import { NextResponse } from "next/server";
import { db } from "@/db";
import { tournaments } from "@/db/schema";
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

    const { name, description, footerText } = await request.json();

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Assuming we only manage 1 tournament
    const tournamentList = await db.select().from(tournaments).limit(1);
    if (tournamentList.length === 0) {
      return NextResponse.json({ error: "No tournament found to update" }, { status: 404 });
    }
    
    await db
      .update(tournaments)
      .set({ name, description, footerText })
      .where(eq(tournaments.id, tournamentList[0].id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
