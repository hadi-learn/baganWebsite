import { db } from "@/db";
import { matches, categories } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/session";

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      id,
      team1Name,
      team2Name,
      team1Seed,
      team2Seed,
      team1Number,
      team2Number,
      scoreTeam1,
      scoreTeam2,
      winner,
      schedule,
      status,
    } = body;

    if (!id) {
      return Response.json(
        { error: "Match ID is required" },
        { status: 400 }
      );
    }

    // Update the match
    await db
      .update(matches)
      .set({
        team1Name: team1Name ?? undefined,
        team2Name: team2Name ?? undefined,
        team1Seed: team1Seed ?? undefined,
        team2Seed: team2Seed ?? undefined,
        team1Number: team1Number ?? undefined,
        team2Number: team2Number ?? undefined,
        scoreTeam1: scoreTeam1 ?? undefined,
        scoreTeam2: scoreTeam2 ?? undefined,
        winner: winner ?? undefined,
        schedule: schedule ?? undefined,
        status: status ?? undefined,
      })
      .where(eq(matches.id, id));

    // If a winner is declared, advance to next match
    if (winner) {
      const [currentMatch] = await db
        .select()
        .from(matches)
        .where(eq(matches.id, id))
        .limit(1);

      if (currentMatch && currentMatch.nextMatchCode) {
        const winnerName =
          winner === 1 ? currentMatch.team1Name : currentMatch.team2Name;
        const winnerClub =
          winner === 1 ? currentMatch.team1Club : currentMatch.team2Club;
        const winnerSeed =
          winner === 1 ? currentMatch.team1Seed : currentMatch.team2Seed;
        const winnerNumber =
          winner === 1 ? currentMatch.team1Number : currentMatch.team2Number;

        // Find the next match
        const [nextMatch] = await db
          .select()
          .from(matches)
          .where(
            and(
              eq(matches.categoryId, currentMatch.categoryId),
              eq(matches.matchCode, currentMatch.nextMatchCode)
            )
          )
          .limit(1);

        if (nextMatch) {
          const updateData: Record<string, unknown> = {};
          if (currentMatch.nextMatchSlot === 1) {
            updateData.team1Name = winnerName;
            updateData.team1Club = winnerClub;
            updateData.team1Seed = winnerSeed;
            updateData.team1Number = winnerNumber;
          } else {
            updateData.team2Name = winnerName;
            updateData.team2Club = winnerClub;
            updateData.team2Seed = winnerSeed;
            updateData.team2Number = winnerNumber;
          }

          await db
            .update(matches)
            .set(updateData)
            .where(eq(matches.id, nextMatch.id));
        }
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error updating match:", error);
    return Response.json(
      { error: "Failed to update match" },
      { status: 500 }
    );
  }
}
