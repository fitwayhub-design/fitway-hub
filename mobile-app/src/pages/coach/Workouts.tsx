import { getApiBase } from "@/lib/api";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { Play, Search, Clock, ChevronRight, X } from "lucide-react";
import VideoPlayer from "@/components/app/VideoPlayer";

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

  const fetchJson = async (path: string, init?: RequestInit) => {
    const response = await fetch(`${getApiBase()}${path}`, {
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
  }, [token]);
  useAutoRefresh(loadVideos);

  const filtered = videos.filter((video) =>
    (cat === "All" || video.category === cat) &&
    (!q || video.title.toLowerCase().includes(q.toLowerCase()))
  );

  const shorts = filtered.filter((video) => video.is_short);
  const regular = filtered.filter((video) => !video.is_short);

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
        {searching ? (
          <>
            <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder={t("search_workouts_ph")} style={{ flex: 1, padding: "10px 14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 15, outline: "none" }} />
            <button onClick={() => { setSearching(false); setQ(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={22} /></button>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 24, fontWeight: 800, flex: 1, fontFamily: "var(--font-heading)" }}>{t("training_videos")}</h1>
            <button onClick={() => setSearching(true)} style={{ width: 40, height: 40, borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-secondary)" }}>
              <Search size={18} />
            </button>
          </>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 4, scrollbarWidth: "none" }}>
        {CATS.map((category) => (
          <button key={category} onClick={() => setCat(category)} style={{ flexShrink: 0, padding: "8px 16px", borderRadius: 99, border: `1.5px solid ${cat === category ? (CAT_COLORS[category] || "var(--accent)") : "var(--border)"}`, background: cat === category ? `${CAT_COLORS[category] || "var(--accent)"}15` : "var(--bg-card)", color: cat === category ? (CAT_COLORS[category] || "var(--accent)") : "var(--text-secondary)", fontWeight: cat === category ? 700 : 400, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
            {category}
          </button>
        ))}
      </div>

      {loading && <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>{lang === "ar" ? "جاري التحميل..." : "Loading..."}</div>}

      {shorts.length > 0 && (
        <section style={{ marginBottom: 8 }}>
          <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>{t("quick_workouts")}</p>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollSnapType: "x mandatory" }}>
            {shorts.map((video) => (
              <div key={video.id} onClick={() => setPlaying(video)} style={{ flexShrink: 0, width: 110, scrollSnapAlign: "start", cursor: "pointer", position: "relative" }}>
                <div style={{ height: 180, borderRadius: 16, overflow: "hidden", background: "var(--bg-card)", border: "1px solid var(--border)", marginBottom: 8, position: "relative" }}>
                  {video.thumbnail ? <img src={video.thumbnail} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", background: `${CAT_COLORS[video.category] || "#FFD600"}20` }} />}
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)" }}>
                    <div style={{ position: "absolute", bottom: 8, left: 8, right: 8 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>{video.title}</p>
                    </div>
                    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }}><Play size={16} color="#000000" fill="#000000" /></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {regular.length > 0 && (
        <section>
          <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{cat === "All" ? t("all_workouts") : cat} · {regular.length}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {regular.map((video) => (
              <div key={video.id} onClick={() => setPlaying(video)} style={{ display: "flex", gap: 12, alignItems: "center", padding: 12, borderRadius: 14, background: "var(--bg-card)", border: "1px solid var(--border)", cursor: "pointer" }}>
                <div style={{ width: 64, height: 64, borderRadius: 10, overflow: "hidden", flexShrink: 0, position: "relative", background: "var(--bg-surface)" }}>
                  {video.thumbnail ? <img src={video.thumbnail} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", background: `${CAT_COLORS[video.category] || "#FFD600"}20`, display: "flex", alignItems: "center", justifyContent: "center" }}><Play size={20} color={CAT_COLORS[video.category] || "var(--accent)"} /></div>}
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.2)" }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}><Play size={12} color="#fff" fill="#fff" /></div>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, marginBottom: 3 }}>{video.title}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 99, background: `${CAT_COLORS[video.category] || "#FFD600"}15`, color: CAT_COLORS[video.category] || "var(--accent)", fontWeight: 600 }}>{video.category}</span>
                    {video.duration && <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--text-muted)" }}><Clock size={11} />{video.duration}</span>}
                  </div>
                </div>
                <ChevronRight size={16} color="var(--text-muted)" />
              </div>
            ))}
          </div>
        </section>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{t("no_workouts_found")}</p>
          <p style={{ fontSize: 13 }}>{t("try_different_filter")}</p>
        </div>
      )}

      {playing && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.95)", display: "flex", flexDirection: "column" }} onClick={() => setPlaying(null)}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px" }} onClick={(e) => e.stopPropagation()}>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{playing.title}</p>
            <button onClick={() => setPlaying(null)} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 99, padding: "8px 16px", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>{t("done")}</button>
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }} onClick={(e) => e.stopPropagation()}>
            <VideoPlayer url={playing.source_type === "youtube" ? (playing.youtube_url || playing.url) : playing.url} mediaType={playing.source_type === "youtube" ? "youtube" : "video"} />
          </div>
        </div>
      )}
    </div>
  );
}
