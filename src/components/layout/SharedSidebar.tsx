import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Sun, Moon, Menu, X, ChevronLeft, ChevronRight, Grid, Bell } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useI18n } from "@/context/I18nContext";
import { getApiBase } from "@/lib/api";

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

export function SharedSidebar({
  navItems, bottomNavItems, accentColor, accentBg,
  logoIcon: LogoIcon, logoIconColor, logoLabel, logoUrl,
  roleLabel, roleLabelColor, extraFooter, moreDrawerItems, notificationPath, homePath,
}: SharedSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { t, lang, setLang } = useI18n();
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
        const r = await fetch(`${getApiBase()}/api/notifications/list`, { headers: { Authorization: `Bearer ${token}` } });
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
          padding: showLabel ? "9px 12px" : "10px 0",
          borderRadius: 12,
          marginBottom: 2,
          fontSize: 13.5,
          fontWeight: active ? 600 : 400,
          textDecoration: "none",
          backgroundColor: active ? accentBg : "transparent",
          color: active ? accentColor : "var(--text-secondary)",
          transition: "all 0.15s",
          whiteSpace: "nowrap",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <item.icon size={16} strokeWidth={active ? 2.5 : 1.75} style={{ flexShrink: 0 }} />
        {showLabel && <span style={{ overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{item.label}</span>}
        {item.badge ? (
          <span style={{
            marginInlineStart: showLabel ? "auto" : undefined,
            minWidth: 18, height: 18,
            borderRadius: 12, backgroundColor: accentColor, color: "#000000",
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
          backgroundColor: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 12, padding: compact ? "8px 10px" : "10px 12px",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: compact ? 28 : 32, height: compact ? 28 : 32,
            borderRadius: "50%", border: `2px solid ${accentColor}`,
            padding: 1, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <img src={user.avatar} alt={user.name} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</p>
            <p style={{ fontSize: 11, color: roleLabelColor, marginTop: 1, fontWeight: 600 }}>{roleLabel}</p>
          </div>
        </div>
      </div>
    ) : null;

  // ── Footer Actions ──────────────────────────────────────────────────────────
  const FooterActions = ({ showLabels = true }: { showLabels?: boolean }) => (
    <div style={{ borderTop: "1px solid var(--border)", padding: showLabels ? "8px 8px 16px" : "8px 6px 14px", flexShrink: 0 }}>
      {extraFooter && showLabels && <div style={{ marginBottom: 10 }}>{extraFooter}</div>}
      <button onClick={toggleTheme} style={{ display: "flex", alignItems: "center", gap: showLabels ? 8 : 0, justifyContent: showLabels ? "flex-start" : "center", width: "100%", padding: showLabels ? "8px 12px" : "8px 0", borderRadius: 12, fontSize: 12, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", marginBottom: 2, whiteSpace: "nowrap" }}>
        {isDark ? <Moon size={14} /> : <Sun size={14} />}
        {showLabels && (isDark ? t("dark_mode") : t("light_mode"))}
      </button>
      <button onClick={() => setLang(lang === "en" ? "ar" : "en")} style={{ display: "flex", alignItems: "center", gap: showLabels ? 8 : 0, justifyContent: showLabels ? "flex-start" : "center", width: "100%", padding: showLabels ? "8px 12px" : "8px 0", borderRadius: 12, fontSize: 12, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", marginBottom: 2, whiteSpace: "nowrap" }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>{lang === "en" ? "🇸🇦" : "🇬🇧"}</span>
        {showLabels && (lang === "en" ? "العربية" : "English")}
      </button>
      <button onClick={handleLogout} style={{ display: "flex", alignItems: "center", gap: showLabels ? 10 : 0, justifyContent: showLabels ? "flex-start" : "center", width: "100%", padding: showLabels ? "9px 12px" : "9px 0", borderRadius: 12, fontSize: 13, fontWeight: 500, color: "var(--red)", background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
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
      backgroundColor: "var(--bg-surface)",
      borderInlineEnd: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", borderBottom: "1px solid var(--border)", flexShrink: 0, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden", flex: 1 }}>
          {!sidebarCollapsed && (
            <img src={logoUrl || "/logo.svg"} alt={logoLabel} style={{ height: 30, borderRadius: 8, objectFit: "contain", flexShrink: 0 }} />
          )}
          {sidebarCollapsed && (
            <div style={{ width: 32, height: 32, borderRadius: 12, background: `${accentColor}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <LogoIcon size={16} color={accentColor} />
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {notificationPath && (
            <Link to={notificationPath} title="Notifications" style={{ position: "relative", width: 28, height: 28, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-muted)", textDecoration: "none" }}>
              <Bell size={14} />
              {unreadNotifs > 0 && (
                <span style={{ position: "absolute", top: -4, right: -4, minWidth: 14, height: 14, borderRadius: 9999, background: "#EF4444", color: "#fff", fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", border: "2px solid var(--bg-surface)" }}>{unreadNotifs > 9 ? "9+" : unreadNotifs}</span>
              )}
            </Link>
          )}
          <button onClick={() => setSidebarCollapsed(c => !c)} style={{ width: 28, height: 28, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-card)", border: "1px solid var(--border)", cursor: "pointer", color: "var(--text-muted)", flexShrink: 0 }}>
            {sidebarCollapsed ? (isRtl ? <ChevronLeft size={14} /> : <ChevronRight size={14} />) : (isRtl ? <ChevronRight size={14} /> : <ChevronLeft size={14} />)}
          </button>
        </div>
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
        <div onClick={() => setDrawerOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 55, backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} />
      )}
      <aside style={{
        position: "fixed", top: 0, insetInlineStart: 0, bottom: 0,
        width: 270, zIndex: 60,
        backgroundColor: "var(--bg-surface)",
        borderInlineEnd: "1px solid var(--border)",
        display: "flex", flexDirection: "column",
        transform: drawerOpen ? "translateX(0)" : (isRtl ? "translateX(100%)" : "translateX(-100%)"),
        transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
        boxShadow: drawerOpen ? "4px 0 40px rgba(0,0,0,0.4)" : "none",
      }}>
        <div style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <img src={logoUrl || "/logo.svg"} alt={logoLabel} style={{ height: 28, borderRadius: 8, objectFit: "contain" }} />
          <button onClick={() => setDrawerOpen(false)} style={{ width: 34, height: 34, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-card)", border: "1px solid var(--border)", cursor: "pointer", color: "var(--text-secondary)" }}>
            <X size={16} />
          </button>
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
      backgroundColor: "rgba(15, 15, 15, 0.55)",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      backdropFilter: "var(--nav-blur)",
      WebkitBackdropFilter: "var(--nav-blur)",
      display: "flex", alignItems: "flex-end",
    }}>
      <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", height: 56 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setDrawerOpen(o => !o)} style={{ width: 36, height: 36, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: drawerOpen ? accentBg : "var(--bg-card)", border: `1px solid ${drawerOpen ? accentColor : "var(--border)"}`, cursor: "pointer", color: drawerOpen ? accentColor : "var(--text-secondary)", transition: "all 0.15s" }}>
            {drawerOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          {showBack && (
            <button
              aria-label="Back"
              onClick={() => window.history.back()}
              style={{
                background: "none", border: "none", cursor: "pointer", padding: 0,
                display: "flex", alignItems: "center",
                color: "var(--text-secondary)", fontSize: 20, flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points={isRtl ? "9 18 15 12 9 6" : "15 18 9 12 15 6"}/></svg>
            </button>
          )}
          <img src={logoUrl || "/logo.svg"} alt={logoLabel} style={{ height: 26, borderRadius: 8, objectFit: "contain" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {notificationPath && (
            <Link to={notificationPath} style={{ position: "relative", width: 34, height: 34, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)", textDecoration: "none" }}>
              <Bell size={16} />
              {unreadNotifs > 0 && (
                <span style={{ position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 9999, background: "#EF4444", color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", border: "2px solid var(--bg-primary)" }}>{unreadNotifs > 9 ? "9+" : unreadNotifs}</span>
              )}
            </Link>
          )}
          <button onClick={toggleTheme} style={{ width: 34, height: 34, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-card)", border: "1px solid var(--border)", cursor: "pointer", color: "var(--text-secondary)" }}>
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          {user?.avatar && (
            <div style={{ width: 32, height: 32, borderRadius: "50%", border: `2px solid ${accentColor}`, padding: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src={user.avatar} alt={user.name} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
            </div>
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
        <div onClick={() => setMoreOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "flex-end" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", background: "var(--bg-card)", borderRadius: "28px 28px 0 0", padding: "20px 20px calc(20px + env(safe-area-inset-bottom))", border: "1px solid var(--border-light)", boxShadow: "0 -8px 40px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <span style={{ fontFamily: "var(--font-heading)", fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em" }}>More</span>
              <button onClick={() => setMoreOpen(false)} style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--bg-surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-secondary)" }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {moreDrawerItems!.map(({ path, icon: Icon, label }) => {
                const active = isActive(path);
                return (
                  <button key={path} onClick={() => { navigate(path); setMoreOpen(false); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "14px 8px", borderRadius: 12, background: active ? accentBg : "var(--bg-surface)", border: `1px solid ${active ? accentColor : "var(--border)"}`, cursor: "pointer", transition: "all 0.15s" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: active ? accentColor : `${accentColor}22`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: active ? `0 4px 12px ${accentColor}44` : "none" }}>
                      <Icon size={18} color={active ? "#fff" : accentColor} strokeWidth={2} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: active ? 700 : 500, color: active ? accentColor : "var(--text-secondary)", lineHeight: 1.2, textAlign: "center" }}>{label}</span>
                  </button>
                );
              })}
              {/* Sign out */}
              <button onClick={() => { setMoreOpen(false); handleLogout(); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "14px 8px", borderRadius: 12, background: "var(--bg-surface)", border: "1px solid var(--border)", cursor: "pointer", transition: "all 0.15s" }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <LogOut size={18} color="var(--red)" strokeWidth={2} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--red)", lineHeight: 1.2, textAlign: "center" }}>{t("sign_out")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating pill nav (modernised) */}
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100, padding: `0 12px calc(12px + env(safe-area-inset-bottom))`, pointerEvents: "none" }} aria-label="Main navigation">
        <div style={{
          margin: "0 auto", maxWidth: 560,
          background: "rgba(20, 20, 20, 0.55)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 999,
          display: "flex", alignItems: "stretch", padding: 6,
          pointerEvents: "all",
          backdropFilter: "var(--nav-blur)",
          WebkitBackdropFilter: "var(--nav-blur)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.04) inset",
        }}>
          {bottomItems.map(({ path, icon: Icon, label }) => {
            const active = isActive(path);
            return (
              <Link key={path} to={path} style={{
                flex: "1 1 0", minWidth: 0,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 3,
                padding: "8px 4px", textDecoration: "none",
                borderRadius: 999,
                background: active ? `${accentColor}1f` : "transparent",
                transition: "background 0.25s cubic-bezier(0.4,0,0.2,1)",
                position: "relative",
              }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 999,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: active ? accentColor : "var(--text-muted)",
                  transition: "color 0.22s, transform 0.22s cubic-bezier(0.4,0,0.2,1)",
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
            <button onClick={() => setMoreOpen(o => !o)} style={{
              flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 3,
              padding: "8px 4px", background: (moreActive || moreOpen) ? `${accentColor}1f` : "none",
              border: "none", cursor: "pointer", borderRadius: 999,
              transition: "background 0.25s cubic-bezier(0.4,0,0.2,1)",
              position: "relative",
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: 999,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: (moreActive || moreOpen) ? accentColor : "var(--text-muted)",
                transition: "color 0.22s, transform 0.22s cubic-bezier(0.4,0,0.2,1)",
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
                }}>More</span>
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
