import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Sun, Moon, Menu, X, Grid, Bell, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useI18n } from "@/context/I18nContext";
import { useBranding } from "@/context/BrandingContext";
import { apiFetch } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export interface NavItem {
  path: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
}

interface SharedSidebarProps {
  navItems: NavItem[];
  bottomNavItems?: NavItem[];
  accentColor: string;
  accentBg: string;
  logoIcon: React.ElementType;
  logoIconColor: string;
  logoLabel: string;
  logoUrl?: string;
  roleLabel: string;
  roleLabelColor: string;
  extraFooter?: React.ReactNode;
  moreDrawerItems?: NavItem[];
  notificationPath?: string;
  homePath?: string;
}

const EXPANDED = 220;
const COLLAPSED = 62;

/** Initials for the avatar fallback (keeps a graceful state while the image loads). */
function initialsOf(nameOrEmail?: string) {
  if (!nameOrEmail) return "U";
  const base = nameOrEmail.includes("@") ? nameOrEmail.split("@")[0] : nameOrEmail;
  const parts = base.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export function SharedSidebar({
  navItems, bottomNavItems, accentColor, accentBg,
  logoLabel, logoUrl,
  roleLabel, roleLabelColor, extraFooter, moreDrawerItems, notificationPath, homePath,
}: SharedSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { t, lang, setLang } = useI18n();
  const { branding } = useBranding();
  const favicon = branding.favicon_url || "/favicon.svg";
  const isRtl = lang === "ar";

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  // Fetch unread notification count
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || !notificationPath) return;
    const fetchUnread = async () => {
      try {
        const r = await apiFetch(`/api/notifications/list`, { headers: { Authorization: `Bearer ${token}` } });
        if (r.ok) {
          const data = await r.json();
          const arr = Array.isArray(data) ? data : data.notifications || [];
          setUnreadNotifs(arr.filter((n: any) => !n.is_read).length);
        }
      } catch { /* ignore */ }
    };
    fetchUnread();
    const iv = setInterval(fetchUnread, 30_000);
    return () => clearInterval(iv);
  }, [notificationPath]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
    setMoreOpen(false);
  }, [location.pathname]);

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const sidebarW = sidebarCollapsed ? COLLAPSED : EXPANDED;
  const bottomItems = bottomNavItems || navItems.slice(0, 4);
  const hasMoreItems = moreDrawerItems && moreDrawerItems.length > 0;
  const moreActive = hasMoreItems && moreDrawerItems!.some(i => isActive(i.path));

  const handleLogout = () => { logout(); navigate("/auth/login", { replace: true }); };

  // ── Shared NavLink ──────────────────────────────────────────────────────────
  const NavLinkItem = ({ item, onClick, showLabel = true }: { item: NavItem; onClick?: () => void; showLabel?: boolean; key?: string }) => {
    const active = isActive(item.path);
    return (
      <Link
        to={item.path}
        onClick={onClick}
        title={!showLabel ? item.label : undefined}
        style={{
          display: "flex", alignItems: "center",
          gap: showLabel ? 10 : 0,
          justifyContent: showLabel ? "flex-start" : "center",
          padding: showLabel ? "10px 12px" : "11px 0",
          borderRadius: 12,
          marginBottom: 2,
          fontSize: 13.5,
          fontWeight: active ? 600 : 500,
          textDecoration: "none",
          backgroundColor: active ? accentBg : "transparent",
          color: active ? accentColor : "var(--text-secondary)",
          transition: "color 0.18s, background 0.18s",
          whiteSpace: "nowrap",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <item.icon size={18} strokeWidth={active ? 2.4 : 1.9} style={{ flexShrink: 0 }} />
        {showLabel && <span style={{ overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{item.label}</span>}
        {item.badge ? (
          <span style={{
            marginInlineStart: showLabel ? "auto" : undefined,
            minWidth: 18, height: 18,
            borderRadius: 9999, backgroundColor: accentColor, color: "#0A0A0A",
            fontSize: 10, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
          }}>
            {item.badge}
          </span>
        ) : null}
      </Link>
    );
  };

  // ── User Pill ────────────────────────────────────────────────────────────────
  const UserPill = ({ compact = false }: { compact?: boolean }) =>
    user ? (
      <div style={{ padding: compact ? "10px 8px 6px" : "12px 12px 8px" }}>
        <div style={{
          backgroundColor: "var(--bg-card)",
          borderRadius: 12, padding: compact ? "8px 10px" : "10px 12px",
          display: "flex", alignItems: "center", gap: 10,
          boxShadow: "var(--shadow-soft-sm)",
        }}>
          <Avatar
            className={compact ? "size-8" : "size-9"}
            style={{ boxShadow: `0 0 0 2px ${accentColor}`, flexShrink: 0 }}
          >
            <AvatarImage src={user.avatar} alt="" />
            <AvatarFallback className="text-xs">{initialsOf(user.name || user.email)}</AvatarFallback>
          </Avatar>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</p>
            <p style={{ fontSize: 11, color: roleLabelColor, marginTop: 1, fontWeight: 600 }}>{roleLabel}</p>
          </div>
        </div>
      </div>
    ) : null;

  // ── Footer Actions ──────────────────────────────────────────────────────────
  const footerBtnStyle = (showLabels: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center",
    gap: showLabels ? 10 : 0,
    justifyContent: showLabels ? "flex-start" : "center",
    width: "100%",
    padding: showLabels ? "9px 12px" : "9px 0",
    borderRadius: 12,
    fontSize: 13,
    color: "var(--text-secondary)",
    background: "none", border: "none", cursor: "pointer",
    marginBottom: 2, whiteSpace: "nowrap",
    transition: "color 0.18s, background 0.18s",
  });
  const FooterActions = ({ showLabels = true }: { showLabels?: boolean }) => (
    <div style={{ padding: showLabels ? "8px 8px 16px" : "8px 6px 14px", flexShrink: 0, boxShadow: "0 -0.5px 0 var(--border)" }}>
      {extraFooter && showLabels && <div style={{ marginBottom: 10 }}>{extraFooter}</div>}
      <button onClick={toggleTheme} style={footerBtnStyle(showLabels)}>
        {isDark ? <Moon size={16} style={{ flexShrink: 0 }} /> : <Sun size={16} style={{ flexShrink: 0 }} />}
        {showLabels && (isDark ? t("dark_mode") : t("light_mode"))}
      </button>
      <button onClick={() => setLang(lang === "en" ? "ar" : "en")} style={footerBtnStyle(showLabels)}>
        <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1 }}>{lang === "en" ? "🇸🇦" : "🇬🇧"}</span>
        {showLabels && (lang === "en" ? "العربية" : "English")}
      </button>
      <button onClick={handleLogout} style={{ ...footerBtnStyle(showLabels), fontWeight: 500, color: "var(--red)" }}>
        <LogOut size={16} style={{ flexShrink: 0 }} />
        {showLabels && t("sign_out")}
      </button>
    </div>
  );

  // ── Desktop Sidebar ─────────────────────────────────────────────────────────
  const DesktopSidebar = () => (
    <aside style={{
      position: "fixed", top: 0, insetInlineStart: 0, bottom: 0,
      width: sidebarW, zIndex: 40,
      backgroundColor: "var(--bg-card)",
      display: "flex", flexDirection: "column",
      transition: "width 0.28s cubic-bezier(0.22,1,0.36,1)",
      overflow: "hidden",
      boxShadow: "10px 0 36px rgba(0,0,0,.18)",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        flexDirection: sidebarCollapsed ? "column" : "row",
        alignItems: "center",
        justifyContent: sidebarCollapsed ? "center" : "space-between",
        gap: 8,
        padding: sidebarCollapsed ? "16px 0" : "0 12px",
        height: sidebarCollapsed ? "auto" : 64,
        flexShrink: 0,
      }}>
        {sidebarCollapsed ? (
          <Link to={homePath} aria-label="Home" style={{ display: "flex", flexShrink: 0 }}>
            <img src={favicon} alt={logoLabel || "Home"} style={{ width: 36, height: 36, borderRadius: 10, objectFit: "contain" }} />
          </Link>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden", flex: 1 }}>
            <Link to={homePath} aria-label="Home" style={{ display: "flex", flexShrink: 0 }}>
              <img src={logoUrl || "/logo.svg"} alt={logoLabel || "Home"} style={{ height: 30, borderRadius: 8, objectFit: "contain" }} />
            </Link>
          </div>
        )}
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

      {!sidebarCollapsed && <UserPill />}

      <nav style={{ flex: 1, padding: "4px 8px", overflowY: "auto", overflowX: "hidden" }}>
        {!sidebarCollapsed && (
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-muted)", padding: "8px 10px", textTransform: "uppercase", whiteSpace: "nowrap" }}>
            {t("navigation")}
          </p>
        )}
        {navItems.map(item => <NavLinkItem key={item.path} item={item} showLabel={!sidebarCollapsed} />)}
      </nav>

      <FooterActions showLabels={!sidebarCollapsed} />
    </aside>
  );

  // ── Overlay Drawer ──────────────────────────────────────────────────────────
  const OverlayDrawer = () => (
    <>
      {drawerOpen && (
        <div onClick={() => setDrawerOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 55, backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} />
      )}
      <aside style={{
        position: "fixed", top: 0, insetInlineStart: 0,
        // Stop above the floating bottom-nav pill so the two don't overlap.
        // Pill height (~54px) + outer padding (12px) + the device's safe-area
        // — keep this in sync with the nav's own padding below.
        bottom: "calc(78px + env(safe-area-inset-bottom))",
        width: 270, zIndex: 60,
        backgroundColor: "var(--bg-card)",
        borderEndEndRadius: 16, borderEndStartRadius: 16,
        display: "flex", flexDirection: "column",
        transform: drawerOpen ? "translateX(0)" : (isRtl ? "translateX(100%)" : "translateX(-100%)"),
        transition: "transform 0.25s cubic-bezier(0.22,1,0.36,1)",
        boxShadow: drawerOpen ? "var(--shadow-soft-lg)" : "none",
      }}>
        <div style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", flexShrink: 0, boxShadow: "0 0.5px 0 var(--border)" }}>
          <Link to={homePath} onClick={() => setDrawerOpen(false)} aria-label="Home" style={{ display: "flex" }}>
            <img src={logoUrl || "/logo.svg"} alt={logoLabel || "Home"} style={{ height: 28, borderRadius: 8, objectFit: "contain" }} />
          </Link>
          <Button variant="ghost" size="icon-sm" onClick={() => setDrawerOpen(false)} aria-label={t("close") || "Close"} className="text-muted-foreground">
            <X size={16} />
          </Button>
        </div>
        <UserPill />
        <nav style={{ flex: 1, padding: "4px 10px", overflowY: "auto" }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-muted)", padding: "8px 10px", textTransform: "uppercase" }}>{t("navigation")}</p>
          {navItems.map(item => <NavLinkItem key={item.path} item={item} showLabel onClick={() => setDrawerOpen(false)} />)}
        </nav>
        <FooterActions showLabels />
      </aside>
    </>
  );

  // ── Mobile Top Bar ── (matches AppLayout top bar exactly) ──────────────────
  const MobileTopBar = () => {
    const isRtl = lang === "ar";
    const showBack = homePath ? location.pathname !== homePath : false;
    return (
    <header style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 90,
      height: "calc(56px + env(safe-area-inset-top))",
      paddingTop: "env(safe-area-inset-top)",
      background: "color-mix(in srgb, var(--bg-primary) 70%, transparent)",
      backdropFilter: "saturate(180%) blur(22px)",
      WebkitBackdropFilter: "saturate(180%) blur(22px)",
      boxShadow: "0 0.5px 0 var(--border), 0 10px 24px -18px rgba(0,0,0,.5)",
      display: "flex", alignItems: "flex-end",
    }}>
      <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", height: 56 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setDrawerOpen(o => !o)}
            aria-label={drawerOpen ? (t("close") || "Close menu") : (t("menu") || "Open menu")}
            style={drawerOpen ? { background: accentBg, color: accentColor } : { color: "var(--text-secondary)" }}
          >
            {drawerOpen ? <X size={18} /> : <Menu size={18} />}
          </Button>
          {showBack && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("back") || "Back"}
              onClick={() => window.history.back()}
              className="-ms-1 text-foreground"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points={isRtl ? "9 18 15 12 9 6" : "15 18 9 12 15 6"}/></svg>
            </Button>
          )}
          <Link to={homePath} aria-label="Home" style={{ display: "flex" }}>
            <img src={logoUrl || "/logo.svg"} alt={logoLabel || "Home"} style={{ height: 26, borderRadius: 8, objectFit: "contain" }} />
          </Link>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {notificationPath && (
            <Button
              asChild
              variant="ghost"
              size="icon-sm"
              aria-label={t("notifications") || "Notifications"}
              className="relative text-foreground"
            >
              <Link to={notificationPath}>
                <Bell size={18} />
                {unreadNotifs > 0 && (
                  <span style={{ position: "absolute", top: 2, insetInlineEnd: 2, minWidth: 16, height: 16, borderRadius: 9999, background: "var(--red)", color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", boxShadow: "0 0 0 2px var(--bg-primary)" }}>{unreadNotifs > 9 ? "9+" : unreadNotifs}</span>
                )}
              </Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleTheme}
            aria-label={isDark ? (t("light_mode") || "Light mode") : (t("dark_mode") || "Dark mode")}
            className="text-foreground"
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </Button>
          {user && (
            <Link to={homePath} aria-label="Home" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
              <Avatar className="size-8" style={{ boxShadow: `0 0 0 2px ${accentColor}` }}>
                <AvatarImage src={user.avatar} alt="" />
                <AvatarFallback className="text-xs">{initialsOf(user.name || user.email)}</AvatarFallback>
              </Avatar>
            </Link>
          )}
        </div>
      </div>
    </header>
  );};

  // ── Mobile Bottom Nav ── (matches AppLayout floating pill exactly) ──────────
  const MobileBottomBar = () => (
    <>
      {/* More grid sheet */}
      {hasMoreItems && moreOpen && (
        <div onClick={() => setMoreOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "flex-end" }}>
          <div onClick={e => e.stopPropagation()} className="rounded-t-[20px]" style={{ width: "100%", background: "var(--bg-card)", padding: "20px 20px calc(20px + env(safe-area-inset-bottom))", boxShadow: "var(--shadow-soft-lg)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>{t("more") || "More"}</span>
              <Button variant="ghost" size="icon-sm" onClick={() => setMoreOpen(false)} aria-label={t("close") || "Close"} className="text-muted-foreground">
                <X size={16} />
              </Button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {moreDrawerItems!.map(({ path, icon: Icon, label }) => {
                const active = isActive(path);
                return (
                  <button key={path} onClick={() => { navigate(path); setMoreOpen(false); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "14px 8px", borderRadius: 12, background: active ? accentBg : "var(--bg-surface)", border: "none", cursor: "pointer", transition: "background 0.18s", boxShadow: active ? "none" : "var(--shadow-soft-xs)" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: active ? accentColor : `color-mix(in srgb, ${accentColor} 14%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: active ? `0 4px 12px color-mix(in srgb, ${accentColor} 28%, transparent)` : "none" }}>
                      <Icon size={18} color={active ? "#0A0A0A" : accentColor} strokeWidth={2} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: active ? 600 : 500, color: active ? accentColor : "var(--text-secondary)", lineHeight: 1.2, textAlign: "center" }}>{label}</span>
                  </button>
                );
              })}
              {/* Sign out */}
              <button onClick={() => { setMoreOpen(false); handleLogout(); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "14px 8px", borderRadius: 12, background: "var(--bg-surface)", border: "none", cursor: "pointer", transition: "background 0.18s", boxShadow: "var(--shadow-soft-xs)" }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: "color-mix(in srgb, var(--red) 12%, transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <LogOut size={18} color="var(--red)" strokeWidth={2} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--red)", lineHeight: 1.2, textAlign: "center" }}>{t("sign_out")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating pill nav (frosted, theme-adaptive) */}
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100, padding: `0 12px calc(12px + env(safe-area-inset-bottom))`, pointerEvents: "none" }} aria-label="Main navigation">
        <div style={{
          margin: "0 auto", maxWidth: 560,
          background: "color-mix(in srgb, var(--bg-card) 60%, transparent)",
          borderRadius: 999,
          display: "flex", alignItems: "stretch", padding: 6,
          pointerEvents: "all",
          backdropFilter: "saturate(180%) blur(22px)",
          WebkitBackdropFilter: "saturate(180%) blur(22px)",
          boxShadow: "var(--shadow-soft-lg)",
        }}>
          {bottomItems.map(({ path, icon: Icon, label }) => {
            const active = isActive(path);
            return (
              <Link key={path} to={path} aria-label={label} style={{
                flex: "1 1 0", minWidth: 0,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 3,
                padding: "8px 4px", textDecoration: "none",
                borderRadius: 999,
                background: active ? accentBg : "transparent",
                transition: "background 0.25s cubic-bezier(0.22,1,0.36,1)",
                position: "relative",
              }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 999,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: active ? accentColor : "var(--text-muted)",
                  transition: "color 0.22s, transform 0.22s cubic-bezier(0.22,1,0.36,1)",
                  transform: active ? "translateY(-1px)" : "none",
                }}>
                  <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
                </div>
                {active && (
                  <span style={{
                    fontSize: 9, fontWeight: 600,
                    color: accentColor,
                    letterSpacing: "0.16em", textTransform: "uppercase",
                    fontFamily: "var(--fwh-mono, 'Geist Mono', 'JetBrains Mono', ui-monospace, monospace)",
                    transition: "color 0.2s", whiteSpace: "nowrap",
                  }}>{label}</span>
                )}
                {active && (
                  <span style={{
                    position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)",
                    width: 4, height: 4, borderRadius: "50%",
                    background: accentColor, boxShadow: `0 0 8px ${accentColor}`,
                  }} />
                )}
              </Link>
            );
          })}

          {hasMoreItems && (
            <button onClick={() => setMoreOpen(o => !o)} aria-label={t("more") || "More"} style={{
              flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 3,
              padding: "8px 4px", background: (moreActive || moreOpen) ? accentBg : "none",
              border: "none", cursor: "pointer", borderRadius: 999,
              transition: "background 0.25s cubic-bezier(0.22,1,0.36,1)",
              position: "relative",
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: 999,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: (moreActive || moreOpen) ? accentColor : "var(--text-muted)",
                transition: "color 0.22s, transform 0.22s cubic-bezier(0.22,1,0.36,1)",
                transform: (moreActive || moreOpen) ? "translateY(-1px)" : "none",
              }}>
                <Grid size={20} strokeWidth={(moreActive || moreOpen) ? 2.4 : 1.8} />
              </div>
              {(moreActive || moreOpen) && (
                <span style={{
                  fontSize: 9, fontWeight: 600,
                  color: accentColor,
                  letterSpacing: "0.16em", textTransform: "uppercase",
                  fontFamily: "var(--fwh-mono, 'Geist Mono', 'JetBrains Mono', ui-monospace, monospace)",
                  transition: "color 0.2s",
                }}>{t("more") || "More"}</span>
              )}
              {(moreActive || moreOpen) && (
                <span style={{
                  position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)",
                  width: 4, height: 4, borderRadius: "50%",
                  background: accentColor, boxShadow: `0 0 8px ${accentColor}`,
                }} />
              )}
            </button>
          )}
        </div>
      </nav>
    </>
  );

  return { isMobile, sidebarW, DesktopSidebar, OverlayDrawer, MobileTopBar, MobileBottomBar };
}
