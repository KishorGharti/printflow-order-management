'use strict';
const { pool } = require('../config/db');

async function run() {
  const res = await pool.query(
    "SELECT id, expense_number, title, category, linked_purchase_id, stock_quantity, created_at FROM expenses WHERE business_id = 'ram-2f52a600' AND linked_purchase_id IS NOT NULL AND linked_purchase_id != ''"
  );
  console.log('Linked expenses count:', res.rows.length);
  for (const exp of res.rows) {
    const stock = await pool.query("SELECT id, name, quantity, unit, parent_id FROM stock_items WHERE id::text = $1 OR local_id = $1", [exp.linked_purchase_id]);
    console.log({
      expenseId: exp.id,
      title: exp.title,
      stockQuantity: exp.stock_quantity,
      linkedId: exp.linked_purchase_id,
      matchedStock: stock.rows[0] ? { name: stock.rows[0].name, quantity: stock.rows[0].quantity, unit: stock.rows[0].unit } : 'NOT FOUND'
    });
  }
  await pool.end();
}

run();
