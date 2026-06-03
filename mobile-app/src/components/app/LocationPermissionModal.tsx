/**
 * LocationPermissionModal
 * Shows once after login (or if location is older than 7 days) to request GPS.
 * Saves lat/lng to backend. Gracefully dismissed if denied.
 */
import { useState, useEffect } from "react";
import { MapPin, X } from "lucide-react";
import { getApiBase } from "@/lib/api";

const LOCATION_ASKED_KEY = "fitway_location_asked_at";
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

interface Props {
  token: string | null;
  onDismiss: () => void;
}

export default function LocationPermissionModal({ token, onDismiss }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "denied">("idle");

  const requestLocation = () => {
    if (!navigator.geolocation) { setStatus("denied"); return; }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          // Reverse geocode with a free API
          const geo = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            { headers: { "Accept-Language": "en" } }
          ).then(r => r.json()).catch(() => ({}));

          const city    = geo?.address?.city || geo?.address?.town || geo?.address?.village || "";
          const country = geo?.address?.country || "";

          await fetch(`${getApiBase()}/api/user/location`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ latitude, longitude, city, country }),
          });
        } catch {}
        localStorage.setItem(LOCATION_ASKED_KEY, String(Date.now()));
        setStatus("done");
        setTimeout(onDismiss, 1200);
      },
      () => {
        localStorage.setItem(LOCATION_ASKED_KEY, String(Date.now()));
        setStatus("denied");
      },
      { timeout: 15000, enableHighAccuracy: true, maximumAge: 0 }
    );
  };

  const dismiss = () => {
    localStorage.setItem(LOCATION_ASKED_KEY, String(Date.now()));
    onDismiss();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 20, padding: "28px 24px", maxWidth: 380, width: "100%",
        textAlign: "center",
      }}>
        {/* close */}
        <button onClick={dismiss} style={{
          position: "absolute" as any, top: 12, right: 12,
          background: "none", border: "none", cursor: "pointer",
          color: "var(--text-muted)", padding: 4,
        }}>
          <X size={18} />
        </button>

        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "var(--accent-dim)", border: "2px solid var(--accent)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 18px",
        }}>
          <MapPin size={28} color="var(--accent)" />
        </div>

        {status === "done" ? (
          <>
            <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>📍 Location saved!</p>
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>You'll now see coaches and ads near you.</p>
          </>
        ) : status === "denied" ? (
          <>
            <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No problem!</p>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20 }}>
              You can enable location anytime from your Profile settings for more relevant content.
            </p>
            <button onClick={dismiss} style={{
              width: "100%", padding: "12px", borderRadius: "var(--radius-full)",
              background: "var(--bg-surface)", border: "1px solid var(--border)",
              cursor: "pointer", fontWeight: 600, fontSize: 14,
            }}>Got it</button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              See coaches near you
            </p>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 24 }}>
              Share your location to discover local coaches, targeted workout plans, and ads relevant to your area.
              <br /><br />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                📌 Your location is only used for personalizing your feed. It's never shared publicly.
              </span>
            </p>
            <button
              onClick={requestLocation}
              disabled={status === "loading"}
              style={{
                width: "100%", padding: "13px", borderRadius: "var(--radius-full)",
                background: "var(--accent)", border: "none", color: "#000000",
                fontWeight: 700, fontSize: 15, cursor: status === "loading" ? "wait" : "pointer",
                marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
              <MapPin size={16} />
              {status === "loading" ? "Getting location…" : "Share My Location"}
            </button>
            <button onClick={dismiss} style={{
              width: "100%", padding: "11px", borderRadius: "var(--radius-full)",
              background: "transparent", border: "1px solid var(--border)",
              cursor: "pointer", fontWeight: 500, fontSize: 14, color: "var(--text-muted)",
            }}>
              Not now
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Returns true if we should ask for location (first time or >7 days old) */
export function shouldAskForLocation(): boolean {
  const last = localStorage.getItem(LOCATION_ASKED_KEY);
  if (!last) return true;
  return Date.now() - parseInt(last) > SEVEN_DAYS;
}
