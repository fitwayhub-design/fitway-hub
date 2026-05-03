import { getApiBase } from "@/lib/api";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { Play, Search, Clock, ChevronRight, X } from "lucide-react";
import VideoPlayer from "@/components/app/VideoPlayer";

interface Video {
  id: number; title: string; description: string;
  url: string; duration: string; category: string;
  is_premium: number; thumbnail: string; is_short?: number;
  source_type?: string; youtube_url?: string;
}

const CATS = ["All", "HIIT", "Strength", "Cardio", "Yoga", "Mobility"];
const CAT_COLORS: Record<string, string> = {
  HIIT: "#FB7185", Strength: "#60A5FA", Cardio: "#FFD600",
  Yoga: "#34D399", Mobility: "#FBBF24",
};

export default function Workouts() {
  const { user, token } = useAuth();
  const { t, lang } = useI18n();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [playing, setPlaying] = useState<Video | null>(null);
  const [searching, setSearching] = useState(false);

  const loadWorkouts = () => {
    if (!token) return;
    fetch(`${getApiBase()}/api/workouts/videos`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setVideos(d.videos || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadWorkouts();
  }, [token]);
  useAutoRefresh(loadWorkouts);

  const filtered = videos.filter(v =>
    (cat === "All" || v.category === cat) &&
    (!q || v.title.toLowerCase().includes(q.toLowerCase()))
  );

  const shorts = filtered.filter(v => v.is_short);
  const regular = filtered.filter(v => !v.is_short);



  const CAT_LABELS: Record<string, string> = {
    All: t("all"), HIIT: t("hiit"), Strength: t("strength"),
    Cardio: t("cardio"), Yoga: t("yoga"), Mobility: t("mobility_label"),
  };

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", paddingBottom: 24 }}>
      {/* Header */}
      <div style={{ padding: "16px 16px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        {searching
          ? <>
              <input value={q} onChange={e => setQ(e.target.value)} autoFocus placeholder={t("search_workouts_ph")}
                style={{ flex: 1, padding: "10px 14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 15, outline: "none" }} />
              <button onClick={() => { setSearching(false); setQ(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={22} /></button>
            </>
          : <>
              <h1 style={{ fontSize: 24, fontWeight: 800, flex: 1, fontFamily: "var(--font-heading)" }}>{t("workouts")}</h1>
              <button onClick={() => setSearching(true)} style={{ width: 40, height: 40, borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-secondary)" }}>
                <Search size={18} />
              </button>
            </>
        }
      </div>

      {/* Category pills */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 16px 16px", scrollbarWidth: "none" }}>
        {CATS.map(c => (
          <button key={c} onClick={() => setCat(c)}
            style={{ flexShrink: 0, padding: "8px 16px", borderRadius: 99, border: `1.5px solid ${cat === c ? (CAT_COLORS[c] || "var(--accent)") : "var(--border)"}`, background: cat === c ? `${CAT_COLORS[c] || "var(--accent)"}15` : "var(--bg-card)", color: cat === c ? (CAT_COLORS[c] || "var(--accent)") : "var(--text-secondary)", fontWeight: cat === c ? 700 : 400, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s" }}>
            {CAT_LABELS[c] || c}
          </button>
        ))}
      </div>

      {loading && <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>{t("loading_ellipsis")}</div>}

      {/* Shorts row */}
      {shorts.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px 10px" }}>
            <p style={{ fontSize: 15, fontWeight: 700 }}>{t("quick_workouts")}</p>
          </div>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "0 16px", scrollSnapType: "x mandatory" }}>
            {shorts.map(v => (
              <div key={v.id} onClick={() => setPlaying(v)}
                style={{ flexShrink: 0, width: 110, scrollSnapAlign: "start", cursor: "pointer", position: "relative" }}>
                <div style={{ height: 180, borderRadius: 16, overflow: "hidden", background: "var(--bg-card)", border: "1px solid var(--border)", marginBottom: 8, position: "relative" }}>
                  {v.thumbnail ? <img src={v.thumbnail} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", background: `${CAT_COLORS[v.category] || "#FFD600"}20` }} />}
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)" }}>
                    <div style={{ position: "absolute", bottom: 8, left: 8, right: 8 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>{v.title}</p>
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

      {/* Regular videos */}
      {regular.length > 0 && (
        <section style={{ padding: "0 16px" }}>
          <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{cat === "All" ? t("all_workouts") : (CAT_LABELS[cat] || cat)} · {regular.length}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {regular.map(v => (
              <div key={v.id} onClick={() => setPlaying(v)}
                style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px", borderRadius: 14, background: "var(--bg-card)", border: "1px solid var(--border)", cursor: "pointer" }}>
                <div style={{ width: 64, height: 64, borderRadius: 10, overflow: "hidden", flexShrink: 0, position: "relative", background: "var(--bg-surface)" }}>
                  {v.thumbnail ? <img src={v.thumbnail} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", background: `${CAT_COLORS[v.category] || "#FFD600"}20`, display: "flex", alignItems: "center", justifyContent: "center" }}><Play size={20} color={CAT_COLORS[v.category] || "var(--accent)"} /></div>}
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.2)" }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}><Play size={12} color="#fff" fill="#fff" /></div>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, marginBottom: 3 }}>{v.title}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 99, background: `${CAT_COLORS[v.category] || "#FFD600"}15`, color: CAT_COLORS[v.category] || "var(--accent)", fontWeight: 600 }}>{v.category}</span>
                    {v.duration && <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--text-muted)" }}><Clock size={11} />{v.duration}</span>}

                  </div>
                </div>
                <ChevronRight size={16} color="var(--text-muted)" />
              </div>
            ))}
          </div>
        </section>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--text-muted)" }}>
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{t("no_workouts_found")}</p>
          <p style={{ fontSize: 13 }}>{t("try_different_filter")}</p>
        </div>
      )}

      {/* Video player modal */}
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
