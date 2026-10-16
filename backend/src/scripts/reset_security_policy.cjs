'use strict';
const { pool } = require('../config/db');

async function main() {
  const val = {
    session_timeout_minutes: 120,
    max_failed_logins: 5,
    rate_limit_per_minute: 500,
    enforce_mfa_developer: false,
    ip_whitelist_enabled: false,
    allowed_ips: ['127.0.0.1', '::1', 'localhost']
  };

  const res = await pool.query(
    'UPDATE saas_settings SET value = $1 WHERE key = $2',
    [JSON.stringify(val), 'security_policy']
  );
  console.log('Reset security policy successfully. Updated rows:', res.rowCount);
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
