import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || "3306"),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  });

  try {
    const [rows, fields] = await connection.query("SELECT * FROM tournaments");
    console.log("Tournaments:", rows);
    
    const [cols] = await connection.query("SHOW COLUMNS FROM tournaments");
    console.log("Tournament columns:", cols);
  } catch (error) {
    console.error("DB Error:", error);
  } finally {
    await connection.end();
  }
}

run();
