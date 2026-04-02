import { NextResponse } from "next/server";
import { db } from "@/db";
import { scheduleMatches, scheduleSettings, tournaments, categories, matches } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";
import { parseScheduleCSV } from "@/lib/scheduleParser";
import { parsePlayerInfo, normalizeMatchCode, normalizeCategoryName } from "@/lib/playerUtils";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value;
    if (!token || !(await decrypt(token))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get schedule settings
    const settings = await db.select().from(scheduleSettings).limit(1);
    if (settings.length === 0 || !settings[0].csvUrl) {
      return NextResponse.json({ error: "No schedule CSV URL configured" }, { status: 400 });
    }

    const csvUrl = settings[0].csvUrl;
    const tournamentId = settings[0].tournamentId;

    // Fetch CSV
    const response = await fetch(csvUrl, { cache: "no-store" });
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch CSV" }, { status: 500 });
    }

    const csvText = await response.text();
    const parsed = parseScheduleCSV(csvText);

    // Clear existing schedule matches for this tournament
    await db.delete(scheduleMatches).where(eq(scheduleMatches.tournamentId, tournamentId));

    // Insert new matches
    if (parsed.matches.length > 0) {
      const insertData = parsed.matches.map((m) => ({
        tournamentId,
        dayDate: m.dayDate,
        dayOrder: m.dayOrder,
        matchOrder: m.matchOrder,
        time: m.time,
        category: m.category,
        gameNumber: m.gameNumber,
        team1Player1: m.team1Player1,
        team1Player2: m.team1Player2,
        team1Number: m.team1Number,
        team2Player1: m.team2Player1,
        team2Player2: m.team2Player2,
        team2Number: m.team2Number,
        scoreTeam1: m.scoreTeam1,
        scoreTeam2: m.scoreTeam2,
        winner: m.winner,
        status: m.status,
      }));

      // Insert in batches of 50
      for (let i = 0; i < insertData.length; i += 50) {
        const batch = insertData.slice(i, i + 50);
        await db.insert(scheduleMatches).values(batch);
      }
    }

    // Update last imported timestamp + auto-generate category config
    // Preserve existing display names if already set
    let existingConfig: Array<{name: string; displayName: string; sortOrder: number}> = [];
    try {
      existingConfig = settings[0].categoryConfig ? JSON.parse(settings[0].categoryConfig) : [];
    } catch { /* ignore */ }

    const defaultOrder: Record<string, number> = {
      "64 Tim U110": 1, "U80": 2, "64 Tim A-B": 3, "64 Tim C-D": 4, "E-F": 5,
    };

    const newConfig = parsed.categories.map((cat, idx) => {
      const existing = existingConfig.find((c) => c.name === cat);
      return {
        name: cat,
        displayName: existing?.displayName || cat,
        sortOrder: existing?.sortOrder ?? defaultOrder[cat] ?? (10 + idx),
      };
    }).sort((a, b) => a.sortOrder - b.sortOrder);

    await db
      .update(scheduleSettings)
      .set({ lastImportedAt: new Date(), categoryConfig: JSON.stringify(newConfig) })
      .where(eq(scheduleSettings.id, settings[0].id));

    // --- SYNC CLUB INFO TO BRACKET (MATCHES TABLE) ---
    // 1. Load all categories to map normalized name -> id
    const allCats = await db.select().from(categories);
    const catMap: Record<string, number> = {};
    allCats.forEach(c => {
      catMap[normalizeCategoryName(c.name)] = c.id;
    });

    // 2. Process each parsed match if needed (we'll use the optimized loop below for DB efficiency)
    // We already have the optimized loop below, so we'll just ensure it uses normalizeCategoryName.

    // Optimization: Bulk fetch bracket matches for categories found in schedule
    const categoryIdsFound = Array.from(new Set(parsed.matches.map(m => catMap[normalizeCategoryName(m.category)]).filter(Boolean)));
    for (const cId of categoryIdsFound) {
      const bracketMatches = await db.select().from(matches).where(eq(matches.categoryId, cId as number));
      const scheduleMatchesForCat = parsed.matches.filter(m => catMap[normalizeCategoryName(m.category)] === cId);

      for (const sm of scheduleMatchesForCat) {
        const smNorm = normalizeMatchCode(sm.gameNumber);
        const bm = bracketMatches.find(b => normalizeMatchCode(b.matchCode) === smNorm);
        
        if (bm) {
          // Check both player 1 and player 2 for club info
          const p1_1 = parsePlayerInfo(sm.team1Player1);
          const p1_2 = parsePlayerInfo(sm.team1Player2);
          const club1 = p1_1.club || p1_2.club;

          const p2_1 = parsePlayerInfo(sm.team2Player1);
          const p2_2 = parsePlayerInfo(sm.team2Player2);
          const club2 = p2_1.club || p2_2.club;
          
          if (club1 !== bm.team1Club || club2 !== bm.team2Club) {
            await db.update(matches)
              .set({ team1Club: club1, team2Club: club2 })
              .where(eq(matches.id, bm.id));
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      matchesImported: parsed.matches.length,
      daysFound: parsed.days.length,
      categoriesFound: parsed.categories.length,
    });
  } catch (error) {
    console.error("Schedule import error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
