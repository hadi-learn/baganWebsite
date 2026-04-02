/**
 * Shared utility for parsing player and club information from strings.
 * Used by both frontend rendering and backend import syncing.
 */
export function parsePlayerInfo(raw: string | null): { 
  name: string; 
  seed: string | null; 
  club: string | null 
} {
  if (!raw || raw.trim() === "" || raw.trim() === "— BYE —") {
    return { name: raw?.trim() || "", seed: null, club: null };
  }
  
  let text = raw.trim();
  let seed: string | null = null;
  let club: string | null = null;

  // Extract seed: "(Seed 1)" or "(Seed 3/4)" or just "[U1]" style etc.
  // Handles "(Seed 1)" and also "[U1]" style if it gets mixed in.
  const seedMatch = text.match(/\(Seed\s*(\d+(?:\/\d+)?)\)/i) || text.match(/\[(.*?)\]/);
  if (seedMatch) {
    seed = seedMatch[1] || seedMatch[0].replace(/[\[\]]/g, "");
    text = text.replace(seedMatch[0], "").replace(/\s+/g, " ").trim();
  }

  // Extract club: "Name - Club" or "Name (CLUB)" 
  // Let's check for " - " first as it's the standard separator the user mentioned.
  const dashIdx = text.indexOf(" - ");
  if (dashIdx > 0) {
    club = text.substring(dashIdx + 3).trim();
    text = text.substring(0, dashIdx).trim();
  } else {
    // Fallback: check if there's any bracket leftover that might be a club
    const clubMatch = text.match(/\((.*?)\)$/);
    if (clubMatch) {
      club = clubMatch[1];
      text = text.replace(clubMatch[0], "").trim();
    }
  }

  return { name: text, seed, club };
}

/**
 * Normalizes a match code by removing all non-digits.
 * Used for linking "M33" (Bracket) to "#33" (Schedule).
 */
export function normalizeMatchCode(code: string | null): string {
  if (!code) return "";
  return code.toString().replace(/\D/g, "");
}

/**
 * Normalizes category names for better matching.
 * e.g. "64 Tim U110" -> "u110", "U110" -> "u110"
 */
export function normalizeCategoryName(name: string | null): string {
  if (!name) return "";
  return name.toLowerCase()
    .replace(/\s+/g, "")
    .replace(/\d+tim/g, "") // Remove "64Tim", "32Tim" etc.
    .trim();
}
