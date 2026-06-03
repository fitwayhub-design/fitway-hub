/**
 * MapLocationPicker
 * Leaflet map that lets coaches pin an exact location for ad targeting.
 * Loads Leaflet from CDN — no npm install needed.
 * Handles stale closure correctly via refs.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Crosshair, X, Check, Loader2, AlertCircle, MousePointerClick, Move } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  lat: number | null;
  lng: number | null;
  radius: number;               // km
  onPick: (lat: number, lng: number, cityName: string) => void;
}

const EGYPT_CENTER = { lat: 26.82, lng: 30.80 };

const EGYPT_CITIES: [string, number, number][] = [
  ["Cairo", 30.0444, 31.2357], ["Giza", 30.0131, 31.2089],
  ["Alexandria", 31.2001, 29.9187], ["Hurghada", 27.2579, 33.8116],
  ["Sharm El Sheikh", 27.9158, 34.3300], ["Luxor", 25.6872, 32.6396],
  ["Aswan", 24.0889, 32.8998], ["Mansoura", 31.0364, 31.3807],
  ["Tanta", 30.7865, 31.0004], ["Suez", 29.9668, 32.5498],
  ["Ismailia", 30.5965, 32.2715], ["Port Said", 31.2565, 32.2841],
  ["Zagazig", 30.5877, 31.5021], ["Asyut", 27.1809, 31.1837],
];

function nearestCity(lat: number, lng: number): string {
  let best = "Egypt", bestD = Infinity;
  for (const [name, clat, clng] of EGYPT_CITIES) {
    const d = Math.hypot(lat - clat, lng - clng);
    if (d < bestD) { bestD = d; best = name; }
  }
  return best;
}

let leafletLoaded = false;
let leafletLoading: Promise<void> | null = null;

function loadLeaflet(): Promise<void> {
  if (leafletLoaded) return Promise.resolve();
  if (leafletLoading) return leafletLoading;
  leafletLoading = new Promise<void>((resolve, reject) => {
    if ((window as any).L) { leafletLoaded = true; resolve(); return; }

    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => { leafletLoaded = true; resolve(); };
    script.onerror = () => reject(new Error("Leaflet failed to load"));
    document.head.appendChild(script);
  });
  return leafletLoading;
}

export default function MapLocationPicker({ lat, lng, radius, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [leafletReady, setLeafletReady] = useState(leafletLoaded);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState("");

  const mapDiv = useRef<HTMLDivElement>(null);
  const mapInst = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  // Keep latest props in refs so callbacks don't go stale
  const radiusRef = useRef(radius);
  const onPickRef = useRef(onPick);
  radiusRef.current = radius;
  onPickRef.current = onPick;

  // ── Build/rebuild marker + circle ────────────────────────────────────────────
  const placePinAt = useCallback((plat: number, plng: number) => {
    const L = (window as any).L;
    const map = mapInst.current;
    if (!L || !map) return;

    const icon = L.divIcon({
      className: "",
      html: `<div style="width:28px;height:28px;background:#FFD600;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 10px rgba(255,214,0,0.5)"></div>`,
      iconSize: [28, 28], iconAnchor: [14, 28],
    });

    if (markerRef.current) {
      markerRef.current.setLatLng([plat, plng]);
    } else {
      markerRef.current = L.marker([plat, plng], { icon, draggable: true }).addTo(map);
      markerRef.current.on("dragend", () => {
        const p = markerRef.current.getLatLng();
        circleRef.current?.setLatLng([p.lat, p.lng]);
        onPickRef.current(p.lat, p.lng, nearestCity(p.lat, p.lng));
      });
    }

    if (circleRef.current) {
      circleRef.current.setLatLng([plat, plng]);
    } else {
      circleRef.current = L.circle([plat, plng], {
        radius: radiusRef.current * 1000,
        color: "#FFD600", fillColor: "#FFD600", fillOpacity: 0.12, weight: 2,
      }).addTo(map);
    }
  }, []);

  // ── Init map ─────────────────────────────────────────────────────────────────
  const initMap = useCallback(async () => {
    if (!mapDiv.current) return;
    try {
      await loadLeaflet();
      setLeafletReady(true);
    } catch {
      setError("Map failed to load. Check your internet connection.");
      return;
    }

    const L = (window as any).L;
    if (mapInst.current) { mapInst.current.remove(); mapInst.current = null; markerRef.current = null; circleRef.current = null; }

    const initLat = lat ?? EGYPT_CENTER.lat;
    const initLng = lng ?? EGYPT_CENTER.lng;
    const zoom = lat ? 10 : 6;

    const map = L.map(mapDiv.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([initLat, initLng], zoom);
    mapInst.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 18,
    }).addTo(map);

    // If already has a pin, show it
    if (lat && lng) placePinAt(lat, lng);

    // Click to place pin
    map.on("click", (e: any) => {
      const { lat: clat, lng: clng } = e.latlng;
      placePinAt(clat, clng);
      onPickRef.current(clat, clng, nearestCity(clat, clng));
    });

    setTimeout(() => map.invalidateSize(), 150);
  }, [lat, lng, placePinAt]);

  // ── Open/close ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      if (mapInst.current) { mapInst.current.remove(); mapInst.current = null; markerRef.current = null; circleRef.current = null; }
      return;
    }
    // Small delay to ensure the div is mounted
    const t = setTimeout(initMap, 50);
    return () => clearTimeout(t);
  }, [open, initMap]);

  // ── Sync radius circle ────────────────────────────────────────────────────────
  useEffect(() => {
    if (circleRef.current) circleRef.current.setRadius(radius * 1000);
  }, [radius]);

  // ── Sync pin when lat/lng change externally (e.g. dropdown) ──────────────────
  useEffect(() => {
    if (!mapInst.current || lat == null || lng == null) return;
    placePinAt(lat, lng);
    mapInst.current.setView([lat, lng], 11, { animate: true });
  }, [lat, lng, placePinAt]);

  // ── Use browser location ──────────────────────────────────────────────────────
  const useMyLocation = () => {
    if (!navigator.geolocation) { setError("Geolocation not supported by your browser."); return; }
    setGeoLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        placePinAt(latitude, longitude);
        mapInst.current?.setView([latitude, longitude], 14, { animate: true });

        // Reverse geocode to get real city name
        let city = nearestCity(latitude, longitude);
        try {
          const geo = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            { headers: { "Accept-Language": "en" } }
          ).then(r => r.json());
          city = geo?.address?.city || geo?.address?.town || geo?.address?.village || geo?.address?.county || city;
        } catch {}

        onPickRef.current(latitude, longitude, city);
        setGeoLoading(false);
      },
      (err) => {
        const msg =
          err.code === 1 ? "Location permission denied. Allow location access in your browser settings." :
          err.code === 2 ? "Location unavailable. Try moving to an area with better signal." :
          "Location request timed out. Try again.";
        setError(msg);
        setGeoLoading(false);
      },
      { timeout: 15000, enableHighAccuracy: true, maximumAge: 0 }
    );
  };

  return (
    <div className="mt-2">

      {/* ── Toggle button ─────────────────────────────── */}
      <Button
        type="button"
        variant={open ? "default" : "secondary"}
        onClick={() => { setOpen(o => !o); setError(""); }}
        className="w-full justify-start"
      >
        <MapPin size={16} strokeWidth={2} />
        {open ? "Close map" : "Pick exact location on map"}
        {!open && lat != null && lng != null && (
          <span className="ms-auto inline-flex items-center gap-1 text-[11px] font-bold text-primary">
            <Check size={13} strokeWidth={2.5} /> Pinned
          </span>
        )}
        {open && <X size={15} strokeWidth={2} className="ms-auto" />}
      </Button>

      {/* ── Map panel ─────────────────────────────────── */}
      {open && (
        <div className="mt-2 overflow-hidden rounded-lg bg-card shadow-soft">

          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-card px-4 py-2.5">
            <span className="min-w-0 text-[12px] text-muted-foreground">
              {lat != null && lng != null
                ? <span><strong className="text-foreground">Pinned:</strong> {nearestCity(lat, lng)} ({lat.toFixed(3)}, {lng.toFixed(3)})</span>
                : <span>Click the map to drop a pin, or use your location</span>}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={useMyLocation}
              disabled={geoLoading}
            >
              {geoLoading
                ? <><Loader2 size={14} strokeWidth={2} className="animate-spin" /> Getting…</>
                : <><Crosshair size={14} strokeWidth={2} /> Use my location</>}
            </Button>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-destructive/10 px-4 py-2 text-[12px] text-destructive">
              <AlertCircle size={15} strokeWidth={2} className="mt-px shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Leaflet div */}
          <div style={{ position: "relative" }}>
            <div ref={mapDiv} style={{ height: 340, width: "100%" }} />
            {!leafletReady && (
              <div style={{ position: "absolute", inset: 0, zIndex: 1000 }} className="flex flex-col items-center justify-center gap-3 bg-muted">
                <Loader2 size={32} strokeWidth={2} className="animate-spin text-primary" />
                <span className="text-[13px] text-muted-foreground">Loading map…</span>
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="bg-card px-4 py-2">
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
              <MousePointerClick size={12} strokeWidth={2} /> <strong className="text-foreground">Click</strong> to drop pin
              <span aria-hidden="true">·</span>
              <Move size={12} strokeWidth={2} /> <strong className="text-foreground">Drag</strong> to reposition
              <span aria-hidden="true">·</span>
              Circle = your targeting radius
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
