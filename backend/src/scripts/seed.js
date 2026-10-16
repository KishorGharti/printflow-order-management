'use strict';

require('dotenv').config();
const { pool } = require('../config/db');
const { buildInsertParts } = require('../config/dbHelpers');
const logger = require('../utils/logger');

const INITIAL_PRODUCTS = [
  {
    name: 'Business Cards (500 Pack)',
    category: 'Stationery',
    defaultPrice: 60.0,
    unit: 'set',
    description: '16pt Heavyweight Cardstock with Premium Matte or Gloss Finish.',
    isActive: true,
  },
  {
    name: 'Vinyl Banner (13oz)',
    category: 'Large Format',
    defaultPrice: 8.0,
    unit: 'sq.ft',
    description: 'Heavy duty indoor/outdoor vinyl banner with reinforced hems and grommets.',
    isActive: true,
  },
  {
    name: 'Flyers (1000 Pack - 8.5x11)',
    category: 'Marketing',
    defaultPrice: 75.0,
    unit: 'set',
    description: 'Full color 100lb Gloss Book paper print.',
    isActive: true,
  },
  {
    name: 'DTF Shirt Transfer Print',
    category: 'Apparel',
    defaultPrice: 10.0,
    unit: 'pcs',
    description: 'Direct-to-Film transfer print ready for heat press.',
    isActive: true,
  },
];

const INITIAL_CUSTOMERS = [
  {
    name: 'Alex Rivers',
    businessName: 'Apex Graphic Solutions',
    phone: '+977-9801234567',
    whatsapp: '+977-9801234567',
    email: 'alex@apexmedia.com',
    address: 'Kathmandu, Nepal',
  },
];

async function seed() {
  try {
    const prodRes = await pool.query('SELECT count(*) FROM products');
    const prodCount = parseInt(prodRes.rows[0].count, 10);
    if (prodCount === 0) {
      for (const prod of INITIAL_PRODUCTS) {
        const { cols, placeholders, values } = buildInsertParts(prod);
        await pool.query(`INSERT INTO products (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`, values);
      }
      logger.info(`Inserted ${INITIAL_PRODUCTS.length} initial products.`);
    } else {
      logger.info(`Database already has ${prodCount} products. Skipping.`);
    }

    const custRes = await pool.query('SELECT count(*) FROM customers');
    const custCount = parseInt(custRes.rows[0].count, 10);
    if (custCount === 0) {
      for (const cust of INITIAL_CUSTOMERS) {
        const { cols, placeholders, values } = buildInsertParts(cust);
        await pool.query(`INSERT INTO customers (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`, values);
      }
      logger.info(`Inserted ${INITIAL_CUSTOMERS.length} initial customers.`);
    } else {
      logger.info(`Database already has ${custCount} customers. Skipping.`);
    }

    logger.info('Seeding complete.');
  } catch (err) {
    logger.error('Seeding error:', err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

seed();
