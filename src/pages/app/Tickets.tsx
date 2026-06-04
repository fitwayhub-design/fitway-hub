/**
 * Tickets — athlete & coach
 * ─────────────────────────────────────────────────────────
 * Lists the current user's tickets (filed by them if athlete, received if
 * coach) and provides a detail view with replies. Used everywhere we used
 * to expose direct chat: an athlete opens a ticket on a workout/nutrition
 * item, the coach answers, and either side can resolve.
 *
 * Mounted at /app/tickets and /coach/tickets — same component, role is
 * inferred from useAuth().
 */
import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { getApiBase } from "@/lib/api";
import { getAvatar } from "@/lib/avatar";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { Plus, Send, CheckCircle, RefreshCw, MessageCircle, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Ticket {
  id: number;
  user_id: number; coach_id: number;
  user_name: string; coach_name: string;
  user_avatar?: string; coach_avatar?: string;
  kind: string; subject: string; body: string;
  status: "open" | "resolved" | "closed";
  workout_plan_id?: number | null; nutrition_plan_id?: number | null; exercise_key?: string | null;
  created_at: string; updated_at: string;
}
interface Reply { id: number; ticket_id: number; author_id: number; author_role: string; body: string; author_name: string; author_avatar?: string; created_at: string; }

export default function Tickets() {
  const { user, token } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const focusId = Number(params.get("id")) || null;
  const preselectCoach = Number(params.get("coach")) || null;

  const isCoach = user?.role === "coach";
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [composeMode, setComposeMode] = useState(!!preselectCoach && !isCoach);
  const [newBody, setNewBody] = useState("");
  const [newCoachId, setNewCoachId] = useState<number | "">(preselectCoach || "");
  const [coachOptions, setCoachOptions] = useState<{ id: number; name: string }[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyDraft, setReplyDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Cascading subject — athlete picks workout/nutrition, then a day from the
  // coach plan, then the specific exercise or meal. No free text. Subject is
  // built from the selection so coaches see exactly what's being asked about.
  const [ticketKind, setTicketKind] = useState<"workout" | "nutrition">("workout");
  const [workoutDays, setWorkoutDays] = useState<{ day: string; items: { id: string; name: string }[] }[]>([]);
  const [nutritionDays, setNutritionDays] = useState<{ day: string; items: { id: string; name: string }[] }[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [selectedItemKey, setSelectedItemKey] = useState<string>("");
  const [selectedItemLabel, setSelectedItemLabel] = useState<string>("");
  const [planMeta, setPlanMeta] = useState<{ workout_plan_id: number | null; nutrition_plan_id: number | null }>({ workout_plan_id: null, nutrition_plan_id: null });

  const api = (path: string, init?: RequestInit) =>
    fetch(getApiBase() + path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers || {}) } });

  const loadList = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await api("/api/tickets");
      if (r.ok) {
        const d = await r.json();
        setTickets(d.tickets || []);
        if (focusId && !selected) {
          const t2 = (d.tickets || []).find((x: Ticket) => x.id === focusId);
          if (t2) openTicket(t2);
        }
      }
    } finally { setLoading(false); }
  };
  const openTicket = async (t: Ticket) => {
    setSelected(t);
    setReplies([]);
    try {
      const r = await api(`/api/tickets/${t.id}`);
      if (r.ok) { const d = await r.json(); setReplies(d.replies || []); setSelected(d.ticket || t); }
    } catch { /* keep list-version of ticket */ }
  };
  const sendReply = async () => {
    if (!selected || !replyDraft.trim()) return;
    setBusy(true);
    try {
      const r = await api(`/api/tickets/${selected.id}/reply`, { method: "POST", body: JSON.stringify({ body: replyDraft.trim() }) });
      if (r.ok) { setReplyDraft(""); setErr(""); await openTicket(selected); await loadList(); }
      else { const d = await r.json().catch(() => ({})); setErr(d.message || "Couldn't send reply."); }
    } finally { setBusy(false); }
  };
  const setStatus = async (status: "open" | "resolved" | "closed") => {
    if (!selected) return;
    setBusy(true);
    try {
      const r = await api(`/api/tickets/${selected.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      if (r.ok) { setSelected({ ...selected, status }); await loadList(); }
    } finally { setBusy(false); }
  };
  const createTicket = async () => {
    if (!newCoachId || !selectedItemKey || !newBody.trim()) return;
    setBusy(true);
    try {
      const subject = `${ticketKind === "workout" ? "Workout" : "Nutrition"} · ${selectedDay} · ${selectedItemLabel}`;
      const payload: any = {
        coach_id: newCoachId,
        subject,
        body: newBody.trim(),
        kind: ticketKind === "workout" ? "workout_question" : "nutrition_question",
      };
      if (ticketKind === "workout") {
        payload.workout_plan_id = planMeta.workout_plan_id;
        payload.exercise_key = selectedItemKey;
      } else {
        payload.nutrition_plan_id = planMeta.nutrition_plan_id;
        payload.meal_key = selectedItemKey;
      }
      const r = await api("/api/tickets", { method: "POST", body: JSON.stringify(payload) });
      if (r.ok) {
        const d = await r.json();
        setErr("");
        setComposeMode(false); setNewBody(""); setNewCoachId("");
        setSelectedDay(""); setSelectedItemKey(""); setSelectedItemLabel("");
        await loadList();
        if (d.ticket) openTicket(d.ticket);
      } else { const d = await r.json().catch(() => ({})); setErr(d.message || "Couldn't create ticket."); }
    } finally { setBusy(false); }
  };

  useEffect(() => { loadList(); /* eslint-disable-next-line */ }, []);
  useAutoRefresh(() => loadList(true));

  // Load coaches the athlete is subscribed to (for the compose form). Coaches
  // can't open tickets to themselves so this is skipped for them.
  useEffect(() => {
    if (isCoach || !composeMode) return;
    api("/api/payments/my-subscriptions").then(r => r.ok ? r.json() : { subscriptions: [] }).then(d => {
      const opts = (d.subscriptions || [])
        .filter((s: any) => s.coach_id && s.coach_name)
        .map((s: any) => ({ id: s.coach_id, name: s.coach_name }));
      // de-duplicate by id
      const seen = new Set<number>();
      setCoachOptions(opts.filter((o: any) => !seen.has(o.id) && seen.add(o.id)));
    }).catch(() => {});
  }, [composeMode, isCoach]);

  // When a coach is selected, fetch their workout + nutrition plans assigned
  // to this athlete and group items by day for the cascading dropdowns.
  useEffect(() => {
    if (!composeMode || !newCoachId || isCoach) return;
    setSelectedDay(""); setSelectedItemKey(""); setSelectedItemLabel("");
    const groupByDay = (raw: any, itemNameKey: "name" | "meal_name" | "exercise") => {
      try {
        const list = typeof raw === "string" ? JSON.parse(raw) : (raw || []);
        if (!Array.isArray(list)) return [];
        const map = new Map<string, { id: string; name: string }[]>();
        list.forEach((it: any, i: number) => {
          const day = it.day || "Day";
          const arr = map.get(day) || [];
          const name = it.name || it.meal_name || it.exercise || `Item ${i + 1}`;
          arr.push({ id: String(i), name });
          map.set(day, arr);
        });
        return Array.from(map.entries()).map(([day, items]) => ({ day, items }));
      } catch { return []; }
    };
    Promise.all([
      api("/api/plans/coach-workout-plan").then(r => r.ok ? r.json() : null).catch(() => null),
      api("/api/plans/coach-nutrition-plan").then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([w, n]) => {
      setPlanMeta({
        workout_plan_id: w?.plan?.id ?? null,
        nutrition_plan_id: n?.plan?.id ?? null,
      });
      setWorkoutDays(groupByDay(w?.plan?.exercises, "name"));
      setNutritionDays(groupByDay(n?.plan?.meals, "meal_name"));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composeMode, newCoachId, isCoach]);

  const grouped = useMemo(() => {
    const open = tickets.filter(t => t.status === "open");
    const done = tickets.filter(t => t.status !== "open");
    return { open, done };
  }, [tickets]);

  if (selected) {
    return (
      <div className="mx-auto w-full max-w-[760px] px-4 pb-4">
        <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="-ms-2 mb-3 gap-1.5 text-muted-foreground">
          <ChevronLeft size={16} /> Back to tickets
        </Button>

        <div className="mb-4 rounded-lg bg-card p-5 shadow-soft-sm">
          <div className="mb-2.5 flex items-center justify-between gap-2.5">
            <p className="text-[11px] tracking-wider text-muted-foreground uppercase">
              Ticket #{selected.id} · {selected.kind || "general"}
            </p>
            <StatusPill status={selected.status} />
          </div>
          <h2 className="mb-2 text-[19px] font-bold tracking-tight">{selected.subject}</h2>
          {selected.body && <p className="text-[14px] leading-relaxed whitespace-pre-wrap text-muted-foreground">{selected.body}</p>}
          <p className="mt-3 text-[11px] text-muted-foreground">
            {new Date(selected.created_at).toLocaleString()} · {isCoach ? `from ${selected.user_name}` : `to ${selected.coach_name}`}
          </p>
        </div>

        <div className="mb-4 flex flex-col gap-2.5">
          {replies.map(r => {
            const mine = String(r.author_id) === String(user?.id);
            return (
              <div key={r.id} className={cn("flex gap-2.5", mine ? "justify-end" : "justify-start")}>
                {!mine && (
                  <Avatar className="size-8 shrink-0">
                    <AvatarImage src={r.author_avatar || getAvatar(r.author_id, null, null, r.author_name)} alt="" />
                    <AvatarFallback className="text-[11px]">{(r.author_name || "U").slice(0, 1)}</AvatarFallback>
                  </Avatar>
                )}
                <div className={cn("max-w-[78%] rounded-2xl px-3.5 py-2.5 shadow-soft-sm", mine ? "bg-primary text-primary-foreground" : "bg-card text-foreground")}>
                  <p className="mb-0.5 text-[10.5px] font-bold opacity-70">{r.author_name} · {r.author_role}</p>
                  <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{r.body}</p>
                  <p className="mt-1 text-[10px] opacity-60">{new Date(r.created_at).toLocaleString()}</p>
                </div>
              </div>
            );
          })}
        </div>

        {selected.status !== "closed" && (
          <div>
            <div className="flex items-end gap-2">
              <Textarea value={replyDraft} onChange={e => { setReplyDraft(e.target.value); if (err) setErr(""); }} placeholder="Write a reply…" rows={2} className="min-h-11 flex-1" />
              <Button onClick={sendReply} disabled={busy || !replyDraft.trim()} className="gap-1.5">
                <Send size={14} /> Send
              </Button>
            </div>
            {err && <p className="mt-1.5 text-[12px] text-[var(--red)]">{err}</p>}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          {selected.status !== "resolved" && (
            <Button variant="outline" size="sm" onClick={() => setStatus("resolved")} disabled={busy}
              className="gap-1.5 text-[var(--green)] ring-[color-mix(in_srgb,var(--green)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--green)_10%,transparent)] hover:text-[var(--green)]">
              <CheckCircle size={13} /> Mark resolved
            </Button>
          )}
          {selected.status === "resolved" && (
            <Button variant="outline" size="sm" onClick={() => setStatus("open")} disabled={busy} className="gap-1.5 text-muted-foreground">
              <RefreshCw size={13} /> Reopen
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pb-4">
      <header className="mb-5 flex items-center justify-between gap-3 pt-1">
        <h1 className="text-[26px] font-bold leading-none tracking-tight">Tickets</h1>
        {!isCoach && (
          <Button size="sm" onClick={() => setComposeMode(v => !v)} className="gap-1.5">
            <Plus size={15} /> New ticket
          </Button>
        )}
      </header>

      {composeMode && !isCoach && (() => {
        const days = ticketKind === "workout" ? workoutDays : nutritionDays;
        const itemsForDay = days.find(d => d.day === selectedDay)?.items || [];
        const planMissing = !!newCoachId && days.length === 0;
        return (
          <div className="mb-4 flex flex-col gap-3 rounded-lg bg-card p-5 shadow-soft-sm">
            <p className="text-[12px] text-muted-foreground">Tickets reference a specific item in your coach plan — pick what you're asking about and your coach will reply here.</p>

            <Select value={newCoachId ? String(newCoachId) : ""} onValueChange={v => setNewCoachId(Number(v) || "")}>
              <SelectTrigger className="w-full"><SelectValue placeholder="— Pick a coach —" /></SelectTrigger>
              <SelectContent>
                {coachOptions.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {coachOptions.length === 0 && (
              <p className="text-[12px] text-muted-foreground">
                You're not subscribed to a coach yet. <a href="/app/coaching" className="font-semibold text-primary">Find a coach</a>.
              </p>
            )}

            {!!newCoachId && (
              <>
                <div className="flex gap-1.5 rounded-full bg-muted p-1">
                  {(["workout", "nutrition"] as const).map(k => (
                    <button key={k} type="button"
                      onClick={() => { setTicketKind(k); setSelectedDay(""); setSelectedItemKey(""); setSelectedItemLabel(""); }}
                      className={cn("flex-1 rounded-full px-2.5 py-2 text-[12px] font-bold transition", ticketKind === k ? "bg-primary text-primary-foreground shadow-soft-sm" : "text-muted-foreground")}>
                      {k === "workout" ? "Workout" : "Nutrition"}
                    </button>
                  ))}
                </div>

                {planMissing ? (
                  <p className="py-2 text-[12px] text-muted-foreground">
                    {ticketKind === "workout"
                      ? "Your coach hasn't assigned a workout plan yet — you can't open a workout ticket until they do."
                      : "Your coach hasn't assigned a nutrition plan yet — you can't open a nutrition ticket until they do."}
                  </p>
                ) : (
                  <>
                    <Select value={selectedDay} onValueChange={v => { setSelectedDay(v); setSelectedItemKey(""); setSelectedItemLabel(""); }}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="— Pick a day —" /></SelectTrigger>
                      <SelectContent>
                        {days.map(d => <SelectItem key={d.day} value={d.day}>{d.day}</SelectItem>)}
                      </SelectContent>
                    </Select>

                    {!!selectedDay && (
                      <Select value={selectedItemKey} onValueChange={key => {
                        const found = itemsForDay.find(it => it.id === key);
                        setSelectedItemKey(key);
                        setSelectedItemLabel(found?.name || "");
                      }}>
                        <SelectTrigger className="w-full"><SelectValue placeholder={`— Pick ${ticketKind === "workout" ? "an exercise" : "a meal"} —`} /></SelectTrigger>
                        <SelectContent>
                          {itemsForDay.map(it => <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}

                    <Textarea value={newBody} onChange={e => setNewBody(e.target.value)} placeholder="What's your question?" rows={3} />
                  </>
                )}
              </>
            )}

            {err && <p className="text-[12px] text-[var(--red)]">{err}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setComposeMode(false)}>Cancel</Button>
              <Button size="sm" onClick={createTicket} disabled={busy || !newCoachId || !selectedItemKey || !newBody.trim() || planMissing}>
                Send ticket
              </Button>
            </div>
          </div>
        );
      })()}

      {loading ? (
        <div className="space-y-2.5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[68px] w-full rounded-lg" />)}</div>
      ) : tickets.length === 0 ? (
        <div className="rounded-lg bg-card p-12 text-center shadow-soft-sm">
          <div className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-muted">
            <MessageCircle size={26} className="text-muted-foreground" />
          </div>
          <p className="text-[14px] text-muted-foreground">{isCoach ? "You haven't received any tickets yet." : "You haven't opened any tickets yet."}</p>
        </div>
      ) : (
        <>
          {grouped.open.length > 0 && <Section label="Open">{grouped.open.map(t => <TicketCard key={t.id} ticket={t} isCoach={isCoach} onClick={() => openTicket(t)} />)}</Section>}
          {grouped.done.length > 0 && <Section label="Resolved / closed">{grouped.done.map(t => <TicketCard key={t.id} ticket={t} isCoach={isCoach} onClick={() => openTicket(t)} />)}</Section>}
        </>
      )}
      {opening && null}
      {/* hint to silence unused 'navigate' warning when this route is mounted at /coach too */}
      <span className="hidden">{navigate.length}</span>
    </div>
  );
}

function Section({ label, children }: { label: string; children: any }) {
  return (
    <div className="mb-5">
      <p className="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

function TicketCard({ ticket, isCoach, onClick }: { ticket: Ticket; isCoach: boolean; onClick: () => void }) {
  const peer = isCoach ? { name: ticket.user_name, avatar: ticket.user_avatar, id: ticket.user_id } : { name: ticket.coach_name, avatar: ticket.coach_avatar, id: ticket.coach_id };
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-lg bg-card p-3.5 text-start shadow-soft-sm transition active:scale-[0.99]">
      <Avatar className="size-10 shrink-0">
        <AvatarImage src={peer.avatar || getAvatar(peer.id, null, null, peer.name)} alt="" />
        <AvatarFallback>{(peer.name || "U").slice(0, 1)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <p className="truncate text-[14px] font-bold">{ticket.subject}</p>
          <StatusPill status={ticket.status} />
        </div>
        <p className="text-[12px] text-muted-foreground">{peer.name} · {new Date(ticket.updated_at).toLocaleDateString()}</p>
      </div>
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  const variant = status === "resolved" ? "success" : status === "closed" ? "muted" : "warning";
  return <Badge variant={variant as any} className="shrink-0 uppercase tracking-wider">{status}</Badge>;
}
