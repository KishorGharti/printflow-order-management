import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// Runs against a real PostgreSQL database because concurrency cannot be proven with a stub.
// It only runs when the isolated test database is configured (SECTEST_DATABASE_URL), so it can
// never write to a real business database by accident.
const testDbUrl = process.env.SECTEST_DATABASE_URL;
const usingTestDb = Boolean(testDbUrl) && process.env.DATABASE_URL === testDbUrl && new URL(testDbUrl).pathname.endsWith('_sectest');
const skip = usingTestDb ? false : 'requires the isolated test database (SECTEST_DATABASE_URL)';

const { pool } = require('../backend/src/config/db.js');
const orderController = require('../backend/src/controllers/orderController.js');
const { allocateNumber, COUNTERS_TABLE_SQL } = require('../backend/src/services/numberingService.js');

const RUN = `numtest-${Date.now().toString(36)}`;
const BIZ_A = `${RUN}-a`;
const BIZ_B = `${RUN}-b`;
const BIZ_OLD = `${RUN}-old`;
const ALL_BIZ = [BIZ_A, BIZ_B, BIZ_OLD];

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const reqFor = (businessId, body, extra = {}) => ({
  user: { id: 'u-test', name: 'Numbering Test', role: extra.role || 'owner', businessId, isActive: true },
  headers: {}, query: {}, params: extra.params || {}, body,
});
let seq = 0;
const newOrderBody = (overrides = {}) => ({
  localId: `ord-${RUN}-${++seq}`,
  customerId: 'cust-numtest',
  customerName: 'Numbering Test Client',
  items: [{ id: `it-${seq}`, productName: 'Test Card', quantity: 1, rate: 10, lineTotal: 10 }],
  totalAmount: 10,
  status: 'New',
  ...overrides,
});
async function createOrder(businessId, body) {
  const res = mockRes();
  await orderController.create(reqFor(businessId, body), res, (err) => { throw err; });
  return res;
}
async function assignInvoice(businessId, orderIds, role) {
  const res = mockRes();
  await orderController.assignInvoiceNumber(reqFor(businessId, { orderIds }, { role }), res, (err) => { throw err; });
  return res;
}
const digits = (n) => Number(String(n).match(/(\d+)$/)[1]);

before(async () => {
  if (skip) return;
  await pool.query(COUNTERS_TABLE_SQL);
  for (const biz of ALL_BIZ) {
    await pool.query(`INSERT INTO settings (key, business_id) VALUES ($1, $1) ON CONFLICT (key) DO NOTHING`, [biz]);
  }
});

after(async () => {
  if (!skip) {
    // Remove only what this test created.
    await pool.query('DELETE FROM work_notifications WHERE business_id = ANY($1)', [ALL_BIZ]).catch(() => {});
    await pool.query('DELETE FROM orders WHERE business_id = ANY($1)', [ALL_BIZ]);
    await pool.query('DELETE FROM number_counters WHERE business_id = ANY($1)', [ALL_BIZ]);
    await pool.query('DELETE FROM settings WHERE key = ANY($1)', [ALL_BIZ]);
  }
  await pool.end();
});

test('two simultaneous order creations get different, consecutive job numbers', { skip }, async () => {
  const [r1, r2] = await Promise.all([createOrder(BIZ_A, newOrderBody()), createOrder(BIZ_A, newOrderBody())]);
  assert.equal(r1.statusCode, 201);
  assert.equal(r2.statusCode, 201);
  const nums = [r1.body.orderNumber, r2.body.orderNumber].sort();
  assert.deepEqual(nums, ['JOB-1042', 'JOB-1043']);
});

test('ten simultaneous creations from "different devices" never collide', { skip }, async () => {
  const results = await Promise.all(Array.from({ length: 10 }, () => createOrder(BIZ_A, newOrderBody())));
  assert.ok(results.every((r) => r.statusCode === 201));
  const values = results.map((r) => digits(r.body.orderNumber)).sort((a, b) => a - b);
  assert.equal(new Set(values).size, 10);
  assert.deepEqual(values, Array.from({ length: 10 }, (_, i) => 1044 + i));
});

test('the browser cannot choose the job number', { skip }, async () => {
  const r = await createOrder(BIZ_A, newOrderBody({ orderNumber: 'JOB-9999', invoiceNumber: '777' }));
  assert.equal(r.statusCode, 201);
  assert.equal(r.body.orderNumber, 'JOB-1054');
  assert.ok(!r.body.invoiceNumber);
});

test('retry after a timeout returns the same order instead of creating a duplicate', { skip }, async () => {
  const body = newOrderBody();
  const first = await createOrder(BIZ_A, body);
  const retry = await createOrder(BIZ_A, { ...body });
  assert.equal(first.statusCode, 201);
  assert.equal(retry.statusCode, 200);
  assert.equal(retry.body.orderNumber, first.body.orderNumber);
  assert.equal(retry.body._id, first.body._id);

  const racing = newOrderBody();
  const [a, b] = await Promise.all([createOrder(BIZ_A, { ...racing }), createOrder(BIZ_A, { ...racing })]);
  assert.equal(a.body._id, b.body._id);
  assert.deepEqual([a.statusCode, b.statusCode].sort(), [200, 201]);
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM orders WHERE business_id = $1 AND local_id = $2', [BIZ_A, racing.localId]);
  assert.equal(rows[0].n, 1);
});

test('a failed transaction does not use up a number', { skip }, async () => {
  const client = await pool.connect();
  let rolledBack;
  try {
    await client.query('BEGIN');
    rolledBack = (await allocateNumber(client, BIZ_A, 'job')).formatted;
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
  // A create that fails inside the transaction (invalid status breaks a CHECK constraint).
  await assert.rejects(createOrder(BIZ_A, newOrderBody({ status: 'Not A Real Status' })));
  const next = await createOrder(BIZ_A, newOrderBody());
  assert.equal(next.body.orderNumber, rolledBack);
});

test('separate businesses keep separate numbering', { skip }, async () => {
  const [b1, b2] = await Promise.all([createOrder(BIZ_B, newOrderBody()), createOrder(BIZ_B, newOrderBody())]);
  assert.deepEqual([b1.body.orderNumber, b2.body.orderNumber].sort(), ['JOB-1042', 'JOB-1043']);
  const counters = await pool.query("SELECT business_id, last_value FROM number_counters WHERE business_id = ANY($1) AND kind = 'job' ORDER BY business_id", [[BIZ_A, BIZ_B]]);
  assert.equal(Number(counters.rows.find((r) => r.business_id === BIZ_B).last_value), 1043);
  assert.ok(Number(counters.rows.find((r) => r.business_id === BIZ_A).last_value) > 1043);
});

test('existing numbers, prefixes and starting numbers stay compatible', { skip }, async () => {
  // An older order created before server numbering existed.
  await pool.query(
    `INSERT INTO orders (local_id, order_number, customer_id, items, status, business_id, invoice_number)
     VALUES ($1, 'JOB-1061', 'cust-numtest', '[]', 'Ready', $2, '1050')`,
    [`legacy-${RUN}`, BIZ_OLD]
  );
  const continued = await createOrder(BIZ_OLD, newOrderBody());
  assert.equal(continued.body.orderNumber, 'JOB-1062');

  await pool.query("UPDATE settings SET job_prefix = 'PG-' WHERE key = $1", [BIZ_OLD]);
  assert.equal((await createOrder(BIZ_OLD, newOrderBody())).body.orderNumber, 'PG-1063');

  await pool.query('UPDATE settings SET job_start_number = 2000 WHERE key = $1', [BIZ_OLD]);
  assert.equal((await createOrder(BIZ_OLD, newOrderBody())).body.orderNumber, 'PG-2000');

  await pool.query('UPDATE settings SET job_start_number = 5 WHERE key = $1', [BIZ_OLD]);
  assert.equal((await createOrder(BIZ_OLD, newOrderBody())).body.orderNumber, 'PG-2001', 'lowering the start never reuses numbers');

  const legacy = await pool.query("SELECT order_number, invoice_number FROM orders WHERE local_id = $1", [`legacy-${RUN}`]);
  assert.deepEqual(legacy.rows[0], { order_number: 'JOB-1061', invoice_number: '1050' }, 'existing orders are never renumbered');

  const inv = await assignInvoice(BIZ_OLD, [continued.body._id]);
  assert.equal(inv.body.invoiceNumber, '1051', 'invoice numbering continues from existing invoices');
});

test('simultaneous invoice generation never hands out the same number', { skip }, async () => {
  const orders = await Promise.all(Array.from({ length: 6 }, () => createOrder(BIZ_B, newOrderBody())));
  const results = await Promise.all(orders.map((o) => assignInvoice(BIZ_B, [o.body._id])));
  assert.ok(results.every((r) => r.statusCode === 200));
  const numbers = results.map((r) => Number(r.body.invoiceNumber)).sort((a, b) => a - b);
  assert.deepEqual(numbers, [1, 2, 3, 4, 5, 6]);
  const stored = await pool.query('SELECT invoice_number FROM orders WHERE business_id = $1 AND invoice_number <> \'\' ORDER BY invoice_number::int', [BIZ_B]);
  assert.deepEqual(stored.rows.map((r) => Number(r.invoice_number)), [1, 2, 3, 4, 5, 6]);
});

test('billing the same order twice at once returns one invoice number', { skip }, async () => {
  const order = await createOrder(BIZ_B, newOrderBody());
  const [x, y] = await Promise.all([assignInvoice(BIZ_B, [order.body._id]), assignInvoice(BIZ_B, [order.body._id])]);
  assert.equal(x.body.invoiceNumber, y.body.invoiceNumber);
  assert.equal([x.body.reused, y.body.reused].filter(Boolean).length, 1);
  const again = await assignInvoice(BIZ_B, [order.body.localId]);
  assert.equal(again.body.invoiceNumber, x.body.invoiceNumber, 'retry by local id returns the same number');
});

test('a combined bill gives all of its orders one invoice number', { skip }, async () => {
  const group = await Promise.all([createOrder(BIZ_B, newOrderBody()), createOrder(BIZ_B, newOrderBody()), createOrder(BIZ_B, newOrderBody())]);
  const r = await assignInvoice(BIZ_B, group.map((g) => g.body._id));
  assert.equal(r.statusCode, 200);
  const { rows } = await pool.query('SELECT DISTINCT invoice_number FROM orders WHERE id = ANY($1::uuid[])', [group.map((g) => g.body._id)]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].invoice_number, r.body.invoiceNumber);
});

test('invoice numbering cannot reach another business or be used by restricted roles', { skip }, async () => {
  const other = await createOrder(BIZ_A, newOrderBody());
  const cross = await assignInvoice(BIZ_B, [other.body._id]);
  assert.equal(cross.statusCode, 404);
  const { rows } = await pool.query('SELECT invoice_number FROM orders WHERE id = $1', [other.body._id]);
  assert.ok(!rows[0].invoice_number);
  for (const role of ['designer', 'printer_finishing']) {
    assert.equal((await assignInvoice(BIZ_A, [other.body._id], role)).statusCode, 403);
  }
  assert.equal((await assignInvoice(BIZ_A, [])).statusCode, 400);
});

test('an order update cannot change its job or invoice number', { skip }, async () => {
  const created = await createOrder(BIZ_A, newOrderBody());
  await assignInvoice(BIZ_A, [created.body._id]);
  const before = (await pool.query('SELECT order_number, invoice_number FROM orders WHERE id = $1', [created.body._id])).rows[0];
  const res = mockRes();
  await orderController.update(
    reqFor(BIZ_A, { orderNumber: 'JOB-1', invoiceNumber: '999999', notes: 'updated by test' }, { params: { id: created.body._id } }),
    res,
    (err) => { throw err; }
  );
  assert.equal(res.statusCode, 200);
  const afterRow = (await pool.query('SELECT order_number, invoice_number, notes FROM orders WHERE id = $1', [created.body._id])).rows[0];
  assert.equal(afterRow.order_number, before.order_number);
  assert.equal(afterRow.invoice_number, before.invoice_number);
  assert.equal(afterRow.notes, 'updated by test', 'other fields still update');
});
