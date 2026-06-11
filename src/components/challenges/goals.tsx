/**
 * Challenge goals — shared UI for the multi-goal (task list) challenge system.
 *
 *  • GOAL_TYPE_META   — icon + colors per goal type (catalog comes from the API).
 *  • GoalBuilder      — creator-side: compose the list of goals for a challenge.
 *  • RewardFields     — creator-side: the per-challenge reward (title/desc/points).
 *  • GoalChecklist    — athlete-side: the task list with per-goal progress + actions.
 *  • RewardBanner     — athlete-side: what the winner gets.
 *
 * Used by the athlete, coach, and admin challenge pages (web + mobile builds).
 */
import { useEffect, useState } from "react";
import {
  Dumbbell, Footprints, Scale, TrendingUp, Apple, CheckSquare, ImagePlus,
  Plus, X, Gift, Target, CheckCircle2, Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Human labels for every verification method (athlete + coach views). */
export const METHOD_LABELS: Record<string, string> = {
  manual_checkin: "Daily check-in", workout_log: "Workout log", time_based: "Timed activity",
  manual_step: "Steps (manual)", manual_distance: "Distance (manual)", gps_steps: "Steps (GPS)",
  gps_distance: "Distance (GPS)", photo_evidence: "Photo evidence", video_evidence: "Video evidence",
  screenshot_evidence: "Screenshot", weigh_in: "Weigh-in", before_photo: "Before photo",
  after_photo: "After photo", coach_approval: "Coach approval", attendance: "In-person attendance",
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface GoalTypeOption {
  key: string;
  label: string;
  tracking: string;
  unit: string;
  needs_target: boolean;
  needs_training: boolean;
  needs_activity: boolean;
  daily: boolean;
  weigh_in: boolean;
  methods: string[];
}

export interface GoalDraft {
  goal_type: string;
  title?: string;
  description?: string;
  training_id?: number | null;
  activity?: string | null;
  target_value?: number | string;
}

export interface GoalRow {
  id: number;
  goal_type: string;
  title: string;
  description?: string | null;
  training_id?: number | null;
  training_title?: string | null;
  activity?: string | null;
  target_value: number;
  target_unit: string;
  tracking?: string;
  methods?: string[];
  progress?: {
    current: number; target: number; pct: number; completed: boolean;
    start_weight?: number | null; current_weight?: number | null;
    has_before?: boolean; has_after?: boolean;
    before_pending?: boolean; after_pending?: boolean; done_today?: boolean;
  } | null;
}

/**
 * One-tap challenge presets. Each template prefills the goal list with
 * sensible defaults the creator can still edit (targets, habit names, the
 * training pick) before publishing.
 */
export interface ChallengeTemplate { key: string; label: string; blurb: string; goals: GoalDraft[] }
export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  {
    key: "transformation_30",
    label: "30-Day Transformation",
    blurb: "Weight loss + daily habit + before/after photos",
    goals: [
      { goal_type: "weight_loss", target_value: 4 },
      { goal_type: "habit", title: "Stick to your plan every day", target_value: 30 },
      { goal_type: "transformation", target_value: 2 },
    ],
  },
  {
    key: "consistency_21",
    label: "21-Day Consistency",
    blurb: "Daily habit + nutrition check-ins",
    goals: [
      { goal_type: "habit", title: "Train or move every day", target_value: 21 },
      { goal_type: "nutrition", target_value: 21 },
    ],
  },
  {
    key: "distance_month",
    label: "Distance Month",
    blurb: "Run 50 km + daily stretch habit",
    goals: [
      { goal_type: "walk_run", activity: "run", target_value: 50 },
      { goal_type: "habit", title: "Stretch 10 minutes", target_value: 20 },
    ],
  },
  {
    key: "muscle_builder",
    label: "Muscle Builder",
    blurb: "Training plan + weight gain weigh-ins",
    goals: [
      { goal_type: "training", training_id: null, target_value: 16 },
      { goal_type: "weight_gain", target_value: 3 },
    ],
  },
];

export const GOAL_TYPE_META: Record<string, { icon: any; cls: string }> = {
  training:       { icon: Dumbbell,    cls: "text-primary bg-primary/12" },
  walk_run:       { icon: Footprints,  cls: "text-[var(--green)] bg-[color-mix(in_srgb,var(--green)_14%,transparent)]" },
  weight_loss:    { icon: Scale,       cls: "text-[var(--secondary)] bg-[var(--secondary-dim)]" },
  weight_gain:    { icon: TrendingUp,  cls: "text-[var(--secondary)] bg-[var(--secondary-dim)]" },
  nutrition:      { icon: Apple,       cls: "text-[var(--green)] bg-[color-mix(in_srgb,var(--green)_14%,transparent)]" },
  habit:          { icon: CheckSquare, cls: "text-primary bg-primary/12" },
  transformation: { icon: ImagePlus,   cls: "text-[var(--secondary)] bg-[var(--secondary-dim)]" },
};

/** Fetch the goal catalog + trainings once per dialog open. */
export function useGoalOptions(api: (p: string, i?: RequestInit) => Promise<Response>) {
  const [types, setTypes] = useState<GoalTypeOption[]>([]);
  const [trainings, setTrainings] = useState<Array<{ id: number; title: string }>>([]);
  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const r = await api("/api/challenges/meta/goal-options");
        if (r.ok && on) {
          const d = await r.json();
          setTypes(d.goal_types || []);
          setTrainings(d.trainings || []);
        }
      } catch { /* keep empty — builder shows a retry-free fallback */ }
    })();
    return () => { on = false; };
  }, [api]);
  return { types, trainings };
}

// ── Creator: goal builder ─────────────────────────────────────────────────────
export function GoalBuilder({ api, goals, onChange }: {
  api: (p: string, i?: RequestInit) => Promise<Response>;
  goals: GoalDraft[];
  onChange: (goals: GoalDraft[]) => void;
}) {
  const { types, trainings } = useGoalOptions(api);
  const [picking, setPicking] = useState(goals.length === 0);

  const typeOf = (k: string) => types.find(t => t.key === k);
  const update = (i: number, patch: Partial<GoalDraft>) =>
    onChange(goals.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  const remove = (i: number) => onChange(goals.filter((_, j) => j !== i));
  const add = (t: GoalTypeOption) => {
    onChange([...goals, {
      goal_type: t.key,
      activity: t.needs_activity ? "walk" : null,
      training_id: null,
      target_value: t.needs_target ? "" : 2,
    }]);
    setPicking(false);
  };

  return (
    <div className="grid gap-2.5">
      {goals.map((g, i) => {
        const t = typeOf(g.goal_type);
        const meta = GOAL_TYPE_META[g.goal_type] || GOAL_TYPE_META.habit;
        const Icon = meta.icon;
        return (
          <div key={i} className="rounded-md border border-border p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className={cn("grid size-7 shrink-0 place-items-center rounded-md", meta.cls)}><Icon size={14} /></span>
              <p className="flex-1 text-[13px] font-semibold">{t?.label || g.goal_type}</p>
              <Badge variant="outline" className="hidden px-2 py-0 text-[10px] text-muted-foreground sm:inline-flex">{t?.tracking}</Badge>
              <Button variant="ghost" size="icon-sm" onClick={() => remove(i)} aria-label="Remove goal"><X size={14} /></Button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {t?.needs_training && (
                <div className="col-span-2 grid gap-1">
                  <Label className="text-[11px] text-muted-foreground">Training (from your library)</Label>
                  <Select value={g.training_id ? String(g.training_id) : ""} onValueChange={v => update(i, { training_id: Number(v) })}>
                    <SelectTrigger><SelectValue placeholder={trainings.length ? "Choose a training…" : "No trainings available"} /></SelectTrigger>
                    <SelectContent className="z-[10000]">
                      {trainings.map(tr => <SelectItem key={tr.id} value={String(tr.id)}>{tr.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {t?.needs_activity && (
                <div className="grid gap-1">
                  <Label className="text-[11px] text-muted-foreground">Activity</Label>
                  <Select value={g.activity || "walk"} onValueChange={v => update(i, { activity: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[10000]">
                      <SelectItem value="walk">Walking</SelectItem>
                      <SelectItem value="run">Running</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {t?.needs_target && (
                <div className="grid gap-1">
                  <Label className="text-[11px] text-muted-foreground">
                    {g.goal_type === "training" ? "Sessions" : g.goal_type === "walk_run" ? "Distance (km)" : t.weigh_in ? `Target (${t.unit} to ${g.goal_type === "weight_loss" ? "lose" : "gain"})` : `Target (${t.unit})`}
                  </Label>
                  <Input type="number" min={0} value={g.target_value ?? ""} placeholder={g.goal_type === "walk_run" ? "e.g. 50" : "e.g. 12"}
                    onChange={e => update(i, { target_value: e.target.value })} />
                </div>
              )}
              <div className={cn("grid gap-1", g.goal_type === "transformation" ? "col-span-2" : "")}>
                <Label className="text-[11px] text-muted-foreground">{g.goal_type === "habit" ? "Habit (shown to athletes)" : "Custom title (optional)"}</Label>
                <Input value={g.title || ""} placeholder={g.goal_type === "habit" ? "e.g. No sugar, sleep by 11pm" : "Leave empty for automatic"}
                  onChange={e => update(i, { title: e.target.value })} />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Tracked by: {t?.tracking}</p>
          </div>
        );
      })}

      {picking ? (
        <div className="rounded-md border border-dashed border-border p-3">
          {goals.length === 0 && (
            <div className="mb-3">
              <p className="mb-2 text-[12px] font-semibold">Quick start from a template</p>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {CHALLENGE_TEMPLATES.map(t => (
                  <button key={t.key} type="button" onClick={() => { onChange(t.goals.map(g => ({ ...g }))); setPicking(false); }}
                    className="rounded-md border border-border px-3 py-2 text-start transition-colors hover:border-primary/60 hover:bg-primary/5">
                    <span className="block text-[12.5px] font-semibold">{t.label}</span>
                    <span className="block text-[10.5px] text-muted-foreground">{t.blurb}</span>
                  </button>
                ))}
              </div>
              <p className="my-2 text-center text-[10.5px] text-muted-foreground">— or build your own —</p>
            </div>
          )}
          <p className="mb-2 text-[12px] font-semibold">Pick a goal type</p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {types.map(t => {
              const meta = GOAL_TYPE_META[t.key] || GOAL_TYPE_META.habit;
              const Icon = meta.icon;
              return (
                <button key={t.key} type="button" onClick={() => add(t)}
                  className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2 text-start transition-colors hover:border-primary/60 hover:bg-primary/5">
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-md", meta.cls)}><Icon size={15} /></span>
                  <span className="min-w-0">
                    <span className="block text-[12.5px] font-semibold">{t.label}</span>
                    <span className="block truncate text-[10.5px] text-muted-foreground">{t.tracking}</span>
                  </span>
                </button>
              );
            })}
            {types.length === 0 && <p className="col-span-2 py-2 text-center text-[12px] text-muted-foreground">Loading goal types…</p>}
          </div>
          {goals.length > 0 && (
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setPicking(false)}>Cancel</Button>
          )}
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" className="justify-center gap-1.5 border-dashed" onClick={() => setPicking(true)}>
          <Plus size={14} /> Add goal
        </Button>
      )}
    </div>
  );
}

// ── Creator: per-challenge reward ─────────────────────────────────────────────
export function RewardFields({ value, onChange, showPoints }: {
  value: { reward_title: string; reward_description: string; reward_points: string | number };
  onChange: (patch: Partial<{ reward_title: string; reward_description: string; reward_points: string }>) => void;
  showPoints?: boolean;
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold"><Gift size={13} className="text-primary" /> Challenge reward (champion)</p>
      <div className="grid gap-2.5">
        <div className="grid gap-1">
          <Label className="text-[11px] text-muted-foreground">Reward</Label>
          <Input value={value.reward_title} placeholder="e.g. 1 month free membership" onChange={e => onChange({ reward_title: e.target.value })} />
        </div>
        <div className={cn("grid gap-2.5", showPoints ? "grid-cols-[1fr_110px]" : "")}>
          <div className="grid gap-1">
            <Label className="text-[11px] text-muted-foreground">Details (optional)</Label>
            <Input value={value.reward_description} placeholder="How / when the winner receives it" onChange={e => onChange({ reward_description: e.target.value })} />
          </div>
          {showPoints && (
            <div className="grid gap-1">
              <Label className="text-[11px] text-muted-foreground">Bonus points</Label>
              <Input type="number" min={0} value={value.reward_points} onChange={e => onChange({ reward_points: e.target.value })} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Athlete: reward banner ────────────────────────────────────────────────────
export function RewardBanner({ title, description, points }: { title?: string | null; description?: string | null; points?: number }) {
  if (!title) return null;
  return (
    <div className="mt-3 flex items-start gap-2.5 rounded-md bg-primary/10 p-3 ring-1 ring-inset ring-primary/25">
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/15 text-primary"><Gift size={15} /></span>
      <div className="min-w-0">
        <p className="text-[12.5px] font-bold">Reward: {title}{Number(points) > 0 ? ` · +${points} pts` : ""}</p>
        {description && <p className="mt-0.5 text-[11.5px] text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}

// ── Athlete: per-goal progress line ──────────────────────────────────────────
export function goalProgressText(g: GoalRow): string {
  const p = g.progress;
  switch (g.goal_type) {
    case "training":
      return p ? `${p.current}/${p.target} sessions` : `${g.target_value} sessions`;
    case "walk_run":
      return p ? `${p.current}/${p.target} km` : `${g.target_value} km`;
    case "weight_loss":
    case "weight_gain": {
      if (!p) return `${g.target_value} kg`;
      if (p.start_weight == null) return `Target ${p.target} kg — log your first weigh-in to set your starting weight`;
      return `Start ${p.start_weight} kg → now ${p.current_weight} kg · ${p.current}/${p.target} kg (${Math.round(p.pct)}%)`;
    }
    case "nutrition":
    case "habit":
      return p ? `${p.current}/${p.target} days${p.done_today ? " · done today ✓" : ""}` : `${g.target_value} days`;
    case "transformation": {
      if (!p) return "Before & after photos";
      const mark = (ok?: boolean, pending?: boolean) => (ok ? "✓" : pending ? "⏳ in review" : "—");
      return `Before ${mark(p.has_before, p.before_pending)} · After ${mark(p.has_after, p.after_pending)}`;
    }
    default:
      return "";
  }
}

/** Action label for the goal's primary "log progress" button. */
export function goalActionLabel(g: GoalRow): string {
  switch (g.goal_type) {
    case "training": return "Log session";
    case "walk_run": return "Log distance";
    case "weight_loss":
    case "weight_gain": return "Weigh in";
    case "nutrition": return "Check in";
    case "habit": return "Done today";
    case "transformation": {
      const p = g.progress;
      if (!p?.has_before && !p?.before_pending) return "Before photo";
      if (!p?.has_after && !p?.after_pending) return "After photo";
      return "In review";
    }
    default: return "Log progress";
  }
}

export function GoalChecklist({ goals, canLog, busyGoalId, onLog }: {
  goals: GoalRow[];
  /** Whether the viewer is an active participant in a live challenge. */
  canLog: boolean;
  busyGoalId?: number | null;
  onLog?: (goal: GoalRow) => void;
}) {
  if (!goals.length) return null;
  return (
    <div className="mt-3 grid gap-2">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold"><Target size={13} /> Goals — complete the list</p>
      {goals.map(g => {
        const meta = GOAL_TYPE_META[g.goal_type] || GOAL_TYPE_META.habit;
        const Icon = meta.icon;
        const p = g.progress;
        const done = !!p?.completed;
        const dailyDone = !!p?.done_today;
        // Transformation: both photos submitted (approved or awaiting review).
        const transformDone = g.goal_type === "transformation"
          && (p?.has_before || p?.before_pending) && (p?.has_after || p?.after_pending);
        const disabled = done || dailyDone || !!transformDone;
        return (
          <div key={g.id} className={cn("rounded-md border p-3", done ? "border-[color-mix(in_srgb,var(--green)_45%,transparent)] bg-[color-mix(in_srgb,var(--green)_6%,transparent)]" : "border-border")}>
            <div className="flex items-center gap-2.5">
              <span className={cn("grid size-8 shrink-0 place-items-center rounded-md", done ? "bg-[color-mix(in_srgb,var(--green)_16%,transparent)] text-[var(--green)]" : meta.cls)}>
                {done ? <CheckCircle2 size={15} /> : <Icon size={15} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-[13px] font-semibold", done && "line-through opacity-80")}>{g.title}</p>
                <p className="text-[11px] text-muted-foreground">{goalProgressText(g)}</p>
              </div>
              {canLog && onLog && !done && (
                <Button size="sm" variant={dailyDone || transformDone ? "outline" : "default"} disabled={disabled || busyGoalId === g.id}
                  className="shrink-0 gap-1" onClick={() => onLog(g)}>
                  {g.goal_type === "transformation" && <Camera size={13} />}
                  {busyGoalId === g.id ? "…" : dailyDone ? "Done ✓" : goalActionLabel(g)}
                </Button>
              )}
            </div>
            {p && g.goal_type !== "transformation" && (
              <Progress value={p.pct} className="mt-2 h-1.5" />
            )}
            {g.description && <p className="mt-1.5 text-[11px] text-muted-foreground">{g.description}</p>}
            {g.tracking && !p && <p className="mt-1.5 text-[10.5px] text-muted-foreground">Tracked by: {g.tracking}</p>}
          </div>
        );
      })}
    </div>
  );
}
