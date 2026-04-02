import { NextResponse } from "next/server";
import { db } from "@/db";
import { scheduleSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const settings = await db.select().from(scheduleSettings).limit(1);
    if (settings.length === 0) {
      return NextResponse.json({ csvUrl: "", autoImportInterval: 0, categoryConfig: [] });
    }
    let categoryConfig: unknown[] = [];
    try {
      categoryConfig = settings[0].categoryConfig ? JSON.parse(settings[0].categoryConfig) : [];
    } catch { /* ignore parse error */ }

    return NextResponse.json({
      csvUrl: settings[0].csvUrl || "",
      autoImportInterval: settings[0].autoImportInterval,
      categoryConfig,
      lastImportedAt: settings[0].lastImportedAt,
    });
  } catch (error) {
    console.error("Error fetching schedule settings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value;
    if (!token || !(await decrypt(token))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { csvUrl, autoImportInterval, categoryConfig } = body;

    const settings = await db.select().from(scheduleSettings).limit(1);
    if (settings.length === 0) {
      return NextResponse.json({ error: "No schedule settings found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (csvUrl !== undefined) updateData.csvUrl = csvUrl;
    if (autoImportInterval !== undefined) updateData.autoImportInterval = autoImportInterval;
    if (categoryConfig !== undefined) updateData.categoryConfig = JSON.stringify(categoryConfig);

    await db
      .update(scheduleSettings)
      .set(updateData)
      .where(eq(scheduleSettings.id, settings[0].id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating schedule settings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
