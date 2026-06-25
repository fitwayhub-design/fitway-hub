import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import {
  Settings, Save, RefreshCw, CheckCircle, XCircle,
  Lock, CreditCard, Star, LayoutDashboard,
  Upload, Eye, EyeOff, ToggleLeft, Database, Sun, Moon,
  Plus, Trash2, Smartphone, Bot, Apple, Wallet, Coins,
  Download, Users, Globe, ShieldCheck, Search,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useTheme } from "@/context/ThemeContext";
import { apiFetch, getApiBase } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const API = getApiBase();

/* --- Types ---------------------------------------------------------------- */

interface AppSetting {
  id: number;
  setting_key: string;
  setting_value: string | null;
  setting_type: string;
  category: string;
  label: string | null;
}

type Category = "dashboard" | "access" | "features" | "pricing" | "points" | "payments" | "promo" | "moderators" | "system";

const CATEGORIES: { key: Category; label: string; icon: typeof LayoutDashboard; desc: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, desc: "Hero, sections, visibility" },
  { key: "access",    label: "Access",    icon: Lock,            desc: "Free limits, uploads" },
  { key: "features",  label: "Features",  icon: ToggleLeft,      desc: "Toggle app features on/off" },
  { key: "pricing",   label: "Pricing",   icon: CreditCard,      desc: "Fees & packages" },
  { key: "points",    label: "Points",    icon: Star,            desc: "Rewards & bonus points" },
  { key: "payments",  label: "Payments",  icon: CreditCard,      desc: "Payment gateways & methods" },
  { key: "promo",     label: "Promo codes", icon: Star,          desc: "Discount & gift codes" },
  { key: "moderators", label: "Moderators", icon: ShieldCheck,   desc: "Assign moderators & access" },
  { key: "system",    label: "System",    icon: Database,        desc: "Backup, server, tools" },
];

// Moderator-controllable areas surfaced in the Moderators tab. Each maps to a
// permission key enforced server-side; DEFAULT-DENY (§17) — a moderator only
// gets an area an admin has explicitly switched on.
const MODERATOR_AREAS: { key: string; label: string; desc: string }[] = [
  { key: "community_view",     label: "View community",      desc: "See community posts, comments and stats" },
  { key: "community_moderate", label: "Moderate community",  desc: "Hide / restore / delete posts, pin posts, post announcements" },
  { key: "challenges_view",    label: "View challenges",     desc: "View community challenges and their entries" },
  { key: "challenges_moderate",label: "Moderate challenges", desc: "Review submissions, resolve reports, approve/reject challenges" },
  { key: "tickets_view",       label: "View support tickets", desc: "See user support tickets and conversations" },
  { key: "tickets_respond",    label: "Answer tickets",      desc: "Reply to and resolve user support tickets" },
  { key: "blogs_moderate",     label: "Moderate blog",       desc: "Review and unpublish blog posts" },
];

/* --- Payment helper components -------------------------------------------- */

function SectionCard({ icon: Icon, title, sub, children }: { icon: typeof Wallet; title: string; sub: string; children: ReactNode }) {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="flex items-center gap-3 bg-muted px-5 py-3.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-card text-primary">
          <Icon size={18} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{sub}</p>
        </div>
      </div>
      <div className="flex flex-col gap-4 p-5">{children}</div>
    </Card>
  );
}

function ModeBlock({ enabled, onToggle, badge, badgeVariant, desc, children }: { enabled: boolean; onToggle: () => void; badge: string; badgeVariant: "success" | "warning" | "secondary" | "accent"; desc: string; children: ReactNode }) {
  return (
    <div className="rounded-md bg-muted p-3.5">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <Badge variant={badgeVariant}>{badge}</Badge>
        <Switch checked={enabled} onCheckedChange={onToggle} aria-label={badge} />
      </div>
      <p className={`text-[13px] leading-relaxed text-muted-foreground ${enabled ? "mb-3" : ""}`}>{desc}</p>
      {enabled && <div className="flex flex-col gap-3">{children}</div>}
    </div>
  );
}

function PayField({ id, label, hint, children }: { id: string; label: string; hint: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-[13px]">{label}</Label>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
      {children}
    </div>
  );
}

/* ========================================================================== */

export default function AdminSettings() {
  const { token, user, updateUser } = useAuth();
  const { lang, setLang } = useI18n();
  const { isDark, toggleTheme } = useTheme();
  const l = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const api = (path: string, opts?: RequestInit & { rawBody?: boolean }) => {
    const hdrs: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (!(opts as any)?.rawBody) hdrs["Content-Type"] = "application/json";
    return apiFetch(path, { ...opts, headers: { ...hdrs, ...(opts?.headers || {}) } });
  };

  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<{ msg: string; ok: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<Category>("dashboard");
  const [editMap, setEditMap] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);

  // System tab state
  const [serverUrl, setServerUrl] = useState(() => localStorage.getItem("fitway_server_url") || "");
  const [serverUrlSaving, setServerUrlSaving] = useState(false);
  const [serverUrlMsg, setServerUrlMsg] = useState("");
  const [serverUrlTesting, setServerUrlTesting] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [genCount, setGenCount] = useState(10);
  const [genLoading, setGenLoading] = useState(false);
  const [genMsg, setGenMsg] = useState("");
  const [removeFakeLoading, setRemoveFakeLoading] = useState(false);
  const [restoringDb, setRestoringDb] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement | null>(null);

  // Payment settings — Paymob/Fawry/PayPal were all removed (May 2026 meeting).
  // Only manual e-wallet (Vodafone / Orange / WE / InstaPay) and the Google
  // Play / Apple App Store IAP plumbing for native subscriptions remain.
  const [paySettings, setPaySettings] = useState<Record<string, string>>({
    ewallet_phone_vodafone: "", ewallet_phone_orange: "", ewallet_phone_we: "", ewallet_phone_instapay: "",
    pm_credit_card: "0", pm_google_pay: "1", pm_apple_pay: "1",
    google_play_enabled: "0", google_play_product_id_monthly: "", google_play_product_id_annual: "",
    apple_pay_enabled: "0", apple_pay_product_id_monthly: "", apple_pay_product_id_annual: "",
    coach_cut_percentage: "85", egp_usd_rate: "",
  });
  const [payLoading, setPayLoading] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);

  // Moderators tab state
  const [modUsers, setModUsers] = useState<Array<{ id: number; name: string; email: string; role: string; avatar?: string }>>([]);
  const [modPerms, setModPerms] = useState<Record<string, boolean>>({});
  const [modSearch, setModSearch] = useState("");
  const [modLoading, setModLoading] = useState(false);
  const [modSaving, setModSaving] = useState(false);

  const loadModerators = useCallback(async () => {
    setModLoading(true);
    try {
      const [uRes, pRes] = await Promise.all([
        fetch(`${API}/api/admin/users`, { headers }),
        fetch(`${API}/api/admin/moderator-permissions`, { headers }),
      ]);
      const uData = await uRes.json().catch(() => ({}));
      const pData = await pRes.json().catch(() => ({}));
      setModUsers((uData.users || []).map((u: any) => ({ id: u.id, name: u.name, email: u.email, role: u.role, avatar: u.avatar })));
      setModPerms(pData.permissions || {});
    } catch {
      // leave empty — render shows a friendly state
    } finally {
      setModLoading(false);
    }
  }, []); // eslint-disable-line

  const setUserRole = async (id: number, role: string) => {
    try {
      const r = await fetch(`${API}/api/admin/users/${id}/role`, { method: "PATCH", headers, body: JSON.stringify({ role }) });
      if (!r.ok) throw new Error();
      setModUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u));
      showFlash(role === "moderator" ? l("Moderator added", "تمت إضافة مشرف") : l("Moderator removed", "تمت إزالة المشرف"));
    } catch {
      showFlash(l("Failed to update role", "فشل تحديث الدور"), false);
    }
  };

  const saveModeratorPerms = async (next: Record<string, boolean>) => {
    setModPerms(next);
    setModSaving(true);
    try {
      const r = await fetch(`${API}/api/admin/moderator-permissions`, { method: "PUT", headers, body: JSON.stringify({ permissions: next }) });
      if (!r.ok) throw new Error();
      showFlash(l("Access updated", "تم تحديث الصلاحيات"));
    } catch {
      showFlash(l("Failed to save access", "فشل حفظ الصلاحيات"), false);
    } finally {
      setModSaving(false);
    }
  };

  const showFlash = (msg: string, ok = true) => {
    setFlash({ msg, ok });
    setTimeout(() => setFlash(null), 3000);
  };

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/app-settings`, { headers });
      const d = await r.json();
      const rows: AppSetting[] = d.settings || [];
      setSettings(rows);
      const map: Record<string, string> = {};
      for (const s of rows) map[s.setting_key] = s.setting_value ?? "";
      setEditMap(map);
    } catch {
      showFlash(l("Failed to load settings", "فشل تحميل الإعدادات"), false);
    }
    setLoading(false);
  }, [token]);

  const fetchPaymentSettings = useCallback(async () => {
    setPayLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/payment-settings`, { headers });
      const d = await r.json();
      const raw = d.settings || {};
      const s: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw)) s[k] = v == null ? "" : String(v);
      setPaySettings(prev => ({ ...prev, ...s }));
    } catch { /* ignore */ }
    setPayLoading(false);
  }, [token]);

  useEffect(() => { fetchSettings(); fetchPaymentSettings(); fetchServerUrl(); }, [fetchSettings, fetchPaymentSettings]);
  useEffect(() => { setAdminName(user?.name || ""); }, [user?.name]);
  useEffect(() => { if (activeTab === "moderators") loadModerators(); }, [activeTab, loadModerators]);

  // --- System functions ---
  const fetchServerUrl = async () => {
    try {
      const res = await api("/api/admin/server-url");
      if (res.ok) { const data = await res.json(); if (data.url) { setServerUrl(data.url); localStorage.setItem("fitway_server_url", data.url); } }
    } catch {}
  };
  const saveServerUrl = async () => {
    setServerUrlSaving(true); setServerUrlMsg("");
    const clean = serverUrl.trim().replace(/\/+$/, "");
    if (clean) localStorage.setItem("fitway_server_url", clean);
    else localStorage.removeItem("fitway_server_url");
    setServerUrl(clean);
    try {
      const res = await Promise.race([
        api("/api/admin/server-url", { method: "PUT", body: JSON.stringify({ url: clean }) }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 4000)),
      ]);
      if (res.ok) setServerUrlMsg("✅ Server URL saved!");
      else setServerUrlMsg("✅ Saved locally. Server sync failed.");
    } catch { setServerUrlMsg("✅ Saved locally. Backend not reachable."); }
    finally { setServerUrlSaving(false); setTimeout(() => setServerUrlMsg(""), 5000); }
  };
  const testServerUrl = async () => {
    setServerUrlTesting(true); setServerUrlMsg("");
    const base = serverUrl.trim().replace(/\/+$/, "") || "";
    try {
      const res = await fetch(`${base}/api/admin/ping`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) { const d = await res.json(); setServerUrlMsg(`✅ Connection OK — responded at ${d.timestamp || "now"}`); }
      else setServerUrlMsg("⚠️ Server reachable but returned an error.");
    } catch { setServerUrlMsg("❌ Cannot reach server at this URL."); }
    finally { setServerUrlTesting(false); setTimeout(() => setServerUrlMsg(""), 6000); }
  };
  const handleDatabaseRestore = async (file?: File) => {
    if (!file || restoringDb) return;
    if (!confirm(`⚠️ Are you sure you want to restore from "${file.name}"? This will overwrite existing data.`)) {
      if (restoreInputRef.current) restoreInputRef.current.value = "";
      return;
    }
    setRestoringDb(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API}/api/admin/backup/restore`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Restore failed");
      alert(`✅ ${data.message}${data.errors ? "\n\nWarnings:\n" + data.errors.join("\n") : ""}`);
    } catch (err: any) { alert("❌ Restore failed: " + err.message); }
    finally { if (restoreInputRef.current) restoreInputRef.current.value = ""; setRestoringDb(false); }
  };
  const saveAdminName = () => {
    const n = adminName.trim();
    if (!n) { showFlash("Name is required", false); return; }
    updateUser({ name: n });
    showFlash("Admin name updated");
  };

  const filtered = settings.filter(s =>
    s.category === activeTab
    && s.setting_key !== 'user_premium_fee_usd'
    && s.setting_key !== 'free_user_max_videos'
    && s.setting_key !== 'free_user_can_access_coaching'
  );

  async function saveAppSettings() {
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      for (const s of filtered) payload[s.setting_key] = editMap[s.setting_key] ?? "";
      const r = await fetch(`${API}/api/admin/app-settings`, {
        method: "PUT", headers, body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error();
      showFlash(l("Settings saved", "تم حفظ الإعدادات"));
    } catch {
      showFlash(l("Failed to save", "فشل الحفظ"), false);
    }
    setSaving(false);
  }

  async function savePaymentSettings() {
    setSaving(true);
    try {
      const r = await fetch(`${API}/api/admin/payment-settings`, {
        method: "PUT", headers, body: JSON.stringify(paySettings),
      });
      if (!r.ok) throw new Error();
      showFlash(l("Payment settings saved", "تم حفظ إعدادات الدفع"));
    } catch {
      showFlash(l("Failed to save payment settings", "فشل حفظ إعدادات الدفع"), false);
    }
    setSaving(false);
  }

  async function uploadImage(key: string, file: File) {
    setUploading(key);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const r = await fetch(`${API}/api/admin/upload-dashboard-image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setEditMap(m => ({ ...m, [key]: d.url }));
      showFlash(l("Image uploaded", "تم رفع الصورة"));
    } catch {
      showFlash(l("Upload failed", "فشل الرفع"), false);
    }
    setUploading(null);
  }

  async function uploadFont(key: string, file: File) {
    setUploading(key);
    try {
      const fd = new FormData();
      fd.append("font", file);
      const r = await fetch(`${API}/api/admin/upload-font`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setEditMap(m => ({ ...m, [key]: d.name || d.url }));
      showFlash(l("Font uploaded", "تم رفع الخط"));
    } catch {
      showFlash(l("Upload failed", "فشل الرفع"), false);
    }
    setUploading(null);
  }

  function renderField(s: AppSetting) {
    const val = editMap[s.setting_key] ?? "";
    const set = (v: string) => setEditMap(m => ({ ...m, [s.setting_key]: v }));
    const isOn = val === "1" || val === "true";
    const fieldId = `setting-${s.setting_key}`;

    if (s.setting_type === "boolean") {
      return (
        <div className="flex items-center justify-between gap-3 px-5 py-3.5">
          <Label htmlFor={fieldId} className="text-[15px] font-medium">{s.label || s.setting_key}</Label>
          <Switch id={fieldId} checked={isOn} onCheckedChange={v => set(v ? "1" : "0")} />
        </div>
      );
    }

    if (s.setting_type === "color") {
      return (
        <div className="grid gap-2 px-5 py-3.5">
          <Label htmlFor={fieldId} className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{s.label || s.setting_key}</Label>
          <div className="flex items-center gap-2.5">
            <input type="color" id={`${fieldId}-swatch`} value={val || "#000000"} onChange={e => set(e.target.value)} aria-label={`${s.label || s.setting_key} color`}
              className="size-10 cursor-pointer rounded-md bg-muted p-1 ring-1 ring-inset ring-border" />
            <Input id={fieldId} type="text" value={val} onChange={e => set(e.target.value)} className="flex-1" placeholder="#hex" />
          </div>
        </div>
      );
    }

    if (s.setting_type === "image" || ((s.setting_type === "url") && s.setting_key.includes("image")) || s.setting_key.includes("logo")) {
      return (
        <div className="grid gap-2 px-5 py-3.5">
          <Label htmlFor={fieldId} className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{s.label || s.setting_key}</Label>
          <div className="flex items-center gap-2">
            <Input id={fieldId} type="url" value={val} onChange={e => set(e.target.value)} className="flex-1" placeholder="Image URL or upload..." />
            <Button asChild variant="outline" size="sm" disabled={uploading === s.setting_key}>
              <label className={uploading === s.setting_key ? "cursor-not-allowed" : "cursor-pointer"}>
                <Upload size={14} strokeWidth={2} />
                {uploading === s.setting_key ? "Uploading..." : "Upload"}
                <input type="file" accept="image/*" hidden
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(s.setting_key, f); e.target.value = ""; }}
                  disabled={uploading === s.setting_key} />
              </label>
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">JPG, PNG, or WebP — recommended 800×400px, max 2 MB</p>
          {val && (
            <div className="mt-1 h-[60px] w-[100px] overflow-hidden rounded-md bg-muted ring-1 ring-inset ring-border">
              <img src={val} alt="" className="size-full object-cover" />
            </div>
          )}
        </div>
      );
    }

    if (s.setting_type === "font") {
      const isArabic = s.setting_key.includes("ar");
      const isHeading = s.setting_key.includes("heading");
      const presetFonts = isArabic
        ? ["Cairo", "Tajawal", "Noto Sans Arabic", "IBM Plex Sans Arabic", "Almarai", "Changa", "El Messiri", "Readex Pro"]
        : isHeading
        ? ["Gotham", "Orbitron", "Rajdhani", "Exo 2", "Teko", "Russo One", "Plus Jakarta Sans", "Syne", "Inter"]
        : ["Gotham", "Plus Jakarta Sans", "Inter", "Poppins", "Roboto", "Montserrat", "DM Sans", "Nunito", "Lato", "Open Sans"];
      return (
        <div className="grid gap-2 px-5 py-3.5">
          <Label htmlFor={fieldId} className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{s.label || s.setting_key}</Label>
          <div className="flex items-center gap-2">
            <Select value={presetFonts.includes(val) ? val : "__custom"} onValueChange={v => { if (v !== "__custom") set(v); }}>
              <SelectTrigger id={fieldId} className="h-11 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {presetFonts.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                {!presetFonts.includes(val) && val && <SelectItem value="__custom">{val} (custom)</SelectItem>}
              </SelectContent>
            </Select>
            <Button asChild variant="outline" size="sm" disabled={uploading === s.setting_key}>
              <label className={uploading === s.setting_key ? "cursor-not-allowed" : "cursor-pointer"}>
                <Upload size={14} strokeWidth={2} />
                {uploading === s.setting_key ? "Uploading..." : "Upload"}
                <input type="file" accept=".ttf,.otf,.woff,.woff2" hidden
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadFont(s.setting_key, f); e.target.value = ""; }}
                  disabled={uploading === s.setting_key} />
              </label>
            </Button>
          </div>
          {val && (
            <p className="mt-1 text-[16px] text-foreground" style={{ fontFamily: val }}>
              {isArabic ? "معاينة الخط العربي — ١٢٣٤٥" : "Preview Font — Aa Bb Cc 12345"}
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="grid gap-2 px-5 py-3.5">
        <Label htmlFor={fieldId} className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{s.label || s.setting_key}</Label>
        <Input
          id={fieldId}
          type={s.setting_type === "number" ? "number" : "text"}
          value={val}
          onChange={e => set(e.target.value)}
          placeholder={`Enter ${s.setting_type || "text"}...`}
        />
      </div>
    );
  }

  function renderFeatures() {
    const userFeatures = filtered.filter(s => s.setting_key.startsWith("feature_user_"));
    const coachFeatures = filtered.filter(s => s.setting_key.startsWith("feature_coach_"));
    const other = filtered.filter(s => !s.setting_key.startsWith("feature_user_") && !s.setting_key.startsWith("feature_coach_"));
    const allFeatureKeys = [...userFeatures, ...coachFeatures, ...other].map(s => ({
      key: s.setting_key,
      label: (s.label || s.setting_key).replace(/^(User: |Coach: )/, ""),
    }));

    return (
      <div className="flex flex-col gap-4">
        {/* Grant a feature to a specific username (overrides the global toggle). */}
        <FeatureAccessPanel token={token} featureKeys={allFeatureKeys} />

        {[
          { title: "User App", items: userFeatures },
          { title: "Coach Panel", items: coachFeatures },
          ...(other.length ? [{ title: "Other", items: other }] : []),
        ].map(group => group.items.length > 0 && (
          <Card key={group.title} className="gap-0 overflow-hidden p-0">
            <div className="bg-muted px-5 py-3">
              <p className="text-[11px] font-semibold tracking-wider text-primary uppercase">{group.title}</p>
            </div>
            {group.items.map((s, i) => {
              const val = editMap[s.setting_key] ?? "";
              const isOn = val === "1" || val === "true";
              const niceName = (s.label || s.setting_key).replace(/^(User: |Coach: )/, "");
              const fid = `feature-${s.setting_key}`;
              return (
                <div key={s.setting_key}>
                  <div className="flex items-center justify-between gap-3 px-5 py-3">
                    <Label htmlFor={fid} className="text-[15px] font-medium">{niceName}</Label>
                    <Switch id={fid} checked={isOn} onCheckedChange={v => setEditMap(m => ({ ...m, [s.setting_key]: v ? "1" : "0" }))} />
                  </div>
                  {i < group.items.length - 1 && <Separator />}
                </div>
              );
            })}
          </Card>
        ))}
      </div>
    );
  }

  function renderModerators() {
    const isAllowed = (key: string) => modPerms[key] === true; // default-deny (§17): only explicitly-granted areas are allowed
    const toggleArea = (key: string) => saveModeratorPerms({ ...modPerms, [key]: !isAllowed(key) });
    const moderators = modUsers.filter(u => u.role === "moderator");
    const q = modSearch.trim().toLowerCase();
    const candidates = q
      ? modUsers.filter(u => u.role !== "moderator" && u.role !== "admin" && (u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)))
      : [];

    return (
      <div className="space-y-3.5">
        {/* Access toggles */}
        <Card className="gap-0 overflow-hidden p-0">
          <div className="flex items-center gap-3 bg-muted px-5 py-3.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-card text-primary"><Lock size={18} strokeWidth={2} /></span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-foreground">{l("What moderators can access", "ما يمكن للمشرفين الوصول إليه")}</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">{l("Grant only the areas a moderator needs — everything is off by default. Admins always have full access.", "امنح المشرف فقط الأقسام التي يحتاجها — كل شيء مغلق افتراضيًا. المسؤولون لديهم وصول كامل دائمًا.")}</p>
            </div>
          </div>
          <div className="flex flex-col">
            {MODERATOR_AREAS.map((a, i) => (
              <div key={a.key}>
                <div className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-foreground">{l(a.label, a.label)}</p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">{a.desc}</p>
                  </div>
                  <Switch checked={isAllowed(a.key)} disabled={modSaving} onCheckedChange={() => toggleArea(a.key)} aria-label={a.label} />
                </div>
                {i < MODERATOR_AREAS.length - 1 && <Separator />}
              </div>
            ))}
          </div>
        </Card>

        {/* Current moderators */}
        <Card className="gap-0 overflow-hidden p-0">
          <div className="flex items-center gap-3 bg-muted px-5 py-3.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-card text-primary"><ShieldCheck size={18} strokeWidth={2} /></span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-foreground">{l("Moderators", "المشرفون")}</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">{l("People who can moderate based on the access above.", "الأشخاص الذين يمكنهم الإشراف بناءً على الصلاحيات أعلاه.")}</p>
            </div>
          </div>
          <div className="flex flex-col">
            {modLoading ? (
              <p className="px-5 py-6 text-center text-[13px] text-muted-foreground">{l("Loading...", "جاري التحميل...")}</p>
            ) : moderators.length === 0 ? (
              <p className="px-5 py-6 text-center text-[13px] text-muted-foreground">{l("No moderators yet. Add one below.", "لا يوجد مشرفون بعد. أضف واحدًا أدناه.")}</p>
            ) : (
              moderators.map((u, i) => (
                <div key={u.id}>
                  <div className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-foreground">{u.name}</p>
                      <p className="truncate text-[12px] text-muted-foreground">{u.email}</p>
                    </div>
                    <Button variant="outline" size="sm" className="text-destructive" onClick={() => setUserRole(u.id, "user")}>
                      <Trash2 size={14} strokeWidth={2} /> {l("Remove", "إزالة")}
                    </Button>
                  </div>
                  {i < moderators.length - 1 && <Separator />}
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Add a moderator */}
        <Card className="gap-0 p-5">
          <p className="mb-2.5 text-[15px] font-semibold">{l("Add a moderator", "إضافة مشرف")}</p>
          <div className="relative">
            <Search size={15} strokeWidth={2} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={modSearch} onChange={e => setModSearch(e.target.value)} placeholder={l("Search users by name or email", "ابحث عن المستخدمين بالاسم أو البريد")} className="ps-9" />
          </div>
          {q && (
            <div className="mt-3 flex flex-col">
              {candidates.length === 0 ? (
                <p className="py-4 text-center text-[13px] text-muted-foreground">{l("No matching users.", "لا يوجد مستخدمون مطابقون.")}</p>
              ) : (
                candidates.slice(0, 12).map((u, i) => (
                  <div key={u.id}>
                    <div className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-foreground">{u.name}</p>
                        <p className="truncate text-[12px] text-muted-foreground">{u.email}</p>
                      </div>
                      <Button size="sm" onClick={() => setUserRole(u.id, "moderator")}>
                        <ShieldCheck size={14} strokeWidth={2} /> {l("Make moderator", "تعيين كمشرف")}
                      </Button>
                    </div>
                    {i < Math.min(candidates.length, 12) - 1 && <Separator />}
                  </div>
                ))
              )}
            </div>
          )}
        </Card>
      </div>
    );
  }

  function renderPromoCodes() {
    type Promo = { code: string; type: "percent" | "amount"; value: number; uses_left: number; description: string };
    const raw = settings.find(s => s.setting_key === "promo_codes")?.setting_value || "[]";
    let list: Promo[] = [];
    try { list = JSON.parse(raw); if (!Array.isArray(list)) list = []; } catch { list = []; }
    const persist = async (next: Promo[]) => {
      try {
        await api("/api/admin/app-settings", {
          method: "PUT",
          body: JSON.stringify({ promo_codes: JSON.stringify(next) }),
        });
        await fetchSettings();
        showFlash("Promo codes saved", true);
      } catch { showFlash("Save failed", false); }
    };
    const add = () => persist([...list, { code: `CODE${list.length + 1}`, type: "percent", value: 10, uses_left: 100, description: "" }]);
    const update = (i: number, patch: Partial<Promo>) => {
      const next = list.map((p, idx) => idx === i ? { ...p, ...patch } : p);
      persist(next);
    };
    const remove = (i: number) => persist(list.filter((_, idx) => idx !== i));

    return (
      <Card className="gap-0 p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[13px] text-muted-foreground">
            Promo & gift codes are stored as a JSON blob in app settings — admin can add, edit, or remove them here without touching code. Changes save instantly.
          </p>
          <Button size="sm" onClick={add} className="shrink-0">
            <Plus size={14} strokeWidth={2} /> Add code
          </Button>
        </div>
        {list.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-muted-foreground">
            No promo codes yet. Click "Add code" to create one.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {/* Column headers — aligned with the same grid below */}
            <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr_2fr_auto] items-center gap-2 px-3.5">
              {["Code", "Type", "Value", "Uses left", "Description (internal)", ""].map((h, hi) => (
                <div key={hi} className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">{h}</div>
              ))}
            </div>
            {list.map((p, i) => (
              <div key={i} className="grid grid-cols-[1.3fr_1fr_1fr_1fr_2fr_auto] items-center gap-2 rounded-md bg-muted p-3.5">
                <Input value={p.code} onChange={e => update(i, { code: e.target.value.toUpperCase() })} placeholder="CODE" aria-label="Promo code" className="bg-card font-bold tracking-wider" />
                <Select value={p.type} onValueChange={v => update(i, { type: v as "percent" | "amount" })}>
                  <SelectTrigger className="h-11 w-full bg-card" aria-label="Discount type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">% off</SelectItem>
                    <SelectItem value="amount">EGP off</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" min={0} value={p.value} onChange={e => update(i, { value: Number(e.target.value) || 0 })} placeholder="Value" aria-label="Discount value" className="bg-card" />
                <Input type="number" min={0} value={p.uses_left} onChange={e => update(i, { uses_left: Number(e.target.value) || 0 })} placeholder="Uses left" aria-label="Uses left" className="bg-card" />
                <Input value={p.description} onChange={e => update(i, { description: e.target.value })} placeholder="Description (internal)" aria-label="Description" className="bg-card" />
                <Button variant="destructive" size="icon" onClick={() => remove(i)} aria-label="Delete promo code">
                  <Trash2 size={16} strokeWidth={2} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    );
  }

  function renderPayments() {
    const ps = paySettings;
    const set = (key: string, val: string) => setPaySettings(s => ({ ...s, [key]: val }));
    const tog = (key: string) => set(key, ps[key] === "1" ? "0" : "1");
    const inp = (key: string, label: string, hint: string, type = "text") => (
      <PayField id={`pay-${key}`} label={label} hint={hint}>
        <Input id={`pay-${key}`} type={type === "secret" ? (showSecrets ? "text" : "password") : type} value={ps[key] || ""} onChange={e => set(key, e.target.value)} placeholder="..." />
      </PayField>
    );

    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={() => setShowSecrets(s => !s)}>
            {showSecrets ? <EyeOff size={14} strokeWidth={2} /> : <Eye size={14} strokeWidth={2} />} {showSecrets ? "Hide" : "Show"} secrets
          </Button>
        </div>

        {/* Manual e-wallet — primary payment path for Egypt. Users transfer
            to one of the published wallet numbers from their phone wallet
            and upload a screenshot. An admin reviews + activates.
            (The Paymob automated processor was removed in v3.0.) */}
        <SectionCard icon={Smartphone} title="Mobile Wallet (Manual)" sub="Vodafone Cash · Orange Cash · WE Pay">
          <ModeBlock enabled={true} onToggle={() => {}}
            badge="Reviewed by admin" badgeVariant="warning"
            desc="Users transfer to your wallets and upload a screenshot. Admin reviews and activates.">
            {inp("ewallet_phone_vodafone", "Vodafone Cash number", "Your registered Vodafone Cash number", "tel")}
            {inp("ewallet_phone_orange", "Orange Cash number", "Your registered Orange Cash number", "tel")}
            {inp("ewallet_phone_we", "WE Pay number", "Your registered WE Pay number", "tel")}
            {inp("ewallet_phone_instapay", "InstaPay handle/number", "Your InstaPay ID or phone (e.g. user@instapay)", "text")}
          </ModeBlock>
        </SectionCard>

        {/* PayPal was removed per the May meeting — InstaPay (handled in the
            Mobile Wallet block above) replaces it. Google Play / App Store
            IAP stay below for Android / iOS native subscription flows. */}

        <SectionCard icon={Bot} title="Google Play (Android IAP)" sub="In-app purchase for Android">
          <ModeBlock enabled={ps.google_play_enabled === "1"} onToggle={() => tog("google_play_enabled")}
            badge="Android" badgeVariant="success"
            desc="Android users see a native Google Play purchase button.">
            {inp("google_play_product_id_monthly", "Monthly Subscription ID", "Google Play Console > Monetize > Subscriptions")}
            {inp("google_play_product_id_annual", "Annual Subscription ID", "Separate subscription product for annual")}
          </ModeBlock>
        </SectionCard>

        <SectionCard icon={Apple} title="App Store (iOS IAP)" sub="In-app purchase for iOS">
          <ModeBlock enabled={ps.apple_pay_enabled === "1"} onToggle={() => tog("apple_pay_enabled")}
            badge="iOS" badgeVariant="secondary"
            desc="iOS users see a native App Store purchase button.">
            {inp("apple_pay_product_id_monthly", "Monthly Subscription ID", "App Store Connect > Subscriptions")}
            {inp("apple_pay_product_id_annual", "Annual Subscription ID", "Separate subscription group for annual")}
          </ModeBlock>
        </SectionCard>

        <SectionCard icon={Coins} title="Revenue Split" sub="Earnings split between coaches and platform">
          <div className="flex gap-4">
            <div className="flex-1 grid gap-1.5">
              <Label htmlFor="pay-coach-cut" className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Coach receives (%)</Label>
              <Input id="pay-coach-cut" type="number" min="0" max="100" value={ps.coach_cut_percentage || ""} onChange={e => set("coach_cut_percentage", e.target.value)} />
              <p className="text-[11px] text-muted-foreground">Platform keeps {100 - Number(ps.coach_cut_percentage || 85)}%</p>
            </div>
            <div className="flex-1 grid gap-1.5">
              <Label htmlFor="pay-egp-rate" className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">EGP to USD rate</Label>
              <Input id="pay-egp-rate" type="number" step="0.01" value={ps.egp_usd_rate || ""} onChange={e => set("egp_usd_rate", e.target.value)} placeholder="Leave empty for live rate" />
            </div>
          </div>
        </SectionCard>
      </div>
    );
  }

  function renderSystem() {
    return (
      <div className="flex flex-col gap-4">

        {/* Database Backup */}
        <Card className="gap-0 p-5">
          <p className="mb-1.5 flex items-center gap-2 text-[15px] font-semibold"><Database size={16} strokeWidth={2} className="text-muted-foreground" /> Database Backup</p>
          <p className="mb-4 text-[13px] leading-relaxed text-muted-foreground">
            Download a full SQL dump of the database. Includes all tables and rows — safe to restore on any MySQL server.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <Button asChild>
              <a href={`${API}/api/admin/backup/database`} download
                onClick={async e => {
                  e.preventDefault();
                  const btn = e.currentTarget;
                  const origText = btn.textContent;
                  btn.textContent = "⏳ Generating backup…";
                  try {
                    const res = await fetch(`${API}/api/admin/backup/database`, { headers: { Authorization: `Bearer ${token}` } });
                    if (!res.ok) throw new Error(await res.text());
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
                    a.download = `fitwayhub-backup-${ts}.sql`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  } catch (err: any) { alert("Backup failed: " + err.message); }
                  finally { btn.textContent = origText || "⬇ Download .sql"; }
                }}>
                <Download size={16} strokeWidth={2} /> Download Database (.sql)
              </a>
            </Button>
            <Button variant="outline" onClick={() => restoreInputRef.current?.click()} disabled={restoringDb}>
              <Upload size={16} strokeWidth={2} /> {restoringDb ? "Restoring…" : "Upload Database (.sql)"}
            </Button>
            <input ref={restoreInputRef} type="file" accept=".sql" hidden
              onChange={e => { handleDatabaseRestore(e.target.files?.[0]); }} />
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">💡 Store backups securely. This file contains all user data.</p>
        </Card>

        {/* Fake Accounts Generator */}
        <Card className="gap-0 p-5">
          <p className="mb-1.5 flex items-center gap-2 text-[15px] font-semibold"><Users size={16} strokeWidth={2} className="text-muted-foreground" /> Fake Accounts Generator</p>
          <p className="mb-4 text-[13px] leading-relaxed text-muted-foreground">
            Generate realistic fake user accounts with complete onboarding profiles for testing.
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            {[5, 10, 20, 50, 100].map(n => (
              <Button key={n} variant={genCount === n ? "default" : "outline"} size="sm" onClick={() => setGenCount(n)}>
                {n}
              </Button>
            ))}
            <Input type="number" min={1} max={500} value={genCount}
              onChange={e => setGenCount(Math.min(500, Math.max(1, +e.target.value)))}
              aria-label="Fake user count"
              className="w-20" />
            <Button onClick={async () => {
              setGenLoading(true); setGenMsg("");
              try {
                const res = await api("/api/admin/generate-fake-users", { method: "POST", body: JSON.stringify({ count: genCount }) });
                const d = await res.json();
                if (res.ok) setGenMsg(`✅ Created ${d.created} fake users`);
                else setGenMsg("❌ " + (d.message || "Failed"));
              } catch { setGenMsg("❌ Request failed"); }
              setGenLoading(false);
            }} disabled={genLoading}>
              <Plus size={16} strokeWidth={2} /> {genLoading ? "Generating…" : `Add ${genCount} Fake Users`}
            </Button>
            <Button variant="destructive" size="sm" onClick={async () => {
              if (!confirm("Remove ALL fake users now?")) return;
              setRemoveFakeLoading(true); setGenMsg("");
              try {
                const res = await api("/api/admin/fake-users", { method: "DELETE" });
                const d = await res.json().catch(() => ({}));
                if (res.ok) setGenMsg(`✅ ${d?.message || "Fake users removed"}`);
                else setGenMsg(`❌ ${d?.message || "Failed to remove fake users"}`);
              } catch { setGenMsg("❌ Failed to remove fake users"); }
              finally { setRemoveFakeLoading(false); }
            }} disabled={removeFakeLoading}>
              <Trash2 size={16} strokeWidth={2} /> {removeFakeLoading ? "Removing…" : "Remove All Fake Accounts"}
            </Button>
          </div>
          {genMsg && <p className={`mt-3 text-[13px] font-semibold ${genMsg.startsWith("✅") ? "text-[var(--green)]" : "text-destructive"}`}>{genMsg}</p>}
          <p className="mt-2.5 text-[11px] text-muted-foreground">⚠️ Fake accounts use the password <code>FakePass!2025</code> and are tagged with <code>fake.</code> email prefix.</p>

          {/* Fake-coach button — moved here from the Dashboard per the May
              meeting. Lives next to the fake-user controls so all the
              testing helpers are in one place. */}
          <Separator className="my-4" />
          <div>
            <p className="mb-2 text-[14px] font-semibold">Fake coaches</p>
            <p className="mb-3 text-[13px] text-muted-foreground">
              Spin up demo coach profiles so the coach-side flows can be tested.
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              <Button onClick={async () => {
                setGenLoading(true); setGenMsg("");
                try {
                  const res = await api("/api/admin/generate-coach-profiles", { method: "POST", body: JSON.stringify({ count: 5 }) });
                  const d = await res.json().catch(() => ({}));
                  if (res.ok) setGenMsg(`✅ ${d?.message || "5 fake coaches added"}`);
                  else setGenMsg(`❌ ${d?.message || "Failed to add coaches"}`);
                } catch { setGenMsg("❌ Request failed"); }
                finally { setGenLoading(false); }
              }} disabled={genLoading}>
                <Plus size={16} strokeWidth={2} /> Add 5 Fake Coaches
              </Button>
              <Button variant="outline" onClick={async () => {
                if (!confirm("Remove ALL fake coaches? This will delete every coach with an @fitwayhub.coach email and cascade their posts, subscriptions, ads, and reviews. This cannot be undone.")) return;
                setGenLoading(true); setGenMsg("");
                try {
                  const res = await api("/api/admin/remove-fake-coaches", { method: "POST" });
                  const d = await res.json().catch(() => ({}));
                  if (res.ok) setGenMsg(`✅ ${d?.message || "Fake coaches removed"}`);
                  else setGenMsg(`❌ ${d?.message || "Failed to remove fake coaches"}`);
                } catch { setGenMsg("❌ Request failed"); }
                finally { setGenLoading(false); }
              }} disabled={genLoading}
                className="text-destructive ring-destructive/40 hover:bg-destructive/10 hover:text-destructive">
                <Trash2 size={16} strokeWidth={2} /> Remove Fake Coaches
              </Button>
              <Button variant="outline" onClick={async () => {
                setGenLoading(true); setGenMsg("");
                try {
                  const res = await api("/api/admin/generate-fake-subs", { method: "POST" });
                  const d = await res.json().catch(() => ({}));
                  if (res.ok) setGenMsg(`✅ ${d?.message || "Fake subscriptions seeded (fake users only)"}`);
                  else setGenMsg(`❌ ${d?.message || "Failed"}`);
                } catch { setGenMsg("❌ Request failed"); }
                finally { setGenLoading(false); }
              }} disabled={genLoading}
                className="text-primary ring-primary/40 hover:bg-primary/10 hover:text-primary">
                🎯 Seed Fake Subscriptions
              </Button>
            </div>
            <p className="mt-2.5 text-[11px] text-muted-foreground">
              Fake subscriptions only apply to fake users — real accounts are never modified.
            </p>
          </div>
        </Card>

        {/* Admin Preferences */}
        <Card className="gap-0 p-5">
          <p className="mb-4 text-[15px] font-semibold">Admin Preferences</p>
          <div className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="admin-name" className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Name</Label>
              <div className="flex gap-2">
                <Input id="admin-name" type="text" value={adminName} onChange={e => setAdminName(e.target.value)} placeholder="Admin name" className="flex-1" />
                <Button onClick={saveAdminName} className="shrink-0">
                  Save Name
                </Button>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold">Mode</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">Toggle between light and dark theme</p>
              </div>
              <div className="flex items-center gap-2.5">
                <Sun size={16} strokeWidth={2} className={!isDark ? "text-[var(--amber)]" : "text-muted-foreground"} />
                <Switch checked={isDark} onCheckedChange={toggleTheme} aria-label="Toggle dark mode" />
                <Moon size={16} strokeWidth={2} className={isDark ? "text-[var(--secondary)]" : "text-muted-foreground"} />
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold">Language</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">Choose admin panel language</p>
              </div>
              <Select value={lang} onValueChange={v => setLang(v as any)}>
                <SelectTrigger className="h-10 w-[150px]" aria-label="Admin panel language"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">العربية</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Backend Server URL */}
        <Card className="gap-0 p-5">
          <p className="mb-1 flex items-center gap-2 text-[15px] font-semibold"><Globe size={16} strokeWidth={2} className="text-muted-foreground" /> Backend Server URL</p>
          <p className="mb-4 text-[13px] leading-relaxed text-muted-foreground">
            Set the full backend URL for mobile (Capacitor) builds. Leave empty to use relative paths (default for web).
            <br />Example: <strong>https://api.fitwayhub.com</strong> or <strong>http://192.168.1.100:3000</strong>
          </p>
          <div className="grid gap-2">
            <Label htmlFor="server-url" className="sr-only">Backend server URL</Label>
            <div className="flex items-stretch gap-2.5">
              <Input id="server-url" type="url" value={serverUrl} onChange={e => setServerUrl(e.target.value)} placeholder="https://api.fitwayhub.com" className="flex-1" />
              <Button variant="outline" onClick={testServerUrl} disabled={serverUrlTesting} className="shrink-0">
                <RefreshCw size={14} strokeWidth={2} /> {serverUrlTesting ? "Testing…" : "Test"}
              </Button>
            </div>
          </div>
          {serverUrlMsg && (
            <div className={`mt-3 rounded-md px-3.5 py-2.5 text-[13px] font-semibold ${serverUrlMsg.startsWith("✅") ? "bg-[color-mix(in_srgb,var(--green)_14%,transparent)] text-[var(--green)]" : serverUrlMsg.startsWith("⚠") ? "bg-[color-mix(in_srgb,var(--amber)_14%,transparent)] text-[var(--amber)]" : "bg-destructive/12 text-destructive"}`}>
              {serverUrlMsg}
            </div>
          )}
          <div className="mt-3.5 flex gap-2.5">
            <Button onClick={saveServerUrl} disabled={serverUrlSaving} className="flex-1">
              <Save size={16} strokeWidth={2} /> {serverUrlSaving ? "Saving…" : "Save Server URL"}
            </Button>
            {serverUrl && (
              <Button variant="outline" onClick={() => { setServerUrl(""); localStorage.removeItem("fitway_server_url"); setServerUrlMsg("✅ Cleared — using relative paths (web mode)"); setTimeout(() => setServerUrlMsg(""), 4000); }}
                className="text-destructive ring-destructive/40 hover:bg-destructive/10 hover:text-destructive">
                Clear
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  const isPayments = activeTab === "payments";
  const isFeatures = activeTab === "features";
  const isSystem = activeTab === "system";
  const isPromo = activeTab === "promo";
  const isModerators = activeTab === "moderators";
  const activeMeta = CATEGORIES.find(c => c.key === activeTab);

  return (
    <div className="space-y-6">
      {flash && (
        <div className={`fixed end-4 top-4 z-[9999] flex items-center gap-2 rounded-md bg-card px-4 py-3 text-[13px] font-semibold text-foreground shadow-soft-lg ring-1 ring-inset ${flash.ok ? "ring-[color-mix(in_srgb,var(--green)_40%,transparent)]" : "ring-destructive/40"}`}>
          {flash.ok ? <CheckCircle size={16} strokeWidth={2} className="text-[var(--green)]" /> : <XCircle size={16} strokeWidth={2} className="text-destructive" />}
          {flash.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
            <Settings size={20} strokeWidth={2} />
          </span>
          <div>
            <h1 className="text-[26px] leading-tight font-bold tracking-tight">{l("Settings", "الإعدادات")}</h1>
            <p className="text-[13px] text-muted-foreground">{l("Manage application configuration", "إدارة إعدادات التطبيق")}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchSettings(); fetchPaymentSettings(); }}>
          <RefreshCw size={14} strokeWidth={2} /> {l("Refresh", "تحديث")}
        </Button>
      </div>

      <div className="admin-settings-grid flex items-start gap-4">
        {/* Section nav */}
        <Card className="admin-settings-side w-[220px] shrink-0 gap-0 p-2">
          {CATEGORIES.map(({ key, label, icon: Icon, desc }) => {
            const active = activeTab === key;
            return (
              <button key={key} onClick={() => setActiveTab(key)} aria-current={active ? "page" : undefined}
                className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-start transition-colors ${active ? "bg-primary/15" : "hover:bg-muted"}`}>
                <Icon size={16} strokeWidth={2} className={active ? "text-primary" : "text-muted-foreground"} />
                <div className="min-w-0 flex-1">
                  <div className={`text-[13px] font-semibold ${active ? "text-primary" : "text-foreground"}`}>{label}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{desc}</div>
                </div>
              </button>
            );
          })}
        </Card>

        <div className="min-w-0 flex-1 space-y-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold tracking-tight">{activeMeta?.label}</h2>
              <p className="text-[13px] text-muted-foreground">{activeMeta?.desc}</p>
            </div>
            {!isSystem && !isPromo && !isModerators && (
              <Button
                onClick={isPayments ? savePaymentSettings : saveAppSettings}
                disabled={saving || (!isPayments && filtered.length === 0)}
                className="shrink-0"
              >
                <Save size={16} strokeWidth={2} /> {saving ? l("Saving...", "جاري الحفظ...") : l("Save", "حفظ")}
              </Button>
            )}
          </div>

          {isModerators ? renderModerators() : isSystem ? renderSystem() : isPromo ? renderPromoCodes() : isPayments ? (
            payLoading ? (
              <Card className="p-10 text-center text-[13px] text-muted-foreground">
                Loading...
              </Card>
            ) : renderPayments()
          ) : loading ? (
            <Card className="p-10 text-center text-[13px] text-muted-foreground">
              Loading settings...
            </Card>
          ) : filtered.length === 0 ? (
            <Card className="p-10 text-center text-[13px] text-muted-foreground">
              {l("No settings in this category yet.", "لا توجد إعدادات في هذا القسم.")}
            </Card>
          ) : isFeatures ? renderFeatures() : (
            <Card className="gap-0 overflow-hidden p-0">
              {filtered.map((s, i) => (
                <div key={s.setting_key}>
                  {renderField(s)}
                  {i < filtered.length - 1 && <Separator />}
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Per-user feature access ──────────────────────────────────────────────────
   Lets an admin grant (or revoke) a single feature for a SPECIFIC username/email
   instead of toggling it for everyone. Backed by /api/admin/feature-access. */
function FeatureAccessPanel({ token, featureKeys }: { token: string | null; featureKeys: { key: string; label: string }[] }) {
  const [overrides, setOverrides] = useState<any[]>([]);
  const [username, setUsername] = useState("");
  const [featureKey, setFeatureKey] = useState(featureKeys[0]?.key || "");
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const authHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/admin/feature-access`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      setOverrides(d?.overrides || []);
    } catch { /* ignore */ }
  }, [token]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!featureKey && featureKeys[0]) setFeatureKey(featureKeys[0].key); }, [featureKeys, featureKey]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 2500); };

  const grant = async () => {
    if (!username.trim() || !featureKey) { flash("Enter a username and pick a feature."); return; }
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/admin/feature-access`, {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({ username: username.trim(), feature_key: featureKey, enabled }),
      });
      const d = await r.json().catch(() => ({}));
      flash(d?.message || (r.ok ? "Saved" : "Failed"));
      if (r.ok) { setUsername(""); load(); }
    } finally { setBusy(false); }
  };

  const remove = async (id: number) => {
    await fetch(`${API}/api/admin/feature-access/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    load();
  };

  const labelFor = (k: string) => featureKeys.find(f => f.key === k)?.label || k;

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="flex items-center gap-3 bg-muted px-5 py-3.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-card text-primary"><Users size={18} strokeWidth={2} /></span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-foreground">Per-user access</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Give (or block) a feature for a specific username/email — overrides the global toggle for that user only.</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-5">
        <div className="grid gap-2 sm:grid-cols-[1.4fr_1.4fr_auto_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Username or email</Label>
            <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. john_doe or john@email.com" />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Feature</Label>
            <select value={featureKey} onChange={e => setFeatureKey(e.target.value)} className="h-11 rounded-md border border-input bg-background px-3 text-[14px]">
              {featureKeys.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 pb-1.5">
            <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Enabled" />
            <span className="text-[13px] text-muted-foreground">{enabled ? "Grant" : "Block"}</span>
          </div>
          <Button onClick={grant} disabled={busy} className="h-11">{busy ? "Saving…" : "Apply"}</Button>
        </div>
        {msg && <p className="text-[12px] text-muted-foreground">{msg}</p>}

        {overrides.length > 0 && (
          <div className="mt-1 overflow-hidden rounded-md border border-border">
            {overrides.map((o, i) => (
              <div key={o.id}>
                <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-foreground">{o.user_name} <span className="font-normal text-muted-foreground">· {o.user_email}</span></p>
                    <p className="text-[12px] text-muted-foreground">{labelFor(o.feature_key)} — <span className={Number(o.enabled) === 1 ? "text-[var(--green)]" : "text-destructive"}>{Number(o.enabled) === 1 ? "granted" : "blocked"}</span></p>
                  </div>
                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => remove(o.id)}><Trash2 size={14} /> Remove</Button>
                </div>
                {i < overrides.length - 1 && <Separator />}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
