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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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
      <div className="mx-auto flex h-[calc(100dvh-130px)] w-full max-w-[760px] flex-col px-3 pt-4 pb-6">
        <button
          onClick={() => setActive(null)}
          className="mb-2.5 inline-flex w-fit items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft size={16} strokeWidth={2} /> All challenges
        </button>

        <Card className="mb-3 flex flex-row items-center gap-3 p-3.5 shadow-soft-sm">
          <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-md bg-muted">
            {active.image_url ? <img src={active.image_url} alt="" className="size-11 rounded-md object-cover" /> : <Trophy size={20} strokeWidth={2} className="text-primary" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold">{active.title}</p>
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Users size={11} strokeWidth={2} /> {active.participant_count || 0} members
              {active.end_date && <><span>·</span><Calendar size={11} strokeWidth={2} /> ends {new Date(active.end_date).toLocaleDateString()}</>}
            </p>
          </div>
        </Card>

        <div ref={threadRef} className="flex flex-1 flex-col gap-2 overflow-y-auto px-1">
          {messages.length === 0 ? (
            <p className="p-10 text-center text-[13px] text-muted-foreground">Be the first to say hi 👋</p>
          ) : messages.map(m => {
            const mine = String(m.sender_id) === user?.id;
            return (
              <div key={m.id} className={cn("flex gap-2", mine ? "flex-row-reverse" : "flex-row")}>
                {!mine && (
                  <Avatar className="size-7 shrink-0">
                    <AvatarImage src={m.sender_avatar || getAvatar(m.sender_id, null, null, m.sender_name)} alt={m.sender_name || ""} />
                    <AvatarFallback className="text-[10px]">{(m.sender_name || "U").slice(0, 1)}</AvatarFallback>
                  </Avatar>
                )}
                <div className={cn(
                  "max-w-[78%] rounded-lg px-3 py-2 shadow-soft-xs",
                  mine ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground",
                )}>
                  {!mine && <p className="mb-0.5 text-[11px] font-bold opacity-80">{m.sender_name}</p>}
                  <p className="text-[13px] leading-snug break-words whitespace-pre-wrap">{m.content}</p>
                  <p className={cn("mt-1 text-[10px] opacity-60", mine ? "text-end" : "text-start")}>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-2.5 pt-2.5">
          <Separator className="mb-2.5" />
          <div className="flex gap-2">
            <Input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") send(); }}
              placeholder={`Message ${active.title}…`}
              className="flex-1"
            />
            <Button onClick={send} disabled={busy || !draft.trim()} className="gap-1.5">
              <Send size={14} strokeWidth={2} /> Send
            </Button>
          </div>
        </div>
        {flash && <p className="mt-2 text-center text-[12px] text-muted-foreground">{flash}</p>}
      </div>
    );
  }

  // ─── List view ──────────────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-[980px] px-4 pt-5 pb-16">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[22px] font-bold tracking-tight">
            <Trophy size={20} strokeWidth={2} className="text-primary" /> Challenges
          </h1>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Group fitness challenges and their group chats — join one, then talk with everyone in it.
          </p>
        </div>
        <Button onClick={() => setCreating(v => !v)} size="sm" className="gap-1.5">
          <Plus size={14} strokeWidth={2} /> {creating ? "Cancel" : "New challenge"}
        </Button>
      </div>

      {creating && (
        <Card className="mt-3.5 flex flex-col gap-2 p-3.5 shadow-soft-sm">
          <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Challenge title — e.g. 30-day plank streak" />
          <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="What's the goal? (optional)" rows={2} className="min-h-16 resize-y" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setCreating(false); setNewTitle(""); setNewDesc(""); }}>Cancel</Button>
            <Button size="sm" onClick={create} disabled={busy || !newTitle.trim()}>Create</Button>
          </div>
        </Card>
      )}

      <div className="relative mt-4 mb-4">
        <Search size={14} strokeWidth={2} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search challenges…" className="ps-10 text-[13px]" />
      </div>

      {flash && <p className="mb-2.5 text-[12px] text-primary">{flash}</p>}

      {loading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[260px] w-full rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="items-center p-14 text-center shadow-soft-sm">
          <Trophy size={40} strokeWidth={2} className="mb-2.5 text-muted-foreground" />
          <p className="text-[14px] text-muted-foreground">No challenges yet. Start one!</p>
        </Card>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5">
          {filtered.map(c => (
            <Card key={c.id} className="flex flex-col gap-0 overflow-hidden p-0 shadow-soft-sm">
              <div className="relative flex aspect-video w-full items-center justify-center bg-muted">
                {c.image_url ? (
                  <img src={c.image_url} alt={c.title} className="size-full object-cover" />
                ) : (
                  <Trophy size={36} strokeWidth={2} className="text-primary opacity-70" />
                )}
                {c.is_joined ? (
                  <Badge variant="default" className="absolute top-2 end-2 bg-primary text-primary-foreground">Joined</Badge>
                ) : null}
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-3.5">
                <p className="line-clamp-2 text-[14px] font-bold leading-snug">{c.title}</p>
                {c.description && (
                  <p className="line-clamp-2 text-[12px] leading-snug text-muted-foreground">{c.description}</p>
                )}
                <div className="mt-1 flex items-center gap-2.5 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Users size={11} strokeWidth={2} /> {c.participant_count || 0}</span>
                  {c.end_date && <span className="inline-flex items-center gap-1"><Calendar size={11} strokeWidth={2} /> {new Date(c.end_date).toLocaleDateString()}</span>}
                </div>
                <div className="mt-2.5 flex gap-2">
                  {c.is_joined ? (
                    <Button onClick={() => openChat(c)} size="sm" className="flex-1">
                      Open chat
                    </Button>
                  ) : (
                    <Button onClick={() => join(c)} disabled={busy} size="sm" variant="secondary" className="flex-1">
                      Join challenge
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
