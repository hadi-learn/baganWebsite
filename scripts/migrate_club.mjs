import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const dbConfig = {
  host: process.env.DATABASE_HOST || "localhost",
  port: Number(process.env.DATABASE_PORT) || 3306,
  user: process.env.DATABASE_USER || "root",
  password: process.env.DATABASE_PASSWORD || "",
  database: process.env.DATABASE_NAME || "bagan_tournament",
};

async function main() {
  const connection = await mysql.createConnection(dbConfig);
  try {
    console.log("Checking columns in 'matches' table...");
    const [columns] = await connection.query("SHOW COLUMNS FROM matches");
    const existing = columns.map(c => c.Field);
    
    if (!existing.includes('team1_club')) {
      console.log("Adding team1_club...");
      await connection.query("ALTER TABLE matches ADD COLUMN team1_club VARCHAR(255) AFTER team1_name");
    }
    
    if (!existing.includes('team2_club')) {
      console.log("Adding team2_club...");
      await connection.query("ALTER TABLE matches ADD COLUMN team2_club VARCHAR(255) AFTER team2_name");
    }
    
    console.log("Columns checked/added successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await connection.end();
  }
}

main();
