/**
 * Challenges — athlete experience.
 *
 * Discover open Community challenges, see Team-challenge invitations from your
 * coach, join, track progress toward the goal, submit verified proof, climb the
 * leaderboard, and collect rewards when it finalizes. Privacy-first: you pick
 * whether you appear hidden (alias), aliased, or by real name.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiBase, resolveAssetUrl } from "@/lib/api";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import {
  Trophy, Users, Plus, ChevronLeft, Search, Calendar, Flame, Target, ShieldCheck,
  Upload, Lock, Globe, Mail, Award, Clock, CheckCircle2, Hourglass, Flag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { GoalChecklist, RewardBanner, GOAL_TYPE_META, METHOD_LABELS, type GoalRow } from "@/components/challenges/goals";
import { getCurrentPosition } from "@/lib/locationTracking";

const EVIDENCE_METHODS = new Set(["photo_evidence", "video_evidence", "screenshot_evidence"]);
const NUMERIC_METHODS: Record<string, string> = { manual_step: "steps", manual_distance: "km", gps_steps: "steps", time_based: "" };

/** Current device location (best-effort — submissions proceed without it). */
async function getGeo(): Promise<{ lat: number; lng: number } | null> {
  try {
    const pos = await getCurrentPosition();
    return { lat: pos.latitude, lng: pos.longitude };
  } catch { return null; }
}

type Challenge = any;
type Row = any;

export default function ChallengesPage() {
  const { user, token } = useAuth();
  const api = useCallback(
    (path: string, init?: RequestInit) =>
      fetch(getApiBase() + path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers || {}) } }),
    [token],
  );

  const [tab, setTab] = useState("discover");
  const [discover, setDiscover] = useState<Challenge[]>([]);
  const [mine, setMine] = useState<Challenge[]>([]);
  const [invites, setInvites] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [flash, setFlash] = useState("");

  const note = (m: string) => { setFlash(m); setTimeout(() => setFlash(""), 2200); };

  const load = useCallback(async () => {
    try {
      const [d, m, i] = await Promise.all([
        api("/api/challenges?view=discover"), api("/api/challenges?view=mine"), api("/api/challenges/invitations"),
      ]);
      if (d.ok) setDiscover((await d.json()).challenges || []);
      if (m.ok) setMine((await m.json()).challenges || []);
      if (i.ok) setInvites((await i.json()).invitations || []);
    } finally { setLoading(false); }
  }, [api]);
  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);

  if (openId != null) {
    return <ChallengeDetail id={openId} api={api} token={token} onBack={() => { setOpenId(null); load(); }} note={note} meId={user?.id} />;
  }

  const filterList = (list: Challenge[]) =>
    list.filter(c => String(c.title || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 pt-5 pb-20">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[22px] font-bold tracking-tight">
            <Trophy size={20} strokeWidth={2} className="text-primary" /> Challenges
          </h1>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Join a challenge, track verified progress, and climb the leaderboard.
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="discover" className="gap-1.5"><Globe size={14} /> Discover</TabsTrigger>
            <TabsTrigger value="mine" className="gap-1.5"><Flame size={14} /> My challenges</TabsTrigger>
            <TabsTrigger value="invites" className="gap-1.5">
              <Mail size={14} /> Invitations {invites.length > 0 && <Badge variant="destructive" className="ms-1 px-1.5 py-0 text-[10px]">{invites.length}</Badge>}
            </TabsTrigger>
          </TabsList>
          <div className="relative w-full max-w-[260px]">
            <Search size={14} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="ps-10 text-[13px]" />
          </div>
        </div>

        {flash && <p className="mb-3 text-[12px] text-primary">{flash}</p>}

        <TabsContent value="discover">
          <Grid loading={loading} list={filterList(discover)} onOpen={setOpenId} empty="No open challenges right now. Check back soon!" />
        </TabsContent>
        <TabsContent value="mine">
          <Grid loading={loading} list={filterList(mine)} onOpen={setOpenId} empty="You haven't joined any challenges yet." />
        </TabsContent>
        <TabsContent value="invites">
          {invites.length === 0 ? (
            <EmptyCard icon={Mail} text="No pending invitations." />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5">
              {invites.map(c => <ChallengeCard key={c.id} c={c} onOpen={setOpenId} invite />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Grid({ loading, list, onOpen, empty }: { loading: boolean; list: Challenge[]; onOpen: (id: number) => void; empty: string }) {
  if (loading) {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[250px] w-full rounded-lg" />)}
      </div>
    );
  }
  if (!list.length) return <EmptyCard icon={Trophy} text={empty} />;
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5">
      {list.map(c => <ChallengeCard key={c.id} c={c} onOpen={onOpen} />)}
    </div>
  );
}

function EmptyCard({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <Card className="items-center p-14 text-center shadow-soft-sm">
      <Icon size={40} strokeWidth={2} className="mb-2.5 text-muted-foreground" />
      <p className="text-[14px] text-muted-foreground">{text}</p>
    </Card>
  );
}

function StateBadge({ state }: { state: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    scheduled: { label: "Starts soon", cls: "bg-[var(--secondary-dim)] text-[var(--secondary)]" },
    active: { label: "Live", cls: "bg-[color-mix(in_srgb,var(--green)_18%,transparent)] text-[var(--green)]" },
    ended: { label: "Ended", cls: "bg-muted text-muted-foreground" },
    finalized: { label: "Finished", cls: "bg-primary/15 text-primary" },
    pending_review: { label: "In review", cls: "bg-muted text-muted-foreground" },
  };
  const m = map[state] || map.active;
  return <Badge className={cn("px-2 py-0 text-[10px]", m.cls)}>{m.label}</Badge>;
}

function ChallengeCard({ c, onOpen, invite }: { c: Challenge; onOpen: (id: number) => void; invite?: boolean }) {
  return (
    <Card className="flex cursor-pointer flex-col gap-0 overflow-hidden p-0 shadow-soft-sm transition-shadow hover:shadow-soft-md" onClick={() => onOpen(c.id)}>
      <div className="relative flex aspect-video w-full items-center justify-center bg-muted">
        {c.image_url ? (
          <img src={resolveAssetUrl(c.image_url)} alt={c.title} className="size-full object-cover" />
        ) : (
          <Trophy size={36} strokeWidth={2} className="text-primary opacity-70" />
        )}
        <div className="absolute top-2 start-2 flex gap-1.5">
          <Badge className={cn("gap-1 px-2 py-0 text-[10px]", c.type === "team" ? "bg-foreground/80 text-background" : "bg-primary/15 text-primary")}>
            {c.type === "team" ? <Lock size={10} /> : <Globe size={10} />} {c.type === "team" ? "Team" : "Community"}
          </Badge>
        </div>
        <div className="absolute top-2 end-2 flex gap-1.5">
          {invite ? <Badge variant="destructive" className="px-2 py-0 text-[10px]">Invited</Badge> : <StateBadge state={c.state} />}
          {c.is_joined ? <Badge className="bg-primary px-2 py-0 text-[10px] text-primary-foreground">Joined</Badge> : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <p className="line-clamp-2 text-[14px] font-bold leading-snug">{c.title}</p>
        {c.description && <p className="line-clamp-2 text-[12px] leading-snug text-muted-foreground">{c.description}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-2.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Users size={11} /> {c.participant_count || 0}</span>
          {c.goal_label && <span className="inline-flex items-center gap-1"><Target size={11} /> {c.goal_label}</span>}
          {c.end_at && <span className="inline-flex items-center gap-1"><Calendar size={11} /> {new Date(c.end_at).toLocaleDateString()}</span>}
        </div>
        {c.reward_title && (
          <p className="mt-0.5 inline-flex items-center gap-1 truncate text-[11px] font-semibold text-primary">
            <Award size={11} className="shrink-0" /> {c.reward_title}
          </p>
        )}
      </div>
    </Card>
  );
}

// ─── Detail view ──────────────────────────────────────────────────────────────
function ChallengeDetail({ id, api, token, onBack, note }: { id: number; api: (p: string, i?: RequestInit) => Promise<Response>; token: string | null; onBack: () => void; note: (m: string) => void; meId?: string }) {
  const [data, setData] = useState<any>(null);
  const [board, setBoard] = useState<Row[]>([]);
  const [scope, setScope] = useState("overall");
  const [progress, setProgress] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [goalSubmit, setGoalSubmit] = useState<GoalRow | null>(null);
  const [busyGoal, setBusyGoal] = useState<number | null>(null);

  const loadAll = useCallback(async () => {
    const r = await api(`/api/challenges/${id}`);
    if (r.ok) setData(await r.json());
    const p = await api(`/api/challenges/${id}/progress`);
    if (p.ok) setProgress(await p.json());
  }, [api, id]);
  const loadBoard = useCallback(async (sc: string) => {
    const r = await api(`/api/challenges/${id}/leaderboard?scope=${sc}`);
    if (r.ok) setBoard((await r.json()).leaderboard || []);
  }, [api, id]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { loadBoard(scope); }, [loadBoard, scope]);

  if (!data) return <div className="mx-auto max-w-[820px] px-4 pt-6"><Skeleton className="h-64 w-full rounded-lg" /></div>;
  const c = data.challenge;
  const part = data.participant;
  const inv = data.invitation;
  const joined = part && part.status === "active";
  const methods: string[] = c.verification_methods || [];
  // Goal-based challenges: prefer the progress payload (it carries my per-goal
  // progress); fall back to the bare definitions before joining.
  const goalRows: GoalRow[] = (progress?.goals?.length ? progress.goals : c.goals_list) || [];
  const hasGoals = goalRows.length > 0;
  const canLog = !!joined && c.state === "active";

  const act = async (path: string, body?: any, ok?: string) => {
    setBusy(true);
    try {
      const r = await api(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
      const d = await r.json().catch(() => ({}));
      note(d.message || (r.ok ? ok || "Done" : "Something went wrong"));
      await loadAll(); await loadBoard(scope);
    } finally { setBusy(false); }
  };

  // One-tap daily check-in for nutrition/habit goals; everything else opens
  // the goal's submit sheet.
  const logGoal = async (goal: GoalRow) => {
    if (goal.goal_type === "nutrition" || goal.goal_type === "habit") {
      setBusyGoal(goal.id);
      try {
        const fd = new FormData();
        fd.append("method", "manual_checkin");
        fd.append("goal_id", String(goal.id));
        const r = await fetch(getApiBase() + `/api/challenges/${id}/submissions`, {
          method: "POST", headers: { Authorization: `Bearer ${token || ""}` }, body: fd,
        });
        const d = await r.json().catch(() => ({}));
        note(d.message || (r.ok ? "Checked in!" : "Check-in failed"));
        if (r.ok) { await loadAll(); await loadBoard(scope); }
      } finally { setBusyGoal(null); }
      return;
    }
    setGoalSubmit(goal);
  };

  const goalTarget = Number(c.goal_target) || 0;
  const myProgress = Number(progress?.participant?.progress_value) || 0;
  const pct = goalTarget > 0 ? Math.min(100, (myProgress / goalTarget) * 100) : 0;
  const completedGoals = hasGoals ? goalRows.filter(g => g.progress?.completed).length : 0;

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 pt-4 pb-24">
      <button onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ChevronLeft size={16} /> All challenges
      </button>

      <Card className="mb-4 overflow-hidden p-0 shadow-soft-sm">
        <div className="relative flex aspect-[3/1] w-full items-center justify-center bg-muted">
          {c.image_url ? <img src={resolveAssetUrl(c.image_url)} alt={c.title} className="size-full object-cover" /> : <Trophy size={48} className="text-primary opacity-70" />}
          <div className="absolute bottom-3 start-3 flex gap-1.5">
            <Badge className={cn("gap-1 px-2 py-0.5 text-[11px]", c.type === "team" ? "bg-foreground/80 text-background" : "bg-primary/15 text-primary")}>
              {c.type === "team" ? <Lock size={11} /> : <Globe size={11} />} {c.type === "team" ? "Team" : "Community"}
            </Badge>
            <StateBadge state={c.state} />
          </div>
        </div>
        <div className="p-5">
          <h2 className="text-[19px] font-bold">{c.title}</h2>
          {c.description && <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{c.description}</p>}

          {/* The challenge's reward (set by the admin/coach in challenge settings) */}
          <RewardBanner title={c.reward_title} description={c.reward_description} points={c.reward_points} />

          {/* The goal/task list (new system) — or legacy free-text milestones */}
          {hasGoals ? (
            <GoalChecklist goals={goalRows} canLog={canLog} busyGoalId={busyGoal} onLog={logGoal} />
          ) : c.goals && String(c.goals).trim() ? (
            <div className="mt-3 rounded-md bg-muted/50 p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-foreground"><Target size={13} /> Goals</p>
              <ul className="flex flex-col gap-1">
                {String(c.goals).split("\n").map((g: string) => g.trim()).filter(Boolean).map((g: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] text-muted-foreground">
                    <span className="mt-0.5 text-[var(--main)]">•</span>
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-muted-foreground">
            {hasGoals ? (
              <span className="inline-flex items-center gap-1.5"><Target size={13} /> <b className="text-foreground">{goalRows.length} goal{goalRows.length > 1 ? "s" : ""}</b> to complete</span>
            ) : (
              <span className="inline-flex items-center gap-1.5"><Target size={13} /> Goal: <b className="text-foreground">{goalTarget || "—"} {c.goal_unit}</b> ({c.scoring_model})</span>
            )}
            <span className="inline-flex items-center gap-1.5"><Users size={13} /> {c.participant_count} joined</span>
            {c.start_at && <span className="inline-flex items-center gap-1.5"><Calendar size={13} /> {new Date(c.start_at).toLocaleDateString()} → {new Date(c.end_at).toLocaleDateString()}</span>}
          </div>

          {!hasGoals && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {methods.map(m => <Badge key={m} variant="outline" className="gap-1 px-2 py-0.5 text-[10px]"><ShieldCheck size={10} /> {METHOD_LABELS[m] || m}</Badge>)}
            </div>
          )}

          {c.rules_terms && (
            <details className="mt-3 rounded-md bg-muted/50 p-3 text-[12px]">
              <summary className="cursor-pointer font-semibold text-foreground">Rules & terms</summary>
              <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{c.rules_terms}</p>
            </details>
          )}

          {/* Join / leave / accept */}
          <div className="mt-4 flex flex-wrap gap-2">
            {inv && !joined && (
              <>
                <Button disabled={busy} onClick={() => act(`/api/challenges/${id}/invites/respond`, { token: inv.token, accept: true, display_mode: "hidden" }, "Invitation accepted")}>Accept invite</Button>
                <Button variant="outline" disabled={busy} onClick={() => act(`/api/challenges/${id}/invites/respond`, { token: inv.token, accept: false }, "Declined")}>Decline</Button>
              </>
            )}
            {!inv && !joined && c.type === "community" && (c.state === "active" || c.state === "scheduled") && (
              <Button disabled={busy} onClick={() => act(`/api/challenges/${id}/join`, { display_mode: "hidden" }, "Joined!")}>Join challenge</Button>
            )}
            {joined && c.state === "active" && !hasGoals && (
              <Button disabled={busy} className="gap-1.5" onClick={() => setSubmitOpen(true)}><Upload size={15} /> Submit progress</Button>
            )}
            {joined && c.state !== "finalized" && (
              <Button variant="outline" disabled={busy} onClick={() => act(`/api/challenges/${id}/leave`, undefined, "Left challenge")}>Leave</Button>
            )}
            <Button variant="outline" disabled={busy} className="gap-1.5" onClick={() => { const reason = prompt("Report this challenge — reason:"); if (reason) act(`/api/challenges/${id}/report`, { reason }, "Reported"); }}>
              <Flag size={14} /> Report
            </Button>
          </div>
        </div>
      </Card>

      {/* My progress */}
      {joined && (
        <Card className="mb-4 p-5 shadow-soft-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[14px] font-bold">Your progress</p>
            <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Award size={13} className="text-primary" /> {progress?.participant?.verified_points || 0} pts</span>
              <span className="inline-flex items-center gap-1"><Flame size={13} className="text-[var(--secondary)]" /> {progress?.participant?.streak || 0} streak</span>
              {progress?.rank && <span className="inline-flex items-center gap-1"><Trophy size={13} /> #{progress.rank}</span>}
            </div>
          </div>
          {goalTarget > 0 && (
            <>
              <Progress value={pct} className="h-2.5" />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {hasGoals
                  ? `${completedGoals}/${goalRows.length} goals complete · ${Math.round(pct)}% overall`
                  : `${myProgress} / ${goalTarget} ${c.goal_unit} (${Math.round(pct)}%)`}
              </p>
            </>
          )}
          {Number(progress?.participant?.pending_points) > 0 && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"><Hourglass size={12} /> {progress.participant.pending_points} pts pending review</p>
          )}
          {progress?.submissions?.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {progress.submissions.slice(0, 6).map((s: any) => {
                const g = s.goal_id ? goalRows.find(x => x.id === s.goal_id) : null;
                return (
                  <div key={s.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-[12px]">
                    <span className="min-w-0 truncate">{g ? `${g.title} — ` : ""}{METHOD_LABELS[s.method] || s.method} · {s.activity_date}</span>
                    <SubStatus status={s.status} />
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Leaderboard */}
      <Card className="p-5 shadow-soft-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[14px] font-bold">Leaderboard</p>
          <Tabs value={scope} onValueChange={setScope}>
            <TabsList className="h-8">
              <TabsTrigger value="overall" className="text-[11px]">Overall</TabsTrigger>
              <TabsTrigger value="weekly" className="text-[11px]">Weekly</TabsTrigger>
              <TabsTrigger value="daily" className="text-[11px]">Daily</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {board.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-muted-foreground">No ranked entries yet.</p>
        ) : (
          <div className="space-y-1">
            {board.map(r => (
              <div key={r.participant_id} className={cn("flex items-center gap-3 rounded-md px-3 py-2", r.you ? "bg-primary/10 ring-1 ring-inset ring-primary/30" : "hover:bg-muted/40")}>
                <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-bold", r.rank <= 3 ? "bg-primary/15 text-primary" : "text-muted-foreground")}>{r.rank}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                  {r.name}{r.you && <span className="ms-1 text-[11px] text-primary">(you)</span>}
                  {r.is_winner && <Trophy size={12} className="ms-1 inline text-primary" />}
                </span>
                {r.has_pending && <Hourglass size={12} className="text-muted-foreground" />}
                <span className="text-[13px] font-bold tabular-nums">{r.verified_points}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {submitOpen && <SubmitDialog open={submitOpen} onClose={() => setSubmitOpen(false)} methods={methods} token={token} id={id} onDone={() => { setSubmitOpen(false); loadAll(); loadBoard(scope); }} note={note} />}
      {goalSubmit && <GoalSubmitDialog goal={goalSubmit} token={token} id={id} onClose={() => setGoalSubmit(null)} onDone={() => { setGoalSubmit(null); loadAll(); loadBoard(scope); }} note={note} />}
    </div>
  );
}

// ─── Goal-aware submit sheet ──────────────────────────────────────────────────
// The goal's type decides exactly what we ask for — athletes never pick a
// "verification method" by hand.
function GoalSubmitDialog({ goal, token, id, onClose, onDone, note }: {
  goal: GoalRow; token: string | null; id: number; onClose: () => void; onDone: () => void; note: (m: string) => void;
}) {
  const [value, setValue] = useState("");      // km / kg / minutes
  const [file, setFile] = useState<File | null>(null);
  const [noteText, setNoteText] = useState("");
  const [busy, setBusy] = useState(false);
  const type = goal.goal_type;
  const meta = GOAL_TYPE_META[type] || GOAL_TYPE_META.habit;
  const Icon = meta.icon;
  const transformStage = type === "transformation"
    ? (goal.progress?.has_before || goal.progress?.before_pending ? "after" : "before")
    : null;

  // What the server will record this as.
  const method =
    type === "weight_loss" || type === "weight_gain" ? "weigh_in"
    : type === "transformation" ? `${transformStage}_photo`
    : file ? (file.type.startsWith("video") ? "video_evidence" : "photo_evidence")
    : type === "walk_run" ? "gps_distance"
    : "time_based";

  const needsValue = type === "walk_run" || type === "weight_loss" || type === "weight_gain" || (type === "training" && !file);
  const needsFile = type === "weight_loss" || type === "weight_gain" || type === "transformation";
  const valueLabel =
    type === "walk_run" ? "Distance (km)"
    : type === "training" ? "Duration (minutes)"
    : "Current weight (kg)";

  const submit = async () => {
    if (needsValue && (!value || Number(value) <= 0)) return note(`Enter ${valueLabel.toLowerCase()}`);
    if (needsFile && !file) return note("A photo is required for this goal");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("method", method);
      fd.append("goal_id", String(goal.id));
      if (type === "walk_run" || type === "weight_loss" || type === "weight_gain") fd.append("metric_value", value);
      if (type === "training" && value) fd.append("duration_seconds", String(Number(value) * 60));
      if (noteText) fd.append("note", noteText);
      if (file) fd.append("evidence", file);
      // Walk/Run: attach the device's location as proof-of-presence.
      if (type === "walk_run") {
        const geo = await getGeo();
        if (geo) { fd.append("geo_lat", String(geo.lat)); fd.append("geo_lng", String(geo.lng)); }
      }
      const r = await fetch(getApiBase() + `/api/challenges/${id}/submissions`, {
        method: "POST", headers: { Authorization: `Bearer ${token || ""}` }, body: fd,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) note(d.message || "Submission failed");
      else { note(d.message || "Submitted"); onDone(); }
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={cn("grid size-7 place-items-center rounded-md", meta.cls)}><Icon size={14} /></span>
            {goal.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {type === "transformation" && (
            <p className="rounded-md bg-muted/50 p-2.5 text-[12px] text-muted-foreground">
              Upload your <b className="text-foreground">{transformStage}</b> photo. {transformStage === "before" ? "Take it at the start so your transformation is measurable." : "Time to show the result!"}
            </p>
          )}
          {(type === "weight_loss" || type === "weight_gain") && goal.progress?.start_weight == null && (
            <p className="rounded-md bg-muted/50 p-2.5 text-[12px] text-muted-foreground">
              Your first weigh-in sets your <b className="text-foreground">starting weight</b>. Progress is measured from there.
            </p>
          )}
          {needsValue && (
            <div>
              <label className="mb-1 block text-[12px] font-semibold">{valueLabel}</label>
              <Input type="number" min={0} step="any" value={value} onChange={e => setValue(e.target.value)}
                placeholder={type === "walk_run" ? "e.g. 5.2" : type === "training" ? "e.g. 45" : "e.g. 82.5"} />
            </div>
          )}
          {(type === "training" || type === "walk_run") && (
            <div>
              <label className="mb-1 block text-[12px] font-semibold">Proof photo/video (optional)</label>
              <input type="file" accept="image/*,video/*" onChange={e => setFile(e.target.files?.[0] || null)} className="block w-full text-[12px] file:mr-3 file:rounded-md file:border-0 file:bg-primary/15 file:px-3 file:py-1.5 file:text-primary" />
            </div>
          )}
          {needsFile && (
            <div>
              <label className="mb-1 block text-[12px] font-semibold">{type === "transformation" ? `${transformStage === "before" ? "Before" : "After"} photo` : "Scale photo"}</label>
              <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} className="block w-full text-[12px] file:mr-3 file:rounded-md file:border-0 file:bg-primary/15 file:px-3 file:py-1.5 file:text-primary" />
            </div>
          )}
          <div>
            <label className="mb-1 block text-[12px] font-semibold">Note (optional)</label>
            <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={2} placeholder="Anything the reviewer should know…" />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {needsFile || file
              ? "This will be reviewed before it counts toward your score. Photos/videos are checked for when they were captured."
              : type === "walk_run"
                ? "We'll attach your current GPS location as proof of presence. Add a photo for a higher-trust entry."
                : "This counts immediately (adding proof earns more trust)."}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy || (needsFile && !file)} onClick={submit}>{busy ? "Submitting…" : "Submit"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubStatus({ status }: { status: string }) {
  if (status === "approved" || status === "auto_approved") return <span className="inline-flex items-center gap-1 text-[var(--green)]"><CheckCircle2 size={13} /> Counted</span>;
  if (status === "rejected") return <span className="text-destructive">Rejected</span>;
  return <span className="inline-flex items-center gap-1 text-muted-foreground"><Hourglass size={13} /> Pending</span>;
}

function SubmitDialog({ open, onClose, methods, token, id, onDone, note }: any) {
  const [method, setMethod] = useState<string>(methods[0]);
  const [metric, setMetric] = useState("");
  const [duration, setDuration] = useState("");
  const [noteText, setNoteText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const needsEvidence = EVIDENCE_METHODS.has(method);
  const numericUnit = NUMERIC_METHODS[method];

  const submit = async () => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("method", method);
      if (metric) fd.append("metric_value", metric);
      if (method === "time_based" && duration) fd.append("duration_seconds", String(Number(duration) * 60));
      if (noteText) fd.append("note", noteText);
      if (file) fd.append("evidence", file);
      // Steps-by-GPS: attach the device's current location as proof-of-presence.
      if (method === "gps_steps") {
        const geo = await getGeo();
        if (geo) { fd.append("geo_lat", String(geo.lat)); fd.append("geo_lng", String(geo.lng)); }
      }
      const r = await fetch(getApiBase() + `/api/challenges/${id}/submissions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token || ""}` },
        body: fd,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { note(d.message || "Submission failed"); }
      else { note(d.message || "Submitted"); onDone(); }
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Submit progress</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[12px] font-semibold">Method</label>
            <div className="flex flex-wrap gap-1.5">
              {methods.map((m: string) => (
                <button key={m} onClick={() => setMethod(m)} className={cn("rounded-full border px-3 py-1 text-[12px]", method === m ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>
                  {METHOD_LABELS[m] || m}
                </button>
              ))}
            </div>
          </div>
          {method !== "manual_checkin" && method !== "coach_approval" && method !== "attendance" && !needsEvidence && (
            <div>
              <label className="mb-1 block text-[12px] font-semibold">{method === "time_based" ? "Duration (minutes)" : `Amount ${numericUnit ? `(${numericUnit})` : ""}`}</label>
              {method === "time_based"
                ? <Input type="number" value={duration} onChange={e => setDuration(e.target.value)} placeholder="e.g. 30" />
                : <Input type="number" value={metric} onChange={e => setMetric(e.target.value)} placeholder="e.g. 8000" />}
            </div>
          )}
          {needsEvidence && (
            <div>
              <label className="mb-1 block text-[12px] font-semibold">Evidence (photo/video/screenshot)</label>
              <input ref={fileRef} type="file" accept="image/*,video/*" onChange={e => setFile(e.target.files?.[0] || null)} className="block w-full text-[12px] file:mr-3 file:rounded-md file:border-0 file:bg-primary/15 file:px-3 file:py-1.5 file:text-primary" />
            </div>
          )}
          <div>
            <label className="mb-1 block text-[12px] font-semibold">Note (optional)</label>
            <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={2} placeholder="Anything the reviewer should know…" />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {needsEvidence || method === "coach_approval" || method === "attendance"
              ? "This will be reviewed before it counts toward your score. Photos/videos are checked for when they were captured."
              : method === "gps_steps"
                ? "We'll attach your current GPS location as proof of presence."
                : "This counts immediately (lower-trust methods earn fewer points)."}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy || (needsEvidence && !file)} onClick={submit}>{busy ? "Submitting…" : "Submit"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
