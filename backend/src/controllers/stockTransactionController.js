'use strict';

const { pool } = require('../config/db');
const { rowToDoc, rowsToDocs, buildInsertParts } = require('../config/dbHelpers');
const { getTenantBusinessId } = require('../middleware/rbac');
const logger = require('../utils/logger');

function enforceStockRoleGuard(req, res) {
  if (req.user && (req.user.role === 'designer' || req.user.role === 'printer_finishing')) {
    res.status(403).json({ error: `Forbidden: Stock transactions are restricted from role "${req.user.role}".` });
    return true;
  }
  return false;
}

/** GET /api/stock-transactions — list with filters and server-side pagination */
const list = async (req, res, next) => {
  try {
    if (enforceStockRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 20);
    const offset = req.query.skip !== undefined ? Math.max(0, parseInt(req.query.skip, 10)) : (page - 1) * limit;
    const { inventoryItemId, orderId } = req.query;

    const conditions = ['business_id = $1'];
    const values = [businessId];
    let idx = 2;

    if (inventoryItemId) { conditions.push(`inventory_item_id = $${idx++}`); values.push(inventoryItemId); }
    if (orderId)         { conditions.push(`order_id = $${idx++}`);          values.push(orderId); }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM stock_transactions ${where}`, values);
    const total = countRes.rows[0]?.total || 0;

    const { rows } = await pool.query(
      `SELECT * FROM stock_transactions ${where} ORDER BY "timestamp" DESC, created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, limit, offset]
    );

    res.json({
      transactions: rowsToDocs(rows),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    next(err);
  }
};

/** POST /api/stock-transactions */
const create = async (req, res, next) => {
  try {
    if (enforceStockRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const body = { ...req.body, businessId };
    if (!body.inventoryItemId) return res.status(400).json({ error: 'inventoryItemId is required.' });
    if (body.quantity === undefined) return res.status(400).json({ error: 'quantity is required.' });

    const { cols, placeholders, values } = buildInsertParts(body);
    const { rows } = await pool.query(
      `INSERT INTO stock_transactions (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values
    );
    res.status(201).json(rowToDoc(rows[0]));
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/stock-transactions/bulk
 */
const bulkUpsert = async (req, res, next) => {
  try {
    if (enforceStockRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const items = req.body.transactions;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'transactions array is required.' });
    }

    let inserted = 0;

    for (const item of items) {
      const localId = item.id || item.localId;
      const cleanItem = { ...item, businessId, localId: localId || `stocktxn-${Date.now()}` };
      delete cleanItem.id;
      delete cleanItem._id;

      if (localId) {
        const exists = await pool.query(`SELECT id FROM stock_transactions WHERE local_id = $1 AND business_id = $2 LIMIT 1`, [localId, businessId]);
        if (exists.rows.length) continue;
      }

      try {
        const { cols, placeholders, values } = buildInsertParts(cleanItem);
        await pool.query(
          `INSERT INTO stock_transactions (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`,
          values
        );
        inserted++;
      } catch (e) {
        if (e.code !== '23505') throw e;
      }
    }

    logger.info(`📦 Bulk stock transactions upsert (business=${businessId}): ${inserted} inserted.`);
    res.json({ success: true, inserted });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, create, bulkUpsert };
