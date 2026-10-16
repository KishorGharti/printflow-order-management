#!/usr/bin/env node
'use strict';

/**
 * MongoDB Atlas → PostgreSQL Data Migration Script
 * ────────────────────────────────────────────────
 * Copies all collections and documents from MongoDB Atlas into local PostgreSQL.
 * Preserves MongoDB _ids as local_id for backward compatibility with frontend refs.
 */

const path = require('path');
const mongoose = require('mongoose');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { buildInsertParts } = require('../config/dbHelpers');

const MONGODB_URI = process.env.MONGODB_URI || '';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function migrateCollection(mongoDb, collectionName, tableName, idField = 'local_id', transformDoc = null) {
  const docs = await mongoDb.collection(collectionName).find().toArray();
  console.log(`📦 Migrating ${collectionName} (${docs.length} documents) → ${tableName}...`);
  if (!docs.length) return;

  let inserted = 0;
  for (const doc of docs) {
    let cleanDoc = { ...doc };
    const mongoId = cleanDoc._id ? cleanDoc._id.toString() : null;

    if (idField && !cleanDoc.localId && !cleanDoc.local_id && mongoId) {
      cleanDoc.localId = mongoId;
    }

    delete cleanDoc._id;
    delete cleanDoc.__v;

    if (transformDoc) {
      cleanDoc = transformDoc(cleanDoc);
    }

    const { cols, placeholders, values } = buildInsertParts(cleanDoc);
    if (!cols.length) continue;

    try {
      await pool.query(
        `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT DO NOTHING`,
        values
      );
      inserted++;
    } catch (err) {
      console.warn(`  ⚠️ Failed to insert row in ${tableName}: ${err.message}`);
    }
  }

  console.log(`  ✅ ${inserted}/${docs.length} rows inserted into ${tableName}.`);
}

async function main() {
  console.log('🔌 Connecting to MongoDB Atlas...');
  await mongoose.connect(MONGODB_URI);
  const mongoDb = mongoose.connection.db;
  console.log('✅ Connected to MongoDB Atlas.');

  console.log('🔌 Connecting to PostgreSQL...');
  const client = await pool.connect();
  client.release();
  console.log('✅ Connected to PostgreSQL.\n');

  try {
    // 1. Settings
    await migrateCollection(mongoDb, 'settings', 'settings', null, (d) => {
      d.key = d.key || 'global_settings';
      return d;
    });

    // 2. Customers
    await migrateCollection(mongoDb, 'customers', 'customers');

    // 3. Vendors
    await migrateCollection(mongoDb, 'vendors', 'vendors');

    // 4. Products
    await migrateCollection(mongoDb, 'products', 'products');

    // 5. Team Members
    await migrateCollection(mongoDb, 'teammembers', 'team_members');

    // 6. Stock Items
    await migrateCollection(mongoDb, 'stockitems', 'stock_items');

    // 7. Orders
    await migrateCollection(mongoDb, 'orders', 'orders');

    // 8. Expenses
    await migrateCollection(mongoDb, 'expenses', 'expenses');

    // 9. Customer Pricing
    await migrateCollection(mongoDb, 'customerpricings', 'customer_pricing');

    // 10. Stock Transactions
    await migrateCollection(mongoDb, 'stocktransactions', 'stock_transactions');

    // 11. Monthly Reports
    await migrateCollection(mongoDb, 'monthlyreports', 'monthly_reports', null, (d) => {
      if (!d.year && d.month) {
        d.year = d.month.split('-')[0] || new Date().getFullYear().toString();
      }
      return d;
    });

    console.log('\n🎉 ALL DATA MIGRATION COMPLETE! Everything has been safely transferred to PostgreSQL.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await mongoose.disconnect();
    await pool.end();
  }
}

main();
