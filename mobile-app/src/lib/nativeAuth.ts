/**
 * Mobile auth helpers shared by Login / Register / ForgotPassword.
 *
 * Two problems these fix:
 *
 *  1. Google OAuth in the embedded WebView. Google's sign-in flow refuses to
 *     authenticate inside an embedded WebView ("disallowed_useragent"). Even
 *     if it didn't, the WebView can't follow the `fitwayhub://auth/...`
 *     redirect that the server issues after a successful sign-in — it would
 *     just stop. On native we have to hand the URL to the system browser
 *     (Safari / Chrome) instead, then let the OS hand the deep-link callback
 *     back to the app via the URL-scheme registration in Info.plist /
 *     AndroidManifest.xml.
 *
 *  2. OTP requests hanging silently. On a flaky network the fetch can sit
 *     pending until the user gives up. Wrapping each request in an
 *     AbortController with an explicit timeout surfaces a real error message
 *     instead of a stuck spinner.
 */

export function isNativeRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as any).Capacitor;
  try {
    return !!cap?.isNativePlatform?.();
  } catch {
    return false;
  }
}

/** Open a URL in the system browser on native; fall back to a normal
 *  navigation on web. Capacitor intercepts window.open() and routes the
 *  URL through UIApplication.shared.open (iOS) / ACTION_VIEW Intent
 *  (Android), which is what Google requires for OAuth.
 *
 *  Note: Capacitor's window.open returns null even on success (there's no
 *  real popup window in the WebView), so we must NOT inspect the return
 *  value and fall back to a WebView navigation — that would defeat the
 *  whole point and dump the user back into the embedded view where
 *  Google rejects them. On native we always trust window.open. */
export function openExternal(url: string): void {
  if (isNativeRuntime()) {
    try {
      window.open(url, '_system');
    } catch {
      // Last-resort fallback. The embedded WebView will get
      // disallowed_useragent from Google but at least the user sees
      // *something* instead of a silent no-op.
      window.location.href = url;
    }
    return;
  }
  window.location.href = url;
}

/** fetch() that aborts after `timeoutMs` and rethrows a clear error
 *  message. Use for any request the user is actively waiting on (OTP
 *  send, password reset request, etc.) so a hung network doesn't leave
 *  the UI stuck in "Sending…". The URL being requested is included in
 *  the error message so the user can tell at a glance whether the app
 *  is hitting the wrong backend (the #1 cause of "OTP doesn't send" in
 *  the field — VITE_API_BASE not baked into the build, no admin
 *  override, falling back to a hostname that doesn't run the API). */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 20000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const urlForMsg =
    typeof input === 'string' ? input
    : input instanceof URL ? input.toString()
    : (input as Request).url;
  const origin = (() => {
    try { return new URL(urlForMsg).origin; } catch { return urlForMsg; }
  })();
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`Request timed out talking to ${origin}. Please check your connection and try again.`);
    }
    // Cross-origin / TLS / DNS failures surface as TypeError("Failed to fetch")
    // in Capacitor's WebView — translate to something a user can act on.
    if (err?.name === 'TypeError') {
      throw new Error(`Cannot reach ${origin}. Check your connection, or your server URL in Settings.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
