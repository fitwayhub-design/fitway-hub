/**
 * Unified geolocation helper.
 *
 * THE PROBLEM THIS SOLVES
 * -----------------------
 * The app previously called the browser's `navigator.geolocation` API directly
 * everywhere. Inside a Capacitor WebView that path is fragile: the native OS
 * permission dialog is only shown via an internal WebChrome bridge, and if the
 * runtime permission isn't granted the call fails silently — which is exactly
 * why the step/GPS tracker "asked for location but no permission could be
 * granted". The `@capacitor/geolocation` plugin was installed but never used.
 *
 * This module is the single place geolocation is accessed from. On a real
 * device it goes through the Capacitor plugin, whose `requestPermissions()`
 * shows the real Android/iOS permission dialog and whose getCurrentPosition /
 * watchPosition use native location services. On the web it falls back to
 * `navigator.geolocation` (browsers show their own inline prompt).
 *
 * The returned position objects intentionally mirror the web
 * `GeolocationPosition` shape (`{ coords: { latitude, longitude, ... }, timestamp }`)
 * so existing call sites need minimal changes.
 */

import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export interface GeoPosition {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude?: number | null;
    altitudeAccuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
  };
  timestamp: number;
}

export interface GeoError {
  /** 1 = permission denied, 2 = position unavailable, 3 = timeout */
  code: number;
  message: string;
}

export interface GeoOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

export type LocationPermission = 'granted' | 'denied' | 'prompt' | 'unsupported';

export interface GeoWatchHandle {
  clear: () => void;
}

const DEFAULT_OPTS: Required<GeoOptions> = {
  enableHighAccuracy: true,
  timeout: 20000,
  maximumAge: 5000,
};

export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function makeError(code: number, message: string): GeoError {
  return { code, message };
}

/**
 * Ensure location permission is granted.
 *
 * On native this triggers the real OS permission dialog (via the Capacitor
 * Geolocation plugin) the first time it's called. On web we can only *read*
 * the current state — the browser shows its own prompt on the first
 * getCurrentPosition call, so 'prompt' is treated as "go ahead and try".
 *
 * Returns 'denied' on native if system location services are turned off (the
 * plugin throws in that case), so callers can show an actionable message.
 */
export async function requestLocationPermission(highAccuracy = true): Promise<LocationPermission> {
  if (isNativePlatform()) {
    try {
      let status = await Geolocation.checkPermissions();
      let state = status.location;
      if (state === 'prompt' || state === 'prompt-with-rationale') {
        status = await Geolocation.requestPermissions({
          permissions: highAccuracy ? ['location'] : ['coarseLocation'],
        });
        state = status.location;
      }
      return state === 'granted' ? 'granted' : 'denied';
    } catch {
      // requestPermissions/checkPermissions throw when system location
      // services are disabled at the OS level.
      return 'denied';
    }
  }

  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return 'unsupported';
  }
  try {
    if (navigator.permissions?.query) {
      const res = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      return (res.state as LocationPermission) ?? 'prompt';
    }
  } catch {
    /* Permissions API not supported — fall through to optimistic prompt. */
  }
  return 'prompt';
}

/**
 * Read the current permission state WITHOUT prompting the user.
 * Useful for deciding whether to silently centre a map on the user's
 * location (only when already granted) versus waiting for an explicit action.
 */
export async function checkLocationPermission(): Promise<LocationPermission> {
  if (isNativePlatform()) {
    try {
      const status = await Geolocation.checkPermissions();
      const state = status.location;
      if (state === 'granted') return 'granted';
      if (state === 'denied') return 'denied';
      return 'prompt';
    } catch {
      return 'denied';
    }
  }
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return 'unsupported';
  }
  try {
    if (navigator.permissions?.query) {
      const res = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      return (res.state as LocationPermission) ?? 'prompt';
    }
  } catch {
    /* not supported */
  }
  return 'prompt';
}

/** Get a single current position. Requests permission first on native. */
export async function getCurrentPosition(options: GeoOptions = {}): Promise<GeoPosition> {
  const opts = { ...DEFAULT_OPTS, ...options };

  if (isNativePlatform()) {
    const perm = await requestLocationPermission(opts.enableHighAccuracy);
    if (perm === 'denied') {
      throw makeError(1, 'Location permission denied. Enable it in Settings → Apps → FitWayHub → Permissions → Location.');
    }
    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: opts.enableHighAccuracy,
        timeout: opts.timeout,
        maximumAge: opts.maximumAge,
      });
      return pos as GeoPosition;
    } catch (e: any) {
      throw makeError(2, e?.message || 'Unable to determine your location. Move to an open area and try again.');
    }
  }

  return new Promise<GeoPosition>((resolve, reject) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      reject(makeError(2, 'Geolocation is not supported on this device.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p as unknown as GeoPosition),
      (e) => reject(makeError(e.code, e.message)),
      opts,
    );
  });
}

/**
 * Continuously watch position. Returns a handle with a `clear()` method that
 * works regardless of platform. On native the underlying watch id resolves
 * asynchronously, so calling `clear()` before it resolves is handled safely.
 */
export async function watchPosition(
  options: GeoOptions,
  onPosition: (pos: GeoPosition) => void,
  onError?: (err: GeoError) => void,
): Promise<GeoWatchHandle> {
  const opts = { ...DEFAULT_OPTS, ...options };

  if (isNativePlatform()) {
    const perm = await requestLocationPermission(opts.enableHighAccuracy);
    if (perm === 'denied') {
      onError?.(makeError(1, 'Location permission denied. Enable it in Settings → Apps → FitWayHub → Permissions → Location.'));
      return { clear: () => {} };
    }

    let cleared = false;
    let watchId: string | null = null;
    try {
      watchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: opts.enableHighAccuracy,
          timeout: opts.timeout,
          maximumAge: opts.maximumAge,
        },
        (pos, err) => {
          if (cleared) return;
          if (err) {
            onError?.(makeError(2, (err as any)?.message || 'Location signal lost.'));
            return;
          }
          if (pos) onPosition(pos as GeoPosition);
        },
      );
      // If clear() was called before the id resolved, clear it now.
      if (cleared && watchId) {
        Geolocation.clearWatch({ id: watchId });
        watchId = null;
      }
    } catch (e: any) {
      onError?.(makeError(2, e?.message || 'Unable to start location tracking.'));
    }

    return {
      clear: () => {
        cleared = true;
        if (watchId) {
          Geolocation.clearWatch({ id: watchId });
          watchId = null;
        }
      },
    };
  }

  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    onError?.(makeError(2, 'Geolocation is not supported on this device.'));
    return { clear: () => {} };
  }
  const id = navigator.geolocation.watchPosition(
    (p) => onPosition(p as unknown as GeoPosition),
    (e) => onError?.(makeError(e.code, e.message)),
    opts,
  );
  return { clear: () => navigator.geolocation.clearWatch(id) };
}
