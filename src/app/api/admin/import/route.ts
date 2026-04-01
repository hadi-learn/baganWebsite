import { getSession } from "@/lib/session";
import { performImport } from "@/lib/importer";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { categoryId } = await request.json();

    if (!categoryId) {
      return Response.json(
        { error: "categoryId is required" },
        { status: 400 }
      );
    }

    const result = await performImport(categoryId);

    return Response.json(result);
  } catch (error: any) {
    console.error("Import error:", error);
    return Response.json(
      { error: error.message || "Failed to import data" },
      { status: 500 }
    );
  }
}
