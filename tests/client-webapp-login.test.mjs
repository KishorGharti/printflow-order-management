import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const authController = require('../backend/src/controllers/authController.js');
const { authenticateUser } = require('../backend/src/middleware/rbac.js');
const { pool } = require('../backend/src/config/db.js');

// Mock request / response helpers matching repository convention
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

test('CLIENT WEBAPP LOGIN SYSTEM — Restricted to Developer-Registered Gmails', async (t) => {
  t.after(async () => {
    await pool.end();
  });

  // 1. Unregistered Gmail Login Attempt
  await t.test('1. Security Gate: Unregistered Gmail is blocked with 403 Access Denied', async () => {
    const unregisteredEmail = `random_stranger_${Date.now()}@gmail.com`;
    const req = createMockReq({ body: { email: unregisteredEmail } });
    const res = createMockRes();

    await authController.clientLogin(req, res, (err) => {
      if (err) throw err;
    });

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'CLIENT_NOT_REGISTERED');
    assert.match(res.body.error, /not registered by the developer/i);
  });

  // 2. Empty Email Attempt
  await t.test('2. Validation: Empty email is rejected with 400 Bad Request', async () => {
    const req = createMockReq({ body: { email: '   ' } });
    const res = createMockRes();

    await authController.clientLogin(req, res, (err) => {
      if (err) throw err;
    });

    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /registered Gmail address/i);
  });

  // 3. Deactivated Client Login Attempt
  await t.test('3. Security Gate: Deactivated client Gmail is blocked with 403 Account Deactivated', async () => {
    // Find or ensure a deactivated client in DB
    const deactRes = await pool.query(
      "SELECT email FROM saas_clients WHERE status = 'deactivated' LIMIT 1"
    );
    assert.ok(deactRes.rows.length > 0, 'Should have at least one deactivated client for testing');
    const deactivatedEmail = deactRes.rows[0].email;

    const req = createMockReq({ body: { email: deactivatedEmail } });
    const res = createMockRes();

    await authController.clientLogin(req, res, (err) => {
      if (err) throw err;
    });

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'CLIENT_DEACTIVATED');
    assert.match(res.body.error, /account has been deactivated by the developer/i);
  });

  // 4. Developer-Added Active Client Login
  let clientToken = null;
  let activeClient = null;

  await t.test('4. Success: Developer-registered active client Gmail logs in successfully and receives JWT', async () => {
    const activeRes = await pool.query(
      "SELECT id, name, email FROM saas_clients WHERE status = 'active' LIMIT 1"
    );
    assert.ok(activeRes.rows.length > 0, 'Should have at least one active client');
    activeClient = activeRes.rows[0];

    const req = createMockReq({ body: { email: activeClient.email.toUpperCase() } }); // Test case-insensitivity
    const res = createMockRes();

    await authController.clientLogin(req, res, (err) => {
      if (err) throw err;
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.token);
    assert.equal(res.body.client.id, activeClient.id);
    assert.equal(res.body.client.name, activeClient.name);
    assert.equal(res.body.client.email.toLowerCase(), activeClient.email.toLowerCase());
    assert.equal(res.body.user.role, 'owner');

    clientToken = res.body.token;

    // Verify last_login_at timestamp was stamped in DB
    const checkDb = await pool.query('SELECT last_login_at FROM saas_clients WHERE id = $1', [activeClient.id]);
    assert.ok(checkDb.rows[0].last_login_at, 'last_login_at must be populated after login');
  });

  // 5. Token Authorization via authenticateUser middleware
  await t.test('5. RBAC Guard: authenticateUser recognizes client token as active Owner', async () => {
    assert.ok(clientToken, 'Must have received token from login test');

    const req = createMockReq({
      headers: { authorization: `Bearer ${clientToken}` },
    });
    const res = createMockRes();

    let nextCalled = false;
    await authenticateUser(req, res, (err) => {
      if (err) throw err;
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.ok(req.user);
    assert.equal(req.user.isClient, true);
    assert.equal(req.user.email, activeClient.email);
    assert.equal(req.user.role, 'owner');
  });

  // 6. Frontend Assets Verification
  await t.test('6. Frontend: dist/app.js provides clientLogin, getClientProfile, and renderClientLogin', () => {
    const appJs = fs.readFileSync('dist/app.js', 'utf8');

    assert.match(appJs, /clientLogin\s*\(email/);
    assert.match(appJs, /clientForgotPassword\s*\(email\)\s*\{/);
    assert.match(appJs, /clientResetPassword\s*\(email/);
    assert.match(appJs, /clientRegister\s*\(/);
    assert.match(appJs, /clientVerifyRegistration\s*\(email/);
    assert.match(appJs, /getClientProfile\s*\(\)\s*\{/);
    assert.match(appJs, /renderClientLogin\s*=\s*\(\)\s*=>/);
    assert.match(appJs, /if\s*\(!authenticatedClient\)\s*\{\s*return renderClientLogin\(\);/);
    assert.match(appJs, /handleClientSignOut/);
  });
});
