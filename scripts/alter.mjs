import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST || "localhost",
    port: Number(process.env.DATABASE_PORT) || 3306,
    user: process.env.DATABASE_USER || "root",
    password: process.env.DATABASE_PASSWORD || "",
    database: process.env.DATABASE_NAME || "bagan_tournament",
  });
  
  try {
    await connection.execute(`ALTER TABLE categories ADD COLUMN score_format ENUM('continuous', 'sets') DEFAULT 'continuous' NOT NULL;`);
    console.log("Successfully added score_format column.");
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log("Column already exists.");
    } else {
      console.error(err);
    }
  }
  
  await connection.end();
}
main();
