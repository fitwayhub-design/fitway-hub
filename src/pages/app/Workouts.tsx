import { getApiBase, resolveAssetUrl } from "@/lib/api";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { useMemo, useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import {
  Play, Search, Clock, ChevronRight, X, BookmarkCheck, Sparkles,
  Flame, Zap, User, TrendingUp, Heart, Eye,
} from "lucide-react";
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
  coach_id?: number | null;
  coach_name?: string | null;
  views_count?: number;
  likes_count?: number;
  created_at?: string;
  completed?: boolean;
}

interface VideoProgress {
  video_id: number;
  position_seconds: number;
  duration_seconds: number;
  completed: number;
  updated_at: string;
}

const CAT_COLORS: Record<string, string> = {
  HIIT: "#FB7185", Strength: "#60A5FA", Cardio: "#FFD600",
  Yoga: "#34D399", Mobility: "#FBBF24",
};

/* Filter facets shown as chip rows. Values match what admin saves on a video. */
const GOALS = [
  { value: "fat_loss", label: "Burn" },
  { value: "muscle_gain", label: "Build" },
  { value: "mobility", label: "Recover" },
  { value: "endurance", label: "Tone" },
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
/* Duration buckets, in seconds. */
const DURATIONS: Array<{ value: string; label: string; min: number; max: number }> = [
  { value: "5", label: "5 min", min: 0, max: 5 * 60 + 30 },
  { value: "10", label: "10 min", min: 5 * 60 + 30, max: 14 * 60 },
  { value: "20", label: "20 min", min: 14 * 60, max: 30 * 60 },
  { value: "45", label: "45 min+", min: 30 * 60, max: Number.POSITIVE_INFINITY },
];

/* Workout type chips — these map to the existing `category` column. */
const WORKOUT_TYPES = [
  { value: "Strength", label: "Strength" },
  { value: "Cardio", label: "Cardio" },
  { value: "Mobility", label: "Mobility" },
  { value: "HIIT", label: "Fat Loss" },
  { value: "Yoga", label: "Yoga" },
];

type SortMode = "newest" | "shortest" | "longest";
type Mode = "long" | "short";

/* Compact relative time for the "Continue watching" strip — "5m ago",
   "2h ago", "yesterday". Drops back to a date once it's older than a week
   so we don't grow a long "16 days ago" tail. */
function formatRelative(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

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
  const [longs, setLongs] = useState<Video[]>([]);
  const [shorts, setShorts] = useState<Video[]>([]);
  const [trendingShorts, setTrendingShorts] = useState<Video[]>([]);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  const [progressMap, setProgressMap] = useState<Map<number, VideoProgress>>(new Map());
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [playing, setPlaying] = useState<Video | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<SortMode>("newest");
  const [mode, setMode] = useState<Mode>("long");

  const [fGoal, setFGoal] = useState("");
  const [fBody, setFBody] = useState("");
  const [fDuration, setFDuration] = useState("");
  const [fEquipment, setFEquipment] = useState("");
  const [fLevel, setFLevel] = useState("");
  const [fType, setFType] = useState("");

  /* Last-known position for the currently-playing video, in seconds. Mirrored
     in state so the player can resume on mount, and in a ref so the throttle
     loop doesn't trigger re-renders 4x/second. */
  const playingProgressRef = useRef<{ position: number; duration: number; lastSyncedAt: number }>({
    position: 0, duration: 0, lastSyncedAt: 0,
  });
  /* Videos we've already counted a view for in this session, so opening the
     same workout twice doesn't double-count. */
  const viewedThisSessionRef = useRef<Set<number>>(new Set());

  const apiCall = (path: string, init?: RequestInit) =>
    fetch(`${getApiBase()}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
    });

  const loadWorkouts = () => {
    if (!token) return;
    Promise.all([
      apiCall('/api/workouts/videos').then(r => r.json()).catch(() => ({ videos: [] })),
      apiCall('/api/workouts/shorties').then(r => r.json()).catch(() => ({ videos: [] })),
      apiCall('/api/workouts/shorties/trending?limit=5').then(r => r.ok ? r.json() : { videos: [] }).catch(() => ({ videos: [] })),
      apiCall('/api/workouts/me').then(r => r.ok ? r.json() : { saved_ids: [], liked_ids: [], progress: [] }).catch(() => ({ saved_ids: [], liked_ids: [], progress: [] })),
    ]).then(([l, s, t, me]) => {
      setLongs(l.videos || []);
      setShorts(s.videos || []);
      setTrendingShorts(t.videos || []);
      setSavedIds(new Set((me.saved_ids || []).map((id: any) => Number(id))));
      setLikedIds(new Set((me.liked_ids || []).map((id: any) => Number(id))));
      const pm = new Map<number, VideoProgress>();
      for (const p of (me.progress || []) as VideoProgress[]) {
        pm.set(Number(p.video_id), { ...p, video_id: Number(p.video_id) });
      }
      setProgressMap(pm);
      setLoading(false);
    });
  };

  useEffect(() => { loadWorkouts(); }, [token]);
  useAutoRefresh(loadWorkouts);

  /* Toggle a save on the server with optimistic UI. */
  const toggleSaved = async (id: number) => {
    const wasSaved = savedIds.has(id);
    setSavedIds(prev => {
      const next = new Set(prev);
      if (wasSaved) next.delete(id); else next.add(id);
      return next;
    });
    try {
      const r = await apiCall(`/api/workouts/videos/${id}/save`, { method: 'POST' });
      if (!r.ok) throw new Error('save failed');
    } catch {
      // Roll back on failure so the UI doesn't lie about server state.
      setSavedIds(prev => {
        const next = new Set(prev);
        if (wasSaved) next.add(id); else next.delete(id);
        return next;
      });
    }
  };

  const toggleLiked = async (id: number) => {
    const wasLiked = likedIds.has(id);
    setLikedIds(prev => {
      const next = new Set(prev);
      if (wasLiked) next.delete(id); else next.add(id);
      return next;
    });
    // Optimistically bump the visible counter.
    const bump = wasLiked ? -1 : 1;
    setShorts(prev => prev.map(v => v.id === id ? { ...v, likes_count: Math.max(0, (v.likes_count || 0) + bump) } : v));
    setLongs(prev => prev.map(v => v.id === id ? { ...v, likes_count: Math.max(0, (v.likes_count || 0) + bump) } : v));
    try {
      const r = await apiCall(`/api/workouts/videos/${id}/like`, { method: 'POST' });
      if (!r.ok) throw new Error('like failed');
      const data = await r.json();
      // Reconcile with the server's authoritative count.
      setShorts(prev => prev.map(v => v.id === id ? { ...v, likes_count: data.likes_count } : v));
      setLongs(prev => prev.map(v => v.id === id ? { ...v, likes_count: data.likes_count } : v));
    } catch {
      setLikedIds(prev => {
        const next = new Set(prev);
        if (wasLiked) next.add(id); else next.delete(id);
        return next;
      });
      setShorts(prev => prev.map(v => v.id === id ? { ...v, likes_count: Math.max(0, (v.likes_count || 0) - bump) } : v));
      setLongs(prev => prev.map(v => v.id === id ? { ...v, likes_count: Math.max(0, (v.likes_count || 0) - bump) } : v));
    }
  };

  /* Open a video — record a view (deduped per session) and seed the resume
     position from server progress. The actual time-update sync happens inside
     the player onProgress callback below. */
  const openPlayer = (v: Video) => {
    setPlaying(v);
    const prior = progressMap.get(v.id);
    playingProgressRef.current = {
      position: prior?.position_seconds || 0,
      duration: prior?.duration_seconds || Number(v.duration_seconds || 0),
      lastSyncedAt: 0,
    };
    if (!viewedThisSessionRef.current.has(v.id)) {
      viewedThisSessionRef.current.add(v.id);
      // Optimistic local bump.
      setShorts(prev => prev.map(x => x.id === v.id ? { ...x, views_count: (x.views_count || 0) + 1 } : x));
      setLongs(prev => prev.map(x => x.id === v.id ? { ...x, views_count: (x.views_count || 0) + 1 } : x));
      apiCall(`/api/workouts/videos/${v.id}/view`, { method: 'POST' }).catch(() => { /* silent */ });
    }
  };

  /* Throttle progress sync to once every 5s. The HTML5 timeupdate event fires
     roughly 4x/second — without throttling we'd hammer the server. */
  const handleProgress = (position: number, duration: number) => {
    if (!playing) return;
    playingProgressRef.current.position = position;
    if (duration > 0) playingProgressRef.current.duration = duration;
    const now = Date.now();
    if (now - playingProgressRef.current.lastSyncedAt < 5000) return;
    playingProgressRef.current.lastSyncedAt = now;
    syncProgress(playing.id, position, duration);
  };

  const syncProgress = async (videoId: number, position: number, duration: number) => {
    const pos = Math.max(0, Math.floor(position));
    const dur = Math.max(0, Math.floor(duration));
    // Update local map immediately so "Continue watching" reflects reality on
    // the next render without waiting for the round-trip.
    setProgressMap(prev => {
      const next = new Map(prev);
      const existing = next.get(videoId);
      next.set(videoId, {
        video_id: videoId,
        position_seconds: pos,
        duration_seconds: Math.max(existing?.duration_seconds || 0, dur),
        completed: (dur > 0 && pos / dur >= 0.9) ? 1 : (existing?.completed || 0),
        updated_at: new Date().toISOString(),
      });
      return next;
    });
    try {
      await apiCall(`/api/workouts/videos/${videoId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position_seconds: pos, duration_seconds: dur }),
      });
    } catch { /* silent */ }
  };

  /* On player close, flush whatever the last position was so we don't lose
     the final few seconds the throttle skipped. */
  const closePlayer = () => {
    if (playing) {
      const { position, duration } = playingProgressRef.current;
      if (position > 0) syncProgress(playing.id, position, duration);
    }
    setPlaying(null);
  };

  const activeFilterCount =
    [fGoal, fBody, fDuration, fEquipment, fLevel, fType].filter(Boolean).length;

  const matchesDuration = (v: Video) => {
    if (!fDuration) return true;
    const bucket = DURATIONS.find(d => d.value === fDuration);
    if (!bucket) return true;
    const secs = Number(v.duration_seconds || 0);
    if (!secs) return false;
    return secs >= bucket.min && secs < bucket.max;
  };

  const sourceList = mode === "long" ? longs : shorts;

  const filtered = useMemo(() => {
    const q2 = q.trim().toLowerCase();
    return sourceList.filter(v =>
      (!fType || v.category === fType) &&
      (!fGoal || v.goal === fGoal) &&
      (!fBody || v.body_area === fBody) &&
      (!fEquipment || v.equipment === fEquipment) &&
      (!fLevel || v.level === fLevel) &&
      (mode === "short" || matchesDuration(v)) &&
      (!q2 || v.title.toLowerCase().includes(q2) || (v.description || "").toLowerCase().includes(q2))
    );
  }, [sourceList, mode, fType, fGoal, fBody, fEquipment, fLevel, fDuration, q]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sort === "shortest") arr.sort((a, b) => Number(a.duration_seconds || 0) - Number(b.duration_seconds || 0));
    else if (sort === "longest") arr.sort((a, b) => Number(b.duration_seconds || 0) - Number(a.duration_seconds || 0));
    else arr.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    return arr;
  }, [filtered, sort]);

  /* "Continue watching" — long videos the user has actual progress on but
     hasn't finished. Sorted by last-watched so the most recent session is
     surfaced first. Completed workouts drop off so the strip stays
     genuinely useful instead of repeating finished items. */
  const continueList = useMemo(() => {
    return longs
      .map(v => ({ v, p: progressMap.get(v.id) }))
      .filter(({ p }) => p && !p.completed && p.position_seconds > 5)
      .sort((a, b) => (b.p!.updated_at || "").localeCompare(a.p!.updated_at || ""))
      .slice(0, 6)
      .map(({ v }) => v);
  }, [longs, progressMap]);

  /* Helper used in a couple of places to pull progress out of the map. */
  const progressFor = (id: number) => progressMap.get(id);

  /* Featured pick: shorts use the server's trending-by-recent-views ordering,
     long-form recommends an unstarted goal/level match (falling back to the
     newest video on cold start). */
  const featured = useMemo<Video | null>(() => {
    if (mode === "short") {
      return trendingShorts[0] || shorts[0] || null;
    }
    const userGoal = (user as any)?.fitness_goal as string | undefined;
    const matching = longs.find(v => (!userGoal || v.goal === userGoal) && !progressFor(v.id)?.completed);
    return matching || longs[0] || null;
  }, [mode, longs, shorts, trendingShorts, user, progressMap]);

  /* Coach groupings — only meaningful for long-form. */
  const coachGroups = useMemo(() => {
    if (mode !== "long") return [];
    const map = new Map<string, Video[]>();
    for (const v of longs) {
      if (!v.coach_name) continue;
      const arr = map.get(v.coach_name) || [];
      arr.push(v);
      map.set(v.coach_name, arr);
    }
    return [...map.entries()]
      .filter(([, arr]) => arr.length >= 2)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 4);
  }, [mode, longs]);

  const savedList = useMemo(
    () => sourceList.filter(v => savedIds.has(v.id)),
    [sourceList, savedIds]
  );

  /* ── Card renderers ────────────────────────────────────────────────────── */

  const SaveBtn = ({ id, light }: { id: number; light?: boolean }) => {
    const saved = savedIds.has(id);
    return (
      <button
        onClick={(e) => { e.stopPropagation(); toggleSaved(id); }}
        style={{
          width: 30, height: 30, borderRadius: 99,
          background: light ? "rgba(0,0,0,0.55)" : "var(--bg-surface)",
          border: light ? "none" : "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: saved ? "var(--accent)" : (light ? "#fff" : "var(--text-secondary)"),
        }}
        aria-label={saved ? "Unsave" : "Save"}
      >
        <BookmarkCheck size={14} fill={saved ? "currentColor" : "none"} />
      </button>
    );
  };

  const LikeBtn = ({ id, light, count }: { id: number; light?: boolean; count?: number }) => {
    const liked = likedIds.has(id);
    return (
      <button
        onClick={(e) => { e.stopPropagation(); toggleLiked(id); }}
        style={{
          height: 30, padding: "0 10px", borderRadius: 99,
          background: light ? "rgba(0,0,0,0.55)" : "var(--bg-surface)",
          border: light ? "none" : "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
          cursor: "pointer", color: liked ? "#FB7185" : (light ? "#fff" : "var(--text-secondary)"),
          fontSize: 11, fontWeight: 700,
        }}
        aria-label={liked ? "Unlike" : "Like"}
      >
        <Heart size={13} fill={liked ? "currentColor" : "none"} />
        {typeof count === "number" && count > 0 && <span>{count}</span>}
      </button>
    );
  };

  const ProgressBar = ({ id }: { id: number }) => {
    const p = progressMap.get(id);
    if (!p || !p.duration_seconds) return null;
    const pct = Math.min(100, Math.max(0, (p.position_seconds / p.duration_seconds) * 100));
    if (pct < 1) return null;
    return (
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, background: "rgba(0,0,0,0.4)" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "var(--accent)" }} />
      </div>
    );
  };

  /* Long-form card: bigger thumbnail + stack of meta + Start/Continue CTA. */
  const renderLongCard = (v: Video) => {
    const prog = progressFor(v.id);
    const hasProgress = !!prog && prog.position_seconds > 5 && !prog.completed;
    return (
      <div key={v.id} onClick={() => openPlayer(v)}
        style={{ display: "flex", flexDirection: "column", borderRadius: 16, background: "var(--bg-card)", border: "1px solid var(--border)", overflow: "hidden", cursor: "pointer" }}>
        <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", background: "var(--bg-surface)" }}>
          {v.thumbnail
            ? <img src={resolveAssetUrl(v.thumbnail)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <div style={{ width: "100%", height: "100%", background: `${CAT_COLORS[v.category] || "#FFD600"}20`, display: "flex", alignItems: "center", justifyContent: "center" }}><Play size={28} color={CAT_COLORS[v.category] || "var(--accent)"} /></div>}
          {v.duration && (
            <span style={{ position: "absolute", bottom: 8, right: 8, fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "rgba(0,0,0,0.75)", color: "#fff", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
              <Clock size={10} /> {v.duration}
            </span>
          )}
          <div style={{ position: "absolute", top: 8, right: 8 }}>
            <SaveBtn id={v.id} light />
          </div>
          <ProgressBar id={v.id} />
        </div>
        <div style={{ padding: "8px 10px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
          <p style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3, margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{v.title}</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 99, background: `${CAT_COLORS[v.category] || "#FFD600"}15`, color: CAT_COLORS[v.category] || "var(--accent)", fontWeight: 600 }}>{v.category}</span>
            {v.level && <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "capitalize" }}>· {v.level}</span>}
            {v.coach_name && (
              <span style={{ fontSize: 10, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 3 }}>
                <User size={9} /> {v.coach_name}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--text-muted)", fontSize: 10 }}>
            {(v.views_count || 0) > 0 && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Eye size={11} /> {v.views_count}</span>}
            {(v.likes_count || 0) > 0 && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Heart size={11} /> {v.likes_count}</span>}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
            <button
              onClick={(e) => { e.stopPropagation(); openPlayer(v); }}
              style={{
                flex: 1, padding: "6px 10px", borderRadius: 8,
                border: "none", background: "var(--accent)", color: "#000",
                fontWeight: 700, fontSize: 12, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              }}>
              <Play size={11} fill="#000" /> {hasProgress ? "Continue" : "Start"}
            </button>
            <LikeBtn id={v.id} />
          </div>
        </div>
      </div>
    );
  };

  /* Short card: tall portrait thumbnail, minimal meta, designed for fast scrolling. */
  const renderShortCard = (v: Video) => (
    <div key={v.id} onClick={() => openPlayer(v)}
      style={{ display: "flex", flexDirection: "column", cursor: "pointer" }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: "9 / 16", borderRadius: 14, overflow: "hidden", background: "var(--bg-card)", border: "1px solid var(--border)", marginBottom: 6 }}>
        {v.thumbnail
          ? <img src={resolveAssetUrl(v.thumbnail)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ width: "100%", height: "100%", background: `${CAT_COLORS[v.category] || "#FFD600"}20`, display: "flex", alignItems: "center", justifyContent: "center" }}><Play size={24} color={CAT_COLORS[v.category] || "var(--accent)"} /></div>}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 45%)" }} />
        {v.duration && (
          <span style={{ position: "absolute", top: 6, left: 6, fontSize: 10, padding: "2px 6px", borderRadius: 6, background: "rgba(0,0,0,0.7)", color: "#fff", fontWeight: 700 }}>
            {v.duration}
          </span>
        )}
        <div style={{ position: "absolute", top: 6, right: 6, display: "flex", flexDirection: "column", gap: 6 }}>
          <SaveBtn id={v.id} light />
          <LikeBtn id={v.id} light count={v.likes_count} />
        </div>
        <div style={{ position: "absolute", left: 8, right: 8, bottom: 8, color: "#fff" }}>
          <p style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.3, margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{v.title}</p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 3, opacity: 0.85, fontSize: 10 }}>
            {v.coach_name && (
              <span style={{ display: "flex", alignItems: "center", gap: 3 }}><User size={9} /> {v.coach_name}</span>
            )}
            {(v.views_count || 0) > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Eye size={10} /> {v.views_count}</span>
            )}
          </div>
        </div>
        <ProgressBar id={v.id} />
      </div>
    </div>
  );

  /* Featured / "hero" card — single highlighted item at top of each tab. */
  const renderFeatured = (v: Video) => {
    const prog = progressFor(v.id);
    const hasResume = !!prog && prog.position_seconds > 5 && !prog.completed;
    const labelIcon = mode === "short"
      ? <><TrendingUp size={13} /> Trending this week</>
      : (hasResume
        ? <><Play size={13} /> Continue watching</>
        : <><Sparkles size={13} /> Recommended for you</>);
    return (
      <div onClick={() => openPlayer(v)}
        style={{
          position: "relative", borderRadius: 18, overflow: "hidden", cursor: "pointer",
          aspectRatio: mode === "short" ? "4 / 5" : "16 / 9",
          maxHeight: mode === "short" ? 320 : 240,
          background: "var(--bg-card)", border: "1px solid var(--border)",
        }}>
        {v.thumbnail
          ? <img src={resolveAssetUrl(v.thumbnail)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ width: "100%", height: "100%", background: `${CAT_COLORS[v.category] || "#FFD600"}30` }} />}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.1) 55%, rgba(0,0,0,0.35) 100%)" }} />
        <span style={{ position: "absolute", top: 14, left: 14, fontSize: 11, padding: "5px 10px", borderRadius: 99, background: "var(--accent)", color: "#000", fontWeight: 800, display: "flex", alignItems: "center", gap: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {labelIcon}
        </span>
        <div style={{ position: "absolute", left: 16, right: 16, bottom: 16, color: "#fff" }}>
          <p style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2, margin: 0, marginBottom: 6, fontFamily: "var(--font-heading)" }}>{v.title}</p>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
            <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 99, background: "rgba(255,255,255,0.18)", fontWeight: 600 }}>{v.category}</span>
            {v.duration && <span style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4, opacity: 0.9 }}><Clock size={11} /> {v.duration}</span>}
            {v.level && <span style={{ fontSize: 11, opacity: 0.9, textTransform: "capitalize" }}>· {v.level}</span>}
            {v.coach_name && <span style={{ fontSize: 11, opacity: 0.9, display: "flex", alignItems: "center", gap: 4 }}><User size={11} /> {v.coach_name}</span>}
            {(v.views_count || 0) > 0 && <span style={{ fontSize: 11, opacity: 0.9, display: "flex", alignItems: "center", gap: 4 }}><Eye size={11} /> {v.views_count}</span>}
            {(v.likes_count || 0) > 0 && <span style={{ fontSize: 11, opacity: 0.9, display: "flex", alignItems: "center", gap: 4 }}><Heart size={11} /> {v.likes_count}</span>}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={(e) => { e.stopPropagation(); openPlayer(v); }}
              style={{
                padding: "9px 18px", borderRadius: 99, border: "none",
                background: "#fff", color: "#000", fontWeight: 800, fontSize: 13,
                cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
              }}>
              <Play size={13} fill="#000" /> {mode === "short" ? "Begin workout now" : (hasResume ? "Resume" : "Start")}
            </button>
            <LikeBtn id={v.id} light count={v.likes_count} />
            <SaveBtn id={v.id} light />
          </div>
        </div>
        <ProgressBar id={v.id} />
      </div>
    );
  };

  /* ── Render ────────────────────────────────────────────────────────────── */

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", paddingBottom: 24 }}>
      {/* Header + search (unchanged) */}
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
          </>
        )}
      </div>

      {/* Primary toggle: Shorts vs Long Videos */}
      <div style={{ padding: "0 16px 12px" }}>
        <div role="tablist" style={{ display: "flex", padding: 4, borderRadius: 14, background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          {([
            { key: "long", label: "Long Videos", icon: <Play size={14} /> },
            { key: "short", label: "Shorts", icon: <Zap size={14} /> },
          ] as Array<{ key: Mode; label: string; icon: any }>).map(opt => {
            const active = mode === opt.key;
            return (
              <button key={opt.key} role="tab" aria-selected={active} onClick={() => setMode(opt.key)}
                style={{
                  flex: 1, padding: "10px 12px", borderRadius: 10,
                  border: "none",
                  background: active ? "var(--accent)" : "transparent",
                  color: active ? "#000" : "var(--text-secondary)",
                  fontWeight: 700, fontSize: 13, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  transition: "background 0.15s ease",
                }}>
                {opt.icon} {opt.label}
              </button>
            );
          })}
        </div>
      </div>


      {loading && <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>{t("loading_ellipsis")}</div>}

      {/* Featured hero — only on the un-filtered, un-searched view */}
      {!loading && !activeFilterCount && !q && featured && (
        <section style={{ padding: "0 16px", marginBottom: 24 }}>
          {renderFeatured(featured)}
        </section>
      )}

      {/* Continue watching strip — long-form only, when the user has history */}
      {!loading && mode === "long" && !activeFilterCount && !q && continueList.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px 12px" }}>
            <p style={{ fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
              <Play size={14} color="var(--accent)" /> Continue watching
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "0 16px", scrollSnapType: "x mandatory", scrollbarWidth: "none" }}>
            {continueList.map(v => {
              const p = progressFor(v.id);
              const lastWatched = p?.updated_at ? new Date(p.updated_at) : null;
              const relTime = lastWatched ? formatRelative(lastWatched) : null;
              return (
                <div key={v.id} onClick={() => openPlayer(v)}
                  style={{ flexShrink: 0, width: 220, scrollSnapAlign: "start", cursor: "pointer" }}>
                  <div style={{ position: "relative", height: 124, borderRadius: 14, overflow: "hidden", background: "var(--bg-card)", border: "1px solid var(--border)", marginBottom: 8 }}>
                    {v.thumbnail
                      ? <img src={resolveAssetUrl(v.thumbnail)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <div style={{ width: "100%", height: "100%", background: `${CAT_COLORS[v.category] || "#FFD600"}20` }} />}
                    <ProgressBar id={v.id} />
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, marginBottom: 2 }}>{v.title}</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                    <Clock size={11} /> {v.duration || ""}{v.coach_name ? ` · ${v.coach_name}` : ""}
                    {relTime ? ` · ${relTime}` : ""}
                  </p>
                  <button
                    onClick={(e) => { e.stopPropagation(); openPlayer(v); }}
                    style={{
                      marginTop: 6, padding: "5px 10px", borderRadius: 8,
                      border: "none", background: "var(--accent)", color: "#000",
                      fontWeight: 700, fontSize: 11, cursor: "pointer",
                      display: "inline-flex", alignItems: "center", gap: 4,
                    }}>
                    <Play size={10} fill="#000" /> Resume
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Coach groupings — long-form only */}
      {!loading && mode === "long" && !activeFilterCount && !q && coachGroups.length > 0 && (
        <section style={{ padding: "0 16px", marginBottom: 24 }}>
          <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <User size={14} color="var(--accent)" /> Browse by coach
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            {coachGroups.map(([name, list]) => (
              <button key={name} onClick={() => { setQ(name); setSearching(true); }}
                style={{ padding: "14px", borderRadius: 14, border: "1px solid var(--border)", background: "var(--bg-card)", textAlign: "start", cursor: "pointer" }}>
                <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{name}</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{list.length} workout{list.length !== 1 ? "s" : ""}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Main list */}
      <section style={{ padding: "0 16px", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <p style={{ fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            {mode === "short" ? <Flame size={14} color="var(--accent)" /> : <Play size={14} color="var(--accent)" />}
            {fType || (mode === "short" ? "All shorts" : "All workouts")} · {sorted.length}
          </p>
          {mode === "long" && (
            <select value={sort} onChange={e => setSort(e.target.value as SortMode)}
              style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-secondary)", fontSize: 12 }}>
              <option value="newest">Newest</option>
              <option value="shortest">Shortest first</option>
              <option value="longest">Longest first</option>
            </select>
          )}
        </div>
        {sorted.length > 0 ? (
          mode === "short" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(108px, 1fr))", gap: 10 }}>
              {sorted.map(renderShortCard)}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
              {sorted.map(renderLongCard)}
            </div>
          )
        ) : (
          !loading && (
            <div style={{ padding: "32px 0", textAlign: "center", color: "var(--text-muted)" }}>
              <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{t("no_workouts_found")}</p>
              <p style={{ fontSize: 12 }}>{t("try_different_filter")}</p>
            </div>
          )
        )}
      </section>

      {/* Saved (client-side) — lower section */}
      {savedList.length > 0 && (
        <section style={{ padding: "0 16px", marginBottom: 24 }}>
          <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <BookmarkCheck size={14} color="var(--accent)" /> Saved
          </p>
          {mode === "short" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(108px, 1fr))", gap: 10 }}>
              {savedList.slice(0, 6).map(renderShortCard)}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
              {savedList.slice(0, 4).map(renderLongCard)}
            </div>
          )}
        </section>
      )}

      {/* Recently watched (server-side progress) — separate from "Saved" */}
      {mode === "long" && continueList.length > 0 && (activeFilterCount > 0 || q) && (
        <section style={{ padding: "0 16px", marginBottom: 24 }}>
          <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <BookmarkCheck size={14} color="var(--accent)" /> Recently watched
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {continueList.slice(0, 5).map(v => (
              <div key={v.id} onClick={() => openPlayer(v)}
                style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px", borderRadius: 14, background: "var(--bg-card)", border: "1px solid var(--border)", cursor: "pointer" }}>
                <div style={{ position: "relative", width: 84, height: 64, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: "var(--bg-surface)" }}>
                  {v.thumbnail ? <img src={resolveAssetUrl(v.thumbnail)} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", background: `${CAT_COLORS[v.category] || "#FFD600"}20` }} />}
                  <ProgressBar id={v.id} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, marginBottom: 4 }}>{v.title}</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{v.duration}{v.coach_name ? ` · ${v.coach_name}` : ""}</p>
                </div>
                <ChevronRight size={16} color="var(--text-muted)" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Player modal */}
      {playing && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.95)", display: "flex", flexDirection: "column" }}
          onClick={closePlayer}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "56px 20px 16px" }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{playing.title}</p>
            <button onClick={closePlayer} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 99, padding: "8px 16px", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>{t("done")}</button>
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }} onClick={e => e.stopPropagation()}>
            <VideoPlayer
              url={playing.source_type === "youtube"
                ? (playing.youtube_url || playing.url)
                : resolveAssetUrl(playing.url)}
              mediaType={playing.source_type === "youtube" ? "youtube" : "video"}
              height="60vh"
              autoPlay
              startAt={progressFor(playing.id)?.position_seconds || 0}
              onProgress={handleProgress}
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
