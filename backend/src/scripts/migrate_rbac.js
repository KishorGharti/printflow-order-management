'use strict';

const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    console.log('Running RBAC migrations on PostgreSQL...');
    await client.query('BEGIN');

    // 1. team_members columns
    await client.query(`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS business_id TEXT NOT NULL DEFAULT 'global_settings';`);
    await client.query(`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS email TEXT;`);
    await client.query(`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS password_hash TEXT;`);
    await client.query(`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'reception';`);
    await client.query(`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;`);
    await client.query(`CREATE INDEX IF NOT EXISTS team_members_business_id_idx ON team_members(business_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS team_members_email_idx ON team_members(email);`);

    // 2. Resource multi-tenant business_id columns
    const tables = [
      'orders',
      'expenses',
      'customers',
      'products',
      'stock_items',
      'stock_transactions',
      'customer_pricing',
      'vendors'
    ];

    for (const tbl of tables) {
      await client.query(`ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS business_id TEXT NOT NULL DEFAULT 'global_settings';`);
      await client.query(`CREATE INDEX IF NOT EXISTS ${tbl}_business_id_idx ON ${tbl}(business_id);`);
    }

    // 3. work_notifications table
    await client.query(`
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
      CREATE INDEX IF NOT EXISTS work_notif_target_idx ON work_notifications(business_id, target_role, is_read);
    `);

    await client.query('COMMIT');
    console.log('✅ RBAC and multi-tenant database columns migrated successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
