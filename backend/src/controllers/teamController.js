'use strict';

const { pool } = require('../config/db');
const { rowToDoc, rowsToDocs, buildInsertParts, buildSetClause } = require('../config/dbHelpers');
const { hashPassword, sanitizeUser } = require('../utils/authHelper');
const { getTenantBusinessId } = require('../middleware/rbac');
const { ROLES } = require('../config/permissions');
const logger = require('../utils/logger');

function resolveTeamWhere(id) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (isUuid) return { where: 'id = $1', values: [id] };
  return { where: 'local_id = $1', values: [id] };
}

function enforceTeamRoleGuard(req, res) {
  if (!req.user) return true;
  const role = String(req.user.role || '').toLowerCase();
  if (role.includes('owner') || role.includes('super_admin') || role.includes('developer')) {
    return false;
  }
  res.status(403).json({ error: `Forbidden: Team and staff management are restricted to Owner accounts.` });
  return true;
}

function normalizeRole(roleInput, defaultRole = ROLES.RECEPTION) {
  if (!roleInput) return defaultRole;
  const parts = String(roleInput)
    .split(',')
    .map(r => r.trim().toLowerCase())
    .filter(r => Object.values(ROLES).includes(r));
  return parts.length ? parts.join(',') : defaultRole;
}

/** GET /api/team — list with search, role filters and server-side pagination */
const list = async (req, res, next) => {
  try {
    if (enforceTeamRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 20);
    const offset = req.query.skip !== undefined ? Math.max(0, parseInt(req.query.skip, 10)) : (page - 1) * limit;
    const { search, role, status } = req.query;

    const conditions = ['business_id = $1'];
    const values = [businessId];
    let idx = 2;

    if (status && status !== 'ALL') {
      conditions.push(`status = $${idx++}`);
      values.push(status);
    }
    if (role && role !== 'ALL') {
      conditions.push(`role ILIKE $${idx++}`);
      values.push(`%${role}%`);
    }
    if (search) {
      conditions.push(`(name ILIKE $${idx} OR job_title ILIKE $${idx} OR phone ILIKE $${idx} OR email ILIKE $${idx} OR employee_id ILIKE $${idx})`);
      values.push(`%${search.trim()}%`);
      idx++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    // Exact count of filtered employees
    const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM team_members ${where}`, values);
    const total = countRes.rows[0]?.total || 0;

    const { rows } = await pool.query(
      `SELECT * FROM team_members ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, limit, offset]
    );

    const team = rows.map((r) => sanitizeUser(rowToDoc(r)));
    res.json({
      team,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    next(err);
  }
};

/** GET /api/team/:id */
const getById = async (req, res, next) => {
  try {
    if (enforceTeamRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const { where, values } = resolveTeamWhere(req.params.id);

    const { rows } = await pool.query(`SELECT * FROM team_members WHERE ${where}`, values);
    if (!rows.length) return res.status(404).json({ error: 'Team member not found.' });

    const member = rows[0];
    if (member.business_id && member.business_id !== businessId) {
      return res.status(403).json({ error: 'Forbidden: Cross-business access is strictly prohibited.' });
    }

    res.json(sanitizeUser(rowToDoc(member)));
  } catch (err) {
    next(err);
  }
};

/** POST /api/team */
const create = async (req, res, next) => {
  try {
    if (enforceTeamRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const body = { ...req.body };

    if (!body.name?.trim())     return res.status(400).json({ error: 'Member name is required.' });
    if (!body.jobTitle?.trim()) return res.status(400).json({ error: 'Job title is required.' });

    // Multi-tenant business binding
    body.businessId = businessId;

    // Hash password if supplied
    if (body.password) {
      body.passwordHash = hashPassword(body.password);
      delete body.password;
    } else if (body.pin) {
      body.passwordHash = hashPassword(body.pin);
    }

    // Role assignment & normalization (supports single and combined roles like 'designer,printer_finishing')
    body.role = normalizeRole(body.role, ROLES.RECEPTION);

    // Sync isActive and status
    if (body.isActive !== undefined) {
      body.isActive = Boolean(body.isActive);
      if (!body.status) body.status = body.isActive ? 'active' : 'inactive';
    } else if (body.status !== undefined) {
      body.isActive = body.status !== 'inactive';
    }

    // Auto-generate employeeId if not provided (store-prefixed)
    if (!body.employeeId && !body.employee_id) {
      let prefix = 'PG';
      if (businessId !== 'global_settings') {
        const bRes = await pool.query('SELECT shop_code, name FROM businesses WHERE business_id = $1 LIMIT 1', [businessId]);
        const bRow = bRes.rows[0];
        if (bRow?.shop_code) {
          prefix = bRow.shop_code.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
        } else if (bRow?.name) {
          prefix = bRow.name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
        } else {
          prefix = String(businessId).replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'EMP';
        }
      }
      const countRes = await pool.query('SELECT COUNT(*)::int as count FROM team_members WHERE business_id = $1', [businessId]);
      const nextNum = (countRes.rows[0]?.count || 0) + 1;
      body.employeeId = `${prefix}-EMP-${String(nextNum).padStart(3, '0')}`;
    }

    const { cols, placeholders, values } = buildInsertParts(body);
    const { rows } = await pool.query(
      `INSERT INTO team_members (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values
    );

    res.status(201).json(sanitizeUser(rowToDoc(rows[0])));
  } catch (err) {
    next(err);
  }
};

/** PUT /api/team/:id */
const update = async (req, res, next) => {
  try {
    if (enforceTeamRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const { where, values: whereValues } = resolveTeamWhere(req.params.id);

    // Verify existence and multi-tenant security
    const existing = await pool.query(`SELECT * FROM team_members WHERE ${where}`, whereValues);
    if (!existing.rows.length) return res.status(404).json({ error: 'Team member not found.' });

    const current = existing.rows[0];
    if (current.business_id && current.business_id !== businessId) {
      return res.status(403).json({ error: 'Forbidden: Cross-business access is strictly prohibited.' });
    }

    const body = { ...req.body };
    delete body.businessId;
    delete body.business_id;

    // Password reset / update
    if (body.password) {
      body.passwordHash = hashPassword(body.password);
      delete body.password;
    } else if (body.pin) {
      body.passwordHash = hashPassword(body.pin);
    }

    // Role update
    if (body.role !== undefined) {
      body.role = normalizeRole(body.role, current.role);
    }

    // Status / isActive sync
    if (body.isActive !== undefined) {
      body.isActive = Boolean(body.isActive);
      if (!body.status) body.status = body.isActive ? 'active' : 'inactive';
    } else if (body.status !== undefined) {
      body.isActive = body.status !== 'inactive';
    }

    const { setClause, values: setValues } = buildSetClause(body);
    if (!setClause) return res.status(400).json({ error: 'No fields to update.' });

    const nextIdx = setValues.length + 1;
    const { rows } = await pool.query(
      `UPDATE team_members SET ${setClause} WHERE ${where.replace('$1', `$${nextIdx}`)} RETURNING *`,
      [...setValues, ...whereValues]
    );

    res.json(sanitizeUser(rowToDoc(rows[0])));
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/team/:id */
const remove = async (req, res, next) => {
  try {
    if (enforceTeamRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const { where, values } = resolveTeamWhere(req.params.id);

    // Verify existence and multi-tenant isolation
    const existing = await pool.query(`SELECT * FROM team_members WHERE ${where}`, values);
    if (!existing.rows.length) return res.status(404).json({ error: 'Team member not found.' });

    const current = existing.rows[0];
    if (current.business_id && current.business_id !== businessId) {
      return res.status(403).json({ error: 'Forbidden: Cross-business access is strictly prohibited.' });
    }

    await pool.query(`DELETE FROM team_members WHERE ${where}`, values);
    res.json({ success: true, deletedId: req.params.id });
  } catch (err) {
    next(err);
  }
};

/** POST /api/team/bulk */
const bulkUpsert = async (req, res, next) => {
  try {
    if (enforceTeamRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const items = req.body.team;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'team array is required.' });
    }

    let inserted = 0;
    let updated  = 0;

    for (const item of items) {
      const localId = item.id || item.localId;
      const cleanItem = {
        ...item,
        businessId,
        localId: localId || `tm-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      };
      delete cleanItem.id;
      delete cleanItem._id;

      if (cleanItem.password) {
        cleanItem.passwordHash = hashPassword(cleanItem.password);
        delete cleanItem.password;
      }

      const existRes = localId
        ? await pool.query(`SELECT id, business_id FROM team_members WHERE local_id = $1 LIMIT 1`, [localId])
        : await pool.query(`SELECT id, business_id FROM team_members WHERE name = $1 AND business_id = $2 LIMIT 1`, [item.name, businessId]);

      if (existRes.rows.length) {
        if (existRes.rows[0].business_id && existRes.rows[0].business_id !== businessId) {
          continue; // Skip cross-tenant overwrites
        }
        const { setClause, values: setValues } = buildSetClause(cleanItem);
        if (setClause) {
          await pool.query(
            `UPDATE team_members SET ${setClause} WHERE id = $${setValues.length + 1}`,
            [...setValues, existRes.rows[0].id]
          );
        }
        updated++;
      } else {
        try {
          const { cols, placeholders, values } = buildInsertParts(cleanItem);
          await pool.query(
            `INSERT INTO team_members (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`,
            values
          );
          inserted++;
        } catch (e) {
          if (e.code !== '23505') throw e;
        }
      }
    }

    logger.info(`📦 Bulk team upsert: ${inserted} inserted, ${updated} updated for business: ${businessId}`);
    res.json({ success: true, inserted, updated });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getById, create, update, remove, bulkUpsert, normalizeRole };
