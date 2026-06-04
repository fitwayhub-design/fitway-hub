/**
 * Pricing — three athlete subscription packages.
 *
 *   Freemium   → no coach, basics only
 *   Premium    → coach-led with monthly progress reviews
 *   Exclusive  → coach-led with weekly reviews + in-person extras
 *
 * Prices come from admin app_settings (sub_community_*_egp). Defaults below
 * are placeholders until the client populates the real numbers.
 */
import { useState, useEffect } from "react";
import { Check, ArrowLeft, Minus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useNavigate } from "react-router-dom";
import { getApiBase } from "@/lib/api";
import PaymentForm from "@/components/app/PaymentForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Step = "plans" | "payment";

interface TierDef {
  id: string;
  name: string;
  blurb: string;
  badge?: string;
  features: { label: string; v: string | boolean }[];
}

const TIERS: TierDef[] = [
  {
    id: "freemium",
    name: "Freemium",
    blurb: "Start free — for athletes without a coach.",
    features: [
      { label: "Calorie Calculator", v: true },
      { label: "General Programs (Pro split / PPL / Upper & Lower)", v: true },
      { label: "Customized workout program", v: false },
      { label: "Customized Nutrition Plans", v: false },
      { label: "Courses", v: false },
      { label: "Live support", v: false },
      { label: "Access to Community", v: false },
      { label: "Coach tickets", v: false },
      { label: "Training follow-up", v: false },
      { label: "Nutrition Facts for Food", v: false },
      { label: "Hybrid / Training in person", v: false },
      { label: "Fitness Assessment", v: false },
    ],
  },
  {
    id: "premium",
    name: "Premium",
    blurb: "Coach-led plan with monthly progress reviews.",
    badge: "Most popular",
    features: [
      { label: "Calorie Calculator", v: true },
      { label: "Customized workout program", v: true },
      { label: "Customized Nutrition Plans", v: true },
      { label: "Courses", v: true },
      { label: "Live support", v: true },
      { label: "Access to Community", v: true },
      { label: "Coach tickets", v: "10 / month" },
      { label: "Training follow-up", v: "Monthly report" },
      { label: "Nutrition Facts for Food", v: false },
      { label: "Hybrid / Training in person", v: false },
      { label: "Fitness Assessment", v: false },
    ],
  },
  {
    id: "exclusive",
    name: "Exclusive",
    blurb: "Full coaching access with weekly reviews and in-person sessions.",
    features: [
      { label: "Calorie Calculator", v: true },
      { label: "Customized workout program", v: true },
      { label: "Customized Nutrition Plans", v: true },
      { label: "Courses", v: true },
      { label: "Live support", v: true },
      { label: "Access to Community", v: true },
      { label: "Coach tickets", v: "Unlimited" },
      { label: "Training follow-up", v: "Weekly report" },
      { label: "Nutrition Facts for Food", v: true },
      { label: "Hybrid / Training in person", v: true },
      { label: "Fitness Assessment", v: true },
    ],
  },
];

const DEFAULT_PRICES: Record<string, number> = {
  community_freemium: 0,
  community_premium:  149,
  community_exclusive:299,
};

export default function Pricing() {
  const { user, updateUser, token } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 860);
  useEffect(() => { const h = () => setIsMobile(window.innerWidth < 860); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);

  const [step, setStep] = useState<Step>("plans");
  const [selectedTier, setSelectedTier] = useState<TierDef | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [prices, setPrices] = useState<Record<string, number>>(DEFAULT_PRICES);

  // Admin-tunable prices. Falls back to DEFAULT_PRICES when settings aren't
  // populated yet — the client will replace these with real numbers from
  // their business plan via the admin Settings page.
  useEffect(() => {
    fetch(`${getApiBase()}/api/admin/app-settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : { settings: [] })
      .then(d => {
        const map: Record<string, number> = { ...DEFAULT_PRICES };
        for (const s of (d.settings || [])) {
          if (s.setting_key?.startsWith("sub_")) {
            const key = s.setting_key.replace(/^sub_/, "").replace(/_egp$/, "");
            const n = Number(s.setting_value);
            if (!Number.isNaN(n)) map[key] = n;
          }
        }
        setPrices(map);
      })
      .catch(() => {});
  }, [token]);

  const priceFor = (tier: TierDef) => {
    const monthly = prices[`community_${tier.id}`] ?? 0;
    return billingCycle === "annual" ? monthly * 10 : monthly; // 2 months free on annual
  };

  const handleSuccess = () => {
    updateUser({ isPremium: true });
    navigate("/app/dashboard");
  };

  if (step === "payment" && selectedTier) {
    const amount = priceFor(selectedTier);
    return (
      <div className="mx-auto w-full max-w-[500px] px-4 pt-6 pb-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStep("plans")}
          className="-ms-2 mb-6 text-muted-foreground"
        >
          <ArrowLeft size={15} /> Back to plans
        </Button>

        <Card className="gap-0 p-0 ring-2 ring-primary shadow-soft-md">
          <CardContent className="px-6 py-7">
            <h2 className="text-xl font-bold tracking-tight">{selectedTier.name}</h2>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              {billingCycle === "annual" ? `${amount} EGP / year (2 months free)` : `${amount} EGP / month`}
            </p>

            <div className="mt-5 mb-6 flex gap-1 rounded-md bg-muted p-1">
              {(["monthly", "annual"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setBillingCycle(c)}
                  aria-pressed={billingCycle === c}
                  className={`flex-1 rounded-[8px] py-2 text-[12px] font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                    billingCycle === c
                      ? "bg-card text-foreground shadow-soft-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c === "monthly" ? "Monthly" : "Annual · save 2 months"}
                </button>
              ))}
            </div>

            <div className="mb-5 flex items-center justify-between rounded-md bg-muted px-4 py-3">
              <span className="text-[13px] text-muted-foreground">{billingCycle === "annual" ? "Annual total" : "Monthly charge"}</span>
              <span className="text-lg font-bold tabular-nums text-primary">{amount} EGP</span>
            </div>

            <PaymentForm
              amount={amount}
              plan={billingCycle}
              type="user"
              token={token}
              onSuccess={handleSuccess}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 pt-6 pb-12">
      <div className="mb-8 text-center">
        <h1 className="text-[clamp(22px,4vw,34px)] font-bold tracking-tight">{t("unlock_potential") || "Pick your subscription"}</h1>
        <p className="mx-auto mt-2 max-w-[540px] text-[14px] text-muted-foreground">
          Pick a plan that matches how you want to train. Freemium is for athletes
          without a coach; Premium and Exclusive add a personal coach with custom plans.
        </p>
      </div>

      {/* Tier cards */}
      <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-3"}`}>
        {TIERS.map(tier => {
          const monthly = priceFor(tier);
          const highlighted = tier.badge === "Most popular";
          return (
            <Card
              key={tier.id}
              className={`relative gap-0 p-0 ${highlighted ? "ring-2 ring-primary shadow-soft-md" : "shadow-soft-sm"}`}
            >
              {tier.badge && (
                <Badge className="absolute -top-2.5 end-4 px-2.5 py-1 text-[10px] tracking-wider uppercase">
                  {tier.badge}
                </Badge>
              )}
              <CardContent className="flex flex-1 flex-col px-6 py-7">
                <h3 className="text-lg font-bold tracking-tight">{tier.name}</h3>
                <p className="mt-1.5 mb-4 min-h-9 text-[13px] text-muted-foreground">{tier.blurb}</p>
                <div className="mb-5">
                  <span className={`text-[36px] font-bold tabular-nums tracking-tight ${highlighted ? "text-primary" : "text-foreground"}`}>{monthly}</span>
                  <span className="text-[13px] text-muted-foreground"> EGP/month</span>
                </div>
                <ul className="mb-6 flex flex-1 flex-col gap-2.5">
                  {tier.features.map(f => {
                    const has = f.v !== false;
                    const valueStr = typeof f.v === "string" ? f.v : null;
                    return (
                      <li key={f.label} className={`flex items-start gap-2.5 text-[13px] ${has ? "text-foreground" : "text-muted-foreground"}`}>
                        <span className={`mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full ${has ? "bg-primary/15" : "bg-muted"}`}>
                          {has ? <Check size={11} className="text-primary" strokeWidth={2.5} /> : <Minus size={10} className="text-muted-foreground" />}
                        </span>
                        <span>
                          {f.label}
                          {valueStr && <span className="ms-1.5 text-[11px] text-muted-foreground">· {valueStr}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <Button
                  variant={highlighted ? "default" : "outline"}
                  className="w-full"
                  onClick={() => {
                    if (tier.id === "freemium" || monthly === 0) {
                      updateUser({ isPremium: false });
                      navigate("/app/dashboard");
                    } else {
                      setSelectedTier(tier);
                      setStep("payment");
                    }
                  }}
                  disabled={user?.isPremium && tier.id === "freemium"}
                >
                  {tier.id === "freemium" || monthly === 0 ? "Continue free" : "Choose " + tier.name}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="mt-8 text-center text-[12px] text-muted-foreground">
        Plan pricing is set by Fitway Hub admins. Talk to your coach for any
        custom or hybrid arrangements not listed here.
      </p>
    </div>
  );
}
