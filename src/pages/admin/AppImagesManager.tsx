import { useState, useEffect, useCallback, useRef } from "react";
import { Image as ImageIcon, Upload, Trash2, RefreshCw, Plus, CheckCircle, AlertTriangle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useAppImages } from "@/context/AppImagesContext";
import { getApiBase } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

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
  onboarding: { label: "Onboarding", color: "var(--primary)", desc: "Full-screen background images shown behind each onboarding step" },
  custom:     { label: "Custom Slots", color: "var(--secondary)", desc: "Additional slots created by admins" },
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
    <div className="space-y-6" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
            <ImageIcon size={20} strokeWidth={2} />
          </span>
          <div>
            <h1 className="text-[26px] leading-tight font-bold tracking-tight">{l("App Images", "صور التطبيق")}</h1>
            <p className="text-[13px] text-muted-foreground">
              {l("Upload images used inside the app — onboarding, feature mockups, branding marks.", "ارفع الصور المستخدمة داخل التطبيق — شاشات التهيئة والميزات والعلامة التجارية.")}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw size={16} strokeWidth={2} /> {l("Refresh", "تحديث")}
        </Button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed end-5 top-5 z-[9999] flex items-center gap-2 rounded-md bg-card px-4 py-3 text-[13px] font-semibold text-foreground shadow-soft-lg ring-1 ring-inset ${toast.kind === "ok" ? "ring-[color-mix(in_srgb,var(--green)_40%,transparent)]" : "ring-destructive/40"}`}
        >
          {toast.kind === "ok"
            ? <CheckCircle size={16} strokeWidth={2} className="text-[var(--green)]" />
            : <AlertTriangle size={16} strokeWidth={2} className="text-destructive" />}
          {toast.text}
        </div>
      )}

      {/* Categories */}
      {Object.entries(categorised).map(([catKey, slots]) => {
        const meta = CATEGORY_META[catKey] || CATEGORY_META.custom;
        return (
          <Card key={catKey} className="gap-0 overflow-hidden p-0">
            <div className="flex items-center gap-3 bg-muted px-5 py-3.5">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: meta.color }} />
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-foreground">{meta.label}</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{meta.desc}</p>
              </div>
            </div>
            <div className="grid gap-3.5 p-4 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
              {slots.map(slot => {
                const existing = bySlug.get(slot.slug);
                const busy = uploadingSlug === slot.slug;
                return (
                  <div key={slot.slug} className="flex flex-col overflow-hidden rounded-md bg-muted shadow-soft-xs">
                    <div className="relative grid aspect-[9/16] place-items-center bg-card">
                      {existing?.url ? (
                        <img src={existing.url} alt={existing.alt || slot.label} className="size-full object-contain" />
                      ) : (
                        <div className="px-3 py-3 text-center text-[12px] text-muted-foreground">
                          <ImageIcon size={32} strokeWidth={2} className="mx-auto opacity-35" />
                          <div className="mt-2">{l("No image", "بدون صورة")}</div>
                        </div>
                      )}
                      {busy && (
                        <div className="absolute inset-0 grid place-items-center bg-black/50 text-[13px] text-white">
                          {l("Uploading…", "جارٍ الرفع…")}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[13px] font-semibold text-foreground">{slot.label}</div>
                        {existing && <Badge variant="success">{l("Set", "موجودة")}</Badge>}
                      </div>
                      <code className="text-[11px] text-muted-foreground">{slot.slug}</code>
                      {slot.hint && <div className="text-[11px] text-muted-foreground">{slot.hint}</div>}
                      <div className="mt-1.5 flex gap-1.5">
                        <input
                          ref={el => { fileRefs.current[slot.slug] = el; }}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => {
                            const f = e.target.files?.[0];
                            if (f) upload(slot.slug, f, slot.category);
                            e.target.value = "";
                          }}
                        />
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => fileRefs.current[slot.slug]?.click()}
                          disabled={busy}
                        >
                          <Upload size={14} strokeWidth={2} /> {existing ? l("Replace", "استبدال") : l("Upload", "رفع")}
                        </Button>
                        {existing && (
                          <Button
                            variant="outline"
                            size="icon-sm"
                            onClick={() => remove(slot.slug)}
                            disabled={busy}
                            aria-label={l(`Delete ${slot.label}`, `حذف ${slot.label}`)}
                            className="text-destructive ring-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 size={14} strokeWidth={2} />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}

      {/* Custom slug upload */}
      <Card className="gap-0 p-5">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
          <Plus size={16} strokeWidth={2} /> {l("Add Custom Slot", "إضافة فتحة مخصصة")}
        </div>
        <p className="mt-1.5 mb-3 text-[12px] text-muted-foreground">
          {l("Enter a slug (lowercase letters, digits, underscores) then pick an image. Use these slugs in code via <AppImage slug=\"...\"/>.", "أدخل معرفًا (أحرف صغيرة وأرقام وشرطة سفلية) ثم اختر صورة. استخدم المعرف في الكود عبر <AppImage slug=\"...\"/>.")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Label htmlFor="custom-slug" className="sr-only">{l("Custom slot slug", "معرف الفتحة المخصصة")}</Label>
          <Input
            id="custom-slug"
            value={customSlug}
            onChange={e => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            placeholder="e.g. home_hero_badge"
            maxLength={64}
            className="min-w-[200px] flex-1 font-mono text-[13px]"
          />
          <Button asChild disabled={!customSlug}>
            <label className={customSlug ? "cursor-pointer" : "cursor-not-allowed"}>
              <Upload size={14} strokeWidth={2} />
              {l("Choose image", "اختر صورة")}
              <input
                type="file"
                accept="image/*"
                disabled={!customSlug}
                hidden
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
          </Button>
        </div>
      </Card>

      {loading && (
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[9/16] w-full rounded-md" />
          ))}
        </div>
      )}
    </div>
  );
}
