import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST || "localhost",
    port: Number(process.env.DATABASE_PORT) || 3306,
    user: process.env.DATABASE_USER || "root",
    password: process.env.DATABASE_PASSWORD || "",
    database: process.env.DATABASE_NAME || "bagan_tournament",
  });

  try {
    console.log("Adding 'type' column to match_photos table...");
    await connection.execute(`
      ALTER TABLE match_photos 
      ADD COLUMN type ENUM('match', 'general') NOT NULL DEFAULT 'match' AFTER url
    `);
    console.log("Success!");
  } catch (error) {
    if (error.code === 'ER_DUP_COLUMN_NAME') {
      console.log("Column 'type' already exists.");
    } else {
      console.error("Migration error:", error);
    }
  } finally {
    await connection.end();
  }
}

main();
