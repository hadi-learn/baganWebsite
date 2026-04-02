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
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS schedule_matches (
        id INT(11) PRIMARY KEY AUTO_INCREMENT,
        tournament_id INT(11) NOT NULL,
        day_date VARCHAR(100) NOT NULL,
        day_order INT(11) NOT NULL,
        match_order INT(11) NOT NULL,
        time VARCHAR(10) NOT NULL,
        category VARCHAR(50) NOT NULL,
        game_number VARCHAR(20) NOT NULL,
        team1_player1 VARCHAR(255),
        team1_player2 VARCHAR(255),
        team1_number VARCHAR(20),
        team2_player1 VARCHAR(255),
        team2_player2 VARCHAR(255),
        team2_number VARCHAR(20),
        score_team1 VARCHAR(50),
        score_team2 VARCHAR(50),
        winner INT(11),
        status ENUM('upcoming', 'ongoing', 'completed') DEFAULT 'upcoming' NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
      )
    `);
    console.log("✅ schedule_matches table created");

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS schedule_settings (
        id INT(11) PRIMARY KEY AUTO_INCREMENT,
        tournament_id INT(11) NOT NULL,
        csv_url TEXT,
        auto_import_interval INT(11) DEFAULT 0 NOT NULL,
        last_imported_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
      )
    `);
    console.log("✅ schedule_settings table created");

    // Insert default schedule settings
    const [existing] = await connection.query("SELECT id FROM schedule_settings LIMIT 1");
    if (!existing.length) {
      const [tournaments] = await connection.query("SELECT id FROM tournaments LIMIT 1");
      if (tournaments.length) {
        await connection.execute(
          "INSERT INTO schedule_settings (tournament_id, csv_url) VALUES (?, ?)",
          [tournaments[0].id, "https://docs.google.com/spreadsheets/d/e/2PACX-1vQNLCLM5de-_TTQFTdsQZcFMYiZIB7MRb0FsPgwCeYhXlHp0ycDhNLmi8af8EXpCguSoySFwGgfIKVE/pub?gid=883773874&single=true&output=csv"]
        );
        console.log("✅ Default schedule settings inserted");
      }
    }

    console.log("🎉 Done!");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await connection.end();
  }
}

run();
