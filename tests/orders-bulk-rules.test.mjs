import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// Real PostgreSQL is needed (locking, unique constraints). Runs only against the isolated test DB.
const testDbUrl = process.env.SECTEST_DATABASE_URL;
const usingTestDb = Boolean(testDbUrl) && process.env.DATABASE_URL === testDbUrl && new URL(testDbUrl).pathname.endsWith('_sectest');
const skip = usingTestDb ? false : 'requires the isolated test database (SECTEST_DATABASE_URL)';

const { pool } = require('../backend/src/config/db.js');
const orderController = require('../backend/src/controllers/orderController.js');
const { COUNTERS_TABLE_SQL } = require('../backend/src/services/numberingService.js');

const RUN = `bulktest-${Date.now().toString(36)}`;
const BIZ = `${RUN}-a`;
const OTHER = `${RUN}-b`;

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const reqFor = (businessId, body, role = 'owner') => ({ user: { id: 'u', role, businessId, isActive: true }, headers: {}, query: {}, params: {}, body });
const call = async (fn, req) => { const res = mockRes(); await fn(req, res, (err) => { throw err; }); return res; };
let n = 0;
const order = (extra = {}) => ({ localId: `ord-${RUN}-${++n}`, customerId: 'c1', items: [{ productName: 'Card', quantity: 1, rate: 10, lineTotal: 10 }], totalAmount: 10, status: 'New', ...extra });
const create = (biz, body) => call(orderController.create, reqFor(biz, body));
const bulk = (biz, orders, role) => call(orderController.bulkUpsert, reqFor(biz, { orders }, role));
const row = async (where, params) => (await pool.query(`SELECT * FROM orders WHERE ${where}`, params)).rows[0];

before(async () => {
  if (skip) return;
  await pool.query(COUNTERS_TABLE_SQL);
  for (const b of [BIZ, OTHER]) await pool.query('INSERT INTO settings (key, business_id) VALUES ($1, $1) ON CONFLICT (key) DO NOTHING', [b]);
});
after(async () => {
  if (!skip) {
    await pool.query('DELETE FROM work_notifications WHERE business_id = ANY($1)', [[BIZ, OTHER]]).catch(() => {});
    await pool.query('DELETE FROM orders WHERE business_id = ANY($1)', [[BIZ, OTHER]]);
    await pool.query('DELETE FROM number_counters WHERE business_id = ANY($1)', [[BIZ, OTHER]]);
    await pool.query('DELETE FROM settings WHERE key = ANY($1)', [[BIZ, OTHER]]);
  }
  await pool.end();
});

test('restoring an existing order updates it but never changes its job or invoice number', { skip }, async () => {
  const created = await create(BIZ, order());
  await call(orderController.assignInvoiceNumber, reqFor(BIZ, { orderIds: [created.body._id] }));
  const before = await row('id = $1', [created.body._id]);
  const res = await bulk(BIZ, [{ ...created.body, orderNumber: 'JOB-9', invoiceNumber: '999', notes: 'restored note' }]);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.updated, 1);
  const after = await row('id = $1', [created.body._id]);
  assert.equal(after.order_number, before.order_number);
  assert.equal(after.invoice_number, before.invoice_number);
  assert.equal(after.notes, 'restored note');
});

test('a stale job number can never overwrite a different order', { skip }, async () => {
  const victim = await create(BIZ, order({ notes: 'victim' }));
  const res = await bulk(BIZ, [order({ orderNumber: victim.body.orderNumber, notes: 'stale device copy' })]);
  assert.equal(res.body.inserted, 1);
  assert.equal(res.body.renumbered, 1);
  const untouched = await row('id = $1', [victim.body._id]);
  assert.equal(untouched.notes, 'victim');
  const copy = await row("business_id = $1 AND notes = 'stale device copy'", [BIZ]);
  assert.notEqual(copy.order_number, victim.body.orderNumber, 'the incoming order got a new server number instead');
});

test('an old order keeps its original number when it is still free, and numbering continues after it', { skip }, async () => {
  const res = await bulk(BIZ, [order({ orderNumber: 'JOB-5000', invoiceNumber: '700' })]);
  assert.equal(res.body.inserted, 1);
  assert.equal(res.body.renumbered, 0);
  assert.ok(await row("business_id = $1 AND order_number = 'JOB-5000' AND invoice_number = '700'", [BIZ]));
  assert.equal((await create(BIZ, order())).body.orderNumber, 'JOB-5001');
});

test('orders without a number get one from the server', { skip }, async () => {
  const res = await bulk(BIZ, [order()]);
  assert.equal(res.body.inserted, 1);
  const latest = (await pool.query("SELECT order_number FROM orders WHERE business_id = $1 ORDER BY created_at DESC LIMIT 1", [BIZ])).rows[0];
  assert.match(latest.order_number, /^JOB-\d+$/);
});

test('an invoice number already used by an unrelated order is not copied; a shared one inside the payload is', { skip }, async () => {
  const billed = await create(BIZ, order());
  const inv = (await call(orderController.assignInvoiceNumber, reqFor(BIZ, { orderIds: [billed.body._id] }))).body.invoiceNumber;
  const clash = await bulk(BIZ, [order({ invoiceNumber: inv, notes: 'clashing invoice' })]);
  assert.equal(clash.body.invoiceNumbersCleared, 1);
  assert.ok(!(await row("business_id = $1 AND notes = 'clashing invoice'", [BIZ])).invoice_number);

  const shared = await bulk(BIZ, [order({ invoiceNumber: '8800', notes: 'group-1' }), order({ invoiceNumber: '8800', notes: 'group-2' })]);
  assert.equal(shared.body.invoiceNumbersCleared, 0);
  const { rows } = await pool.query("SELECT count(*)::int AS c FROM orders WHERE business_id = $1 AND invoice_number = '8800'", [BIZ]);
  assert.equal(rows[0].c, 2);
});

test('bulk cannot touch another business', { skip }, async () => {
  const theirs = await create(OTHER, order({ notes: 'other business' }));
  const res = await bulk(BIZ, [{ ...theirs.body, notes: 'cross-business attempt', business_id: OTHER }]);
  assert.equal(res.statusCode, 200);
  const stillTheirs = await row('id = $1', [theirs.body._id]);
  assert.equal(stillTheirs.business_id, OTHER);
  assert.equal(stillTheirs.notes, 'other business');
  const mine = await row("business_id = $1 AND notes = 'cross-business attempt'", [BIZ]);
  assert.ok(mine, 'the payload became an order in the caller\'s own business');
  assert.notEqual(mine.id, theirs.body._id);
});

test('bulk inserts and normal order creation running at once never collide', { skip }, async () => {
  const results = await Promise.all([
    bulk(BIZ, [order(), order(), order()]),
    create(BIZ, order()), create(BIZ, order()), create(BIZ, order()),
  ]);
  assert.ok(results.every((r) => r.statusCode === 200 || r.statusCode === 201));
  const dup = await pool.query('SELECT order_number FROM orders WHERE business_id = $1 GROUP BY 1 HAVING count(*) > 1', [BIZ]);
  assert.equal(dup.rows.length, 0);
});

test('a repeated bulk payload does not create duplicates', { skip }, async () => {
  const payload = [order({ notes: 'repeat-me' })];
  await bulk(BIZ, payload);
  const again = await bulk(BIZ, payload);
  assert.equal(again.body.inserted, 0);
  assert.equal(again.body.updated, 1);
  const { rows } = await pool.query("SELECT count(*)::int AS c FROM orders WHERE business_id = $1 AND notes = 'repeat-me'", [BIZ]);
  assert.equal(rows[0].c, 1);
});

test('restricted roles cannot use bulk', { skip }, async () => {
  for (const role of ['designer', 'printer_finishing']) assert.equal((await bulk(BIZ, [order()], role)).statusCode, 403);
});
