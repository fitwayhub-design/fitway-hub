import { useState, useEffect, useCallback } from "react";
import { Bell, Send, Edit3, Trash2, Plus, CheckCircle, XCircle, RefreshCw, Zap, ArrowLeft, Mail, Smartphone, MessageSquare, Inbox, CheckCheck, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { getApiBase } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

  const filteredTemplates = templates.filter(t => {
    if (filterCat !== "all" && t.category !== filterCat) return false;
    if (filterTrigger !== "all" && t.trigger_type !== filterTrigger) return false;
    if (filterPurpose !== "all" && purposeOfTrigger(t.trigger_type) !== filterPurpose) return false;
    return true;
  });

  const unreadInbox = inboxItems.filter(n => !n.is_read).length;

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2.5 text-[28px] font-bold leading-tight tracking-tight">
        <Bell size={24} strokeWidth={2} className="text-primary" /> {l("Push Notifications", "الإشعارات")}
      </h1>

      {/* FCM Status */}
      {fcmStatus && (
        <Card className="gap-0 p-5">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {/* Status indicators */}
            <div className="flex items-center gap-2">
              {fcmStatus.configured
                ? <CheckCircle size={16} strokeWidth={2} className="text-[var(--green)]" />
                : <XCircle size={16} strokeWidth={2} className="text-destructive" />}
              <span className="text-[13px] font-semibold">
                FCM: {fcmStatus.configured ? `Configured (${fcmStatus.method})` : "Not configured"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Smartphone size={16} strokeWidth={2} className="text-muted-foreground" />
              <span className="text-[13px]">{fcmStatus.registeredDevices} {l("registered device(s)", "جهاز مسجل")}</span>
            </div>
            {/* Test button */}
            <Button variant="secondary" size="sm" onClick={handleTestPush} disabled={testing} className="ms-auto gap-1.5">
              {testing
                ? <><RefreshCw size={13} strokeWidth={2} className="animate-spin" /> {l("Sending…", "جاري الإرسال…")}</>
                : <><Send size={13} strokeWidth={2} /> {l("Send Test Push", "إرسال إشعار تجريبي")}</>
              }
            </Button>
          </div>
          {/* Test result */}
          {testResult && (
            <div className={cn(
              "mt-3 rounded-md p-3.5 shadow-soft-xs",
              testResult.ok ? "bg-[color-mix(in_srgb,var(--green)_10%,transparent)]" : "bg-[color-mix(in_srgb,var(--red)_10%,transparent)]",
            )}>
              <div className="flex items-center gap-2">
                {testResult.ok
                  ? <CheckCircle size={15} strokeWidth={2} className="text-[var(--green)]" />
                  : <XCircle size={15} strokeWidth={2} className="text-destructive" />}
                <span className={cn("text-[13px] font-semibold", testResult.ok ? "text-[var(--green)]" : "text-destructive")}>
                  {testResult.msg}
                </span>
              </div>
              {testResult.devices && testResult.devices.length > 0 && (
                <div className="mt-2 flex flex-col gap-1">
                  {testResult.devices.map((d: any, i: number) => (
                    <div key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      {d.ok
                        ? <CheckCircle size={11} strokeWidth={2} className="text-[var(--green)]" />
                        : <XCircle size={11} strokeWidth={2} className="text-destructive" />}
                      <span>{d.platform} — {d.token}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {!fcmStatus.configured && (
            <p className="mt-2 text-[12px] text-muted-foreground">
              ⚠️ {l("Set", "قم بتعيين")} <code className="rounded bg-muted px-1 py-0.5 text-[11px]">FCM_SERVER_KEY</code> {l("in your", "في ملف")} <code className="rounded bg-muted px-1 py-0.5 text-[11px]">.env</code> {l("to enable push notifications.", "لتفعيل الإشعارات.")}
            </p>
          )}
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={view === "edit-template" ? "templates" : view === "edit-welcome" ? "welcome" : view} onValueChange={v => setView(v as View)}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="inbox"><Inbox size={14} strokeWidth={2} /> {l("Inbox", "الوارد")} {unreadInbox > 0 ? `(${unreadInbox})` : ""}</TabsTrigger>
          <TabsTrigger value="templates"><Zap size={14} strokeWidth={2} /> {l("Templates", "القوالب")} ({templates.length})</TabsTrigger>
          <TabsTrigger value="welcome"><Mail size={14} strokeWidth={2} /> {l("Welcome Messages", "رسائل الترحيب")}</TabsTrigger>
          <TabsTrigger value="send"><Send size={14} strokeWidth={2} /> {l("Send Push", "إرسال إشعار")}</TabsTrigger>
          <TabsTrigger value="log"><RefreshCw size={14} strokeWidth={2} /> {l("Push Log", "سجل الإشعارات")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {error && <div className="rounded-md bg-destructive/10 px-3.5 py-2.5 text-[13px] text-destructive shadow-soft-xs">{error}</div>}
      {success && <div className="rounded-md bg-[color-mix(in_srgb,var(--green)_10%,transparent)] px-3.5 py-2.5 text-[13px] text-[var(--green)] shadow-soft-xs">{success}</div>}

      {/* ── Inbox view ── */}
      {view === "inbox" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-muted-foreground">{l("Your in-app notifications", "إشعاراتك داخل التطبيق")}</p>
            <div className="flex gap-2">
              {inboxItems.some(n => !n.is_read) && (
                <Button variant="outline" size="sm" onClick={markAllInboxRead} className="gap-1.5"><CheckCheck size={14} strokeWidth={2} /> {l("Mark all read", "تحديد الكل كمقروء")}</Button>
              )}
              <Button variant="outline" size="sm" onClick={loadInbox} className="gap-1.5"><RefreshCw size={14} strokeWidth={2} /> {l("Refresh", "تحديث")}</Button>
            </div>
          </div>
          {inboxLoading ? (
            <div className="flex flex-col gap-2.5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[76px] w-full rounded-lg" />)}</div>
          ) : (
            inboxItems.length === 0 ? (
              <Card className="items-center gap-3 p-12 text-center">
                <div className="grid size-14 place-items-center rounded-full bg-muted">
                  <Bell size={26} strokeWidth={2} className="text-muted-foreground" />
                </div>
                <p className="text-[14px] text-muted-foreground">{l("No notifications yet", "لا توجد إشعارات بعد")}</p>
              </Card>
            ) : (
              <div className="flex flex-col gap-2.5">
                {inboxItems.map(n => (
                  <div
                    key={n.id}
                    onClick={() => { if (!n.is_read) markInboxRead(n.id); }}
                    className={cn(
                      "flex items-start gap-3 rounded-lg p-4 shadow-soft-sm transition",
                      n.is_read
                        ? "bg-card"
                        : "cursor-pointer bg-[var(--secondary-dim)] ring-1 ring-[color-mix(in_srgb,var(--secondary)_25%,transparent)]",
                    )}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--secondary-dim)]">
                      <Bell size={16} strokeWidth={2} className="text-[var(--secondary)]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <p className={cn("text-[14px] leading-snug", n.is_read ? "font-medium" : "font-bold")}>{n.title}</p>
                        {!n.is_read && <span className="size-1.5 shrink-0 rounded-full bg-[var(--secondary)]" />}
                      </div>
                      <p className="mb-1 text-[13px] leading-relaxed text-muted-foreground">{n.body}</p>
                      <span className="text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* ── Templates view ── */}
      {view === "templates" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter by Trigger */}
            <Select value={filterTrigger} onValueChange={setFilterTrigger}>
              <SelectTrigger size="sm" aria-label={l("Filter by trigger", "تصفية حسب المحفز")}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{l("All Triggers", "كل المحفزات")}</SelectItem>
                {TRIGGERS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {/* Filter by Purpose */}
            <Select value={filterPurpose} onValueChange={setFilterPurpose}>
              <SelectTrigger size="sm" aria-label={l("Filter by purpose", "تصفية حسب الهدف")}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{l("All Purposes", "كل الأهداف")}</SelectItem>
                {PURPOSES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {/* Filter by Category */}
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger size="sm" aria-label={l("Filter by category", "تصفية حسب الفئة")}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{l("All Categories", "كل الفئات")}</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{categoryLabel[c]}</SelectItem>)}
              </SelectContent>
            </Select>
            {/* Reset */}
            {(filterTrigger !== "all" || filterPurpose !== "all" || filterCat !== "all") && (
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground"
                onClick={() => { setFilterTrigger("all"); setFilterPurpose("all"); setFilterCat("all"); }}>
                <X size={14} strokeWidth={2} /> {l("Clear", "مسح")}
              </Button>
            )}
            <span className="text-[12px] text-muted-foreground">
              {filteredTemplates.length} / {templates.length}
            </span>
            <Button size="sm" className="ms-auto gap-1.5" onClick={() => setShowNewForm(!showNewForm)}>
              <Plus size={14} strokeWidth={2} /> {l("New Template", "قالب جديد")}
            </Button>
          </div>

          {showNewForm && (
            <Card className="gap-3 p-5">
              <h3 className="text-[16px] font-bold">{l("New Push Template", "قالب إشعار جديد")}</h3>
              <Input placeholder={l("Slug (unique ID, e.g. my_promo)", "Slug (معرف فريد مثل my_promo)")} value={newSlug} onChange={e => setNewSlug(e.target.value)} aria-label={l("Slug", "Slug")} />
              <Input placeholder={l("Title", "العنوان")} value={newTitle} onChange={e => setNewTitle(e.target.value)} aria-label={l("Title", "العنوان")} />
              <Textarea placeholder={l("Body (use {{first_name}} etc.)", "المحتوى (استخدم {{first_name}} وغيرها)")} value={newBody} onChange={e => setNewBody(e.target.value)} aria-label={l("Body", "المحتوى")} />
              <div className="flex flex-wrap gap-2.5">
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger className="flex-1" aria-label={l("Category", "الفئة")}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{categoryLabel[c]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={newTrigger} onValueChange={setNewTrigger}>
                  <SelectTrigger className="flex-1" aria-label={l("Trigger", "المحفز")}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRIGGERS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={createTemplate} className="w-fit">{l("Create Template", "إنشاء القالب")}</Button>
            </Card>
          )}

          {loading ? (
            <div className="flex flex-col gap-2.5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[96px] w-full rounded-lg" />)}</div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {filteredTemplates.map(t => (
                <Card key={t.id} className="flex-row items-start justify-between gap-3 p-5">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-bold">{t.title}</span>
                      <Badge variant={t.enabled ? "success" : "destructive"}>{t.enabled ? "ON" : "OFF"}</Badge>
                      <Badge variant="default">{categoryLabel[t.category] || t.category}</Badge>
                    </div>
                    <p className="mb-1.5 text-[13px] text-muted-foreground">{t.body}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">🎯 {triggerLabel(t.trigger_type)}</span>
                      {purposeOfTrigger(t.trigger_type) && (
                        <Badge variant="accent" className="text-[10px]">{purposeLabel(purposeOfTrigger(t.trigger_type))}</Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground">· {t.slug}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button variant="outline" size="icon-sm" aria-label={l("Edit", "تعديل")} onClick={() => { setEditTemplate({ ...t }); setView("edit-template"); }}><Edit3 size={15} strokeWidth={2} /></Button>
                    <Button variant="outline" size="icon-sm" aria-label={t.enabled ? l("Disable", "تعطيل") : l("Enable", "تفعيل")} onClick={() => toggleTemplate(t)}>{t.enabled ? <XCircle size={15} strokeWidth={2} /> : <CheckCircle size={15} strokeWidth={2} />}</Button>
                    <Button variant="outline" size="icon-sm" aria-label={l("Delete", "حذف")} className="text-destructive hover:text-destructive" onClick={() => deleteTemplate(t.id)}><Trash2 size={15} strokeWidth={2} /></Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Edit template ── */}
      {view === "edit-template" && editTemplate && (
        <Card className="gap-4 p-5">
          <Button variant="ghost" size="sm" className="-ms-2 w-fit gap-1.5 text-muted-foreground" onClick={() => setView("templates")}><ArrowLeft size={14} strokeWidth={2} /> {l("Back", "رجوع")}</Button>
          <h3 className="text-[16px] font-bold">{l("Edit", "تعديل")}: {editTemplate.slug}</h3>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="tpl-title">TITLE</Label>
              <Input id="tpl-title" value={editTemplate.title} onChange={e => setEditTemplate({ ...editTemplate, title: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tpl-body">BODY</Label>
              <Textarea id="tpl-body" value={editTemplate.body} onChange={e => setEditTemplate({ ...editTemplate, body: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tpl-trigger">TRIGGER</Label>
              <Select value={editTemplate.trigger_type} onValueChange={v => setEditTemplate({ ...editTemplate, trigger_type: v })}>
                <SelectTrigger id="tpl-trigger" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRIGGERS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {purposeOfTrigger(editTemplate.trigger_type) && (
                <p className="text-[11px] text-primary">Purpose: {purposeLabel(purposeOfTrigger(editTemplate.trigger_type))}</p>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <Switch id="tpl-enabled" checked={!!editTemplate.enabled} onCheckedChange={c => setEditTemplate({ ...editTemplate, enabled: c ? 1 : 0 })} />
              <Label htmlFor="tpl-enabled">Enabled</Label>
            </div>
            <Button onClick={saveTemplate} className="w-fit">{l("Save Changes", "حفظ التغييرات")}</Button>
          </div>
        </Card>
      )}

      {/* ── Welcome messages ── */}
      {view === "welcome" && (
        <div className="space-y-4">
          <p className="text-[13px] text-muted-foreground">
            These messages are sent automatically when a new user or coach registers. Edit content and toggle on/off.
          </p>
          {loading ? (
            <div className="flex flex-col gap-2.5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[110px] w-full rounded-lg" />)}</div>
          ) : (
            <>
              {["user", "coach"].map(target => (
                <div key={target} className="space-y-2.5">
                  <h3 className="mt-2 text-[16px] font-bold capitalize">New {target} Messages</h3>
                  {welcomeMsgs.filter(m => m.target === target).map(m => {
                    const Icon = channelIcon[m.channel] || Bell;
                    return (
                      <Card key={m.id} className="flex-row items-start justify-between gap-3 p-5">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1.5 flex flex-wrap items-center gap-2">
                            <Icon size={16} strokeWidth={2} className="text-primary" />
                            <span className="text-[14px] font-bold capitalize">{m.channel.replace("_", "-")}</span>
                            <Badge variant={m.enabled ? "success" : "destructive"}>{m.enabled ? "ON" : "OFF"}</Badge>
                          </div>
                          {m.subject && <p className="mb-0.5 text-[13px] font-semibold">Subject: {m.subject}</p>}
                          <p className="mb-0.5 text-[13px] font-semibold">{m.title}</p>
                          <p className="max-h-20 overflow-hidden text-[12px] whitespace-pre-wrap text-muted-foreground">{m.body}</p>
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          <Button variant="outline" size="icon-sm" aria-label={l("Edit", "تعديل")} onClick={() => { setEditWelcome({ ...m }); setView("edit-welcome"); }}><Edit3 size={15} strokeWidth={2} /></Button>
                          <Button variant="outline" size="icon-sm" aria-label={m.enabled ? l("Disable", "تعطيل") : l("Enable", "تفعيل")} onClick={() => toggleWelcome(m)}>{m.enabled ? <XCircle size={15} strokeWidth={2} /> : <CheckCircle size={15} strokeWidth={2} />}</Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── Edit welcome message ── */}
      {view === "edit-welcome" && editWelcome && (
        <Card className="gap-4 p-5">
          <Button variant="ghost" size="sm" className="-ms-2 w-fit gap-1.5 text-muted-foreground" onClick={() => setView("welcome")}><ArrowLeft size={14} strokeWidth={2} /> {l("Back", "رجوع")}</Button>
          <h3 className="text-[16px] font-bold">
            Edit: {editWelcome.target} — {editWelcome.channel.replace("_", "-")}
          </h3>
          <div className="grid gap-4">
            {editWelcome.channel === "email" && (
              <div className="grid gap-1.5">
                <Label htmlFor="wm-subject">SUBJECT</Label>
                <Input id="wm-subject" value={editWelcome.subject} onChange={e => setEditWelcome({ ...editWelcome, subject: e.target.value })} />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="wm-title">TITLE</Label>
              <Input id="wm-title" value={editWelcome.title} onChange={e => setEditWelcome({ ...editWelcome, title: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="wm-body">BODY (plain text)</Label>
              <Textarea id="wm-body" className="min-h-[120px]" value={editWelcome.body} onChange={e => setEditWelcome({ ...editWelcome, body: e.target.value })} />
            </div>
            {editWelcome.channel === "email" && (
              <div className="grid gap-1.5">
                <Label htmlFor="wm-html">HTML BODY (optional)</Label>
                <Textarea id="wm-html" className="min-h-[150px] font-mono text-[12px]" value={editWelcome.html_body || ""} onChange={e => setEditWelcome({ ...editWelcome, html_body: e.target.value })} />
              </div>
            )}
            <div className="flex items-center gap-2.5">
              <Switch id="wm-enabled" checked={!!editWelcome.enabled} onCheckedChange={c => setEditWelcome({ ...editWelcome, enabled: c ? 1 : 0 })} />
              <Label htmlFor="wm-enabled">Enabled</Label>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Tokens: {"{{first_name}}"}, {"{{app_url}}"}. Use them in title, body, subject, and HTML.
            </p>
            <Button onClick={saveWelcome} className="w-fit">{l("Save Changes", "حفظ التغييرات")}</Button>
          </div>
        </Card>
      )}

      {/* ── Send push ── */}
      {view === "send" && (
        <Card className="gap-4 p-5">
          <h3 className="text-[16px] font-bold">{l("Send Push Notification", "إرسال إشعار")}</h3>
          <div className="grid gap-4">
            <Input placeholder={l("Title", "العنوان")} value={sendTitle} onChange={e => setSendTitle(e.target.value)} aria-label={l("Title", "العنوان")} />
            <Textarea placeholder={l("Body (use {{first_name}} for personalization)", "المحتوى (استخدم {{first_name}} للتخصيص)")} value={sendBody} onChange={e => setSendBody(e.target.value)} aria-label={l("Body", "المحتوى")} />
            <div className="flex flex-wrap gap-4">
              <div className="grid flex-1 gap-1.5">
                <Label htmlFor="send-segment">{l("SEGMENT (blast)", "الشريحة (إرسال جماعي)")}</Label>
                <Select value={sendSegment} onValueChange={setSendSegment}>
                  <SelectTrigger id="send-segment" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{l("All Users", "كل المستخدمين")}</SelectItem>
                    <SelectItem value="users">{l("Users Only", "المستخدمون فقط")}</SelectItem>
                    <SelectItem value="coaches">{l("Coaches Only", "المدربون فقط")}</SelectItem>
                    <SelectItem value="inactive">{l("Inactive (7d+)", "غير النشطين (7 أيام+)")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid flex-1 gap-1.5">
                <Label htmlFor="send-user-id">{l("OR SPECIFIC USER ID", "أو رقم مستخدم محدد")}</Label>
                <Input id="send-user-id" placeholder={l("User ID (optional)", "رقم المستخدم (اختياري)")} value={sendUserId} onChange={e => setSendUserId(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleSend} disabled={sending} className="w-fit gap-1.5">
              <Send size={14} strokeWidth={2} /> {sending ? l("Sending...", "جاري الإرسال...") : l("Send Push", "إرسال الإشعار")}
            </Button>
          </div>
        </Card>
      )}

      {/* ── Push log ── */}
      {view === "log" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-muted-foreground">{l("Last 100 push notifications sent", "آخر 100 إشعار تم إرسالها")}</p>
            <Button variant="outline" size="sm" onClick={loadLog} className="gap-1.5"><RefreshCw size={14} strokeWidth={2} /> {l("Refresh", "تحديث")}</Button>
          </div>
          {loading ? (
            <div className="flex flex-col gap-2.5">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)}</div>
          ) : (
            logEntries.length === 0 ? (
              <Card className="items-center gap-3 p-12 text-center">
                <div className="grid size-14 place-items-center rounded-full bg-muted">
                  <Bell size={26} strokeWidth={2} className="text-muted-foreground" />
                </div>
                <p className="text-[14px] text-muted-foreground">{l("No push notifications sent yet", "لا توجد إشعارات مرسلة بعد")}</p>
              </Card>
            ) : (
              <Card className="gap-0 overflow-hidden p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="shadow-soft-xs [&>th]:px-3.5 [&>th]:py-3 [&>th]:text-start [&>th]:font-semibold [&>th]:text-muted-foreground">
                        <th>Time</th>
                        <th>User</th>
                        <th>Title</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logEntries.map((l) => (
                        <tr key={l.id} className="odd:bg-muted/40 [&>td]:px-3.5 [&>td]:py-3 [&>td]:align-middle">
                          <td className="whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                          <td>{l.user_name || l.user_email || "—"}</td>
                          <td>
                            <strong>{l.title}</strong>
                            {l.template_slug && <span className="ms-1.5 text-[11px] text-muted-foreground">({l.template_slug})</span>}
                          </td>
                          <td>
                            <Badge variant={l.status === "sent" ? "success" : "destructive"}>{String(l.status || "").replace(/_/g, " ")}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )
          )}
        </div>
      )}
    </div>
  );
}
