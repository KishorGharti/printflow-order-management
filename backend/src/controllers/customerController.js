'use strict';

const { pool } = require('../config/db');
const { rowToDoc, rowsToDocs, buildInsertParts, buildSetClause } = require('../config/dbHelpers');
const { getTenantBusinessId } = require('../middleware/rbac');
const logger = require('../utils/logger');

function resolveCustomerWhere(id, businessId) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (isUuid) return { where: 'id = $1', values: [id] };
  if (businessId) {
    return { where: 'local_id = $1 AND business_id = $2', values: [id, businessId] };
  }
  return { where: 'local_id = $1', values: [id] };
}

function enforceClientRoleGuard(req, res) {
  if (req.user && (req.user.role === 'designer' || req.user.role === 'printer_finishing')) {
    res.status(403).json({ error: `Forbidden: Client records are restricted from role "${req.user.role}".` });
    return true;
  }
  return false;
}

/** GET /api/customers — list with search, sorting and server-side pagination */
const list = async (req, res, next) => {
  try {
    if (enforceClientRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 20);
    const offset = req.query.skip !== undefined ? Math.max(0, parseInt(req.query.skip, 10)) : (page - 1) * limit;
    const { search } = req.query;

    const conditions = ['business_id = $1'];
    const values = [businessId];
    let idx = 2;

    if (search) {
      conditions.push(`(name ILIKE $${idx} OR business_name ILIKE $${idx} OR phone ILIKE $${idx} OR email ILIKE $${idx})`);
      values.push(`%${search.trim()}%`);
      idx++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    // Exact count of filtered customers
    const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM customers ${where}`, values);
    const total = countRes.rows[0]?.total || 0;

    const { rows } = await pool.query(
      `SELECT * FROM customers ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, limit, offset]
    );

    res.json({
      customers: rowsToDocs(rows),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    next(err);
  }
};

/** GET /api/customers/:id */
const getById = async (req, res, next) => {
  try {
    if (enforceClientRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const { where, values } = resolveCustomerWhere(req.params.id, businessId);
    const { rows } = await pool.query(`SELECT * FROM customers WHERE ${where}`, values);
    if (!rows.length) return res.status(404).json({ error: 'Customer not found.' });

    const cust = rows[0];
    if (cust.business_id && cust.business_id !== businessId) {
      return res.status(403).json({ error: 'Forbidden: Cross-business access is strictly prohibited.' });
    }

    res.json(rowToDoc(cust));
  } catch (err) {
    next(err);
  }
};

/** POST /api/customers */
const create = async (req, res, next) => {
  try {
    if (enforceClientRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const body = { ...req.body, businessId };
    if (!body.name?.trim()) return res.status(400).json({ error: 'Customer name is required.' });

    const { cols, placeholders, values } = buildInsertParts(body);
    const { rows } = await pool.query(
      `INSERT INTO customers (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values
    );
    res.status(201).json(rowToDoc(rows[0]));
  } catch (err) {
    next(err);
  }
};

/** PUT /api/customers/:id */
const update = async (req, res, next) => {
  try {
    if (enforceClientRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const { where, values: whereValues } = resolveCustomerWhere(req.params.id, businessId);

    const existRes = await pool.query(`SELECT * FROM customers WHERE ${where}`, whereValues);
    if (!existRes.rows.length) return res.status(404).json({ error: 'Customer not found.' });

    const current = existRes.rows[0];
    if (current.business_id && current.business_id !== businessId) {
      return res.status(403).json({ error: 'Forbidden: Cross-business access is strictly prohibited.' });
    }

    const body = { ...req.body };
    delete body.businessId;
    delete body.business_id;

    const { setClause, values: setValues } = buildSetClause(body);
    if (!setClause) return res.status(400).json({ error: 'No fields to update.' });

    const shiftedWhere = where.replace(/\$(\d+)/g, (_, num) => `$${Number(num) + setValues.length}`);
    const { rows } = await pool.query(
      `UPDATE customers SET ${setClause} WHERE ${shiftedWhere} RETURNING *`,
      [...setValues, ...whereValues]
    );
    res.json(rowToDoc(rows[0]));
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/customers/:id */
const remove = async (req, res, next) => {
  try {
    if (enforceClientRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const { where, values } = resolveCustomerWhere(req.params.id, businessId);

    const existRes = await pool.query(`SELECT * FROM customers WHERE ${where}`, values);
    if (!existRes.rows.length) return res.status(404).json({ error: 'Customer not found.' });

    const current = existRes.rows[0];
    if (current.business_id && current.business_id !== businessId) {
      return res.status(403).json({ error: 'Forbidden: Cross-business access is strictly prohibited.' });
    }

    await pool.query(`DELETE FROM customers WHERE ${where}`, values);
    res.json({ success: true, deletedId: req.params.id });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/customers/bulk
 * Batch upsert for migrating customers from browser localStorage.
 */
const bulkUpsert = async (req, res, next) => {
  try {
    if (enforceClientRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const items = req.body.customers;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'customers array is required.' });
    }

    let inserted = 0;
    let updated = 0;

    for (const item of items) {
      const localId = item.id || item.localId;
      const isProfile = Boolean(item.isProfileAccount || localId === 'cust-profile-business');

      const cleanItem = { ...item, localId: localId || `cust-${Date.now()}`, businessId };
      delete cleanItem.id;
      delete cleanItem._id;

      let existRow = null;

      if (isProfile) {
        const r = await pool.query(
          `SELECT id FROM customers WHERE (is_profile_account = true OR local_id = 'cust-profile-business') AND business_id = $1 LIMIT 1`,
          [businessId]
        );
        existRow = r.rows[0] || null;
      } else if (localId) {
        const r = await pool.query(`SELECT id FROM customers WHERE local_id = $1 AND business_id = $2 LIMIT 1`, [localId, businessId]);
        existRow = r.rows[0] || null;
      } else if (item.phone) {
        const r = await pool.query(`SELECT id FROM customers WHERE phone = $1 AND name = $2 AND business_id = $3 LIMIT 1`, [item.phone, item.name, businessId]);
        existRow = r.rows[0] || null;
      }

      if (existRow) {
        const { setClause, values: setValues } = buildSetClause(cleanItem);
        if (setClause) {
          await pool.query(
            `UPDATE customers SET ${setClause} WHERE id = $${setValues.length + 1}`,
            [...setValues, existRow.id]
          );
        }
        updated++;
      } else {
        try {
          const { cols, placeholders, values } = buildInsertParts(cleanItem);
          await pool.query(
            `INSERT INTO customers (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`,
            values
          );
          inserted++;
        } catch (e) {
          if (e.code !== '23505') throw e;
        }
      }
    }

    logger.info(`📦 Bulk customers upsert: ${inserted} inserted, ${updated} updated for business: ${businessId}`);
    res.json({ success: true, inserted, updated });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getById, create, update, remove, bulkUpsert };
