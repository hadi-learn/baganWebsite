import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT) || 3306,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  });

  await conn.execute(`ALTER TABLE match_photos ADD COLUMN file_size INT NULL AFTER sort_order`);
  console.log("✅ Added file_size column to match_photos");

  await conn.end();
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
