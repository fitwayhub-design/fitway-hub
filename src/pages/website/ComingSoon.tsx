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
 * (case-insensitive). Once matched, the gate is bypassed and the page reloads.
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
  const accent = branding.primary_color || "#FFD600";

  useAdminLoginKeystrokeBypass();

  const isAr = lang === "ar";
  const headline = isAr ? "قريبًا" : "COMING SOON";
  const tagline = isAr ? "حيث تلتقي اللياقة بالحركة الأمامية" : "Where Fitness Meets Forward Motion";

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
        padding: "32px 24px",
        backgroundColor: "#000000",
        backgroundImage: bg ? `url(${bg})` : "none",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        color: "#ffffff",
        fontFamily: "var(--font-en)",
        overflow: "hidden",
      }}
    >
      {/* Subtle dark wash so headline + logo always read on any image */}
      {bg && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.65) 60%, rgba(0,0,0,0.85) 100%)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Centerpiece: logo above huge headline */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          maxWidth: 1100,
          width: "100%",
        }}
      >
        {brandLogo && (
          <img
            src={brandLogo}
            alt={branding.app_name || "FitWay Hub"}
            style={{
              maxWidth: "min(360px, 60vw)",
              maxHeight: 160,
              objectFit: "contain",
            }}
          />
        )}

        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "clamp(56px, 13vw, 200px)",
            fontWeight: 900,
            letterSpacing: "-0.02em",
            margin: 0,
            lineHeight: 0.95,
            color: accent,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {headline}
        </h1>
      </div>

      {/* Tagline anchored to bottom-center, like the reference */}
      <div
        style={{
          position: "absolute",
          bottom: "calc(40px + env(safe-area-inset-bottom))",
          left: 0,
          right: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          color: accent,
          fontSize: 14,
          letterSpacing: "0.02em",
          padding: "0 24px",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            border: `1.5px solid ${accent}`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          ©
        </span>
        <p style={{ margin: 0, fontFamily: "var(--font-en)", lineHeight: 1.4, textAlign: isAr ? "right" : "left" }}>
          {tagline}
        </p>
      </div>
    </div>
  );
}
