import { db } from "@/db";
import { categories } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tournamentId = searchParams.get("tournamentId");

  try {
    let result;
    if (tournamentId) {
      result = await db
        .select()
        .from(categories)
        .where(eq(categories.tournamentId, parseInt(tournamentId, 10)))
        .orderBy(categories.sortOrder);
    } else {
      result = await db.select().from(categories).orderBy(categories.sortOrder);
    }

    return Response.json(result);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return Response.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}
