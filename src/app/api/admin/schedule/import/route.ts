import { NextResponse } from "next/server";
import { db } from "@/db";
import { scheduleMatches, scheduleSettings, tournaments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";
import { parseScheduleCSV } from "@/lib/scheduleParser";

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
