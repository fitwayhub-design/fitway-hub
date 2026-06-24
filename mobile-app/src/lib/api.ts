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

// Hard-coded fallback for native (Capacitor) builds when no per-device
// override is set AND VITE_API_BASE wasn't baked in at build time. Without
// this the app would fetch against capacitor://localhost on Android/iOS
// (no server there) and surface "server is unreachable" the moment the
// installed APK/IPA is opened. Users / admins can still override via the
// in-app server URL setting (writes to localStorage under LS_KEY) or via
// VITE_API_BASE at build time.
const DEFAULT_BACKEND_URL = "https://www.fitwayhub.com";

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
  // Native build with no in-app override: prefer the VITE_API_BASE build-time
  // variable, otherwise fall back to the production backend URL so the app
  // works out of the box even without a VITE_API_BASE secret.
  const buildTime = String(import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');
  return buildTime || DEFAULT_BACKEND_URL;
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

// ─────────────────────────────────────────────────────────────────────────────
//  Guarded JSON fetch
//
//  Mobile call sites historically did `fetch(getApiBase()+path).then(r =>
//  r.json())`, which throws "Unexpected token '<'" whenever the server returns
//  a non-JSON error page (e.g. a 404 HTML body). `apiJson` prepends the API
//  base, injects the bearer token, checks res.ok, and throws a typed ApiError
//  carrying the server message instead of crashing the parser.
// ─────────────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  payload: any;
  constructor(message: string, status: number, payload?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export interface ApiJsonOptions extends Omit<RequestInit, "body"> {
  body?: BodyInit | Record<string, unknown> | unknown[] | null;
  auth?: boolean;
}

export async function apiJson<T = any>(path: string, opts: ApiJsonOptions = {}): Promise<T> {
  const { body, auth = true, headers, ...rest } = opts;
  const finalHeaders = new Headers(headers as HeadersInit | undefined);

  const isPlainObject =
    body != null &&
    typeof body === "object" &&
    !(body instanceof FormData) &&
    !(body instanceof Blob) &&
    !(body instanceof ArrayBuffer) &&
    !(typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams);

  let finalBody: BodyInit | null | undefined;
  if (isPlainObject) {
    if (!finalHeaders.has("Content-Type")) finalHeaders.set("Content-Type", "application/json");
    finalBody = JSON.stringify(body);
  } else {
    finalBody = body as BodyInit | null | undefined;
  }

  if (auth && !finalHeaders.has("Authorization")) {
    try {
      const t = localStorage.getItem("token");
      if (t) finalHeaders.set("Authorization", `Bearer ${t}`);
    } catch { /* localStorage may throw in some contexts */ }
  }

  const res = await fetch(getApiBase() + path, { ...rest, headers: finalHeaders, body: finalBody });

  const text = await res.text();
  let data: any = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!res.ok) {
    const message =
      (data && typeof data === "object" && (data.message || data.error)) ||
      (typeof data === "string" && data) ||
      `Request failed (${res.status})`;
    throw new ApiError(String(message), res.status, data);
  }
  return data as T;
}

