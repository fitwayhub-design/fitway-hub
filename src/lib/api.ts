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

// ─────────────────────────────────────────────────────────────────────────────
//  Centralized fetch layer
//
//  Previously every call site repeated `fetch(getApiBase() + path, { headers:
//  { Authorization: Bearer <localStorage token> } })` plus its own ad-hoc error
//  and 401 handling. `apiFetch`/`apiJson` consolidate that:
//    • prepend the API base,
//    • inject the bearer token from localStorage,
//    • default JSON content-type for object bodies,
//    • emit a global `auth:unauthorized` event on 401 so AuthContext can run a
//      single refresh-or-logout flow instead of N bespoke handlers,
//    • normalize failures into a typed ApiError.
//  Existing raw `fetch` calls keep working; new code should prefer these.
// ─────────────────────────────────────────────────────────────────────────────

export const UNAUTHORIZED_EVENT = "auth:unauthorized";

/** Error thrown by apiJson when the response is not ok. */
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

function authToken(): string | null {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  /** Object bodies are JSON-stringified automatically; pass FormData/string as-is. */
  body?: BodyInit | Record<string, unknown> | unknown[] | null;
  /** Set false to skip the Authorization header (e.g. public endpoints). */
  auth?: boolean;
}

/**
 * fetch() with base URL + bearer auth + global 401 signalling.
 * Returns the raw Response so callers can stream, check status, etc.
 */
export async function apiFetch(path: string, opts: ApiFetchOptions = {}): Promise<Response> {
  const { body, auth = true, headers, ...rest } = opts;
  const finalHeaders = new Headers(headers as HeadersInit | undefined);

  let finalBody: BodyInit | null | undefined;
  const isPlainObject =
    body != null &&
    typeof body === "object" &&
    !(body instanceof FormData) &&
    !(body instanceof Blob) &&
    !(body instanceof ArrayBuffer) &&
    !(typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams);

  if (isPlainObject) {
    if (!finalHeaders.has("Content-Type")) finalHeaders.set("Content-Type", "application/json");
    finalBody = JSON.stringify(body);
  } else {
    finalBody = body as BodyInit | null | undefined;
  }

  if (auth) {
    const t = authToken();
    if (t && !finalHeaders.has("Authorization")) finalHeaders.set("Authorization", `Bearer ${t}`);
  }

  const res = await fetch(getApiBase() + path, { ...rest, headers: finalHeaders, body: finalBody });

  if (res.status === 401 && typeof window !== "undefined") {
    // Let a single listener (AuthContext) decide: try remember-token refresh,
    // else clear auth. Avoids every call site reimplementing logout-on-401.
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
  }

  return res;
}

/**
 * apiFetch + JSON parsing. Resolves with the parsed body on 2xx, throws
 * ApiError (carrying status + parsed payload) otherwise.
 */
export async function apiJson<T = any>(path: string, opts: ApiFetchOptions = {}): Promise<T> {
  const res = await apiFetch(path, opts);
  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
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

