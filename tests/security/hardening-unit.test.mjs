import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// Hermetic: pool.query is stubbed and email is stubbed, so this file never touches a database or sends mail.
process.env.DEVELOPER_EMAIL = 'dev-test@example.test';
process.env.DEVELOPER_PASSWORD = 'test-only-developer-password';
const mailed = [];
const emailService = require('../../backend/src/services/emailService.js');
emailService.sendDeveloperMfaCode = async (to, otp) => { mailed.push({ to, otp }); return { stubbed: true }; };

const { pool } = require('../../backend/src/config/db');
const RECEPTION_ID = '33333333-3333-4333-8333-333333333333';
const DESIGNER_ID = '44444444-4444-4444-8444-444444444444';
pool.query = async (sql, params = []) => {
  if (sql.includes('FROM team_members') && params[0] === DESIGNER_ID) {
    return { rows: [{ id: DESIGNER_ID, local_id: 'emp-d', name: 'Designer A', email: 'designer-a@example.test', role: 'designer', business_id: 'biz-a', is_active: true, status: 'active', job_title: 'Designer', session_revoked_at: null }] };
  }
  if (sql.includes('FROM team_members')) {
    return { rows: [{ id: RECEPTION_ID, local_id: 'emp-r', name: 'Reception A', email: 'reception-a@example.test', role: 'reception', business_id: 'biz-a', is_active: true, status: 'active', job_title: 'Reception', session_revoked_at: null }] };
  }
  return { rows: [] };
};
after(async () => { await pool.end(); });

const express = require('../../backend/node_modules/express');
const { authenticateUser } = require('../../backend/src/middleware/rbac.js');
const { signToken, verifyPassword, safeEqual, generateOtp, isLegacyPlaintext } = require('../../backend/src/utils/authHelper.js');
const { buildInsertParts, buildSetClause } = require('../../backend/src/config/dbHelpers.js');
const policy = require('../../backend/src/services/securityPolicyService.js');
const developerController = require('../../backend/src/controllers/developerController.js');

function mockRes() {
  const res = { statusCode: 200, body: null, headers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  return res;
}
const devLogin = async (body) => {
  const res = mockRes();
  await developerController.developerLogin({ headers: {}, body, query: {}, params: {}, socket: { remoteAddress: '127.0.0.1' } }, res);
  return res;
};

test('reception cannot switch itself to owner with X-Role, but can still switch down', async () => {
  const token = signToken({ id: RECEPTION_ID, role: 'reception', businessId: 'biz-a' });
  for (const [asked, expected] of [['owner', 'reception'], ['super_admin', 'reception'], ['designer', 'designer'], [undefined, 'reception']]) {
    const req = { headers: { authorization: `Bearer ${token}`, ...(asked ? { 'x-role': asked } : {}) }, query: {}, body: {}, params: {} };
    await authenticateUser(req, mockRes(), (err) => { if (err) throw err; });
    assert.equal(req.user.role, expected, `X-Role ${asked}`);
  }
});

test('request field names cannot inject SQL, and updates cannot move a record to another shop', () => {
  for (const key of ['name); DROP TABLE orders;--', 'a b', 'x"y', "o'k", 'col = 1, business_id']) {
    assert.throws(() => buildInsertParts({ [key]: 1 }), (err) => err.statusCode === 400, key);
    assert.throws(() => buildSetClause({ [key]: 1 }), (err) => err.statusCode === 400, key);
  }
  assert.deepEqual(buildSetClause({ businessId: 'other-shop', business_id: 'other-shop', name: 'Card' }).setClause, 'name = $1');
  assert.deepEqual(buildInsertParts({ businessId: 'my-shop', name: 'Card' }).cols, ['business_id', 'name']);
  assert.equal(buildSetClause({ user: 'u', timestamp: 't' }).setClause, '"user" = $1, "timestamp" = $2');
});

test('client IP: a typed X-Forwarded-For is ignored unless it comes from the local front server', () => {
  const direct = { headers: { 'x-forwarded-for': '6.6.6.6' }, socket: { remoteAddress: '203.0.113.7' } };
  assert.equal(policy.getClientIp(direct), '203.0.113.7');
  const viaFrontServer = { headers: { 'x-forwarded-for': '6.6.6.6, 198.51.100.4' }, socket: { remoteAddress: '::ffff:127.0.0.1' } };
  assert.equal(policy.getClientIp(viaFrontServer), '198.51.100.4');
});

test('sign-in endpoints are rate limited per IP, including developer sign-in', async () => {
  for (const path of ['/api/auth/client-login', '/api/developer/auth/login']) {
    const ip = `198.51.100.${path.length}`;
    let blocked = 0;
    for (let i = 0; i < 31; i++) {
      const res = mockRes();
      await policy.dynamicRateLimiter({ method: 'POST', path, headers: {}, socket: { remoteAddress: ip } }, res, () => {});
      if (res.statusCode === 429) blocked++;
    }
    assert.equal(blocked, 1, path);
  }
});

test('developer MFA code: random, never returned, emailed only, and 5 wrong tries cancel it', async () => {
  policy.updatePolicyCache({ enforce_mfa_developer: true });
  const res = await devLogin({ email: 'dev-test@example.test', password: 'test-only-developer-password' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.requiresMfa, true);
  assert.equal('devOtp' in res.body, false);
  assert.equal(JSON.stringify(res.body).includes(mailed.at(-1).otp), false);
  assert.equal(mailed.at(-1).to, 'dev-test@example.test');
  assert.match(res.body.sessionId, /^mfa_[0-9a-f]{32}$/);
  const { sessionId } = res.body;
  for (let i = 0; i < 4; i++) assert.equal(policy.verifyMfaSession(sessionId, '000000').valid, false);
  assert.match(policy.verifyMfaSession(sessionId, '000000').error, /Too many wrong codes/);
  assert.equal(policy.verifyMfaSession(sessionId, mailed.at(-1).otp).valid, false, 'cancelled session cannot be used');
  policy.updatePolicyCache({ enforce_mfa_developer: false });
});

test('developer sign-in accepts only the .env account; old built-in passwords no longer work', async () => {
  policy.clearAllLockouts();
  const ok = await devLogin({ email: 'DEV-TEST@example.test', password: 'test-only-developer-password' });
  assert.equal(ok.statusCode, 200);
  assert.ok(ok.body.token);
  for (const [email, password] of [['dev@printghar.com', 'admin123'], ['dev@printghar.com', 'printghar-dev-2026'], ['any@printghar.com', 'printghar-secret-2026'], ['dev-test@example.test', 'wrong']]) {
    policy.clearAllLockouts();
    assert.equal((await devLogin({ email, password })).statusCode, 401, `${email} / ${password}`);
  }
  const saved = process.env.DEVELOPER_PASSWORD;
  delete process.env.DEVELOPER_PASSWORD;
  const notSetUp = await devLogin({ email: 'dev-test@example.test', password: 'anything' });
  process.env.DEVELOPER_PASSWORD = saved;
  assert.equal(notSetUp.statusCode, 503);
  assert.equal(notSetUp.body.code, 'DEVELOPER_LOGIN_NOT_CONFIGURED');
});

test('helpers: random codes, constant-time compare, plaintext detection', () => {
  const codes = new Set(Array.from({ length: 50 }, generateOtp));
  assert.ok([...codes].every((c) => /^\d{6}$/.test(c)));
  assert.ok(codes.size > 40);
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(isLegacyPlaintext('hunter22'), true);
  assert.equal(isLegacyPlaintext('scrypt:aa:bb'), false);
  assert.equal(isLegacyPlaintext('$2b$10$abc'), false);
  assert.equal(verifyPassword('', 'x'), false);
});

test('upload, WhatsApp send and support routes need a signed-in user', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/upload', require('../../backend/src/routes/upload.js'));
  app.use('/api/whatsapp', require('../../backend/src/routes/whatsapp.js'));
  app.use('/api/support', require('../../backend/src/routes/support.js'));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const calls = [
      ['POST', '/api/upload/design'], ['POST', '/api/upload/logo'], ['POST', '/api/upload/company-design'],
      ['POST', '/api/upload/company-design/delete'], ['DELETE', '/api/upload/company-design'], ['DELETE', '/api/upload/file'],
      ['POST', '/api/upload/ledger-monthly'], ['POST', '/api/upload/trigger-monthly-archive'], ['GET', '/api/upload/monthly-reports'],
      ['GET', '/api/upload/annual-backups'], ['GET', '/api/upload/annual-backup/2025/download'], ['POST', '/api/upload/annual-backup/2025/purge-cloud'],
      ['POST', '/api/whatsapp/send'], ['POST', '/api/support/tickets'], ['GET', '/api/support/my-tickets'],
    ];
    for (const [method, path] of calls) {
      const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-Role': 'owner', 'X-Business-Id': 'biz-a' }, body: method === 'GET' ? undefined : JSON.stringify({ publicId: 'x', subject: 's', message: 'm', to: '9779800000000' }) });
      assert.ok([401, 403].includes(res.status), `${method} ${path} -> ${res.status}`);
    }
    // A signed-in designer cannot reach shop settings files (logo, backups).
    const designer = signToken({ id: DESIGNER_ID, role: 'designer', businessId: 'biz-a' });
    const backups = await fetch(`${base}/api/upload/annual-backups`, { headers: { Authorization: `Bearer ${designer}` } });
    assert.equal(backups.status, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('frontend server and browser code no longer carry the old shortcuts', async () => {
  const fs = require('fs');
  const dev = fs.readFileSync(new URL('../../dist/developer.js', import.meta.url), 'utf8');
  assert.equal(dev.includes('devOtp'), false);
  const backendSrc = ['controllers/developerController.js', 'utils/authHelper.js']
    .map((f) => fs.readFileSync(new URL(`../../backend/src/${f}`, import.meta.url), 'utf8')).join('\n');
  assert.equal(backendSrc.includes("'admin123'"), false);
  assert.equal(backendSrc.includes("'printghar-dev-2026'"), false);
  assert.equal(/API_SECRET_KEY \|\| 'printghar-secret-2026'/.test(backendSrc), false);
  const app = fs.readFileSync(new URL('../../dist/app.js', import.meta.url), 'utf8');
  assert.match(app, /\/restore-stock`/);
  assert.equal(/String\(entry\.pin \|\| ''\) === String\(pin\)/.test(app), false, 'PIN is checked by the server, not the browser');
});
