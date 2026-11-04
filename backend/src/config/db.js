'use strict';

const { Pool, types } = require('pg');
const { env } = require('./env');
const logger = require('../utils/logger');

// Parse PostgreSQL NUMERIC/DECIMAL as float instead of string
types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  min: 2,               // Keep 2 warm connections so first requests skip TLS ramp-up
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error('PostgreSQL pool error:', err.message);
});

let isConnected = false;

/**
 * Connects to PostgreSQL and verifies the connection with a test query.
 * Called once at server startup.
 */
async function ensureRbacColumns(client) {
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS businesses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        slug TEXT UNIQUE,
        owner_client_id UUID,
        owner_name TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'trial', 'suspended')),
        subscription_plan TEXT NOT NULL DEFAULT 'Standard',
        features JSONB NOT NULL DEFAULT '{"orders":true,"finance":true,"inventory":true,"designer":true,"production":true,"whatsapp":true,"reports":true,"branding":true,"api":false}'::jsonb,
        settings JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_businesses_business_id ON businesses(business_id);

      CREATE TABLE IF NOT EXISTS developer_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id TEXT NOT NULL DEFAULT 'global_settings',
        key TEXT NOT NULL,
        value JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (business_id, key)
      );
      CREATE INDEX IF NOT EXISTS idx_developer_settings_biz_key ON developer_settings(business_id, key);

      ALTER TABLE team_members ADD COLUMN IF NOT EXISTS business_id TEXT NOT NULL DEFAULT 'global_settings';
      ALTER TABLE team_members ADD COLUMN IF NOT EXISTS employee_id TEXT;
      ALTER TABLE team_members ADD COLUMN IF NOT EXISTS email TEXT;
      ALTER TABLE team_members ADD COLUMN IF NOT EXISTS password_hash TEXT;
      ALTER TABLE team_members ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'reception';
      ALTER TABLE team_members ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
      ALTER TABLE businesses ADD COLUMN IF NOT EXISTS shop_code TEXT;
      ALTER TABLE saas_clients ADD COLUMN IF NOT EXISTS shop_code TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS business_id TEXT NOT NULL DEFAULT 'global_settings';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TEXT NOT NULL DEFAULT '';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS mistake_at TEXT NOT NULL DEFAULT '';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS mistake_cost NUMERIC(14,2) NOT NULL DEFAULT 0;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS mistake_reason TEXT NOT NULL DEFAULT '';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS mistake_by TEXT NOT NULL DEFAULT '';
      ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
      ALTER TABLE orders ADD CONSTRAINT orders_status_check
        CHECK (status IN ('New', 'In Design', 'Design', 'Ready to Go', 'Printing', 'Finishing', 'Progress', 'Done', 'Ready', 'Payment', 'Pickup', 'Delivery', 'Cancelled', 'Mistake'));
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS business_id TEXT NOT NULL DEFAULT 'global_settings';
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS linked_order_id TEXT NOT NULL DEFAULT '';
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS mistake_expense BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS business_id TEXT NOT NULL DEFAULT 'global_settings';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS business_id TEXT NOT NULL DEFAULT 'global_settings';
      ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS business_id TEXT NOT NULL DEFAULT 'global_settings';
      ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS business_id TEXT NOT NULL DEFAULT 'global_settings';
      ALTER TABLE customer_pricing ADD COLUMN IF NOT EXISTS business_id TEXT NOT NULL DEFAULT 'global_settings';
      ALTER TABLE vendors ADD COLUMN IF NOT EXISTS business_id TEXT NOT NULL DEFAULT 'global_settings';
      ALTER TABLE monthly_reports ADD COLUMN IF NOT EXISTS business_id TEXT NOT NULL DEFAULT 'global_settings';

      CREATE TABLE IF NOT EXISTS work_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id TEXT NOT NULL DEFAULT 'global_settings',
        target_role TEXT NOT NULL,
        order_id TEXT NOT NULL DEFAULT '',
        order_number TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        stage TEXT NOT NULL DEFAULT '',
        is_read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ── saas_clients missing columns (added after initial schema) ────────────
    await client.query(`
      ALTER TABLE saas_clients ADD COLUMN IF NOT EXISTS business_id        TEXT NOT NULL DEFAULT 'global_settings';
      ALTER TABLE saas_clients ADD COLUMN IF NOT EXISTS password_hash      TEXT;
      ALTER TABLE saas_clients ADD COLUMN IF NOT EXISTS verification_otp   TEXT;
      ALTER TABLE saas_clients ADD COLUMN IF NOT EXISTS verification_exp   TIMESTAMPTZ;
      ALTER TABLE saas_clients ADD COLUMN IF NOT EXISTS reset_token        TEXT;
      ALTER TABLE saas_clients ADD COLUMN IF NOT EXISTS reset_token_exp    TIMESTAMPTZ;
      ALTER TABLE saas_clients ADD COLUMN IF NOT EXISTS last_login_at      TIMESTAMPTZ;
      ALTER TABLE saas_clients ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;
      ALTER TABLE saas_clients ADD COLUMN IF NOT EXISTS subscription_status     TEXT NOT NULL DEFAULT 'active';
      ALTER TABLE saas_clients ADD COLUMN IF NOT EXISTS plan_duration           TEXT NOT NULL DEFAULT 'monthly';
      ALTER TABLE saas_companies ADD COLUMN IF NOT EXISTS email            TEXT NOT NULL DEFAULT '';
      ALTER TABLE saas_companies ADD COLUMN IF NOT EXISTS owner_name       TEXT NOT NULL DEFAULT '';
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS business_id            TEXT NOT NULL DEFAULT 'global_settings';

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

      INSERT INTO businesses (business_id, name, slug, email, owner_name, status, subscription_plan)
      VALUES ('global_settings', 'Print Ghar Bagbazar', 'global_settings', 'kishor@printghar.com', 'Kishor Gharti', 'active', 'Enterprise')
      ON CONFLICT (business_id) DO NOTHING;
    `);

    // Bootstrap missing settings rows for all tenants (idempotent)
    await client.query(`
      INSERT INTO settings (key, shop_name, business_id)
      SELECT sc.business_id, split_part(sc.email, '@', 1), sc.business_id
      FROM saas_clients sc
      WHERE sc.business_id IS NOT NULL
        AND sc.business_id != 'global_settings'
        AND NOT EXISTS (SELECT 1 FROM settings s WHERE s.key = sc.business_id)
      ON CONFLICT (key) DO NOTHING;
    `);
  } catch (_) {}
}

/**
 * Server-side job / invoice number counters (additive; existing data is never renumbered).
 * Kept separate from ensureRbacColumns so a failure here is logged instead of swallowed.
 */
async function ensureNumberCounters(client) {
  const { COUNTERS_TABLE_SQL } = require('../services/numberingService');
  try {
    await client.query(COUNTERS_TABLE_SQL);
  } catch (err) {
    logger.error(`❌ Could not create number_counters table: ${err.message}`);
  }
}

/**
 * Repeat-job link columns on orders (additive). Kept separate so a failure is logged, not swallowed.
 */
async function ensureRepeatOrderColumns(client) {
  try {
    await client.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS repeat_of_order_id TEXT NOT NULL DEFAULT '';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS repeat_of_order_number TEXT NOT NULL DEFAULT '';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS repeat_design_mode TEXT NOT NULL DEFAULT '';
      CREATE INDEX IF NOT EXISTS orders_repeat_of_idx ON orders(business_id, repeat_of_order_id) WHERE repeat_of_order_id <> '';
    `);
  } catch (err) {
    logger.error(`❌ Could not add repeat order columns: ${err.message}`);
  }
}

async function connectDB() {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    await ensureRbacColumns(client);
    await ensureNumberCounters(client);
    await ensureRepeatOrderColumns(client);
    client.release();
    isConnected = true;
    logger.info('✅ PostgreSQL connected → printflow database (RBAC schema verified)');
  } catch (err) {
    isConnected = false;
    logger.error(`❌ PostgreSQL connection failed: ${err.message}`);
    logger.warn('👉 Ensure PostgreSQL is running and DATABASE_URL in .env is correct.');
    logger.warn('👉 Then run: node src/scripts/migrate_to_pg.js  to create tables.');
    // Don't exit — let the server start anyway so health check reflects state
  }
}

function isDBConnected() {
  return isConnected;
}

module.exports = { pool, connectDB, isDBConnected };
