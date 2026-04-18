import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  tournaments,
  categories,
  matches,
  scheduleMatches,
  scheduleSettings,
  matchPhotos,
} from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { normalizeCategoryName, normalizeMatchCode, getUnifiedMatchCode } from "@/lib/playerUtils";

/**
 * AI Context Endpoint for Botpress
 * 
 * Returns a comprehensive, structured JSON containing all tournament data
 * that the AI chatbot needs to answer user questions about:
 * - Tournament info
 * - Categories (bracket divisions)
 * - Full schedule with scores
 * - Bracket/match results per category
 * - Statistics & summaries
 * 
 * Protected by a simple API key via query parameter or header.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  // --- API Key Protection ---
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get("key") || request.headers.get("x-api-key");
  const validKey = process.env.AI_API_KEY;

  if (validKey && apiKey !== validKey) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid API key via ?key= or x-api-key header." },
      { status: 401 }
    );
  }

  try {
    // 1. Tournament Info
    const [tournament] = await db.select().from(tournaments).limit(1);

    // 2. All Categories
    const allCategories = await db
      .select()
      .from(categories)
      .orderBy(asc(categories.sortOrder));

    // 3. All Bracket Matches (grouped by category)
    const allMatches = await db
      .select()
      .from(matches)
      .orderBy(asc(matches.categoryId), asc(matches.roundOrder), asc(matches.matchOrder));

    // 4. Full Schedule
    const allSchedule = await db
      .select()
      .from(scheduleMatches)
      .orderBy(asc(scheduleMatches.dayOrder), asc(scheduleMatches.matchOrder));

    // 5. Schedule Settings (for category display config)
    const schedSettings = await db.select().from(scheduleSettings).limit(1);
    let categoryConfig: any[] = [];
    try {
      categoryConfig = schedSettings[0]?.categoryConfig
        ? JSON.parse(schedSettings[0].categoryConfig)
        : [];
    } catch { /* ignore */ }

    // 6. All Photos
    const allPhotos = await db.select().from(matchPhotos).orderBy(asc(matchPhotos.sortOrder));
    
    // Process photos for easy lookup
    const matchPhotosMap = new Map<string, any[]>();
    const generalPhotosMap = new Map<string, any[]>();
    
    allPhotos.forEach(p => {
      if (p.type === "match") {
        if (!matchPhotosMap.has(p.matchCode)) matchPhotosMap.set(p.matchCode, []);
        matchPhotosMap.get(p.matchCode)!.push(p.url);
      } else {
        if (!generalPhotosMap.has(p.matchCode)) generalPhotosMap.set(p.matchCode, []);
        generalPhotosMap.get(p.matchCode)!.push(p.url);
      }
    });

    // --- Build structured response ---

    // Round label mapping
    const roundLabels: Record<string, string> = {
      R128: "Babak 128 Besar",
      R64: "Babak 64 Besar",
      R32: "Babak 32 Besar",
      R16: "Babak 16 Besar",
      QF: "Perempat Final",
      SF: "Semi Final",
      F: "Final",
    };

    const statusLabels: Record<string, string> = {
      upcoming: "Belum Dimulai",
      ongoing: "Sedang Berlangsung",
      completed: "Selesai",
    };

    // Group bracket matches by category
    const bracketByCategory = allCategories.map((cat) => {
      const catMatches = allMatches.filter((m) => m.categoryId === cat.id);

      // Group by round
      const rounds: Record<string, any[]> = {};
      catMatches.forEach((m) => {
        const roundKey = m.round;
        if (!rounds[roundKey]) rounds[roundKey] = [];

        const matchEntry: any = {
          nomorPertandingan: m.matchCode,
          babak: roundLabels[m.round] || m.round,
          status: statusLabels[m.status] || m.status,
        };

        if (m.isBye) {
          matchEntry.keterangan = "BYE (lolos tanpa bertanding)";
          matchEntry.tim1 = formatTeamName(m.team1Name, m.team1Club, m.team1Seed);
        } else {
          matchEntry.tim1 = formatTeamName(m.team1Name, m.team1Club, m.team1Seed);
          matchEntry.tim2 = formatTeamName(m.team2Name, m.team2Club, m.team2Seed);

          if (m.scoreTeam1 || m.scoreTeam2) {
            matchEntry.skor = `${m.scoreTeam1 || "0"} - ${m.scoreTeam2 || "0"}`;
          }
          if (m.winner) {
            matchEntry.pemenang = m.winner === 1 ? matchEntry.tim1 : matchEntry.tim2;
          }
        }

        if (m.schedule) {
          matchEntry.jadwal = m.schedule;
        }

        // Add photo info - Use unified match code for lookup
        const unifiedCode = getUnifiedMatchCode(cat.name, m.matchCode);
        const photos = matchPhotosMap.get(unifiedCode) || [];
        if (photos.length > 0) {
          matchEntry.galeriFoto = {
            jumlah: photos.length,
            daftarLink: photos.slice(0, 5) // AI only needs a few links to be helpful
          };
        }

        rounds[roundKey].push(matchEntry);
      });

      // Stats
      const totalMatches = catMatches.filter((m) => !m.isBye).length;
      const completedMatches = catMatches.filter((m) => m.status === "completed" && !m.isBye).length;
      const ongoingMatches = catMatches.filter((m) => m.status === "ongoing").length;

      return {
        namaKategori: cat.name,
        label: cat.label,
        jumlahTim: cat.totalTeams,
        ukuranBagan: cat.bracketSize,
        tag: cat.customTags || null,
        statistik: {
          totalPertandingan: totalMatches,
          pertandinganSelesai: completedMatches,
          pertandinganBerlangsung: ongoingMatches,
          pertandinganBelumDimulai: totalMatches - completedMatches - ongoingMatches,
          persentaseSelesai: totalMatches > 0 ? `${Math.round((completedMatches / totalMatches) * 100)}%` : "0%",
        },
        babak: Object.entries(rounds).map(([roundKey, matchList]) => ({
          kode: roundKey,
          nama: roundLabels[roundKey] || roundKey,
          pertandingan: matchList,
        })),
      };
    });

    // Group schedule by day
    const scheduleDays = new Map<string, any[]>();
    allSchedule.forEach((s) => {
      if (!scheduleDays.has(s.dayDate)) scheduleDays.set(s.dayDate, []);
      
      const matchEntry: any = {
        waktu: s.time,
        kategori: s.category,
        nomorPertandingan: s.gameNumber,
        status: statusLabels[s.status] || s.status,
      };

      // Team 1
      if (s.team1Player1) {
        matchEntry.tim1 = s.team1Player2
          ? `${s.team1Player1} / ${s.team1Player2}`
          : s.team1Player1;
        if (s.team1Number) matchEntry.nomorUrutTim1 = s.team1Number;
      }

      // Team 2
      if (s.team2Player1) {
        matchEntry.tim2 = s.team2Player2
          ? `${s.team2Player1} / ${s.team2Player2}`
          : s.team2Player1;
        if (s.team2Number) matchEntry.nomorUrutTim2 = s.team2Number;
      }

      // Score
      if (s.scoreTeam1 || s.scoreTeam2) {
        matchEntry.skor = `${s.scoreTeam1 || "0"} - ${s.scoreTeam2 || "0"}`;
      }
      if (s.winner) {
        matchEntry.pemenang = s.winner === 1 ? matchEntry.tim1 : matchEntry.tim2;
      }

      // Add photo info - Use unified match code for lookup
      const unifiedCode = getUnifiedMatchCode(s.category, s.gameNumber);
      const photos = matchPhotosMap.get(unifiedCode) || [];
      if (photos.length > 0) {
        matchEntry.galeriFoto = {
          jumlah: photos.length,
          daftarLink: photos.slice(0, 5)
        };
      }

      scheduleDays.get(s.dayDate)!.push(matchEntry);
    });

    const jadwalPerHari = Array.from(scheduleDays.entries()).map(([dayDate, matches], idx) => ({
      hari: `Hari ${idx + 1}`,
      tanggal: dayDate,
      jumlahPertandingan: matches.length,
      pertandinganSelesai: matches.filter((m) => m.status === "Selesai").length,
      galeriSuasana: {
        jumlahFoto: generalPhotosMap.get(dayDate)?.length || 0,
        daftarLink: generalPhotosMap.get(dayDate)?.slice(0, 10) || []
      },
      daftarPertandingan: matches,
    }));

    // Overall statistics
    const totalScheduleMatches = allSchedule.length;
    const completedSchedule = allSchedule.filter((s) => s.status === "completed").length;
    const ongoingSchedule = allSchedule.filter((s) => s.status === "ongoing").length;

    // Build final response
    const response = {
      _metadata: {
        deskripsi: "Data lengkap turnamen untuk AI chatbot. Data ini bersifat real-time dan diambil langsung dari database.",
        dibuatPada: new Date().toISOString(),
        catatan: "Semua nama field menggunakan Bahasa Indonesia agar AI dapat memahami konteks dengan lebih baik.",
      },

      turnamen: {
        nama: tournament?.name || "Turnamen Badminton",
        deskripsi: tournament?.description || null,
        footerText: tournament?.footerText || null,
      },

      ringkasanUmum: {
        jumlahKategori: allCategories.length,
        daftarKategori: allCategories.map((c) => ({
          nama: c.name,
          label: c.label,
          jumlahTim: c.totalTeams,
          tag: c.customTags || null,
        })),
        jumlahHariPertandingan: scheduleDays.size,
        totalPertandinganTerjadwal: totalScheduleMatches,
        pertandinganSelesai: completedSchedule,
        pertandinganBerlangsung: ongoingSchedule,
        pertandinganBelumDimulai: totalScheduleMatches - completedSchedule - ongoingSchedule,
      },

      jadwalPertandingan: jadwalPerHari,

      hasilBaganPerKategori: bracketByCategory,

      informasiUmum: {
        lokasi: "Informasi lokasi turnamen tersedia di halaman utama website.",
        kontak: "Untuk informasi lebih lanjut, silakan hubungi panitia turnamen.",
        website: "Kunjungi website resmi untuk melihat bagan pertandingan secara visual, jadwal lengkap, dan galeri foto.",
        fiturWebsite: [
          "Bagan pertandingan interaktif per kategori",
          "Jadwal pertandingan per hari dengan skor real-time",
          "Galeri foto pertandingan dan suasana turnamen",
        ],
      },
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60", // Cache 1 menit
      },
    });
  } catch (error) {
    console.error("AI Context API Error:", error);
    return NextResponse.json(
      { error: "Failed to generate AI context data" },
      { status: 500 }
    );
  }
}

/** Helper: Format team name with club and seed */
function formatTeamName(
  name: string | null,
  club: string | null,
  seed: string | null
): string {
  if (!name) return "TBD (Belum Ditentukan)";
  let result = name;
  if (club) result += ` (${club})`;
  if (seed) result += ` ${seed}`;
  return result;
}
