import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dumbbell, Plus, Trash2, RefreshCw, Upload, CheckCircle, AlertTriangle,
  Video as VideoIcon, Youtube, Link2, X, Edit3,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { getApiBase } from "@/lib/api";

const API = getApiBase();

type Training = {
  id: number;
  title: string;
  description: string | null;
  cover_image: string | null;
  sort_order: number;
  short_count: number;
  long_count: number;
  created_at: string;
};

type Video = {
  id: number;
  title: string;
  description: string | null;
  url: string;
  thumbnail: string | null;
  duration: string | null;
  is_short: number;
  source_type: string | null;
  youtube_url: string | null;
  training_id: number | null;
};

type AddVideoState = {
  trainingId: number;
  isShort: boolean;
  source: "upload" | "youtube";
  title: string;
  description: string;
  duration: string;
  youtubeUrl: string;
  videoFile: File | null;
  thumbFile: File | null;
};

const emptyTrainingForm = { title: "", description: "" };

export default function AdminTrainings() {
  const { token } = useAuth();
  const { lang } = useI18n();
  const l = (en: string, ar: string) => (lang === "ar" ? ar : en);

  const [trainings, setTrainings] = useState<Training[]>([]);
  const [videosByTraining, setVideosByTraining] = useState<Record<number, Video[]>>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [newTrainingOpen, setNewTrainingOpen] = useState(false);
  const [newTraining, setNewTraining] = useState(emptyTrainingForm);
  const [editing, setEditing] = useState<Training | null>(null);
  const [addVideo, setAddVideo] = useState<AddVideoState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const videoFileRef = useRef<HTMLInputElement | null>(null);
  const thumbFileRef = useRef<HTMLInputElement | null>(null);

  const notify = (kind: "ok" | "err", text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3000);
  };

  const authFetch = (path: string, init?: RequestInit) =>
    fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
    });

  const loadTrainings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authFetch("/api/admin/trainings");
      const data = await res.json();
      const list: Training[] = data.trainings || [];
      setTrainings(list);
      const videoPairs = await Promise.all(
        list.map(async (t) => {
          const r = await authFetch(`/api/admin/trainings/${t.id}/videos`);
          const d = await r.json().catch(() => ({}));
          return [t.id, (d.videos || []) as Video[]] as const;
        })
      );
      setVideosByTraining(Object.fromEntries(videoPairs));
    } catch {
      notify("err", l("Failed to load trainings", "فشل تحميل التدريبات"));
    } finally {
      setLoading(false);
    }
  }, [token]); // eslint-disable-line

  useEffect(() => { loadTrainings(); }, [loadTrainings]);

  const createTraining = async () => {
    const title = newTraining.title.trim();
    if (!title) return;
    try {
      const res = await authFetch("/api/admin/trainings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: newTraining.description }),
      });
      if (!res.ok) throw new Error();
      setNewTrainingOpen(false);
      setNewTraining(emptyTrainingForm);
      notify("ok", l("Training created", "تم إنشاء التدريب"));
      await loadTrainings();
    } catch {
      notify("err", l("Failed to create training", "فشل إنشاء التدريب"));
    }
  };

  const saveTraining = async () => {
    if (!editing) return;
    try {
      const res = await authFetch(`/api/admin/trainings/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editing.title, description: editing.description }),
      });
      if (!res.ok) throw new Error();
      setEditing(null);
      notify("ok", l("Training updated", "تم تحديث التدريب"));
      await loadTrainings();
    } catch {
      notify("err", l("Failed to update", "فشل التحديث"));
    }
  };

  const deleteTraining = async (id: number, title: string) => {
    if (!confirm(l(`Delete training "${title}"? Its videos will be unlinked but not removed.`, `حذف التدريب "${title}"؟ سيتم فك ربط فيديوهاته دون حذفها.`))) return;
    try {
      const res = await authFetch(`/api/admin/trainings/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      notify("ok", l("Deleted", "تم الحذف"));
      await loadTrainings();
    } catch {
      notify("err", l("Delete failed", "فشل الحذف"));
    }
  };

  const deleteVideo = async (videoId: number) => {
    if (!confirm(l("Delete this video?", "حذف هذا الفيديو؟"))) return;
    try {
      const res = await authFetch(`/api/admin/videos/${videoId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      notify("ok", l("Video deleted", "تم حذف الفيديو"));
      await loadTrainings();
    } catch {
      notify("err", l("Delete failed", "فشل الحذف"));
    }
  };

  const submitVideo = async () => {
    if (!addVideo) return;
    if (!addVideo.title.trim()) {
      notify("err", l("Title is required", "العنوان مطلوب"));
      return;
    }
    if (addVideo.source === "upload" && !addVideo.videoFile) {
      notify("err", l("Pick a video file", "اختر ملف فيديو"));
      return;
    }
    if (addVideo.source === "youtube" && !addVideo.youtubeUrl.trim()) {
      notify("err", l("YouTube URL required", "رابط يوتيوب مطلوب"));
      return;
    }
    setSubmitting(true);
    try {
      if (addVideo.source === "youtube") {
        const res = await authFetch(`/api/admin/trainings/${addVideo.trainingId}/videos/youtube`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: addVideo.title,
            description: addVideo.description,
            duration: addVideo.duration,
            is_short: addVideo.isShort ? "1" : "0",
            youtube_url: addVideo.youtubeUrl,
          }),
        });
        if (!res.ok) throw new Error();
      } else {
        const fd = new FormData();
        fd.append("title", addVideo.title);
        fd.append("description", addVideo.description);
        fd.append("duration", addVideo.duration);
        fd.append("is_short", addVideo.isShort ? "1" : "0");
        fd.append("video", addVideo.videoFile!);
        if (addVideo.thumbFile) fd.append("thumbnail", addVideo.thumbFile);
        const res = await authFetch(`/api/admin/trainings/${addVideo.trainingId}/videos`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) throw new Error();
      }
      setAddVideo(null);
      notify("ok", l("Video added", "تمت إضافة الفيديو"));
      await loadTrainings();
    } catch {
      notify("err", l("Failed to add video", "فشل إضافة الفيديو"));
    } finally {
      setSubmitting(false);
    }
  };

  const openAddVideo = (trainingId: number, isShort: boolean) => {
    setAddVideo({
      trainingId, isShort, source: "upload",
      title: "", description: "", duration: "", youtubeUrl: "",
      videoFile: null, thumbFile: null,
    });
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto", direction: lang === "ar" ? "rtl" : "ltr" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, display: "flex", alignItems: "center", gap: 10, color: "var(--text-primary)" }}>
            <Dumbbell size={22} color="var(--accent)" />
            {l("Trainings", "التدريبات")}
          </h1>
          <p style={{ margin: "6px 0 0", color: "var(--text-secondary)", fontSize: 13 }}>
            {l("Group workout videos into trainings. Each training holds short and long videos.", "اجمع فيديوهات التمارين في تدريبات. لكل تدريب فيديوهات قصيرة وطويلة.")}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={loadTrainings}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", borderRadius: 10, cursor: "pointer" }}
          >
            <RefreshCw size={16} /> {l("Refresh", "تحديث")}
          </button>
          <button
            onClick={() => setNewTrainingOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", border: "none", background: "var(--accent)", color: "#000", borderRadius: 10, cursor: "pointer", fontWeight: 700 }}
          >
            <Plus size={16} /> {l("New Training", "تدريب جديد")}
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, padding: "10px 14px", borderRadius: 10, background: toast.kind === "ok" ? "#10b981" : "#ef4444", color: "#fff", display: "flex", alignItems: "center", gap: 8, zIndex: 9999 }}>
          {toast.kind === "ok" ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          {toast.text}
        </div>
      )}

      {/* Trainings list */}
      {!loading && trainings.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)", background: "var(--bg-card)", border: "1px dashed var(--border)", borderRadius: 14 }}>
          {l("No trainings yet. Create your first training to start adding videos.", "لا توجد تدريبات بعد. أنشئ أول تدريب لتبدأ بإضافة الفيديوهات.")}
        </div>
      )}

      {trainings.map((t) => {
        const vids = videosByTraining[t.id] || [];
        const shorts = vids.filter(v => v.is_short);
        const longs = vids.filter(v => !v.is_short);
        return (
          <section key={t.id} style={{ marginBottom: 28, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
            <header style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--accent)" }} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{t.title}</div>
                {t.description && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{t.description}</div>}
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  {t.long_count} {l("long", "طويل")} · {t.short_count} {l("shorts", "قصير")}
                </div>
              </div>
              <button
                onClick={() => setEditing(t)}
                title={l("Edit training", "تعديل التدريب")}
                style={{ padding: "6px 10px", border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
              >
                <Edit3 size={13} /> {l("Edit", "تعديل")}
              </button>
              <button
                onClick={() => deleteTraining(t.id, t.title)}
                style={{ padding: "6px 10px", border: "1px solid var(--border)", background: "transparent", color: "#ef4444", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
              >
                <Trash2 size={13} />
              </button>
            </header>

            {/* Long videos */}
            <VideoSubsection
              label={l("Long videos", "فيديوهات طويلة")}
              videos={longs}
              onAdd={() => openAddVideo(t.id, false)}
              onDelete={deleteVideo}
              l={l}
            />
            {/* Short videos */}
            <VideoSubsection
              label={l("Short videos", "فيديوهات قصيرة")}
              videos={shorts}
              onAdd={() => openAddVideo(t.id, true)}
              onDelete={deleteVideo}
              l={l}
              shortFormat
            />
          </section>
        );
      })}

      {loading && <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>{l("Loading…", "جارٍ التحميل…")}</div>}

      {/* New training modal */}
      {newTrainingOpen && (
        <Modal onClose={() => setNewTrainingOpen(false)} title={l("New Training", "تدريب جديد")}>
          <Field label={l("Title", "العنوان")}>
            <input
              autoFocus
              value={newTraining.title}
              onChange={e => setNewTraining(s => ({ ...s, title: e.target.value }))}
              placeholder={l("e.g. Upper Body Strength", "مثلاً: تقوية الجزء العلوي")}
              style={inputStyle}
            />
          </Field>
          <Field label={l("Description", "الوصف")}>
            <textarea
              rows={3}
              value={newTraining.description}
              onChange={e => setNewTraining(s => ({ ...s, description: e.target.value }))}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </Field>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
            <button onClick={() => setNewTrainingOpen(false)} style={btnGhost}>{l("Cancel", "إلغاء")}</button>
            <button onClick={createTraining} disabled={!newTraining.title.trim()} style={btnPrimary(!newTraining.title.trim())}>
              {l("Create", "إنشاء")}
            </button>
          </div>
        </Modal>
      )}

      {/* Edit training modal */}
      {editing && (
        <Modal onClose={() => setEditing(null)} title={l("Edit Training", "تعديل التدريب")}>
          <Field label={l("Title", "العنوان")}>
            <input
              value={editing.title}
              onChange={e => setEditing(s => s ? { ...s, title: e.target.value } : s)}
              style={inputStyle}
            />
          </Field>
          <Field label={l("Description", "الوصف")}>
            <textarea
              rows={3}
              value={editing.description || ""}
              onChange={e => setEditing(s => s ? { ...s, description: e.target.value } : s)}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </Field>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
            <button onClick={() => setEditing(null)} style={btnGhost}>{l("Cancel", "إلغاء")}</button>
            <button onClick={saveTraining} style={btnPrimary(false)}>{l("Save", "حفظ")}</button>
          </div>
        </Modal>
      )}

      {/* Add video modal */}
      {addVideo && (
        <Modal onClose={() => setAddVideo(null)} title={addVideo.isShort ? l("Add Short Video", "إضافة فيديو قصير") : l("Add Long Video", "إضافة فيديو طويل")}>
          {/* Source switch */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14, padding: 4, background: "var(--bg-primary)", borderRadius: 10, border: "1px solid var(--border)" }}>
            {(["upload", "youtube"] as const).map(s => (
              <button
                key={s}
                onClick={() => setAddVideo(v => v ? { ...v, source: s } : v)}
                style={{
                  flex: 1, padding: "8px 10px", border: "none", borderRadius: 8, cursor: "pointer",
                  background: addVideo.source === s ? "var(--accent)" : "transparent",
                  color: addVideo.source === s ? "#000" : "var(--text-secondary)",
                  fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                {s === "upload" ? <><Upload size={14} /> {l("Upload file", "رفع ملف")}</> : <><Youtube size={14} /> YouTube</>}
              </button>
            ))}
          </div>

          <Field label={l("Title", "العنوان")}>
            <input
              autoFocus
              value={addVideo.title}
              onChange={e => setAddVideo(v => v ? { ...v, title: e.target.value } : v)}
              style={inputStyle}
            />
          </Field>

          {addVideo.source === "upload" ? (
            <>
              <Field label={l("Video file", "ملف الفيديو")}>
                <input
                  ref={videoFileRef}
                  type="file"
                  accept="video/*"
                  onChange={e => setAddVideo(v => v ? { ...v, videoFile: e.target.files?.[0] || null } : v)}
                  style={{ display: "none" }}
                />
                <button
                  onClick={() => videoFileRef.current?.click()}
                  style={{ ...btnGhost, width: "100%", justifyContent: "flex-start", display: "flex", alignItems: "center", gap: 8 }}
                >
                  <VideoIcon size={14} />
                  {addVideo.videoFile ? `${addVideo.videoFile.name} (${(addVideo.videoFile.size / 1024 / 1024).toFixed(1)} MB)` : l("Choose video", "اختر فيديو")}
                </button>
              </Field>
              <Field label={l("Thumbnail (optional)", "صورة مصغرة (اختياري)")}>
                <input
                  ref={thumbFileRef}
                  type="file"
                  accept="image/*"
                  onChange={e => setAddVideo(v => v ? { ...v, thumbFile: e.target.files?.[0] || null } : v)}
                  style={{ display: "none" }}
                />
                <button
                  onClick={() => thumbFileRef.current?.click()}
                  style={{ ...btnGhost, width: "100%", justifyContent: "flex-start", display: "flex", alignItems: "center", gap: 8 }}
                >
                  <Upload size={14} />
                  {addVideo.thumbFile ? addVideo.thumbFile.name : l("Choose thumbnail", "اختر صورة مصغرة")}
                </button>
              </Field>
            </>
          ) : (
            <Field label={l("YouTube URL", "رابط يوتيوب")}>
              <input
                value={addVideo.youtubeUrl}
                onChange={e => setAddVideo(v => v ? { ...v, youtubeUrl: e.target.value } : v)}
                placeholder="https://youtube.com/watch?v=..."
                style={inputStyle}
              />
            </Field>
          )}

          <Field label={l("Duration (e.g. 12:30)", "المدة (مثلاً 12:30)")}>
            <input
              value={addVideo.duration}
              onChange={e => setAddVideo(v => v ? { ...v, duration: e.target.value } : v)}
              placeholder="12:30"
              style={inputStyle}
            />
          </Field>

          <Field label={l("Description", "الوصف")}>
            <textarea
              rows={3}
              value={addVideo.description}
              onChange={e => setAddVideo(v => v ? { ...v, description: e.target.value } : v)}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </Field>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
            <button onClick={() => setAddVideo(null)} style={btnGhost}>{l("Cancel", "إلغاء")}</button>
            <button onClick={submitVideo} disabled={submitting} style={btnPrimary(submitting)}>
              {submitting ? l("Saving…", "جارٍ الحفظ…") : l("Add Video", "إضافة الفيديو")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function VideoSubsection({
  label, videos, onAdd, onDelete, l, shortFormat,
}: {
  label: string;
  videos: Video[];
  onAdd: () => void;
  onDelete: (id: number) => void;
  l: (en: string, ar: string) => string;
  shortFormat?: boolean;
}) {
  return (
    <div style={{ padding: 16, borderTop: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label} <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>· {videos.length}</span>
        </div>
        <button
          onClick={onAdd}
          style={{ padding: "6px 12px", border: "1px dashed var(--border)", background: "transparent", color: "var(--text-secondary)", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
        >
          <Plus size={13} /> {l("Add video", "إضافة فيديو")}
        </button>
      </div>
      {videos.length === 0 ? (
        <div style={{ padding: "14px 0", color: "var(--text-muted)", fontSize: 12 }}>
          {l("No videos yet.", "لا توجد فيديوهات بعد.")}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${shortFormat ? 160 : 220}px, 1fr))`, gap: 12 }}>
          {videos.map(v => (
            <div key={v.id} style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "var(--bg-primary)", display: "flex", flexDirection: "column" }}>
              <div style={{ aspectRatio: shortFormat ? "9/16" : "16/9", background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                {v.thumbnail ? (
                  <img src={v.thumbnail} alt={v.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <VideoIcon size={28} opacity={0.4} />
                )}
                {v.source_type === "youtube" && (
                  <div style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.7)", color: "#fff", padding: "2px 6px", borderRadius: 6, fontSize: 10, display: "flex", alignItems: "center", gap: 4 }}>
                    <Link2 size={10} /> YouTube
                  </div>
                )}
              </div>
              <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{v.title}</div>
                {v.duration && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{v.duration}</div>}
                <button
                  onClick={() => onDelete(v.id)}
                  style={{ marginTop: 4, padding: "5px 8px", border: "1px solid var(--border)", background: "transparent", color: "#ef4444", borderRadius: 6, cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                >
                  <Trash2 size={11} /> {l("Delete", "حذف")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Modal({ children, title, onClose }: { children: React.ReactNode; title: string; onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 9998 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 17, color: "var(--text-primary)" }}>{title}</h2>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", border: "1px solid var(--border)",
  background: "var(--bg-primary)", color: "var(--text-primary)", borderRadius: 8, fontSize: 13, outline: "none",
};

const btnGhost: React.CSSProperties = {
  padding: "8px 14px", border: "1px solid var(--border)", background: "var(--bg-primary)",
  color: "var(--text-primary)", borderRadius: 8, cursor: "pointer", fontSize: 13,
};

const btnPrimary = (disabled: boolean): React.CSSProperties => ({
  padding: "8px 14px", border: "none", background: disabled ? "var(--bg-primary)" : "var(--accent)",
  color: disabled ? "var(--text-muted)" : "#000", borderRadius: 8,
  cursor: disabled ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 13,
});
