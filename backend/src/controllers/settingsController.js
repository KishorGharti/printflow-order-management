'use strict';

const { pool } = require('../config/db');
const { rowToDoc, buildSetClause } = require('../config/dbHelpers');
const { getTenantBusinessId } = require('../middleware/rbac');
const logger = require('../utils/logger');

const SETTINGS_KEY = 'global_settings';

/**
 * Whitelist of camelCase field names that map to actual DB columns.
 * Any extra frontend-only fields (billReferenceConfig, chalanReferenceConfig,
 * darkMode, key, id, etc.) are silently stripped before building the SQL clause.
 * Note: 'key' is intentionally excluded — it is the conflict target and must
 * not appear in the SET clause to avoid parameter count mismatches.
 */
const ALLOWED_FIELDS = new Set([
  'shopName', 'shopPhone', 'shopEmail', 'shopAddress', 'shopLogo',
  'ownerName', 'businessCategory',
  'openingBalance', 'openingBalanceDate',
  'currency', 'dateMode',
  'jobPrefix', 'jobStartNumber',
  'invoicePrefix', 'invoiceStartNumber',
  'brandPrimary', 'appearance',
  'whatsappNotificationsEnabled', 'whatsappSenderNumber', 'whatsappTemplate',
  'balanceSheetHeaderColor', 'balanceSheetHeaderTextColor',
  'balanceSheetFooterColor', 'balanceSheetFooterTextColor',
  'balanceSheetAlternateColor', 'balanceSheetAlternateTint',
  'allTransactionsHeaderColor', 'allTransactionsHeaderTextColor',
  'allTransactionsFooterColor', 'allTransactionsFooterTextColor',
  'allTransactionsAlternateColor', 'allTransactionsAlternateTint',
  'billReferenceConfig', 'chalanReferenceConfig',
]);

/**
 * Strip all fields that are not in the DB column whitelist.
 * This prevents "column X does not exist" errors when the frontend
 * sends computed/frontend-only fields like billReferenceConfig.
 */
function filterBody(raw) {
  const filtered = {};
  for (const [k, v] of Object.entries(raw)) {
    if (ALLOWED_FIELDS.has(k)) filtered[k] = v;
  }
  return filtered;
}

/**
 * Resolves the business / tenant key strictly from the authenticated user.
 */
function getBusinessKey(req) {
  return getTenantBusinessId(req);
}

/** GET /api/settings */
const getSettings = async (req, res, next) => {
  try {
    const key = getBusinessKey(req);
    const { rows } = await pool.query(`SELECT * FROM settings WHERE key = $1 OR business_id = $1 LIMIT 1`, [key]);

    if (rows.length) {
      return res.json(rowToDoc(rows[0]));
    }

    // Create default settings row if it doesn't exist for this business
    const { rows: created } = await pool.query(
      `INSERT INTO settings (key, business_id) VALUES ($1, $1) ON CONFLICT (key) DO UPDATE SET business_id = EXCLUDED.business_id RETURNING *`,
      [key]
    );
    res.json(rowToDoc(created[0]));
  } catch (err) {
    next(err);
  }
};

/** PUT /api/settings */
const updateSettings = async (req, res, next) => {
  try {
    if (req.user && (req.user.role === 'designer' || req.user.role === 'printer_finishing')) {
      return res.status(403).json({ error: `Forbidden: Settings modification is restricted from role "${req.user.role}".` });
    }
    const key = getBusinessKey(req);
    const body = filterBody(req.body);

    // Ensure the settings row exists for this business key
    await pool.query(
      `INSERT INTO settings (key, business_id) VALUES ($1, $1) ON CONFLICT (key) DO UPDATE SET business_id = EXCLUDED.business_id`,
      [key]
    );

    const { setClause, values: setValues, nextIdx } = buildSetClause(body, 1);

    if (!setClause) {
      const { rows } = await pool.query(`SELECT * FROM settings WHERE key = $1`, [key]);
      if (!rows.length) return res.status(404).json({ error: 'Settings not found.' });
      return res.json(rowToDoc(rows[0]));
    }

    const { rows } = await pool.query(
      `UPDATE settings SET ${setClause} WHERE key = $${nextIdx} RETURNING *`,
      [...setValues, key]
    );
    res.json(rowToDoc(rows[0]));
  } catch (err) {
    next(err);
  }
};

/** POST /api/settings/bulk — used during initial localStorage migration */
const bulkUpsert = async (req, res, next) => {
  try {
    if (req.user && (req.user.role === 'designer' || req.user.role === 'printer_finishing')) {
      return res.status(403).json({ error: `Forbidden: Settings modification is restricted from role "${req.user.role}".` });
    }
    const key = getBusinessKey(req);
    const data = req.body.settings || req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'settings object is required.' });
    }

    const body = filterBody(data);

    // Ensure the settings row exists for this business key
    await pool.query(
      `INSERT INTO settings (key, business_id) VALUES ($1, $1) ON CONFLICT (key) DO UPDATE SET business_id = EXCLUDED.business_id`,
      [key]
    );

    const { setClause, values: setValues, nextIdx } = buildSetClause(body, 1);

    if (!setClause) {
      const { rows } = await pool.query(`SELECT * FROM settings WHERE key = $1`, [key]);
      return res.json({ success: true, settings: rows.length ? rowToDoc(rows[0]) : {} });
    }

    const { rows } = await pool.query(
      `UPDATE settings SET ${setClause} WHERE key = $${nextIdx} RETURNING *`,
      [...setValues, key]
    );

    logger.info(`📦 Settings migrated to PostgreSQL successfully for key: ${key}`);
    res.json({ success: true, settings: rowToDoc(rows[0]) });
  } catch (err) {
    next(err);
  }
};

module.exports = { getSettings, updateSettings, bulkUpsert };
