import assert from 'node:assert/strict';

const BASE_URL = 'http://localhost:3001';

async function runTests() {
  console.log('🧪 Starting End-to-End Verification of Points 3, 5, 7, 8...\n');

  // Authenticate as Developer
  console.log('🔑 Authenticating as Developer...');
  const loginRes = await fetch(`${BASE_URL}/api/developer/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'dev@printghar.com',
      password: 'printghar-dev-2026'
    })
  });
  const loginData = await loginRes.json();
  assert.equal(loginRes.status, 200);
  assert(loginData.token, 'Token must be returned');
  const token = loginData.token;
  console.log(`✅ Developer authenticated: ${loginData.developer.name} (${loginData.developer.email})\n`);

  const devHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 1. Point 5: Safe SQL Query Playground
  console.log('--- 1. Testing Point 5: Safe Database Query Playground ---');
  const savedQueriesRes = await fetch(`${BASE_URL}/api/developer/database/saved-queries`, {
    headers: devHeaders
  });
  const savedQueriesData = await savedQueriesRes.json();
  assert.equal(savedQueriesRes.status, 200);
  assert.equal(savedQueriesData.ok, true);
  assert(savedQueriesData.queries.length >= 5, 'Must have at least 5 preset queries');
  console.log(`✅ Fetched ${savedQueriesData.queries.length} saved queries.`);

  // Safe SELECT query
  const safeQueryRes = await fetch(`${BASE_URL}/api/developer/database/query`, {
    method: 'POST',
    headers: devHeaders,
    body: JSON.stringify({ query: 'SELECT id, name, subscription_plan, subscription_status FROM saas_clients ORDER BY created_at DESC LIMIT 5;' })
  });
  const safeQueryData = await safeQueryRes.json();
  assert.equal(safeQueryRes.status, 200);
  assert.equal(safeQueryData.ok, true);
  assert(Array.isArray(safeQueryData.rows));
  assert(Array.isArray(safeQueryData.columns));
  assert(typeof safeQueryData.durationMs === 'number');
  console.log(`✅ Safe SELECT query returned ${safeQueryData.rowCount} rows in ${safeQueryData.durationMs}ms.`);

  // Blocked unsafe query (DROP / DELETE)
  const blockedQueryRes = await fetch(`${BASE_URL}/api/developer/database/query`, {
    method: 'POST',
    headers: devHeaders,
    body: JSON.stringify({ query: 'DELETE FROM saas_clients WHERE id = 999;' })
  });
  const blockedQueryData = await blockedQueryRes.json();
  assert(blockedQueryRes.status === 400 || blockedQueryRes.status === 403);
  assert(blockedQueryData.error, 'Must return error message');
  console.log(`✅ Unsafe DELETE blocked with: "${blockedQueryData.error}"`);

  // 2. Point 8: Automated Scheduled Database Backups
  console.log('\n--- 2. Testing Point 8: Automated Scheduled Database Backups ---');
  const backupsRes = await fetch(`${BASE_URL}/api/developer/database/automated-backups`, {
    headers: devHeaders
  });
  const backupsData = await backupsRes.json();
  assert.equal(backupsRes.status, 200);
  assert.equal(backupsData.ok, true);
  assert(backupsData.scheduler !== undefined);
  console.log(`✅ Scheduler status: Active=${backupsData.scheduler.active} (retention: ${backupsData.scheduler.retentionLimit} snapshots)`);

  // Trigger snapshot run-now
  const runNowRes = await fetch(`${BASE_URL}/api/developer/database/automated-backups/run-now`, {
    method: 'POST',
    headers: devHeaders
  });
  const runNowData = await runNowRes.json();
  assert.equal(runNowRes.status, 200);
  assert.equal(runNowData.ok, true);
  assert(runNowData.backup && runNowData.backup.filename);
  console.log(`✅ Created automated backup: ${runNowData.backup.filename} (${runNowData.backup.sizeKb} KB)`);

  // 3. Point 7: Real-Time Crash & Error Trace Viewer (Mini-Sentry)
  console.log('\n--- 3. Testing Point 7: Real-Time Crash & Error Trace Viewer ---');
  // Report an error via public reporting route
  const reportRes = await fetch(`${BASE_URL}/api/developer/report-error`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Test crash: Unhandled exception simulated in order processing',
      stack: 'Error: Test crash\n    at simulateCrash (/tests/test.js:42:15)',
      endpoint: '/api/orders/simulate-crash',
      method: 'POST',
      statusCode: 500,
      businessId: 'test-shop',
      userEmail: 'qa@printflow.com'
    })
  });
  const reportData = await reportRes.json();
  assert.equal(reportRes.status, 200);
  assert.equal(reportData.ok, true);
  console.log(`✅ Error reported successfully via Mini-Sentry.`);

  // Fetch error logs
  const errorsRes = await fetch(`${BASE_URL}/api/developer/errors`, {
    headers: devHeaders
  });
  const errorsData = await errorsRes.json();
  assert.equal(errorsRes.status, 200);
  assert.equal(errorsData.ok, true);
  const found = errorsData.errors.find(e => e.message && e.message.includes('Test crash'));
  assert(found !== undefined, 'Reported error must exist in error list');
  console.log(`✅ Found error #${found.id} in list: "${found.message}" (resolved: ${found.resolved})`);

  // Resolve error
  const resolveRes = await fetch(`${BASE_URL}/api/developer/errors/${found.id}/resolve`, {
    method: 'PATCH',
    headers: devHeaders
  });
  const resolveData = await resolveRes.json();
  assert.equal(resolveRes.status, 200);
  assert.equal(resolveData.ok, true);
  console.log(`✅ Resolved error #${found.id}`);

  // Clear resolved errors
  const clearRes = await fetch(`${BASE_URL}/api/developer/errors/resolved`, {
    method: 'DELETE',
    headers: devHeaders
  });
  const clearData = await clearRes.json();
  assert.equal(clearRes.status, 200);
  assert.equal(clearData.ok, true);
  console.log(`✅ Cleared resolved errors: count ${clearData.count}`);

  // 4. Point 3: Subscription & License Expiry Management
  console.log('\n--- 4. Testing Point 3: Subscription & License Expiry Management ---');
  // Get clients
  const clientsRes = await fetch(`${BASE_URL}/api/developer/clients`, {
    headers: devHeaders
  });
  const clientsData = await clientsRes.json();
  assert.equal(clientsRes.status, 200);
  const clientList = clientsData.clients || clientsData;
  const client = clientList[0];
  assert(client !== undefined, 'At least one client must exist');
  console.log(`✅ Client: ${client.name} (Plan: ${client.subscription_plan}, Status: ${client.subscription_status}, Days left: ${client.days_remaining})`);

  // Update subscription via developer endpoint
  const subUpdateRes = await fetch(`${BASE_URL}/api/developer/clients/${client.id}/subscription`, {
    method: 'PATCH',
    headers: devHeaders,
    body: JSON.stringify({
      plan: 'Standard',
      duration: 'yearly',
      status: 'active',
      extendDays: 365
    })
  });
  const subUpdateData = await subUpdateRes.json();
  assert.equal(subUpdateRes.status, 200);
  assert.equal(subUpdateData.ok, true);
  assert.equal(subUpdateData.client.subscription_plan, 'Standard');
  assert.equal(subUpdateData.client.subscription_status, 'active');
  console.log(`✅ Extended client to Standard plan (+365 days): expires at ${subUpdateData.client.subscription_expires_at}`);

  // Test expired lock behavior
  const expireUpdateRes = await fetch(`${BASE_URL}/api/developer/clients/${client.id}/subscription`, {
    method: 'PATCH',
    headers: devHeaders,
    body: JSON.stringify({
      status: 'expired',
      expiresAt: new Date(Date.now() - 86400000).toISOString()
    })
  });
  const expireData = await expireUpdateRes.json();
  assert.equal(expireData.client.subscription_status, 'expired');
  assert.equal(expireData.client.is_expired, true);
  console.log(`✅ Client subscription set to Expired (is_expired: true)`);

  // Restore back to active
  const restoreRes = await fetch(`${BASE_URL}/api/developer/clients/${client.id}/subscription`, {
    method: 'PATCH',
    headers: devHeaders,
    body: JSON.stringify({
      plan: 'Standard',
      duration: 'monthly',
      status: 'active',
      extendDays: 30
    })
  });
  const restoreData = await restoreRes.json();
  assert.equal(restoreData.client.subscription_status, 'active');
  assert.equal(restoreData.client.is_expired, false);
  console.log(`✅ Client restored to Active (30 days remaining).`);

  console.log('\n🎉 ALL VERIFICATION TESTS FOR POINTS 3, 5, 7, 8 PASSED FLAWLESSLY!\n');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
