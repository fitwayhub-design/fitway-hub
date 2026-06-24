import { apiFetch, getApiBase } from "@/lib/api";
import { clickable } from "@/lib/a11y";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { useState, useEffect } from "react";
import { CheckCircle, X, Clock, ChevronDown, ChevronUp, User, Camera, AlertCircle, Calendar, CreditCard, ClipboardList } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface CoachingRequest {
  id: number; user_id: number; user_name: string; user_email: string; user_avatar: string;
  created_at: string; status: "pending" | "accepted" | "rejected";
  note: string; date: string; time: string; plan: string; level: string; booking_type: string;
  now_body_photo?: string; dream_body_photo?: string;
}

interface UserProfile {
  id: number; name: string; email: string; avatar: string;
  height?: number; weight?: number; gender?: string; age?: number;
  points?: number; steps?: number;
}

interface CoachSubscriptionRequest {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  user_avatar?: string;
  plan_cycle: "monthly" | "yearly";
  plan_type: string;
  amount: number;
  status: string;
  payment_proof?: string;
  created_at: string;
}

export default function CoachRequests() {
  const { token } = useAuth();
  const { t } = useI18n();
  const [requests, setRequests] = useState<CoachingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [userProfiles, setUserProfiles] = useState<Record<number, UserProfile>>({});
  const [loadingProfile, setLoadingProfile] = useState<number | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [subscriptionRequests, setSubscriptionRequests] = useState<CoachSubscriptionRequest[]>([]);

  const api = (path: string, opts?: RequestInit) =>
    apiFetch(path, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts?.headers || {}) } });

  const fetchRequests = async () => {
    try {
      const r = await api("/api/coaching/requests");
      if (r.ok) { const d = await r.json(); setRequests(d.requests || []); }
    } catch {} finally { setLoading(false); }
  };

  const fetchSubscriptionRequests = async () => {
    try {
      const r = await api("/api/payments/coach-subscription-requests");
      if (r.ok) {
        const d = await r.json();
        setSubscriptionRequests(d.subscriptions || []);
      }
    } catch {}
  };

  useEffect(() => {
    fetchRequests();
    fetchSubscriptionRequests();
  }, []);
  useAutoRefresh(() => { fetchRequests(); fetchSubscriptionRequests(); });

  const fetchUserProfile = async (userId: number) => {
    if (userProfiles[userId]) return;
    setLoadingProfile(userId);
    try {
      const r = await apiFetch(`/api/coach/users/${userId}/profile`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) { const d = await r.json(); setUserProfiles(p => ({ ...p, [userId]: d.user })); }
    } catch {} finally { setLoadingProfile(null); }
  };

  const toggleExpand = (req: CoachingRequest) => {
    if (expandedId === req.id) { setExpandedId(null); } else {
      setExpandedId(req.id);
      fetchUserProfile(req.user_id);
    }
  };

  const updateStatus = async (id: number, status: "accepted" | "rejected") => {
    try {
      const r = await api(`/api/coaching/requests/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      if (r.ok) {
        setRequests(rs => rs.map(r => r.id === id ? { ...r, status } : r));
        setMessage(status === "accepted" ? t("coach_requests_athlete_accepted") : t("coach_requests_request_declined"));
        setTimeout(() => setMessage(""), 3000);
      }
    } catch {}
  };

  const pending = requests.filter(r => r.status === "pending");
  const accepted = requests.filter(r => r.status === "accepted");
  const rejected = requests.filter(r => r.status === "rejected");

  const handleSubscriptionDecision = async (id: number, action: "accept" | "decline") => {
    try {
      const endpoint = action === "accept" ? `/api/payments/coach-subscriptions/${id}/coach-accept` : `/api/payments/coach-subscriptions/${id}/coach-decline`;
      const r = await api(endpoint, {
        method: "PATCH",
        body: action === "decline" ? JSON.stringify({ reason: t('declined_by_coach') }) : undefined,
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setSubscriptionRequests((prev) => prev.filter((s) => s.id !== id));
        setMessage(action === "accept" ? t("coach_requests_subscription_accepted") : t("coach_requests_subscription_declined"));
        setTimeout(() => setMessage(""), 3500);
      } else {
        setMessage(d.message || t("coach_requests_subscription_process_failed"));
        setTimeout(() => setMessage(""), 3500);
      }
    } catch {
      setMessage(t("coach_requests_subscription_process_failed"));
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const statusBadge = (status: CoachingRequest["status"]) => {
    if (status === "pending") return <Badge variant="warning"><Clock size={11} strokeWidth={2} /> {t("pending")}</Badge>;
    if (status === "accepted") return <Badge variant="success"><CheckCircle size={11} strokeWidth={2} /> {t("accepted")}</Badge>;
    return <Badge variant="destructive"><X size={11} strokeWidth={2} /> {t("declined")}</Badge>;
  };

  const RequestCard = ({ req }: { req: CoachingRequest }) => {
    const expanded = expandedId === req.id;
    const profile = userProfiles[req.user_id];
    const isLoadingThis = loadingProfile === req.user_id;

    return (
      <Card className="gap-0 overflow-hidden p-0 shadow-soft-sm">
        {/* Header row */}
        <div className="flex cursor-pointer items-center gap-3.5 p-4" {...clickable(() => toggleExpand(req), { label: `Toggle request from ${req.user_name || 'athlete'}` })}>
          <Avatar className="size-11 shrink-0">
            <AvatarImage src={req.user_avatar} alt={req.user_name} />
            <AvatarFallback>{(req.user_name || "A").slice(0, 1)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[15px] font-semibold">{req.user_name}</p>
              {statusBadge(req.status)}
            </div>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {req.plan} {t("coach_requests_plan_suffix")} · {req.booking_type === "session" ? t("coach_requests_per_session") : t("monthly_plan")} · {new Date(req.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {req.status === "pending" && (
              <>
                <Button size="sm" onClick={e => { e.stopPropagation(); updateStatus(req.id, "accepted"); }}>
                  <CheckCircle size={14} strokeWidth={2} /> {t("accept")}
                </Button>
                <Button size="sm" variant="outline" className="text-destructive" onClick={e => { e.stopPropagation(); updateStatus(req.id, "rejected"); }}>
                  <X size={14} strokeWidth={2} /> {t("decline")}
                </Button>
              </>
            )}
            {expanded ? <ChevronUp size={16} strokeWidth={2} className="text-muted-foreground" /> : <ChevronDown size={16} strokeWidth={2} className="text-muted-foreground" />}
          </div>
        </div>

        {/* Expanded: full details */}
        {expanded && (
          <>
            <Separator />
            <div className="p-5">
              <div className="grid gap-5 lg:grid-cols-2">

                {/* Left: User Profile */}
                <div>
                  <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    <User size={12} strokeWidth={2} /> {t("coach_requests_athlete_profile")}
                  </p>
                  {isLoadingThis ? (
                    <div className="flex flex-col gap-2.5">
                      <Skeleton className="h-[68px] rounded-md" />
                      <div className="grid grid-cols-2 gap-2">
                        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[52px] rounded-md" />)}
                      </div>
                    </div>
                  ) : profile ? (
                    <div className="flex flex-col gap-2.5">
                      {/* Avatar + basic info */}
                      <div className="flex items-center gap-3 rounded-md bg-muted p-3">
                        <Avatar className="size-12 shrink-0">
                          <AvatarImage src={profile.avatar} alt={profile.name} />
                          <AvatarFallback>{(profile.name || "A").slice(0, 1)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold">{profile.name}</p>
                          <p className="truncate text-[12px] text-muted-foreground">{profile.email}</p>
                        </div>
                      </div>
                      {/* Stats grid */}
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: t("height_label"), value: profile.height ? `${profile.height} cm` : "—", icon: "📏" },
                          { label: t("weight_label"), value: profile.weight ? `${profile.weight} kg` : "—", icon: "⚖️" },
                          { label: t("coach_requests_gender"), value: profile.gender ? (profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1)) : "—", icon: "👤" },
                          { label: t("points"), value: profile.points?.toLocaleString() ?? "0", icon: "⭐" },
                          { label: t("coach_requests_steps_today"), value: profile.steps?.toLocaleString() ?? "0", icon: "🦶" },
                          { label: t("coach_requests_age"), value: profile.age ? `${profile.age} ${t("coach_requests_years_short")}` : "—", icon: "🎂" },
                        ].map(s => (
                          <div key={s.label} className="rounded-md bg-muted px-3 py-2.5">
                            <p className="mb-1 text-[10px] tracking-wide text-muted-foreground uppercase">{s.icon} {s.label}</p>
                            <p className="text-[14px] font-bold text-[var(--secondary)]">{s.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[13px] text-muted-foreground italic">{t("coach_requests_profile_unavailable")}</div>
                  )}
                </div>

                {/* Right: Request Details */}
                <div>
                  <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    <Calendar size={12} strokeWidth={2} /> {t("coach_requests_request_details")}
                  </p>
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    {[
                      { label: t("table_date"), value: req.date || t("coach_requests_tbd") },
                      { label: t("coach_requests_time"), value: req.time || t("coach_requests_tbd") },
                      { label: t("plan_type"), value: req.plan || t("coach_requests_complete") },
                      { label: t("coach_requests_level"), value: `${t("coach_requests_level")} ${req.level || "1"}` },
                      { label: t("table_type"), value: req.booking_type === "session" ? t("coach_requests_per_session") : t("monthly_plan") },
                      { label: t("coach_requests_requested"), value: new Date(req.created_at).toLocaleDateString() },
                    ].map(s => (
                      <div key={s.label} className="rounded-md bg-muted px-3 py-2.5">
                        <p className="mb-1 text-[10px] tracking-wide text-muted-foreground uppercase">{s.label}</p>
                        <p className="text-[13px] font-bold text-[var(--secondary)] capitalize">{s.value}</p>
                      </div>
                    ))}
                  </div>
                  {req.note && (
                    <div className="mb-3 rounded-md bg-muted px-3.5 py-3">
                      <p className="mb-1.5 text-[10px] tracking-wide text-muted-foreground uppercase">💬 {t("coach_requests_message_from_athlete")}</p>
                      <p className="text-[13px] leading-relaxed text-foreground italic">"{req.note}"</p>
                    </div>
                  )}

                  {/* Body photos */}
                  {(req.now_body_photo || req.dream_body_photo) && (
                    <div>
                      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                        <Camera size={12} strokeWidth={2} /> {t("coach_requests_body_photos")}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: t("coach_requests_now_body"), src: req.now_body_photo },
                          { label: t("coach_requests_dream_body"), src: req.dream_body_photo },
                        ].map(p => p.src ? (
                          <button key={p.label} type="button" className="text-start" onClick={() => setLightboxSrc(p.src!)} aria-label={p.label}>
                            <p className="mb-1 text-[10px] tracking-wide text-muted-foreground uppercase">{p.label}</p>
                            <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-muted transition active:scale-[0.98]">
                              <img src={p.src} alt={p.label} className="size-full object-cover" />
                            </div>
                          </button>
                        ) : null)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </Card>
    );
  };

  // Combined recent timeline — the May meeting asked for requests and
  // recent requests to be shown together ("beysama3"), instead of split
  // across two disconnected sections. We merge incoming coaching requests
  // and pending paid subscriptions into one reverse-chronological feed at
  // the top so the coach sees the latest activity from any source at a
  // glance, then the original detail sections still render below for
  // drill-down.
  const recentCombined = [
    ...requests.map(r => ({ kind: "coaching" as const, id: r.id, name: r.user_name, summary: `${r.plan} plan · ${r.booking_type}`, status: r.status, created_at: r.created_at })),
    ...subscriptionRequests.map(s => ({ kind: "subscription" as const, id: s.id, name: s.user_name, summary: `${s.plan_cycle} ${s.plan_type} · ${s.amount} EGP`, status: s.status, created_at: s.created_at })),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);

  return (
    <div className="mx-auto w-full max-w-[880px] px-4 pb-4">
      <div className="space-y-5">
        <header className="pt-1">
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">{t("coach_requests_title")}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{t("coach_requests_subtitle")}</p>
        </header>

        {/* Unified recent feed (subscriptions + coaching requests together) */}
        {recentCombined.length > 0 && (
          <Card className="gap-0 p-5 shadow-soft-sm">
            <p className="mb-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Recent activity</p>
            <ul className="flex flex-col gap-2">
              {recentCombined.map(item => (
                <li key={`${item.kind}-${item.id}`} className="flex items-center gap-2.5 rounded-md bg-muted px-3 py-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-card text-muted-foreground">
                    {item.kind === "subscription" ? <CreditCard size={15} strokeWidth={2} /> : <ClipboardList size={15} strokeWidth={2} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold">{item.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{item.kind === "subscription" ? "Subscription" : "Coaching request"} · {item.summary}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground capitalize">{item.status}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {message && (
          <div className={`rounded-md px-3.5 py-2.5 text-[13px] font-semibold ${message.startsWith("✅") ? "bg-[color-mix(in_srgb,var(--green)_14%,transparent)] text-[var(--green)]" : "bg-[color-mix(in_srgb,var(--red)_14%,transparent)] text-[var(--red)]"}`}>
            {message}
          </div>
        )}

        {/* Paid subscriptions */}
        <Card className="gap-0 p-5 shadow-soft-sm">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{t("coach_requests_paid_subscriptions")}</p>
            <span className="text-[11px] font-bold text-[var(--amber)]">{subscriptionRequests.length} {t("pending")}</span>
          </div>
          {subscriptionRequests.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">{t("coach_requests_no_paid_subscriptions")}</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {subscriptionRequests.map((sub) => (
                <div key={sub.id} className="rounded-md bg-muted p-3.5">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-9 shrink-0">
                        <AvatarImage src={sub.user_avatar} alt={sub.user_name} />
                        <AvatarFallback>{(sub.user_name || "A").slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold">{sub.user_name}</p>
                        <p className="text-[11px] text-muted-foreground">{sub.plan_cycle} · {sub.plan_type} · {sub.amount} {t('currency_egp')}</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-[var(--amber)]">{new Date(sub.created_at).toLocaleDateString()}</span>
                  </div>
                  {sub.payment_proof && (
                    <div className="mb-2.5">
                      <img
                        src={sub.payment_proof.startsWith("http") ? sub.payment_proof : getApiBase() + sub.payment_proof}
                        alt={t('payment_proof')}
                        className="max-h-[130px] rounded-md object-cover"
                      />
                    </div>
                  )}
                  {/* Admin-first flow: the coach can only act once admin has
                      verified payment (status -> pending_coach). Before that the
                      coach-accept/decline endpoints 403, so show a waiting state
                      instead of buttons that error. */}
                  {sub.status === "pending_coach" ? (
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1" onClick={() => handleSubscriptionDecision(sub.id, "accept")}>
                        <CheckCircle size={14} strokeWidth={2} /> {t("accept")}
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 text-destructive" onClick={() => handleSubscriptionDecision(sub.id, "decline")}>
                        <X size={14} strokeWidth={2} /> {t("coach_requests_decline_refund")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 rounded-md bg-[color-mix(in_srgb,var(--amber)_12%,transparent)] px-3 py-2 text-[12px] font-semibold text-[var(--amber)]">
                      <Clock size={13} strokeWidth={2} /> {t("coach_requests_awaiting_admin")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Status counters */}
        <div className="flex flex-wrap gap-3">
          {[
            { label: t("pending"), count: pending.length, cls: "text-[var(--amber)]" },
            { label: t("accepted"), count: accepted.length, cls: "text-primary" },
            { label: t("declined"), count: rejected.length, cls: "text-muted-foreground" },
          ].map(s => (
            <Card key={s.label} className="min-w-[100px] flex-1 gap-0 p-4 shadow-soft-sm">
              <p className="mb-1 text-[11px] tracking-wide text-muted-foreground uppercase">{s.label}</p>
              <p className={`text-[26px] leading-none font-bold tabular-nums ${s.cls}`}>{s.count}</p>
            </Card>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[76px] rounded-lg" />)}
          </div>
        ) : requests.length === 0 ? (
          <Card className="items-center gap-2 py-10 text-center shadow-soft-sm">
            <AlertCircle size={40} strokeWidth={1.5} className="text-muted-foreground" />
            <p className="text-[15px] text-muted-foreground">{t("coach_requests_empty")}</p>
          </Card>
        ) : (
          <>
            {pending.length > 0 && (
              <div className="flex flex-col gap-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-[var(--amber)] uppercase">
                  <Clock size={12} strokeWidth={2} /> {t("coach_requests_awaiting_review")} ({pending.length})
                </p>
                {pending.map(r => <RequestCard key={r.id} req={r} />)}
              </div>
            )}
            {accepted.length > 0 && (
              <div className="flex flex-col gap-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-primary uppercase">
                  <CheckCircle size={12} strokeWidth={2} /> {t("accepted")} ({accepted.length})
                </p>
                {accepted.map(r => <RequestCard key={r.id} req={r} />)}
              </div>
            )}
            {rejected.length > 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{t("declined")} ({rejected.length})</p>
                {rejected.map(r => <RequestCard key={r.id} req={r} />)}
              </div>
            )}
          </>
        )}
      </div>

      {/* Lightbox */}
      <Dialog open={!!lightboxSrc} onOpenChange={(o) => { if (!o) setLightboxSrc(null); }}>
        <DialogContent className="max-w-[min(92vw,640px)] bg-transparent p-0 shadow-none ring-0">
          <DialogTitle className="sr-only">{t('body_photo')}</DialogTitle>
          {lightboxSrc && <img src={lightboxSrc} alt={t('body_photo')} className="max-h-[88dvh] w-full rounded-lg object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
