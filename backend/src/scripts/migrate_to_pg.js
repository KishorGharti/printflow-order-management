#!/usr/bin/env node
'use strict';

/**
 * PrintGhar PostgreSQL Table Migration Script
 * ─────────────────────────────────────────────
 * Reads schema.sql and runs it against the DATABASE_URL PostgreSQL database.
 * This script is IDEMPOTENT — safe to run multiple times.
 *
 * Usage:
 *   node src/scripts/migrate_to_pg.js
 *
 * Prerequisites:
 *   - DATABASE_URL must be set in .env (or environment)
 *   - The target database must exist (e.g. CREATE DATABASE printflow)
 */

const path   = require('path');
const fs     = require('fs');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌  DATABASE_URL is not set. Add it to your .env file:');
  console.error('    DATABASE_URL=postgresql://postgres:password@localhost:5432/printflow');
  process.exit(1);
}

const schemaPath = path.join(__dirname, '../config/schema.sql');
const sql        = fs.readFileSync(schemaPath, 'utf-8');

const pool = new Pool({ connectionString: DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    console.log('🔌 Connected to PostgreSQL:', DATABASE_URL.replace(/:([^:@]+)@/, ':***@'));
    console.log('📦 Running schema migrations...\n');

    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');

    console.log('✅ All tables created (or already exist).');
    console.log('\nTables in printflow database:');

    const { rows } = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    rows.forEach((r) => console.log('  •', r.tablename));

    console.log('\n🚀 Migration complete. You can now start the server with: npm run dev');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    console.error(err.detail || '');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
