import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// Hermetic: pool.query is stubbed, so this test never touches a database.
const { pool } = require('../backend/src/config/db');
const presence = require('../backend/src/services/presenceService.js');
const { authenticateUser } = require('../backend/src/middleware/rbac.js');
const { signToken } = require('../backend/src/utils/authHelper.js');
const developerController = require('../backend/src/controllers/developerController.js');

const OWNER_A = '11111111-1111-4111-8111-111111111111'; // owner active themselves
const OWNER_B = '22222222-2222-4222-8222-222222222222'; // only staff active
const OWNER_C = '33333333-3333-4333-8333-333333333333'; // nobody active
const OWNER_MAIN = '44444444-4444-4444-8444-444444444444'; // owns 'global_settings'
const OWNER_UNLINKED = '55555555-5555-4555-8555-555555555555'; // default 'global_settings', not owner
const STAFF_B = '66666666-6666-4666-8666-666666666666';
const STAFF_MAIN = '77777777-7777-4777-8777-777777777777';

const clientRows = [
  { id: OWNER_A, email: 'a@example.test', business_id: 'presence-biz-a', status: 'active', name: 'A', session_revoked_at: null },
  { id: OWNER_B, email: 'b@example.test', business_id: 'presence-biz-b', status: 'active', name: 'B', session_revoked_at: null },
  { id: OWNER_C, email: 'c@example.test', business_id: 'presence-biz-c', status: 'active', name: 'C', session_revoked_at: null },
  { id: OWNER_MAIN, email: 'main@example.test', business_id: 'global_settings', status: 'active', name: 'Main', session_revoked_at: null },
  { id: OWNER_UNLINKED, email: 'unlinked@example.test', business_id: 'global_settings', status: 'active', name: 'U', session_revoked_at: null },
];
const staffRows = {
  [STAFF_B]: { id: STAFF_B, local_id: 'emp-b', name: 'Staff B', role: 'designer', business_id: 'presence-biz-b', is_active: true, status: 'active', job_title: 'Designer', session_revoked_at: null },
  [STAFF_MAIN]: { id: STAFF_MAIN, local_id: 'emp-m', name: 'Staff M', role: 'reception', business_id: 'global_settings', is_active: true, status: 'active', job_title: 'Reception', session_revoked_at: null },
};

pool.query = async (sql, params = []) => {
  if (sql.includes('FROM saas_clients WHERE id = $1')) return { rows: clientRows.filter(r => r.id === params[0]) };
  if (sql.includes('FROM saas_clients')) return { rows: clientRows };
  if (sql.includes('FROM team_members')) return { rows: staffRows[params[0]] ? [staffRows[params[0]]] : [] };
  if (sql.includes("FROM businesses WHERE business_id = 'global_settings'")) return { rows: [{ email: 'main@example.test' }] };
  return { rows: [] };
};
after(async () => { await pool.end(); });

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

async function authAs(payload) {
  const req = { headers: { authorization: `Bearer ${signToken(payload)}` }, query: {}, body: {}, params: {}, ip: '127.0.0.1' };
  let passed = false;
  await authenticateUser(req, mockRes(), (err) => { if (err) throw err; passed = true; });
  assert.equal(passed, true);
}

test('presence window: online within 5 minutes, offline after', () => {
  const now = Date.now();
  assert.equal(presence.ONLINE_WINDOW_MS, 5 * 60 * 1000);
  assert.equal(presence.isOnline(now - 60 * 1000, now), true);
  assert.equal(presence.isOnline(now - 6 * 60 * 1000, now), false);
  assert.equal(presence.isOnline(null, now), false);
});

test('owner and staff requests mark their shop online; developer endpoint reports counts', async () => {
  await authAs({ id: OWNER_A, role: 'owner', businessId: 'presence-biz-a', isClient: true, clientId: OWNER_A });
  await authAs({ id: STAFF_B, localId: 'emp-b', role: 'designer', businessId: 'presence-biz-b' });
  await authAs({ id: STAFF_MAIN, localId: 'emp-m', role: 'reception', businessId: 'global_settings' });

  const res = mockRes();
  await developerController.getClientPresence({ headers: {}, query: {} }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.total, 5);
  assert.equal(res.body.clients[OWNER_A].isOnline, true, 'owner active');
  assert.equal(res.body.clients[OWNER_B].isOnline, true, 'staff active counts for the shop');
  assert.equal(res.body.clients[OWNER_C].isOnline, false, 'nobody active');
  assert.equal(res.body.clients[OWNER_C].lastSeenAt, null);
  assert.equal(res.body.clients[OWNER_MAIN].isOnline, true, 'staff of the main business count for its owner');
  assert.equal(res.body.clients[OWNER_UNLINKED].isOnline, false, 'unlinked clients do not inherit main-business staff activity');
  assert.equal(res.body.online, 3);
  assert.equal(res.body.offline, 2);
  assert.equal(res.body.onlineWindowMinutes, 5);
});

test('presence route is developer-only and registered before /clients/:id', () => {
  const routes = fs.readFileSync(new URL('../backend/src/routes/developer.js', import.meta.url), 'utf8');
  const guard = routes.indexOf('router.use(requireDeveloperAccess)');
  const presenceRoute = routes.indexOf("router.get('/clients/presence'");
  const byId = routes.indexOf("router.get('/clients/:id'");
  assert.ok(guard > -1 && presenceRoute > guard, 'presence route must sit behind requireDeveloperAccess');
  assert.ok(byId > presenceRoute, '/clients/presence must be registered before /clients/:id');
});

test('developer console Clients tab shows online/offline summary, column, and filters', () => {
  const dev = fs.readFileSync(new URL('../dist/developer.js', import.meta.url), 'utf8');
  assert.match(dev, /fetchApi\('\/api\/developer\/clients\/presence'\)/);
  assert.match(dev, /setInterval\(loadPresence, 30000\)/);
  assert.match(dev, /h\('option', \{ value: 'online' \}, 'Online Now'\)/);
  assert.match(dev, /h\('option', \{ value: 'offline' \}, 'Offline'\)/);
  assert.match(dev, /h\('th', \{ className: 'px-4 py-3' \}, 'Online'\)/);
});
