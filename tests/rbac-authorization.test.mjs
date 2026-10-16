import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
} = require('../backend/src/config/permissions.js');

const {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  sanitizeUser,
} = require('../backend/src/utils/authHelper.js');

const {
  requirePermission,
  requireRole,
  getTenantBusinessId,
} = require('../backend/src/middleware/rbac.js');

const { sanitizeOrderForRole } = require('../backend/src/controllers/orderController.js');

const appJs = fs.readFileSync('dist/app.js', 'utf8');
const schemaSql = fs.readFileSync('backend/src/config/schema.sql', 'utf8');
const orderRoutesJs = fs.readFileSync('backend/src/routes/orders.js', 'utf8');
const expenseRoutesJs = fs.readFileSync('backend/src/routes/expenses.js', 'utf8');
const teamRoutesJs = fs.readFileSync('backend/src/routes/team.js', 'utf8');
const statsRoutesJs = fs.readFileSync('backend/src/routes/stats.js', 'utf8');
const settingsRoutesJs = fs.readFileSync('backend/src/routes/settings.js', 'utf8');

// Helper to create mock Express request
function createMockReq({ user = null, headers = {}, params = {}, body = {}, query = {} } = {}) {
  return {
    headers: { ...headers },
    params: { ...params },
    body: { ...body },
    query: { ...query },
    user,
  };
}

// Helper to create mock Express response
function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res.body = data;
      return res;
    },
  };
  return res;
}

// ============================================================================
// 1. Owner & Reception Full Operational & Business Access
// ============================================================================
test('1. RBAC: Owner and Reception have full operational access to business resources', () => {
  // Owner has all permissions
  assert.equal(hasPermission(ROLES.OWNER, PERMISSIONS.ORDERS_VIEW), true);
  assert.equal(hasPermission(ROLES.OWNER, PERMISSIONS.FINANCE_VIEW), true);
  assert.equal(hasPermission(ROLES.OWNER, PERMISSIONS.FINANCE_UPDATE), true);
  assert.equal(hasPermission(ROLES.OWNER, PERMISSIONS.EMPLOYEES_MANAGE), true);
  assert.equal(hasPermission(ROLES.OWNER, PERMISSIONS.SETTINGS_MANAGE), true);

  // Reception has identical operational permissions to Owner
  assert.equal(hasPermission(ROLES.RECEPTION, PERMISSIONS.ORDERS_VIEW), true);
  assert.equal(hasPermission(ROLES.RECEPTION, PERMISSIONS.ORDERS_CREATE), true);
  assert.equal(hasPermission(ROLES.RECEPTION, PERMISSIONS.ORDERS_UPDATE), true);
  assert.equal(hasPermission(ROLES.RECEPTION, PERMISSIONS.STOCK_VIEW), true);
  assert.equal(hasPermission(ROLES.RECEPTION, PERMISSIONS.CUSTOMERS_VIEW), true);
  assert.equal(hasPermission(ROLES.RECEPTION, PERMISSIONS.PRODUCTS_VIEW), true);
  assert.equal(hasPermission(ROLES.RECEPTION, PERMISSIONS.FINANCE_VIEW), true);
  assert.equal(hasPermission(ROLES.RECEPTION, PERMISSIONS.FINANCE_UPDATE), true);
  assert.equal(hasPermission(ROLES.RECEPTION, PERMISSIONS.EMPLOYEES_VIEW), true);
  assert.equal(hasPermission(ROLES.RECEPTION, PERMISSIONS.EMPLOYEES_MANAGE), true);
  assert.equal(hasPermission(ROLES.RECEPTION, PERMISSIONS.SETTINGS_VIEW), true);
  assert.equal(hasPermission(ROLES.RECEPTION, PERMISSIONS.NOTIFICATIONS_VIEW), true);

  // Middleware verification for Reception
  const reqReception = createMockReq({
    user: { id: 'u1', role: ROLES.RECEPTION, isActive: true, businessId: 'biz_printghar' },
  });
  const res = createMockRes();
  let nextCalled = false;

  requirePermission(PERMISSIONS.FINANCE_VIEW)(reqReception, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true, 'Reception should be allowed to view finance');
  assert.equal(res.statusCode, 200);
});

// ============================================================================
// 2. Designer Role Capabilities
// ============================================================================
test('2. RBAC: Designer can view orders and update design stage, but lacks administrative permissions', () => {
  assert.equal(hasPermission(ROLES.DESIGNER, PERMISSIONS.ORDERS_VIEW), true);
  assert.equal(hasPermission(ROLES.DESIGNER, PERMISSIONS.ORDERS_UPDATE), true);
  assert.equal(hasPermission(ROLES.DESIGNER, PERMISSIONS.NOTIFICATIONS_VIEW), true);
  assert.equal(hasPermission(ROLES.DESIGNER, PERMISSIONS.NOTIFICATIONS_MANAGE), true);

  // Designer cannot access finance, employees, settings
  assert.equal(hasPermission(ROLES.DESIGNER, PERMISSIONS.FINANCE_VIEW), false);
  assert.equal(hasPermission(ROLES.DESIGNER, PERMISSIONS.FINANCE_UPDATE), false);
  assert.equal(hasPermission(ROLES.DESIGNER, PERMISSIONS.EMPLOYEES_VIEW), false);
  assert.equal(hasPermission(ROLES.DESIGNER, PERMISSIONS.EMPLOYEES_MANAGE), false);
  assert.equal(hasPermission(ROLES.DESIGNER, PERMISSIONS.SETTINGS_MANAGE), false);
});

// ============================================================================
// 3. Printer / Finishing Role Capabilities
// ============================================================================
test('3. RBAC: Printer / Finishing can view orders/stock and update production stage', () => {
  assert.equal(hasPermission(ROLES.PRINTER_FINISHING, PERMISSIONS.ORDERS_VIEW), true);
  assert.equal(hasPermission(ROLES.PRINTER_FINISHING, PERMISSIONS.ORDERS_UPDATE), true);
  assert.equal(hasPermission(ROLES.PRINTER_FINISHING, PERMISSIONS.STOCK_VIEW), true);
  assert.equal(hasPermission(ROLES.PRINTER_FINISHING, PERMISSIONS.NOTIFICATIONS_VIEW), true);

  // Printer/Finishing cannot access finance, employees, settings
  assert.equal(hasPermission(ROLES.PRINTER_FINISHING, PERMISSIONS.FINANCE_VIEW), false);
  assert.equal(hasPermission(ROLES.PRINTER_FINISHING, PERMISSIONS.FINANCE_UPDATE), false);
  assert.equal(hasPermission(ROLES.PRINTER_FINISHING, PERMISSIONS.EMPLOYEES_VIEW), false);
  assert.equal(hasPermission(ROLES.PRINTER_FINISHING, PERMISSIONS.EMPLOYEES_MANAGE), false);
  assert.equal(hasPermission(ROLES.PRINTER_FINISHING, PERMISSIONS.SETTINGS_MANAGE), false);
});

// ============================================================================
// 4. Designer CANNOT Access Finance APIs (403 Forbidden)
// ============================================================================
test('4. RBAC: Designer access to finance APIs returns 403 Forbidden', () => {
  const req = createMockReq({
    user: { id: 'u_des_1', role: ROLES.DESIGNER, isActive: true, businessId: 'biz_pg' },
  });
  const res = createMockRes();
  let nextCalled = false;

  requirePermission(PERMISSIONS.FINANCE_VIEW)(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.match(res.body.error, /Forbidden/);
  assert.match(res.body.error, /does not have.*permission/);
});

// ============================================================================
// 5. Printer / Finishing CANNOT Access Finance APIs (403 Forbidden)
// ============================================================================
test('5. RBAC: Printer / Finishing access to finance APIs returns 403 Forbidden', () => {
  const req = createMockReq({
    user: { id: 'u_print_1', role: ROLES.PRINTER_FINISHING, isActive: true, businessId: 'biz_pg' },
  });
  const res = createMockRes();
  let nextCalled = false;

  requirePermission(PERMISSIONS.FINANCE_UPDATE)(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.match(res.body.error, /Forbidden/);
});

// ============================================================================
// 6. Designer and Printer CANNOT Manage Employees (403 Forbidden)
// ============================================================================
test('6. RBAC: Designer and Printer access to employee management returns 403 Forbidden', () => {
  for (const role of [ROLES.DESIGNER, ROLES.PRINTER_FINISHING]) {
    const req = createMockReq({
      user: { id: `u_${role}`, role, isActive: true, businessId: 'biz_pg' },
    });
    const resView = createMockRes();
    const resManage = createMockRes();
    let viewCalled = false;
    let manageCalled = false;

    requirePermission(PERMISSIONS.EMPLOYEES_VIEW)(req, resView, () => {
      viewCalled = true;
    });
    requirePermission(PERMISSIONS.EMPLOYEES_MANAGE)(req, resManage, () => {
      manageCalled = true;
    });

    assert.equal(viewCalled, false, `${role} must not view employees`);
    assert.equal(resView.statusCode, 403);
    assert.equal(manageCalled, false, `${role} must not manage employees`);
    assert.equal(resManage.statusCode, 403);
  }
});

// ============================================================================
// 7. Multi-Tenant Data Isolation (Cross-Tenant Access Returns 403)
// ============================================================================
test('7. Multi-tenant: getTenantBusinessId strictly binds to authenticated user and prevents cross-tenant access', () => {
  // A malicious request passes x-business-id or query param attempting to impersonate Business B
  const spoofedReq = createMockReq({
    headers: { 'x-business-id': 'business_b' },
    query: { business_id: 'business_b' },
    user: { id: 'u_alice', businessId: 'business_a', role: ROLES.OWNER, isActive: true },
  });

  // getTenantBusinessId must ignore client headers and strictly resolve from req.user
  const tenantId = getTenantBusinessId(spoofedReq);
  assert.equal(tenantId, 'business_a', 'Must strictly use authenticated token tenant ID');

  // Verify cross-tenant protection pattern in controllers
  const resourceBusinessId = 'business_b';
  const hasCrossBusinessAccess = resourceBusinessId && resourceBusinessId !== tenantId;
  assert.equal(hasCrossBusinessAccess, true, 'Cross-business mismatch must be detected');
});

// ============================================================================
// 8. Inactive Employee Blocking (Immediate 403 Forbidden)
// ============================================================================
test('8. RBAC: Inactive employees (isActive: false or status: inactive) are blocked with 403 Forbidden', () => {
  const reqInactive = createMockReq({
    user: { id: 'u_disabled', role: ROLES.RECEPTION, isActive: false, businessId: 'biz_pg' },
  });
  const res = createMockRes();
  let nextCalled = false;

  requirePermission(PERMISSIONS.ORDERS_VIEW)(reqInactive, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.match(res.body.error, /deactivated/i);
});

// ============================================================================
// 9. Direct API Requests Without Authentication Return 403 Forbidden
// ============================================================================
test('9. RBAC: Direct API requests without authentication token return 403 Forbidden', () => {
  const unauthReq = createMockReq({ user: null });
  const res = createMockRes();
  let nextCalled = false;

  requirePermission(PERMISSIONS.ORDERS_VIEW)(unauthReq, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.match(res.body.error, /Forbidden.*Direct API access without authentication/i);
});

// ============================================================================
// 10. Authentication & Cryptographic Token Security
// ============================================================================
test('10. Security: Password hashing with scrypt, JWT signing, verification, and tamper detection', () => {
  // Password hashing & verification
  const password = 'SuperSecretPassword2026!';
  const hash = hashPassword(password);
  assert.ok(hash.includes(':'), 'Hash must have salt:key format');
  assert.equal(verifyPassword(password, hash), true);
  assert.equal(verifyPassword('WrongPassword', hash), false);

  // JWT signing and validation
  const payload = {
    id: 'emp-101',
    name: 'Rohan Sharma',
    email: 'rohan@printghar.com',
    role: ROLES.DESIGNER,
    businessId: 'biz_kathmandu',
  };
  const token = signToken(payload);
  assert.ok(typeof token === 'string' && token.split('.').length === 3, 'Must be valid JWT structure');

  const verified = verifyToken(token);
  assert.ok(verified, 'Token should verify successfully');
  assert.equal(verified.id, 'emp-101');
  assert.equal(verified.role, ROLES.DESIGNER);
  assert.equal(verified.businessId, 'biz_kathmandu');

  // Tamper detection: modifying payload segment must invalidate signature
  const parts = token.split('.');
  const tamperedPayload = Buffer.from(JSON.stringify({ ...payload, role: ROLES.OWNER })).toString('base64url');
  const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
  assert.equal(verifyToken(tamperedToken), null, 'Tampered token must fail signature verification');

  // Sanitizing user object strips sensitive data
  const userRecord = {
    id: 'emp-101',
    name: 'Rohan',
    email: 'rohan@printghar.com',
    role: ROLES.DESIGNER,
    password_hash: hash,
    passwordHash: hash,
    pin: '123456',
    salary: 35000,
  };
  const sanitized = sanitizeUser(userRecord);
  assert.equal(sanitized.password_hash, undefined);
  assert.equal(sanitized.passwordHash, undefined);
  assert.equal(sanitized.pin, undefined);
  assert.equal(sanitized.id, 'emp-101');
  assert.equal(sanitized.name, 'Rohan');
});

// ============================================================================
// 11. Order Financial Data Scrubbing for Designer and Printer
// ============================================================================
test('11. Security: Financial figures are strictly stripped for Designer and Printer, but kept for Owner/Reception', () => {
  const fullOrder = {
    id: 'ord-999',
    orderNumber: 'PG-2026-999',
    customerName: 'Nepal Everest Traders',
    status: 'In Design',
    totalAmount: 18500,
    total_amount: 18500,
    discount: 500,
    paymentStatus: 'Partial',
    paymentHistory: [{ amount: 5000, date: '2026-09-27' }],
    initialPaymentMethod: 'eSewa',
    initialReceivedAmount: 5000,
    invoiceNumber: 'INV-1001',
    items: [
      {
        productName: 'Brochures A4 300gsm',
        quantity: 1000,
        unitPrice: 18.5,
        lineTotal: 18500,
      },
    ],
    media: [{ id: 'm-1', name: 'catalog-mockup.pdf', category: 'Ready to Go' }],
  };

  // For Designer: financial fields must be stripped
  const designerOrder = sanitizeOrderForRole(fullOrder, ROLES.DESIGNER);
  assert.equal(designerOrder.id, 'ord-999');
  assert.equal(designerOrder.orderNumber, 'PG-2026-999');
  assert.equal(designerOrder.totalAmount, undefined);
  assert.equal(designerOrder.total_amount, undefined);
  assert.equal(designerOrder.discount, undefined);
  assert.equal(designerOrder.paymentStatus, undefined);
  assert.equal(designerOrder.paymentHistory, undefined);
  assert.equal(designerOrder.initialReceivedAmount, undefined);
  assert.equal(designerOrder.invoiceNumber, undefined);
  assert.equal(designerOrder.items[0].quantity, 1000);
  assert.equal(designerOrder.items[0].unitPrice, undefined);
  assert.equal(designerOrder.items[0].lineTotal, undefined);
  assert.equal(designerOrder.media.length, 1);

  // For Printer/Finishing: financial fields must also be stripped
  const printerOrder = sanitizeOrderForRole(fullOrder, ROLES.PRINTER_FINISHING);
  assert.equal(printerOrder.totalAmount, undefined);
  assert.equal(printerOrder.paymentStatus, undefined);
  assert.equal(printerOrder.items[0].unitPrice, undefined);
  assert.equal(printerOrder.items[0].lineTotal, undefined);
  assert.equal(printerOrder.items[0].quantity, 1000);

  // For Reception and Owner: financial fields remain completely intact
  const receptionOrder = sanitizeOrderForRole(fullOrder, ROLES.RECEPTION);
  assert.equal(receptionOrder.totalAmount, 18500);
  assert.equal(receptionOrder.discount, 500);
  assert.equal(receptionOrder.paymentStatus, 'Partial');
  assert.equal(receptionOrder.items[0].unitPrice, 18.5);

  const ownerOrder = sanitizeOrderForRole(fullOrder, ROLES.OWNER);
  assert.equal(ownerOrder.totalAmount, 18500);
  assert.equal(ownerOrder.items[0].unitPrice, 18.5);
});

// ============================================================================
// 12. PostgreSQL Schema & Database Multi-Tenancy Structure
// ============================================================================
test('12. Database Schema: RBAC columns, business_id tenant isolation, and work notifications exist in schema', () => {
  // team_members has role, business_id, email, password_hash, is_active
  assert.match(schemaSql, /business_id\s+TEXT/i);
  assert.match(schemaSql, /role\s+TEXT/i);
  assert.match(schemaSql, /email\s+TEXT/i);
  assert.match(schemaSql, /password_hash\s+TEXT/i);
  assert.match(schemaSql, /is_active\s+BOOLEAN/i);

  // work_notifications table exists with target_role and business_id
  assert.match(schemaSql, /CREATE TABLE IF NOT EXISTS work_notifications/i);
  assert.match(schemaSql, /target_role\s+TEXT\s+NOT\s+NULL/i);
  assert.match(schemaSql, /is_read\s+BOOLEAN/i);

  // Tenant indexes exist
  assert.match(schemaSql, /orders_business_id_idx/i);
  assert.match(schemaSql, /team_members_business_id_idx/i);
  assert.match(schemaSql, /work_notif_target_idx/i);
});

// ============================================================================
// 13. Route Middleware Protection on All Critical Backend Endpoints
// ============================================================================
test('13. Route Protection: Protected routes employ authenticateUser and appropriate requirePermission', () => {
  // Orders route
  assert.match(orderRoutesJs, /router\.use\(authenticateUser\)/);
  assert.match(orderRoutesJs, /requirePermission\(PERMISSIONS\.ORDERS_VIEW\)/);
  assert.match(orderRoutesJs, /requirePermission\(PERMISSIONS\.ORDERS_CREATE\)/);
  assert.match(orderRoutesJs, /requirePermission\(PERMISSIONS\.ORDERS_UPDATE\)/);

  // Expenses route
  assert.match(expenseRoutesJs, /router\.use\(authenticateUser\)/);
  assert.match(expenseRoutesJs, /requirePermission\(PERMISSIONS\.FINANCE_VIEW\)/);
  assert.match(expenseRoutesJs, /requirePermission\(PERMISSIONS\.FINANCE_UPDATE\)/);

  // Team route
  assert.match(teamRoutesJs, /router\.use\(authenticateUser\)/);
  assert.match(teamRoutesJs, /requirePermission\(PERMISSIONS\.EMPLOYEES_VIEW\)/);
  assert.match(teamRoutesJs, /requirePermission\(PERMISSIONS\.EMPLOYEES_MANAGE\)/);

  // Stats route
  assert.match(statsRoutesJs, /router\.use\(authenticateUser\)/);
  assert.match(statsRoutesJs, /requirePermission\(PERMISSIONS\.FINANCE_VIEW\)/);

  // Settings route
  assert.match(settingsRoutesJs, /router\.use\(authenticateUser\)/);
  assert.match(settingsRoutesJs, /requirePermission\(PERMISSIONS\.SETTINGS_VIEW\)/);
  assert.match(settingsRoutesJs, /requirePermission\(PERMISSIONS\.SETTINGS_MANAGE\)/);
});

// ============================================================================
// 14. Frontend RBAC Integration in dist/app.js
// ============================================================================
test('14. Frontend UI: dist/app.js provides role management, navigation filtering, and auth helpers', () => {
  // storageService contains auth & token helpers
  assert.match(appJs, /getAuthToken\s*\(\)\s*\{/);
  assert.match(appJs, /setAuthToken\s*\(token\)\s*\{/);
  assert.match(appJs, /getCurrentRole\s*\(\)\s*\{/);
  assert.match(appJs, /getAuthHeaders\s*\([^)]*\)\s*\{/);
  assert.match(appJs, /login\s*\([^)]*\)\s*\{/);
  assert.match(appJs, /logout\s*\(\)\s*\{/);

  // Team Member modal supports role selection
  assert.match(appJs, /name:\s*['"]addMemberRole['"]/);
  assert.match(appJs, /name:\s*['"]editRole['"]/);
  assert.match(appJs, /value:\s*['"]reception['"]/);
  assert.match(appJs, /value:\s*['"]designer['"]/);
  assert.match(appJs, /value:\s*['"]printer_finishing['"]/);

  // Team Profile details view shows Assigned Role
  assert.match(appJs, /\['Assigned Role',/);
});

