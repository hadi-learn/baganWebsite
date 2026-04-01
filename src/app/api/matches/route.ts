import { db } from "@/db";
import { matches, categories } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { performImport } from "@/lib/importer";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get("categoryId");

  if (!categoryId) {
    return Response.json(
      { error: "categoryId is required" },
      { status: 400 }
    );
  }

  try {
    const catIdNum = parseInt(categoryId, 10);
    
    // Check for auto-import lazy cron
    const [category] = await db
      .select({
        autoImportInterval: categories.autoImportInterval,
        lastImportedAt: categories.lastImportedAt,
        csvUrl: categories.csvUrl
      })
      .from(categories)
      .where(eq(categories.id, catIdNum))
      .limit(1);

    if (category && category.csvUrl && category.autoImportInterval > 0) {
      const lastImportTime = category.lastImportedAt ? new Date(category.lastImportedAt).getTime() : 0;
      const intervalMs = category.autoImportInterval * 60 * 1000;
      if (Date.now() - lastImportTime > intervalMs) {
        try {
          console.log(`Auto-import triggered for category ${catIdNum}`);
          await performImport(catIdNum);
        } catch (e) {
          console.error("Auto-import failed:", e);
        }
      }
    }

    const result = await db
      .select()
      .from(matches)
      .where(eq(matches.categoryId, catIdNum))
      .orderBy(asc(matches.roundOrder), asc(matches.matchOrder));

    return Response.json(result);
  } catch (error) {
    console.error("Error fetching matches:", error);
    return Response.json(
      { error: "Failed to fetch matches" },
      { status: 500 }
    );
  }
}
