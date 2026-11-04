import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// Needs a real database (it checks what PostgreSQL accepts). Runs only against the isolated test DB.
const testDbUrl = process.env.SECTEST_DATABASE_URL;
const usingTestDb = Boolean(testDbUrl) && process.env.DATABASE_URL === testDbUrl && new URL(testDbUrl).pathname.endsWith('_sectest');
const skip = usingTestDb ? false : 'requires the isolated test database (SECTEST_DATABASE_URL)';

const { pool } = require('../backend/src/config/db.js');
const orderController = require('../backend/src/controllers/orderController.js');
const { COUNTERS_TABLE_SQL } = require('../backend/src/services/numberingService.js');

const BIZ = `savefields-${Date.now().toString(36)}`;
function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const reqFor = (body, params = {}) => ({ user: { id: 'u', role: 'owner', businessId: BIZ, isActive: true }, headers: {}, query: {}, params, body });
const call = async (fn, req) => { const res = mockRes(); await fn(req, res, (err) => { throw err; }); return res; };

before(async () => {
  if (skip) return;
  await pool.query(COUNTERS_TABLE_SQL);
  await pool.query('INSERT INTO settings (key, business_id) VALUES ($1, $1) ON CONFLICT (key) DO NOTHING', [BIZ]);
});
after(async () => {
  if (!skip) {
    await pool.query('DELETE FROM work_notifications WHERE business_id = $1', [BIZ]).catch(() => {});
    await pool.query('DELETE FROM orders WHERE business_id = $1', [BIZ]);
    await pool.query('DELETE FROM number_counters WHERE business_id = $1', [BIZ]);
    await pool.query('DELETE FROM settings WHERE key = $1', [BIZ]);
  }
  await pool.end();
});

test('billing an order opened from "Needing Attention" saves its discount and total', { skip }, async () => {
  const created = await call(orderController.create, reqFor({
    localId: `ord-${BIZ}-1`, customerId: 'c1', items: [{ productName: 'Card', quantity: 10, rate: 10, lineTotal: 100 }], totalAmount: 100, status: 'New',
  }));
  assert.equal(created.statusCode, 201);
  // The dashboard card adds display-only fields to its copy of the order.
  const res = await call(orderController.update, reqFor(
    { ...created.body, _dueMs: 1790000000000, _diffMs: -5000, discount: 15, totalAmount: 85 },
    { id: created.body._id }
  ));
  assert.equal(res.statusCode, 200);
  const row = (await pool.query('SELECT discount, total_amount FROM orders WHERE id = $1', [created.body._id])).rows[0];
  assert.equal(Number(row.discount), 15);
  assert.equal(Number(row.total_amount), 85);
});

test('creating an order ignores display-only fields too', { skip }, async () => {
  const res = await call(orderController.create, reqFor({
    localId: `ord-${BIZ}-2`, customerId: 'c1', items: [{ productName: 'Card', quantity: 1, rate: 5, lineTotal: 5 }], totalAmount: 5, status: 'New', _dueMs: 1, _diffMs: 2,
  }));
  assert.equal(res.statusCode, 201);
});

test('the browser strips display-only fields before saving an order', () => {
  const app = fs.readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');
  assert.match(app, /Display-only fields \(for example _dueMs \/ _diffMs/);
});
