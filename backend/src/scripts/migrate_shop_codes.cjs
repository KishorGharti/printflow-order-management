const { pool } = require('../config/db');

async function migrateShopCodes() {
  console.log('🔄 Running migration for Shop Code and Employee ID...');

  // 1. Add shop_code column to businesses and saas_clients
  await pool.query(`
    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS shop_code TEXT;
    ALTER TABLE saas_clients ADD COLUMN IF NOT EXISTS shop_code TEXT;
    ALTER TABLE team_members ADD COLUMN IF NOT EXISTS employee_id TEXT;
  `);

  // 2. Generate shop_codes for existing businesses
  const bizRes = await pool.query(`SELECT id, business_id, name, slug, shop_code FROM businesses ORDER BY created_at ASC`);
  const usedCodes = new Set();

  for (let i = 0; i < bizRes.rows.length; i++) {
    const b = bizRes.rows[i];
    let code = b.shop_code;
    if (!code) {
      if (b.business_id === 'global_settings' || b.name.toLowerCase().includes('bagbazar')) {
        code = 'PGBAG01';
      } else {
        // Generate prefix from business name
        const cleanName = b.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        let prefix = cleanName.slice(0, 5) || 'STORE';
        if (prefix.length < 5) prefix = (prefix + 'XXXXX').slice(0, 5);
        let seq = 1;
        code = `${prefix}${String(seq).padStart(2, '0')}`;
        while (usedCodes.has(code)) {
          seq++;
          code = `${prefix}${String(seq).padStart(2, '0')}`;
        }
      }
    }
    usedCodes.add(code);
    await pool.query(`UPDATE businesses SET shop_code = $1 WHERE id = $2`, [code, b.id]);
    await pool.query(`UPDATE saas_clients SET shop_code = $1 WHERE business_id = $2`, [code, b.business_id]);
    console.log(`  🏢 Business "${b.name}" (${b.business_id}) → Shop Code: ${code}`);
  }

  // 3. Generate employee_id for existing team_members within each business
  const teamRes = await pool.query(`SELECT id, business_id, name, local_id, employee_id FROM team_members ORDER BY business_id, created_at ASC`);
  const bizCounter = {};

  for (const tm of teamRes.rows) {
    if (!tm.employee_id) {
      const biz = tm.business_id || 'global_settings';
      bizCounter[biz] = (bizCounter[biz] || 0) + 1;
      const empId = `EMP-${String(bizCounter[biz]).padStart(3, '0')}`;
      await pool.query(`UPDATE team_members SET employee_id = $1 WHERE id = $2`, [empId, tm.id]);
      console.log(`  👤 Team Member "${tm.name}" (${biz}) → Employee ID: ${empId}`);
    }
  }

  // 4. Create index on shop_code
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_businesses_shop_code ON businesses (LOWER(shop_code));
    CREATE INDEX IF NOT EXISTS idx_team_members_employee_id ON team_members (LOWER(employee_id));
  `);

  console.log('✅ Migration completed successfully!');
  process.exit(0);
}

migrateShopCodes().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
