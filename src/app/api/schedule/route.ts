import { NextResponse } from "next/server";
import { db } from "@/db";
import { scheduleMatches, scheduleSettings } from "@/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  try {
    const allMatches = await db
      .select()
      .from(scheduleMatches)
      .orderBy(asc(scheduleMatches.dayOrder), asc(scheduleMatches.matchOrder));

    // Also return category config for display names and ordering
    const settings = await db.select().from(scheduleSettings).limit(1);
    let categoryConfig: unknown[] = [];
    try {
      categoryConfig = settings[0]?.categoryConfig ? JSON.parse(settings[0].categoryConfig) : [];
    } catch { /* ignore */ }

    return NextResponse.json({
      matches: allMatches,
      categoryConfig,
    });
  } catch (error) {
    console.error("Error fetching schedule:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
