"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Category {
  id: number;
  name: string;
  label: string;
  totalTeams: number;
  bracketSize: number;
  scoreFormat: string;
  csvUrl: string | null;
  customTags: string | null;
  autoImportInterval: number;
}

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
}

const ROUND_LABELS: Record<string, string> = {
  R64: "Babak 64 Besar",
  R32: "Babak 32 Besar",
  R16: "Babak 16 Besar",
  QF: "Perempat Final",
  SF: "Semi-Final",
  F: "Final",
};

export default function AdminPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [mainTab, setMainTab] = useState<"matches" | "settings">("matches");

  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Global Settings State
  const [globalSettings, setGlobalSettings] = useState({ name: "", description: "", footerText: "" });
  const [globalSettingsMsg, setGlobalSettingsMsg] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Check auth
  useEffect(() => {
    fetch("/api/auth/check")
      .then((r) => {
        if (!r.ok) {
          router.push("/login");
          return;
        }
        return r.json();
      })
      .then((data) => {
        if (data?.authenticated) {
          setAuthenticated(true);
        }
      })
      .catch(() => router.push("/login"));
  }, [router]);

  // Load categories & settings
  useEffect(() => {
    if (!authenticated) return;
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCategories(data);
          if (data.length > 0) setActiveCategory(data[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    fetch("/api/settings")
      .then(r => r.json())
      .then(data => {
        if (data && !data.error) {
          setGlobalSettings({
            name: data.name || "",
            description: data.description || "",
            footerText: data.footerText || ""
          });
        }
      });
  }, [authenticated]);

  const loadMatches = useCallback((categoryId: number) => {
    setLoading(true);
    fetch(`/api/matches?categoryId=${categoryId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setMatches(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeCategory && authenticated && mainTab === "matches") {
      loadMatches(activeCategory);
    }
  }, [activeCategory, authenticated, loadMatches, mainTab]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const handleImport = async () => {
    if (!activeCategory) return;
    setImporting(true);
    setImportResult(null);

    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: activeCategory }),
      });
      const data = await res.json();

      if (res.ok) {
        setImportResult(
          `✅ Berhasil import ${data.matchesImported} pertandingan!`
        );
        loadMatches(activeCategory);
      } else {
        setImportResult(`❌ Error: ${data.error}`);
      }
    } catch {
      setImportResult("❌ Gagal melakukan import.");
    } finally {
      setImporting(false);
    }
  };

  const handleSaveMatch = async () => {
    if (!editingMatch) return;
    setSaveMsg(null);

    try {
      const res = await fetch("/api/admin/matches", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingMatch),
      });

      if (res.ok) {
        setSaveMsg("✅ Berhasil disimpan!");
        setEditingMatch(null);
        if (activeCategory) loadMatches(activeCategory);
      } else {
        const data = await res.json();
        setSaveMsg(`❌ Error: ${data.error}`);
      }
    } catch {
      setSaveMsg("❌ Gagal menyimpan.");
    }
  };

  const handleUpdateCategoryData = async (updates: Partial<Category>) => {
    if (!activeCategory) return;
    try {
      const res = await fetch("/api/admin/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: activeCategory, ...updates }),
      });
      if (res.ok) {
        setCategories((cats) =>
          cats.map((c) => (c.id === activeCategory ? { ...c, ...updates } : c))
        );
        if (updates.scoreFormat) setImportResult("✅ Pengaturan skor disimpan!");
        setTimeout(() => setImportResult(null), 3000);
      } else {
        setImportResult("❌ Gagal update pengaturan kategori");
      }
    } catch {
      setImportResult("❌ Gagal update pengaturan kategori");
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setGlobalSettingsMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(globalSettings)
      });
      if (res.ok) {
        setGlobalSettingsMsg("✅ Berhasil disimpan");
      } else {
        const data = await res.json().catch(() => ({}));
        setGlobalSettingsMsg("❌ Gagal menyimpan: " + (data?.error || res.statusText));
      }
    } catch (e: any) {
      setGlobalSettingsMsg("❌ Terjadi kesalahan: " + (e.message || "Unknown error"));
    } finally {
      setSavingSettings(false);
      setTimeout(() => setGlobalSettingsMsg(null), 5000);
    }
  };

  if (!authenticated) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Memeriksa autentikasi...</p>
      </div>
    );
  }

  // Group by rounds
  const roundGroups = matches.reduce(
    (acc, m) => {
      if (!acc[m.round]) acc[m.round] = [];
      acc[m.round].push(m);
      return acc;
    },
    {} as Record<string, Match[]>
  );

  const sortedRoundKeys = Object.keys(roundGroups).sort((a, b) => {
    const orderA = matches.find((m) => m.round === a)?.roundOrder || 0;
    const orderB = matches.find((m) => m.round === b)?.roundOrder || 0;
    return orderA - orderB;
  });

  const activeCat = categories.find((c) => c.id === activeCategory);

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <h2>🏸 Admin Panel</h2>
        </div>
        <nav className="admin-sidebar-nav">
          <button
            className={`nav-btn ${mainTab === "matches" ? "active" : ""}`}
            onClick={() => setMainTab("matches")}
          >
            📋 Pertandingan
          </button>
          <button
            className={`nav-btn ${mainTab === "settings" ? "active" : ""}`}
            onClick={() => setMainTab("settings")}
          >
            ⚙️ Pengaturan Utama
          </button>
        </nav>
        <div className="admin-sidebar-footer">
          <button onClick={handleLogout} className="logout-btn">
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        {mainTab === "matches" && (
          <div className="admin-content-container">
            <nav className="admin-tabs">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  className={`admin-tab ${activeCategory === cat.id ? "active" : ""}`}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  {cat.name}
                </button>
              ))}
            </nav>

            <div className="admin-actions-row">
              <button
                onClick={handleImport}
                className="import-btn"
                disabled={importing}
              >
                {importing ? (
                  <>
                    <span className="spinner-sm"></span> Mengimport...
                  </>
                ) : (
                  "📥 Import dari Google Spreadsheet"
                )}
              </button>
              
              <div className="format-toggle">
                <label>Opsi Skor:</label>
                <select
                  value={activeCat?.scoreFormat || "continuous"}
                  onChange={(e) => handleUpdateCategoryData({ scoreFormat: e.target.value })}
                >
                  <option value="continuous">Bersambung (1 Kolom)</option>
                  <option value="sets">Sistem Set (Best of 3)</option>
                </select>
              </div>

              {importResult && (
                <div className={`import-result ${importResult.startsWith("✅") ? "success" : "error"}`}>
                  {importResult}
                </div>
              )}
            </div>

            <div className="admin-actions-grid">
               <div className="admin-action-item">
                 <label>Judul Kategori (Tab):</label>
                 <input 
                   type="text" 
                   value={activeCat?.name || ""}
                   onChange={(e) => {
                      const val = e.target.value;
                      setCategories((cats) => cats.map((c) => (c.id === activeCategory ? { ...c, name: val } : c)));
                   }}
                   onBlur={(e) => handleUpdateCategoryData({ name: e.target.value.trim() })}
                   className="admin-input-sm"
                 />
               </div>
               <div className="admin-action-item">
                 <label>Keterangan / Sub-judul:</label>
                 <input 
                   type="text" 
                   value={activeCat?.label || ""}
                   onChange={(e) => {
                      const val = e.target.value;
                      setCategories((cats) => cats.map((c) => (c.id === activeCategory ? { ...c, label: val } : c)));
                   }}
                   onBlur={(e) => handleUpdateCategoryData({ label: e.target.value.trim() })}
                   className="admin-input-sm"
                 />
               </div>
                <div className="admin-action-item">
                  <label>Auto-Import:</label>
                  <select
                    value={activeCat?.autoImportInterval || 0}
                    onChange={(e) =>
                      handleUpdateCategoryData({
                        autoImportInterval: parseInt(e.target.value),
                      })
                    }
                    className="admin-select-sm"
                  >
                    <option value={0}>Manual Only</option>
                    <option value={10}>10 Menit</option>
                    <option value={30}>30 Menit</option>
                    <option value={60}>1 Jam</option>
                  </select>
                </div>
                <div className="admin-action-item">
                  <label>Ukuran Bagan (8, 16, 32, 64):</label>
                  <input
                    type="number"
                    value={activeCat?.bracketSize || 64}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val)) {
                        setCategories((cats) => cats.map((c) => (c.id === activeCategory ? { ...c, bracketSize: val } : c)));
                      }
                    }}
                    onBlur={(e) => handleUpdateCategoryData({ bracketSize: parseInt(e.target.value) })}
                    className="admin-input-sm"
                  />
                </div>
                <div className="admin-action-item full-width">
                 <label>Tag / Label (Pisahkan dengan koma):</label>
                 <input 
                   type="text" 
                   placeholder="cth: 40 Pasang, Kuota Penuh"
                   value={activeCat?.customTags || ""}
                   onChange={(e) => {
                      const val = e.target.value;
                      setCategories((cats) => cats.map((c) => (c.id === activeCategory ? { ...c, customTags: val } : c)));
                   }}
                   onBlur={(e) => handleUpdateCategoryData({ customTags: (e.target.value.trim() || null) })}
                   className="admin-input-sm"
                 />
               </div>
            </div>

            {saveMsg && (
              <div className={`save-msg ${saveMsg.startsWith("✅") ? "success" : "error"}`}>
                {saveMsg}
              </div>
            )}

            {loading ? (
              <div className="loading">
                <div className="spinner"></div>
                <p>Memuat data...</p>
              </div>
            ) : matches.length === 0 ? (
              <div className="empty-state admin-empty">
                <p>Belum ada data pertandingan untuk kategori ini.</p>
                <p>Klik tombol &quot;Import dari Google Spreadsheet&quot; untuk memuat data.</p>
              </div>
            ) : (
              <div className="admin-matches">
                {sortedRoundKeys.map((round) => (
                  <div key={round} className="admin-round-group">
                    <h2 className="admin-round-title">
                      {ROUND_LABELS[round] || round}
                    </h2>
                    <div className="admin-match-list">
                      {roundGroups[round]
                        .sort((a, b) => a.matchOrder - b.matchOrder)
                        .map((match) => (
                          <div
                            key={match.id}
                            className={`admin-match-card ${match.isBye ? "bye" : ""} ${match.status === "completed" ? "completed" : ""}`}
                          >
                            <div className="admin-match-top">
                              <span className="admin-match-code">
                                {match.matchCode}
                              </span>
                              <span
                                className={`admin-match-status status-${match.status}`}
                              >
                                {match.status === "upcoming"
                                  ? "Belum dimulai"
                                  : match.status === "ongoing"
                                    ? "Berlangsung"
                                    : "Selesai"}
                              </span>
                            </div>

                            <div className="admin-match-teams">
                              <div
                                className={`admin-team ${match.winner === 1 ? "winner" : ""}`}
                              >
                                {match.team1Number !== null && (
                                  <span className="admin-seed">
                                    [{match.team1Number}]
                                  </span>
                                )}
                                <span className="admin-team-name">
                                  {match.team1Name || "TBD"}
                                </span>
                                {match.scoreTeam1 && (
                                  <span className="admin-score">
                                    {match.scoreTeam1}
                                  </span>
                                )}
                              </div>
                              <div className="admin-vs">VS</div>
                              <div
                                className={`admin-team ${match.winner === 2 ? "winner" : ""}`}
                              >
                                {match.team2Number !== null && (
                                  <span className="admin-seed">
                                    [{match.team2Number}]
                                  </span>
                                )}
                                <span className="admin-team-name">
                                  {match.team2Name || "TBD"}
                                </span>
                                {match.scoreTeam2 && (
                                  <span className="admin-score">
                                    {match.scoreTeam2}
                                  </span>
                                )}
                              </div>
                            </div>

                            {match.schedule && (
                              <div className="admin-schedule">
                                📅 {match.schedule}
                              </div>
                            )}

                            <button
                              className="edit-btn"
                              onClick={() => setEditingMatch({ ...match })}
                            >
                              ✏️ Edit
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {mainTab === "settings" && (
          <div className="admin-content-container settings-container">
            <h1>⚙️ Pengaturan Halaman Publik</h1>
            <p className="settings-desc">Kustomisasi teks yang muncul pada halaman utama penonton.</p>
            
            <div className="settings-form">
              <div className="form-group">
                <label>Judul Utama (Header)</label>
                <input 
                  type="text" 
                  value={globalSettings.name} 
                  onChange={(e) => setGlobalSettings({...globalSettings, name: e.target.value})}
                  placeholder="cth: Bagan Pertandingan"
                />
              </div>

              <div className="form-group">
                <label>Subjudul (Keterangan di bawah Header)</label>
                <input 
                  type="text" 
                  value={globalSettings.description} 
                  onChange={(e) => setGlobalSettings({...globalSettings, description: e.target.value})}
                  placeholder="cth: Turnamen Badminton Tingkat Lokal 2026"
                />
              </div>

              <div className="form-group">
                <label>Teks Footer (Copyright Footage)</label>
                <input 
                  type="text" 
                  value={globalSettings.footerText} 
                  onChange={(e) => setGlobalSettings({...globalSettings, footerText: e.target.value})}
                  placeholder="cth: © 2026 Bagan Pertandingan. All rights reserved."
                />
              </div>

              <button className="save-btn lg" onClick={handleSaveSettings} disabled={savingSettings}>
                {savingSettings ? "Menyimpan..." : "💾 Simpan Pengaturan"}
              </button>

              {globalSettingsMsg && (
                <div style={{ marginTop: '1rem', padding: '0.8rem', borderRadius: '8px', background: globalSettingsMsg.includes('❌') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)', color: globalSettingsMsg.includes('❌') ? '#ef4444' : '#22c55e' }}>
                  {globalSettingsMsg}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Edit Modal */}
      {editingMatch && mainTab === "matches" && (
        <div className="modal-overlay" onClick={() => setEditingMatch(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Pertandingan {editingMatch.matchCode}</h2>
              <button
                className="modal-close"
                onClick={() => setEditingMatch(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Tim 1</label>
                  <input
                    type="text"
                    value={editingMatch.team1Name || ""}
                    onChange={(e) =>
                      setEditingMatch({
                        ...editingMatch,
                        team1Name: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Tim 2</label>
                  <input
                    type="text"
                    value={editingMatch.team2Name || ""}
                    onChange={(e) =>
                      setEditingMatch({
                        ...editingMatch,
                        team2Name: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>No. Urut Tim 1</label>
                  <input
                    type="number"
                    value={editingMatch.team1Number ?? ""}
                    onChange={(e) =>
                      setEditingMatch({
                        ...editingMatch,
                        team1Number: e.target.value
                          ? parseInt(e.target.value)
                          : null,
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>No. Urut Tim 2</label>
                  <input
                    type="number"
                    value={editingMatch.team2Number ?? ""}
                    onChange={(e) =>
                      setEditingMatch({
                        ...editingMatch,
                        team2Number: e.target.value
                          ? parseInt(e.target.value)
                          : null,
                      })
                    }
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>{activeCat?.scoreFormat === "sets" ? "Skor Set Tim 1" : "Total Skor Tim 1"}</label>
                  <input
                    type={activeCat?.scoreFormat === "sets" ? "text" : "number"}
                    value={editingMatch.scoreTeam1 || ""}
                    onChange={(e) =>
                      setEditingMatch({
                        ...editingMatch,
                        scoreTeam1: e.target.value || null,
                      })
                    }
                    placeholder={activeCat?.scoreFormat === "sets" ? "cth: 21-15 21-18" : "cth: 42"}
                  />
                </div>
                <div className="form-group">
                  <label>{activeCat?.scoreFormat === "sets" ? "Skor Set Tim 2" : "Total Skor Tim 2"}</label>
                  <input
                    type={activeCat?.scoreFormat === "sets" ? "text" : "number"}
                    value={editingMatch.scoreTeam2 || ""}
                    onChange={(e) =>
                      setEditingMatch({
                        ...editingMatch,
                        scoreTeam2: e.target.value || null,
                      })
                    }
                    placeholder={activeCat?.scoreFormat === "sets" ? "cth: 15-21 18-21" : "cth: 25"}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Jadwal</label>
                  <input
                    type="text"
                    value={editingMatch.schedule || ""}
                    onChange={(e) =>
                      setEditingMatch({
                        ...editingMatch,
                        schedule: e.target.value || null,
                      })
                    }
                    placeholder="cth: Kamis / 16 April 2026, @19:30"
                  />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={editingMatch.status}
                    onChange={(e) =>
                      setEditingMatch({
                        ...editingMatch,
                        status: e.target.value,
                      })
                    }
                  >
                    <option value="upcoming">Belum dimulai</option>
                    <option value="ongoing">Berlangsung</option>
                    <option value="completed">Selesai</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Pemenang</label>
                <div className="winner-select">
                  <button
                    type="button"
                    className={`winner-btn ${editingMatch.winner === 1 ? "selected" : ""}`}
                    onClick={() =>
                      setEditingMatch({ ...editingMatch, winner: 1 })
                    }
                  >
                    Tim 1: {editingMatch.team1Name || "TBD"}
                  </button>
                  <button
                    type="button"
                    className={`winner-btn ${editingMatch.winner === 2 ? "selected" : ""}`}
                    onClick={() =>
                      setEditingMatch({ ...editingMatch, winner: 2 })
                    }
                  >
                    Tim 2: {editingMatch.team2Name || "TBD"}
                  </button>
                  <button
                    type="button"
                    className={`winner-btn clear ${editingMatch.winner === null ? "selected" : ""}`}
                    onClick={() =>
                      setEditingMatch({ ...editingMatch, winner: null })
                    }
                  >
                    Belum ditentukan
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="cancel-btn"
                onClick={() => setEditingMatch(null)}
              >
                Batal
              </button>
              <button className="save-btn" onClick={handleSaveMatch}>
                💾 Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
