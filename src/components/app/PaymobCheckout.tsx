/**
 * UnifiedCheckout
 * ─────────────────────────────────────────────────────────
 * Two payment paths:
 *
 *  1. PayPal (automated) — instant capture, no admin involvement.
 *     Accepts PayPal balance, credit/debit card, Google Pay, Apple Pay.
 *
 *  2. Manual e-wallet — Vodafone Cash / Orange Cash / WE Pay.
 *     User sends money from their phone wallet to the platform's published
 *     wallet number, takes a screenshot, uploads it. An admin reviews it
 *     and activates the subscription on approval.
 *
 *  History: earlier versions also handled Paymob (auto card/wallet/fawry)
 *  and Fawry. Both were removed in May 2026 — Paymob auto integration is
 *  gone; Fawry is no longer offered. The component file name is preserved
 *  for backwards-compat imports; the component is exported as
 *  `UnifiedCheckout` with a `PaymobCheckout` alias at the bottom.
 */

import { useState, useEffect, useRef } from "react";
import {
  X, Loader2, CheckCircle, AlertCircle,
  ChevronRight, ChevronLeft, Upload, Clock, Lock,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getApiBase } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

// ── Types ──────────────────────────────────────────────────────────────────────
type WalletType = "vodafone" | "orange" | "we" | "instapay";

interface PayConfig {
  paypal: { configured: boolean; clientId: string; mode: string };
  manualEwallet?: { enabled: boolean };
}

interface AdminNumbers { vodafone?: string; orange?: string; we?: string; instapay?: string }

interface Props {
  amount:     number;
  type:       "subscription" | "premium" | "booking";
  coachId?:   number;
  planCycle?: "monthly" | "yearly";
  planType?:  "complete" | "nutrition" | "workout";
  bookingId?: number;
  label?:     string;
  onSuccess?: () => void;
  onFailure?: (reason: string) => void;
  onClose?:   () => void;
}

declare global { interface Window { paypal?: any } }

export default function UnifiedCheckout({
  amount, type, coachId, planCycle, planType, bookingId, label, onSuccess, onFailure, onClose,
}: Props) {
  const { token } = useAuth();

  // ── State machine ──────────────────────────────────────────────────────────
  type Step =
    | "provider"        // pick PayPal vs manual e-wallet
    | "paypal"          // PayPal SDK render
    | "manual_ewallet"  // upload e-wallet screenshot (admin reviews)
    | "success_auto"    // PayPal completed → instant activation
    | "success_manual"  // proof submitted, awaiting admin
    | "failed";

  const [step,    setStep]    = useState<Step>("provider");
  const [config,  setConfig]  = useState<PayConfig | null>(null);
  const [nums,    setNums]    = useState<AdminNumbers>({});
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const [walletType,   setWalletType]   = useState<WalletType>("vodafone");
  const [senderNum,    setSenderNum]    = useState("");
  const [proofFile,    setProofFile]    = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const paypalRef = useRef<HTMLDivElement>(null);
  const paypalLoaded = useRef(false);

  // ── Load config & admin wallet numbers ────────────────────────────────────
  useEffect(() => {
    fetch(getApiBase() + "/api/pay/config").then(r => r.json()).then(setConfig).catch(() => {});
    fetch(getApiBase() + "/api/payments/public-settings").then(r => r.json()).then(d => {
      const s = d.settings || {};
      setNums({
        vodafone: s.ewallet_phone_vodafone || s.ewallet_phone || "",
        orange:   s.ewallet_phone_orange   || "",
        we:       s.ewallet_phone_we       || "",
        instapay: s.ewallet_phone_instapay || s.instapay_handle || "",
      });
    }).catch(() => {});
  }, []);

  // ── Load PayPal SDK ────────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== "paypal" || !config?.paypal.configured || paypalLoaded.current) return;
    const cid = config.paypal.clientId;
    if (!cid) return;
    const render = () => {
      if (!window.paypal || !paypalRef.current) return;
      paypalRef.current.innerHTML = "";
      paypalLoaded.current = true;
      window.paypal.Buttons({
        style: { layout: "vertical", color: "blue", shape: "pill", label: "pay" },
        createOrder: async () => {
          const res = await fetch(getApiBase() + "/api/pay/intention", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ provider: "paypal", amount, type, coachId, planCycle, planType }),
          });
          const d = await res.json();
          if (!res.ok) throw new Error(d.message);
          return d.orderId;
        },
        onApprove: async (data: any) => {
          setLoading(true);
          try {
            const res = await fetch(getApiBase() + "/api/pay/paypal/capture", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ orderId: data.orderID }),
            });
            const d = await res.json();
            if (!res.ok) { setError(d.message || "Capture failed"); setStep("failed"); return; }
            setStep("success_auto");
            onSuccess?.();
          } finally { setLoading(false); }
        },
        onError:  (err: any) => { setError(err?.message || "PayPal error"); setStep("failed"); onFailure?.(err?.message || ""); },
        onCancel: () => setStep("provider"),
      }).render(paypalRef.current);
    };
    const existing = document.getElementById("paypal-sdk");
    if (!existing) {
      const s = document.createElement("script");
      s.id = "paypal-sdk";
      s.src = `https://www.paypal.com/sdk/js?client-id=${cid}&currency=USD&intent=capture&enable-funding=venmo,paylater`;
      s.onload = render;
      document.head.appendChild(s);
    } else if (window.paypal) { render(); }
    else existing.addEventListener("load", render);
  }, [step, config]);

  // ── Submit manual e-wallet proof ──────────────────────────────────────────
  const submitManualProof = async () => {
    if (!senderNum.trim()) { setError("Enter your wallet number"); return; }
    if (!proofFile) { setError("Please upload a screenshot of the transaction"); return; }
    setLoading(true); setError("");
    try {
      const form = new FormData();
      form.append("plan", planCycle || "monthly");
      form.append("type", type === "premium" ? "user" : "coach");
      form.append("walletType", walletType);
      form.append("senderNumber", senderNum);
      form.append("proof", proofFile);
      if (coachId) form.append("coachId", String(coachId));
      const res = await fetch(getApiBase() + "/api/payments/ewallet", {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form,
      });
      const d = await res.json();
      if (!res.ok) { setError(d.message || "Submission failed"); return; }
      setStep("success_manual");
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setProofFile(f);
    const r = new FileReader(); r.onload = ev => setProofPreview(ev.target?.result as string); r.readAsDataURL(f);
  };

  const reset = () => {
    setStep("provider"); setError(""); setProofFile(null); setProofPreview(null);
    setSenderNum(""); paypalLoaded.current = false;
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════════════════

  if (step === "success_auto") return (
    <Overlay><Sheet>
      <StatusScreen
        icon={<CheckCircle size={32} color="var(--green)" />}
        bg="rgba(74,222,128,0.12)"
        title="Payment Successful!"
        sub={type === "subscription" ? "Your subscription is now active." : type === "premium" ? "Premium access activated!" : "Payment confirmed."}
        cta="Continue" onCta={() => { reset(); onClose?.(); }}
      />
    </Sheet></Overlay>
  );

  if (step === "success_manual") return (
    <Overlay><Sheet>
      <StatusScreen
        icon={<Clock size={32} color="var(--amber)" />}
        bg="rgba(251,191,36,0.12)"
        title="Proof Submitted!"
        sub="Your payment screenshot has been sent to the admin for review. You'll be notified once it's approved — usually within a few hours."
        cta="Got it" onCta={() => { reset(); onClose?.(); }}
      />
    </Sheet></Overlay>
  );

  if (step === "failed") return (
    <Overlay><Sheet>
      <StatusScreen
        icon={<AlertCircle size={32} color="var(--red)" />}
        bg="rgba(248,113,113,0.12)"
        title="Payment Failed"
        sub={error || "Something went wrong. Please try again."}
        cta="Try Again" onCta={reset}
        ctaSecondary="Cancel" onCtaSecondary={() => { reset(); onClose?.(); }}
      />
    </Sheet></Overlay>
  );

  if (step === "paypal") return (
    <Overlay><Sheet>
      <Hdr title="PayPal / Card / Google & Apple Pay" back={() => setStep("provider")} />
      <p className="mb-4 text-[13px] leading-relaxed text-muted-foreground">
        PayPal accepts credit cards, debit cards, Google Pay, and Apple Pay. No PayPal account required.
      </p>
      {loading ? (
        <div className="grid place-items-center py-8"><Loader2 size={28} strokeWidth={2} className="animate-spin text-primary" /></div>
      ) : <div ref={paypalRef} style={{ minHeight: 50 }} />}
      {error && <ErrBox>{error}</ErrBox>}
      <p className="mt-4 inline-flex w-full items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <Lock size={12} strokeWidth={2} /> Secured by PayPal · Encrypted
      </p>
    </Sheet></Overlay>
  );

  if (step === "manual_ewallet") return (
    <Overlay><Sheet>
      <Hdr title="Pay via Mobile Wallet" back={() => setStep("provider")} />
      <p className="mb-3.5 text-[13px] leading-relaxed text-muted-foreground">
        Pick your wallet, send <strong className="text-primary">{amount} EGP</strong> to the
        number below from your wallet app, then upload the confirmation screenshot.
      </p>
      <div className="mb-3.5 flex flex-wrap gap-2">
        {(["vodafone", "orange", "we", "instapay"] as WalletType[]).map(w => (
          <WalletChip key={w} id={w} selected={walletType === w} onClick={() => setWalletType(w)} />
        ))}
      </div>
      <ManualInstructions
        icon={walletEmoji(walletType)}
        title={walletLabel(walletType)}
        steps={[
          `Open your ${walletLabel(walletType)} app`,
          `Send ${amount} EGP to: ${nums[walletType] || "—"}`,
          "Take a screenshot of the confirmation",
          "Upload it below — admin will activate within hours",
        ]}
        color={walletColor(walletType)}
        adminRef={nums[walletType] ? `Send to: ${nums[walletType]}` : undefined}
        copyValue={nums[walletType]}
      />
      <div className="mt-3.5 space-y-2">
        <Label htmlFor="ewallet-sender">Your Wallet Number</Label>
        <Input id="ewallet-sender" type="tel" placeholder="01XXXXXXXXX" value={senderNum} onChange={e => setSenderNum(e.target.value)} />
      </div>
      <div className="mt-3">
        <ProofUploader file={proofFile} preview={proofPreview} onFile={handleFile} inputRef={fileRef} />
      </div>
      {error && <ErrBox>{error}</ErrBox>}
      <Button disabled={loading || !proofFile} className="mt-3.5 w-full" onClick={submitManualProof}>
        {loading ? <><Loader2 size={16} strokeWidth={2} className="animate-spin" /> Submitting…</> : <><Upload size={16} strokeWidth={2} /> Submit Payment Proof</>}
      </Button>
    </Sheet></Overlay>
  );

  // ── Provider Selection (root) ─────────────────────────────────────────────
  const manualEnabled = config?.manualEwallet?.enabled !== false;
  return (
    <Overlay><Sheet>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[17px] font-bold tracking-tight text-foreground">{label || "Choose Payment"}</h3>
          <p className="mt-1 text-[14px] font-bold text-primary">Total: {amount} EGP</p>
        </div>
        {onClose && <Ibtn onClick={onClose} aria-label="Close checkout"><X size={17} strokeWidth={2} /></Ibtn>}
      </div>

      <div className="flex flex-col gap-3">
        {/* Manual e-wallet — Vodafone, Orange, WE, InstaPay */}
        {manualEnabled && (
          <ProviderCard
            emoji="📱"
            title="Mobile Wallet & InstaPay"
            sub="Vodafone Cash · Orange Cash · WE Pay · InstaPay"
            tag="EGP"
            modes={["Reviewed by admin"]}
            onClick={() => setStep("manual_ewallet")}
          />
        )}
      </div>

      {!manualEnabled && (
        <div className="py-6 text-center text-[13px] text-muted-foreground">
          No payment methods are configured yet. Please contact support.
        </div>
      )}
    </Sheet></Overlay>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[6px]">
      {children}
    </div>
  );
}

function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <Card className="max-h-[90dvh] w-full max-w-[440px] gap-0 overflow-y-auto rounded-lg p-6 shadow-soft-lg">
      {children}
    </Card>
  );
}

function Hdr({ title, back }: { title: string; back?: () => void }) {
  return (
    <div className="mb-5 flex items-center gap-2.5">
      {back && (
        <Button type="button" variant="secondary" size="icon-sm" className="rounded-full" onClick={back} aria-label="Go back">
          <ChevronLeft size={18} strokeWidth={2} />
        </Button>
      )}
      <h3 className="text-[17px] font-bold tracking-tight text-foreground">{title}</h3>
    </div>
  );
}

function Ibtn({ onClick, children, "aria-label": ariaLabel }: { onClick: () => void; children: React.ReactNode; "aria-label"?: string }) {
  return (
    <Button type="button" variant="secondary" size="icon-sm" className="rounded-full" onClick={onClick} aria-label={ariaLabel}>
      {children}
    </Button>
  );
}

function StatusScreen({ icon, bg, title, sub, cta, onCta, ctaSecondary, onCtaSecondary }: any) {
  return (
    <div className="py-2 text-center">
      <div className="mx-auto mb-4 grid size-[68px] place-items-center rounded-full" style={{ background: bg }}>{icon}</div>
      <h3 className="text-[17px] font-bold tracking-tight text-foreground">{title}</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{sub}</p>
      <div className="mt-6 flex justify-center gap-2.5">
        <Button className="flex-1" onClick={onCta}>{cta}</Button>
        {ctaSecondary && <Button variant="ghost" className="flex-1" onClick={onCtaSecondary}>{ctaSecondary}</Button>}
      </div>
    </div>
  );
}

function ProviderCard({ emoji, title, sub, tag, modes, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3.5 rounded-md bg-muted px-4 py-4 text-start shadow-soft-sm transition hover:bg-accent active:scale-[0.99]"
    >
      <div className="grid size-12 shrink-0 place-items-center rounded-full bg-card text-[22px]">{emoji}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold text-foreground">{title}</p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">{sub}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {modes.map((m: string) => (
            <Badge key={m} variant="muted" className="gap-1 text-[10px]"><Clock size={10} strokeWidth={2} /> {m}</Badge>
          ))}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Badge>{tag}</Badge>
        <ChevronRight size={16} strokeWidth={2} className="text-muted-foreground" />
      </div>
    </button>
  );
}

function WalletChip({ id, selected, onClick }: { id: WalletType; selected: boolean; onClick: () => void; key?: React.Key }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-1 flex-col items-center gap-1 rounded-md px-1 py-2 transition"
      style={selected
        ? { background: `color-mix(in srgb, ${walletColor(id)} 14%, transparent)`, boxShadow: `inset 0 0 0 2px ${walletColor(id)}`, color: walletColor(id) }
        : { background: "var(--muted)", color: "var(--muted-foreground)" }}
    >
      <span className="text-[16px]">{walletEmoji(id)}</span>
      <span className="text-[10px] font-bold">{walletShort(id)}</span>
    </button>
  );
}

function ManualInstructions({ icon, title, steps, color, adminRef, copyValue }: any) {
  return (
    <div className="mb-1.5 rounded-md p-3.5" style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 35%, transparent)` }}>
      <div className="mb-3 flex items-center gap-2.5">
        <span className="text-[24px]">{icon}</span>
        <span className="text-[14px] font-bold text-foreground">{title} Transfer Instructions</span>
      </div>
      {steps.map((s: string, i: number) => (
        <div key={i} className="mb-2 flex items-start gap-2.5">
          <div className="grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: color }}>{i + 1}</div>
          <span className="text-[13px] leading-relaxed text-foreground">{s}</span>
        </div>
      ))}
      {adminRef && (
        <div className="mt-2.5 flex items-center justify-between gap-2 rounded-md bg-card px-3.5 py-2.5">
          <span className="font-mono text-[18px] font-extrabold tracking-wide" style={{ color }}>{adminRef}</span>
          {copyValue && <Button type="button" variant="secondary" size="sm" className="rounded-full" onClick={() => navigator.clipboard?.writeText(copyValue)}>Copy</Button>}
        </div>
      )}
    </div>
  );
}

function ProofUploader({ file, preview, onFile, inputRef }: any) {
  return (
    <div className="space-y-2">
      <Label htmlFor="proof-upload">Transaction Screenshot *</Label>
      <input id="proof-upload" type="file" ref={inputRef} accept="image/*" onChange={onFile} style={{ display: "none" }} />
      {preview ? (
        <div className="relative">
          <img src={preview} alt="Payment proof screenshot" className="max-h-[180px] w-full rounded-md bg-muted object-contain shadow-soft-sm" />
          <Button type="button" size="sm" className="absolute bottom-2 end-2 rounded-full" onClick={() => { inputRef.current?.click(); }}>Change</Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-md bg-muted p-6 ring-1 ring-inset ring-border transition hover:bg-accent"
        >
          <Upload size={24} strokeWidth={2} className="text-muted-foreground" />
          <span className="text-[13px] text-muted-foreground">Click to upload screenshot</span>
          <span className="text-[10px] text-muted-foreground">JPG or PNG — max 5 MB</span>
        </button>
      )}
    </div>
  );
}

function ErrBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 flex items-start gap-2 rounded-md bg-destructive/10 px-3.5 py-2.5 text-[13px] text-destructive">
      <AlertCircle size={16} strokeWidth={2} className="mt-px shrink-0" />
      <span>{children}</span>
    </div>
  );
}

// ── Wallet helpers ─────────────────────────────────────────────────────────────
function walletColor(w: WalletType): string {
  return { vodafone: "#E60000", orange: "#FF6900", we: "#7B2D8E", instapay: "#1E1E3F" }[w];
}
function walletEmoji(w: WalletType): string {
  return { vodafone: "🔴", orange: "🟠", we: "🟣", instapay: "💳" }[w];
}
function walletLabel(w: WalletType): string {
  return { vodafone: "Vodafone Cash", orange: "Orange Cash", we: "WE Pay", instapay: "InstaPay" }[w];
}
function walletShort(w: WalletType): string {
  return { vodafone: "Vodafone", orange: "Orange", we: "WE", instapay: "InstaPay" }[w];
}

// Re-export with old name for backward compat with existing imports.
// Existing imports still write `import { PaymobCheckout } from ...` —
// keep this alias to avoid mass-renaming consumer files.
export { UnifiedCheckout as PaymobCheckout };
