'use strict';

require('dotenv').config();
const { pool } = require('../config/db');

async function update() {
  try {
    await pool.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS pan TEXT NOT NULL DEFAULT '';`);
    await pool.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS pan_number TEXT NOT NULL DEFAULT '';`);
    console.log('✅ Altered customers table to add pan and pan_number successfully.');
  } catch (err) {
    console.error('Error altering table:', err);
  } finally {
    await pool.end();
  }
}

update();
