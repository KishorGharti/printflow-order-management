-- PrintGhar PostgreSQL Schema
-- Run this once to initialize the database.
-- All statements use IF NOT EXISTS so it is safe to re-run.

-- ── UUID support ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── updated_at auto-trigger function ────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── customers ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id            TEXT        UNIQUE,
  business_id         TEXT        NOT NULL DEFAULT 'global_settings',
  name                TEXT        NOT NULL,
  business_name       TEXT        NOT NULL DEFAULT '',
  phone               TEXT        NOT NULL DEFAULT '',
  whatsapp            TEXT        NOT NULL DEFAULT '',
  email               TEXT        NOT NULL DEFAULT '',
  address             TEXT        NOT NULL DEFAULT '',
  pan                 TEXT        NOT NULL DEFAULT '',
  pan_number          TEXT        NOT NULL DEFAULT '',
  notes               TEXT        NOT NULL DEFAULT '',
  is_profile_account  BOOLEAN     NOT NULL DEFAULT false,
  advance_balance     NUMERIC(14,2) NOT NULL DEFAULT 0,
  advance_history     JSONB       NOT NULL DEFAULT '[]',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS customers_business_id_idx ON customers(business_id);
DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;
CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── vendors ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendors (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id    TEXT        UNIQUE,
  business_id TEXT        NOT NULL DEFAULT 'global_settings',
  name        TEXT        NOT NULL,
  phone       TEXT        NOT NULL DEFAULT '',
  email       TEXT        NOT NULL DEFAULT '',
  address     TEXT        NOT NULL DEFAULT '',
  notes       TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS vendors_business_id_idx ON vendors(business_id);
DROP TRIGGER IF EXISTS trg_vendors_updated_at ON vendors;
CREATE TRIGGER trg_vendors_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── products ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id                 TEXT          UNIQUE,
  business_id              TEXT          NOT NULL DEFAULT 'global_settings',
  name                     TEXT          NOT NULL,
  category                 TEXT          NOT NULL DEFAULT 'General',
  default_price            NUMERIC(14,2) NOT NULL DEFAULT 0,
  unit                     TEXT          NOT NULL DEFAULT 'pcs',
  description              TEXT          NOT NULL DEFAULT '',
  is_active                BOOLEAN       NOT NULL DEFAULT true,
  materials                JSONB         NOT NULL DEFAULT '[]',
  stock_materials_enabled  BOOLEAN       NOT NULL DEFAULT false,
  deduct_auto_stock_at     TEXT          NOT NULL DEFAULT 'Finishing',
  variant_prices           JSONB         NOT NULL DEFAULT '{}',
  sub_items                JSONB         NOT NULL DEFAULT '[]',
  has_sub_items            BOOLEAN       NOT NULL DEFAULT false,
  low_stock_threshold      NUMERIC(14,4) NOT NULL DEFAULT 5,
  production_type          TEXT          NOT NULL DEFAULT '',
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS products_business_id_idx ON products(business_id);
DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── orders ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id                    TEXT          UNIQUE,
  business_id                 TEXT          NOT NULL DEFAULT 'global_settings',
  order_number                TEXT          NOT NULL UNIQUE,
  customer_id                 TEXT          NOT NULL,
  customer_name               TEXT          NOT NULL DEFAULT '',
  customer_phone              TEXT          NOT NULL DEFAULT '',
  customer_email              TEXT          NOT NULL DEFAULT '',
  customer_whatsapp           TEXT          NOT NULL DEFAULT '',
  order_contact_name          TEXT          NOT NULL DEFAULT '',
  order_contact_phone         TEXT          NOT NULL DEFAULT '',
  status                      TEXT          NOT NULL DEFAULT 'New'
                              CHECK (status IN ('New','In Design','Design','Ready to Go','Printing','Finishing','Progress','Done','Ready','Payment','Pickup','Delivery','Cancelled','Mistake')),
  items                       JSONB         NOT NULL DEFAULT '[]',
  total_amount                NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount                    NUMERIC(14,2) NOT NULL DEFAULT 0,
  order_date                  TEXT          NOT NULL DEFAULT '',
  due_date                    TEXT          NOT NULL DEFAULT '',
  due_time                    TEXT          NOT NULL DEFAULT '',
  notes                       TEXT          NOT NULL DEFAULT '',
  payment_method              TEXT,
  payment_status              TEXT          NOT NULL DEFAULT 'Unpaid'
                              CHECK (payment_status IN ('Unpaid','Partial','Paid','Credit')),
  payment_history             JSONB         NOT NULL DEFAULT '[]',
  initial_payment_method      TEXT          NOT NULL DEFAULT '',
  initial_received_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
  invoice_number              TEXT          NOT NULL DEFAULT '',
  media                       JSONB         NOT NULL DEFAULT '[]',
  history                     JSONB         NOT NULL DEFAULT '[]',
  stock_allocations           JSONB         NOT NULL DEFAULT '[]',
  stock_updated_at            TEXT          NOT NULL DEFAULT '',
  designer_id                 TEXT          NOT NULL DEFAULT '',
  designer_name               TEXT          NOT NULL DEFAULT '',
  designer_job_title          TEXT          NOT NULL DEFAULT '',
  completed_at                TEXT          NOT NULL DEFAULT '',
  pickup_type                 TEXT          NOT NULL DEFAULT '',
  pickup_person_name          TEXT          NOT NULL DEFAULT '',
  pickup_person_phone         TEXT          NOT NULL DEFAULT '',
  picked_up_at                TEXT          NOT NULL DEFAULT '',
  delivery_type               TEXT          NOT NULL DEFAULT '',
  delivery_person_id          TEXT          NOT NULL DEFAULT '',
  delivery_person_name        TEXT          NOT NULL DEFAULT '',
  delivery_person_job_title   TEXT          NOT NULL DEFAULT '',
  delivered_at                TEXT          NOT NULL DEFAULT '',
  downloaded_media_ids        JSONB         NOT NULL DEFAULT '[]',
  last_design_downloaded_at   TEXT          NOT NULL DEFAULT '',
  print_history               JSONB         NOT NULL DEFAULT '[]',
  printer_id                  TEXT          NOT NULL DEFAULT '',
  printer_name                TEXT          NOT NULL DEFAULT '',
  printed_by                  TEXT          NOT NULL DEFAULT '',
  printer_job_title           TEXT          NOT NULL DEFAULT '',
  cancelled_at                TEXT          NOT NULL DEFAULT '',
  cancelled_by                TEXT          NOT NULL DEFAULT '',
  cancel_reason               TEXT          NOT NULL DEFAULT '',
  previous_status             TEXT          NOT NULL DEFAULT '',
  created_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS orders_business_id_idx ON orders(business_id);
CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON orders(customer_id);
CREATE INDEX IF NOT EXISTS orders_status_idx      ON orders(status);
CREATE INDEX IF NOT EXISTS orders_order_date_idx  ON orders(order_date DESC);
DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── expenses ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id            TEXT          UNIQUE,
  business_id         TEXT          NOT NULL DEFAULT 'global_settings',
  expense_number      TEXT          NOT NULL DEFAULT '',
  title               TEXT          NOT NULL,
  category            TEXT          NOT NULL DEFAULT 'General',
  vendor              TEXT          NOT NULL DEFAULT '',
  vendor_id           TEXT          NOT NULL DEFAULT '',
  amount              NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_amount         NUMERIC(14,2) NOT NULL DEFAULT 0,
  outstanding_amount  NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_status      TEXT          NOT NULL DEFAULT 'Paid'
                      CHECK (payment_status IN ('Paid','Partial','Unpaid','Credit')),
  payment_method      TEXT          NOT NULL DEFAULT 'Cash'
                      CHECK (payment_method IN ('Cash','Online','Bank','Credit')),
  payment_history     JSONB         NOT NULL DEFAULT '[]',
  paid_by             TEXT          NOT NULL DEFAULT '',
  paid_at             TEXT          NOT NULL DEFAULT '',
  linked_purchase_id  TEXT          NOT NULL DEFAULT '',
  stock_quantity      NUMERIC(14,4),
  date                TEXT          NOT NULL,
  notes               TEXT          NOT NULL DEFAULT '',
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS expenses_business_id_idx    ON expenses(business_id);
CREATE INDEX IF NOT EXISTS expenses_date_idx           ON expenses(date DESC);
CREATE INDEX IF NOT EXISTS expenses_category_idx       ON expenses(category);
CREATE INDEX IF NOT EXISTS expenses_payment_status_idx ON expenses(payment_status);
DROP TRIGGER IF EXISTS trg_expenses_updated_at ON expenses;
CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── team_members ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_members (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id      TEXT          UNIQUE,
  business_id   TEXT          NOT NULL DEFAULT 'global_settings',
  name          TEXT          NOT NULL,
  email         TEXT,
  password_hash TEXT,
  role          TEXT          NOT NULL DEFAULT 'reception',
  job_title     TEXT          NOT NULL,
  phone         TEXT          NOT NULL DEFAULT '',
  salary        NUMERIC(14,2) NOT NULL DEFAULT 0,
  borrowed      NUMERIC(14,2) NOT NULL DEFAULT 0,
  pin           TEXT          NOT NULL DEFAULT '123456',
  records       JSONB         NOT NULL DEFAULT '[]',
  attendance    JSONB         NOT NULL DEFAULT '[]',
  is_active     BOOLEAN       NOT NULL DEFAULT true,
  status        TEXT          NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS team_members_business_id_idx ON team_members(business_id);
CREATE INDEX IF NOT EXISTS team_members_email_idx       ON team_members(email);
DROP TRIGGER IF EXISTS trg_team_members_updated_at ON team_members;
CREATE TRIGGER trg_team_members_updated_at
  BEFORE UPDATE ON team_members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── stock_items ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_items (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id             TEXT          UNIQUE,
  business_id          TEXT          NOT NULL DEFAULT 'global_settings',
  name                 TEXT          NOT NULL,
  category             TEXT          NOT NULL DEFAULT 'General',
  quantity             NUMERIC(14,4) NOT NULL DEFAULT 0,
  unit                 TEXT          NOT NULL DEFAULT 'pcs',
  parent_id            TEXT,
  parent_name          TEXT          NOT NULL DEFAULT '',
  has_sub_items        BOOLEAN       NOT NULL DEFAULT false,
  sub_items            JSONB         NOT NULL DEFAULT '[]',
  low_stock_threshold  NUMERIC(14,4) NOT NULL DEFAULT 5,
  min_quantity         NUMERIC(14,4) NOT NULL DEFAULT 0,
  min_stock_alert      NUMERIC(14,4) NOT NULL DEFAULT 0,
  cost                 NUMERIC(14,2) NOT NULL DEFAULT 0,
  purchase_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  vendor               TEXT          NOT NULL DEFAULT '',
  vendor_id            TEXT          NOT NULL DEFAULT '',
  is_archived          BOOLEAN       NOT NULL DEFAULT false,
  archived_at          TEXT,
  source_expense_id    TEXT          NOT NULL DEFAULT '',
  purchase_number      TEXT          NOT NULL DEFAULT '',
  notes                TEXT          NOT NULL DEFAULT '',
  payment_method       TEXT          NOT NULL DEFAULT '',
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS stock_items_business_id_idx ON stock_items(business_id);
DROP TRIGGER IF EXISTS trg_stock_items_updated_at ON stock_items;
CREATE TRIGGER trg_stock_items_updated_at
  BEFORE UPDATE ON stock_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── stock_transactions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_transactions (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id             TEXT          UNIQUE,
  business_id          TEXT          NOT NULL DEFAULT 'global_settings',
  inventory_item_id    TEXT          NOT NULL,
  inventory_item_name  TEXT          NOT NULL DEFAULT '',
  quantity             NUMERIC(14,4) NOT NULL,
  signed_quantity      NUMERIC(14,4) NOT NULL,
  unit                 TEXT          NOT NULL DEFAULT 'pcs',
  transaction_type     TEXT          NOT NULL DEFAULT 'ADJUST'
                       CHECK (transaction_type IN ('RESERVE','RELEASE','CONSUME','RESTORE','PURCHASE','ADJUST','RETURN','MANUAL')),
  order_id             TEXT          NOT NULL DEFAULT '',
  order_number         TEXT          NOT NULL DEFAULT '',
  master_product_id    TEXT          NOT NULL DEFAULT '',
  master_product_name  TEXT          NOT NULL DEFAULT '',
  order_item_id        TEXT          NOT NULL DEFAULT '',
  "timestamp"          TEXT          NOT NULL DEFAULT '',
  "user"               TEXT          NOT NULL DEFAULT 'System',
  automatic            BOOLEAN       NOT NULL DEFAULT true,
  reason               TEXT          NOT NULL DEFAULT '',
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS stock_transactions_business_id_idx ON stock_transactions(business_id);
CREATE INDEX IF NOT EXISTS stock_txn_item_idx  ON stock_transactions(inventory_item_id);
CREATE INDEX IF NOT EXISTS stock_txn_order_idx ON stock_transactions(order_id);
DROP TRIGGER IF EXISTS trg_stock_transactions_updated_at ON stock_transactions;
CREATE TRIGGER trg_stock_transactions_updated_at
  BEFORE UPDATE ON stock_transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── customer_pricing ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_pricing (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id     TEXT          UNIQUE,
  business_id  TEXT          NOT NULL DEFAULT 'global_settings',
  customer_id  TEXT          NOT NULL,
  product_id   TEXT          NOT NULL,
  variant      TEXT          NOT NULL DEFAULT '',
  custom_price NUMERIC(14,2) NOT NULL,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, product_id, variant)
);
CREATE INDEX IF NOT EXISTS customer_pricing_business_id_idx ON customer_pricing(business_id);
DROP TRIGGER IF EXISTS trg_customer_pricing_updated_at ON customer_pricing;
CREATE TRIGGER trg_customer_pricing_updated_at
  BEFORE UPDATE ON customer_pricing
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── settings ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  id                                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key                                 TEXT        NOT NULL UNIQUE DEFAULT 'global_settings',
  business_id                         TEXT        NOT NULL DEFAULT 'global_settings',
  shop_name                           TEXT        NOT NULL DEFAULT 'PrintGhar',
  shop_phone                          TEXT        NOT NULL DEFAULT '9800000000',
  shop_email                          TEXT        NOT NULL DEFAULT 'printghar@gmail.com',
  shop_address                        TEXT        NOT NULL DEFAULT 'Ghorahi, Dang',
  owner_name                          TEXT        NOT NULL DEFAULT '',
  business_category                   TEXT        NOT NULL DEFAULT 'Wholesale Printing Platform',
  shop_logo                           TEXT        NOT NULL DEFAULT '',
  opening_balance                     NUMERIC(14,2) NOT NULL DEFAULT 0,
  opening_balance_date                TEXT        NOT NULL DEFAULT '',
  currency                            TEXT        NOT NULL DEFAULT 'Rs.',
  date_mode                           TEXT        NOT NULL DEFAULT 'AD' CHECK (date_mode IN ('AD','BS')),
  job_prefix                          TEXT        NOT NULL DEFAULT 'JOB-',
  job_start_number                    INTEGER     NOT NULL DEFAULT 1042,
  invoice_prefix                      TEXT        NOT NULL DEFAULT '',
  invoice_start_number                INTEGER     NOT NULL DEFAULT 1,
  brand_primary                       TEXT        NOT NULL DEFAULT '#4f46e5',
  appearance                          TEXT        NOT NULL DEFAULT 'light' CHECK (appearance IN ('light','dark')),
  whatsapp_notifications_enabled      BOOLEAN     NOT NULL DEFAULT true,
  whatsapp_sender_number              TEXT        NOT NULL DEFAULT '',
  whatsapp_template                   TEXT        NOT NULL DEFAULT '',
  balance_sheet_header_color          TEXT        NOT NULL DEFAULT '#0026ff',
  balance_sheet_header_text_color     TEXT        NOT NULL DEFAULT '#ffffff',
  balance_sheet_footer_color          TEXT        NOT NULL DEFAULT '#0026ff',
  balance_sheet_footer_text_color     TEXT        NOT NULL DEFAULT '#ffffff',
  balance_sheet_alternate_color       TEXT        NOT NULL DEFAULT '#f1f5f9',
  balance_sheet_alternate_tint        INTEGER     NOT NULL DEFAULT 100,
  all_transactions_header_color       TEXT        NOT NULL DEFAULT '#1e293b',
  all_transactions_header_text_color  TEXT        NOT NULL DEFAULT '#ffffff',
  all_transactions_footer_color       TEXT        NOT NULL DEFAULT '#1e293b',
  all_transactions_footer_text_color  TEXT        NOT NULL DEFAULT '#ffffff',
  all_transactions_alternate_color    TEXT        NOT NULL DEFAULT '#f8fafc',
  all_transactions_alternate_tint     INTEGER     NOT NULL DEFAULT 100,
  bill_reference_config               JSONB       NOT NULL DEFAULT '{}'::jsonb,
  chalan_reference_config             JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS settings_business_id_idx ON settings(business_id);
DROP TRIGGER IF EXISTS trg_settings_updated_at ON settings;
CREATE TRIGGER trg_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── monthly_reports ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monthly_reports (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           TEXT          NOT NULL DEFAULT 'global_settings',
  month                 TEXT          NOT NULL UNIQUE,
  year                  TEXT          NOT NULL,
  title                 TEXT          NOT NULL,
  period_start          TEXT          NOT NULL,
  period_end            TEXT          NOT NULL,
  total_revenue         NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_expenses        NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_profit            NUMERIC(14,2) NOT NULL DEFAULT 0,
  order_count           INTEGER       NOT NULL DEFAULT 0,
  cloudinary_pdf_url    TEXT          NOT NULL DEFAULT '',
  cloudinary_public_id  TEXT          NOT NULL DEFAULT '',
  is_archived_locally   BOOLEAN       NOT NULL DEFAULT false,
  archived_locally_at   TIMESTAMPTZ,
  is_deleted_from_cloud BOOLEAN       NOT NULL DEFAULT false,
  deleted_from_cloud_at TIMESTAMPTZ,
  cloud_cleanup_status  TEXT          NOT NULL DEFAULT 'ACTIVE'
                        CHECK (cloud_cleanup_status IN ('ACTIVE','ARCHIVED_LOCAL','PURGED_FROM_CLOUD')),
  generated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  summary_data          JSONB,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS monthly_reports_business_id_idx ON monthly_reports(business_id);
DROP TRIGGER IF EXISTS trg_monthly_reports_updated_at ON monthly_reports;
CREATE TRIGGER trg_monthly_reports_updated_at
  BEFORE UPDATE ON monthly_reports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── work_notifications ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS work_notifications (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   TEXT          NOT NULL DEFAULT 'global_settings',
  target_role   TEXT          NOT NULL,
  order_id      TEXT          NOT NULL DEFAULT '',
  order_number  TEXT          NOT NULL DEFAULT '',
  title         TEXT          NOT NULL,
  message       TEXT          NOT NULL,
  stage         TEXT          NOT NULL DEFAULT '',
  is_read       BOOLEAN       NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS work_notif_target_idx ON work_notifications(business_id, target_role, is_read);
DROP TRIGGER IF EXISTS trg_work_notifications_updated_at ON work_notifications;
CREATE TRIGGER trg_work_notifications_updated_at
  BEFORE UPDATE ON work_notifications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── SaaS Developer Admin Platform Tables ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS saas_companies (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT          NOT NULL,
  slug                    TEXT          UNIQUE NOT NULL,
  owner_client_id         UUID,
  owner_name              TEXT          NOT NULL DEFAULT '',
  email                   TEXT          NOT NULL DEFAULT '',
  phone                   TEXT          NOT NULL DEFAULT '',
  status                  TEXT          NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'trial', 'suspended')),
  subscription_plan       TEXT          NOT NULL DEFAULT 'Standard',
  subscription_status     TEXT          NOT NULL DEFAULT 'active',
  subscription_expires_at TIMESTAMPTZ,
  currency                TEXT          NOT NULL DEFAULT 'Rs.',
  features                JSONB         NOT NULL DEFAULT '{"orders":true,"finance":true,"inventory":true,"designer":true,"production":true,"whatsapp":true,"reports":true,"branding":true,"api":false}'::jsonb,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_saas_companies_slug ON saas_companies(slug);
CREATE INDEX IF NOT EXISTS idx_saas_companies_status ON saas_companies(status);

CREATE TABLE IF NOT EXISTS saas_clients (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT          NOT NULL,
  email             TEXT          UNIQUE NOT NULL,
  phone             TEXT          NOT NULL DEFAULT '',
  company_id        UUID          REFERENCES saas_companies(id) ON DELETE SET NULL,
  company_name      TEXT          NOT NULL DEFAULT '',
  status            TEXT          NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deactivated', 'suspended', 'pending', 'expired')),
  subscription_plan TEXT          NOT NULL DEFAULT 'Standard',
  permissions       JSONB         NOT NULL DEFAULT '["orders.view","orders.create","orders.update","finance.view","finance.update","stock.view","stock.manage","reports.view"]'::jsonb,
  last_login_at     TIMESTAMPTZ,
  notes             TEXT          NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_saas_clients_email ON saas_clients(email);
CREATE INDEX IF NOT EXISTS idx_saas_clients_status ON saas_clients(status);

CREATE TABLE IF NOT EXISTS saas_plans (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT          NOT NULL UNIQUE,
  description         TEXT          NOT NULL DEFAULT '',
  price_monthly       NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_yearly        NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_users           INT           NOT NULL DEFAULT 5,
  max_orders_per_month INT          NOT NULL DEFAULT 1000,
  features            JSONB         NOT NULL DEFAULT '[]'::jsonb,
  is_active           BOOLEAN       NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saas_subscriptions (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID          REFERENCES saas_clients(id) ON DELETE CASCADE,
  company_id    UUID          REFERENCES saas_companies(id) ON DELETE CASCADE,
  plan_name     TEXT          NOT NULL,
  billing_cycle TEXT          NOT NULL DEFAULT 'monthly',
  amount        NUMERIC(10,2) NOT NULL DEFAULT 0,
  status        TEXT          NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'trial')),
  starts_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ   NOT NULL,
  features      JSONB         NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_saas_subscriptions_status ON saas_subscriptions(status);

CREATE TABLE IF NOT EXISTS saas_audit_logs (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  action          TEXT          NOT NULL,
  performed_by    TEXT          NOT NULL DEFAULT 'Developer',
  performer_role  TEXT          NOT NULL DEFAULT 'SUPER_ADMIN',
  client_company  TEXT          NOT NULL DEFAULT '',
  target_id       TEXT          NOT NULL DEFAULT '',
  target_type     TEXT          NOT NULL DEFAULT '',
  details         JSONB         NOT NULL DEFAULT '{}'::jsonb,
  ip_address      TEXT          NOT NULL DEFAULT '127.0.0.1',
  device_info     TEXT          NOT NULL DEFAULT 'Developer Console / Chrome',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_saas_audit_logs_action ON saas_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_saas_audit_logs_created ON saas_audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS saas_support_tickets (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name   TEXT          NOT NULL,
  client_email  TEXT          NOT NULL,
  company_name  TEXT          NOT NULL DEFAULT '',
  subject       TEXT          NOT NULL,
  message       TEXT          NOT NULL,
  priority      TEXT          NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status        TEXT          NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saas_settings (
  key           TEXT          PRIMARY KEY,
  value         JSONB         NOT NULL,
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Pagination and Sorting Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_orders_biz_created ON orders(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_biz_status_created ON orders(business_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_biz_cust_created ON orders(business_id, customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_biz_created ON customers(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_biz_name ON customers(business_id, name ASC);
CREATE INDEX IF NOT EXISTS idx_products_biz_name ON products(business_id, name ASC);
CREATE INDEX IF NOT EXISTS idx_stock_items_biz_name ON stock_items(business_id, name ASC);
CREATE INDEX IF NOT EXISTS idx_stock_txns_biz_time ON stock_transactions(business_id, "timestamp" DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_biz_date ON expenses(business_id, date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_biz_created ON team_members(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendors_biz_name ON vendors(business_id, name ASC);
CREATE INDEX IF NOT EXISTS idx_monthly_reports_biz_month ON monthly_reports(business_id, month DESC);
CREATE INDEX IF NOT EXISTS idx_saas_clients_status_created ON saas_clients(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saas_tickets_status_created ON saas_support_tickets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saas_audit_biz_created ON saas_audit_logs(client_company, created_at DESC);

