import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// Developer sign-in comes only from DEVELOPER_EMAIL / DEVELOPER_PASSWORD; use test-only values here.
process.env.DEVELOPER_EMAIL = 'dev@printghar.com';
process.env.DEVELOPER_PASSWORD = 'test-only-developer-password';
const developerController = require('../backend/src/controllers/developerController.js');
const { requireDeveloperAccess } = require('../backend/src/middleware/rbac.js');
const { ROLES, ROLE_PERMISSIONS } = require('../backend/src/config/permissions.js');
const { pool } = require('../backend/src/config/db.js');

// Mock request / response helpers matching repository testing convention
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

test('DEVELOPER ADMIN PANEL (STREAMLINED) — Security, RBAC & Functionality Test Suite', async (t) => {
  t.after(async () => {
    await pool.end();
  });

  let createdClientId = null;

  // 1. Static Assets & Frontend Routing Verification
  await t.test('1. Frontend & Routing: developer.html and dist/developer.js exist and are registered in server.js', () => {
    assert.ok(fs.existsSync('developer.html'), 'developer.html must exist in project root');
    assert.ok(fs.existsSync('dist/developer.js'), 'dist/developer.js must exist in dist directory');

    const serverJs = fs.readFileSync('server.js', 'utf8');
    assert.match(serverJs, /['"]\/developer\.html['"]/);
    assert.match(serverJs, /['"]\/dist\/developer\.js['"]/);
    assert.match(serverJs, /reqUrl === '\/developer'/);

    const devHtml = fs.readFileSync('developer.html', 'utf8');
    assert.match(devHtml, /PrintFlow \| Developer Admin Console/);
    assert.match(devHtml, /dist\/developer\.js/);
    assert.match(devHtml, /developer-root/);
    assert.match(devHtml, /html,\s*body,\s*#developer-root/);

    const devJs = fs.readFileSync('dist/developer.js', 'utf8');
    assert.match(devJs, /h-screen\s+max-h-screen\s+w-full.*overflow-hidden/);
    assert.match(devJs, /md:h-screen\s+md:max-h-screen\s+bg-slate-900/);
    assert.match(devJs, /md:sticky\s+md:top-0\s+md:left-0/);
    assert.match(devJs, /min-h-0\s+p-3\s+space-y-1\s+overflow-y-auto/);
    assert.match(devJs, /flex-1\s+flex\s+flex-col\s+min-w-0\s+h-full\s+md:h-screen\s+overflow-y-auto/);
  });

  // 2. Strict Security Boundary: Client accounts must NOT access developer endpoints
  await t.test('2. Security Guard: Standard client accounts receive 403 Forbidden via requireDeveloperAccess', () => {
    // Unauthenticated
    const reqUnauth = createMockReq();
    const resUnauth = createMockRes();
    requireDeveloperAccess(reqUnauth, resUnauth, () => assert.fail('Should not call next for unauthenticated'));
    assert.equal(resUnauth.statusCode, 403);
    assert.match(resUnauth.body.error, /requires authentication/i);

    // Client Owner role
    const reqOwner = createMockReq({
      user: { id: 'u-owner', role: ROLES.OWNER, isActive: true },
    });
    const resOwner = createMockRes();
    requireDeveloperAccess(reqOwner, resOwner, () => assert.fail('Should not call next for client owner'));
    assert.equal(resOwner.statusCode, 403);
    assert.match(resOwner.body.error, /strictly restricted to SUPER_ADMIN \/ DEVELOPER/i);

    // Client Designer role
    const reqDesigner = createMockReq({
      user: { id: 'u-designer', role: ROLES.DESIGNER, isActive: true },
    });
    const resDesigner = createMockRes();
    requireDeveloperAccess(reqDesigner, resDesigner, () => assert.fail('Should not call next for client designer'));
    assert.equal(resDesigner.statusCode, 403);
    assert.match(resDesigner.body.error, /strictly restricted to SUPER_ADMIN \/ DEVELOPER/i);

    // Super Admin / Developer Role (Passes)
    const reqDev = createMockReq({
      user: { id: 'u-dev', role: ROLES.DEVELOPER, isActive: true },
    });
    const resDev = createMockRes();
    let nextCalled = false;
    requireDeveloperAccess(reqDev, resDev, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true, 'Developer should pass access guard');
  });

  // 3. Developer Authentication
  await t.test('3. Developer Auth: Developer login with credentials succeeds and returns JWT', async () => {
    const req = createMockReq({
      body: {
        email: 'dev@printghar.com',
        password: process.env.DEVELOPER_PASSWORD,
      },
    });
    const res = createMockRes();
    await developerController.developerLogin(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.ok(res.body.token);
    assert.equal(res.body.developer.email, 'dev@printghar.com');
  });

  await t.test('4. Developer Auth: Developer login with invalid credentials returns 401 Unauthorized', async () => {
    const req = createMockReq({
      body: {
        email: 'intruder@evil.com',
        password: 'wrongpassword',
      },
    });
    const res = createMockRes();
    await developerController.developerLogin(req, res);

    assert.equal(res.statusCode, 401);
    assert.match(res.body.error, /Invalid developer credentials/i);
  });

  // 4. Developer Profile
  await t.test('5. Developer Profile: Authenticated developer profile returned', async () => {
    const req = createMockReq({
      user: {
        id: 'dev-master',
        name: 'Lead Developer',
        email: 'dev@printghar.com',
        role: ROLES.DEVELOPER,
        permissions: ROLE_PERMISSIONS[ROLES.DEVELOPER],
      },
    });
    const res = createMockRes();
    await developerController.getDeveloperProfile(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.developer.isDeveloper, true);
  });

  // 5. Developer Dashboard Stats (Streamlined)
  await t.test('6. Developer Dashboard: Returns client counts, support counts, and recent activity', async () => {
    const req = createMockReq({
      user: { id: 'dev-master', name: 'Developer', role: ROLES.DEVELOPER },
    });
    const res = createMockRes();
    await developerController.getStats(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.ok(res.body.stats);
    assert.ok(res.body.stats.clients);
    assert.ok(res.body.stats.support);
    assert.ok(Array.isArray(res.body.stats.recentClients));
    assert.ok(Array.isArray(res.body.stats.recentActivity));
  });

  // 6. Clients Management
  await t.test('7. Clients: Developer can create, list, view, update, suspend, and reset client', async () => {
    const testEmail = `client_${Date.now()}@testclient.com`;
    // Create client
    const reqCreate = createMockReq({
      user: { id: 'dev-master', name: 'Developer', role: ROLES.DEVELOPER },
      body: {
        name: 'Bikram Thapa',
        email: testEmail,
        phone: '9851000000',
        notes: 'Priority direct client',
      },
    });
    const resCreate = createMockRes();
    await developerController.createClient(reqCreate, resCreate);

    assert.equal(resCreate.statusCode, 201);
    assert.equal(resCreate.body.ok, true);
    assert.equal(resCreate.body.client.name, 'Bikram Thapa');
    createdClientId = resCreate.body.client.id;

    // List clients
    const reqList = createMockReq({
      user: { id: 'dev-master', name: 'Developer', role: ROLES.DEVELOPER },
    });
    const resList = createMockRes();
    await developerController.getClients(reqList, resList);

    assert.equal(resList.statusCode, 200);
    assert.ok(resList.body.clients.some((c) => c.id === createdClientId));

    // View client details
    const reqDetails = createMockReq({
      user: { id: 'dev-master', name: 'Developer', role: ROLES.DEVELOPER },
      params: { id: createdClientId },
    });
    const resDetails = createMockRes();
    await developerController.getClientById(reqDetails, resDetails);

    assert.equal(resDetails.statusCode, 200);
    assert.equal(resDetails.body.client.email, testEmail);

    // Update client details
    const reqUpdate = createMockReq({
      user: { id: 'dev-master', name: 'Developer', role: ROLES.DEVELOPER },
      params: { id: createdClientId },
      body: { phone: '9851999999', notes: 'Updated notes' },
    });
    const resUpdate = createMockRes();
    await developerController.updateClient(reqUpdate, resUpdate);

    assert.equal(resUpdate.statusCode, 200);
    assert.equal(resUpdate.body.client.phone, '9851999999');

    // Toggle client status (deactivate)
    const reqDeactivate = createMockReq({
      user: { id: 'dev-master', name: 'Developer', role: ROLES.DEVELOPER },
      params: { id: createdClientId },
      body: { status: 'deactivated' },
    });
    const resDeactivate = createMockRes();
    await developerController.toggleClientStatus(reqDeactivate, resDeactivate);

    assert.equal(resDeactivate.statusCode, 200);
    assert.equal(resDeactivate.body.client.status, 'deactivated');

    // Toggle client status back to active
    const reqActivate = createMockReq({
      user: { id: 'dev-master', name: 'Developer', role: ROLES.DEVELOPER },
      params: { id: createdClientId },
      body: { status: 'active' },
    });
    const resActivate = createMockRes();
    await developerController.toggleClientStatus(reqActivate, resActivate);

    assert.equal(resActivate.statusCode, 200);
    assert.equal(resActivate.body.client.status, 'active');
  });

  // 7. Audit Logs
  await t.test('8. Audit Logs: Developer operations generate traceable audit records', async () => {
    const reqLogs = createMockReq({
      user: { id: 'dev-master', name: 'Developer', role: ROLES.DEVELOPER },
    });
    const resLogs = createMockRes();
    await developerController.getAuditLogs(reqLogs, resLogs);

    assert.equal(resLogs.statusCode, 200);
    assert.ok(resLogs.body.logs.length > 0);
    assert.ok(resLogs.body.logs.some((l) => l.action.includes('Client')));
  });

  // 8. Support Tickets
  await t.test('9. Support: Developer can list and manage client support tickets', async () => {
    const reqTickets = createMockReq({
      user: { id: 'dev-master', name: 'Developer', role: ROLES.DEVELOPER },
    });
    const resTickets = createMockRes();
    await developerController.getSupportTickets(reqTickets, resTickets);

    assert.equal(resTickets.statusCode, 200);
    assert.ok(Array.isArray(resTickets.body.tickets));

    if (resTickets.body.tickets.length > 0) {
      const ticket = resTickets.body.tickets[0];
      const reqUpdate = createMockReq({
        user: { id: 'dev-master', name: 'Developer', role: ROLES.DEVELOPER },
        params: { id: ticket.id },
        body: {
          status: 'resolved',
          developer_reply: 'Issue resolved by developer.',
        },
      });
      const resUpdate = createMockRes();
      await developerController.updateSupportTicket(reqUpdate, resUpdate);

      assert.equal(resUpdate.statusCode, 200);
      assert.equal(resUpdate.body.ticket.status, 'resolved');
    }
  });

  // 9. System Settings
  await t.test('10. Settings: Developer can retrieve and update platform settings', async () => {
    const reqGet = createMockReq({
      user: { id: 'dev-master', name: 'Developer', role: ROLES.DEVELOPER },
    });
    const resGet = createMockRes();
    await developerController.getSettings(reqGet, resGet);

    assert.equal(resGet.statusCode, 200);
    assert.ok(resGet.body.settings);

    const reqUpdate = createMockReq({
      user: { id: 'dev-master', name: 'Developer', role: ROLES.DEVELOPER },
      body: {
        key: 'platform_info',
        value: {
          name: 'PrintFlow SaaS Developer Console',
          version: '2.4.0',
          support_email: 'dev@printghar.com',
          maintenance_mode: false,
        },
      },
    });
    const resUpdate = createMockRes();
    await developerController.updateSettings(reqUpdate, resUpdate);

    assert.equal(resUpdate.statusCode, 200);
    assert.match(resUpdate.body.message, /updated successfully/i);
  });

  // Cleanup created test client
  if (createdClientId) {
    const reqDel = createMockReq({
      user: { id: 'dev-master', name: 'Developer', role: ROLES.DEVELOPER },
      params: { id: createdClientId },
    });
    const resDel = createMockRes();
    await developerController.deleteClient(reqDel, resDel);
  }
});
