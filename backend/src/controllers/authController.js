'use strict';

const { pool } = require('../config/db');
const { rowToDoc } = require('../config/dbHelpers');
const { hashPassword, verifyPassword, signToken, sanitizeUser } = require('../utils/authHelper');
const { ROLES, ROLE_PERMISSIONS, getCombinedPermissions } = require('../config/permissions');
const { sendPasswordResetOtp, sendRegistrationOtp } = require('../services/emailService');
const logger = require('../utils/logger');
const { checkLoginLockout, recordFailedLogin, resetFailedLogins, getClientIp } = require('../services/securityPolicyService');

// ─── Multi-tenant helpers ─────────────────────────────────────────────────────

/**
 * Converts a company/business name to a URL-safe slug used as business_id.
 */
function slugify(name) {
  return String(name || 'business')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50) || 'business';
}

/**
 * Ensures a saas_companies entry exists for this client and returns its slug,
 * which is used as the tenant business_id for all data isolation queries.
 * If the client already has a linked company, returns its existing slug.
 * Otherwise, creates a new company record and links it.
 */
async function getOrCreateClientBusinessId(clientId, clientEmail, companyName) {
  // Check if client already has a linked company or business_id
  const linkRes = await pool.query(
    `SELECT sc.company_id, sc.business_id, co.slug
     FROM saas_clients sc
     LEFT JOIN saas_companies co ON co.id = sc.company_id
     WHERE sc.id = $1`,
    [clientId]
  );

  if (linkRes.rows.length) {
    if (clientEmail === 'kishor@printghar.com') {
      return 'global_settings';
    }
    if (linkRes.rows[0].business_id && linkRes.rows[0].business_id !== 'global_settings') {
      return linkRes.rows[0].business_id;
    }
    if (linkRes.rows[0].company_id && linkRes.rows[0].slug) {
      await pool.query(`UPDATE saas_clients SET business_id = $1 WHERE id = $2`, [linkRes.rows[0].slug, clientId]);
      return linkRes.rows[0].slug;
    }
  }

  // Build a unique slug for this new business tenant
  const baseSlug = slugify(companyName || clientEmail.split('@')[0]);
  let slug = baseSlug;
  const existingSlug = await pool.query(`SELECT id FROM saas_companies WHERE slug = $1`, [slug]);
  if (existingSlug.rows.length) {
    slug = `${baseSlug}-${Date.now().toString(36)}`;
  }

  // Create the company record
  const companyRes = await pool.query(
    `INSERT INTO saas_companies (name, slug, owner_client_id, email, status)
     VALUES ($1, $2, $3::uuid, $4, 'active')
     RETURNING id, slug`,
    [companyName || clientEmail.split('@')[0], slug, clientId, clientEmail]
  );

  const companyId = companyRes.rows[0].id;

  // Insert into businesses table
  await pool.query(
    `INSERT INTO businesses (business_id, name, slug, owner_client_id, email, status)
     VALUES ($1, $2, $1, $3::uuid, $4, 'active')
     ON CONFLICT (business_id) DO NOTHING`,
    [slug, companyName || clientEmail.split('@')[0], clientId, clientEmail]
  );

  // Link the new company and business_id to the client
  await pool.query(
    `UPDATE saas_clients SET company_id = $1, business_id = $2, updated_at = NOW() WHERE id = $3`,
    [companyId, slug, clientId]
  );

  // Bootstrap an isolated settings row for this business tenant
  await pool.query(
    `INSERT INTO settings (key, shop_name, business_id)
     VALUES ($1, $2, $1)
     ON CONFLICT (key) DO NOTHING`,
    [slug, companyName || clientEmail.split('@')[0]]
  );

  logger.info(`🏢 New business tenant created: slug="${slug}" for client ${clientEmail}`);
  return slug;
}

/**
 * POST /api/auth/login
 * Supports email + password or phone + pin/password
 */
const login = async (req, res, next) => {
  try {
    const { email, phone, identifier, employeeId, shopCode: inputShopCode, password, pin, businessId: bodyBizId } = req.body;
    const credUser = (employeeId || identifier || email || phone || '').trim();
    const credPass = password || pin || '';
    const rawShopCode = (inputShopCode || req.headers['x-shop-code'] || '').trim();

    if (!credUser || !credPass) {
      return res.status(400).json({ error: 'Please provide Employee ID and Password.' });
    }

    const clientIp = getClientIp(req);
    const lockStatus = await checkLoginLockout(credUser, clientIp);
    if (lockStatus.locked) {
      return res.status(429).json({
        error: `Security Alert: Account temporarily locked due to ${lockStatus.maxAttempts} failed login attempts. Please try again in ${lockStatus.remainingMinutes} minute(s) or contact your manager.`,
        code: 'ACCOUNT_LOCKED',
      });
    }

    let targetBizId = req.headers['x-business-id'] || bodyBizId || (req.user && req.user.businessId);

    // If shopCode is provided, resolve the exact business
    if (rawShopCode) {
      const bizLookup = await pool.query(
        `SELECT business_id, name, shop_code FROM businesses 
         WHERE LOWER(shop_code) = LOWER($1) 
            OR LOWER(business_id) = LOWER($1) 
            OR LOWER(slug) = LOWER($1) 
         LIMIT 1`,
        [rawShopCode]
      );
      if (bizLookup.rows.length) {
        targetBizId = bizLookup.rows[0].business_id;
      } else {
        const clientLookup = await pool.query(
          `SELECT business_id, name, shop_code FROM saas_clients 
           WHERE LOWER(shop_code) = LOWER($1) 
              OR LOWER(business_id) = LOWER($1) 
           LIMIT 1`,
          [rawShopCode]
        );
        if (!clientLookup.rows.length) {
          return res.status(404).json({
            error: `Invalid Shop Code "${rawShopCode}". Please verify your shop code with your manager.`
          });
        }
        targetBizId = clientLookup.rows[0].business_id;
      }
    }

    // Lookup user in PostgreSQL team_members with tenant scoping
    let query;
    let params;
    if (targetBizId) {
      query = `
        SELECT * FROM team_members
        WHERE (LOWER(employee_id) = LOWER($1)
           OR LOWER(local_id) = LOWER($1)
           OR phone = $1
           OR LOWER(name) = LOWER($1)
           OR LOWER(email) = LOWER($1))
          AND business_id = $2
        LIMIT 1
      `;
      params = [credUser, targetBizId];
    } else {
      query = `
        SELECT * FROM team_members
        WHERE LOWER(employee_id) = LOWER($1)
           OR LOWER(local_id) = LOWER($1)
           OR phone = $1
           OR LOWER(name) = LOWER($1)
           OR LOWER(email) = LOWER($1)
           OR (LOWER($1) LIKE 'emp-%' AND LOWER(employee_id) LIKE '%' || LOWER($1))
        ORDER BY CASE WHEN role IN ('reception', 'designer', 'printer_finishing', 'printer', 'finisher') THEN 0 ELSE 1 END,
                 CASE WHEN business_id = 'global_settings' THEN 1 ELSE 0 END, id ASC
        LIMIT 1
      `;
      params = [credUser];
    }
    const { rows } = await pool.query(query, params);

    if (!rows.length) {
      const lockRes = await recordFailedLogin(credUser, clientIp);
      try {
        await pool.query(
          `INSERT INTO saas_audit_logs (action, performed_by, performer_role, client_company, target_id, target_type, details, ip_address, device_info)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            'Failed Login Attempt: Employee Not Found',
            credUser,
            'STAFF',
            targetBizId || 'Unknown',
            credUser,
            'auth',
            JSON.stringify({ error: 'Employee not found', identifier: credUser }),
            req.ip || '127.0.0.1',
            req.headers['user-agent'] || 'Employee Portal',
          ]
        );
      } catch (_) {}
      if (lockRes.locked) {
        return res.status(429).json({
          error: `Security Alert: Account temporarily locked due to ${lockRes.maxAttempts} failed login attempts. Please try again in ${lockRes.remainingMinutes} minute(s) or contact your manager.`,
          code: 'ACCOUNT_LOCKED',
        });
      }
      return res.status(401).json({
        error: req.body.portal === 'employee'
          ? `Employee "${credUser}" not found. Please verify your store-prefixed Employee ID (e.g. PG-EMP-001).`
          : 'Invalid email/phone/employee ID or password.'
      });
    }

    const member = rows[0];

    // Deactivation Check: Inactive employees must be blocked immediately
    const isMemberActive = member.is_active !== false && member.status !== 'inactive';
    if (!isMemberActive) {
      return res.status(403).json({
        error: 'Forbidden: Account is deactivated. Please contact your manager.',
      });
    }

    const valid = verifyPassword(credPass, member.password_hash) || verifyPassword(credPass, member.pin);
    if (!valid) {
      const lockRes = await recordFailedLogin(credUser, clientIp);
      try {
        await pool.query(
          `INSERT INTO saas_audit_logs (action, performed_by, performer_role, client_company, target_id, target_type, details, ip_address, device_info)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            'Failed Login Attempt: Invalid Password or PIN',
            member.name,
            member.role || 'STAFF',
            member.business_id || 'global_settings',
            String(member.id),
            'auth',
            JSON.stringify({ error: 'Invalid password or PIN', employee_id: member.employee_id }),
            req.ip || '127.0.0.1',
            req.headers['user-agent'] || 'Employee Portal',
          ]
        );
      } catch (_) {}
      if (lockRes.locked) {
        return res.status(429).json({
          error: `Security Alert: Account temporarily locked due to ${lockRes.maxAttempts} failed login attempts. Please try again in ${lockRes.remainingMinutes} minute(s) or contact your manager.`,
          code: 'ACCOUNT_LOCKED',
        });
      }
      return res.status(401).json({ error: 'Invalid email/phone or password.' });
    }

    const role = member.role || ROLES.RECEPTION;
    const businessId = member.business_id || 'global_settings';

    // ── Portal-based access control ─────────────────────────────────────────
    // The portal field (owner | employee | admin) is sent by the login page.
    // Validate that the user's actual DB role matches the intended portal.
    // Supports single role and comma-separated multi-roles (e.g. 'designer,printer_finishing').
    const portal = String(req.body.portal || '').trim().toLowerCase();
    const userRoles = String(role).split(',').map(r => r.trim().toLowerCase()).filter(Boolean);

    if (portal === 'owner') {
      const ownerPortalRoles = [ROLES.OWNER, ROLES.SUPER_ADMIN, ROLES.DEVELOPER];
      const hasOwnerRole = userRoles.some(r => ownerPortalRoles.includes(r));
      if (!hasOwnerRole) {
        logger.warn(`Portal mismatch: ${member.name} (role=${role}) attempted owner portal login`);
        return res.status(403).json({
          error: 'Wrong portal. Staff accounts (Reception, Designer, Printer) must log in at the Employee portal.',
          redirectTo: '/employee/login',
        });
      }
    } else if (portal === 'employee') {
      const employeePortalRoles = [ROLES.RECEPTION, ROLES.DESIGNER, ROLES.PRINTER_FINISHING, 'printer', 'finisher'];
      const hasEmployeeRole = userRoles.some(r => employeePortalRoles.includes(r));
      if (!hasEmployeeRole) {
        logger.warn(`Portal mismatch: ${member.name} (role=${role}) attempted employee portal login`);
        return res.status(403).json({
          error: 'Wrong portal. Business Owner accounts must log in at the Owner portal.',
          redirectTo: '/owner/login',
        });
      }
    } else if (portal === 'admin') {
      const adminPortalRoles = [ROLES.SUPER_ADMIN, ROLES.DEVELOPER];
      const hasAdminRole = userRoles.some(r => adminPortalRoles.includes(r));
      if (!hasAdminRole) {
        logger.warn(`Portal mismatch: ${member.name} (role=${role}) attempted admin portal login`);
        return res.status(403).json({
          error: 'Access denied. This portal is for Developer and Super Admin accounts only.',
          redirectTo: '/owner/login',
        });
      }
    }
    // ────────────────────────────────────────────────────────────────────────
    // Successful login: reset any lockout counter
    resetFailedLogins(credUser, clientIp);

    const token = signToken({
      id: member.id,
      localId: member.local_id,
      name: member.name,
      email: member.email,
      role,
      businessId,
    });

    const userDoc = sanitizeUser(rowToDoc(member));

    // Lookup shop code for response
    const bRes = await pool.query('SELECT name, shop_code FROM businesses WHERE business_id = $1 LIMIT 1', [businessId]);
    const shopCode = bRes.rows[0]?.shop_code || null;
    const shopName = bRes.rows[0]?.name || null;

    logger.info(`🔑 Employee login success: ${member.name} (Role: ${role}, Business: ${businessId}, Shop: ${shopCode})`);

    res.json({
      success: true,
      token,
      user: {
        ...userDoc,
        employeeId: member.employee_id || member.local_id,
        shopCode,
        shopName,
      },
      shopCode,
      permissions: getCombinedPermissions(role),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me
 * Returns profile and permissions of authenticated user
 */
const me = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }

    if (req.user.isClient) {
      const clientRes = await pool.query('SELECT id, name, email, phone, status, subscription_plan, subscription_expires_at, subscription_status, plan_duration, business_id, shop_code FROM saas_clients WHERE id = $1', [req.user.id]);
      if (clientRes.rows.length) {
        const c = clientRes.rows[0];
        const now = Date.now();
        const expMs = c.subscription_expires_at ? new Date(c.subscription_expires_at).getTime() : null;
        const daysRemaining = expMs ? Math.ceil((expMs - now) / (1000 * 60 * 60 * 24)) : null;
        const isExpired = c.subscription_status === 'expired' || c.status === 'expired' || (expMs ? expMs < now : false);
        const isGracePeriod = !isExpired && (c.subscription_status === 'grace_period' || (daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0));
        return res.json({
          user: req.user,
          client: {
            ...c,
            status: isExpired && (c.status === 'active' || !c.status) ? 'expired' : c.status,
            subscription_status: isExpired ? 'expired' : c.subscription_status,
            daysRemaining: isExpired && daysRemaining > 0 ? 0 : daysRemaining,
            isExpired,
            isGracePeriod
          },
          subscription: {
            plan: c.subscription_plan,
            status: isExpired ? 'expired' : c.subscription_status,
            expiresAt: c.subscription_expires_at,
            daysRemaining: isExpired && daysRemaining > 0 ? 0 : daysRemaining,
            isExpired,
            isGracePeriod
          },
          permissions: req.user.permissions || ROLE_PERMISSIONS[ROLES.OWNER],
        });
      }
    }

    const { rows } = await pool.query('SELECT * FROM team_members WHERE id = $1', [req.user.id]);
    if (!rows.length) {
      return res.json({
        user: req.user,
        permissions: req.user.permissions,
      });
    }

    const userDoc = sanitizeUser(rowToDoc(rows[0]));
    res.json({
      user: userDoc,
      permissions: getCombinedPermissions(userDoc.role),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/client-login
 * Authenticates client webapp user via registered Gmail/Email with password verification.
 */
const clientLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const clientEmail = String(email || '').trim().toLowerCase();

    if (!clientEmail) {
      return res.status(400).json({ error: 'Please enter your registered Gmail address.' });
    }

    const clientIp = getClientIp(req);
    const lockStatus = await checkLoginLockout(clientEmail, clientIp);
    if (lockStatus.locked) {
      return res.status(429).json({
        error: `Security Alert: Account temporarily locked due to ${lockStatus.maxAttempts} failed login attempts. Please try again in ${lockStatus.remainingMinutes} minute(s) or click Forgot Password.`,
        code: 'ACCOUNT_LOCKED',
      });
    }

    // Lookup client in saas_clients
    const clientRes = await pool.query(
      `SELECT id, name, email, phone, status, notes, last_login_at, password_hash
       FROM saas_clients
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [clientEmail]
    );

    if (!clientRes.rows.length) {
      const lockRes = await recordFailedLogin(clientEmail, clientIp);
      try {
        await pool.query(
          `INSERT INTO saas_audit_logs (action, performed_by, performer_role, client_company, target_id, target_type, details, ip_address, device_info)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            'Failed Login Attempt: Email Not Registered',
            clientEmail,
            'GUEST',
            'Unknown',
            clientEmail,
            'auth',
            JSON.stringify({ error: 'Client not registered', email: clientEmail }),
            req.ip || '127.0.0.1',
            req.headers['user-agent'] || 'Client WebApp',
          ]
        );
      } catch (_) {}
      if (lockRes.locked) {
        return res.status(429).json({
          error: `Security Alert: Account temporarily locked due to ${lockRes.maxAttempts} failed login attempts. Please try again in ${lockRes.remainingMinutes} minute(s) or contact your manager.`,
          code: 'ACCOUNT_LOCKED',
        });
      }
      return res.status(403).json({
        error: `Access Denied: The Gmail "${clientEmail}" is not registered by the developer. Please contact Algora.`,
        code: 'CLIENT_NOT_REGISTERED',
      });
    }

    const client = clientRes.rows[0];

    // Status check: Only active accounts allowed
    if (client.status === 'deactivated' || client.status === 'suspended') {
      return res.status(403).json({
        error: `Account Deactivated: Your account has been deactivated by the developer. Please contact Algora.`,
        code: 'CLIENT_DEACTIVATED',
      });
    }

    if (client.status === 'pending') {
      return res.status(403).json({
        error: `Account Pending: Please verify your email using the 6-digit code sent to ${clientEmail}.`,
        code: 'CLIENT_PENDING',
      });
    }

    // Password verification logic
    if (client.password_hash && password) {
      const isMatch = verifyPassword(password, client.password_hash);
      if (!isMatch) {
        const lockRes = await recordFailedLogin(clientEmail, clientIp);
        try {
          await pool.query(
            `INSERT INTO saas_audit_logs (action, performed_by, performer_role, client_company, target_id, target_type, details, ip_address, device_info)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              'Failed Login Attempt: Incorrect Password',
              client.name,
              'CLIENT_OWNER',
              client.name,
              String(client.id),
              'auth',
              JSON.stringify({ error: 'Incorrect password', email: client.email }),
              req.ip || '127.0.0.1',
              req.headers['user-agent'] || 'Client WebApp',
            ]
          );
        } catch (_) {}
        if (lockRes.locked) {
          return res.status(429).json({
            error: `Security Alert: Account temporarily locked due to ${lockRes.maxAttempts} failed login attempts. Please try again in ${lockRes.remainingMinutes} minute(s) or contact your manager.`,
            code: 'ACCOUNT_LOCKED',
          });
        }
        return res.status(401).json({
          error: 'Incorrect email or password. Please check your credentials or click Forgot Password.',
          code: 'INVALID_CREDENTIALS',
        });
      }
    } else if (password) {
      // First-time login: hash and store the password in PostgreSQL
      const hashed = hashPassword(password);
      await pool.query(`UPDATE saas_clients SET password_hash = $1 WHERE id = $2`, [hashed, client.id]);
    }

    // Update last_login_at timestamp
    await pool.query(`UPDATE saas_clients SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1`, [client.id]);

    // Resolve the tenant business_id (company slug) — auto-creates company on first login
    const businessId = await getOrCreateClientBusinessId(client.id, client.email, client.company_name);

    // Sign JWT token for client
    const token = signToken({
      id: client.id,
      name: client.name,
      email: client.email,
      role: ROLES.OWNER,
      businessId,
      isClient: true,
      clientId: client.id,
    });

    // Successful login: reset any lockout counter
    resetFailedLogins(clientEmail, clientIp);

    // Record audit log
    try {
      await pool.query(
        `INSERT INTO saas_audit_logs (action, performed_by, performer_role, client_company, target_id, target_type, details, ip_address, device_info)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          'Client WebApp Login',
          client.name,
          'CLIENT_OWNER',
          client.name,
          String(client.id),
          'client',
          JSON.stringify({ email: client.email, status: client.status, businessId }),
          req.ip || '127.0.0.1',
          req.headers['user-agent'] || 'Client WebApp',
        ]
      );
    } catch (_) {}

    logger.info(`🔑 Client WebApp login success: ${client.name} (${client.email}) [tenant: ${businessId}]`);

    return res.json({
      success: true,
      token,
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        status: client.status,
        businessId,
      },
      user: {
        id: client.id,
        name: client.name,
        email: client.email,
        role: ROLES.OWNER,
        businessId,
        isActive: true,
      },
      permissions: ROLE_PERMISSIONS[ROLES.OWNER] || [],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/client-forgot-password
 * Sends a 6-digit password reset OTP to the client's email via Gmail SMTP
 */
const clientForgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const clientEmail = String(email || '').trim().toLowerCase();

    if (!clientEmail) {
      return res.status(400).json({ error: 'Please enter your registered email address.' });
    }

    // 1. Check in saas_clients (Owner)
    const clientRes = await pool.query(
      `SELECT id, name, email, status FROM saas_clients WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [clientEmail]
    );

    let target = clientRes.rows[0];
    let isTeam = false;

    // 2. If not found in saas_clients, check team_members (Reception)
    if (!target) {
      const tmRes = await pool.query(
        `SELECT id, name, email, status, role FROM team_members 
         WHERE LOWER(email) = LOWER($1) AND (role ILIKE '%reception%' OR role ILIKE '%owner%') 
         LIMIT 1`,
        [clientEmail]
      );
      if (tmRes.rows.length) {
        target = tmRes.rows[0];
        isTeam = true;
      }
    }

    if (!target) {
      return res.status(404).json({ error: `No registered Owner or Reception account found with email "${clientEmail}".` });
    }

    if (target.status === 'deactivated' || target.status === 'suspended' || target.status === 'inactive') {
      return res.status(403).json({ error: 'This account has been deactivated. Please contact Algora or your administrator.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    if (isTeam) {
      await pool.query(
        `UPDATE team_members
         SET reset_token = $1, reset_token_exp = NOW() + INTERVAL '15 minutes', updated_at = NOW()
         WHERE id = $2`,
        [otp, target.id]
      );
    } else {
      await pool.query(
        `UPDATE saas_clients
         SET reset_token = $1, reset_token_exp = NOW() + INTERVAL '15 minutes', updated_at = NOW()
         WHERE id = $2`,
        [otp, target.id]
      );
    }

    try {
      await sendPasswordResetOtp(target.email, otp, target.name);
      logger.info(`✉️ Password reset OTP (${otp}) sent to ${target.email}`);
    } catch (mailErr) {
      logger.error(`Failed to send password reset email: ${mailErr.message}`);
      return res.status(500).json({ error: 'Failed to send reset email. Please verify your connection or try again later.' });
    }

    return res.json({
      success: true,
      message: `A 6-digit password reset code has been sent to ${target.email}.`,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/client-reset-password
 * Verifies OTP and updates password_hash in PostgreSQL
 */
const clientResetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    const clientEmail = String(email || '').trim().toLowerCase();
    const token = String(otp || '').trim();
    const pass = String(newPassword || '').trim();

    if (!clientEmail || !token || !pass) {
      return res.status(400).json({ error: 'Please provide email, verification code, and your new password.' });
    }

    if (pass.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    // 1. Check in saas_clients (Owner)
    const clientRes = await pool.query(
      `SELECT id, name, email, reset_token, reset_token_exp FROM saas_clients WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [clientEmail]
    );

    let target = clientRes.rows[0];
    let isTeam = false;

    // 2. If not found in saas_clients, check team_members (Reception)
    if (!target) {
      const tmRes = await pool.query(
        `SELECT id, name, email, reset_token, reset_token_exp, role FROM team_members 
         WHERE LOWER(email) = LOWER($1) AND (role ILIKE '%reception%' OR role ILIKE '%owner%') 
         LIMIT 1`,
        [clientEmail]
      );
      if (tmRes.rows.length) {
        target = tmRes.rows[0];
        isTeam = true;
      }
    }

    if (!target) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    if (!target.reset_token || target.reset_token !== token) {
      return res.status(400).json({ error: 'Invalid verification code. Please check your email and try again.' });
    }

    if (new Date(target.reset_token_exp) < new Date()) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    const hashed = hashPassword(pass);
    if (isTeam) {
      await pool.query(
        `UPDATE team_members
         SET password_hash = $1, pin = $2, reset_token = NULL, reset_token_exp = NULL, updated_at = NOW()
         WHERE id = $3`,
        [hashed, pass.slice(0, 6), target.id]
      );
    } else {
      await pool.query(
        `UPDATE saas_clients
         SET password_hash = $1, reset_token = NULL, reset_token_exp = NULL, updated_at = NOW()
         WHERE id = $2`,
        [hashed, target.id]
      );
    }

    logger.info(`🔒 Password reset successfully for ${target.email}`);

    return res.json({
      success: true,
      message: 'Password reset successfully! You can now log in with your new password.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/client-register
 * Creates new client account with hashed password and sends verification code
 */
const clientRegister = async (req, res, next) => {
  try {
    const { name, email, password, phone, companyName } = req.body;
    const clientName = String(name || '').trim();
    const clientEmail = String(email || '').trim().toLowerCase();
    const clientPass = String(password || '').trim();
    const clientPhone = String(phone || '').trim();
    const clientCompany = String(companyName || clientName || 'Print Shop').trim();

    if (!clientName || !clientEmail || !clientPass) {
      return res.status(400).json({ error: 'Please provide your full name, email, and password.' });
    }

    if (clientPass.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // Check if client already exists
    const existing = await pool.query(
      `SELECT id, email, status FROM saas_clients WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [clientEmail]
    );

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashed = hashPassword(clientPass);

    if (existing.rows.length) {
      const row = existing.rows[0];
      if (row.status === 'active') {
        return res.status(409).json({ error: 'An account with this email is already registered. Please sign in or reset your password.' });
      }
      // Re-send verification for pending account
      await pool.query(
        `UPDATE saas_clients
         SET name = $1, phone = $2, company_name = $3, password_hash = $4, verification_otp = $5, verification_exp = NOW() + INTERVAL '15 minutes', updated_at = NOW()
         WHERE id = $6`,
        [clientName, clientPhone, clientCompany, hashed, otp, row.id]
      );
    } else {
      await pool.query(
        `INSERT INTO saas_clients (name, email, phone, company_name, password_hash, status, verification_otp, verification_exp)
         VALUES ($1, $2, $3, $4, $5, 'pending', $6, NOW() + INTERVAL '15 minutes')`,
        [clientName, clientEmail, clientPhone, clientCompany, hashed, otp]
      );
    }

    try {
      await sendRegistrationOtp(clientEmail, otp, clientName, clientCompany);
      logger.info(`✉️ Registration verification OTP (${otp}) sent to ${clientEmail}`);
    } catch (mailErr) {
      logger.error(`Failed to send registration email: ${mailErr.message}`);
      return res.status(500).json({ error: 'Failed to send verification email. Please check your email address.' });
    }

    return res.json({
      success: true,
      message: `A 6-digit verification code has been sent to ${clientEmail}. Please enter it to activate your account.`,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/client-verify-registration
 * Verifies registration OTP and activates the client account
 */
const clientVerifyRegistration = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const clientEmail = String(email || '').trim().toLowerCase();
    const token = String(otp || '').trim();

    if (!clientEmail || !token) {
      return res.status(400).json({ error: 'Please enter your email and 6-digit verification code.' });
    }

    const clientRes = await pool.query(
      `SELECT id, name, email, phone, company_name, verification_otp, verification_exp, status
       FROM saas_clients
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [clientEmail]
    );

    if (!clientRes.rows.length) {
      return res.status(404).json({ error: 'Registration record not found.' });
    }

    const client = clientRes.rows[0];
    if (!client.verification_otp || client.verification_otp !== token) {
      return res.status(400).json({ error: 'Invalid verification code. Please check your email and try again.' });
    }

    if (new Date(client.verification_exp) < new Date()) {
      return res.status(400).json({ error: 'Verification code has expired. Please register again to get a fresh code.' });
    }

    // Activate client account
    const updatedRes = await pool.query(
      `UPDATE saas_clients
       SET status = 'active', verification_otp = NULL, verification_exp = NULL, last_login_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, email, phone, company_name, status`,
      [client.id]
    );

    const activeClient = updatedRes.rows[0];

    // Resolve (or create) the tenant business_id for this newly activated client
    const businessId = await getOrCreateClientBusinessId(
      activeClient.id,
      activeClient.email,
      activeClient.company_name
    );

    // Sign JWT token
    const jwtToken = signToken({
      id: activeClient.id,
      name: activeClient.name,
      email: activeClient.email,
      role: ROLES.OWNER,
      businessId,
      isClient: true,
      clientId: activeClient.id,
    });

    logger.info(`🎉 New client activated: ${activeClient.name} (${activeClient.email}) [tenant: ${businessId}]`);

    return res.json({
      success: true,
      token: jwtToken,
      client: { ...activeClient, businessId },
      user: {
        id: activeClient.id,
        name: activeClient.name,
        email: activeClient.email,
        role: ROLES.OWNER,
        businessId,
        isActive: true,
      },
      permissions: ROLE_PERMISSIONS[ROLES.OWNER] || [],
      message: 'Account verified successfully! Welcome to PrintFlow.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/client-token-sync
 * Re-synchronizes or heals an active SaaS client's JWT session.
 * Re-issues a verified client token scoped strictly to the client's business_id.
 */
const clientTokenSync = async (req, res, next) => {
  try {
    const { clientId, email } = req.body;
    const clientEmail = String(email || '').trim().toLowerCase();

    if (!clientId && !clientEmail) {
      return res.status(400).json({ error: 'Client identifier is required.' });
    }

    let query = 'SELECT id, name, email, phone, status, business_id, company_name FROM saas_clients WHERE ';
    const params = [];
    if (clientId && clientEmail) {
      query += 'id = $1 AND LOWER(email) = LOWER($2)';
      params.push(clientId, clientEmail);
    } else if (clientId) {
      query += 'id = $1';
      params.push(clientId);
    } else {
      query += 'LOWER(email) = LOWER($1)';
      params.push(clientEmail);
    }

    const { rows } = await pool.query(query, params);
    if (!rows.length) {
      return res.status(404).json({ error: 'Client account not found.' });
    }

    const client = rows[0];
    if (client.status === 'deactivated' || client.status === 'suspended') {
      return res.status(403).json({ error: 'Forbidden: Account is deactivated.' });
    }

    const businessId = client.business_id || await getOrCreateClientBusinessId(client.id, client.email, client.company_name || client.name);

    const token = signToken({
      id: client.id,
      name: client.name,
      email: client.email,
      role: ROLES.OWNER,
      businessId,
      isClient: true,
      clientId: client.id,
    });

    return res.json({
      success: true,
      token,
      businessId,
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        status: client.status,
        businessId,
      },
      user: {
        id: client.id,
        name: client.name,
        email: client.email,
        role: ROLES.OWNER,
        businessId,
        isActive: true,
      },
      permissions: ROLE_PERMISSIONS[ROLES.OWNER] || [],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/change-password
 * Allows an authenticated employee or owner to change their password securely.
 */
const changePassword = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }

    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }
    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New password and confirm password do not match.' });
    }

    if (req.user.isClient) {
      const clientRes = await pool.query('SELECT id, password_hash FROM saas_clients WHERE id = $1', [req.user.id]);
      if (!clientRes.rows.length) {
        return res.status(404).json({ error: 'Account not found.' });
      }
      const client = clientRes.rows[0];
      const isMatch = verifyPassword(currentPassword, client.password_hash);
      if (!isMatch) {
        return res.status(400).json({ error: 'Incorrect current password.' });
      }
      const newHash = hashPassword(newPassword);
      await pool.query('UPDATE saas_clients SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, client.id]);
      return res.json({ success: true, message: 'Password changed successfully.' });
    }

    // Team member
    const memberRes = await pool.query('SELECT id, password_hash, pin FROM team_members WHERE id = $1 OR local_id = $2', [
      req.user.id,
      req.user.localId || req.user.id,
    ]);
    if (!memberRes.rows.length) {
      return res.status(404).json({ error: 'Team member account not found.' });
    }
    const member = memberRes.rows[0];
    const isMatch = verifyPassword(currentPassword, member.password_hash) || verifyPassword(currentPassword, member.pin);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect current password.' });
    }

    const newHash = hashPassword(newPassword);
    const updatePin = /^\d{6}$/.test(newPassword) ? newPassword : member.pin;
    await pool.query(
      'UPDATE team_members SET password_hash = $1, pin = $2, updated_at = NOW() WHERE id = $3',
      [newHash, updatePin, member.id]
    );

    logger.info(`🔐 Password changed for user: ${req.user.name || req.user.email} (ID: ${member.id})`);
    return res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  login,
  me,
  clientLogin,
  clientForgotPassword,
  clientResetPassword,
  clientRegister,
  clientVerifyRegistration,
  clientTokenSync,
  changePassword,
};


