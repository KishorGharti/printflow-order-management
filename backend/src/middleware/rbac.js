'use strict';

const { pool } = require('../config/db');
const { env } = require('../config/env');
const { verifyToken, safeEqual } = require('../utils/authHelper');
const { ROLES, ROLE_PERMISSIONS, hasPermission } = require('../config/permissions');
const logger = require('../utils/logger');
const { getSecurityPolicy, checkIpWhitelist, checkIpWhitelistSync } = require('../services/securityPolicyService');
const presence = require('../services/presenceService');

let cachedGlobalRevokedAt = null;
let lastRevokedCheckTime = 0;

async function getGlobalRevokedAt() {
  const now = Date.now();
  if (now - lastRevokedCheckTime < 2000 && cachedGlobalRevokedAt !== null) {
    return cachedGlobalRevokedAt;
  }
  try {
    const res = await pool.query("SELECT value FROM saas_settings WHERE key = 'revoked_sessions_at'");
    lastRevokedCheckTime = now;
    if (res.rows.length && res.rows[0].value) {
      const val = typeof res.rows[0].value === 'string'
        ? res.rows[0].value
        : JSON.parse(JSON.stringify(res.rows[0].value));
      cachedGlobalRevokedAt = new Date(val).getTime();
    } else {
      cachedGlobalRevokedAt = 0;
    }
  } catch (err) {
    logger.error('Failed to read revoked_sessions_at:', err);
  }
  return cachedGlobalRevokedAt || 0;
}

function invalidateGlobalRevokedCache() {
  lastRevokedCheckTime = 0;
  cachedGlobalRevokedAt = null;
}

/**
 * Resolves the authenticated user from the Authorization header (Bearer JWT or API_SECRET_KEY).
 * Populates req.user.
 */
async function authenticateUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers['x-auth-token'] || '';
    let token = '';

    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else if (authHeader.trim()) {
      token = authHeader.trim();
    } else if (req.query && req.query.token) {
      token = String(req.query.token).trim();
    }

    if (!token) {
      // Role and business headers are only honoured for a verified token below.
      req.user = null;
      return next();
    }

    // 1. Master API key support (system administration / backend crons / developer console)
    if (env.API_SECRET_KEY && safeEqual(token, env.API_SECRET_KEY)) {
      req.user = {
        id: 'system-master',
        name: 'Platform Developer (Super Admin)',
        role: ROLES.SUPER_ADMIN,
        businessId: req.headers['x-business-id'] || 'platform_developer',
        isActive: true,
        permissions: ROLE_PERMISSIONS[ROLES.SUPER_ADMIN],
      };
      return next();
    }

    // 2. JWT token verification
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired authentication token.' });
    }

    // Check if sessions have been revoked globally
    const tokenIatMs = (decoded.iat || 0) * 1000;
    const globalRevokedAt = await getGlobalRevokedAt();
    if (globalRevokedAt && tokenIatMs <= globalRevokedAt) {
      return res.status(401).json({
        ok: false,
        code: 'SESSION_REVOKED',
        error: 'Your session has been revoked by an administrator. Please log in again.'
      });
    }

    // Check dynamic session timeout from Security Policy
    const policy = await getSecurityPolicy();
    const timeoutMs = (policy.session_timeout_minutes || 120) * 60 * 1000;
    if (tokenIatMs && (Date.now() - tokenIatMs) > timeoutMs) {
      return res.status(401).json({
        ok: false,
        code: 'SESSION_TIMEOUT',
        error: `Session expired due to inactivity timeout (${policy.session_timeout_minutes} minutes). Please log in again.`
      });
    }

    // Check if token represents a developer / super_admin account
    if (decoded.role === ROLES.SUPER_ADMIN || decoded.role === ROLES.DEVELOPER || decoded.isDeveloper) {
      req.user = {
        id: decoded.id || 'dev-super-admin',
        localId: decoded.localId || 'dev-super-admin',
        name: decoded.name || 'Platform Developer',
        email: decoded.email || 'dev@printghar.com',
        role: decoded.role || ROLES.SUPER_ADMIN,
        businessId: decoded.businessId || 'platform_developer',
        isActive: true,
        jobTitle: 'Lead Platform Developer',
        permissions: ROLE_PERMISSIONS[ROLES.SUPER_ADMIN],
      };
      return next();
    }

    // 2b. Check if token represents an authenticated SaaS Client account
    if (decoded.isClient) {
      const clientRes = await pool.query(
        'SELECT id, name, email, phone, status, business_id, session_revoked_at FROM saas_clients WHERE id = $1',
        [decoded.id]
      );
      if (!clientRes.rows.length) {
        return res.status(401).json({ error: 'Unauthorized: Client account not found.' });
      }
      const client = clientRes.rows[0];
      if (client.status === 'deactivated' || client.status === 'suspended') {
        return res.status(403).json({ error: 'Forbidden: Client account is deactivated by the developer.' });
      }
      if (client.session_revoked_at && tokenIatMs <= new Date(client.session_revoked_at).getTime()) {
        return res.status(401).json({
          ok: false,
          code: 'SESSION_REVOKED',
          error: 'Your session has been terminated by an administrator. Please log in again.'
        });
      }

      // Allow owner to switch/operate under restricted role (e.g. Designer or Printer/Finishing)
      const requestedRole = (req.headers['x-role'] || req.headers['x-active-role'] || decoded.role || ROLES.OWNER).toLowerCase().trim();
      const effectiveRole = [ROLES.DESIGNER, ROLES.PRINTER_FINISHING, ROLES.RECEPTION, ROLES.OWNER].includes(requestedRole)
        ? requestedRole
        : ROLES.OWNER;

      const clientBiz = (decoded.businessId && decoded.businessId !== 'global_settings')
        ? decoded.businessId
        : (client.business_id || 'global_settings');

      req.user = {
        id: client.id,
        localId: client.id,
        name: client.name,
        email: client.email,
        role: effectiveRole,
        businessId: clientBiz,
        isActive: true,
        isClient: true,
        permissions: ROLE_PERMISSIONS[effectiveRole] || [],
      };
      presence.markActive({ clientId: client.id, businessId: clientBiz });
      return next();
    }

    // 3. Database check: Verify employee exists and is active in PostgreSQL
    const userId = decoded.id || decoded.localId;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    const query = isUuid
      ? 'SELECT id, local_id, name, email, role, business_id, is_active, status, job_title, session_revoked_at FROM team_members WHERE id = $1'
      : 'SELECT id, local_id, name, email, role, business_id, is_active, status, job_title, session_revoked_at FROM team_members WHERE local_id = $1';

    const { rows } = await pool.query(query, [userId]);
    if (!rows.length) {
      return res.status(401).json({ error: 'Unauthorized: User account no longer exists.' });
    }

    const member = rows[0];
    const isMemberActive = member.is_active !== false && member.status !== 'inactive';

    if (!isMemberActive) {
      return res.status(403).json({ error: 'Forbidden: Account is deactivated. Please contact your administrator.' });
    }

    if (member.session_revoked_at && tokenIatMs <= new Date(member.session_revoked_at).getTime()) {
      return res.status(401).json({
        ok: false,
        code: 'SESSION_REVOKED',
        error: 'Your session has been terminated by an administrator. Please log in again.'
      });
    }

    const requestedRole = (req.headers['x-role'] || req.headers['x-active-role'] || member.role || decoded.role || ROLES.RECEPTION).toLowerCase().trim();
    // A member may switch down to a role with fewer rights, never up: an owner can work as any staff
    // role, reception only as reception/designer/printer. Everyone else keeps their assigned role.
    const switchableRoles = member.role === ROLES.OWNER
      ? [ROLES.DESIGNER, ROLES.PRINTER_FINISHING, ROLES.RECEPTION, ROLES.OWNER]
      : member.role === ROLES.RECEPTION
        ? [ROLES.DESIGNER, ROLES.PRINTER_FINISHING, ROLES.RECEPTION]
        : [];
    const effectiveRole = switchableRoles.includes(requestedRole) ? requestedRole : member.role;

    req.user = {
      id: member.id,
      localId: member.local_id,
      name: member.name,
      email: member.email,
      role: effectiveRole,
      businessId: member.business_id || decoded.businessId || 'global_settings',
      isActive: true,
      jobTitle: member.job_title,
      permissions: ROLE_PERMISSIONS[effectiveRole] || [],
    };
    presence.markActive({ businessId: req.user.businessId });

    next();
  } catch (err) {
    logger.error('Authentication middleware error:', err);
    next(err);
  }
}

/**
 * Middleware factory requiring a specific fine-grained permission.
 * Returns 403 Forbidden if user is unauthenticated or lacks the permission.
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({
        error: 'Forbidden: Direct API access without authentication or permission is blocked.',
      });
    }

    if (!req.user.isActive) {
      return res.status(403).json({
        error: 'Forbidden: Account is deactivated.',
      });
    }

    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({
        error: `Forbidden: Role "${req.user.role}" does not have "${permission}" permission.`,
      });
    }

    next();
  };
}

/**
 * Middleware requiring one of the specified roles.
 */
function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({ error: 'Forbidden: Authentication required.' });
    }

    if (!req.user.isActive) {
      return res.status(403).json({ error: 'Forbidden: Account is deactivated.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: Access restricted to roles: ${allowedRoles.join(', ')}.`,
      });
    }

    next();
  };
}

/**
 * Strict Developer Platform Guard:
 * Blocks all standard client accounts (owner, reception, designer, printer).
 * Only grants access to SUPER_ADMIN / DEVELOPER.
 */
function requireDeveloperAccess(req, res, next) {
  if (!req.user) {
    return res.status(403).json({
      error: 'Forbidden: Developer platform access requires authentication.',
    });
  }

  if (!req.user.isActive) {
    return res.status(403).json({ error: 'Forbidden: Account is deactivated.' });
  }

  const role = String(req.user.role || '').toLowerCase().trim();
  if (role !== ROLES.SUPER_ADMIN && role !== ROLES.DEVELOPER && !req.user.isDeveloper) {
    return res.status(403).json({
      error: 'Forbidden: Developer platform access is strictly restricted to SUPER_ADMIN / DEVELOPER accounts.',
    });
  }

  // Enforce IP Whitelist if enabled (sync check against cached policy)
  const ipCheck = checkIpWhitelistSync(req);
  if (ipCheck && !ipCheck.allowed) {
    return res.status(403).json({
      error: `Access Denied: Your IP address (${ipCheck.clientIp}) is not authorized by the security policy whitelist.`,
      code: 'IP_NOT_WHITELISTED',
    });
  }

  next();
}

/**
 * Multi-tenant resolver: extracts businessId strictly from authenticated user.
 * Falls back to 'global_settings' when there is no verified user.
 * Only SUPER_ADMIN / DEVELOPER may override businessId via header/query for admin operations.
 */
function getTenantBusinessId(req) {
  if (req.user) {
    const isDev = req.user.role === ROLES.SUPER_ADMIN || req.user.role === ROLES.DEVELOPER || req.user.isDeveloper;
    if (isDev && (req.headers['x-business-id'] || req.query.business_id || req.query.businessId)) {
      return String(req.headers['x-business-id'] || req.query.business_id || req.query.businessId).trim();
    }
    if (req.user.businessId) {
      return req.user.businessId;
    }
  }
  // Without a verified login the X-Business-Id header is not trusted.
  return 'global_settings';
}

module.exports = {
  authenticateUser,
  requirePermission,
  requireRole,
  requireDeveloperAccess,
  getTenantBusinessId,
  invalidateGlobalRevokedCache,
  getGlobalRevokedAt,
};
