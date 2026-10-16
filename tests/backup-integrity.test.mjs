import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { pool } = require('../backend/src/config/db');
const { sign, verify } = require('../backend/src/controllers/backupController.js');

pool.query = async () => ({ rows: [] });
after(async () => {
  await pool.end();
});

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const reqFor = (user, body) => ({ user, body, headers: { 'user-agent': 'test' }, query: {}, ip: '127.0.0.1' });
const owner = { id: 'u1', name: 'Test Owner', role: 'owner', businessId: 'tenant-backup-a' };
const reception = { id: 'u2', name: 'Recep', role: 'reception', businessId: 'tenant-backup-a' };
const otherOwner = { id: 'u3', name: 'Other', role: 'owner', businessId: 'tenant-backup-b' };

const makePayload = () => ({
  app: 'print-ghar-order-manager-backup',
  version: 2,
  exportedAt: '2026-10-07T00:00:00.000Z',
  data: {
    orders: [{ id: 'o1', total: 1000, advance: 200 }],
    expenses: [{ id: 'e1', amount: 50 }],
  },
});

async function signed(user = owner) {
  const payload = makePayload();
  const res = mockRes();
  await sign(reqFor(user, { payload }), res, (e) => { throw e; });
  assert.equal(res.statusCode, 200);
  payload.integrity = res.body.integrity;
  return payload;
}

async function runVerify(user, payload) {
  const res = mockRes();
  await verify(reqFor(user, { payload }), res, (e) => { throw e; });
  return res;
}

test('1. Untouched signed backup verifies (even after JSON re-formatting / key reordering)', async () => {
  const payload = await signed();
  const reparsed = JSON.parse(JSON.stringify(payload, null, 4));
  const reordered = { integrity: reparsed.integrity, data: { expenses: reparsed.data.expenses, orders: reparsed.data.orders }, exportedAt: reparsed.exportedAt, version: reparsed.version, app: reparsed.app };
  const res = await runVerify(owner, reordered);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.valid, true);
});

test('2. Editing financial data in the file is detected and blocked', async () => {
  const payload = await signed();
  payload.data.orders[0].total = 1;      // tamper amount
  const res = await runVerify(owner, payload);
  assert.equal(res.statusCode, 422);
  assert.equal(res.body.code, 'BACKUP_TAMPERED');

  const p2 = await signed();
  p2.data.expenses.push({ id: 'e2', amount: 999 }); // inject record
  assert.equal((await runVerify(owner, p2)).body.code, 'BACKUP_TAMPERED');

  const p3 = await signed();
  p3.data.orders = []; // delete records
  assert.equal((await runVerify(owner, p3)).body.code, 'BACKUP_TAMPERED');
});

test('3. Unsigned (or signature-stripped) backup is rejected', async () => {
  const payload = makePayload();
  assert.equal((await runVerify(owner, payload)).body.code, 'BACKUP_UNSIGNED');
  const p2 = await signed();
  delete p2.integrity;
  assert.equal((await runVerify(owner, p2)).body.code, 'BACKUP_UNSIGNED');
});

test('4. Forged signature / edited integrity block is rejected', async () => {
  const payload = await signed();
  payload.integrity.signature = 'a'.repeat(64);
  assert.equal((await runVerify(owner, payload)).body.code, 'BACKUP_TAMPERED');
  const p2 = await signed();
  p2.integrity.signature = 'zz-not-hex';
  assert.equal((await runVerify(owner, p2)).body.code, 'BACKUP_TAMPERED');
});

test('5. Backup from business A cannot be restored into business B (even with businessId edited)', async () => {
  const payload = await signed(owner);
  const res = await runVerify(otherOwner, payload);
  assert.equal(res.statusCode, 422);
  assert.equal(res.body.code, 'BACKUP_WRONG_BUSINESS');

  payload.integrity.businessId = 'tenant-backup-b';
  assert.equal((await runVerify(otherOwner, payload)).body.code, 'BACKUP_TAMPERED');
});

test('6. Only the Owner can restore; Reception can download but not restore', async () => {
  const payload = await signed(reception);
  const res = await runVerify(reception, payload);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'RESTORE_OWNER_ONLY');
  assert.equal((await runVerify(owner, payload)).body.valid, true);
});
