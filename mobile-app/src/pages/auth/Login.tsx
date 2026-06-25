import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useBranding, getBrandLogoForLang } from "@/context/BrandingContext";
import { useTheme } from "@/context/ThemeContext";
import { getApiBase } from "@/lib/api";
import { openExternal } from "@/lib/nativeAuth";
import { Eye, EyeOff, Mail, Lock, Activity, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";

export default function Login() {
  const { t, lang } = useI18n();
  const { branding } = useBranding();
  const { isDark } = useTheme();
  const brandLogo = getBrandLogoForLang(branding, lang, isDark);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login, user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const coachMembershipRequired = searchParams.get("coach_membership") === "required";
  const navigate = useNavigate();

  const [liveStats, setLiveStats] = useState({ members: 0, programs: 0, rating: "5.0", reviews: 0 });
  useEffect(() => {
    fetch(`${getApiBase()}/api/public/stats`)
      .then(r => r.json())
      .then(d => setLiveStats({ members: d.members || 0, programs: d.programs || 0, rating: d.rating || "5.0", reviews: d.reviews || 0 }))
      .catch(() => {});
  }, []);

  const appRoute = user?.role === "admin"
    ? "/admin/dashboard"
    : user?.role === "coach"
      ? "/coach/dashboard"
      : "/app/dashboard";

  useEffect(() => {
    const oauthError = searchParams.get("error");
    if (oauthError) setError(oauthError);
  }, [searchParams]);

  const startSocialLogin = (provider: "google") => {
    const base = getApiBase();
    const cap = (window as any).Capacitor;
    const isNative = typeof cap?.isNativePlatform === 'function' && cap.isNativePlatform();
    const qs = isNative ? '?platform=mobile' : '';
    // On native, OAuth MUST open in the system browser — Google rejects sign-in
    // inside an embedded WebView ("disallowed_useragent"). openExternal opens
    // the system browser on native and navigates normally on web. The server
    // redirects back via the fitwayhub:// deep link, handled in App.tsx.
    openExternal(`${base}/api/auth/oauth/${provider}${qs}`);
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const data = await login(email, password, rememberMe);
      if (data?.rememberToken) localStorage.setItem("remember_token", data.rememberToken);
      // Redirect based on role
      const role = data?.user?.role || "user";
      if (role === "admin") navigate("/admin/dashboard");
      else if (role === "coach") navigate("/coach/dashboard");
      else navigate("/app/dashboard");
    } catch (err: any) {
      if (err.message?.includes('COACH_MEMBERSHIP_REQUIRED') || err.message?.includes('membership required') || err.message?.includes('membership')) {
        setError(t("coach_membership_msg"));
      } else {
        setError(err.message || t("failed_login"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!loading && user) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-6">
        <Card className="w-full max-w-[440px] gap-4 p-7 shadow-soft-lg">
          <h1 className="text-[24px] font-bold tracking-tight">{t("already_logged_in")}</h1>
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            {t("signed_in_as")} <strong className="text-foreground">{user.email}</strong>. {t("continue_to_account")}
          </p>
          <Button type="button" size="lg" className="w-full" onClick={() => navigate(appRoute)}>
            {t("open_my_account")}
          </Button>
        </Card>
      </div>
    );
  }

  // Show a stat only once it's real (§1.8): no "—", and no hollow "5.0★"
  // until there are actual reviews. Hide the whole row unless ≥3 are meaningful.
  const stats = [
    { show: liveStats.members > 0, v: `${liveStats.members.toLocaleString()}+`, l: t("members") },
    { show: liveStats.programs > 0, v: `${liveStats.programs}+`, l: t("programs") },
    { show: liveStats.reviews > 0, v: `${liveStats.rating}★`, l: t("rating") },
  ].filter(s => s.show);
  const showStats = stats.length >= 3;

  return (
    <div className="flex min-h-[100dvh] bg-background">
      {/* Left decorative panel */}
      <div className="relative hidden w-[45%] flex-col justify-between overflow-hidden bg-card p-12 lg:flex">
        {/* Glow blob */}
        <div className="pointer-events-none absolute bottom-[15%] start-[10%] size-80 rounded-full bg-primary opacity-[0.08] blur-[80px]" />

        {/* Logo — links back to the public site home. */}
        <Link to="/" aria-label="Home" className="self-start no-underline text-inherit">
          {brandLogo ? (
            <img src={brandLogo} alt={branding.app_name || t("fitway_hub")} className="h-9 rounded-lg object-contain" />
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="grid size-8 place-items-center rounded-full bg-primary"><Activity size={18} className="text-primary-foreground" /></div>
              <span className="text-[20px] font-bold tracking-wide">{branding.app_name || t("fitway_hub")}</span>
            </div>
          )}
        </Link>

        {/* Quote block */}
        <div>
          <p className="mb-5 text-[36px] font-bold leading-[1.15] tracking-tight text-foreground">
            {t("transform_body")}<br />
            <span className="text-primary">{t("empower_mind")}</span>
          </p>
          <p className="max-w-[340px] text-[14px] leading-relaxed text-muted-foreground">{t("egypt_fitness")}</p>
        </div>

        {/* Stats row — only shown when ≥3 stats are meaningful (§1.8) */}
        {showStats && (
        <div className="flex gap-8">
          {stats.map((s) => (
            <div key={s.l}>
              <p className="text-[22px] font-bold tabular-nums text-primary">{s.v}</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">{s.l}</p>
            </div>
          ))}
        </div>
        )}
      </div>

      {/* Right: form */}
      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="fade-up w-full max-w-[400px]">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={14} className="rtl:rotate-180" /> {t("back")}
          </button>

          {/* Mobile logo */}
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

          <h1 className="mb-1.5 text-[28px] font-bold tracking-tight">{t("welcome_back")}</h1>
          <p className="mb-8 text-[14px] text-muted-foreground">{t("sign_in_continue")}</p>

          {coachMembershipRequired && (
            <div className="mb-4 rounded-md p-4 ring-1 ring-inset ring-[color-mix(in_srgb,var(--amber)_30%,transparent)]" style={{ background: "color-mix(in srgb, var(--amber) 12%, transparent)" }}>
              <p className="mb-1 text-[13px] font-bold text-[var(--amber)]">{t("coach_membership_required")}</p>
              <p className="text-[12px] text-muted-foreground">{t("coach_membership_msg")}</p>
            </div>
          )}
          {error && (
            <div className="mb-5 rounded-md bg-destructive/10 p-3.5 text-[13px] text-destructive ring-1 ring-inset ring-destructive/20">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="login-email" className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">{t("email_label")}</Label>
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="ps-10" placeholder="you@example.com" required />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="login-password" className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">{t("password_label")}</Label>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input id="login-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="ps-10 pe-11" placeholder="••••••••" required />
                <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)} className="absolute end-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox id="remember" checked={rememberMe} onCheckedChange={(v) => setRememberMe(v === true)} />
                <Label htmlFor="remember" className="cursor-pointer text-[13px] font-normal text-muted-foreground">{t("remember_me")}</Label>
              </div>
              <Link to="/auth/forgot-password" className="text-[13px] font-medium text-primary no-underline transition-opacity hover:opacity-80">{t("forgot_password")}</Link>
            </div>

            {/* Submit */}
            <Button type="submit" size="lg" disabled={isLoading} className="mt-1 w-full">
              {isLoading ? t("signing_in") : t("sign_in")}
            </Button>

            <div className="mt-1 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[12px] tracking-wide text-muted-foreground uppercase">{t("or")}</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <Button type="button" variant="outline" size="lg" className="w-full" onClick={() => startSocialLogin("google")}>
              {t("continue_google")}
            </Button>
          </form>

          <p className="mt-7 text-center text-[14px] text-muted-foreground">
            {t("no_account")}{" "}
            <Link to="/auth/register" className="font-semibold text-primary no-underline">{t("sign_up_free")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
