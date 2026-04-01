import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";
import { resolve } from "path";

// Load env
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function seed() {
  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST || "localhost",
    port: Number(process.env.DATABASE_PORT) || 3306,
    user: process.env.DATABASE_USER || "root",
    password: process.env.DATABASE_PASSWORD || "",
    database: process.env.DATABASE_NAME || "bagan_tournament",
    multipleStatements: true,
  });

  console.log("📦 Connected to database");

  // Create tables
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS tournaments (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS categories (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tournament_id INT NOT NULL,
      name VARCHAR(50) NOT NULL,
      label VARCHAR(255) NOT NULL,
      total_teams INT NOT NULL,
      bracket_size INT NOT NULL,
      csv_url TEXT,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
    )
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS \`matches\` (
      id INT PRIMARY KEY AUTO_INCREMENT,
      category_id INT NOT NULL,
      match_code VARCHAR(10) NOT NULL,
      round VARCHAR(10) NOT NULL,
      round_order INT NOT NULL,
      match_order INT NOT NULL,
      team1_name VARCHAR(255),
      team1_seed VARCHAR(50),
      team1_number INT,
      team2_name VARCHAR(255),
      team2_seed VARCHAR(50),
      team2_number INT,
      score_team1 VARCHAR(50),
      score_team2 VARCHAR(50),
      winner INT,
      is_bye BOOLEAN DEFAULT FALSE,
      schedule VARCHAR(255),
      next_match_code VARCHAR(10),
      next_match_slot INT,
      status ENUM('upcoming', 'ongoing', 'completed') DEFAULT 'upcoming',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log("✅ Tables created");

  // Create admin user
  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  // Check if admin exists
  const [existing] = await connection.execute(
    "SELECT id FROM admin_users WHERE username = ?",
    [adminUsername]
  );

  if ((existing as unknown[]).length === 0) {
    await connection.execute(
      "INSERT INTO admin_users (username, password_hash) VALUES (?, ?)",
      [adminUsername, passwordHash]
    );
    console.log(`✅ Admin user created: ${adminUsername}`);
  } else {
    // Update password
    await connection.execute(
      "UPDATE admin_users SET password_hash = ? WHERE username = ?",
      [passwordHash, adminUsername]
    );
    console.log(`✅ Admin user updated: ${adminUsername}`);
  }

  // Create tournament
  const [tournaments] = await connection.execute(
    "SELECT id FROM tournaments LIMIT 1"
  );

  let tournamentId: number;
  if ((tournaments as unknown[]).length === 0) {
    const [result] = await connection.execute(
      "INSERT INTO tournaments (name, description) VALUES (?, ?)",
      [
        "Pak Hite Cup 1",
        "Turnamen Badminton Lokal — Pak Hite Cup 1",
      ]
    );
    tournamentId = (result as { insertId: number }).insertId;
    console.log("✅ Tournament created: Pak Hite Cup 1");
  } else {
    tournamentId = (tournaments as { id: number }[])[0].id;
    console.log("ℹ️  Tournament already exists");
  }

  // Create categories
  const categoryData = [
    {
      name: "U110",
      label: "Umum Kelas Umur 110 Tahun",
      totalTeams: 40,
      bracketSize: 64,
      csvUrl:
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vS1_8u1-SbI2U9qY7OizEvxVBJpky760IhxqT1noYaAlV89smp7msAkumd2qyoeE1t--nbxj_KSlnZ5/pub?gid=1015729012&single=true&output=csv",
      sortOrder: 1,
    },
    {
      name: "U80",
      label: "Umum Kelas Umur 80 Tahun",
      totalTeams: 28,
      bracketSize: 32,
      csvUrl:
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vS1_8u1-SbI2U9qY7OizEvxVBJpky760IhxqT1noYaAlV89smp7msAkumd2qyoeE1t--nbxj_KSlnZ5/pub?gid=1074140472&single=true&output=csv",
      sortOrder: 2,
    },
  ];

  for (const cat of categoryData) {
    const [existing] = await connection.execute(
      "SELECT id FROM categories WHERE tournament_id = ? AND name = ?",
      [tournamentId, cat.name]
    );

    if ((existing as unknown[]).length === 0) {
      await connection.execute(
        "INSERT INTO categories (tournament_id, name, label, total_teams, bracket_size, csv_url, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          tournamentId,
          cat.name,
          cat.label,
          cat.totalTeams,
          cat.bracketSize,
          cat.csvUrl,
          cat.sortOrder,
        ]
      );
      console.log(`✅ Category created: ${cat.name}`);
    } else {
      console.log(`ℹ️  Category already exists: ${cat.name}`);
    }
  }

  console.log("\n🎉 Seed completed successfully!");
  await connection.end();
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
