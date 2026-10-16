'use strict';

const { pool } = require('../config/db');
const { rowToDoc, rowsToDocs, buildInsertParts, buildSetClause } = require('../config/dbHelpers');
const { getTenantBusinessId } = require('../middleware/rbac');
const logger = require('../utils/logger');

function resolveVendorWhere(id, businessId) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (isUuid) return { where: 'id = $1', values: [id] };
  if (businessId) {
    return { where: 'local_id = $1 AND business_id = $2', values: [id, businessId] };
  }
  return { where: 'local_id = $1', values: [id] };
}

function enforceVendorRoleGuard(req, res) {
  if (req.user && (req.user.role === 'designer' || req.user.role === 'printer_finishing')) {
    res.status(403).json({ error: `Forbidden: Vendors are restricted from role "${req.user.role}".` });
    return true;
  }
  return false;
}

/** GET /api/vendors — list with search and server-side pagination */
const list = async (req, res, next) => {
  try {
    if (enforceVendorRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 20);
    const offset = req.query.skip !== undefined ? Math.max(0, parseInt(req.query.skip, 10)) : (page - 1) * limit;
    const { search } = req.query;

    const conditions = ['business_id = $1'];
    const values = [businessId];
    let idx = 2;

    if (search) {
      conditions.push(`(name ILIKE $${idx} OR phone ILIKE $${idx} OR email ILIKE $${idx})`);
      values.push(`%${search.trim()}%`);
      idx++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    // Exact count of filtered vendors
    const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM vendors ${where}`, values);
    const total = countRes.rows[0]?.total || 0;

    const { rows } = await pool.query(
      `SELECT * FROM vendors ${where} ORDER BY name ASC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, limit, offset]
    );

    res.json({
      vendors: rowsToDocs(rows),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    next(err);
  }
};

/** GET /api/vendors/:id */
const getById = async (req, res, next) => {
  try {
    if (enforceVendorRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const { where, values } = resolveVendorWhere(req.params.id, businessId);
    const { rows } = await pool.query(`SELECT * FROM vendors WHERE ${where}`, values);
    if (!rows.length) return res.status(404).json({ error: 'Vendor not found.' });
    const item = rows[0];
    if (item.business_id && item.business_id !== businessId) {
      return res.status(403).json({ error: 'Forbidden: Cross-business access is strictly prohibited.' });
    }
    res.json(rowToDoc(item));
  } catch (err) {
    next(err);
  }
};

/** POST /api/vendors */
const create = async (req, res, next) => {
  try {
    if (enforceVendorRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const body = { ...req.body, businessId };
    if (!body.name?.trim()) return res.status(400).json({ error: 'Vendor name is required.' });

    const { cols, placeholders, values } = buildInsertParts(body);
    const { rows } = await pool.query(
      `INSERT INTO vendors (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values
    );
    res.status(201).json(rowToDoc(rows[0]));
  } catch (err) {
    next(err);
  }
};

/** PUT /api/vendors/:id */
const update = async (req, res, next) => {
  try {
    if (enforceVendorRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const { where, values: whereValues } = resolveVendorWhere(req.params.id, businessId);

    const { rows: existing } = await pool.query(`SELECT id, business_id FROM vendors WHERE ${where}`, whereValues);
    if (!existing.length) return res.status(404).json({ error: 'Vendor not found.' });
    if (existing[0].business_id && existing[0].business_id !== businessId) {
      return res.status(403).json({ error: 'Forbidden: Cross-business modification is strictly prohibited.' });
    }

    const { setClause, values: setValues } = buildSetClause(req.body);
    if (!setClause) return res.status(400).json({ error: 'No fields to update.' });

    const nextIdx = setValues.length + 1;
    const { rows } = await pool.query(
      `UPDATE vendors SET ${setClause} WHERE id = $${nextIdx} RETURNING *`,
      [...setValues, existing[0].id]
    );
    res.json(rowToDoc(rows[0]));
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/vendors/:id */
const remove = async (req, res, next) => {
  try {
    if (enforceVendorRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const { where, values } = resolveVendorWhere(req.params.id, businessId);

    const { rows: existing } = await pool.query(`SELECT id, business_id FROM vendors WHERE ${where}`, values);
    if (!existing.length) return res.status(404).json({ error: 'Vendor not found.' });
    if (existing[0].business_id && existing[0].business_id !== businessId) {
      return res.status(403).json({ error: 'Forbidden: Cross-business deletion is strictly prohibited.' });
    }

    await pool.query(`DELETE FROM vendors WHERE id = $1`, [existing[0].id]);
    res.json({ success: true, deletedId: req.params.id });
  } catch (err) {
    next(err);
  }
};

/** POST /api/vendors/bulk */
const bulkUpsert = async (req, res, next) => {
  try {
    if (enforceVendorRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const items = req.body.vendors;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'vendors array is required.' });
    }

    let inserted = 0;
    let updated  = 0;

    for (const item of items) {
      const localId = item.id || item.localId;
      const cleanItem = { ...item, businessId, localId: localId || `vendor-${Date.now()}` };
      delete cleanItem.id;
      delete cleanItem._id;

      const existRes = localId
        ? await pool.query(`SELECT id FROM vendors WHERE local_id = $1 AND business_id = $2 LIMIT 1`, [localId, businessId])
        : await pool.query(`SELECT id FROM vendors WHERE name = $1 AND business_id = $2 LIMIT 1`, [item.name, businessId]);

      if (existRes.rows.length) {
        const { setClause, values: setValues } = buildSetClause(cleanItem);
        if (setClause) {
          await pool.query(
            `UPDATE vendors SET ${setClause} WHERE id = $${setValues.length + 1}`,
            [...setValues, existRes.rows[0].id]
          );
        }
        updated++;
      } else {
        try {
          const { cols, placeholders, values } = buildInsertParts(cleanItem);
          await pool.query(
            `INSERT INTO vendors (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`,
            values
          );
          inserted++;
        } catch (e) {
          if (e.code !== '23505') throw e;
        }
      }
    }

    logger.info(`📦 Bulk vendors upsert (business=${businessId}): ${inserted} inserted, ${updated} updated.`);
    res.json({ success: true, inserted, updated });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getById, create, update, remove, bulkUpsert };
