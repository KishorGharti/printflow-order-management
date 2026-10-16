const http = require('http');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function run() {
  console.log('--- 1. Testing Developer Login & Token retrieval ---');
  const loginRes = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/developer/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'dev@printghar.com', password: 'printghar-dev-2026' });

  let devToken = loginRes.body?.token;
  if (loginRes.body?.requiresMfa) {
    const mfaRes = await request({
      hostname: '127.0.0.1',
      port: 3001,
      path: '/api/developer/auth/verify-mfa',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      sessionId: loginRes.body.sessionId,
      code: loginRes.body.devOtp || '123456'
    });
    devToken = mfaRes.body?.token;
  }

  console.log('Developer Token obtained:', Boolean(devToken));
  if (!devToken) {
    throw new Error('Failed to obtain dev token: ' + JSON.stringify(loginRes.body));
  }

  // Let's test toggling Maintenance Mode ON
  console.log('\n--- 2. Toggling Maintenance Mode ON via /api/developer/system-settings ---');
  const maintMessage = 'Platform is currently undergoing scheduled hardware upgrades. Back soon!';
  const setOnRes = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/developer/system-settings',
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${devToken}`
    }
  }, {
    category: 'maintenanceMode',
    value: {
      enabled: true,
      message: maintMessage
    }
  });
  console.log('Set Maintenance Mode ON response status:', setOnRes.status, setOnRes.body);

  console.log('\n--- 3. Testing Client Interception under Maintenance Mode ---');
  // 3a: SaaS Client Login attempt
  const clientLogin = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/auth/client-login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'client@shop.com', password: 'password123' });
  console.log('Client Login Status (MUST be 503):', clientLogin.status);
  console.log('Client Login Body:', clientLogin.body);
  console.log('Retry-After Header (MUST be 300):', clientLogin.headers['retry-after']);
  if (clientLogin.status !== 503 || clientLogin.body?.code !== 'MAINTENANCE_MODE') {
    throw new Error('Client login was not intercepted with 503 MAINTENANCE_MODE!');
  }

  // 3b: Staff / Employee Login attempt
  const empLogin = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { employeeId: 'PG-EMP-001', password: 'pin' });
  console.log('Employee Login Status (MUST be 503):', empLogin.status);
  console.log('Employee Login Body:', empLogin.body);
  if (empLogin.status !== 503 || empLogin.body?.code !== 'MAINTENANCE_MODE') {
    throw new Error('Employee login was not intercepted with 503 MAINTENANCE_MODE!');
  }

  // 3c: Orders API attempt
  const ordersReq = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/orders',
    method: 'GET'
  });
  console.log('/api/orders Status (MUST be 503):', ordersReq.status);
  console.log('/api/orders Body:', ordersReq.body);
  if (ordersReq.status !== 503 || ordersReq.body?.code !== 'MAINTENANCE_MODE') {
    throw new Error('/api/orders was not intercepted with 503 MAINTENANCE_MODE!');
  }

  // 3d: Customers API attempt
  const customersReq = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/customers',
    method: 'GET'
  });
  console.log('/api/customers Status (MUST be 503):', customersReq.status);
  if (customersReq.status !== 503) {
    throw new Error('/api/customers was not intercepted with 503 MAINTENANCE_MODE!');
  }

  console.log('\n--- 4. Testing Developer Console Bypass under Maintenance Mode ---');
  // Health check must succeed
  const healthReq = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/health',
    method: 'GET'
  });
  console.log('Health Check Status (MUST be 200):', healthReq.status);
  if (healthReq.status !== 200) throw new Error('Health check failed!');

  // Developer Server Status must succeed
  const devStatusReq = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/developer/server-status',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${devToken}` }
  });
  console.log('Developer Server Status (MUST be 200):', devStatusReq.status);
  console.log('Server Status maintenanceMode state:', devStatusReq.body?.maintenanceMode);
  if (devStatusReq.status !== 200) throw new Error('Developer endpoint failed!');

  console.log('\n--- 5. Toggling Maintenance Mode back OFF ---');
  const setOffRes = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/developer/system-settings',
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${devToken}`
    }
  }, {
    category: 'maintenanceMode',
    value: {
      enabled: false,
      message: 'The system is undergoing scheduled maintenance. Please check back shortly.'
    }
  });
  console.log('Set Maintenance Mode OFF response:', setOffRes.status, setOffRes.body);

  console.log('\n--- 6. Verifying Normal Operation Restored Immediately ---');
  // Client login no longer blocked by 503
  const restoredLogin = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/auth/client-login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'client@shop.com', password: 'password123' });
  console.log('Restored Client Login Status (should NOT be 503):', restoredLogin.status);
  console.log('Restored Client Login Body:', restoredLogin.body);
  if (restoredLogin.status === 503) {
    throw new Error('Client login is still stuck on 503 after turning maintenance off!');
  }

  // Developer status reflects enabled: false
  const restoredStatus = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/developer/server-status',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${devToken}` }
  });
  console.log('Final Server Status maintenanceMode state:', restoredStatus.body?.maintenanceMode);
  if (restoredStatus.body?.maintenanceMode?.enabled !== false) {
    throw new Error('Maintenance mode is not disabled in server status!');
  }

  console.log('\n🎉 ALL MAINTENANCE MODE ENFORCEMENT & RESTORATION TESTS PASSED 100%!');
}

run().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
