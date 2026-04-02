"use client";

import { useState, useEffect, useCallback } from "react";

interface Match {
  id: number;
  matchCode: string;
  round: string;
  roundOrder: number;
  matchOrder: number;
  team1Name: string | null;
  team1Seed: string | null;
  team1Number: number | null;
  team2Name: string | null;
  team2Seed: string | null;
  team2Number: number | null;
  scoreTeam1: string | null;
  scoreTeam2: string | null;
  winner: number | null;
  isBye: boolean;
  schedule: string | null;
  status: string;
  nextMatchCode: string | null;
  nextMatchSlot: number | null;
}

interface Category {
  id: number;
  name: string;
  label: string;
  totalTeams: number;
  bracketSize: number;
  customTags: string | null;
}

interface ScheduleMatch {
  id: number;
  dayDate: string;
  dayOrder: number;
  matchOrder: number;
  time: string;
  category: string;
  gameNumber: string;
  team1Player1: string | null;
  team1Player2: string | null;
  team1Number: string | null;
  team2Player1: string | null;
  team2Player2: string | null;
  team2Number: string | null;
  scoreTeam1: string | null;
  scoreTeam2: string | null;
  winner: number | null;
  status: string;
}

const ROUND_LABELS: Record<string, string> = {
  R64: "Babak 64 Besar",
  R32: "Babak 32 Besar",
  R16: "Babak 16 Besar",
  QF: "Perempat Final",
  SF: "Semi-Final",
  F: "Final",
};

const ROUND_CLASSES: Record<string, string> = {
  R64: "round-r64",
  R32: "round-r32",
  R16: "round-r16",
  QF: "round-qf",
  SF: "round-sf",
  F: "round-final",
};

function TeamRow({
  name,
  seed,
  number,
  score,
  isWinner,
  isBye,
  teamSlot,
}: {
  name: string | null;
  seed: string | null;
  number: number | null;
  score: string | null;
  isWinner: boolean;
  isBye: boolean;
  teamSlot: 1 | 2;
}) {
  const isWaiting = name?.startsWith("▶") || name?.toLowerCase().includes("menunggu");
  const isEmpty = !name && !isBye;
  const isSeeded = seed !== null;

  return (
    <div
      className={`team-row ${isWinner ? "winner" : ""} ${isBye && teamSlot === 2 && !name ? "bye" : ""} ${isWaiting ? "waiting" : ""} ${isEmpty ? "empty" : ""} ${isSeeded ? "seeded" : ""} team-${teamSlot}`}
    >
      <div className="team-info">
        {number !== null && <span className="seed-number">[{number}]</span>}
        {seed && <span className="seed-badge">⭐{seed}</span>}
        <span className="team-name">
          {isBye && !name ? "— BYE —" : isWaiting && name ? name.replace("▶", "").trim() : name || "TBD"}
        </span>
      </div>
      <div className="score-box">
        {score}
      </div>
    </div>
  );
}

function MatchCard({ match, roundClass, allMatches, isFirstRound }: { match: Match; roundClass: string; allMatches: Match[]; isFirstRound: boolean }) {
  const prev1 = allMatches.find(m => m.nextMatchCode === match.matchCode && m.nextMatchSlot === 1);
  const prev2 = allMatches.find(m => m.nextMatchCode === match.matchCode && m.nextMatchSlot === 2);

  const finalName1 = match.team1Name || (prev1 ? `Menunggu ${prev1.matchCode}` : null);
  const finalName2 = match.team2Name || (prev2 ? `Menunggu ${prev2.matchCode}` : null);

  const slotClass = match.nextMatchSlot === 1 ? "match-slot-top" : match.nextMatchSlot === 2 ? "match-slot-bottom" : "";
  const firstRoundClass = isFirstRound ? "round-first" : "";

  return (
    <div className={`match-card ${roundClass} ${slotClass} ${firstRoundClass} ${match.isBye ? "bye-match" : ""} ${match.status === "completed" ? "completed" : ""}`}>
      <div className="match-header">
        <span className="match-code">{match.matchCode}</span>
        {match.schedule && (
          <span className="match-schedule">{match.schedule}</span>
        )}
      </div>
      <div className="match-teams">
        <TeamRow
          name={finalName1}
          seed={match.team1Seed}
          number={match.team1Number}
          score={match.scoreTeam1}
          isWinner={match.winner === 1}
          isBye={match.isBye}
          teamSlot={1}
        />
        <div className="team-divider"></div>
        <TeamRow
          name={finalName2}
          seed={match.team2Seed}
          number={match.team2Number}
          score={match.scoreTeam2}
          isWinner={match.winner === 2}
          isBye={match.isBye}
          teamSlot={2}
        />
      </div>
    </div>
  );
}

/* ============== Parse Player Info ============== */
// Parses: "Name (Seed 1)" / "Name - Club (Seed 3/4)" / "Name - Club" / "Name"
function parsePlayerInfo(raw: string | null): { name: string; seed: string | null; club: string | null } {
  if (!raw || raw.trim() === "") return { name: "", seed: null, club: null };
  let text = raw.trim();
  let seed: string | null = null;
  let club: string | null = null;

  // Extract seed: "(Seed 1)" or "(Seed 3/4)" etc.
  const seedMatch = text.match(/\(Seed\s*(\d+(?:\/\d+)?)\)/i);
  if (seedMatch) {
    seed = seedMatch[1];
    text = text.replace(seedMatch[0], "").trim();
  }

  // Extract club: "Name - Club"
  const dashIdx = text.indexOf(" - ");
  if (dashIdx > 0) {
    club = text.substring(dashIdx + 3).trim();
    text = text.substring(0, dashIdx).trim();
  }

  return { name: text, seed, club };
}

/* ============== Schedule Team Row ============== */
function SchedTeamRow({ player1Raw, player2Raw, teamNumber, isWinner, isCompleted, score }: {
  player1Raw: string | null; player2Raw: string | null; teamNumber: string | null;
  isWinner: boolean; isCompleted: boolean; score: string | null;
}) {
  const p1 = parsePlayerInfo(player1Raw);
  const p2 = parsePlayerInfo(player2Raw);
  const isSeeded = !!(p1.seed || p2.seed);
  const seedLabel = p1.seed || p2.seed;
  const club = p1.club || p2.club;
  const isWaiting = !p1.name || p1.name.toLowerCase().includes("menunggu");

  return (
    <div className={`sched-team-row ${isWinner ? "winner" : ""} ${isCompleted && !isWinner ? "loser" : ""} ${isSeeded ? "seeded" : ""} ${isWaiting ? "waiting" : ""}`}>
      <div className="sched-team-left">
        <div className="sched-team-badges">
          {teamNumber && <span className="seed-number">[{teamNumber}]</span>}
          {seedLabel && <span className="seed-badge">⭐U{seedLabel}</span>}
        </div>
        <div className="sched-team-player-names">
          <span className="team-name">{p1.name || "Menunggu Hasil"}</span>
          {p2.name && <span className="team-name">{p2.name}</span>}
        </div>
        {club && <span className="sched-club">{club}</span>}
      </div>
      <div className={`score-box ${isWinner ? "" : ""}`}>
        {score || ""}
      </div>
    </div>
  );
}

/* ============== Schedule Card ============== */
function ScheduleCard({ match, catDisplayName }: { match: ScheduleMatch; catDisplayName: string }) {
  const isCompleted = match.status === "completed";

  return (
    <div className={`schedule-card ${isCompleted ? "completed" : ""}`}>
      <div className="sched-time-col">
        <span className="sched-time">{match.time}</span>
        <span className="sched-game">{match.gameNumber}</span>
      </div>
      <div className="sched-content">
        <div className="sched-category-badge">{catDisplayName}</div>
        <div className="sched-match-box">
          <SchedTeamRow player1Raw={match.team1Player1} player2Raw={match.team1Player2} teamNumber={match.team1Number} isWinner={match.winner === 1} isCompleted={isCompleted} score={match.scoreTeam1} />
          <div className="team-divider" />
          <SchedTeamRow player1Raw={match.team2Player1} player2Raw={match.team2Player2} teamNumber={match.team2Number} isWinner={match.winner === 2} isCompleted={isCompleted} score={match.scoreTeam2} />
        </div>
      </div>
    </div>
  );
}


export default function HomePage() {
  const [viewMode, setViewMode] = useState<"bracket" | "schedule">("bracket");
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [globalSettings, setGlobalSettings] = useState({ name: "Bagan Pertandingan", description: "Turnamen Badminton", footerText: "© 2026 Bagan Pertandingan. All rights reserved." });

  // Schedule state
  const [scheduleData, setScheduleData] = useState<ScheduleMatch[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [schedFilterMode, setSchedFilterMode] = useState<"day" | "category">("day");
  const [activeDay, setActiveDay] = useState<string>("");
  const [activeSchedCat, setActiveSchedCat] = useState<string>("");
  const [schedCatConfig, setSchedCatConfig] = useState<Array<{name: string; displayName: string; sortOrder: number}>>([]);

  useEffect(() => {
    const interval = setInterval(() => {
        if (activeCategory && viewMode === "bracket") loadMatches(activeCategory);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [activeCategory, viewMode]);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCategories(data);
          if (data.length > 0) {
            setActiveCategory(data[0].id);
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    fetch("/api/settings")
      .then(r => r.json())
      .then(data => {
        if (data && !data.error) {
           setGlobalSettings({
             name: data.name || "Bagan Pertandingan",
             description: data.description || "Turnamen Badminton",
             footerText: data.footerText || "© 2026 Bagan Pertandingan. All rights reserved."
           });
        }
      });
  }, []);

  const loadMatches = useCallback((categoryId: number) => {
    setMatchesLoading(true);
    fetch(`/api/matches?categoryId=${categoryId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setMatches(data);
        }
      })
      .catch(console.error)
      .finally(() => setMatchesLoading(false));
  }, []);

  const loadSchedule = useCallback(() => {
    setScheduleLoading(true);
    fetch("/api/schedule")
      .then((r) => r.json())
      .then((data) => {
        const matches = data?.matches || (Array.isArray(data) ? data : []);
        if (Array.isArray(matches)) {
          setScheduleData(matches);
          const days = [...new Set(matches.map((m: ScheduleMatch) => m.dayDate))];
          if (days.length > 0 && !activeDay) setActiveDay(days[0]);
          // Use first category from config or data
          const cats = [...new Set(matches.map((m: ScheduleMatch) => m.category))];
          if (cats.length > 0 && !activeSchedCat) setActiveSchedCat(cats[0]);
        }
        if (data?.categoryConfig) {
          setSchedCatConfig(data.categoryConfig);
        }
      })
      .catch(console.error)
      .finally(() => setScheduleLoading(false));
  }, [activeDay, activeSchedCat]);

  useEffect(() => {
    if (activeCategory && viewMode === "bracket") {
      loadMatches(activeCategory);
    }
  }, [activeCategory, loadMatches, viewMode]);

  useEffect(() => {
    if (viewMode === "schedule" && scheduleData.length === 0) {
      loadSchedule();
    }
  }, [viewMode, loadSchedule, scheduleData.length]);

  // Group matches by round (for bracket view)
  const rounds = matches.reduce(
    (acc, match) => {
      if (!acc[match.round]) {
        acc[match.round] = { roundOrder: match.roundOrder, matches: [] };
      }
      acc[match.round].matches.push(match);
      return acc;
    },
    {} as Record<string, { roundOrder: number; matches: Match[] }>
  );

  const sortedRounds = Object.entries(rounds).sort(
    ([, a], [, b]) => a.roundOrder - b.roundOrder
  );

  const activeCat = categories.find((c) => c.id === activeCategory);

  // Schedule derived data
  const scheduleDays = [...new Set(scheduleData.map(m => m.dayDate))];

  // Build sorted category list using config
  const rawCategories = [...new Set(scheduleData.map(m => m.category))];
  const scheduleCategories = rawCategories.sort((a, b) => {
    const configA = schedCatConfig.find(c => c.name === a);
    const configB = schedCatConfig.find(c => c.name === b);
    return (configA?.sortOrder ?? 99) - (configB?.sortOrder ?? 99);
  });

  // Helper: get display name for a category
  function getCatDisplayName(name: string): string {
    const config = schedCatConfig.find(c => c.name === name);
    return config?.displayName || name;
  }
  const filteredSchedule = schedFilterMode === "day"
    ? scheduleData.filter(m => m.dayDate === activeDay)
    : scheduleData.filter(m => m.category === activeSchedCat);

  // Group schedule by day if "per category" mode
  const schedGroupedByDay: Record<string, ScheduleMatch[]> = {};
  if (schedFilterMode === "category") {
    filteredSchedule.forEach(m => {
      if (!schedGroupedByDay[m.dayDate]) schedGroupedByDay[m.dayDate] = [];
      schedGroupedByDay[m.dayDate].push(m);
    });
  }

  // Helper to format short day label from "Sabtu, 4 April 2026"
  function shortDay(full: string) {
    const parts = full.split(",");
    if (parts.length >= 2) {
      const dayName = parts[0].trim().substring(0, 3);
      const datePart = parts[1].trim().split(" ");
      return `${dayName}, ${datePart[0]} ${(datePart[1] || "").substring(0, 3)}`;
    }
    return full;
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1 className="title">
            <span className="title-icon">🏸</span>
            <span>{globalSettings.name}</span>
          </h1>
          {globalSettings.description && <p className="subtitle">{globalSettings.description}</p>}
        </div>
      </header>

      {/* ===== VIEW MODE SELECTOR ===== */}
      <div className="view-selector">
        <button
          className={`view-card ${viewMode === "bracket" ? "view-active" : ""}`}
          onClick={() => setViewMode("bracket")}
        >
          <span className="view-icon">🏆</span>
          <span className="view-label">Bagan Turnamen</span>
        </button>
        <button
          className={`view-card ${viewMode === "schedule" ? "view-active" : ""}`}
          onClick={() => setViewMode("schedule")}
        >
          <span className="view-icon">📅</span>
          <span className="view-label">Jadwal Pertandingan</span>
        </button>
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <p>Memuat data...</p>
        </div>
      ) : (
        <>
          {/* ===== BRACKET VIEW ===== */}
          {viewMode === "bracket" && (
            <>
              <div className="navigation-container">
                {categories.length > 0 && (
                  <nav className="category-tabs">
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        className={`tab-btn ${activeCategory === cat.id ? "active" : ""}`}
                        onClick={() => setActiveCategory(cat.id)}
                      >
                        <span className="tab-name">{cat.name}</span>
                        <span className="tab-label">{cat.label}</span>
                      </button>
                    ))}
                  </nav>
                )}

                {activeCat && (
                  <div className="bracket-info">
                    {activeCat.customTags ? (
                      activeCat.customTags.split(",").map((tag, idx) => (
                        <span key={idx} className="info-badge">
                          {tag.trim()}
                        </span>
                      ))
                    ) : (
                      <>
                        <span className="info-badge">
                          {activeCat.totalTeams} Pasangan
                        </span>
                        <span className="info-badge">
                          Bracket {activeCat.bracketSize}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {matchesLoading && matches.length === 0 ? (
                <div className="loading">
                  <div className="spinner"></div>
                  <p>Memuat bagan...</p>
                </div>
              ) : matches.length === 0 ? (
                <div className="empty-state">
                  <p>🏸 Belum ada data pertandingan.</p>
                  <p className="empty-hint">
                    Silakan import data dari halaman admin.
                  </p>
                </div>
              ) : (
                <div className="bracket-container">
                  <div className="bracket">
                    {sortedRounds.map(([round, { matches: roundMatches }]) => (
                      <div key={round} className="round-column">
                        <div
                          className={`round-header ${ROUND_CLASSES[round] || ""}`}
                        >
                          {ROUND_LABELS[round] || round}
                        </div>
                        <div className="round-matches">
                          {roundMatches
                            .sort((a, b) => a.matchOrder - b.matchOrder)
                            .map((match) => (
                              <MatchCard
                                key={match.id}
                                match={match}
                                roundClass={ROUND_CLASSES[round] || ""}
                                allMatches={matches}
                                isFirstRound={match.roundOrder === 0}
                              />
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ===== SCHEDULE VIEW ===== */}
          {viewMode === "schedule" && (
            <div className="schedule-view">
              {/* Filter mode tabs */}
              <div className="sched-filter-tabs">
                <button
                  className={`sched-filter-btn ${schedFilterMode === "day" ? "active" : ""}`}
                  onClick={() => setSchedFilterMode("day")}
                >
                  📆 Per Hari
                </button>
                <button
                  className={`sched-filter-btn ${schedFilterMode === "category" ? "active" : ""}`}
                  onClick={() => setSchedFilterMode("category")}
                >
                  🏸 Per Kategori
                </button>
              </div>

              {/* Day picker (horizontal scroll) */}
              {schedFilterMode === "day" && (
                <div className="sched-day-picker">
                  {scheduleDays.map((day, idx) => (
                    <button
                      key={day}
                      className={`sched-day-btn ${activeDay === day ? "active" : ""}`}
                      onClick={() => setActiveDay(day)}
                    >
                      <span className="sched-day-number">Hari {idx + 1}</span>
                      <span className="sched-day-label">{shortDay(day)}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Category picker */}
              {schedFilterMode === "category" && (
                <div className="sched-cat-picker">
                  {scheduleCategories.map((cat) => (
                    <button
                      key={cat}
                      className={`sched-cat-btn ${activeSchedCat === cat ? "active" : ""}`}
                      onClick={() => setActiveSchedCat(cat)}
                    >
                      {getCatDisplayName(cat)}
                    </button>
                  ))}
                </div>
              )}

              {scheduleLoading ? (
                <div className="loading">
                  <div className="spinner"></div>
                  <p>Memuat jadwal...</p>
                </div>
              ) : scheduleData.length === 0 ? (
                <div className="empty-state">
                  <p>📅 Belum ada data jadwal pertandingan.</p>
                  <p className="empty-hint">Silakan import jadwal dari halaman admin.</p>
                </div>
              ) : (
                <div className="schedule-list">
                  {schedFilterMode === "day" ? (
                    <>
                      <h2 className="sched-day-title">📅 {activeDay}</h2>
                      <div className="sched-cards">
                        {filteredSchedule.map((m) => (
                          <ScheduleCard key={m.id} match={m} catDisplayName={getCatDisplayName(m.category)} />
                        ))}
                      </div>
                    </>
                  ) : (
                    Object.entries(schedGroupedByDay).map(([day, dayMatches]) => (
                      <div key={day} className="sched-day-group">
                        <h3 className="sched-group-title">📅 {day}</h3>
                        <div className="sched-cards">
                          {dayMatches.map((m) => (
                            <ScheduleCard key={m.id} match={m} catDisplayName={getCatDisplayName(m.category)} />
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <footer className="footer">
        <p>{globalSettings.footerText}</p>
      </footer>
    </div>
  );
}
