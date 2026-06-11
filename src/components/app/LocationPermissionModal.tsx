/**
 * LocationPermissionModal
 * Shows once after login (or if location is older than 7 days) to request GPS.
 * Saves lat/lng to backend. Gracefully dismissed if denied.
 */
import { useState } from "react";
import { MapPin, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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

          await apiFetch(`/api/user/location`, {
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
    <Dialog open onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="max-w-[380px] text-center sm:max-w-[380px]">
        <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-primary/15">
          <MapPin size={28} strokeWidth={2} className="text-primary" />
        </div>

        {status === "done" ? (
          <DialogHeader className="text-center sm:text-center">
            <DialogTitle className="text-[18px]">Location saved</DialogTitle>
            <DialogDescription className="text-[14px]">
              You'll now see coaches and ads near you.
            </DialogDescription>
          </DialogHeader>
        ) : status === "denied" ? (
          <>
            <DialogHeader className="text-center sm:text-center">
              <DialogTitle className="text-[18px]">No problem</DialogTitle>
              <DialogDescription className="text-[14px]">
                You can enable location anytime from your Profile settings for more relevant content.
              </DialogDescription>
            </DialogHeader>
            <Button variant="secondary" className="mt-5 w-full" onClick={dismiss}>
              Got it
            </Button>
          </>
        ) : (
          <>
            <DialogHeader className="text-center sm:text-center">
              <DialogTitle className="text-[18px]">See coaches near you</DialogTitle>
              <DialogDescription className="text-[14px] leading-relaxed">
                Share your location to discover local coaches, targeted workout plans, and ads relevant to your area.
              </DialogDescription>
            </DialogHeader>
            <p className="mt-3 inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck size={14} strokeWidth={2} className="shrink-0 text-[var(--green)]" />
              Your location is only used for personalizing your feed. It's never shared publicly.
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <Button
                size="lg"
                className="w-full"
                onClick={requestLocation}
                disabled={status === "loading"}
              >
                <MapPin size={16} strokeWidth={2} />
                {status === "loading" ? "Getting location…" : "Share My Location"}
              </Button>
              <Button variant="ghost" className="w-full" onClick={dismiss}>
                Not now
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Returns true if we should ask for location (first time or >7 days old) */
export function shouldAskForLocation(): boolean {
  const last = localStorage.getItem(LOCATION_ASKED_KEY);
  if (!last) return true;
  return Date.now() - parseInt(last) > SEVEN_DAYS;
}
