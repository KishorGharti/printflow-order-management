import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const authController = require('../backend/src/controllers/authController.js');
const { pool } = require('../backend/src/config/db.js');
const { verifyPassword } = require('../backend/src/utils/authHelper.js');

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
  };
  return res;
}

test('CLIENT AUTH SYSTEM: Forgot Password, OTP Verification, and New User Registration with Hash in PostgreSQL', async (t) => {
  const testEmail = `test_client_${Date.now()}@example.com`;
  const initialPassword = 'InitialSecurePass123!';
  const updatedPassword = 'NewSecretPassword456!';

  t.after(async () => {
    // Clean up test client
    await pool.query('DELETE FROM saas_clients WHERE email = $1', [testEmail.toLowerCase()]);
    await pool.end();
  });

  // 1. New Client Registration
  await t.test('1. Registration creates pending client with hashed password and verification OTP', async () => {
    const req = createMockReq({
      body: {
        name: 'Algora Tester',
        companyName: 'Algora Print Works',
        email: testEmail,
        phone: '9841234567',
        password: initialPassword,
      },
    });
    const res = createMockRes();

    await authController.clientRegister(req, res, (err) => {
      if (err) throw err;
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.match(res.body.message, /verification code/i);

    // Verify record in PostgreSQL database
    const dbRes = await pool.query(
      'SELECT id, name, email, company_name, password_hash, status, verification_otp, verification_exp FROM saas_clients WHERE email = $1',
      [testEmail.toLowerCase()]
    );
    assert.equal(dbRes.rows.length, 1);
    const client = dbRes.rows[0];
    assert.equal(client.status, 'pending');
    assert.ok(client.verification_otp, 'Must store 6-digit OTP');
    assert.equal(client.verification_otp.length, 6);
    assert.ok(client.password_hash.startsWith('scrypt:'), 'Password must be hashed with scrypt in PostgreSQL');
    assert.equal(verifyPassword(initialPassword, client.password_hash), true);
    assert.equal(verifyPassword('WrongPass', client.password_hash), false);
  });

  // 2. Pending account cannot log in before verification
  await t.test('2. Pending account is blocked from login before OTP verification', async () => {
    const req = createMockReq({
      body: {
        email: testEmail,
        password: initialPassword,
      },
    });
    const res = createMockRes();

    await authController.clientLogin(req, res, (err) => {
      if (err) throw err;
    });

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'CLIENT_PENDING');
  });

  // 3. Verify Registration OTP
  let verifiedClientId = null;
  await t.test('3. Verifying registration OTP activates client account and returns JWT token', async () => {
    const dbRes = await pool.query(
      'SELECT id, verification_otp FROM saas_clients WHERE email = $1',
      [testEmail.toLowerCase()]
    );
    const otp = dbRes.rows[0].verification_otp;
    verifiedClientId = dbRes.rows[0].id;

    const req = createMockReq({
      body: {
        email: testEmail,
        otp: otp,
      },
    });
    const res = createMockRes();

    await authController.clientVerifyRegistration(req, res, (err) => {
      if (err) throw err;
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.token, 'Must return JWT token upon verification');
    assert.equal(res.body.client.status, 'active');

    // Confirm DB status updated to active
    const checkDb = await pool.query(
      'SELECT status, verification_otp FROM saas_clients WHERE id = $1',
      [verifiedClientId]
    );
    assert.equal(checkDb.rows[0].status, 'active');
    assert.equal(checkDb.rows[0].verification_otp, null);
  });

  // 4. Client Login with password
  await t.test('4. Active client logs in with correct password, rejects invalid password', async () => {
    // Bad password
    const badReq = createMockReq({
      body: {
        email: testEmail,
        password: 'WrongPassword!',
      },
    });
    const badRes = createMockRes();

    await authController.clientLogin(badReq, badRes, (err) => {
      if (err) throw err;
    });

    assert.equal(badRes.statusCode, 401);
    assert.equal(badRes.body.code, 'INVALID_CREDENTIALS');

    // Correct password
    const goodReq = createMockReq({
      body: {
        email: testEmail,
        password: initialPassword,
      },
    });
    const goodRes = createMockRes();

    await authController.clientLogin(goodReq, goodRes, (err) => {
      if (err) throw err;
    });

    assert.equal(goodRes.statusCode, 200);
    assert.equal(goodRes.body.success, true);
    assert.ok(goodRes.body.token);
  });

  // 5. Forgot Password Request
  await t.test('5. Forgot password generates 6-digit reset token and sets expiration in PostgreSQL', async () => {
    const req = createMockReq({
      body: {
        email: testEmail,
      },
    });
    const res = createMockRes();

    await authController.clientForgotPassword(req, res, (err) => {
      if (err) throw err;
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);

    const checkDb = await pool.query(
      'SELECT reset_token, reset_token_exp FROM saas_clients WHERE id = $1',
      [verifiedClientId]
    );
    assert.ok(checkDb.rows[0].reset_token, 'Must store reset token');
    assert.equal(checkDb.rows[0].reset_token.length, 6);
    assert.ok(new Date(checkDb.rows[0].reset_token_exp) > new Date(), 'Expiry must be in the future');
  });

  // 6. Reset Password with OTP
  await t.test('6. Reset password verifies OTP, hashes new password with scrypt in PostgreSQL, and clears token', async () => {
    const checkDb = await pool.query(
      'SELECT reset_token FROM saas_clients WHERE id = $1',
      [verifiedClientId]
    );
    const otp = checkDb.rows[0].reset_token;

    const req = createMockReq({
      body: {
        email: testEmail,
        otp: otp,
        newPassword: updatedPassword,
      },
    });
    const res = createMockRes();

    await authController.clientResetPassword(req, res, (err) => {
      if (err) throw err;
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);

    // Verify new password in PostgreSQL
    const afterDb = await pool.query(
      'SELECT password_hash, reset_token FROM saas_clients WHERE id = $1',
      [verifiedClientId]
    );
    assert.equal(afterDb.rows[0].reset_token, null, 'Reset token must be cleared');
    assert.ok(afterDb.rows[0].password_hash.startsWith('scrypt:'), 'New password must be hashed with scrypt');
    assert.equal(verifyPassword(updatedPassword, afterDb.rows[0].password_hash), true);
    assert.equal(verifyPassword(initialPassword, afterDb.rows[0].password_hash), false);

    // Test login with updated password
    const loginReq = createMockReq({
      body: {
        email: testEmail,
        password: updatedPassword,
      },
    });
    const loginRes = createMockRes();

    await authController.clientLogin(loginReq, loginRes, (err) => {
      if (err) throw err;
    });

    assert.equal(loginRes.statusCode, 200);
    assert.equal(loginRes.body.success, true);
  });
});
