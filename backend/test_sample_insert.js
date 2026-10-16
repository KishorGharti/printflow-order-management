const { Pool } = require('pg');
require('dotenv').config();
const { buildInsertParts } = require('./src/config/dbHelpers');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const cols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'orders'");
  console.log('Columns:', cols.rows.map(r => r.column_name));

  // Let's test a sample order with all potential fields from frontend
  const sample = {
    orderNumber: 'JOB-9999',
    customerId: '212d60ad-3e6c-4ad1-9ffe-b9be831c9777', // Nabin Oli (design ghar)
    customerName: 'design ghar',
    customerPhone: '9812345678',
    customerEmail: '',
    customerWhatsapp: '1234567898',
    orderContactName: '',
    orderContactPhone: '',
    items: [{
      id: 'draft-1',
      productId: '8e989d57-4648-494e-a6e6-9fbaeff15c62',
      productName: 'banner',
      quantity: 1,
      unitPrice: 1000,
      lineTotal: 1000
    }],
    totalAmount: 1000,
    orderDate: '2026-09-29',
    dueDate: '2026-09-30',
    dueTime: '17:00',
    status: 'New',
    media: [],
    history: [{ status: 'New', timestamp: new Date().toISOString() }],
    stockAllocations: [],
    businessId: 'mohan-421dd538'
  };

  const { cols: c, placeholders: p, values: v } = buildInsertParts(sample);
  console.log('Inserting with cols:', c);
  try {
    const res = await pool.query(
      `INSERT INTO orders (${c.join(', ')}) VALUES (${p.join(', ')}) RETURNING *`,
      v
    );
    console.log('Success! Inserted order ID:', res.rows[0].id);
    await pool.query("DELETE FROM orders WHERE id = $1", [res.rows[0].id]);
  } catch (e) {
    console.error('Insert error:', e);
  }

  await pool.end();
}

check().catch(console.error);
