import { apiFetch } from "@/lib/api";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { Play, Search, Clock, ChevronRight, X, Plus } from "lucide-react";
import VideoPlayer from "@/components/app/VideoPlayer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Video {
  id: number;
  title: string;
  description: string;
  url: string;
  duration: string;
  category: string;
  is_premium: number;
  thumbnail: string;
  is_short?: number;
  source_type?: string;
  youtube_url?: string;
}

const CATS = ["All", "HIIT", "Strength", "Cardio", "Yoga", "Mobility"];
const CAT_COLORS: Record<string, string> = {
  HIIT: "#FB7185",
  Strength: "#60A5FA",
  Cardio: "#FFD600",
  Yoga: "#34D399",
  Mobility: "#FBBF24",
};

// Coaches can browse the training library but can no longer submit videos —
// that is admin-only now and managed from /admin/trainings.
export default function CoachWorkouts() {
  const { token } = useAuth();
  const { t, lang } = useI18n();

  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [playing, setPlaying] = useState<Video | null>(null);
  const [searching, setSearching] = useState(false);

  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [athletes, setAthletes] = useState<{ id: number; name: string }[]>([]);
  const [newPlanAthleteId, setNewPlanAthleteId] = useState("");
  const [newPlanTitle, setNewPlanTitle] = useState("");
  const [newPlanDesc, setNewPlanDesc] = useState("");
  const [newPlanSaving, setNewPlanSaving] = useState(false);
  const [newPlanMsg, setNewPlanMsg] = useState("");

  const fetchJson = async (path: string, init?: RequestInit) => {
    const response = await apiFetch(`${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || `HTTP ${response.status}`);
    return data;
  };

  const loadVideos = async () => {
    if (!token) return;
    try {
      const libraryData = await fetchJson("/api/workouts/videos");
      setVideos(libraryData.videos || []);
    } catch {
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVideos();
    if (token) {
      fetchJson("/api/coach/users").then(d => setAthletes((d.users || []).map((u: any) => ({ id: u.id, name: u.name })))).catch(() => {});
    }
  }, [token]);
  useAutoRefresh(loadVideos);

  const saveNewPlan = async () => {
    if (!newPlanAthleteId || !newPlanTitle.trim()) return;
    setNewPlanSaving(true);
    setNewPlanMsg("");
    try {
      const r = await fetchJson(`/api/coach/users/${newPlanAthleteId}/workout-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newPlanTitle.trim(), description: newPlanDesc.trim(), days_per_week: 3, exercises: [] }),
      });
      setNewPlanMsg("✅ " + (r.message || "Plan created!"));
      setTimeout(() => { setNewPlanOpen(false); setNewPlanTitle(""); setNewPlanDesc(""); setNewPlanAthleteId(""); setNewPlanMsg(""); }, 1500);
    } catch (e: any) {
      setNewPlanMsg("❌ " + (e.message || "Failed to create plan"));
    } finally {
      setNewPlanSaving(false);
    }
  };

  const filtered = videos.filter((video) =>
    (cat === "All" || video.category === cat) &&
    (!q || video.title.toLowerCase().includes(q.toLowerCase()))
  );

  const shorts = filtered.filter((video) => video.is_short);
  const regular = filtered.filter((video) => !video.is_short);

  return (
    <div className="mx-auto flex w-full max-w-[980px] flex-col gap-[18px]">
      <div className="mb-0.5 flex items-center gap-2.5">
        {searching ? (
          <>
            <Input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder={t("search_workouts_ph")} className="flex-1" />
            <Button variant="ghost" size="icon" aria-label={lang === "ar" ? "إغلاق البحث" : "Close search"} onClick={() => { setSearching(false); setQ(""); }}>
              <X size={20} strokeWidth={2} />
            </Button>
          </>
        ) : (
          <>
            <h1 className="flex-1 text-[24px] font-bold tracking-tight">{t("workouts")}</h1>
            <Button variant="outline" size="sm" onClick={() => setNewPlanOpen(true)} className="gap-1.5">
              <Plus size={15} strokeWidth={2} /> New Plan
            </Button>
            <Button variant="outline" size="icon" aria-label={lang === "ar" ? "بحث" : "Search"} onClick={() => setSearching(true)}>
              <Search size={18} strokeWidth={2} />
            </Button>
          </>
        )}
      </div>

      <div className="scroll-x -mx-1 mb-1 flex gap-2 px-1">
        {CATS.map((category) => {
          const active = cat === category;
          const color = CAT_COLORS[category];
          return (
            <button
              key={category}
              onClick={() => setCat(category)}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold whitespace-nowrap transition active:scale-[0.97]",
                active ? (color ? "" : "bg-primary text-primary-foreground") : "bg-muted text-muted-foreground hover:text-foreground",
              )}
              style={active && color ? { background: `color-mix(in srgb, ${color} 18%, transparent)`, color } : undefined}
            >
              {category}
            </button>
          );
        })}
      </div>

      {loading && <div className="py-10 text-center text-[14px] text-muted-foreground">{lang === "ar" ? "جاري التحميل..." : "Loading..."}</div>}

      {shorts.length > 0 && (
        <section className="mb-2">
          <p className="mb-2.5 text-[15px] font-semibold">{t("quick_workouts")}</p>
          <div className="scroll-x flex snap-x snap-mandatory gap-2.5">
            {shorts.map((video) => (
              <button key={video.id} onClick={() => setPlaying(video)} className="relative w-[110px] shrink-0 snap-start text-start" aria-label={video.title}>
                <div className="relative mb-2 h-[180px] overflow-hidden rounded-lg bg-card shadow-soft-sm">
                  {video.thumbnail ? (
                    <img src={video.thumbnail} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="size-full" style={{ background: `color-mix(in srgb, ${CAT_COLORS[video.category] || "#FFD600"} 18%, transparent)` }} />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent">
                    <div className="absolute inset-x-2 bottom-2">
                      <p className="text-[11px] font-bold leading-snug text-white">{video.title}</p>
                    </div>
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                      <span className="grid size-9 place-items-center rounded-full bg-white/90"><Play size={16} className="text-black" fill="#000" /></span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {regular.length > 0 && (
        <section>
          <p className="mb-3 text-[15px] font-semibold">{cat === "All" ? t("all_workouts") : cat} · {regular.length}</p>
          <div className="flex flex-col gap-2.5">
            {regular.map((video) => {
              const color = CAT_COLORS[video.category] || "var(--primary)";
              return (
                <button key={video.id} onClick={() => setPlaying(video)} className="flex items-center gap-3 rounded-lg bg-card p-3 text-start shadow-soft-sm transition active:scale-[0.99]" aria-label={video.title}>
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted">
                    {video.thumbnail ? (
                      <img src={video.thumbnail} alt="" className="size-full object-cover" />
                    ) : (
                      <div className="grid size-full place-items-center" style={{ background: `color-mix(in srgb, ${color} 18%, transparent)` }}><Play size={20} style={{ color }} /></div>
                    )}
                    <div className="absolute inset-0 grid place-items-center bg-black/20">
                      <span className="grid size-7 place-items-center rounded-full bg-black/60"><Play size={12} className="text-white" fill="#fff" /></span>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 text-[14px] font-semibold leading-snug">{video.title}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}>{video.category}</span>
                      {video.duration && <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Clock size={11} strokeWidth={2} />{video.duration}</span>}
                    </div>
                  </div>
                  <ChevronRight size={16} strokeWidth={2} className="text-muted-foreground" />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {!loading && filtered.length === 0 && (
        <div className="py-10 text-center text-muted-foreground">
          <p className="mb-2 text-[15px] font-semibold text-foreground">{t("no_workouts_found")}</p>
          <p className="text-[13px]">{t("try_different_filter")}</p>
        </div>
      )}

      <Dialog open={newPlanOpen} onOpenChange={setNewPlanOpen}>
        <DialogContent className="max-w-[440px]">
          <DialogHeader>
            <DialogTitle>New Workout Plan</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">Athlete</Label>
              <Select value={newPlanAthleteId} onValueChange={setNewPlanAthleteId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="— Select athlete —" /></SelectTrigger>
                <SelectContent>
                  {athletes.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {athletes.length === 0 && <p className="text-[12px] text-muted-foreground">No active athlete subscriptions yet.</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">Plan title</Label>
              <Input value={newPlanTitle} onChange={e => setNewPlanTitle(e.target.value)} placeholder="e.g. Beginner Full-Body 3x Week" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">Description</Label>
              <Textarea value={newPlanDesc} onChange={e => setNewPlanDesc(e.target.value)} placeholder="Overview of this workout plan…" rows={3} />
            </div>
            {newPlanMsg && <p className="text-[13px]" style={{ color: newPlanMsg.startsWith("✅") ? "var(--green)" : "var(--red)" }}>{newPlanMsg}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewPlanOpen(false)}>Cancel</Button>
            <Button onClick={saveNewPlan} disabled={newPlanSaving || !newPlanAthleteId || !newPlanTitle.trim()}>
              {newPlanSaving ? "Creating…" : "Create Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {playing && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-black/95" onClick={() => setPlaying(null)}>
          <div className="flex items-center justify-between p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-[16px] font-bold text-white">{playing.title}</p>
            <Button variant="secondary" size="sm" className="bg-white/15 text-white hover:bg-white/25" onClick={() => setPlaying(null)}>{t("done")}</Button>
          </div>
          <div className="flex flex-1 items-center justify-center px-4" onClick={(e) => e.stopPropagation()}>
            <VideoPlayer url={playing.source_type === "youtube" ? (playing.youtube_url || playing.url) : playing.url} mediaType={playing.source_type === "youtube" ? "youtube" : "video"} />
          </div>
        </div>
      )}
    </div>
  );
}
