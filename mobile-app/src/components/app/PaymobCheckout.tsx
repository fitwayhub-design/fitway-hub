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
  X, Smartphone, Loader2, CheckCircle, AlertCircle,
  ChevronRight, Upload, Clock, Info,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getApiBase } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────────
type WalletType = "vodafone" | "orange" | "we";

interface PayConfig {
  paypal: { configured: boolean; clientId: string; mode: string };
  manualEwallet?: { enabled: boolean };
}

interface AdminNumbers { vodafone?: string; orange?: string; we?: string }

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
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.6 }}>
        PayPal accepts credit cards, debit cards, Google Pay, and Apple Pay. No PayPal account required.
      </p>
      {loading ? (
        <div style={{ textAlign: "center", padding: 32 }}><Loader2 size={28} color="var(--main)" style={{ animation: "spin 1s linear infinite" }} /></div>
      ) : <div ref={paypalRef} style={{ minHeight: 50 }} />}
      {error && <ErrBox>{error}</ErrBox>}
      <p style={S.lock}>🔒 Secured by PayPal · Encrypted</p>
    </Sheet></Overlay>
  );

  if (step === "manual_ewallet") return (
    <Overlay><Sheet>
      <Hdr title="Pay via Mobile Wallet" back={() => setStep("provider")} />
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 14, lineHeight: 1.6 }}>
        Pick your wallet, send <strong style={{ color: "var(--main)" }}>{amount} EGP</strong> to the
        number below from your wallet app, then upload the confirmation screenshot.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {(["vodafone", "orange", "we"] as WalletType[]).map(w => (
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
      <div style={{ marginTop: 14 }}>
        <label style={S.label}>Your Wallet Number</label>
        <input className="input-base" type="tel" placeholder="01XXXXXXXXX" value={senderNum} onChange={e => setSenderNum(e.target.value)} style={{ marginBottom: 12 }} />
      </div>
      <ProofUploader file={proofFile} preview={proofPreview} onFile={handleFile} inputRef={fileRef} />
      {error && <ErrBox>{error}</ErrBox>}
      <button disabled={loading || !proofFile} className="btn-main" style={{ width: "100%", marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={submitManualProof}>
        {loading ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Submitting…</> : <><Upload size={15} /> Submit Payment Proof</>}
      </button>
    </Sheet></Overlay>
  );

  // ── Provider Selection (root) ─────────────────────────────────────────────
  const manualEnabled = config?.manualEwallet?.enabled !== false;
  const paypalEnabled = config?.paypal.configured !== false;
  return (
    <Overlay><Sheet>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <h3 style={S.title}>{label || "Choose Payment"}</h3>
          <p style={{ fontSize: 14, color: "var(--main)", fontWeight: 700, marginTop: 4 }}>Total: {amount} EGP</p>
        </div>
        {onClose && <Ibtn onClick={onClose}><X size={17} /></Ibtn>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Manual e-wallet — primary path for Egypt */}
        {manualEnabled && (
          <ProviderCard
            emoji="📱"
            title="Mobile Wallet"
            sub="Vodafone Cash · Orange Cash · WE Pay"
            tag="EGP"
            tagColor="var(--main)"
            modes={["🕐 Reviewed by admin"]}
            onClick={() => setStep("manual_ewallet")}
          />
        )}
        {/* PayPal — instant, international */}
        {paypalEnabled && (
          <ProviderCard
            emoji="🅿"
            title="PayPal"
            sub="PayPal · Credit / Debit Card · Google Pay · Apple Pay"
            tag="USD"
            tagColor="#0070BA"
            modes={["⚡ Instant"]}
            onClick={() => setStep("paypal")}
          />
        )}
      </div>

      {!manualEnabled && !paypalEnabled && (
        <div style={{ textAlign: "center", padding: 24, color: "var(--text-muted)", fontSize: 13 }}>
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
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      {children}
    </div>
  );
}

function Sheet({ children }: { children: React.ReactNode }) {
  return <div style={S.sheet}>{children}</div>;
}

function Hdr({ title, back }: { title: string; back?: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
      {back && (
        <button onClick={back} style={{ background: "var(--bg-surface)", border: "none", borderRadius: "50%", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-secondary)", flexShrink: 0, fontSize: 18, fontWeight: 700 }}>‹</button>
      )}
      <h3 style={S.title}>{title}</h3>
    </div>
  );
}

function Ibtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ background: "var(--bg-surface)", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-secondary)", flexShrink: 0 }}>
      {children}
    </button>
  );
}

function StatusScreen({ icon, bg, title, sub, cta, onCta, ctaSecondary, onCtaSecondary }: any) {
  return (
    <div style={{ textAlign: "center", padding: "8px 0" }}>
      <div style={{ width: 68, height: 68, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>{icon}</div>
      <h3 style={S.title}>{title}</h3>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8, lineHeight: 1.6 }}>{sub}</p>
      <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "center" }}>
        <button onClick={onCta} className="btn-main" style={{ flex: 1 }}>{cta}</button>
        {ctaSecondary && <button onClick={onCtaSecondary} className="btn-ghost" style={{ flex: 1 }}>{ctaSecondary}</button>}
      </div>
    </div>
  );
}

function ProviderCard({ emoji, title, sub, tag, tagColor, modes, onClick }: any) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-light)", background: "var(--bg-surface)", cursor: "pointer", textAlign: "left", width: "100%", transition: "all 0.15s" }}
      onMouseOver={e => { (e.currentTarget as any).style.borderColor = "var(--main)"; (e.currentTarget as any).style.background = "var(--main-dim)"; }}
      onMouseOut={e => { (e.currentTarget as any).style.borderColor = "var(--border-light)"; (e.currentTarget as any).style.background = "var(--bg-surface)"; }}
    >
      <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{emoji}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{title}</p>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{sub}</p>
        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
          {modes.map((m: string) => (
            <span key={m} style={{ fontSize: 10, padding: "2px 7px", borderRadius: "var(--radius-full)", background: "var(--bg-card)", color: "var(--text-muted)", fontWeight: 600 }}>{m}</span>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: "var(--radius-full)", background: `${tagColor}18`, color: tagColor, fontWeight: 700 }}>{tag}</span>
        <ChevronRight size={15} color="var(--text-muted)" />
      </div>
    </button>
  );
}

function WalletChip({ id, selected, onClick }: { id: WalletType; selected: boolean; onClick: () => void; key?: React.Key }) {
  return (
    <button onClick={onClick} style={{ flex: 1, padding: "8px 4px", borderRadius: "var(--radius-full)", border: `2px solid ${selected ? walletColor(id) : "var(--border-light)"}`, background: selected ? `${walletColor(id)}18` : "var(--bg-surface)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <span style={{ fontSize: 16 }}>{walletEmoji(id)}</span>
      <span style={{ fontSize: 10, fontWeight: 700, color: selected ? walletColor(id) : "var(--text-muted)" }}>{walletShort(id)}</span>
    </button>
  );
}

function ManualInstructions({ icon, title, steps, color, adminRef, copyValue }: any) {
  return (
    <div style={{ padding: 14, borderRadius: "var(--radius-lg)", background: `${color}12`, border: `1px solid ${color}40`, marginBottom: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 24 }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{title} Transfer Instructions</span>
      </div>
      {steps.map((s: string, i: number) => (
        <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
          <div style={{ width: 20, height: 20, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11, fontWeight: 700, color: "#fff" }}>{i + 1}</div>
          <span style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5 }}>{s}</span>
        </div>
      ))}
      {adminRef && (
        <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: "var(--radius-md)", background: "var(--bg-surface)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 800, color, letterSpacing: 1 }}>{adminRef}</span>
          {copyValue && <button onClick={() => navigator.clipboard?.writeText(copyValue)} style={S.copyBtn}>Copy</button>}
        </div>
      )}
    </div>
  );
}

function ProofUploader({ file, preview, onFile, inputRef }: any) {
  return (
    <div>
      <label style={S.label}>Transaction Screenshot *</label>
      <input type="file" ref={inputRef} accept="image/*" onChange={onFile} style={{ display: "none" }} />
      {preview ? (
        <div style={{ position: "relative" }}>
          <img src={preview} alt="Proof" style={{ width: "100%", maxHeight: 180, objectFit: "contain", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", background: "var(--bg-surface)" }} />
          <button onClick={() => { inputRef.current?.click(); }} style={{ position: "absolute", bottom: 8, right: 8, background: "var(--main)", border: "none", borderRadius: "var(--radius-full)", padding: "4px 10px", fontSize: 11, color: "#fff", cursor: "pointer", fontWeight: 600 }}>Change</button>
        </div>
      ) : (
        <button onClick={() => inputRef.current?.click()} style={{ width: "100%", padding: "24px", borderRadius: "var(--radius-lg)", border: "2px dashed var(--border-light)", background: "var(--bg-surface)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <Upload size={24} color="var(--text-muted)" />
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Click to upload screenshot</span>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>JPG or PNG — max 5 MB</span>
        </button>
      )}
    </div>
  );
}

function ErrBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "rgba(248,113,113,0.1)", color: "var(--red)", borderRadius: "var(--radius-md)", padding: "10px 14px", fontSize: 13, marginTop: 8 }}>{children}</div>
  );
}

// ── Wallet helpers ─────────────────────────────────────────────────────────────
function walletColor(w: WalletType): string {
  return { vodafone: "#E60000", orange: "#FF6900", we: "#7B2D8E" }[w];
}
function walletEmoji(w: WalletType): string {
  return { vodafone: "🔴", orange: "🟠", we: "🟣" }[w];
}
function walletLabel(w: WalletType): string {
  return { vodafone: "Vodafone Cash", orange: "Orange Cash", we: "WE Pay" }[w];
}
function walletShort(w: WalletType): string {
  return { vodafone: "Vodafone", orange: "Orange", we: "WE" }[w];
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const S = {
  sheet: {
    background: "var(--bg-card)",
    borderRadius: "var(--radius-xl)",
    border: "1px solid var(--border-light)",
    padding: "26px 22px",
    width: "100%", maxWidth: 440,
    boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
    maxHeight: "90dvh",
    overflowY: "auto" as const,
  } as React.CSSProperties,
  title: {
    fontFamily: "var(--font-heading)", fontSize: 17, fontWeight: 700,
    color: "var(--text-primary)", margin: 0,
  } as React.CSSProperties,
  label: { fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 } as React.CSSProperties,
  lock: { fontSize: 11, color: "var(--text-muted)", textAlign: "center" as const, marginTop: 14 },
  copyBtn: {
    background: "var(--bg-card)", border: "none", borderRadius: "var(--radius-full)",
    padding: "4px 12px", fontSize: 11, color: "var(--text-secondary)", cursor: "pointer", fontWeight: 600,
  } as React.CSSProperties,
};

// Re-export with old name for backward compat with existing imports.
// Existing imports still write `import { PaymobCheckout } from ...` —
// keep this alias to avoid mass-renaming consumer files.
export { UnifiedCheckout as PaymobCheckout };
