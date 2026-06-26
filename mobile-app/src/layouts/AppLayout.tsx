import { Outlet, NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Home, Dumbbell, Activity, Users,
  MessageCircle, Wrench, CreditCard, BarChart2,
  UserCheck, BookOpen, ClipboardList, User, Utensils, LogOut, Inbox, Trophy,
  PanelLeftClose, PanelLeftOpen, ChevronLeft, ChevronRight,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

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
  // Challenges = group fitness challenges + their group chats. Replaces
  // the old Groups tab on /app/chat (1:1 chat is gone).
  { path: "/app/challenges", icon: Trophy,        label: "Challenges" },
  { path: "/app/profile",    icon: User,          label: "Profile" },
  // Tickets is the only direct contact channel with a coach (May meeting).
  { path: "/app/tickets",    icon: Inbox,         label: "Tickets" },
  { path: "/app/tools",      icon: Wrench,        label: "Tools" },
  { path: "/app/analytics",  icon: BarChart2,     label: "Analytics" },
  { path: "/app/blogs",          icon: BookOpen,       label: "Our Blog" },
];

const FEATURE_BY_PATH: Record<string, string> = {
  "/app/workouts": "feature_user_workouts",
  "/app/workout-plan": "feature_user_workout_plan",
  "/app/nutrition-plan": "feature_user_nutrition_plan",
  "/app/steps": "feature_user_steps",
  "/app/community": "feature_user_community",
  "/app/coaching": "feature_user_coaching",
  "/app/tools": "feature_user_tools",
  "/app/analytics": "feature_user_analytics",
  "/app/blogs": "feature_user_blogs",
  "/app/notifications": "feature_user_notifications",
};

const SIDEBAR_W = 252;
const SIDEBAR_W_COLLAPSED = 72;

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

/** Initials for the avatar fallback (keeps a graceful state while the image loads). */
function initialsOf(nameOrEmail?: string) {
  if (!nameOrEmail) return "U";
  const base = nameOrEmail.includes("@") ? nameOrEmail.split("@")[0] : nameOrEmail;
  const parts = base.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const brandLogo = getBrandLogoForLang(branding, lang, isDark);
  const favicon = branding.favicon_url || "/favicon.svg";
  const isDesktop = useIsDesktop();
  const currentSidebarW = sidebarCollapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W;
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
    if (path === "/app/challenges") return "Challenges";
    if (path === "/app/profile") return t("nav_profile");
    if (path === "/app/tickets") return "Tickets";
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
      // Authenticated users get the global flags merged with any per-user
      // access overrides an admin granted them; anonymous gets the global map.
      const r = token
        ? await fetch(`${getApiBase()}/api/admin/features/me`, { headers: { Authorization: `Bearer ${token}` } })
        : await fetch(`${getApiBase()}/api/admin/features`);
      const d = await r.json();
      setFeatures(d?.features || {});
    } catch {
      setFeatures({});
    }
  }, [token]);

  useEffect(() => {
    // Defer the location prompt to a location-relevant screen (Find a Coach)
    // instead of ambushing the athlete on first load (§3.1). Still throttled to
    // once per 7 days by shouldAskForLocation().
    const onCoaching = location.pathname.startsWith("/app/coaching");
    if (token && user && onCoaching && shouldAskForLocation()) {
      const t = setTimeout(() => setShowLocation(true), 800);
      return () => clearTimeout(t);
    }
  }, [token, user, location.pathname]);

  useEffect(() => {
    fetchFeatures();
    const onRefresh = () => fetchFeatures();
    window.addEventListener("features:refresh", onRefresh);
    return () => window.removeEventListener("features:refresh", onRefresh);
  }, [fetchFeatures]);

  const BackChevron = isRtl ? ChevronRight : ChevronLeft;
  const avatarSrc = user ? (user.avatar || getAvatar(user.email, null, (user as any).gender, user.name)) : "";

  return (
    <div
      className={`app-view app-layout app-fwh${isRtl ? " rtl" : ""}${isDesktop ? " app-desktop user-panel-shell" : ""}`}
      style={{
        background: "var(--bg-primary)",
        color: "var(--text-primary)",
        minHeight: "100dvh",
        direction: isRtl ? "rtl" : "ltr",
        // Height of the top bar that sits above page content. Children use this
        // for sticky `top` offsets so their headers don't slide under it.
        // Desktop: the sticky panel header (62px). Mobile: fixed top bar
        // (56px) + iOS safe-area inset.
        ["--app-top-offset" as any]: isDesktop ? "62px" : "calc(56px + env(safe-area-inset-top))",
      }}
    >
      {/* ── Desktop Sidebar ── */}
      {isDesktop && (
        <aside
          className="user-panel-sidebar fade-up"
          style={{
            position: "fixed", top: 0, [isRtl ? "right" : "left"]: 0,
            width: currentSidebarW, height: "100dvh", zIndex: 100,
            background: "var(--bg-card)",
            display: "flex", flexDirection: "column", overflow: "hidden",
            transition: "width 0.28s cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          {/* Brand header + collapse toggle */}
          <div style={{
            display: "flex",
            flexDirection: sidebarCollapsed ? "column" : "row",
            alignItems: "center",
            justifyContent: sidebarCollapsed ? "center" : "space-between",
            gap: 10,
            padding: sidebarCollapsed ? "16px 0" : "20px 16px",
          }}>
            <Link to="/app/dashboard" className="user-panel-brand" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", minWidth: 0, flex: sidebarCollapsed ? "0 0 auto" : 1, borderRadius: 12, padding: sidebarCollapsed ? 0 : "4px 6px" }}>
              {sidebarCollapsed ? (
                <img src={favicon} alt={branding.app_name || "FitWay Hub"} style={{ width: 36, height: 36, borderRadius: 10, objectFit: "contain", flexShrink: 0 }} />
              ) : brandLogo ? (
                <img src={brandLogo} alt={branding.app_name || "FitWay Hub"} style={{ height: 28, borderRadius: 8, objectFit: "contain" }} />
              ) : (
                <span style={{
                  fontFamily: "var(--fwh-display, var(--font-heading))",
                  fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em",
                  color: "var(--text-primary)",
                }}>
                  {branding.app_name || "FitWay Hub"}
                </span>
              )}
            </Link>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setSidebarCollapsed(c => !c)}
              title={sidebarCollapsed ? "Expand" : "Collapse"}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="text-muted-foreground"
            >
              {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </Button>
          </div>

          {/* Nav items */}
          <nav style={{ flex: 1, overflowY: "auto", padding: sidebarCollapsed ? "8px 8px" : "8px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
            {allNav.map(({ path, icon: Icon, label }) => {
              const active = location.pathname === path || location.pathname.startsWith(path + "/");
              return (
                <NavLink
                  key={path}
                  to={path}
                  title={sidebarCollapsed ? labelForPath(path, label) : undefined}
                  className={`user-panel-nav-link${active ? " active" : ""}`}
                  style={{
                    display: "flex", alignItems: "center",
                    gap: sidebarCollapsed ? 0 : 12,
                    justifyContent: sidebarCollapsed ? "center" : "flex-start",
                    padding: sidebarCollapsed ? "11px 0" : "10px 12px",
                    borderRadius: 12, textDecoration: "none",
                    fontSize: 14, fontWeight: active ? 600 : 500,
                    color: active ? "var(--main)" : "var(--text-secondary)",
                    background: active ? "var(--main-dim)" : "transparent",
                    transition: "color 0.18s, background 0.18s",
                    whiteSpace: "nowrap", overflow: "hidden",
                  }}
                >
                  <Icon size={19} strokeWidth={active ? 2.4 : 1.9} />
                  {!sidebarCollapsed && labelForPath(path, label)}
                </NavLink>
              );
            })}
          </nav>

          {/* User avatar at bottom */}
          {user && (
            <div style={{ padding: sidebarCollapsed ? "8px" : "10px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
              <NavLink
                to="/app/profile"
                className="user-panel-profile-link"
                title={sidebarCollapsed ? (user.name || user.email) : undefined}
                style={{
                  display: "flex", alignItems: "center",
                  gap: sidebarCollapsed ? 0 : 12,
                  justifyContent: sidebarCollapsed ? "center" : "flex-start",
                  textDecoration: "none",
                  padding: sidebarCollapsed ? "8px 0" : "10px",
                  borderRadius: 14,
                }}
              >
                <Avatar className="size-9 ring-2 ring-primary/70">
                  <AvatarImage src={avatarSrc} alt="" />
                  <AvatarFallback>{initialsOf(user.name || user.email)}</AvatarFallback>
                </Avatar>
                {!sidebarCollapsed && (
                  <div style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name || user.email}</span>
                    <span style={{
                      display: "block", fontSize: 11, color: "var(--text-muted)",
                      textTransform: "capitalize", marginTop: 1,
                    }}>{user.role}</span>
                  </div>
                )}
              </NavLink>
              <Button
                variant="ghost"
                onClick={handleSignOut}
                title={sidebarCollapsed ? t("sign_out") : undefined}
                aria-label={t("sign_out")}
                className="h-10 justify-center text-destructive hover:text-destructive hover:bg-destructive/10"
                style={{ justifyContent: sidebarCollapsed ? "center" : "flex-start", paddingInline: sidebarCollapsed ? 0 : 12, gap: sidebarCollapsed ? 0 : 12 }}
              >
                <LogOut size={17} />
                {!sidebarCollapsed && t("sign_out")}
              </Button>
            </div>
          )}
        </aside>
      )}

      {/* ── Top Bar (mobile only) ── */}
      {!isDesktop && (
        <header className="app-top-bar">
          <div className="app-top-bar-inner">
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              {location.pathname !== '/app/dashboard' && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('back')}
                  onClick={() => window.history.back()}
                  className="-ms-1 text-foreground"
                >
                  <BackChevron size={22} strokeWidth={2.2} />
                </Button>
              )}
              <Link to="/app/dashboard" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", minWidth: 0 }}>
                {brandLogo ? (
                  <img src={brandLogo} alt={branding.app_name || "FitWay Hub"} style={{ height: 26, borderRadius: 8, objectFit: "contain" }} />
                ) : (
                  <span style={{
                    fontFamily: "var(--fwh-display, var(--font-heading))",
                    fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em",
                    color: "var(--text-primary)",
                  }}>
                    {branding.app_name || "FitWay Hub"}
                  </span>
                )}
              </Link>
            </div>

            {user && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {isFeatureEnabled("/app/notifications") && (
                  <NotificationDropdown token={token} size={20} align={isRtl ? "left" : "right"} buttonStyle={{ background: "transparent", border: "none", width: 38, height: 38 }} />
                )}
                <NavLink to="/app/profile" aria-label={t("nav_profile")} style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
                  <Avatar className="size-9 ring-2 ring-primary/70">
                    <AvatarImage src={avatarSrc} alt="" />
                    <AvatarFallback className="text-xs">{initialsOf(user.name || user.email)}</AvatarFallback>
                  </Avatar>
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
                      <Icon size={15} strokeWidth={isActive ? 2.5 : 1.9} />
                    </div>
                    <span className="app-top-scroll-label">{labelForPath(path, label)}</span>
                  </NavLink>
                );
              })}
              <button
                type="button"
                onClick={handleSignOut}
                className="app-top-scroll-item"
                style={{ background: "none", cursor: "pointer", color: "var(--red)" }}
                aria-label={t("sign_out")}
              >
                <div className="app-top-scroll-icon-wrap">
                  <LogOut size={15} strokeWidth={2} />
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
        ...(isDesktop ? { [isRtl ? "marginRight" : "marginLeft"]: currentSidebarW, transition: "margin 0.28s cubic-bezier(0.22,1,0.36,1)" } : {}),
      }}>
        {isDesktop && (
          <header className="user-panel-header panel-topbar fade-up" style={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            minHeight: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            background: "color-mix(in srgb, var(--bg-primary) 80%, transparent)",
            backdropFilter: "saturate(180%) blur(20px)",
            WebkitBackdropFilter: "saturate(180%) blur(20px)",
            gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", minWidth: 0, flex: 1, gap: 8 }}>
              {location.pathname !== '/app/dashboard' && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('back')}
                  onClick={() => window.history.back()}
                  className="-ms-2 text-muted-foreground"
                >
                  <BackChevron size={22} strokeWidth={2.2} />
                </Button>
              )}
              <h1 style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 600,
                fontFamily: "var(--fwh-display, var(--font-heading))",
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
                color: "var(--text-primary)",
              }}>{currentPageLabel}</h1>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isFeatureEnabled("/app/notifications") && (
              <NotificationDropdown token={token} size={18} align={isRtl ? "left" : "right"} />
            )}
            {user && (
              <NavLink to="/app/profile" aria-label={t("nav_profile")} style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
                <Avatar className="size-9 ring-2 ring-primary/70">
                  <AvatarImage src={avatarSrc} alt="" />
                  <AvatarFallback className="text-xs">{initialsOf(user.name || user.email)}</AvatarFallback>
                </Avatar>
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
                      <Icon size={42} strokeWidth={1.9} />
                    </span>
                  </NavLink>
                );
              }
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `app-nav-item${isActive ? " active" : ""}`}
                  aria-label={labelForPath(item.path, item.label)}
                >
                  {({ isActive }) => (
                    <>
                      <div className="app-nav-icon-wrap">
                        <Icon size={21} color={isActive ? "var(--main)" : "var(--text-muted)"} strokeWidth={isActive ? 2.5 : 1.9} />
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

      {/* App-scoped toast host (Apple-style, soft shadow) */}
      <Toaster />
    </div>
  );
}
