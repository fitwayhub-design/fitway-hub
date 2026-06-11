import { AlertTriangle, RefreshCw } from "lucide-react";

type Props = {
  title?: string;
  message?: string;
  /** When provided, renders a "Try again" button wired to this handler. */
  onRetry?: () => void;
  retryLabel?: string;
  compact?: boolean;
};

/**
 * Consistent error placeholder with an optional retry action. Use when a fetch
 * fails so users get clear feedback + a recovery path instead of a blank screen
 * or a silently empty list.
 */
export default function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load this right now. Please try again.",
  onRetry,
  retryLabel = "Try again",
  compact,
}: Props) {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 10,
        padding: compact ? "28px 20px" : "48px 24px",
      }}
    >
      <div
        aria-hidden
        style={{
          width: 56,
          height: 56,
          borderRadius: "var(--radius-full, 999px)",
          display: "grid",
          placeItems: "center",
          background: "color-mix(in srgb, var(--red) 12%, transparent)",
          border: "1px solid color-mix(in srgb, var(--red) 35%, transparent)",
          color: "var(--red)",
        }}
      >
        <AlertTriangle size={26} />
      </div>
      <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 16 }}>{title}</div>
      <div style={{ fontSize: 13.5, color: "var(--text-muted)", maxWidth: 320, lineHeight: 1.5 }}>
        {message}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: 6,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 16px",
            borderRadius: "var(--radius-full, 999px)",
            border: "1px solid var(--border)",
            background: "var(--bg-card)",
            color: "var(--text-primary)",
            fontWeight: 600,
            fontSize: 13.5,
            cursor: "pointer",
          }}
        >
          <RefreshCw size={15} />
          {retryLabel}
        </button>
      )}
    </div>
  );
}
