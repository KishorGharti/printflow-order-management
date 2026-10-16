'use strict';

const crypto = require('crypto');
const { pool } = require('../config/db');
const { env } = require('../config/env');
const { getTenantBusinessId } = require('../middleware/rbac');
const logger = require('../utils/logger');

const BACKUP_APP_ID = 'print-ghar-order-manager-backup';
const SIGN_ALG = 'HMAC-SHA256';

/**
 * Root signing key. Prefer a dedicated BACKUP_SIGNING_KEY; fall back to a key derived
 * from API_SECRET_KEY so the signature is never the same as the JWT secret itself.
 */
function getRootKey() {
  const dedicated = process.env.BACKUP_SIGNING_KEY;
  if (dedicated) return dedicated;
  return crypto.createHmac('sha256', String(env.API_SECRET_KEY || '')).update('print-ghar-backup-signing-v1').digest('hex');
}

/** Per-business key — a backup signed for business A can never be restored into business B. */
function getBusinessKey(businessId) {
  return crypto.createHmac('sha256', getRootKey()).update(`business:${businessId}`).digest();
}

/** Deterministic JSON (sorted keys) so the signature does not depend on key order or whitespace. */
function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value === undefined ? null : value);
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  const keys = Object.keys(value).filter(k => value[k] !== undefined).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalize(value[k])).join(',') + '}';
}

function computeSignature(payloadWithoutIntegrity, businessId) {
  return crypto
    .createHmac('sha256', getBusinessKey(businessId))
    .update(canonicalize(payloadWithoutIntegrity))
    .digest('hex');
}

function stripIntegrity(payload) {
  const { integrity, ...rest } = payload || {};
  return { rest, integrity };
}

function isOwnerLike(user) {
  const roles = String(user?.role || '').split(',').map(r => r.trim().toLowerCase());
  return roles.includes('owner') || roles.includes('super_admin') || roles.includes('developer') || user?.isClient === true;
}

async function audit(req, action, details) {
  try {
    await pool.query(
      `INSERT INTO saas_audit_logs (action, performed_by, performer_role, client_company, target_id, target_type, details, ip_address, device_info)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        action,
        req.user?.name || 'Unknown',
        String(req.user?.role || 'unknown').toUpperCase(),
        getTenantBusinessId(req),
        String(req.user?.id || ''),
        'backup',
        JSON.stringify(details || {}),
        req.ip || '127.0.0.1',
        req.headers['user-agent'] || 'WebApp',
      ]
    );
  } catch (err) {
    logger.warn(`Backup audit log failed: ${err.message}`);
  }
}

/** POST /api/backup/sign — body: { payload } → { integrity } */
const sign = async (req, res, next) => {
  try {
    const payload = req.body && req.body.payload;
    if (!payload || payload.app !== BACKUP_APP_ID || !payload.data || typeof payload.data !== 'object') {
      return res.status(400).json({ error: 'Invalid backup payload.' });
    }
    const businessId = getTenantBusinessId(req);
    const { rest } = stripIntegrity(payload);
    const integrity = {
      alg: SIGN_ALG,
      businessId,
      signedAt: new Date().toISOString(),
      signedBy: req.user?.name || 'Unknown',
      signature: computeSignature(rest, businessId),
    };
    await audit(req, 'Backup Downloaded', { businessId, sections: Object.keys(payload.data).length });
    res.json({ integrity });
  } catch (err) {
    next(err);
  }
};

/** POST /api/backup/verify — body: { payload } → { valid: true } or 4xx with reason. Owner only. */
const verify = async (req, res, next) => {
  try {
    if (!isOwnerLike(req.user)) {
      await audit(req, 'Backup Restore Denied (Not Owner)', {});
      return res.status(403).json({ error: 'Only the business Owner can restore a backup.', code: 'RESTORE_OWNER_ONLY' });
    }

    const payload = req.body && req.body.payload;
    if (!payload || payload.app !== BACKUP_APP_ID || !payload.data || typeof payload.data !== 'object') {
      return res.status(400).json({ error: 'This file is not a valid Print Ghar records backup.', code: 'BACKUP_INVALID' });
    }

    const businessId = getTenantBusinessId(req);
    const { rest, integrity } = stripIntegrity(payload);

    if (!integrity || !integrity.signature || integrity.alg !== SIGN_ALG) {
      await audit(req, 'Backup Restore Rejected (Unsigned)', { businessId, fileExportedAt: payload.exportedAt });
      return res.status(422).json({
        error: 'This backup is not signed, so it cannot be verified. Only backups downloaded from this system can be restored.',
        code: 'BACKUP_UNSIGNED',
      });
    }

    if (integrity.businessId !== businessId) {
      await audit(req, 'Backup Restore Rejected (Wrong Business)', { businessId, fileBusinessId: integrity.businessId });
      return res.status(422).json({
        error: 'This backup belongs to a different business and cannot be restored here.',
        code: 'BACKUP_WRONG_BUSINESS',
      });
    }

    // Always recompute with the authenticated tenant's id — never trust the id stored in the file.
    const expected = Buffer.from(computeSignature(rest, businessId), 'hex');
    let given;
    try { given = Buffer.from(String(integrity.signature), 'hex'); } catch (_) { given = Buffer.alloc(0); }
    const ok = given.length === expected.length && crypto.timingSafeEqual(given, expected);

    if (!ok) {
      logger.warn(`⚠️ Tampered backup rejected for business ${businessId} (user: ${req.user?.name})`);
      await audit(req, 'Backup Restore Rejected (Tampered)', { businessId, fileExportedAt: payload.exportedAt, signedBy: integrity.signedBy });
      return res.status(422).json({
        error: 'Backup file has been modified after it was downloaded. Restore blocked to protect your financial data.',
        code: 'BACKUP_TAMPERED',
      });
    }

    await audit(req, 'Backup Restore Verified', { businessId, fileExportedAt: payload.exportedAt, signedAt: integrity.signedAt, signedBy: integrity.signedBy });
    res.json({ valid: true, exportedAt: payload.exportedAt, signedAt: integrity.signedAt, signedBy: integrity.signedBy });
  } catch (err) {
    next(err);
  }
};

module.exports = { sign, verify, canonicalize, computeSignature, BACKUP_APP_ID };
