import { apiFetch, resolveAssetUrl } from "@/lib/api";
import ErrorState from "@/components/ui/ErrorState";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { useMemo, useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import {
  Play, Search, Clock, ChevronRight, X, BookmarkCheck, Sparkles,
  Flame, Zap, User, TrendingUp, Heart, Eye,
} from "lucide-react";
import VideoPlayer from "@/components/app/VideoPlayer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { clickable } from "@/lib/a11y";

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

/* Section header — quiet icon + bold title, matching the Dashboard rhythm. */
function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-[19px] font-bold leading-none tracking-tight">
      <span className="text-primary">{icon}</span>
      {children}
    </h2>
  );
}

/* Tiny helper for a chip row. Single-select with an "All" reset chip. */
function ChipRow<T extends { value: string; label: string }>({
  label, items, value, onChange,
}: { label: string; items: T[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="mb-2.5">
      <p className="mb-1.5 text-[11px] tracking-[0.06em] text-muted-foreground uppercase">{label}</p>
      <div className="scroll-x flex gap-2 pb-1">
        <button
          onClick={() => onChange("")}
          className={cn(
            "shrink-0 rounded-full px-3 py-1.5 text-xs whitespace-nowrap transition",
            !value
              ? "bg-primary/15 font-bold text-primary"
              : "bg-card font-medium text-muted-foreground shadow-soft-sm",
          )}
        >All</button>
        {items.map(it => {
          const active = value === it.value;
          return (
            <button key={it.value} onClick={() => onChange(active ? "" : it.value)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs whitespace-nowrap transition",
                active
                  ? "bg-primary/15 font-bold text-primary"
                  : "bg-card font-medium text-muted-foreground shadow-soft-sm",
              )}>
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
  const [loadError, setLoadError] = useState(false);
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

  // Delegates to the centralized apiFetch: API base + bearer injection plus the
  // global 401 → refresh-or-logout flow, with the same (path, init) signature.
  const apiCall = (path: string, init?: RequestInit) => apiFetch(path, init as any);

  const loadWorkouts = () => {
    if (!token) return;
    setLoadError(false);
    Promise.all([
      // The two primary feeds: a failure here means the page has nothing to
      // show, so let it reject and surface a retry instead of faking "empty".
      apiCall('/api/workouts/videos').then(r => { if (!r.ok) throw new Error('videos failed'); return r.json(); }),
      apiCall('/api/workouts/shorties').then(r => { if (!r.ok) throw new Error('shorties failed'); return r.json(); }),
      // Secondary data: degrade gracefully to defaults.
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
    }).catch(() => {
      // Keep any previously-loaded content (background auto-refresh may fail
      // transiently); the error state only renders when both feeds are empty.
      setLoadError(true);
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
        className={cn(
          "grid size-[30px] place-items-center rounded-full transition active:scale-95",
          light
            ? "bg-black/55 text-white backdrop-blur"
            : "bg-muted shadow-soft-sm",
          saved && (light ? "text-primary" : "text-primary"),
          !saved && !light && "text-muted-foreground",
        )}
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
        className={cn(
          "inline-flex h-[30px] items-center justify-center gap-1 rounded-full px-2.5 text-[11px] font-bold transition active:scale-95",
          light
            ? "bg-black/55 text-white backdrop-blur"
            : "bg-muted shadow-soft-sm",
          liked && "text-[#FB7185]",
          !liked && !light && "text-muted-foreground",
        )}
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
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-black/40">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    );
  };

  /* Long-form card: bigger thumbnail + stack of meta + Start/Continue CTA. */
  const renderLongCard = (v: Video) => {
    const prog = progressFor(v.id);
    const hasProgress = !!prog && prog.position_seconds > 5 && !prog.completed;
    return (
      <Card key={v.id} {...clickable(() => openPlayer(v))}
        className="cursor-pointer gap-0 overflow-hidden p-0 shadow-soft-sm transition active:scale-[0.99]">
        <div className="relative aspect-video w-full bg-muted">
          {v.thumbnail
            ? <img src={resolveAssetUrl(v.thumbnail)} alt="" className="size-full object-cover" />
            : <div className="grid size-full place-items-center" style={{ background: `${CAT_COLORS[v.category] || "#FFD600"}20` }}><Play size={28} color={CAT_COLORS[v.category] || "var(--accent)"} /></div>}
          {v.duration && (
            <span className="absolute end-2 bottom-2 inline-flex items-center gap-1 rounded-md bg-black/75 px-2 py-0.5 text-[11px] font-semibold text-white">
              <Clock size={10} /> {v.duration}
            </span>
          )}
          <div className="absolute end-2 top-2">
            <SaveBtn id={v.id} light />
          </div>
          <ProgressBar id={v.id} />
        </div>
        <div className="flex flex-col gap-1.5 px-2.5 pt-2 pb-2.5">
          <p className="line-clamp-2 text-[13px] leading-snug font-bold">{v.title}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: `${CAT_COLORS[v.category] || "#FFD600"}15`, color: CAT_COLORS[v.category] || "var(--accent)" }}>{v.category}</span>
            {v.level && <span className="text-[10px] text-muted-foreground capitalize">· {v.level}</span>}
            {v.coach_name && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <User size={9} /> {v.coach_name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            {(v.views_count || 0) > 0 && <span className="flex items-center gap-1"><Eye size={11} /> {v.views_count}</span>}
            {(v.likes_count || 0) > 0 && <span className="flex items-center gap-1"><Heart size={11} /> {v.likes_count}</span>}
          </div>
          <div className="mt-0.5 flex gap-1.5">
            <Button
              size="sm"
              onClick={(e) => { e.stopPropagation(); openPlayer(v); }}
              className="h-8 flex-1 text-xs"
            >
              <Play size={11} fill="currentColor" /> {hasProgress ? "Continue" : "Start"}
            </Button>
            <LikeBtn id={v.id} />
          </div>
        </div>
      </Card>
    );
  };

  /* Short card: tall portrait thumbnail, minimal meta, designed for fast scrolling. */
  const renderShortCard = (v: Video) => (
    <div key={v.id} {...clickable(() => openPlayer(v))}
      className="flex cursor-pointer flex-col">
      <div className="relative mb-1.5 aspect-[9/16] w-full overflow-hidden rounded-md bg-card shadow-soft-sm">
        {v.thumbnail
          ? <img src={resolveAssetUrl(v.thumbnail)} alt="" className="size-full object-cover" />
          : <div className="grid size-full place-items-center" style={{ background: `${CAT_COLORS[v.category] || "#FFD600"}20` }}><Play size={24} color={CAT_COLORS[v.category] || "var(--accent)"} /></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent to-45%" />
        {v.duration && (
          <span className="absolute start-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {v.duration}
          </span>
        )}
        <div className="absolute end-1.5 top-1.5 flex flex-col gap-1.5">
          <SaveBtn id={v.id} light />
          <LikeBtn id={v.id} light count={v.likes_count} />
        </div>
        <div className="absolute inset-x-2 bottom-2 text-white">
          <p className="line-clamp-2 text-xs leading-snug font-bold">{v.title}</p>
          <div className="mt-0.5 flex items-center gap-2 text-[10px] opacity-85">
            {v.coach_name && (
              <span className="flex items-center gap-1"><User size={9} /> {v.coach_name}</span>
            )}
            {(v.views_count || 0) > 0 && (
              <span className="flex items-center gap-1"><Eye size={10} /> {v.views_count}</span>
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
      <div {...clickable(() => openPlayer(v))}
        className={cn(
          "relative cursor-pointer overflow-hidden rounded-lg bg-card shadow-soft transition active:scale-[0.99]",
          mode === "short" ? "aspect-[4/5] max-h-[320px]" : "aspect-video max-h-[240px]",
        )}>
        {v.thumbnail
          ? <img src={resolveAssetUrl(v.thumbnail)} alt="" className="size-full object-cover" />
          : <div className="size-full" style={{ background: `${CAT_COLORS[v.category] || "#FFD600"}30` }} />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/35" />
        <span className="absolute start-3.5 top-3.5 inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-[11px] font-extrabold tracking-wide text-primary-foreground uppercase">
          {labelIcon}
        </span>
        <div className="absolute inset-x-4 bottom-4 text-white">
          <p className="mb-1.5 text-[20px] leading-tight font-extrabold tracking-tight">{v.title}</p>
          <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
            <span className="rounded-full bg-white/[0.18] px-2.5 py-0.5 text-[11px] font-semibold">{v.category}</span>
            {v.duration && <span className="flex items-center gap-1 text-[11px] opacity-90"><Clock size={11} /> {v.duration}</span>}
            {v.level && <span className="text-[11px] opacity-90 capitalize">· {v.level}</span>}
            {v.coach_name && <span className="flex items-center gap-1 text-[11px] opacity-90"><User size={11} /> {v.coach_name}</span>}
            {(v.views_count || 0) > 0 && <span className="flex items-center gap-1 text-[11px] opacity-90"><Eye size={11} /> {v.views_count}</span>}
            {(v.likes_count || 0) > 0 && <span className="flex items-center gap-1 text-[11px] opacity-90"><Heart size={11} /> {v.likes_count}</span>}
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={(e) => { e.stopPropagation(); openPlayer(v); }}
              className="rounded-full bg-white text-black hover:bg-white/90"
            >
              <Play size={13} fill="currentColor" /> {mode === "short" ? "Begin workout now" : (hasResume ? "Resume" : "Start")}
            </Button>
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
    <div className="mx-auto w-full max-w-[860px] pb-6">
      {/* Header + search (unchanged) */}
      <div className="flex items-center gap-2.5 px-4 py-4">
        {searching ? (
          <>
            <Input value={q} onChange={e => setQ(e.target.value)} autoFocus placeholder={t("search_workouts_ph")} className="flex-1" />
            <Button variant="ghost" size="icon" onClick={() => { setSearching(false); setQ(""); }} aria-label="Close search">
              <X size={22} />
            </Button>
          </>
        ) : (
          <>
            <h1 className="flex-1 text-[26px] font-bold tracking-tight">{t("workouts")}</h1>
            <Button variant="outline" size="icon" onClick={() => setSearching(true)} aria-label="Search workouts">
              <Search size={18} />
            </Button>
          </>
        )}
      </div>

      {/* Primary toggle: Shorts vs Long Videos */}
      <div className="px-4 pb-3">
        <div role="tablist" className="flex gap-1 rounded-md bg-muted p-1">
          {([
            { key: "long", label: "Long Videos", icon: <Play size={14} /> },
            { key: "short", label: "Shorts", icon: <Zap size={14} /> },
          ] as Array<{ key: Mode; label: string; icon: any }>).map(opt => {
            const active = mode === opt.key;
            return (
              <button key={opt.key} role="tab" aria-selected={active} onClick={() => setMode(opt.key)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-[8px] px-3 py-2.5 text-[13px] font-bold transition",
                  active
                    ? "bg-card text-foreground shadow-soft-sm"
                    : "text-muted-foreground",
                )}>
                {opt.icon} {opt.label}
              </button>
            );
          })}
        </div>
      </div>


      {loading && (
        <div className="space-y-6 px-4 pt-2">
          <Skeleton className="aspect-video w-full rounded-lg" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-[4/3] w-full rounded-lg" />)}
          </div>
        </div>
      )}

      {/* Load failure with nothing cached to show — offer a retry instead of
          silently rendering an empty library. */}
      {!loading && loadError && longs.length === 0 && shorts.length === 0 && (
        <ErrorState message="We couldn't load your workouts. Check your connection and try again." onRetry={loadWorkouts} />
      )}

      {/* Featured hero — only on the un-filtered, un-searched view */}
      {!loading && !activeFilterCount && !q && featured && (
        <section className="mb-6 px-4">
          {renderFeatured(featured)}
        </section>
      )}

      {/* Continue watching strip — long-form only, when the user has history */}
      {!loading && mode === "long" && !activeFilterCount && !q && continueList.length > 0 && (
        <section className="mb-6">
          <div className="px-4 pb-3">
            <SectionTitle icon={<Play size={16} />}>Continue watching</SectionTitle>
          </div>
          <div className="scroll-x flex snap-x snap-mandatory gap-3 px-4">
            {continueList.map(v => {
              const p = progressFor(v.id);
              const lastWatched = p?.updated_at ? new Date(p.updated_at) : null;
              const relTime = lastWatched ? formatRelative(lastWatched) : null;
              return (
                <div key={v.id} {...clickable(() => openPlayer(v))}
                  className="w-[220px] shrink-0 snap-start cursor-pointer">
                  <div className="relative mb-2 h-[124px] overflow-hidden rounded-md bg-card shadow-soft-sm">
                    {v.thumbnail
                      ? <img src={resolveAssetUrl(v.thumbnail)} alt="" className="size-full object-cover" />
                      : <div className="size-full" style={{ background: `${CAT_COLORS[v.category] || "#FFD600"}20` }} />}
                    <ProgressBar id={v.id} />
                  </div>
                  <p className="mb-0.5 line-clamp-2 text-[13px] leading-snug font-semibold break-words">{v.title}</p>
                  <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                    <Clock size={11} /> {v.duration || ""}{v.coach_name ? ` · ${v.coach_name}` : ""}
                    {relTime ? ` · ${relTime}` : ""}
                  </p>
                  <Button
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); openPlayer(v); }}
                    className="mt-1.5 h-7 px-2.5 text-[11px]"
                  >
                    <Play size={10} fill="currentColor" /> Resume
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Coach groupings — long-form only */}
      {!loading && mode === "long" && !activeFilterCount && !q && coachGroups.length > 0 && (
        <section className="mb-6 px-4">
          <div className="mb-2.5">
            <SectionTitle icon={<User size={16} />}>Browse by coach</SectionTitle>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
            {coachGroups.map(([name, list]) => (
              <Card key={name} asChild className="gap-0 p-0 shadow-soft-sm">
                <button onClick={() => { setQ(name); setSearching(true); }}
                  className="cursor-pointer p-3.5 text-start transition active:scale-[0.98]">
                  <p className="mb-1 text-sm font-bold">{name}</p>
                  <p className="text-[11px] text-muted-foreground">{list.length} workout{list.length !== 1 ? "s" : ""}</p>
                </button>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Main list */}
      <section className="mb-6 px-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <SectionTitle icon={mode === "short" ? <Flame size={16} /> : <Play size={16} />}>
            {fType || (mode === "short" ? "All shorts" : "All workouts")} · {sorted.length}
          </SectionTitle>
          {mode === "long" && (
            <Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
              <SelectTrigger size="sm" className="text-xs" aria-label="Sort workouts">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="shortest">Shortest first</SelectItem>
                <SelectItem value="longest">Longest first</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        {sorted.length > 0 ? (
          mode === "short" ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(108px,1fr))] gap-2.5">
              {sorted.map(renderShortCard)}
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
              {sorted.map(renderLongCard)}
            </div>
          )
        ) : (
          !loading && !loadError && (
            <div className="py-8 text-center text-muted-foreground">
              <p className="mb-1.5 text-sm font-semibold text-foreground">{t("no_workouts_found")}</p>
              <p className="text-xs">{t("try_different_filter")}</p>
            </div>
          )
        )}
      </section>

      {/* Saved (client-side) — lower section */}
      {savedList.length > 0 && (
        <section className="mb-6 px-4">
          <div className="mb-2.5">
            <SectionTitle icon={<BookmarkCheck size={16} />}>Saved</SectionTitle>
          </div>
          {mode === "short" ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(108px,1fr))] gap-2.5">
              {savedList.slice(0, 6).map(renderShortCard)}
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
              {savedList.slice(0, 4).map(renderLongCard)}
            </div>
          )}
        </section>
      )}

      {/* Recently watched (server-side progress) — separate from "Saved" */}
      {mode === "long" && continueList.length > 0 && (activeFilterCount > 0 || q) && (
        <section className="mb-6 px-4">
          <div className="mb-2.5">
            <SectionTitle icon={<BookmarkCheck size={16} />}>Recently watched</SectionTitle>
          </div>
          <div className="flex flex-col gap-2.5">
            {continueList.slice(0, 5).map(v => (
              <Card key={v.id} {...clickable(() => openPlayer(v))}
                className="flex cursor-pointer flex-row items-center gap-3 p-3 shadow-soft-sm transition active:scale-[0.99]">
                <div className="relative h-16 w-[84px] shrink-0 overflow-hidden rounded-md bg-muted">
                  {v.thumbnail ? <img src={resolveAssetUrl(v.thumbnail)} alt="" className="size-full object-cover" /> : <div className="size-full" style={{ background: `${CAT_COLORS[v.category] || "#FFD600"}20` }} />}
                  <ProgressBar id={v.id} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="mb-1 line-clamp-2 text-sm leading-snug font-semibold break-words">{v.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{v.duration}{v.coach_name ? ` · ${v.coach_name}` : ""}</p>
                </div>
                <ChevronRight size={16} className="text-muted-foreground" />
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Player modal */}
      {playing && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-black/95"
          onClick={closePlayer}>
          <div className="flex items-center justify-between gap-3 px-5 pt-14 pb-4" onClick={e => e.stopPropagation()}>
            <p className="min-w-0 flex-1 truncate text-base font-bold text-white">{playing.title}</p>
            <Button variant="secondary" onClick={closePlayer} className="rounded-full bg-white/15 text-white hover:bg-white/25">{t("done")}</Button>
          </div>
          <div className="flex flex-1 items-center justify-center px-4" onClick={e => e.stopPropagation()}>
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
          <div className="px-5 pt-4 pb-8" onClick={e => e.stopPropagation()}>
            <p className="text-[13px] leading-relaxed text-white/60">{playing.description}</p>
          </div>
        </div>
      )}
    </div>
  );
}
