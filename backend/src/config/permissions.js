'use strict';

/**
 * Role-Based Access Control (RBAC) Permissions Configuration
 *
 * Roles:
 *  - owner: Full administrative and business access
 *  - reception: Full operational access (equal to owner for business operations)
 *  - designer: Only design-related jobs, media, upload and status updates
 *  - printer_finishing: Only printing and finishing production jobs and status
 */

const ROLES = {
  SUPER_ADMIN: 'super_admin',
  DEVELOPER: 'developer',
  OWNER: 'owner',
  RECEPTION: 'reception',
  DESIGNER: 'designer',
  PRINTER_FINISHING: 'printer_finishing',
};

const PERMISSIONS = {
  // Developer Platform Administration (Super Admin / Developer ONLY)
  DEVELOPER_ACCESS: 'developer.access',
  CLIENTS_MANAGE: 'developer.clients_manage',
  COMPANIES_MANAGE: 'developer.companies_manage',
  SUBSCRIPTIONS_MANAGE: 'developer.subscriptions_manage',
  AUDIT_LOGS_VIEW: 'developer.audit_logs_view',
  SYSTEM_SETTINGS_MANAGE: 'developer.system_settings_manage',

  // Dashboard
  DASHBOARD_VIEW: 'dashboard.view',

  // Orders
  ORDERS_VIEW: 'orders.view',
  ORDERS_CREATE: 'orders.create',
  ORDERS_UPDATE: 'orders.update',
  ORDERS_CANCEL: 'orders.cancel',
  ORDERS_DESIGN: 'orders.design',

  // Production
  PRODUCTION_VIEW: 'production.view',
  PRODUCTION_UPDATE: 'production.update',

  // Customers
  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_MANAGE: 'customers.manage',

  // Products & Stock
  PRODUCTS_VIEW: 'products.view',
  PRODUCTS_MANAGE: 'products.manage',
  STOCK_VIEW: 'stock.view',
  STOCK_UPDATE: 'stock.update',
  STOCK_MANAGE: 'stock.manage',

  // Finance & Accounting (Protected)
  FINANCE_VIEW: 'finance.view',
  FINANCE_UPDATE: 'finance.update',

  // Reports
  REPORTS_VIEW: 'reports.view',

  // Settings
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_MANAGE: 'settings.manage',

  // Employee / Team Management
  EMPLOYEES_VIEW: 'employees.view',
  EMPLOYEES_MANAGE: 'employees.manage',

  // Notifications
  NOTIFICATIONS_VIEW: 'notifications.view',
  NOTIFICATIONS_MANAGE: 'notifications.manage',
};

// All permissions
const ALL_PERMISSIONS = Object.values(PERMISSIONS);

// Map of Role → Granted Permissions
const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: ALL_PERMISSIONS,
  [ROLES.DEVELOPER]: ALL_PERMISSIONS,

  // Client owner and reception have operational access to business operations, NOT developer platform access
  [ROLES.OWNER]: ALL_PERMISSIONS.filter(p => !p.startsWith('developer.')),
  [ROLES.RECEPTION]: ALL_PERMISSIONS.filter(p => !p.startsWith('developer.')),

  [ROLES.DESIGNER]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_DESIGN,
    PERMISSIONS.ORDERS_UPDATE,
    PERMISSIONS.PRODUCTION_VIEW,
    PERMISSIONS.NOTIFICATIONS_VIEW,
    PERMISSIONS.NOTIFICATIONS_MANAGE,
  ],

  [ROLES.PRINTER_FINISHING]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.PRODUCTION_VIEW,
    PERMISSIONS.PRODUCTION_UPDATE,
    PERMISSIONS.ORDERS_UPDATE,
    PERMISSIONS.STOCK_VIEW,
    PERMISSIONS.NOTIFICATIONS_VIEW,
    PERMISSIONS.NOTIFICATIONS_MANAGE,
  ],
};

/**
 * Checks whether a given role (or comma-separated multi-roles) has a specific permission.
 */
function hasPermission(role, permission) {
  if (!role) return false;
  const roles = (Array.isArray(role) ? role : String(role).split(','))
    .map(r => r.trim().toLowerCase())
    .filter(Boolean);

  for (const r of roles) {
    if (r === ROLES.SUPER_ADMIN || r === ROLES.DEVELOPER) return true;
    if (r === ROLES.OWNER || r === ROLES.RECEPTION) {
      if (permission && permission.startsWith('developer.')) continue;
      return true;
    }
  }

  for (const r of roles) {
    const perms = ROLE_PERMISSIONS[r] || [];
    if (perms.includes(permission)) return true;
  }
  return false;
}

/**
 * Returns the unified set of permissions granted to a role or comma-separated multi-roles.
 */
function getCombinedPermissions(role) {
  if (!role) return [];
  const roles = (Array.isArray(role) ? role : String(role).split(','))
    .map(r => r.trim().toLowerCase())
    .filter(Boolean);

  if (roles.includes(ROLES.SUPER_ADMIN) || roles.includes(ROLES.DEVELOPER)) return ALL_PERMISSIONS;
  if (roles.includes(ROLES.OWNER) || roles.includes(ROLES.RECEPTION)) {
    return ALL_PERMISSIONS.filter(p => !p.startsWith('developer.'));
  }

  const set = new Set();
  for (const r of roles) {
    const perms = ROLE_PERMISSIONS[r] || [];
    for (const p of perms) set.add(p);
  }
  return Array.from(set);
}

module.exports = {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  getCombinedPermissions,
};
