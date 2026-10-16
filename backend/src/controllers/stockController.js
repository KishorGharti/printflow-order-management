'use strict';

const { pool } = require('../config/db');
const { rowToDoc, rowsToDocs, buildInsertParts, buildSetClause } = require('../config/dbHelpers');
const { getTenantBusinessId } = require('../middleware/rbac');
const logger = require('../utils/logger');

function resolveStockWhere(id, businessId) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (isUuid) return { where: 'id = $1', values: [id] };
  if (businessId) {
    return { where: 'local_id = $1 AND business_id = $2', values: [id, businessId] };
  }
  return { where: 'local_id = $1', values: [id] };
}

function enforceStockRoleGuard(req, res) {
  if (req.user && (req.user.role === 'designer' || req.user.role === 'printer_finishing')) {
    res.status(403).json({ error: `Forbidden: Stock management is restricted from role "${req.user.role}".` });
    return true;
  }
  return false;
}

/** GET /api/stock — list with search, category filter and server-side pagination */
const list = async (req, res, next) => {
  try {
    if (enforceStockRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 20);
    const offset = req.query.skip !== undefined ? Math.max(0, parseInt(req.query.skip, 10)) : (page - 1) * limit;
    const { search, category, activeOnly } = req.query;

    const conditions = ['business_id = $1'];
    const values = [businessId];
    let idx = 2;

    if (activeOnly === 'true') { conditions.push(`is_archived = false`); }
    if (category && category !== 'ALL') { conditions.push(`category = $${idx++}`); values.push(category); }
    if (search) {
      conditions.push(`(name ILIKE $${idx} OR category ILIKE $${idx} OR vendor ILIKE $${idx})`);
      values.push(`%${search.trim()}%`);
      idx++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    // Exact count of filtered stock items
    const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM stock_items ${where}`, values);
    const total = countRes.rows[0]?.total || 0;

    const { rows } = await pool.query(
      `SELECT * FROM stock_items ${where} ORDER BY name ASC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, limit, offset]
    );

    const docs = rowsToDocs(rows);
    logger.info(`📦 [GET /api/stock] Returned page ${page} (${docs.length} of ${total} records) (business=${businessId})`);
    res.json({
      stock: docs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    next(err);
  }
};

/** GET /api/stock/:id */
const getById = async (req, res, next) => {
  try {
    if (enforceStockRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const { where, values } = resolveStockWhere(req.params.id, businessId);
    const { rows } = await pool.query(`SELECT * FROM stock_items WHERE ${where}`, values);
    if (!rows.length) return res.status(404).json({ error: 'Stock item not found.' });
    const item = rows[0];
    if (item.business_id && item.business_id !== businessId) {
      return res.status(403).json({ error: 'Forbidden: Cross-business access is strictly prohibited.' });
    }
    res.json(rowToDoc(item));
  } catch (err) {
    next(err);
  }
};

/** POST /api/stock */
const create = async (req, res, next) => {
  try {
    if (enforceStockRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const body = { ...req.body, businessId };
    const name = body.name?.trim();
    if (!name) return res.status(400).json({ error: 'Item name is required.' });

    const parentId = body.parentId || '';
    const whereScope = parentId ? `parent_id = $3` : `(parent_id IS NULL OR parent_id = '')`;
    const checkParams = parentId ? [name, businessId, parentId] : [name, businessId];

    const { rows: existing } = await pool.query(
      `SELECT id, name FROM stock_items WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND business_id = $2 AND is_archived = false AND ${whereScope} LIMIT 1`,
      checkParams
    );

    if (existing.length) {
      return res.status(409).json({
        error: parentId ? `A sub item named "${name}" already exists.` : `Product "${name}" already exists in stock.`
      });
    }

    const { cols, placeholders, values } = buildInsertParts(body);
    const { rows } = await pool.query(
      `INSERT INTO stock_items (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values
    );
    const doc = rowToDoc(rows[0]);
    logger.info(`📦 [POST /api/stock] Persisted: id=${doc.id}, name="${doc.name}", qty=${doc.quantity}, business=${businessId}`);
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
};

/** PUT /api/stock/:id */
const update = async (req, res, next) => {
  try {
    if (enforceStockRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const { where, values: whereValues } = resolveStockWhere(req.params.id, businessId);

    // Verify ownership before updating
    const { rows: existing } = await pool.query(`SELECT id, business_id FROM stock_items WHERE ${where}`, whereValues);
    if (!existing.length) return res.status(404).json({ error: 'Stock item not found.' });
    if (existing[0].business_id && existing[0].business_id !== businessId) {
      return res.status(403).json({ error: 'Forbidden: Cross-business modification is strictly prohibited.' });
    }

    const { setClause, values: setValues } = buildSetClause(req.body);
    if (!setClause) return res.status(400).json({ error: 'No fields to update.' });

    const nextIdx = setValues.length + 1;
    const { rows } = await pool.query(
      `UPDATE stock_items SET ${setClause} WHERE id = $${nextIdx} RETURNING *`,
      [...setValues, existing[0].id]
    );
    const doc = rowToDoc(rows[0]);
    logger.info(`📦 [PUT /api/stock/:id] Updated: id=${doc.id}, name="${doc.name}", qty=${doc.quantity}`);
    res.json(doc);
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/stock/:id */
const remove = async (req, res, next) => {
  try {
    if (enforceStockRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const { where, values } = resolveStockWhere(req.params.id, businessId);

    // Verify ownership before deleting
    const { rows: existing } = await pool.query(`SELECT id, business_id FROM stock_items WHERE ${where}`, values);
    if (!existing.length) return res.status(404).json({ error: 'Stock item not found.' });
    if (existing[0].business_id && existing[0].business_id !== businessId) {
      return res.status(403).json({ error: 'Forbidden: Cross-business deletion is strictly prohibited.' });
    }

    await pool.query(`DELETE FROM stock_items WHERE id = $1`, [existing[0].id]);
    res.json({ success: true, deletedId: req.params.id });
  } catch (err) {
    next(err);
  }
};

/** POST /api/stock/bulk */
const bulkUpsert = async (req, res, next) => {
  try {
    if (enforceStockRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const items = req.body.stock;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'stock array is required.' });
    }

    let inserted = 0;
    let updated  = 0;

    for (const item of items) {
      const rawId = item.id || item._id;
      const isUuid = Boolean(rawId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(rawId)));
      const localId = item.localId || (!isUuid && rawId ? String(rawId) : null);

      const cleanItem = { ...item, businessId, localId: localId || (isUuid ? null : `stock-${Date.now()}`) };
      delete cleanItem.id;
      delete cleanItem._id;
      if (cleanItem.localId === null) delete cleanItem.localId;

      let existRes = { rows: [] };
      if (isUuid) {
        existRes = await pool.query(`SELECT id FROM stock_items WHERE id = $1 AND business_id = $2 LIMIT 1`, [rawId, businessId]);
      }
      if (!existRes.rows.length && localId) {
        existRes = await pool.query(`SELECT id FROM stock_items WHERE local_id = $1 AND business_id = $2 LIMIT 1`, [localId, businessId]);
      }
      if (!existRes.rows.length && item.name?.trim()) {
        const parentId = item.parentId || null;
        existRes = parentId
          ? await pool.query(`SELECT id FROM stock_items WHERE LOWER(name) = LOWER($1) AND parent_id = $2 AND business_id = $3 LIMIT 1`, [item.name.trim(), parentId, businessId])
          : await pool.query(`SELECT id FROM stock_items WHERE LOWER(name) = LOWER($1) AND (parent_id IS NULL OR parent_id = '') AND business_id = $2 LIMIT 1`, [item.name.trim(), businessId]);
      }

      if (existRes.rows.length) {
        const { setClause, values: setValues } = buildSetClause(cleanItem);
        if (setClause) {
          await pool.query(
            `UPDATE stock_items SET ${setClause} WHERE id = $${setValues.length + 1}`,
            [...setValues, existRes.rows[0].id]
          );
        }
        updated++;
      } else {
        try {
          const { cols, placeholders, values } = buildInsertParts(cleanItem);
          await pool.query(
            `INSERT INTO stock_items (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`,
            values
          );
          inserted++;
        } catch (e) {
          if (e.code !== '23505') throw e;
        }
      }
    }

    logger.info(`📦 Bulk stock upsert (business=${businessId}): ${inserted} inserted, ${updated} updated.`);
    res.json({ success: true, inserted, updated });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getById, create, update, remove, bulkUpsert };
