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
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newCoachId, setNewCoachId] = useState<number | "">(preselectCoach || "");
  const [coachOptions, setCoachOptions] = useState<{ id: number; name: string }[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyDraft, setReplyDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const api = (path: string, init?: RequestInit) =>
    fetch(getApiBase() + path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers || {}) } });

  const loadList = async () => {
    setLoading(true);
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
      if (r.ok) { setReplyDraft(""); await openTicket(selected); await loadList(); }
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
    if (!newSubject.trim() || !newCoachId) return;
    setBusy(true);
    try {
      const r = await api("/api/tickets", { method: "POST", body: JSON.stringify({ coach_id: newCoachId, subject: newSubject.trim(), body: newBody.trim() }) });
      if (r.ok) {
        const d = await r.json();
        setComposeMode(false); setNewSubject(""); setNewBody(""); setNewCoachId("");
        await loadList();
        if (d.ticket) openTicket(d.ticket);
      }
    } finally { setBusy(false); }
  };

  useEffect(() => { loadList(); /* eslint-disable-next-line */ }, []);
  useAutoRefresh(loadList);

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

  const grouped = useMemo(() => {
    const open = tickets.filter(t => t.status === "open");
    const done = tickets.filter(t => t.status !== "open");
    return { open, done };
  }, [tickets]);

  if (selected) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 16px 60px" }}>
        <button onClick={() => setSelected(null)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", marginBottom: 14 }}>
          <ChevronLeft size={16} /> Back to tickets
        </button>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono, monospace)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Ticket #{selected.id} · {selected.kind || "general"}
            </p>
            <StatusPill status={selected.status} />
          </div>
          <h2 style={{ fontSize: 19, fontWeight: 800, marginBottom: 8 }}>{selected.subject}</h2>
          {selected.body && <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{selected.body}</p>}
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12 }}>
            {new Date(selected.created_at).toLocaleString()} · {isCoach ? `from ${selected.user_name}` : `to ${selected.coach_name}`}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
          {replies.map(r => {
            const mine = r.author_id === user?.id;
            return (
              <div key={r.id} style={{ display: "flex", gap: 10, justifyContent: mine ? "flex-end" : "flex-start" }}>
                {!mine && <img src={r.author_avatar || getAvatar(r.author_id, null, null, r.author_name)} alt="" style={{ width: 32, height: 32, borderRadius: "50%" }} />}
                <div style={{ maxWidth: "78%", background: mine ? "var(--main)" : "var(--bg-card)", color: mine ? "#0a0a0a" : "var(--text-primary)", border: mine ? "none" : "1px solid var(--border)", borderRadius: 14, padding: "10px 14px" }}>
                  <p style={{ fontSize: 10.5, fontWeight: 700, opacity: 0.7, marginBottom: 2 }}>{r.author_name} · {r.author_role}</p>
                  <p style={{ fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{r.body}</p>
                  <p style={{ fontSize: 10, opacity: 0.6, marginTop: 4 }}>{new Date(r.created_at).toLocaleString()}</p>
                </div>
              </div>
            );
          })}
        </div>

        {selected.status !== "closed" && (
          <div style={{ display: "flex", gap: 8 }}>
            <textarea value={replyDraft} onChange={e => setReplyDraft(e.target.value)} placeholder="Write a reply…" rows={2}
              style={{ flex: 1, padding: "10px 12px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 14, resize: "vertical" }} />
            <button onClick={sendReply} disabled={busy || !replyDraft.trim()}
              style={{ padding: "10px 16px", borderRadius: 12, border: "none", background: "var(--main)", color: "#000", fontWeight: 700, cursor: busy ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <Send size={14} /> Send
            </button>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          {selected.status !== "resolved" && (
            <button onClick={() => setStatus("resolved")} disabled={busy}
              style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid var(--green)", background: "rgba(74,222,128,0.08)", color: "var(--green)", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <CheckCircle size={13} /> Mark resolved
            </button>
          )}
          {selected.status === "resolved" && (
            <button onClick={() => setStatus("open")} disabled={busy}
              style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-secondary)", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <RefreshCw size={13} /> Reopen
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 16px 60px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--font-heading)" }}>Tickets</h1>
        {!isCoach && (
          <button onClick={() => setComposeMode(v => !v)}
            style={{ padding: "9px 14px", borderRadius: 10, border: "none", background: "var(--main)", color: "#0a0a0a", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> New ticket
          </button>
        )}
      </div>

      {composeMode && !isCoach && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Tickets replace direct chat — your coach will be notified and reply here.</p>
          <select value={newCoachId} onChange={e => setNewCoachId(Number(e.target.value) || "")}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 14 }}>
            <option value="">— Pick a coach —</option>
            {coachOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {coachOptions.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
              You're not subscribed to a coach yet. <a href="/app/coaching" style={{ color: "var(--main)" }}>Find a coach</a>.
            </p>
          )}
          <input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Subject"
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 14 }} />
          <textarea value={newBody} onChange={e => setNewBody(e.target.value)} placeholder="Tell your coach what's up…" rows={3}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 14, resize: "vertical" }} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setComposeMode(false)} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={createTicket} disabled={busy || !newCoachId || !newSubject.trim()}
              style={{ padding: "9px 14px", borderRadius: 10, border: "none", background: "var(--main)", color: "#000", fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: (!newCoachId || !newSubject.trim()) ? 0.5 : 1 }}>
              Send ticket
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>Loading…</p>
      ) : tickets.length === 0 ? (
        <div style={{ textAlign: "center", padding: 50, background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}>
          <MessageCircle size={36} color="var(--text-muted)" style={{ marginBottom: 10 }} />
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>{isCoach ? "You haven't received any tickets yet." : "You haven't opened any tickets yet."}</p>
        </div>
      ) : (
        <>
          {grouped.open.length > 0 && <Section label="Open">{grouped.open.map(t => <Card key={t.id} ticket={t} isCoach={isCoach} onClick={() => openTicket(t)} />)}</Section>}
          {grouped.done.length > 0 && <Section label="Resolved / closed">{grouped.done.map(t => <Card key={t.id} ticket={t} isCoach={isCoach} onClick={() => openTicket(t)} />)}</Section>}
        </>
      )}
      {opening && null}
      {/* hint to silence unused 'navigate' warning when this route is mounted at /coach too */}
      <span style={{ display: "none" }}>{navigate.length}</span>
    </div>
  );
}

function Section({ label, children }: { label: string; children: any }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <p style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 8, fontFamily: "var(--font-mono, monospace)" }}>{label}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </div>
  );
}

function Card({ ticket, isCoach, onClick }: { ticket: Ticket; isCoach: boolean; onClick: () => void }) {
  const peer = isCoach ? { name: ticket.user_name, avatar: ticket.user_avatar, id: ticket.user_id } : { name: ticket.coach_name, avatar: ticket.coach_avatar, id: ticket.coach_id };
  return (
    <button onClick={onClick} style={{ textAlign: "left", display: "flex", gap: 12, padding: "12px 14px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, cursor: "pointer", width: "100%" }}>
      <img src={peer.avatar || getAvatar(peer.id, null, null, peer.name)} alt="" style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{ticket.subject}</p>
          <StatusPill status={ticket.status} />
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{peer.name} · {new Date(ticket.updated_at).toLocaleDateString()}</p>
      </div>
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    open:     { bg: "rgba(255,179,64,0.12)", color: "var(--amber)" },
    resolved: { bg: "rgba(74,222,128,0.12)", color: "var(--green)" },
    closed:   { bg: "rgba(120,120,120,0.18)", color: "var(--text-muted)" },
  };
  const s = map[status] || map.open;
  return <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: s.bg, color: s.color, textTransform: "uppercase", letterSpacing: "0.12em" }}>{status}</span>;
}
