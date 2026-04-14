import { NextResponse } from "next/server";
import { db } from "@/db";
import { matchPhotos } from "@/db/schema";
import { eq, inArray, and } from "drizzle-orm";
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
  let step = "initialization";
  try {
    // 0. Verify Config
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      console.error("[Gallery API] Missing Cloudinary environment variables");
      return NextResponse.json({ error: "Server Configuration Error (Cloudinary)" }, { status: 500 });
    }

    step = "parsing form data";
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const rawMatchCode = formData.get("matchCode") as string;
    const matchCode = rawMatchCode ? rawMatchCode.trim() : null;
    const type = (formData.get("type") as "match" | "general") || "match";

    if (!file || !matchCode) {
      return NextResponse.json({ error: "File and matchCode are required" }, { status: 400 });
    }

    console.log(`[Gallery API] Received upload request for match: ${matchCode}, file: ${file.name} (${file.size} bytes)`);

    step = "processing binary data";
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Use user-requested specific folder
    const folder = "pakpelecup_gallery";
    
    step = "uploading to cloudinary";
    // Upload to cloudinary
    const uploadResult = await uploadToCloudinary(buffer, folder);
    console.log("[Gallery API] Cloudinary upload completed, saving to database...");

    step = "fetching existing photos from db";
    // Get current max sort_order for this match
    // Wrap DB call in try/catch to isolate
    let existingPhotos;
    try {
      existingPhotos = await db.select()
        .from(matchPhotos)
        .where(
          and(
            eq(matchPhotos.matchCode, matchCode),
            eq(matchPhotos.type, type)
          )
        );
    } catch (dbErr: any) {
      console.error("[Gallery API] DB Select Error:", dbErr);
      throw new Error(`Database Select Failed: ${dbErr.message}`);
    }

    const maxSortOrder = existingPhotos.length > 0 ? Math.max(...existingPhotos.map(p => p.sortOrder)) : -1;

    step = "inserting into database";
    // Save to DB
    try {
      await db.insert(matchPhotos).values({
        matchCode,
        cloudinaryPublicId: uploadResult.public_id,
        url: uploadResult.secure_url,
        type,
        sortOrder: maxSortOrder + 1,
        fileSize: uploadResult.bytes || null,
      });
    } catch (insertErr: any) {
      console.error("[Gallery API] DB Insert Error:", insertErr);
      throw new Error(`Database Insert Failed: ${insertErr.message}`);
    }

    console.log("[Gallery API] Database insert successful.");

    return NextResponse.json({ success: true, url: uploadResult.secure_url });
  } catch (error: any) {
    console.error(`Gallery Upload Error at step [${step}]:`, error);
    return NextResponse.json({ 
      error: error.message || "Upload failed",
      step: step 
    }, { status: 500 });
  }
}

// DELETE: Delete one or multiple photos
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { id, ids } = body;
    
    // Support bulk delete via ids array
    const idsToDelete: number[] = ids ? ids : (id ? [id] : []);
    if (idsToDelete.length === 0) {
      return NextResponse.json({ error: "Photo ID(s) required" }, { status: 400 });
    }

    // Find photos in DB
    const photos = await db.select().from(matchPhotos).where(inArray(matchPhotos.id, idsToDelete));
    if (photos.length === 0) {
      return NextResponse.json({ error: "No photos found" }, { status: 404 });
    }

    // Delete from cloudinary
    let cloudinaryErrors = 0;
    for (const photo of photos) {
      try {
        await cloudinary.uploader.destroy(photo.cloudinaryPublicId);
      } catch (e) {
        console.error(`Failed to delete from Cloudinary: ${photo.cloudinaryPublicId}`, e);
        cloudinaryErrors++;
      }
    }

    // Delete from DB
    await db.delete(matchPhotos).where(inArray(matchPhotos.id, idsToDelete));

    return NextResponse.json({ 
      success: true, 
      deleted: photos.length,
      cloudinaryErrors 
    });
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
