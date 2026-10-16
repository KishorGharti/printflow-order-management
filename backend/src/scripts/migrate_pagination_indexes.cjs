'use strict';

const { pool } = require('../config/db');

async function run() {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_orders_biz_created ON orders(business_id, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_orders_biz_status_created ON orders(business_id, status, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_orders_biz_cust_created ON orders(business_id, customer_id, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_customers_biz_created ON customers(business_id, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_customers_biz_name ON customers(business_id, name ASC)',
    'CREATE INDEX IF NOT EXISTS idx_products_biz_name ON products(business_id, name ASC)',
    'CREATE INDEX IF NOT EXISTS idx_stock_items_biz_name ON stock_items(business_id, name ASC)',
    'CREATE INDEX IF NOT EXISTS idx_stock_txns_biz_time ON stock_transactions(business_id, "timestamp" DESC, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_expenses_biz_date ON expenses(business_id, date DESC, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_team_biz_created ON team_members(business_id, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_vendors_biz_name ON vendors(business_id, name ASC)',
    'CREATE INDEX IF NOT EXISTS idx_monthly_reports_biz_month ON monthly_reports(business_id, month DESC)',
    'CREATE INDEX IF NOT EXISTS idx_saas_clients_status_created ON saas_clients(status, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_saas_tickets_status_created ON saas_support_tickets(status, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_saas_audit_biz_created ON saas_audit_logs(client_company, created_at DESC)',
  ];

  for (const sql of indexes) {
    await pool.query(sql);
  }
  console.log('✅ All pagination indexes verified and created in PostgreSQL!');
  await pool.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
