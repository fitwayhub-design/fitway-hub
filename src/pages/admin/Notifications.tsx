import { useState, useEffect, useCallback } from "react";
import type { CSSProperties } from "react";
import { Bell, Send, Edit3, Trash2, Plus, CheckCircle, XCircle, RefreshCw, Users, Zap, ArrowLeft, Mail, Smartphone, MessageSquare, Inbox, CheckCheck, ExternalLink } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { getApiBase } from "@/lib/api";

const API = getApiBase();

interface PushTemplate {
  id: number;
  slug: string;
  title: string;
  body: string;
  category: string;
  trigger_type: string;
  enabled: number;
}

interface WelcomeMessage {
  id: number;
  target: "user" | "coach";
  channel: "email" | "push" | "in_app";
  subject: string;
  title: string;
  body: string;
  html_body: string | null;
  enabled: number;
}

interface LogEntry {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  template_slug: string | null;
  title: string;
  body: string;
  status: "sent" | "failed";
  created_at: string;
}

interface FcmStatus {
  configured: boolean;
  method: string;
  registeredDevices: number;
}

type View = "inbox" | "templates" | "welcome" | "send" | "log" | "edit-template" | "edit-welcome";

// ── Trigger options (trigger_type field) ──────────────────────────────────────
const TRIGGERS: { value: string; label: string; purpose: string }[] = [
  { value: "user_registers",          label: "User registers",             purpose: "onboarding" },
  { value: "coach_registers",         label: "New coach registers",        purpose: "coach_onboarding" },
  { value: "user_completes_profile",  label: "User completes profile",     purpose: "activation" },
  { value: "workout_plan_assigned",   label: "Workout plan assigned",      purpose: "engagement" },
  { value: "workout_day_reminder",    label: "Workout day reminder",       purpose: "habit_building" },
  { value: "user_inactive_1_day",     label: "Inactive for 1 day",         purpose: "retention" },
  { value: "user_inactive_3_days",    label: "Inactive for 3 days",        purpose: "re_engagement" },
  { value: "user_inactive_7_days",    label: "Inactive for 7 days",        purpose: "win_back" },
  { value: "workout_completed",       label: "Workout completed",          purpose: "positive_reinforcement" },
  { value: "streak_3_days",           label: "3-day streak",               purpose: "motivation" },
  { value: "streak_7_days",           label: "7-day streak",               purpose: "habit_reinforcement" },
  { value: "coach_sends_message",     label: "Coach sends message",        purpose: "communication" },
  { value: "new_workout_unlocked",    label: "New workout unlocked",       purpose: "engagement" },
  { value: "progress_milestone",      label: "Progress milestone",         purpose: "retention" },
  { value: "goal_achieved",           label: "Goal achieved",              purpose: "achievement" },
  { value: "weight_logged",           label: "Weight logged",              purpose: "habit_reinforcement" },
  { value: "meal_plan_updated",       label: "Meal plan updated",          purpose: "engagement" },
  { value: "new_challenge_available", label: "New challenge available",    purpose: "community_engagement" },
  { value: "user_near_streak_break",  label: "Near streak break",          purpose: "urgency" },
  { value: "coach_assigns_exercise",  label: "Coach assigns new exercise", purpose: "engagement" },
  { value: "morning_reminder",        label: "Morning reminder",           purpose: "daily_activation" },
  { value: "evening_reminder",        label: "Evening reminder",           purpose: "recovery_engagement" },
  { value: "user_improves_record",    label: "User improves record",       purpose: "motivation" },
  { value: "friend_joins_platform",   label: "Friend joins platform",      purpose: "social_engagement" },
  { value: "challenge_completed",     label: "Challenge completed",        purpose: "reward_reinforcement" },
  { value: "app_feature_announcement",label: "App feature announcement",   purpose: "product_awareness" },
  { value: "monthly_progress_summary",label: "Monthly progress summary",   purpose: "retention" },
  { value: "coach_review_posted",     label: "Coach review posted",        purpose: "engagement" },
  { value: "program_completed",       label: "Program completed",          purpose: "retention" },
  { value: "user_inactive_14_days",   label: "Inactive for 14 days",       purpose: "win_back" },
  { value: "manual",                  label: "Manual / custom",            purpose: "system" },
];

// ── Purpose options ────────────────────────────────────────────────────────────
const PURPOSES: { value: string; label: string }[] = [
  { value: "onboarding",              label: "Onboarding" },
  { value: "coach_onboarding",        label: "Coach Onboarding" },
  { value: "activation",              label: "Activation" },
  { value: "engagement",              label: "Engagement" },
  { value: "habit_building",          label: "Habit Building" },
  { value: "habit_reinforcement",     label: "Habit Reinforcement" },
  { value: "retention",               label: "Retention" },
  { value: "re_engagement",           label: "Re-engagement" },
  { value: "win_back",                label: "Win-back" },
  { value: "positive_reinforcement",  label: "Positive Reinforcement" },
  { value: "motivation",              label: "Motivation" },
  { value: "communication",           label: "Communication" },
  { value: "achievement",             label: "Achievement" },
  { value: "community_engagement",    label: "Community Engagement" },
  { value: "urgency",                 label: "Urgency" },
  { value: "daily_activation",        label: "Daily Activation" },
  { value: "recovery_engagement",     label: "Recovery Engagement" },
  { value: "social_engagement",       label: "Social Engagement" },
  { value: "reward_reinforcement",    label: "Reward Reinforcement" },
  { value: "product_awareness",       label: "Product Awareness" },
  { value: "system",                  label: "System" },
];

const CATEGORIES = ["new_user", "new_coach", "engagement", "streak", "inactivity", "promo", "coach_tip", "system"];

const categoryLabel: Record<string, string> = {
  new_user: "New User", new_coach: "New Coach", engagement: "Engagement",
  streak: "Streak", inactivity: "Inactivity", promo: "Promo",
  coach_tip: "Coach Tip", system: "System",
};

const triggerLabel = (t: string) => TRIGGERS.find(x => x.value === t)?.label || t;
const purposeOfTrigger = (t: string) => TRIGGERS.find(x => x.value === t)?.purpose || "";
const purposeLabel = (p: string) => PURPOSES.find(x => x.value === p)?.label || p;

const channelIcon: Record<string, typeof Mail> = { email: Mail, push: Smartphone, in_app: MessageSquare };

export default function Notifications() {
  const { token } = useAuth();
  const { lang } = useI18n();
  const l = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const [view, setView] = useState<View>("inbox");
  const [templates, setTemplates] = useState<PushTemplate[]>([]);
  const [welcomeMsgs, setWelcomeMsgs] = useState<WelcomeMessage[]>([]);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [fcmStatus, setFcmStatus] = useState<FcmStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Edit states
  const [editTemplate, setEditTemplate] = useState<PushTemplate | null>(null);
  const [editWelcome, setEditWelcome] = useState<WelcomeMessage | null>(null);

  // Send form
  const [sendTitle, setSendTitle] = useState("");
  const [sendBody, setSendBody] = useState("");
  const [sendSegment, setSendSegment] = useState<string>("all");
  const [sendUserId, setSendUserId] = useState("");
  const [sending, setSending] = useState(false);

  // New template form
  const [newSlug, setNewSlug] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newCategory, setNewCategory] = useState("engagement");
  const [newTrigger, setNewTrigger] = useState("manual");
  const [showNewForm, setShowNewForm] = useState(false);

  // Filters
  const [filterCat,     setFilterCat]     = useState<string>("all");
  const [filterTrigger, setFilterTrigger] = useState<string>("all");
  const [filterPurpose, setFilterPurpose] = useState<string>("all");

  // Test push
  const [testing, setTesting] = useState(false);

  // Admin inbox (in-app notifications)
  const [inboxItems, setInboxItems] = useState<{ id: number; type: string; title: string; body: string; link: string | null; is_read: number; created_at: string }[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string; devices?: any[] } | null>(null);

  const handleTestPush = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await fetch(`${API}/api/notifications/test`, {
        method: "POST",
        headers: hdr(),
        body: JSON.stringify({ title: "🔔 FitWay Hub Test", body: "Push notifications are working correctly!" }),
      });
      const d = await r.json();
      setTestResult({ ok: d.sent, msg: d.message, devices: d.devices });
    } catch {
      setTestResult({ ok: false, msg: l("Network error - could not reach server", "خطأ في الشبكة - تعذر الوصول إلى الخادم") });
    } finally {
      setTesting(false);
      setTimeout(() => setTestResult(null), 6000);
    }
  };

  const hdr = useCallback(() => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }), [token]);

  const flash = (msg: string, isErr = false) => {
    if (isErr) { setError(msg); setSuccess(""); }
    else { setSuccess(msg); setError(""); }
    setTimeout(() => { setError(""); setSuccess(""); }, 4000);
  };

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/notifications/templates`, { headers: hdr() });
      const d = await r.json();
      setTemplates(d.templates || []);
    } catch { flash(l("Failed to load templates", "فشل تحميل القوالب"), true); }
    setLoading(false);
  }, [hdr]);

  const loadWelcome = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/notifications/welcome-messages`, { headers: hdr() });
      const d = await r.json();
      setWelcomeMsgs(d.messages || []);
    } catch { flash(l("Failed to load welcome messages", "فشل تحميل رسائل الترحيب"), true); }
    setLoading(false);
  }, [hdr]);

  const loadLog = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/notifications/log?limit=100`, { headers: hdr() });
      const d = await r.json();
      setLogEntries(d.log || []);
    } catch { flash(l("Failed to load log", "فشل تحميل السجل"), true); }
    setLoading(false);
  }, [hdr]);

  const loadFcmStatus = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/notifications/fcm-status`, { headers: hdr() });
      const d = await r.json();
      setFcmStatus(d);
    } catch {}
  }, [hdr]);

  useEffect(() => {
    loadTemplates();
    loadFcmStatus();
    loadInbox();
  }, [loadTemplates, loadFcmStatus]);

  const loadInbox = async () => {
    setInboxLoading(true);
    try {
      const r = await fetch(`${API}/api/notifications/list`, { headers: hdr() });
      const d = await r.json();
      setInboxItems(d.notifications || []);
    } catch {} finally { setInboxLoading(false); }
  };

  const markInboxRead = async (id: number) => {
    await fetch(`${API}/api/notifications/read/${id}`, { method: "PUT", headers: hdr() });
    setInboxItems(ns => ns.map(n => n.id === id ? { ...n, is_read: 1 } : n));
  };

  const markAllInboxRead = async () => {
    await fetch(`${API}/api/notifications/read-all`, { method: "PUT", headers: hdr() });
    setInboxItems(ns => ns.map(n => ({ ...n, is_read: 1 })));
  };

  useEffect(() => {
    if (view === "welcome") loadWelcome();
    if (view === "log") loadLog();
  }, [view, loadWelcome, loadLog]);

  // ── Actions ───────────────────
  const toggleTemplate = async (t: PushTemplate) => {
    await fetch(`${API}/api/notifications/templates/${t.id}`, { method: "PUT", headers: hdr(), body: JSON.stringify({ enabled: !t.enabled }) });
    loadTemplates();
  };

  const deleteTemplate = async (id: number) => {
    if (!confirm(l("Delete this template?", "هل تريد حذف هذا القالب؟"))) return;
    await fetch(`${API}/api/notifications/templates/${id}`, { method: "DELETE", headers: hdr() });
    flash(l("Template deleted", "تم حذف القالب"));
    loadTemplates();
  };

  const saveTemplate = async () => {
    if (!editTemplate) return;
    await fetch(`${API}/api/notifications/templates/${editTemplate.id}`, {
      method: "PUT", headers: hdr(),
      body: JSON.stringify({ title: editTemplate.title, body: editTemplate.body, trigger_type: editTemplate.trigger_type, enabled: editTemplate.enabled }),
    });
    flash(l("Template saved", "تم حفظ القالب"));
    setView("templates");
    loadTemplates();
  };

  const createTemplate = async () => {
    if (!newSlug || !newTitle || !newBody) return flash(l("Fill slug, title, body", "يرجى إدخال slug والعنوان والمحتوى"), true);
    const r = await fetch(`${API}/api/notifications/templates`, {
      method: "POST", headers: hdr(),
      body: JSON.stringify({ slug: newSlug, title: newTitle, body: newBody, category: newCategory, trigger_type: newTrigger }),
    });
    if (r.ok) {
      flash(l("Template created", "تم إنشاء القالب"));
      setShowNewForm(false); setNewSlug(""); setNewTitle(""); setNewBody(""); setNewCategory("engagement"); setNewTrigger("manual");
      loadTemplates();
    } else {
      const d = await r.json();
      flash(d.message || l("Failed", "فشل"), true);
    }
  };

  const saveWelcome = async () => {
    if (!editWelcome) return;
    await fetch(`${API}/api/notifications/welcome-messages/${editWelcome.id}`, {
      method: "PUT", headers: hdr(),
      body: JSON.stringify({ subject: editWelcome.subject, title: editWelcome.title, body: editWelcome.body, html_body: editWelcome.html_body, enabled: editWelcome.enabled }),
    });
    flash(l("Welcome message saved", "تم حفظ رسالة الترحيب"));
    setView("welcome");
    loadWelcome();
  };

  const toggleWelcome = async (m: WelcomeMessage) => {
    await fetch(`${API}/api/notifications/welcome-messages/${m.id}`, { method: "PUT", headers: hdr(), body: JSON.stringify({ enabled: !m.enabled }) });
    loadWelcome();
  };

  const handleSend = async () => {
    if (!sendTitle || !sendBody) return flash(l("Title and body are required", "العنوان والمحتوى مطلوبان"), true);
    setSending(true);
    try {
      const payload: any = { title: sendTitle, body: sendBody };
      if (sendUserId) payload.userId = parseInt(sendUserId);
      else payload.segment = sendSegment;
      const r = await fetch(`${API}/api/notifications/send`, { method: "POST", headers: hdr(), body: JSON.stringify(payload) });
      const d = await r.json();
      flash(d.message || l("Sent!", "تم الإرسال"));
    } catch { flash(l("Send failed", "فشل الإرسال"), true); }
    setSending(false);
  };

  // ── Styles ────────────────────
  const card: CSSProperties = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: 20, marginBottom: 16 };
  const btn: CSSProperties = { padding: "8px 16px", borderRadius: "var(--radius-full)", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 };
  const btnAccent: CSSProperties = { ...btn, backgroundColor: "var(--accent)", color: "#000000" };
  const btnSecondary: CSSProperties = { ...btn, backgroundColor: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border)" };
  const input: CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: "var(--radius-full)", border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 14 };
  const textarea: CSSProperties = { ...input, minHeight: 80, resize: "vertical" as const };
  const badge = (color: string): CSSProperties => ({ display: "inline-block", padding: "2px 8px", borderRadius: "var(--radius-full)", fontSize: 11, fontWeight: 600, backgroundColor: `${color}20`, color });
  const tabBtn = (active: boolean): CSSProperties => ({ ...btn, backgroundColor: active ? "var(--accent)" : "var(--bg-surface)", color: active ? "#000000" : "var(--text-secondary)", border: active ? "none" : "1px solid var(--border)" });

  const filteredTemplates = templates.filter(t => {
    if (filterCat !== "all" && t.category !== filterCat) return false;
    if (filterTrigger !== "all" && t.trigger_type !== filterTrigger) return false;
    if (filterPurpose !== "all" && purposeOfTrigger(t.trigger_type) !== filterPurpose) return false;
    return true;
  });

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "var(--font-en)", fontSize: 24, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
        <Bell size={22} /> {l("Push Notifications", "الإشعارات")}
      </h1>

      {/* FCM Status */}
      {fcmStatus && (
        <div style={{ ...card }}>
          <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
            {/* Status indicators */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {fcmStatus.configured ? <CheckCircle size={16} color="var(--green)" /> : <XCircle size={16} color="var(--red)" />}
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                FCM: {fcmStatus.configured ? `Configured (${fcmStatus.method})` : "Not configured"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Smartphone size={16} color="var(--text-secondary)" />
              <span style={{ fontSize: 13 }}>{fcmStatus.registeredDevices} {l("registered device(s)", "جهاز مسجل")}</span>
            </div>
            {/* Test button */}
            <button
              onClick={handleTestPush}
              disabled={testing}
              style={{
                ...btn,
                marginLeft: "auto",
                backgroundColor: testing ? "var(--bg-surface)" : "var(--main)",
                color: testing ? "var(--text-muted)" : "#fff",
                border: testing ? "1px solid var(--border)" : "none",
                borderRadius: "var(--radius-full)",
                padding: "8px 20px",
                fontSize: 13,
              }}
            >
              {testing
                ? <><RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> {l("Sending…", "جاري الإرسال…")}</>
                : <><Send size={13} /> {l("Send Test Push", "إرسال إشعار تجريبي")}</>
              }
            </button>
          </div>
          {/* Test result */}
          {testResult && (
            <div style={{
              marginTop: 12,
              padding: "12px 14px",
              borderRadius: "var(--radius-md)",
              background: testResult.ok ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
              border: `1px solid ${testResult.ok ? "var(--green)" : "var(--red)"}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {testResult.ok
                  ? <CheckCircle size={15} color="var(--green)" />
                  : <XCircle size={15} color="var(--red)" />
                }
                <span style={{ fontSize: 13, color: testResult.ok ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                  {testResult.msg}
                </span>
              </div>
              {testResult.devices && testResult.devices.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                  {testResult.devices.map((d: any, i: number) => (
                    <div key={i} style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                      {d.ok ? <CheckCircle size={11} color="var(--green)" /> : <XCircle size={11} color="var(--red)" />}
                      <span>{d.platform} — {d.token}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {!fcmStatus.configured && (
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
              ⚠️ {l("Set", "قم بتعيين")} <code>FCM_SERVER_KEY</code> {l("in your", "في ملف")} <code>.env</code> {l("to enable push notifications.", "لتفعيل الإشعارات.")}
            </p>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <button style={tabBtn(view === "inbox")} onClick={() => setView("inbox")}><Inbox size={14} /> {l("Inbox", "الوارد")} {inboxItems.filter(n => !n.is_read).length > 0 ? `(${inboxItems.filter(n => !n.is_read).length})` : ""}</button>
        <button style={tabBtn(view === "templates")} onClick={() => setView("templates")}><Zap size={14} /> {l("Templates", "القوالب")} ({templates.length})</button>
        <button style={tabBtn(view === "welcome")} onClick={() => setView("welcome")}><Mail size={14} /> {l("Welcome Messages", "رسائل الترحيب")}</button>
        <button style={tabBtn(view === "send")} onClick={() => setView("send")}><Send size={14} /> {l("Send Push", "إرسال إشعار")}</button>
        <button style={tabBtn(view === "log")} onClick={() => setView("log")}><RefreshCw size={14} /> {l("Push Log", "سجل الإشعارات")}</button>
      </div>

      {error && <div style={{ padding: "10px 14px", backgroundColor: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.25)", borderRadius: "var(--radius-full)", color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</div>}
      {success && <div style={{ padding: "10px 14px", backgroundColor: "rgba(0,200,100,0.1)", border: "1px solid rgba(0,200,100,0.25)", borderRadius: "var(--radius-full)", color: "var(--green)", fontSize: 13, marginBottom: 16 }}>{success}</div>}

      {/* ── Inbox view ── */}
      {view === "inbox" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{l("Your in-app notifications", "إشعاراتك داخل التطبيق")}</p>
            <div style={{ display: "flex", gap: 8 }}>
              {inboxItems.some(n => !n.is_read) && (
                <button style={btnSecondary} onClick={markAllInboxRead}><CheckCheck size={14} /> {l("Mark all read", "تحديد الكل كمقروء")}</button>
              )}
              <button style={btnSecondary} onClick={loadInbox}><RefreshCw size={14} /> {l("Refresh", "تحديث")}</button>
            </div>
          </div>
          {inboxLoading ? <p style={{ color: "var(--text-secondary)" }}>{l("Loading...", "جاري التحميل...")}</p> : (
            inboxItems.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center" }}>
                <Bell size={36} color="var(--text-muted)" style={{ opacity: 0.4, marginBottom: 12 }} />
                <p style={{ fontSize: 14, color: "var(--text-muted)" }}>{l("No notifications yet", "لا توجد إشعارات بعد")}</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {inboxItems.map(n => (
                  <div key={n.id} onClick={() => { if (!n.is_read) markInboxRead(n.id); }}
                    style={{ padding: "14px 16px", borderRadius: "var(--radius-full)", background: n.is_read ? "var(--bg-card)" : "rgba(59,139,255,0.06)", border: `1px solid ${n.is_read ? "var(--border)" : "rgba(59,139,255,0.2)"}`, cursor: n.is_read ? "default" : "pointer", transition: "all 0.15s" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: "rgba(59,139,255,0.1)", border: "1px solid rgba(59,139,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Bell size={16} color="var(--blue)" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                          <p style={{ fontSize: 14, fontWeight: n.is_read ? 500 : 700 }}>{n.title}</p>
                          {!n.is_read && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--blue)", flexShrink: 0 }} />}
                        </div>
                        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 4 }}>{n.body}</p>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(n.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}

      {/* ── Templates view ── */}
      {view === "templates" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            {/* Filter by Trigger */}
            <select style={{ ...input, width: "auto", borderRadius: "var(--radius-full)", fontSize: 12 }} value={filterTrigger} onChange={e => setFilterTrigger(e.target.value)}>
              <option value="all">{l("All Triggers", "كل المحفزات")}</option>
              {TRIGGERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {/* Filter by Purpose */}
            <select style={{ ...input, width: "auto", borderRadius: "var(--radius-full)", fontSize: 12 }} value={filterPurpose} onChange={e => setFilterPurpose(e.target.value)}>
              <option value="all">{l("All Purposes", "كل الأهداف")}</option>
              {PURPOSES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            {/* Filter by Category */}
            <select style={{ ...input, width: "auto", borderRadius: "var(--radius-full)", fontSize: 12 }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
              <option value="all">{l("All Categories", "كل الفئات")}</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{categoryLabel[c]}</option>)}
            </select>
            {/* Reset */}
            {(filterTrigger !== "all" || filterPurpose !== "all" || filterCat !== "all") && (
              <button style={{ ...btn, backgroundColor: "var(--bg-surface)", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)" }}
                onClick={() => { setFilterTrigger("all"); setFilterPurpose("all"); setFilterCat("all"); }}>
                ✕ {l("Clear", "مسح")}
              </button>
            )}
            <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 4 }}>
              {filteredTemplates.length} / {templates.length}
            </span>
            <button style={{ ...btnAccent, marginLeft: "auto", borderRadius: "var(--radius-full)" }} onClick={() => setShowNewForm(!showNewForm)}>
              <Plus size={14} /> {l("New Template", "قالب جديد")}
            </button>
          </div>

          {showNewForm && (
            <div style={card}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{l("New Push Template", "قالب إشعار جديد")}</h3>
              <div style={{ display: "grid", gap: 10 }}>
                <input style={input} placeholder={l("Slug (unique ID, e.g. my_promo)", "Slug (معرف فريد مثل my_promo)")} value={newSlug} onChange={e => setNewSlug(e.target.value)} />
                <input style={input} placeholder={l("Title", "العنوان")} value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                <textarea style={textarea} placeholder={l("Body (use {{first_name}} etc.)", "المحتوى (استخدم {{first_name}} وغيرها)")} value={newBody} onChange={e => setNewBody(e.target.value)} />
                <div style={{ display: "flex", gap: 10 }}>
                  <select style={{ ...input, flex: 1 }} value={newCategory} onChange={e => setNewCategory(e.target.value)}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{categoryLabel[c]}</option>)}
                  </select>
                  <select style={{ ...input, flex: 1 }} value={newTrigger} onChange={e => setNewTrigger(e.target.value)}>
                    {TRIGGERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <button style={btnAccent} onClick={createTemplate}>{l("Create Template", "إنشاء القالب")}</button>
              </div>
            </div>
          )}

          {loading ? <p style={{ color: "var(--text-secondary)" }}>Loading...</p> : (
            filteredTemplates.map(t => (
              <div key={t.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{t.title}</span>
                    <span style={badge(t.enabled ? "var(--green)" : "var(--red)")}>{t.enabled ? "ON" : "OFF"}</span>
                    <span style={badge("var(--accent)")}>{categoryLabel[t.category] || t.category}</span>
                  </div>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>{t.body}</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      🎯 {triggerLabel(t.trigger_type)}
                    </span>
                    {purposeOfTrigger(t.trigger_type) && (
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: "var(--radius-full)", background: "var(--main-dim)", color: "var(--main)", fontWeight: 600 }}>
                        {purposeLabel(purposeOfTrigger(t.trigger_type))}
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>· {t.slug}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={btnSecondary} onClick={() => { setEditTemplate({ ...t }); setView("edit-template"); }}><Edit3 size={13} /></button>
                  <button style={btnSecondary} onClick={() => toggleTemplate(t)}>{t.enabled ? <XCircle size={13} /> : <CheckCircle size={13} />}</button>
                  <button style={{ ...btnSecondary, color: "var(--red)" }} onClick={() => deleteTemplate(t.id)}><Trash2 size={13} /></button>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {/* ── Edit template ── */}
      {view === "edit-template" && editTemplate && (
        <div style={card}>
          <button style={{ ...btnSecondary, marginBottom: 16 }} onClick={() => setView("templates")}><ArrowLeft size={14} /> {l("Back", "رجوع")}</button>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{l("Edit", "تعديل")}: {editTemplate.slug}</h3>
          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>TITLE</label>
              <input style={input} value={editTemplate.title} onChange={e => setEditTemplate({ ...editTemplate, title: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>BODY</label>
              <textarea style={textarea} value={editTemplate.body} onChange={e => setEditTemplate({ ...editTemplate, body: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>TRIGGER</label>
              <select style={input} value={editTemplate.trigger_type} onChange={e => setEditTemplate({ ...editTemplate, trigger_type: e.target.value })}>
                {TRIGGERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {purposeOfTrigger(editTemplate.trigger_type) && (
                <p style={{ fontSize: 11, color: "var(--main)", marginTop: 4 }}>
                  Purpose: {purposeLabel(purposeOfTrigger(editTemplate.trigger_type))}
                </p>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={!!editTemplate.enabled} onChange={e => setEditTemplate({ ...editTemplate, enabled: e.target.checked ? 1 : 0 })} /> Enabled
              </label>
            </div>
            <button style={btnAccent} onClick={saveTemplate}>{l("Save Changes", "حفظ التغييرات")}</button>
          </div>
        </div>
      )}

      {/* ── Welcome messages ── */}
      {view === "welcome" && (
        <>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
            These messages are sent automatically when a new user or coach registers. Edit content and toggle on/off.
          </p>
          {loading ? <p style={{ color: "var(--text-secondary)" }}>{l("Loading...", "جاري التحميل...")}</p> : (
            <>
              {["user", "coach"].map(target => (
                <div key={target}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, marginTop: 16, textTransform: "capitalize" }}>New {target} Messages</h3>
                  {welcomeMsgs.filter(m => m.target === target).map(m => {
                    const Icon = channelIcon[m.channel] || Bell;
                    return (
                      <div key={m.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                            <Icon size={16} color="var(--accent)" />
                            <span style={{ fontWeight: 700, fontSize: 14, textTransform: "capitalize" }}>{m.channel.replace("_", "-")}</span>
                            <span style={badge(m.enabled ? "var(--green)" : "var(--red)")}>{m.enabled ? "ON" : "OFF"}</span>
                          </div>
                          {m.subject && <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Subject: {m.subject}</p>}
                          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{m.title}</p>
                          <p style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "pre-wrap", maxHeight: 80, overflow: "hidden" }}>{m.body}</p>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button style={btnSecondary} onClick={() => { setEditWelcome({ ...m }); setView("edit-welcome"); }}><Edit3 size={13} /></button>
                          <button style={btnSecondary} onClick={() => toggleWelcome(m)}>{m.enabled ? <XCircle size={13} /> : <CheckCircle size={13} />}</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </>
          )}
        </>
      )}

      {/* ── Edit welcome message ── */}
      {view === "edit-welcome" && editWelcome && (
        <div style={card}>
          <button style={{ ...btnSecondary, marginBottom: 16 }} onClick={() => setView("welcome")}><ArrowLeft size={14} /> {l("Back", "رجوع")}</button>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            Edit: {editWelcome.target} — {editWelcome.channel.replace("_", "-")}
          </h3>
          <div style={{ display: "grid", gap: 10 }}>
            {editWelcome.channel === "email" && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>SUBJECT</label>
                <input style={input} value={editWelcome.subject} onChange={e => setEditWelcome({ ...editWelcome, subject: e.target.value })} />
              </div>
            )}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>TITLE</label>
              <input style={input} value={editWelcome.title} onChange={e => setEditWelcome({ ...editWelcome, title: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>BODY (plain text)</label>
              <textarea style={{ ...textarea, minHeight: 120 }} value={editWelcome.body} onChange={e => setEditWelcome({ ...editWelcome, body: e.target.value })} />
            </div>
            {editWelcome.channel === "email" && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>HTML BODY (optional)</label>
                <textarea style={{ ...textarea, minHeight: 150, fontFamily: "monospace", fontSize: 12 }} value={editWelcome.html_body || ""} onChange={e => setEditWelcome({ ...editWelcome, html_body: e.target.value })} />
              </div>
            )}
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={!!editWelcome.enabled} onChange={e => setEditWelcome({ ...editWelcome, enabled: e.target.checked ? 1 : 0 })} /> Enabled
              </label>
            </div>
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Tokens: {"{{first_name}}"}, {"{{app_url}}"}. Use them in title, body, subject, and HTML.
            </p>
            <button style={btnAccent} onClick={saveWelcome}>{l("Save Changes", "حفظ التغييرات")}</button>
          </div>
        </div>
      )}

      {/* ── Send push ── */}
      {view === "send" && (
        <div style={card}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{l("Send Push Notification", "إرسال إشعار")}</h3>
          <div style={{ display: "grid", gap: 10 }}>
            <input style={input} placeholder={l("Title", "العنوان")} value={sendTitle} onChange={e => setSendTitle(e.target.value)} />
            <textarea style={textarea} placeholder={l("Body (use {{first_name}} for personalization)", "المحتوى (استخدم {{first_name}} للتخصيص)")} value={sendBody} onChange={e => setSendBody(e.target.value)} />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>{l("SEGMENT (blast)", "الشريحة (إرسال جماعي)")}</label>
                <select style={input} value={sendSegment} onChange={e => setSendSegment(e.target.value)}>
                  <option value="all">{l("All Users", "كل المستخدمين")}</option>
                  <option value="users">{l("Users Only", "المستخدمون فقط")}</option>
                  <option value="coaches">{l("Coaches Only", "المدربون فقط")}</option>
                  <option value="inactive">{l("Inactive (7d+)", "غير النشطين (7 أيام+)")}</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>{l("OR SPECIFIC USER ID", "أو رقم مستخدم محدد")}</label>
                <input style={input} placeholder={l("User ID (optional)", "رقم المستخدم (اختياري)")} value={sendUserId} onChange={e => setSendUserId(e.target.value)} />
              </div>
            </div>
            <button style={btnAccent} onClick={handleSend} disabled={sending}>
              <Send size={14} /> {sending ? l("Sending...", "جاري الإرسال...") : l("Send Push", "إرسال الإشعار")}
            </button>
          </div>
        </div>
      )}

      {/* ── Push log ── */}
      {view === "log" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{l("Last 100 push notifications sent", "آخر 100 إشعار تم إرسالها")}</p>
            <button style={btnSecondary} onClick={loadLog}><RefreshCw size={14} /> {l("Refresh", "تحديث")}</button>
          </div>
          {loading ? <p style={{ color: "var(--text-secondary)" }}>{l("Loading...", "جاري التحميل...")}</p> : (
            logEntries.length === 0 ? <p style={{ color: "var(--text-muted)", textAlign: "center", padding: 32 }}>{l("No push notifications sent yet", "لا توجد إشعارات مرسلة بعد")}</p> : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 600 }}>Time</th>
                      <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 600 }}>User</th>
                      <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 600 }}>Title</th>
                      <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 600 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logEntries.map(l => (
                      <tr key={l.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{new Date(l.created_at).toLocaleString()}</td>
                        <td style={{ padding: "8px 12px" }}>{l.user_name || l.user_email || "—"}</td>
                        <td style={{ padding: "8px 12px" }}>
                          <strong>{l.title}</strong>
                          {l.template_slug && <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>({l.template_slug})</span>}
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <span style={badge(l.status === "sent" ? "var(--green)" : "var(--red)")}>{String(l.status || "").replace(/_/g, " ")}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
