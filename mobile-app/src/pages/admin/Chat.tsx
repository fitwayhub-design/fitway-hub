/**
 * Admin Chat — two tabs (May meeting):
 *   • Groups   — every challenge / group chat. Admin reads + posts in any.
 *   • Support  — direct support DMs from athletes / coaches. 1:1 chat is
 *                gone everywhere EXCEPT user↔admin, which stays alive
 *                exactly so this tab keeps working.
 */
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiBase, resolveAssetUrl } from "@/lib/api";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { getAvatar } from "@/lib/avatar";
import { Send, Search, Users, LifeBuoy, Trophy, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Challenge { id: number; title: string; image_url?: string; cover_image?: string; participant_count?: number; members_count?: number }
interface Message { id: number; sender_id: number; sender_name?: string; sender_avatar?: string; content: string; created_at: string }
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
        setChallenges(list.map(c => ({ ...c, members_count: c.members_count ?? c.participant_count, cover_image: c.cover_image ?? c.image_url ?? undefined })));
      }
    } catch { /* ignore */ }
  };
  const loadSupport = async () => {
    try {
      const r = await api("/api/chat/users?supportOnly=1");
      if (r.ok) {
        const d = await r.json();
        // controller may return either { users: [...] } or a raw array
        setSupportUsers(Array.isArray(d) ? d : (d.users || d.contacts || []));
      }
    } catch { /* ignore */ }
  };
  const loadAll = async (silent = false) => {
    if (!silent) setLoading(true);
    await Promise.all([loadGroups(), loadSupport()]);
    setLoading(false);
  };
  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, []);
  useAutoRefresh(() => loadAll(true));

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
    <div className="space-y-6">
      <h1 className="text-[28px] font-bold leading-tight tracking-tight">Chat</h1>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={v => { setTab(v as "groups" | "support"); setActiveChallenge(null); setActiveUser(null); setMessages([]); }}>
        <TabsList>
          <TabsTrigger value="groups"><Users size={16} strokeWidth={2} /> Groups</TabsTrigger>
          <TabsTrigger value="support"><LifeBuoy size={16} strokeWidth={2} /> Support</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid h-[70vh] grid-cols-1 gap-4 md:grid-cols-[320px_1fr]">
        {/* Side list */}
        <Card className="flex flex-col gap-0 overflow-hidden py-0">
          <div className="p-3">
            <div className="relative">
              <Search size={16} strokeWidth={2} className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground start-3.5" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={tab === "groups" ? "Search groups…" : "Search support contacts…"}
                aria-label={tab === "groups" ? "Search groups" : "Search support contacts"}
                className="h-10 ps-10"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            {loading ? (
              <p className="p-5 text-center text-[13px] text-muted-foreground">Loading…</p>
            ) : tab === "groups" ? (
              filteredChallenges.length === 0 ? (
                <p className="p-5 text-center text-[13px] text-muted-foreground">No challenges/groups yet.</p>
              ) : filteredChallenges.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setActiveChallenge(c); setActiveUser(null); loadChallengeMessages(c.id); }}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-start transition-colors",
                    activeChallenge?.id === c.id ? "bg-[var(--main-dim)]" : "hover:bg-muted",
                  )}
                >
                  <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-md bg-muted">
                    {c.cover_image
                      ? <img src={resolveAssetUrl(c.cover_image)} alt="" className="size-9 rounded-md object-cover" />
                      : <Trophy size={16} strokeWidth={2} className="text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{c.title}</p>
                    <p className="text-[11px] text-muted-foreground">{c.members_count || c.participant_count || 0} members</p>
                  </div>
                </button>
              ))
            ) : (
              filteredSupport.length === 0 ? (
                <p className="p-5 text-center text-[13px] text-muted-foreground">No active support requests.</p>
              ) : filteredSupport.map(u => (
                <button
                  key={u.id}
                  onClick={() => { setActiveUser(u); setActiveChallenge(null); loadDmMessages(u.id); }}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-start transition-colors",
                    activeUser?.id === u.id ? "bg-[var(--main-dim)]" : "hover:bg-muted",
                  )}
                >
                  <Avatar className="size-9 shrink-0">
                    <AvatarImage src={u.avatar || getAvatar(u.email, null, null, u.name)} alt="" />
                    <AvatarFallback>{(u.name || "U").slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{u.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{u.last_message || u.email}</p>
                  </div>
                  {!!u.unread_count && u.unread_count > 0 && (
                    <Badge className="shrink-0">{u.unread_count}</Badge>
                  )}
                </button>
              ))
            )}
          </ScrollArea>
        </Card>

        {/* Thread */}
        <Card className="flex flex-col gap-0 overflow-hidden py-0">
          {!activeChallenge && !activeUser ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
              <div className="grid size-12 place-items-center rounded-full bg-muted">
                <MessageCircle size={22} strokeWidth={2} className="text-muted-foreground" />
              </div>
              <p className="text-[13px]">
                {tab === "groups" ? "Pick a group to monitor or post." : "Pick a support contact to reply."}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5 px-4 py-3 shadow-soft-xs">
                {activeChallenge ? (
                  <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-md bg-muted">
                    {activeChallenge.cover_image
                      ? <img src={resolveAssetUrl(activeChallenge.cover_image)} alt="" className="size-9 rounded-md object-cover" />
                      : <Trophy size={16} strokeWidth={2} className="text-muted-foreground" />}
                  </div>
                ) : (
                  <Avatar className="size-9 shrink-0">
                    <AvatarImage src={activeUser?.avatar || getAvatar(activeUser?.email, null, null, activeUser?.name)} alt="" />
                    <AvatarFallback>{(activeUser?.name || "U").slice(0, 1)}</AvatarFallback>
                  </Avatar>
                )}
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold">
                    {activeChallenge ? activeChallenge.title : activeUser?.name}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {activeChallenge ? `${activeChallenge.members_count || activeChallenge.participant_count || 0} members` : activeUser?.email}
                  </p>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="flex flex-col gap-2.5 p-3.5">
                  {messages.length === 0 ? (
                    <p className="p-5 text-center text-[13px] text-muted-foreground">No messages yet.</p>
                  ) : messages.map(m => (
                    <div key={m.id} className="flex gap-2.5">
                      <Avatar className="size-8 shrink-0">
                        <AvatarImage src={m.sender_avatar || getAvatar(m.sender_id, null, null, m.sender_name)} alt="" />
                        <AvatarFallback className="text-[11px]">{(m.sender_name || "U").slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 rounded-2xl bg-muted px-3.5 py-2.5">
                        <p className="mb-0.5 text-[11px] font-semibold text-muted-foreground">{m.sender_name}</p>
                        <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{m.content}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="flex items-center gap-2 p-3 shadow-soft-xs">
                <Input
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") send(); }}
                  placeholder="Message as Admin…"
                  aria-label="Message as Admin"
                  className="h-10 flex-1"
                />
                <Button onClick={send} disabled={busy || !draft.trim()} size="sm" className="gap-1.5">
                  <Send size={14} strokeWidth={2} /> Send
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
