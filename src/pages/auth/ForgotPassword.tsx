import { useState, useEffect, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, ShieldQuestion, Activity, ArrowLeft, Eye, EyeOff, CheckCircle, KeyRound } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/context/I18nContext";
import { useBranding, getBrandLogoForLang } from "@/context/BrandingContext";
import { usePageTitle } from "@/lib/usePageMeta";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "email" | "answer" | "otp" | "done";
type Method = "otp" | "security";

export default function ForgotPassword() {
  const { t, lang } = useI18n();
  const { branding } = useBranding();
  usePageTitle(`${lang === "ar" ? "استعادة كلمة المرور" : "Reset Password"} — ${branding?.app_name || "FitWay Hub"}`);
  const { isDark } = useTheme();
  const brandLogo = getBrandLogoForLang(branding, lang, isDark);
  const [method, setMethod] = useState<Method>("otp"); // OTP is the default; security questions remain as a fallback.
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [question, setQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);
  const navigate = useNavigate();

  const questionMap: Record<string, string> = {
    "What was the name of your first pet?": t("security_question_1"),
    "What city were you born in?": t("security_question_2"),
    "What is your mother's maiden name?": t("security_question_3"),
    "What was the name of your first school?": t("security_question_4"),
    "What is your favorite childhood movie?": t("security_question_5"),
    "What was the make of your first car?": t("security_question_6"),
  };

  const localizedQuestion = questionMap[question] || question;

  const requestEmailOtp = async () => {
    const res = await apiFetch("/api/auth/forgot-password/request-otp", {
      skip401: true,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Failed to send code");
    setResendCooldown(30);
    setInfo(data.message || `A code was sent to ${email} if an account exists.`);
  };

  const handleSubmitEmail = async (e: FormEvent) => {
    e.preventDefault();
    setError(""); setInfo("");
    if (!email.trim()) { setError(t("please_enter_your_email")); return; }
    setIsLoading(true);
    try {
      if (method === "security") {
        const res = await apiFetch("/api/auth/forgot-password/question", {
      skip401: true,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || t("account_not_found"));
        setQuestion(data.question);
        setStep("answer");
      } else {
        await requestEmailOtp();
        setStep("otp");
      }
    } catch (err: any) {
      setError(err.message || t("failed_find_account"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError(""); setInfo("");
    setIsLoading(true);
    try { await requestEmailOtp(); } catch (err: any) { setError(err.message); }
    finally { setIsLoading(false); }
  };

  const handleOtpReset = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (otp.trim().length !== 6) { setError("Enter the 6-digit code"); return; }
    if (newPassword.length < 8) { setError(t("password_min_8_chars")); return; }
    setIsLoading(true);
    try {
      const res = await apiFetch("/api/auth/forgot-password/otp-reset", {
      skip401: true,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: otp.trim(), newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || t("verification_failed"));
      setStep("done");
    } catch (err: any) {
      setError(err.message || t("failed_reset_password"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAndReset = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!securityAnswer.trim()) { setError(t("please_enter_your_answer")); return; }
    if (newPassword.length < 8) { setError(t("password_min_8_chars")); return; }
    setIsLoading(true);
    try {
      const res = await apiFetch("/api/auth/forgot-password/verify", {
      skip401: true,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, securityAnswer, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || t("verification_failed"));
      setStep("done");
    } catch (err: any) {
      setError(err.message || t("failed_reset_password"));
    } finally {
      setIsLoading(false);
    }
  };

  const fieldLabel = "text-[12px] font-semibold tracking-wide text-muted-foreground uppercase";

  return (
    <div className="flex min-h-[100dvh] bg-background">
      {/* Left panel */}
      <div className="relative hidden w-[45%] flex-col justify-between overflow-hidden bg-card p-12 lg:flex">
        <div className="pointer-events-none absolute bottom-[20%] start-[5%] size-[300px] rounded-full bg-primary opacity-[0.07] blur-[80px]" />
        {brandLogo ? (
          <img src={brandLogo} alt={branding.app_name || t("fitway_hub")} className="h-9 self-start rounded-lg object-contain" />
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-full bg-primary"><Activity size={18} className="text-primary-foreground" /></div>
            <span className="text-[20px] font-bold tracking-wide">{branding.app_name || t("fitway_hub")}</span>
          </div>
        )}
        <div>
          <p className="mb-4 text-[32px] font-bold leading-[1.15] tracking-tight">
            {t("dont_worry")}<br /><span className="text-primary">{t("weve_got_you")}</span>
          </p>
          <p className="max-w-[340px] text-[14px] leading-relaxed text-muted-foreground">{t("forgot_password_helper")}</p>
        </div>
        <div />
      </div>

      {/* Right: form */}
      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="fade-up w-full max-w-[420px]">
          <button type="button" onClick={() => navigate("/auth/login")} className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft size={14} className="rtl:rotate-180" /> {t("back_to_login")}
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

          {step === "done" ? (
            <div className="py-10 text-center">
              <div className="mx-auto mb-5 grid size-16 place-items-center rounded-full bg-primary/15">
                <CheckCircle size={32} className="text-primary" />
              </div>
              <h1 className="mb-2 text-[24px] font-bold tracking-tight">{t("password_reset_success")}</h1>
              <p className="mb-7 text-[14px] text-muted-foreground">{t("password_reset_success_desc")}</p>
              <Button onClick={() => navigate("/auth/login")} size="lg" className="px-8">{t("sign_in_now")}</Button>
            </div>
          ) : (
            <>
              <h1 className="mb-1.5 text-[28px] font-bold tracking-tight">
                {step === "email" ? t("forgot_password_title") : t("verify_identity")}
              </h1>
              <p className="mb-7 text-[14px] text-muted-foreground">
                {step === "email" ? t("forgot_password_step_desc") : t("verify_identity_step_desc")}
              </p>

              {/* Progress dots */}
              <div className="mb-6 flex gap-2">
                <div className="h-1 w-10 rounded-full bg-primary" />
                <div className={cn("h-1 w-10 rounded-full", step === "answer" || step === "otp" ? "bg-primary" : "bg-border")} />
              </div>

              {error && (
                <div className="mb-5 rounded-md bg-destructive/10 p-3.5 text-[13px] text-destructive ring-1 ring-inset ring-destructive/20">{error}</div>
              )}
              {info && !error && (
                <div className="mb-5 rounded-md bg-primary/10 p-3.5 text-[13px] text-primary ring-1 ring-inset ring-primary/25">{info}</div>
              )}

              {step === "email" && (
                <>
                  {/* Recovery method toggle. Default is email OTP; security question is a fallback. */}
                  <div className="mb-4 grid grid-cols-2 gap-1.5 rounded-full bg-muted p-1">
                    {([
                      { val: "otp" as const, label: "Email code", Icon: Mail },
                      { val: "security" as const, label: "Security question", Icon: ShieldQuestion },
                    ]).map(({ val, label, Icon }) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setMethod(val)}
                        className={cn(
                          "flex items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-[13px] font-semibold transition",
                          method === val ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                        )}
                      >
                        <Icon size={14} />
                        {label}
                      </button>
                    ))}
                  </div>
                  <form onSubmit={handleSubmitEmail} className="flex flex-col gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="fp-email" className={fieldLabel}>{t("email_or_username")}</Label>
                      <div className="relative">
                        <Mail size={16} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input id="fp-email" type="text" value={email} onChange={(e) => setEmail(e.target.value)} className="ps-10" placeholder="you@example.com" required autoFocus />
                      </div>
                    </div>
                    <Button type="submit" size="lg" disabled={isLoading} className="mt-1 w-full">
                      {isLoading ? t("looking_up") : t("continue_label")}
                    </Button>
                  </form>
                </>
              )}

              {step === "otp" && (
                <form onSubmit={handleOtpReset} className="flex flex-col gap-4">
                  <div className="rounded-md bg-primary/8 p-4 ring-1 ring-inset ring-primary/20">
                    <div className="mb-1.5 flex items-center gap-2">
                      <Mail size={16} className="text-primary" />
                      <span className="text-[12px] font-semibold tracking-wide text-primary uppercase">Check your email</span>
                    </div>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">If <strong className="text-foreground">{email}</strong> has an account, we sent a 6-digit code. It expires in 2 minutes.</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="fp-otp" className={fieldLabel}>Verification code</Label>
                    <div className="relative">
                      <KeyRound size={16} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input id="fp-otp" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} className="ps-10 font-mono text-[18px] tracking-[0.5em]" placeholder="000000" required autoFocus />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="fp-newpass" className={fieldLabel}>{t("new_password")}</Label>
                    <div className="relative">
                      <Lock size={16} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input id="fp-newpass" type={showPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="ps-10 pe-11" placeholder={t("min_chars")} required />
                      <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)} className="absolute end-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground">
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <Button type="submit" size="lg" disabled={isLoading || otp.length !== 6} className="mt-1 w-full">
                    {isLoading ? t("verifying") : t("reset_password")}
                  </Button>
                  <div className="flex items-center justify-between text-[13px]">
                    <button type="button" onClick={() => { setStep("email"); setError(""); setInfo(""); setOtp(""); }} className="text-muted-foreground transition-colors hover:text-foreground">← {t("try_different_email")}</button>
                    <button type="button" onClick={handleResendOtp} disabled={resendCooldown > 0 || isLoading} className={cn("font-semibold", resendCooldown > 0 ? "text-muted-foreground" : "text-primary")}>
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                    </button>
                  </div>
                </form>
              )}

              {step === "answer" && (
                <form onSubmit={handleVerifyAndReset} className="flex flex-col gap-4">
                  {/* Show the question */}
                  <div className="rounded-md bg-primary/8 p-4 ring-1 ring-inset ring-primary/20">
                    <div className="mb-1.5 flex items-center gap-2">
                      <ShieldQuestion size={16} className="text-primary" />
                      <span className="text-[12px] font-semibold tracking-wide text-primary uppercase">{t("security_question_label")}</span>
                    </div>
                    <p className="text-[14px] font-semibold text-foreground">{localizedQuestion}</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="fp-answer" className={fieldLabel}>{t("your_answer")}</Label>
                    <div className="relative">
                      <ShieldQuestion size={16} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input id="fp-answer" type="text" value={securityAnswer} onChange={(e) => setSecurityAnswer(e.target.value)} className="ps-10" placeholder={t("type_your_answer")} required autoFocus />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="fp-newpass2" className={fieldLabel}>{t("new_password")}</Label>
                    <div className="relative">
                      <Lock size={16} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input id="fp-newpass2" type={showPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="ps-10 pe-11" placeholder={t("min_chars")} required aria-invalid={newPassword.length > 0 && newPassword.length < 8} />
                      <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)} className="absolute end-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground">
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {newPassword.length > 0 && newPassword.length < 8 && (
                      <p className="mt-1 text-[11px] text-destructive">⚠ {8 - newPassword.length} {lang === "ar" ? "حرف كمان" : `more character${8 - newPassword.length !== 1 ? "s" : ""} needed`}</p>
                    )}
                  </div>

                  <Button type="submit" size="lg" disabled={isLoading} className="mt-1 w-full">
                    {isLoading ? t("verifying") : t("reset_password")}
                  </Button>
                  <button type="button" onClick={() => { setStep("email"); setError(""); }} className="mt-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
                    ← {t("try_different_email")}
                  </button>
                </form>
              )}
            </>
          )}

          <p className="mt-7 text-center text-[14px] text-muted-foreground">
            {t("remember_your_password")}{" "}
            <Link to="/auth/login" className="font-semibold text-primary no-underline">{t("sign_in_link")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
