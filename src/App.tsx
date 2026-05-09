import { App as CapacitorApp } from "@capacitor/app";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { I18nProvider } from '@/context/I18nContext';
import { BrandingProvider, useBranding } from "@/context/BrandingContext";
import { AppImagesProvider } from "@/context/AppImagesContext";
import BrandLoader from "@/components/ui/BrandLoader";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useEffect, useState, lazy, Suspense, Component, type ReactNode } from "react";

// ── Hook: subscribe to Firebase push events ───────────────────────────────────
function useNotif() {
  const [notif, setNotif] = useState<{ title: string; body: string; link?: string } | null>(null);
  useEffect(() => {
    const handle = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setNotif(detail);
      setTimeout(() => setNotif(null), 5000);
    };
    window.addEventListener("fitway:push", handle);
    return () => window.removeEventListener("fitway:push", handle);
  }, []);
  return [notif, setNotif] as const;
}

// ── Error Boundary ─────────────────────────────────────────────────────────────
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  declare state: { error: Error | null };
  declare props: { children: ReactNode };
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)", color: "var(--text-primary)", padding: 24, textAlign: "center", gap: 12 }}>
          <p style={{ fontSize: 32 }}>⚠️</p>
          <p style={{ fontSize: 18, fontWeight: 700 }}>Something went wrong</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 400 }}>Something unexpected happened. Please try reloading the page.</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: 8, padding: "10px 24px", borderRadius: 99, background: "var(--accent)", border: "none", color: "#000000", fontWeight: 700, cursor: "pointer" }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}


// ── Lazy chunk error boundary — catches "Failed to fetch dynamically imported module" ──
class LazyErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; error: string }> {
  declare state: { failed: boolean; error: string };
  declare props: { children: ReactNode };
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { failed: false, error: '' };
  }
  static getDerivedStateFromError(err: Error) { return { failed: true, error: String(err?.message || err) }; }
  componentDidCatch(err: Error, info: React.ErrorInfo) {
    console.error('[LazyErrorBoundary]', err, info.componentStack);
  }
  render() {
    if (this.state.failed) {
      // Only auto-reload for genuine chunk load failures, not runtime errors
      const isChunkError = /loading chunk|dynamically imported module|failed to fetch/i.test(this.state.error);
      if (isChunkError && typeof window !== 'undefined' && !sessionStorage.getItem('lazy_reloaded')) {
        sessionStorage.setItem('lazy_reloaded', '1');
        window.location.reload();
        return null;
      }
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 8, padding: 32 }}>
          <p style={{ fontSize: 18, fontWeight: 700 }}>Failed to load page</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 500, textAlign: 'center', wordBreak: 'break-word' }}>{this.state.error || 'A page module failed to load.'}</p>
          <button onClick={() => { sessionStorage.removeItem('lazy_reloaded'); window.location.reload(); }} style={{ marginTop: 8, padding: '10px 24px', borderRadius: 99, background: 'var(--accent)', border: 'none', color: '#000000', fontWeight: 700, cursor: 'pointer' }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── In-app push notification toast (Placeholder - not used) ──────────────────
// Removing broken implementation that was causing crashes.


const AppLayout = lazy(() => import("@/layouts/AppLayout").then((m) => ({ default: m.AppLayout })));
const AdminLayout = lazy(() => import("@/layouts/AdminLayout").then((m) => ({ default: m.AdminLayout })));
const CoachLayout = lazy(() => import("@/layouts/CoachLayout").then((m) => ({ default: m.CoachLayout })));
const WebsiteLayout = lazy(() => import("@/layouts/WebsiteLayout").then((m) => ({ default: m.WebsiteLayout })));

const CmsPage = lazy(() => import("@/pages/website/CmsPage"));
const HomePage = lazy(() => import("@/pages/website/Home"));
const ComingSoonPage = lazy(() => import("@/pages/website/ComingSoon"));
const PrivacyPolicyPage = lazy(() => import("@/pages/website/PrivacyPolicy"));
const TermsOfServicePage = lazy(() => import("@/pages/website/TermsOfService"));
const AboutPage = lazy(() => import("@/pages/website/About"));
const WebsiteBlogs = lazy(() => import("@/pages/website/Blogs"));
const WebsiteBlogPost = lazy(() => import("@/pages/website/BlogPost"));
const Login = lazy(() => import("@/pages/auth/Login"));
const Register = lazy(() => import("@/pages/auth/Register"));
const SocialCallback = lazy(() => import("@/pages/auth/SocialCallback"));
const ForgotPassword = lazy(() => import("@/pages/auth/ForgotPassword"));
const Dashboard = lazy(() => import("@/pages/app/Dashboard"));
const Workouts = lazy(() => import("@/pages/app/Workouts"));
const Community = lazy(() => import("@/pages/app/Community"));
const Chat = lazy(() => import("@/pages/app/Chat"));
const Profile = lazy(() => import("@/pages/app/Profile"));
const Tools = lazy(() => import("@/pages/app/Tools"));
const Pricing = lazy(() => import("@/pages/app/Pricing"));
const Analytics = lazy(() => import("@/pages/app/Analytics"));
const Coaching = lazy(() => import("@/pages/app/Coaching"));
const Onboarding = lazy(() => import("@/pages/app/Onboarding"));
const Steps = lazy(() => import("@/pages/app/Steps"));
const AppNotifications = lazy(() => import("@/pages/app/Notifications"));

const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const CoachDashboard = lazy(() => import("@/pages/coach/Dashboard"));
const CoachRequests = lazy(() => import("@/pages/coach/Requests"));
const CoachAthletes = lazy(() => import("@/pages/coach/Athletes"));
const CoachChat = lazy(() => import("@/pages/coach/Chat"));
const CoachCommunity = lazy(() => import("@/pages/coach/Community"));
const CoachProfile = lazy(() => import("@/pages/coach/Profile"));
const CoachBlogs = lazy(() => import("@/pages/coach/Blogs"));
const CoachWorkouts = lazy(() => import("@/pages/coach/Workouts"));
const CoachNotifications = lazy(() => import("@/pages/coach/Notifications"));
const PaymentResult = lazy(() => import("@/pages/PaymentResult"));
const AppBlogs = lazy(() => import("@/pages/app/Blogs"));
const WorkoutPlan = lazy(() => import("@/pages/app/WorkoutPlan"));
const NutritionPlan = lazy(() => import("@/pages/app/NutritionPlan"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const AdminBlogs = lazy(() => import("@/pages/admin/Blogs"));
const AdminNotifications = lazy(() => import("@/pages/admin/Notifications"));
const AdminAdSettings = lazy(() => import("@/pages/admin/AdSettings"));
const AdminSettings = lazy(() => import("@/pages/admin/Settings"));
const CoachAdsManager = lazy(() => import("@/pages/coach/AdsManager"));
const CoachAdsCampaigns = lazy(() => import("@/pages/coach/ads/Campaigns"));
const CoachAdsCreatives = lazy(() => import("@/pages/coach/ads/Creatives"));
const CoachAdsAnalytics = lazy(() => import("@/pages/coach/ads/Analytics"));
const CoachAdsWallet = lazy(() => import("@/pages/coach/ads/Wallet"));
const CoachMyAds = lazy(() => import("@/pages/coach/ads/MyAds"));
const AdminAdsManager = lazy(() => import("@/pages/admin/AdsManager"));
const AdsSettingsPanel = lazy(() => import("@/pages/admin/AdsSettings"));
const AdminCertifications = lazy(() => import("@/pages/admin/Certifications"));
const AdminCoachReports = lazy(() => import("@/pages/admin/CoachReports"));
const AdminAppImages = lazy(() => import("@/pages/admin/AppImagesManager"));

// ── Page spinner (shown while lazy chunks download) ────────────────────────────
function PageSpinner() {
  return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <BrandLoader fullScreen={false} size={72} />
    </div>
  );
}

// ── Push notification in-app banner ───────────────────────────────────────────
function PushBanner() {
  const [notif, setNotif] = useNotif();
  if (!notif) return null;
  const handleClick = () => {
    if (notif.link && notif.link !== '/') window.location.href = notif.link;
    setNotif(null);
  };
  return (
    <div
      onClick={handleClick}
      style={{
        position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
        zIndex: 99999, width: "min(360px, calc(100vw - 32px))",
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 16, padding: "14px 16px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,214,0,0.15)",
        display: "flex", gap: 12, alignItems: "flex-start",
        animation: "slideDown 0.3s cubic-bezier(0.4,0,0.2,1)",
        cursor: notif.link ? "pointer" : "default",
      }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--accent-dim)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 18 }}>🔔</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 2, color: "var(--text-primary)" }}>{notif.title}</p>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{notif.body}</p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); setNotif(null); }}
        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2, fontSize: 20, lineHeight: 1, flexShrink: 0 }}>×</button>
    </div>
  );
}

function SmartRedirect() {
  const { user, isReady } = useAuth();
  const { branding } = useBranding();
  if (!isReady) return null;
  if (!user) {
    const csOn = String(branding.coming_soon_enabled || "0") === "1";
    // Lazy-import the bypass helper to avoid pulling ComingSoon into the main bundle.
    let bypassed = false;
    try { bypassed = localStorage.getItem("fitway_cs_bypass") === "1"; } catch {}
    if (csOn && !bypassed) return <ComingSoonPage />;
    return <HomePage />;
  }
  if (user.role === "admin") return <Navigate to="/admin/dashboard" replace />;
  if (user.role === "coach") return <Navigate to="/coach/dashboard" replace />;
  return <Navigate to="/app/dashboard" replace />;
}

/** Wraps a public website page so it shows the Coming Soon screen when enabled. */
function PublicGate({ children }: { children: ReactNode }) {
  const { branding } = useBranding();
  const csOn = String(branding.coming_soon_enabled || "0") === "1";
  let bypassed = false;
  try { bypassed = localStorage.getItem("fitway_cs_bypass") === "1"; } catch {}
  if (csOn && !bypassed) return <ComingSoonPage />;
  return <>{children}</>;
}

function NativeUrlHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    const cap = (window as any).Capacitor;
    if (!cap?.isNativePlatform?.()) return;

    let active = true;
    const listener = CapacitorApp.addListener("appUrlOpen", ({ url }) => {
      if (!active || !url) return;

      try {
        const parsed = new URL(url);
        if (parsed.hostname.toLowerCase() !== "auth") return;

        if (parsed.pathname === "/auth/social-callback") {
          navigate(`/auth/social-callback${parsed.search}`, { replace: true });
          return;
        }

        if (parsed.pathname === "/auth/login") {
          navigate(`/auth/login${parsed.search}`, { replace: true });
        }
      } catch (error) {
        console.warn("Failed to parse app URL:", error);
      }
    });

    return () => {
      active = false;
      listener.then((subscription) => subscription.remove()).catch(() => {});
    };
  }, [navigate]);

  return null;
}

export default function App() {
  function SplashGate() {
    const { isReady } = useBranding();

    useEffect(() => {
      const removeSplash = () => {
        const splash = document.getElementById('splash-loader');
        if (splash) {
          splash.style.transition = 'opacity 0.3s';
          splash.style.opacity = '0';
          setTimeout(() => splash.remove(), 300);
        }
      };

      // Remove when branding is ready
      if (isReady) { removeSplash(); return; }

      // Safety timeout — remove after 3s no matter what
      const t = setTimeout(removeSplash, 3000);
      return () => clearTimeout(t);
    }, [isReady]);

    return null;
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <I18nProvider>
          <BrandingProvider>
          <AppImagesProvider>
          <SplashGate />
          <PushBanner />
          <BrowserRouter>
            <NativeUrlHandler />
            <ErrorBoundary>
            <LazyErrorBoundary><Suspense fallback={<PageSpinner />}>
            <Routes>
              {/* Public Website Routes */}
              <Route element={<WebsiteLayout />}>
                <Route path="/" element={<SmartRedirect />} />
                <Route path="/about" element={<PublicGate><AboutPage /></PublicGate>} />
                <Route path="/contact" element={<PublicGate><CmsPage page="contact" /></PublicGate>} />
                <Route path="/blogs" element={<PublicGate><WebsiteBlogs /></PublicGate>} />
                <Route path="/blogs/:slug" element={<PublicGate><WebsiteBlogPost /></PublicGate>} />
                <Route path="/privacy" element={<PublicGate><PrivacyPolicyPage /></PublicGate>} />
                <Route path="/terms" element={<PublicGate><TermsOfServicePage /></PublicGate>} />
              </Route>

              {/* Auth Routes */}
              <Route path="/auth/login" element={<Login />} />
              <Route path="/auth/register" element={<Register />} />
              <Route path="/auth/forgot-password" element={<ForgotPassword />} />
              <Route path="/auth/social-callback" element={<SocialCallback />} />

              {/* User App Routes */}
              <Route path="/app/login" element={<Navigate to="/auth/login" replace />} />
              <Route path="/app/onboarding" element={
                <ProtectedRoute role="user">
                  <Onboarding />
                </ProtectedRoute>
              } />
              
              <Route element={
                <ProtectedRoute role="user">
                  <AppLayout />
                </ProtectedRoute>
              }>
                <Route path="/app/dashboard" element={<Dashboard />} />
                <Route path="/app/workouts" element={<Workouts />} />
                <Route path="/app/steps" element={<Steps />} />
                <Route path="/app/community" element={<Community />} />
                <Route path="/app/chat" element={<Chat />} />
                <Route path="/app/profile" element={<Profile />} />
                <Route path="/app/tools" element={<Tools />} />
                <Route path="/app/pricing" element={<Pricing />} />
                <Route path="/app/analytics" element={<Analytics />} />
                <Route path="/app/coaching" element={<Coaching />} />
                <Route path="/app/blogs" element={<AppBlogs />} />
                <Route path="/app/workout-plan" element={<WorkoutPlan />} />
                <Route path="/app/nutrition-plan" element={<NutritionPlan />} />
                <Route path="/app/notifications" element={<AppNotifications />} />
              </Route>

              {/* Coach Routes */}
              <Route path="/coach" element={<Navigate to="/coach/dashboard" replace />} />
              <Route element={
                <ProtectedRoute role="coach">
                  <CoachLayout />
                </ProtectedRoute>
              }>
                <Route path="/coach/dashboard" element={<CoachDashboard />} />
                <Route path="/coach/requests" element={<CoachRequests />} />
                <Route path="/coach/athletes" element={<CoachAthletes />} />
                <Route path="/coach/chat" element={<CoachChat />} />
                <Route path="/coach/ads" element={<Navigate to="/coach/ads/campaigns" replace />} />
                <Route path="/coach/ads/campaigns" element={<CoachAdsCampaigns />} />
                <Route path="/coach/ads/my-ads" element={<CoachMyAds />} />
                <Route path="/coach/ads/creatives" element={<CoachAdsCreatives />} />
                <Route path="/coach/ads/analytics" element={<CoachAdsAnalytics />} />
                <Route path="/coach/ads/wallet" element={<CoachAdsWallet />} />
                <Route path="/coach/campaigns" element={<Navigate to="/coach/ads/campaigns" replace />} />
                <Route path="/coach/community" element={<CoachCommunity />} />
                <Route path="/coach/profile" element={<CoachProfile />} />
                <Route path="/coach/blogs" element={<CoachBlogs />} />
                <Route path="/coach/workouts" element={<CoachWorkouts />} />
                <Route path="/coach/notifications" element={<CoachNotifications />} />
              </Route>

              {/* Admin Routes */}
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
              <Route element={
                <ProtectedRoute role="admin">
                  <AdminLayout />
                </ProtectedRoute>
              }>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/users" element={<AdminDashboard />} />
                <Route path="/admin/coaches" element={<AdminDashboard />} />
                <Route path="/admin/payments" element={<AdminDashboard />} />
                <Route path="/admin/videos" element={<AdminDashboard />} />
                <Route path="/admin/ads" element={<AdminAdsManager />} />
                <Route path="/admin/ad-settings" element={<AdsSettingsPanel />} />
                <Route path="/admin/chat" element={<AdminDashboard />} />
                <Route path="/admin/gifts" element={<AdminDashboard />} />
                <Route path="/admin/settings" element={<AdminSettings />} />
                <Route path="/admin/website" element={<AdminDashboard />} />
                <Route path="/admin/community" element={<AdminDashboard />} />
                <Route path="/admin/subscriptions" element={<AdminDashboard />} />
                <Route path="/admin/withdrawals" element={<AdminDashboard />} />
                <Route path="/admin/blogs" element={<AdminBlogs />} />
                <Route path="/admin/notifications" element={<AdminNotifications />} />
                <Route path="/admin/certifications" element={<AdminCertifications />} />
                <Route path="/admin/coach-reports" element={<AdminCoachReports />} />
                <Route path="/admin/app-images" element={<AdminAppImages />} />
              </Route>

              {/* Payment Result Routes */}
              <Route path="/payment/success" element={<PaymentResult result="success" />} />
              <Route path="/payment/cancel" element={<PaymentResult result="cancel" />} />
              <Route path="/payment/error" element={<PaymentResult result="error" />} />

              {/* 404 — catches unknown routes */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense></LazyErrorBoundary>
            </ErrorBoundary>
          </BrowserRouter>
          </AppImagesProvider>
          </BrandingProvider>
        </I18nProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
