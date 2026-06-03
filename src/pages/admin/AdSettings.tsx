import { useState, useEffect, useCallback } from "react";
import {
  Settings, Save, RefreshCw, History,
  Shield, DollarSign, Target, Image as ImageIcon, Flag,
  ChevronRight, CheckCircle, Globe, Layers,
  Eye, BarChart2, Zap, Clock, Lock, Trash2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { getApiBase } from "@/lib/api";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const API = getApiBase();

interface Setting { setting_key: string; setting_value: string; setting_type: string; label: string; category: string; description?: string; }
interface Placement { id: number; placement_key: string; label: string; enabled: boolean; max_ads: number; priority_order: number; frequency_cap_hours: number; }
interface Flag { id: number; flag_key: string; label: string; enabled: boolean; description?: string; }
interface ApprovalRule { id: number; rule_name: string; rule_type: string; conditions: string; enabled: boolean; priority: number; }
interface Preset { id: number; preset_type: string; name: string; description?: string; config: string; is_default: boolean; }
interface Overview { campaigns: { total: number; active: number; pending: number }; pending_reviews: number; events_today: number; spend_today: number; }

const CATEGORY_META: Record<string, { label: string; icon: any; color: string; desc: string }> = {
  global:     { label: "Global Settings",     icon: Globe,      color: "var(--primary)",   desc: "Master on/off switches for the ads system" },
  budget:     { label: "Budget Controls",     icon: DollarSign, color: "var(--green)",     desc: "Spending limits and auto-pause rules" },
  targeting:  { label: "Targeting Settings",  icon: Target,     color: "var(--secondary)", desc: "What targeting options coaches can use" },
  creatives:  { label: "Creative Settings",   icon: ImageIcon,  color: "var(--amber)",     desc: "Allowed formats, sizes and templates" },
  moderation: { label: "Moderation Rules",    icon: Shield,     color: "var(--red)",       desc: "Auto-flagging, approval workflow" },
  reporting:  { label: "Reporting Settings",  icon: BarChart2,  color: "var(--secondary)", desc: "Analytics refresh, exports, windows" },
  security:   { label: "Security & Audit",    icon: Lock,       color: "var(--primary)",   desc: "Audit logs, rate limits, session policy" },
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
    const isDirty = dirty[s.setting_key] !== undefined;
    const fieldId = `ad-setting-${s.setting_key}`;

    if (s.setting_type === "boolean") {
      const isOn = pending === "true";
      return (
        <div className="flex items-center gap-2.5">
          {saving === s.setting_key && <RefreshCw size={16} strokeWidth={2} className="animate-spin text-muted-foreground" />}
          <Switch
            id={fieldId}
            checked={isOn}
            onCheckedChange={(v) => { const nv = v ? "true" : "false"; setDirty(d => ({ ...d, [s.setting_key]: nv })); saveSetting(s.setting_key, nv); }}
            disabled={saving === s.setting_key}
            aria-label={s.label}
          />
        </div>
      );
    }

    if (s.setting_type === "integer") {
      return (
        <div className="flex items-center gap-2">
          <Input id={fieldId} type="number" defaultValue={s.setting_value} onChange={e => setDirty(d => ({ ...d, [s.setting_key]: e.target.value }))} aria-label={s.label} className="h-9 w-[90px] text-end" />
          <Button size="icon-sm" variant={isDirty ? "default" : "outline"} onClick={() => saveSetting(s.setting_key, dirty[s.setting_key] ?? s.setting_value)} disabled={saving === s.setting_key} aria-label={l("Save", "حفظ")}>
            {saving === s.setting_key ? <RefreshCw size={14} strokeWidth={2} className="animate-spin" /> : <Save size={14} strokeWidth={2} />}
          </Button>
        </div>
      );
    }

    if (s.setting_type === "string") {
      return (
        <div className="flex items-center gap-2">
          <Input id={fieldId} defaultValue={s.setting_value} onChange={e => setDirty(d => ({ ...d, [s.setting_key]: e.target.value }))} aria-label={s.label} className="h-9 w-[140px]" />
          <Button size="icon-sm" variant={isDirty ? "default" : "outline"} onClick={() => saveSetting(s.setting_key, dirty[s.setting_key] ?? s.setting_value)} disabled={saving === s.setting_key} aria-label={l("Save", "حفظ")}>
            <Save size={14} strokeWidth={2} />
          </Button>
        </div>
      );
    }

    // JSON type - textarea
    return (
      <div className="flex items-start gap-2">
        <Textarea id={fieldId} defaultValue={s.setting_value} onChange={e => setDirty(d => ({ ...d, [s.setting_key]: e.target.value }))} rows={2} aria-label={s.label} className="min-h-0 w-[200px] resize-none py-2 font-mono text-[11px]" />
        <Button size="icon-sm" variant={isDirty ? "default" : "outline"} onClick={() => saveSetting(s.setting_key, dirty[s.setting_key] ?? s.setting_value)} disabled={saving === s.setting_key} aria-label={l("Save", "حفظ")}>
          <Save size={14} strokeWidth={2} />
        </Button>
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
    <div className="space-y-6" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Toast */}
      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-6 left-1/2 z-[9999] flex -translate-x-1/2 items-center gap-2 rounded-md bg-card px-5 py-2.5 text-[13px] font-semibold text-foreground shadow-soft-lg ring-1 ring-inset ring-border">
          <CheckCircle size={14} strokeWidth={2} className="text-primary" />{toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
          <Settings size={20} strokeWidth={2} />
        </span>
        <div>
          <h1 className="text-[26px] leading-tight font-bold tracking-tight">{l("Ad System Settings", "إعدادات نظام الإعلانات")}</h1>
          <p className="text-[13px] text-muted-foreground">{l("Master control panel for FitWayHub's internal promotion engine", "لوحة التحكم الرئيسية لمحرك الإعلانات الداخلي في FitWayHub")}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="h-auto w-full flex-wrap p-1">
          {TABS.map(t => (
            <TabsTrigger key={t.key} value={t.key} className="min-w-[80px] flex-1 py-2">
              <t.icon size={14} strokeWidth={2} /> {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
        </div>
      ) : (
        <>
          {/* ── Overview ────────────────────────────────────────────────── */}
          {tab === "overview" && overview && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
                {[
                  { label: l("Total Campaigns", "إجمالي الحملات"),  value: overview.campaigns?.total ?? 0,         icon: Layers,         color: "var(--primary)" },
                  { label: l("Active Campaigns", "الحملات النشطة"), value: overview.campaigns?.active ?? 0,         icon: CheckCircle,    color: "var(--green)" },
                  { label: l("Pending Reviews", "المراجعات المعلقة"),  value: overview.pending_reviews ?? 0,           icon: Clock,          color: "var(--amber)" },
                  { label: l("Events Today", "أحداث اليوم"),     value: overview.events_today ?? 0,              icon: Eye,            color: "var(--secondary)" },
                ].map(card => (
                  <Card key={card.label} className="gap-0 p-5">
                    <card.icon size={18} strokeWidth={2} className="mb-2" style={{ color: card.color }} />
                    <p className="text-[28px] leading-tight font-bold tabular-nums tracking-tight text-foreground">{card.value}</p>
                    <p className="text-[12px] text-muted-foreground">{card.label}</p>
                  </Card>
                ))}
              </div>

              {/* Quick settings summary */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {Object.entries(CATEGORY_META).map(([cat, meta]) => {
                  const catSettings = grouped[cat] || [];
                  const toggleCount = catSettings.filter(s => s.setting_type === "boolean" && s.setting_value === "true").length;
                  return (
                    <Card key={cat} asChild className="gap-0 p-0">
                      <button type="button" onClick={() => setTab("settings")} className="flex items-center gap-3.5 px-5 py-4 text-start transition-shadow hover:shadow-soft">
                        <span className="grid size-10 shrink-0 place-items-center rounded-md" style={{ background: `color-mix(in srgb, ${meta.color} 15%, transparent)`, color: meta.color }}>
                          <meta.icon size={18} strokeWidth={2} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-semibold text-foreground">{meta.label}</p>
                          <p className="text-[12px] text-muted-foreground">{catSettings.length} {l("settings", "إعداد")} · {toggleCount} {l("active", "نشط")}</p>
                        </div>
                        <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-muted-foreground rtl:rotate-180" />
                      </button>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Settings ────────────────────────────────────────────────── */}
          {tab === "settings" && (
            <div className="flex flex-col gap-5">
              {(Object.entries(grouped) as [string, Setting[]][]).map(([category, settings]) => {
                const meta = CATEGORY_META[category];
                if (!meta) return null;
                return (
                  <Card key={category} className="gap-0 overflow-hidden p-0">
                    <div className="flex items-center gap-3 bg-muted px-5 py-3.5">
                      <span className="grid size-9 shrink-0 place-items-center rounded-md" style={{ background: `color-mix(in srgb, ${meta.color} 15%, transparent)`, color: meta.color }}>
                        <meta.icon size={16} strokeWidth={2} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold text-foreground">{meta.label}</p>
                        <p className="mt-0.5 text-[13px] text-muted-foreground">{meta.desc}</p>
                      </div>
                    </div>
                    <div>
                      {settings.map((s, i) => (
                        <div key={s.setting_key}>
                          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5">
                            <div className="min-w-[200px] flex-1">
                              <p className="text-[14px] font-semibold text-foreground">{s.label}</p>
                              <code className="text-[11px] text-muted-foreground">{s.setting_key}</code>
                            </div>
                            {renderSettingControl(s)}
                          </div>
                          {i < settings.length - 1 && <Separator />}
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* ── Placements ──────────────────────────────────────────────── */}
          {tab === "placements" && (
            <Card className="gap-0 overflow-hidden p-0">
              <div className="bg-muted px-5 py-4">
                <h2 className="text-[16px] font-semibold text-foreground">{l("Internal Placement Surfaces", "أماكن عرض الإعلانات الداخلية")}</h2>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{l("Control where ads appear across FitWayHub. Drag to reorder priority.", "تحكم في أماكن ظهور الإعلانات داخل FitWayHub. اسحب لإعادة ترتيب الأولوية.")}</p>
              </div>
              {placements.map((p, i) => (
                <div key={p.placement_key}>
                  <div className="flex flex-wrap items-center gap-4 px-5 py-4">
                    <div className="min-w-[180px] flex-1">
                      <div className="mb-0.5 flex items-center gap-2">
                        <Badge variant="muted">#{p.priority_order}</Badge>
                        <p className="text-[14px] font-semibold text-foreground">{p.label}</p>
                      </div>
                      <code className="text-[11px] text-muted-foreground">{p.placement_key}</code>
                    </div>
                    <div className="flex flex-wrap items-end gap-3.5">
                      <div className="grid gap-1">
                        <label htmlFor={`placement-max-${p.placement_key}`} className="text-[10px] text-muted-foreground">{l("Max Ads", "الحد الأقصى للإعلانات")}</label>
                        <Input id={`placement-max-${p.placement_key}`} type="number" min={1} max={20} defaultValue={p.max_ads} onBlur={e => updatePlacementField(p.placement_key, "max_ads", +e.target.value)} className="h-9 w-[68px] text-center" />
                      </div>
                      <div className="grid gap-1">
                        <label htmlFor={`placement-freq-${p.placement_key}`} className="text-[10px] text-muted-foreground">{l("Freq Cap (h)", "حد التكرار (ساعة)")}</label>
                        <Input id={`placement-freq-${p.placement_key}`} type="number" min={1} defaultValue={p.frequency_cap_hours} onBlur={e => updatePlacementField(p.placement_key, "frequency_cap_hours", +e.target.value)} className="h-9 w-[68px] text-center" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={p.enabled} onCheckedChange={() => togglePlacement(p.placement_key, p.enabled)} aria-label={`${p.label} ${l("enabled", "مفعل")}`} />
                        <span className="text-[11px] font-semibold text-muted-foreground">{p.enabled ? l("ON", "تشغيل") : l("OFF", "إيقاف")}</span>
                      </div>
                    </div>
                  </div>
                  {i < placements.length - 1 && <Separator />}
                </div>
              ))}
            </Card>
          )}

          {/* ── Feature Flags ─────────────────────────────────────────────── */}
          {tab === "flags" && (
            <Card className="gap-0 overflow-hidden p-0">
              <div className="bg-muted px-5 py-4">
                <h2 className="text-[16px] font-semibold text-foreground">{l("Feature Flags", "مفاتيح الميزات")}</h2>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{l("Enable or disable experimental and advanced features system-wide.", "تفعيل أو تعطيل الميزات التجريبية والمتقدمة على مستوى النظام.")}</p>
              </div>
              {flags.map((f, i) => (
                <div key={f.flag_key}>
                  <div className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-foreground">{f.label}</p>
                      <code className="text-[11px] text-muted-foreground">{f.flag_key}</code>
                      {f.description && <p className="mt-0.5 text-[12px] text-muted-foreground">{f.description}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Switch checked={f.enabled} onCheckedChange={() => toggleFlag(f.flag_key, f.enabled)} aria-label={f.label} />
                      <span className="text-[12px] font-semibold text-muted-foreground">{f.enabled ? l("Enabled", "مفعل") : l("Disabled", "معطل")}</span>
                    </div>
                  </div>
                  {i < flags.length - 1 && <Separator />}
                </div>
              ))}
            </Card>
          )}

          {/* ── Approval Rules ─────────────────────────────────────────────── */}
          {tab === "approvals" && (
            <Card className="gap-0 overflow-hidden p-0">
              <div className="bg-muted px-5 py-4">
                <h2 className="text-[16px] font-semibold text-foreground">{l("Approval Rules", "قواعد الموافقة")}</h2>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{l("Rules that determine how campaigns are reviewed and approved.", "قواعد تحدد كيفية مراجعة الحملات والموافقة عليها.")}</p>
              </div>
              {rules.map((r, i) => {
                const typeVariant: Record<string, "success" | "warning" | "destructive" | "accent"> = { auto_approve: "success", require_review: "warning", auto_reject: "destructive", flag: "accent" };
                return (
                  <div key={r.id}>
                    <div className="flex items-center gap-3.5 px-5 py-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <Badge variant={typeVariant[r.rule_type] || "muted"}>
                            {r.rule_type.replace(/_/g, " ").toUpperCase()}
                          </Badge>
                          {!r.enabled && <Badge variant="muted">{l("DISABLED", "معطل")}</Badge>}
                        </div>
                        <p className="text-[14px] font-semibold text-foreground">{r.rule_name}</p>
                        {r.conditions && <code className="mt-0.5 block text-[11px] text-muted-foreground">{r.conditions}</code>}
                      </div>
                      <Button variant="outline" size="icon-sm" onClick={() => deleteRule(r.id)} aria-label={l("Delete rule", "حذف القاعدة")} className="text-destructive ring-destructive/40 hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 size={14} strokeWidth={2} />
                      </Button>
                    </div>
                    {i < rules.length - 1 && <Separator />}
                  </div>
                );
              })}
            </Card>
          )}

          {/* ── Template Presets ──────────────────────────────────────────── */}
          {tab === "presets" && (
            <Card className="gap-0 overflow-hidden p-0">
              <div className="bg-muted px-5 py-4">
                <h2 className="text-[16px] font-semibold text-foreground">{l("Campaign Presets & Templates", "القوالب الجاهزة للحملات")}</h2>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{l("Default templates available to coaches when creating campaigns.", "قوالب افتراضية متاحة للمدربين عند إنشاء الحملات.")}</p>
              </div>
              {["campaign", "ad_set", "budget", "creative"].map(type => {
                const typePresets = presets.filter(p => p.preset_type === type);
                return (
                  <div key={type}>
                    <div className="bg-muted/60 px-5 py-2.5">
                      <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{type.replace("_", " ")} Templates</p>
                    </div>
                    {typePresets.length === 0 && <p className="px-5 py-3.5 text-[13px] text-muted-foreground">{l("No presets of this type.", "لا توجد قوالب من هذا النوع.")}</p>}
                    {typePresets.map((p) => (
                      <div key={p.id}>
                        <div className="flex items-center gap-3.5 px-5 py-3.5">
                          <div className="min-w-0 flex-1">
                            <div className="mb-0.5 flex items-center gap-2">
                              <p className="text-[14px] font-semibold text-foreground">{p.name}</p>
                              {p.is_default && <Badge variant="default">{l("DEFAULT", "افتراضي")}</Badge>}
                            </div>
                            {p.description && <p className="text-[12px] text-muted-foreground">{p.description}</p>}
                            <code className="mt-0.5 block text-[11px] text-muted-foreground">{p.config}</code>
                          </div>
                          <Button variant="outline" size="icon-sm" onClick={() => deletePreset(p.id)} aria-label={l("Delete preset", "حذف القالب المسبق")} className="text-destructive ring-destructive/40 hover:bg-destructive/10 hover:text-destructive">
                            <Trash2 size={14} strokeWidth={2} />
                          </Button>
                        </div>
                        <Separator />
                      </div>
                    ))}
                  </div>
                );
              })}
            </Card>
          )}

          {/* ── History ─────────────────────────────────────────────────── */}
          {tab === "history" && (
            <Card className="gap-0 overflow-hidden p-0">
              <div className="bg-muted px-5 py-4">
                <h2 className="text-[16px] font-semibold text-foreground">{l("Settings Change History", "سجل تغييرات الإعدادات")}</h2>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{l("Full audit trail of every settings change.", "سجل تدقيق كامل لكل تغيير في الإعدادات.")}</p>
              </div>
              {history.length === 0 && <p className="px-5 py-6 text-[14px] text-muted-foreground">{l("No history yet.", "لا يوجد سجل بعد.")}</p>}
              {history.map((h, i) => (
                <div key={h.id}>
                  <div className="flex items-start gap-3.5 px-5 py-3.5">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-foreground">{h.setting_key}</p>
                      <p className="text-[12px] text-muted-foreground">
                        <span className="text-destructive">{h.old_value}</span> → <span className="text-[var(--green)]">{h.new_value}</span>
                      </p>
                      {h.reason && <p className="mt-0.5 text-[12px] text-muted-foreground">{l("Reason", "السبب")}: {h.reason}</p>}
                    </div>
                    <div className="shrink-0 text-end">
                      <p className="text-[12px] font-semibold text-foreground">{h.changed_by_name}</p>
                      <p className="text-[11px] text-muted-foreground">{new Date(h.changed_at).toLocaleString()}</p>
                    </div>
                  </div>
                  {i < history.length - 1 && <Separator />}
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
