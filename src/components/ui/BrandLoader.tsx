import { useBranding } from "@/context/BrandingContext";

type Props = {
  /** Full-screen overlay (default) or inline block. */
  fullScreen?: boolean;
  /** Logical size in px (default 88). */
  size?: number;
  /** Optional caption rendered under the mark. */
  label?: string;
};

/**
 * Branded loading indicator — renders the favicon with a gentle breathe+glow pulse.
 * Falls back to an accent dot if favicon isn't configured yet.
 */
export default function BrandLoader({ fullScreen = true, size = 88, label }: Props) {
  const { branding } = useBranding();
  const favicon = branding.favicon_url || "/favicon.svg";

  const wrapStyle = fullScreen
    ? {
        position: "fixed" as const,
        inset: 0,
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        backgroundColor: "var(--bg-primary)",
        zIndex: 99998,
      }
    : {
        display: "inline-flex",
        flexDirection: "column" as const,
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
      };

  return (
    <div style={wrapStyle} aria-busy="true" aria-live="polite">
      <style>{`
        @keyframes fwh-brand-breathe {
          0%,100% { transform: scale(0.92); filter: drop-shadow(0 0 0 rgba(124,110,250,0.0)); }
          50%     { transform: scale(1.08); filter: drop-shadow(0 0 28px rgba(124,110,250,0.55)); }
        }
        @keyframes fwh-brand-ring {
          0%   { transform: scale(0.6); opacity: 0.55; }
          100% { transform: scale(1.9); opacity: 0; }
        }
      `}</style>

      <div style={{ position: "relative", width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "2px solid var(--accent)",
            animation: "fwh-brand-ring 1.6s ease-out infinite",
          }}
        />
        <span
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "2px solid var(--accent)",
            animation: "fwh-brand-ring 1.6s ease-out 0.5s infinite",
          }}
        />
        <img
          src={favicon}
          alt="FitWay Hub"
          style={{
            width: size * 0.72,
            height: size * 0.72,
            objectFit: "contain",
            animation: "fwh-brand-breathe 1.6s ease-in-out infinite",
          }}
          draggable={false}
        />
      </div>

      {label && (
        <div style={{ fontSize: 13, color: "var(--text-secondary)", letterSpacing: 0.3 }}>
          {label}
        </div>
      )}
    </div>
  );
}
