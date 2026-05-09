import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getApiBase } from "@/lib/api";
import {
  Plus, ChevronDown, ChevronUp, Trash2, CheckCircle2,
  Circle, Dumbbell, Calendar, Flame, Trophy, RefreshCw, UserCheck, User as UserIcon,
  Lock, Pencil,
} from "lucide-react";

interface Exercise {
  id: number;
  name: string;
  sets: number;
  reps: string;
  rest: string;
  note?: string;
  done?: boolean;
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
                dayMap.get(day)!.push({ id: idx + 1, name: ex.name || ex.exercise, sets: ex.sets || 3, reps: ex.reps || "10", rest: ex.rest || "60s" });
              });
              const coachPlan: WorkoutDay[] = DAYS.map((day, i) => ({
                id: i + 1, day, focus: dayMap.has(day) ? "Full" : "Rest",
                exercises: dayMap.get(day) || [], expanded: false,
              }));
              setCoachPlanData(coachPlan);
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
    setPlan(p => p.map(d => d.id === dayId
      ? { ...d, exercises: d.exercises.map(e => e.id === exId ? { ...e, done: !e.done } : e) }
      : d
    ));
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
    <div style={{ maxWidth: 860, margin: "0 auto", paddingBottom: 32 }}>

      {/* Flash */}
      {flash && (
        <div style={{
          position: "fixed", top: 70, left: "50%", transform: "translateX(-50%)",
          zIndex: 999, background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 12, padding: "10px 20px", fontSize: 13, fontWeight: 600,
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)", color: "var(--text-primary)",
          whiteSpace: "nowrap",
        }}>
          {flash}
        </div>
      )}

      {/* Header */}
      <div style={{ padding: "16px 16px 8px" }}>
        <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 4 }}>
          Workout Plan
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          {tab === "coach"
            ? (hasSubscription && coachPlanData
                ? `Assigned by ${coachName}`
                : "Subscribe to a coach to receive a personalised plan")
            : "Your weekly training schedule"}
        </p>
      </div>

      {/* Tabs: My Plan / Coach Plan (Coach tab is locked without an active subscription) */}
      <div style={{ display: "flex", gap: 8, padding: "8px 16px 12px" }}>
        <button
          onClick={() => setTab("self")}
          style={{
            flex: 1, padding: "10px 14px", borderRadius: 12,
            border: `1px solid ${tab === "self" ? "var(--main)" : "var(--border)"}`,
            background: tab === "self" ? "var(--main-dim)" : "var(--bg-card)",
            color: tab === "self" ? "var(--main)" : "var(--text-secondary)",
            fontWeight: tab === "self" ? 700 : 500, fontSize: 13, cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
        >
          <UserIcon size={14} /> My Plan
        </button>
        <button
          onClick={() => setTab("coach")}
          disabled={!hasSubscription}
          aria-disabled={!hasSubscription}
          style={{
            flex: 1, padding: "10px 14px", borderRadius: 12,
            border: `1px solid ${tab === "coach" ? "#3B82F6" : "var(--border)"}`,
            background: tab === "coach" ? "rgba(59,130,246,0.12)" : "var(--bg-card)",
            color: !hasSubscription ? "var(--text-muted)" : tab === "coach" ? "#3B82F6" : "var(--text-secondary)",
            fontWeight: tab === "coach" ? 700 : 500, fontSize: 13,
            cursor: hasSubscription ? "pointer" : "not-allowed",
            opacity: hasSubscription ? 1 : 0.6,
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
        >
          {hasSubscription ? <UserCheck size={14} /> : <Lock size={14} />} Coach Plan
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, padding: "8px 16px 16px" }}>
        {[
          { icon: Calendar, label: "Training Days", value: trainingDays, color: "#FFD600" },
          { icon: Dumbbell, label: "Exercises", value: totalExercises, color: "#60A5FA" },
          { icon: CheckCircle2, label: "Completed", value: `${doneExercises}/${totalExercises}`, color: "#4ADE80" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} style={{
            background: "var(--bg-card)", borderRadius: 14, padding: "12px 10px",
            border: "1px solid var(--border)", textAlign: "center",
          }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: `${color}22`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 6px" }}>
              <Icon size={16} color={color} strokeWidth={2} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>{value}</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 500, marginTop: 1 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Coach tab: locked card when no active subscription */}
      {tab === "coach" && !hasSubscription && (
        <div style={{ margin: "0 16px 24px", padding: "28px 22px", borderRadius: 18, border: "1px solid var(--border)", background: "var(--bg-card)", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: "rgba(59,130,246,0.12)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
            <Lock size={22} color="#3B82F6" />
          </div>
          <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Subscribe to a coach to unlock</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55, marginBottom: 16 }}>
            Once you subscribe, your coach can publish a custom workout plan that appears here.
          </p>
          <button
            onClick={() => navigate("/app/coaching")}
            style={{ padding: "11px 22px", borderRadius: 12, border: "none", background: "#3B82F6", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
          >
            Find a coach
          </button>
        </div>
      )}

      {/* Coach tab: subscribed but coach hasn't pushed a plan yet */}
      {tab === "coach" && hasSubscription && !coachPlanData && (
        <div style={{ margin: "0 16px 24px", padding: "28px 22px", borderRadius: 18, border: "1px solid var(--border)", background: "var(--bg-card)", textAlign: "center" }}>
          <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>No plan from your coach yet</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55 }}>
            Your coach will push a workout plan here as soon as it's ready.
          </p>
        </div>
      )}

      {/* My Plan: Add / Edit toggle */}
      {tab === "self" && (
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 16px 12px" }}>
          <button
            onClick={() => setEditingMyPlan(v => !v)}
            style={{
              padding: "8px 14px", borderRadius: 10,
              border: editingMyPlan ? "1px solid var(--main)" : "1px solid var(--border)",
              background: editingMyPlan ? "var(--main-dim)" : "var(--bg-card)",
              color: editingMyPlan ? "var(--main)" : "var(--text-secondary)",
              fontWeight: 600, fontSize: 12, cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            {editingMyPlan ? <CheckCircle2 size={14} /> : (hasMyPlan ? <Pencil size={14} /> : <Plus size={14} />)}
            {editingMyPlan ? "Done" : (hasMyPlan ? "Edit" : "Add")}
          </button>
        </div>
      )}

      {/* Day cards */}
      {(tab === "self" || (tab === "coach" && coachPlanData)) && (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 16px" }}>
        {displayedPlan.map(day => {
          const color = FOCUS_COLORS[day.focus] || "#FFD600";
          const isToday = day.day === todayDayName;
          const doneCount = day.exercises.filter(e => e.done).length;
          const total = day.exercises.length;
          const allDone = total > 0 && doneCount === total;

          return (
            <div
              key={day.id}
              style={{
                background: "var(--bg-card)", borderRadius: 16,
                border: `1px solid ${isToday ? "var(--main)" : "var(--border)"}`,
                overflow: "hidden",
                boxShadow: isToday ? "0 0 0 1px var(--main-glow)" : "none",
              }}
            >
              {/* Day header */}
              <button
                onClick={() => toggleDay(day.id)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 12,
                  padding: "14px 16px", background: "transparent", border: "none",
                  cursor: "pointer", textAlign: "start",
                }}
              >
                {/* Focus dot */}
                <div style={{
                  width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                  background: `${color}22`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {allDone
                    ? <Trophy size={16} color={color} strokeWidth={2} />
                    : <Flame size={16} color={color} strokeWidth={2} />
                  }
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{day.day}</span>
                    {isToday && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                        background: "var(--main)", color: "#fff",
                        padding: "2px 6px", borderRadius: 20, textTransform: "uppercase",
                      }}>Today</span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color, background: `${color}18`,
                      padding: "2px 8px", borderRadius: 20,
                    }}>{day.focus}</span>
                    {total > 0 && (
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {doneCount}/{total} done
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress + chevron */}
                {total > 0 && (
                  <div style={{ width: 32, height: 32, position: "relative", flexShrink: 0 }}>
                    <svg width="32" height="32" viewBox="0 0 32 32">
                      <circle cx="16" cy="16" r="13" fill="none" stroke="var(--border)" strokeWidth="3" />
                      <circle
                        cx="16" cy="16" r="13" fill="none"
                        stroke={color} strokeWidth="3"
                        strokeDasharray={`${2 * Math.PI * 13}`}
                        strokeDashoffset={`${2 * Math.PI * 13 * (1 - doneCount / total)}`}
                        strokeLinecap="round"
                        style={{ transform: "rotate(-90deg)", transformOrigin: "center", transition: "stroke-dashoffset 0.4s" }}
                      />
                    </svg>
                  </div>
                )}
                {day.expanded
                  ? <ChevronUp size={16} color="var(--text-muted)" />
                  : <ChevronDown size={16} color="var(--text-muted)" />
                }
              </button>

              {/* Expanded content */}
              {day.expanded && (
                <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px 16px" }}>

                  {/* Focus selector — only when editing my own plan */}
                  {tab === "self" && editingMyPlan && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                    {FOCUS_OPTIONS.map(f => (
                      <button
                        key={f}
                        onClick={() => changeFocus(day.id, f)}
                        style={{
                          padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                          border: "none", cursor: "pointer",
                          background: day.focus === f ? (FOCUS_COLORS[f] || "var(--main)") : "var(--bg-surface)",
                          color: day.focus === f ? "#fff" : "var(--text-secondary)",
                          transition: "all 0.15s",
                        }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  )}

                  {/* Exercises */}
                  {day.exercises.length === 0 && day.focus === "Rest" ? (
                    <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-muted)", fontSize: 13 }}>
                      😴 Rest day — recovery is part of training
                    </div>
                  ) : day.exercises.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "16px 0", color: "var(--text-muted)", fontSize: 13 }}>
                      No exercises yet. Add one below.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                      {day.exercises.map((ex, idx) => (
                        <div
                          key={ex.id}
                          style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "10px 12px", borderRadius: 12,
                            background: ex.done ? `${color}12` : "var(--bg-surface)",
                            border: `1px solid ${ex.done ? color + "44" : "var(--border)"}`,
                            transition: "all 0.2s",
                          }}
                        >
                          <button
                            onClick={() => toggleExercise(day.id, ex.id)}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}
                          >
                            {ex.done
                              ? <CheckCircle2 size={20} color={color} strokeWidth={2} />
                              : <Circle size={20} color="var(--text-muted)" strokeWidth={1.8} />
                            }
                          </button>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 13, fontWeight: 600,
                              color: ex.done ? "var(--text-muted)" : "var(--text-primary)",
                              textDecoration: ex.done ? "line-through" : "none",
                            }}>
                              {idx + 1}. {ex.name}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                              {ex.sets} sets × {ex.reps} reps · rest {ex.rest}
                            </div>
                          </div>

                          {tab === "self" && editingMyPlan && (
                            <button
                              onClick={() => removeExercise(day.id, ex.id)}
                              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-muted)", flexShrink: 0 }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add exercise form */}
                  {tab === "self" && editingMyPlan && addingExercise === day.id ? (
                    <div style={{ background: "var(--bg-surface)", borderRadius: 12, padding: 12, border: "1px solid var(--border)", marginBottom: 10 }}>
                      <input
                        className="input-base"
                        placeholder="Exercise name (e.g. Bench Press)"
                        value={newEx.name}
                        onChange={e => setNewEx(v => ({ ...v, name: e.target.value }))}
                        style={{ marginBottom: 8, fontSize: 13 }}
                        autoFocus
                        onKeyDown={e => e.key === "Enter" && addExercise(day.id)}
                      />
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                        {[
                          { key: "sets", label: "Sets", placeholder: "3" },
                          { key: "reps", label: "Reps", placeholder: "10" },
                          { key: "rest", label: "Rest", placeholder: "60s" },
                        ].map(({ key, label, placeholder }) => (
                          <div key={key}>
                            <label style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                              {label}
                            </label>
                            <input
                              className="input-base"
                              placeholder={placeholder}
                              value={(newEx as any)[key]}
                              onChange={e => setNewEx(v => ({ ...v, [key]: e.target.value }))}
                              style={{ fontSize: 13, padding: "8px 10px" }}
                            />
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => addExercise(day.id)}
                          style={{
                            flex: 1, padding: "9px", borderRadius: 10, border: "none",
                            background: "var(--main)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
                          }}
                        >
                          Add
                        </button>
                        <button
                          onClick={() => setAddingExercise(null)}
                          style={{
                            flex: 1, padding: "9px", borderRadius: 10,
                            border: "1px solid var(--border)", background: "transparent",
                            color: "var(--text-secondary)", fontWeight: 600, fontSize: 13, cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* Actions row — Add Exercise only while editing My Plan; Reset is always available so users can reset coach-plan check-offs too. */}
                  <div style={{ display: "flex", gap: 8 }}>
                    {tab === "self" && editingMyPlan && addingExercise !== day.id && (
                      <button
                        onClick={() => setAddingExercise(day.id)}
                        style={{
                          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                          padding: "9px", borderRadius: 10, border: "1px dashed var(--border)",
                          background: "transparent", color: "var(--text-secondary)",
                          fontWeight: 600, fontSize: 12, cursor: "pointer",
                        }}
                      >
                        <Plus size={14} /> Add Exercise
                      </button>
                    )}
                    {day.exercises.length > 0 && (
                      <button
                        onClick={() => resetDay(day.id)}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                          padding: "9px 14px", borderRadius: 10,
                          border: "1px solid var(--border)", background: "transparent",
                          color: "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer",
                        }}
                      >
                        <RefreshCw size={13} /> Reset
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
