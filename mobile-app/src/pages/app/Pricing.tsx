/**
 * App Subscription Plans — what an athlete pays to unlock the app's features.
 *
 *   Freemium       → free forever, core self-service tools only
 *   Premium App    → everything (community, general programs, courses,
 *                     live support, assessments, challenges …)
 *
 * Premium billing comes in three cycles: 1 month, 3 months and annual.
 * Prices default to the business plan below and can be overridden by admins
 * via app_settings (sub_app_1month_egp / sub_app_3months_egp / sub_app_annual_egp).
 *
 * NOTE: This is separate from the PT (coach) plans an athlete picks when they
 * subscribe to a specific coach — those live in the Coaching flow.
 */
import { useState, useEffect } from "react";
import { Check, X, Sparkles, Crown } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useNavigate } from "react-router-dom";
import { getApiBase } from "@/lib/api";
import PaymentForm from "@/components/app/PaymentForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Cycle = "1month" | "3months" | "annual";

const DEFAULT_PREMIUM_PRICES: Record<Cycle, number> = {
  "1month": 199,
  "3months": 499,
  annual: 699,
};

const BILLING: { id: Cycle; label: string; planLabel: string }[] = [
  { id: "1month", label: "1 Month", planLabel: "monthly" },
  { id: "3months", label: "3 Months", planLabel: "quarterly" },
  { id: "annual", label: "Annual", planLabel: "annual" },
];

// Freemium — included core tools + what stays locked.
const FREEMIUM_INCLUDED = [
  "Calorie Calculator",
  "Steps Calculator",
  "Hydration Reminder",
  "Create Your Own Program",
  "Create Your Own Meals",
  "Workout Library",
];
const FREEMIUM_EXCLUDED = [
  "Community Posting",
  "General Programs (Pro Split, PPL, Push/Pull/Legs, Upper/Lower)",
  "Courses",
  "Live Support / Emergency Support",
  "Assessment / Consultation",
  "Challenge Participation",
];

// Premium App — everything unlocked.
const PREMIUM_INCLUDED = [
  "Calorie Calculator",
  "Steps Calculator",
  "Hydration Reminder",
  "Community Posting",
  "General Programs (Pro Split, PPL, Push/Pull/Legs, Upper/Lower)",
  "Create Your Own Program",
  "Create Your Own Meals",
  "Courses",
  "Workout Library",
  "Live Support / Emergency Support",
  "Assessment / Consultation",
  "Challenge Participation",
];

export default function Pricing() {
  const { user, updateUser, token } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [cycle, setCycle] = useState<Cycle>("3months");
  const [prices, setPrices] = useState<Record<Cycle, number>>(DEFAULT_PREMIUM_PRICES);

  // Admin-tunable Premium prices (optional overrides).
  useEffect(() => {
    fetch(`${getApiBase()}/api/admin/app-settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : { settings: [] })
      .then(d => {
        const map: Record<Cycle, number> = { ...DEFAULT_PREMIUM_PRICES };
        for (const s of (d.settings || [])) {
          const key = s.setting_key as string | undefined;
          if (!key) continue;
          const n = Number(s.setting_value);
          if (Number.isNaN(n)) continue;
          if (key === "sub_app_1month_egp") map["1month"] = n;
          if (key === "sub_app_3months_egp") map["3months"] = n;
          if (key === "sub_app_annual_egp") map["annual"] = n;
        }
        setPrices(map);
      })
      .catch(() => {});
  }, [token]);

  const amount = prices[cycle];
  const billing = BILLING.find(b => b.id === cycle)!;

  const handleSuccess = () => {
    updateUser({ isPremium: true });
    navigate("/app/dashboard");
  };

  // ── Plans step ──
  return (
    <div className="mx-auto w-full max-w-[960px] px-4 pt-6 pb-12">
      <div className="mb-8 text-center">
        <h1 className="text-[clamp(22px,4vw,34px)] font-bold tracking-tight">{t("unlock_potential") || "Choose your app plan"}</h1>
        <p className="mx-auto mt-2 max-w-[560px] text-[14px] text-muted-foreground">
          Freemium gives you the core tools for free. Premium App unlocks everything —
          community, general programs, courses, live support, assessments and challenges.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* ── Freemium ── */}
        <Card className="gap-0 p-0 shadow-soft-sm">
          <CardContent className="flex flex-1 flex-col px-6 py-7">
            <h3 className="text-lg font-bold tracking-tight">Freemium</h3>
            <p className="mt-1.5 mb-4 min-h-9 text-[13px] text-muted-foreground">Core self-service tools, free forever.</p>
            <div className="mb-5">
              <span className="text-[36px] font-bold tabular-nums tracking-tight">Free</span>
            </div>

            <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Included</p>
            <ul className="mb-4 flex flex-col gap-2.5">
              {FREEMIUM_INCLUDED.map(f => (
                <li key={f} className="flex items-start gap-2.5 text-[13px] text-foreground">
                  <span className="mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full bg-primary/15">
                    <Check size={11} className="text-primary" strokeWidth={2.5} />
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Not included</p>
            <ul className="mb-6 flex flex-1 flex-col gap-2.5">
              {FREEMIUM_EXCLUDED.map(f => (
                <li key={f} className="flex items-start gap-2.5 text-[13px] text-muted-foreground">
                  <span className="mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full bg-muted">
                    <X size={11} className="text-muted-foreground" strokeWidth={2.5} />
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => { updateUser({ isPremium: false }); navigate("/app/dashboard"); }}
            >
              Continue free
            </Button>
          </CardContent>
        </Card>

        {/* ── Premium App ── */}
        <Card className="relative gap-0 p-0 ring-2 ring-primary shadow-soft-md">
          <Badge className="absolute -top-2.5 end-4 px-2.5 py-1 text-[10px] tracking-wider uppercase">
            <Sparkles size={11} className="me-1" /> Most value
          </Badge>
          <CardContent className="flex flex-1 flex-col px-6 py-7">
            <div className="flex items-center gap-2">
              <Crown size={18} className="text-primary" />
              <h3 className="text-lg font-bold tracking-tight">Premium App</h3>
            </div>
            <p className="mt-1.5 mb-4 min-h-9 text-[13px] text-muted-foreground">Everything unlocked — train without limits.</p>

            {/* Billing cycle selector */}
            <div className="mb-3 flex gap-1 rounded-md bg-muted p-1">
              {BILLING.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setCycle(b.id)}
                  aria-pressed={cycle === b.id}
                  className={cn(
                    "flex-1 rounded-[8px] py-1.5 text-[12px] font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    cycle === b.id ? "bg-card text-foreground shadow-soft-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {b.label}
                </button>
              ))}
            </div>

            <div className="mb-5">
              <span className="text-[36px] font-bold tabular-nums tracking-tight text-primary">{prices[cycle]}</span>
              <span className="text-[13px] text-muted-foreground"> EGP / {BILLING.find(b => b.id === cycle)!.label.toLowerCase()}</span>
            </div>

            <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Everything in Freemium, plus</p>
            <ul className="mb-6 flex flex-1 flex-col gap-2.5">
              {PREMIUM_INCLUDED.map(f => (
                <li key={f} className="flex items-start gap-2.5 text-[13px] text-foreground">
                  <span className="mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full bg-primary/15">
                    <Check size={11} className="text-primary" strokeWidth={2.5} />
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <Button className="w-full" onClick={() => setPaymentOpen(true)}>
              Get Premium — {prices[cycle]} EGP
            </Button>
          </CardContent>
        </Card>
      </div>

      <p className="mt-8 text-center text-[12px] text-muted-foreground">
        Prices are set by Fitway Hub admins. Looking for a personal coach? Choose a PT plan
        from a coach in the Coaching section.
      </p>

      {/* Payment dialog — opened when "Get Premium" is clicked */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown size={18} className="text-primary" /> Premium App
            </DialogTitle>
          </DialogHeader>

          <div className="flex gap-1 rounded-md bg-muted p-1">
            {BILLING.map((b) => (
              <button
                key={b.id}
                onClick={() => setCycle(b.id)}
                aria-pressed={cycle === b.id}
                className={cn(
                  "flex-1 rounded-[8px] py-2 text-[12px] font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  cycle === b.id ? "bg-card text-foreground shadow-soft-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {b.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-md bg-muted px-4 py-3">
            <span className="text-[13px] text-muted-foreground">{billing.label} total</span>
            <span className="text-lg font-bold tabular-nums text-primary">{amount} EGP</span>
          </div>

          <PaymentForm
            amount={amount}
            plan={billing.planLabel}
            type="user"
            token={token}
            onSuccess={handleSuccess}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
