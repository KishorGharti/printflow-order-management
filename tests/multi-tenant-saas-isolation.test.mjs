import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { pool } = require('../backend/src/config/db.js');
const { signToken, hashPassword } = require('../backend/src/utils/authHelper.js');
const { ROLES, ROLE_PERMISSIONS } = require('../backend/src/config/permissions.js');
const authController = require('../backend/src/controllers/authController.js');
const orderController = require('../backend/src/controllers/orderController.js');
const customerController = require('../backend/src/controllers/customerController.js');
const productController = require('../backend/src/controllers/productController.js');
const stockController = require('../backend/src/controllers/stockController.js');
const expenseController = require('../backend/src/controllers/expenseController.js');
const vendorController = require('../backend/src/controllers/vendorController.js');
const pricingController = require('../backend/src/controllers/pricingController.js');
const settingsController = require('../backend/src/controllers/settingsController.js');
const developerController = require('../backend/src/controllers/developerController.js');
const { requireDeveloperAccess, getTenantBusinessId } = require('../backend/src/middleware/rbac.js');

// Mock request / response helpers
function createMockReq({ user = null, headers = {}, params = {}, body = {}, query = {}, ip = '127.0.0.1' } = {}) {
  return {
    headers: { ...headers },
    params: { ...params },
    body: { ...body },
    query: { ...query },
    ip,
    user,
  };
}

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
    setHeader() {},
  };
  return res;
}

test('MULTI-TENANT SAAS ISOLATION & POSTGRESQL DEVELOPER SETTINGS SUITE', async (t) => {
  t.after(async () => {
    // Cleanup created test businesses
    try {
      await pool.query(`DELETE FROM orders WHERE business_id IN ('tenant-alpha-test', 'tenant-beta-test')`);
      await pool.query(`DELETE FROM customers WHERE business_id IN ('tenant-alpha-test', 'tenant-beta-test')`);
      await pool.query(`DELETE FROM products WHERE business_id IN ('tenant-alpha-test', 'tenant-beta-test')`);
      await pool.query(`DELETE FROM stock_items WHERE business_id IN ('tenant-alpha-test', 'tenant-beta-test')`);
      await pool.query(`DELETE FROM expenses WHERE business_id IN ('tenant-alpha-test', 'tenant-beta-test')`);
      await pool.query(`DELETE FROM vendors WHERE business_id IN ('tenant-alpha-test', 'tenant-beta-test')`);
      await pool.query(`DELETE FROM customer_pricing WHERE business_id IN ('tenant-alpha-test', 'tenant-beta-test')`);
      await pool.query(`DELETE FROM settings WHERE key IN ('tenant-alpha-test', 'tenant-beta-test') OR business_id IN ('tenant-alpha-test', 'tenant-beta-test')`);
      await pool.query(`DELETE FROM developer_settings WHERE business_id IN ('tenant-alpha-test', 'tenant-beta-test')`);
      await pool.query(`DELETE FROM team_members WHERE business_id IN ('tenant-alpha-test', 'tenant-beta-test')`);
      await pool.query(`DELETE FROM saas_clients WHERE email IN ('owner-alpha@test.com', 'owner-beta@test.com')`);
      await pool.query(`DELETE FROM businesses WHERE business_id IN ('tenant-alpha-test', 'tenant-beta-test')`);
    } catch (_) {}
    await pool.end();
  });

  const BIZ_A = 'tenant-alpha-test';
  const BIZ_B = 'tenant-beta-test';

  let clientA = null;
  let clientB = null;
  let tokenA = null;
  let tokenB = null;

  let orderAId = null;
  let customerAId = null;
  let productAId = null;
  let stockAId = null;
  let expenseAId = null;
  let vendorAId = null;

  // 1. SETUP: Businesses Table and Multi-Tenant Setup
  await t.test('1. Setup: Businesses table exists and stores unique business_id per business', async () => {
    // Create Business A
    await pool.query(`
      INSERT INTO businesses (business_id, name, slug, email, status, subscription_plan)
      VALUES ($1, 'Alpha Printing Hub', $1, 'owner-alpha@test.com', 'active', 'Enterprise')
      ON CONFLICT (business_id) DO NOTHING
    `, [BIZ_A]);

    // Create Business B
    await pool.query(`
      INSERT INTO businesses (business_id, name, slug, email, status, subscription_plan)
      VALUES ($1, 'Beta Color Graphics', $1, 'owner-beta@test.com', 'active', 'Professional')
      ON CONFLICT (business_id) DO NOTHING
    `, [BIZ_B]);

    const resA = await pool.query(`SELECT * FROM businesses WHERE business_id = $1`, [BIZ_A]);
    const resB = await pool.query(`SELECT * FROM businesses WHERE business_id = $1`, [BIZ_B]);

    assert.equal(resA.rows.length, 1);
    assert.equal(resB.rows.length, 1);
    assert.notEqual(resA.rows[0].business_id, resB.rows[0].business_id);
    assert.equal(resA.rows[0].name, 'Alpha Printing Hub');
    assert.equal(resB.rows[0].name, 'Beta Color Graphics');
  });

  // 2. AUTHENTICATION & JWT BINDING: business_id is strictly resolved from authenticated session
  await t.test('2. Auth & JWT: Client logins issue JWT with correct user_id, business_id, and role', async () => {
    // Setup clients in saas_clients
    const pwHash = hashPassword('Secret123!');
    const insA = await pool.query(`
      INSERT INTO saas_clients (name, email, status, business_id, password_hash)
      VALUES ('Alpha Owner', 'owner-alpha@test.com', 'active', $1, $2)
      RETURNING *
    `, [BIZ_A, pwHash]);
    clientA = insA.rows[0];

    const insB = await pool.query(`
      INSERT INTO saas_clients (name, email, status, business_id, password_hash)
      VALUES ('Beta Owner', 'owner-beta@test.com', 'active', $1, $2)
      RETURNING *
    `, [BIZ_B, pwHash]);
    clientB = insB.rows[0];

    // Client Login A
    const reqLoginA = createMockReq({ body: { email: 'owner-alpha@test.com', password: 'Secret123!' } });
    const resLoginA = createMockRes();
    await authController.clientLogin(reqLoginA, resLoginA, () => {});

    assert.equal(resLoginA.statusCode, 200);
    assert.ok(resLoginA.body.token);
    assert.equal(resLoginA.body.client.businessId, BIZ_A);
    tokenA = resLoginA.body.token;

    // Client Login B
    const reqLoginB = createMockReq({ body: { email: 'owner-beta@test.com', password: 'Secret123!' } });
    const resLoginB = createMockRes();
    await authController.clientLogin(reqLoginB, resLoginB, () => {});

    assert.equal(resLoginB.statusCode, 200);
    assert.ok(resLoginB.body.token);
    assert.equal(resLoginB.body.client.businessId, BIZ_B);
    tokenB = resLoginB.body.token;
  });

  // 3. BACKEND DOES NOT TRUST SPOOFED business_id HEADER FROM CLIENT
  await t.test('3. Security: Backend ignores spoofed headers and strictly enforces JWT business_id', async () => {
    const userA = { id: clientA.id, role: ROLES.OWNER, businessId: BIZ_A, isActive: true };
    // Client A sends header pretending to be Business B
    const reqSpoof = createMockReq({
      user: userA,
      headers: { 'x-business-id': BIZ_B },
    });
    const resolvedBiz = getTenantBusinessId(reqSpoof);
    assert.equal(resolvedBiz, BIZ_A, 'Client header must be ignored; user session businessId must prevail');
  });

  // 4. DATA CREATION IN BUSINESS A
  await t.test('4. Data Creation: Create resources in Business A', async () => {
    const userA = { id: clientA.id, role: ROLES.OWNER, businessId: BIZ_A, isActive: true };

    // Create Customer in A
    const reqCust = createMockReq({
      user: userA,
      body: { name: 'Alpha Customer 1', phone: '9800000001', businessName: 'Alpha Corp' },
    });
    const resCust = createMockRes();
    await customerController.create(reqCust, resCust, () => {});
    assert.equal(resCust.statusCode, 201);
    customerAId = resCust.body.id || resCust.body._id;
    assert.ok(customerAId);

    // Create Product in A
    const reqProd = createMockReq({
      user: userA,
      body: { name: 'Alpha Banner 13oz', category: 'Large Format', defaultPrice: 150, unit: 'sq.ft' },
    });
    const resProd = createMockRes();
    await productController.create(reqProd, resProd, () => {});
    assert.equal(resProd.statusCode, 201);
    productAId = resProd.body.id || resProd.body._id;
    assert.ok(productAId);

    // Create Order in A
    const reqOrder = createMockReq({
      user: userA,
      body: {
        orderNumber: 'ORD-ALPHA-1001',
        customerId: customerAId,
        customerName: 'Alpha Customer 1',
        items: [{ productName: 'Alpha Banner 13oz', quantity: 10, unitPrice: 150, lineTotal: 1500 }],
        totalAmount: 1500,
        orderDate: '2026-09-29',
        status: 'New',
      },
    });
    const resOrder = createMockRes();
    await orderController.create(reqOrder, resOrder, () => {});
    assert.equal(resOrder.statusCode, 201);
    orderAId = resOrder.body.id || resOrder.body._id;
    assert.ok(orderAId);

    // Create Stock Item in A
    const reqStock = createMockReq({
      user: userA,
      body: { name: 'Alpha Flex Roll 10ft', category: 'Raw Materials', quantity: 50, unit: 'roll', cost: 2000 },
    });
    const resStock = createMockRes();
    await stockController.create(reqStock, resStock, () => {});
    assert.equal(resStock.statusCode, 201);
    stockAId = resStock.body.id || resStock.body._id;
    assert.ok(stockAId);

    // Create Expense in A
    const reqExp = createMockReq({
      user: userA,
      body: { title: 'Alpha Ink Purchase', category: 'Supplies', amount: 5000, date: '2026-09-29' },
    });
    const resExp = createMockRes();
    await expenseController.create(reqExp, resExp, () => {});
    assert.equal(resExp.statusCode, 201);
    expenseAId = resExp.body.id || resExp.body._id;
    assert.ok(expenseAId);

    // Create Vendor in A
    const reqVen = createMockReq({
      user: userA,
      body: { name: 'Alpha Ink Supplier', phone: '9841000001' },
    });
    const resVen = createMockRes();
    await vendorController.create(reqVen, resVen, () => {});
    assert.equal(resVen.statusCode, 201);
    vendorAId = resVen.body.id || resVen.body._id;
    assert.ok(vendorAId);
  });

  // 5. DATA ISOLATION (READ): Business B cannot see Business A's data in listings
  await t.test('5. Tenant Isolation (Read): Business B lists return 0 records from Business A', async () => {
    const userB = { id: clientB.id, role: ROLES.OWNER, businessId: BIZ_B, isActive: true };

    // List Orders
    const reqOrders = createMockReq({ user: userB });
    const resOrders = createMockRes();
    await orderController.list(reqOrders, resOrders, () => {});
    assert.equal(resOrders.statusCode, 200);
    assert.ok(!resOrders.body.orders.some((o) => o.orderNumber === 'ORD-ALPHA-1001'));

    // List Customers
    const reqCust = createMockReq({ user: userB });
    const resCust = createMockRes();
    await customerController.list(reqCust, resCust, () => {});
    assert.equal(resCust.statusCode, 200);
    assert.ok(!resCust.body.customers.some((c) => c.name === 'Alpha Customer 1'));

    // List Products
    const reqProd = createMockReq({ user: userB });
    const resProd = createMockRes();
    await productController.list(reqProd, resProd, () => {});
    assert.equal(resProd.statusCode, 200);
    assert.ok(!resProd.body.products.some((p) => p.name === 'Alpha Banner 13oz'));

    // List Stock
    const reqStock = createMockReq({ user: userB });
    const resStock = createMockRes();
    await stockController.list(reqStock, resStock, () => {});
    assert.equal(resStock.statusCode, 200);
    assert.ok(!resStock.body.stock.some((s) => s.name === 'Alpha Flex Roll 10ft'));

    // List Expenses
    const reqExp = createMockReq({ user: userB });
    const resExp = createMockRes();
    await expenseController.list(reqExp, resExp, () => {});
    assert.equal(resExp.statusCode, 200);
    assert.ok(!resExp.body.expenses.some((e) => e.title === 'Alpha Ink Purchase'));

    // List Vendors
    const reqVen = createMockReq({ user: userB });
    const resVen = createMockRes();
    await vendorController.list(reqVen, resVen, () => {});
    assert.equal(resVen.statusCode, 200);
    assert.ok(!resVen.body.vendors.some((v) => v.name === 'Alpha Ink Supplier'));
  });

  // 6. CROSS-TENANT ACCESS BLOCKING: Business B cannot access or modify Business A records by ID
  await t.test('6. Tenant Isolation (Direct ID Access): Business B gets 403 Forbidden attempting to access Business A records', async () => {
    const userB = { id: clientB.id, role: ROLES.OWNER, businessId: BIZ_B, isActive: true };

    // Direct Get Order
    const reqGetOrd = createMockReq({ user: userB, params: { id: orderAId } });
    const resGetOrd = createMockRes();
    await orderController.getById(reqGetOrd, resGetOrd, () => {});
    assert.equal(resGetOrd.statusCode, 403);
    assert.match(resGetOrd.body.error, /Cross-business/i);

    // Direct Get Customer
    const reqGetCust = createMockReq({ user: userB, params: { id: customerAId } });
    const resGetCust = createMockRes();
    await customerController.getById(reqGetCust, resGetCust, () => {});
    assert.equal(resGetCust.statusCode, 403);
    assert.match(resGetCust.body.error, /Cross-business/i);

    // Direct Get Product
    const reqGetProd = createMockReq({ user: userB, params: { id: productAId } });
    const resGetProd = createMockRes();
    await productController.getById(reqGetProd, resGetProd, () => {});
    assert.equal(resGetProd.statusCode, 403);
    assert.match(resGetProd.body.error, /Cross-business/i);

    // Direct Get Stock
    const reqGetStk = createMockReq({ user: userB, params: { id: stockAId } });
    const resGetStk = createMockRes();
    await stockController.getById(reqGetStk, resGetStk, () => {});
    assert.equal(resGetStk.statusCode, 403);
    assert.match(resGetStk.body.error, /Cross-business/i);

    // Direct Get Expense
    const reqGetExp = createMockReq({ user: userB, params: { id: expenseAId } });
    const resGetExp = createMockRes();
    await expenseController.getById(reqGetExp, resGetExp, () => {});
    assert.equal(resGetExp.statusCode, 403);
    assert.match(resGetExp.body.error, /Cross-business/i);

    // Direct Get Vendor
    const reqGetVen = createMockReq({ user: userB, params: { id: vendorAId } });
    const resGetVen = createMockRes();
    await vendorController.getById(reqGetVen, resGetVen, () => {});
    assert.equal(resGetVen.statusCode, 403);
    assert.match(resGetVen.body.error, /Cross-business/i);
  });

  // 7. CROSS-TENANT MODIFICATION & DELETION BLOCKING
  await t.test('7. Tenant Isolation (Mutation): Business B cannot modify or delete Business A data', async () => {
    const userB = { id: clientB.id, role: ROLES.OWNER, businessId: BIZ_B, isActive: true };

    // Update Customer of A -> 403
    const reqUpCust = createMockReq({ user: userB, params: { id: customerAId }, body: { name: 'Hacked Name' } });
    const resUpCust = createMockRes();
    await customerController.update(reqUpCust, resUpCust, () => {});
    assert.equal(resUpCust.statusCode, 403);

    // Delete Customer of A -> 403
    const reqDelCust = createMockReq({ user: userB, params: { id: customerAId } });
    const resDelCust = createMockRes();
    await customerController.remove(reqDelCust, resDelCust, () => {});
    assert.equal(resDelCust.statusCode, 403);

    // Update Product of A -> 403
    const reqUpProd = createMockReq({ user: userB, params: { id: productAId }, body: { defaultPrice: 1 } });
    const resUpProd = createMockRes();
    await productController.update(reqUpProd, resUpProd, () => {});
    assert.equal(resUpProd.statusCode, 403);

    // Delete Product of A -> 403
    const reqDelProd = createMockReq({ user: userB, params: { id: productAId } });
    const resDelProd = createMockRes();
    await productController.remove(reqDelProd, resDelProd, () => {});
    assert.equal(resDelProd.statusCode, 403);

    // Update Stock of A -> 403
    const reqUpStk = createMockReq({ user: userB, params: { id: stockAId }, body: { quantity: 0 } });
    const resUpStk = createMockRes();
    await stockController.update(reqUpStk, resUpStk, () => {});
    assert.equal(resUpStk.statusCode, 403);

    // Delete Stock of A -> 403
    const reqDelStk = createMockReq({ user: userB, params: { id: stockAId } });
    const resDelStk = createMockRes();
    await stockController.remove(reqDelStk, resDelStk, () => {});
    assert.equal(resDelStk.statusCode, 403);
  });

  // 8. SETTINGS ISOLATION & POSTGRESQL PERSISTENCE
  await t.test('8. Settings Persistence: Business settings are isolated and saved to PostgreSQL', async () => {
    const userA = { id: clientA.id, role: ROLES.OWNER, businessId: BIZ_A, isActive: true };
    const userB = { id: clientB.id, role: ROLES.OWNER, businessId: BIZ_B, isActive: true };

    // Save Settings for Business A
    const reqSetA = createMockReq({
      user: userA,
      body: { shopName: 'Alpha Printing Hub', jobPrefix: 'ALPHA-', currency: 'Rs.' },
    });
    const resSetA = createMockRes();
    await settingsController.updateSettings(reqSetA, resSetA, () => {});
    assert.equal(resSetA.statusCode, 200);

    // Save Settings for Business B
    const reqSetB = createMockReq({
      user: userB,
      body: { shopName: 'Beta Color Graphics', jobPrefix: 'BETA-', currency: 'Rs.' },
    });
    const resSetB = createMockRes();
    await settingsController.updateSettings(reqSetB, resSetB, () => {});
    assert.equal(resSetB.statusCode, 200);

    // Read Settings for Business A
    const reqGetA = createMockReq({ user: userA });
    const resGetA = createMockRes();
    await settingsController.getSettings(reqGetA, resGetA, () => {});
    assert.equal(resGetA.statusCode, 200);
    assert.equal(resGetA.body.shopName, 'Alpha Printing Hub');
    assert.equal(resGetA.body.jobPrefix, 'ALPHA-');

    // Read Settings for Business B
    const reqGetB = createMockReq({ user: userB });
    const resGetB = createMockRes();
    await settingsController.getSettings(reqGetB, resGetB, () => {});
    assert.equal(resGetB.statusCode, 200);
    assert.equal(resGetB.body.shopName, 'Beta Color Graphics');
    assert.equal(resGetB.body.jobPrefix, 'BETA-');

    // Verify in PostgreSQL directly that two separate rows exist with independent configs
    const dbRows = await pool.query(
      `SELECT key, business_id, shop_name, job_prefix FROM settings WHERE key IN ($1, $2)`,
      [BIZ_A, BIZ_B]
    );
    assert.equal(dbRows.rows.length, 2);
  });

  // 9. DEVELOPER/ADMIN OPTIONS IN POSTGRESQL: Multi-tenant developer options
  await t.test('9. Developer Settings: Per-business developer options and global options in PostgreSQL', async () => {
    const devUser = { id: 'dev-master', role: ROLES.DEVELOPER, isDeveloper: true, isActive: true };

    // Developer updates Business A specific developer settings
    const reqDevA = createMockReq({
      user: devUser,
      params: { businessId: BIZ_A },
      body: {
        key: 'whatsapp_gateway_config',
        value: { provider: 'MetaCloud', maxDailyMessages: 500, autoSendDueReminder: true },
        features: { orders: true, finance: true, inventory: true, whatsapp: true, api: true },
        subscriptionPlan: 'Enterprise',
      },
    });
    const resDevA = createMockRes();
    await developerController.updateBusinessDeveloperSettings(reqDevA, resDevA);
    assert.equal(resDevA.statusCode, 200);

    // Developer reads Business A developer settings
    const reqGetDevA = createMockReq({
      user: devUser,
      params: { businessId: BIZ_A },
    });
    const resGetDevA = createMockRes();
    await developerController.getBusinessDeveloperSettings(reqGetDevA, resGetDevA);
    assert.equal(resGetDevA.statusCode, 200);
    assert.equal(resGetDevA.body.business.subscription_plan, 'Enterprise');
    assert.equal(resGetDevA.body.developerSettings.whatsapp_gateway_config.provider, 'MetaCloud');

    // Verify Business B does NOT have this setting
    const reqGetDevB = createMockReq({
      user: devUser,
      params: { businessId: BIZ_B },
    });
    const resGetDevB = createMockRes();
    await developerController.getBusinessDeveloperSettings(reqGetDevB, resGetDevB);
    assert.equal(resGetDevB.statusCode, 200);
    assert.equal(resGetDevB.body.developerSettings.whatsapp_gateway_config, undefined);

    // Verify standard client cannot access developer routes
    const clientUser = { id: clientA.id, role: ROLES.OWNER, businessId: BIZ_A, isActive: true };
    const reqClientGuard = createMockReq({ user: clientUser });
    const resClientGuard = createMockRes();
    requireDeveloperAccess(reqClientGuard, resClientGuard, () => assert.fail('Client must be rejected'));
    assert.equal(resClientGuard.statusCode, 403);
    assert.match(resClientGuard.body.error, /strictly restricted to SUPER_ADMIN \/ DEVELOPER/i);
  });

  // 10. RECOVERY: Simulate browser localStorage clearing and verify PostgreSQL persistence
  await t.test('10. Persistence: Clearing browser cache/localStorage does not lose settings or data', async () => {
    // Query directly from PostgreSQL pretending browser storage is empty
    const userA = { id: clientA.id, role: ROLES.OWNER, businessId: BIZ_A, isActive: true };
    const reqFresh = createMockReq({ user: userA });
    const resFresh = createMockRes();
    await settingsController.getSettings(reqFresh, resFresh, () => {});

    assert.equal(resFresh.statusCode, 200);
    assert.equal(resFresh.body.shopName, 'Alpha Printing Hub');
    assert.equal(resFresh.body.jobPrefix, 'ALPHA-');

    // Customer and order count in PostgreSQL remains completely intact
    const ordersInDb = await pool.query(`SELECT COUNT(*)::int AS count FROM orders WHERE business_id = $1`, [BIZ_A]);
    const customersInDb = await pool.query(`SELECT COUNT(*)::int AS count FROM customers WHERE business_id = $1`, [BIZ_A]);
    assert.equal(ordersInDb.rows[0].count, 1);
    assert.equal(customersInDb.rows[0].count, 1);
  });
});
