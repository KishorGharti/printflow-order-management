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

/**
 * One-time numbering: a shop sets its job prefix + job starting number, and separately its invoice
 * starting number, once. Each is then locked until the platform developer unlocks it for one more
 * change. The locks live in developer_settings so shops cannot change them through /api/settings.
 */
const NUMBERING_LOCKS = {
  job: {
    key: 'job_numbering',
    requestFlag: 'lockJobNumbering',
    fields: [['jobPrefix', 'job_prefix', 'text'], ['jobStartNumber', 'job_start_number', 'number']],
    error: {
      error: 'Job prefix and job starting number can only be set once. Please contact the platform developer to unlock them.',
      code: 'JOB_NUMBERING_LOCKED',
    },
  },
  invoice: {
    key: 'invoice_numbering',
    requestFlag: 'lockInvoiceNumbering',
    fields: [['invoiceStartNumber', 'invoice_start_number', 'number']],
    error: {
      error: 'The invoice starting number can only be set once. Please contact the platform developer to unlock it.',
      code: 'INVOICE_NUMBERING_LOCKED',
    },
  },
};
const JOB_NUMBERING_KEY = NUMBERING_LOCKS.job.key;
const JOB_NUMBERING_LOCKED_ERROR = NUMBERING_LOCKS.job.error;

async function isNumberingLocked(businessId, kind) {
  const { rows } = await pool.query(
    'SELECT value FROM developer_settings WHERE business_id = $1 AND key = $2 LIMIT 1',
    [businessId, NUMBERING_LOCKS[kind].key]
  );
  return rows[0]?.value?.locked === true;
}

async function setNumberingLocked(businessId, kind, locked) {
  await pool.query(
    `INSERT INTO developer_settings (business_id, key, value, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (business_id, key) DO UPDATE SET value = $3, updated_at = NOW()`,
    [businessId, NUMBERING_LOCKS[kind].key, JSON.stringify({ locked, changedAt: new Date().toISOString() })]
  );
}

const isJobNumberingLocked = (businessId) => isNumberingLocked(businessId, 'job');
const setJobNumberingLocked = (businessId, locked) => setNumberingLocked(businessId, 'job', locked);

/** Lock state for the settings responses. */
async function numberingLockState(businessId) {
  const [jobNumberingLocked, invoiceNumberingLocked] = await Promise.all([
    isNumberingLocked(businessId, 'job'),
    isNumberingLocked(businessId, 'invoice'),
  ]);
  return { jobNumberingLocked, invoiceNumberingLocked };
}

function numberingChanged(currentRow, body, kind) {
  return NUMBERING_LOCKS[kind].fields.some(([field, column, type]) => {
    if (body[field] === undefined) return false;
    return type === 'number'
      ? Number(body[field]) !== Number(currentRow?.[column])
      : String(body[field] ?? '').trim() !== String(currentRow?.[column] ?? '').trim();
  });
}

/**
 * Applies the one-time rules before a settings write.
 * Returns { blocked: <error> } when a locked value would change, otherwise which locks to turn on after
 * saving. A lock turns on at the first real change, or when the numbering form asks for it.
 */
async function checkNumbering(key, body, request = {}) {
  const [{ rows }, state] = await Promise.all([
    pool.query('SELECT job_prefix, job_start_number, invoice_start_number FROM settings WHERE key = $1', [key]),
    numberingLockState(key),
  ]);
  const lockedNow = { job: state.jobNumberingLocked, invoice: state.invoiceNumberingLocked };
  const lockAfterSave = [];
  for (const kind of Object.keys(NUMBERING_LOCKS)) {
    const changed = numberingChanged(rows[0], body, kind);
    if (lockedNow[kind] && changed) return { blocked: NUMBERING_LOCKS[kind].error };
    if (!lockedNow[kind] && (changed || request[NUMBERING_LOCKS[kind].requestFlag] === true)) lockAfterSave.push(kind);
  }
  return { blocked: null, lockAfterSave };
}

async function applyLocks(key, kinds) {
  for (const kind of kinds) await setNumberingLocked(key, kind, true);
}

/** GET /api/settings */
const getSettings = async (req, res, next) => {
  try {
    const key = getBusinessKey(req);
    const [{ rows }, locks] = await Promise.all([
      pool.query(`SELECT * FROM settings WHERE key = $1 OR business_id = $1 LIMIT 1`, [key]),
      numberingLockState(key),
    ]);

    if (rows.length) {
      return res.json({ ...rowToDoc(rows[0]), ...locks });
    }

    // Create default settings row if it doesn't exist for this business
    const { rows: created } = await pool.query(
      `INSERT INTO settings (key, business_id) VALUES ($1, $1) ON CONFLICT (key) DO UPDATE SET business_id = EXCLUDED.business_id RETURNING *`,
      [key]
    );
    res.json({ ...rowToDoc(created[0]), ...locks });
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

    const numbering = await checkNumbering(key, body, req.body || {});
    if (numbering.blocked) return res.status(403).json(numbering.blocked);

    const { setClause, values: setValues, nextIdx } = buildSetClause(body, 1);

    if (!setClause) {
      const { rows } = await pool.query(`SELECT * FROM settings WHERE key = $1`, [key]);
      if (!rows.length) return res.status(404).json({ error: 'Settings not found.' });
      await applyLocks(key, numbering.lockAfterSave);
      return res.json({ ...rowToDoc(rows[0]), ...(await numberingLockState(key)) });
    }

    const { rows } = await pool.query(
      `UPDATE settings SET ${setClause} WHERE key = $${nextIdx} RETURNING *`,
      [...setValues, key]
    );
    await applyLocks(key, numbering.lockAfterSave);
    res.json({ ...rowToDoc(rows[0]), ...(await numberingLockState(key)) });
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

    const numbering = await checkNumbering(key, body, data);
    if (numbering.blocked) return res.status(403).json(numbering.blocked);

    const { setClause, values: setValues, nextIdx } = buildSetClause(body, 1);

    if (!setClause) {
      const { rows } = await pool.query(`SELECT * FROM settings WHERE key = $1`, [key]);
      return res.json({ success: true, settings: rows.length ? rowToDoc(rows[0]) : {} });
    }

    const { rows } = await pool.query(
      `UPDATE settings SET ${setClause} WHERE key = $${nextIdx} RETURNING *`,
      [...setValues, key]
    );
    await applyLocks(key, numbering.lockAfterSave);

    logger.info(`📦 Settings migrated to PostgreSQL successfully for key: ${key}`);
    res.json({ success: true, settings: rowToDoc(rows[0]) });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSettings, updateSettings, bulkUpsert,
  setJobNumberingLocked, isJobNumberingLocked, setNumberingLocked, isNumberingLocked, NUMBERING_LOCKS, JOB_NUMBERING_KEY, JOB_NUMBERING_LOCKED_ERROR,
};
