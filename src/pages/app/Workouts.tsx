import { getApiBase } from "@/lib/api";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { Play, Search, Clock, ChevronRight, X, BookmarkCheck, Sparkles, SlidersHorizontal } from "lucide-react";
import VideoPlayer from "@/components/app/VideoPlayer";

interface Video {
  id: number; title: string; description: string;
  url: string; duration: string; duration_seconds?: number;
  category: string;
  is_premium: number; thumbnail: string; is_short?: number;
  source_type?: string; youtube_url?: string;
  goal?: string | null;
  body_area?: string | null;
  equipment?: string | null;
  level?: string | null;
  created_at?: string;
  completed?: boolean;
}

const CAT_COLORS: Record<string, string> = {
  HIIT: "#FB7185", Strength: "#60A5FA", Cardio: "#FFD600",
  Yoga: "#34D399", Mobility: "#FBBF24",
};

/* Filter facets shown as chip rows. Values match what admin saves on a video. */
const GOALS = [
  { value: "fat_loss", label: "Fat loss" },
  { value: "muscle_gain", label: "Muscle gain" },
  { value: "mobility", label: "Mobility" },
  { value: "endurance", label: "Endurance" },
];
const BODY_AREAS = [
  { value: "full_body", label: "Full body" },
  { value: "legs", label: "Legs" },
  { value: "core", label: "Core" },
  { value: "upper_body", label: "Upper body" },
];
const EQUIPMENTS = [
  { value: "none", label: "No equipment" },
  { value: "dumbbells", label: "Dumbbells" },
  { value: "bands", label: "Bands" },
  { value: "gym", label: "Gym" },
];
const LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];
/* Duration buckets, in seconds. -1 means "more than 45 min" (no upper bound). */
const DURATIONS: Array<{ value: string; label: string; min: number; max: number }> = [
  { value: "5", label: "5 min", min: 0, max: 5 * 60 + 30 },
  { value: "10", label: "10 min", min: 5 * 60 + 30, max: 14 * 60 },
  { value: "20", label: "20 min", min: 14 * 60, max: 30 * 60 },
  { value: "45", label: "45 min", min: 30 * 60, max: 45 * 60 + 60 },
  { value: "more", label: "45+ min", min: 45 * 60 + 60, max: Number.POSITIVE_INFINITY },
];

type SortMode = "newest" | "shortest" | "longest";

/* Tiny helper for a chip row. Single-select with an "All" reset chip. */
function ChipRow<T extends { value: string; label: string }>({
  label, items, value, onChange,
}: { label: string; items: T[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 0 4px", scrollbarWidth: "none" }}>
        <button
          onClick={() => onChange("")}
          style={{
            flexShrink: 0, padding: "6px 12px", borderRadius: 99,
            border: `1px solid ${!value ? "var(--accent)" : "var(--border)"}`,
            background: !value ? "var(--accent-dim)" : "var(--bg-card)",
            color: !value ? "var(--accent)" : "var(--text-secondary)",
            fontWeight: !value ? 700 : 500, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
          }}
        >All</button>
        {items.map(it => {
          const active = value === it.value;
          return (
            <button key={it.value} onClick={() => onChange(active ? "" : it.value)}
              style={{
                flexShrink: 0, padding: "6px 12px", borderRadius: 99,
                border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                background: active ? "var(--accent-dim)" : "var(--bg-card)",
                color: active ? "var(--accent)" : "var(--text-secondary)",
                fontWeight: active ? 700 : 500, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
              }}>
              {it.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Workouts() {
  const { user, token } = useAuth();
  const { t } = useI18n();
  const [videos, setVideos] = useState<Video[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [playing, setPlaying] = useState<Video | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<SortMode>("newest");

  const [fGoal, setFGoal] = useState("");
  const [fBody, setFBody] = useState("");
  const [fDuration, setFDuration] = useState("");
  const [fEquipment, setFEquipment] = useState("");
  const [fLevel, setFLevel] = useState("");
  const [fCategory, setFCategory] = useState("");

  const loadWorkouts = () => {
    if (!token) return;
    fetch(`${getApiBase()}/api/workouts/videos`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setVideos(d.videos || []); setLoading(false); })
      .catch(() => setLoading(false));
    // Best-effort fetch of completed video IDs (endpoint may not exist on every install).
    fetch(`${getApiBase()}/api/workouts/completed`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : { ids: [] })
      .then(d => setCompletedIds(new Set((d?.ids || d?.completed || []).map((x: any) => Number(x.id || x)))))
      .catch(() => { /* silent */ });
  };

  useEffect(() => { loadWorkouts(); }, [token]);
  useAutoRefresh(loadWorkouts);

  /* Active filters (excluding free-text search and category). Used for the
     "active filter count" badge on the filter button. */
  const activeFilterCount =
    [fGoal, fBody, fDuration, fEquipment, fLevel].filter(Boolean).length;

  const matchesDuration = (v: Video) => {
    if (!fDuration) return true;
    const bucket = DURATIONS.find(d => d.value === fDuration);
    if (!bucket) return true;
    const secs = Number(v.duration_seconds || 0);
    if (!secs) return false;
    return secs >= bucket.min && secs < bucket.max;
  };

  const filtered = useMemo(() => {
    const q2 = q.trim().toLowerCase();
    return videos.filter(v =>
      (!fCategory || v.category === fCategory) &&
      (!fGoal || v.goal === fGoal) &&
      (!fBody || v.body_area === fBody) &&
      (!fEquipment || v.equipment === fEquipment) &&
      (!fLevel || v.level === fLevel) &&
      matchesDuration(v) &&
      (!q2 || v.title.toLowerCase().includes(q2) || (v.description || "").toLowerCase().includes(q2))
    );
  }, [videos, fCategory, fGoal, fBody, fEquipment, fLevel, fDuration, q]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sort === "shortest") arr.sort((a, b) => Number(a.duration_seconds || 0) - Number(b.duration_seconds || 0));
    else if (sort === "longest") arr.sort((a, b) => Number(b.duration_seconds || 0) - Number(a.duration_seconds || 0));
    else arr.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    return arr;
  }, [filtered, sort]);

  const recommended = useMemo(() => {
    // Prefer videos that match the athlete's saved goal/level if any.
    const userGoal = (user as any)?.fitness_goal as string | undefined;
    const matching = videos.filter(v =>
      (!userGoal || v.goal === userGoal) && !completedIds.has(v.id)
    );
    return (matching.length ? matching : videos).slice(0, 6);
  }, [videos, user, completedIds]);

  const completedList = useMemo(
    () => videos.filter(v => completedIds.has(v.id)),
    [videos, completedIds]
  );

  const featuredCategories = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const v of videos) counts[v.category] = (counts[v.category] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [videos]);

  const renderRowCard = (v: Video) => (
    <div key={v.id} onClick={() => setPlaying(v)}
      style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px", borderRadius: 14, background: "var(--bg-card)", border: "1px solid var(--border)", cursor: "pointer" }}>
      <div style={{ width: 84, height: 64, borderRadius: 10, overflow: "hidden", flexShrink: 0, position: "relative", background: "var(--bg-surface)" }}>
        {v.thumbnail ? <img src={v.thumbnail} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", background: `${CAT_COLORS[v.category] || "#FFD600"}20`, display: "flex", alignItems: "center", justifyContent: "center" }}><Play size={20} color={CAT_COLORS[v.category] || "var(--accent)"} /></div>}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.18)" }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}><Play size={12} color="#fff" fill="#fff" /></div>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, marginBottom: 4 }}>{v.title}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 99, background: `${CAT_COLORS[v.category] || "#FFD600"}15`, color: CAT_COLORS[v.category] || "var(--accent)", fontWeight: 600 }}>{v.category}</span>
          {v.duration && <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--text-muted)" }}><Clock size={11} />{v.duration}</span>}
          {v.level && <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "capitalize" }}>· {v.level}</span>}
        </div>
      </div>
      <ChevronRight size={16} color="var(--text-muted)" />
    </div>
  );

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", paddingBottom: 24 }}>
      {/* Header + search */}
      <div style={{ padding: "16px", display: "flex", alignItems: "center", gap: 10 }}>
        {searching ? (
          <>
            <input value={q} onChange={e => setQ(e.target.value)} autoFocus placeholder={t("search_workouts_ph")}
              style={{ flex: 1, padding: "10px 14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 15, outline: "none" }} />
            <button onClick={() => { setSearching(false); setQ(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={22} /></button>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 24, fontWeight: 800, flex: 1, fontFamily: "var(--font-heading)" }}>{t("workouts")}</h1>
            <button onClick={() => setSearching(true)} style={{ width: 40, height: 40, borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-secondary)" }}>
              <Search size={18} />
            </button>
            <button
              onClick={() => setShowFilters(v => !v)}
              style={{
                position: "relative",
                width: 40, height: 40, borderRadius: 12,
                border: `1px solid ${showFilters || activeFilterCount ? "var(--accent)" : "var(--border)"}`,
                background: showFilters || activeFilterCount ? "var(--accent-dim)" : "var(--bg-card)",
                color: showFilters || activeFilterCount ? "var(--accent)" : "var(--text-secondary)",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}
            >
              <SlidersHorizontal size={18} />
              {activeFilterCount > 0 && (
                <span style={{ position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 99, background: "var(--accent)", color: "#000", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{activeFilterCount}</span>
              )}
            </button>
          </>
        )}
      </div>

      {/* Quick filter chips (collapsible) */}
      {showFilters && (
        <div style={{ padding: "0 16px 8px" }}>
          <ChipRow label="Goal" items={GOALS} value={fGoal} onChange={setFGoal} />
          <ChipRow label="Body area" items={BODY_AREAS} value={fBody} onChange={setFBody} />
          <ChipRow label="Duration" items={DURATIONS.map(d => ({ value: d.value, label: d.label }))} value={fDuration} onChange={setFDuration} />
          <ChipRow label="Equipment" items={EQUIPMENTS} value={fEquipment} onChange={setFEquipment} />
          <ChipRow label="Level" items={LEVELS} value={fLevel} onChange={setFLevel} />
          {activeFilterCount > 0 && (
            <button onClick={() => { setFGoal(""); setFBody(""); setFDuration(""); setFEquipment(""); setFLevel(""); }}
              style={{ marginTop: 4, fontSize: 12, color: "var(--text-muted)", background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" }}>
              Clear all filters
            </button>
          )}
        </div>
      )}

      {loading && <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>{t("loading_ellipsis")}</div>}

      {/* Continue / Recommended */}
      {!loading && !activeFilterCount && !q && recommended.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px 12px" }}>
            <p style={{ fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
              <Sparkles size={15} color="var(--accent)" /> Recommended for you
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "0 16px", scrollSnapType: "x mandatory", scrollbarWidth: "none" }}>
            {recommended.map(v => (
              <div key={v.id} onClick={() => setPlaying(v)}
                style={{ flexShrink: 0, width: 200, scrollSnapAlign: "start", cursor: "pointer" }}>
                <div style={{ height: 120, borderRadius: 14, overflow: "hidden", background: "var(--bg-card)", border: "1px solid var(--border)", marginBottom: 8, position: "relative" }}>
                  {v.thumbnail ? <img src={v.thumbnail} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", background: `${CAT_COLORS[v.category] || "#FFD600"}20` }} />}
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%)", display: "flex", alignItems: "flex-end", padding: 10 }}>
                    <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, background: "rgba(0,0,0,0.55)", color: "#fff", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{v.category}</span>
                  </div>
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, marginBottom: 2 }}>{v.title}</p>
                {v.duration && <p style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}><Clock size={11} /> {v.duration}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Featured categories */}
      {!loading && !activeFilterCount && !q && featuredCategories.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px 12px" }}>
            <p style={{ fontSize: 15, fontWeight: 700 }}>Featured categories</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, padding: "0 16px" }}>
            {featuredCategories.map(([name, count]) => (
              <button key={name} onClick={() => setFCategory(fCategory === name ? "" : name)}
                style={{
                  padding: "16px 14px", borderRadius: 14,
                  border: `1px solid ${fCategory === name ? (CAT_COLORS[name] || "var(--accent)") : "var(--border)"}`,
                  background: fCategory === name ? `${CAT_COLORS[name] || "#FFD600"}18` : "var(--bg-card)",
                  textAlign: "start", cursor: "pointer",
                }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: CAT_COLORS[name] || "var(--text-primary)", marginBottom: 4 }}>{name}</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{count} workout{count !== 1 ? "s" : ""}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* All workouts with sort */}
      <section style={{ padding: "0 16px", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <p style={{ fontSize: 15, fontWeight: 700 }}>{fCategory || "All workouts"} · {sorted.length}</p>
          <select value={sort} onChange={e => setSort(e.target.value as SortMode)}
            style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-secondary)", fontSize: 12 }}>
            <option value="newest">Newest</option>
            <option value="shortest">Shortest first</option>
            <option value="longest">Longest first</option>
          </select>
        </div>
        {sorted.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sorted.map(renderRowCard)}
          </div>
        ) : (
          !loading && (
            <div style={{ padding: "32px 0", textAlign: "center", color: "var(--text-muted)" }}>
              <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{t("no_workouts_found")}</p>
              <p style={{ fontSize: 12 }}>{t("try_different_filter")}</p>
            </div>
          )
        )}
      </section>

      {/* Saved / completed */}
      {completedList.length > 0 && (
        <section style={{ padding: "0 16px", marginBottom: 24 }}>
          <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <BookmarkCheck size={15} color="var(--accent)" /> Completed by you
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {completedList.slice(0, 5).map(renderRowCard)}
          </div>
        </section>
      )}

      {/* Player modal */}
      {playing && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.95)", display: "flex", flexDirection: "column" }}
          onClick={() => setPlaying(null)}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "56px 20px 16px" }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{playing.title}</p>
            <button onClick={() => setPlaying(null)} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 99, padding: "8px 16px", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>{t("done")}</button>
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }} onClick={e => e.stopPropagation()}>
            <VideoPlayer
              url={playing.source_type === "youtube" ? (playing.youtube_url || playing.url) : playing.url}
              mediaType={playing.source_type === "youtube" ? "youtube" : "video"}
              height="60vh"
              autoPlay
              style={{ borderRadius: 16 }}
            />
          </div>
          <div style={{ padding: "16px 20px 32px" }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>{playing.description}</p>
          </div>
        </div>
      )}
    </div>
  );
}
