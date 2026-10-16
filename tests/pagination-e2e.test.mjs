import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import controllers
const orderController = (await import('../backend/src/controllers/orderController.js')).default || (await import('../backend/src/controllers/orderController.js'));
const customerController = (await import('../backend/src/controllers/customerController.js')).default || (await import('../backend/src/controllers/customerController.js'));
const productController = (await import('../backend/src/controllers/productController.js')).default || (await import('../backend/src/controllers/productController.js'));
const stockController = (await import('../backend/src/controllers/stockController.js')).default || (await import('../backend/src/controllers/stockController.js'));
const stockTransactionController = (await import('../backend/src/controllers/stockTransactionController.js')).default || (await import('../backend/src/controllers/stockTransactionController.js'));
const expenseController = (await import('../backend/src/controllers/expenseController.js')).default || (await import('../backend/src/controllers/expenseController.js'));
const teamController = (await import('../backend/src/controllers/teamController.js')).default || (await import('../backend/src/controllers/teamController.js'));
const vendorController = (await import('../backend/src/controllers/vendorController.js')).default || (await import('../backend/src/controllers/vendorController.js'));
const developerController = (await import('../backend/src/controllers/developerController.js')).default || (await import('../backend/src/controllers/developerController.js'));
const crashReporter = (await import('../backend/src/utils/crashReporter.js')).default || (await import('../backend/src/utils/crashReporter.js'));
const { pool } = (await import('../backend/src/config/db.js')).default || (await import('../backend/src/config/db.js'));
const { ROLES } = (await import('../backend/src/config/permissions.js')).default || (await import('../backend/src/config/permissions.js'));

function createMockReq(overrides = {}) {
  return {
    headers: {},
    params: {},
    query: {},
    body: {},
    user: {
      id: 'test-user-pagination',
      role: ROLES.OWNER,
      businessId: 'test-biz-pagination',
      name: 'Pagination Tester',
      email: 'pagination@test.com'
    },
    ...overrides
  };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    send(data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

test('POSTGRESQL SERVER-SIDE PAGINATION SUITE — Complete Coverage', async (t) => {
  const BIZ_ID = 'test-biz-pagination-e2e';

  // Seed test data for multi-tenant pagination testing
  await t.before(async () => {
    // Clean existing test records for this business
    await pool.query('DELETE FROM orders WHERE business_id = $1', [BIZ_ID]);
    await pool.query('DELETE FROM customers WHERE business_id = $1', [BIZ_ID]);
    await pool.query('DELETE FROM products WHERE business_id = $1', [BIZ_ID]);
    await pool.query('DELETE FROM stock_items WHERE business_id = $1', [BIZ_ID]);
    await pool.query('DELETE FROM expenses WHERE business_id = $1', [BIZ_ID]);
    await pool.query('DELETE FROM team_members WHERE business_id = $1', [BIZ_ID]);

    // Insert 25 customers first so we can link customer_id
    const customerIds = [];
    for (let i = 1; i <= 25; i++) {
      const custRes = await pool.query(
        `INSERT INTO customers (business_id, name, phone, email, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING id`,
        [BIZ_ID, `Customer ${i}`, `98000000${String(i).padStart(2, '0')}`, `customer${i}@test.com`]
      );
      customerIds.push(custRes.rows[0].id);
    }

    // Insert 25 orders to test page 1 (20 items) and page 2 (5 items)
    for (let i = 1; i <= 25; i++) {
      const orderNum = `PAG-ORD-${String(i).padStart(3, '0')}`;
      await pool.query(
        `INSERT INTO orders (business_id, customer_id, order_number, customer_name, status, total_amount, order_date, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, '2026-10-11', NOW() - ($7 || ' hours')::interval, NOW())`,
        [BIZ_ID, customerIds[i - 1], orderNum, `Client ${i}`, i % 2 === 0 ? 'New' : 'Ready', 500 * i, 26 - i]
      );
    }

    // Insert 25 products
    for (let i = 1; i <= 25; i++) {
      await pool.query(
        `INSERT INTO products (business_id, name, unit, default_price, created_at, updated_at)
         VALUES ($1, $2, 'pcs', 100, NOW(), NOW())`,
        [BIZ_ID, `Product Model ${i}`]
      );
    }

    // Insert 25 stock items
    for (let i = 1; i <= 25; i++) {
      await pool.query(
        `INSERT INTO stock_items (business_id, name, category, quantity, unit, created_at, updated_at)
         VALUES ($1, $2, 'Raw Materials', 50, 'kg', NOW(), NOW())`,
        [BIZ_ID, `Stock Item ${i}`]
      );
    }
  });

  await t.after(async () => {
    // Cleanup
    await pool.query('DELETE FROM orders WHERE business_id = $1', [BIZ_ID]);
    await pool.query('DELETE FROM customers WHERE business_id = $1', [BIZ_ID]);
    await pool.query('DELETE FROM products WHERE business_id = $1', [BIZ_ID]);
    await pool.query('DELETE FROM stock_items WHERE business_id = $1', [BIZ_ID]);
    await pool.query('DELETE FROM expenses WHERE business_id = $1', [BIZ_ID]);
    await pool.query('DELETE FROM team_members WHERE business_id = $1', [BIZ_ID]);
  });

  // 1. Orders server-side pagination
  await t.test('1. Orders: Default page size is 20 with exact total and totalPages', async () => {
    const reqPage1 = createMockReq({
      user: { id: 'u1', role: ROLES.OWNER, businessId: BIZ_ID },
      query: { page: '1' }
    });
    const resPage1 = createMockRes();
    await orderController.list(reqPage1, resPage1);

    assert.equal(resPage1.statusCode, 200);
    assert.equal(resPage1.body.orders.length, 20, 'Page 1 must contain exactly 20 records by default');
    assert.equal(resPage1.body.total, 25, 'Total must equal 25 seeded records');
    assert.equal(resPage1.body.page, 1);
    assert.equal(resPage1.body.limit, 20);
    assert.equal(resPage1.body.totalPages, 2);

    // Page 2
    const reqPage2 = createMockReq({
      user: { id: 'u1', role: ROLES.OWNER, businessId: BIZ_ID },
      query: { page: '2' }
    });
    const resPage2 = createMockRes();
    await orderController.list(reqPage2, resPage2);

    assert.equal(resPage2.statusCode, 200);
    assert.equal(resPage2.body.orders.length, 5, 'Page 2 must contain the remaining 5 records');
    assert.equal(resPage2.body.page, 2);
    assert.equal(resPage2.body.total, 25);
  });

  // 2. Orders filtered pagination and multi-tenant scoping
  await t.test('2. Orders: Preserves status filter with pagination and blocks foreign business records', async () => {
    const reqFiltered = createMockReq({
      user: { id: 'u1', role: ROLES.OWNER, businessId: BIZ_ID },
      query: { status: 'New', page: '1', limit: '10' }
    });
    const resFiltered = createMockRes();
    await orderController.list(reqFiltered, resFiltered);

    assert.equal(resFiltered.statusCode, 200);
    // 12 even numbers from 1 to 25 have status 'New'
    assert.equal(resFiltered.body.total, 12);
    assert.equal(resFiltered.body.orders.length, 10);
    assert.equal(resFiltered.body.totalPages, 2);
    assert.ok(resFiltered.body.orders.every(o => o.status === 'New'));

    // Separate business sees 0 records
    const reqForeign = createMockReq({
      user: { id: 'u2', role: ROLES.OWNER, businessId: 'different-isolated-biz' },
      query: { page: '1' }
    });
    const resForeign = createMockRes();
    await orderController.list(reqForeign, resForeign);

    assert.equal(resForeign.statusCode, 200);
    assert.equal(resForeign.body.total, 0);
    assert.equal(resForeign.body.orders.length, 0);
  });

  // 3. Customers server-side pagination
  await t.test('3. Customers: Server-side pagination with default 20 per page', async () => {
    const req = createMockReq({
      user: { id: 'u1', role: ROLES.OWNER, businessId: BIZ_ID },
      query: { page: '1' }
    });
    const res = createMockRes();
    await customerController.list(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.customers.length, 20);
    assert.equal(res.body.total, 25);
    assert.equal(res.body.totalPages, 2);
  });

  // 4. Products server-side pagination
  await t.test('4. Products: Server-side pagination with default 20 per page', async () => {
    const req = createMockReq({
      user: { id: 'u1', role: ROLES.OWNER, businessId: BIZ_ID },
      query: { page: '1' }
    });
    const res = createMockRes();
    await productController.list(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.products.length, 20);
    assert.equal(res.body.total, 25);
    assert.equal(res.body.totalPages, 2);
  });

  // 5. Stock items server-side pagination
  await t.test('5. Stock Items: Server-side pagination with default 20 per page', async () => {
    const req = createMockReq({
      user: { id: 'u1', role: ROLES.OWNER, businessId: BIZ_ID },
      query: { page: '1' }
    });
    const res = createMockRes();
    await stockController.list(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.stock.length, 20);
    assert.equal(res.body.total, 25);
    assert.equal(res.body.totalPages, 2);
  });

  // 6. Developer Console: Clients pagination
  await t.test('6. Developer: getClients returns paginated results with total, page, limit', async () => {
    const req = createMockReq({
      user: { id: 'dev-master', role: ROLES.SUPER_ADMIN, isDeveloper: true },
      query: { page: '1', limit: '20' }
    });
    const res = createMockRes();
    await developerController.getClients(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.ok(Array.isArray(res.body.clients));
    assert.ok(typeof res.body.total === 'number');
    assert.equal(res.body.page, 1);
    assert.equal(res.body.limit, 20);
    assert.ok(typeof res.body.totalPages === 'number');
  });

  // 7. Developer Console: Audit logs pagination
  await t.test('7. Developer: getAuditLogs returns paginated logs with filtered total', async () => {
    const req = createMockReq({
      user: { id: 'dev-master', role: ROLES.SUPER_ADMIN, isDeveloper: true },
      query: { page: '1', limit: '20' }
    });
    const res = createMockRes();
    await developerController.getAuditLogs(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.ok(Array.isArray(res.body.logs));
    assert.ok(typeof res.body.total === 'number');
    assert.equal(res.body.page, 1);
    assert.equal(res.body.limit, 20);
  });

  // 8. Developer Console: Crash Reporter Error logs pagination
  await t.test('8. Crash Reporter: getRecentErrors returns paginated errors', async () => {
    const result = await crashReporter.getRecentErrors({ page: 1, limit: 20 });
    assert.ok(Array.isArray(result.errors));
    assert.ok(typeof result.total === 'number');
    assert.equal(result.page, 1);
    assert.equal(result.limit, 20);
    assert.ok(typeof result.totalPages === 'number');
  });

  // 9. Developer Console: Automated Backups pagination
  await t.test('9. Developer: getAutomatedBackups returns paginated backups and status', async () => {
    const req = createMockReq({
      user: { id: 'dev-master', role: ROLES.SUPER_ADMIN, isDeveloper: true },
      query: { page: '1', limit: '20' }
    });
    const res = createMockRes();
    await developerController.getAutomatedBackups(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.ok(Array.isArray(res.body.backups));
    assert.ok(typeof res.body.total === 'number');
    assert.equal(res.body.page, 1);
    assert.equal(res.body.limit, 20);
  });

  // 10. Frontend pagination integration in dist/app.js & dist/developer.js
  await t.test('10. Frontend: dist/app.js and dist/developer.js render Pagination with buttons and reset hooks', () => {
    const appJs = fs.readFileSync(path.resolve(__dirname, '../dist/app.js'), 'utf8');
    const devJs = fs.readFileSync(path.resolve(__dirname, '../dist/developer.js'), 'utf8');

    // app.js has generatePaginationPages, renderAppPagination, and reset useEffects
    assert.match(appJs, /generatePaginationPages/);
    assert.doesNotMatch(appJs, /Showing \$\{start \+ 1\}/, 'app.js must not show Showing records label in pagination');
    assert.doesNotMatch(devJs, /Showing \$\{start \+ 1\}/, 'developer.js must not show Showing records label in pagination');
    assert.match(appJs, /setOrdersTablePage\(1\)/);
    assert.match(appJs, /setClientListPage\(1\)/);
    assert.match(appJs, /setStockTablePage\(1\)/);
    assert.match(appJs, /setTeamAttendancePage\(1\)/);

    // developer.js has Pagination component with prev/next and numbered buttons
    assert.match(devJs, /function Pagination\(\{/);
    assert.match(devJs, /← Prev/);
    assert.match(devJs, /Next →/);
    assert.match(devJs, /h\(Pagination,/);
    assert.match(devJs, /tableStoragePage/);
    assert.match(devJs, /bizUsagePage/);

    // Verify 'per page' dropdowns have been removed and default page sizes are 20
    assert.doesNotMatch(devJs, /per page/i, 'developer.js must not contain per-page dropdown options');
    assert.doesNotMatch(appJs, /"20 per page"/, 'app.js must not contain per-page dropdown options');
    assert.doesNotMatch(appJs, /"50 per page"/, 'app.js must not contain per-page dropdown options');
    assert.match(devJs, /const \[tableStoragePageSize, setTableStoragePageSize\] = useState\(20\)/);
    assert.match(devJs, /const \[bizUsagePageSize, setBizUsagePageSize\] = useState\(20\)/);
  });
});
