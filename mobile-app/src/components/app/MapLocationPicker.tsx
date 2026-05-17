/**
 * MapLocationPicker
 * Leaflet map that lets coaches pin an exact location for ad targeting.
 * Loads Leaflet from CDN — no npm install needed.
 * Handles stale closure correctly via refs.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Crosshair, X } from "lucide-react";

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
    <div style={{ marginTop: 8 }}>

      {/* ── Toggle button ─────────────────────────────── */}
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setError(""); }}
        style={{
          display: "flex", alignItems: "center", gap: 8, width: "100%",
          padding: "10px 14px", borderRadius: 10, cursor: "pointer",
          border: open ? "1.5px solid var(--main, #FFD600)" : "1.5px dashed var(--border)",
          background: open ? "rgba(255,214,0,0.08)" : "var(--bg-surface)",
          color: open ? "#FFD600" : "var(--text-secondary)",
          fontSize: 13, fontWeight: 600, transition: "all 0.15s",
        }}
      >
        <MapPin size={15} />
        {open ? "Close map" : "📍 Pick exact location on map"}
        {!open && lat != null && lng != null && (
          <span style={{ marginInlineStart: "auto", fontSize: 11, color: "#FFD600", fontWeight: 700 }}>
            ✓ Pinned
          </span>
        )}
        {open && (
          <span style={{ marginInlineStart: "auto" }}><X size={14} /></span>
        )}
      </button>

      {/* ── Map panel ─────────────────────────────────── */}
      {open && (
        <div style={{ marginTop: 8, borderRadius: 14, overflow: "hidden", border: "1px solid var(--border)", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>

          {/* Toolbar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 14px", background: "var(--bg-card)", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)", minWidth: 0 }}>
              {lat != null && lng != null
                ? <span><strong style={{ color: "#FFD600" }}>📍 Pinned:</strong> {nearestCity(lat, lng)} ({lat.toFixed(3)}, {lng.toFixed(3)})</span>
                : <span>Click the map to drop a pin, or use your location</span>}
            </span>
            <button
              type="button"
              onClick={useMyLocation}
              disabled={geoLoading}
              style={{
                display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
                padding: "7px 14px", borderRadius: 8,
                background: "rgba(255,214,0,0.1)", border: "1px solid #FFD600",
                color: "#FFD600", cursor: geoLoading ? "wait" : "pointer",
                fontSize: 12, fontWeight: 700,
              }}
            >
              {geoLoading
                ? <><span style={{ width: 13, height: 13, borderRadius: "50%", border: "2px solid #FFD60044", borderTopColor: "#FFD600", animation: "spin 0.7s linear infinite", display: "inline-block" }} /> Getting…</>
                : <><Crosshair size={13} /> Use my location</>}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div style={{ padding: "8px 14px", background: "rgba(255,68,68,0.08)", borderBottom: "1px solid rgba(255,68,68,0.2)", fontSize: 12, color: "var(--red, #FF4444)" }}>
              ⚠️ {error}
            </div>
          )}

          {/* Leaflet div */}
          <div style={{ position: "relative" }}>
            <div ref={mapDiv} style={{ height: 340, width: "100%" }} />
            {!leafletReady && (
              <div style={{ position: "absolute", inset: 0, zIndex: 1000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--bg-surface)", gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid var(--border)", borderTopColor: "#FFD600", animation: "spin 0.7s linear infinite" }} />
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading map…</span>
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div style={{ padding: "8px 14px", background: "var(--bg-card)", borderTop: "1px solid var(--border)" }}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
              🖱️ <strong>Click</strong> to drop pin &nbsp;·&nbsp; <strong>Drag</strong> to reposition &nbsp;·&nbsp; Circle = your targeting radius
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
