import { NextResponse } from "next/server";
import { db } from "@/db";
import { matchPhotos } from "@/db/schema";
import cloudinary from "@/lib/cloudinary";

export async function GET() {
  const results: any = {
    env: {
      CLOUDINARY_CLOUD_NAME: !!process.env.CLOUDINARY_CLOUD_NAME,
      CLOUDINARY_API_KEY: !!process.env.CLOUDINARY_API_KEY,
      CLOUDINARY_API_SECRET: !!process.env.CLOUDINARY_API_SECRET,
      DATABASE_HOST: !!process.env.DATABASE_HOST,
    },
    database: "pending",
    cloudinary: "pending",
  };

  // Test DB
  try {
    await db.select().from(matchPhotos).limit(1);
    results.database = "OK";
  } catch (e: any) {
    results.database = "ERROR: " + e.message;
  }

  // Test Cloudinary
  try {
    const res = await cloudinary.api.ping();
    results.cloudinary = "OK: " + JSON.stringify(res);
  } catch (e: any) {
    results.cloudinary = "ERROR: " + e.message;
  }

  return NextResponse.json(results);
}
