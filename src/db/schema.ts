import {
  mysqlTable,
  int,
  varchar,
  text,
  boolean,
  timestamp,
  mysqlEnum,
} from "drizzle-orm/mysql-core";

export const tournaments = mysqlTable("tournaments", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  footerText: varchar("footer_text", { length: 255 }), // e.g., "© 2026 Bagan Pertandingan"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const categories = mysqlTable("categories", {
  id: int("id").primaryKey().autoincrement(),
  tournamentId: int("tournament_id")
    .notNull()
    .references(() => tournaments.id),
  name: varchar("name", { length: 50 }).notNull(), // e.g., "U110", "U80"
  label: varchar("label", { length: 255 }).notNull(), // e.g., "Umum Kelas Umur 110 Tahun"
  totalTeams: int("total_teams").notNull(),
  bracketSize: int("bracket_size").notNull(), // e.g., 64, 32
  scoreFormat: mysqlEnum("score_format", ["continuous", "sets"]).default("continuous").notNull(),
  csvUrl: text("csv_url"), // Google Spreadsheet CSV link
  customTags: text("custom_tags"), // Comma-separated tags e.g., "40 Pasang, Kuota Penuh"
  autoImportInterval: int("auto_import_interval").default(0).notNull(), // in minutes, 0 means manual
  lastImportedAt: timestamp("last_imported_at"),
  sortOrder: int("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const matches = mysqlTable("matches", {
  id: int("id").primaryKey().autoincrement(),
  categoryId: int("category_id")
    .notNull()
    .references(() => categories.id),
  matchCode: varchar("match_code", { length: 10 }).notNull(), // e.g., "M1", "M33"
  round: varchar("round", { length: 10 }).notNull(), // e.g., "R64", "R32", "R16", "QF", "SF", "F"
  roundOrder: int("round_order").notNull(), // numeric order (0=R64, 1=R32, etc.)
  matchOrder: int("match_order").notNull(), // position within round (top to bottom)
  team1Name: varchar("team1_name", { length: 255 }),
  team1Seed: varchar("team1_seed", { length: 50 }), // e.g., "[U1]"
  team1Number: int("team1_number"), // seeding number e.g., 28
  team2Name: varchar("team2_name", { length: 255 }),
  team2Seed: varchar("team2_seed", { length: 50 }),
  team2Number: int("team2_number"),
  scoreTeam1: varchar("score_team1", { length: 50 }),
  scoreTeam2: varchar("score_team2", { length: 50 }),
  winner: int("winner"), // 1 or 2 or null
  isBye: boolean("is_bye").default(false).notNull(),
  schedule: varchar("schedule", { length: 255 }), // e.g., "Kamis / 16 April 2026, @19:30"
  nextMatchCode: varchar("next_match_code", { length: 10 }), // match winner advances to
  nextMatchSlot: int("next_match_slot"), // 1 or 2 — which team slot in next match
  status: mysqlEnum("status", ["upcoming", "ongoing", "completed"])
    .default("upcoming")
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const adminUsers = mysqlTable("admin_users", {
  id: int("id").primaryKey().autoincrement(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const scheduleMatches = mysqlTable("schedule_matches", {
  id: int("id").primaryKey().autoincrement(),
  tournamentId: int("tournament_id")
    .notNull()
    .references(() => tournaments.id),
  dayDate: varchar("day_date", { length: 100 }).notNull(), // e.g., "Sabtu, 4 April 2026"
  dayOrder: int("day_order").notNull(), // sequential day number (1, 2, 3...)
  matchOrder: int("match_order").notNull(), // position within the day (1-8)
  time: varchar("time", { length: 10 }).notNull(), // e.g., "18:30"
  category: varchar("category", { length: 50 }).notNull(), // e.g., "E-F", "64 Tim C-D"
  gameNumber: varchar("game_number", { length: 20 }).notNull(), // e.g., "#1", "#33"
  team1Player1: varchar("team1_player1", { length: 255 }),
  team1Player2: varchar("team1_player2", { length: 255 }),
  team1Number: varchar("team1_number", { length: 20 }),
  team2Player1: varchar("team2_player1", { length: 255 }),
  team2Player2: varchar("team2_player2", { length: 255 }),
  team2Number: varchar("team2_number", { length: 20 }),
  scoreTeam1: varchar("score_team1", { length: 50 }),
  scoreTeam2: varchar("score_team2", { length: 50 }),
  winner: int("winner"), // 1 or 2 or null
  status: mysqlEnum("status", ["upcoming", "ongoing", "completed"])
    .default("upcoming")
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const scheduleSettings = mysqlTable("schedule_settings", {
  id: int("id").primaryKey().autoincrement(),
  tournamentId: int("tournament_id")
    .notNull()
    .references(() => tournaments.id),
  csvUrl: text("csv_url"),
  autoImportInterval: int("auto_import_interval").default(0).notNull(),
  categoryConfig: text("category_config"), // JSON: [{name, displayName, sortOrder}]
  lastImportedAt: timestamp("last_imported_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const matchPhotos = mysqlTable("match_photos", {
  id: int("id").primaryKey().autoincrement(),
  matchCode: varchar("match_code", { length: 255 }).notNull(), // Unified code e.g. "1" from "M1" or "#1"
  cloudinaryPublicId: varchar("cloudinary_public_id", { length: 255 }).notNull(),
  url: varchar("url", { length: 500 }).notNull(),
  sortOrder: int("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
