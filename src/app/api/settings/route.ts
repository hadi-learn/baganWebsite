import { NextResponse } from "next/server";
import { db } from "@/db";
import { tournaments } from "@/db/schema";

export async function GET() {
  try {
    const tournamentList = await db.select().from(tournaments).limit(1);
    if (tournamentList.length === 0) {
      return NextResponse.json(
        { error: "Tournament settings not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(tournamentList[0]);
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}
