'use strict';

const API_BASE = 'http://localhost:3001';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  return { status: res.status, headers: res.headers, data: json || text };
}

async function runTests() {
  console.log('🧪 Starting Security Policy & Protection Rules Verification Test Suite\n');
  let developerToken = '';

  // 0. Initial Developer Login to obtain token
  console.log('--- Step 0: Obtain Developer Admin Token ---');
  const initLogin = await request('/api/developer/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'dev@printghar.com', password: 'printghar-dev-2026' }),
  });
  if (initLogin.status === 200 && initLogin.data.requiresMfa) {
    const mfaVerify = await request('/api/developer/auth/verify-mfa', {
      method: 'POST',
      body: JSON.stringify({ sessionId: initLogin.data.sessionId, code: initLogin.data.devOtp }),
    });
    developerToken = mfaVerify.data.token;
    console.log('✅ Initial Developer Login Success (via MFA)');
  } else if (initLogin.status === 200 && initLogin.data.token) {
    developerToken = initLogin.data.token;
    console.log('✅ Initial Developer Login Success');
  } else {
    console.error('❌ Failed initial dev login:', initLogin);
    process.exit(1);
  }

  // ─── Test 1: Max Failed Logins Before Lockout ───
  console.log('\n--- Test 1: Max Failed Logins Before Lockout ---');
  // Configure policy: max_failed_logins = 4
  const setPolicy1 = await request('/api/developer/security/settings', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${developerToken}` },
    body: JSON.stringify({
      session_timeout_minutes: 120,
      max_failed_logins: 4,
      rate_limit_per_minute: 500,
      enforce_mfa_developer: false,
      ip_whitelist_enabled: false,
      allowed_ips: ['127.0.0.1', '::1'],
    }),
  });
  console.log('Policy configured with max_failed_logins = 4. Status:', setPolicy1.status);

  const testUser = 'lockout_test_user_' + Date.now();
  // Attempt 1, 2, 3: Should fail with 401 or 404/403 (Invalid credentials)
  for (let i = 1; i <= 3; i++) {
    const attempt = await request('/api/developer/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: `${testUser}@printghar.com`, password: 'wrongpassword' }),
    });
    console.log(`  Attempt ${i}: Status = ${attempt.status} (expected 401)`);
    if (attempt.status !== 401) throw new Error(`Expected 401 on attempt ${i}`);
  }

  // Attempt 4: Should trigger lockout and return 429 ACCOUNT_LOCKED
  const attempt4 = await request('/api/developer/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: `${testUser}@printghar.com`, password: 'wrongpassword' }),
  });
  console.log(`  Attempt 4: Status = ${attempt4.status}, Code = ${attempt4.data?.code}`);
  if (attempt4.status === 429 && attempt4.data?.code === 'ACCOUNT_LOCKED') {
    console.log('  ✅ Lockout triggered on attempt 4 with HTTP 429 ACCOUNT_LOCKED');
  } else {
    console.error('  ❌ Failed to lockout on attempt 4:', attempt4);
    process.exit(1);
  }

  // Subsequent attempt while locked
  const attempt5 = await request('/api/developer/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: `${testUser}@printghar.com`, password: 'wrongpassword' }),
  });
  console.log(`  Attempt 5 (during lockout): Status = ${attempt5.status}, Code = ${attempt5.data?.code}`);
  if (attempt5.status === 429) {
    console.log('  ✅ Locked account continues to be rejected with HTTP 429');
  } else {
    console.error('  ❌ Expected 429 while locked, got:', attempt5.status);
    process.exit(1);
  }

  // ─── Test 2: Session Timeout Inactivity Window ───
  console.log('\n--- Test 2: Session Timeout Inactivity Window ---');
  // Configure policy: session_timeout_minutes = 60
  await request('/api/developer/security/settings', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${developerToken}` },
    body: JSON.stringify({
      session_timeout_minutes: 60,
      max_failed_logins: 5,
      rate_limit_per_minute: 500,
      enforce_mfa_developer: false,
      ip_whitelist_enabled: false,
      allowed_ips: ['127.0.0.1', '::1'],
    }),
  });

  // Verify fresh token works
  const freshCheck = await request('/api/developer/security/overview', {
    headers: { Authorization: `Bearer ${developerToken}` },
  });
  console.log('  Fresh token request status:', freshCheck.status);
  if (freshCheck.status === 200) {
    console.log('  ✅ Fresh active token is authorized');
  } else {
    console.error('  ❌ Fresh token failed:', freshCheck);
    process.exit(1);
  }

  // Generate an expired token using authHelper with iat in the past (125 mins ago)
  const { signToken } = require('./src/utils/authHelper');
  const expiredToken = signToken({
    id: 'test-expired-user',
    name: 'Expired Tester',
    email: 'expired@test.local',
    role: 'super_admin',
    isDeveloper: true,
    iat: Math.floor(Date.now() / 1000) - (125 * 60), // 125 minutes ago
  });
  
  const timeoutCheck = await request('/api/developer/security/overview', {
    headers: { Authorization: `Bearer ${expiredToken}` },
  });
  console.log(`  Expired token request: Status = ${timeoutCheck.status}, Code = ${timeoutCheck.data?.code}`);
  if (timeoutCheck.status === 401 && timeoutCheck.data?.code === 'SESSION_TIMEOUT') {
    console.log('  ✅ Expired session token rejected with HTTP 401 SESSION_TIMEOUT');
  } else {
    console.error('  ❌ Expected 401 SESSION_TIMEOUT, got:', timeoutCheck);
    process.exit(1);
  }

  // ─── Test 3: IP Whitelist Restriction ───
  console.log('\n--- Test 3: IP Whitelist Restriction ---');
  // Enable IP whitelist restriction and allow only office IP 198.51.100.5
  await request('/api/developer/security/settings', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${developerToken}` },
    body: JSON.stringify({
      session_timeout_minutes: 120,
      max_failed_logins: 5,
      rate_limit_per_minute: 500,
      enforce_mfa_developer: false,
      ip_whitelist_enabled: true,
      allowed_ips: ['198.51.100.5'],
    }),
  });

  // Test request from non-whitelisted IP (203.0.113.88)
  const nonWhitelistedRes = await request('/api/developer/server-status', {
    headers: {
      Authorization: `Bearer ${developerToken}`,
      'X-Forwarded-For': '203.0.113.88',
    },
  });
  console.log(`  Non-whitelisted IP request: Status = ${nonWhitelistedRes.status}, Code = ${nonWhitelistedRes.data?.code}`);
  if (nonWhitelistedRes.status === 403 && nonWhitelistedRes.data?.code === 'IP_NOT_WHITELISTED') {
    console.log('  ✅ Non-whitelisted IP blocked with HTTP 403 IP_NOT_WHITELISTED');
  } else {
    console.error('  ❌ Expected 403 IP_NOT_WHITELISTED, got:', nonWhitelistedRes);
    process.exit(1);
  }

  // Test request from whitelisted IP (198.51.100.5)
  const whitelistedRes = await request('/api/developer/server-status', {
    headers: {
      Authorization: `Bearer ${developerToken}`,
      'X-Forwarded-For': '198.51.100.5',
    },
  });
  console.log(`  Whitelisted IP request: Status = ${whitelistedRes.status}`);
  if (whitelistedRes.status === 200) {
    console.log('  ✅ Whitelisted IP successfully granted access');
  } else {
    console.error('  ❌ Expected 200 for whitelisted IP, got:', whitelistedRes);
    process.exit(1);
  }

  // Reset IP whitelist
  await request('/api/developer/security/settings', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${developerToken}` },
    body: JSON.stringify({
      session_timeout_minutes: 120,
      max_failed_logins: 5,
      rate_limit_per_minute: 500,
      enforce_mfa_developer: false,
      ip_whitelist_enabled: false,
      allowed_ips: ['127.0.0.1', '::1', 'localhost'],
    }),
  });

  // ─── Test 4: Dynamic API Rate Limiting ───
  console.log('\n--- Test 4: Dynamic API Rate Limiting ---');
  // Configure rate limit to 4 req/min for testing
  await request('/api/developer/security/settings', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${developerToken}` },
    body: JSON.stringify({
      session_timeout_minutes: 120,
      max_failed_logins: 5,
      rate_limit_per_minute: 4,
      enforce_mfa_developer: false,
      ip_whitelist_enabled: false,
      allowed_ips: ['127.0.0.1', '::1'],
    }),
  });

  const rateTestIp = '10.200.1.55';
  let blockedAt = 0;
  for (let reqNum = 1; reqNum <= 6; reqNum++) {
    const res = await request('/api/pricing', {
      headers: { 'X-Forwarded-For': rateTestIp },
    });
    console.log(`  Request ${reqNum} from test IP: Status = ${res.status}`);
    if (res.status === 429 && res.data?.code === 'RATE_LIMIT_EXCEEDED') {
      blockedAt = reqNum;
      console.log(`  ✅ Request ${reqNum} throttled with HTTP 429 RATE_LIMIT_EXCEEDED`);
      break;
    }
  }

  if (blockedAt > 0) {
    console.log(`  ✅ Dynamic rate limiter successfully throttled requests beyond limit`);
  } else {
    console.error('  ❌ Rate limiter did not throttle requests');
    process.exit(1);
  }

  // Restore rate limit back to 500
  await request('/api/developer/security/settings', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${developerToken}` },
    body: JSON.stringify({
      session_timeout_minutes: 120,
      max_failed_logins: 5,
      rate_limit_per_minute: 500,
      enforce_mfa_developer: false,
      ip_whitelist_enabled: false,
      allowed_ips: ['127.0.0.1', '::1'],
    }),
  });

  // ─── Test 5: Enforce Developer MFA ───
  console.log('\n--- Test 5: Enforce Developer MFA ---');
  // Enable Developer MFA in security policy
  await request('/api/developer/security/settings', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${developerToken}` },
    body: JSON.stringify({
      session_timeout_minutes: 120,
      max_failed_logins: 5,
      rate_limit_per_minute: 500,
      enforce_mfa_developer: true,
      ip_whitelist_enabled: false,
      allowed_ips: ['127.0.0.1', '::1'],
    }),
  });

  // Attempt login with valid email/password
  const mfaLogin = await request('/api/developer/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'dev@printghar.com', password: 'printghar-dev-2026' }),
  });
  console.log(`  Login with MFA active: Status = ${mfaLogin.status}, requiresMfa = ${mfaLogin.data?.requiresMfa}`);
  if (mfaLogin.status === 200 && mfaLogin.data?.requiresMfa === true && mfaLogin.data?.sessionId) {
    console.log('  ✅ Step 1: Login returned requiresMfa: true with active sessionId');
  } else {
    console.error('  ❌ Expected requiresMfa: true, got:', mfaLogin);
    process.exit(1);
  }

  const { sessionId, devOtp } = mfaLogin.data;
  console.log(`  Session ID: ${sessionId}, Generated 6-digit OTP: ${devOtp}`);

  // Test 5a: Verify with wrong code
  const wrongCodeRes = await request('/api/developer/auth/verify-mfa', {
    method: 'POST',
    body: JSON.stringify({ sessionId, code: '000000' }),
  });
  console.log(`  Verify invalid OTP (000000): Status = ${wrongCodeRes.status}, Error = ${wrongCodeRes.data?.error}`);
  if (wrongCodeRes.status === 400 && wrongCodeRes.data?.error?.includes('Invalid')) {
    console.log('  ✅ Invalid verification code correctly rejected');
  } else {
    console.error('  ❌ Expected 400 rejection for invalid code, got:', wrongCodeRes);
    process.exit(1);
  }

  // Test 5b: Verify with valid code
  const validCodeRes = await request('/api/developer/auth/verify-mfa', {
    method: 'POST',
    body: JSON.stringify({ sessionId, code: devOtp }),
  });
  console.log(`  Verify valid OTP (${devOtp}): Status = ${validCodeRes.status}, Received token = ${Boolean(validCodeRes.data?.token)}`);
  if (validCodeRes.status === 200 && validCodeRes.data?.token) {
    console.log('  ✅ Step 2: Valid OTP verified, JWT issued for Developer Console');
  } else {
    console.error('  ❌ Expected 200 with JWT token for valid OTP, got:', validCodeRes);
    process.exit(1);
  }

  // Disable MFA for clean baseline
  await request('/api/developer/security/settings', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${validCodeRes.data.token}` },
    body: JSON.stringify({
      session_timeout_minutes: 120,
      max_failed_logins: 5,
      rate_limit_per_minute: 500,
      enforce_mfa_developer: false,
      ip_whitelist_enabled: false,
      allowed_ips: ['127.0.0.1', '::1'],
    }),
  });

  console.log('\n🎉 ALL 5 SECURITY POLICY & PROTECTION RULES VERIFIED AND FULLY WORKING!');
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
