import { useEffect } from "react";
import { useBranding, getBrandLogoForLang } from "@/context/BrandingContext";
import { useTheme } from "@/context/ThemeContext";
import { useI18n } from "@/context/I18nContext";

const BYPASS_KEY = "fitway_cs_bypass";
const BYPASS_PHRASE = "adminlogin";

export function isComingSoonBypassed(): boolean {
  try { return localStorage.getItem(BYPASS_KEY) === "1"; } catch { return false; }
}

export function setComingSoonBypassed(on: boolean) {
  try {
    if (on) localStorage.setItem(BYPASS_KEY, "1");
    else localStorage.removeItem(BYPASS_KEY);
  } catch {}
}

/**
 * Listens globally for the user typing "adminlogin" anywhere on the page
 * (case-insensitive, ignores other keys). When matched, the gate is bypassed
 * and the page reloads to show the real website.
 */
export function useAdminLoginKeystrokeBypass() {
  useEffect(() => {
    let buffer = "";
    const onKey = (e: KeyboardEvent) => {
      if (e.key.length !== 1) return;
      buffer = (buffer + e.key.toLowerCase()).slice(-BYPASS_PHRASE.length);
      if (buffer === BYPASS_PHRASE) {
        setComingSoonBypassed(true);
        window.location.reload();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export default function ComingSoon() {
  const { branding } = useBranding();
  const { isDark } = useTheme();
  const { lang } = useI18n();
  const brandLogo = getBrandLogoForLang(branding, lang, isDark);
  const bg = branding.coming_soon_bg_image;

  useAdminLoginKeystrokeBypass();

  const isAr = lang === "ar";
  const headline = isAr ? "قريباً" : "Coming Soon";
  const sub = isAr ? "ترقّبوا" : "Stay tuned";

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: 24,
        backgroundColor: "var(--bg-primary)",
        backgroundImage: bg ? `url(${bg})` : "none",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        color: "var(--text-primary)",
        fontFamily: "var(--font-en)",
      }}
    >
      {/* Soft overlay so logo + text stay readable on any image */}
      {bg && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: isDark
              ? "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.65) 100%)"
              : "linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.55) 100%)",
            pointerEvents: "none",
          }}
        />
      )}

      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 28, maxWidth: 640 }}>
        {brandLogo && (
          <img
            src={brandLogo}
            alt={branding.app_name || "FitWay Hub"}
            style={{ maxWidth: 220, maxHeight: 120, objectFit: "contain" }}
          />
        )}

        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "clamp(40px, 8vw, 84px)",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            margin: 0,
            lineHeight: 1.05,
          }}
        >
          {headline}
        </h1>

        <div style={{ display: "flex", alignItems: "center", gap: 14, opacity: 0.85 }}>
          <span style={{ width: 36, height: 1, background: "currentColor", opacity: 0.4 }} />
          <p style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 500,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontFamily: "var(--font-en)",
          }}>
            {sub}
          </p>
          <span style={{ width: 36, height: 1, background: "currentColor", opacity: 0.4 }} />
        </div>
      </div>
    </div>
  );
}
