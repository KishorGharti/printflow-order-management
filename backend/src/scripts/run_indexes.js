/**
 * Add missing PostgreSQL indexes for Print Ghar order mgmt.
 * Safe to run multiple times — all use CREATE INDEX IF NOT EXISTS.
 * Run with: node backend/src/scripts/run_indexes.js
 */
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../..', 'backend', '.env') });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const INDEXES = [
  // Orders: list is sorted/filtered by created_at — no index existed
  `CREATE INDEX IF NOT EXISTS orders_created_at_idx
   ON orders(created_at DESC)`,

  // Orders: status filter used on every list view refresh
  `CREATE INDEX IF NOT EXISTS orders_status_idx
   ON orders(status)`,

  // Stock items: list sorted by name; archive filter on every startup fetch
  `CREATE INDEX IF NOT EXISTS stock_items_name_idx
   ON stock_items(name)`,

  `CREATE INDEX IF NOT EXISTS stock_items_archived_idx
   ON stock_items(is_archived)`,

  // Stock transactions: audit log sorted by timestamp/created_at
  `CREATE INDEX IF NOT EXISTS stock_txn_created_at_idx
   ON stock_transactions(created_at DESC)`,

  `CREATE INDEX IF NOT EXISTS stock_txn_inventory_item_created_idx
   ON stock_transactions(inventory_item_id, created_at DESC)`,

  // Expenses: date is the primary sort column
  `CREATE INDEX IF NOT EXISTS expenses_created_at_idx
   ON expenses(created_at DESC)`,
];

(async () => {
  let client;
  try {
    client = await pool.connect();
    console.log('✅ Connected to database');

    for (const sql of INDEXES) {
      const name = sql.match(/INDEX IF NOT EXISTS (\w+)/)?.[1] || '?';
      try {
        await client.query(sql);
        console.log(`  ✅ ${name}`);
      } catch (err) {
        console.error(`  ❌ ${name}:`, err.message);
      }
    }

    console.log('\n✅ All indexes applied.');
  } catch (err) {
    console.error('Connection error:', err.message);
    process.exit(1);
  } finally {
    client?.release();
    await pool.end();
  }
})();
