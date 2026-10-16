'use strict';

const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
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
    console.log('🚀 Running SaaS Developer Admin Panel migrations...');
    await client.query('BEGIN');

    // 1. saas_companies table
    await client.query(`
      CREATE TABLE IF NOT EXISTS saas_companies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        owner_client_id UUID,
        owner_name TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'trial', 'suspended')),
        subscription_plan TEXT NOT NULL DEFAULT 'Professional',
        subscription_status TEXT NOT NULL DEFAULT 'active',
        subscription_expires_at TIMESTAMPTZ,
        currency TEXT NOT NULL DEFAULT 'Rs.',
        features JSONB NOT NULL DEFAULT '{"orders":true,"finance":true,"inventory":true,"designer":true,"production":true,"whatsapp":true,"reports":true,"branding":true,"api":false}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_saas_companies_slug ON saas_companies(slug);
      CREATE INDEX IF NOT EXISTS idx_saas_companies_status ON saas_companies(status);
    `);

    // 2. saas_clients table
    await client.query(`
      CREATE TABLE IF NOT EXISTS saas_clients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT NOT NULL DEFAULT '',
        company_id UUID REFERENCES saas_companies(id) ON DELETE SET NULL,
        company_name TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deactivated', 'suspended', 'pending')),
        subscription_plan TEXT NOT NULL DEFAULT 'Professional',
        permissions JSONB NOT NULL DEFAULT '["orders.view","orders.create","orders.update","finance.view","finance.update","stock.view","stock.manage","reports.view"]'::jsonb,
        last_login_at TIMESTAMPTZ,
        notes TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_saas_clients_email ON saas_clients(email);
      CREATE INDEX IF NOT EXISTS idx_saas_clients_status ON saas_clients(status);
    `);

    // 3. saas_plans table
    await client.query(`
      CREATE TABLE IF NOT EXISTS saas_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL DEFAULT '',
        price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
        price_yearly NUMERIC(10,2) NOT NULL DEFAULT 0,
        max_users INT NOT NULL DEFAULT 5,
        max_orders_per_month INT NOT NULL DEFAULT 1000,
        features JSONB NOT NULL DEFAULT '[]'::jsonb,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 4. saas_subscriptions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS saas_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID REFERENCES saas_clients(id) ON DELETE CASCADE,
        company_id UUID REFERENCES saas_companies(id) ON DELETE CASCADE,
        plan_name TEXT NOT NULL,
        billing_cycle TEXT NOT NULL DEFAULT 'monthly',
        amount NUMERIC(10,2) NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'trial')),
        starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        features JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_saas_subscriptions_status ON saas_subscriptions(status);
    `);

    // 5. saas_audit_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS saas_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        action TEXT NOT NULL,
        performed_by TEXT NOT NULL DEFAULT 'Developer',
        performer_role TEXT NOT NULL DEFAULT 'SUPER_ADMIN',
        client_company TEXT NOT NULL DEFAULT '',
        target_id TEXT NOT NULL DEFAULT '',
        target_type TEXT NOT NULL DEFAULT '',
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        ip_address TEXT NOT NULL DEFAULT '127.0.0.1',
        device_info TEXT NOT NULL DEFAULT 'Developer Console / Chrome',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_saas_audit_logs_action ON saas_audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_saas_audit_logs_created ON saas_audit_logs(created_at DESC);
    `);

    // 6. saas_support_tickets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS saas_support_tickets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_name TEXT NOT NULL,
        client_email TEXT NOT NULL,
        company_name TEXT NOT NULL DEFAULT '',
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 7. saas_settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS saas_settings (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ── Seed Default SaaS Plans if empty ──
    const planCountRes = await client.query('SELECT COUNT(*) FROM saas_plans');
    if (parseInt(planCountRes.rows[0].count, 10) === 0) {
      console.log('🌱 Seeding initial SaaS plans...');
      await client.query(`
        INSERT INTO saas_plans (name, description, price_monthly, price_yearly, max_users, max_orders_per_month, features)
        VALUES
          ('Starter', 'Small print & stationery shops with basic order workflows', 2500, 25000, 3, 500, '["orders.view","orders.create","orders.update","stock.view"]'::jsonb),
          ('Professional', 'Fast-growing commercial printers with full production & accounting', 6000, 60000, 10, 5000, '["orders.all","finance.all","stock.all","designer.portal","production.finishing","whatsapp.automation","reports.all"]'::jsonb),
          ('Enterprise', 'High-volume packaging & large format printing houses', 15000, 150000, 999, 999999, '["orders.all","finance.all","stock.all","designer.portal","production.finishing","whatsapp.automation","reports.all","custom.branding","api.access","priority.support"]'::jsonb)
      `);
    }

    // ── Seed Initial Companies and Clients if empty ──
    const companyCountRes = await client.query('SELECT COUNT(*) FROM saas_companies');
    if (parseInt(companyCountRes.rows[0].count, 10) === 0) {
      console.log('🌱 Seeding initial demo companies and clients for Developer Panel...');
      const comp1 = await client.query(`
        INSERT INTO saas_companies (name, slug, owner_name, email, phone, status, subscription_plan, subscription_status, subscription_expires_at)
        VALUES ('Print Ghar Bagbazar', 'print-ghar-bagbazar', 'Kishor Gharti', 'kishor@printghar.com', '9866225251', 'active', 'Professional', 'active', NOW() + INTERVAL '180 days')
        RETURNING id
      `);

      const comp2 = await client.query(`
        INSERT INTO saas_companies (name, slug, owner_name, email, phone, status, subscription_plan, subscription_status, subscription_expires_at)
        VALUES ('Himalayan Offset Press', 'himalayan-offset', 'Sunil Shrestha', 'sunil@himalayanpress.com', '9841234567', 'active', 'Enterprise', 'active', NOW() + INTERVAL '300 days')
        RETURNING id
      `);

      const comp3 = await client.query(`
        INSERT INTO saas_companies (name, slug, owner_name, email, phone, status, subscription_plan, subscription_status, subscription_expires_at)
        VALUES ('Patan Quick Print', 'patan-quick-print', 'Anil Maharjan', 'anil@patanprint.com', '9812345678', 'suspended', 'Starter', 'expired', NOW() - INTERVAL '15 days')
        RETURNING id
      `);

      const comp1Id = comp1.rows[0].id;
      const comp2Id = comp2.rows[0].id;
      const comp3Id = comp3.rows[0].id;

      // Seed clients
      const cl1 = await client.query(`
        INSERT INTO saas_clients (name, email, phone, company_id, company_name, status, subscription_plan, last_login_at, notes)
        VALUES ('Kishor Gharti', 'kishor@printghar.com', '9866225251', $1::uuid, 'Print Ghar Bagbazar', 'active', 'Professional', NOW() - INTERVAL '2 hours', 'Flagship central client in Kathmandu')
        RETURNING id
      `, [comp1Id]);

      const cl2 = await client.query(`
        INSERT INTO saas_clients (name, email, phone, company_id, company_name, status, subscription_plan, last_login_at, notes)
        VALUES ('Sunil Shrestha', 'sunil@himalayanpress.com', '9841234567', $1::uuid, 'Himalayan Offset Press', 'active', 'Enterprise', NOW() - INTERVAL '1 day', 'Heavy offset packaging client')
        RETURNING id
      `, [comp2Id]);

      const cl3 = await client.query(`
        INSERT INTO saas_clients (name, email, phone, company_id, company_name, status, subscription_plan, last_login_at, notes)
        VALUES ('Anil Maharjan', 'anil@patanprint.com', '9812345678', $1::uuid, 'Patan Quick Print', 'suspended', 'Starter', NOW() - INTERVAL '18 days', 'Subscription overdue - temporarily suspended')
        RETURNING id
      `, [comp3Id]);

      // Link owner_client_id back to companies
      await client.query(`UPDATE saas_companies SET owner_client_id = $1::uuid WHERE id = $2::uuid`, [cl1.rows[0].id, comp1Id]);
      await client.query(`UPDATE saas_companies SET owner_client_id = $1::uuid WHERE id = $2::uuid`, [cl2.rows[0].id, comp2Id]);
      await client.query(`UPDATE saas_companies SET owner_client_id = $1::uuid WHERE id = $2::uuid`, [cl3.rows[0].id, comp3Id]);

      // Seed initial subscriptions
      await client.query(`
        INSERT INTO saas_subscriptions (client_id, company_id, plan_name, billing_cycle, amount, status, starts_at, expires_at)
        VALUES
          ($1::uuid, $2::uuid, 'Professional', 'monthly', 6000, 'active', NOW() - INTERVAL '30 days', NOW() + INTERVAL '180 days'),
          ($3::uuid, $4::uuid, 'Enterprise', 'yearly', 150000, 'active', NOW() - INTERVAL '65 days', NOW() + INTERVAL '300 days'),
          ($5::uuid, $6::uuid, 'Starter', 'monthly', 2500, 'expired', NOW() - INTERVAL '45 days', NOW() - INTERVAL '15 days')
      `, [cl1.rows[0].id, comp1Id, cl2.rows[0].id, comp2Id, cl3.rows[0].id, comp3Id]);

      // Seed initial audit logs
      await client.query(`
        INSERT INTO saas_audit_logs (action, performed_by, performer_role, client_company, target_type, details)
        VALUES
          ('System Initialized', 'Developer (Super Admin)', 'SUPER_ADMIN', 'Platform System', 'system', '{"version":"2.4.0","mode":"production"}'::jsonb),
          ('Client Created', 'Developer', 'SUPER_ADMIN', 'Print Ghar Bagbazar', 'client', '{"name":"Kishor Gharti","plan":"Professional"}'::jsonb),
          ('Subscription Activated', 'Developer', 'SUPER_ADMIN', 'Print Ghar Bagbazar', 'subscription', '{"plan":"Professional","amount":6000}'::jsonb),
          ('Client Created', 'Developer', 'SUPER_ADMIN', 'Himalayan Offset Press', 'client', '{"name":"Sunil Shrestha","plan":"Enterprise"}'::jsonb),
          ('Client Suspended', 'Developer', 'SUPER_ADMIN', 'Patan Quick Print', 'client', '{"reason":"Overdue subscription payment"}'::jsonb)
      `);

      // Seed support tickets
      await client.query(`
        INSERT INTO saas_support_tickets (client_name, client_email, company_name, subject, message, priority, status)
        VALUES
          ('Kishor Gharti', 'kishor@printghar.com', 'Print Ghar Bagbazar', 'WhatsApp Sender ID configuration', 'Need assistance verifying Meta Cloud API business WhatsApp sender ID.', 'high', 'in_progress'),
          ('Sunil Shrestha', 'sunil@himalayanpress.com', 'Himalayan Offset Press', 'Request extra storage quota for PSD files', 'We have large 200MB packaging files and request additional Cloudinary allocation.', 'medium', 'open')
      `);
    }

    // ── Seed default system settings if empty ──
    await client.query(`
      INSERT INTO saas_settings (key, value)
      VALUES
        ('platform_info', '{"name":"PrintFlow SaaS Developer Console","version":"2.4.0","support_email":"dev@printghar.com","contact_phone":"+977-9800000000","maintenance_mode":false}'::jsonb),
        ('security_policy', '{"session_timeout_minutes":120,"enforce_mfa_developer":true,"ip_whitelist_enabled":false,"max_failed_logins":5}'::jsonb),
        ('backup_policy', '{"auto_daily_backup":true,"retention_days":30,"cloud_sync_provider":"AWS S3 / Cloudinary"}'::jsonb)
      ON CONFLICT (key) DO NOTHING;
    `);

    await client.query('COMMIT');
    console.log('✅ SaaS Developer Admin Panel migrations & seeding completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration error:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
