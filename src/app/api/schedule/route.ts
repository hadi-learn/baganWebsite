import { NextResponse } from "next/server";
import { db } from "@/db";
import { scheduleMatches, scheduleSettings } from "@/db/schema";
import { asc } from "drizzle-orm";
import { performScheduleImport } from "@/lib/scheduleImporter";

export async function GET() {
  try {
    // 1. Check for auto-import lazy cron
    const settings = await db.select().from(scheduleSettings).limit(1);
    
    if (settings.length > 0 && settings[0].csvUrl && settings[0].autoImportInterval > 0) {
      const lastImportTime = settings[0].lastImportedAt ? new Date(settings[0].lastImportedAt).getTime() : 0;
      const intervalMs = settings[0].autoImportInterval * 60 * 1000;
      
      if (Date.now() - lastImportTime > intervalMs) {
        try {
          console.log(`Auto-import triggered for schedule`);
          await performScheduleImport();
        } catch (e) {
          console.error("Auto-import failed for schedule:", e);
        }
      }
    }

    const allMatches = await db
      .select()
      .from(scheduleMatches)
      .orderBy(asc(scheduleMatches.dayOrder), asc(scheduleMatches.matchOrder));

    // Also return category config for display names and ordering
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
