/**
 * Creates the number_counters table used for server-side job / invoice numbering.
 * Additive and safe to run multiple times: existing orders and invoices are not renumbered.
 * The backend also creates this table automatically on startup.
 * Run with: node backend/src/scripts/migrate_number_counters.js
 */
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../..', 'backend', '.env') });
const { Pool } = require('pg');
const { COUNTERS_TABLE_SQL } = require('../services/numberingService');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    await pool.query(COUNTERS_TABLE_SQL);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM number_counters');
    console.log(`number_counters ready (${rows[0].n} counter rows).`);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
