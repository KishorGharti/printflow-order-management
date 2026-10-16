'use strict';

const { pool } = require('../config/db');
const { env } = require('../config/env');
const { verifyToken } = require('../utils/authHelper');
const { ROLES } = require('../config/permissions');
const logger = require('../utils/logger');
const systemMonitor = require('../utils/systemMonitor');

// Default fallback policy
const DEFAULT_POLICY = {
  session_timeout_minutes: 120,
  max_failed_logins: 5,
  rate_limit_per_minute: 500,
  enforce_mfa_developer: false,
  ip_whitelist_enabled: false,
  allowed_ips: ['127.0.0.1', '::1', 'localhost'],
};

let cachedPolicy = null;
let lastCacheFetch = 0;
const CACHE_TTL_MS = 10000; // 10 seconds

// Brute-force failed attempts tracking: key -> { count: number, lockedUntil: number }
const failedAttemptsMap = new Map();

// Pending MFA sessions: sessionId -> { code: string, email: string, expiresAt: number }
const pendingMfaMap = new Map();

// IP sliding window rate limit tracking: ip -> { count: number, resetAt: number }
const ipRateLimitMap = new Map();

// Cleanup expired entries periodically (every 5 mins)
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of failedAttemptsMap.entries()) {
    if (record.lockedUntil && record.lockedUntil < now) {
      failedAttemptsMap.delete(key);
    }
  }
  for (const [sessionId, mfa] of pendingMfaMap.entries()) {
    if (mfa.expiresAt < now) {
      pendingMfaMap.delete(sessionId);
    }
  }
  for (const [ip, record] of ipRateLimitMap.entries()) {
    if (record.resetAt < now) {
      ipRateLimitMap.delete(ip);
    }
  }
}, 300000);

/**
 * Retrieves the currently active security policy from PostgreSQL (with caching)
 */
async function getSecurityPolicy() {
  const now = Date.now();
  if (cachedPolicy && now - lastCacheFetch < CACHE_TTL_MS) {
    return cachedPolicy;
  }

  try {
    const res = await pool.query("SELECT value FROM saas_settings WHERE key = 'security_policy'");
    if (res.rows.length && res.rows[0].value) {
      const dbVal = typeof res.rows[0].value === 'string'
        ? JSON.parse(res.rows[0].value)
        : res.rows[0].value;
      cachedPolicy = {
        session_timeout_minutes: Number(dbVal.session_timeout_minutes) || DEFAULT_POLICY.session_timeout_minutes,
        max_failed_logins: Number(dbVal.max_failed_logins) || DEFAULT_POLICY.max_failed_logins,
        rate_limit_per_minute: Number(dbVal.rate_limit_per_minute) || DEFAULT_POLICY.rate_limit_per_minute,
        enforce_mfa_developer: Boolean(dbVal.enforce_mfa_developer),
        ip_whitelist_enabled: Boolean(dbVal.ip_whitelist_enabled),
        allowed_ips: Array.isArray(dbVal.allowed_ips) ? dbVal.allowed_ips : DEFAULT_POLICY.allowed_ips,
      };
    } else {
      cachedPolicy = { ...DEFAULT_POLICY };
    }
  } catch (err) {
    logger.warn('Failed to fetch security_policy from DB, using fallback defaults:', err.message);
    if (!cachedPolicy) cachedPolicy = { ...DEFAULT_POLICY };
  }

  lastCacheFetch = now;
  // Sync monitor rate limiter threshold
  if (systemMonitor && cachedPolicy.rate_limit_per_minute) {
    systemMonitor.rateLimitPerMin = cachedPolicy.rate_limit_per_minute;
  }
  return cachedPolicy;
}

/**
 * Immediately updates the active cached security policy
 */
function updatePolicyCache(newPolicy) {
  cachedPolicy = {
    session_timeout_minutes: Number(newPolicy.session_timeout_minutes) || DEFAULT_POLICY.session_timeout_minutes,
    max_failed_logins: Number(newPolicy.max_failed_logins) || DEFAULT_POLICY.max_failed_logins,
    rate_limit_per_minute: Number(newPolicy.rate_limit_per_minute) || DEFAULT_POLICY.rate_limit_per_minute,
    enforce_mfa_developer: Boolean(newPolicy.enforce_mfa_developer),
    ip_whitelist_enabled: Boolean(newPolicy.ip_whitelist_enabled),
    allowed_ips: Array.isArray(newPolicy.allowed_ips) ? newPolicy.allowed_ips : DEFAULT_POLICY.allowed_ips,
  };
  lastCacheFetch = Date.now();
  if (systemMonitor && cachedPolicy.rate_limit_per_minute) {
    systemMonitor.rateLimitPerMin = cachedPolicy.rate_limit_per_minute;
  }
}

function getLockoutKeys(identifier, ip) {
  const keys = [];
  if (identifier) {
    keys.push(String(identifier).trim().toLowerCase());
  }
  const cleanIp = normalizeIp(ip);
  if (cleanIp && cleanIp !== '127.0.0.1' && cleanIp !== 'localhost') {
    keys.push(`ip:${cleanIp}`);
  }
  return keys;
}

/**
 * Checks if a user / IP is currently locked out due to exceeding max_failed_logins
 */
async function checkLoginLockout(identifier, ip = '127.0.0.1') {
  const policy = await getSecurityPolicy();
  const keys = getLockoutKeys(identifier, ip);

  const now = Date.now();
  for (const k of keys) {
    const record = failedAttemptsMap.get(k);
    if (record && record.lockedUntil && record.lockedUntil > now) {
      const remainingMinutes = Math.max(1, Math.ceil((record.lockedUntil - now) / 60000));
      return {
        locked: true,
        remainingMinutes,
        maxAttempts: policy.max_failed_logins,
      };
    }
  }

  return { locked: false, maxAttempts: policy.max_failed_logins };
}

/**
 * Records a failed login attempt and locks account if threshold exceeded
 */
async function recordFailedLogin(identifier, ip = '127.0.0.1') {
  const policy = await getSecurityPolicy();
  const max = policy.max_failed_logins;
  const keys = getLockoutKeys(identifier, ip);

  const now = Date.now();
  let wasLocked = false;
  let remainingMinutes = 15;

  for (const k of keys) {
    const existing = failedAttemptsMap.get(k) || { count: 0, lockedUntil: 0 };
    // If lockout window passed, reset count
    if (existing.lockedUntil && existing.lockedUntil <= now) {
      existing.count = 0;
      existing.lockedUntil = 0;
    }

    existing.count += 1;
    if (existing.count >= max) {
      existing.lockedUntil = now + (15 * 60 * 1000); // 15-minute cooldown
      wasLocked = true;
    }
    failedAttemptsMap.set(k, existing);
  }

  return { locked: wasLocked, remainingMinutes, maxAttempts: max };
}

/**
 * Clears failed login counter on successful authentication
 */
function resetFailedLogins(identifier, ip = '127.0.0.1') {
  const keys = getLockoutKeys(identifier, ip);
  for (const k of keys) {
    failedAttemptsMap.delete(k);
  }
}

function clearAllLockouts() {
  failedAttemptsMap.clear();
}

/**
 * Extracts and normalizes client IP from request
 */
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return normalizeIp(first);
  }
  return normalizeIp(req.ip || req.connection?.remoteAddress || '127.0.0.1');
}

function normalizeIp(ip) {
  if (!ip) return '127.0.0.1';
  let clean = String(ip).trim();
  if (clean.startsWith('::ffff:')) {
    clean = clean.replace('::ffff:', '');
  }
  if (clean === '::1' || clean === '0:0:0:0:0:0:0:1') {
    clean = '127.0.0.1';
  }
  return clean;
}

/**
 * Checks if client IP is permitted under active whitelist
 */
async function checkIpWhitelist(req) {
  const policy = await getSecurityPolicy();
  if (!policy.ip_whitelist_enabled) return { allowed: true };

  const clientIp = getClientIp(req);
  // Loopback / localhost is always safe to avoid self-lockout
  if (clientIp === '127.0.0.1' || clientIp === 'localhost' || clientIp === '::1') {
    return { allowed: true, clientIp };
  }

  const allowed = policy.allowed_ips.map(normalizeIp);
  const isMatch = allowed.some(a => a === clientIp || a === '*');

  return { allowed: isMatch, clientIp, allowedIps: allowed };
}

/**
 * Synchronous check of client IP against cached security policy
 */
function checkIpWhitelistSync(req) {
  const policy = cachedPolicy || DEFAULT_POLICY;
  if (!policy.ip_whitelist_enabled) return { allowed: true };

  const clientIp = getClientIp(req);
  if (clientIp === '127.0.0.1' || clientIp === 'localhost' || clientIp === '::1') {
    return { allowed: true, clientIp };
  }

  const allowed = (policy.allowed_ips || []).map(normalizeIp);
  const isMatch = allowed.some(a => a === clientIp || a === '*');

  return { allowed: isMatch, clientIp, allowedIps: allowed };
}


/**
 * Creates a pending 6-digit MFA session for Developer login
 */
function createMfaSession(email) {
  const sessionId = 'mfa_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  pendingMfaMap.set(sessionId, {
    code: otp,
    email: email.toLowerCase().trim(),
    expiresAt: Date.now() + (10 * 60 * 1000), // 10 minutes
  });
  return { sessionId, otp };
}

/**
 * Verifies developer 6-digit MFA code
 */
function verifyMfaSession(sessionId, inputCode) {
  if (!sessionId || !inputCode) return { valid: false, error: 'Session ID and OTP required' };
  const session = pendingMfaMap.get(sessionId);
  if (!session) return { valid: false, error: 'MFA session expired or not found. Please log in again.' };

  if (Date.now() > session.expiresAt) {
    pendingMfaMap.delete(sessionId);
    return { valid: false, error: 'Verification code expired. Please log in again.' };
  }

  if (String(session.code).trim() !== String(inputCode).trim()) {
    return { valid: false, error: 'Invalid 6-digit verification code.' };
  }

  pendingMfaMap.delete(sessionId);
  return { valid: true, email: session.email };
}

/**
 * Express middleware enforcing the dynamic API rate limit defined in the security policy
 */
async function dynamicRateLimiter(req, res, next) {
  // Exclude health check and developer console administrative endpoints
  if (req.path === '/health' || req.path.startsWith('/api/developer')) {
    return next();
  }

  const policy = await getSecurityPolicy();
  const limit = policy.rate_limit_per_minute || 500;
  const clientIp = getClientIp(req);
  const now = Date.now();

  let record = ipRateLimitMap.get(clientIp);
  if (!record || record.resetAt <= now) {
    record = { count: 1, resetAt: now + 60000 };
    ipRateLimitMap.set(clientIp, record);
    return next();
  }

  record.count += 1;
  if (record.count > limit) {
    if (systemMonitor) {
      systemMonitor.blockedRequests = (systemMonitor.blockedRequests || 0) + 1;
    }
    const retryAfter = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({
      ok: false,
      error: `Too Many Requests: Dynamic rate limit exceeded (${limit} req/min). Please slow down.`,
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfterSeconds: retryAfter,
    });
  }

  next();
}

let cachedMaintenanceMode = null;
let lastMaintenanceFetch = 0;

/**
 * Retrieves the currently active maintenance mode settings from PostgreSQL
 */
async function getMaintenanceMode() {
  const now = Date.now();
  if (cachedMaintenanceMode && now - lastMaintenanceFetch < CACHE_TTL_MS) {
    return cachedMaintenanceMode;
  }

  try {
    const res = await pool.query("SELECT value FROM saas_settings WHERE key = 'maintenance_mode'");
    if (res.rows.length && res.rows[0].value) {
      const val = typeof res.rows[0].value === 'string'
        ? JSON.parse(res.rows[0].value)
        : res.rows[0].value;
      cachedMaintenanceMode = {
        enabled: Boolean(val.enabled),
        message: String(val.message || 'The system is undergoing scheduled maintenance. Please check back shortly.').trim(),
      };
    } else {
      cachedMaintenanceMode = {
        enabled: false,
        message: 'The system is undergoing scheduled maintenance. Please check back shortly.',
      };
    }
  } catch (err) {
    if (!cachedMaintenanceMode) {
      cachedMaintenanceMode = {
        enabled: false,
        message: 'The system is undergoing scheduled maintenance. Please check back shortly.',
      };
    }
  }

  lastMaintenanceFetch = now;
  return cachedMaintenanceMode;
}

/**
 * Immediately updates the in-memory cached maintenance mode setting
 */
function updateMaintenanceModeCache(newVal) {
  cachedMaintenanceMode = {
    enabled: Boolean(newVal?.enabled),
    message: String(newVal?.message || 'The system is undergoing scheduled maintenance. Please check back shortly.').trim(),
  };
  lastMaintenanceFetch = Date.now();
}

/**
 * Express middleware enforcing maintenance mode:
 * Blocks client/staff logins and APIs with HTTP 503 while leaving developer routes 100% accessible.
 */
async function maintenanceModeMiddleware(req, res, next) {
  // Always permit health check and developer admin endpoints
  if (
    req.path === '/health' ||
    req.path.startsWith('/api/developer')
  ) {
    return next();
  }

  const maint = await getMaintenanceMode();
  if (!maint.enabled) {
    return next();
  }

  // Developer bypass: Check for developer Master API key or Developer/SuperAdmin JWT token
  const authHeader = req.headers.authorization || req.headers['x-auth-token'] || '';
  let token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();

  if (env.API_SECRET_KEY && token === env.API_SECRET_KEY) {
    return next();
  }

  if (token) {
    try {
      const decoded = verifyToken(token);
      if (decoded && (decoded.role === ROLES.SUPER_ADMIN || decoded.role === ROLES.DEVELOPER || decoded.isDeveloper)) {
        return next();
      }
    } catch (_) {}
  }

  // Block client requests with HTTP 503
  res.setHeader('Retry-After', '300');
  return res.status(503).json({
    ok: false,
    code: 'MAINTENANCE_MODE',
    error: maint.message || 'The system is currently undergoing scheduled maintenance. Please check back shortly.',
    message: maint.message || 'The system is currently undergoing scheduled maintenance. Please check back shortly.',
  });
}

module.exports = {
  getSecurityPolicy,
  updatePolicyCache,
  checkLoginLockout,
  recordFailedLogin,
  resetFailedLogins,
  checkIpWhitelist,
  checkIpWhitelistSync,
  getClientIp,
  createMfaSession,
  verifyMfaSession,
  dynamicRateLimiter,
  clearAllLockouts,
  getMaintenanceMode,
  updateMaintenanceModeCache,
  maintenanceModeMiddleware,
};
