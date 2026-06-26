/**
 * Admin Tickets — read-only view of every ticket between athletes and coaches.
 * Per the May meeting: admin should be able to see all tickets between users.
 * Filterable by status, searchable by athlete or coach name.
 */
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { Search, MessageCircle, ChevronLeft, Send, ArrowRight, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { getAvatar } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

interface Ticket {
  id: number; user_id: number; coach_id: number;
  user_name: string; coach_name: string;
  user_avatar?: string; coach_avatar?: string;
  subject: string; body: string;
  status: "open" | "resolved" | "closed";
  kind: string;
  workout_plan_id?: number | null;
  exercise_key?: string | null;
  created_at: string; updated_at: string;
}
interface Reply {
  id: number; ticket_id: number; author_id: number; author_role: string;
  author_name: string; author_avatar?: string;
  body: string; created_at: string;
}

export default function AdminTickets() {
  const { token } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "resolved" | "closed">("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [adminReply, setAdminReply] = useState("");
  const [busy, setBusy] = useState(false);

  const api = (path: string, init?: RequestInit) =>
    apiFetch(path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers || {}) } });

  const load = async () => {
    try {
      const r = await api("/api/tickets/admin/all");
      if (r.ok) { const d = await r.json(); setTickets(d.tickets || []); }
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  useAutoRefresh(load);

  const openTicket = async (t: Ticket) => {
    setSelected(t);
    setReplies([]);
    try {
      const r = await api(`/api/tickets/${t.id}`);
      if (r.ok) { const d = await r.json(); setReplies(d.replies || []); setSelected(d.ticket || t); }
    } catch { /* keep list version */ }
  };

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return tickets.filter(t =>
      (filter === "all" || t.status === filter) &&
      (!ql || t.subject.toLowerCase().includes(ql) || t.user_name?.toLowerCase().includes(ql) || t.coach_name?.toLowerCase().includes(ql))
    );
  }, [tickets, filter, q]);

  const replyAsAdmin = async () => {
    if (!selected || !adminReply.trim()) return;
    setBusy(true);
    try {
      const r = await api(`/api/tickets/${selected.id}/reply`, { method: "POST", body: JSON.stringify({ body: adminReply.trim() }) });
      if (r.ok) { setAdminReply(""); await openTicket(selected); }
    } finally { setBusy(false); }
  };

  const setStatus = async (status: "open" | "resolved" | "closed") => {
    if (!selected) return;
    setBusy(true);
    try {
      const r = await api(`/api/tickets/${selected.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      if (r.ok) { setSelected({ ...selected, status }); await load(); }
    } finally { setBusy(false); }
  };

  if (selected) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="-ms-2 gap-1.5 text-muted-foreground">
          <ChevronLeft size={16} strokeWidth={2} /> Back to all tickets
        </Button>

        <Card className="gap-0 p-5">
          <div className="mb-2.5 flex items-center justify-between gap-2.5">
            <p className="text-[11px] tracking-wider text-muted-foreground uppercase">
              Ticket #{selected.id} · {selected.kind || "general"}
            </p>
            <StatusPill status={selected.status} />
          </div>
          <h2 className="mb-2 text-[19px] font-bold tracking-tight">{selected.subject}</h2>
          {selected.body && <p className="text-[14px] leading-relaxed whitespace-pre-wrap text-muted-foreground">{selected.body}</p>}
          <div className="mt-3.5 flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-muted-foreground">
            <span>Athlete: <strong className="text-foreground">{selected.user_name}</strong></span>
            <span>{Number(selected.coach_id) === 0 || selected.kind === "support"
              ? <>Type: <strong className="text-foreground">General support</strong></>
              : <>Coach: <strong className="text-foreground">{selected.coach_name}</strong></>}</span>
            <span>Opened: {new Date(selected.created_at).toLocaleString()}</span>
          </div>
        </Card>

        <div className="flex flex-col gap-2.5">
          {replies.map(r => {
            const isAdmin = r.author_role === "admin";
            return (
              <div key={r.id} className="flex gap-2.5">
                <Avatar className="size-8 shrink-0">
                  <AvatarImage src={r.author_avatar || getAvatar(r.author_id, null, null, r.author_name)} alt="" />
                  <AvatarFallback className="text-[11px]">{(r.author_name || "U").slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div className={cn(
                  "min-w-0 flex-1 rounded-2xl px-3.5 py-2.5 shadow-soft-sm",
                  isAdmin ? "bg-primary/15 text-foreground ring-1 ring-[color-mix(in_srgb,var(--primary)_30%,transparent)]" : "bg-card text-foreground",
                )}>
                  <p className="mb-1 text-[11px] font-bold">
                    {r.author_name} · <span className="text-[10px] tracking-wider text-muted-foreground uppercase">{r.author_role}</span>
                  </p>
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{r.body}</p>
                  <p className="mt-1.5 text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                </div>
              </div>
            );
          })}
          {replies.length === 0 && <p className="py-5 text-center text-[13px] text-muted-foreground">No replies yet.</p>}
        </div>

        {/* Admin can step in if needed */}
        {selected.status !== "closed" && (
          <div className="flex items-end gap-2">
            <Textarea
              value={adminReply}
              onChange={e => setAdminReply(e.target.value)}
              placeholder="Reply as admin (visible to both parties)…"
              aria-label="Reply as admin"
              rows={2}
              className="min-h-11 flex-1"
            />
            <Button onClick={replyAsAdmin} disabled={busy || !adminReply.trim()} className="gap-1.5">
              <Send size={14} strokeWidth={2} /> Reply
            </Button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {selected.status !== "resolved" && (
            <Button variant="outline" size="sm" onClick={() => setStatus("resolved")} disabled={busy}
              className="gap-1.5 text-[var(--green)] ring-[color-mix(in_srgb,var(--green)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--green)_10%,transparent)] hover:text-[var(--green)]">
              <CheckCircle size={13} strokeWidth={2} /> Mark resolved
            </Button>
          )}
          {selected.status !== "closed" && (
            <Button variant="outline" size="sm" onClick={() => setStatus("closed")} disabled={busy}
              className="gap-1.5 text-destructive ring-[color-mix(in_srgb,var(--red)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--red)_10%,transparent)] hover:text-destructive">
              <XCircle size={13} strokeWidth={2} /> Close
            </Button>
          )}
          {selected.status !== "open" && (
            <Button variant="outline" size="sm" onClick={() => setStatus("open")} disabled={busy} className="gap-1.5 text-muted-foreground">
              <RefreshCw size={13} strokeWidth={2} /> Reopen
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight">All tickets</h1>
        <div className="flex flex-wrap gap-1.5">
          {(["all", "open", "resolved", "closed"] as const).map(s => (
            <Button
              key={s}
              size="sm"
              variant={filter === s ? "default" : "outline"}
              onClick={() => setFilter(s)}
              className={cn("capitalize", filter !== s && "text-muted-foreground")}
            >
              {s} {s === "open" && filter !== "open" ? `(${tickets.filter(t => t.status === "open").length})` : ""}
            </Button>
          ))}
        </div>
      </div>

      <div className="relative">
        <Search size={16} strokeWidth={2} className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground start-3.5" />
        <Input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search by subject, athlete, or coach name…"
          aria-label="Search tickets"
          className="ps-10"
        />
      </div>

      {loading ? (
        <div className="flex flex-col gap-2.5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[64px] w-full rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="items-center gap-3 p-12 text-center">
          <div className="grid size-14 place-items-center rounded-full bg-muted">
            <MessageCircle size={26} strokeWidth={2} className="text-muted-foreground" />
          </div>
          <p className="text-[14px] text-muted-foreground">No tickets match this filter.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map(t => (
            <button
              key={t.id}
              onClick={() => openTicket(t)}
              className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 rounded-lg bg-card p-3.5 text-start shadow-soft-sm transition hover:shadow-soft active:scale-[0.99] md:grid-cols-[1fr_1fr_auto_auto]"
            >
              <div className="min-w-0">
                <p className="truncate text-[14px] font-bold">{t.subject}</p>
                <p className="text-[11px] text-muted-foreground">#{t.id} · {t.kind || "general"}</p>
              </div>
              <div className="col-span-2 flex items-center gap-2 md:col-span-1">
                <Avatar className="size-6 shrink-0">
                  <AvatarImage src={t.user_avatar || getAvatar(t.user_id, null, null, t.user_name)} alt="" />
                  <AvatarFallback className="text-[10px]">{(t.user_name || "U").slice(0, 1)}</AvatarFallback>
                </Avatar>
                <span className="truncate text-[12px]">{t.user_name}</span>
                <ArrowRight size={12} strokeWidth={2} className="shrink-0 text-muted-foreground rtl:rotate-180" />
                {Number(t.coach_id) === 0 || t.kind === "support" ? (
                  <span className="truncate text-[12px] font-medium text-[var(--secondary)]">General support</span>
                ) : (
                  <>
                    <Avatar className="size-6 shrink-0">
                      <AvatarImage src={t.coach_avatar || getAvatar(t.coach_id, null, null, t.coach_name)} alt="" />
                      <AvatarFallback className="text-[10px]">{(t.coach_name || "U").slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate text-[12px]">{t.coach_name}</span>
                  </>
                )}
              </div>
              <StatusPill status={t.status} />
              <span className="text-[11px] whitespace-nowrap text-muted-foreground">{new Date(t.updated_at).toLocaleDateString()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const variant = status === "resolved" ? "success" : status === "closed" ? "muted" : "warning";
  return <Badge variant={variant as any} className="shrink-0 uppercase tracking-wider">{status}</Badge>;
}
