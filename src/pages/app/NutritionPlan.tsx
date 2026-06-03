import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { useAuth } from "@/context/AuthContext";
import { getApiBase } from "@/lib/api";
import {
  Plus, ChevronDown, ChevronUp, Trash2, CheckCircle2,
  Circle, Utensils, Flame, RefreshCw, Droplets, UserCheck, User as UserIcon,
  Lock, Pencil, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Meal {
  id: number;
  name: string;
  amount: string;
  calories: number;
  protein: string;
  note?: string;
  eaten?: boolean;
}

interface NutritionDay {
  id: number;
  day: string;
  goal: string;
  meals: Meal[];
  expanded: boolean;
}

const GOAL_COLORS: Record<string, string> = {
  Bulk:    "#FB7185",
  Cut:     "#60A5FA",
  Maintain:"#4ADE80",
  Refeed:  "#FBBF24",
  Rest:    "#6B7280",
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const GOAL_OPTIONS = ["Bulk", "Cut", "Maintain", "Refeed", "Rest"];

const DEFAULT_PLAN: NutritionDay[] = [
  {
    id: 1, day: "Monday", goal: "Bulk", expanded: false,
    meals: [
      { id: 1, name: "Oats + Banana", amount: "1 bowl", calories: 420, protein: "12g" },
      { id: 2, name: "Chicken & Rice", amount: "300g / 150g", calories: 620, protein: "52g" },
      { id: 3, name: "Greek Yogurt", amount: "200g", calories: 180, protein: "20g" },
      { id: 4, name: "Salmon & Veggies", amount: "200g / 200g", calories: 540, protein: "44g" },
    ],
  },
  {
    id: 2, day: "Tuesday", goal: "Bulk", expanded: false,
    meals: [
      { id: 1, name: "Eggs & Toast", amount: "3 eggs / 2 slices", calories: 380, protein: "24g" },
      { id: 2, name: "Tuna Wrap", amount: "1 large", calories: 490, protein: "38g" },
      { id: 3, name: "Protein Shake", amount: "1 scoop", calories: 160, protein: "25g" },
      { id: 4, name: "Beef Stir Fry", amount: "250g / 120g rice", calories: 680, protein: "48g" },
    ],
  },
  {
    id: 3, day: "Wednesday", goal: "Rest", expanded: false,
    meals: [
      { id: 1, name: "Avocado Toast", amount: "2 slices", calories: 320, protein: "10g" },
      { id: 2, name: "Lentil Soup", amount: "2 bowls", calories: 380, protein: "22g" },
      { id: 3, name: "Mixed Nuts", amount: "40g", calories: 240, protein: "8g" },
    ],
  },
  {
    id: 4, day: "Thursday", goal: "Bulk", expanded: false,
    meals: [
      { id: 1, name: "Oats + Whey", amount: "1 bowl + 1 scoop", calories: 480, protein: "38g" },
      { id: 2, name: "Turkey & Sweet Potato", amount: "200g / 200g", calories: 580, protein: "46g" },
      { id: 3, name: "Cottage Cheese", amount: "200g", calories: 200, protein: "24g" },
      { id: 4, name: "Chicken Pasta", amount: "150g chicken / 120g pasta", calories: 720, protein: "55g" },
    ],
  },
  {
    id: 5, day: "Friday", goal: "Maintain", expanded: false,
    meals: [
      { id: 1, name: "Smoothie Bowl", amount: "1 large", calories: 360, protein: "18g" },
      { id: 2, name: "Grilled Chicken Salad", amount: "300g", calories: 420, protein: "40g" },
      { id: 3, name: "Hummus & Veggies", amount: "100g / 150g", calories: 220, protein: "8g" },
      { id: 4, name: "Salmon & Quinoa", amount: "200g / 100g", calories: 560, protein: "46g" },
    ],
  },
  {
    id: 6, day: "Saturday", goal: "Refeed", expanded: false,
    meals: [
      { id: 1, name: "Pancakes & Fruit", amount: "3 pancakes", calories: 520, protein: "14g" },
      { id: 2, name: "Burrito Bowl", amount: "1 large", calories: 720, protein: "42g" },
      { id: 3, name: "Rice Cakes", amount: "4 cakes", calories: 140, protein: "3g" },
      { id: 4, name: "White Rice & Chicken", amount: "200g / 200g", calories: 680, protein: "50g" },
    ],
  },
  {
    id: 7, day: "Sunday", goal: "Rest", expanded: false,
    meals: [
      { id: 1, name: "Overnight Oats", amount: "1 jar", calories: 380, protein: "16g" },
      { id: 2, name: "Veggie Omelette", amount: "3 eggs", calories: 320, protein: "22g" },
      { id: 3, name: "Fruit & Nuts", amount: "1 serving", calories: 260, protein: "6g" },
    ],
  },
];

export default function NutritionPlan() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"self" | "coach">("self");
  const [plan, setPlan] = useState<NutritionDay[]>(DEFAULT_PLAN);
  const [coachPlanData, setCoachPlanData] = useState<NutritionDay[] | null>(null);
  const [coachName, setCoachName] = useState<string>("");
  const [hasSubscription, setHasSubscription] = useState(false);
  const [hasMyPlan, setHasMyPlan] = useState(false);
  const [editingMyPlan, setEditingMyPlan] = useState(false);
  const [addingMeal, setAddingMeal] = useState<number | null>(null);
  const [newMeal, setNewMeal] = useState({ name: "", amount: "", calories: "", protein: "" });
  const [flash, setFlash] = useState("");

  useEffect(() => {
    setHasMyPlan(JSON.stringify(plan) !== JSON.stringify(DEFAULT_PLAN));
  }, [plan]);

  // Coach plan + subscription status load in parallel; the self plan is no
  // longer auto-replaced by the coach plan — the user picks a tab.
  useEffect(() => {
    if (!token) return;
    fetch(`${getApiBase()}/api/payments/my-subscriptions`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : { subscriptions: [] })
      .then(d => setHasSubscription((d?.subscriptions || []).length > 0))
      .catch(() => setHasSubscription(false));

    fetch(`${getApiBase()}/api/plans/coach-nutrition-plan`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.plan?.meals) {
          try {
            const meals = typeof d.plan.meals === "string" ? JSON.parse(d.plan.meals) : d.plan.meals;
            if (Array.isArray(meals) && meals.length > 0) {
              const dayMap = new Map<string, Meal[]>();
              meals.forEach((m: any, idx: number) => {
                const day = m.day || DAYS[idx % 7];
                if (!dayMap.has(day)) dayMap.set(day, []);
                dayMap.get(day)!.push({ id: idx + 1, name: m.name || m.meal_name, amount: m.amount || "1 serving", calories: m.calories || 0, protein: m.protein || "0g" });
              });
              const coachPlan: NutritionDay[] = DAYS.map((day, i) => ({
                id: i + 1, day, goal: dayMap.has(day) ? "Maintain" : "Rest",
                meals: dayMap.get(day) || [], expanded: false,
              }));
              setCoachPlanData(coachPlan);
              setCoachName(d.plan.coach_name || "Your Coach");
            }
          } catch { /* leave coachPlanData null */ }
        }
      }).catch(() => {});
  }, [token]);
  useAutoRefresh(() => {
    if (!token) return;
    fetch(`${getApiBase()}/api/plans/coach-nutrition-plan`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null).then(d => {
        if (d?.plan?.meals) {
          try {
            const meals = typeof d.plan.meals === "string" ? JSON.parse(d.plan.meals) : d.plan.meals;
            if (Array.isArray(meals) && meals.length > 0) {
              const dayMap = new Map<string, Meal[]>();
              meals.forEach((m: any, idx: number) => { const day = m.day || DAYS[idx % 7]; if (!dayMap.has(day)) dayMap.set(day, []); dayMap.get(day)!.push({ id: idx + 1, name: m.name || m.meal_name, amount: m.amount || "1 serving", calories: m.calories || 0, protein: m.protein || "0g" }); });
              setCoachPlanData(DAYS.map((day, i) => ({ id: i + 1, day, goal: dayMap.has(day) ? "Maintain" : "Rest", meals: dayMap.get(day) || [], expanded: false })));
            }
          } catch {}
        }
      }).catch(() => {});
  });

  const todayIndex = new Date().getDay();
  const todayDayName = DAYS[(todayIndex + 6) % 7];

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(""), 2000);
  };

  const toggleDay = (id: number) => {
    setPlan(p => p.map(d => d.id === id ? { ...d, expanded: !d.expanded } : d));
  };

  const toggleMeal = (dayId: number, mealId: number) => {
    setPlan(p => p.map(d => d.id === dayId
      ? { ...d, meals: d.meals.map(m => m.id === mealId ? { ...m, eaten: !m.eaten } : m) }
      : d
    ));
  };

  const changeGoal = (dayId: number, goal: string) => {
    setPlan(p => p.map(d => d.id === dayId ? { ...d, goal } : d));
  };

  const addMeal = (dayId: number) => {
    if (!newMeal.name.trim()) return;
    setPlan(p => p.map(d => d.id === dayId ? {
      ...d,
      meals: [...d.meals, {
        id: Date.now(),
        name: newMeal.name.trim(),
        amount: newMeal.amount || "1 serving",
        calories: parseInt(newMeal.calories) || 0,
        protein: newMeal.protein || "0g",
      }],
    } : d));
    setNewMeal({ name: "", amount: "", calories: "", protein: "" });
    setAddingMeal(null);
    showFlash("✅ Meal added");
  };

  const removeMeal = (dayId: number, mealId: number) => {
    setPlan(p => p.map(d => d.id === dayId
      ? { ...d, meals: d.meals.filter(m => m.id !== mealId) }
      : d
    ));
  };

  const resetDay = (dayId: number) => {
    setPlan(p => p.map(d => d.id === dayId
      ? { ...d, meals: d.meals.map(m => ({ ...m, eaten: false })) }
      : d
    ));
    showFlash("🔄 Day reset");
  };

  // Plan currently rendered — My Plan is editable, Coach Plan is read-only.
  const displayedPlan = tab === "coach" && coachPlanData ? coachPlanData : plan;
  const totalMeals = displayedPlan.reduce((s, d) => s + d.meals.length, 0);
  const eatenMeals = displayedPlan.reduce((s, d) => s + d.meals.filter(m => m.eaten).length, 0);
  const totalCalories = displayedPlan.reduce((s, d) => s + d.meals.reduce((ms, m) => ms + m.calories, 0), 0);

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
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">Nutrition Plan</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {tab === "coach"
              ? (hasSubscription && coachPlanData
                  ? `Assigned by ${coachName}`
                  : "Subscribe to a coach to receive a personalised plan")
              : "Your weekly meal schedule"}
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
            { icon: Utensils,    label: "Total Meals",  value: totalMeals,                            color: "var(--main)" },
            { icon: CheckCircle2,label: "Eaten",        value: `${eatenMeals}/${totalMeals}`,         color: "var(--green)" },
            { icon: Flame,       label: "Weekly kcal",  value: `${(totalCalories/1000).toFixed(1)}k`, color: "#FB7185" },
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

        {/* Grams-to-calories quick estimator */}
        <GramsCalorieCalc />

        {/* Coach tab: locked card when no active subscription */}
        {tab === "coach" && !hasSubscription && (
          <Card className="items-center p-7 text-center shadow-soft-sm">
            <span className="mb-3.5 grid size-14 place-items-center rounded-lg bg-[var(--secondary-dim)]">
              <Lock size={22} strokeWidth={2} className="text-[var(--secondary)]" />
            </span>
            <p className="text-[15px] font-semibold">Subscribe to a coach to unlock</p>
            <p className="mt-1.5 max-w-[340px] text-[13px] leading-relaxed text-muted-foreground">
              Once you subscribe, your coach can publish a custom nutrition plan that appears here.
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
              Your coach will push a nutrition plan here as soon as it's ready.
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
            const color = GOAL_COLORS[day.goal] || "var(--main)";
            const isToday = day.day === todayDayName;
            const eatenCount = day.meals.filter(m => m.eaten).length;
            const total = day.meals.length;
            const allEaten = total > 0 && eatenCount === total;
            const dayCalories = day.meals.reduce((s, m) => s + m.calories, 0);
            const pct = total > 0 ? Math.round((eatenCount / total) * 100) : 0;

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
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-md"
                    style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }}
                  >
                    {allEaten
                      ? <Droplets size={16} strokeWidth={2} style={{ color }} />
                      : <Utensils size={16} strokeWidth={2} style={{ color }} />
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
                      >{day.goal}</span>
                      {total > 0 && (
                        <span className="text-[11px] text-muted-foreground">
                          {dayCalories} kcal · {eatenCount}/{total} eaten
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

                    {/* Goal selector — only when editing my own plan */}
                    {tab === "self" && editingMyPlan && (
                    <div className="mb-3.5 flex flex-wrap gap-1.5">
                      {GOAL_OPTIONS.map(g => {
                        const active = day.goal === g;
                        const gColor = GOAL_COLORS[g] || "var(--main)";
                        return (
                          <button
                            key={g}
                            onClick={() => changeGoal(day.id, g)}
                            className={cn(
                              "rounded-full px-2.5 py-1 text-[11px] font-semibold transition",
                              !active && "bg-muted text-muted-foreground",
                            )}
                            style={active ? { background: gColor, color: "#fff" } : undefined}
                          >
                            {g}
                          </button>
                        );
                      })}
                    </div>
                    )}

                    {/* Meals */}
                    {day.meals.length === 0 ? (
                      <div className="py-4 text-center text-[13px] text-muted-foreground">
                        No meals yet. Add one below.
                      </div>
                    ) : (
                      <div className="mb-3 flex flex-col gap-1.5">
                        {day.meals.map((meal, idx) => (
                          <div
                            key={meal.id}
                            className="flex items-center gap-2.5 rounded-md p-3 transition"
                            style={{
                              background: meal.eaten
                                ? `color-mix(in srgb, ${color} 10%, transparent)`
                                : "var(--color-muted)",
                            }}
                          >
                            <button
                              onClick={() => toggleMeal(day.id, meal.id)}
                              className="shrink-0 transition active:scale-90"
                              aria-label={meal.eaten ? "Mark meal not eaten" : "Mark meal eaten"}
                              aria-pressed={!!meal.eaten}
                            >
                              {meal.eaten
                                ? <CheckCircle2 size={20} strokeWidth={2} style={{ color }} />
                                : <Circle size={20} strokeWidth={1.8} className="text-muted-foreground" />
                              }
                            </button>

                            <div className="min-w-0 flex-1">
                              <div
                                className={cn(
                                  "text-[13px] font-semibold",
                                  meal.eaten ? "text-muted-foreground line-through" : "text-foreground",
                                )}
                              >
                                {idx + 1}. {meal.name}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] text-muted-foreground">{meal.amount}</span>
                                <Badge variant="destructive" className="px-2 py-0 text-[10px]">{meal.calories} kcal</Badge>
                                <Badge variant="accent" className="px-2 py-0 text-[10px]">{meal.protein} protein</Badge>
                              </div>
                            </div>

                            {tab === "self" && editingMyPlan && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => removeMeal(day.id, meal.id)}
                                className="shrink-0 text-muted-foreground"
                                aria-label="Remove meal"
                              >
                                <Trash2 size={15} />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add meal form */}
                    {tab === "self" && editingMyPlan && addingMeal === day.id ? (
                      <Card className="mb-2.5 gap-0 bg-muted p-3 shadow-none">
                        <Input
                          placeholder="Meal name (e.g. Chicken & Rice)"
                          value={newMeal.name}
                          onChange={e => setNewMeal(v => ({ ...v, name: e.target.value }))}
                          className="mb-2 bg-card"
                          autoFocus
                          onKeyDown={e => e.key === "Enter" && addMeal(day.id)}
                        />
                        <div className="mb-2.5 grid grid-cols-3 gap-2">
                          {[
                            { key: "amount",   label: "Amount",  placeholder: "200g" },
                            { key: "calories", label: "kcal",    placeholder: "500" },
                            { key: "protein",  label: "Protein", placeholder: "40g" },
                          ].map(({ key, label, placeholder }) => (
                            <div key={key}>
                              <Label className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {label}
                              </Label>
                              <Input
                                placeholder={placeholder}
                                value={(newMeal as any)[key]}
                                onChange={e => setNewMeal(v => ({ ...v, [key]: e.target.value }))}
                                className="h-10 bg-card text-[13px]"
                              />
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={() => addMeal(day.id)} className="flex-1">Add</Button>
                          <Button variant="outline" onClick={() => setAddingMeal(null)} className="flex-1">Cancel</Button>
                        </div>
                      </Card>
                    ) : null}

                    {/* Actions row — Add Meal only while editing My Plan */}
                    <div className="flex gap-2">
                      {tab === "self" && editingMyPlan && addingMeal !== day.id && (
                        <Button
                          variant="outline"
                          onClick={() => setAddingMeal(day.id)}
                          className="flex-1 border-dashed text-muted-foreground"
                        >
                          <Plus size={15} /> Add Meal
                        </Button>
                      )}
                      {day.meals.length > 0 && (
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
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   GramsCalorieCalc
   Lightweight grams → kcal estimator that lives next to the nutrition plan.
   Picks one of a few common foods (or "Custom" with kcal-per-100g), takes a
   grams input, and shows kcal + protein/carbs/fat. No backend — this is just
   a planning aid, so the foods table is local. Admin can extend this in CMS
   later if needed.
   ────────────────────────────────────────────────────────────────────────── */
const FOOD_TABLE: { id: string; name: string; kcal: number; p: number; c: number; f: number }[] = [
  { id: "chicken",  name: "Chicken Breast (cooked)", kcal: 165, p: 31, c: 0,  f: 3.6 },
  { id: "rice",     name: "Rice (cooked)",           kcal: 130, p: 2.7, c: 28, f: 0.3 },
  { id: "oats",     name: "Oats (raw)",              kcal: 389, p: 17, c: 66, f: 7   },
  { id: "egg",      name: "Egg (whole)",             kcal: 155, p: 13, c: 1.1, f: 11 },
  { id: "salmon",   name: "Salmon (cooked)",         kcal: 208, p: 20, c: 0,  f: 13  },
  { id: "yogurt",   name: "Greek Yogurt (plain)",    kcal: 59,  p: 10, c: 3.6, f: 0.4 },
  { id: "banana",   name: "Banana",                  kcal: 89,  p: 1.1, c: 23, f: 0.3 },
  { id: "almonds",  name: "Almonds",                 kcal: 579, p: 21, c: 22, f: 50  },
  { id: "beef",     name: "Beef (lean, cooked)",     kcal: 250, p: 26, c: 0,  f: 15  },
  { id: "custom",   name: "Custom (enter kcal/100g)", kcal: 0,  p: 0,  c: 0,  f: 0   },
];
function GramsCalorieCalc() {
  const [foodId, setFoodId] = useState("chicken");
  const [grams, setGrams] = useState("100");
  const [customKcal, setCustomKcal] = useState("");
  const food = FOOD_TABLE.find(f => f.id === foodId) || FOOD_TABLE[0];
  const g = Math.max(0, Number(grams) || 0);
  const per100 = food.id === "custom" ? Math.max(0, Number(customKcal) || 0) : food.kcal;
  const kcal = Math.round((per100 * g) / 100);
  const ratio = g / 100;
  const prot = (food.p * ratio).toFixed(1);
  const carb = (food.c * ratio).toFixed(1);
  const fat  = (food.f * ratio).toFixed(1);
  return (
    <Card className="gap-0 p-4 shadow-soft-sm">
      <p className="mb-2.5 flex items-center gap-1.5 text-[13px] font-semibold">
        <Flame size={15} strokeWidth={2} className="text-[#FB7185]" /> Calorie calculator (by grams)
      </p>
      <div className="mb-2 grid grid-cols-[2fr_1fr] gap-2">
        <Select value={foodId} onValueChange={setFoodId}>
          <SelectTrigger className="w-full text-[13px]" aria-label="Food">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FOOD_TABLE.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          type="number"
          min="0"
          value={grams}
          onChange={e => setGrams(e.target.value)}
          placeholder="grams"
          aria-label="Grams"
          className="text-[13px]"
        />
      </div>
      {food.id === "custom" && (
        <Input
          type="number"
          min="0"
          value={customKcal}
          onChange={e => setCustomKcal(e.target.value)}
          placeholder="kcal per 100g (from label)"
          aria-label="kcal per 100g"
          className="mb-2 text-[13px]"
        />
      )}
      <div className="mt-1 grid grid-cols-4 gap-1.5">
        {[
          { label: "kcal", val: kcal,  c: "#FB7185" },
          { label: "P (g)", val: prot, c: "var(--secondary)" },
          { label: "C (g)", val: carb, c: "var(--green)" },
          { label: "F (g)", val: fat,  c: "var(--amber)" },
        ].map(({ label, val, c }) => (
          <div
            key={label}
            className="rounded-md p-2 text-center"
            style={{ background: `color-mix(in srgb, ${c} 12%, transparent)` }}
          >
            <div className="text-[15px] font-bold tabular-nums" style={{ color: c }}>{val}</div>
            <div className="text-[10px] text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
