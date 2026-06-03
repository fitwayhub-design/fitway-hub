import { getApiBase } from "@/lib/api";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { useState, useEffect } from "react";
import { Users, Activity, Dumbbell, Plus, Save, Trash2, ChevronRight, Search, Target, Check, X, ArrowLeft, Zap, CheckCircle2, PartyPopper } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Athlete {
  id: number; name: string; email: string; avatar: string;
  steps: number; step_goal?: number; height?: number; weight?: number;
  gender?: string;
  date_of_birth?: string;
  fitness_goal?: string;
  activity_level?: string;
  target_weight?: number;
  weekly_goal?: number;
  computed_activity_level?: string;
  city?: string;
  country?: string;
  medical_history?: string;
  medical_file_url?: string;
  workoutPlan?: { title: string; exercises: number } | null;
  nutritionPlan?: { title: string; daily_calories: number } | null;
}

interface Exercise { id: string; name: string; sets: number; reps: string; rest_seconds: number; day: string; video_url?: string; video_type?: "upload" | "youtube"; }
interface Meal { id: string; name: string; time: string; calories: number; foods: string; }

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

/* Common exercise names shown in the workout-builder name dropdown. Coaches can
   still type a custom name — the input is bound to a <datalist>, not a strict
   select. Admin can later override / extend this from the workouts video
   library; this list is the safe minimum for a fresh install. */
const EXERCISE_LIBRARY: string[] = [
  // Push
  "Bench Press", "Incline Dumbbell Press", "Push-Up", "Dumbbell Shoulder Press",
  "Overhead Press", "Lateral Raise", "Triceps Pushdown", "Skull Crusher",
  // Pull
  "Pull-Up", "Lat Pulldown", "Barbell Row", "Seated Cable Row", "T-Bar Row",
  "Face Pull", "Dumbbell Curl", "Hammer Curl",
  // Legs
  "Back Squat", "Front Squat", "Romanian Deadlift", "Deadlift", "Leg Press",
  "Walking Lunge", "Bulgarian Split Squat", "Hip Thrust", "Leg Curl",
  "Leg Extension", "Calf Raise",
  // Core
  "Plank", "Side Plank", "Hanging Leg Raise", "Cable Crunch", "Russian Twist",
  // Cardio / conditioning
  "Treadmill (Steady)", "Treadmill (HIIT)", "Cycling", "Rowing Machine",
  "Stair Climber", "Jump Rope", "Burpees",
  // Mobility
  "Foam Rolling", "Hip Mobility Flow", "Thoracic Opener",
];


export default function CoachAthletes() {
  const { token } = useAuth();
  const { t } = useI18n();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [selected, setSelected] = useState<Athlete | null>(null);
  const [tab, setTab] = useState<"overview" | "workout" | "nutrition">("overview");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingStepGoal, setEditingStepGoal] = useState(false);
  const [stepGoalInput, setStepGoalInput] = useState("");

  const [workoutPlan, setWorkoutPlan] = useState({ title: "", description: "", days_per_week: 3, exercises: [] as Exercise[] });
  const [nutritionPlan, setNutritionPlan] = useState({ title: "", daily_calories: 2000, protein_g: 150, carbs_g: 250, fat_g: 65, meals: [] as Meal[], notes: "" });

  const api = (path: string, opts?: RequestInit) => fetch(getApiBase() + path, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts?.headers || {}) } });

  const loadAthletes = () => {
    api("/api/coach/users")
      .then(r => r.json())
      .then(d => setAthletes(d.users || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAthletes();
  }, []);
  useAutoRefresh(loadAthletes);
  useAutoRefresh(loadAthletes);

  const filtered = athletes.filter(a => a.name.toLowerCase().includes(search.toLowerCase()) || a.email.toLowerCase().includes(search.toLowerCase()));

  const selectAthlete = async (a: Athlete) => {
    setSelected(a);
    setTab("overview");
    setEditingStepGoal(false);
    setWorkoutPlan({ title: t('workout_plan_title', { name: a.name }), description: "", days_per_week: 3, exercises: [] });
    setNutritionPlan({ title: t('nutrition_plan_title', { name: a.name }), daily_calories: 2000, protein_g: 150, carbs_g: 250, fat_g: 65, meals: [], notes: "" });
    // Load existing plans and profile
    try {
      const [wp, np, profile] = await Promise.all([
        api(`/api/coach/users/${a.id}/workout-plan`).then(r => r.json()),
        api(`/api/coach/users/${a.id}/nutrition-plan`).then(r => r.json()),
        api(`/api/coach/users/${a.id}/profile`).then(r => r.json()),
      ]);
      if (profile?.user) {
        setSelected(s => s ? { ...s, ...profile.user, step_goal: profile.user.step_goal || 10000 } : s);
      }
      if (wp.plan) {
        setWorkoutPlan({
          title: wp.plan.title || t('workout_plan_title', { name: a.name }),
          description: wp.plan.description || "",
          days_per_week: wp.plan.days_per_week || 3,
          exercises: Array.isArray(wp.plan.exercises) ? wp.plan.exercises.map((e: any) => ({ ...e, id: e.id || Date.now().toString() })) : [],
        });
      }
      if (np.plan) {
        setNutritionPlan({
          title: np.plan.title || t('nutrition_plan_title', { name: a.name }),
          daily_calories: np.plan.daily_calories || 2000,
          protein_g: np.plan.protein_g || 150,
          carbs_g: np.plan.carbs_g || 250,
          fat_g: np.plan.fat_g || 65,
          meals: Array.isArray(np.plan.meals) ? np.plan.meals.map((m: any) => ({ ...m, id: m.id || Date.now().toString() })) : [],
          notes: np.plan.notes || "",
        });
      }
    } catch {}
  };

  const showMsg = (m: string) => { setMessage(m); setTimeout(() => setMessage(""), 3000); };

  const saveWorkout = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const r = await api(`/api/coach/users/${selected.id}/workout-plan`, { method: "POST", body: JSON.stringify(workoutPlan) });
      if (r.ok) showMsg(t("workout_saved")); else showMsg(t("failed_save"));
    } catch { showMsg(t("failed_save")); }
    finally { setSaving(false); }
  };

  const saveNutrition = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const r = await api(`/api/coach/users/${selected.id}/nutrition-plan`, { method: "POST", body: JSON.stringify(nutritionPlan) });
      if (r.ok) showMsg(t("nutrition_saved")); else showMsg(t("failed_save"));
    } catch { showMsg(t("failed_save")); }
    finally { setSaving(false); }
  };

  const addExercise = () => setWorkoutPlan(p => ({ ...p, exercises: [...p.exercises, { id: Date.now().toString(), name: "", sets: 3, reps: "10", rest_seconds: 60, day: "Monday", video_url: "", video_type: "youtube" as const }] }));
  const updateEx = (id: string, k: keyof Exercise, v: any) => setWorkoutPlan(p => ({ ...p, exercises: p.exercises.map(e => e.id === id ? { ...e, [k]: v } : e) }));
  const removeEx = (id: string) => setWorkoutPlan(p => ({ ...p, exercises: p.exercises.filter(e => e.id !== id) }));

  const addMeal = () => setNutritionPlan(p => ({ ...p, meals: [...p.meals, { id: Date.now().toString(), name: "", time: "08:00", calories: 400, foods: "" }] }));
  const updateMeal = (id: string, k: keyof Meal, v: any) => setNutritionPlan(p => ({ ...p, meals: p.meals.map(m => m.id === id ? { ...m, [k]: v } : m) }));
  const removeMeal = (id: string) => setNutritionPlan(p => ({ ...p, meals: p.meals.filter(m => m.id !== id) }));

  const bmi = selected?.height && selected?.weight ? (selected.weight / ((selected.height / 100) ** 2)).toFixed(1) : null;

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5 px-4 pb-4 md:flex-row">
      {/* Athletes list — hidden on phones once an athlete is selected */}
      <div className={`w-full shrink-0 md:block md:w-[260px] ${selected ? "hidden md:block" : "block"}`}>
        <Card className="sticky top-4 gap-0 overflow-hidden p-0 shadow-soft-sm">
          <div className="p-4">
            <p className="mb-2.5 text-[15px] font-semibold">{t("my_athletes")}</p>
            <div className="relative">
              <Search size={14} strokeWidth={2} className="pointer-events-none absolute top-1/2 start-3 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("search_placeholder")} className="h-9 ps-9 text-[13px]" aria-label={t("search_placeholder")} />
            </div>
          </div>
          <Separator />
          <div className="max-h-[calc(100dvh-260px)] overflow-y-auto">
            {loading ? (
              <div className="flex flex-col gap-2 p-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-md" />)}
              </div>
            ) : filtered.length === 0 ? (
              <p className="p-5 text-center text-[13px] text-muted-foreground">{t("coach_athletes_none")}</p>
            ) : filtered.map((a, i, arr) => (
              <div key={a.id}>
                <button
                  onClick={() => selectAthlete(a)}
                  className={`flex w-full items-center gap-2.5 px-4 py-3 text-start transition-colors ${selected?.id === a.id ? "bg-[var(--secondary-dim)]" : "hover:bg-muted/60"}`}
                >
                  <Avatar className="size-9 shrink-0">
                    <AvatarImage src={a.avatar} alt={a.name} />
                    <AvatarFallback>{(a.name || "A").slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{a.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{a.steps?.toLocaleString() || 0} {t("steps")}</p>
                  </div>
                  <ChevronRight size={14} strokeWidth={2} className="shrink-0 text-muted-foreground rtl:rotate-180" />
                </button>
                {i < arr.length - 1 && <Separator />}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Detail pane */}
      <div className={`min-w-0 flex-1 md:block ${selected ? "block" : "hidden md:block"}`}>
        {!selected ? (
          <div className="flex h-[300px] flex-col items-center justify-center gap-3 text-muted-foreground">
            <Users size={48} strokeWidth={1.5} />
            <p className="text-[15px]">{t("select_athlete")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Card className="gap-0 p-5 shadow-soft-sm">
              <button onClick={() => setSelected(null)} className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-opacity hover:opacity-75 md:hidden">
                <ArrowLeft size={15} strokeWidth={2} className="rtl:rotate-180" /> {t("coach_athletes_back")}
              </button>
              <div className="flex flex-wrap items-center gap-3.5">
                <Avatar className="size-14 shrink-0 ring-2 ring-[var(--secondary)]">
                  <AvatarImage src={selected.avatar} alt={selected.name} />
                  <AvatarFallback>{(selected.name || "A").slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[18px] font-bold tracking-tight">{selected.name}</p>
                  <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{selected.email}</p>
                </div>
                <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
                  <TabsList>
                    <TabsTrigger value="overview" className="px-3 capitalize">{t("overview")}</TabsTrigger>
                    <TabsTrigger value="workout" className="px-3 capitalize">{t("workout")}</TabsTrigger>
                    <TabsTrigger value="nutrition" className="px-3 capitalize">{t("nutrition")}</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </Card>

            {message && (
              <div className={`rounded-md px-3.5 py-2.5 text-[13px] font-semibold ${message.startsWith("✅") ? "bg-[color-mix(in_srgb,var(--green)_14%,transparent)] text-[var(--green)]" : "bg-[color-mix(in_srgb,var(--red)_14%,transparent)] text-[var(--red)]"}`}>{message}</div>
            )}

            {tab === "overview" && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    { label: t("height_label"), value: selected.height ? `${selected.height} cm` : "—" },
                    { label: t("weight_label"), value: selected.weight ? `${selected.weight} kg` : "—" },
                    { label: t('bmi_label'), value: bmi || "—" },
                    { label: t("gender"), value: selected.gender || "—" },
                    { label: t("date_of_birth"), value: selected.date_of_birth ? new Date(selected.date_of_birth).toLocaleDateString() : "—" },
                    { label: t("coach_requests_steps_today"), value: (selected.steps || 0).toLocaleString() },
                  ].map(s => (
                    <Card key={s.label} className="gap-0 p-4 shadow-soft-sm">
                      <p className="mb-1.5 text-[11px] tracking-wide text-muted-foreground uppercase">{s.label}</p>
                      <p className="text-[16px] font-bold capitalize">{s.value}</p>
                    </Card>
                  ))}
                </div>

                <Card className="gap-0 p-5 shadow-soft-sm">
                  <p className="mb-3 text-[13px] font-semibold">{t("onboarding_data")}</p>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {[
                      { label: t("main_goal"), value: selected.fitness_goal || "—" },
                      { label: t("activity_level"), value: selected.activity_level || "—" },
                      { label: t("computed_activity"), value: selected.computed_activity_level || "—" },
                      { label: t("target_weight"), value: selected.target_weight ? `${selected.target_weight} kg` : "—" },
                      { label: t("weekly_goal"), value: selected.weekly_goal ? `${selected.weekly_goal} kg` : "—" },
                      { label: t("location"), value: [selected.city, selected.country].filter(Boolean).join(", ") || "—" },
                    ].map(row => (
                      <div key={row.label} className="rounded-md bg-muted px-3 py-2.5">
                        <p className="mb-1 text-[10px] tracking-wide text-muted-foreground uppercase">{row.label}</p>
                        <p className="text-[13px] font-semibold">{row.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2.5 rounded-md bg-muted px-3 py-2.5">
                    <p className="mb-1 text-[10px] tracking-wide text-muted-foreground uppercase">{t("medical_history_short")}</p>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">{selected.medical_history || "—"}</p>
                    {selected.medical_file_url && (
                      <a href={selected.medical_file_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[12px] font-semibold text-[var(--secondary)] transition-opacity hover:opacity-75">
                        {t("view_medical_file")}
                      </a>
                    )}
                  </div>
                </Card>

                {/* Step Goal Editor */}
                <Card className="gap-0 p-5 shadow-soft-sm">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Target size={15} strokeWidth={2} className="text-primary" />
                      <p className="text-[13px] font-semibold">{t("step_goal_label")}</p>
                    </div>
                    {!editingStepGoal && (
                      <Button variant="outline" size="sm" onClick={() => { setStepGoalInput(String(selected.step_goal || 10000)); setEditingStepGoal(true); }}>
                        {t("edit")}
                      </Button>
                    )}
                  </div>
                  {editingStepGoal ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={stepGoalInput}
                        onChange={e => setStepGoalInput(e.target.value)}
                        className="flex-1"
                        min={500} max={100000}
                        aria-label={t("step_goal_label")}
                      />
                      <Button size="icon" aria-label={t("coach_athletes_step_goal_updated")} onClick={async () => {
                        const val = parseInt(stepGoalInput);
                        if (!val) return;
                        try {
                          const r = await api(`/api/coach/users/${selected.id}/step-goal`, { method: "PATCH", body: JSON.stringify({ step_goal: val }) });
                          if (r.ok) {
                            setAthletes(a => a.map(x => x.id === selected.id ? { ...x, step_goal: val } : x));
                            setSelected(s => s ? { ...s, step_goal: val } : s);
                            setEditingStepGoal(false);
                            showMsg(t("coach_athletes_step_goal_updated"));
                          }
                        } catch { showMsg(t("coach_athletes_step_goal_failed")); }
                      }}>
                        <Check size={16} strokeWidth={2.5} />
                      </Button>
                      <Button variant="secondary" size="icon" aria-label={t("cancel")} onClick={() => setEditingStepGoal(false)}>
                        <X size={16} strokeWidth={2} />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-[22px] font-bold text-primary tabular-nums">
                      {(selected.step_goal || 10000).toLocaleString()} <span className="text-[13px] font-normal text-muted-foreground">{t("coach_athletes_steps_per_day")}</span>
                    </p>
                  )}
                </Card>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: t("workout_plan"), tab: "workout" as const, icon: Dumbbell, sub: `${workoutPlan.exercises.length} ${t("exercises")}` },
                    { label: t("nutrition_plan_label"), tab: "nutrition" as const, icon: Activity, sub: `${nutritionPlan.daily_calories} ${t('kcal_per_day')}` },
                  ].map(p => {
                    const Icon = p.icon;
                    return (
                      <Card key={p.label} className="gap-0 p-5 shadow-soft-sm">
                        <div className="mb-2.5 flex items-center justify-between">
                          <p className="text-[13px] font-semibold">{p.label}</p>
                          <Icon size={14} strokeWidth={2} className="text-primary" />
                        </div>
                        <p className="mb-2.5 text-[12px] text-muted-foreground">{p.sub}</p>
                        <Button variant="secondary" size="sm" className="w-full" onClick={() => setTab(p.tab)}>{t("manage_plan")}</Button>
                      </Card>
                    );
                  })}
                </div>

                {/* Training activity feed — plan progress this coach can
                    actually act on (start/finish events fired from the
                    athlete's workout-plan view). */}
                <AthleteTrainingFeed athleteId={selected.id} token={token} />
              </div>
            )}

            {tab === "workout" && (
              <Card className="gap-0 p-5 shadow-soft-sm">
                <div className="mb-3.5 flex items-center justify-between">
                  <p className="text-[15px] font-semibold">{t("workout_plan")}</p>
                  <Button size="sm" onClick={saveWorkout} disabled={saving}>
                    <Save size={14} strokeWidth={2} /> {saving ? t("saving") : t("save_plan")}
                  </Button>
                </div>
                <div className="mb-3.5 grid gap-3 sm:grid-cols-[2fr_1fr]">
                  <div className="grid gap-2">
                    <Label htmlFor="wp-title">{t("coach_athletes_plan_title")}</Label>
                    <Input id="wp-title" value={workoutPlan.title} onChange={e => setWorkoutPlan(p => ({ ...p, title: e.target.value }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="wp-days">{t("coach_athletes_days_week")}</Label>
                    <Select value={String(workoutPlan.days_per_week)} onValueChange={v => setWorkoutPlan(p => ({ ...p, days_per_week: Number(v) }))}>
                      <SelectTrigger id="wp-days" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[2,3,4,5,6].map(n => <SelectItem key={n} value={String(n)}>{t('n_days', { n })}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mb-3.5 flex items-center justify-between">
                  <p className="text-[13px] font-semibold">{t("exercises")} ({workoutPlan.exercises.length})</p>
                  <Button size="sm" variant="outline" onClick={addExercise}><Plus size={14} strokeWidth={2} /> {t("coach_athletes_add_exercise")}</Button>
                </div>
                {workoutPlan.exercises.length === 0 && <p className="py-6 text-center text-[13px] text-muted-foreground">{t("coach_athletes_no_exercises")}</p>}
                <datalist id="coach-exercise-names">
                  {EXERCISE_LIBRARY.map(name => <option key={name} value={name} />)}
                </datalist>
                <div className="flex flex-col gap-3">
                  {workoutPlan.exercises.map(ex => (
                    <div key={ex.id} className="rounded-md bg-muted p-3.5">
                      <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[2fr_1fr_70px_70px_70px_auto]">
                        <Input list="coach-exercise-names" value={ex.name} onChange={e => updateEx(ex.id, "name", e.target.value)} placeholder={t('exercise_name')} className="h-9 bg-card text-[13px]" aria-label={t('exercise_name')} />
                        <Select value={ex.day} onValueChange={v => updateEx(ex.id, "day", v)}>
                          <SelectTrigger size="sm" className="w-full bg-card text-[12px]" aria-label={t("coach_athletes_days_week")}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DAYS.map(d => <SelectItem key={d} value={d}>{d.slice(0,3)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input type="number" value={ex.sets} onChange={e => updateEx(ex.id, "sets", Number(e.target.value))} placeholder={t('sets_label')} className="h-9 bg-card text-[13px]" min={1} aria-label={t('sets_label')} />
                        <Input value={ex.reps} onChange={e => updateEx(ex.id, "reps", e.target.value)} placeholder={t('reps_label')} className="h-9 bg-card text-[13px]" aria-label={t('reps_label')} />
                        <Input type="number" value={ex.rest_seconds} onChange={e => updateEx(ex.id, "rest_seconds", Number(e.target.value))} placeholder={t('rest_label')} className="h-9 bg-card text-[13px]" min={0} aria-label={t('rest_label')} />
                        <Button variant="outline" size="icon-sm" className="text-destructive" onClick={() => removeEx(ex.id)} aria-label={t("coach_athletes_add_exercise")}><Trash2 size={14} strokeWidth={2} /></Button>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Select value={ex.video_type || "youtube"} onValueChange={v => updateEx(ex.id, "video_type", v)}>
                          <SelectTrigger size="sm" className="w-[120px] shrink-0 bg-card text-[11px]" aria-label="Video type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="youtube">▶ YouTube</SelectItem>
                            <SelectItem value="upload">📁 {t("upload") || "Upload"}</SelectItem>
                          </SelectContent>
                        </Select>
                        {(ex.video_type || "youtube") === "youtube" ? (
                          <Input value={ex.video_url || ""} onChange={e => updateEx(ex.id, "video_url", e.target.value)} placeholder={t("youtube_url_placeholder") || "https://youtube.com/watch?v=..."} className="h-9 flex-1 bg-card text-[12px]" aria-label="YouTube URL" />
                        ) : (
                          <div className="flex-1">
                            <Input type="file" accept="video/*" className="h-9 bg-card text-[11px]" aria-label="Upload video" onChange={async e => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const fd = new FormData(); fd.append("file", file);
                              try {
                                const r = await api("/api/ads/creatives/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
                                const data = await r.json();
                                if (data.creative?.media_url) updateEx(ex.id, "video_url", data.creative.media_url);
                              } catch {}
                            }} />
                            <p className="mt-0.5 text-[10px] text-muted-foreground">MP4 or MOV — max 50 MB</p>
                          </div>
                        )}
                        {ex.video_url && <a href={ex.video_url} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap text-[11px] text-[var(--secondary)]">🔗 {t("preview") || "Preview"}</a>}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {tab === "nutrition" && (
              <Card className="gap-0 p-5 shadow-soft-sm">
                <div className="mb-3.5 flex items-center justify-between">
                  <p className="text-[15px] font-semibold">{t("nutrition_plan_label")}</p>
                  <Button size="sm" onClick={saveNutrition} disabled={saving}>
                    <Save size={14} strokeWidth={2} /> {saving ? t("saving") : t("save_plan")}
                  </Button>
                </div>
                <Input value={nutritionPlan.title} onChange={e => setNutritionPlan(p => ({ ...p, title: e.target.value }))} placeholder={t("coach_athletes_plan_title")} className="mb-3.5" aria-label={t("coach_athletes_plan_title")} />
                <div className="mb-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {[
                    { label: t('calories_nutrition'), field: "daily_calories" as const, unit: t('kcal_unit') },
                    { label: t('protein_label'), field: "protein_g" as const, unit: t('g_unit') },
                    { label: t('carbs_label'), field: "carbs_g" as const, unit: t('g_unit') },
                    { label: t('fat_label'), field: "fat_g" as const, unit: t('g_unit') },
                  ].map(m => (
                    <div key={m.field} className="rounded-md bg-muted px-3.5 py-3">
                      <p className="mb-1.5 text-[10px] tracking-wide text-muted-foreground uppercase">{m.label}</p>
                      <div className="flex items-baseline gap-1">
                        <input type="number" value={nutritionPlan[m.field]} onChange={e => setNutritionPlan(p => ({ ...p, [m.field]: Number(e.target.value) }))} className="w-16 bg-transparent text-[18px] font-bold tabular-nums outline-none" aria-label={m.label} />
                        <span className="text-[11px] text-muted-foreground">{m.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mb-3.5 flex items-center justify-between">
                  <p className="text-[13px] font-semibold">{t("coach_athletes_meals")} ({nutritionPlan.meals.length})</p>
                  <Button size="sm" variant="outline" onClick={addMeal}><Plus size={14} strokeWidth={2} /> {t("coach_athletes_add_meal")}</Button>
                </div>
                {nutritionPlan.meals.length === 0 && <p className="py-6 text-center text-[13px] text-muted-foreground">{t("coach_athletes_no_meals")}</p>}
                <div className="flex flex-col gap-3">
                  {nutritionPlan.meals.map(m => (
                    <div key={m.id} className="flex flex-col gap-2 rounded-md bg-muted p-3.5">
                      <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[2fr_1fr_100px_auto]">
                        <Input value={m.name} onChange={e => updateMeal(m.id, "name", e.target.value)} placeholder={t('meal_name')} className="h-9 bg-card text-[13px]" aria-label={t('meal_name')} />
                        <Input type="time" value={m.time} onChange={e => updateMeal(m.id, "time", e.target.value)} className="h-9 bg-card text-[13px]" aria-label={t("coach_requests_time")} />
                        <Input type="number" value={m.calories} onChange={e => updateMeal(m.id, "calories", Number(e.target.value))} placeholder={t('kcal_unit')} className="h-9 bg-card text-[13px]" min={0} aria-label={t('kcal_unit')} />
                        <Button variant="outline" size="icon-sm" className="text-destructive" onClick={() => removeMeal(m.id)} aria-label={t("coach_athletes_add_meal")}><Trash2 size={14} strokeWidth={2} /></Button>
                      </div>
                      <Input value={m.foods} onChange={e => updateMeal(m.id, "foods", e.target.value)} placeholder={t('foods_placeholder')} className="h-9 bg-card text-[13px]" aria-label={t('foods_placeholder')} />
                    </div>
                  ))}
                </div>
                <div className="mt-3.5 grid gap-2">
                  <Label htmlFor="np-notes">{t("coach_athletes_notes")}</Label>
                  <Textarea id="np-notes" value={nutritionPlan.notes} onChange={e => setNutritionPlan(p => ({ ...p, notes: e.target.value }))} placeholder={t("coach_athletes_notes_placeholder")} rows={3} className="resize-none" />
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * AthleteTrainingFeed
 * ─────────────────────────────────────────────────────────
 * Compact training-events feed shown on a coach's per-athlete overview.
 * Reads /api/tickets/training-events?user_id= and renders the latest
 * starts/finishes/plan-completes so the coach can follow up without
 * leaving the page.
 */
function AthleteTrainingFeed({ athleteId, token }: { athleteId: number; token: string | null }) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch(getApiBase() + `/api/tickets/training-events?user_id=${athleteId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : { events: [] })
      .then(d => setEvents(d.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [athleteId, token]);
  if (!token) return null;
  const labels: Record<string, { label: string; icon: any }> = {
    workout_started:  { label: "Started training",   icon: Dumbbell },
    workout_finished: { label: "Finished a workout", icon: CheckCircle2 },
    plan_finished:    { label: "Finished the plan",  icon: PartyPopper },
  };
  return (
    <Card className="gap-0 p-5 shadow-soft-sm">
      <p className="mb-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        Training activity
      </p>
      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9 rounded-md" />)}
        </div>
      ) : events.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">No training sessions logged yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {events.slice(0, 8).map((e: any) => {
            const meta = labels[e.event_type] || { label: e.event_type, icon: Zap };
            const MetaIcon = meta.icon;
            return (
              <li key={e.id} className="flex items-center gap-2.5 rounded-md bg-muted px-2.5 py-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-card text-muted-foreground">
                  <MetaIcon size={16} strokeWidth={2} />
                </span>
                <p className="flex-1 text-[12px] font-semibold">{meta.label}</p>
                <span className="shrink-0 text-[10px] text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
