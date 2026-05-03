import { useState, useEffect, useCallback } from "react";
import {
  Settings, ToggleLeft, ToggleRight, Save, RefreshCw, History,
  Shield, DollarSign, Target, Image as ImageIcon, Flag,
  ChevronRight, CheckCircle, AlertTriangle, Globe, Layers,
  Eye, BarChart2, Zap, Clock, Lock, Plus, Trash2, Edit2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { getApiBase } from "@/lib/api";
import axios from "axios";

const API = getApiBase();

interface Setting { setting_key: string; setting_value: string; setting_type: string; label: string; category: string; description?: string; }
interface Placement { id: number; placement_key: string; label: string; enabled: boolean; max_ads: number; priority_order: number; frequency_cap_hours: number; }
interface Flag { id: number; flag_key: string; label: string; enabled: boolean; description?: string; }
interface ApprovalRule { id: number; rule_name: string; rule_type: string; conditions: string; enabled: boolean; priority: number; }
interface Preset { id: number; preset_type: string; name: string; description?: string; config: string; is_default: boolean; }
interface Overview { campaigns: { total: number; active: number; pending: number }; pending_reviews: number; events_today: number; spend_today: number; }

const CATEGORY_META: Record<string, { label: string; icon: any; color: string; desc: string }> = {
  global:     { label: "Global Settings",     icon: Globe,      color: "#FFD600", desc: "Master on/off switches for the ads system" },
  budget:     { label: "Budget Controls",     icon: DollarSign, color: "#10b981", desc: "Spending limits and auto-pause rules" },
  targeting:  { label: "Targeting Settings",  icon: Target,     color: "#3b82f6", desc: "What targeting options coaches can use" },
  creatives:  { label: "Creative Settings",   icon: ImageIcon,  color: "#f59e0b", desc: "Allowed formats, sizes and templates" },
  moderation: { label: "Moderation Rules",    icon: Shield,     color: "#ef4444", desc: "Auto-flagging, approval workflow" },
  reporting:  { label: "Reporting Settings",  icon: BarChart2,  color: "#8b5cf6", desc: "Analytics refresh, exports, windows" },
  security:   { label: "Security & Audit",    icon: Lock,       color: "#ec4899", desc: "Audit logs, rate limits, session policy" },
};

export default function AdminAdSettings() {
  const { token } = useAuth();
  const { lang } = useI18n();
  const l = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const headers = { Authorization: `Bearer ${token}` };

  const [tab, setTab] = useState<"settings" | "placements" | "flags" | "approvals" | "presets" | "history" | "overview">("overview");
  const [grouped, setGrouped] = useState<Record<string, Setting[]>>({});
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [rules, setRules] = useState<ApprovalRule[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Record<string, string>>({});
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sett, plac, fl, rul, pre, hist, ov] = await Promise.all([
        axios.get(`${API}/api/ad-settings`, { headers }),
        axios.get(`${API}/api/ad-settings/placements`, { headers }),
        axios.get(`${API}/api/ad-settings/feature-flags`, { headers }),
        axios.get(`${API}/api/ad-settings/approval-rules`, { headers }),
        axios.get(`${API}/api/ad-settings/presets`, { headers }),
        axios.get(`${API}/api/ad-settings/history`, { headers }),
        axios.get(`${API}/api/ad-settings/overview`, { headers }),
      ]);
      setGrouped(sett.data.grouped || {});
      setPlacements(plac.data.placements || []);
      setFlags(fl.data.flags || []);
      setRules(rul.data.rules || []);
      setPresets(pre.data.presets || []);
      setHistory(hist.data.history || []);
      setOverview(ov.data);
    } catch { } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const saveSetting = async (key: string, value: string) => {
    setSaving(key);
    try {
      await axios.patch(`${API}/api/ad-settings/${key}`, { value }, { headers });
      const sett = await axios.get(`${API}/api/ad-settings`, { headers });
      setGrouped(sett.data.grouped || {});
      setDirty(d => { const n = { ...d }; delete n[key]; return n; });
      showToast(l("Setting saved", "تم حفظ الإعداد"));
    } catch { showToast(l("Save failed", "فشل الحفظ")); } finally { setSaving(null); }
  };

  const toggleFlag = async (key: string, current: boolean) => {
    try {
      await axios.patch(`${API}/api/ad-settings/feature-flags/${key}`, { enabled: !current }, { headers });
      setFlags(prev => prev.map(f => f.flag_key === key ? { ...f, enabled: !current } : f));
      showToast(`${key} ${!current ? l("enabled", "مفعل") : l("disabled", "معطل")}`);
    } catch { showToast(l("Update failed", "فشل التحديث")); }
  };

  const togglePlacement = async (key: string, current: boolean) => {
    try {
      await axios.patch(`${API}/api/ad-settings/placements/${key}`, { enabled: !current }, { headers });
      setPlacements(prev => prev.map(p => p.placement_key === key ? { ...p, enabled: !current } : p));
      showToast(`${key} ${!current ? l("enabled", "مفعل") : l("disabled", "معطل")}`);
    } catch { showToast(l("Update failed", "فشل التحديث")); }
  };

  const updatePlacementField = async (key: string, field: string, value: number) => {
    try {
      await axios.patch(`${API}/api/ad-settings/placements/${key}`, { [field]: value }, { headers });
      setPlacements(prev => prev.map(p => p.placement_key === key ? { ...p, [field]: value } : p));
      showToast(l("Placement updated", "تم تحديث الموضع"));
    } catch { showToast(l("Update failed", "فشل التحديث")); }
  };

  const deleteRule = async (id: number) => {
    if (!confirm(l("Delete this rule?", "هل تريد حذف هذه القاعدة؟"))) return;
    await axios.delete(`${API}/api/ad-settings/approval-rules/${id}`, { headers });
    setRules(prev => prev.filter(r => r.id !== id));
    showToast(l("Rule deleted", "تم حذف القاعدة"));
  };

  const deletePreset = async (id: number) => {
    if (!confirm(l("Delete this preset?", "هل تريد حذف هذا القالب المسبق؟"))) return;
    await axios.delete(`${API}/api/ad-settings/presets/${id}`, { headers });
    setPresets(prev => prev.filter(p => p.id !== id));
    showToast(l("Preset deleted", "تم حذف القالب المسبق"));
  };

  const renderSettingControl = (s: Setting) => {
    const pending = dirty[s.setting_key] !== undefined ? dirty[s.setting_key] : s.setting_value;

    if (s.setting_type === "boolean") {
      const isOn = pending === "true";
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => { const nv = isOn ? "false" : "true"; setDirty(d => ({ ...d, [s.setting_key]: nv })); saveSetting(s.setting_key, nv); }} style={{ background: "none", border: "none", cursor: "pointer", color: isOn ? "var(--accent)" : "var(--text-muted)", display: "flex", alignItems: "center", transition: "color 0.15s" }}>
            {saving === s.setting_key ? <RefreshCw size={22} style={{ animation: "spin 1s linear infinite" }} /> : isOn ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
          </button>
          <span style={{ fontSize: 12, color: isOn ? "var(--accent)" : "var(--text-muted)", fontWeight: 600 }}>{isOn ? l("ON", "تشغيل") : l("OFF", "إيقاف")}</span>
        </div>
      );
    }

    if (s.setting_type === "integer") {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="number" defaultValue={s.setting_value} onChange={e => setDirty(d => ({ ...d, [s.setting_key]: e.target.value }))} style={{ width: 90, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 13, textAlign: "right" }} />
          <button onClick={() => saveSetting(s.setting_key, dirty[s.setting_key] ?? s.setting_value)} style={{ padding: "6px 12px", borderRadius: 8, background: dirty[s.setting_key] !== undefined ? "var(--accent)" : "var(--bg-surface)", border: "1px solid var(--border)", color: dirty[s.setting_key] !== undefined ? "#000" : "var(--text-muted)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            {saving === s.setting_key ? <RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={12} />}
          </button>
        </div>
      );
    }

    if (s.setting_type === "string") {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input defaultValue={s.setting_value} onChange={e => setDirty(d => ({ ...d, [s.setting_key]: e.target.value }))} style={{ width: 140, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 13 }} />
          <button onClick={() => saveSetting(s.setting_key, dirty[s.setting_key] ?? s.setting_value)} style={{ padding: "6px 12px", borderRadius: 8, background: dirty[s.setting_key] !== undefined ? "var(--accent)" : "var(--bg-surface)", border: "1px solid var(--border)", color: dirty[s.setting_key] !== undefined ? "#000" : "var(--text-muted)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            <Save size={12} />
          </button>
        </div>
      );
    }

    // JSON type - textarea
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <textarea defaultValue={s.setting_value} onChange={e => setDirty(d => ({ ...d, [s.setting_key]: e.target.value }))} rows={2} style={{ width: 200, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 11, fontFamily: "monospace", resize: "none" }} />
        <button onClick={() => saveSetting(s.setting_key, dirty[s.setting_key] ?? s.setting_value)} style={{ padding: "6px 12px", borderRadius: 8, background: dirty[s.setting_key] !== undefined ? "var(--accent)" : "var(--bg-surface)", border: "1px solid var(--border)", color: dirty[s.setting_key] !== undefined ? "#000" : "var(--text-muted)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
          <Save size={12} />
        </button>
      </div>
    );
  };

  const TABS = [
    { key: "overview",   label: l("Overview", "نظرة عامة"),   icon: BarChart2 },
    { key: "settings",   label: l("Settings", "الإعدادات"),   icon: Settings },
    { key: "placements", label: l("Placements", "المواضع"), icon: Layers },
    { key: "flags",      label: l("Features", "الميزات"),   icon: Zap },
    { key: "approvals",  label: l("Approvals", "الموافقات"),  icon: CheckCircle },
    { key: "presets",    label: l("Presets", "القوالب"),    icon: Flag },
    { key: "history",    label: l("History", "السجل"),    icon: History },
  ] as const;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 20px", fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
          <CheckCircle size={13} color="var(--accent)" style={{ verticalAlign: "middle", marginRight: 6 }} />{toast}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontFamily: "var(--font-en)", marginBottom: 4 }}>{l("Ad System Settings", "إعدادات نظام الإعلانات")}</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{l("Master control panel for FitWayHub's internal promotion engine", "لوحة التحكم الرئيسية لمحرك الإعلانات الداخلي في FitWayHub")}</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 28, background: "var(--bg-surface)", borderRadius: 14, padding: 4, overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, minWidth: 80, padding: "9px 12px", borderRadius: 10, border: "none", background: tab === t.key ? "var(--bg-card)" : "transparent", color: tab === t.key ? "var(--text-primary)" : "var(--text-muted)", fontWeight: tab === t.key ? 700 : 400, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, transition: "all 0.15s", boxShadow: tab === t.key ? "0 1px 4px rgba(0,0,0,0.2)" : "none", whiteSpace: "nowrap" }}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <RefreshCw size={24} color="var(--accent)" style={{ animation: "spin 1s linear infinite" }} />
        </div>
      ) : (
        <>
          {/* ── Overview ────────────────────────────────────────────────── */}
          {tab === "overview" && overview && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
                {[
                  { label: l("Total Campaigns", "إجمالي الحملات"),  value: overview.campaigns?.total ?? 0,         icon: Layers,         color: "#FFD600" },
                  { label: l("Active Campaigns", "الحملات النشطة"), value: overview.campaigns?.active ?? 0,         icon: CheckCircle,    color: "#10b981" },
                  { label: l("Pending Reviews", "المراجعات المعلقة"),  value: overview.pending_reviews ?? 0,           icon: Clock,          color: "#f59e0b" },
                  { label: l("Events Today", "أحداث اليوم"),     value: overview.events_today ?? 0,              icon: Eye,            color: "#3b82f6" },
                ].map(card => (
                  <div key={card.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px" }}>
                    <card.icon size={18} color={card.color} style={{ marginBottom: 8 }} />
                    <p style={{ fontSize: 28, fontWeight: 800, fontFamily: "var(--font-en)", color: card.color }}>{card.value}</p>
                    <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{card.label}</p>
                  </div>
                ))}
              </div>

              {/* Quick settings summary */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {Object.entries(CATEGORY_META).map(([cat, meta]) => {
                  const catSettings = grouped[cat] || [];
                  const toggleCount = catSettings.filter(s => s.setting_type === "boolean" && s.setting_value === "true").length;
                  return (
                    <div key={cat} onClick={() => setTab("settings")} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "18px 20px", cursor: "pointer", display: "flex", gap: 14, alignItems: "center", transition: "border-color 0.15s" }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${meta.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <meta.icon size={18} color={meta.color} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{meta.label}</p>
                        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{catSettings.length} {l("settings", "إعداد")} · {toggleCount} {l("active", "نشط")}</p>
                      </div>
                      <ChevronRight size={14} color="var(--text-muted)" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Settings ────────────────────────────────────────────────── */}
          {tab === "settings" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {(Object.entries(grouped) as [string, Setting[]][]).map(([category, settings]) => {
                const meta = CATEGORY_META[category];
                if (!meta) return null;
                return (
                  <div key={category} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, overflow: "hidden" }}>
                    <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: `${meta.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <meta.icon size={16} color={meta.color} />
                      </div>
                      <div>
                        <p style={{ fontSize: 15, fontWeight: 700 }}>{meta.label}</p>
                        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{meta.desc}</p>
                      </div>
                    </div>
                    <div>
                      {settings.map((s, i) => (
                        <div key={s.setting_key} style={{ padding: "14px 24px", borderBottom: i < settings.length - 1 ? "1px solid var(--border-light)" : "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                          <div style={{ flex: 1, minWidth: 200 }}>
                            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{s.label}</p>
                            <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>{s.setting_key}</p>
                          </div>
                          {renderSettingControl(s)}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Placements ──────────────────────────────────────────────── */}
          {tab === "placements" && (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, overflow: "hidden" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{l("Internal Placement Surfaces", "أماكن عرض الإعلانات الداخلية")}</h2>
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{l("Control where ads appear across FitWayHub. Drag to reorder priority.", "تحكم في أماكن ظهور الإعلانات داخل FitWayHub. اسحب لإعادة ترتيب الأولوية.")}</p>
              </div>
              {placements.map((p, i) => (
                <div key={p.placement_key} style={{ padding: "16px 24px", borderBottom: i < placements.length - 1 ? "1px solid var(--border-light)" : "none", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, background: "var(--bg-surface)", padding: "2px 6px", borderRadius: 6, color: "var(--text-muted)" }}>#{p.priority_order}</span>
                      <p style={{ fontSize: 14, fontWeight: 700 }}>{p.label}</p>
                    </div>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>{p.placement_key}</p>
                  </div>
                  <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", flex: "column", gap: 2 }}>
                      <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block" }}>{l("Max Ads", "الحد الأقصى للإعلانات")}</label>
                      <input type="number" min={1} max={20} defaultValue={p.max_ads} onBlur={e => updatePlacementField(p.placement_key, "max_ads", +e.target.value)} style={{ width: 60, padding: "5px 8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 13, textAlign: "center" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block" }}>{l("Freq Cap (h)", "حد التكرار (ساعة)")}</label>
                      <input type="number" min={1} defaultValue={p.frequency_cap_hours} onBlur={e => updatePlacementField(p.placement_key, "frequency_cap_hours", +e.target.value)} style={{ width: 60, padding: "5px 8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 13, textAlign: "center" }} />
                    </div>
                    <button onClick={() => togglePlacement(p.placement_key, p.enabled)} style={{ background: "none", border: "none", cursor: "pointer", color: p.enabled ? "var(--accent)" : "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                      {p.enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                      <span style={{ fontSize: 11, fontWeight: 600 }}>{p.enabled ? l("ON", "تشغيل") : l("OFF", "إيقاف")}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Feature Flags ─────────────────────────────────────────────── */}
          {tab === "flags" && (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, overflow: "hidden" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{l("Feature Flags", "مفاتيح الميزات")}</h2>
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{l("Enable or disable experimental and advanced features system-wide.", "تفعيل أو تعطيل الميزات التجريبية والمتقدمة على مستوى النظام.")}</p>
              </div>
              {flags.map((f, i) => (
                <div key={f.flag_key} style={{ padding: "16px 24px", borderBottom: i < flags.length - 1 ? "1px solid var(--border-light)" : "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{f.label}</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>{f.flag_key}</p>
                    {f.description && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{f.description}</p>}
                  </div>
                  <button onClick={() => toggleFlag(f.flag_key, f.enabled)} style={{ background: "none", border: "none", cursor: "pointer", color: f.enabled ? "var(--accent)" : "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                    {f.enabled ? <ToggleRight size={30} /> : <ToggleLeft size={30} />}
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{f.enabled ? l("Enabled", "مفعل") : l("Disabled", "معطل")}</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── Approval Rules ─────────────────────────────────────────────── */}
          {tab === "approvals" && (
            <div>
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, overflow: "hidden" }}>
                <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{l("Approval Rules", "قواعد الموافقة")}</h2>
                    <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{l("Rules that determine how campaigns are reviewed and approved.", "قواعد تحدد كيفية مراجعة الحملات والموافقة عليها.")}</p>
                  </div>
                </div>
                {rules.map((r, i) => {
                  const typeColor: Record<string, string> = { auto_approve: "#10b981", require_review: "#f59e0b", auto_reject: "#ef4444", flag: "#3b82f6" };
                  return (
                    <div key={r.id} style={{ padding: "16px 24px", borderBottom: i < rules.length - 1 ? "1px solid var(--border-light)" : "none", display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ padding: "3px 9px", borderRadius: 99, fontSize: 10, fontWeight: 700, background: `${typeColor[r.rule_type] || "#888"}20`, color: typeColor[r.rule_type] || "#888" }}>
                            {r.rule_type.replace(/_/g, " ").toUpperCase()}
                          </span>
                          {!r.enabled && <span style={{ padding: "3px 9px", borderRadius: 99, fontSize: 10, fontWeight: 600, background: "var(--bg-surface)", color: "var(--text-muted)" }}>{l("DISABLED", "معطل")}</span>}
                        </div>
                        <p style={{ fontSize: 14, fontWeight: 600 }}>{r.rule_name}</p>
                        {r.conditions && <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace", marginTop: 2 }}>{r.conditions}</p>}
                      </div>
                      <button onClick={() => deleteRule(r.id)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--red)", cursor: "pointer", fontSize: 12 }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Template Presets ──────────────────────────────────────────── */}
          {tab === "presets" && (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, overflow: "hidden" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{l("Campaign Presets & Templates", "القوالب الجاهزة للحملات")}</h2>
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{l("Default templates available to coaches when creating campaigns.", "قوالب افتراضية متاحة للمدربين عند إنشاء الحملات.")}</p>
              </div>
              {["campaign", "ad_set", "budget", "creative"].map(type => {
                const typePresets = presets.filter(p => p.preset_type === type);
                return (
                  <div key={type}>
                    <div style={{ padding: "10px 24px", background: "var(--bg-surface)", borderBottom: "1px solid var(--border-light)" }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{type.replace("_", " ")} Templates</p>
                    </div>
                    {typePresets.length === 0 && <p style={{ padding: "14px 24px", fontSize: 13, color: "var(--text-muted)" }}>{l("No presets of this type.", "لا توجد قوالب من هذا النوع.")}</p>}
                    {typePresets.map((p, i) => (
                      <div key={p.id} style={{ padding: "14px 24px", borderBottom: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                            <p style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</p>
                            {p.is_default && <span style={{ padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700, background: "var(--accent-dim)", color: "var(--accent)" }}>{l("DEFAULT", "افتراضي")}</span>}
                          </div>
                          {p.description && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{p.description}</p>}
                          <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace", marginTop: 2 }}>{p.config}</p>
                        </div>
                        <button onClick={() => deletePreset(p.id)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--red)", cursor: "pointer", fontSize: 12 }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── History ─────────────────────────────────────────────────── */}
          {tab === "history" && (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, overflow: "hidden" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{l("Settings Change History", "سجل تغييرات الإعدادات")}</h2>
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{l("Full audit trail of every settings change.", "سجل تدقيق كامل لكل تغيير في الإعدادات.")}</p>
              </div>
              {history.length === 0 && <p style={{ padding: "24px", color: "var(--text-muted)", fontSize: 14 }}>{l("No history yet.", "لا يوجد سجل بعد.")}</p>}
              {history.map((h, i) => (
                <div key={h.id} style={{ padding: "14px 24px", borderBottom: i < history.length - 1 ? "1px solid var(--border-light)" : "none", display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", marginTop: 5, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{h.setting_key}</p>
                    <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      <span style={{ color: "#ef4444" }}>{h.old_value}</span> → <span style={{ color: "#10b981" }}>{h.new_value}</span>
                    </p>
                    {h.reason && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{l("Reason", "السبب")}: {h.reason}</p>}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{h.changed_by_name}</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(h.changed_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
