import { useState, useEffect, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useBranding, getBrandLogoForLang } from "@/context/BrandingContext";
import { useTheme } from "@/context/ThemeContext";
import { getApiBase } from "@/lib/api";
import { Eye, EyeOff, Mail, Lock, User, Activity, CheckCircle2, Dumbbell, Trophy, Chrome, ArrowLeft, ShieldQuestion, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your mother's maiden name?",
  "What was the name of your first school?",
  "What is your favorite childhood movie?",
  "What was the make of your first car?",
];

export default function Register() {
  const { t, lang } = useI18n();
  const { branding } = useBranding();
  const { isDark } = useTheme();
  const brandLogo = getBrandLogoForLang(branding, lang, isDark);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [role, setRole] = useState<"user" | "coach">("user");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // OTP step state. The form is filled out first; once "Continue" is clicked
  // we POST /register/request-otp, show the OTP screen, and the actual
  // /register call happens after the user types the 6-digit code.
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [info, setInfo] = useState("");
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  const [liveStats, setLiveStats] = useState({ members: 0, programs: 0, rating: "5.0" });
  useEffect(() => {
    fetch(`${getApiBase()}/api/public/stats`)
      .then(r => r.json())
      .then(d => setLiveStats({ members: d.members || 0, programs: d.programs || 0, rating: d.rating || "5.0" }))
      .catch(() => {});
  }, []);
  const { register } = useAuth();
  const navigate = useNavigate();

  const startSocialSignup = (provider: "google") => {
    const base = getApiBase();
    const cap = (window as any).Capacitor;
    const isNative = typeof cap?.isNativePlatform === 'function' && cap.isNativePlatform();
    const qs = isNative ? '?platform=mobile' : '';
    window.location.href = `${base}/api/auth/oauth/${provider}${qs}`;
  };

  const requestOtp = async () => {
    setError(""); setInfo("");
    const res = await fetch(`${getApiBase()}/api/auth/register/request-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Failed to send code");
    setInfo(data.message || `Code sent to ${email}`);
    setResendCooldown(30);
  };

  const handleContinueToOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) { setError(t("valid_email")); return; }
    if (password.length < 8) { setError(t("password_min")); return; }
    if (!securityQuestion) { setError(t("security_question_pick")); return; }
    if (!securityAnswer.trim()) { setError(t("security_answer_placeholder")); return; }
    setIsLoading(true);
    try {
      await requestOtp();
      setOtpStep(true);
    } catch (err: any) {
      setError(err.message || "Failed to send verification code");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    try { await requestOtp(); } catch (err: any) { setError(err.message); }
    finally { setIsLoading(false); }
  };

  const handleVerifyAndRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (otp.trim().length !== 6) { setError("Enter the 6-digit code"); return; }
    setIsLoading(true);
    try {
      await register(email, password, name, role, securityQuestion, securityAnswer, otp.trim());
      if (role === "coach") {
        navigate("/coach/dashboard");
      } else {
        navigate("/app/onboarding");
      }
    } catch (err: any) {
      setError(err.message || t("failed_register"));
    } finally {
      setIsLoading(false);
    }
  };

  const perks = [t("perk_programs"), t("perk_steps"), t("perk_community"), t("perk_free_start")];
  const securityQuestionLabels: Record<string, string> = {
    "What was the name of your first pet?": t("security_question_1"),
    "What city were you born in?": t("security_question_2"),
    "What is your mother's maiden name?": t("security_question_3"),
    "What was the name of your first school?": t("security_question_4"),
    "What is your favorite childhood movie?": t("security_question_5"),
    "What was the make of your first car?": t("security_question_6"),
  };

  const stats = [
    { v: liveStats.members > 0 ? `${liveStats.members.toLocaleString()}+` : "—", l: t("members") },
    { v: liveStats.programs > 0 ? `${liveStats.programs}+` : "—", l: t("programs") },
    { v: `${liveStats.rating}★`, l: t("rating") },
  ];

  return (
    <div className="flex min-h-[100dvh] bg-background">
      {/* Left decorative panel */}
      <div className="relative hidden w-[45%] flex-col justify-between overflow-hidden bg-card p-12 lg:flex">
        <div className="pointer-events-none absolute top-[30%] end-[-10%] size-[300px] rounded-full bg-primary opacity-[0.07] blur-[80px]" />
        {brandLogo ? (
          <img src={brandLogo} alt={branding.app_name || t("fitway_hub")} className="h-9 self-start rounded-lg object-contain" />
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-full bg-primary"><Activity size={18} className="text-primary-foreground" /></div>
            <span className="text-[20px] font-bold tracking-wide">{branding.app_name || t("fitway_hub")}</span>
          </div>
        )}
        <div className="relative z-10">
          <p className="mb-7 text-[32px] font-bold leading-[1.15] tracking-tight">
            {t("join_members_prefix")}<br /><span className="text-primary">{t("join_members_highlight")}</span>
          </p>
          <div className="flex flex-col gap-3">
            {perks.map((p) => (
              <div key={p} className="flex items-center gap-2.5">
                <CheckCircle2 size={16} className="shrink-0 text-primary" />
                <span className="text-[14px] text-muted-foreground">{p}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-6">
          {stats.map((s) => (
            <div key={s.l}>
              <p className="text-[22px] font-bold tabular-nums text-primary">{s.v}</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right: form */}
      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="fade-up w-full max-w-[420px]">
          <button type="button" onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft size={14} className="rtl:rotate-180" /> {t("back")}
          </button>

          <Link to="/" aria-label="Home" className="mb-8 flex items-center gap-2.5 no-underline text-inherit lg:hidden">
            {brandLogo ? (
              <img src={brandLogo} alt={branding.app_name || t("fitway_hub")} className="h-8 rounded-lg object-contain" />
            ) : (
              <>
                <div className="grid size-7 place-items-center rounded-full bg-primary"><Activity size={15} className="text-primary-foreground" /></div>
                <span className="text-[18px] font-bold">{branding.app_name || t("fitway_hub")}</span>
              </>
            )}
          </Link>

          <h1 className="mb-1.5 text-[28px] font-bold tracking-tight">{t("create_account")}</h1>
          <p className="mb-6 text-[14px] text-muted-foreground">{t("join_community_start")}</p>

          {/* Role Selection */}
          <div className="mb-6">
            <p className="mb-2.5 text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">{t("joining_as")}</p>
            <div className="grid grid-cols-2 gap-2.5">
              {([
                { val: "user", label: t("athlete"), desc: t("train_progress"), Icon: Trophy },
                { val: "coach", label: t("coach"), desc: t("membership_required"), Icon: Dumbbell },
              ] as const).map(({ val, label, desc, Icon }) => {
                const active = role === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setRole(val)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-md p-3.5 text-center transition active:scale-[0.98]",
                      active ? "bg-primary/10 ring-2 ring-inset ring-primary" : "bg-muted",
                    )}
                  >
                    <div className={cn("grid size-10 place-items-center rounded-full transition-colors", active ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground")}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <p className={cn("text-[13px] font-bold", active ? "text-primary" : "text-foreground")}>{label}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="mb-5 rounded-md bg-destructive/10 p-3.5 text-[13px] text-destructive ring-1 ring-inset ring-destructive/20">{error}</div>
          )}
          {info && !error && (
            <div className="mb-5 rounded-md bg-primary/10 p-3.5 text-[13px] text-primary ring-1 ring-inset ring-primary/25">{info}</div>
          )}

          {otpStep ? (
            <form onSubmit={handleVerifyAndRegister} className="flex flex-col gap-4">
              <div className="rounded-md bg-primary/8 p-4 ring-1 ring-inset ring-primary/20">
                <div className="mb-1.5 flex items-center gap-2">
                  <Mail size={16} className="text-primary" />
                  <span className="text-[12px] font-semibold tracking-wide text-primary uppercase">Check your email</span>
                </div>
                <p className="text-[13px] leading-relaxed text-muted-foreground">We sent a 6-digit code to <strong className="text-foreground">{email}</strong>. It expires in 2 minutes.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="otp" className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">Verification code</Label>
                <div className="relative">
                  <KeyRound size={16} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input id="otp" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} className="ps-10 font-mono text-[18px] tracking-[0.5em]" placeholder="000000" required autoFocus />
                </div>
              </div>
              <Button type="submit" size="lg" disabled={isLoading || otp.length !== 6} className="mt-1 w-full">
                {isLoading ? t("creating_account") : "Verify & create account"}
              </Button>
              <div className="flex items-center justify-between text-[13px]">
                <button type="button" onClick={() => { setOtpStep(false); setOtp(""); setInfo(""); }} className="text-muted-foreground transition-colors hover:text-foreground">← Back</button>
                <button type="button" onClick={handleResendOtp} disabled={resendCooldown > 0 || isLoading} className={cn("font-semibold", resendCooldown > 0 ? "text-muted-foreground" : "text-primary")}>
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleContinueToOtp} className="flex flex-col gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="reg-name" className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">{t("full_name")}</Label>
                <div className="relative">
                  <User size={16} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input id="reg-name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="ps-10" placeholder={lang === "ar" ? "اسمك بالكامل" : "John Doe"} required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-email" className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">{t("email_label")}</Label>
                <div className="relative">
                  <Mail size={16} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="ps-10" placeholder="you@example.com" required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-password" className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">{t("password_label")}</Label>
                <div className="relative">
                  <Lock size={16} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input id="reg-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="ps-10 pe-11" placeholder={t("min_chars")} required aria-invalid={!!password && password.length < 8} />
                  <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)} className="absolute end-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div className="mt-2 flex flex-col gap-1">
                  {[
                    { ok: password.length >= 8, label: lang === "ar" ? "٨ أحرف على الأقل" : "At least 8 characters" },
                    { ok: /[A-Z]/.test(password), label: lang === "ar" ? "حرف كبير واحد على الأقل" : "At least one uppercase letter" },
                    { ok: /[0-9]/.test(password), label: lang === "ar" ? "رقم واحد على الأقل" : "At least one number" },
                    { ok: /[^A-Za-z0-9]/.test(password), label: lang === "ar" ? "رمز خاص واحد على الأقل" : "At least one special character" },
                  ].map((rule) => (
                    <p key={rule.label} className="flex items-center gap-1.5 text-[11px]" style={{ color: !password ? "var(--text-muted)" : rule.ok ? "var(--green)" : "var(--red)" }}>
                      {!password ? "○" : rule.ok ? "✓" : "✗"} {rule.label}
                    </p>
                  ))}
                </div>
              </div>
              {/* Security Question */}
              <div className="space-y-1.5">
                <Label className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">{t("security_question_label")}</Label>
                <Select value={securityQuestion} onValueChange={setSecurityQuestion} required>
                  <SelectTrigger className="w-full">
                    <span className="flex items-center gap-2.5 truncate">
                      <ShieldQuestion size={16} className="shrink-0 text-muted-foreground" />
                      <SelectValue placeholder={t("security_question_pick")} />
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {SECURITY_QUESTIONS.map((q) => (
                      <SelectItem key={q} value={q}>{securityQuestionLabels[q] || q}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {securityQuestion && (
                <div className="space-y-1.5">
                  <Label htmlFor="reg-answer" className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">{t("your_answer")}</Label>
                  <div className="relative">
                    <Lock size={16} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input id="reg-answer" type="text" value={securityAnswer} onChange={(e) => setSecurityAnswer(e.target.value)} className="ps-10" placeholder={t("security_answer_placeholder")} required />
                  </div>
                </div>
              )}
              <p className="text-[12px] text-muted-foreground">
                {t("agree_terms")}{" "}
                <a href="#" className="font-medium text-primary no-underline">{t("terms")}</a> and{" "}
                <a href="#" className="font-medium text-primary no-underline">{t("privacy_policy")}</a>.
              </p>
              <Button type="submit" size="lg" disabled={isLoading} className="mt-1 w-full">
                {isLoading ? "Sending code..." : "Continue"}
              </Button>

              <div className="mt-1 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[12px] tracking-wide text-muted-foreground uppercase">{t("or")}</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <Button type="button" variant="outline" size="lg" className="w-full gap-2" onClick={() => startSocialSignup("google")}>
                <Chrome size={16} />
                {t("sign_up_google")}
              </Button>
            </form>
          )}

          <p className="mt-7 text-center text-[14px] text-muted-foreground">
            {t("have_account")}{" "}
            <Link to="/auth/login" className="font-semibold text-primary no-underline">{t("sign_in_link")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
