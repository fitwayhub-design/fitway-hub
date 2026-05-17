import { useState, useEffect, useCallback } from "react";
import { Outlet, Link, NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Activity, MessageSquare, Bell,
  Megaphone, Globe, ClipboardList, CreditCard, Lock, X, FileText,
  Target, Image, BarChart2, Wallet, Dumbbell,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useBranding, getBrandLogoForLang } from "@/context/BrandingContext";
import { useI18n } from "@/context/I18nContext";
import { useTheme } from "@/context/ThemeContext";
import { SharedSidebar, NavItem } from "@/components/layout/SharedSidebar";
import PaymentForm from "@/components/app/PaymentForm";
import LocationPermissionModal, { shouldAskForLocation } from "@/components/app/LocationPermissionModal";
import { getApiBase } from "@/lib/api";

const navItems: NavItem[] = [
  { path: "/coach/dashboard",      icon: LayoutDashboard, label: "Dashboard" },
  { path: "/coach/requests",       icon: ClipboardList,   label: "Requests" },
  { path: "/coach/athletes",       icon: Users,           label: "Athletes" },
  { path: "/coach/chat",           icon: MessageSquare,   label: "Messages" },
  { path: "/coach/ads/campaigns",  icon: Target,          label: "Campaigns" },
  { path: "/coach/ads/my-ads",     icon: Megaphone,       label: "My Ads" },
  { path: "/coach/ads/creatives",  icon: Image,           label: "Creatives" },
  { path: "/coach/ads/analytics",  icon: BarChart2,       label: "Analytics" },
  { path: "/coach/ads/wallet",     icon: Wallet,          label: "Wallet" },
  { path: "/coach/blogs",          icon: FileText,        label: "Our Blog" },
  { path: "/coach/community",      icon: Globe,           label: "Community" },
  { path: "/coach/workouts",       icon: Dumbbell,        label: "Workouts" },
  { path: "/coach/profile",        icon: Activity,        label: "Profile" },
];

const bottomNavItems: NavItem[] = [
  { path: "/coach/dashboard", icon: LayoutDashboard, label: "Home" },
  { path: "/coach/requests",  icon: ClipboardList,   label: "Requests" },
  { path: "/coach/athletes",  icon: Users,           label: "Athletes" },
  { path: "/coach/chat",      icon: MessageSquare,   label: "Chat" },
  { path: "/coach/profile",   icon: Activity,        label: "Profile" },
];

const moreItems: NavItem[] = [
  { path: "/coach/ads/campaigns",  icon: Target,    label: "Campaigns" },
  { path: "/coach/ads/my-ads",     icon: Megaphone, label: "My Ads" },
  { path: "/coach/ads/creatives",  icon: Image,     label: "Creatives" },
  { path: "/coach/ads/analytics",  icon: BarChart2, label: "Analytics" },
  { path: "/coach/ads/wallet",     icon: Wallet,    label: "Wallet" },
  { path: "/coach/community",      icon: Globe,     label: "Community" },
];

const FEATURE_BY_PATH: Record<string, string> = {
  "/coach/requests": "feature_coach_requests",
  "/coach/athletes": "feature_coach_athletes",
  "/coach/chat": "feature_coach_chat",
  "/coach/ads": "feature_coach_ads",
  "/coach/ads/campaigns": "feature_coach_ads",
  "/coach/ads/my-ads": "feature_coach_ads",
  "/coach/ads/creatives": "feature_coach_ads",
  "/coach/ads/analytics": "feature_coach_ads",
  "/coach/ads/wallet": "feature_coach_ads",
  "/coach/blogs": "feature_coach_blogs",
  "/coach/community": "feature_coach_community",
  "/coach/workouts": "feature_coach_workouts",
  "/coach/notifications": "feature_coach_notifications",
};

// ── Membership paywall overlay ────────────────────────────────────────────────
function CoachPaywall({ onPay }: { onPay: () => void }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      backdropFilter: "blur(16px) brightness(0.4)",
      WebkitBackdropFilter: "blur(16px) brightness(0.4)",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(10,10,11,0.7)",
    }}>
      <div style={{
        backgroundColor: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-full)", padding: "36px 40px", maxWidth: 440, width: "90%",
        textAlign: "center", boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
      }}>
        <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(59,139,255,0.15)", border: "1px solid rgba(59,139,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <Lock size={26} color="var(--main)" />
        </div>
        <h2 style={{ fontFamily: "var(--font-en)", fontSize: 22, fontWeight: 700, marginBottom: 10 }}>Activate Your Coach Account</h2>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 8 }}>
          Activate your coach membership to access your dashboard and start working with athletes.
        </p>
        <div style={{ background: "rgba(59,139,255,0.08)", border: "1px solid rgba(59,139,255,0.2)", borderRadius: "var(--radius-full)", padding: "16px 20px", marginBottom: 24, textAlign: "start" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--main)", marginBottom: 8, fontFamily: "var(--font-en)" }}>COACH MEMBERSHIP</p>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1, background: "var(--bg-surface)", borderRadius: "var(--radius-full)", padding: "12px 14px", border: "1px solid var(--border)" }}>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Monthly</p>
              <p style={{ fontFamily: "var(--font-en)", fontSize: 20, fontWeight: 700 }}>50 EGP</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>per month</p>
            </div>
            <div style={{ flex: 1, background: "var(--accent-dim)", borderRadius: "var(--radius-full)", padding: "12px 14px", border: "1px solid rgba(255,214,0,0.2)" }}>
              <p style={{ fontSize: 12, color: "var(--accent)", marginBottom: 4 }}>Annual ⚡ SAVE 25%</p>
              <p style={{ fontFamily: "var(--font-en)", fontSize: 20, fontWeight: 700, color: "var(--accent)" }}>450 EGP</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>per year</p>
            </div>
          </div>
        </div>
        <button onClick={onPay} style={{ width: "100%", padding: "14px", borderRadius: "var(--radius-full)", background: "var(--main)", border: "none", color: "#fff", fontFamily: "var(--font-en)", fontWeight: 700, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <CreditCard size={17} /> Choose Payment Method
        </button>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 14, lineHeight: 1.6 }}>
          💳 <strong>PayPal / Card</strong> = instant activation &nbsp;·&nbsp; 📱 <strong>E-Wallet</strong> = pending admin review
        </p>
      </div>
    </div>
  );
}

// ── Membership payment modal ──────────────────────────────────────────────────
function CoachPaymentModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { token } = useAuth();
  const [plan, setPlan] = useState<"monthly" | "annual">("monthly");
  const amount = plan === "annual" ? 450 : 50;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, backgroundColor: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: 28, width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <p style={{ fontFamily: "var(--font-en)", fontSize: 18, fontWeight: 700 }}>Coach Membership</p>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={20} /></button>
        </div>

        {/* Plan picker */}
        <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
          {(["monthly", "annual"] as const).map(p => (
            <button key={p} onClick={() => setPlan(p)} style={{ flex: 1, padding: "12px", borderRadius: "var(--radius-full)", border: `2px solid ${plan === p ? "var(--main)" : "var(--border)"}`, background: plan === p ? "rgba(59,139,255,0.1)" : "var(--bg-surface)", cursor: "pointer", textAlign: "center" }}>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4, textTransform: "capitalize" }}>{p}</p>
              <p style={{ fontFamily: "var(--font-en)", fontSize: 22, fontWeight: 700, color: plan === p ? "var(--main)" : "var(--text-primary)" }}>
                {p === "annual" ? "450" : "50"} EGP
              </p>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{p === "annual" ? "/year" : "/month"}</p>
              {p === "annual" && <p style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700, marginTop: 4 }}>SAVE 25%</p>}
            </button>
          ))}
        </div>

        <div style={{ padding: "10px 14px", backgroundColor: "rgba(255,179,64,0.07)", border: "1px solid rgba(255,179,64,0.2)", borderRadius: "var(--radius-full)", marginBottom: 18, fontSize: 12, color: "var(--amber)" }}>
          ⚡ <strong>PayPal</strong> = instant activation &nbsp;|&nbsp; 📱 <strong>E-Wallet</strong> = admin must approve before you get access
        </div>

        <PaymentForm
          amount={amount}
          plan={plan}
          type="coach"
          token={token}
          onSuccess={() => {
            onSuccess();
            onClose();
          }}
          onError={(msg) => console.error("Payment error:", msg)}
        />
      </div>
    </div>
  );
}

// ── CoachLayout ───────────────────────────────────────────────────────────────
export function CoachLayout() {
  const { user, token, refreshUser } = useAuth();
  const { branding } = useBranding();
  const { lang, t } = useI18n();
  const { isDark } = useTheme();
  const isRtl = lang === "ar";
  const location = useLocation();
  const brandLogo = getBrandLogoForLang(branding, lang, isDark);
  const [showPayment, setShowPayment] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const isFeatureEnabled = useCallback((path: string) => {
    const key = FEATURE_BY_PATH[path];
    if (!key) return true;
    return features[key] !== false;
  }, [features]);

  const fetchFeatures = useCallback(async () => {
    try {
      const r = await fetch(`${getApiBase()}/api/admin/features`);
      const d = await r.json();
      setFeatures(d?.features || {});
    } catch {
      setFeatures({});
    }
  }, []);

  useEffect(() => {
    if (token && user && shouldAskForLocation()) {
      const timer = setTimeout(() => setShowLocationModal(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [token, user]);
  useEffect(() => {
    fetchFeatures();
    const onRefresh = () => fetchFeatures();
    window.addEventListener("features:refresh", onRefresh);
    return () => window.removeEventListener("features:refresh", onRefresh);
  }, [fetchFeatures]);
  const membershipActive = user?.coachMembershipActive || user?.role === "admin";

  const activateBtn = !membershipActive ? (
    <button
      onClick={() => setShowPayment(true)}
      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 10px", borderRadius: "var(--radius-full)", fontSize: 12, fontWeight: 600, color: "#fff", background: "var(--main)", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}
    >
      <CreditCard size={13} /> Activate Account
    </button>
  ) : null;

  const translatedNavItems: NavItem[] = [
    { path: "/coach/dashboard", icon: LayoutDashboard, label: t("dashboard") },
    { path: "/coach/requests",  icon: ClipboardList,   label: t("requests") },
    { path: "/coach/athletes",  icon: Users,           label: t("athletes") },
    { path: "/coach/chat",      icon: MessageSquare,   label: t("messages") },
    { path: "/coach/ads",       icon: Megaphone,       label: t("my_ads") },
    { path: "/coach/blogs",     icon: FileText,        label: t("blog_title") },
    { path: "/coach/community", icon: Globe,           label: t("community") },
    { path: "/coach/workouts",  icon: Dumbbell,        label: t("nav_workouts") },
    { path: "/coach/profile",   icon: Activity,        label: t("profile") },
  ].filter((item) => isFeatureEnabled(item.path));

  const translatedBottomNavItems: NavItem[] = [
    { path: "/coach/dashboard", icon: LayoutDashboard, label: t("nav_home") },
    { path: "/coach/requests",  icon: ClipboardList,   label: t("requests") },
    { path: "/coach/athletes",  icon: Users,           label: t("athletes") },
    { path: "/coach/chat",      icon: MessageSquare,   label: t("nav_chat") },
    { path: "/coach/profile",   icon: Activity,        label: t("nav_profile") },
  ].filter((item) => isFeatureEnabled(item.path));

  const translatedMoreItems: NavItem[] = [
    { path: "/coach/ads",       icon: Megaphone, label: t("my_ads") },
    { path: "/coach/blogs",     icon: FileText,  label: t("blog_title") },
    { path: "/coach/community", icon: Globe,     label: t("nav_community") },
    { path: "/coach/workouts",  icon: Dumbbell,  label: t("nav_workouts") },
  ].filter((item) => isFeatureEnabled(item.path));
  const allCoachNav = [...translatedNavItems, ...translatedMoreItems, ...translatedBottomNavItems];
  const currentPageLabel = allCoachNav.find((item) => item.path === location.pathname)?.label || t("dashboard");

  const { isMobile, sidebarW, DesktopSidebar, OverlayDrawer, MobileTopBar, MobileBottomBar } = SharedSidebar({
    navItems: translatedNavItems,
    bottomNavItems: translatedBottomNavItems,
    moreDrawerItems: translatedMoreItems,
    accentColor: "var(--main)",
    accentBg: "var(--main-dim)",
    logoIcon: Activity,
    logoIconColor: "var(--main)",
    logoLabel: (branding.app_name || "FITWAY") + " COACH",
    logoUrl: brandLogo || undefined,
    roleLabel: membershipActive ? "🏅 Active Coach" : "⚠️ Inactive",
    roleLabelColor: membershipActive ? "var(--main)" : "var(--amber)",
    extraFooter: activateBtn,
    notificationPath: isFeatureEnabled("/coach/notifications") ? "/coach/notifications" : undefined,
    homePath: "/coach/dashboard",
  });

  return (
    <div className={`app-fwh${isRtl ? " rtl" : ""}`} style={{ minHeight: "100vh", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", display: "flex", overflow: "hidden" }}>
      {/* Paywall for unpaid coaches */}
      {!membershipActive && !showPayment && <CoachPaywall onPay={() => setShowPayment(true)} />}

      {/* Payment modal */}
      {showPayment && (
        <CoachPaymentModal
          onClose={() => setShowPayment(false)}
          onSuccess={async () => { await refreshUser(); }}
        />
      )}

      {/* Sidebar (desktop) + overlay drawer (all sizes) */}
      {!isMobile && <DesktopSidebar />}
      <OverlayDrawer />
      {isMobile && <MobileTopBar />}

      <main style={{
        flex: 1,
        minWidth: 0,
        overflowX: "hidden",
        overflowY: "auto",
        height: "100vh",
        marginInlineStart: isMobile ? 0 : sidebarW,
        transition: "margin 0.25s cubic-bezier(0.4,0,0.2,1)",
        paddingTop: isMobile ? "calc(56px + env(safe-area-inset-top))" : 0,
        paddingBottom: isMobile ? "calc(88px + env(safe-area-inset-bottom))" : 0,
      }}>
        {!isMobile && (
          <header className="panel-topbar" style={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            minHeight: 62,
            display: "flex",
            alignItems: "stretch",
            justifyContent: "space-between",
            padding: "0 20px 0 24px",
            borderBottom: "1px solid var(--border)",
            background: "color-mix(in srgb, var(--bg-primary) 88%, transparent)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            gap: 10,
          }}>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0, flex: 1, gap: 6, padding: "8px 0" }}>
              <div style={{ display: "flex", alignItems: "center", minWidth: 0, gap: 10 }}>
                {location.pathname !== '/coach/dashboard' && (
                  <button
                    aria-label="Back"
                    onClick={() => window.history.back()}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      marginInlineEnd: 2, display: 'flex', alignItems: 'center',
                      color: 'var(--text-secondary)', fontSize: 20,
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points={isRtl ? "9 18 15 12 9 6" : "15 18 9 12 15 6"}/></svg>
                  </button>
                )}
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 300, lineHeight: 1.05, fontFamily: "var(--fwh-display, 'Barlow Condensed', sans-serif)", letterSpacing: "-0.01em", textTransform: "uppercase" }}>{currentPageLabel}</h1>
                <p style={{ margin: "3px 0 0", fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: "var(--fwh-mono, 'Geist Mono', monospace)" }}>{t("dashboard")} / {currentPageLabel}</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isFeatureEnabled("/coach/notifications") ? (
              <Link to="/coach/notifications" style={{ textDecoration: "none", width: 34, height: 34, borderRadius: 12, background: "transparent", border: "1px solid var(--border)", color: "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Bell size={18} />
              </Link>
            ) : <div style={{ width: 34, height: 34 }} />}
            </div>
          </header>
        )}
        <div style={{ padding: isMobile ? "16px 12px" : "24px 20px", maxWidth: 1200, margin: "0 auto" }}>
          <Outlet />
        </div>
      </main>

      {isMobile && <MobileBottomBar />}

      {showLocationModal && (
        <LocationPermissionModal token={token} onDismiss={() => setShowLocationModal(false)} />
      )}
    </div>
  );
}
