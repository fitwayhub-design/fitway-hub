import React, { useEffect, useRef, useState, useImperativeHandle } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import {
  calculateStepsFromDistance,
  calculateCaloriesMET,
  UserMetrics,
  ActivityMode,
  createAccelerometerCounter,
  GpsKalmanFilter,
  AccelerometerStepCounter,
  normaliseHeightCm,
} from '@/lib/stepCalculations';
import { Activity, Zap, MapPin, Timer, Play, Square, Loader2, AlertCircle, Footprints, PersonStanding } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  getCurrentPosition,
  watchPosition,
  requestLocationPermission,
  checkLocationPermission,
  type GeoWatchHandle,
} from '@/lib/geo';

interface Position { lat: number; lng: number; timestamp: number; accuracy?: number }

interface MapTrackerProps {
  onComplete?: (session: {
    startTime: string | null;
    endTime: string | null;
    totalSteps: number;
    totalDistanceMeters: number;
    calories: number;
    path: Position[];
  }) => void;
  onUpdate?: (data: { distanceMeters: number; steps: number; calories: number; speedKmh?: number; met?: number }) => void;
  hideControls?: boolean;
  distanceUnit?: 'km' | 'm' | 'cm';
}

const MapTracker = React.forwardRef<
  { start: () => void; stop: () => void; running: boolean },
  MapTrackerProps
>(({ onComplete, onUpdate, hideControls = false, distanceUnit = 'km' }, ref) => {
  const { user } = useAuth();
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const glowLineRef = useRef<any>(null);
  const startMarkerRef = useRef<any>(null);
  const watchHandleRef = useRef<GeoWatchHandle | null>(null);
  const positionsRef = useRef<Position[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [steps, setSteps] = useState(0);
  const [calories, setCalories] = useState(0);
  const [speedKmh, setSpeedKmhState] = useState<number>(0);
  const [mode, setMode] = useState<'walking' | 'running'>('walking');
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'acquiring' | 'active' | 'error'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { isDark } = useTheme();

  // ─── Accelerometer & Kalman filter refs ─────────────────────────────────
  const accelCounterRef = useRef<AccelerometerStepCounter | null>(null);
  const accelCleanupRef = useRef<(() => void) | null>(null);
  const kalmanRef = useRef<GpsKalmanFilter>(new GpsKalmanFilter(3));
  const hasAccelRef = useRef(false);
  // Track the mode ref so watchPosition callback always sees the latest value
  const modeRef = useRef<ActivityMode>(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  // Polling interval for accelerometer-only step updates
  const accelPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Last known accel step count to detect changes
  const lastAccelStepsRef = useRef(0);

  const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const createModernIcon = (L: any, isStart = false) => {
    const color = isStart ? '#3B8BFF' : '#FFD600';
    const innerColor = isStart ? '#fff' : '#000000';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44"><path d="M18 2C9.716 2 3 8.716 3 17c0 10.5 15 25 15 25S33 27.5 33 17C33 8.716 26.284 2 18 2z" fill="${color}"/><circle cx="18" cy="17" r="6" fill="${innerColor}" opacity="0.9"/></svg>`;
    return L.divIcon({ html: svg, className: '', iconSize: [36, 44], iconAnchor: [18, 44] });
  };

  const createPulsingDot = (L: any) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="8" fill="#FFD600" opacity="0.9"/><circle cx="20" cy="20" r="14" fill="none" stroke="#FFD600" stroke-width="2" opacity="0.5"><animate attributeName="r" from="8" to="18" dur="1.5s" repeatCount="indefinite"/><animate attributeName="opacity" from="0.8" to="0" dur="1.5s" repeatCount="indefinite"/></circle></svg>`;
    return L.divIcon({ html: svg, className: '', iconSize: [40, 40], iconAnchor: [20, 20] });
  };

  const createMapInstance = (L: any, lat: number, lng: number) => {
    if (!mapRef.current) return;
    const container = mapRef.current as any;
    if (container._leaflet_id !== undefined) delete container._leaflet_id;
    while (container.firstChild) container.removeChild(container.firstChild);

    try {
      const map = L.map(mapRef.current!, { zoomControl: true, attributionControl: false }).setView([lat, lng], 17);
      const tileUrl = isDark
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
      L.tileLayer(tileUrl, { maxZoom: 20, subdomains: 'abcd' }).addTo(map);
      polylineRef.current = L.polyline([], { color: '#FFD600', weight: 5, opacity: 0.9, lineJoin: 'round', lineCap: 'round' }).addTo(map);
      glowLineRef.current = L.polyline([], { color: 'rgba(255,214,0,0.2)', weight: 12, opacity: 1 }).addTo(map);
      markerRef.current = L.marker([lat, lng], { icon: createPulsingDot(L) }).addTo(map);
      mapInstanceRef.current = map;
      setMapReady(true);
      setMapError(null);
      setTimeout(() => { try { map.invalidateSize(); } catch (e) {} }, 300);
    } catch (err) {
      setMapError('Failed to initialize map. Please refresh the page and try again.');
    }
  };

  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const initWithLocation = (L: any) => {
      // Centre on a sensible default first; only fetch the real location when
      // the user has ALREADY granted permission. We deliberately do NOT prompt
      // for location just because the GPS tab was opened — the OS permission
      // dialog is only triggered when the user taps "Start Live Tracking".
      createMapInstance(L, 30.0444, 31.2357);
      checkLocationPermission()
        .then((perm) => {
          if (perm !== 'granted') return;
          return getCurrentPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 120000 })
            .then((pos) => {
              if (!mapInstanceRef.current) return;
              try {
                mapInstanceRef.current.setView([pos.coords.latitude, pos.coords.longitude], 17);
                if (markerRef.current) markerRef.current.setLatLng([pos.coords.latitude, pos.coords.longitude]);
              } catch { /* map may have been torn down */ }
            })
            .catch(() => { /* keep default centre */ });
        })
        .catch(() => { /* keep default centre */ });
    };

    if ((window as any).L) {
      setTimeout(() => initWithLocation((window as any).L), 100);
    } else {
      const existing = document.getElementById('leaflet-js') as HTMLScriptElement | null;
      if (existing) {
        const onLoad = () => setTimeout(() => initWithLocation((window as any).L), 100);
        existing.addEventListener('load', onLoad);
        return () => existing.removeEventListener('load', onLoad);
      }
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => setTimeout(() => initWithLocation((window as any).L), 100);
      script.onerror = () => setMapError('Could not load map library. Check your internet connection.');
      document.head.appendChild(script);
    }

    return () => {
      if (watchHandleRef.current) { watchHandleRef.current.clear(); watchHandleRef.current = null; }
      if (timerRef.current) clearInterval(timerRef.current);
      if (accelPollRef.current) clearInterval(accelPollRef.current);
      if (accelCleanupRef.current) { accelCleanupRef.current(); accelCleanupRef.current = null; }
      if (mapInstanceRef.current) {
        try { mapInstanceRef.current.remove(); } catch (e) {}
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const start = async () => {
    if (!mapInstanceRef.current) { setMapError('Map is still loading. Please wait and try again.'); return; }

    // Request location permission up front. On a real device this shows the
    // native OS permission dialog via the Capacitor Geolocation plugin; on the
    // web the browser prompts on the first position request below.
    setGpsStatus('acquiring');
    const perm = await requestLocationPermission(true);
    if (perm === 'denied') {
      setGpsStatus('error');
      setMapError('Location permission is denied. Enable it in Settings → Apps → FitWayHub → Permissions → Location (Android) or Settings → Privacy → Location Services (iOS), then try again.');
      return;
    }
    if (perm === 'unsupported') {
      setGpsStatus('error');
      setMapError('Location services are not available on this device.');
      return;
    }

    setRunning(true);
    runningRef.current = true;
    setGpsStatus('acquiring');
    positionsRef.current = [];
    setPositions([]);
    setDistanceMeters(0);
    setSteps(0);
    setCalories(0);
    setSpeedKmhState(0);
    setElapsed(0);
    setMapError(null);

    // ── Start accelerometer step counter ──
    kalmanRef.current = new GpsKalmanFilter(3);
    const counter = createAccelerometerCounter(mode);
    accelCounterRef.current = counter;
    hasAccelRef.current = !!counter;
    lastAccelStepsRef.current = 0;
    if (counter) {
      accelCleanupRef.current = counter.start();
    }

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setElapsed(prev => prev + 1), 1000);

    // ── Accelerometer polling (independent of GPS) ──
    // Poll every 500ms so steps update even when GPS positions are sparse
    if (accelPollRef.current) clearInterval(accelPollRef.current);
    accelPollRef.current = setInterval(() => {
      if (!runningRef.current || !accelCounterRef.current) return;
      const accelSteps = accelCounterRef.current.getSteps();
      if (accelSteps > lastAccelStepsRef.current) {
        lastAccelStepsRef.current = accelSteps;
        // Only update step count if accelerometer is giving us more than GPS-derived
        setSteps(prev => Math.max(prev, accelSteps));
      }
    }, 500);

    const L = (window as any).L;
    if (polylineRef.current) polylineRef.current.setLatLngs([]);
    if (glowLineRef.current) glowLineRef.current.setLatLngs([]);
    if (startMarkerRef.current) {
      try { mapInstanceRef.current?.removeLayer(startMarkerRef.current); } catch (e) {}
      startMarkerRef.current = null;
    }

    watchHandleRef.current = await watchPosition(
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
      (pos) => {
        if (!runningRef.current) return; // guard if stopped mid-way
        setGpsStatus('active');
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        // Adaptive accuracy: reject readings with accuracy worse than 30m
        if (accuracy > 30) return;

        // ── Apply Kalman filter to smooth GPS jitter ──
        const smoothed = kalmanRef.current.update(lat, lng, accuracy ?? 10);
        const sLat = smoothed.lat;
        const sLng = smoothed.lng;

        const newPos: Position = { lat: sLat, lng: sLng, timestamp: pos.timestamp, accuracy };
        const prev = positionsRef.current;
        if (prev.length > 0) {
          const last = prev[prev.length - 1];
          // Use smoothed→smoothed comparison for consistent distance check
          const dist = haversineDistance(last.lat, last.lng, sLat, sLng);

          // ── Accuracy-adaptive dead zone ──
          // GPS on phones has ~3-10m error. Reject movements smaller than
          // the reported accuracy to avoid drift accumulation.
          const minDist = Math.max(5, Math.min(accuracy || 5, 15));
          if (dist < minDist || dist > 50) return;

          // Time gate: require at least 2 seconds between accepted positions
          // to avoid rapid-fire jitter accumulation
          const timeDelta = (pos.timestamp - last.timestamp) / 1000;
          if (timeDelta < 2) return;

          // Speed sanity check: reject points implying > 15 km/h walking or > 30 km/h running
          if (timeDelta > 0) {
            const impliedSpeed = (dist / 1000) / (timeDelta / 3600); // km/h
            const maxSpeed = modeRef.current === 'running' ? 30 : 15;
            if (impliedSpeed > maxSpeed) return;
          }
        }

        const next = [...prev, newPos];
        positionsRef.current = next;
        setPositions(next);

        if (mapInstanceRef.current && L && mapRef.current) {
          const latLngs = next.map(p => [p.lat, p.lng]);
          try {
          if (polylineRef.current) polylineRef.current.setLatLngs(latLngs);
          if (glowLineRef.current) glowLineRef.current.setLatLngs(latLngs);
          if (next.length === 1) {
            startMarkerRef.current = L.marker([lat, lng], { icon: createModernIcon(L, true) }).bindTooltip('Start', { permanent: false, direction: 'top' }).addTo(mapInstanceRef.current);
          }
          if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
          else markerRef.current = L.marker([lat, lng], { icon: createPulsingDot(L) }).addTo(mapInstanceRef.current);
          mapInstanceRef.current.panTo([lat, lng], { animate: true, duration: 0.5 });
          } catch(mapErr) { console.warn('Map update error:', mapErr); }
        }

        let totalDist = 0;
        for (let i = 1; i < next.length; i++) totalDist += haversineDistance(next[i-1].lat, next[i-1].lng, next[i].lat, next[i].lng);

        const currentMode = modeRef.current;
        const userMetrics: UserMetrics = { height: normaliseHeightCm(user?.height), weight: user?.weight || 70, gender: (user as any)?.gender || 'other' };
        const distKm = totalDist / 1000;
        const gpsSteps = calculateStepsFromDistance(distKm, userMetrics, currentMode);

        // ── Fuse accelerometer + GPS steps ──
        // Use weighted average: accelerometer is more accurate for step detection,
        // GPS-derived is a sanity bound. Clamp accelerometer to 2× GPS to prevent runaway.
        let estSteps = gpsSteps;
        if (hasAccelRef.current && accelCounterRef.current) {
          const accelSteps = accelCounterRef.current.getSteps();
          // Sanity: accelerometer steps shouldn't exceed 2× what GPS distance implies
          const maxReasonable = Math.max(gpsSteps * 2, 20); // at least 20 to allow short walks
          const clampedAccel = Math.min(accelSteps, maxReasonable);
          // Weighted: 70% accelerometer, 30% GPS when both available
          estSteps = Math.round(clampedAccel * 0.7 + gpsSteps * 0.3);
        }

        let speed: number | undefined;
        if (next.length >= 2) {
          const win = next.slice(-4);
          let d = 0; let t = 0;
          for (let i = 1; i < win.length; i++) {
            d += haversineDistance(win[i-1].lat, win[i-1].lng, win[i].lat, win[i].lng);
            t += (win[i].timestamp - win[i-1].timestamp) / 1000;
          }
          if (t > 0) speed = (d / 1000) / (t / 3600);
        }

        const metResult = calculateCaloriesMET({ weightKg: userMetrics.weight, heightCm: userMetrics.height, steps: estSteps, distanceKm: distKm, gender: userMetrics.gender, speedKmh: speed, mode: currentMode });

        setDistanceMeters(totalDist);
        setSteps(estSteps);
        setCalories(metResult.calories);
        if (speed !== undefined) setSpeedKmhState(speed);
        if (onUpdate) onUpdate({ distanceMeters: totalDist, steps: estSteps, calories: metResult.calories, speedKmh: speed, met: metResult.met });
      },
      (err) => {
        setGpsStatus('error');
        const msg = err.code === 1 ? 'Location permission denied. To fix: on Android go to Settings → Apps → Browser/App → Permissions → Location → Allow. On iOS go to Settings → Privacy → Location Services.' : err.code === 2 ? 'Location signal unavailable. Move to an open area or enable GPS in your device settings.' : 'Location request timed out. Try moving outdoors or enabling GPS.';
        setMapError(msg);
        setRunning(false);
        if (timerRef.current) clearInterval(timerRef.current);
      },
    );
    // Fallback: if GPS doesn't respond in 5 seconds, try low-accuracy mode
    setTimeout(() => {
      if (gpsStatus === 'acquiring' && runningRef.current) {
        setMapError(null); // clear any error
        setGpsStatus('acquiring');
      }
    }, 5000);
  };

  const stopWithOfflineSave = (sessionData: any) => {
    // If offline, save to localStorage queue
    if (!navigator.onLine) {
      const today = new Date().toISOString().split('T')[0];
      const offlineSteps: any[] = JSON.parse(localStorage.getItem('offline_steps') || '[]');
      const existingIdx = offlineSteps.findIndex((e: any) => e.date === today);
      const entry = {
        date: today,
        steps: sessionData.totalSteps,
        caloriesBurned: sessionData.calories,
        distanceKm: sessionData.totalDistanceMeters ? +(sessionData.totalDistanceMeters / 1000).toFixed(3) : undefined,
        trackingMode: 'live',
        timestamp: new Date().toISOString(),
      };
      if (existingIdx >= 0) {
        const ex = offlineSteps[existingIdx];
        offlineSteps[existingIdx] = { ...ex, steps: Math.max(ex.steps || 0, entry.steps), caloriesBurned: Math.max(ex.caloriesBurned || 0, entry.caloriesBurned || 0), distanceKm: Math.max(ex.distanceKm || 0, entry.distanceKm || 0) };
      } else {
        offlineSteps.push(entry);
      }
      localStorage.setItem('offline_steps', JSON.stringify(offlineSteps));
    }
  };

  const stop = () => {
    if (watchHandleRef.current) { watchHandleRef.current.clear(); watchHandleRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (accelPollRef.current) { clearInterval(accelPollRef.current); accelPollRef.current = null; }
    // ── Stop accelerometer ──
    if (accelCleanupRef.current) { accelCleanupRef.current(); accelCleanupRef.current = null; }
    accelCounterRef.current = null;
    hasAccelRef.current = false;
    setRunning(false);
    runningRef.current = false;
    setGpsStatus('idle');

    const pts = positionsRef.current;
    if (pts.length > 0) {
      const L = (window as any).L;
      const last = pts[pts.length - 1];
      if (mapInstanceRef.current && L) {
        if (markerRef.current) { try { mapInstanceRef.current.removeLayer(markerRef.current); } catch (e) {} }
        markerRef.current = L.marker([last.lat, last.lng], { icon: createModernIcon(L, false) }).bindTooltip('End', { permanent: false, direction: 'top' }).addTo(mapInstanceRef.current);
      }
    }

    const sessionData = { startTime: pts[0]?.timestamp ? new Date(pts[0].timestamp).toISOString() : null, endTime: pts[pts.length-1]?.timestamp ? new Date(pts[pts.length-1].timestamp).toISOString() : null, totalSteps: steps, totalDistanceMeters: Number(distanceMeters.toFixed(2)), calories, path: pts };
    stopWithOfflineSave(sessionData); // saves to localStorage if offline
    if (onComplete) onComplete(sessionData);
  };

  useImperativeHandle(ref, () => ({ start, stop, running }));

  const gpsStatusColor = gpsStatus === 'active' ? 'var(--green)' : gpsStatus === 'acquiring' ? 'var(--amber)' : gpsStatus === 'error' ? 'var(--red)' : 'var(--muted-foreground)';
  const gpsStatusLabel = gpsStatus === 'active' ? 'GPS Active' : gpsStatus === 'acquiring' ? 'Acquiring…' : gpsStatus === 'error' ? 'GPS Error' : 'GPS Ready';

  const stats = [
    { label: 'Steps', value: steps > 0 ? steps.toLocaleString() : '—', icon: Activity, color: 'var(--primary)' },
    { label: 'Distance', value: distanceMeters > 0 ? (() => {
        if (distanceUnit === 'cm') return `${Math.round(distanceMeters * 100)} cm`;
        if (distanceUnit === 'm') return `${Math.round(distanceMeters)} m`;
        return distanceMeters >= 1000 ? `${(distanceMeters/1000).toFixed(2)} km` : `${Math.round(distanceMeters)} m`;
      })() : '—', icon: MapPin, color: 'var(--secondary)' },
    { label: 'Calories', value: calories > 0 ? `${Math.round(calories)}` : '—', icon: Zap, color: 'var(--destructive)' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-lg shadow-soft-sm">
        <div ref={mapRef} style={{ width: '100%', height: 'clamp(240px, 38vw, 380px)', display: 'block', backgroundColor: 'var(--bg-surface)' }} />
        <div
          className="absolute top-3 z-[1000] inline-flex items-center gap-1.5 rounded-full bg-black/75 px-3 py-1.5 text-[11px] font-semibold backdrop-blur-md"
          style={{ insetInlineEnd: 12, color: gpsStatusColor }}
        >
          <span className="inline-block size-[7px] rounded-full" style={{ backgroundColor: gpsStatusColor }} />
          {gpsStatusLabel}
        </div>
        {running && (
          <div className="absolute top-3 z-[1000] inline-flex items-center gap-1.5 rounded-full bg-black/75 px-3 py-1.5 text-[12px] font-bold tabular-nums text-primary backdrop-blur-md" style={{ insetInlineStart: 12 }}>
            <Timer size={13} strokeWidth={2} /> {formatTime(elapsed)}
          </div>
        )}
      </div>

      {/* Live Stats — always visible */}
      <div className="grid grid-cols-3 gap-2">
        {stats.map(stat => (
          <Card
            key={stat.label}
            className="gap-0 rounded-md bg-muted px-3 py-2.5 text-center shadow-none transition-shadow"
            style={running ? { boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${stat.color} 35%, transparent)` } : undefined}
          >
            <stat.icon size={14} strokeWidth={2} className="mx-auto mb-1" style={{ color: stat.color }} />
            <p className="my-0.5 text-[17px] font-bold leading-none tabular-nums" style={{ color: stat.color }}>{stat.value}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{stat.label}{stat.label === 'Calories' ? ' kcal' : ''}</p>
          </Card>
        ))}
      </div>

      {running && speedKmh > 0 && (
        <div className="flex items-center gap-2.5 rounded-md bg-muted px-4 py-2 text-[12px]">
          <Timer size={13} strokeWidth={2} className="text-muted-foreground" />
          <span className="text-muted-foreground">Speed: <strong className="text-[var(--cyan)]">{speedKmh.toFixed(1)} km/h</strong></span>
          <span className="ms-auto text-muted-foreground">{positions.length} GPS pts</span>
        </div>
      )}

      {mapError && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-4 py-2.5 text-[13px] text-destructive">
          <AlertCircle size={16} strokeWidth={2} className="mt-px shrink-0" />
          <span>{mapError}</span>
        </div>
      )}

      {!hideControls && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Mode</span>
            {(['walking', 'running'] as const).map(m => (
              <Button
                key={m}
                type="button"
                size="sm"
                variant={mode === m ? 'default' : 'secondary'}
                onClick={() => setMode(m)}
                className="rounded-full capitalize"
              >
                {m === 'walking' ? <Footprints size={14} strokeWidth={2} /> : <PersonStanding size={14} strokeWidth={2} />} {m}
              </Button>
            ))}
          </div>
          {!running ? (
            <Button onClick={start} disabled={!mapReady} size="lg" className="w-full">
              {mapReady
                ? <><Play size={18} strokeWidth={2} fill="currentColor" /> START LIVE TRACKING</>
                : <><Loader2 size={18} strokeWidth={2} className="animate-spin" /> Loading Map…</>}
            </Button>
          ) : (
            <Button onClick={stop} variant="destructive" size="lg" className="w-full">
              <Square size={16} strokeWidth={2} fill="currentColor" /> STOP &amp; SAVE SESSION
            </Button>
          )}
        </div>
      )}
    </div>
  );
});

export default MapTracker;
