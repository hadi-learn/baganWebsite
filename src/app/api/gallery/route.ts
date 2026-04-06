import { NextResponse } from "next/server";
import { db } from "@/db";
import { matchPhotos } from "@/db/schema";
import { eq, asc, and } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const matchCode = searchParams.get("match");
    const type = searchParams.get("type") || "match";

    if (!matchCode) {
      return NextResponse.json({ error: "Match code is required" }, { status: 400 });
    }

    const photos = await db
      .select()
      .from(matchPhotos)
      .where(
        and(
          eq(matchPhotos.matchCode, matchCode),
          eq(matchPhotos.type, type as any)
        )
      )
      .orderBy(asc(matchPhotos.sortOrder));

    return NextResponse.json({ photos });
  } catch (error) {
    console.error("Gallery Fetch Error:", error);
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }
}
