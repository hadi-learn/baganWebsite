import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

// Local copies of normalization logic for the script
function normalizeMatchCode(code) {
  if (!code) return "";
  return code.toString().replace(/\D/g, "");
}

function normalizeCategoryName(name) {
  if (!name) return "";
  return name.toLowerCase()
    .replace(/\s+/g, "")
    .replace(/\d+tim/g, "")
    .trim();
}

function getUnifiedMatchCode(category, matchCode) {
  const normCat = normalizeCategoryName(category);
  const normCode = normalizeMatchCode(matchCode);
  return `${normCat}-${normCode}`;
}

async function main() {
  console.log("Migrating gallery match codes to standardized format...");

  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST || "localhost",
    port: Number(process.env.DATABASE_PORT) || 3306,
    user: process.env.DATABASE_USER || "root",
    password: process.env.DATABASE_PASSWORD || "",
    database: process.env.DATABASE_NAME || "bagan_tournament",
  });

  try {
    // 1. Fetch all photos
    const [rows] = await connection.execute("SELECT id, match_code FROM match_photos");
    console.log(`Found ${rows.length} photos to check.`);

    let updatedCount = 0;

    for (const row of rows) {
      const oldCode = row.match_code;
      if (!oldCode || !oldCode.includes("-")) {
        console.log(`Skipping invalid code: ${oldCode} (ID: ${row.id})`);
        continue;
      }

      // Format was: "Category Name-Number"
      const lastDashIdx = oldCode.lastIndexOf("-");
      const categoryPart = oldCode.substring(0, lastDashIdx);
      const codePart = oldCode.substring(lastDashIdx + 1);

      const newCode = getUnifiedMatchCode(categoryPart, codePart);

      if (newCode !== oldCode) {
        console.log(`Updating ID ${row.id}: "${oldCode}" -> "${newCode}"`);
        await connection.execute(
          "UPDATE match_photos SET match_code = ? WHERE id = ?",
          [newCode, row.id]
        );
        updatedCount++;
      }
    }

    console.log(`Migration complete. Updated ${updatedCount} photos.`);
  } catch (error) {
    console.error("Migration error:", error);
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
