import { db } from "@/db";
import { matches, categories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { parseCSV } from "@/lib/csvParser";

export async function performImport(categoryId: number) {
  // Get the category to find CSV URL
  const [category] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1);

  if (!category) {
    throw new Error("Category not found");
  }

  if (!category.csvUrl) {
    throw new Error("No CSV URL configured for this category");
  }

  // Fetch CSV from Google Sheets without caching
  const response = await fetch(category.csvUrl, { 
    cache: "no-store",
    next: { revalidate: 0 },
    headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' }
  });
  if (!response.ok) {
    throw new Error("Failed to fetch CSV from Google Sheets");
  }

  const csvText = await response.text();
  const parsed = parseCSV(csvText);

  // Delete existing matches for this category
  await db.delete(matches).where(eq(matches.categoryId, categoryId));

  // Insert new matches
  if (parsed.matches.length > 0) {
    await db.insert(matches).values(
      parsed.matches.map((m) => ({
        categoryId: categoryId as number,
        matchCode: m.matchCode,
        round: m.round,
        roundOrder: m.roundOrder,
        matchOrder: m.matchOrder,
        team1Name: m.team1Name,
        team1Seed: m.team1Seed,
        team1Number: m.team1Number,
        team2Name: m.team2Name,
        team2Seed: m.team2Seed,
        team2Number: m.team2Number,
        scoreTeam1: m.scoreTeam1,
        scoreTeam2: m.scoreTeam2,
        winner: m.winner,
        isBye: m.isBye,
        schedule: m.schedule,
        nextMatchCode: m.nextMatchCode,
        nextMatchSlot: m.nextMatchSlot,
        status: m.status,
      }))
    );
  }

  // Update category info
  await db
    .update(categories)
    .set({
      totalTeams: parsed.totalTeams || category.totalTeams,
      bracketSize: parsed.bracketSize || category.bracketSize,
      lastImportedAt: new Date(),
    })
    .where(eq(categories.id, categoryId));

  return {
    success: true,
    matchesImported: parsed.matches.length,
    totalTeams: parsed.totalTeams || category.totalTeams,
    bracketSize: parsed.bracketSize || category.bracketSize,
  };
}
