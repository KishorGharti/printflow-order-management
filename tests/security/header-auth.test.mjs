import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// Hermetic: pool.query is stubbed, so this test never touches a database.
const { pool } = require('../../backend/src/config/db');
const { authenticateUser, requirePermission } = require('../../backend/src/middleware/rbac.js');
const { signToken } = require('../../backend/src/utils/authHelper.js');
const { PERMISSIONS } = require('../../backend/src/config/permissions.js');

const OWNER_CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const DESIGNER_ID = '22222222-2222-4222-8222-222222222222';

pool.query = async (sql) => {
  if (sql.includes('FROM saas_clients')) {
    return { rows: [{ id: OWNER_CLIENT_ID, name: 'Owner A', email: 'owner-a@example.test', status: 'active', business_id: 'biz-a', session_revoked_at: null }] };
  }
  if (sql.includes('FROM team_members')) {
    return { rows: [{ id: DESIGNER_ID, local_id: 'emp-d', name: 'Designer A', email: 'designer-a@example.test', role: 'designer', business_id: 'biz-a', is_active: true, status: 'active', job_title: 'Designer', session_revoked_at: null }] };
  }
  return { rows: [] };
};
after(async () => { await pool.end(); });

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

// Runs authenticateUser followed by requirePermission, like the route stack does.
async function runStack(headers, permission) {
  const req = { headers, query: {}, body: {}, params: {}, ip: '127.0.0.1' };
  const res = mockRes();
  let reached = false;
  await authenticateUser(req, res, (err) => { if (err) throw err; });
  if (res.body === null) {
    requirePermission(permission)(req, res, () => { reached = true; });
  }
  return { req, res, reached };
}

test('no token + X-Role/X-Business-Id headers does not grant access', async () => {
  const { req, res, reached } = await runStack({ 'x-role': 'owner', 'x-business-id': 'biz-a' }, PERMISSIONS.CUSTOMERS_VIEW);
  assert.equal(req.user, null);
  assert.equal(reached, false);
  assert.equal(res.statusCode, 403);
});

test('no token + no headers is rejected exactly as before', async () => {
  const { req, res, reached } = await runStack({}, PERMISSIONS.ORDERS_VIEW);
  assert.equal(req.user, null);
  assert.equal(reached, false);
  assert.equal(res.statusCode, 403);
});

test('valid owner (client) token still reaches owner routes in its own business', async () => {
  const token = signToken({ id: OWNER_CLIENT_ID, name: 'Owner A', email: 'owner-a@example.test', role: 'owner', businessId: 'biz-a', isClient: true, clientId: OWNER_CLIENT_ID });
  const { req, reached } = await runStack({ authorization: `Bearer ${token}` }, PERMISSIONS.FINANCE_VIEW);
  assert.equal(reached, true);
  assert.equal(req.user.role, 'owner');
  assert.equal(req.user.businessId, 'biz-a');
});

test('valid designer token keeps its existing permissions', async () => {
  const token = signToken({ id: DESIGNER_ID, localId: 'emp-d', name: 'Designer A', role: 'designer', businessId: 'biz-a' });
  const allowed = await runStack({ authorization: `Bearer ${token}` }, PERMISSIONS.ORDERS_VIEW);
  assert.equal(allowed.reached, true);
  assert.equal(allowed.req.user.role, 'designer');
  const denied = await runStack({ authorization: `Bearer ${token}` }, PERMISSIONS.FINANCE_VIEW);
  assert.equal(denied.reached, false);
  assert.equal(denied.res.statusCode, 403);
});
