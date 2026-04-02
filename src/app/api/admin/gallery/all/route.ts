import { NextResponse } from "next/server";
import { db } from "@/db";
import { matchPhotos } from "@/db/schema";
import { eq } from "drizzle-orm";
import cloudinary from "@/lib/cloudinary";

// DELETE: Delete all photos for a given matchCode
export async function DELETE(request: Request) {
  try {
    const { matchCode: rawMatchCode } = await request.json();
    const matchCode = rawMatchCode ? rawMatchCode.trim() : null;
    if (!matchCode) return NextResponse.json({ error: "matchCode required" }, { status: 400 });

    // Find all photos in DB for this match code
    const photos = await db.select().from(matchPhotos).where(eq(matchPhotos.matchCode, matchCode));
    
    // Delete from cloudinary
    for (const photo of photos) {
      if (photo.cloudinaryPublicId) {
        await cloudinary.uploader.destroy(photo.cloudinaryPublicId);
      }
    }

    // Delete from DB strictly for this matched Code
    await db.delete(matchPhotos).where(eq(matchPhotos.matchCode, matchCode));

    return NextResponse.json({ success: true, count: photos.length });
  } catch (error) {
    console.error("Gallery Delete All Error:", error);
    return NextResponse.json({ error: "Delete all failed" }, { status: 500 });
  }
}
