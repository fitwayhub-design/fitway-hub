/**
 * Copy text to the clipboard reliably across web and Capacitor WebViews.
 *
 * `navigator.clipboard.writeText` works in secure contexts but is not always
 * available on older Android System WebViews (minSdk here is 24). Fall back to
 * the legacy `execCommand('copy')` textarea trick, which works inside WebViews
 * on both platforms. Returns true on success so callers can show feedback.
 */
export async function copyText(text: string): Promise<boolean> {
  const value = String(text ?? "");
  if (!value) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fall through to the legacy path below */
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
