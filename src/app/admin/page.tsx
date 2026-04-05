"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getCategoryStyles } from "@/lib/colors";
import { getUnifiedMatchCode, normalizeCategoryName, normalizeMatchCode } from "@/lib/playerUtils";

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
  categoryId: number;
  matchCode: string;
  round: string;
  roundOrder: number;
  matchOrder: number;
  team1Name: string | null;
  team1Club: string | null;
  team1Seed: string | null;
  team1Number: number | null;
  team2Name: string | null;
  team2Club: string | null;
  team2Seed: string | null;
  team2Number: number | null;
  scoreTeam1: string | null;
  scoreTeam2: string | null;
  winner: number | null;
  isBye: boolean;
  schedule: string | null;
  status: string;
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

interface SchedCatConfig {
  name: string;
  displayName: string;
  sortOrder: number;
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
  const [mainTab, setMainTab] = useState<"matches" | "settings" | "schedule" | "gallery">("matches");

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

  // Schedule Settings State
  const [schedCsvUrl, setSchedCsvUrl] = useState("");
  const [schedAutoImport, setSchedAutoImport] = useState(0);
  const [schedImporting, setSchedImporting] = useState(false);
  const [schedMsg, setSchedMsg] = useState<string | null>(null);
  const [schedLastImport, setSchedLastImport] = useState<string | null>(null);
  const [schedMatches, setSchedMatches] = useState<ScheduleMatch[]>([]);
  const [schedCatConfig, setSchedCatConfig] = useState<SchedCatConfig[]>([]);
  const [editingSchedMatch, setEditingSchedMatch] = useState<ScheduleMatch | null>(null);
  const [schedActiveDay, setSchedActiveDay] = useState<string>("");
  
  // Gallery State
  const [galleryMatchCode, setGalleryMatchCode] = useState("");
  const [galleryPhotos, setGalleryPhotos] = useState<any[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryMsg, setGalleryMsg] = useState<string | null>(null);

  const [gallerySummary, setGallerySummary] = useState<any[]>([]);
  const [gallerySummaryLoading, setGallerySummaryLoading] = useState(false);
  const [showGalleryAdd, setShowGalleryAdd] = useState(false);

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

    // Load schedule settings
    fetch("/api/admin/schedule/settings")
      .then(r => r.json())
      .then(data => {
        if (data && !data.error) {
          setSchedCsvUrl(data.csvUrl || "");
          setSchedAutoImport(data.autoImportInterval || 0);
          setSchedLastImport(data.lastImportedAt || null);
        }
      });
  }, [authenticated]);

  useEffect(() => {
    if (authenticated && mainTab === "gallery" && !showGalleryAdd) {
      loadGallerySummary();
    }
  }, [authenticated, mainTab, showGalleryAdd]);

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

  const loadScheduleMatches = useCallback(() => {
    fetch("/api/schedule")
      .then(r => r.json())
      .then(data => {
        if (data?.matches) {
          setSchedMatches(data.matches);
          const days = [...new Set(data.matches.map((m: ScheduleMatch) => m.dayDate))] as string[];
          if (days.length > 0 && !schedActiveDay) setSchedActiveDay(days[0]);
        }
        if (data?.categoryConfig) {
          setSchedCatConfig(data.categoryConfig);
        }
      })
      .catch(console.error);
  }, [schedActiveDay]);

  const handleScheduleImport = async () => {
    setSchedImporting(true);
    setSchedMsg(null);
    try {
      const res = await fetch("/api/admin/schedule/import", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSchedMsg(`✅ Berhasil import ${data.matchesImported} pertandingan dari ${data.daysFound} hari!`);
        setSchedLastImport(new Date().toISOString());
        loadScheduleMatches();
        // Reload settings to get updated category config
        fetch("/api/admin/schedule/settings").then(r => r.json()).then(d => {
          if (d?.categoryConfig) setSchedCatConfig(d.categoryConfig);
        });
      } else {
        setSchedMsg(`❌ Error: ${data.error}`);
      }
    } catch {
      setSchedMsg("❌ Gagal melakukan import jadwal.");
    } finally {
      setSchedImporting(false);
    }
  };

  useEffect(() => {
    if (authenticated && mainTab === "schedule") {
      loadScheduleMatches();
    }
  }, [authenticated, mainTab, loadScheduleMatches]);

  const handleSaveSchedMatch = async () => {
    if (!editingSchedMatch) return;
    try {
      const res = await fetch("/api/admin/schedule/matches", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingSchedMatch),
      });
      if (res.ok) {
        setSchedMsg("✅ Pertandingan jadwal berhasil disimpan!");
        setEditingSchedMatch(null);
        loadScheduleMatches();
      } else {
        setSchedMsg("❌ Gagal menyimpan pertandingan jadwal");
      }
    } catch {
      setSchedMsg("❌ Terjadi kesalahan");
    }
    setTimeout(() => setSchedMsg(null), 5000);
  };

  const handleSaveScheduleSettings = async () => {
    setSchedMsg(null);
    try {
      const res = await fetch("/api/admin/schedule/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvUrl: schedCsvUrl, autoImportInterval: schedAutoImport, categoryConfig: schedCatConfig }),
      });
      if (res.ok) {
        setSchedMsg("✅ Pengaturan jadwal disimpan!");
      } else {
        setSchedMsg("❌ Gagal menyimpan pengaturan jadwal");
      }
    } catch {
      setSchedMsg("❌ Terjadi kesalahan");
    }
    setTimeout(() => setSchedMsg(null), 5000);
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

  // --- Gallery Functions ---
  const loadGallerySummary = async () => {
    setGallerySummaryLoading(true);
    try {
      const res = await fetch("/api/admin/gallery/summary");
      const data = await res.json();
      if (res.ok) {
        setGallerySummary(data.summary || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGallerySummaryLoading(false);
    }
  };

  const handleGalleryAddShortcut = (unifiedCode: string) => {
    setGalleryMatchCode(unifiedCode);
    setMainTab("gallery");
    setEditingMatch(null);
    setEditingSchedMatch(null);
    loadGallery(unifiedCode);
  };

  const loadGallery = async (rawCode: string, skipClearMsg = false) => {
    if (!rawCode) return;
    const matchCode = rawCode.trim();
    setGalleryMatchCode(matchCode);
    setShowGalleryAdd(true);
    setGalleryLoading(true);
    if (!skipClearMsg) setGalleryMsg(null);
    try {
      const res = await fetch(`/api/gallery?match=${encodeURIComponent(matchCode)}`);
      const data = await res.json();
      if (res.ok) {
        setGalleryPhotos(data.photos || []);
      } else {
        setGalleryMsg(`❌ Gagal: ${data.error}`);
      }
    } catch {
      setGalleryMsg("❌ Gagal memuat galeri");
    } finally {
      setGalleryLoading(false);
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    if (!galleryMatchCode) {
      setGalleryMsg("❌ Pilih Kategori dan Nomor Pertandingan terlebih dahulu!");
      return;
    }
    
    setGalleryMsg(null);
    setGalleryUploading(true);
    const filesArray = Array.from(e.target.files);
    const totalFiles = filesArray.length;
    let successCount = 0;
    const errors: string[] = [];
    
    try {
      for (let i = 0; i < totalFiles; i++) {
        setGalleryMsg(`⏳ Mengupload foto ${i + 1} dari ${totalFiles}...`);
        const file = filesArray[i];
        
        const formData = new FormData();
        formData.append("file", file);
        formData.append("matchCode", galleryMatchCode.trim());
        
        try {
          const res = await fetch("/api/admin/gallery", {
            method: "POST",
            body: formData,
          });
          if (res.ok) {
            successCount++;
          } else {
            const errData = await res.json().catch(() => ({ error: "Server Error (Non-JSON)" }));
            const msg = errData.step ? `[${errData.step}] ${errData.error}` : errData.error;
            errors.push(`${file.name}: ${msg || "Gagal"}`);
          }
        } catch (innerErr: any) {
          errors.push(`${file.name}: ${innerErr.message || "Network Error"}`);
        }
      }
      
      if (successCount === totalFiles) {
        setGalleryMsg(`✅ ${successCount} foto berhasil diupload!`);
      } else if (successCount > 0) {
        setGalleryMsg(`⚠️ Berhasil: ${successCount}. Gagal: ${errors.length}. Periksa koneksi.`);
        if (errors.length > 0) console.error("Upload Errors:", errors);
      } else {
        const errorDetail = errors.length > 0 ? ` (${errors[0].split(':').slice(1).join(':').trim()})` : "";
        setGalleryMsg(`❌ Gagal: ${errorDetail || "Periksa koneksi/ukuran file"}`);
      }
      loadGallery(galleryMatchCode, true);
      
      // Auto-clear success message after 5s
      if (successCount === totalFiles) {
        setTimeout(() => setGalleryMsg(null), 5000);
      }
    } catch (err) {
      setGalleryMsg("❌ Terjadi kesalahan fatal saat mengunggah.");
    } finally {
      setGalleryUploading(false);
      e.target.value = '';
    }
  };
  
  const handleGalleryDelete = async (id: number) => {
    if (!confirm("Hapus foto ini?")) return;
    setGalleryMsg(null);
    try {
      setGalleryMsg("⏳ Menghapus foto...");
      const res = await fetch("/api/admin/gallery", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setGalleryMsg("✅ Foto dihapus");
        loadGallery(galleryMatchCode);
      } else {
        setGalleryMsg("❌ Gagal menghapus");
      }
    } catch (err) {
      console.error(err);
      setGalleryMsg("❌ Gagal menghapus");
    }
  };
  
  const handleGalleryDeleteAll = async () => {
    if (!galleryMatchCode) return;
    if (!confirm(`Yakin ingin menghapus SEMUA FOTO pertandingan ${galleryMatchCode}? Tindakan ini tidak dapat dibatalkan.`)) return;

    setGalleryMsg("⏳ Menghapus semua foto...");
    try {
      const res = await fetch("/api/admin/gallery/all", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchCode: galleryMatchCode }),
      });
      if (res.ok) {
        setGalleryPhotos([]);
        setGalleryMsg("✅ Berhasil menghapus semua foto.");
        // Optional: refresh summary later if they back out
      } else {
        const data = await res.json();
        setGalleryMsg(`❌ Gagal: ${data.error}`);
      }
    } catch {
      setGalleryMsg("❌ Terjadi kesalahan saat menghapus semua foto.");
    }
  };

  const handleGalleryMove = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === galleryPhotos.length - 1) return;
    
    const newPhotos = [...galleryPhotos];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    
    // Swap
    const temp = newPhotos[index];
    newPhotos[index] = newPhotos[targetIdx];
    newPhotos[targetIdx] = temp;
    
    // Update sortOrder local
    newPhotos.forEach((p, i) => p.sortOrder = i);
    setGalleryPhotos(newPhotos);
    
    // DB Update
    try {
      setGalleryMsg("⏳ Menyimpan urutan...");
      const res = await fetch("/api/admin/gallery", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: newPhotos.map(p => ({ id: p.id, sortOrder: p.sortOrder })) }),
      });
      if (res.ok) setGalleryMsg(null);
      else setGalleryMsg("❌ Gagal menyimpan urutan");
    } catch (err) {
      console.error(err);
      setGalleryMsg("❌ Gagal menyimpan urutan");
    }
  };

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
            className={`nav-btn ${mainTab === "schedule" ? "active" : ""}`}
            onClick={() => setMainTab("schedule")}
          >
            📅 Jadwal
          </button>
          <button
            className={`nav-btn ${mainTab === "settings" ? "active" : ""}`}
            onClick={() => setMainTab("settings")}
          >
            ⚙️ Pengaturan Utama
          </button>
          <button
            className={`nav-btn ${mainTab === "gallery" ? "active" : ""}`}
            onClick={() => setMainTab("gallery")}
          >
            📸 Galeri Foto
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
              {categories.map((cat) => {
                const styles = getCategoryStyles(cat.name);
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    className={`admin-tab ${isActive ? "active" : ""}`}
                    onClick={() => setActiveCategory(cat.id)}
                    style={isActive ? {
                      backgroundColor: styles.background,
                      borderColor: styles.border,
                      color: styles.color,
                      fontWeight: 800
                    } : {
                      borderColor: styles.border,
                      color: styles.border,
                      backgroundColor: 'rgba(30, 41, 59, 0.5)',
                      opacity: 0.8
                    }}
                  >
                    {cat.name}
                  </button>
                );
              })}
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
                                <div className="team-badges-area">
                                  {match.team1Number !== null && (
                                    <span className="admin-seed">
                                      [{match.team1Number}]
                                    </span>
                                  )}
                                </div>
                                 <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                  <span className="admin-team-name">
                                    {match.team1Name || "TBD"}
                                  </span>
                                  {match.team1Club && <span style={{ fontSize: '0.65rem', color: 'var(--accent)', opacity: 0.8 }}>{match.team1Club}</span>}
                                </div>
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
                                <div className="team-badges-area">
                                  {match.team2Number !== null && (
                                    <span className="admin-seed">
                                      [{match.team2Number}]
                                    </span>
                                  )}
                                </div>
                                 <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                  <span className="admin-team-name">
                                    {match.team2Name || "TBD"}
                                  </span>
                                  {match.team2Club && <span style={{ fontSize: '0.65rem', color: 'var(--accent)', opacity: 0.8 }}>{match.team2Club}</span>}
                                </div>
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

                            <div style={{ display: "flex", gap: "0.5rem", marginTop: "auto" }}>
                              <button
                                className="edit-btn"
                                onClick={() => setEditingMatch({ ...match })}
                                style={{ flex: 1 }}
                              >
                                ✏️ Edit
                              </button>
                              <button
                                className="save-btn"
                                onClick={() => {
                                  const num = match.matchCode.replace(/\D/g, "");
                                  const unified = `${activeCat?.name || "Unknown"}-${num}`;
                                  handleGalleryAddShortcut(unified);
                                }}
                                style={{ flex: 1, padding: "0.4rem", fontSize: "0.75rem", background: "rgba(212, 175, 55, 0.2)", borderColor: "var(--accent)" }}
                              >
                                📸 Galeri
                              </button>
                            </div>
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

        {/* ===== Schedule Tab ===== */}
        {mainTab === "schedule" && (
          <div className="admin-content-container">
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '1.5rem' }}>📅 Pengaturan Jadwal Pertandingan</h2>
            <div className="admin-actions-grid" style={{ maxWidth: '700px' }}>
              <div className="admin-action-item full-width">
                <label>URL CSV Jadwal (Google Spreadsheet):</label>
                <input type="text" value={schedCsvUrl} onChange={(e) => setSchedCsvUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?gid=...&output=csv" className="admin-input-sm" style={{ width: '100%' }} />
              </div>
              <div className="admin-action-item">
                <label>Auto-Import:</label>
                <select value={schedAutoImport} onChange={(e) => setSchedAutoImport(parseInt(e.target.value))} className="admin-select-sm">
                  <option value={0}>Manual Only</option>
                  <option value={10}>10 Menit</option>
                  <option value={30}>30 Menit</option>
                  <option value={60}>1 Jam</option>
                </select>
              </div>
              <div className="admin-action-item">
                <label>Terakhir Import:</label>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{schedLastImport ? new Date(schedLastImport).toLocaleString('id-ID') : 'Belum pernah'}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
              <button onClick={handleSaveScheduleSettings} className="save-btn">💾 Simpan Pengaturan</button>
              <button onClick={handleScheduleImport} disabled={schedImporting} className="save-btn" style={{ background: 'rgba(34, 197, 94, 0.2)', borderColor: 'var(--success)' }}>
                {schedImporting ? "⏳ Mengimport..." : "📥 Import dari Spreadsheet"}
              </button>
            </div>
            {schedMsg && (
              <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', borderRadius: '8px', background: schedMsg.startsWith('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: schedMsg.startsWith('✅') ? '#86efac' : '#fca5a5', fontSize: '0.9rem' }}>{schedMsg}</div>
            )}
            {schedCatConfig.length > 0 && (
              <div style={{ marginTop: '2rem' }}>
                <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>🏷️ Nama Tampilan Kategori</h3>
                <div style={{ display: 'grid', gap: '0.5rem', maxWidth: '600px' }}>
                  {schedCatConfig.sort((a,b) => a.sortOrder - b.sortOrder).map((cat, idx) => (
                    <div key={cat.name} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{cat.name}</span>
                      <input type="text" value={cat.displayName} onChange={(e) => { const u = [...schedCatConfig]; u[idx] = { ...u[idx], displayName: e.target.value }; setSchedCatConfig(u); }} className="admin-input-sm" style={{ width: '100%' }} />
                      <input type="number" value={cat.sortOrder} onChange={(e) => { const u = [...schedCatConfig]; u[idx] = { ...u[idx], sortOrder: parseInt(e.target.value) || 0 }; setSchedCatConfig(u); }} className="admin-input-sm" style={{ width: '60px' }} title="Urutan" />
                    </div>
                  ))}
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem' }}>Kolom 1: Nama asli CSV | Kolom 2: Nama tampilan | Kolom 3: Urutan</p>
              </div>
            )}
            {schedMatches.length > 0 && (() => {
              const days = [...new Set(schedMatches.map(m => m.dayDate))];
              const filtered = schedMatches.filter(m => m.dayDate === schedActiveDay);
              return (
                <div style={{ marginTop: '2.5rem' }}>
                  <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>📋 Data Jadwal ({schedMatches.length} pertandingan)</h3>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    {days.map((day, idx) => (
                      <button key={day} onClick={() => setSchedActiveDay(day)} style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', border: schedActiveDay === day ? '1px solid var(--accent)' : '1px solid var(--glass-border)', background: schedActiveDay === day ? 'rgba(99,102,241,0.2)' : 'var(--glass-bg)', color: schedActiveDay === day ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                        H{idx+1}: {day.split(',')[0]}
                      </button>
                    ))}
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-muted)' }}>Jam</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-muted)' }}>Kategori</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-muted)' }}>Game</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-muted)' }}>Tim A</th>
                          <th style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>Skor</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-muted)' }}>Tim B</th>
                          <th style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>Status</th>
                          <th style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map(m => (
                          <tr key={m.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <td style={{ padding: '0.5rem', color: 'var(--accent-hover)', fontWeight: 700 }}>{m.time}</td>
                            <td style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>{m.category}</td>
                            <td style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>{m.gameNumber}</td>
                            <td style={{ padding: '0.5rem', color: m.winner === 1 ? '#86efac' : 'var(--text-primary)', fontSize: '0.75rem' }}>{m.team1Player1 || '-'}{m.team1Player2 ? ` / ${m.team1Player2}` : ''}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 700 }}>{m.scoreTeam1 || '0'} - {m.scoreTeam2 || '0'}</td>
                            <td style={{ padding: '0.5rem', color: m.winner === 2 ? '#86efac' : 'var(--text-primary)', fontSize: '0.75rem' }}>{m.team2Player1 || '-'}{m.team2Player2 ? ` / ${m.team2Player2}` : ''}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}><span style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 600, background: m.status === 'completed' ? 'rgba(34,197,94,0.15)' : 'rgba(99,102,241,0.15)', color: m.status === 'completed' ? '#86efac' : 'var(--accent-hover)' }}>{m.status === 'completed' ? 'Selesai' : 'Belum'}</span></td>
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center' }}>
                                <button onClick={() => setEditingSchedMatch(m)} style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid var(--accent)', background: 'rgba(99,102,241,0.1)', color: 'var(--accent-hover)', cursor: 'pointer', fontSize: '0.7rem' }}>✏️ Edit</button>
                                <button 
                                  onClick={() => {
                                    const num = m.gameNumber.replace(/\D/g, "");
                                    const unified = `${m.category}-${num}`;
                                    handleGalleryAddShortcut(unified);
                                  }} 
                                  style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid var(--accent)', background: 'rgba(212, 175, 55, 0.15)', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.7rem' }}
                                  title="Kelola Galeri Foto"
                                >
                                  📸 Galeri
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
        
        {mainTab === "gallery" && (
          <div className="admin-content-container">
            <div className="admin-sidebar-header" style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0 }}>📸 Kelola Galeri Foto Pertandingan</h2>
              {!showGalleryAdd ? (
                <button className="save-btn" onClick={() => { setGalleryMatchCode(""); setGalleryPhotos([]); setShowGalleryAdd(true); }}>
                  ➕ Tambah Galeri Baru
                </button>
              ) : (
                <button className="cancel-btn" onClick={() => { setShowGalleryAdd(false); loadGallerySummary(); }}>
                  ◀ Kembali
                </button>
              )}
            </div>
            
            {!showGalleryAdd ? (
              // SUMMARY VIEW
              gallerySummaryLoading ? (
                <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>Memuat ringkasan galeri...</div>
              ) : gallerySummary.length === 0 ? (
                <div className="empty-state">
                  <p>📸 Belum ada galeri foto yang tersimpan.</p>
                  <p className="empty-hint">Silakan tambahkan galeri foto pertandingan baru.</p>
                </div>
              ) : (
                <div className="schedule-list">
                  {(() => {
                    const mapped = gallerySummary.map(s => {
                      // Normalize candidate code for comparison
                      const candidateCode = s.matchCode?.trim().toLowerCase() || "";
                      
                      // Try find in schedule matches first
                      const sm = schedMatches.find(m => {
                        const normalizedTarget = getUnifiedMatchCode(m.category || "", m.gameNumber).toLowerCase();
                        return normalizedTarget === candidateCode;
                      });
                      if (sm) return { ...s, dayDate: sm.dayDate, category: sm.category, info: sm };

                      // Try find in bracket matches
                      const gm = matches.find(m => {
                        const categoryName = categories.find(c => c.id === m.categoryId)?.name || "Unknown";
                        const normalizedTarget = getUnifiedMatchCode(categoryName, m.matchCode).toLowerCase();
                        return normalizedTarget === candidateCode;
                      });
                      if (gm) {
                        const catName = categories.find(c => c.id === gm.categoryId)?.name || "Lainnya";
                        return { ...s, dayDate: "Bagan Utama", category: catName, info: gm };
                      }

                      return { ...s, dayDate: "Lainnya", category: "Lainnya", info: null };
                    });
                    const grouped = mapped.reduce((acc, curr) => {
                      if (!acc[curr.dayDate]) acc[curr.dayDate] = {};
                      if (!acc[curr.dayDate][curr.category]) acc[curr.dayDate][curr.category] = [];
                      acc[curr.dayDate][curr.category].push(curr);
                      return acc;
                    }, {} as Record<string, Record<string, any[]>>);
                    
                    return Object.entries(grouped).map(([day, catGroups]) => (
                      <div key={day} className="sched-day-group">
                        <h3 className="sched-group-title">📅 {day}</h3>
                        {Object.entries(catGroups as Record<string, any[]>).map(([cat, items]) => (
                          <div key={cat} style={{ marginBottom: '1.5rem' }}>
                            {(() => {
                              const styles = getCategoryStyles(cat);
                              return (
                                <div className="sched-category-badge" style={{ 
                                  marginBottom: '1rem', 
                                  display: 'inline-block',
                                  backgroundColor: styles.background,
                                  color: styles.color,
                                  border: `1px solid ${styles.border}`
                                }}>
                                  {cat}
                                </div>
                              );
                            })()}
                            <div className="sched-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                              {(items as any[]).map(item => (
                                <div key={item.matchCode} className="admin-card clickable" onClick={() => loadGallery(item.matchCode)} style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '1rem', cursor: 'pointer', margin: 0 }}>
                                  <div style={{ width: '80px', height: '60px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, background: '#000', border: '1px solid var(--border-light)' }}>
                                    {item.thumbnail ? <img src={item.thumbnail} alt="thumb" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent)' }}>#{item.matchCode}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>{item.photoCount} Foto Tersimpan</div>
                                    {item.info && (
                                      <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {item.info.team1Player1}{item.info.team1Player2 ? ` / ${item.info.team1Player2}` : ''} <span style={{ color: 'var(--text-muted)' }}>vs</span> {item.info.team2Player1}{item.info.team2Player2 ? ` / ${item.info.team2Player2}` : ''}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ));
                  })()}
                </div>
              )
            ) : (
              // DETAILED UPLOAD VIEW
              <>
                <div className="admin-card">
                  <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
                    <div className="form-group" style={{ flex: 2, minWidth: "150px", marginBottom: 0 }}>
                      <label>Kategori Pertandingan</label>
                      <select 
                        value={galleryMatchCode.includes('-') ? galleryMatchCode.substring(0, galleryMatchCode.lastIndexOf('-')) : ""} 
                        onChange={(e) => {
                          const numPart = galleryMatchCode.includes('-') ? galleryMatchCode.substring(galleryMatchCode.lastIndexOf('-') + 1) : galleryMatchCode;
                          setGalleryMatchCode(`${e.target.value}-${numPart}`);
                        }}
                      >
                        <option value="">-- Pilih Kategori --</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ flex: 1, minWidth: "100px", marginBottom: 0 }}>
                      <label>Nomor Urut / Game</label>
                      <input 
                        type="number" 
                        value={galleryMatchCode.includes('-') ? galleryMatchCode.substring(galleryMatchCode.lastIndexOf('-') + 1) : galleryMatchCode} 
                        onChange={(e) => {
                          const catPart = galleryMatchCode.includes('-') ? galleryMatchCode.substring(0, galleryMatchCode.lastIndexOf('-')) : "";
                          setGalleryMatchCode(`${catPart ? catPart + '-' : ''}${e.target.value}`);
                        }} 
                        placeholder="Cth: 1" 
                      />
                    </div>
                    <button className="save-btn" onClick={() => loadGallery(galleryMatchCode)}>
                      🔍 Buka Galeri
                    </button>
                  </div>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
                    Tentukan kategori lalu isi dengan identitas angkanya (misal pertandingan M1 atau #1, masukkan angka 1).
                  </p>
                </div>

                {galleryMsg && (
                  <div style={{ 
                    marginTop: "1rem", padding: "0.75rem", borderRadius: "8px", fontSize: "0.85rem",
                    background: galleryMsg.startsWith("❌") ? "rgba(239, 68, 68, 0.1)" : 
                               (galleryMsg.startsWith("⏳") ? "rgba(245, 158, 11, 0.1)" : "rgba(34, 197, 94, 0.1)"),
                    color: galleryMsg.startsWith("❌") ? "#fca5a5" : 
                          (galleryMsg.startsWith("⏳") ? "#fcd34d" : "#86efac"),
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}>
                    <span>{galleryMsg}</span>
                    <button 
                      onClick={() => setGalleryMsg(null)} 
                      style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", padding: "0 0.5rem", fontSize: "1.1rem" }}
                    >✕</button>
                  </div>
                )}

                <div className="admin-card" style={{ marginTop: "1.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <h3 style={{ color: "var(--text-primary)" }}>Daftar Foto ({galleryPhotos.length})</h3>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <label 
                        className="save-btn" 
                        style={{ 
                          background: "var(--accent)", 
                          cursor: (galleryUploading || !galleryMatchCode) ? "not-allowed" : "pointer",
                          opacity: (galleryUploading || !galleryMatchCode) ? 0.6 : 1,
                          display: "inline-block",
                          padding: "0.5rem 1rem",
                          borderRadius: "6px",
                          fontSize: "0.9rem"
                        }}
                      >
                        {galleryUploading ? "⏳ Uploading..." : "➕ Tambah Foto"}
                        <input 
                          type="file" 
                          multiple 
                          accept="image/*" 
                          onChange={handleGalleryUpload}
                          disabled={galleryUploading || !galleryMatchCode}
                          style={{ display: "none" }}
                        />
                      </label>
                      {galleryPhotos.length > 0 && (
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleGalleryDeleteAll();
                          }}
                          style={{ 
                            background: "rgba(239, 68, 68, 0.1)", 
                            color: "#fca5a5", 
                            border: "1px solid rgba(239, 68, 68, 0.3)", 
                            padding: "0.5rem 1rem", 
                            borderRadius: "6px", 
                            cursor: "pointer", 
                            fontWeight: 600,
                            fontSize: "0.9rem"
                          }}
                        >
                          🗑️ Hapus Semua
                        </button>
                      )}
                    </div>
                  </div>

                  {galleryLoading ? (
                    <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>Memuat foto...</div>
                  ) : galleryPhotos.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)", background: "var(--glass-bg)", borderRadius: "8px", border: "1px dashed var(--border)" }}>
                      Belum ada foto untuk pertandingan ini.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "1rem" }}>
                      {galleryPhotos.map((photo, index) => (
                        <div key={photo.id} style={{ position: "relative", background: "var(--glass-bg)", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border-light)" }}>
                          <img src={photo.url} alt="Gallery" style={{ width: "100%", height: "120px", objectFit: "cover", display: "block" }} />
                          
                          <div style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem", background: "rgba(0,0,0,0.6)" }}>
                            <div style={{ display: "flex", gap: "0.2rem" }}>
                              <button 
                                onClick={() => handleGalleryMove(index, 'up')} 
                                disabled={index === 0}
                                style={{ background: "transparent", border: "none", color: index === 0 ? "#555" : "#fff", cursor: index === 0 ? "default" : "pointer" }}
                                title="Pindah ke kiri/atas"
                              >◀</button>
                              <button 
                                onClick={() => handleGalleryMove(index, 'down')} 
                                disabled={index === galleryPhotos.length - 1}
                                style={{ background: "transparent", border: "none", color: index === galleryPhotos.length - 1 ? "#555" : "#fff", cursor: index === galleryPhotos.length - 1 ? "default" : "pointer" }}
                                title="Pindah ke kanan/bawah"
                              >▶</button>
                            </div>
                            <button 
                              onClick={() => handleGalleryDelete(photo.id)}
                              style={{ background: "transparent", border: "none", color: "#fca5a5", cursor: "pointer", fontSize: "0.9rem" }}
                              title="Hapus"
                            >🗑️</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* Edit Match Modal */}
      {editingMatch && mainTab === "matches" && (
        <div className="modal-overlay" onClick={() => setEditingMatch(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Pertandingan {editingMatch.matchCode}</h2>
              <div>
                {editingMatch.status === "completed" && (
                  <button 
                    onClick={() => {
                      const catName = activeCat?.name || "Unknown";
                      const unified = getUnifiedMatchCode(catName, editingMatch.matchCode);
                      handleGalleryAddShortcut(unified);
                    }}
                    style={{ background: "rgba(59,130,246,0.15)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.3)", padding: "0.3rem 0.6rem", borderRadius: "6px", fontSize: "0.75rem", marginRight: "1rem", cursor: "pointer", fontWeight: 600 }}
                  >📸 Kelola Galeri</button>
                )}
                <button className="modal-close" onClick={() => setEditingMatch(null)}>✕</button>
              </div>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group"><label>Tim 1</label><input type="text" value={editingMatch.team1Name || ""} onChange={(e) => setEditingMatch({ ...editingMatch, team1Name: e.target.value })} /></div>
                <div className="form-group"><label>Tim 2</label><input type="text" value={editingMatch.team2Name || ""} onChange={(e) => setEditingMatch({ ...editingMatch, team2Name: e.target.value })} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>No. Urut Tim 1</label><input type="number" value={editingMatch.team1Number ?? ""} onChange={(e) => setEditingMatch({ ...editingMatch, team1Number: e.target.value ? parseInt(e.target.value) : null })} /></div>
                <div className="form-group"><label>No. Urut Tim 2</label><input type="number" value={editingMatch.team2Number ?? ""} onChange={(e) => setEditingMatch({ ...editingMatch, team2Number: e.target.value ? parseInt(e.target.value) : null })} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>{activeCat?.scoreFormat === "sets" ? "Skor Set Tim 1" : "Total Skor Tim 1"}</label><input type={activeCat?.scoreFormat === "sets" ? "text" : "number"} value={editingMatch.scoreTeam1 || ""} onChange={(e) => setEditingMatch({ ...editingMatch, scoreTeam1: e.target.value || null })} placeholder={activeCat?.scoreFormat === "sets" ? "cth: 21-15 21-18" : "cth: 42"} /></div>
                <div className="form-group"><label>{activeCat?.scoreFormat === "sets" ? "Skor Set Tim 2" : "Total Skor Tim 2"}</label><input type={activeCat?.scoreFormat === "sets" ? "text" : "number"} value={editingMatch.scoreTeam2 || ""} onChange={(e) => setEditingMatch({ ...editingMatch, scoreTeam2: e.target.value || null })} placeholder={activeCat?.scoreFormat === "sets" ? "cth: 15-21 18-21" : "cth: 25"} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Jadwal</label><input type="text" value={editingMatch.schedule || ""} onChange={(e) => setEditingMatch({ ...editingMatch, schedule: e.target.value || null })} placeholder="cth: Kamis / 16 April 2026, @19:30" /></div>
                <div className="form-group"><label>Status</label><select value={editingMatch.status} onChange={(e) => setEditingMatch({ ...editingMatch, status: e.target.value })}><option value="upcoming">Belum dimulai</option><option value="ongoing">Berlangsung</option><option value="completed">Selesai</option></select></div>
              </div>
              <div className="form-group">
                <label>Pemenang</label>
                <div className="winner-select">
                  <button type="button" className={`winner-btn ${editingMatch.winner === 1 ? "selected" : ""}`} onClick={() => setEditingMatch({ ...editingMatch, winner: 1 })}>Tim 1: {editingMatch.team1Name || "TBD"}</button>
                  <button type="button" className={`winner-btn ${editingMatch.winner === 2 ? "selected" : ""}`} onClick={() => setEditingMatch({ ...editingMatch, winner: 2 })}>Tim 2: {editingMatch.team2Name || "TBD"}</button>
                  <button type="button" className={`winner-btn clear ${editingMatch.winner === null ? "selected" : ""}`} onClick={() => setEditingMatch({ ...editingMatch, winner: null })}>Belum ditentukan</button>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setEditingMatch(null)}>Batal</button>
              <button className="save-btn" onClick={handleSaveMatch}>💾 Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Schedule Match Modal */}
      {editingSchedMatch && (
        <div className="modal-overlay" onClick={() => setEditingSchedMatch(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0 }}>✏️ Edit Jadwal — {editingSchedMatch.gameNumber} ({editingSchedMatch.category})</h3>
              <div>
                {editingSchedMatch.status === "completed" && (
                  <button 
                    onClick={() => {
                      const unified = getUnifiedMatchCode(editingSchedMatch.category, editingSchedMatch.gameNumber);
                      handleGalleryAddShortcut(unified);
                    }}
                    style={{ background: "rgba(59,130,246,0.15)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.3)", padding: "0.3rem 0.6rem", borderRadius: "6px", fontSize: "0.75rem", marginRight: "1rem", cursor: "pointer", fontWeight: 600 }}
                  >📸 Kelola Galeri</button>
                )}
              </div>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group"><label>Jam</label><input value={editingSchedMatch.time} onChange={e => setEditingSchedMatch({...editingSchedMatch, time: e.target.value})} /></div>
                <div className="form-group"><label>Kategori</label><input value={editingSchedMatch.category} onChange={e => setEditingSchedMatch({...editingSchedMatch, category: e.target.value})} /></div>
                <div className="form-group"><label>Nomor Game</label><input value={editingSchedMatch.gameNumber} onChange={e => setEditingSchedMatch({...editingSchedMatch, gameNumber: e.target.value})} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Pemain A1</label><input value={editingSchedMatch.team1Player1 || ''} onChange={e => setEditingSchedMatch({...editingSchedMatch, team1Player1: e.target.value})} /></div>
                <div className="form-group"><label>Pemain A2</label><input value={editingSchedMatch.team1Player2 || ''} onChange={e => setEditingSchedMatch({...editingSchedMatch, team1Player2: e.target.value})} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Pemain B1</label><input value={editingSchedMatch.team2Player1 || ''} onChange={e => setEditingSchedMatch({...editingSchedMatch, team2Player1: e.target.value})} /></div>
                <div className="form-group"><label>Pemain B2</label><input value={editingSchedMatch.team2Player2 || ''} onChange={e => setEditingSchedMatch({...editingSchedMatch, team2Player2: e.target.value})} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Skor A</label><input value={editingSchedMatch.scoreTeam1 || ''} onChange={e => setEditingSchedMatch({...editingSchedMatch, scoreTeam1: e.target.value})} /></div>
                <div className="form-group"><label>Skor B</label><input value={editingSchedMatch.scoreTeam2 || ''} onChange={e => setEditingSchedMatch({...editingSchedMatch, scoreTeam2: e.target.value})} /></div>
                <div className="form-group"><label>Status</label><select value={editingSchedMatch.status} onChange={e => setEditingSchedMatch({...editingSchedMatch, status: e.target.value})}><option value="upcoming">Belum dimulai</option><option value="ongoing">Berlangsung</option><option value="completed">Selesai</option></select></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setEditingSchedMatch(null)}>Batal</button>
              <button className="save-btn" onClick={handleSaveSchedMatch}>💾 Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

