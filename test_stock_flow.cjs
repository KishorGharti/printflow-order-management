const { pool } = require('./backend/src/config/db');

async function check() {
  const rows = await pool.query("SELECT id, local_id, name, parent_id, parent_name, is_archived FROM stock_items");
  console.log('Total items in stock_items:', rows.rows.length);
  const parents = rows.rows.filter(r => !r.parent_id);
  console.log('Items with NO parent_id:', parents.map(p => ({ id: p.id, local_id: p.local_id, name: p.name })));
  const subitems = rows.rows.filter(r => r.parent_id);
  console.log('Items WITH parent_id:', subitems.map(s => ({ id: s.id, name: s.name, parent_id: s.parent_id, parent_name: s.parent_name })));
  await pool.end();
}

check().catch(console.error);
