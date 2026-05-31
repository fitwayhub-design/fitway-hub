/**
 * Challenges — group / challenge chats live here.
 *
 * One page that lists every active challenge with cover, title, member
 * count, join state, and opens a group chat thread inline. Replaces the
 * old "Groups" tab on /app/chat (which is gone — 1:1 chat was removed).
 *
 * Admin sees every challenge too (the /api/community/challenges endpoint
 * doesn't filter by creator), and the existing /admin/chat page reads /
 * posts in any of them.
 */
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiBase } from "@/lib/api";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { getAvatar } from "@/lib/avatar";
import { Trophy, Users, Plus, Send, ChevronLeft, Search, Calendar } from "lucide-react";

interface Challenge {
  id: number; title: string; description?: string;
  image_url?: string | null;
  participant_count?: number;
  is_joined?: 0 | 1;
  creator_id?: number; creator_name?: string; creator_avatar?: string;
  start_date?: string; end_date?: string;
  created_at?: string;
}
interface Message {
  id: number; sender_id: number;
  sender_name?: string; sender_avatar?: string;
  content: string; created_at: string;
}

export default function ChallengesPage() {
  const { user, token } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<Challenge | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const threadRef = useRef<HTMLDivElement | null>(null);

  const api = (path: string, init?: RequestInit) =>
    fetch(getApiBase() + path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers || {}) } });

  const load = async () => {
    try {
      const r = await api("/api/community/challenges");
      if (r.ok) {
        const d = await r.json();
        const list: Challenge[] = Array.isArray(d) ? d : (d.challenges || []);
        setChallenges(list);
      }
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  useAutoRefresh(load);

  const loadMessages = async (id: number) => {
    setMessages([]);
    try {
      const r = await api(`/api/chat/challenge/${id}/messages`);
      if (r.ok) {
        const d = await r.json();
        const list: Message[] = d.messages || d || [];
        setMessages(list);
        setTimeout(() => { if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight; }, 50);
      }
    } catch { /* keep empty */ }
  };

  // Poll thread while it's open so new members' messages appear.
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => loadMessages(active.id), 8000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  const join = async (c: Challenge) => {
    setBusy(true);
    try {
      const r = await api(`/api/community/challenges/${c.id}/join`, { method: "POST" });
      if (r.ok) {
        setFlash("Joined!");
        setTimeout(() => setFlash(""), 1500);
        await load();
      }
    } finally { setBusy(false); }
  };

  const openChat = (c: Challenge) => {
    if (!c.is_joined) { setFlash("Join the challenge first."); setTimeout(() => setFlash(""), 1500); return; }
    setActive(c);
    loadMessages(c.id);
  };

  const send = async () => {
    if (!active || !draft.trim()) return;
    setBusy(true);
    try {
      const r = await api("/api/chat/send", { method: "POST", body: JSON.stringify({ content: draft.trim(), challengeId: active.id }) });
      if (r.ok) {
        setDraft("");
        await loadMessages(active.id);
      } else {
        const d = await r.json().catch(() => ({}));
        setFlash(d.message || "Couldn't send.");
        setTimeout(() => setFlash(""), 2500);
      }
    } finally { setBusy(false); }
  };

  const create = async () => {
    if (!newTitle.trim()) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("title", newTitle.trim());
      if (newDesc.trim()) fd.append("description", newDesc.trim());
      const r = await fetch(getApiBase() + "/api/community/challenges", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (r.ok) {
        setCreating(false); setNewTitle(""); setNewDesc("");
        await load();
      }
    } finally { setBusy(false); }
  };

  const filtered = challenges.filter(c => c.title.toLowerCase().includes(search.toLowerCase()));

  // ─── Single-challenge thread view ───────────────────────────────────────
  if (active) {
    return (
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px 12px 24px", display: "flex", flexDirection: "column", height: "calc(100dvh - 130px)" }}>
        <button onClick={() => setActive(null)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", marginBottom: 10, fontSize: 13 }}>
          <ChevronLeft size={16} /> All challenges
        </button>

        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "12px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--bg-surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
            {active.image_url ? <img src={active.image_url} alt="" style={{ width: 44, height: 44, borderRadius: 12, objectFit: "cover" }} /> : <Trophy size={20} color="var(--main)" />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 800 }}>{active.title}</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
              <Users size={11} /> {active.participant_count || 0} members
              {active.end_date && <><span>·</span><Calendar size={11} /> ends {new Date(active.end_date).toLocaleDateString()}</>}
            </p>
          </div>
        </div>

        <div ref={threadRef} style={{ flex: 1, overflowY: "auto", padding: "0 4px", display: "flex", flexDirection: "column", gap: 8 }}>
          {messages.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13, padding: 40 }}>Be the first to say hi 👋</p>
          ) : messages.map(m => {
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id} style={{ display: "flex", gap: 8, flexDirection: mine ? "row-reverse" : "row" }}>
                {!mine && <img src={m.sender_avatar || getAvatar(m.sender_id, null, null, m.sender_name)} alt="" style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0 }} />}
                <div style={{ maxWidth: "78%", background: mine ? "var(--main)" : "var(--bg-card)", color: mine ? "#0a0a0a" : "var(--text-primary)", border: mine ? "none" : "1px solid var(--border)", borderRadius: 14, padding: "8px 12px" }}>
                  {!mine && <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.8, marginBottom: 2 }}>{m.sender_name}</p>}
                  <p style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.content}</p>
                  <p style={{ fontSize: 10, opacity: 0.6, marginTop: 4, textAlign: mine ? "end" : "start" }}>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
          <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter") send(); }}
            placeholder={`Message ${active.title}…`}
            style={{ flex: 1, padding: "10px 12px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 14 }} />
          <button onClick={send} disabled={busy || !draft.trim()}
            style={{ padding: "10px 16px", borderRadius: 12, border: "none", background: "var(--main)", color: "#0a0a0a", fontWeight: 700, cursor: busy ? "not-allowed" : "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <Send size={14} /> Send
          </button>
        </div>
        {flash && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8, textAlign: "center" }}>{flash}</p>}
      </div>
    );
  }

  // ─── List view ──────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "20px 16px 60px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 22, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
            <Trophy size={20} color="var(--main)" /> Challenges
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            Group fitness challenges and their group chats — join one, then talk with everyone in it.
          </p>
        </div>
        <button onClick={() => setCreating(v => !v)}
          style={{ padding: "9px 14px", borderRadius: 10, border: "none", background: "var(--main)", color: "#0a0a0a", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} /> {creating ? "Cancel" : "New challenge"}
        </button>
      </div>

      {creating && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: 14, marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Challenge title — e.g. 30-day plank streak"
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 14 }} />
          <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="What's the goal? (optional)" rows={2}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 14, resize: "vertical" }} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => { setCreating(false); setNewTitle(""); setNewDesc(""); }} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={create} disabled={busy || !newTitle.trim()} style={{ padding: "9px 14px", borderRadius: 10, border: "none", background: "var(--main)", color: "#0a0a0a", fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: (!newTitle.trim()) ? 0.5 : 1 }}>Create</button>
          </div>
        </div>
      )}

      <div style={{ position: "relative", marginTop: 16, marginBottom: 16 }}>
        <Search size={14} style={{ position: "absolute", insetInlineStart: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search challenges…"
          style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 13 }} />
      </div>

      {flash && <p style={{ fontSize: 12, color: "var(--main)", marginBottom: 10 }}>{flash}</p>}

      {loading ? (
        <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14 }}>
          <Trophy size={40} color="var(--text-muted)" style={{ marginBottom: 10 }} />
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>No challenges yet. Start one!</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {filtered.map(c => (
            <div key={c.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ width: "100%", aspectRatio: "16 / 9", background: "var(--bg-surface)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                {c.image_url ? (
                  <img src={c.image_url} alt={c.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <Trophy size={36} color="var(--main)" style={{ opacity: 0.7 }} />
                )}
                {c.is_joined ? (
                  <span style={{ position: "absolute", top: 8, insetInlineEnd: 8, fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 99, background: "var(--main)", color: "#0a0a0a" }}>Joined</span>
                ) : null}
              </div>
              <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.title}</p>
                {c.description && (
                  <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.description}</p>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Users size={11} /> {c.participant_count || 0}</span>
                  {c.end_date && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={11} /> {new Date(c.end_date).toLocaleDateString()}</span>}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  {c.is_joined ? (
                    <button onClick={() => openChat(c)}
                      style={{ flex: 1, padding: "9px 12px", borderRadius: 10, border: "none", background: "var(--main)", color: "#0a0a0a", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                      Open chat
                    </button>
                  ) : (
                    <button onClick={() => join(c)} disabled={busy}
                      style={{ flex: 1, padding: "9px 12px", borderRadius: 10, border: "1px solid var(--main)", background: "var(--main-dim)", color: "var(--main)", fontWeight: 700, fontSize: 12, cursor: busy ? "not-allowed" : "pointer" }}>
                      Join challenge
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
