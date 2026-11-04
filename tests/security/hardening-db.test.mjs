import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// Sign-in, one-time codes, stock restore and file delete against real PostgreSQL. Only runs on the
// isolated test database (SECTEST_DATABASE_URL); creates its own rows and removes them afterwards.
const testDbUrl = process.env.SECTEST_DATABASE_URL;
const usingTestDb = Boolean(testDbUrl) && process.env.DATABASE_URL === testDbUrl && new URL(testDbUrl).pathname.endsWith('_sectest');
const skip = usingTestDb ? false : 'requires the isolated test database (SECTEST_DATABASE_URL)';

// Stub email before the controllers capture it, and record every log line.
const sentCodes = [];
const emailService = require('../../backend/src/services/emailService.js');
emailService.sendPasswordResetOtp = async (to, otp) => { sentCodes.push(otp); return { stubbed: true }; };
emailService.sendRegistrationOtp = async (to, otp) => { sentCodes.push(otp); return { stubbed: true }; };
const logger = require('../../backend/src/utils/logger.js');
const logLines = [];
for (const level of ['info', 'warn', 'error', 'debug']) {
  const original = logger[level];
  logger[level] = (...args) => { logLines.push(args.map(String).join(' ')); return original && original.apply(logger, args); };
}

const { pool } = require('../../backend/src/config/db.js');
const authController = require('../../backend/src/controllers/authController.js');
const orderController = require('../../backend/src/controllers/orderController.js');
const uploadController = require('../../backend/src/controllers/uploadController.js');
const { hashPassword, verifyPassword } = require('../../backend/src/utils/authHelper.js');
const { clearAllLockouts } = require('../../backend/src/services/securityPolicyService.js');

const TAG = Date.now().toString(36);
const BIZ = `sechard-${TAG}`;
const OTHER_BIZ = `sechard-other-${TAG}`;
const email = (name) => `${name}-${TAG}@example.test`;
const clientIds = [];

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const call = async (fn, body, extra = {}) => {
  const res = mockRes();
  await fn({ headers: {}, query: {}, params: {}, ip: '127.0.0.1', body, ...extra }, res, (err) => { if (err) throw err; });
  return res;
};
const addClient = async (name, fields = {}) => {
  const row = (await pool.query(
    `INSERT INTO saas_clients (name, email, status, password_hash, business_id, reset_token, reset_token_exp, verification_otp, verification_exp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [name, email(name), fields.status || 'active', fields.passwordHash ?? null, BIZ, fields.resetToken ?? null,
      fields.resetToken ? new Date(Date.now() + 600000) : null, fields.verificationOtp ?? null,
      fields.verificationOtp ? new Date(Date.now() + 600000) : null]
  )).rows[0];
  clientIds.push(row.id);
  return row.id;
};
const clientRow = async (id) => (await pool.query('SELECT * FROM saas_clients WHERE id = $1', [id])).rows[0];

before(async () => {
  if (skip) return;
  await pool.query("INSERT INTO settings (key, business_id) VALUES ($1, $1) ON CONFLICT (key) DO NOTHING", [BIZ]);
});
after(async () => {
  if (!skip) {
    await pool.query('DELETE FROM saas_audit_logs WHERE target_id = ANY($1::text[]) OR performed_by LIKE $2', [clientIds.map(String), `%${TAG}%`]).catch(() => {});
    await pool.query('DELETE FROM saas_clients WHERE id = ANY($1::uuid[])', [clientIds]);
    for (const t of ['stock_transactions', 'orders', 'stock_items', 'team_members']) {
      await pool.query(`DELETE FROM ${t} WHERE business_id = ANY($1::text[])`, [[BIZ, OTHER_BIZ]]);
    }
    await pool.query('DELETE FROM settings WHERE key = $1', [BIZ]);
  }
  await pool.end();
});

test('owner sign-in: password always required; an account with no password must use the emailed code', { skip }, async () => {
  clearAllLockouts();
  const noPassword = await addClient('nopw');
  assert.equal((await call(authController.clientLogin, { email: email('nopw') })).statusCode, 400);
  const claim = await call(authController.clientLogin, { email: email('nopw'), password: 'attacker-chosen' });
  assert.equal(claim.statusCode, 403);
  assert.equal(claim.body.code, 'PASSWORD_NOT_SET');
  assert.match(claim.body.error, /Forgot Password/);
  assert.equal(claim.body.token, undefined);
  assert.equal((await clientRow(noPassword)).password_hash, null, 'nobody can claim the account by signing in first');

  await addClient('haspw', { passwordHash: hashPassword('Right-Pass-1') });
  assert.equal((await call(authController.clientLogin, { email: email('haspw'), password: 'wrong' })).statusCode, 401);
  const ok = await call(authController.clientLogin, { email: email('haspw'), password: 'Right-Pass-1' });
  assert.equal(ok.statusCode, 200);
  assert.ok(ok.body.token);
});

test('owner sign-in upgrades an old plaintext password to a hash the first time it is used', { skip }, async () => {
  clearAllLockouts();
  const id = await addClient('plain', { passwordHash: 'Old-Plain-9' });
  assert.equal((await call(authController.clientLogin, { email: email('plain'), password: 'Old-Plain-9' })).statusCode, 200);
  const stored = (await clientRow(id)).password_hash;
  assert.match(stored, /^scrypt:/);
  assert.equal(verifyPassword('Old-Plain-9', stored), true);
});

test('token sync no longer hands out an owner token for just an email', { skip }, async () => {
  clearAllLockouts();
  const id = await addClient('sync', { passwordHash: hashPassword('Sync-Pass-1') });
  assert.equal((await call(authController.clientTokenSync, { email: email('sync') })).statusCode, 400);
  assert.equal((await call(authController.clientTokenSync, { clientId: id })).statusCode, 400);
  const wrong = await call(authController.clientTokenSync, { email: email('sync'), password: 'nope' });
  assert.equal(wrong.statusCode, 401);
  assert.equal(wrong.body.token, undefined);
  const ok = await call(authController.clientTokenSync, { email: email('sync'), password: 'Sync-Pass-1' });
  assert.equal(ok.statusCode, 200);
  assert.ok(ok.body.token);
});

test('password reset code: never logged, and 5 wrong guesses cancel it', { skip }, async () => {
  const id = await addClient('reset', { passwordHash: hashPassword('Before-1') });
  const sent = await call(authController.clientForgotPassword, { email: email('reset') });
  assert.equal(sent.statusCode, 200);
  const code = sentCodes.at(-1);
  assert.match(code, /^\d{6}$/);
  assert.equal(logLines.some((line) => line.includes(code)), false, 'the code is not in the log');
  const wrongCode = code === '000000' ? '111111' : '000000';
  for (let i = 0; i < 4; i++) {
    assert.equal((await call(authController.clientResetPassword, { email: email('reset'), otp: wrongCode, newPassword: 'After-123' })).statusCode, 400);
  }
  const fifth = await call(authController.clientResetPassword, { email: email('reset'), otp: wrongCode, newPassword: 'After-123' });
  assert.equal(fifth.statusCode, 429);
  assert.equal(fifth.body.code, 'OTP_CANCELLED');
  assert.equal((await clientRow(id)).reset_token, null);
  assert.equal((await call(authController.clientResetPassword, { email: email('reset'), otp: code, newPassword: 'After-123' })).statusCode, 400, 'the real code no longer works');
  assert.equal(verifyPassword('Before-1', (await clientRow(id)).password_hash), true, 'password unchanged');

  // A fresh code still works normally.
  await call(authController.clientForgotPassword, { email: email('reset') });
  const ok = await call(authController.clientResetPassword, { email: email('reset'), otp: sentCodes.at(-1), newPassword: 'After-123' });
  assert.equal(ok.statusCode, 200);
  assert.equal(verifyPassword('After-123', (await clientRow(id)).password_hash), true);
});

test('registration code: 5 wrong guesses cancel it', { skip }, async () => {
  const id = await addClient('reg', { status: 'pending', passwordHash: hashPassword('Reg-Pass-1'), verificationOtp: '424242' });
  for (let i = 0; i < 4; i++) assert.equal((await call(authController.clientVerifyRegistration, { email: email('reg'), otp: '000000' })).statusCode, 400);
  assert.equal((await call(authController.clientVerifyRegistration, { email: email('reg'), otp: '000000' })).statusCode, 429);
  assert.equal((await call(authController.clientVerifyRegistration, { email: email('reg'), otp: '424242' })).statusCode, 400);
  assert.equal((await clientRow(id)).status, 'pending');
});

test('restore stock: PIN checked by the server, saved together, never restored twice', { skip }, async () => {
  const stockId = (await pool.query("INSERT INTO stock_items (local_id, name, quantity, unit, business_id) VALUES ($1, 'Art Paper', 100, 'sheets', $2) RETURNING id", [`stk-${TAG}`, BIZ])).rows[0].id;
  await pool.query("INSERT INTO team_members (local_id, name, job_title, role, pin, business_id, is_active, status) VALUES ($1, 'Store Keeper', 'Stock Manager', 'reception', '246810', $2, true, 'active')", [`tm-${TAG}`, BIZ]);
  await pool.query("INSERT INTO team_members (local_id, name, job_title, role, pin, business_id, is_active, status) VALUES ($1, 'Designer', 'Designer', 'designer', '135790', $2, true, 'active')", [`tm2-${TAG}`, BIZ]);
  const allocations = [{ orderItemId: 'i1', inventoryItemId: String(stockId), inventoryItemName: 'Art Paper', unit: 'sheets', trackingMode: 'AUTO', reservedQuantity: 0, consumedQuantity: 30, consumedAt: new Date().toISOString() }];
  const orderId = (await pool.query("INSERT INTO orders (local_id, order_number, customer_id, status, items, stock_allocations, business_id) VALUES ($1, $1, 'c1', 'Cancelled', '[]', $2, $3) RETURNING id", [`ord-${TAG}`, JSON.stringify(allocations), BIZ])).rows[0].id;
  const user = { id: 'u', name: 'Owner', role: 'owner', businessId: BIZ, isActive: true };
  const restore = (pin) => call(orderController.restoreStock, { pin }, { params: { id: orderId }, user });
  const qty = async () => Number((await pool.query('SELECT quantity FROM stock_items WHERE id = $1', [stockId])).rows[0].quantity);
  const moves = async () => (await pool.query("SELECT quantity::float AS q, \"user\" FROM stock_transactions WHERE business_id = $1 AND transaction_type = 'RESTORE'", [BIZ])).rows;

  for (const pin of ['123456', '135790', '']) {
    const res = await restore(pin);
    assert.ok([400, 403].includes(res.statusCode), `PIN "${pin}" refused`);
  }
  assert.equal(await qty(), 100);
  assert.equal((await moves()).length, 0);

  const ok = await restore('246810');
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.body.restored, 30);
  assert.equal(ok.body.authorizedBy, 'Store Keeper');
  assert.equal(await qty(), 130);
  assert.deepEqual(await moves(), [{ q: 30, user: 'Store Keeper' }]);
  assert.ok(ok.body.order.stockAllocations[0].restoredAt);

  const again = await restore('246810');
  assert.equal(again.body.restored, 0);
  assert.equal(await qty(), 130, 'not restored twice');

  const otherShop = await call(orderController.restoreStock, { pin: '246810' }, { params: { id: orderId }, user: { ...user, businessId: OTHER_BIZ } });
  assert.ok([403, 404].includes(otherShop.statusCode), 'another shop cannot restore this order');
});

test('order file delete: only a file attached to an order of the signed-in shop', { skip }, async () => {
  const media = [{ id: 'm1', name: 'a.pdf', cloudinaryPublicId: 'printghar/designs/x/a' }];
  const otherOrder = (await pool.query("INSERT INTO orders (local_id, order_number, customer_id, status, items, media, business_id) VALUES ($1, $1, 'c1', 'New', '[]', $2, $3) RETURNING id", [`oth-${TAG}`, JSON.stringify(media), OTHER_BIZ])).rows[0].id;
  const myOrder = (await pool.query("INSERT INTO orders (local_id, order_number, customer_id, status, items, media, business_id) VALUES ($1, $1, 'c1', 'New', '[]', $2, $3) RETURNING id", [`mine-${TAG}`, JSON.stringify(media), BIZ])).rows[0].id;
  const user = { id: 'u', role: 'owner', businessId: BIZ, isActive: true };
  const del = (body) => call(uploadController.deleteFile, body, { user });
  assert.equal((await del({ publicId: 'printghar/designs/x/a' })).statusCode, 400, 'order and file ids are required');
  assert.equal((await del({ publicId: 'printghar/designs/x/a', orderId: String(otherOrder), mediaId: 'm1' })).statusCode, 404, "another shop's file");
  assert.equal((await del({ publicId: 'printghar/branding/someone_else', orderId: String(myOrder), mediaId: 'm1' })).statusCode, 404, 'file not on this order');
  const ok = await del({ publicId: 'printghar/designs/x/a', orderId: String(myOrder), mediaId: 'm1' });
  assert.equal(ok.statusCode, 200);
  const after = (await pool.query('SELECT media FROM orders WHERE id = $1', [myOrder])).rows[0].media;
  assert.equal(after[0].isDeletedFromCloud, true);
  const untouched = (await pool.query('SELECT media FROM orders WHERE id = $1', [otherOrder])).rows[0].media;
  assert.equal(untouched[0].isDeletedFromCloud, undefined);
});
