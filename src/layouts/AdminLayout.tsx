import { Outlet, Link, NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Settings, Activity,
  Gift, DollarSign, Video, Megaphone, UserCheck, Globe, MessageCircle, FileText,
  ClipboardList, Wallet, Mail, Bell, ShieldCheck, Flag, Image as ImageIcon,
} from "lucide-react";
import { useBranding, getBrandLogoForLang } from "@/context/BrandingContext";
import { useI18n } from "@/context/I18nContext";
import { useTheme } from "@/context/ThemeContext";
import { SharedSidebar, NavItem } from "@/components/layout/SharedSidebar";

const navItems: NavItem[] = [
  { path: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/admin/users",     icon: Users,           label: "Users" },
  { path: "/admin/coaches",   icon: UserCheck,       label: "Coaches" },
  { path: "/admin/certifications", icon: ShieldCheck, label: "Certifications" },
  { path: "/admin/coach-reports", icon: Flag, label: "Coach Reports" },
  { path: "/admin/payments",  icon: DollarSign,      label: "Payments" },
  { path: "/admin/videos",    icon: Video,           label: "Videos" },
  { path: "/admin/ads",         icon: Megaphone,       label: "Ads Manager" },
  { path: "/admin/ad-settings", icon: Settings,        label: "Ads Settings" },
  { path: "/admin/chat",      icon: MessageCircle,   label: "Chat" },
  { path: "/admin/gifts",     icon: Gift,            label: "Gifts" },
  { path: "/admin/blogs",          icon: FileText,        label: "No Pain No Shawerma" },
  { path: "/admin/website",        icon: Globe,           label: "Website" },
  { path: "/admin/app-images",     icon: ImageIcon,       label: "App Images" },
  { path: "/admin/subscriptions",  icon: ClipboardList,   label: "Subscriptions" },
  { path: "/admin/withdrawals",    icon: Wallet,          label: "Withdrawals" },
  { path: "/admin/email",          icon: Mail,            label: "Email Server" },
  { path: "/admin/notifications",  icon: Bell,            label: "Notifications" },
  { path: "/admin/settings",       icon: Settings,        label: "Settings" },
];

const bottomNavItems: NavItem[] = [
  { path: "/admin/dashboard", icon: LayoutDashboard, label: "Overview" },
  { path: "/admin/users",     icon: Users,           label: "Users" },
  { path: "/admin/payments",  icon: DollarSign,      label: "Payments" },
  { path: "/admin/coaches",   icon: UserCheck,       label: "Coaches" },
  { path: "/admin/settings",  icon: Settings,        label: "Settings" },
];

const moreItems: NavItem[] = [
  { path: "/admin/videos",  icon: Video,     label: "Videos" },
  { path: "/admin/ads",     icon: Megaphone, label: "Coach Ads" },
  { path: "/admin/chat",           icon: MessageCircle, label: "Chat" },
  { path: "/admin/gifts",          icon: Gift,          label: "Gifts" },
  { path: "/admin/website",        icon: Globe,         label: "Website" },
  { path: "/admin/subscriptions",  icon: ClipboardList, label: "Subscriptions" },
  { path: "/admin/withdrawals",    icon: Wallet,        label: "Withdrawals" },
  { path: "/admin/email",          icon: Mail,          label: "Email Server" },
  { path: "/admin/notifications",  icon: Bell,          label: "Notifications" },
];

export function AdminLayout() {
  const { branding } = useBranding();
  const { lang, t } = useI18n();
  const { isDark } = useTheme();
  const isRtl = lang === "ar";
  const location = useLocation();
  const brandLogo = getBrandLogoForLang(branding, lang, isDark);
  const translatedNavItems: NavItem[] = [
    { path: "/admin/dashboard", icon: LayoutDashboard, label: t("dashboard") },
    { path: "/admin/users",     icon: Users,           label: t("users") },
    { path: "/admin/coaches",   icon: UserCheck,       label: t("coaches") },
    { path: "/admin/certifications", icon: ShieldCheck, label: t("certifications") },
    { path: "/admin/coach-reports", icon: Flag, label: t("coach_reports") },
    { path: "/admin/payments",  icon: DollarSign,      label: t("payments") },
    { path: "/admin/videos",    icon: Video,           label: t("videos") },
    { path: "/admin/ads",       icon: Megaphone,       label: t("ads_manager") },
    { path: "/admin/chat",      icon: MessageCircle,   label: t("chat") },
    { path: "/admin/gifts",     icon: Gift,            label: t("gifts") },
    { path: "/admin/blogs",          icon: FileText,        label: "No Pain No Shawerma" },
    { path: "/admin/website",        icon: Globe,           label: t("website") },
    { path: "/admin/app-images",     icon: ImageIcon,       label: t("app_images") || "App Images" },
    { path: "/admin/subscriptions",  icon: ClipboardList,   label: t("subscriptions") || "Subscriptions" },
    { path: "/admin/withdrawals",    icon: Wallet,          label: t("withdrawals") || "Withdrawals" },
    { path: "/admin/email",          icon: Mail,            label: t("email_server") },
    { path: "/admin/notifications",  icon: Bell,            label: t("notifications") },
    { path: "/admin/settings",       icon: Settings,        label: t("settings") },
  ];

  const translatedBottomNavItems: NavItem[] = [
    { path: "/admin/dashboard", icon: LayoutDashboard, label: t("overview") },
    { path: "/admin/users",     icon: Users,           label: t("users") },
    { path: "/admin/payments",  icon: DollarSign,      label: t("payments") },
    { path: "/admin/coaches",   icon: UserCheck,       label: t("coaches") },
    { path: "/admin/settings",  icon: Settings,        label: t("settings") },
  ];

  const translatedMoreItems: NavItem[] = [
    { path: "/admin/videos",  icon: Video,          label: t("videos") },
    { path: "/admin/ads",     icon: Megaphone,      label: t("ads_manager") },
    { path: "/admin/coach-reports", icon: Flag,      label: t("coach_reports") },
    { path: "/admin/chat",           icon: MessageCircle,  label: t("chat") },
    { path: "/admin/gifts",          icon: Gift,           label: t("gifts") },
    { path: "/admin/blogs",          icon: FileText,       label: "No Pain No Shawerma" },
    { path: "/admin/website",        icon: Globe,          label: t("website") },
    { path: "/admin/app-images",     icon: ImageIcon,      label: t("app_images") || "App Images" },
    { path: "/admin/subscriptions",  icon: ClipboardList,  label: t("subscriptions") || "Subscriptions" },
    { path: "/admin/withdrawals",    icon: Wallet,         label: t("withdrawals") || "Withdrawals" },
    { path: "/admin/email",          icon: Mail,           label: t("email_server") },
    { path: "/admin/notifications",  icon: Bell,           label: t("notifications") },
  ];
  const currentPageLabel = translatedNavItems.find((item) => item.path === location.pathname)?.label || t("dashboard");
  const { isMobile, sidebarW, DesktopSidebar, OverlayDrawer, MobileTopBar, MobileBottomBar } = SharedSidebar({
    navItems: translatedNavItems,
    bottomNavItems: translatedBottomNavItems,
    moreDrawerItems: translatedMoreItems,
    accentColor: "var(--main)",
    accentBg: "var(--main-dim)",
    logoIcon: Activity,
    logoIconColor: "var(--main)",
    logoLabel: "",
    logoUrl: brandLogo || undefined,
    roleLabel: "🛡️ Admin",
    roleLabelColor: "var(--main)",
    notificationPath: "/admin/notifications",
    homePath: "/admin/dashboard",
  });

  return (
    <div className={`app-fwh${isRtl ? " rtl" : ""}`} style={{ minHeight: "100vh", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", display: "flex", overflow: "hidden" }}>
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
                {location.pathname !== '/admin/dashboard' && (
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
              <Link to="/admin/notifications" style={{ textDecoration: "none", width: 34, height: 34, borderRadius: 12, background: "transparent", border: "1px solid var(--border)", color: "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Bell size={18} />
              </Link>
            </div>
          </header>
        )}
        <div style={{ padding: isMobile ? "16px 12px" : "24px 20px", maxWidth: 1200, margin: "0 auto" }}>
          <Outlet />
        </div>
      </main>

      {isMobile && <MobileBottomBar />}
    </div>
  );
}
