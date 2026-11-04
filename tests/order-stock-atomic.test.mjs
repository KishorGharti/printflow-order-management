import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// Order + stock are saved in one transaction on the server. Real PostgreSQL is needed, so this
// only runs against the isolated test database (SECTEST_DATABASE_URL).
const testDbUrl = process.env.SECTEST_DATABASE_URL;
const usingTestDb = Boolean(testDbUrl) && process.env.DATABASE_URL === testDbUrl && new URL(testDbUrl).pathname.endsWith('_sectest');
const skip = usingTestDb ? false : 'requires the isolated test database (SECTEST_DATABASE_URL)';

const { pool } = require('../backend/src/config/db.js');
const orderController = require('../backend/src/controllers/orderController.js');
const { COUNTERS_TABLE_SQL } = require('../backend/src/services/numberingService.js');

const BIZ = `stocktest-${Date.now().toString(36)}`;
let paperId; let productId; let seq = 0;

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const req = (body, params = {}, role = 'owner', query = {}) => ({ user: { id: 'u', name: 'Tester', role, businessId: BIZ, isActive: true }, headers: {}, query, params, body });
const call = async (fn, r) => { const res = mockRes(); await fn(r, res, (err) => { throw err; }); return res; };
const create = (quantity, extra = {}) => call(orderController.create, req({
  localId: `ord-${BIZ}-${++seq}`, customerId: 'c1', status: 'New',
  items: [{ id: `item-${seq}`, productId, productName: 'Visiting Card', quantity, rate: 2, lineTotal: quantity * 2 }], totalAmount: quantity * 2, ...extra,
}));
const update = (id, body) => call(orderController.update, req(body, { id }));
const paperQty = async () => Number((await pool.query('SELECT quantity FROM stock_items WHERE id = $1', [paperId])).rows[0].quantity);
const txns = async (orderId) => (await pool.query('SELECT transaction_type, quantity::float AS quantity FROM stock_transactions WHERE business_id = $1 AND order_id = $2 ORDER BY created_at, transaction_type', [BIZ, String(orderId)])).rows;
const row = async (id) => (await pool.query('SELECT * FROM orders WHERE id = $1', [id])).rows[0];

before(async () => {
  if (skip) return;
  await pool.query(COUNTERS_TABLE_SQL);
  await pool.query('INSERT INTO settings (key, business_id) VALUES ($1, $1) ON CONFLICT (key) DO NOTHING', [BIZ]);
  paperId = (await pool.query("INSERT INTO stock_items (local_id, name, quantity, unit, business_id) VALUES ($1, 'Art Paper', 500, 'sheets', $2) RETURNING id", [`stk-${BIZ}`, BIZ])).rows[0].id;
  productId = (await pool.query(
    `INSERT INTO products (local_id, name, default_price, unit, stock_materials_enabled, deduct_auto_stock_at, materials, business_id)
     VALUES ($1, 'Visiting Card', 2, 'pcs', true, 'Finishing', $2, $3) RETURNING id`,
    [`prod-${BIZ}`, JSON.stringify([{ inventoryItemId: String(paperId), inventoryItemName: 'Art Paper', quantityPerUnit: 0.1, unit: 'sheets', trackingMode: 'AUTO', variant: 'ALL' }]), BIZ]
  )).rows[0].id;
  productId = String(productId);
});
after(async () => {
  if (!skip) {
    for (const t of ['stock_transactions', 'work_notifications', 'orders', 'products', 'stock_items', 'number_counters']) {
      await pool.query(`DELETE FROM ${t} WHERE business_id = $1`, [BIZ]).catch(() => {});
    }
    await pool.query('DELETE FROM settings WHERE key = $1', [BIZ]);
  }
  await pool.end();
});

test('creating an order reserves its stock in the same save (quantity unchanged until consumed)', { skip }, async () => {
  const r = await create(500);
  assert.equal(r.statusCode, 201);
  assert.equal(r.body.stockChanged, true);
  assert.equal(r.body.stockAllocations.length, 1);
  assert.equal(r.body.stockAllocations[0].reservedQuantity, 50);
  assert.deepEqual(await txns(r.body._id), [{ transaction_type: 'RESERVE', quantity: 50 }]);
  assert.equal(await paperQty(), 500);
});

test('reaching the deduct stage consumes the stock; extra quantity later is consumed too', { skip }, async () => {
  const start = await paperQty();
  const r = await create(300);
  await update(r.body._id, { status: 'Finishing' });
  assert.equal(await paperQty(), start - 30);
  const more = await update(r.body._id, { items: [{ ...r.body.items[0], quantity: 400 }] });
  assert.equal(more.statusCode, 200);
  assert.equal(await paperQty(), start - 40);
  assert.deepEqual((await txns(r.body._id)).map((t) => `${t.transaction_type} ${t.quantity}`).sort(), ['CONSUME 10', 'CONSUME 30', 'RESERVE 30']);
});

test('a save that fails part-way changes nothing (power-cut safety)', { skip }, async () => {
  const r = await create(200);
  await update(r.body._id, { status: 'Finishing' });
  const qtyBefore = await paperQty();
  const txBefore = await txns(r.body._id);
  const orderBefore = await row(r.body._id);
  // More quantity (would consume extra stock) together with a status the database rejects:
  await assert.rejects(update(r.body._id, { items: [{ ...r.body.items[0], quantity: 900 }], status: 'Not A Status' }));
  assert.equal(await paperQty(), qtyBefore, 'stock quantity unchanged');
  assert.deepEqual(await txns(r.body._id), txBefore, 'no stock movements recorded');
  const orderAfter = await row(r.body._id);
  assert.deepEqual(orderAfter.items, orderBefore.items);
  assert.deepEqual(orderAfter.stock_allocations, orderBefore.stock_allocations);
});

test('cancelling before consumption releases the reservation and leaves the quantity alone', { skip }, async () => {
  const start = await paperQty();
  const r = await create(100);
  const c = await update(r.body._id, { status: 'Cancelled', cancelReason: 'test' });
  assert.equal(c.statusCode, 200);
  assert.equal(await paperQty(), start);
  assert.deepEqual((await txns(r.body._id)).map((t) => t.transaction_type).sort(), ['RELEASE', 'RESERVE']);
});

test('two devices consuming the same stock at once both count', { skip }, async () => {
  const start = await paperQty();
  const [a, b] = await Promise.all([create(100), create(150)]);
  await Promise.all([update(a.body._id, { status: 'Finishing' }), update(b.body._id, { status: 'Finishing' })]);
  assert.equal(await paperQty(), start - 25);
});

test('a purchase saved on another device is not overwritten by an order save', { skip }, async () => {
  const r = await create(100);
  await pool.query('UPDATE stock_items SET quantity = quantity + 100 WHERE id = $1', [paperId]); // purchase elsewhere
  const afterPurchase = await paperQty();
  await update(r.body._id, { status: 'Finishing' });
  assert.equal(await paperQty(), afterPurchase - 10);
});

test('the browser cannot set stock allocations', { skip }, async () => {
  const r = await create(50);
  const res = await update(r.body._id, { notes: 'x', stockChanged: true, stockAllocations: [{ inventoryItemId: String(paperId), reservedQuantity: 99999, trackingMode: 'AUTO' }] });
  assert.equal(res.statusCode, 200, 'echoing the reply-only stockChanged flag back is harmless');
  assert.equal(res.body.stockAllocations[0].reservedQuantity, 5);
});

test('saving an order loaded from a list keeps its items, files and history', { skip }, async () => {
  const r = await create(80);
  await pool.query('UPDATE orders SET media = $1 WHERE id = $2', [JSON.stringify([{ id: 'm1', name: 'design.pdf', url: 'https://example.test/d.pdf' }]), r.body._id]);
  const before = await row(r.body._id);
  const list = await call(orderController.list, req({}, {}, 'owner', { fields: 'list', limit: '100' }));
  const slim = list.body.orders.find((o) => String(o._id || o.id) === String(r.body._id));
  assert.equal(slim.items[0].id, before.items[0].id, 'list items keep their id');
  assert.equal(slim.items[0].productId, productId, 'list items keep their product link');
  assert.equal(slim.items[0].rate, 2, 'list items keep their rate');
  // What the browser sends for a list-only order: media placeholders, no history.
  const payload = { ...slim, status: 'In Design', media: [{}] };
  delete payload.history; delete payload.itemSummary; delete payload.mediaCount;
  const res = await update(r.body._id, payload);
  assert.equal(res.statusCode, 200);
  const after = await row(r.body._id);
  assert.deepEqual(after.items, before.items);
  assert.deepEqual(after.media, before.media);
  assert.equal(after.history.length, (before.history || []).length + 1);
  assert.equal(after.history[after.history.length - 1].status, 'In Design');
  // A new file added to a list-only order is kept alongside the existing one.
  await update(r.body._id, { media: [{}, { id: 'm2', name: 'ready.pdf', url: 'https://example.test/r.pdf' }] });
  assert.deepEqual((await row(r.body._id)).media.map((m) => m.id), ['m1', 'm2']);
});

test('the browser no longer calculates or sends stock for order saves', () => {
  const app = fs.readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');
  assert.equal(app.includes('_reconcileOrderStock'), false);
  assert.match(app, /this\._orderCache = items\.map\(raw => \(\{ \.\.\.this\.normalizeOrder\(raw\), _listOnly: true \}\)\);/);
  assert.match(app, /if \(order\._listOnly\) delete payload\.history;/);
  assert.match(app, /delete payload\.stockAllocations;/);
  assert.match(app, /if \(saved\.stockChanged\) this\._refreshStockFromServer\(\);/);
});
