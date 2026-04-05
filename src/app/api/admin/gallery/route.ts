import { NextResponse } from "next/server";
import { db } from "@/db";
import { matchPhotos } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import cloudinary from "@/lib/cloudinary";

// Helper to upload buffer to Cloudinary
function uploadToCloudinary(buffer: Buffer, folder: string): Promise<any> {
  return new Promise((resolve, reject) => {
    console.log(`[Cloudinary] Starting upload stream to folder: ${folder}...`);
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) {
          console.error("[Cloudinary] Upload Error:", error);
          return reject(error);
        }
        console.log("[Cloudinary] Upload Success:", result?.public_id);
        resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
}

// POST: Upload a single photo
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const rawMatchCode = formData.get("matchCode") as string;
    const matchCode = rawMatchCode ? rawMatchCode.trim() : null;

    if (!file || !matchCode) {
      return NextResponse.json({ error: "File and matchCode are required" }, { status: 400 });
    }

    console.log(`[Gallery API] Received upload request for match: ${matchCode}, file: ${file.name} (${file.size} bytes)`);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Use user-requested specific folder
    const folder = "pakpelecup_gallery";
    
    // Upload to cloudinary
    const uploadResult = await uploadToCloudinary(buffer, folder);
    console.log("[Gallery API] Cloudinary upload completed, saving to database...");

    // Get current max sort_order for this match
    const existingPhotos = await db.select().from(matchPhotos).where(eq(matchPhotos.matchCode, matchCode));
    const maxSortOrder = existingPhotos.length > 0 ? Math.max(...existingPhotos.map(p => p.sortOrder)) : -1;

    // Save to DB
    await db.insert(matchPhotos).values({
      matchCode,
      cloudinaryPublicId: uploadResult.public_id,
      url: uploadResult.secure_url,
      sortOrder: maxSortOrder + 1,
    });
    console.log("[Gallery API] Database insert successful.");

    return NextResponse.json({ success: true, url: uploadResult.secure_url });
  } catch (error: any) {
    console.error("Gallery Upload Error:", error);
    return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 });
  }
}

// DELETE: Delete a photo
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "Photo ID required" }, { status: 400 });

    // Find photo in DB
    const [photo] = await db.select().from(matchPhotos).where(eq(matchPhotos.id, id));
    if (!photo) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

    // Delete from cloudinary
    await cloudinary.uploader.destroy(photo.cloudinaryPublicId);

    // Delete from DB
    await db.delete(matchPhotos).where(eq(matchPhotos.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Gallery Delete Error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}

// PUT: Update sort order
export async function PUT(request: Request) {
  try {
    // Expects: { updates: [{ id: 1, sortOrder: 0 }, { id: 2, sortOrder: 1 }] }
    const { updates } = await request.json();
    if (!Array.isArray(updates)) {
      return NextResponse.json({ error: "Invalid updates format" }, { status: 400 });
    }

    // Process updates sequentially or use Promise.all
    await Promise.all(
      updates.map((update: any) =>
        db.update(matchPhotos)
          .set({ sortOrder: update.sortOrder })
          .where(eq(matchPhotos.id, update.id))
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Gallery Update Order Error:", error);
    return NextResponse.json({ error: "Update order failed" }, { status: 500 });
  }
}
