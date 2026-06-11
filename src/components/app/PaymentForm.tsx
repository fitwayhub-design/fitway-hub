import { apiFetch } from "@/lib/api";
import React, { useState, useEffect, useRef } from "react";
import { Smartphone, CheckCircle, Upload, X, AlertCircle, ShieldCheck } from "lucide-react";
import { detectPlatform, isNativeApp } from "@/lib/iap";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

declare global {
  interface Window { paypal?: any; }
}

interface PaymentFormProps {
  amount: number;
  // "monthly" / "annual" drive coach-subscription duration on the backend;
  // app plans may pass other labels (e.g. "quarterly") which are stored as-is.
  plan: "monthly" | "annual" | string;
  type: "user" | "coach";
  token: string | null;
  onSuccess: () => void;
  onError?: (msg: string) => void;
  /** For coach subscription payments */
  coachId?: number;
  coachName?: string;
  /** Package id (e.g. community_premium, pt_basic) selected by athlete */
  packageId?: string;
}

// ── Main PaymentForm ─────────────────────────────────────────────────────────
export default function PaymentForm({ amount, plan, type, token, onSuccess, onError, coachId, coachName, packageId }: PaymentFormProps) {
  type Method = "paypal" | "ewallet" | "apple_iap" | "google_iap";
  const platform = detectPlatform();
  const native = isNativeApp();

  // Default: E-Wallet for web, Apple/Google IAP for native
  const defaultMethod: Method = coachId ? "ewallet" : (platform === "ios" ? "apple_iap" : platform === "android" ? "google_iap" : "ewallet");
  const [method, setMethod] = useState<Method>(defaultMethod);

  const [paypalClientId, setPaypalClientId] = useState<string | null>(null);
  const [ewalletPhones, setEwalletPhones] = useState<Record<string, string>>({ vodafone: "", orange: "", we: "" });
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const [walletType, setWalletType] = useState<"vodafone" | "orange" | "we">("vodafone");
  const [senderNumber, setSenderNumber] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [ewalletProcessing, setEwalletProcessing] = useState(false);
  const [ewalletError, setEwalletError] = useState("");
  const [ewalletSuccess, setEwalletSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const paypalContainerRef = useRef<HTMLDivElement>(null);
  const paypalRendered = useRef(false);
  const loadedClientId = useRef<string | null>(null);

  const [iapProcessing, setIapProcessing] = useState(false);
  const [iapError, setIapError] = useState("");

  const [enabledMethods, setEnabledMethods] = useState<Record<string, boolean>>({
    pm_orange_cash: true, pm_vodafone_cash: true, pm_we_pay: true,
    pm_paypal: true, pm_credit_card: false, pm_google_pay: true, pm_apple_pay: true,
  });

  const api = (path: string, opts?: RequestInit) =>
    apiFetch(path, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts?.headers || {}) } });

  // ── Load configs ────────────────────────────────────────────────────────────
  useEffect(() => {
    apiFetch("/api/payments/public-settings")
      .then(r => r.json())
      .then(data => {
        const s = data.settings || {};
        const clientIdKey = type === "coach" ? "paypal_coach_client_id" : "paypal_user_client_id";
        if (s[clientIdKey]) setPaypalClientId(s[clientIdKey]);
        setEwalletPhones({
          vodafone: s.ewallet_phone_vodafone || s.ewallet_phone || "",
          orange: s.ewallet_phone_orange || s.ewallet_phone || "",
          we: s.ewallet_phone_we || s.ewallet_phone || "",
        });
        // Load payment method toggles
        const pm: Record<string, boolean> = {};
        for (const k of ['pm_orange_cash', 'pm_vodafone_cash', 'pm_we_pay', 'pm_paypal', 'pm_credit_card', 'pm_google_pay', 'pm_apple_pay']) {
          pm[k] = s[k] !== '0'; // default is enabled unless explicitly "0"
        }
        setEnabledMethods(pm);

        // Auto-select first available method if current default is disabled
        const ewalletOn = pm.pm_vodafone_cash || pm.pm_orange_cash || pm.pm_we_pay;
        const methodAvail: [Method, boolean][] = [
          ["ewallet", ewalletOn],
          ["paypal", pm.pm_paypal],
          ["apple_iap", pm.pm_apple_pay && !coachId && (platform === "ios" || !native)],
          ["google_iap", pm.pm_google_pay && !coachId && (platform === "android" || !native)],
        ];
        const curAvail = methodAvail.find(([m]) => m === method)?.[1];
        if (!curAvail) {
          const first = methodAvail.find(([, ok]) => ok);
          if (first) setMethod(first[0]);
        }

        // Auto-select first available wallet type
        const walletAvail: ("vodafone" | "orange" | "we")[] = [];
        if (pm.pm_vodafone_cash) walletAvail.push("vodafone");
        if (pm.pm_orange_cash) walletAvail.push("orange");
        if (pm.pm_we_pay) walletAvail.push("we");
        if (walletAvail.length && !walletAvail.includes(walletType)) {
          setWalletType(walletAvail[0]);
        }

        setSettingsLoaded(true);
      })
      .catch(() => setSettingsLoaded(true));
  }, [type]);

  // ── PayPal rendering ────────────────────────────────────────────────────────
  useEffect(() => {
    if (method !== "paypal" || !paypalClientId || !settingsLoaded) return;
    if (paypalRendered.current && loadedClientId.current === paypalClientId) return;

    const renderButtons = () => {
      if (!window.paypal || !paypalContainerRef.current) { setTimeout(renderButtons, 200); return; }
      paypalContainerRef.current.innerHTML = "";
      paypalRendered.current = false;
      loadedClientId.current = paypalClientId;
      paypalRendered.current = true;
      window.paypal.Buttons({
        style: { layout: "vertical", color: "gold", shape: "rect", label: "pay", height: 45 },
        createOrder: async () => {
          const res = await api("/api/payments/paypal/create-order", { method: "POST", body: JSON.stringify({ amount: amount.toFixed(2), plan, type, coachId, coachName }) });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || "Failed to create order");
          return data.id;
        },
        onApprove: async (data: any) => {
          const res = await api("/api/payments/paypal/capture-order", { method: "POST", body: JSON.stringify({ orderId: data.orderID, plan, type, amount, coachId, packageId }) });
          const result = await res.json();
          if (!res.ok) { onError?.(result.message || "Capture failed"); return; }
          onSuccess();
        },
        onError: () => { onError?.("PayPal encountered an error. Please try another method."); },
        onCancel: () => { onError?.("Payment was cancelled."); },
      }).render(paypalContainerRef.current);
    };

    const existingScript = document.querySelector(`script[src*="paypal.com/sdk"]`);
    if (existingScript && !existingScript.getAttribute("src")?.includes(paypalClientId)) {
      existingScript.remove();
      (window as any).paypal = undefined;
      paypalRendered.current = false;
    }

    if (!document.querySelector(`script[src*="${paypalClientId}"]`)) {
      const script = document.createElement("script");
      script.src = `https://www.paypal.com/sdk/js?client-id=${paypalClientId}&currency=USD`;
      script.async = true;
      script.onload = renderButtons;
      document.head.appendChild(script);
    } else {
      renderButtons();
    }
  }, [method, paypalClientId, settingsLoaded, amount]);

  // ── Apple / Google IAP ──────────────────────────────────────────────────────
  const handleIAPPurchase = async () => {
    setIapProcessing(true);
    setIapError("");
    try {
      const Capacitor = (window as any).Capacitor;
      if (!Capacitor?.isNativePlatform?.()) {
        setIapError(`In-app purchases are only available in the mobile app. Please use E-Wallet or PayPal on web.`);
        return;
      }
      setIapError(`To complete your purchase, please use the FitWay Hub mobile app from the ${platform === "ios" ? "App Store" : "Google Play Store"}.`);
    } catch (err: any) {
      setIapError(err.message || "Purchase failed");
    } finally {
      setIapProcessing(false);
    }
  };

  // ── E-Wallet Submit ─────────────────────────────────────────────────────────
  const handleEwalletSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEwalletError("");
    if (!senderNumber.trim()) { setEwalletError("Please enter your wallet number."); return; }
    if (!proofFile) { setEwalletError("Please upload a screenshot of the transaction."); return; }
    setEwalletProcessing(true);
    try {
      const formData = new FormData();
      formData.append("plan", plan);
      formData.append("type", type);
      formData.append("walletType", walletType);
      formData.append("senderNumber", senderNumber);
      formData.append("proof", proofFile);
      if (coachId) formData.append("coachId", coachId.toString());
      if (packageId) formData.append("packageId", packageId);
      const res = await apiFetch("/api/payments/ewallet", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
      if (!res.ok) {
        const text = await res.text();
        let message = "Payment submission failed.";
        try {
          const parsed = JSON.parse(text || "{}");
          if (parsed?.message) message = parsed.message;
        } catch {
          if (text?.trim()) message = text.trim();
          else message = `Payment submission failed (HTTP ${res.status}).`;
        }
        throw new Error(message);
      }
      setEwalletSuccess(true);
    } catch (err: any) {
      setEwalletError(err.message || "Failed to submit payment.");
    } finally {
      setEwalletProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setProofPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const walletColors: Record<string, string> = { vodafone: "#E60000", orange: "#FF6900", we: "#7B2D8E" };
  const walletColor = walletColors[walletType];

  // ── Success state ───────────────────────────────────────────────────────────
  if (ewalletSuccess) {
    return (
      <div className="px-4 py-7 text-center">
        <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-[color-mix(in_srgb,var(--amber)_16%,transparent)]">
          <CheckCircle size={32} strokeWidth={2} className="text-[var(--amber)]" />
        </div>
        <p className="mb-2 text-[18px] font-bold text-foreground">Proof Submitted!</p>
        <p className="mb-5 text-[14px] leading-relaxed text-muted-foreground">
          Your payment screenshot was sent for admin review.<br/>
          <strong className="text-[var(--amber)]">
            {coachId
              ? "Admin will verify payment, then your coach can accept or decline the request."
              : "Your account will be activated once approved."}
          </strong>
        </p>
        <Button variant="secondary" onClick={onSuccess}>Close</Button>
      </div>
    );
  }

  // ── Method button helper ────────────────────────────────────────────────────
  const methodBtn = (m: Method, icon: React.ReactNode, label: string, sublabel?: string) => (
    <button
      type="button"
      onClick={() => { setMethod(m); paypalRendered.current = false; }}
      aria-pressed={method === m}
      className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md px-1.5 py-2.5 text-[11px] font-semibold transition-all active:scale-[0.97] ${
        method === m
          ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/40"
          : "bg-muted text-muted-foreground ring-1 ring-inset ring-border"
      }`}
    >
      {icon}
      <span className="text-center leading-tight">{label}</span>
      {sublabel && <span className="text-[9px] font-normal text-muted-foreground">{sublabel}</span>}
    </button>
  );

  return (
    <div className="flex flex-col gap-5">
      {/* ── Payment Method Selector ──────────────────────────────────── */}
      <div>
        <p className="mb-2.5 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">Payment Method</p>
        <div className="flex flex-wrap gap-1.5">
          {(enabledMethods.pm_vodafone_cash || enabledMethods.pm_orange_cash || enabledMethods.pm_we_pay) && methodBtn("ewallet",
            <Smartphone size={18} strokeWidth={2} />,
            "E-Wallet"
          )}
          {enabledMethods.pm_paypal && methodBtn("paypal",
            <img src="https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_37x23.jpg" alt="PayPal" className="h-[18px] rounded-sm" />,
            "PayPal"
          )}
          {enabledMethods.pm_apple_pay && !coachId && (platform === "ios" || !native) && methodBtn("apple_iap",
            <span className="text-[18px]">🍎</span>,
            "Apple Pay",
            native ? "" : "iOS App"
          )}
          {enabledMethods.pm_google_pay && !coachId && (platform === "android" || !native) && methodBtn("google_iap",
            <span className="text-[18px]">▶️</span>,
            "Google Pay",
            native ? "" : "Android"
          )}
        </div>
      </div>

      {/* ── PayPal ─────────────────────────────────────────────────────── */}
      {method === "paypal" && (
        <div>
          {!settingsLoaded ? (
            <div className="px-4 py-6 text-center text-[13px] text-muted-foreground">Loading payment options…</div>
          ) : !paypalClientId ? (
            <div className="flex items-start gap-3 rounded-md bg-[color-mix(in_srgb,var(--amber)_10%,transparent)] px-[18px] py-4">
              <AlertCircle size={20} strokeWidth={2} className="mt-px shrink-0 text-[var(--amber)]" />
              <div>
                <p className="mb-1 text-[14px] font-semibold text-[var(--amber)]">PayPal Not Configured</p>
                <p className="text-[13px] text-muted-foreground">Please use another payment method.</p>
              </div>
            </div>
          ) : (
            <>
              <p className="mb-3.5 text-center text-[13px] text-muted-foreground">You'll be redirected to PayPal to complete your payment securely.</p>
              <div ref={paypalContainerRef} style={{ minHeight: 50 }} />
            </>
          )}
        </div>
      )}

      {/* ── E-Wallet ───────────────────────────────────────────────────── */}
      {method === "ewallet" && (
        <form onSubmit={handleEwalletSubmit} className="flex flex-col gap-4">
          <div>
            <p className="mb-2.5 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">Select Wallet</p>
            <div className="flex gap-2">
              {([
                { id: "vodafone" as const, label: "Vodafone Cash", icon: "🔴", color: "#E60000", key: "pm_vodafone_cash" },
                { id: "orange" as const, label: "Orange Cash", icon: "🟠", color: "#FF6900", key: "pm_orange_cash" },
                { id: "we" as const, label: "WE Pay", icon: "🟣", color: "#7B2D8E", key: "pm_we_pay" },
              ]).filter(w => enabledMethods[w.key]).map(w => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setWalletType(w.id)}
                  aria-pressed={walletType === w.id}
                  className="flex flex-1 flex-col items-center gap-1.5 rounded-md bg-muted px-1.5 py-3 ring-1 ring-inset transition-all active:scale-[0.97]"
                  style={{
                    backgroundColor: walletType === w.id ? `${w.color}18` : undefined,
                    ["--tw-ring-color" as any]: walletType === w.id ? w.color : "var(--border)",
                  }}
                >
                  <span className="text-[22px]">{w.icon}</span>
                  <span className="text-[11px] font-bold" style={{ color: w.color }}>{w.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-md p-4" style={{ backgroundColor: `${walletColor}14` }}>
            <p className="mb-3 text-[12px] font-bold text-foreground">📱 Transfer Instructions</p>
            <div className="flex flex-col gap-2.5">
              <div className="text-[13px] text-foreground">1. Send <strong style={{ color: walletColor }}>{amount} EGP</strong> to:</div>
              <div className="flex items-center justify-between rounded-md bg-card px-4 py-3 shadow-soft-sm">
                <span className="font-mono text-[20px] font-extrabold tracking-[2px]" style={{ color: walletColor }}>{ewalletPhones[walletType] || "—"}</span>
                <Button type="button" variant="secondary" size="sm" onClick={() => navigator.clipboard?.writeText(ewalletPhones[walletType] || "")}>Copy</Button>
              </div>
              <div className="text-[13px] text-muted-foreground">2. Take a screenshot of the confirmation</div>
              <div className="text-[13px] text-muted-foreground">3. Upload it below</div>
            </div>
          </div>
          <div>
            <Label htmlFor="ewallet-sender" className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Your Wallet Number</Label>
            <Input id="ewallet-sender" type="tel" value={senderNumber} onChange={(e) => setSenderNumber(e.target.value.replace(/[\s]/g, "").slice(0, 15))} placeholder="e.g. 01012345678" />
          </div>
          <div>
            <Label className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Transaction Screenshot *</Label>
            <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
            {proofPreview ? (
              <div className="relative">
                <img src={proofPreview} alt="Payment proof" className="max-h-[200px] w-full rounded-md bg-muted object-contain shadow-soft-sm" />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="secondary"
                  aria-label="Remove screenshot"
                  onClick={() => { setProofFile(null); setProofPreview(null); }}
                  className="absolute top-2 end-2 rounded-full bg-black/60 text-white hover:bg-black/70"
                >
                  <X size={14} strokeWidth={2} />
                </Button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-md bg-muted p-6 ring-1 ring-inset ring-border transition-colors hover:bg-accent">
                <Upload size={24} strokeWidth={2} className="text-muted-foreground" />
                <span className="text-[13px] text-muted-foreground">Click to upload screenshot</span>
                <span className="text-[10px] text-muted-foreground">JPG or PNG — max 5 MB</span>
              </button>
            )}
          </div>
          {ewalletError && <div className="rounded-md bg-destructive/10 px-3.5 py-2.5 text-[13px] text-destructive">{ewalletError}</div>}
          <Button type="submit" disabled={ewalletProcessing || !proofFile} size="lg" className="w-full">
            <CheckCircle size={16} strokeWidth={2} /> {ewalletProcessing ? "Submitting…" : "Submit Payment Proof"}
          </Button>
        </form>
      )}

      {/* ── Apple IAP ──────────────────────────────────────────────────── */}
      {method === "apple_iap" && (
        <div className="flex flex-col gap-3.5">
          <Card className="gap-0 p-4 text-center shadow-soft-sm">
            <span className="text-[40px]">🍎</span>
            <p className="mt-2 mb-1.5 text-[16px] font-bold text-foreground">Apple In-App Purchase</p>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {native
                ? "Complete your purchase using your Apple ID payment method. Charged directly through the App Store."
                : "Apple Pay is available in the FitWay Hub iOS app. Download from the App Store to use Apple's secure in-app purchases."}
            </p>
          </Card>
          {iapError && (
            <div className="rounded-md bg-[color-mix(in_srgb,var(--amber)_10%,transparent)] px-3.5 py-2.5 text-[13px] text-[var(--amber)]">
              {iapError}
            </div>
          )}
          <Button
            onClick={handleIAPPurchase}
            disabled={iapProcessing}
            size="lg"
            className="w-full bg-black text-white hover:bg-black/90"
          >
            🍎 {iapProcessing ? "Processing…" : `Buy with Apple Pay — ${amount} EGP`}
          </Button>
        </div>
      )}

      {/* ── Google IAP ─────────────────────────────────────────────────── */}
      {method === "google_iap" && (
        <div className="flex flex-col gap-3.5">
          <Card className="gap-0 p-4 text-center shadow-soft-sm">
            <span className="text-[40px]">▶️</span>
            <p className="mt-2 mb-1.5 text-[16px] font-bold text-foreground">Google Play Purchase</p>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {native
                ? "Complete your purchase using your Google account payment method. Charged directly through Google Play."
                : "Google Play payments are available in the FitWay Hub Android app. Download from Google Play to use in-app purchases."}
            </p>
          </Card>
          {iapError && (
            <div className="rounded-md bg-[color-mix(in_srgb,var(--amber)_10%,transparent)] px-3.5 py-2.5 text-[13px] text-[var(--amber)]">
              {iapError}
            </div>
          )}
          <Button
            onClick={handleIAPPurchase}
            disabled={iapProcessing}
            size="lg"
            className="w-full text-white"
            style={{ background: "linear-gradient(135deg, #34A853, #1B873B)" }}
          >
            ▶️ {iapProcessing ? "Processing…" : `Buy with Google Play — ${amount} EGP`}
          </Button>
        </div>
      )}

      {/* ── Security note ──────────────────────────────────────────────── */}
      <p className="inline-flex items-center justify-center gap-1.5 text-center text-[11px] leading-relaxed text-muted-foreground">
        <ShieldCheck size={13} strokeWidth={2} className="shrink-0 text-[var(--green)]" />
        All payments are secured with 256-bit SSL encryption.
        {method === "apple_iap" ? " Managed by Apple." : ""}
        {method === "google_iap" ? " Managed by Google." : ""}
        {" "}Cancel anytime.
      </p>
    </div>
  );
}
