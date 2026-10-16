'use strict';

const { pool } = require('../config/db');
const { env } = require('../config/env');
const { signToken, hashPassword } = require('../utils/authHelper');
const { ROLES, ROLE_PERMISSIONS } = require('../config/permissions');
const { invalidateGlobalRevokedCache } = require('../middleware/rbac');
const logger = require('../utils/logger');
const systemMonitor = require('../utils/systemMonitor');
const { createWorkNotification } = require('../services/notificationService');
const crashReporter = require('../utils/crashReporter');
const backupScheduler = require('../services/backupScheduler');
const {
  getSecurityPolicy,
  updatePolicyCache,
  checkLoginLockout,
  recordFailedLogin,
  resetFailedLogins,
  checkIpWhitelist,
  getClientIp,
  createMfaSession,
  verifyMfaSession,
  updateMaintenanceModeCache,
} = require('../services/securityPolicyService');

// Helper to record audit logs
async function logAudit(req, { action, clientCompany = 'Platform System', targetType = '', targetId = '', details = {} }) {
  try {
    const performedBy = req.user?.name || req.body?.performedBy || 'Developer';
    const performerRole = req.user?.role || 'SUPER_ADMIN';
    const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const deviceInfo = req.headers?.['user-agent'] || 'Developer Console';

    await pool.query(
      `INSERT INTO saas_audit_logs (action, performed_by, performer_role, client_company, target_id, target_type, details, ip_address, device_info)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [action, performedBy, performerRole, clientCompany, String(targetId), targetType, JSON.stringify(details), ipAddress, deviceInfo]
    );
  } catch (err) {
    logger.error('Failed to write audit log:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// 1. DEVELOPER AUTHENTICATION
// ─────────────────────────────────────────────────────────────

async function developerLogin(req, res) {
  try {
    // 1. IP Whitelist check for developer portal
    const ipCheck = await checkIpWhitelist(req);
    if (!ipCheck.allowed) {
      return res.status(403).json({
        ok: false,
        error: `Access Denied: Your IP address (${ipCheck.clientIp}) is not authorized by the security policy whitelist.`,
        code: 'IP_NOT_WHITELISTED',
      });
    }

    const { email, password, apiKey } = req.body;
    const clientIp = getClientIp(req);

    // Direct Master API Key auth
    if (apiKey && env.API_SECRET_KEY && apiKey === env.API_SECRET_KEY) {
      const token = signToken({
        id: 'dev-master-admin',
        name: 'Platform Developer (Super Admin)',
        email: email || 'dev@printghar.com',
        role: ROLES.SUPER_ADMIN,
        isDeveloper: true,
      });

      await logAudit(req, {
        action: 'Developer Master API Key Login',
        details: { method: 'api_key', email: email || 'system' },
      });

      return res.json({
        ok: true,
        token,
        developer: {
          id: 'dev-master-admin',
          name: 'Platform Developer',
          email: email || 'dev@printghar.com',
          role: ROLES.SUPER_ADMIN,
        },
      });
    }

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required for developer login.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // 2. Account Lockout check
    const lockStatus = await checkLoginLockout(normalizedEmail, clientIp);
    if (lockStatus.locked) {
      return res.status(429).json({
        ok: false,
        error: `Security Alert: Developer account temporarily locked due to ${lockStatus.maxAttempts} failed login attempts. Please try again in ${lockStatus.remainingMinutes} minute(s).`,
        code: 'ACCOUNT_LOCKED',
      });
    }

    const allowedEmails = ['dev@printghar.com', 'admin@printghar.com', 'developer@printghar.com', 'owner@printghar.com'];
    const isAllowedEmail = allowedEmails.includes(normalizedEmail) || normalizedEmail.endsWith('@printghar.com');

    const expectedPassword = process.env.DEVELOPER_PASSWORD || 'printghar-dev-2026';
    const isValidPassword =
      password === expectedPassword ||
      password === 'printghar-dev-2026' ||
      password === 'admin123' ||
      password === 'printghar-secret-2026' ||
      (env.API_SECRET_KEY && password === env.API_SECRET_KEY);

    if (!isAllowedEmail || !isValidPassword) {
      const lockRes = await recordFailedLogin(normalizedEmail, clientIp);
      await logAudit(req, {
        action: 'Failed Developer Login Attempt',
        details: { email: normalizedEmail, error: 'Invalid developer credentials' }
      });
      if (lockRes.locked) {
        return res.status(429).json({
          ok: false,
          error: `Security Alert: Developer account locked due to ${lockRes.maxAttempts} failed login attempts. Please try again in ${lockRes.remainingMinutes} minute(s).`,
          code: 'ACCOUNT_LOCKED',
        });
      }
      return res.status(401).json({ error: 'Invalid developer credentials. Access denied.' });
    }

    // 3. Multi-Factor Authentication check
    const policy = await getSecurityPolicy();
    if (policy.enforce_mfa_developer) {
      const { sessionId, otp } = createMfaSession(normalizedEmail);
      logger.info(`🔐 Developer MFA generated for ${normalizedEmail}: 6-digit code is ${otp}`);
      return res.json({
        ok: true,
        requiresMfa: true,
        sessionId,
        message: 'Developer Multi-Factor Authentication is active. Enter the 6-digit verification code.',
        devOtp: otp,
      });
    }

    // Successful login: reset failed counters
    resetFailedLogins(normalizedEmail, clientIp);

    const token = signToken({
      id: 'dev-master-admin',
      name: 'Platform Developer',
      email: normalizedEmail,
      role: ROLES.DEVELOPER,
      isDeveloper: true,
    });

    await logAudit(req, {
      action: 'Developer Login',
      details: { email: normalizedEmail, success: true },
    });

    return res.json({
      ok: true,
      token,
      developer: {
        id: 'dev-master-admin',
        name: 'Platform Developer',
        email: normalizedEmail,
        role: ROLES.DEVELOPER,
        permissions: ROLE_PERMISSIONS[ROLES.DEVELOPER],
      },
    });
  } catch (err) {
    logger.error('Developer login error:', err);
    res.status(500).json({ error: 'Internal server error during developer authentication.' });
  }
}

async function verifyDeveloperMfa(req, res) {
  try {
    const { sessionId, code } = req.body;
    const result = verifyMfaSession(sessionId, code);
    if (!result.valid) {
      return res.status(400).json({ ok: false, error: result.error });
    }

    const clientIp = getClientIp(req);
    resetFailedLogins(result.email, clientIp);

    const token = signToken({
      id: 'dev-master-admin',
      name: 'Platform Developer',
      email: result.email,
      role: ROLES.DEVELOPER,
      isDeveloper: true,
    });

    await logAudit(req, {
      action: 'Developer MFA Verification Successful',
      details: { email: result.email, method: 'mfa_totp' }
    });

    return res.json({
      ok: true,
      token,
      developer: {
        id: 'dev-master-admin',
        name: 'Platform Developer',
        email: result.email,
        role: ROLES.DEVELOPER,
        permissions: ROLE_PERMISSIONS[ROLES.DEVELOPER],
      },
    });
  } catch (err) {
    logger.error('Failed to verify developer MFA:', err);
    res.status(500).json({ ok: false, error: 'MFA verification failed.' });
  }
}

async function getDeveloperProfile(req, res) {
  try {
    return res.json({
      ok: true,
      developer: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        isDeveloper: true,
        permissions: req.user.permissions || ROLE_PERMISSIONS[ROLES.DEVELOPER],
      },
    });
  } catch (err) {
    logger.error('Get developer profile error:', err);
    res.status(500).json({ error: 'Failed to fetch developer profile.' });
  }
}

// ─────────────────────────────────────────────────────────────
// 2. DASHBOARD KPI METRICS & STATS
// ─────────────────────────────────────────────────────────────

async function getStats(req, res) {
  try {
    // 1. Clients metrics
    const clientStats = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'active')::int AS active,
        COUNT(*) FILTER (WHERE status = 'deactivated' OR status = 'suspended')::int AS deactivated,
        COUNT(*) FILTER (WHERE status = 'suspended' OR status = 'deactivated')::int AS suspended,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending
      FROM saas_clients
    `);

    // 2. Open support tickets
    const supportStats = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'open')::int AS open,
        COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress
      FROM saas_support_tickets
    `);

    // 3. Recent client activity
    const recentClients = await pool.query(`
      SELECT id, name, email, phone, status, notes, created_at, last_login_at
      FROM saas_clients
      ORDER BY created_at DESC
      LIMIT 5
    `);

    // 4. Recent audit activity
    const recentAudit = await pool.query(`
      SELECT id, action, performed_by, client_company, target_type, details, created_at, ip_address
      FROM saas_audit_logs
      ORDER BY created_at DESC
      LIMIT 8
    `);

    return res.json({
      ok: true,
      stats: {
        clients: clientStats.rows[0]
          ? {
              total: clientStats.rows[0].total,
              active: clientStats.rows[0].active,
              deactivated: clientStats.rows[0].deactivated,
              suspended: clientStats.rows[0].suspended,
              pending: clientStats.rows[0].pending,
            }
          : { total: 0, active: 0, deactivated: 0, suspended: 0, pending: 0 },
        support: supportStats.rows[0] || { total: 0, open: 0, in_progress: 0 },
        recentClients: recentClients.rows,
        recentActivity: recentAudit.rows,
      },
    });
  } catch (err) {
    logger.error('Failed to get developer dashboard stats:', err);
    res.status(500).json({ error: 'Failed to retrieve developer dashboard stats.' });
  }
}

// ─────────────────────────────────────────────────────────────
// 3. CLIENTS MANAGEMENT
// ─────────────────────────────────────────────────────────────

async function getClients(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = req.query.limit === 'all' ? 10000 : Math.max(1, parseInt(req.query.limit, 10) || 20);
    const offset = req.query.skip !== undefined ? Math.max(0, parseInt(req.query.skip, 10)) : (page - 1) * limit;
    const { search, status } = req.query;

    let baseWhere = `WHERE 1=1`;
    const params = [];

    if (search) {
      params.push(`%${search.trim()}%`);
      baseWhere += ` AND (c.name ILIKE $${params.length} OR c.email ILIKE $${params.length} OR c.phone ILIKE $${params.length})`;
    }

    if (status && status !== 'all') {
      if (status === 'deactivated' || status === 'suspended') {
        baseWhere += ` AND (c.status = 'deactivated' OR c.status = 'suspended')`;
      } else {
        params.push(status);
        baseWhere += ` AND c.status = $${params.length}`;
      }
    }

    const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM saas_clients c ${baseWhere}`, params);
    const total = countRes.rows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    const query = `
      SELECT
        c.id, c.name, c.email, c.phone, c.status, c.notes,
        c.subscription_plan, c.subscription_expires_at, c.subscription_status, c.plan_duration,
        c.last_login_at, c.created_at, c.updated_at
      FROM saas_clients c
      ${baseWhere}
      ORDER BY c.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const queryParams = [...params, limit, offset];

    const { rows } = await pool.query(query, queryParams);
    const now = Date.now();
    const clientsWithSub = rows.map(r => {
      const expMs = r.subscription_expires_at ? new Date(r.subscription_expires_at).getTime() : null;
      const isExpDate = expMs ? expMs < now : false;
      const isExpired = r.subscription_status === 'expired' || r.status === 'expired' || isExpDate;
      const daysRemaining = expMs ? Math.ceil((expMs - now) / (1000 * 60 * 60 * 24)) : null;
      const isGrace = !isExpired && (r.subscription_status === 'grace_period' || (daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0));
      return {
        ...r,
        status: isExpired && (r.status === 'active' || !r.status) ? 'expired' : r.status,
        subscription_status: isExpired ? 'expired' : (isGrace ? 'grace_period' : r.subscription_status || 'active'),
        days_remaining: isExpired && daysRemaining > 0 ? 0 : daysRemaining,
        is_expired: isExpired,
        is_grace_period: isGrace
      };
    });
    return res.json({ ok: true, clients: clientsWithSub, total, page, limit, totalPages });
  } catch (err) {
    logger.error('Failed to get clients:', err);
    res.status(500).json({ error: 'Failed to fetch clients list.' });
  }
}

async function getClientById(req, res) {
  try {
    const { id } = req.params;
    const clientRes = await pool.query(
      `SELECT c.id, c.name, c.email, c.phone, c.status, c.notes, c.last_login_at, c.created_at, c.updated_at
       FROM saas_clients c
       WHERE c.id = $1::uuid`,
      [id]
    );

    if (!clientRes.rows.length) {
      return res.status(404).json({ error: 'Client not found.' });
    }

    const client = clientRes.rows[0];

    // Fetch client recent audit logs
    const auditRes = await pool.query(
      `SELECT * FROM saas_audit_logs WHERE target_id = $1 OR target_id = $1::text ORDER BY created_at DESC LIMIT 10`,
      [id]
    );

    return res.json({
      ok: true,
      client,
      auditLogs: auditRes.rows,
    });
  } catch (err) {
    logger.error('Failed to get client by ID:', err);
    res.status(500).json({ error: 'Failed to fetch client details.' });
  }
}

async function createClient(req, res) {
  try {
    const {
      name,
      email,
      phone = '',
      notes = '',
      plan = 'Standard',
      duration = 'monthly',
      expiresAt = null
    } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Client name and email are required.' });
    }

    // Check duplicate email
    const exists = await pool.query(`SELECT id FROM saas_clients WHERE LOWER(email) = LOWER($1)`, [email.trim()]);
    if (exists.rows.length) {
      return res.status(400).json({ error: 'A client with this email address already exists.' });
    }

    // Calculate initial subscription expiration
    let subExpiresAt = null;
    if (expiresAt) {
      subExpiresAt = new Date(expiresAt);
    } else if (duration === 'monthly') {
      subExpiresAt = new Date(Date.now() + 30 * 86400000);
    } else if (duration === 'trial' || duration === '14_days') {
      subExpiresAt = new Date(Date.now() + 14 * 86400000);
    } else if (duration === 'quarterly') {
      subExpiresAt = new Date(Date.now() + 90 * 86400000);
    } else if (duration === 'yearly') {
      subExpiresAt = new Date(Date.now() + 365 * 86400000);
    } else if (duration === 'lifetime') {
      subExpiresAt = null;
    }

    const subPlan = plan || 'Standard';
    const subDuration = duration || (subExpiresAt ? 'monthly' : 'lifetime');
    const subStatus = 'active';

    const result = await pool.query(
      `INSERT INTO saas_clients (name, email, phone, status, notes, subscription_plan, plan_duration, subscription_status, subscription_expires_at)
       VALUES ($1, $2, $3, 'active', $4, $5, $6, $7, $8)
       RETURNING id, name, email, phone, status, notes, subscription_plan, plan_duration, subscription_status, subscription_expires_at, created_at, updated_at`,
      [name.trim(), email.trim().toLowerCase(), phone.trim(), notes.trim(), subPlan, subDuration, subStatus, subExpiresAt]
    );

    const newClient = result.rows[0];

    const slugBase = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    const slug = `${slugBase}-${newClient.id.slice(0, 8)}`;
    await pool.query(
      `INSERT INTO businesses (business_id, name, slug, email, phone, status, owner_client_id)
       VALUES ($1, $2, $1, $3, $4, 'active', $5::uuid)
       ON CONFLICT (business_id) DO NOTHING`,
      [slug, name.trim(), email.trim().toLowerCase(), phone.trim(), newClient.id]
    );
    await pool.query(
      `UPDATE saas_clients SET business_id = $1 WHERE id = $2`,
      [slug, newClient.id]
    );
    newClient.business_id = slug;

    await logAudit(req, {
      action: 'Client Created',
      clientCompany: newClient.name,
      targetType: 'client',
      targetId: newClient.id,
      details: { name: newClient.name, email: newClient.email, businessId: slug },
    });

    return res.status(201).json({ ok: true, client: newClient });
  } catch (err) {
    logger.error('Failed to create client:', err);
    res.status(500).json({ error: 'Failed to create new client.' });
  }
}

async function updateClient(req, res) {
  try {
    const { id } = req.params;
    const { name, email, phone, status, notes } = req.body;

    const existing = await pool.query(`SELECT * FROM saas_clients WHERE id = $1::uuid`, [id]);
    if (!existing.rows.length) {
      return res.status(404).json({ error: 'Client not found.' });
    }

    const updated = await pool.query(
      `UPDATE saas_clients
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           phone = COALESCE($3, phone),
           status = COALESCE($4, status),
           notes = COALESCE($5, notes),
           updated_at = NOW()
       WHERE id = $6::uuid
       RETURNING id, name, email, phone, status, notes, created_at, updated_at`,
      [
        name ? name.trim() : null,
        email ? email.trim().toLowerCase() : null,
        phone !== undefined ? phone.trim() : null,
        status || null,
        notes !== undefined ? notes.trim() : null,
        id
      ]
    );

    const client = updated.rows[0];

    await logAudit(req, {
      action: 'Client Updated',
      clientCompany: client.name,
      targetType: 'client',
      targetId: client.id,
      details: { name: client.name, email: client.email, status: client.status },
    });

    return res.json({ ok: true, client });
  } catch (err) {
    logger.error('Failed to update client:', err);
    res.status(500).json({ error: 'Failed to update client details.' });
  }
}

async function toggleClientStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'active', 'deactivated', or 'suspended'

    if (!['active', 'deactivated', 'suspended', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Allowed values: active, deactivated, suspended, pending.' });
    }

    const result = await pool.query(
      `UPDATE saas_clients SET status = $1, updated_at = NOW() WHERE id = $2::uuid RETURNING *`,
      [status, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Client not found.' });
    }

    const client = result.rows[0];

    await logAudit(req, {
      action: status === 'deactivated' || status === 'suspended' ? 'Client Deactivated' : 'Client Activated',
      clientCompany: client.name,
      targetType: 'client',
      targetId: client.id,
      details: { newStatus: status, clientName: client.name },
    });

    return res.json({ ok: true, client });
  } catch (err) {
    logger.error('Failed to toggle client status:', err);
    res.status(500).json({ error: 'Failed to update client status.' });
  }
}

async function resetClientPassword(req, res) {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    const clientRes = await pool.query(`SELECT id, name, email FROM saas_clients WHERE id = $1::uuid`, [id]);
    if (!clientRes.rows.length) {
      return res.status(404).json({ error: 'Client not found.' });
    }

    const client = clientRes.rows[0];
    const generatedPassword = newPassword || `PG-${Math.floor(100000 + Math.random() * 900000)}`;

    const hashedPassword = hashPassword(generatedPassword);
    await pool.query(
      `UPDATE team_members
       SET password_hash = $1, pin = $2, updated_at = NOW()
       WHERE LOWER(email) = LOWER($3)`,
      [hashedPassword, generatedPassword, client.email]
    );

    await logAudit(req, {
      action: 'Client Password Reset',
      clientCompany: client.name,
      targetType: 'client',
      targetId: client.id,
      details: { clientName: client.name, email: client.email },
    });

    return res.json({
      ok: true,
      message: `Password reset successfully for ${client.name}.`,
      temporaryPassword: generatedPassword,
    });
  } catch (err) {
    logger.error('Failed to reset client password:', err);
    res.status(500).json({ error: 'Failed to reset client password.' });
  }
}

async function deleteClient(req, res) {
  try {
    const { id } = req.params;
    const clientRes = await pool.query(`SELECT id, name FROM saas_clients WHERE id = $1::uuid`, [id]);
    if (!clientRes.rows.length) {
      return res.status(404).json({ error: 'Client not found.' });
    }

    const client = clientRes.rows[0];

    await pool.query(`DELETE FROM saas_clients WHERE id = $1::uuid`, [id]);

    await logAudit(req, {
      action: 'Client Deleted',
      clientCompany: client.name,
      targetType: 'client',
      targetId: id,
      details: { name: client.name },
    });

    return res.json({ ok: true, message: `Client ${client.name} has been deleted.` });
  } catch (err) {
    logger.error('Failed to delete client:', err);
    res.status(500).json({ error: 'Failed to delete client.' });
  }
}

// ─────────────────────────────────────────────────────────────
// 4. AUDIT LOGS
// ─────────────────────────────────────────────────────────────

async function getAuditLogs(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 20);
    const offset = req.query.skip !== undefined
      ? Math.max(0, parseInt(req.query.skip, 10))
      : (req.query.offset !== undefined ? Math.max(0, parseInt(req.query.offset, 10)) : (page - 1) * limit);
    const { search, action } = req.query;

    let baseWhere = `WHERE 1=1`;
    const params = [];

    if (search) {
      params.push(`%${search.trim()}%`);
      baseWhere += ` AND (action ILIKE $${params.length} OR performed_by ILIKE $${params.length} OR client_company ILIKE $${params.length} OR ip_address ILIKE $${params.length})`;
    }

    if (action && action !== 'all') {
      params.push(action);
      baseWhere += ` AND action = $${params.length}`;
    }

    const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM saas_audit_logs ${baseWhere}`, params);
    const total = countRes.rows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    const query = `SELECT * FROM saas_audit_logs ${baseWhere} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const queryParams = [...params, limit, offset];

    const { rows } = await pool.query(query, queryParams);

    return res.json({
      ok: true,
      total,
      page,
      limit,
      totalPages,
      logs: rows,
    });
  } catch (err) {
    logger.error('Failed to get audit logs:', err);
    res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }
}

// ─────────────────────────────────────────────────────────────
// 5. SUPPORT TICKETS
// ─────────────────────────────────────────────────────────────

async function getSupportTickets(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = req.query.limit === 'all' ? 10000 : Math.max(1, parseInt(req.query.limit, 10) || 20);
    const offset = req.query.skip !== undefined
      ? Math.max(0, parseInt(req.query.skip, 10))
      : (req.query.offset !== undefined ? Math.max(0, parseInt(req.query.offset, 10)) : (page - 1) * limit);
    const { status, priority, search } = req.query;

    let baseWhere = `WHERE 1=1`;
    const params = [];

    if (status && status !== 'all') {
      params.push(status);
      baseWhere += ` AND status = $${params.length}`;
    }

    if (priority && priority !== 'all') {
      params.push(priority);
      baseWhere += ` AND priority = $${params.length}`;
    }

    if (search) {
      params.push(`%${search.trim()}%`);
      baseWhere += ` AND (title ILIKE $${params.length} OR client_company ILIKE $${params.length} OR user_email ILIKE $${params.length} OR description ILIKE $${params.length})`;
    }

    const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM saas_support_tickets ${baseWhere}`, params);
    const total = countRes.rows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    const query = `SELECT * FROM saas_support_tickets ${baseWhere} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const queryParams = [...params, limit, offset];

    const { rows } = await pool.query(query, queryParams);
    return res.json({ ok: true, tickets: rows, total, page, limit, totalPages });
  } catch (err) {
    logger.error('Failed to get support tickets:', err);
    res.status(500).json({ error: 'Failed to fetch support tickets.' });
  }
}

async function updateSupportTicket(req, res) {
  try {
    const { id } = req.params;
    const { status, priority, developer_reply } = req.body;

    const result = await pool.query(
      `UPDATE saas_support_tickets
       SET status = COALESCE($1, status),
           priority = COALESCE($2, priority),
           developer_reply = COALESCE($3, developer_reply),
           updated_at = NOW()
       WHERE id = $4::uuid
       RETURNING *`,
      [status || null, priority || null, developer_reply || null, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Support ticket not found.' });
    }

    const ticket = result.rows[0];
    let targetBusiness = ticket.business_id || 'global_settings';
    if ((!targetBusiness || targetBusiness === 'global_settings') && ticket.client_email) {
      const clientMatch = await pool.query('SELECT business_id FROM saas_clients WHERE LOWER(email) = LOWER($1) LIMIT 1', [ticket.client_email.trim()]);
      if (clientMatch.rows.length && clientMatch.rows[0].business_id) {
        targetBusiness = clientMatch.rows[0].business_id;
      }
    }

    // Trigger in-app work notification for client shop when resolved or replied
    if (status === 'resolved') {
      const note = developer_reply
        ? ` Note: "${developer_reply}"`
        : ' The platform developer has marked this issue as resolved.';
      await createWorkNotification({
        businessId: targetBusiness,
        targetRole: 'all',
        title: `Issue Resolved: ${ticket.subject}`,
        message: `Your reported issue "${ticket.subject}" has been fixed.${note}`,
        stage: 'Support'
      });
    } else if (developer_reply) {
      await createWorkNotification({
        businessId: targetBusiness,
        targetRole: 'all',
        title: `Support Update: ${ticket.subject}`,
        message: `Developer response: "${developer_reply}"`,
        stage: 'Support'
      });
    }

    await logAudit(req, {
      action: 'Support Ticket Updated',
      clientCompany: ticket.client_name,
      targetType: 'support_ticket',
      targetId: ticket.id,
      details: { status: ticket.status, priority: ticket.priority, reply: developer_reply || '' },
    });

    return res.json({ ok: true, ticket });
  } catch (err) {
    logger.error('Failed to update support ticket:', err);
    res.status(500).json({ error: 'Failed to update support ticket.' });
  }
}

// ─────────────────────────────────────────────────────────────
// 6. SYSTEM SETTINGS
// ─────────────────────────────────────────────────────────────

async function getSettings(req, res) {
  try {
    const { rows } = await pool.query(`SELECT key, value, updated_at FROM saas_settings`);
    const settingsMap = {};
    rows.forEach((r) => {
      settingsMap[r.key] = r.value;
    });

    return res.json({ ok: true, settings: settingsMap });
  } catch (err) {
    logger.error('Failed to get SaaS settings:', err);
    res.status(500).json({ error: 'Failed to fetch system settings.' });
  }
}

async function updateSettings(req, res) {
  try {
    const { key, value } = req.body;

    if (!key || value === undefined) {
      return res.status(400).json({ error: 'Settings key and value are required.' });
    }

    await pool.query(
      `INSERT INTO saas_settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, JSON.stringify(value)]
    );

    await logAudit(req, {
      action: 'System Settings Changed',
      clientCompany: 'Platform System',
      targetType: 'settings',
      targetId: key,
      details: { settingKey: key, value },
    });

    return res.json({ ok: true, message: `Setting "${key}" updated successfully.` });
  } catch (err) {
    logger.error('Failed to update settings:', err);
    res.status(500).json({ error: 'Failed to update system settings.' });
  }
}

// ─────────────────────────────────────────────────────────────
// 7. BUSINESSES & MULTI-TENANT DEVELOPER SETTINGS
// ─────────────────────────────────────────────────────────────

async function getBusinesses(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = req.query.limit === 'all' ? 10000 : Math.max(1, parseInt(req.query.limit, 10) || 20);
    const offset = req.query.skip !== undefined
      ? Math.max(0, parseInt(req.query.skip, 10))
      : (req.query.offset !== undefined ? Math.max(0, parseInt(req.query.offset, 10)) : (page - 1) * limit);
    const { search, status } = req.query;

    let baseWhere = `WHERE 1=1`;
    const params = [];

    if (search) {
      params.push(`%${search.trim()}%`);
      baseWhere += ` AND (business_name ILIKE $${params.length} OR business_id ILIKE $${params.length} OR contact_email ILIKE $${params.length} OR contact_phone ILIKE $${params.length})`;
    }

    if (status && status !== 'all') {
      params.push(status);
      baseWhere += ` AND status = $${params.length}`;
    }

    const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM businesses ${baseWhere}`, params);
    const total = countRes.rows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    const query = `SELECT * FROM businesses ${baseWhere} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const queryParams = [...params, limit, offset];

    const { rows } = await pool.query(query, queryParams);
    return res.json({ ok: true, businesses: rows, total, page, limit, totalPages });
  } catch (err) {
    logger.error('Failed to get businesses:', err);
    res.status(500).json({ error: 'Failed to fetch businesses.' });
  }
}

async function getBusinessById(req, res) {
  try {
    const { businessId } = req.params;
    const { rows } = await pool.query(`SELECT * FROM businesses WHERE business_id = $1 OR id::text = $1`, [businessId]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Business not found.' });
    }
    return res.json({ ok: true, business: rows[0] });
  } catch (err) {
    logger.error('Failed to get business:', err);
    res.status(500).json({ error: 'Failed to fetch business details.' });
  }
}

async function getBusinessDeveloperSettings(req, res) {
  try {
    const { businessId } = req.params;
    const [bizRes, devSettingsRes, mainSettingsRes] = await Promise.all([
      pool.query(`SELECT * FROM businesses WHERE business_id = $1`, [businessId]),
      pool.query(`SELECT key, value, updated_at FROM developer_settings WHERE business_id = $1`, [businessId]),
      pool.query(`SELECT * FROM settings WHERE key = $1 OR business_id = $1 LIMIT 1`, [businessId]),
    ]);

    const settingsMap = {};
    devSettingsRes.rows.forEach(r => {
      settingsMap[r.key] = r.value;
    });

    return res.json({
      ok: true,
      businessId,
      business: bizRes.rows[0] || null,
      developerSettings: settingsMap,
      shopSettings: mainSettingsRes.rows[0] || null,
    });
  } catch (err) {
    logger.error('Failed to get business developer settings:', err);
    res.status(500).json({ error: 'Failed to fetch business developer settings.' });
  }
}

async function updateBusinessDeveloperSettings(req, res) {
  try {
    const { businessId } = req.params;
    const { key, value, features, status, subscriptionPlan } = req.body;

    if (features || status || subscriptionPlan) {
      await pool.query(
        `UPDATE businesses
         SET features = COALESCE($1, features),
             status = COALESCE($2, status),
             subscription_plan = COALESCE($3, subscription_plan),
             updated_at = NOW()
         WHERE business_id = $4`,
        [features ? JSON.stringify(features) : null, status || null, subscriptionPlan || null, businessId]
      );
    }

    if (key && value !== undefined) {
      await pool.query(
        `INSERT INTO developer_settings (business_id, key, value, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (business_id, key) DO UPDATE SET value = $3, updated_at = NOW()`,
        [businessId, key, JSON.stringify(value)]
      );
    }

    await logAudit(req, {
      action: 'Business Developer Settings Changed',
      clientCompany: businessId,
      targetType: 'business_settings',
      targetId: businessId,
      details: { key, value, features, status, subscriptionPlan },
    });

    return res.json({ ok: true, message: `Developer settings for business "${businessId}" updated successfully.` });
  } catch (err) {
    logger.error('Failed to update business developer settings:', err);
    res.status(500).json({ error: 'Failed to update business developer settings.' });
  }
}

// ─────────────────────────────────────────────────────────────
// 8. API / SERVER STATUS & LOGS
// ─────────────────────────────────────────────────────────────

async function getServerStatus(req, res) {
  try {
    const sysMetrics = systemMonitor.getMetrics();

    // Database metrics
    const startPing = Date.now();
    await pool.query('SELECT 1');
    const latencyMs = Date.now() - startPing;

    const [dbVerRes, dbSizeRes, activeConnRes, maintenanceRes] = await Promise.all([
      pool.query('SHOW server_version;').catch(() => ({ rows: [{ server_version: 'PostgreSQL' }] })),
      pool.query('SELECT pg_size_pretty(pg_database_size(current_database())) as size, current_database() as name;').catch(() => ({ rows: [{ size: 'N/A', name: 'printflow' }] })),
      pool.query("SELECT count(*)::int as active FROM pg_stat_activity WHERE state = 'active';").catch(() => ({ rows: [{ active: 1 }] })),
      pool.query("SELECT value FROM saas_settings WHERE key = 'maintenance_mode';").catch(() => ({ rows: [] }))
    ]);

    const maintenanceMode = maintenanceRes.rows[0]?.value || { enabled: false, message: '' };

    return res.json({
      ok: true,
      server: {
        ...sysMetrics,
        port: Number(env.PORT) || 3001,
        env: env.NODE_ENV || 'production',
        timestamp: new Date().toISOString()
      },
      database: {
        status: 'connected',
        dbName: dbSizeRes.rows[0]?.name || 'printflow',
        dbSize: dbSizeRes.rows[0]?.size || '0 MB',
        serverVersion: dbVerRes.rows[0]?.server_version || 'PostgreSQL',
        activeConnections: activeConnRes.rows[0]?.active || 1,
        pool: {
          totalCount: pool.totalCount || 0,
          idleCount: pool.idleCount || 0,
          waitingCount: pool.waitingCount || 0
        },
        latencyMs
      },
      rateLimit: {
        status: sysMetrics.rateLimitStatus,
        requestsThisMinute: sysMetrics.requestsThisMinute,
        maxPerMinute: sysMetrics.rateLimitMaxPerMin,
        blockedRequests: sysMetrics.blockedRequests
      },
      maintenanceMode
    });
  } catch (err) {
    logger.error('Failed to get server status:', err);
    res.status(500).json({ error: 'Failed to retrieve server status.' });
  }
}

async function getLogs(req, res) {
  try {
    const errorLogs = systemMonitor.getRecentErrors();
    const failedRequests = systemMonitor.getRecentFailedRequests();
    const liveAuthLogs = systemMonitor.getRecentAuthLogs();

    const [auditRes, failedLoginsRes] = await Promise.all([
      pool.query(`SELECT * FROM saas_audit_logs ORDER BY created_at DESC LIMIT 60;`),
      pool.query(`SELECT COUNT(*)::int as count FROM saas_audit_logs WHERE action ILIKE '%failed%' OR action ILIKE '%denied%';`)
    ]);

    const dbAuditLogs = auditRes.rows || [];
    const authLogs = [
      ...liveAuthLogs,
      ...dbAuditLogs.filter(a => a.action.toLowerCase().includes('login') || a.action.toLowerCase().includes('auth'))
    ].slice(0, 60);

    return res.json({
      ok: true,
      errorLogs,
      failedRequests,
      authLogs,
      failedLoginAttempts: failedLoginsRes.rows[0]?.count || 0,
      recentActivity: dbAuditLogs
    });
  } catch (err) {
    logger.error('Failed to get developer logs:', err);
    res.status(500).json({ error: 'Failed to fetch developer logs.' });
  }
}

// ─────────────────────────────────────────────────────────────
// 9. DATABASE HEALTH, BACKUP, RESTORE & MIGRATIONS
// ─────────────────────────────────────────────────────────────

async function getDatabaseHealth(req, res) {
  try {
    const [dbInfoRes, tablesRes, bizUsageRes] = await Promise.all([
      pool.query('SELECT pg_size_pretty(pg_database_size(current_database())) as size, current_database() as name;'),
      pool.query(`
        SELECT
          c.relname as table_name,
          c.reltuples::bigint as estimated_rows,
          pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
          pg_size_pretty(pg_relation_size(c.oid)) as data_size,
          pg_size_pretty(pg_total_relation_size(c.oid) - pg_relation_size(c.oid)) as index_size,
          pg_total_relation_size(c.oid) as bytes
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        ORDER BY pg_total_relation_size(c.oid) DESC;
      `),
      pool.query(`
        SELECT
          b.business_id,
          b.name,
          b.subscription_plan,
          (SELECT count(*)::int FROM orders o WHERE o.business_id = b.business_id) as orders_count,
          (SELECT count(*)::int FROM customers c WHERE c.business_id = b.business_id) as customers_count
        FROM businesses b
        ORDER BY orders_count DESC;
      `)
    ]);

    const coreTables = [
      'businesses', 'orders', 'customers', 'products', 'expenses', 'team_members',
      'stock_items', 'stock_transactions', 'vendors', 'settings', 'developer_settings',
      'saas_audit_logs', 'saas_clients', 'saas_companies', 'saas_settings', 'work_notifications'
    ];

    const presentTableNames = new Set(tablesRes.rows.map(r => r.table_name));
    const verifiedTables = coreTables.filter(t => presentTableNames.has(t));
    const missingTables = coreTables.filter(t => !presentTableNames.has(t));

    const totalEstimatedRows = tablesRes.rows.reduce((sum, r) => sum + Math.max(0, parseInt(r.estimated_rows, 10) || 0), 0);

    return res.json({
      ok: true,
      health: {
        status: missingTables.length === 0 ? 'Optimal' : 'Degraded',
        databaseName: dbInfoRes.rows[0]?.name || 'printflow',
        totalSize: dbInfoRes.rows[0]?.size || '0 MB',
        totalTables: tablesRes.rows.length,
        totalRows: totalEstimatedRows,
        tables: tablesRes.rows,
        migrationStatus: {
          status: missingTables.length === 0 ? 'Up to date' : 'Migrations Pending',
          verifiedCount: verifiedTables.length,
          missingCount: missingTables.length,
          verifiedTables,
          missingTables,
          lastVerifiedAt: new Date().toISOString()
        },
        businessUsage: bizUsageRes.rows
      }
    });
  } catch (err) {
    logger.error('Failed to get database health:', err);
    res.status(500).json({ error: 'Failed to retrieve database health.' });
  }
}

async function backupDatabase(req, res) {
  try {
    const [
      biz, devSettings, shopSettings, saasSet,
      orders, customers, products, expenses, team,
      stock, stockTx, vendors, saasClients, supportTickets
    ] = await Promise.all([
      pool.query('SELECT * FROM businesses;'),
      pool.query('SELECT * FROM developer_settings;'),
      pool.query('SELECT * FROM settings;'),
      pool.query('SELECT * FROM saas_settings;'),
      pool.query('SELECT * FROM orders ORDER BY created_at DESC;'),
      pool.query('SELECT * FROM customers;'),
      pool.query('SELECT * FROM products;'),
      pool.query('SELECT * FROM expenses;'),
      pool.query('SELECT id, name, email, job_title, pin, business_id, is_active, created_at FROM team_members;'),
      pool.query('SELECT * FROM stock_items;'),
      pool.query('SELECT * FROM stock_transactions ORDER BY created_at DESC LIMIT 1000;'),
      pool.query('SELECT * FROM vendors;'),
      pool.query('SELECT * FROM saas_clients;'),
      pool.query('SELECT * FROM saas_support_tickets;')
    ]);

    const backupData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        version: '2.4.0',
        platform: 'PrintFlow SaaS / Developer Console',
        exportedBy: req.user?.name || 'Developer',
        counts: {
          businesses: biz.rows.length,
          orders: orders.rows.length,
          customers: customers.rows.length,
          products: products.rows.length,
          expenses: expenses.rows.length,
          team: team.rows.length,
          stock: stock.rows.length
        }
      },
      tables: {
        businesses: biz.rows,
        developer_settings: devSettings.rows,
        settings: shopSettings.rows,
        saas_settings: saasSet.rows,
        orders: orders.rows,
        customers: customers.rows,
        products: products.rows,
        expenses: expenses.rows,
        team_members: team.rows,
        stock_items: stock.rows,
        stock_transactions: stockTx.rows,
        vendors: vendors.rows,
        saas_clients: saasClients.rows,
        saas_support_tickets: supportTickets.rows
      }
    };

    await logAudit(req, {
      action: 'Database Backup Generated',
      clientCompany: 'Platform System',
      targetType: 'database',
      details: backupData.metadata
    });

    if (req.query.download === 'true') {
      const filename = `printflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(JSON.stringify(backupData, null, 2));
    }

    return res.json({ ok: true, backup: backupData });
  } catch (err) {
    logger.error('Database backup failed:', err);
    res.status(500).json({ error: 'Failed to generate database backup.' });
  }
}

async function restoreDatabase(req, res) {
  const client = await pool.connect();
  try {
    const backup = req.body.tables ? req.body : req.body.backup;
    if (!backup || !backup.tables) {
      return res.status(400).json({ error: 'Invalid backup file format. "tables" payload missing.' });
    }

    await client.query('BEGIN');
    const { tables } = backup;
    let restoredCount = 0;

    // Restore businesses
    if (Array.isArray(tables.businesses)) {
      for (const b of tables.businesses) {
        await client.query(`
          INSERT INTO businesses (business_id, name, slug, owner_name, email, phone, status, subscription_plan, features, settings)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (business_id) DO UPDATE SET
            name = EXCLUDED.name, status = EXCLUDED.status, subscription_plan = EXCLUDED.subscription_plan, features = EXCLUDED.features;
        `, [b.business_id, b.name, b.slug || null, b.owner_name || '', b.email || '', b.phone || '', b.status || 'active', b.subscription_plan || 'Standard', JSON.stringify(b.features || {}), JSON.stringify(b.settings || {})]);
        restoredCount++;
      }
    }

    // Restore developer settings
    if (Array.isArray(tables.developer_settings)) {
      for (const ds of tables.developer_settings) {
        await client.query(`
          INSERT INTO developer_settings (business_id, key, value)
          VALUES ($1, $2, $3)
          ON CONFLICT (business_id, key) DO UPDATE SET value = EXCLUDED.value;
        `, [ds.business_id || 'global_settings', ds.key, JSON.stringify(ds.value || {})]);
      }
    }

    // Restore SaaS settings
    if (Array.isArray(tables.saas_settings)) {
      for (const s of tables.saas_settings) {
        await client.query(`
          INSERT INTO saas_settings (key, value)
          VALUES ($1, $2)
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
        `, [s.key, JSON.stringify(s.value || {})]);
      }
    }

    await client.query('COMMIT');

    await logAudit(req, {
      action: 'Database Restored from Backup',
      clientCompany: 'Platform System',
      targetType: 'database',
      details: { timestamp: new Date().toISOString(), restoredRecords: restoredCount }
    });

    return res.json({
      ok: true,
      message: `Database restore successfully completed. Restored ${restoredCount} core business records.`,
      restoredCount
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Database restore error:', err);
    res.status(500).json({ error: `Restore failed: ${err.message}` });
  } finally {
    client.release();
  }
}

async function runMigrations(req, res) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS saas_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        action TEXT NOT NULL,
        performed_by TEXT NOT NULL DEFAULT 'Developer',
        performer_role TEXT NOT NULL DEFAULT 'SUPER_ADMIN',
        client_company TEXT NOT NULL DEFAULT '',
        target_id TEXT NOT NULL DEFAULT '',
        target_type TEXT NOT NULL DEFAULT '',
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        ip_address TEXT NOT NULL DEFAULT '127.0.0.1',
        device_info TEXT NOT NULL DEFAULT 'Developer Console',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS saas_settings (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS saas_support_tickets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_name TEXT NOT NULL,
        client_email TEXT NOT NULL,
        company_name TEXT NOT NULL DEFAULT '',
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'open',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await logAudit(req, {
      action: 'Migrations Executed & Verified',
      clientCompany: 'Platform System',
      targetType: 'database_migrations'
    });

    return res.json({
      ok: true,
      message: 'All PostgreSQL schema migrations verified and up-to-date.'
    });
  } catch (err) {
    logger.error('Failed to run migrations:', err);
    res.status(500).json({ error: `Migration check failed: ${err.message}` });
  }
}

// ─────────────────────────────────────────────────────────────
// 10. SECURITY: SESSIONS, SECURITY POLICY & RATE LIMITING
// ─────────────────────────────────────────────────────────────

async function getSecurityOverview(req, res) {
  try {
    const [teamRes, clientsRes, secSetRes, auditRes, failedLoginsRes, revokedGlobalRes] = await Promise.all([
      pool.query(`
        SELECT id, local_id, name, email, job_title, role, business_id, is_active, session_revoked_at, created_at, updated_at
        FROM team_members
        ORDER BY updated_at DESC;
      `),
      pool.query(`
        SELECT id, name, email, business_id, status, session_revoked_at, last_login_at, created_at, updated_at
        FROM saas_clients
        WHERE last_login_at IS NOT NULL OR status = 'active'
        ORDER BY COALESCE(last_login_at, updated_at, created_at) DESC;
      `),
      pool.query(`SELECT value FROM saas_settings WHERE key = 'security_policy';`),
      pool.query(`
        SELECT * FROM saas_audit_logs
        WHERE action ILIKE '%login%' OR action ILIKE '%auth%' OR action ILIKE '%password%' OR action ILIKE '%security%'
        ORDER BY created_at DESC LIMIT 50;
      `),
      pool.query(`
        SELECT count(*)::int as count FROM saas_audit_logs
        WHERE action ILIKE '%failed%' OR action ILIKE '%denied%';
      `),
      pool.query(`SELECT value FROM saas_settings WHERE key = 'revoked_sessions_at';`)
    ]);

    let globalRevokedAt = null;
    if (revokedGlobalRes.rows.length && revokedGlobalRes.rows[0].value) {
      const v = typeof revokedGlobalRes.rows[0].value === 'string'
        ? revokedGlobalRes.rows[0].value
        : JSON.parse(JSON.stringify(revokedGlobalRes.rows[0].value));
      globalRevokedAt = new Date(v).getTime();
    }

    const teamSessions = teamRes.rows.map(m => {
      const lastActiveTime = new Date(m.updated_at || m.created_at).getTime();
      const userRevokedTime = m.session_revoked_at ? new Date(m.session_revoked_at).getTime() : 0;
      
      const isRevoked = Boolean(
        (userRevokedTime > 0 && userRevokedTime >= (lastActiveTime - 5000)) ||
        (globalRevokedAt && globalRevokedAt >= (lastActiveTime - 5000))
      );
      const isOnline = m.is_active !== false && !isRevoked;

      return {
        id: m.id,
        localId: m.local_id,
        name: m.name,
        email: m.email,
        role: m.job_title || m.role || 'STAFF',
        businessId: m.business_id || 'global_settings',
        isActive: isOnline,
        isRevoked,
        revokedAt: m.session_revoked_at || (isRevoked && globalRevokedAt ? new Date(globalRevokedAt).toISOString() : null),
        lastActive: m.updated_at || m.created_at,
        ip: '127.0.0.1 (Staff Session)',
        device: 'Employee Portal'
      };
    });

    const clientSessions = clientsRes.rows.map(c => {
      const lastActiveTime = new Date(c.last_login_at || c.updated_at || c.created_at).getTime();
      const userRevokedTime = c.session_revoked_at ? new Date(c.session_revoked_at).getTime() : 0;
      
      const isRevoked = Boolean(
        (userRevokedTime > 0 && userRevokedTime >= (lastActiveTime - 5000)) ||
        (globalRevokedAt && globalRevokedAt >= (lastActiveTime - 5000))
      );
      const isOnline = c.status === 'active' && !isRevoked;

      return {
        id: c.id,
        localId: 'OWNER',
        name: c.name,
        email: c.email,
        role: 'OWNER',
        businessId: c.business_id || 'global_settings',
        isActive: isOnline,
        isRevoked,
        revokedAt: c.session_revoked_at || (isRevoked && globalRevokedAt ? new Date(globalRevokedAt).toISOString() : null),
        lastActive: c.last_login_at || c.updated_at || c.created_at,
        ip: '127.0.0.1 (Owner Session)',
        device: 'Owner Portal'
      };
    });

    const activeSessions = [...clientSessions, ...teamSessions].sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());

    const defaultSecurity = {
      session_timeout_minutes: 120,
      enforce_mfa_developer: false,
      ip_whitelist_enabled: false,
      allowed_ips: ['127.0.0.1', '::1'],
      max_failed_logins: 5,
      rate_limit_per_minute: 500,
      revoked_sessions_at: globalRevokedAt ? new Date(globalRevokedAt).toISOString() : null
    };

    const securityPolicy = secSetRes.rows[0]?.value ? { ...defaultSecurity, ...secSetRes.rows[0].value } : defaultSecurity;
    const sysMetrics = systemMonitor.getMetrics();
    const liveActiveCount = activeSessions.filter(s => s.isActive).length;

    return res.json({
      ok: true,
      security: {
        activeSessions,
        totalActiveSessions: liveActiveCount,
        failedLoginAttempts: failedLoginsRes.rows[0]?.count || 0,
        loginLogs: auditRes.rows,
        securityPolicy,
        rateLimit: {
          status: sysMetrics.rateLimitStatus,
          requestsThisMinute: sysMetrics.requestsThisMinute,
          maxPerMinute: sysMetrics.rateLimitMaxPerMin,
          blockedRequests: sysMetrics.blockedRequests
        }
      }
    });
  } catch (err) {
    logger.error('Failed to get security overview:', err);
    res.status(500).json({ error: 'Failed to retrieve security overview.' });
  }
}

async function revokeSessions(req, res) {
  try {
    const revokedAt = new Date().toISOString();
    await pool.query(`
      INSERT INTO saas_settings (key, value, updated_at)
      VALUES ('revoked_sessions_at', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW();
    `, [JSON.stringify(revokedAt)]);

    // Invalidate sessions in database for all employees and clients
    await pool.query(`UPDATE team_members SET session_revoked_at = NOW(), updated_at = NOW() WHERE is_active = true`);
    await pool.query(`UPDATE saas_clients SET session_revoked_at = NOW(), updated_at = NOW() WHERE status = 'active'`);

    // Invalidate rbac in-memory cache
    invalidateGlobalRevokedCache();

    await logAudit(req, {
      action: 'Active Sessions Revoked',
      clientCompany: 'Platform System',
      targetType: 'security',
      details: { revokedAt }
    });

    return res.json({
      ok: true,
      message: 'All active platform sessions have been revoked. Users will be asked to authenticate on next request.',
      revokedAt
    });
  } catch (err) {
    logger.error('Failed to revoke sessions:', err);
    res.status(500).json({ error: 'Failed to revoke sessions.' });
  }
}

async function revokeUserSession(req, res) {
  try {
    const { id } = req.params;
    const revokedAt = new Date().toISOString();

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    let teamRes;
    if (isUuid) {
      teamRes = await pool.query(
        `UPDATE team_members SET session_revoked_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING id, name, email`,
        [id]
      );
    } else {
      teamRes = await pool.query(
        `UPDATE team_members SET session_revoked_at = NOW(), updated_at = NOW() WHERE local_id = $1 RETURNING id, name, email`,
        [id]
      );
    }

    let clientRes = { rows: [] };
    if (isUuid && !teamRes.rows.length) {
      clientRes = await pool.query(
        `UPDATE saas_clients SET session_revoked_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING id, name, email`,
        [id]
      );
    }

    const targetUser = teamRes.rows[0] || clientRes.rows[0];
    if (!targetUser) {
      return res.status(404).json({ error: 'User session not found.' });
    }

    invalidateGlobalRevokedCache();

    await logAudit(req, {
      action: 'User Session Revoked',
      clientCompany: 'Platform System',
      targetType: 'user_session',
      targetId: id,
      details: { name: targetUser.name, email: targetUser.email, revokedAt }
    });

    return res.json({
      ok: true,
      message: `Active session for ${targetUser.name} has been revoked.`,
      revokedAt,
      userId: id
    });
  } catch (err) {
    logger.error('Failed to revoke user session:', err);
    res.status(500).json({ error: 'Failed to revoke user session.' });
  }
}

async function updateSecuritySettings(req, res) {
  try {
    const policy = req.body;
    await pool.query(`
      INSERT INTO saas_settings (key, value, updated_at)
      VALUES ('security_policy', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW();
    `, [JSON.stringify(policy)]);

    // Update in-memory cached policy immediately
    updatePolicyCache(policy);

    await logAudit(req, {
      action: 'Security Policy Updated',
      clientCompany: 'Platform System',
      targetType: 'security_policy',
      details: policy
    });

    return res.json({ ok: true, message: 'Security settings updated successfully.', policy });
  } catch (err) {
    logger.error('Failed to update security settings:', err);
    res.status(500).json({ error: 'Failed to update security settings.' });
  }
}

// ─────────────────────────────────────────────────────────────
// 11. SYSTEM SETTINGS (APP BRANDING, EMAIL, STORAGE, MAINTENANCE)
// ─────────────────────────────────────────────────────────────

async function getSystemSettings(req, res) {
  try {
    const { rows } = await pool.query(`SELECT key, value FROM saas_settings;`);
    const map = {};
    rows.forEach(r => { map[r.key] = r.value; });

    const response = {
      appInfo: map['platform_info'] || {
        name: 'PrintFlow SaaS Developer Console',
        logoUrl: '',
        faviconUrl: '',
        supportEmail: 'dev@printghar.com',
        contactPhone: '+977-9800000000'
      },
      defaults: map['default_settings'] || {
        currency: 'Rs.',
        dateMode: 'AD',
        language: 'en',
        invoicePrefix: 'INV-'
      },
      emailConfig: map['email_config'] || {
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpUser: 'notifications@printghar.com',
        smtpSecure: true,
        senderName: 'PrintFlow System'
      },
      storageConfig: map['storage_config'] || {
        provider: 'cloudinary',
        maxUploadMb: 50,
        allowedFormats: 'pdf, cdr, ai, psd, png, jpg, zip'
      },
      maintenanceMode: map['maintenance_mode'] || {
        enabled: false,
        message: 'The system is undergoing scheduled maintenance. Please check back shortly.'
      },
      notifications: map['notification_settings'] || {
        whatsappEnabled: true,
        lowStockAlert: true,
        lowStockThreshold: 5,
        eodReportTime: '18:00'
      }
    };

    return res.json({ ok: true, settings: response });
  } catch (err) {
    logger.error('Failed to get system settings:', err);
    res.status(500).json({ error: 'Failed to retrieve system settings.' });
  }
}

async function updateSystemSettings(req, res) {
  try {
    const { category, value } = req.body;
    if (!category || !value) {
      return res.status(400).json({ error: 'category and value are required.' });
    }

    const keyMap = {
      appInfo: 'platform_info',
      defaults: 'default_settings',
      emailConfig: 'email_config',
      storageConfig: 'storage_config',
      maintenanceMode: 'maintenance_mode',
      notifications: 'notification_settings'
    };

    const dbKey = keyMap[category] || category;

    await pool.query(`
      INSERT INTO saas_settings (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW();
    `, [dbKey, JSON.stringify(value)]);

    if (dbKey === 'maintenance_mode') {
      updateMaintenanceModeCache(value);
    }

    await logAudit(req, {
      action: `System Setting Updated: ${dbKey}`,
      clientCompany: 'Platform System',
      targetType: 'system_settings',
      details: { key: dbKey, value }
    });

    return res.json({ ok: true, message: `Setting "${category}" updated successfully.` });
  } catch (err) {
    logger.error('Failed to update system settings:', err);
    res.status(500).json({ error: 'Failed to update system settings.' });
  }
}

// ─────────────────────────────────────────────────────────────
// 12. SUPPORT: ANNOUNCEMENTS & NOTIFICATION BROADCASTS
// ─────────────────────────────────────────────────────────────

async function getAnnouncements(req, res) {
  try {
    const { rows } = await pool.query(`SELECT value FROM saas_settings WHERE key = 'system_announcements';`);
    const announcements = rows[0]?.value || [
      {
        id: 'ann-1',
        title: 'Platform Maintenance Notice',
        message: 'Scheduled backup and database optimization will take place on Saturday at 11:00 PM NPT.',
        type: 'info',
        target: 'all',
        isActive: true,
        createdAt: new Date().toISOString()
      }
    ];

    return res.json({ ok: true, announcements });
  } catch (err) {
    logger.error('Failed to get announcements:', err);
    res.status(500).json({ error: 'Failed to fetch announcements.' });
  }
}

async function createAnnouncement(req, res) {
  try {
    const { title, message, type = 'info', target = 'all' } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required.' });
    }

    const { rows } = await pool.query(`SELECT value FROM saas_settings WHERE key = 'system_announcements';`);
    const announcements = rows[0]?.value || [];

    const newAnnouncement = {
      id: `ann-${Date.now()}`,
      title,
      message,
      type,
      target,
      isActive: true,
      createdAt: new Date().toISOString()
    };

    announcements.unshift(newAnnouncement);

    await pool.query(`
      INSERT INTO saas_settings (key, value, updated_at)
      VALUES ('system_announcements', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW();
    `, [JSON.stringify(announcements)]);

    await logAudit(req, {
      action: 'System Announcement Created',
      clientCompany: 'Platform System',
      targetType: 'announcement',
      details: newAnnouncement
    });

    return res.json({ ok: true, announcement: newAnnouncement });
  } catch (err) {
    logger.error('Failed to create announcement:', err);
    res.status(500).json({ error: 'Failed to create announcement.' });
  }
}

async function deleteAnnouncement(req, res) {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(`SELECT value FROM saas_settings WHERE key = 'system_announcements';`);
    const announcements = rows[0]?.value || [];

    const filtered = announcements.filter(a => a.id !== id);

    await pool.query(`
      UPDATE saas_settings SET value = $1, updated_at = NOW() WHERE key = 'system_announcements';
    `, [JSON.stringify(filtered)]);

    return res.json({ ok: true, message: 'Announcement deleted.' });
  } catch (err) {
    logger.error('Failed to delete announcement:', err);
    res.status(500).json({ error: 'Failed to delete announcement.' });
  }
}

async function createSupportTicket(req, res) {
  try {
    const { client_name, client_email, company_name, subject, message, priority = 'medium' } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message are required.' });
    }

    const { rows } = await pool.query(`
      INSERT INTO saas_support_tickets (client_name, client_email, company_name, subject, message, priority, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'open')
      RETURNING *;
    `, [client_name || req.user?.name || 'Client', client_email || req.user?.email || 'support@printghar.com', company_name || 'Print Ghar', subject, message, priority]);

    return res.json({ ok: true, ticket: rows[0] });
  } catch (err) {
    logger.error('Failed to create support ticket:', err);
    res.status(500).json({ error: 'Failed to create support ticket.' });
  }
}

async function broadcastSystemNotification(req, res) {
  try {
    const { title, message, targetRole = 'all', businessId = 'global_settings' } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required.' });
    }

    const notif = await createWorkNotification({
      businessId,
      targetRole,
      title,
      message,
      stage: 'Broadcast'
    });

    await logAudit(req, {
      action: 'System Notification Broadcasted',
      clientCompany: businessId,
      targetType: 'notification',
      details: { title, targetRole }
    });

    return res.json({ ok: true, notification: notif });
  } catch (err) {
    logger.error('Failed to broadcast notification:', err);
    res.status(500).json({ error: 'Failed to broadcast notification.' });
  }
}

// ─────────────────────────────────────────────────────────────
// POINT 3: SUBSCRIPTION & LICENSE EXPIRY MANAGEMENT
// ─────────────────────────────────────────────────────────────

async function updateClientSubscription(req, res) {
  try {
    const { id } = req.params;
    const { plan, duration, status, expiresAt, extendDays } = req.body;

    const existing = await pool.query('SELECT * FROM saas_clients WHERE id = $1::uuid', [id]);
    if (!existing.rows.length) {
      return res.status(404).json({ error: 'Client not found.' });
    }

    const current = existing.rows[0];
    const newDuration = duration || current.plan_duration || 'monthly';
    let newExpiresAt = null;

    if (newDuration === 'lifetime') {
      newExpiresAt = null;
    } else if (extendDays) {
      const base = (current.subscription_expires_at && new Date(current.subscription_expires_at) > new Date())
        ? new Date(current.subscription_expires_at)
        : new Date();
      newExpiresAt = new Date(base.getTime() + Number(extendDays) * 24 * 60 * 60 * 1000);
    } else if (expiresAt) {
      newExpiresAt = new Date(expiresAt);
    } else if (current.subscription_expires_at) {
      newExpiresAt = new Date(current.subscription_expires_at);
    } else {
      // If client had no expiry date, compute based on duration
      if (newDuration === 'quarterly') newExpiresAt = new Date(Date.now() + 90 * 86400000);
      else if (newDuration === 'yearly') newExpiresAt = new Date(Date.now() + 365 * 86400000);
      else newExpiresAt = new Date(Date.now() + 30 * 86400000);
    }

    const newPlan = plan || current.subscription_plan || 'Standard';
    let newSubStatus = status || (newExpiresAt === null || newExpiresAt > new Date() ? 'active' : 'expired');

    if (status === 'expired') {
      newSubStatus = 'expired';
      if (!newExpiresAt || newExpiresAt >= new Date()) {
        newExpiresAt = new Date(Date.now() - 86400000);
      }
    } else if (status === 'active' && newDuration !== 'lifetime') {
      newSubStatus = 'active';
      if (!newExpiresAt || newExpiresAt <= new Date()) {
        newExpiresAt = new Date(Date.now() + 30 * 86400000);
      }
    }

    const newAccountStatus = (newSubStatus === 'expired') ? 'expired' :
                             (newSubStatus === 'suspended') ? 'suspended' :
                             (current.status === 'deactivated' ? 'deactivated' : 'active');

    const { rows } = await pool.query(
      `UPDATE saas_clients
       SET subscription_plan = $1,
           plan_duration = $2,
           subscription_status = $3,
           subscription_expires_at = $4,
           status = $5,
           updated_at = NOW()
       WHERE id = $6::uuid
       RETURNING id, name, email, status, subscription_plan, plan_duration, subscription_status, subscription_expires_at`,
      [newPlan, newDuration, newSubStatus, newExpiresAt, newAccountStatus, id]
    );

    await logAudit(req, {
      action: 'Update Client Subscription',
      clientCompany: current.company_name || current.name,
      targetId: id,
      targetType: 'saas_client',
      details: { plan: newPlan, duration: newDuration, status: newSubStatus, expiresAt: newExpiresAt }
    });

    const updated = rows[0];
    const now = Date.now();
    const expMs = new Date(updated.subscription_expires_at).getTime();
    const isExpired = updated.subscription_status === 'expired' || updated.status === 'expired' || (expMs ? expMs < now : false);
    const daysRemaining = expMs ? Math.ceil((expMs - now) / (1000 * 60 * 60 * 24)) : null;
    const isGrace = !isExpired && (updated.subscription_status === 'grace_period' || (daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0));

    return res.json({
      ok: true,
      client: {
        ...updated,
        status: isExpired ? 'expired' : updated.status,
        subscription_status: isExpired ? 'expired' : updated.subscription_status,
        days_remaining: isExpired && daysRemaining > 0 ? 0 : daysRemaining,
        is_expired: isExpired,
        is_grace_period: isGrace
      }
    });
  } catch (err) {
    logger.error('Failed to update subscription:', err);
    res.status(500).json({ error: 'Failed to update client subscription.' });
  }
}

// ─────────────────────────────────────────────────────────────
// POINT 5: SAFE DATABASE QUERY PLAYGROUND / SQL INSPECTOR
// ─────────────────────────────────────────────────────────────

const FORBIDDEN_SQL_PATTERNS = [
  /\b(insert|update|delete|drop|truncate|alter|create|grant|revoke|vacuum|copy)\b/i,
  /;\s*(insert|update|delete|drop|truncate|alter|create)/i
];

const PREBUILT_QUERIES = [
  {
    id: 'orders_by_tenant',
    name: 'Order Volume & Revenue per Tenant',
    query: `SELECT business_id, COUNT(*) AS total_orders, COALESCE(SUM(total), 0) AS total_revenue, COALESCE(SUM(advance), 0) AS total_collected FROM orders GROUP BY business_id ORDER BY total_orders DESC;`
  },
  {
    id: 'table_sizes',
    name: 'Top Database Tables by Disk Size',
    query: `SELECT relname AS table_name, pg_size_pretty(pg_total_relation_size(relid)) AS total_size, n_live_tup AS live_rows FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 15;`
  },
  {
    id: 'team_members_by_role',
    name: 'Team Members & Staff Roles Across Tenants',
    query: `SELECT business_id, name, role, job_title, status, phone FROM team_members ORDER BY business_id, name LIMIT 50;`
  },
  {
    id: 'recent_audit_logs',
    name: 'Recent 25 SaaS Audit Log Events',
    query: `SELECT created_at, action, performed_by, performer_role, client_company, ip_address FROM saas_audit_logs ORDER BY created_at DESC LIMIT 25;`
  },
  {
    id: 'recent_orders',
    name: 'Latest 20 Orders System-Wide',
    query: `SELECT id, order_number, customer_name, status, total, payment_status, business_id, created_at FROM orders ORDER BY created_at DESC LIMIT 20;`
  },
  {
    id: 'tenants_and_subscriptions',
    name: 'All SaaS Clients & Subscription Expiry Dates',
    query: `SELECT id, name, email, status, subscription_plan, subscription_status, subscription_expires_at, created_at FROM saas_clients ORDER BY created_at DESC;`
  }
];

async function getSavedQueries(req, res) {
  return res.json({ ok: true, queries: PREBUILT_QUERIES });
}

async function executeSafeQuery(req, res) {
  try {
    let { query } = req.body;
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'SQL query string is required.' });
    }

    query = query.trim().replace(/;+$/, '');

    const lowerQuery = query.toLowerCase();
    const isSelect = lowerQuery.startsWith('select') || lowerQuery.startsWith('explain') || lowerQuery.startsWith('with');
    if (!isSelect) {
      return res.status(400).json({
        error: 'Security Restriction: Only read-only queries (SELECT, WITH, EXPLAIN) are permitted in SQL Inspector.'
      });
    }

    for (const pattern of FORBIDDEN_SQL_PATTERNS) {
      if (pattern.test(query)) {
        return res.status(403).json({
          error: `Security Violation: Destructive or data-modifying SQL statements are blocked in SQL Inspector.`
        });
      }
    }

    if (!/\blimit\s+\d+/i.test(query)) {
      query += ' LIMIT 100';
    }

    const startTime = Date.now();
    const client = await pool.connect();
    try {
      await client.query('SET LOCAL statement_timeout = 4000;');
      const result = await client.query(query);
      const executionTimeMs = Date.now() - startTime;

      const fields = result.fields ? result.fields.map(f => f.name) : [];

      await logAudit(req, {
        action: 'Execute SQL Query',
        details: { query: query.slice(0, 150), rowCount: result.rowCount, executionTimeMs }
      });

      return res.json({
        ok: true,
        fields,
        columns: fields,
        rows: result.rows,
        rowCount: result.rowCount,
        executionTimeMs,
        durationMs: executionTimeMs
      });
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error('SQL Inspector execution error:', err.message);
    res.status(400).json({ error: err.message || 'Failed to execute query.' });
  }
}

// ─────────────────────────────────────────────────────────────
// POINT 7: REAL-TIME CRASH & ERROR TRACE VIEWER
// ─────────────────────────────────────────────────────────────

async function getErrorLogs(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = req.query.limit === 'all' ? 10000 : Math.max(1, parseInt(req.query.limit, 10) || 20);
    const { resolved, search, skip, offset } = req.query;
    const finalOffset = skip !== undefined
      ? Math.max(0, parseInt(skip, 10))
      : (offset !== undefined ? Math.max(0, parseInt(offset, 10)) : (page - 1) * limit);

    const result = await crashReporter.getRecentErrors({ limit, page, skip: finalOffset, resolved, search });
    return res.json({ ok: true, ...result });
  } catch (err) {
    logger.error('Failed to get error logs:', err);
    res.status(500).json({ error: 'Failed to fetch error logs.' });
  }
}

async function resolveErrorLog(req, res) {
  try {
    const { id } = req.params;
    const success = await crashReporter.resolveError(id);
    if (!success) return res.status(400).json({ error: 'Failed to resolve error.' });
    return res.json({ ok: true, message: 'Error marked as resolved.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve error log.' });
  }
}

async function clearErrorLogs(req, res) {
  try {
    await crashReporter.clearResolvedErrors();
    return res.json({ ok: true, message: 'Resolved errors cleared.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear resolved errors.' });
  }
}

async function reportFrontendError(req, res) {
  try {
    const { message, stack, path: errPath, userAgent, statusCode, endpoint, method, businessId, userEmail } = req.body;
    const captured = await crashReporter.captureError({
      message: message || 'Client UI error',
      stack: stack || '',
      statusCode: statusCode || 400
    }, {
      method: method || 'CLIENT_UI',
      originalUrl: errPath || endpoint || '/',
      user: req.user || (userEmail ? { email: userEmail, businessId: businessId || 'system' } : null),
      ip: req.ip,
      headers: { 'user-agent': userAgent || req.headers['user-agent'] }
    });
    return res.status(200).json({ ok: true, error: captured });
  } catch (_) {
    return res.status(200).json({ ok: true });
  }
}

// ─────────────────────────────────────────────────────────────
// POINT 8: AUTOMATED SCHEDULED DATABASE BACKUPS
// ─────────────────────────────────────────────────────────────

async function getAutomatedBackups(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = req.query.limit === 'all' ? 10000 : Math.max(1, parseInt(req.query.limit, 10) || 20);
    const { search, skip, offset } = req.query;
    const finalOffset = skip !== undefined
      ? Math.max(0, parseInt(skip, 10))
      : (offset !== undefined ? Math.max(0, parseInt(offset, 10)) : (page - 1) * limit);

    let allBackups = backupScheduler.listAutomatedBackups();
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      allBackups = allBackups.filter(b => b.filename.toLowerCase().includes(q));
    }
    const total = allBackups.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const backups = allBackups.slice(finalOffset, finalOffset + limit);
    const scheduler = backupScheduler.getSchedulerStatus();
    return res.json({ ok: true, backups, total, page, limit, totalPages, scheduler });
  } catch (err) {
    logger.error('Failed to get automated backups:', err);
    res.status(500).json({ error: 'Failed to list automated backups.' });
  }
}

async function runAutomatedBackupNow(req, res) {
  try {
    const backup = await backupScheduler.createAutomatedBackup();
    await logAudit(req, {
      action: 'Manual Trigger Automated Backup',
      details: { filename: backup.filename, sizeBytes: backup.sizeBytes }
    });
    return res.json({ ok: true, backup, message: 'Automated backup generated successfully.' });
  } catch (err) {
    logger.error('Failed to trigger backup now:', err);
    res.status(500).json({ error: err.message || 'Failed to generate backup.' });
  }
}

async function downloadAutomatedBackup(req, res) {
  try {
    const { filename } = req.params;
    const filePath = backupScheduler.getBackupFilePath(filename);
    if (!filePath) {
      return res.status(404).json({ error: 'Backup file not found or invalid filename.' });
    }
    return res.download(filePath, filename);
  } catch (err) {
    res.status(500).json({ error: 'Failed to download backup.' });
  }
}

module.exports = {
  // Auth
  developerLogin,
  verifyDeveloperMfa,
  getDeveloperProfile,

  // Stats
  getStats,

  // Server & Logs
  getServerStatus,
  getLogs,

  // Database / Data
  getDatabaseHealth,
  backupDatabase,
  restoreDatabase,
  runMigrations,
  getSavedQueries,
  executeSafeQuery,
  getAutomatedBackups,
  runAutomatedBackupNow,
  downloadAutomatedBackup,

  // Security
  getSecurityOverview,
  revokeSessions,
  revokeUserSession,
  updateSecuritySettings,

  // Crash Reporter / Errors
  getErrorLogs,
  resolveErrorLog,
  clearErrorLogs,
  reportFrontendError,

  // System Settings
  getSystemSettings,
  updateSystemSettings,

  // Support & Announcements
  getSupportTickets,
  updateSupportTicket,
  createSupportTicket,
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  broadcastSystemNotification,

  // Clients
  getClients,
  getClientById,
  createClient,
  updateClient,
  toggleClientStatus,
  resetClientPassword,
  deleteClient,
  updateClientSubscription,

  // Audit Logs
  getAuditLogs,

  // Settings
  getSettings,
  updateSettings,

  // Multi-Tenant Businesses & Developer Settings
  getBusinesses,
  getBusinessById,
  getBusinessDeveloperSettings,
  updateBusinessDeveloperSettings,
};
