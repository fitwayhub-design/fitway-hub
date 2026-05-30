/**
 * Admin Chat — two tabs (May meeting):
 *   • Groups   — every challenge / community group chat in the system,
 *                read-only-by-default but admin can post too.
 *   • Support  — direct support requests athletes file to the platform.
 *
 * Builds on the existing /api/community/challenges and /api/chat/users
 * endpoints (filtered for support contacts). Admin can read every group's
 * messages and reply.
 */
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiBase } from "@/lib/api";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { getAvatar } from "@/lib/avatar";
import { Users, LifeBuoy, Send, Search } from "lucide-react";

interface Challenge { id: number; title: string; cover_image?: string; members_count?: number; updated_at?: string }
interface Message { id: number; sender_id: number; sender_name: string; sender_avatar?: string; content: string; created_at: string }
interface SupportContact { id: number; name: string; email: string; avatar?: string; last_message?: string; unread_count?: number }

export default function AdminChat() {
  const { token } = useAuth();
  const [tab, setTab] = useState<"groups" | "support">("groups");
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [supportUsers, setSupportUsers] = useState<SupportContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);
  const [activeUser, setActiveUser] = useState<SupportContact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const api = (path: string, init?: RequestInit) =>
    fetch(getApiBase() + path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers || {}) } });

  const loadGroups = async () => {
    try {
      const r = await api("/api/community/challenges");
      if (r.ok) {
        const d = await r.json();
        const list: Challenge[] = Array.isArray(d) ? d : (d.challenges || []);
        setChallenges(list);
      }
    } catch { /* ignore */ }
  };
  const loadSupport = async () => {
    try {
      const r = await api("/api/chat/users?supportOnly=1");
      if (r.ok) {
        const d = await r.json();
        setSupportUsers(d.users || []);
      }
    } catch { /* ignore */ }
  };
  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadGroups(), loadSupport()]);
    setLoading(false);
  };
  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, []);
  useAutoRefresh(loadAll);

  const loadChallengeMessages = async (id: number) => {
    setMessages([]);
    try {
      const r = await api(`/api/chat/challenge/${id}/messages`);
      if (r.ok) { const d = await r.json(); setMessages(d.messages || d || []); }
    } catch { /* keep empty */ }
  };
  const loadDmMessages = async (userId: number) => {
    setMessages([]);
    try {
      const r = await api(`/api/chat/messages/${userId}`);
      if (r.ok) { const d = await r.json(); setMessages(d.messages || d || []); }
    } catch { /* keep empty */ }
  };

  const send = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      if (tab === "groups" && activeChallenge) {
        await api("/api/chat/send", { method: "POST", body: JSON.stringify({ content: draft.trim(), challengeId: activeChallenge.id }) });
        setDraft("");
        await loadChallengeMessages(activeChallenge.id);
      } else if (tab === "support" && activeUser) {
        await api("/api/chat/send", { method: "POST", body: JSON.stringify({ content: draft.trim(), receiverId: activeUser.id }) });
        setDraft("");
        await loadDmMessages(activeUser.id);
      }
    } finally { setBusy(false); }
  };

  const filteredChallenges = challenges.filter(c => c.title.toLowerCase().includes(search.toLowerCase()));
  const filteredSupport = supportUsers.filter(u => (u.name || "").toLowerCase().includes(search.toLowerCase()) || (u.email || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 22, fontWeight: 800, marginBottom: 16 }}>Chat</h1>

      {/* Tabs */}
      <div style={{ display: "inline-flex", padding: 4, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 99, marginBottom: 16 }}>
        {([
          { id: "groups" as const,  label: "Groups",  Icon: Users },
          { id: "support" as const, label: "Support", Icon: LifeBuoy },
        ]).map(({ id, label, Icon }) => (
          <button key={id} onClick={() => { setTab(id); setActiveChallenge(null); setActiveUser(null); setMessages([]); }} style={{
            padding: "8px 18px", borderRadius: 99, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
            background: tab === id ? "var(--main)" : "transparent",
            color: tab === id ? "#0a0a0a" : "var(--text-secondary)",
            display: "flex", alignItems: "center", gap: 6,
          }}><Icon size={13} /> {label}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, height: "70vh" }}>
        {/* Side list */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: 12, borderBottom: "1px solid var(--border)" }}>
            <div style={{ position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={tab === "groups" ? "Search groups…" : "Search support contacts…"}
                style={{ width: "100%", padding: "8px 12px 8px 30px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 12 }} />
            </div>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {loading ? (
              <p style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Loading…</p>
            ) : tab === "groups" ? (
              filteredChallenges.length === 0 ? (
                <p style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No challenges/groups yet.</p>
              ) : filteredChallenges.map(c => (
                <button key={c.id} onClick={() => { setActiveChallenge(c); setActiveUser(null); loadChallengeMessages(c.id); }} style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: "none",
                  background: activeChallenge?.id === c.id ? "var(--main-dim)" : "transparent",
                  borderBottom: "1px solid var(--border)", cursor: "pointer", textAlign: "left",
                  borderLeft: activeChallenge?.id === c.id ? "3px solid var(--main)" : "3px solid transparent",
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--bg-surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                    {c.cover_image ? <img src={c.cover_image} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }} /> : "🏆"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.title}</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.members_count || 0} members</p>
                  </div>
                </button>
              ))
            ) : (
              filteredSupport.length === 0 ? (
                <p style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No active support requests.</p>
              ) : filteredSupport.map(u => (
                <button key={u.id} onClick={() => { setActiveUser(u); setActiveChallenge(null); loadDmMessages(u.id); }} style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: "none",
                  background: activeUser?.id === u.id ? "var(--main-dim)" : "transparent",
                  borderBottom: "1px solid var(--border)", cursor: "pointer", textAlign: "left",
                  borderLeft: activeUser?.id === u.id ? "3px solid var(--main)" : "3px solid transparent",
                }}>
                  <img src={u.avatar || getAvatar(u.email, null, null, u.name)} alt="" style={{ width: 36, height: 36, borderRadius: "50%" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name}</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.last_message || u.email}</p>
                  </div>
                  {!!u.unread_count && u.unread_count > 0 && (
                    <span style={{ background: "var(--main)", color: "#0a0a0a", borderRadius: 99, padding: "1px 6px", fontSize: 10, fontWeight: 800 }}>{u.unread_count}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Thread */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {!activeChallenge && !activeUser ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>
              {tab === "groups" ? "Pick a group to monitor or post." : "Pick a support contact to reply."}
            </div>
          ) : (
            <>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                <p style={{ fontSize: 14, fontWeight: 700 }}>
                  {activeChallenge ? `🏆 ${activeChallenge.title}` : `🛟 ${activeUser?.name}`}
                </p>
                <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {activeChallenge ? `${activeChallenge.members_count || 0} members` : activeUser?.email}
                </p>
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
