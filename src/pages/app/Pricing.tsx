/**
 * Pricing — subscription packages from the May 2026 business plan
 * ─────────────────────────────────────────────────────────
 * Two tracks, three tiers each:
 *
 *   Community Subscription  → Freemium / Premium / Exclusive
 *   PT (Personal Trainer)   → Basic / Premium / Gold
 *
 * Tier prices come from admin app_settings (sub_community_*_egp /
 * sub_pt_*_egp). Defaults are placeholders the client will replace —
 * nothing here is hardcoded.
 */
import { useState, useEffect } from "react";
import { Check, Crown, ArrowLeft, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useNavigate } from "react-router-dom";
import { getApiBase } from "@/lib/api";
import PaymentForm from "@/components/app/PaymentForm";

type Track = "community" | "pt";
type Step = "plans" | "payment";

interface TierDef {
  id: string;
  name: string;
  blurb: string;
  badge?: string;
  features: { label: string; v: string | boolean }[];
}

// ── Community subscription tiers ─────────────────────────────────────────────
const COMMUNITY_TIERS: TierDef[] = [
  {
    id: "freemium",
    name: "Freemium",
    blurb: "Start free — try the basics with the platform.",
    features: [
      { label: "Calorie Calculator", v: true },
      { label: "General Programs (PPL / Upper-Lower / Pro Split)", v: false },
      { label: "Nutrition Plans", v: false },
      { label: "Courses", v: false },
      { label: "Live support / emergency", v: false },
      { label: "Community / Q&A forum", v: false },
      { label: "Training follow-up", v: false },
      { label: "Nutrition facts database", v: false },
      { label: "Hybrid / in-person training", v: false },
      { label: "One-to-one chat with trainer", v: false },
      { label: "Fitness assessment", v: false },
    ],
  },
  {
    id: "premium",
    name: "Premium",
    blurb: "Everything you need to train consistently and follow a plan.",
    badge: "Most popular",
    features: [
      { label: "Calorie Calculator", v: true },
      { label: "General Programs (PPL / Upper-Lower / Pro Split)", v: true },
      { label: "Nutrition Plans", v: true },
      { label: "Courses", v: true },
      { label: "Live support / emergency", v: true },
      { label: "Community / Q&A forum", v: true },
      { label: "Training follow-up", v: "Weekly" },
      { label: "Nutrition facts database", v: false },
      { label: "Hybrid / in-person training", v: false },
      { label: "One-to-one chat with trainer", v: false },
      { label: "Fitness assessment", v: false },
    ],
  },
  {
    id: "exclusive",
    name: "Exclusive",
    blurb: "Full community access plus in-person options and 1:1 support.",
    features: [
      { label: "Calorie Calculator", v: true },
      { label: "General Programs (PPL / Upper-Lower / Pro Split)", v: true },
      { label: "Nutrition Plans", v: true },
      { label: "Courses", v: true },
      { label: "Live support / emergency", v: true },
      { label: "Community / Q&A forum", v: true },
      { label: "Training follow-up", v: "Monthly" },
      { label: "Nutrition facts database", v: true },
      { label: "Hybrid / in-person training", v: true },
      { label: "One-to-one chat with trainer", v: true },
      { label: "Fitness assessment", v: true },
    ],
  },
];

// ── PT (Personal Trainer) subscription tiers ─────────────────────────────────
const PT_TIERS: TierDef[] = [
  {
    id: "basic",
    name: "Basic",
    blurb: "Custom plan from a certified coach with monthly follow-up.",
    features: [
      { label: "Customized nutrition plan", v: true },
      { label: "Personal fitness program", v: true },
      { label: "Follow-up", v: "Monthly" },
      { label: "After the plan (3 months)", v: "None" },
      { label: "Additional benefits", v: false },
    ],
  },
  {
    id: "premium",
    name: "Premium",
    blurb: "Tighter coaching loop with weekly check-ins and post-plan access.",
    badge: "Most popular",
    features: [
      { label: "Customized nutrition plan", v: true },
      { label: "Personal fitness program", v: true },
      { label: "Follow-up", v: "Weekly" },
      { label: "After the plan (3 months)", v: "Premium subscription (limited)" },
      { label: "Additional benefits", v: false },
    ],
  },
  {
    id: "gold",
    name: "Gold",
    blurb: "The full personal-training experience with exclusive perks.",
    features: [
      { label: "Customized nutrition plan", v: true },
      { label: "Personal fitness program", v: true },
      { label: "Follow-up", v: "Continuous" },
      { label: "After the plan (3 months)", v: "Exclusive subscription (limited)" },
      { label: "Additional benefits", v: true },
    ],
  },
];

const DEFAULT_PRICES: Record<string, number> = {
  community_freemium: 0,
  community_premium:  149,
  community_exclusive:299,
  pt_basic:           499,
  pt_premium:         899,
  pt_gold:            1499,
};

export default function Pricing() {
  const { user, updateUser, token } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 860);
  useEffect(() => { const h = () => setIsMobile(window.innerWidth < 860); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);

  const [track, setTrack] = useState<Track>("community");
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
    const key = `${track === "community" ? "community" : "pt"}_${tier.id}`;
    const monthly = prices[key] ?? 0;
    return billingCycle === "annual" ? monthly * 10 : monthly; // 2 months free on annual
  };

  const handleSuccess = () => {
    updateUser({ isPremium: true });
    navigate("/app/dashboard");
  };

  const tiers = track === "community" ? COMMUNITY_TIERS : PT_TIERS;

  if (step === "payment" && selectedTier) {
    const amount = priceFor(selectedTier);
    return (
      <div style={{ padding: "24px 20px 40px", maxWidth: 500, margin: "0 auto" }}>
        <button onClick={() => setStep("plans")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, marginBottom: 24, padding: 0 }}>
          <ArrowLeft size={15} /> Back to plans
        </button>
        <div style={{ backgroundColor: "var(--bg-card)", border: "2px solid var(--accent)", borderRadius: 16, padding: "28px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <Crown size={18} color="var(--accent)" />
            <h2 style={{ fontFamily: "var(--font-en)", fontSize: 20, fontWeight: 700 }}>
              {track === "community" ? "Community" : "PT"} · {selectedTier.name}
            </h2>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>
            {billingCycle === "annual" ? `${amount} EGP / year (2 months free)` : `${amount} EGP / month`}
          </p>

          <div style={{ display: "flex", gap: 4, backgroundColor: "var(--bg-surface)", padding: 3, borderRadius: 99, marginBottom: 24 }}>
            {(["monthly", "annual"] as const).map((c) => (
              <button key={c} onClick={() => setBillingCycle(c)} style={{ flex: 1, padding: "8px 0", borderRadius: 99, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", backgroundColor: billingCycle === c ? "var(--accent)" : "transparent", color: billingCycle === c ? "#000000" : "var(--text-secondary)" }}>
                {c === "monthly" ? "Monthly" : "Annual · save 2 months"}
              </button>
            ))}
          </div>

          <div style={{ padding: "12px 14px", backgroundColor: "var(--bg-surface)", borderRadius: 12, border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{billingCycle === "annual" ? "Annual total" : "Monthly charge"}</span>
            <span style={{ fontFamily: "var(--font-en)", fontSize: 18, fontWeight: 700, color: "var(--accent)" }}>{amount} EGP</span>
          </div>

          <PaymentForm
            amount={amount}
            plan={billingCycle}
            type="user"
            token={token}
            onSuccess={handleSuccess}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: isMobile ? "16px 12px 40px" : "24px 20px 48px", maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <h1 style={{ fontFamily: "var(--font-en)", fontSize: "clamp(22px, 4vw, 34px)", fontWeight: 800, marginBottom: 8 }}>{t("unlock_potential") || "Pick your subscription"}</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", maxWidth: 540, margin: "0 auto" }}>
          Community subscriptions get you the platform and group support. PT subscriptions add a personal certified coach with a custom plan.
        </p>
      </div>

      {/* Track switcher */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
        <div style={{ display: "inline-flex", gap: 0, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 99, padding: 4 }}>
          {([
            { id: "community" as const, label: "Community" },
            { id: "pt"        as const, label: "Personal Trainer" },
          ]).map(opt => {
            const active = track === opt.id;
            return (
              <button key={opt.id} onClick={() => setTrack(opt.id)} style={{
                padding: "9px 22px", borderRadius: 99, border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 700,
                background: active ? "var(--accent)" : "transparent",
                color: active ? "#0a0a0a" : "var(--text-secondary)",
                fontFamily: "var(--font-en)", transition: "all 0.15s",
              }}>{opt.label}</button>
            );
          })}
        </div>
      </div>

      {/* Tier cards */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 16 }}>
        {tiers.map(tier => {
          const monthly = priceFor(tier);
          const highlighted = tier.badge === "Most popular";
          return (
            <div key={tier.id} style={{
              background: "var(--bg-card)",
              border: `${highlighted ? 2 : 1}px solid ${highlighted ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 16,
              padding: "26px 22px",
              position: "relative",
              display: "flex", flexDirection: "column",
            }}>
              {tier.badge && (
                <span style={{ position: "absolute", top: -10, insetInlineEnd: 16, fontSize: 10, padding: "4px 10px", borderRadius: 99, background: "var(--accent)", color: "#0a0a0a", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{tier.badge}</span>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                {highlighted && <Sparkles size={16} color="var(--accent)" />}
                <h3 style={{ fontFamily: "var(--font-en)", fontSize: 18, fontWeight: 700 }}>{tier.name}</h3>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 18, minHeight: 36 }}>{tier.blurb}</p>
              <div style={{ marginBottom: 20 }}>
                <span style={{ fontFamily: "var(--font-en)", fontSize: 36, fontWeight: 800, color: highlighted ? "var(--accent)" : "var(--text-primary)" }}>{monthly}</span>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}> EGP/month</span>
              </div>
              <ul style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 22, flex: 1 }}>
                {tier.features.map(f => {
                  const has = f.v !== false;
                  const valueStr = typeof f.v === "string" ? f.v : null;
                  return (
                    <li key={f.label} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: has ? "var(--text-primary)" : "var(--text-muted)" }}>
                      <div style={{ width: 18, height: 18, borderRadius: "50%", background: has ? "var(--accent-dim)" : "var(--bg-surface)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                        {has ? <Check size={11} color="var(--accent)" /> : <span style={{ width: 6, height: 1, background: "var(--text-muted)" }} />}
                      </div>
                      <span>
                        {f.label}
                        {valueStr && <span style={{ fontSize: 11, color: "var(--text-muted)", marginInlineStart: 6 }}>· {valueStr}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <button
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
                style={{
                  width: "100%", padding: "12px",
                  borderRadius: 12, border: "none",
                  background: highlighted ? "var(--accent)" : "var(--bg-surface)",
                  color: highlighted ? "#0a0a0a" : "var(--text-primary)",
                  fontWeight: 700, fontSize: 13, cursor: "pointer",
                  fontFamily: "var(--font-en)",
                  border: highlighted ? "none" : "1px solid var(--border)",
                }}
              >
                {tier.id === "freemium" || monthly === 0 ? "Continue free" : "Choose " + tier.name}
              </button>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", marginTop: 28 }}>
        Plan pricing is set by Fitway Hub admins. Talk to your coach for any
        custom or hybrid arrangements not listed here.
      </p>
    </div>
  );
}
