import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { ROLES, hasPermission, getCombinedPermissions, ROLE_PERMISSIONS } = require('../backend/src/config/permissions.js');
const { isFinancialRestrictedRole } = require('../backend/src/controllers/orderController.js');
const { normalizeRole } = require('../backend/src/controllers/teamController.js');
const { hashPassword, verifyPassword } = require('../backend/src/utils/authHelper.js');

test('1. Multi-Role Combined Permissions for Dual Employee (Designer + Printer/Finisher)', () => {
  const dualRole = 'designer,printer_finishing';

  // Has design permissions
  assert.equal(hasPermission(dualRole, 'orders.design'), true, 'Dual role must have orders.design');
  assert.equal(hasPermission(dualRole, 'orders.view'), true, 'Dual role must have orders.view');

  // Has production permissions
  assert.equal(hasPermission(dualRole, 'production.update'), true, 'Dual role must have production.update');
  assert.equal(hasPermission(dualRole, 'stock.view'), true, 'Dual role must have stock.view');

  // Strictly NO financial or team administrative permissions
  assert.equal(hasPermission(dualRole, 'finance.view'), false, 'Dual role must NOT have finance.view');
  assert.equal(hasPermission(dualRole, 'finance.update'), false, 'Dual role must NOT have finance.update');
  assert.equal(hasPermission(dualRole, 'reports.view'), false, 'Dual role must NOT have reports.view');
  assert.equal(hasPermission(dualRole, 'employees.manage'), false, 'Dual role must NOT have employees.manage');

  const combined = getCombinedPermissions(dualRole);
  assert.ok(combined.includes('orders.design'));
  assert.ok(combined.includes('production.update'));
  assert.ok(!combined.includes('finance.view'));
  assert.ok(!combined.includes('employees.manage'));
});

test('2. Financial Role Restriction for Single and Multi-Role Employees', () => {
  assert.equal(isFinancialRestrictedRole('designer'), true);
  assert.equal(isFinancialRestrictedRole('printer_finishing'), true);
  assert.equal(isFinancialRestrictedRole('designer,printer_finishing'), true);
  assert.equal(isFinancialRestrictedRole('printer_finishing,designer'), true);

  assert.equal(isFinancialRestrictedRole('owner'), false);
  assert.equal(isFinancialRestrictedRole('reception'), false);
  assert.equal(isFinancialRestrictedRole('developer'), false);
});

test('3. Portal Access Matching Logic (Owner vs Employee vs Admin Portals)', () => {
  const checkPortalAccess = (role, portal) => {
    const userRoles = String(role).split(',').map(r => r.trim().toLowerCase()).filter(Boolean);
    if (portal === 'owner') {
      const ownerPortalRoles = [ROLES.OWNER, ROLES.RECEPTION, ROLES.SUPER_ADMIN, ROLES.DEVELOPER];
      if (!userRoles.some(r => ownerPortalRoles.includes(r))) {
        return { allowed: false, redirectTo: '/employee/login' };
      }
    } else if (portal === 'employee') {
      const employeePortalRoles = [ROLES.DESIGNER, ROLES.PRINTER_FINISHING, 'printer', 'finisher'];
      if (!userRoles.some(r => employeePortalRoles.includes(r))) {
        return { allowed: false, redirectTo: '/owner/login' };
      }
    } else if (portal === 'admin') {
      const adminPortalRoles = [ROLES.SUPER_ADMIN, ROLES.DEVELOPER];
      if (!userRoles.some(r => adminPortalRoles.includes(r))) {
        return { allowed: false, redirectTo: '/owner/login' };
      }
    }
    return { allowed: true };
  };

  // Owner Portal
  assert.deepEqual(checkPortalAccess('owner', 'owner'), { allowed: true });
  assert.deepEqual(checkPortalAccess('reception', 'owner'), { allowed: true });
  assert.deepEqual(checkPortalAccess('designer', 'owner'), { allowed: false, redirectTo: '/employee/login' });
  assert.deepEqual(checkPortalAccess('printer_finishing', 'owner'), { allowed: false, redirectTo: '/employee/login' });
  assert.deepEqual(checkPortalAccess('designer,printer_finishing', 'owner'), { allowed: false, redirectTo: '/employee/login' });

  // Employee Portal
  assert.deepEqual(checkPortalAccess('designer', 'employee'), { allowed: true });
  assert.deepEqual(checkPortalAccess('printer_finishing', 'employee'), { allowed: true });
  assert.deepEqual(checkPortalAccess('designer,printer_finishing', 'employee'), { allowed: true });
  assert.deepEqual(checkPortalAccess('owner', 'employee'), { allowed: false, redirectTo: '/owner/login' });
  assert.deepEqual(checkPortalAccess('reception', 'employee'), { allowed: false, redirectTo: '/owner/login' });

  // Admin Portal
  assert.deepEqual(checkPortalAccess('developer', 'admin'), { allowed: true });
  assert.deepEqual(checkPortalAccess('super_admin', 'admin'), { allowed: true });
  assert.deepEqual(checkPortalAccess('owner', 'admin'), { allowed: false, redirectTo: '/owner/login' });
  assert.deepEqual(checkPortalAccess('designer', 'admin'), { allowed: false, redirectTo: '/owner/login' });
});

test('4. Team Controller Role Normalization', () => {
  assert.equal(normalizeRole('designer,printer_finishing'), 'designer,printer_finishing');
  assert.equal(normalizeRole('designer'), 'designer');
  assert.equal(normalizeRole('printer_finishing'), 'printer_finishing');
  assert.equal(normalizeRole('reception'), 'reception');
  assert.equal(normalizeRole('owner'), 'owner');
  // Unknown role defaults to fallback
  assert.equal(normalizeRole('hacker_role', 'reception'), 'reception');
});

test('5. Password Management & Hashing Verification', () => {
  const currentSecret = 'EmployeePin123!';
  const hash = hashPassword(currentSecret);

  // Correct password verification
  assert.equal(verifyPassword(currentSecret, hash), true);

  // Wrong password rejection
  assert.equal(verifyPassword('WrongPassword', hash), false);

  // Legacy 6-digit PIN verification
  const pin = '456789';
  const pinHash = hashPassword(pin);
  assert.equal(verifyPassword('456789', pinHash), true);
  assert.equal(verifyPassword('123456', pinHash), false);
});
