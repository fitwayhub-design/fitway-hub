import { useState, useEffect, useCallback } from "react";
import {
  Plus, ChevronRight, ChevronDown, BarChart2, Target, DollarSign,
  Image as ImageIcon, Video, AlignLeft, Layers, Eye, Pause, Play,
  Trash2, CheckCircle, Clock, AlertTriangle, XCircle, Archive,
  ArrowLeft, Users, Globe, MapPin, Calendar, Zap, Award,
  TrendingUp, MousePointerClick, RefreshCw, Copy, LayoutGrid,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getApiBase } from "@/lib/api";
import axios from "axios";

const API = getApiBase();

// ── Types ─────────────────────────────────────────────────────────────────────
interface Campaign {
  id: number; name: string; objective: string; status: string;
  daily_budget: number; lifetime_budget: number; budget_type: string;
  schedule_start: string; schedule_end: string; admin_note?: string;
  created_at: string; ad_sets_count: number;
}
interface AdSet {
  id: number; campaign_id: number; name: string; placement: string;
  target_gender: string; target_age_min: number; target_age_max: number;
  target_location: string; daily_budget: number; status: string;
}
interface Ad {
  id: number; ad_set_id: number; name: string; headline?: string;
  body?: string; cta?: string; status: string; impressions: number;
  clicks: number; conversions: number; media_url?: string; format?: string;
}
interface Analytics {
  totals: { total_campaigns: number; active_campaigns: number; total_impressions: number; total_clicks: number; total_conversions: number; total_spent: number };
  topAds: Ad[];
}
interface Settings { min_daily_budget?: number; max_daily_budget?: number; require_admin_approval?: boolean; allow_image_creative?: boolean; allow_video_creative?: boolean; allow_carousel_creative?: boolean; }

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  draft:          { color: "#94a3b8", bg: "rgba(148,163,184,0.12)", icon: AlignLeft,   label: "Draft" },
  pending_review: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  icon: Clock,       label: "In Review" },
  active:         { color: "#10b981", bg: "rgba(16,185,129,0.12)",  icon: CheckCircle, label: "Active" },
  paused:         { color: "#3b82f6", bg: "rgba(59,130,246,0.12)",  icon: Pause,       label: "Paused" },
  rejected:       { color: "#ef4444", bg: "rgba(239,68,68,0.12)",   icon: XCircle,     label: "Rejected" },
  archived:       { color: "#6b7280", bg: "rgba(107,114,128,0.12)", icon: Archive,     label: "Archived" },
  expired:        { color: "#6b7280", bg: "rgba(107,114,128,0.12)", icon: AlertTriangle, label: "Expired" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.draft;
  const Icon = cfg.icon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 99, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 600 }}>
      <Icon size={11} /> {cfg.label}
    </span>
  );
}

const OBJECTIVES = [
  { value: "coaching",     label: "Get Clients",      icon: Users,            color: "#FFD600", desc: "Drive subscriptions & bookings" },
  { value: "awareness",    label: "Brand Awareness",  icon: Globe,            color: "#f59e0b", desc: "Reach new audiences on FitWayHub" },
  { value: "traffic",      label: "Profile Traffic",  icon: TrendingUp,       color: "#10b981", desc: "Send people to your profile" },
  { value: "engagement",   label: "Engagement",       icon: MousePointerClick, color: "#3b82f6", desc: "Likes, saves & comments" },
  { value: "bookings",     label: "Class Bookings",   icon: Calendar,         color: "#ec4899", desc: "Fill up your classes & sessions" },
  { value: "announcements",label: "Announcement",     icon: Zap,              color: "#f97316", desc: "Share news with the community" },
];
const PLACEMENTS = [
  { value: "feed",          label: "Community Feed" },
  { value: "home_banner",   label: "Home Banner" },
  { value: "profile_boost", label: "Profile Boost" },
  { value: "search",        label: "Search Results" },
  { value: "community",     label: "Discovery Page" },
  { value: "all",           label: "All Placements" },
];
const CTAS = ["Book Free Consultation", "Subscribe Now", "View Profile", "Learn More", "Message Me", "Join Challenge", "Get Started", "Book Now"];

// ── Main Component ─────────────────────────────────────────────────────────────
export default function CoachCampaigns() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [view, setView] = useState<"list" | "analytics" | "builder" | "detail">("list");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [settings, setSettings] = useState<Settings>({});
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [adSets, setAdSets] = useState<AdSet[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [expandedSets, setExpandedSets] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Builder state
  const [step, setStep] = useState<"objective" | "audience" | "budget" | "creative" | "review">("objective");
  const [form, setForm] = useState({
    name: "", objective: "coaching",
    daily_budget: 50, lifetime_budget: 200, budget_type: "daily",
    schedule_start: "", schedule_end: "",
  });
  const [adSetForm, setAdSetForm] = useState({
    name: "Ad Set 1", placement: "feed",
    target_gender: "all", target_age_min: 18, target_age_max: 65,
    target_location: "", daily_budget: 50,
  });
  const [adForm, setAdForm] = useState({
    name: "Ad 1", headline: "", body: "", cta: "Learn More",
    media_url: "", format: "image", destination_type: "profile",
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [camps, stats, sett] = await Promise.all([
        axios.get(`${API}/api/ads/campaigns`, { headers }),
        axios.get(`${API}/api/ads/analytics/summary`, { headers }),
        axios.get(`${API}/api/ad-settings/public`, { headers }),
      ]);
      setCampaigns(camps.data.campaigns || []);
      setAnalytics(stats.data);
      setSettings(sett.data.settings || {});
    } catch { /* show empty */ } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (c: Campaign) => {
    setSelected(c);
    try {
      const r = await axios.get(`${API}/api/ads/campaigns/${c.id}`, { headers });
      setAdSets(r.data.adSets || []);
      setAds(r.data.ads || []);
    } catch { setAdSets([]); setAds([]); }
    setView("detail");
  };

  const createCampaign = async () => {
    setSaving(true);
    try {
      const { data } = await axios.post(`${API}/api/ads/campaigns`, form, { headers });
      const campaign = data.campaign;
      // Create ad set
      const { data: setData } = await axios.post(`${API}/api/ads/campaigns/${campaign.id}/ad-sets`, { ...adSetForm, campaign_id: campaign.id }, { headers });
      // Create ad
      await axios.post(`${API}/api/ads/ad-sets/${setData.adSet.id}/ads`, { ...adForm, campaign_id: campaign.id }, { headers });
      await load();
      setView("list");
      setStep("objective");
    } catch { } finally { setSaving(false); }
  };

  const toggleStatus = async (c: Campaign, newStatus: string) => {
    try {
      await axios.patch(`${API}/api/ads/campaigns/${c.id}`, { status: newStatus }, { headers });
      await load();
    } catch { }
  };

  const deleteCampaign = async (id: number) => {
    if (!confirm("Delete this campaign?")) return;
    await axios.delete(`${API}/api/ads/campaigns/${id}`, { headers });
    await load();
  };

  const f = (n: number) => n?.toLocaleString() ?? "0";
  const pct = (a: number, b: number) => b ? ((a / b) * 100).toFixed(1) + "%" : "0%";

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <RefreshCw size={24} color="var(--accent)" style={{ animation: "spin 1s linear infinite" }} />
    </div>
  );

  // ── Campaign Builder ───────────────────────────────────────────────────────
  if (view === "builder") {
    const STEPS = ["objective", "audience", "budget", "creative", "review"] as const;
    const stepIdx = STEPS.indexOf(step);
    const minBudget = settings.min_daily_budget ?? 10;
    const maxBudget = settings.max_daily_budget ?? 5000;

    return (
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <button onClick={() => setView("list")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", marginBottom: 24, fontSize: 14 }}>
          <ArrowLeft size={16} /> Back to Campaigns
        </button>

        {/* Progress bar */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{ flex: 1, height: 4, borderRadius: 99, background: i <= stepIdx ? "var(--accent)" : "var(--border)", transition: "background 0.3s" }} />
            ))}
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", textTransform: "capitalize" }}>Step {stepIdx + 1} of 5 — {step.replace("_", " ")}</p>
        </div>

        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: 28 }}>

          {/* Step 1: Objective */}
          {step === "objective" && (
            <div>
              <h2 style={{ fontSize: 20, fontFamily: "var(--font-en)", marginBottom: 6 }}>Campaign Goal</h2>
              <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 20 }}>What do you want to achieve?</p>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Campaign name (e.g. Summer Promo 2025)" style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 14, marginBottom: 20, boxSizing: "border-box" }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {OBJECTIVES.map(o => (
                  <button key={o.value} onClick={() => setForm(f => ({ ...f, objective: o.value }))} style={{ padding: "14px 16px", borderRadius: 14, border: `2px solid ${form.objective === o.value ? o.color : "var(--border)"}`, background: form.objective === o.value ? `${o.color}18` : "var(--bg-surface)", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
                    <o.icon size={18} color={o.color} style={{ marginBottom: 6 }} />
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{o.label}</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{o.desc}</p>
                  </button>
                ))}
              </div>
              <button disabled={!form.name} onClick={() => setStep("audience")} style={{ width: "100%", marginTop: 20, padding: "13px", borderRadius: 12, background: form.name ? "var(--accent)" : "var(--border)", color: form.name ? "#000" : "var(--text-muted)", border: "none", fontWeight: 700, cursor: form.name ? "pointer" : "not-allowed", fontSize: 14 }}>
                Continue <ChevronRight size={16} style={{ verticalAlign: "middle" }} />
              </button>
            </div>
          )}

          {/* Step 2: Audience */}
          {step === "audience" && (
            <div>
              <h2 style={{ fontSize: 20, fontFamily: "var(--font-en)", marginBottom: 6 }}>Target Audience</h2>
              <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 20 }}>Who should see your promotion?</p>

              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Placement</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
                {PLACEMENTS.map(p => (
                  <button key={p.value} onClick={() => setAdSetForm(f => ({ ...f, placement: p.value }))} style={{ padding: "7px 14px", borderRadius: 99, border: `1.5px solid ${adSetForm.placement === p.value ? "var(--accent)" : "var(--border)"}`, background: adSetForm.placement === p.value ? "var(--accent-dim)" : "transparent", color: adSetForm.placement === p.value ? "var(--accent)" : "var(--text-muted)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                    {p.label}
                  </button>
                ))}
              </div>

              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Gender</label>
              <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                {["all", "male", "female"].map(g => (
                  <button key={g} onClick={() => setAdSetForm(f => ({ ...f, target_gender: g }))} style={{ flex: 1, padding: "9px", borderRadius: 10, border: `1.5px solid ${adSetForm.target_gender === g ? "var(--accent)" : "var(--border)"}`, background: adSetForm.target_gender === g ? "var(--accent-dim)" : "transparent", color: adSetForm.target_gender === g ? "var(--accent)" : "var(--text-muted)", cursor: "pointer", fontSize: 12, fontWeight: 600, textTransform: "capitalize" }}>
                    {g}
                  </button>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Min Age</label>
                  <input type="number" value={adSetForm.target_age_min} onChange={e => setAdSetForm(f => ({ ...f, target_age_min: +e.target.value }))} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 14, boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Max Age</label>
                  <input type="number" value={adSetForm.target_age_max} onChange={e => setAdSetForm(f => ({ ...f, target_age_max: +e.target.value }))} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 14, boxSizing: "border-box" }} />
                </div>
              </div>

              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Target City (optional)</label>
              <input value={adSetForm.target_location} onChange={e => setAdSetForm(f => ({ ...f, target_location: e.target.value }))} placeholder="e.g. Cairo, Alexandria…" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 14, marginBottom: 20, boxSizing: "border-box" }} />

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setStep("objective")} style={{ flex: 1, padding: "12px", borderRadius: 12, background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer", fontWeight: 600 }}>Back</button>
                <button onClick={() => setStep("budget")} style={{ flex: 2, padding: "12px", borderRadius: 12, background: "var(--accent)", border: "none", color: "#000", fontWeight: 700, cursor: "pointer" }}>Continue</button>
              </div>
            </div>
          )}

          {/* Step 3: Budget */}
          {step === "budget" && (
            <div>
              <h2 style={{ fontSize: 20, fontFamily: "var(--font-en)", marginBottom: 6 }}>Budget & Schedule</h2>
              <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 20 }}>How much do you want to spend?</p>

              <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                {["daily", "lifetime"].map(t => (
                  <button key={t} onClick={() => setForm(f => ({ ...f, budget_type: t }))} style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1.5px solid ${form.budget_type === t ? "var(--accent)" : "var(--border)"}`, background: form.budget_type === t ? "var(--accent-dim)" : "transparent", color: form.budget_type === t ? "var(--accent)" : "var(--text-muted)", cursor: "pointer", fontWeight: 600, fontSize: 13, textTransform: "capitalize" }}>
                    {t} Budget
                  </button>
                ))}
              </div>

              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                {form.budget_type === "daily" ? "Daily" : "Lifetime"} Budget (EGP)
              </label>
              <input type="number" min={minBudget} max={maxBudget} value={form.budget_type === "daily" ? form.daily_budget : form.lifetime_budget} onChange={e => form.budget_type === "daily" ? setForm(f => ({ ...f, daily_budget: +e.target.value })) : setForm(f => ({ ...f, lifetime_budget: +e.target.value }))} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 6, boxSizing: "border-box" }} />
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 20 }}>Min: {minBudget} EGP — Max: {maxBudget} EGP</p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Start Date</label>
                  <input type="date" value={form.schedule_start} onChange={e => setForm(f => ({ ...f, schedule_start: e.target.value }))} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 14, boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>End Date</label>
                  <input type="date" value={form.schedule_end} onChange={e => setForm(f => ({ ...f, schedule_end: e.target.value }))} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 14, boxSizing: "border-box" }} />
                </div>
              </div>

              {settings.require_admin_approval && (
                <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <Clock size={14} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>This campaign will require admin approval before going live.</p>
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setStep("audience")} style={{ flex: 1, padding: "12px", borderRadius: 12, background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer", fontWeight: 600 }}>Back</button>
                <button onClick={() => setStep("creative")} style={{ flex: 2, padding: "12px", borderRadius: 12, background: "var(--accent)", border: "none", color: "#000", fontWeight: 700, cursor: "pointer" }}>Continue</button>
              </div>
            </div>
          )}

          {/* Step 4: Creative */}
          {step === "creative" && (
            <div>
              <h2 style={{ fontSize: 20, fontFamily: "var(--font-en)", marginBottom: 6 }}>Ad Creative</h2>
              <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 20 }}>What will your audience see?</p>

              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Format</label>
              <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                {[{ v: "image", i: ImageIcon, label: "Image", ok: settings.allow_image_creative !== false }, { v: "video", i: Video, label: "Video", ok: settings.allow_video_creative !== false }, { v: "text", i: AlignLeft, label: "Text Only", ok: true }].map(f => (
                  <button key={f.v} disabled={!f.ok} onClick={() => setAdForm(x => ({ ...x, format: f.v }))} style={{ flex: 1, padding: "10px 8px", borderRadius: 10, border: `1.5px solid ${adForm.format === f.v ? "var(--accent)" : "var(--border)"}`, background: adForm.format === f.v ? "var(--accent-dim)" : "transparent", color: adForm.format === f.v ? "var(--accent)" : f.ok ? "var(--text-muted)" : "var(--border)", cursor: f.ok ? "pointer" : "not-allowed", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600 }}>
                    <f.i size={16} /> {f.label}
                  </button>
                ))}
              </div>

              {(adForm.format === "image" || adForm.format === "video") && (
                <>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Media URL</label>
                  <input value={adForm.media_url} onChange={e => setAdForm(f => ({ ...f, media_url: e.target.value }))} placeholder="https://… (internal storage URL)" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 13, marginBottom: 14, boxSizing: "border-box" }} />
                </>
              )}

              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Headline</label>
              <input value={adForm.headline} onChange={e => setAdForm(f => ({ ...f, headline: e.target.value }))} placeholder="Grab attention in one line…" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 14, marginBottom: 14, boxSizing: "border-box" }} />

              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Body Text</label>
              <textarea value={adForm.body} onChange={e => setAdForm(f => ({ ...f, body: e.target.value }))} placeholder="Tell people more about your offer…" rows={3} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 14, marginBottom: 14, resize: "vertical", boxSizing: "border-box" }} />

              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Call to Action</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
                {CTAS.map(c => (
                  <button key={c} onClick={() => setAdForm(f => ({ ...f, cta: c }))} style={{ padding: "6px 12px", borderRadius: 99, border: `1.5px solid ${adForm.cta === c ? "var(--accent)" : "var(--border)"}`, background: adForm.cta === c ? "var(--accent-dim)" : "transparent", color: adForm.cta === c ? "var(--accent)" : "var(--text-muted)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                    {c}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setStep("budget")} style={{ flex: 1, padding: "12px", borderRadius: 12, background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer", fontWeight: 600 }}>Back</button>
                <button onClick={() => setStep("review")} style={{ flex: 2, padding: "12px", borderRadius: 12, background: "var(--accent)", border: "none", color: "#000", fontWeight: 700, cursor: "pointer" }}>Review</button>
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {step === "review" && (
            <div>
              <h2 style={{ fontSize: 20, fontFamily: "var(--font-en)", marginBottom: 20 }}>Review & Launch</h2>
              {[
                { label: "Campaign Name", value: form.name },
                { label: "Goal", value: OBJECTIVES.find(o => o.value === form.objective)?.label },
                { label: "Placement", value: PLACEMENTS.find(p => p.value === adSetForm.placement)?.label },
                { label: "Audience", value: `${adSetForm.target_gender === "all" ? "All genders" : adSetForm.target_gender}, Age ${adSetForm.target_age_min}–${adSetForm.target_age_max}` },
                { label: "Budget", value: `${form.budget_type === "daily" ? form.daily_budget + " EGP/day" : form.lifetime_budget + " EGP total"}` },
                { label: "Schedule", value: form.schedule_start ? `${form.schedule_start} → ${form.schedule_end || "open"}` : "No dates set" },
                { label: "Creative", value: `${adForm.format.charAt(0).toUpperCase() + adForm.format.slice(1)} — "${adForm.headline || "No headline"}"` },
                { label: "CTA", value: adForm.cta },
              ].map(row => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-light)" }}>
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", textAlign: "right", maxWidth: "60%" }}>{row.value}</span>
                </div>
              ))}
              <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                <button onClick={() => setStep("creative")} style={{ flex: 1, padding: "12px", borderRadius: 12, background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer", fontWeight: 600 }}>Back</button>
                <button disabled={saving} onClick={createCampaign} style={{ flex: 2, padding: "12px", borderRadius: 12, background: "var(--accent)", border: "none", color: "#000", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  {saving ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Zap size={14} />}
                  {saving ? "Launching…" : "Launch Campaign"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Campaign Detail ────────────────────────────────────────────────────────
  if (view === "detail" && selected) {
    return (
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <button onClick={() => setView("list")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", marginBottom: 24, fontSize: 14 }}>
          <ArrowLeft size={16} /> All Campaigns
        </button>

        {/* Campaign header */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: 24, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <StatusBadge status={selected.status} />
                {selected.admin_note && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Note: {selected.admin_note}</span>}
              </div>
              <h2 style={{ fontSize: 22, fontFamily: "var(--font-en)", marginBottom: 4 }}>{selected.name}</h2>
              <p style={{ fontSize: 13, color: "var(--text-muted)", textTransform: "capitalize" }}>{selected.objective?.replace(/_/g, " ")}</p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => deleteCampaign(selected.id)} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--red)", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </div>
        </div>

        {/* Ad Sets */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Ad Sets ({adSets.length})</h3>
          </div>
          {adSets.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No ad sets yet.</p>}
          {adSets.map(set => {
            const setAds = ads.filter(a => a.ad_set_id === set.id);
            const open = expandedSets.has(set.id);
            return (
              <div key={set.id} style={{ border: "1px solid var(--border-light)", borderRadius: 14, marginBottom: 10, overflow: "hidden" }}>
                <button onClick={() => setExpandedSets(prev => { const n = new Set(prev); open ? n.delete(set.id) : n.add(set.id); return n; })} style={{ width: "100%", padding: "14px 18px", background: "var(--bg-surface)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Layers size={14} color="var(--accent)" />
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{set.name}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "capitalize" }}>{set.placement}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{setAds.length} ads</span>
                    {open ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />}
                  </div>
                </button>
                {open && (
                  <div style={{ padding: "12px 18px" }}>
                    {setAds.length === 0 && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No ads in this set.</p>}
                    {setAds.map(ad => (
                      <div key={ad.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border-light)" }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600 }}>{ad.name}</p>
                          {ad.headline && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{ad.headline}</p>}
                        </div>
                        <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-muted)" }}>
                          <span><Eye size={11} style={{ verticalAlign: "middle" }} /> {f(ad.impressions)}</span>
                          <span><MousePointerClick size={11} style={{ verticalAlign: "middle" }} /> {f(ad.clicks)}</span>
                          <span><Award size={11} style={{ verticalAlign: "middle" }} /> {f(ad.conversions)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Analytics View ─────────────────────────────────────────────────────────
  if (view === "analytics") {
    const t = analytics?.totals;
    return (
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontFamily: "var(--font-en)" }}>Analytics</h1>
          <button onClick={() => setView("list")} style={{ padding: "8px 16px", borderRadius: 10, background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer", fontSize: 13 }}>
            <ArrowLeft size={13} style={{ verticalAlign: "middle", marginRight: 4 }} /> Campaigns
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 24 }}>
          {[
            { label: "Total Impressions", value: f(t?.total_impressions ?? 0), icon: Eye, color: "#FFD600" },
            { label: "Total Clicks", value: f(t?.total_clicks ?? 0), icon: MousePointerClick, color: "#3b82f6" },
            { label: "Conversions", value: f(t?.total_conversions ?? 0), icon: Award, color: "#10b981" },
            { label: "CTR", value: pct(t?.total_clicks ?? 0, t?.total_impressions ?? 0), icon: TrendingUp, color: "#f59e0b" },
            { label: "Active Campaigns", value: String(t?.active_campaigns ?? 0), icon: Play, color: "#10b981" },
            { label: "Total Spent", value: `${(t?.total_spent ?? 0).toFixed(0)} EGP`, icon: DollarSign, color: "#ec4899" },
          ].map(card => (
            <div key={card.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "18px 20px" }}>
              <card.icon size={18} color={card.color} style={{ marginBottom: 8 }} />
              <p style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--font-en)", color: card.color }}>{card.value}</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{card.label}</p>
            </div>
          ))}
        </div>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Top Performing Ads</h3>
          {(analytics?.topAds ?? []).length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No data yet. Launch a campaign to see results.</p>}
          {(analytics?.topAds ?? []).map((ad: any) => (
            <div key={ad.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--border-light)" }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600 }}>{ad.name}</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{ad.campaign_name}</p>
              </div>
              <div style={{ display: "flex", gap: 18, fontSize: 12 }}>
                <div style={{ textAlign: "center" }}><p style={{ fontWeight: 700 }}>{f(ad.impressions)}</p><p style={{ color: "var(--text-muted)" }}>Views</p></div>
                <div style={{ textAlign: "center" }}><p style={{ fontWeight: 700 }}>{f(ad.clicks)}</p><p style={{ color: "var(--text-muted)" }}>Clicks</p></div>
                <div style={{ textAlign: "center" }}><p style={{ fontWeight: 700 }}>{f(ad.conversions)}</p><p style={{ color: "var(--text-muted)" }}>Conv.</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Campaign List ──────────────────────────────────────────────────────────
  const t = analytics?.totals;
  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontFamily: "var(--font-en)", marginBottom: 4 }}>Promotions</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Grow your coaching business on FitWayHub</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setView("analytics")} style={{ padding: "10px 18px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-muted)", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <BarChart2 size={14} /> Analytics
          </button>
          <button onClick={() => { setStep("objective"); setView("builder"); }} style={{ padding: "10px 18px", borderRadius: 12, border: "none", background: "var(--accent)", color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> New Campaign
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Impressions", value: f(t?.total_impressions ?? 0), color: "#FFD600" },
          { label: "Clicks", value: f(t?.total_clicks ?? 0), color: "#3b82f6" },
          { label: "Conversions", value: f(t?.total_conversions ?? 0), color: "#10b981" },
        ].map(s => (
          <div key={s.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px" }}>
            <p style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--font-en)", color: s.color }}>{s.value}</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* List */}
      {campaigns.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: "48px 24px", textAlign: "center" }}>
          <LayoutGrid size={36} color="var(--text-muted)" style={{ marginBottom: 16 }} />
          <h3 style={{ fontFamily: "var(--font-en)", marginBottom: 8 }}>No campaigns yet</h3>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 20 }}>Create your first promotion to start reaching new clients on FitWayHub.</p>
          <button onClick={() => { setStep("objective"); setView("builder"); }} style={{ padding: "12px 24px", borderRadius: 12, background: "var(--accent)", border: "none", color: "#000", fontWeight: 700, cursor: "pointer" }}>
            <Plus size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Create Campaign
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {campaigns.map(c => (
            <div key={c.id} onClick={() => openDetail(c)} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "18px 20px", cursor: "pointer", transition: "border-color 0.15s", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <StatusBadge status={c.status} />
                  <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "capitalize" }}>{c.objective?.replace(/_/g, " ")}</span>
                </div>
                <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{c.ad_sets_count ?? 0} ad sets · {c.budget_type === "daily" ? `${c.daily_budget} EGP/day` : `${c.lifetime_budget} EGP total`}</p>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {c.status === "active" && <button onClick={e => { e.stopPropagation(); toggleStatus(c, "paused"); }} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: 12 }}><Pause size={12} /></button>}
                {c.status === "paused" && <button onClick={e => { e.stopPropagation(); toggleStatus(c, "active"); }} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: 12 }}><Play size={12} /></button>}
                <button onClick={e => { e.stopPropagation(); deleteCampaign(c.id); }} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--red)", cursor: "pointer", fontSize: 12 }}><Trash2 size={12} /></button>
                <ChevronRight size={16} color="var(--text-muted)" style={{ alignSelf: "center" }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
