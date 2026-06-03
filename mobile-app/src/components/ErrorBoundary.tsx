import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /**
   * Optional fallback override. When provided, it is rendered instead of the
   * default error screen. Receives the caught error and a reset callback so
   * the consumer can let the user retry.
   */
  fallback?: (err: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level error boundary.
 *
 * Without this, ANY uncaught render-time exception in any descendant
 * component will replace the entire React tree with a blank screen — the
 * user sees nothing, the page is unusable, and there is no recovery short
 * of a full reload. With this in place we render a clean fallback that
 * tells the user what happened and offers a one-click retry that re-mounts
 * the subtree without forcing a hard reload.
 *
 * We also log the full error + component stack to the console so the team
 * can pick it up via remote console capture (Sentry, LogRocket, etc.) once
 * those are wired in. We deliberately do NOT show the stack trace to the
 * user — leaking implementation details on the public site is a small but
 * gratuitous information disclosure.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface the full error for ops; redact for the user.
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);

    // Default fallback. Keeps styling minimal so it works even if the app's
    // CSS / theme provider is what blew up.
    return (
      <div
        role="alert"
        style={{
          minHeight: "100vh",
          background: "var(--bg-primary, #0F0F14)",
          color: "var(--text-primary, #F0F0F8)",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, opacity: 0.78, lineHeight: 1.55, marginBottom: 24 }}>
            The page hit an unexpected error. Try again — if it keeps happening,
            reload the app or contact support.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={this.reset}
              style={{
                padding: "10px 18px",
                background: "var(--accent, #FFD600)",
                color: "#0A0A0A",
                border: "none",
                borderRadius: 999,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "10px 18px",
                background: "transparent",
                color: "var(--text-primary, #F0F0F8)",
                border: "1px solid var(--border, rgba(255,255,255,0.18))",
                borderRadius: 999,
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
