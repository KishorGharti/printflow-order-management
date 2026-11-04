import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// Marking an order as Mistake saves its details on the order and its cost as a linked expense.
// The database part runs only against the isolated test database.
const testDbUrl = process.env.SECTEST_DATABASE_URL;
const usingTestDb = Boolean(testDbUrl) && process.env.DATABASE_URL === testDbUrl && new URL(testDbUrl).pathname.endsWith('_sectest');
const skip = usingTestDb ? false : 'requires the isolated test database (SECTEST_DATABASE_URL)';

const { pool } = require('../backend/src/config/db.js');
const orderController = require('../backend/src/controllers/orderController.js');
const expenseController = require('../backend/src/controllers/expenseController.js');
const { COUNTERS_TABLE_SQL } = require('../backend/src/services/numberingService.js');

const BIZ = `mistake-${Date.now().toString(36)}`;
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
  // Same additive columns connectDB() adds at startup.
  const db = fs.readFileSync(new URL('../backend/src/config/db.js', import.meta.url), 'utf8');
  for (const line of db.match(/ALTER TABLE (orders|expenses) ADD COLUMN IF NOT EXISTS (mistake_\w+|linked_order_id|mistake_expense)[^;]*;/g)) await pool.query(line);
  await pool.query('INSERT INTO settings (key, business_id) VALUES ($1, $1) ON CONFLICT (key) DO NOTHING', [BIZ]);
});
after(async () => {
  if (!skip) {
    await pool.query('DELETE FROM work_notifications WHERE business_id = $1', [BIZ]).catch(() => {});
    for (const t of ['expenses', 'orders', 'number_counters']) await pool.query(`DELETE FROM ${t} WHERE business_id = $1`, [BIZ]);
    await pool.query('DELETE FROM settings WHERE key = $1', [BIZ]);
  }
  await pool.end();
});

test('an order can be marked Mistake with its details in one save', { skip }, async () => {
  const created = await call(orderController.create, reqFor({ localId: `ord-${BIZ}`, customerId: 'c1', status: 'Printing', items: [{ id: 'i1', productName: 'Card', quantity: 10, rate: 5, lineTotal: 50 }], totalAmount: 50 }));
  assert.equal(created.statusCode, 201);
  const now = new Date().toISOString();
  const res = await call(orderController.update, reqFor({ status: 'Mistake', mistakeAt: now, mistakeCost: 300, mistakeReason: 'Wrong paper used', mistakeBy: 'Ram', notes: '[Marked as Mistake]' }, { id: created.body._id }));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, 'Mistake');
  assert.equal(res.body.mistakeAt, now);
  assert.equal(Number(res.body.mistakeCost), 300);
  assert.equal(res.body.mistakeReason, 'Wrong paper used');
  assert.equal(res.body.mistakeBy, 'Ram');
});

test('once an order is Mistake its status is locked; other details can still be saved', { skip }, async () => {
  const created = await call(orderController.create, reqFor({ localId: `ord2-${BIZ}`, customerId: 'c1', status: 'Printing', items: [{ id: 'i1', productName: 'Card', quantity: 10, rate: 5, lineTotal: 50 }], totalAmount: 50 }));
  const id = created.body._id;
  assert.equal((await call(orderController.update, reqFor({ status: 'Mistake', mistakeReason: 'Misprint' }, { id }))).statusCode, 200);
  for (const status of ['New', 'In Design', 'Printing', 'Ready', 'Payment', 'Pickup', 'Delivery', 'Cancelled']) {
    const res = await call(orderController.update, reqFor({ status }, { id }));
    assert.equal(res.statusCode, 400, status);
    assert.equal(res.body.code, 'ORDER_MISTAKE_FINAL', status);
  }
  assert.equal((await pool.query('SELECT status FROM orders WHERE id = $1', [id])).rows[0].status, 'Mistake');
  const note = await call(orderController.update, reqFor({ status: 'Mistake', notes: 'Customer informed' }, { id }));
  assert.equal(note.statusCode, 200, 'a full save that keeps the Mistake status still works');
  assert.equal(note.body.notes, 'Customer informed');
});

test('the mistake cost is saved as an expense linked to the order', { skip }, async () => {
  const res = await call(expenseController.create, reqFor({ title: 'Mistake cost - JOB-1', category: 'Mistake', amount: 300, date: '2026-10-27', paymentMethod: 'Cash', paidBy: 'Ram', vendor: 'Internal / Production', notes: 'Wrong paper', linkedOrderId: 'order-1', mistakeExpense: true }));
  assert.ok([200, 201].includes(res.statusCode), JSON.stringify(res.body));
  const row = (await pool.query('SELECT linked_order_id, mistake_expense FROM expenses WHERE business_id = $1', [BIZ])).rows[0];
  assert.deepEqual(row, { linked_order_id: 'order-1', mistake_expense: true });
});

test('Mistake, move-back and Printing flows save their changes with the status in one request', () => {
  const app = fs.readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');
  assert.match(app, /updateOrderStatus\(id, status, paymentMethod, teamMember, changes\)/);
  assert.match(app, /storageService\.updateOrderStatus\(order\.id, 'Mistake', undefined, undefined, \{/);
  assert.match(app, /storageService\.updateOrderStatus\(order\.id, targetStatus, undefined, undefined, \{ notes: existingNotes \}\)/);
  assert.match(app, /storageService\.updateOrderStatus\(preparedOrder\.id, 'Printing', undefined, chosenMember, changes\)/);
  assert.equal(/storageService\.saveOrder\(\{ \.\.\.order, notes: existingNotes \}\)/.test(app), false);
  assert.equal(/preparedOrder = storageService\.saveOrder/.test(app), false);
  assert.match(app, /\.catch\(err => alert\(`The mistake cost was not saved as an expense/);
  // Mistake is final on screen too: menu options locked, handler refuses, detail steps disabled.
  assert.match(app, /const isOptionDisabled = \(opt\) => \{\s*\/\/ A Mistake order is closed[^\n]*\n\s*if \(order\.status === 'Mistake'\) return true;/);
  assert.match(app, /if \(current\.status === 'Mistake'\) \{\s*if \(newStatus !== 'Mistake'\) alert\(/);
  assert.match(app, /const isDisabled = isDoneLocked \|\| selectedOrder\.status === 'Mistake' \|\|/);
  const schema = fs.readFileSync(new URL('../backend/src/config/schema.sql', import.meta.url), 'utf8');
  for (const col of ['mistake_at', 'mistake_cost', 'mistake_reason', 'mistake_by', 'linked_order_id', 'mistake_expense']) assert.match(schema, new RegExp(`\\b${col}\\b`), col);
});
