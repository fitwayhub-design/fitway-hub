import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, Activity, Instagram, Facebook, Twitter, Youtube, Sun, Moon, ChevronDown, ArrowRight, Mail } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/context/ThemeContext";
import { useBranding, getBrandLogoForLang } from "@/context/BrandingContext";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { getAvatar } from "@/lib/avatar";

export function WebsiteLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);
  const accountRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const { branding } = useBranding();
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const displayName = user?.name || user?.email?.split("@")[0] || t("nav_home");
  const brandLogo = getBrandLogoForLang(branding, lang, isDark);

  const appRoute = user?.role === "admin"
    ? "/admin/dashboard"
    : user?.role === "coach"
      ? "/coach/dashboard"
      : "/app/dashboard";

  const navLinks: Array<{name:string;path:string}> = [
    { name: t("nav_home"), path: "/" },
    { name: t("blog_title"), path: "/blogs" },
    { name: t("about"), path: "/about" },
    { name: t("contact"), path: "/contact" },
  ];

  const footerProductLinks = [
    { name: t("nav_home"), path: "/" },
    { name: t("about"), path: "/about" },
    { name: t("contact"), path: "/contact" },
  ];
  const legalLinks = [t("privacy_policy"), t("terms")];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onClickAway = (e: MouseEvent) => {
      if (!accountRef.current?.contains(e.target as Node)) setAccountOpen(false);
    };
    window.addEventListener("mousedown", onClickAway);
    return () => window.removeEventListener("mousedown", onClickAway);
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* ── Scroll reveal observer — supports multiple motion styles ── */
  useEffect(() => {
    const selectors = "main section, main [data-reveal]";
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(selectors));
    if (!nodes.length) return;

    /* Assign motion class based on data-reveal or default cycle */
    const motionCycle = ["rv-fade-up", "rv-slide-left", "rv-scale-up", "rv-fade-up", "rv-slide-right", "rv-pop"];
    const skipNodes = new Set<HTMLElement>();
    nodes.forEach((el, i) => {
      const explicit = el.dataset.reveal;
      if (explicit === "none") { skipNodes.add(el); return; }
      const cls = explicit ? `rv-${explicit}` : motionCycle[i % motionCycle.length];
      el.classList.add("rv", cls);
      el.style.setProperty("--rv-delay", `${Math.min(i * 60, 300)}ms`);
    });

    /* Also stagger direct children that opt in */
    document.querySelectorAll<HTMLElement>("[data-stagger]").forEach((parent) => {
      Array.from(parent.children).forEach((child, ci) => {
        const ch = child as HTMLElement;
        ch.classList.add("rv", "rv-fade-up");
        ch.style.setProperty("--rv-delay", `${ci * 80}ms`);
        nodes.push(ch);
      });
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).classList.add("rv-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    nodes.forEach((el) => { if (!skipNodes.has(el)) observer.observe(el); });
    return () => observer.disconnect();
  }, [location.pathname]);

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const headerBg = "transparent";

  return (
    <div
      className={`web-view web-fwh${lang === "ar" ? " rtl" : ""}`}
      dir={lang === "ar" ? "rtl" : "ltr"}
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
    >
      {/* ── Header ── */}
      <header
        className={`web-header${scrolled ? " scrolled" : ""}`}
        style={{
          backgroundColor: headerBg,
          backdropFilter: "none",
          WebkitBackdropFilter: "none",
          borderBottom: "1px solid transparent",
          transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: "none",
        }}
      >
        <div style={{
          maxWidth: 1280,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
          height: 68,
        }}>
          {/* Logo */}
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", flexShrink: 0 }}>
            {brandLogo ? (
              <img
                src={brandLogo}
                alt={branding.app_name || t("fitway_hub")}
                style={{ height: 32, borderRadius: 12, objectFit: "contain" }}
              />
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 12,
                  background: "var(--main)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Activity size={17} color="#0a0a0a" strokeWidth={2.5} />
                </div>
                <span style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  color: "var(--text-primary)",
                  textTransform: "uppercase",
                }}>
                  {branding.app_name || "FitWay Hub"}
                </span>
              </div>
            )}
          </Link>

          {/* Desktop nav — centered links (FWH minimal underline-on-active) */}
          {!isMobile && (
            <nav style={{
              position: "absolute", left: "50%", transform: "translateX(-50%)",
              display: "flex", alignItems: "center", gap: 28,
              background: "transparent",
              border: "none",
            }}>
              {navLinks.map((link) => {
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    style={{
                      padding: "6px 0",
                      fontSize: 12,
                      fontFamily: "var(--font-mono, ui-monospace, monospace)",
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      fontWeight: isActive ? 600 : 500,
                      textDecoration: "none",
                      transition: "color 0.2s",
                      color: isActive ? "var(--main)" : "var(--text-secondary)",
                      borderBottom: isActive ? "1px solid var(--main)" : "1px solid transparent",
                    }}
                  >
                    {link.name}
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Desktop actions */}
          {!isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Lang switcher */}
              <div style={{
                display: "flex", alignItems: "center", gap: 0,
                padding: 0, borderRadius: 12,
                border: "1px solid var(--border)",
                background: "transparent",
              }}>
                {["en", "ar"].map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l as "en" | "ar")}
                    style={{
                      minWidth: 36, height: 30, borderRadius: 12,
                      border: "none", cursor: "pointer",
                      fontSize: 11, fontWeight: 600,
                      letterSpacing: "0.12em",
                      fontFamily: "var(--font-mono, ui-monospace, monospace)",
                      background: lang === l ? "var(--main)" : "transparent",
                      color: lang === l ? "#0a0a0a" : "var(--text-muted)",
                      transition: "all 0.15s",
                    }}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                title={isDark ? t("switch_to_light_mode") : t("switch_to_dark_mode")}
                style={{
                  width: 32, height: 32, borderRadius: 12,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  cursor: "pointer", color: "var(--text-muted)",
                  transition: "all 0.15s",
                }}
              >
                {isDark ? <Sun size={14} /> : <Moon size={14} />}
              </button>

              {/* Account / CTA */}
              {user ? (
                <div ref={accountRef} style={{ position: "relative" }}>
                  <button
                    onClick={() => setAccountOpen(v => !v)}
                    style={{
                      padding: "5px 12px 5px 5px",
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 500,
                      letterSpacing: "0.06em",
                      border: "1px solid var(--border)",
                      backgroundColor: "transparent",
                      color: "var(--text-primary)",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                      height: 32,
                    }}
                  >
                    <img
                      src={user.avatar || getAvatar(user.email, null, (user as any).gender, user.name)}
                      alt=""
                      style={{ width: 22, height: 22, borderRadius: 12, objectFit: "cover" }}
                    />
                    <span style={{ textTransform: "uppercase" }}>{displayName}</span>
                    <ChevronDown size={12} style={{ opacity: 0.5, transform: accountOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
                  </button>
                  {accountOpen && (
                    <div style={{
                      position: "absolute",
                      insetInlineEnd: 0,
                      top: "calc(100% + 8px)",
                      minWidth: 200,
                      background: "var(--bg-card)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      boxShadow: "0 20px 50px rgba(0,0,0,0.4)",
                      overflow: "hidden",
                      zIndex: 80,
                    }}>
                      <button
                        onClick={() => { setAccountOpen(false); navigate(appRoute); }}
                        style={{ width: "100%", textAlign: "start", padding: "14px 18px", background: "transparent", border: "none", color: "var(--text-primary)", cursor: "pointer", fontSize: 13, fontWeight: 500 }}
                      >
                        {t("go_to_app")}
                      </button>
                      <div style={{ height: 1, background: "var(--border)" }} />
                      <button
                        onClick={() => { setAccountOpen(false); logout(); navigate("/"); }}
                        style={{ width: "100%", textAlign: "start", padding: "14px 18px", background: "transparent", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 13, fontWeight: 500 }}
                      >
                        {t("sign_out")}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link to="/auth/login" className="fwh-btn" style={{
                  padding: "10px 18px",
                  fontSize: 12,
                  letterSpacing: "0.12em",
                  textDecoration: "none",
                  height: 32,
                }}>
                  {t("get_started")}
                  <span className="fwh-btn-arr"><ArrowRight size={12} /></span>
                </Link>
              )}
            </div>
          )}

          {/* Mobile actions */}
          {isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ display: "flex", gap: 0, padding: 0, borderRadius: 12, border: "1px solid var(--border)", background: "transparent" }}>
                {["en", "ar"].map((l) => (
                  <button key={l} onClick={() => setLang(l as "en" | "ar")} style={{
                    minWidth: 32, height: 30, borderRadius: 12, border: "none", cursor: "pointer",
                    fontSize: 10, fontWeight: 600, letterSpacing: "0.12em",
                    fontFamily: "var(--font-mono, ui-monospace, monospace)",
                    background: lang === l ? "var(--main)" : "transparent",
                    color: lang === l ? "#0a0a0a" : "var(--text-muted)",
                  }}>{l.toUpperCase()}</button>
                ))}
              </div>
              <button
                onClick={toggleTheme}
                style={{ width: 32, height: 32, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "1px solid var(--border)", cursor: "pointer", color: "var(--text-muted)" }}
              >
                {isDark ? <Sun size={14} /> : <Moon size={14} />}
              </button>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                style={{
                  width: 36, height: 32, borderRadius: 12,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: menuOpen ? "var(--main)" : "transparent",
                  border: `1px solid ${menuOpen ? "var(--main)" : "var(--border)"}`,
                  cursor: "pointer",
                  color: menuOpen ? "#0a0a0a" : "var(--text-primary)",
                  transition: "all 0.2s",
                }}
                aria-label={t("toggle_menu")}
              >
                {menuOpen ? <X size={17} /> : <Menu size={17} />}
              </button>
            </div>
          )}
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div style={{
            borderTop: "1px solid var(--border)",
            backgroundColor: isDark ? "rgba(10,10,10,0.98)" : "rgba(240,237,230,0.98)",
            backdropFilter: "blur(20px)",
            padding: "16px 16px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 0,
          }}>
            {navLinks.map((link, i) => (
              <Link
                key={link.path}
                to={link.path}
                style={{
                  padding: "18px 18px",
                  borderRadius: 12,
                  fontSize: 14,
                  fontFamily: "var(--font-mono, ui-monospace, monospace)",
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  fontWeight: location.pathname === link.path ? 600 : 500,
                  textDecoration: "none",
                  color: location.pathname === link.path ? "var(--main)" : "var(--text-primary)",
                  backgroundColor: "transparent",
                  borderBottom: i < navLinks.length - 1 ? "1px solid var(--border)" : "none",
                  transition: "all 0.15s",
                }}
              >
                {link.name}
              </Link>
            ))}
            <div style={{ height: 1, backgroundColor: "var(--border)", margin: "16px 0 12px" }} />
            {user ? (
              <>
                <Link to={appRoute} className="fwh-btn" style={{
                  padding: "14px 18px", textAlign: "center",
                  textDecoration: "none", justifyContent: "center",
                }}>
                  {t("go_to_app")}
                  <span className="fwh-btn-arr"><ArrowRight size={14} /></span>
                </Link>
                <button
                  onClick={() => { logout(); navigate("/"); }}
                  className="fwh-btn-outline"
                  style={{
                    padding: "12px 18px", textAlign: "center",
                    cursor: "pointer", marginTop: 8, justifyContent: "center",
                    color: "var(--red)", borderColor: "rgba(248,113,113,0.35)",
                  }}
                >
                  <span>{t("sign_out")}</span>
                </button>
              </>
            ) : (
              <Link to="/auth/login" className="fwh-btn" style={{
                padding: "14px 18px", textAlign: "center",
                textDecoration: "none", justifyContent: "center",
              }}>
                {t("get_started")}
                <span className="fwh-btn-arr"><ArrowRight size={14} /></span>
              </Link>
            )}
          </div>
        )}
      </header>

      {/* ── Main ── */}
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>

      {/* ── Footer ── */}
      <footer style={{
        backgroundColor: "var(--bg-surface)",
        borderTop: "1px solid var(--border)",
        transition: "background-color 0.2s",
      }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "80px 32px 40px" }}>
          {/* Top section meta */}
          <div className="fwh-section-meta" style={{ marginBottom: 32 }}>
            <span>{lang === "ar" ? "تذييل · ٢٠٢٦" : "FOOTER · V.2026"}</span>
            <span>{lang === "ar" ? "كل النظام يعمل" : "ALL SYSTEMS GO"}</span>
          </div>

          {/* Top row — brand + socials */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "flex-start",
            flexWrap: "wrap", gap: 40, marginBottom: 48, paddingBottom: 48,
            borderBottom: "1px solid var(--border)",
          }}>
            <div style={{ maxWidth: 380 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                {brandLogo ? (
                  <img src={brandLogo} alt="" style={{ height: 30, borderRadius: 12, objectFit: "contain" }} />
                ) : (
                  <>
                    <div style={{
                      width: 34, height: 34, borderRadius: 12,
                      background: "var(--main)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Activity size={16} color="#0a0a0a" strokeWidth={2.5} />
                    </div>
                    <span style={{ fontFamily: "var(--font-heading)", fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", textTransform: "uppercase" }}>
                      {branding.app_name || "FitWay Hub"}
                    </span>
                  </>
                )}
              </div>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                {branding.footer_text || t("egypt_fitness")}
              </p>
            </div>

            {/* Social links — sharp FWH chips */}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {[
                { Icon: Instagram, url: branding.social_instagram },
                { Icon: Facebook, url: branding.social_facebook },
                { Icon: Twitter, url: branding.social_twitter },
                { Icon: Youtube, url: branding.social_youtube },
              ].filter(s => s.url).map(({ Icon, url }, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-social-link"
                  style={{
                    width: 40, height: 40, borderRadius: 12,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: "1px solid var(--border)",
                    color: "var(--text-muted)",
                    background: "transparent",
                    transition: "all 0.25s",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.color = "var(--main)";
                    e.currentTarget.style.borderColor = "var(--main)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.color = "var(--text-muted)";
                    e.currentTarget.style.borderColor = "var(--border)";
                  }}
                >
                  <Icon size={16} strokeWidth={1.6} />
                </a>
              ))}
            </div>
          </div>

          {/* Links grid */}
          <div
            style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 40 }}
            className="footer-grid"
          >
            {/* Product col */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.18em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 18, fontFamily: "var(--font-mono, ui-monospace, monospace)" }}>{t("product")}</p>
              {footerProductLinks.map(l => (
                <Link key={l.path} to={l.path} className="web-footer-link">{l.name}</Link>
              ))}
              <Link to="/blogs" className="web-footer-link">{t("blog_title")}</Link>
            </div>

            {/* Legal col */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.18em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 18, fontFamily: "var(--font-mono, ui-monospace, monospace)" }}>{t("legal")}</p>
              {legalLinks.map((l) => (
                <a key={l} href="#" className="web-footer-link">{l}</a>
              ))}
            </div>

            {/* Contact col */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.18em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 18, fontFamily: "var(--font-mono, ui-monospace, monospace)" }}>{t("contact")}</p>
              <Link to="/contact" className="web-footer-link" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Mail size={14} /> {t("contact")}
              </Link>
            </div>
          </div>

          {/* Huge wordmark */}
          <div className="fwh-foot-mark" style={{ marginTop: 64, marginBottom: 32 }}>
            {(branding.app_name || "FitWay Hub")}<span className="fwh-foot-mark-yellow">.</span>
          </div>

          {/* Bottom bar */}
          <div style={{
            marginTop: 24, paddingTop: 24,
            borderTop: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: 12,
          }}>
            <p style={{
              fontSize: 11, color: "var(--text-muted)",
              fontFamily: "var(--font-mono, ui-monospace, monospace)",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}>
              {branding.copyright_text || `© ${new Date().getFullYear()} ${t("fitway_hub")} — ${t("all_rights_reserved")}`}
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "var(--green)",
                boxShadow: "0 0 8px var(--green)",
                animation: "pulse-dot 2s infinite",
              }} />
              <span style={{
                fontSize: 11, color: "var(--text-muted)", fontWeight: 500,
                fontFamily: "var(--font-mono, ui-monospace, monospace)",
                letterSpacing: "0.16em", textTransform: "uppercase",
              }}>{lang === "ar" ? "كل النظام يعمل" : "All systems operational"}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
