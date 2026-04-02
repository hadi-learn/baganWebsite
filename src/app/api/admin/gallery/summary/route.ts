import { NextResponse } from "next/server";
import { db } from "@/db";
import { matchPhotos } from "@/db/schema";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    // We want to group by match_code, get a count, and get the first image thumbnail
    // Doing a raw query or simple aggregation
    const summary = await db
      .select({
        matchCode: matchPhotos.matchCode,
        photoCount: sql<number>`cast(count(${matchPhotos.id}) as unsigned)`,
        thumbnail: sql<string>`min(${matchPhotos.url})`,
      })
      .from(matchPhotos)
      .groupBy(matchPhotos.matchCode);

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Gallery Summary Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch gallery summary" },
      { status: 500 }
    );
  }
}
