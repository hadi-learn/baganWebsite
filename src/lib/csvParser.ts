export interface ParsedMatch {
  matchCode: string;
  round: string;
  roundOrder: number;
  matchOrder: number;
  team1Name: string | null;
  team1Seed: string | null;
  team1Number: number | null;
  team2Name: string | null;
  team2Seed: string | null;
  team2Number: number | null;
  scoreTeam1: string | null;
  scoreTeam2: string | null;
  winner: number | null;
  isBye: boolean;
  schedule: string | null;
  nextMatchCode: string | null;
  nextMatchSlot: number | null;
  status: "upcoming" | "ongoing" | "completed";
}

export interface ParsedCategory {
  name: string;
  totalTeams: number;
  bracketSize: number;
  matches: ParsedMatch[];
}

/**
 * Determine round info based on bracket size and column position.
 */
function getRoundInfo(
  bracketSize: number,
  colGroup: number
): { round: string; roundOrder: number } {
  if (bracketSize === 64) {
    const rounds = [
      { round: "R64", roundOrder: 0 },
      { round: "R32", roundOrder: 1 },
      { round: "R16", roundOrder: 2 },
      { round: "QF", roundOrder: 3 },
      { round: "SF", roundOrder: 4 },
      { round: "F", roundOrder: 5 },
    ];
    return rounds[colGroup] || { round: "R64", roundOrder: 0 };
  } else if (bracketSize === 32) {
    const rounds = [
      { round: "R32", roundOrder: 0 },
      { round: "R16", roundOrder: 1 },
      { round: "QF", roundOrder: 2 },
      { round: "SF", roundOrder: 3 },
      { round: "F", roundOrder: 4 },
    ];
    return rounds[colGroup] || { round: "R32", roundOrder: 0 };
  }
  return { round: "R1", roundOrder: 0 };
}

/**
 * Parse a team string like "  [28] ⭐ [U1] Tri Cahyo / Edy Dekor"
 * Returns { name, seed, number }
 */
function parseTeamString(raw: string): {
  name: string;
  seed: string | null;
  number: number | null;
} {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "— BYE —" || trimmed === "—BYE—") {
    return { name: "", seed: null, number: null };
  }

  // Match pattern: [number] optional_star [seed] name
  // e.g. "[28] ⭐ [U1] Tri Cahyo / Edy Dekor"
  // or "[9] Aribowo / Daffa Zein"
  // or "▶ Menunggu M33"
  const waitingMatch = trimmed.match(/▶\s*Menunggu\s+(M\d+)/);
  if (waitingMatch) {
    return { name: `▶ Menunggu ${waitingMatch[1]}`, seed: null, number: null };
  }

  let number: number | null = null;
  let seed: string | null = null;
  let name = trimmed;

  // Extract [number] at the start
  const numMatch = name.match(/^\[(\d+)\]\s*/);
  if (numMatch) {
    number = parseInt(numMatch[1], 10);
    name = name.substring(numMatch[0].length);
  }

  // Remove star emoji
  name = name.replace(/⭐\s*/g, "").trim();

  // Extract [seed] like [U1], [U2], [U3/4], [U5/8]
  const seedMatch = name.match(/^\[([^\]]+)\]\s*/);
  if (seedMatch) {
    seed = seedMatch[1];
    name = name.substring(seedMatch[0].length);
  }

  return { name: name.trim(), seed, number };
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
 * Parse the Google Spreadsheet CSV for a tournament bracket.
 *
 * The CSV has a specific structure:
 * - Row 0: Title (e.g., "🏸  U110  —  BAGAN PERTANDINGAN")
 * - Row 1: Info (total teams, bracket size)
 * - Row 3: Round headers
 * - Remaining rows: Match data
 *
 * Match data rows come in pairs:
 *   - Row with "M{n}" in column 0: team 1 info
 *   - Next row: team 2 info or schedule
 */
export function parseCSV(csvText: string): ParsedCategory {
  const lines = csvText.split(/\r?\n/).map((l) => l.replace(/\r$/, ""));
  const rows = lines.map(parseCSVRow);

  // Parse header for category info
  const titleRow = rows[0] || [];
  const titleText = titleRow[0] || "";
  const catMatch = titleText.match(/([A-Z]\d+)/);
  const categoryName = catMatch ? catMatch[1] : "Unknown";

  const infoRow = rows[1] || [];
  const infoText = infoRow[0] || "";
  const totalMatch = infoText.match(/Total:\s*(\d+)/);
  const sizeMatch = infoText.match(/Ukuran Bagan:\s*(\d+)/);
  const totalTeams = totalMatch ? parseInt(totalMatch[1], 10) : 0;
  const bracketSize = sizeMatch ? parseInt(sizeMatch[1], 10) : 64; // default 64

  // Function to calculate exact next match mathematically
  function getNextMatchInfo(matchNum: number, bSize: number) {
    let currentRoundBase = 0;
    let nextRoundBase = bSize / 2;
    let roundMatches = bSize / 2;

    while (roundMatches >= 1) {
      if (matchNum <= currentRoundBase + roundMatches) {
        if (roundMatches === 1) return { nextMatchCode: null, nextMatchSlot: null }; // Final
        
        const relativeMatchNum = matchNum - currentRoundBase;
        const nextRelativeMatchNum = Math.ceil(relativeMatchNum / 2);
        const nextAbsoluteMatchNum = nextRoundBase + nextRelativeMatchNum;
        const slot = relativeMatchNum % 2 !== 0 ? 1 : 2;
        
        return {
          nextMatchCode: `M${nextAbsoluteMatchNum}`,
          nextMatchSlot: slot
        };
      }
      currentRoundBase += roundMatches;
      roundMatches /= 2;
      nextRoundBase += roundMatches;
    }
    return { nextMatchCode: null, nextMatchSlot: null };
  }

  // Pre-generate the structural full bracket
  const matchEntriesMap = new Map<string, ParsedMatch>();
  const totalMatches = bracketSize - 1;
  for (let i = 1; i <= totalMatches; i++) {
    const roundInfo = determineRoundFromMatchNumber(i, bracketSize);
    const nextInfo = getNextMatchInfo(i, bracketSize);
    
    matchEntriesMap.set(`M${i}`, {
      matchCode: `M${i}`,
      round: roundInfo.round,
      roundOrder: roundInfo.roundOrder,
      matchOrder: i,
      team1Name: null,
      team1Seed: null,
      team1Number: null,
      team2Name: null,
      team2Seed: null,
      team2Number: null,
      scoreTeam1: null,
      scoreTeam2: null,
      winner: null,
      isBye: false,
      schedule: null,
      nextMatchCode: nextInfo.nextMatchCode,
      nextMatchSlot: nextInfo.nextMatchSlot,
      status: "upcoming"
    });
  }

  // Scan all rows and columns to find Match Codes and populate data
  for (let r = 4; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const cell = (row[c] || "").trim();
      const matchCodeMatch = cell.match(/^(M\d+)$/);
      
      if (matchCodeMatch) {
        const matchCode = matchCodeMatch[1];
        const matchObj = matchEntriesMap.get(matchCode);
        
        if (matchObj) {
          // Found a match block! Usually Team 1 is at row[c+1] and Team 2 is at nextRow[c+1]
          const team1Raw = (row[c + 1] || "").trim();
          const nextRow = r + 1 < rows.length ? rows[r + 1] : [];
          const team2Raw = (nextRow[c + 1] || "").trim();
          
          if (team1Raw) {
            const parsed1 = parseTeamString(team1Raw);
            matchObj.team1Name = parsed1.name || null;
            matchObj.team1Seed = parsed1.seed;
            matchObj.team1Number = parsed1.number;
          }
          if (team2Raw) {
            const parsed2 = parseTeamString(team2Raw);
            matchObj.team2Name = parsed2.name || null;
            matchObj.team2Seed = parsed2.seed;
            matchObj.team2Number = parsed2.number;
          }

          // Parse scores (usually adjacent to the team name)
          const score1Raw = (row[c + 2] || "").trim();
          const score2Raw = (nextRow[c + 2] || "").trim();

          if (score1Raw && score1Raw !== "") matchObj.scoreTeam1 = score1Raw;
          if (score2Raw && score2Raw !== "") matchObj.scoreTeam2 = score2Raw;

          matchObj.isBye = (team1Raw === "— BYE —" || team2Raw === "— BYE —" || team1Raw === "—BYE—" || team2Raw === "—BYE—");
          if (matchObj.isBye) {
            matchObj.status = "completed";
            // For byes, the team that is NOT BYE advances
            if (team1Raw === "— BYE —" || team1Raw === "—BYE—") matchObj.winner = 2;
            if (team2Raw === "— BYE —" || team2Raw === "—BYE—") matchObj.winner = 1;
          } else if (matchObj.scoreTeam1 && matchObj.scoreTeam2) {
             matchObj.status = "completed";
             // Basic auto-winner detection if scores are numeric
             const s1 = parseInt(matchObj.scoreTeam1, 10);
             const s2 = parseInt(matchObj.scoreTeam2, 10);
             if (!isNaN(s1) && !isNaN(s2)) {
                if (s1 > s2) matchObj.winner = 1;
                else if (s2 > s1) matchObj.winner = 2;
             }
          }

          // Try to find schedule in the vicinity of the match code (r, c)
          // BUT only if this is NOT a BYE match
          if (!matchObj.isBye) {
            const prevRow = r > 0 ? rows[r - 1] : [];
            const checkRows = [prevRow, row, nextRow];
            
            for (const targetRow of checkRows) {
              if (!targetRow) continue;
              // Check columns c to c+6
              for (let sc = c; sc <= c + 6; sc++) {
                const cellText = (targetRow[sc] || "").trim();
                if (cellText && /\d{1,2}\s+\w+\s+\d{4}/.test(cellText)) {
                  // If it contains a date pattern, assume it is the schedule
                  matchObj.schedule = cellText;
                  break;
                }
              }
              if (matchObj.schedule) break;
            }
          }
        }
      }
    }
  }

  return {
    name: categoryName,
    totalTeams,
    bracketSize,
    matches: Array.from(matchEntriesMap.values()),
  };
}

function determineRoundFromMatchNumber(
  matchNum: number,
  bracketSize: number
): { round: string; roundOrder: number } {
  if (bracketSize === 64) {
    if (matchNum <= 32) return { round: "R64", roundOrder: 0 };
    if (matchNum <= 48) return { round: "R32", roundOrder: 1 };
    if (matchNum <= 56) return { round: "R16", roundOrder: 2 };
    if (matchNum <= 60) return { round: "QF", roundOrder: 3 };
    if (matchNum <= 62) return { round: "SF", roundOrder: 4 };
    return { round: "F", roundOrder: 5 };
  } else if (bracketSize === 32) {
    if (matchNum <= 16) return { round: "R32", roundOrder: 0 };
    if (matchNum <= 24) return { round: "R16", roundOrder: 1 };
    if (matchNum <= 28) return { round: "QF", roundOrder: 2 };
    if (matchNum <= 30) return { round: "SF", roundOrder: 3 };
    return { round: "F", roundOrder: 4 };
  } else if (bracketSize === 16) {
    if (matchNum <= 8) return { round: "R16", roundOrder: 0 };
    if (matchNum <= 12) return { round: "QF", roundOrder: 1 };
    if (matchNum <= 14) return { round: "SF", roundOrder: 2 };
    return { round: "F", roundOrder: 3 };
  } else if (bracketSize === 8) {
    if (matchNum <= 4) return { round: "QF", roundOrder: 0 };
    if (matchNum <= 6) return { round: "SF", roundOrder: 1 };
    return { round: "F", roundOrder: 2 };
  } else if (bracketSize === 4) {
    if (matchNum <= 2) return { round: "SF", roundOrder: 0 };
    return { round: "F", roundOrder: 1 };
  }
  return { round: "R1", roundOrder: 0 };
}
