import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { useAuth } from "@/context/AuthContext";
import { getApiBase } from "@/lib/api";
import {
  Plus, ChevronDown, ChevronUp, Trash2, CheckCircle2,
  Circle, Utensils, Flame, RefreshCw, Droplets, UserCheck, User as UserIcon,
  Lock, Pencil,
} from "lucide-react";

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
          Nutrition Plan
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          {tab === "coach"
            ? (hasSubscription && coachPlanData
                ? `Assigned by ${coachName}`
                : "Subscribe to a coach to receive a personalised plan")
            : "Your weekly meal schedule"}
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
          { icon: Utensils,    label: "Total Meals",  value: totalMeals,                      color: "var(--main)" },
          { icon: CheckCircle2,label: "Eaten",        value: `${eatenMeals}/${totalMeals}`,   color: "#4ADE80" },
          { icon: Flame,       label: "Weekly kcal",  value: `${(totalCalories/1000).toFixed(1)}k`, color: "#FB7185" },
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
            Once you subscribe, your coach can publish a custom nutrition plan that appears here.
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
            Your coach will push a nutrition plan here as soon as it's ready.
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
          const color = GOAL_COLORS[day.goal] || "var(--main)";
          const isToday = day.day === todayDayName;
          const eatenCount = day.meals.filter(m => m.eaten).length;
          const total = day.meals.length;
          const allEaten = total > 0 && eatenCount === total;
          const dayCalories = day.meals.reduce((s, m) => s + m.calories, 0);

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
                <div style={{
                  width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                  background: `${color}22`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {allEaten
                    ? <Droplets size={16} color={color} strokeWidth={2} />
                    : <Utensils size={16} color={color} strokeWidth={2} />
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
                    }}>{day.goal}</span>
                    {total > 0 && (
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {dayCalories} kcal · {eatenCount}/{total} eaten
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress ring */}
                {total > 0 && (
                  <div style={{ width: 32, height: 32, position: "relative", flexShrink: 0 }}>
                    <svg width="32" height="32" viewBox="0 0 32 32">
                      <circle cx="16" cy="16" r="13" fill="none" stroke="var(--border)" strokeWidth="3" />
                      <circle
                        cx="16" cy="16" r="13" fill="none"
                        stroke={color} strokeWidth="3"
                        strokeDasharray={`${2 * Math.PI * 13}`}
                        strokeDashoffset={`${2 * Math.PI * 13 * (1 - eatenCount / total)}`}
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

                  {/* Goal selector — only when editing my own plan */}
                  {tab === "self" && editingMyPlan && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                    {GOAL_OPTIONS.map(g => (
                      <button
                        key={g}
                        onClick={() => changeGoal(day.id, g)}
                        style={{
                          padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                          border: "none", cursor: "pointer",
                          background: day.goal === g ? (GOAL_COLORS[g] || "var(--main)") : "var(--bg-surface)",
                          color: day.goal === g ? "#fff" : "var(--text-secondary)",
                          transition: "all 0.15s",
                        }}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                  )}

                  {/* Meals */}
                  {day.meals.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "16px 0", color: "var(--text-muted)", fontSize: 13 }}>
                      No meals yet. Add one below.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                      {day.meals.map((meal, idx) => (
                        <div
                          key={meal.id}
                          style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "10px 12px", borderRadius: 12,
                            background: meal.eaten ? `${color}12` : "var(--bg-surface)",
                            border: `1px solid ${meal.eaten ? color + "44" : "var(--border)"}`,
                            transition: "all 0.2s",
                          }}
                        >
                          <button
                            onClick={() => toggleMeal(day.id, meal.id)}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}
                          >
                            {meal.eaten
                              ? <CheckCircle2 size={20} color={color} strokeWidth={2} />
                              : <Circle size={20} color="var(--text-muted)" strokeWidth={1.8} />
                            }
                          </button>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 13, fontWeight: 600,
                              color: meal.eaten ? "var(--text-muted)" : "var(--text-primary)",
                              textDecoration: meal.eaten ? "line-through" : "none",
                            }}>
                              {idx + 1}. {meal.name}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                              {meal.amount} · {meal.calories} kcal · {meal.protein} protein
                            </div>
                          </div>

                          {tab === "self" && editingMyPlan && (
                            <button
                              onClick={() => removeMeal(day.id, meal.id)}
                              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-muted)", flexShrink: 0 }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add meal form */}
                  {tab === "self" && editingMyPlan && addingMeal === day.id ? (
                    <div style={{ background: "var(--bg-surface)", borderRadius: 12, padding: 12, border: "1px solid var(--border)", marginBottom: 10 }}>
                      <input
                        className="input-base"
                        placeholder="Meal name (e.g. Chicken & Rice)"
                        value={newMeal.name}
                        onChange={e => setNewMeal(v => ({ ...v, name: e.target.value }))}
                        style={{ marginBottom: 8, fontSize: 13 }}
                        autoFocus
                        onKeyDown={e => e.key === "Enter" && addMeal(day.id)}
                      />
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                        {[
                          { key: "amount",   label: "Amount",  placeholder: "200g" },
                          { key: "calories", label: "kcal",    placeholder: "500" },
                          { key: "protein",  label: "Protein", placeholder: "40g" },
                        ].map(({ key, label, placeholder }) => (
                          <div key={key}>
                            <label style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                              {label}
                            </label>
                            <input
                              className="input-base"
                              placeholder={placeholder}
                              value={(newMeal as any)[key]}
                              onChange={e => setNewMeal(v => ({ ...v, [key]: e.target.value }))}
                              style={{ fontSize: 13, padding: "8px 10px" }}
                            />
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => addMeal(day.id)}
                          style={{
                            flex: 1, padding: "9px", borderRadius: 10, border: "none",
                            background: "var(--main)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
                          }}
                        >
                          Add
                        </button>
                        <button
                          onClick={() => setAddingMeal(null)}
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

                  {/* Actions row — Add Meal only while editing My Plan */}
                  <div style={{ display: "flex", gap: 8 }}>
                    {tab === "self" && editingMyPlan && addingMeal !== day.id && (
                      <button
                        onClick={() => setAddingMeal(day.id)}
                        style={{
                          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                          padding: "9px", borderRadius: 10, border: "1px dashed var(--border)",
                          background: "transparent", color: "var(--text-secondary)",
                          fontWeight: 600, fontSize: 12, cursor: "pointer",
                        }}
                      >
                        <Plus size={14} /> Add Meal
                      </button>
                    )}
                    {day.meals.length > 0 && (
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
