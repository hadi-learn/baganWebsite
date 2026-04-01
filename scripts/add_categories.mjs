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
    // Get tournament ID
    const [tournaments] = await connection.query("SELECT id FROM tournaments LIMIT 1");
    if (!tournaments.length) {
      console.error("No tournament found!");
      return;
    }
    const tournamentId = tournaments[0].id;

    const newCategories = [
      {
        name: "Internal A-B",
        label: "Internal Kelas A-B",
        totalTeams: 0,
        bracketSize: 64,
        csvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS1_8u1-SbI2U9qY7OizEvxVBJpky760IhxqT1noYaAlV89smp7msAkumd2qyoeE1t--nbxj_KSlnZ5/pub?gid=602841946&single=true&output=csv",
        sortOrder: 3
      },
      {
        name: "Internal C-D",
        label: "Internal Kelas C-D",
        totalTeams: 0,
        bracketSize: 64,
        csvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS1_8u1-SbI2U9qY7OizEvxVBJpky760IhxqT1noYaAlV89smp7msAkumd2qyoeE1t--nbxj_KSlnZ5/pub?gid=430443198&single=true&output=csv",
        sortOrder: 4
      },
      {
        name: "Internal E-F",
        label: "Internal Kelas E-F",
        totalTeams: 0,
        bracketSize: 64,
        csvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS1_8u1-SbI2U9qY7OizEvxVBJpky760IhxqT1noYaAlV89smp7msAkumd2qyoeE1t--nbxj_KSlnZ5/pub?gid=336809692&single=true&output=csv",
        sortOrder: 5
      }
    ];

    for (const cat of newCategories) {
      // Check if already exists
      const [existing] = await connection.query("SELECT id FROM categories WHERE name = ?", [cat.name]);
      if (existing.length > 0) {
        console.log(`Category ${cat.name} already exists, skipping.`);
        continue;
      }

      await connection.query(
        "INSERT INTO categories (tournament_id, name, label, total_teams, bracket_size, csv_url, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [tournamentId, cat.name, cat.label, cat.totalTeams, cat.bracketSize, cat.csvUrl, cat.sortOrder]
      );
      console.log(`Added category: ${cat.name}`);
    }

    console.log("✅ Done adding categories!");
  } catch (error) {
    console.error("DB Error:", error);
  } finally {
    await connection.end();
  }
}

run();
