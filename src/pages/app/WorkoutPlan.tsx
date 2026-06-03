import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getApiBase } from "@/lib/api";
import PlanCommentsThread from "@/components/app/PlanCommentsThread";
import {
  Plus, ChevronDown, ChevronUp, Trash2, CheckCircle2,
  Circle, Dumbbell, Calendar, Flame, Trophy, RefreshCw, UserCheck, User as UserIcon,
  Lock, Pencil, Play, Ticket, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Exercise {
  id: number;
  name: string;
  sets: number;
  reps: string;
  rest: string;
  note?: string;
  done?: boolean;
  video_url?: string;
  video_type?: "upload" | "youtube";
}

interface WorkoutDay {
  id: number;
  day: string;
  focus: string;
  exercises: Exercise[];
  expanded: boolean;
}

const FOCUS_COLORS: Record<string, string> = {
  Chest: "#FB7185", Back: "#60A5FA", Legs: "#4ADE80",
  Shoulders: "#FBBF24", Arms: "#A78BFA", Core: "#FF7A6E",
  Cardio: "#22D3EE", Rest: "#6B7280", Full: "#FFD600",
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const DEFAULT_PLAN: WorkoutDay[] = [
  {
    id: 1, day: "Monday", focus: "Chest", expanded: false,
    exercises: [
      { id: 1, name: "Bench Press", sets: 4, reps: "8-10", rest: "90s" },
      { id: 2, name: "Incline Dumbbell Press", sets: 3, reps: "10-12", rest: "60s" },
      { id: 3, name: "Cable Flyes", sets: 3, reps: "12-15", rest: "45s" },
      { id: 4, name: "Push-Ups", sets: 3, reps: "To failure", rest: "45s" },
    ],
  },
  {
    id: 2, day: "Tuesday", focus: "Back", expanded: false,
    exercises: [
      { id: 1, name: "Pull-Ups", sets: 4, reps: "6-10", rest: "90s" },
      { id: 2, name: "Barbell Row", sets: 4, reps: "8-10", rest: "90s" },
      { id: 3, name: "Lat Pulldown", sets: 3, reps: "10-12", rest: "60s" },
      { id: 4, name: "Cable Row", sets: 3, reps: "12", rest: "60s" },
    ],
  },
  {
    id: 3, day: "Wednesday", focus: "Rest", expanded: false,
    exercises: [],
  },
  {
    id: 4, day: "Thursday", focus: "Legs", expanded: false,
    exercises: [
      { id: 1, name: "Squat", sets: 4, reps: "6-8", rest: "120s" },
      { id: 2, name: "Romanian Deadlift", sets: 3, reps: "10-12", rest: "90s" },
      { id: 3, name: "Leg Press", sets: 3, reps: "12-15", rest: "60s" },
      { id: 4, name: "Calf Raises", sets: 4, reps: "15-20", rest: "45s" },
    ],
  },
  {
    id: 5, day: "Friday", focus: "Shoulders", expanded: false,
    exercises: [
      { id: 1, name: "Overhead Press", sets: 4, reps: "8-10", rest: "90s" },
      { id: 2, name: "Lateral Raises", sets: 4, reps: "12-15", rest: "45s" },
      { id: 3, name: "Front Raises", sets: 3, reps: "12", rest: "45s" },
      { id: 4, name: "Face Pulls", sets: 3, reps: "15", rest: "45s" },
    ],
  },
  {
    id: 6, day: "Saturday", focus: "Arms", expanded: false,
    exercises: [
      { id: 1, name: "Barbell Curl", sets: 4, reps: "10-12", rest: "60s" },
      { id: 2, name: "Skull Crushers", sets: 4, reps: "10-12", rest: "60s" },
      { id: 3, name: "Hammer Curls", sets: 3, reps: "12", rest: "45s" },
      { id: 4, name: "Tricep Pushdown", sets: 3, reps: "12-15", rest: "45s" },
    ],
  },
  {
    id: 7, day: "Sunday", focus: "Rest", expanded: false,
    exercises: [],
  },
];

const FOCUS_OPTIONS = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core", "Cardio", "Full", "Rest"];

export default function WorkoutPlan() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"self" | "coach">("self");
  const [plan, setPlan] = useState<WorkoutDay[]>(DEFAULT_PLAN);
  const [coachPlanData, setCoachPlanData] = useState<WorkoutDay[] | null>(null);
  const [coachPlanId, setCoachPlanId] = useState<number | null>(null);
  const [coachUserId, setCoachUserId] = useState<number | null>(null);
  const [ticketModal, setTicketModal] = useState<{ ex: Exercise } | null>(null);
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketBody, setTicketBody] = useState("");
  const [ticketBusy, setTicketBusy] = useState(false);
  const [ticketMsg, setTicketMsg] = useState("");
  const [coachName, setCoachName] = useState<string>("");
  const [hasSubscription, setHasSubscription] = useState(false);
  const [hasMyPlan, setHasMyPlan] = useState(false); // derived: any non-default edit
  const [editingMyPlan, setEditingMyPlan] = useState(false);
  const [addingExercise, setAddingExercise] = useState<number | null>(null);
  const [newEx, setNewEx] = useState({ name: "", sets: "3", reps: "10", rest: "60s" });
  const [flash, setFlash] = useState("");
  const [activeDay, setActiveDay] = useState<number | null>(null);

  // Detect "has plan" purely from local edits — anything that diverges from
  // the default seed counts as a custom plan.
  useEffect(() => {
    setHasMyPlan(JSON.stringify(plan) !== JSON.stringify(DEFAULT_PLAN));
  }, [plan]);

  // Coach plan + subscription status load in parallel; we don't overwrite the
  // self plan any more — the user picks which to view via tabs.
  useEffect(() => {
    if (!token) return;
    fetch(`${getApiBase()}/api/payments/my-subscriptions`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : { subscriptions: [] })
      .then(d => setHasSubscription((d?.subscriptions || []).length > 0))
      .catch(() => setHasSubscription(false));

    fetch(`${getApiBase()}/api/plans/coach-workout-plan`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.plan?.exercises) {
          try {
            const exercises = typeof d.plan.exercises === "string" ? JSON.parse(d.plan.exercises) : d.plan.exercises;
            if (Array.isArray(exercises) && exercises.length > 0) {
              const dayMap = new Map<string, Exercise[]>();
              exercises.forEach((ex: any, idx: number) => {
                const day = ex.day || DAYS[idx % 7];
                if (!dayMap.has(day)) dayMap.set(day, []);
                dayMap.get(day)!.push({ id: idx + 1, name: ex.name || ex.exercise, sets: ex.sets || 3, reps: ex.reps || "10", rest: ex.rest || "60s", video_url: ex.video_url || undefined, video_type: ex.video_type || undefined });
              });
              const coachPlan: WorkoutDay[] = DAYS.map((day, i) => ({
                id: i + 1, day, focus: dayMap.has(day) ? "Full" : "Rest",
                exercises: dayMap.get(day) || [], expanded: false,
              }));
              setCoachPlanData(coachPlan);
              setCoachPlanId(d.plan.id || null);
              setCoachUserId(d.plan.coach_id || null);
              setCoachName(d.plan.coach_name || "Your Coach");
            }
          } catch { /* leave coachPlanData null */ }
        }
      }).catch(() => {});
  }, [token]);

  // Plan currently rendered in the day-cards section. My-plan tab is editable;
  // coach-plan tab renders read-only (handled inline below).
  const displayedPlan = tab === "coach" && coachPlanData ? coachPlanData : plan;
  const planSource: "self" | "coach" = tab;

  const todayIndex = new Date().getDay(); // 0=Sun, 1=Mon...
  const todayDayName = DAYS[(todayIndex + 6) % 7]; // Mon=0 in our list

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(""), 2000);
  };

  const toggleDay = (id: number) => {
    setPlan(p => p.map(d => d.id === id ? { ...d, expanded: !d.expanded } : d));
  };

  const toggleExercise = (dayId: number, exId: number) => {
    let willBeDone = false;
    let firstToggleToday = false;
    let allDoneNow = false;
    let wholePlanDoneNow = false;
    setPlan(p => {
      const nextPlan = p.map(d => {
        if (d.id !== dayId) return d;
        const wasAnyDone = d.exercises.some(e => e.done);
        const next = d.exercises.map(e => {
          if (e.id === exId) { willBeDone = !e.done; return { ...e, done: !e.done }; }
          return e;
        });
        if (willBeDone && !wasAnyDone) firstToggleToday = true;
        if (next.length > 0 && next.every(e => e.done)) allDoneNow = true;
        return { ...d, exercises: next };
      });
      // Plan-finished fires once every exercise on every day is done. The
      // server is idempotent per-plan_id so re-toggles can't double-credit.
      wholePlanDoneNow = nextPlan.every(d => d.exercises.length === 0 || d.exercises.every(e => e.done))
        && nextPlan.some(d => d.exercises.length > 0);
      return nextPlan;
    });
    // Fire training events so the coach sees a "started training" /
    // "finished a workout" entry. Only when we have a coach plan.
    if (tab === "coach" && coachPlanId && token) {
      const post = (event_type: string) =>
        fetch(getApiBase() + "/api/tickets/training-events", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ event_type, workout_plan_id: coachPlanId }),
        }).catch(() => {});
      if (firstToggleToday) post("workout_started");
      if (allDoneNow) post("workout_finished");
      if (wholePlanDoneNow) post("plan_finished");
    }
  };

  const changeFocus = (dayId: number, focus: string) => {
    setPlan(p => p.map(d => d.id === dayId ? { ...d, focus } : d));
  };

  const addExercise = (dayId: number) => {
    if (!newEx.name.trim()) return;
    setPlan(p => p.map(d => d.id === dayId ? {
      ...d,
      exercises: [...d.exercises, {
        id: Date.now(), name: newEx.name.trim(),
        sets: parseInt(newEx.sets) || 3,
        reps: newEx.reps, rest: newEx.rest,
      }],
    } : d));
    setNewEx({ name: "", sets: "3", reps: "10", rest: "60s" });
    setAddingExercise(null);
    showFlash("✅ Exercise added");
  };

  const removeExercise = (dayId: number, exId: number) => {
    setPlan(p => p.map(d => d.id === dayId
      ? { ...d, exercises: d.exercises.filter(e => e.id !== exId) }
      : d
    ));
  };

  const resetDay = (dayId: number) => {
    setPlan(p => p.map(d => d.id === dayId
      ? { ...d, exercises: d.exercises.map(e => ({ ...e, done: false })) }
      : d
    ));
    showFlash("🔄 Day reset");
  };

  // Stats — based on the plan currently displayed (self vs coach)
  const totalExercises = displayedPlan.reduce((s, d) => s + d.exercises.length, 0);
  const doneExercises = displayedPlan.reduce((s, d) => s + d.exercises.filter(e => e.done).length, 0);
  const trainingDays = displayedPlan.filter(d => d.focus !== "Rest").length;

  return (
    <div className="mx-auto w-full max-w-[880px] px-4 pb-4">

      {/* Flash */}
      {flash && (
        <div className="fixed start-1/2 top-[70px] z-[999] -translate-x-1/2 whitespace-nowrap rounded-md bg-card px-5 py-2.5 text-[13px] font-semibold text-foreground shadow-soft-lg">
          {flash}
        </div>
      )}

      <div className="space-y-4">

        {/* Header */}
        <header className="pt-1">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">Workout Plan</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {tab === "coach"
              ? (hasSubscription && coachPlanData
                  ? `Assigned by ${coachName}`
                  : "Subscribe to a coach to receive a personalised plan")
              : "Your weekly training schedule"}
          </p>
        </header>

        {/* Tabs: My Plan / Coach Plan (Coach tab is locked without an active subscription) */}
        <div role="tablist" className="flex gap-1 rounded-md bg-muted p-1">
          <button
            role="tab"
            aria-selected={tab === "self"}
            onClick={() => setTab("self")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-[8px] px-3 py-2.5 text-[13px] font-semibold transition-all",
              tab === "self"
                ? "bg-card text-foreground shadow-soft-sm"
                : "text-muted-foreground",
            )}
          >
            <UserIcon size={15} strokeWidth={2} /> My Plan
          </button>
          <button
            role="tab"
            aria-selected={tab === "coach"}
            onClick={() => setTab("coach")}
            disabled={!hasSubscription}
            aria-disabled={!hasSubscription}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-[8px] px-3 py-2.5 text-[13px] font-semibold transition-all",
              tab === "coach"
                ? "bg-card text-[var(--secondary)] shadow-soft-sm"
                : "text-muted-foreground",
              !hasSubscription && "cursor-not-allowed opacity-50",
            )}
          >
            {hasSubscription ? <UserCheck size={15} strokeWidth={2} /> : <Lock size={15} strokeWidth={2} />} Coach Plan
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Calendar, label: "Training Days", value: trainingDays, color: "var(--main)" },
            { icon: Dumbbell, label: "Exercises", value: totalExercises, color: "var(--secondary)" },
            { icon: CheckCircle2, label: "Completed", value: `${doneExercises}/${totalExercises}`, color: "var(--green)" },
          ].map(({ icon: Icon, label, value, color }) => (
            <Card key={label} className="items-center gap-0 p-4 text-center shadow-soft-sm">
              <span
                className="mx-auto mb-1.5 grid size-9 place-items-center rounded-md"
                style={{ background: `color-mix(in srgb, ${color} 15%, transparent)` }}
              >
                <Icon size={17} strokeWidth={2} style={{ color }} />
              </span>
              <div className="text-2xl font-bold tabular-nums tracking-tight">{value}</div>
              <div className="mt-0.5 text-[11px] font-medium text-muted-foreground">{label}</div>
            </Card>
          ))}
        </div>

        {/* Coach tab: locked card when no active subscription */}
        {tab === "coach" && !hasSubscription && (
          <Card className="items-center p-7 text-center shadow-soft-sm">
            <span className="mb-3.5 grid size-14 place-items-center rounded-lg bg-[var(--secondary-dim)]">
              <Lock size={22} strokeWidth={2} className="text-[var(--secondary)]" />
            </span>
            <p className="text-[15px] font-semibold">Subscribe to a coach to unlock</p>
            <p className="mt-1.5 max-w-[340px] text-[13px] leading-relaxed text-muted-foreground">
              Once you subscribe, your coach can publish a custom workout plan that appears here.
            </p>
            <Button
              onClick={() => navigate("/app/coaching")}
              className="mt-4 bg-[var(--secondary)] text-white hover:bg-[var(--secondary)]/90"
            >
              Find a coach <ArrowRight size={16} />
            </Button>
          </Card>
        )}

        {/* Coach tab: subscribed but coach hasn't pushed a plan yet */}
        {tab === "coach" && hasSubscription && !coachPlanData && (
          <Card className="items-center p-7 text-center shadow-soft-sm">
            <p className="text-[15px] font-semibold">No plan from your coach yet</p>
            <p className="mt-1.5 max-w-[340px] text-[13px] leading-relaxed text-muted-foreground">
              Your coach will push a workout plan here as soon as it's ready.
            </p>
          </Card>
        )}

        {/* My Plan: Add / Edit toggle */}
        {tab === "self" && (
          <div className="flex justify-end">
            <Button
              variant={editingMyPlan ? "default" : "outline"}
              size="sm"
              onClick={() => setEditingMyPlan(v => !v)}
            >
              {editingMyPlan ? <CheckCircle2 size={15} /> : (hasMyPlan ? <Pencil size={15} /> : <Plus size={15} />)}
              {editingMyPlan ? "Done" : (hasMyPlan ? "Edit" : "Add")}
            </Button>
          </div>
        )}

        {/* Day cards */}
        {(tab === "self" || (tab === "coach" && coachPlanData)) && (
        <div className="flex flex-col gap-2">
          {displayedPlan.map(day => {
            const color = FOCUS_COLORS[day.focus] || "#FFD600";
            const isToday = day.day === todayDayName;
            const doneCount = day.exercises.filter(e => e.done).length;
            const total = day.exercises.length;
            const allDone = total > 0 && doneCount === total;
            const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

            return (
              <Card
                key={day.id}
                className={cn(
                  "gap-0 overflow-hidden p-0 shadow-soft-sm",
                  isToday && "ring-1 ring-primary/60",
                )}
              >
                {/* Day header */}
                <button
                  onClick={() => toggleDay(day.id)}
                  aria-expanded={day.expanded}
                  className="flex w-full items-center gap-3 p-4 text-start transition active:scale-[0.99]"
                >
                  {/* Focus icon */}
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-md"
                    style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }}
                  >
                    {allDone
                      ? <Trophy size={16} strokeWidth={2} style={{ color }} />
                      : <Flame size={16} strokeWidth={2} style={{ color }} />
                    }
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-[15px] font-semibold">{day.day}</span>
                      {isToday && (
                        <Badge className="px-2 py-0 text-[10px] uppercase tracking-wide">Today</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
                      >{day.focus}</span>
                      {total > 0 && (
                        <span className="text-[11px] text-muted-foreground">
                          {doneCount}/{total} done
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress + chevron */}
                  {total > 0 && (
                    <span className="text-[12px] font-bold tabular-nums" style={{ color }}>{pct}%</span>
                  )}
                  {day.expanded
                    ? <ChevronUp size={18} className="shrink-0 text-muted-foreground" />
                    : <ChevronDown size={18} className="shrink-0 text-muted-foreground" />
                  }
                </button>

                {total > 0 && (
                  <Progress
                    value={pct}
                    className="h-1 rounded-none"
                    style={{ ["--primary" as any]: color }}
                  />
                )}

                {/* Expanded content */}
                {day.expanded && (
                  <div className="px-4 pt-3 pb-4">
                    <Separator className="mb-3" />

                    {/* Focus selector — only when editing my own plan */}
                    {tab === "self" && editingMyPlan && (
                    <div className="mb-3.5 flex flex-wrap gap-1.5">
                      {FOCUS_OPTIONS.map(f => {
                        const active = day.focus === f;
                        const fColor = FOCUS_COLORS[f] || "var(--main)";
                        return (
                          <button
                            key={f}
                            onClick={() => changeFocus(day.id, f)}
                            className={cn(
                              "rounded-full px-2.5 py-1 text-[11px] font-semibold transition",
                              !active && "bg-muted text-muted-foreground",
                            )}
                            style={active ? { background: fColor, color: "#fff" } : undefined}
                          >
                            {f}
                          </button>
                        );
                      })}
                    </div>
                    )}

                    {/* Exercises */}
                    {day.exercises.length === 0 && day.focus === "Rest" ? (
                      <div className="py-5 text-center text-[13px] text-muted-foreground">
                        😴 Rest day — recovery is part of training
                      </div>
                    ) : day.exercises.length === 0 ? (
                      <div className="py-4 text-center text-[13px] text-muted-foreground">
                        No exercises yet. Add one below.
                      </div>
                    ) : (
                      <div className="mb-3 flex flex-col gap-1.5">
                        {day.exercises.map((ex, idx) => (
                          <div
                            key={ex.id}
                            className="rounded-md p-3 transition"
                            style={{
                              background: ex.done
                                ? `color-mix(in srgb, ${color} 10%, transparent)`
                                : "var(--color-muted)",
                            }}
                          >
                            <div className="flex items-center gap-2.5">
                              <button
                                onClick={() => toggleExercise(day.id, ex.id)}
                                className="shrink-0 transition active:scale-90"
                                aria-label={ex.done ? "Mark exercise not done" : "Mark exercise done"}
                                aria-pressed={!!ex.done}
                              >
                                {ex.done
                                  ? <CheckCircle2 size={20} strokeWidth={2} style={{ color }} />
                                  : <Circle size={20} strokeWidth={1.8} className="text-muted-foreground" />
                                }
                              </button>

                              <div className="min-w-0 flex-1">
                                <div
                                  className={cn(
                                    "text-[13px] font-semibold",
                                    ex.done ? "text-muted-foreground line-through" : "text-foreground",
                                  )}
                                >
                                  {idx + 1}. {ex.name}
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                  <Badge variant="muted" className="px-2 py-0 text-[10px]">{ex.sets} sets</Badge>
                                  <Badge variant="muted" className="px-2 py-0 text-[10px]">{ex.reps} reps</Badge>
                                  <span className="text-[11px] text-muted-foreground">rest {ex.rest}</span>
                                </div>
                              </div>

                              {/* Linked workout video (when coach attached one) */}
                              {ex.video_url && (
                                <Button asChild variant="outline" size="sm" className="h-8 gap-1 px-2.5 text-[11px]">
                                  <a
                                    href={ex.video_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Watch reference video"
                                  >
                                    <Play size={12} fill="currentColor" /> Video
                                  </a>
                                </Button>
                              )}

                              {/* Ask coach about THIS exercise — only place the
                                  ticket button lives now (May meeting).
                                  Requires a coach plan + a real coach. */}
                              {tab === "coach" && coachPlanId && coachUserId && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="h-8 gap-1 px-2.5 text-[11px]"
                                  title="Ask your coach about this exercise"
                                  onClick={() => { setTicketModal({ ex }); setTicketSubject(`Question about: ${ex.name}`); setTicketBody(""); setTicketMsg(""); }}
                                >
                                  <Ticket size={12} /> Ticket
                                </Button>
                              )}

                              {tab === "self" && editingMyPlan && (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => removeExercise(day.id, ex.id)}
                                  className="shrink-0 text-muted-foreground"
                                  aria-label="Remove exercise"
                                >
                                  <Trash2 size={15} />
                                </Button>
                              )}
                            </div>

                            {/* Asana-style comments thread (coach plan only — own
                                plan doesn't have a coach yet, so nothing to
                                discuss). Mounted compact so users opt in. */}
                            {tab === "coach" && coachPlanId && (
                              <PlanCommentsThread workoutPlanId={coachPlanId} exerciseKey={String(ex.id) + "::" + ex.name} compact />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add exercise form */}
                    {tab === "self" && editingMyPlan && addingExercise === day.id ? (
                      <Card className="mb-2.5 gap-0 bg-muted p-3 shadow-none">
                        <Input
                          placeholder="Exercise name (e.g. Bench Press)"
                          value={newEx.name}
                          onChange={e => setNewEx(v => ({ ...v, name: e.target.value }))}
                          className="mb-2 bg-card"
                          autoFocus
                          onKeyDown={e => e.key === "Enter" && addExercise(day.id)}
                        />
                        <div className="mb-2.5 grid grid-cols-3 gap-2">
                          {[
                            { key: "sets", label: "Sets", placeholder: "3" },
                            { key: "reps", label: "Reps", placeholder: "10" },
                            { key: "rest", label: "Rest", placeholder: "60s" },
                          ].map(({ key, label, placeholder }) => (
                            <div key={key}>
                              <Label className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {label}
                              </Label>
                              <Input
                                placeholder={placeholder}
                                value={(newEx as any)[key]}
                                onChange={e => setNewEx(v => ({ ...v, [key]: e.target.value }))}
                                className="h-10 bg-card text-[13px]"
                              />
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={() => addExercise(day.id)} className="flex-1">Add</Button>
                          <Button variant="outline" onClick={() => setAddingExercise(null)} className="flex-1">Cancel</Button>
                        </div>
                      </Card>
                    ) : null}

                    {/* Actions row — Add Exercise only while editing My Plan; Reset is always available so users can reset coach-plan check-offs too. */}
                    <div className="flex gap-2">
                      {tab === "self" && editingMyPlan && addingExercise !== day.id && (
                        <Button
                          variant="outline"
                          onClick={() => setAddingExercise(day.id)}
                          className="flex-1 border-dashed text-muted-foreground"
                        >
                          <Plus size={15} /> Add Exercise
                        </Button>
                      )}
                      {day.exercises.length > 0 && (
                        <Button
                          variant="outline"
                          onClick={() => resetDay(day.id)}
                          className="text-muted-foreground"
                        >
                          <RefreshCw size={14} /> Reset
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
        )}
      </div>

      {/* Ticket modal — only path to file an athlete→coach ticket. Scoped to
          the current exercise so the coach knows what the question's about. */}
      <Dialog open={!!ticketModal} onOpenChange={(o) => { if (!o && !ticketBusy) setTicketModal(null); }}>
        <DialogContent className="sm:max-w-[460px]">
          {ticketModal && (
            <>
              <DialogHeader>
                <DialogTitle>Ask {coachName}</DialogTitle>
                <DialogDescription>
                  About: <strong className="text-foreground">{ticketModal.ex.name}</strong>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div>
                  <Label className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Subject</Label>
                  <Input value={ticketSubject} onChange={e => setTicketSubject(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Your question</Label>
                  <Textarea
                    value={ticketBody}
                    onChange={e => setTicketBody(e.target.value)}
                    rows={4}
                    placeholder="What's confusing you about this exercise?"
                  />
                </div>
                {ticketMsg && (
                  <p className={cn("text-[12px]", ticketMsg.startsWith("✅") ? "text-[var(--green)]" : "text-destructive")}>
                    {ticketMsg}
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setTicketModal(null)} disabled={ticketBusy}>
                  Cancel
                </Button>
                <Button
                  disabled={ticketBusy || !ticketSubject.trim() || !coachUserId || !coachPlanId}
                  onClick={async () => {
                    if (!coachUserId || !coachPlanId || !ticketModal) return;
                    setTicketBusy(true); setTicketMsg("");
                    try {
                      const r = await fetch(getApiBase() + "/api/tickets", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({
                          coach_id: coachUserId,
                          subject: ticketSubject.trim(),
                          body: ticketBody.trim(),
                          kind: "workout_question",
                          workout_plan_id: coachPlanId,
                          exercise_key: `${ticketModal.ex.id}::${ticketModal.ex.name}`,
                        }),
                      });
                      const d = await r.json().catch(() => ({}));
                      if (r.ok) {
                        setTicketMsg("✅ Sent — your coach will reply in your tickets inbox.");
                        setTimeout(() => { setTicketModal(null); setTicketMsg(""); }, 1300);
                      } else {
                        setTicketMsg(d.message || "Couldn't send ticket.");
                      }
                    } catch { setTicketMsg("Couldn't send ticket."); }
                    finally { setTicketBusy(false); }
                  }}
                >
                  {ticketBusy ? "Sending…" : "Send ticket"}
                </Button>
              </DialogFooter>

              <p className="text-[11px] text-muted-foreground">
                You can also see + reply to all your tickets at <a href="/app/tickets" className="text-primary hover:underline">Tickets</a>.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
