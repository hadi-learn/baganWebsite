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
  // Try to clean up name, check if it's waiting
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

export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [globalSettings, setGlobalSettings] = useState({ name: "Bagan Pertandingan", description: "Turnamen Badminton", footerText: "© 2026 Bagan Pertandingan. All rights reserved." });

  // Auto-refresh interval (poll every 5 minutes in case the tab is left open)
  useEffect(() => {
    const interval = setInterval(() => {
        if (activeCategory) loadMatches(activeCategory);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [activeCategory]);

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

  useEffect(() => {
    if (activeCategory) {
      loadMatches(activeCategory);
    }
  }, [activeCategory, loadMatches]);

  // Group matches by round
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

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <p>Memuat data...</p>
        </div>
      ) : (
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

      <footer className="footer">
        <p>{globalSettings.footerText}</p>
      </footer>
    </div>
  );
}
