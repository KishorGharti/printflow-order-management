'use strict';

const { pool } = require('../config/db');

function getBusinessPrefix(businessId, shopCode, businessName) {
  if (businessId === 'global_settings') return 'PG';
  if (shopCode) {
    const clean = shopCode.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
    if (clean) return clean;
  }
  if (businessName) {
    const clean = businessName.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
    if (clean) return clean;
  }
  const cleanId = String(businessId || '').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
  return cleanId || 'EMP';
}

async function migrate() {
  console.log('🔄 Starting migration to Store-Prefixed Employee IDs...');

  // Fetch all businesses
  const bizRes = await pool.query('SELECT business_id, name, shop_code FROM businesses');
  const bizMap = new Map();
  for (const b of bizRes.rows) {
    bizMap.set(b.business_id, getBusinessPrefix(b.business_id, b.shop_code, b.name));
  }

  // Also check saas_clients
  const clientRes = await pool.query('SELECT business_id, name, shop_code FROM saas_clients WHERE business_id IS NOT NULL');
  for (const c of clientRes.rows) {
    if (!bizMap.has(c.business_id)) {
      bizMap.set(c.business_id, getBusinessPrefix(c.business_id, c.shop_code, c.name));
    }
  }

  // For each business, fetch its team members ordered by created_at or id
  const businesses = [...bizMap.keys()];
  for (const bId of businesses) {
    const prefix = bizMap.get(bId) || 'PG';
    const membersRes = await pool.query(
      'SELECT id, name, employee_id FROM team_members WHERE business_id = $1 ORDER BY created_at ASC, id ASC',
      [bId]
    );

    let counter = 1;
    for (const mem of membersRes.rows) {
      const newEmpId = `${prefix}-EMP-${String(counter).padStart(3, '0')}`;
      await pool.query(
        'UPDATE team_members SET employee_id = $1 WHERE id = $2',
        [newEmpId, mem.id]
      );
      console.log(`  [${bId}] ${mem.name} -> ${newEmpId} (was: ${mem.employee_id})`);
      counter++;
    }
  }

  console.log('\n✅ Completed migration to Store-Prefixed Employee IDs!');

  // Display result
  const finalRes = await pool.query(
    'SELECT business_id, employee_id, name, role FROM team_members ORDER BY business_id, employee_id ASC'
  );
  console.table(finalRes.rows);

  await pool.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
