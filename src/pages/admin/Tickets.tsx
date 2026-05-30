/**
 * Admin Tickets — read-only view of every ticket between athletes and coaches.
 * Per the May meeting: admin should be able to see all tickets between users.
 * Filterable by status, searchable by athlete or coach name.
 */
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiBase } from "@/lib/api";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { Search, MessageCircle, ChevronLeft, Send } from "lucide-react";
import { getAvatar } from "@/lib/avatar";

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
    fetch(getApiBase() + path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers || {}) } });

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
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <button onClick={() => setSelected(null)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", marginBottom: 14, fontSize: 13 }}>
          <ChevronLeft size={16} /> Back to all tickets
        </button>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 22px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Ticket #{selected.id} · {selected.kind || "general"}
            </p>
            <StatusPill status={selected.status} />
          </div>
          <h2 style={{ fontSize: 19, fontWeight: 800, marginBottom: 10 }}>{selected.subject}</h2>
          {selected.body && <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{selected.body}</p>}
          <div style={{ display: "flex", gap: 24, fontSize: 12, color: "var(--text-muted)", marginTop: 14 }}>
            <span>Athlete: <strong style={{ color: "var(--text-primary)" }}>{selected.user_name}</strong></span>
            <span>Coach: <strong style={{ color: "var(--text-primary)" }}>{selected.coach_name}</strong></span>
            <span>Opened: {new Date(selected.created_at).toLocaleString()}</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
          {replies.map(r => (
            <div key={r.id} style={{ display: "flex", gap: 10 }}>
              <img src={r.author_avatar || getAvatar(r.author_id, null, null, r.author_name)} alt="" style={{ width: 32, height: 32, borderRadius: "50%" }} />
              <div style={{ flex: 1, background: r.author_role === "admin" ? "rgba(168,85,247,0.08)" : "var(--bg-card)", border: `1px solid ${r.author_role === "admin" ? "rgba(168,85,247,0.3)" : "var(--border)"}`, borderRadius: 12, padding: "10px 14px" }}>
                <p style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                  {r.author_name} · <span style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 10 }}>{r.author_role}</span>
                </p>
                <p style={{ fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{r.body}</p>
                <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6 }}>{new Date(r.created_at).toLocaleString()}</p>
              </div>
            </div>
          ))}
          {replies.length === 0 && <p style={{ fontSize: 13, color: "var(--text-muted)", padding: 20, textAlign: "center" }}>No replies yet.</p>}
        </div>

        {/* Admin can step in if needed */}
        {selected.status !== "closed" && (
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <textarea value={adminReply} onChange={e => setAdminReply(e.target.value)} placeholder="Reply as admin (visible to both parties)…" rows={2}
              style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 14 }} />
            <button onClick={replyAsAdmin} disabled={busy || !adminReply.trim()}
              style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: "var(--main)", color: "#000", fontWeight: 700, cursor: busy ? "not-allowed" : "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
              <Send size={14} /> Reply
            </button>
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          {selected.status !== "resolved" && <button onClick={() => setStatus("resolved")} disabled={busy} style={pillBtn("var(--green)", "rgba(74,222,128,0.08)")}>Mark resolved</button>}
          {selected.status !== "closed" && <button onClick={() => setStatus("closed")} disabled={busy} style={pillBtn("var(--red)", "rgba(248,113,113,0.08)")}>Close</button>}
          {selected.status !== "open" && <button onClick={() => setStatus("open")} disabled={busy} style={pillBtn("var(--text-secondary)", "var(--bg-surface)")}>Reopen</button>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 22, fontWeight: 800 }}>All tickets</h1>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(["all", "open", "resolved", "closed"] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: "6px 14px", borderRadius: 99,
              border: `1px solid ${filter === s ? "var(--main)" : "var(--border)"}`,
              background: filter === s ? "var(--main-dim)" : "var(--bg-surface)",
              color: filter === s ? "var(--main)" : "var(--text-muted)",
              fontSize: 12, fontWeight: 600, cursor: "pointer", textTransform: "capitalize",
            }}>{s} {s === "open" && filter !== "open" ? `(${tickets.filter(t => t.status === "open").length})` : ""}</button>
          ))}
        </div>
      </div>

      <div style={{ position: "relative", marginBottom: 16 }}>
        <Search size={14} style={{ position: "absolute", insetInlineStart: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by subject, athlete, or coach name…"
          style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 13 }} />
      </div>

      {loading ? (
        <p style={{ color: "var(--text-muted)", textAlign: "center", padding: 40 }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14 }}>
          <MessageCircle size={36} color="var(--text-muted)" style={{ marginBottom: 10 }} />
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>No tickets match this filter.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(t => (
            <button key={t.id} onClick={() => openTicket(t)}
              style={{ textAlign: "left", display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 12, padding: "12px 14px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, cursor: "pointer", alignItems: "center" }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.subject}</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)" }}>#{t.id} · {t.kind || "general"}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <img src={t.user_avatar || getAvatar(t.user_id, null, null, t.user_name)} alt="" style={{ width: 22, height: 22, borderRadius: "50%" }} />
                <span style={{ fontSize: 12 }}>{t.user_name}</span>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>→</span>
                <img src={t.coach_avatar || getAvatar(t.coach_id, null, null, t.coach_name)} alt="" style={{ width: 22, height: 22, borderRadius: "50%" }} />
                <span style={{ fontSize: 12 }}>{t.coach_name}</span>
              </div>
              <StatusPill status={t.status} />
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(t.updated_at).toLocaleDateString()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const m: Record<string, { bg: string; c: string }> = {
    open:     { bg: "rgba(255,179,64,0.12)", c: "var(--amber)" },
    resolved: { bg: "rgba(74,222,128,0.12)", c: "var(--green)" },
    closed:   { bg: "rgba(120,120,120,0.18)", c: "var(--text-muted)" },
  };
  const s = m[status] || m.open;
  return <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: s.bg, color: s.c, textTransform: "uppercase", letterSpacing: "0.1em" }}>{status}</span>;
}

function pillBtn(c: string, bg: string): React.CSSProperties {
  return { padding: "9px 14px", borderRadius: 10, border: `1px solid ${c}`, background: bg, color: c, fontSize: 12, fontWeight: 700, cursor: "pointer" };
}
