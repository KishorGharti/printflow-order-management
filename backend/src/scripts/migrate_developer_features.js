'use strict';

const { pool } = require('../config/db');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running developer features schema migration...');
    await client.query(`
      ALTER TABLE saas_clients ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;
      ALTER TABLE saas_clients ADD COLUMN IF NOT EXISTS subscription_status     TEXT NOT NULL DEFAULT 'active';
      ALTER TABLE saas_clients ADD COLUMN IF NOT EXISTS plan_duration           TEXT NOT NULL DEFAULT 'monthly';
      UPDATE saas_clients SET subscription_expires_at = NOW() + INTERVAL '30 days' WHERE subscription_expires_at IS NULL;

      CREATE TABLE IF NOT EXISTS saas_error_logs (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message      TEXT NOT NULL,
        stack        TEXT,
        method       TEXT DEFAULT '',
        path         TEXT DEFAULT '',
        status_code  INT DEFAULT 500,
        business_id  TEXT DEFAULT 'system',
        user_id      TEXT DEFAULT '',
        user_email   TEXT DEFAULT '',
        ip_address   TEXT DEFAULT '',
        user_agent   TEXT DEFAULT '',
        resolved     BOOLEAN NOT NULL DEFAULT false,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_saas_error_logs_created ON saas_error_logs(created_at DESC);
    `);
    console.log('✅ Developer features schema migration complete.');
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
