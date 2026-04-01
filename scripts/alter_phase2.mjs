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
    console.log("Checking tournaments table...");
    const [tCols] = await connection.query("SHOW COLUMNS FROM tournaments LIKE 'footer_text'");
    if (tCols.length === 0) {
      console.log("Adding footer_text to tournaments...");
      await connection.query("ALTER TABLE tournaments ADD COLUMN footer_text VARCHAR(255)");
    }

    console.log("Checking categories table...");
    const [cColsTags] = await connection.query("SHOW COLUMNS FROM categories LIKE 'custom_tags'");
    if (cColsTags.length === 0) {
      console.log("Adding custom_tags to categories...");
      await connection.query("ALTER TABLE categories ADD COLUMN custom_tags TEXT");
    }

    const [cColsInterval] = await connection.query("SHOW COLUMNS FROM categories LIKE 'auto_import_interval'");
    if (cColsInterval.length === 0) {
      console.log("Adding auto_import_interval to categories...");
      await connection.query("ALTER TABLE categories ADD COLUMN auto_import_interval INT NOT NULL DEFAULT 0");
    }

    const [cColsLastImport] = await connection.query("SHOW COLUMNS FROM categories LIKE 'last_imported_at'");
    if (cColsLastImport.length === 0) {
      console.log("Adding last_imported_at to categories...");
      await connection.query("ALTER TABLE categories ADD COLUMN last_imported_at TIMESTAMP NULL DEFAULT NULL");
    }

    console.log("Schema update completed successfully.");
  } catch (error) {
    console.error("Error updating schema:", error);
  } finally {
    await connection.end();
  }
}

run();
