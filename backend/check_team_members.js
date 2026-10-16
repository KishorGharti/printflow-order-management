const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function check() {
  const allTeam = await pool.query("SELECT id, name, role, business_id, pin, phone FROM team_members");
  console.log('All team members:', allTeam.rows);
  await pool.end();
}
check().catch(console.error);
