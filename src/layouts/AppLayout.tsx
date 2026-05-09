import { Outlet, NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Home, Dumbbell, Activity, Users, Bell,
  MessageCircle, Wrench, CreditCard, BarChart2,
  UserCheck, BookOpen, ClipboardList, User, Utensils, LogOut,
} from "lucide-react";
import { CoachSearchIcon } from "@/components/icons/CoachSearchIcon";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useBranding, getBrandLogoForLang } from "@/context/BrandingContext";
import { useTheme } from "@/context/ThemeContext";
import { getAvatar } from "@/lib/avatar";
import { getApiBase } from "@/lib/api";
import LocationPermissionModal, { shouldAskForLocation } from "@/components/app/LocationPermissionModal";
import NotificationDropdown from "@/components/app/NotificationDropdown";

// ── Primary bottom nav (5 items, middle is the center FAB) ──────────────────
type BottomNavItem = { path: string; icon: typeof Home; label: string; center?: boolean };
const NAV: BottomNavItem[] = [
  { path: "/app/dashboard",     icon: Home,          label: "Home" },
  { path: "/app/workouts",      icon: Dumbbell,      label: "Workout" },
  { path: "/app/coaching",      icon: CoachSearchIcon, label: "Find Coach", center: true },
  { path: "/app/workout-plan",  icon: ClipboardList, label: "Workout Plan" },
  { path: "/app/nutrition-plan",icon: Utensils,      label: "Nutrition Plan" },
];

// ── Top horizontal scroll menu (all other pages) ─────────────────────────────
const TOP_NAV = [
  { path: "/app/steps",      icon: Activity,      label: "Activity" },
  { path: "/app/community",  icon: Users,         label: "Community" },
  { path: "/app/profile",    icon: User,          label: "Profile" },
  { path: "/app/chat",       icon: MessageCircle, label: "Chat" },
  { path: "/app/tools",      icon: Wrench,        label: "Tools" },
  { path: "/app/analytics",  icon: BarChart2,     label: "Analytics" },
  { path: "/app/blogs",          icon: BookOpen,       label: "Our Blog" },
  { path: "/app/notifications",  icon: Bell,           label: "Notifications" },
];

const FEATURE_BY_PATH: Record<string, string> = {
  "/app/workouts": "feature_user_workouts",
  "/app/workout-plan": "feature_user_workout_plan",
  "/app/nutrition-plan": "feature_user_nutrition_plan",
  "/app/steps": "feature_user_steps",
  "/app/community": "feature_user_community",
  "/app/chat": "feature_user_chat",
  "/app/coaching": "feature_user_coaching",
  "/app/tools": "feature_user_tools",
  "/app/analytics": "feature_user_analytics",
  "/app/blogs": "feature_user_blogs",
  "/app/notifications": "feature_user_notifications",
};

const SIDEBAR_W = 252;

function useIsDesktop() {
  const [desktop, setDesktop] = useState(() => typeof window !== "undefined" && window.innerWidth >= 860);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 860px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setDesktop(e.matches);
    handler(mq);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return desktop;
}

export function AppLayout() {
  const { token, user, logout } = useAuth();
  const { lang, t } = useI18n();
  const { branding } = useBranding();
  const { isDark } = useTheme();
  const isRtl = lang === "ar";
  const location = useLocation();
  const navigate = useNavigate();
  const handleSignOut = useCallback(() => { logout(); navigate("/auth/login", { replace: true }); }, [logout, navigate]);
  const [showLocation, setShowLocation] = useState(false);
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const brandLogo = getBrandLogoForLang(branding, lang, isDark);
  const isDesktop = useIsDesktop();
  const isFeatureEnabled = useCallback((path: string) => {
    const key = FEATURE_BY_PATH[path];
    if (!key) return true;
    return features[key] !== false;
  }, [features]);
  const bottomNav = useMemo(() => NAV.filter((item) => isFeatureEnabled(item.path)), [isFeatureEnabled]);
  const topNav = useMemo(() => TOP_NAV.filter((item) => isFeatureEnabled(item.path)), [isFeatureEnabled]);
  const allNav = useMemo(() => [...bottomNav, ...topNav], [bottomNav, topNav]);
  const labelForPath = useCallback((path: string, label: string) => {
    if (path === "/app/dashboard") return t("nav_home");
    if (path === "/app/workouts") return t("nav_workouts");
    if (path === "/app/coaching") return t("find_a_coach");
    if (path === "/app/workout-plan") return t("workout_plan");
    if (path === "/app/nutrition-plan") return t("nutrition_plan");
    if (path === "/app/steps") return t("activity");
    if (path === "/app/community") return t("nav_community");
    if (path === "/app/profile") return t("nav_profile");
    if (path === "/app/chat") return t("nav_chat");
    if (path === "/app/tools") return t("nav_tools");
    if (path === "/app/analytics") return t("nav_analytics");
    if (path === "/app/blogs") return t("blog_title");
    if (path === "/app/notifications") return t("notifications");
    return label;
  }, [t]);
  const currentPageLabel = useMemo(() => {
    const match = allNav.find((item) => item.path === location.pathname);
    if (match) return labelForPath(match.path, match.label);
    return t("nav_home");
  }, [allNav, location.pathname, labelForPath, t]);

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
      const t = setTimeout(() => setShowLocation(true), 1500);
      return () => clearTimeout(t);
    }
  }, [token, user]);

  useEffect(() => {
    fetchFeatures();
    const onRefresh = () => fetchFeatures();
    window.addEventListener("features:refresh", onRefresh);
    return () => window.removeEventListener("features:refresh", onRefresh);
  }, [fetchFeatures]);

  return (
    <div
      className={`app-view app-layout app-fwh${isRtl ? " rtl" : ""}${isDesktop ? " app-desktop user-panel-shell" : ""}`}
      style={{
        background: "var(--bg-primary)",
        color: "var(--text-primary)",
        minHeight: "100dvh",
        direction: isRtl ? "rtl" : "ltr",
      }}
    >
      {/* ── Desktop Sidebar ── */}
      {isDesktop && (
        <aside
          className="user-panel-sidebar fade-up"
          style={{
            position: "fixed", top: 0, [isRtl ? "right" : "left"]: 0,
            width: SIDEBAR_W, height: "100dvh", zIndex: 100,
            background: "var(--bg-card)", borderRight: isRtl ? "none" : "1px solid var(--border)",
            borderLeft: isRtl ? "1px solid var(--border)" : "none",
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}
        >
          {/* Brand header + notification bell */}
          <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
          <Link to="/app/dashboard" className="user-panel-brand" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", padding: "22px 18px 16px", flex: 1, minWidth: 0 }}>
            {brandLogo ? (
              <img src={brandLogo} alt={branding.app_name || "FitWay Hub"} style={{ height: 28, borderRadius: 12, objectFit: "contain" }} />
            ) : (
              <span style={{
                fontFamily: "var(--fwh-display, var(--font-heading))",
                fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em",
                color: "var(--text-primary)",
                textTransform: "uppercase",
              }}>
                {branding.app_name || "FitWay Hub"}
              </span>
            )}
          </Link>
          {isFeatureEnabled("/app/notifications") && (
            <div style={{ marginRight: isRtl ? 0 : 14, marginLeft: isRtl ? 14 : 0 }}>
              <NotificationDropdown token={token} size={16} align={isRtl ? "left" : "right"} buttonStyle={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }} />
            </div>
          )}
          </div>

          {/* Nav items */}
          <nav style={{ flex: 1, overflowY: "auto", padding: "12px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
            {allNav.map(({ path, icon: Icon, label }) => {
              const active = location.pathname === path || location.pathname.startsWith(path + "/");
              return (
                <NavLink
                  key={path}
                  to={path}
                  className={`user-panel-nav-link${active ? " active" : ""}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", borderRadius: 12, textDecoration: "none",
                    fontSize: 13, fontWeight: active ? 700 : 500,
                    color: active ? "var(--main)" : "var(--text-secondary)",
                    background: active ? "var(--main-dim)" : "transparent",
                    transition: "all 0.18s",
                  }}
                >
                  <Icon size={18} strokeWidth={active ? 2.4 : 1.8} />
                  {labelForPath(path, label)}
                </NavLink>
              );
            })}
          </nav>

          {/* User avatar at bottom */}
          {user && (
            <div style={{ borderTop: "1px solid var(--border)" }}>
              <NavLink to="/app/profile" className="user-panel-profile-link" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", padding: "16px 18px" }}>
                <img src={user.avatar || getAvatar(user.email, null, (user as any).gender, user.name)} alt="" style={{ width: 32, height: 32, borderRadius: 12, objectFit: "cover", border: "1px solid var(--main)" }} />
                <div style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name || user.email}</span>
                  <span style={{
                    display: "block", fontSize: 9, color: "var(--text-muted)",
                    textTransform: "uppercase", letterSpacing: "0.18em",
                    fontFamily: "var(--fwh-mono, ui-monospace, monospace)", marginTop: 2,
                  }}>{user.role}</span>
                </div>
              </NavLink>
              <button
                onClick={handleSignOut}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%",
                  padding: "12px 18px", border: "none", background: "transparent",
                  color: "var(--red)", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  borderTop: "1px solid var(--border)",
                }}
              >
                <LogOut size={16} />
                {t("sign_out")}
              </button>
            </div>
          )}
        </aside>
      )}

      {/* ── Top Bar (mobile only) ── */}
      {!isDesktop && (
        <header className="app-top-bar">
          <div className="app-top-bar-inner">
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              {location.pathname !== '/app/dashboard' && (
                <button
                  aria-label={t('back')}
                  onClick={() => window.history.back()}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    color: 'var(--text-secondary)',
                    fontSize: 20,
                    flexShrink: 0,
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points={isRtl ? "9 18 15 12 9 6" : "15 18 9 12 15 6"}/></svg>
                </button>
              )}
              <Link to="/app/dashboard" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", minWidth: 0 }}>
                {brandLogo ? (
                  <img src={brandLogo} alt={branding.app_name || "FitWay Hub"} style={{ height: 26, borderRadius: 12, objectFit: "contain" }} />
                ) : (
                  <span style={{
                    fontFamily: "var(--fwh-display, var(--font-heading))",
                    fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em",
                    color: "var(--text-primary)",
                    textTransform: "uppercase",
                  }}>
                    {branding.app_name || "FitWay Hub"}
                  </span>
                )}
              </Link>
            </div>

            {user && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {isFeatureEnabled("/app/notifications") && (
                  <NotificationDropdown token={token} size={20} align={isRtl ? "left" : "right"} buttonStyle={{ background: "transparent", border: "none", width: 34, height: 34 }} />
                )}
                <NavLink to="/app/profile" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 12,
                    border: "1px solid var(--main)", padding: 1,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "none",
                  }}>
                    <img src={user.avatar || getAvatar(user.email, null, (user as any).gender, user.name)} alt="" style={{ width: "100%", height: "100%", borderRadius: 12, objectFit: "cover" }} />
                  </div>
                </NavLink>
              </div>
            )}
          </div>

          {/* ── Horizontal scroll secondary nav ── */}
          <nav className="app-top-scroll-nav" aria-label="Secondary navigation">
            <div className="app-top-scroll-inner">
              {topNav.map(({ path, icon: Icon, label }) => {
                const isActive = location.pathname === path;
                return (
                  <NavLink
                    key={path}
                    to={path}
                    className={`app-top-scroll-item${isActive ? " active" : ""}`}
                  >
                    <div className="app-top-scroll-icon-wrap">
                      <Icon size={14} strokeWidth={isActive ? 2.5 : 1.8} />
                    </div>
                    <span className="app-top-scroll-label">{labelForPath(path, label)}</span>
                  </NavLink>
                );
              })}
              <button
                type="button"
                onClick={handleSignOut}
                className="app-top-scroll-item"
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)" }}
                aria-label={t("sign_out")}
              >
                <div className="app-top-scroll-icon-wrap">
                  <LogOut size={14} strokeWidth={2} />
                </div>
                <span className="app-top-scroll-label">{t("sign_out")}</span>
              </button>
            </div>
          </nav>
        </header>
      )}

      {/* ── Page content ── */}
      <main style={{
        minHeight: "100dvh",
        ...(isDesktop ? { [isRtl ? "marginRight" : "marginLeft"]: SIDEBAR_W } : {}),
      }}>
        {isDesktop && (
          <header className="user-panel-header panel-topbar fade-up" style={{
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
                {location.pathname !== '/app/dashboard' && (
                  <button
                    aria-label={t('back')}
                    onClick={() => window.history.back()}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      marginInlineEnd: 2,
                      display: 'flex',
                      alignItems: 'center',
                      color: 'var(--text-secondary)',
                      fontSize: 20
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points={isRtl ? "9 18 15 12 9 6" : "15 18 9 12 15 6"}/></svg>
                  </button>
                )}
                <h1 style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 300,
                  fontFamily: "var(--fwh-display, var(--font-heading))",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.0,
                }}>{currentPageLabel}</h1>
                <p style={{
                  margin: "5px 0 0",
                  fontSize: 10,
                  color: "var(--text-muted)",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  fontFamily: "var(--fwh-mono, ui-monospace, monospace)",
                }}>{t("nav_home")} / {currentPageLabel}</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isFeatureEnabled("/app/notifications") && (
              <NotificationDropdown token={token} size={18} align={isRtl ? "left" : "right"} />
            )}
            {user && (
              <NavLink to="/app/profile" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
                <img src={user.avatar || getAvatar(user.email, null, (user as any).gender, user.name)} alt="" style={{ width: 32, height: 32, borderRadius: 12, objectFit: "cover", border: "1px solid var(--main)" }} />
              </NavLink>
            )}
            </div>
          </header>
        )}
        <Outlet />
      </main>

      {/* ── Floating Pill Bottom Nav (mobile only) ── */}
      {!isDesktop && (
        <nav className="app-bottom-nav" aria-label="Main navigation">
          <div className="app-bottom-nav-inner">
            {bottomNav.map((item) => {
              const Icon = item.icon;
              if ((item as BottomNavItem).center) {
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => `app-nav-center${isActive ? " active" : ""}`}
                    aria-label={labelForPath(item.path, item.label)}
                  >
                    <span className="app-nav-center-bubble">
                      <Icon size={24} strokeWidth={2.4} />
                    </span>
                  </NavLink>
                );
              }
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `app-nav-item${isActive ? " active" : ""}`}
                >
                  {({ isActive }) => (
                    <>
                      <div className="app-nav-icon-wrap">
                        <Icon size={20} color={isActive ? "#fff" : "var(--text-muted)"} strokeWidth={isActive ? 2.5 : 1.8} />
                      </div>
                      <span className="app-nav-label">{labelForPath(item.path, item.label)}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>
      )}

      {showLocation && (
        <LocationPermissionModal token={token} onDismiss={() => setShowLocation(false)} />
      )}
    </div>
  );
}
