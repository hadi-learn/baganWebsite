import { NextResponse } from "next/server";
import { db } from "@/db";
import { matchPhotos } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawMatchCode = searchParams.get("match");
    const matchCode = rawMatchCode ? rawMatchCode.trim() : null;

    if (!matchCode) {
      return NextResponse.json({ error: "Match code is required" }, { status: 400 });
    }

    const photos = await db
      .select()
      .from(matchPhotos)
      .where(eq(matchPhotos.matchCode, matchCode));

    // Sort by sortOrder
    photos.sort((a, b) => a.sortOrder - b.sortOrder);

    return NextResponse.json({ photos });
  } catch (error) {
    console.error("Error fetching gallery:", error);
    return NextResponse.json(
      { error: "Failed to fetch gallery" },
      { status: 500 }
    );
  }
}
