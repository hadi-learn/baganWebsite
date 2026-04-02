import { NextResponse } from "next/server";
import { db } from "@/db";
import { scheduleMatches } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value;
    if (!token || !(await decrypt(token))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing match ID" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      "dayDate", "dayOrder", "matchOrder", "time", "category",
      "gameNumber", "team1Player1", "team1Player2", "team1Number",
      "team2Player1", "team2Player2", "team2Number",
      "scoreTeam1", "scoreTeam2", "winner", "status"
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    }

    await db
      .update(scheduleMatches)
      .set(updateData)
      .where(eq(scheduleMatches.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating schedule match:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
