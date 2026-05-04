import { useEffect } from "react";
import { Facebook, Instagram } from "lucide-react";
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
  const headline = (isAr ? branding.coming_soon_text_ar : branding.coming_soon_text)?.trim()
    || (isAr ? "قريباً" : "COMING SOON");
  const followLabel = isAr ? "تابعنا على وسائل التواصل" : "Follow us on social media";

  const socials = [
    { Icon: Facebook, url: branding.social_facebook, label: "Facebook" },
    { Icon: Instagram, url: branding.social_instagram, label: "Instagram" },
  ].filter((s) => s.url && s.url.trim());

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
        justifyContent: "space-between",
        padding: "calc(48px + env(safe-area-inset-top)) 24px calc(40px + env(safe-area-inset-bottom))",
        backgroundColor: "#000000",
        backgroundImage: bg ? `url(${bg})` : "none",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        color: "#ffffff",
        fontFamily: "var(--font-en)",
        overflow: "hidden",
        textAlign: "center",
      }}
    >
      {/* Dark wash so logo + headline always read on any image */}
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

      {/* Top: Logo */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}>
        {brandLogo && (
          <img
            src={brandLogo}
            alt={branding.app_name || "FitWay Hub"}
            style={{
              maxWidth: "min(320px, 60vw)",
              maxHeight: 140,
              objectFit: "contain",
            }}
          />
        )}
      </div>

      {/* Middle: Headline */}
      <h1
        style={{
          position: "relative",
          fontFamily: "var(--font-heading)",
          fontSize: "clamp(56px, 13vw, 200px)",
          fontWeight: 900,
          letterSpacing: "-0.02em",
          margin: 0,
          lineHeight: 0.95,
          color: accent,
          textTransform: isAr ? "none" : "uppercase",
          maxWidth: "100%",
          wordBreak: "break-word",
        }}
      >
        {headline}
      </h1>

      {/* Bottom: Social links */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
        }}
      >
        {socials.length > 0 && (
          <>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: accent,
                fontWeight: 600,
              }}
            >
              {followLabel}
            </p>
            <div style={{ display: "flex", gap: 14 }}>
              {socials.map(({ Icon, url, label }) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    border: `1.5px solid ${accent}`,
                    color: accent,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textDecoration: "none",
                    transition: "background 0.18s, color 0.18s, transform 0.18s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = accent;
                    e.currentTarget.style.color = "#000";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = accent;
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <Icon size={20} strokeWidth={1.8} />
                </a>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
