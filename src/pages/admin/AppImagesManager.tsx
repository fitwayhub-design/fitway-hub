import { useState, useEffect, useCallback, useRef } from "react";
import { Image as ImageIcon, Upload, Trash2, RefreshCw, Plus, CheckCircle, AlertTriangle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useAppImages } from "@/context/AppImagesContext";
import { getApiBase } from "@/lib/api";

const API = getApiBase();

type Slot = { slug: string; label: string; hint?: string; category: string };

const PRESET_SLOTS: Slot[] = [
  // Onboarding (full-screen backgrounds for each step)
  { slug: "onboarding_step_1", label: "Onboarding — Step 1", hint: "Full background for step 1", category: "onboarding" },
  { slug: "onboarding_step_2", label: "Onboarding — Step 2", hint: "Full background for step 2", category: "onboarding" },
  { slug: "onboarding_step_3", label: "Onboarding — Step 3", hint: "Full background for step 3", category: "onboarding" },
  { slug: "onboarding_step_4", label: "Onboarding — Step 4", hint: "Full background for step 4", category: "onboarding" },
];

const CATEGORY_META: Record<string, { label: string; color: string; desc: string }> = {
  onboarding: { label: "Onboarding", color: "#FFD600", desc: "Full-screen background images shown behind each onboarding step" },
  custom:     { label: "Custom Slots", color: "#8b5cf6", desc: "Additional slots created by admins" },
};

export default function AppImagesManager() {
  const { token } = useAuth();
  const { lang } = useI18n();
  const l = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const { refresh: refreshCtx } = useAppImages();

  const [rows, setRows] = useState<Array<{ slug: string; url: string; alt: string | null; category: string | null; updated_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [uploadingSlug, setUploadingSlug] = useState<string | null>(null);
  const [customSlug, setCustomSlug] = useState("");
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const notify = (kind: "ok" | "err", text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/api/app-images/admin/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setRows(data.images || []);
    } catch {
      notify("err", l("Failed to load images", "فشل تحميل الصور"));
    } finally {
      setLoading(false);
    }
  }, [token, lang]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const upload = async (slug: string, file: File, category: string) => {
    if (!/^[a-z0-9_]{1,64}$/.test(slug)) {
      notify("err", l("Invalid slug (lowercase, digits, underscore only)", "معرف غير صالح"));
      return;
    }
    setUploadingSlug(slug);
    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("category", category);
      const res = await fetch(`${API}/api/app-images/admin/${slug}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
      await refreshCtx();
      notify("ok", l("Image uploaded", "تم رفع الصورة"));
    } catch {
      notify("err", l("Upload failed", "فشل الرفع"));
    } finally {
      setUploadingSlug(null);
    }
  };

  const remove = async (slug: string) => {
    if (!confirm(l(`Delete image "${slug}"?`, `حذف الصورة "${slug}"؟`))) return;
    try {
      const res = await fetch(`${API}/api/app-images/admin/${slug}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      await load();
      await refreshCtx();
      notify("ok", l("Deleted", "تم الحذف"));
    } catch {
      notify("err", l("Delete failed", "فشل الحذف"));
    }
  };

  type Row = (typeof rows)[number];
  const bySlug = new Map<string, Row>(rows.map(r => [r.slug, r]));
  const presetSlugs = new Set(PRESET_SLOTS.map(s => s.slug));
  const customRows = rows.filter(r => !presetSlugs.has(r.slug));

  const categorised: Record<string, Slot[]> = {};
  for (const slot of PRESET_SLOTS) {
    (categorised[slot.category] ||= []).push(slot);
  }
  if (customRows.length) {
    categorised.custom = customRows.map(r => ({ slug: r.slug, label: r.slug, category: "custom" }));
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto", direction: lang === "ar" ? "rtl" : "ltr" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, display: "flex", alignItems: "center", gap: 10, color: "var(--text-primary)" }}>
            <ImageIcon size={22} color="var(--accent)" />
            {l("App Images", "صور التطبيق")}
          </h1>
          <p style={{ margin: "6px 0 0", color: "var(--text-secondary)", fontSize: 13 }}>
            {l("Upload images used inside the app — onboarding, feature mockups, branding marks.", "ارفع الصور المستخدمة داخل التطبيق — شاشات التهيئة والميزات والعلامة التجارية.")}
          </p>
        </div>
        <button
          onClick={load}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", borderRadius: 10, cursor: "pointer" }}
        >
          <RefreshCw size={16} /> {l("Refresh", "تحديث")}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, padding: "10px 14px", borderRadius: 10, background: toast.kind === "ok" ? "#10b981" : "#ef4444", color: "#fff", display: "flex", alignItems: "center", gap: 8, zIndex: 9999 }}>
          {toast.kind === "ok" ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          {toast.text}
        </div>
      )}

      {/* Categories */}
      {Object.entries(categorised).map(([catKey, slots]) => {
        const meta = CATEGORY_META[catKey] || CATEGORY_META.custom;
        return (
          <section key={catKey} style={{ marginBottom: 28, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
            <header style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: meta.color }} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{meta.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{meta.desc}</div>
              </div>
            </header>
            <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
              {slots.map(slot => {
                const existing = bySlug.get(slot.slug);
                const busy = uploadingSlug === slot.slug;
                return (
                  <div key={slot.slug} style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "var(--bg-primary)", display: "flex", flexDirection: "column" }}>
                    <div style={{ aspectRatio: "9/16", background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                      {existing?.url ? (
                        <img src={existing.url} alt={slot.slug} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      ) : (
                        <div style={{ color: "var(--text-secondary)", fontSize: 12, textAlign: "center", padding: 12 }}>
                          <ImageIcon size={32} opacity={0.35} />
                          <div style={{ marginTop: 8 }}>{l("No image", "بدون صورة")}</div>
                        </div>
                      )}
                      {busy && (
                        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13 }}>
                          {l("Uploading…", "جارٍ الرفع…")}
                        </div>
                      )}
                    </div>
                    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{slot.label}</div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "monospace" }}>{slot.slug}</div>
                      {slot.hint && <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{slot.hint}</div>}
                      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                        <input
                          ref={el => { fileRefs.current[slot.slug] = el; }}
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          onChange={e => {
                            const f = e.target.files?.[0];
                            if (f) upload(slot.slug, f, slot.category);
                            e.target.value = "";
                          }}
                        />
                        <button
                          onClick={() => fileRefs.current[slot.slug]?.click()}
                          disabled={busy}
                          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px", border: "none", background: "var(--accent)", color: "#000", borderRadius: 8, cursor: busy ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600 }}
                        >
                          <Upload size={14} /> {existing ? l("Replace", "استبدال") : l("Upload", "رفع")}
                        </button>
                        {existing && (
                          <button
                            onClick={() => remove(slot.slug)}
                            disabled={busy}
                            style={{ padding: "8px 10px", border: "1px solid var(--border)", background: "transparent", color: "#ef4444", borderRadius: 8, cursor: "pointer" }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Custom slug upload */}
      <section style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
          <Plus size={16} /> {l("Add Custom Slot", "إضافة فتحة مخصصة")}
        </div>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "6px 0 12px" }}>
          {l("Enter a slug (lowercase letters, digits, underscores) then pick an image. Use these slugs in code via <AppImage slug=\"...\"/>.", "أدخل معرفًا (أحرف صغيرة وأرقام وشرطة سفلية) ثم اختر صورة. استخدم المعرف في الكود عبر <AppImage slug=\"...\"/>.")}
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={customSlug}
            onChange={e => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            placeholder="e.g. home_hero_badge"
            maxLength={64}
            style={{ flex: 1, minWidth: 200, padding: "8px 12px", border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", borderRadius: 8, fontFamily: "monospace", fontSize: 13 }}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: customSlug ? "var(--accent)" : "var(--bg-primary)", color: customSlug ? "#000" : "var(--text-secondary)", borderRadius: 8, cursor: customSlug ? "pointer" : "not-allowed", fontWeight: 600, fontSize: 13 }}>
            <Upload size={14} />
            {l("Choose image", "اختر صورة")}
            <input
              type="file"
              accept="image/*"
              disabled={!customSlug}
              style={{ display: "none" }}
              onChange={e => {
                const f = e.target.files?.[0];
                if (f && customSlug) {
                  upload(customSlug, f, "custom");
                  setCustomSlug("");
                }
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </section>

      {loading && <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>{l("Loading…", "جارٍ التحميل…")}</div>}
    </div>
  );
}
