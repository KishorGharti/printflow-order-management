'use strict';

const { pool } = require('../config/db');
const logger = require('./logger');

// In-memory ring buffer for instant lookups
const inMemoryBuffer = [];
const MAX_BUFFER = 100;

async function captureError(err, req = null) {
  try {
    const errorRecord = {
      id: err.id || `err_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      message: String(err.message || err || 'Unknown runtime error'),
      stack: String(err.stack || ''),
      method: req ? req.method : '',
      path: req ? (req.originalUrl || req.url || '') : '',
      statusCode: err.statusCode || err.status || 500,
      businessId: req?.user?.businessId || req?.user?.business_id || 'system',
      userId: req?.user?.id || '',
      userEmail: req?.user?.email || '',
      ipAddress: req ? (req.ip || req.connection?.remoteAddress || '127.0.0.1') : '127.0.0.1',
      userAgent: req ? (req.headers?.['user-agent'] || 'Server') : 'Server',
      resolved: false,
      createdAt: new Date().toISOString()
    };

    // Prepend to in-memory buffer
    inMemoryBuffer.unshift(errorRecord);
    if (inMemoryBuffer.length > MAX_BUFFER) {
      inMemoryBuffer.pop();
    }

    // Persist to database asynchronously
    pool.query(
      `INSERT INTO saas_error_logs (message, stack, method, path, status_code, business_id, user_id, user_email, ip_address, user_agent, resolved)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false)
       RETURNING id, created_at`,
      [
        errorRecord.message,
        errorRecord.stack,
        errorRecord.method,
        errorRecord.path,
        errorRecord.statusCode,
        errorRecord.businessId,
        errorRecord.userId,
        errorRecord.userEmail,
        errorRecord.ipAddress,
        errorRecord.userAgent
      ]
    ).then(res => {
      if (res.rows?.[0]) {
        errorRecord.id = res.rows[0].id;
        errorRecord.createdAt = res.rows[0].created_at;
      }
    }).catch(dbErr => {
      logger.error('Failed to persist error to saas_error_logs:', dbErr.message);
    });

    return errorRecord;
  } catch (reporterErr) {
    logger.error('Crash reporter failed to capture error:', reporterErr);
  }
}

async function getRecentErrors(options = {}) {
  const page = Math.max(1, parseInt(options.page, 10) || 1);
  const limit = Math.max(1, parseInt(options.limit, 10) || 20);
  const offset = options.skip !== undefined ? Math.max(0, parseInt(options.skip, 10)) : (page - 1) * limit;
  const { resolved = null, search = '' } = options;
  try {
    let baseWhere = '';
    const conditions = [];
    const values = [];

    if (resolved !== null && resolved !== undefined && resolved !== 'all') {
      values.push(resolved === true || resolved === 'true');
      conditions.push(`resolved = $${values.length}`);
    }

    if (search && search.trim()) {
      values.push(`%${search.trim().toLowerCase()}%`);
      conditions.push(`(LOWER(message) LIKE $${values.length} OR LOWER(path) LIKE $${values.length} OR LOWER(business_id) LIKE $${values.length})`);
    }

    if (conditions.length) {
      baseWhere = ` WHERE ${conditions.join(' AND ')}`;
    }

    const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM saas_error_logs${baseWhere}`, values);
    const total = countRes.rows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    const query = `SELECT * FROM saas_error_logs${baseWhere} ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    const queryParams = [...values, limit, offset];

    const { rows } = await pool.query(query, queryParams);
    return { errors: rows, total, page, limit, totalPages };
  } catch (err) {
    logger.warn('Falling back to in-memory error buffer:', err.message);
    const filtered = inMemoryBuffer.filter(e => {
      if (resolved !== null && resolved !== undefined && resolved !== 'all') {
        const isRes = resolved === true || resolved === 'true';
        if (Boolean(e.resolved) !== isRes) return false;
      }
      if (search && search.trim()) {
        const s = search.trim().toLowerCase();
        return (e.message && e.message.toLowerCase().includes(s)) || (e.path && e.path.toLowerCase().includes(s));
      }
      return true;
    });
    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const slice = filtered.slice(offset, offset + limit);
    return { errors: slice, total, page, limit, totalPages };
  }
}

async function resolveError(id) {
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (isUuid) {
      await pool.query('UPDATE saas_error_logs SET resolved = true WHERE id = $1', [id]);
    }
    const memItem = inMemoryBuffer.find(e => e.id === id);
    if (memItem) memItem.resolved = true;
    return true;
  } catch (err) {
    logger.error('Failed to resolve error:', err.message);
    return false;
  }
}

async function clearResolvedErrors() {
  try {
    await pool.query('DELETE FROM saas_error_logs WHERE resolved = true');
    for (let i = inMemoryBuffer.length - 1; i >= 0; i--) {
      if (inMemoryBuffer[i].resolved) inMemoryBuffer.splice(i, 1);
    }
    return true;
  } catch (err) {
    logger.error('Failed to clear resolved errors:', err.message);
    return false;
  }
}

// Global Express error handler middleware
function crashReporterMiddleware(err, req, res, next) {
  if (err && (!err.statusCode || err.statusCode >= 500)) {
    captureError(err, req);
  }
  next(err);
}

module.exports = {
  captureError,
  getRecentErrors,
  resolveError,
  clearResolvedErrors,
  crashReporterMiddleware
};
