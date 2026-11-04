import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const authController = require('../backend/src/controllers/authController.js');
const { authenticateUser } = require('../backend/src/middleware/rbac.js');
const { pool } = require('../backend/src/config/db.js');
const { hashPassword } = require('../backend/src/utils/authHelper.js');

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
  // Self-contained fixtures: this test creates and removes its own clients instead of relying on real data.
  const stamp = Date.now();
  const fixturePassword = 'FixturePass123!';
  const activeEmail = `webapp_active_${stamp}@example.com`;
  const deactivatedFixtureEmail = `webapp_deactivated_${stamp}@example.com`;
  const fixtureBusinessId = `webapp-login-test-${stamp}`;
  const fixtureIds = [];
  for (const [email, status] of [[activeEmail, 'active'], [deactivatedFixtureEmail, 'deactivated']]) {
    const { rows } = await pool.query(
      `INSERT INTO saas_clients (name, email, status, password_hash, business_id) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [`Webapp Test ${status}`, email, status, hashPassword(fixturePassword), fixtureBusinessId]
    );
    fixtureIds.push(rows[0].id);
  }

  t.after(async () => {
    await pool.query(`DELETE FROM saas_audit_logs WHERE target_id = ANY($1::text[])`, [fixtureIds]);
    await pool.query(`DELETE FROM saas_clients WHERE id = ANY($1::uuid[])`, [fixtureIds]);
    await pool.end();
  });

  // 1. Unregistered Gmail Login Attempt
  await t.test('1. Security Gate: Unregistered Gmail is blocked with 403 Access Denied', async () => {
    const unregisteredEmail = `random_stranger_${Date.now()}@gmail.com`;
    const req = createMockReq({ body: { email: unregisteredEmail, password: 'any-password' } });
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
    const req = createMockReq({ body: { email: deactivatedFixtureEmail, password: fixturePassword } });
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
    const activeRes = await pool.query('SELECT id, name, email FROM saas_clients WHERE email = $1', [activeEmail]);
    activeClient = activeRes.rows[0];

    const req = createMockReq({ body: { email: activeClient.email.toUpperCase(), password: fixturePassword } }); // Test case-insensitivity
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
    // Login now lives on the dedicated portals; unauthenticated visitors are redirected there.
    assert.match(appJs, /if\s*\(!authenticatedClient\)\s*\{[\s\S]{0,200}?window\.location\.replace\(lastPortal === 'employee' \? '\/employee\/login' : '\/owner\/login'\);\s*return null;/);
    assert.match(appJs, /handleClientSignOut/);
  });
});
