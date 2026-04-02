export interface ParsedScheduleMatch {
  dayDate: string;       // e.g., "Sabtu, 4 April 2026"
  dayOrder: number;      // sequential day number
  matchOrder: number;    // position within day (1-8)
  time: string;          // e.g., "18:30"
  category: string;      // e.g., "E-F", "64 Tim C-D"
  gameNumber: string;    // e.g., "#1", "#33"
  team1Player1: string | null;
  team1Player2: string | null;
  team1Number: string | null;
  team2Player1: string | null;
  team2Player2: string | null;
  team2Number: string | null;
  scoreTeam1: string | null;
  scoreTeam2: string | null;
  winner: number | null;
  status: "upcoming" | "ongoing" | "completed";
}

export interface ParsedSchedule {
  matches: ParsedScheduleMatch[];
  days: string[];       // unique day dates in order
  categories: string[]; // unique categories found
}

/**
 * Simple CSV row parser that handles quoted fields with commas.
 */
function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/**
 * Clean up a player name string.
 * Removes "(Seed X)" suffix but keeps the core name.
 */
function cleanPlayerName(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "Menunggu Hasil" || trimmed === "#REF!") {
    return trimmed === "Menunggu Hasil" ? "Menunggu Hasil" : null;
  }
  return trimmed;
}

/**
 * Parse the schedule CSV from Google Sheets.
 *
 * Structure per day:
 * - Row with "Hari/Tanggal :" in col[0] → marks start of new day, date in col[2]
 * - Header row (Urutan, Jam Pertandingan, Kelas, ...) → skip
 * - Sub-header row (,,,,,Nomor Tim, Nama, ...) → skip
 * - Match rows come in pairs:
 *   Row 1 (Team A): urutan(0), jam(1), kelas(2), #game(3), [helper](4), nomorTimA(5), namaPlayerA1(6), skorA(7), [view](8), skorB(9), [helper](10), nomorTimB(11), namaPlayerB1(12)
 *   Row 2 (Team B): empty cols, then col(6)=namaPlayerA2, col(12)=namaPlayerB2
 */
export function parseScheduleCSV(csvText: string): ParsedSchedule {
  const lines = csvText.split(/\r?\n/).map((l) => l.replace(/\r$/, ""));
  const rows = lines.map(parseCSVRow);

  const matchesList: ParsedScheduleMatch[] = [];
  const daysSet: string[] = [];
  const categoriesSet = new Set<string>();

  let currentDay = "";
  let dayOrder = 0;
  let i = 0;

  while (i < rows.length) {
    const row = rows[i];

    // Detect day header: col[0] starts with "Hari/Tanggal"
    if ((row[0] || "").trim().startsWith("Hari/Tanggal")) {
      currentDay = (row[2] || "").trim();
      dayOrder++;
      if (currentDay && !daysSet.includes(currentDay)) {
        daysSet.push(currentDay);
      }
      i++;
      // Skip the next 2 rows (header + sub-header)
      i += 2;
      continue;
    }

    // Check if this is a match data row (Team A row)
    // It should have a numeric urutan in col[0] and a time in col[1]
    const urutan = (row[0] || "").trim();
    const time = (row[1] || "").trim();
    const category = (row[2] || "").trim();
    const gameNumber = (row[3] || "").trim();

    if (
      currentDay &&
      urutan &&
      /^\d+$/.test(urutan) &&
      time &&
      /^\d{1,2}:\d{2}$/.test(time)
    ) {
      // Skip invalid rows: "Pilih Kelas" or #REF! data
      if (category === "Pilih Kelas" || category.includes("#REF")) {
        i += 2; // Skip both Team A and Team B rows
        continue;
      }

      // Read Team A data from this row
      const team1Number = (row[5] || "").trim() || null;
      const team1Player1Raw = (row[6] || "").trim();
      const scoreA = (row[7] || "").trim() || null;
      const scoreB = (row[9] || "").trim() || null;
      const team2Number = (row[11] || "").trim() || null;
      const team2Player1Raw = (row[12] || "").trim();

      // Read Team B names from next row
      const nextRow = i + 1 < rows.length ? rows[i + 1] : [];
      const team1Player2Raw = (nextRow[6] || "").trim();
      const team2Player2Raw = (nextRow[12] || "").trim();

      // Clean player names
      const team1Player1 = cleanPlayerName(team1Player1Raw);
      const team1Player2 = cleanPlayerName(team1Player2Raw);
      const team2Player1 = cleanPlayerName(team2Player1Raw);
      const team2Player2 = cleanPlayerName(team2Player2Raw);

      // Skip if team1Number is "Belum Mulai" or similar invalid
      const t1Num = team1Number === "Belum Mulai" ? null : team1Number;
      const t2Num = team2Number === "Belum Mulai" ? null : team2Number;

      // Determine winner based on scores
      let winner: number | null = null;
      let status: "upcoming" | "ongoing" | "completed" = "upcoming";
      
      if (scoreA !== null && scoreB !== null) {
        const s1 = parseInt(scoreA, 10);
        const s2 = parseInt(scoreB, 10);
        // If it was provided, and either is > 0 OR if we explicitly want to allow 0-0 finished (rare)
        // But let's check for "Menunggu Hasil" or empty rows
        if (!isNaN(s1) && !isNaN(s2) && (s1 > 0 || s2 > 0)) {
          status = "completed";
          if (s1 > s2) winner = 1;
          else if (s2 > s1) winner = 2;
        }
      }

      // Track this category
      if (category) {
        categoriesSet.add(category);
      }

      matchesList.push({
        dayDate: currentDay,
        dayOrder,
        matchOrder: parseInt(urutan, 10),
        time,
        category,
        gameNumber,
        team1Player1,
        team1Player2,
        team1Number: t1Num,
        team2Player1,
        team2Player2,
        team2Number: t2Num,
        scoreTeam1: scoreA || "0",
        scoreTeam2: scoreB || "0",
        winner,
        status,
      });

      i += 2; // Advance past both Team A and Team B rows
      continue;
    }

    i++;
  }

  return {
    matches: matchesList,
    days: daysSet,
    categories: Array.from(categoriesSet),
  };
}
