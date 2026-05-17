import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBranding } from "@/context/BrandingContext";
import { useAuth } from "@/context/AuthContext";

export default function NotFound() {
  const navigate = useNavigate();
  const { branding } = useBranding();
  const { user } = useAuth();
  const [countdown, setCountdown] = useState(5);

  const destination =
    user?.role === "admin" ? "/admin/dashboard" :
    user?.role === "coach" ? "/coach/dashboard" :
    user ? "/app/dashboard" :
    "/auth/login";

  const destLabel =
    user?.role === "admin" ? "Dashboard" :
    user?.role === "coach" ? "Dashboard" :
    user ? "Dashboard" :
    "Home";

  useEffect(() => {
    if (countdown <= 0) { navigate(destination, { replace: true }); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, navigate, destination]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg-primary)",
      color: "var(--text-primary)",
      padding: 24,
      flexDirection: "column",
      textAlign: "center",
    }}>
      {/* 404 */}
      <div style={{
        fontFamily: "var(--font-heading)",
        fontSize: "clamp(80px, 20vw, 160px)",
        fontWeight: 800,
        letterSpacing: "-0.05em",
        lineHeight: 1,
        background: "linear-gradient(135deg, var(--main) 0%, var(--main) 60%, var(--secondary) 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        marginBottom: 16,
        userSelect: "none",
      }}>
        404
      </div>

      <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "clamp(20px, 4vw, 26px)", fontWeight: 800, marginBottom: 10, letterSpacing: "-0.02em" }}>
        Page not found
      </h1>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 36, maxWidth: 320, lineHeight: 1.6 }}>
        This page doesn't exist or you don't have access to it.
      </p>

      {/* Countdown */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ position: "relative", width: 64, height: 64 }}>
          <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="32" cy="32" r="28" fill="none" stroke="var(--border)" strokeWidth="4" />
            <circle
              cx="32" cy="32" r="28"
              fill="none" stroke="var(--main)" strokeWidth="4"
              strokeDasharray={`${2 * Math.PI * 28}`}
              strokeDashoffset={`${2 * Math.PI * 28 * (countdown / 5)}`}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 0.9s linear" }}
            />
          </svg>
          <span style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            fontFamily: "var(--font-heading)", fontSize: 22, fontWeight: 800, color: "var(--main)",
          }}>
            {countdown}
          </span>
        </div>

        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Taking you back in {countdown}s
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            onClick={() => navigate(destination, { replace: true })}
            style={{
              padding: "11px 24px", borderRadius: 12,
              background: "linear-gradient(135deg, var(--main) 0%, var(--main) 100%)",
              border: "none", color: "#fff",
              fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 14,
              cursor: "pointer", boxShadow: "0 4px 16px var(--main-glow)",
            }}
          >
            Go to {destLabel}
          </button>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: "11px 24px", borderRadius: 12,
              background: "var(--bg-card)", border: "1px solid var(--border)",
              color: "var(--text-secondary)", fontWeight: 600, fontSize: 14, cursor: "pointer",
            }}
          >
            ← Go Back
          </button>
        </div>
      </div>

      <p style={{ marginTop: 48, fontSize: 12, color: "var(--text-muted)" }}>
        {branding.app_name || "FitWay Hub"}
      </p>
    </div>
  );
}
