import { useState, useEffect, useCallback, useRef, type CSSProperties, type ReactNode } from "react";
import {
  Settings, Save, RefreshCw, CheckCircle, XCircle,
  Palette, Lock, CreditCard, Star, LayoutDashboard,
  Upload, Eye, EyeOff, ToggleLeft, Database, Sun, Moon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useTheme } from "@/context/ThemeContext";
import { getApiBase } from "@/lib/api";

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

type Category = "dashboard" | "access" | "features" | "pricing" | "points" | "payments" | "system";

const CATEGORIES: { key: Category; label: string; icon: typeof Palette; desc: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, desc: "Hero, sections, visibility" },
  { key: "access",    label: "Access",    icon: Lock,            desc: "Free limits, uploads" },
  { key: "features",  label: "Features",  icon: ToggleLeft,      desc: "Toggle app features on/off" },
  { key: "pricing",   label: "Pricing",   icon: CreditCard,      desc: "Fees & packages" },
  { key: "points",    label: "Points",    icon: Star,            desc: "Rewards & bonus points" },
  { key: "payments",  label: "Payments",  icon: CreditCard,      desc: "Payment gateways & methods" },
  { key: "system",    label: "System",    icon: Database,        desc: "Backup, server, tools" },
];

/* --- Payment helper components -------------------------------------------- */

function SectionCard({ color, emoji, title, sub, children }: { color: string; emoji: string; title: string; sub: string; children: ReactNode }) {
  return (
    <div style={{ border: `1px solid ${color}22`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", background: `${color}0A`, borderBottom: `1px solid ${color}22`, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 18 }}>{emoji}</span>
        <div>
          <p style={{ fontWeight: 700, fontSize: 14 }}>{title}</p>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{sub}</p>
        </div>
      </div>
      <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
    </div>
  );
}

function ModeBlock({ enabled, onToggle, badge, badgeColor, desc, children }: { enabled: boolean; onToggle: () => void; badge: string; badgeColor: string; desc: string; children: ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: badgeColor, background: `${badgeColor}18`, padding: "3px 10px", borderRadius: 99 }}>{badge}</span>
        <button type="button" onClick={onToggle} style={{ width: 42, height: 24, borderRadius: 99, border: "none", background: enabled ? "var(--green)" : "var(--bg-surface)", position: "relative", cursor: "pointer", transition: "background .2s" }}>
          <span style={{ position: "absolute", top: 3, left: enabled ? 21 : 3, width: 18, height: 18, borderRadius: 99, background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
        </button>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: enabled ? 12 : 0, lineHeight: 1.5 }}>{desc}</p>
      {enabled && <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>}
    </div>
  );
}

function PayField({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: 3 }}>{label}</label>
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 5 }}>{hint}</p>
      {children}
    </div>
  );
}

function WebhookInfo({ url }: { url: string }) {
  return (
    <div style={{ padding: "8px 12px", background: "var(--bg-surface)", borderRadius: 8, fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
      <strong>Webhook URL:</strong> <code style={{ wordBreak: "break-all" }}>{url}</code>
    </div>
  );
}

/* --- Styles --------------------------------------------------------------- */

const card: CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  overflow: "hidden",
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--bg-surface)",
  color: "var(--text-primary)",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  display: "block",
  marginBottom: 4,
};

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
    return fetch(getApiBase() + path, { ...opts, headers: { ...hdrs, ...(opts?.headers || {}) } });
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

  // Payment settings — Paymob + Fawry support was removed in v3.0 (May 2026).
  // Only PayPal and manual e-wallet (Vodafone / Orange / WE) are configured here.
  const [paySettings, setPaySettings] = useState<Record<string, string>>({
    paypal_user_client_id: "", paypal_user_secret: "", paypal_mode: "sandbox", paypal_webhook_id: "",
    ewallet_phone_vodafone: "", ewallet_phone_orange: "", ewallet_phone_we: "",
    pm_paypal: "1", pm_credit_card: "0", pm_google_pay: "1", pm_apple_pay: "1",
    google_play_enabled: "0", google_play_product_id_monthly: "", google_play_product_id_annual: "",
    apple_pay_enabled: "0", apple_pay_product_id_monthly: "", apple_pay_product_id_annual: "",
    coach_cut_percentage: "85", egp_usd_rate: "",
  });
  const [payLoading, setPayLoading] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);

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
      showFlash(l("Failed to load settings", "\u0641\u0634\u0644 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a"), false);
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

  const filtered = settings.filter(s => s.category === activeTab && s.setting_key !== 'user_premium_fee_usd' && s.setting_key !== 'free_user_max_videos');

  async function saveAppSettings() {
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      for (const s of filtered) payload[s.setting_key] = editMap[s.setting_key] ?? "";
      const r = await fetch(`${API}/api/admin/app-settings`, {
        method: "PUT", headers, body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error();
      showFlash(l("Settings saved", "\u062a\u0645 \u062d\u0641\u0638 \u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a"));
    } catch {
      showFlash(l("Failed to save", "\u0641\u0634\u0644 \u0627\u0644\u062d\u0641\u0638"), false);
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
      showFlash(l("Payment settings saved", "\u062a\u0645 \u062d\u0641\u0638 \u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0627\u0644\u062f\u0641\u0639"));
    } catch {
      showFlash(l("Failed to save payment settings", "\u0641\u0634\u0644 \u062d\u0641\u0638 \u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0627\u0644\u062f\u0641\u0639"), false);
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
      showFlash(l("Image uploaded", "\u062a\u0645 \u0631\u0641\u0639 \u0627\u0644\u0635\u0648\u0631\u0629"));
    } catch {
      showFlash(l("Upload failed", "\u0641\u0634\u0644 \u0627\u0644\u0631\u0641\u0639"), false);
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

  function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
    return (
      <button type="button" onClick={() => onChange(!value)} style={{
        width: 44, height: 24, borderRadius: 99, border: "none",
        background: value ? "var(--main)" : "var(--bg-surface)",
        position: "relative", cursor: "pointer", transition: "background .2s", flexShrink: 0,
      }}>
        <span style={{
          position: "absolute", top: 3, left: value ? 23 : 3,
          width: 18, height: 18, borderRadius: 99, background: "#fff",
          transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)",
        }} />
      </button>
    );
  }

  function renderField(s: AppSetting) {
    const val = editMap[s.setting_key] ?? "";
    const set = (v: string) => setEditMap(m => ({ ...m, [s.setting_key]: v }));
    const isOn = val === "1" || val === "true";

    if (s.setting_type === "boolean") {
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{s.label || s.setting_key}</span>
          <Toggle value={isOn} onChange={v => set(v ? "1" : "0")} />
        </div>
      );
    }

    if (s.setting_type === "color") {
      return (
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <label style={labelStyle}>{s.label || s.setting_key}</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input type="color" value={val || "#000000"} onChange={e => set(e.target.value)}
              style={{ width: 36, height: 36, border: "1px solid var(--border)", borderRadius: 8, padding: 2, cursor: "pointer", background: "var(--bg-surface)" }} />
            <input type="text" value={val} onChange={e => set(e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="#hex" />
          </div>
        </div>
      );
    }

    if (s.setting_type === "image" || ((s.setting_type === "url") && s.setting_key.includes("image")) || s.setting_key.includes("logo")) {
      return (
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <label style={labelStyle}>{s.label || s.setting_key}</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="url" value={val} onChange={e => set(e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="Image URL or upload..." />
            <label style={{
              display: "flex", alignItems: "center", gap: 5, padding: "8px 12px", borderRadius: 10,
              border: "1px dashed var(--border)", background: "var(--bg-surface)",
              color: uploading === s.setting_key ? "var(--text-muted)" : "var(--main)",
              fontSize: 12, fontWeight: 600, cursor: uploading === s.setting_key ? "not-allowed" : "pointer", whiteSpace: "nowrap", flexShrink: 0,
            }}>
              <Upload size={13} />
              {uploading === s.setting_key ? "Uploading..." : "Upload"}
              <input type="file" accept="image/*" hidden
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(s.setting_key, f); e.target.value = ""; }}
                disabled={uploading === s.setting_key} />
            </label>
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>JPG, PNG, or WebP — recommended 800×400px, max 2 MB</p>
          {val && (
            <div style={{ marginTop: 8, width: 100, height: 60, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
              <img src={val} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <label style={labelStyle}>{s.label || s.setting_key}</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select value={presetFonts.includes(val) ? val : "__custom"} onChange={e => { if (e.target.value !== "__custom") set(e.target.value); }}
              style={{ ...inputStyle, flex: 1 }}>
              {presetFonts.map(f => <option key={f} value={f}>{f}</option>)}
              {!presetFonts.includes(val) && val && <option value="__custom">{val} (custom)</option>}
            </select>
            <label style={{
              display: "flex", alignItems: "center", gap: 5, padding: "8px 12px", borderRadius: 10,
              border: "1px dashed var(--border)", background: "var(--bg-surface)",
              color: uploading === s.setting_key ? "var(--text-muted)" : "var(--main)",
              fontSize: 12, fontWeight: 600, cursor: uploading === s.setting_key ? "not-allowed" : "pointer", whiteSpace: "nowrap", flexShrink: 0,
            }}>
              <Upload size={13} />
              {uploading === s.setting_key ? "Uploading..." : "Upload"}
              <input type="file" accept=".ttf,.otf,.woff,.woff2" hidden
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadFont(s.setting_key, f); e.target.value = ""; }}
                disabled={uploading === s.setting_key} />
            </label>
          </div>
          {val && (
            <p style={{ marginTop: 8, fontFamily: val, fontSize: 16, color: "var(--text-primary)" }}>
              {isArabic ? "معاينة الخط العربي — ١٢٣٤٥" : "Preview Font — Aa Bb Cc 12345"}
            </p>
          )}
        </div>
      );
    }

    return (
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        <label style={labelStyle}>{s.label || s.setting_key}</label>
        <input
          type={s.setting_type === "number" ? "number" : "text"}
          value={val}
          onChange={e => set(e.target.value)}
          style={inputStyle}
          placeholder={`Enter ${s.setting_type || "text"}...`}
        />
      </div>
    );
  }

  function renderFeatures() {
    const userFeatures = filtered.filter(s => s.setting_key.startsWith("feature_user_"));
    const coachFeatures = filtered.filter(s => s.setting_key.startsWith("feature_coach_"));
    const other = filtered.filter(s => !s.setting_key.startsWith("feature_user_") && !s.setting_key.startsWith("feature_coach_"));

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {[
          { title: "User App", items: userFeatures },
          { title: "Coach Panel", items: coachFeatures },
          ...(other.length ? [{ title: "Other", items: other }] : []),
        ].map(group => group.items.length > 0 && (
          <div key={group.title} style={card}>
            <div style={{ padding: "12px 16px", background: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--main)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{group.title}</p>
            </div>
            {group.items.map(s => {
              const val = editMap[s.setting_key] ?? "";
              const isOn = val === "1" || val === "true";
              const niceName = (s.label || s.setting_key).replace(/^(User: |Coach: )/, "");
              return (
                <div key={s.setting_key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{niceName}</span>
                  <Toggle value={isOn} onChange={v => setEditMap(m => ({ ...m, [s.setting_key]: v ? "1" : "0" }))} />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  function renderPayments() {
    const ps = paySettings;
    const set = (key: string, val: string) => setPaySettings(s => ({ ...s, [key]: val }));
    const tog = (key: string) => set(key, ps[key] === "1" ? "0" : "1");
    const inp = (key: string, label: string, hint: string, type = "text") => (
      <PayField label={label} hint={hint}>
        <input style={inputStyle} type={type === "secret" ? (showSecrets ? "text" : "password") : type} value={ps[key] || ""} onChange={e => set(key, e.target.value)} placeholder="..." />
      </PayField>
    );

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" onClick={() => setShowSecrets(s => !s)} style={{
            background: "none", border: "1px solid var(--border)", borderRadius: 10, padding: "6px 12px",
            cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 5, fontSize: 12,
          }}>
            {showSecrets ? <EyeOff size={13} /> : <Eye size={13} />} {showSecrets ? "Hide" : "Show"} secrets
          </button>
        </div>

        {/* Manual e-wallet — primary payment path for Egypt. Users transfer
            to one of the published wallet numbers from their phone wallet
            and upload a screenshot. An admin reviews + activates.
            (The Paymob automated processor was removed in v3.0.) */}
        <SectionCard color="#00A8E0" emoji="&#128241;" title="Mobile Wallet (Manual)" sub="Vodafone Cash · Orange Cash · WE Pay">
          <ModeBlock enabled={true} onToggle={() => {}}
            badge="&#128336; Reviewed by admin" badgeColor="var(--amber)"
            desc="Users transfer to your wallets and upload a screenshot. Admin reviews and activates.">
            {inp("ewallet_phone_vodafone", "Vodafone Cash number", "Your registered Vodafone Cash number", "tel")}
            {inp("ewallet_phone_orange", "Orange Cash number", "Your registered Orange Cash number", "tel")}
            {inp("ewallet_phone_we", "WE Pay number", "Your registered WE Pay number", "tel")}
          </ModeBlock>
        </SectionCard>

        <SectionCard color="#0070BA" emoji="&#127359;" title="PayPal" sub="PayPal, Credit/debit card, Google Pay, Apple Pay">
          <ModeBlock enabled={ps.pm_paypal === "1"} onToggle={() => tog("pm_paypal")}
            badge="&#9889; Automated" badgeColor="var(--green)"
            desc="PayPal JS SDK renders payment buttons in the app.">
            {inp("paypal_user_client_id", "Client ID", "developer.paypal.com > My Apps")}
            {inp("paypal_user_secret", "Secret Key", "Same app page > Show > copy Secret", "secret")}
            <PayField label="Mode" hint="Sandbox for testing, Live for real payments">
              <div style={{ display: "flex", gap: 8 }}>
                {(["sandbox", "live"] as const).map(m => (
                  <button key={m} type="button" onClick={() => set("paypal_mode", m)} style={{
                    flex: 1, padding: "9px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 12,
                    border: `2px solid ${ps.paypal_mode === m ? (m === "live" ? "var(--red)" : "var(--amber)") : "var(--border)"}`,
                    background: ps.paypal_mode === m ? (m === "live" ? "rgba(248,113,113,0.1)" : "rgba(251,191,36,0.1)") : "var(--bg-surface)",
                    color: ps.paypal_mode === m ? (m === "live" ? "var(--red)" : "var(--amber)") : "var(--text-muted)",
                  }}>
                    {m === "sandbox" ? "Sandbox" : "Live"}
                  </button>
                ))}
              </div>
            </PayField>
            {inp("paypal_webhook_id", "Webhook ID", "PayPal Developer > Webhooks")}
            <WebhookInfo url="https://your-domain.com/api/pay/webhook/paypal" />
          </ModeBlock>
        </SectionCard>

        <SectionCard color="#34A853" emoji="&#129302;" title="Google Play (Android IAP)" sub="In-app purchase for Android">
          <ModeBlock enabled={ps.google_play_enabled === "1"} onToggle={() => tog("google_play_enabled")}
            badge="Android" badgeColor="var(--green)"
            desc="Android users see a native Google Play purchase button.">
            {inp("google_play_product_id_monthly", "Monthly Subscription ID", "Google Play Console > Monetize > Subscriptions")}
            {inp("google_play_product_id_annual", "Annual Subscription ID", "Separate subscription product for annual")}
          </ModeBlock>
        </SectionCard>

        <SectionCard color="#555" emoji="&#127822;" title="App Store (iOS IAP)" sub="In-app purchase for iOS">
          <ModeBlock enabled={ps.apple_pay_enabled === "1"} onToggle={() => tog("apple_pay_enabled")}
            badge="iOS" badgeColor="var(--text-secondary)"
            desc="iOS users see a native App Store purchase button.">
            {inp("apple_pay_product_id_monthly", "Monthly Subscription ID", "App Store Connect > Subscriptions")}
            {inp("apple_pay_product_id_annual", "Annual Subscription ID", "Separate subscription group for annual")}
          </ModeBlock>
        </SectionCard>

        <SectionCard color="var(--green)" emoji="&#128176;" title="Revenue Split" sub="Earnings split between coaches and platform">
          <div style={{ display: "flex", gap: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Coach receives (%)</label>
              <input style={inputStyle} type="number" min="0" max="100" value={ps.coach_cut_percentage || ""} onChange={e => set("coach_cut_percentage", e.target.value)} />
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Platform keeps {100 - Number(ps.coach_cut_percentage || 85)}%</p>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>EGP to USD rate</label>
              <input style={inputStyle} type="number" step="0.01" value={ps.egp_usd_rate || ""} onChange={e => set("egp_usd_rate", e.target.value)} placeholder="Leave empty for live rate" />
            </div>
          </div>
        </SectionCard>
      </div>
    );
  }

  function renderSystem() {
    const sysCard: CSSProperties = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 22px" };
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Database Backup */}
        <div style={sysCard}>
          <p style={{ fontFamily: "var(--font-heading)", fontSize: 15, fontWeight: 700, marginBottom: 6 }}>🗄️ Database Backup</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>
            Download a full SQL dump of the database. Includes all tables and rows — safe to restore on any MySQL server.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
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
              }}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 22px", borderRadius: 99,
                background: "var(--main)", color: "#fff", textDecoration: "none",
                fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 14, boxShadow: "0 4px 14px var(--main-glow)" }}>
              ⬇ Download Database (.sql)
            </a>
            <button onClick={() => restoreInputRef.current?.click()} disabled={restoringDb}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 22px", borderRadius: 99,
                background: "var(--bg-surface)", color: restoringDb ? "var(--text-muted)" : "var(--text-primary)",
                cursor: restoringDb ? "not-allowed" : "pointer",
                fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 14, border: "1px solid var(--border)" }}>
              {restoringDb ? "⏳ Restoring…" : "⬆ Upload Database (.sql)"}
            </button>
            <input ref={restoreInputRef} type="file" accept=".sql" hidden
              onChange={e => { handleDatabaseRestore(e.target.files?.[0]); }} />
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12 }}>💡 Store backups securely. This file contains all user data.</p>
        </div>

        {/* Fake Accounts Generator */}
        <div style={sysCard}>
          <p style={{ fontFamily: "var(--font-heading)", fontSize: 15, fontWeight: 700, marginBottom: 6 }}>👥 Fake Accounts Generator</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>
            Generate realistic fake user accounts with complete onboarding profiles for testing.
          </p>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {[5, 10, 20, 50, 100].map(n => (
              <button key={n} onClick={() => setGenCount(n)}
                style={{ padding: "8px 16px", borderRadius: 10, border: `1.5px solid ${genCount === n ? "var(--main)" : "var(--border)"}`, background: genCount === n ? "var(--main-dim)" : "var(--bg-surface)", color: genCount === n ? "var(--main)" : "var(--text-secondary)", fontWeight: genCount === n ? 700 : 400, fontSize: 13, cursor: "pointer" }}>
                {n}
              </button>
            ))}
            <input type="number" min={1} max={500} value={genCount}
              onChange={e => setGenCount(Math.min(500, Math.max(1, +e.target.value)))}
              style={{ width: 80, padding: "8px 10px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 13 }} />
            <button onClick={async () => {
              setGenLoading(true); setGenMsg("");
              try {
                const res = await api("/api/admin/generate-fake-users", { method: "POST", body: JSON.stringify({ count: genCount }) });
                const d = await res.json();
                if (res.ok) setGenMsg(`✅ Created ${d.created} fake users`);
                else setGenMsg("❌ " + (d.message || "Failed"));
              } catch { setGenMsg("❌ Request failed"); }
              setGenLoading(false);
            }} disabled={genLoading}
              style={{ padding: "10px 22px", borderRadius: 99, background: genLoading ? "var(--bg-surface)" : "var(--main)",
                color: genLoading ? "var(--text-muted)" : "#fff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 14, border: "none", cursor: genLoading ? "not-allowed" : "pointer" }}>
              {genLoading ? "Generating…" : `+ Add ${genCount} Fake Users`}
            </button>
            <button onClick={async () => {
              if (!confirm("Remove ALL fake users now?")) return;
              setRemoveFakeLoading(true); setGenMsg("");
              try {
                const res = await api("/api/admin/fake-users", { method: "DELETE" });
                const d = await res.json().catch(() => ({}));
                if (res.ok) setGenMsg(`✅ ${d?.message || "Fake users removed"}`);
                else setGenMsg(`❌ ${d?.message || "Failed to remove fake users"}`);
              } catch { setGenMsg("❌ Failed to remove fake users"); }
              finally { setRemoveFakeLoading(false); }
            }} disabled={removeFakeLoading}
              style={{ padding: "10px 18px", borderRadius: 99, background: removeFakeLoading ? "var(--bg-surface)" : "rgba(255,68,68,0.1)",
                color: removeFakeLoading ? "var(--text-muted)" : "var(--red)", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 13,
                border: "1px solid rgba(255,68,68,0.35)", cursor: removeFakeLoading ? "not-allowed" : "pointer" }}>
              {removeFakeLoading ? "Removing…" : "🗑 Remove All Fake Accounts"}
            </button>
          </div>
          {genMsg && <p style={{ fontSize: 13, marginTop: 12, color: genMsg.startsWith("✅") ? "var(--green)" : "var(--red)" }}>{genMsg}</p>}
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10 }}>⚠️ Fake accounts use the password <code>FakePass!2025</code> and are tagged with <code>fake.</code> email prefix.</p>
        </div>

        {/* Admin Preferences */}
        <div style={sysCard}>
          <p style={{ fontFamily: "var(--font-heading)", fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Admin Preferences</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelStyle}>Name</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input className="input-base" type="text" value={adminName} onChange={e => setAdminName(e.target.value)} placeholder="Admin name" style={{ flex: 1 }} />
                <button onClick={saveAdminName}
                  style={{ padding: "10px 14px", borderRadius: 99, backgroundColor: "var(--accent)", color: "#000000", border: "none", fontFamily: "var(--font-heading)", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                  Save Name
                </button>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 2 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600 }}>Mode</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Toggle between light and dark theme</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Sun size={16} color={!isDark ? "var(--amber)" : "var(--text-muted)"} />
                <button className={`theme-toggle ${!isDark ? "active" : ""}`} onClick={toggleTheme} />
                <Moon size={16} color={isDark ? "var(--blue)" : "var(--text-muted)"} />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600 }}>Language</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Choose admin panel language</p>
              </div>
              <select value={lang} onChange={e => setLang(e.target.value as any)} className="input-base"
                style={{ width: 150, padding: "8px 10px", fontSize: 12 }}>
                <option value="en">English</option>
                <option value="ar">العربية</option>
              </select>
            </div>
          </div>
        </div>

        {/* Backend Server URL */}
        <div style={sysCard}>
          <p style={{ fontFamily: "var(--font-heading)", fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🌐 Backend Server URL</p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>
            Set the full backend URL for mobile (Capacitor) builds. Leave empty to use relative paths (default for web).
            <br />Example: <strong>https://api.fitwayhub.com</strong> or <strong>http://192.168.1.100:3000</strong>
          </p>
          <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
            <input className="input-base" type="url" value={serverUrl} onChange={e => setServerUrl(e.target.value)} placeholder="https://api.fitwayhub.com" style={{ flex: 1 }} />
            <button onClick={testServerUrl} disabled={serverUrlTesting}
              style={{ padding: "10px 16px", borderRadius: 99, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-secondary)", fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 12, cursor: serverUrlTesting ? "not-allowed" : "pointer", whiteSpace: "nowrap", opacity: serverUrlTesting ? 0.6 : 1 }}>
              {serverUrlTesting ? "Testing…" : "🔗 Test"}
            </button>
          </div>
          {serverUrlMsg && (
            <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 99,
              backgroundColor: serverUrlMsg.startsWith("✅") ? "rgba(0,220,130,0.1)" : serverUrlMsg.startsWith("⚠") ? "rgba(255,170,0,0.1)" : "rgba(255,68,68,0.1)",
              border: `1px solid ${serverUrlMsg.startsWith("✅") ? "rgba(0,220,130,0.3)" : serverUrlMsg.startsWith("⚠") ? "rgba(255,170,0,0.3)" : "rgba(255,68,68,0.3)"}`,
              fontSize: 13, fontWeight: 600,
              color: serverUrlMsg.startsWith("✅") ? "var(--accent)" : serverUrlMsg.startsWith("⚠") ? "var(--amber)" : "var(--red)" }}>
              {serverUrlMsg}
            </div>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button onClick={saveServerUrl} disabled={serverUrlSaving}
              style={{ flex: 1, padding: "11px", borderRadius: 99, backgroundColor: "var(--accent)", color: "#000000",
                fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 13, border: "none",
                cursor: serverUrlSaving ? "not-allowed" : "pointer", opacity: serverUrlSaving ? 0.7 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Save size={14} /> {serverUrlSaving ? "Saving…" : "Save Server URL"}
            </button>
            {serverUrl && (
              <button onClick={() => { setServerUrl(""); localStorage.removeItem("fitway_server_url"); setServerUrlMsg("✅ Cleared — using relative paths (web mode)"); setTimeout(() => setServerUrlMsg(""), 4000); }}
                style={{ padding: "11px 18px", borderRadius: 99, border: "1px solid rgba(255,68,68,0.3)", background: "rgba(255,68,68,0.06)", color: "var(--red)", fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isPayments = activeTab === "payments";
  const isFeatures = activeTab === "features";
  const isSystem = activeTab === "system";

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 16px 48px" }}>
      {flash && (
        <div style={{
          position: "fixed", top: 16, right: 16, zIndex: 9999,
          background: "var(--bg-card)", border: `1px solid ${flash.ok ? "#4ADE80" : "#FB7185"}`,
          borderRadius: 12, padding: "12px 18px", fontSize: 13, fontWeight: 600,
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)", color: "var(--text-primary)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {flash.ok ? <CheckCircle size={15} color="#4ADE80" /> : <XCircle size={15} color="#FB7185" />}
          {flash.msg}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--main-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Settings size={20} color="var(--main)" />
          </div>
          <div>
            <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 22, fontWeight: 800, margin: 0 }}>{l("Settings", "\u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a")}</h1>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>{l("Manage application configuration", "\u0625\u062f\u0627\u0631\u0629 \u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0627\u0644\u062a\u0637\u0628\u064a\u0642")}</p>
          </div>
        </div>
        <button onClick={() => { fetchSettings(); fetchPaymentSettings(); }} style={{
          display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10,
          border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer",
        }}>
          <RefreshCw size={13} /> {l("Refresh", "\u062a\u062d\u062f\u064a\u062b")}
        </button>
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ ...card, width: 200, flexShrink: 0 }}>
          {CATEGORIES.map(({ key, label, icon: Icon, desc }) => (
            <button key={key} onClick={() => setActiveTab(key)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "12px 14px", background: activeTab === key ? "var(--main-dim)" : "transparent",
              border: "none", cursor: "pointer", textAlign: "left",
              borderLeft: activeTab === key ? "3px solid var(--main)" : "3px solid transparent",
              transition: "all 0.15s",
            }}>
              <Icon size={15} color={activeTab === key ? "var(--main)" : "var(--text-muted)"} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: activeTab === key ? "var(--main)" : "var(--text-primary)" }}>{label}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{desc}</div>
              </div>
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                {CATEGORIES.find(c => c.key === activeTab)?.label}
              </h2>
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>
                {CATEGORIES.find(c => c.key === activeTab)?.desc}
              </p>
            </div>
            {!isSystem && <button
              onClick={isPayments ? savePaymentSettings : saveAppSettings}
              disabled={saving || (!isPayments && filtered.length === 0)}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10,
                border: "none", background: saving ? "var(--bg-surface)" : "var(--main)",
                color: saving ? "var(--text-muted)" : "#fff", fontSize: 12, fontWeight: 700,
                cursor: saving ? "not-allowed" : "pointer", fontFamily: "var(--font-heading)",
              }}
            >
              <Save size={13} /> {saving ? l("Saving...", "\u062c\u0627\u0631\u064a \u0627\u0644\u062d\u0641\u0638...") : l("Save", "\u062d\u0641\u0638")}
            </button>}
          </div>

          {isSystem ? renderSystem() : isPayments ? (
            payLoading ? (
              <div style={{ ...card, padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                Loading...
              </div>
            ) : renderPayments()
          ) : loading ? (
            <div style={{ ...card, padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              Loading settings...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ ...card, padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              {l("No settings in this category yet.", "\u0644\u0627 \u062a\u0648\u062c\u062f \u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0641\u064a \u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645.")}
            </div>
          ) : isFeatures ? renderFeatures() : (
            <div style={card}>
              {filtered.map(s => (
                <div key={s.setting_key}>{renderField(s)}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
