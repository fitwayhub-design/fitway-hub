import { getApiBase } from "@/lib/api";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { Play, Search, Clock, ChevronRight, X, Plus, Upload, Link2, AlertCircle } from "lucide-react";
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

interface SubmittedVideo extends Video {
  approval_status?: "pending" | "approved" | "rejected";
  rejection_reason?: string | null;
  created_at: string;
}

const CATS = ["All", "HIIT", "Strength", "Cardio", "Yoga", "Mobility"];
const CAT_COLORS: Record<string, string> = {
  HIIT: "#FB7185",
  Strength: "#60A5FA",
  Cardio: "#FFD600",
  Yoga: "#34D399",
  Mobility: "#FBBF24",
};

const initialForm = {
  title: "",
  description: "",
  duration: "",
  category: "HIIT",
  is_short: false,
};

export default function CoachWorkouts() {
  const { token, user } = useAuth();
  const { t, lang } = useI18n();
  const canSubmit = user?.role === "coach" || user?.role === "admin";

  const [videos, setVideos] = useState<Video[]>([]);
  const [myVideos, setMyVideos] = useState<SubmittedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [playing, setPlaying] = useState<Video | null>(null);
  const [searching, setSearching] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [sourceType, setSourceType] = useState<"upload" | "youtube">("upload");
  const [form, setForm] = useState(initialForm);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);

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
      const libraryPromise = fetchJson("/api/workouts/videos");
      const minePromise = canSubmit ? fetchJson("/api/workouts/my-videos") : Promise.resolve({ videos: [] });
      const [libraryData, mineData] = await Promise.all([libraryPromise, minePromise]);
      setVideos(libraryData.videos || []);
      setMyVideos(mineData.videos || []);
    } catch {
      setVideos([]);
      setMyVideos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVideos();
  }, [token, canSubmit]);
  useAutoRefresh(loadVideos);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const filtered = videos.filter((video) =>
    (cat === "All" || video.category === cat) &&
    (!q || video.title.toLowerCase().includes(q.toLowerCase()))
  );

  const shorts = filtered.filter((video) => video.is_short);
  const regular = filtered.filter((video) => !video.is_short);

  const resetForm = () => {
    setForm(initialForm);
    setYoutubeUrl("");
    setVideoFile(null);
    setThumbnailFile(null);
    setSourceType("upload");
  };

  const closeModal = () => {
    setShowSubmitModal(false);
    resetForm();
  };

  const submitVideo = async () => {
    if (!form.title.trim()) {
      setMessage({ type: "error", text: t("coach_video_title_required") });
      return;
    }
    if (sourceType === "upload" && !videoFile) {
      setMessage({ type: "error", text: t("coach_video_file_required") });
      return;
    }
    if (sourceType === "youtube" && !youtubeUrl.trim()) {
      setMessage({ type: "error", text: t("coach_video_youtube_required") });
      return;
    }

    setSubmitting(true);
    try {
      if (sourceType === "youtube") {
        const data = await fetchJson("/api/workouts/videos/submissions/youtube", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, youtube_url: youtubeUrl }),
        });
        setMyVideos((prev) => [data.video, ...prev]);
        setMessage({ type: "success", text: data.message || t("coach_video_submitted") });
      } else {
        const formData = new FormData();
        formData.append("title", form.title);
        formData.append("description", form.description);
        formData.append("duration", form.duration);
        formData.append("category", form.category);
        formData.append("is_short", form.is_short ? "1" : "0");
        formData.append("video", videoFile!);
        if (thumbnailFile) formData.append("thumbnail", thumbnailFile);

        const response = await fetch(`${getApiBase()}/api/workouts/videos/submissions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.message || t("coach_video_submit_failed"));
        setMyVideos((prev) => [data.video, ...prev]);
        setMessage({ type: "success", text: data.message || t("coach_video_submitted") });
      }
      closeModal();
    } catch (error: any) {
      setMessage({ type: "error", text: error?.message || t("coach_video_submit_failed") });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusMeta = (status?: SubmittedVideo["approval_status"]) => {
    if (status === "approved") {
      return { label: t("coach_video_live"), color: "var(--accent)", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.25)" };
    }
    if (status === "rejected") {
      return { label: t("rejected"), color: "var(--red)", bg: "rgba(255,68,68,0.08)", border: "rgba(255,68,68,0.24)" };
    }
    return { label: t("coach_video_under_review"), color: "var(--amber)", bg: "rgba(255,179,64,0.12)", border: "rgba(255,179,64,0.25)" };
  };

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
      {message && (
        <div style={{ padding: "12px 14px", borderRadius: 14, border: `1px solid ${message.type === "success" ? "rgba(16,185,129,0.25)" : "rgba(255,68,68,0.24)"}`, background: message.type === "success" ? "rgba(16,185,129,0.1)" : "rgba(255,68,68,0.08)", color: message.type === "success" ? "var(--accent)" : "var(--red)", fontSize: 13, fontWeight: 600 }}>
          {message.text}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
        {searching ? (
          <>
            <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder={t("search_workouts_ph")} style={{ flex: 1, padding: "10px 14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 15, outline: "none" }} />
            <button onClick={() => { setSearching(false); setQ(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={22} /></button>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 24, fontWeight: 800, flex: 1, fontFamily: "var(--font-heading)" }}>{t("training_videos")}</h1>
            {canSubmit && (
              <button onClick={() => setShowSubmitModal(true)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, border: "none", background: "var(--red)", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
                <Plus size={16} /> {t("coach_video_submit_cta")}
              </button>
            )}
            <button onClick={() => setSearching(true)} style={{ width: 40, height: 40, borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-secondary)" }}>
              <Search size={18} />
            </button>
          </>
        )}
      </div>

      {canSubmit && (
        <section style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: "18px 18px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>{t("coach_video_my_submissions")}</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("coach_video_submissions_hint")}</p>
            </div>
            <button onClick={() => setShowSubmitModal(true)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: 12, background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)", cursor: "pointer", fontWeight: 700 }}>
              <Upload size={15} /> {t("coach_video_submit_cta")}
            </button>
          </div>

          {myVideos.length === 0 ? (
            <div style={{ padding: "14px 0 4px", color: "var(--text-muted)", fontSize: 13 }}>{t("coach_video_no_submissions")}</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {myVideos.slice(0, 6).map((video) => {
                const status = getStatusMeta(video.approval_status);
                return (
                  <div key={video.id} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
                    <div style={{ height: 118, background: video.thumbnail ? `url(${video.thumbnail}) center/cover` : `${CAT_COLORS[video.category] || "#FFD600"}20`, position: "relative" }}>
                      <div style={{ position: "absolute", top: 10, insetInlineStart: 10, padding: "4px 9px", borderRadius: 999, background: status.bg, color: status.color, border: `1px solid ${status.border}`, fontSize: 11, fontWeight: 700 }}>
                        {status.label}
                      </div>
                    </div>
                    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 8 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.35 }}>{video.title}</p>
                        <span style={{ fontSize: 10, padding: "3px 7px", borderRadius: 999, background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{video.category}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                        <Clock size={11} /> {video.duration || "--"}
                      </div>
                      {video.approval_status === "rejected" && video.rejection_reason && (
                        <div style={{ fontSize: 11, color: "var(--red)", lineHeight: 1.45 }}>
                          {t("coach_video_rejection_reason")}: {video.rejection_reason}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

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

      {showSubmitModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 220, background: "rgba(0,0,0,0.78)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
          <div style={{ width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 24, padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <div>
                <p style={{ fontSize: 17, fontWeight: 800 }}>{t("coach_video_submit_cta")}</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{t("coach_video_submit_desc")}</p>
              </div>
              <button onClick={closeModal} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={20} /></button>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {(["upload", "youtube"] as const).map((type) => (
                <button key={type} onClick={() => setSourceType(type)} style={{ flex: 1, padding: "10px 12px", borderRadius: 14, border: `1px solid ${sourceType === type ? "var(--red)" : "var(--border)"}`, background: sourceType === type ? "var(--red)" : "var(--bg-surface)", color: sourceType === type ? "#fff" : "var(--text-primary)", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  {type === "upload" ? <Upload size={15} /> : <Link2 size={15} />} {type === "upload" ? t("coach_video_source_upload") : t("coach_video_source_youtube")}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>{lang === "ar" ? "عنوان الفيديو" : "Video Title"}</label>
                <input className="input-base" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder={lang === "ar" ? "مثال: تمرين جسم كامل عالي الشدة" : "e.g. Full Body HIIT Blast"} />
              </div>

              {sourceType === "youtube" ? (
                <div>
                  <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>{t("cms_youtube")}</label>
                  <input className="input-base" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder={t("youtube_url_placeholder")} />
                </div>
              ) : (
                <>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>{t("coach_video_file_label")}</label>
                    <div onClick={() => document.getElementById("coach-video-file-input")?.click()} style={{ padding: "16px 14px", borderRadius: 16, border: "1px dashed var(--border)", background: "var(--bg-surface)", cursor: "pointer", textAlign: "center", fontSize: 13, color: videoFile ? "var(--accent)" : "var(--text-muted)", fontWeight: videoFile ? 700 : 500 }}>
                      {videoFile ? `${videoFile.name} (${(videoFile.size / 1024 / 1024).toFixed(1)} MB)` : t("coach_video_file_pick")}
                    </div>
                    <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>MP4 or MOV — max 500 MB</p>
                    <input id="coach-video-file-input" type="file" accept="video/*" style={{ display: "none" }} onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>{t("coach_video_thumbnail_label")}</label>
                    <div onClick={() => document.getElementById("coach-video-thumb-input")?.click()} style={{ padding: "12px 14px", borderRadius: 16, border: "1px dashed var(--border)", background: "var(--bg-surface)", cursor: "pointer", textAlign: "center", fontSize: 13, color: thumbnailFile ? "var(--accent)" : "var(--text-muted)", fontWeight: thumbnailFile ? 700 : 500 }}>
                      {thumbnailFile ? thumbnailFile.name : t("coach_video_thumbnail_pick")}
                    </div>
                    <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>JPG or PNG — recommended 1280×720px (16:9)</p>
                    <input id="coach-video-thumb-input" type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)} />
                  </div>
                </>
              )}

              <div>
                <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>{t("description")}</label>
                <textarea className="input-base" rows={3} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} style={{ resize: "none" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>{lang === "ar" ? "المدة" : "Duration"}</label>
                  <input className="input-base" value={form.duration} onChange={(e) => setForm((prev) => ({ ...prev, duration: e.target.value }))} placeholder="45:00" />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>{lang === "ar" ? "الفئة" : "Category"}</label>
                  <select className="input-base" value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}>
                    {["HIIT", "Strength", "Yoga", "Cardio", "Mobility", "General"].map((item) => <option key={item}>{item}</option>)}
                  </select>
                </div>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}>
                <input type="checkbox" checked={form.is_short} onChange={(e) => setForm((prev) => ({ ...prev, is_short: e.target.checked }))} style={{ width: 16, height: 16, accentColor: "var(--accent)" }} />
                {t("coach_video_short_label")}
              </label>

              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 12px", borderRadius: 14, background: "rgba(255,179,64,0.1)", border: "1px solid rgba(255,179,64,0.25)", color: "var(--amber)", fontSize: 12, lineHeight: 1.45 }}>
                <AlertCircle size={15} /> {t("coach_video_approval_note")}
              </div>

              <button onClick={submitVideo} disabled={submitting} style={{ padding: "13px 14px", borderRadius: 14, border: "none", background: submitting ? "var(--bg-surface)" : "var(--red)", color: submitting ? "var(--text-muted)" : "#fff", fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer" }}>
                {submitting ? t("cert_submitting") : t("submit")}
              </button>
            </div>
          </div>
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
