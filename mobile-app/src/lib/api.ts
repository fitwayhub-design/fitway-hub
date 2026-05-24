/**
 * Centralized API base URL module.
 *
 * On web (dev) the Vite proxy handles /api → localhost:3000, so the base is "".
 * On native Capacitor builds (Android / iOS) there is no proxy — the admin sets
 * the full backend URL (e.g. "https://api.fitwayhub.com") in the admin panel,
 * which is persisted to localStorage and to the server-side system_settings table.
 *
 * Usage:
 *   import { getApiBase } from "@/lib/api";
 *   fetch(getApiBase() + "/api/auth/login", { ... })
 */

const LS_KEY = "fitway_server_url";

function isNativeCapacitorRuntime(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as any).Capacitor;
  try {
    return !!cap?.isNativePlatform?.();
  } catch {
    return false;
  }
}

/** Returns the current API base URL (empty string when no override is set). */
export function getApiBase(): string {
  // In browser/web dev, always use relative /api so requests hit the current local server.
  // Stored override is intended for native builds where there is no Vite proxy.
  if (!isNativeCapacitorRuntime()) return "";

  try {
    const stored = localStorage.getItem(LS_KEY);
    if (stored && stored.trim()) {
      // Strip trailing slash to avoid double-slash issues
      return stored.trim().replace(/\/+$/, "");
    }
  } catch {
    // localStorage may throw in some contexts
  }
  // Default backend URL for native builds (no Vite proxy available).
  // Falls back to the VITE_API_BASE build-time variable if set, otherwise
  // use an empty string so requests go to the same origin (shouldn't happen
  // in native, but is safe).
  return (String(import.meta.env.VITE_API_BASE || '')).replace(/\/+$/, '');
}

/** Persist a new API base URL. Pass empty string to clear (use relative). */
export function setApiBase(url: string): void {
  try {
    const clean = (url || "").trim().replace(/\/+$/, "");
    if (clean) {
      localStorage.setItem(LS_KEY, clean);
    } else {
      localStorage.removeItem(LS_KEY);
    }
  } catch {
    // ignore
  }
}

/**
 * Resolve an image / media URL stored in the database so it loads from any
 * client. Handles three cases that all broke "image visible to admin but
 * missing for other viewers":
 *   1. Root-relative URLs (`/uploads/foo.jpg`) — on native Capacitor there is
 *      no API origin to resolve against, so prefix the API base.
 *   2. Stale absolute URLs pinned to localhost (saved when APP_BASE_URL was
 *      left at the http://localhost:3000 default) — strip the host so the
 *      remaining path can resolve against the current viewer's origin / API
 *      base. Otherwise any device that isn't the dev machine 404s.
 *   3. Real absolute URLs (https://, data:, blob:) — return as-is.
 */
export function resolveAssetUrl(url: string | null | undefined): string {
  if (!url) return "";
  const trimmed = String(url).trim();
  if (!trimmed) return "";
  if (/^(data:|blob:)/i.test(trimmed)) return trimmed;

  // Strip a localhost/127.0.0.1 host prefix so the path can be re-resolved
  // against the viewer's current origin (web) or API base (native).
  const localhostMatch = trimmed.match(/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(\/.*)?$/i);
  if (localhostMatch) {
    return resolveAssetUrl(localhostMatch[1] || "/");
  }

  if (/^https?:/i.test(trimmed)) return trimmed;

  if (trimmed.startsWith("/")) {
    const base = getApiBase();
    return base ? `${base}${trimmed}` : trimmed;
  }
  return trimmed;
}

