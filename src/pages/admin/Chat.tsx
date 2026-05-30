/**
 * Admin Chat — read + post in every group/challenge chat (May meeting).
 *
 * 1:1 chat is removed across the app, so this page is groups-only. Direct
 * user-to-admin contact happens through Tickets (filed from a workout in
 * the athlete's coach plan).
 */
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiBase } from "@/lib/api";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { getAvatar } from "@/lib/avatar";
import { Send, Search, Users } from "lucide-react";

interface Challenge { id: number; title: string; cover_image?: string; members_count?: number }
interface Message { id: number; sender_id: number; sender_name: string; sender_avatar?: string; content: string; created_at: string }

export default function AdminChat() {
  const { token } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<Challenge | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const api = (path: string, init?: RequestInit) =>
    fetch(getApiBase() + path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers || {}) } });

  const load = async () => {
    setLoading(true);
    try {
      const r = await api("/api/community/challenges");
      if (r.ok) {
        const d = await r.json();
        setChallenges(Array.isArray(d) ? d : (d.challenges || []));
      }
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  useAutoRefresh(load);

  const loadMessages = async (id: number) => {
    setMessages([]);
    try {
      const r = await api(`/api/chat/challenge/${id}/messages`);
      if (r.ok) { const d = await r.json(); setMessages(d.messages || d || []); }
    } catch { /* keep empty */ }
  };

  const send = async () => {
    if (!draft.trim() || !active) return;
    setBusy(true);
    try {
      await api("/api/chat/send", { method: "POST", body: JSON.stringify({ content: draft.trim(), challengeId: active.id }) });
      setDraft("");
      await loadMessages(active.id);
    } finally { setBusy(false); }
  };

  const filtered = challenges.filter(c => c.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 22, fontWeight: 800 }}>Group chats</h1>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
          1:1 chat is off — direct contact is filed as <a href="/admin/tickets" style={{ color: "var(--main)" }}>Tickets</a>.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, height: "70vh" }}>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: 12, borderBottom: "1px solid var(--border)" }}>
            <div style={{ position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search groups…"
                style={{ width: "100%", padding: "8px 12px 8px 30px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 12 }} />
            </div>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {loading ? (
              <p style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Loading…</p>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "var(--text-muted)" }}>
                <Users size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
                <p style={{ fontSize: 13 }}>No groups/challenges yet.</p>
              </div>
            ) : filtered.map(c => (
              <button key={c.id} onClick={() => { setActive(c); loadMessages(c.id); }} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: "none",
                background: active?.id === c.id ? "var(--main-dim)" : "transparent",
                borderBottom: "1px solid var(--border)", cursor: "pointer", textAlign: "left",
                borderLeft: active?.id === c.id ? "3px solid var(--main)" : "3px solid transparent",
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--bg-surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                  {c.cover_image ? <img src={c.cover_image} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }} /> : "🏆"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.title}</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.members_count || 0} members</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {!active ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>
              Pick a group to read or post.
            </div>
          ) : (
            <>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                <p style={{ fontSize: 14, fontWeight: 700 }}>🏆 {active.title}</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{active.members_count || 0} members</p>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                {messages.length === 0 ? (
                  <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13, padding: 20 }}>No messages yet.</p>
                ) : messages.map(m => (
                  <div key={m.id} style={{ display: "flex", gap: 8 }}>
                    <img src={m.sender_avatar || getAvatar(m.sender_id, null, null, m.sender_name)} alt="" style={{ width: 28, height: 28, borderRadius: "50%" }} />
                    <div style={{ flex: 1, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px" }}>
                      <p style={{ fontSize: 11, fontWeight: 700, marginBottom: 2 }}>{m.sender_name}</p>
                      <p style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{m.content}</p>
                      <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>{new Date(m.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--border)" }}>
                <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter") send(); }} placeholder="Message as Admin…"
                  style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 13 }} />
                <button onClick={send} disabled={busy || !draft.trim()}
                  style={{ padding: "9px 14px", borderRadius: 8, border: "none", background: "var(--main)", color: "#0a0a0a", fontWeight: 700, cursor: busy ? "not-allowed" : "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <Send size={13} /> Send
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
