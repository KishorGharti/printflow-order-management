import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// Needs a real database. Runs only against the isolated test DB.
const testDbUrl = process.env.SECTEST_DATABASE_URL;
const usingTestDb = Boolean(testDbUrl) && process.env.DATABASE_URL === testDbUrl && new URL(testDbUrl).pathname.endsWith('_sectest');
const skip = usingTestDb ? false : 'requires the isolated test database (SECTEST_DATABASE_URL)';

const { pool } = require('../backend/src/config/db.js');
const orderController = require('../backend/src/controllers/orderController.js');
const { COUNTERS_TABLE_SQL } = require('../backend/src/services/numberingService.js');

const BIZ = `repeat-${Date.now().toString(36)}`;
const OTHER_BIZ = `${BIZ}-other`;
function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const reqFor = (body, params = {}, businessId = BIZ) => ({ user: { id: 'u', role: 'owner', businessId, isActive: true }, headers: {}, query: {}, params, body });
const call = async (fn, req) => { const res = mockRes(); await fn(req, res, (err) => { throw err; }); return res; };
const newOrder = (n, extra = {}, businessId = BIZ) => call(orderController.create, reqFor({
  localId: `ord-${businessId}-${n}`, customerId: 'c1', items: [{ productName: 'Card', quantity: 100, unitPrice: 5, lineTotal: 500 }], totalAmount: 500, status: 'New', ...extra,
}, {}, businessId));

before(async () => {
  if (skip) return;
  await pool.query(`
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS repeat_of_order_id TEXT NOT NULL DEFAULT '';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS repeat_of_order_number TEXT NOT NULL DEFAULT '';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS repeat_design_mode TEXT NOT NULL DEFAULT '';
  `);
  await pool.query(COUNTERS_TABLE_SQL);
  for (const key of [BIZ, OTHER_BIZ]) {
    await pool.query('INSERT INTO settings (key, business_id) VALUES ($1, $1) ON CONFLICT (key) DO NOTHING', [key]);
  }
});
after(async () => {
  if (!skip) {
    for (const key of [BIZ, OTHER_BIZ]) {
      await pool.query('DELETE FROM work_notifications WHERE business_id = $1', [key]).catch(() => {});
      await pool.query('DELETE FROM orders WHERE business_id = $1', [key]);
      await pool.query('DELETE FROM number_counters WHERE business_id = $1', [key]);
      await pool.query('DELETE FROM settings WHERE key = $1', [key]);
    }
  }
  await pool.end();
});

test('a repeat job gets its own job number and links to the old job', { skip }, async () => {
  const old = await newOrder(1);
  assert.equal(old.statusCode, 201);
  // The browser cannot choose the linked job number; the server reads it from the old order.
  const repeat = await newOrder(2, { repeatOfOrderId: old.body._id, repeatOfOrderNumber: 'JOB-FAKE', repeatDesignMode: 'same' });
  assert.equal(repeat.statusCode, 201);
  assert.notEqual(repeat.body.orderNumber, old.body.orderNumber);
  assert.equal(repeat.body.repeatOfOrderId, String(old.body._id));
  assert.equal(repeat.body.repeatOfOrderNumber, old.body.orderNumber);
  assert.equal(repeat.body.repeatDesignMode, 'same');
  assert.match(repeat.body.history[0].note, new RegExp(`Repeat of ${old.body.orderNumber}`));

  const list = await call(orderController.listRepeats, reqFor({}, { id: old.body._id }));
  assert.deepEqual(list.body.repeats.map((r) => r.orderNumber), [repeat.body.orderNumber]);
});

test('a repeat link cannot point at another business or be changed later', { skip }, async () => {
  const foreign = await newOrder(3, {}, OTHER_BIZ);
  const rejected = await newOrder(4, { repeatOfOrderId: foreign.body._id });
  assert.equal(rejected.statusCode, 400);

  const plain = await newOrder(5);
  const old = await newOrder(6);
  await call(orderController.update, reqFor({ ...plain.body, repeatOfOrderId: old.body._id, repeatOfOrderNumber: 'X' }, { id: plain.body._id }));
  const row = (await pool.query('SELECT repeat_of_order_id, repeat_of_order_number FROM orders WHERE id = $1', [plain.body._id])).rows[0];
  assert.equal(row.repeat_of_order_id, '');
  assert.equal(row.repeat_of_order_number, '');
});

test('an unknown design mode is saved as design changes', { skip }, async () => {
  const old = await newOrder(7);
  const repeat = await newOrder(8, { repeatOfOrderId: old.body._id, repeatDesignMode: 'whatever' });
  assert.equal(repeat.body.repeatDesignMode, 'changes');
});

test('the browser repeats only work details and sends the repeat link with the new order', () => {
  const app = fs.readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');
  const repeatHandler = app.slice(app.indexOf('const continueRepeatOrder'), app.indexOf('const handleCancelOrder'));
  assert.ok(repeatHandler.length > 0);
  for (const field of ['paymentHistory', 'invoiceNumber', 'stockAllocations', 'dueDate', 'mistakeCost', 'cancelReason']) {
    assert.ok(!repeatHandler.includes(field), `repeat must not copy ${field}`);
  }
  assert.match(app, /repeatOfOrderId: newOrderRepeatOf\.orderId, repeatDesignMode: newOrderRepeatOf\.designMode/);
  assert.match(app, /\/api\/orders\/\$\{encodeURIComponent\(syncId\)\}\/repeats/);
});
