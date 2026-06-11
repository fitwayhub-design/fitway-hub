import type { KeyboardEvent } from "react";

/**
 * Accessibility helper for non-semantic clickable elements (`<div>`, `<Card>`,
 * list rows, etc.). Spread the result onto the element to make it behave like a
 * real button for keyboard and assistive-tech users:
 *
 *   <div {...clickable(() => openItem(x))}>…</div>
 *
 * It adds `role="button"`, `tabIndex={0}`, the click handler, and an Enter/Space
 * key handler — satisfying WCAG 2.1 SC 2.1.1 (Keyboard) and 4.1.2 (Name, Role,
 * Value). Prefer a real <button> where the markup allows it; use this for the
 * many existing card/row containers that can't easily become buttons.
 */
export function clickable(
  onActivate: () => void,
  opts: { label?: string; disabled?: boolean } = {},
) {
  const { label, disabled } = opts;
  return {
    role: "button" as const,
    tabIndex: disabled ? -1 : 0,
    "aria-disabled": disabled || undefined,
    "aria-label": label,
    onClick: () => {
      if (!disabled) onActivate();
    },
    onKeyDown: (e: KeyboardEvent) => {
      if (disabled) return;
      // Activate on Enter or Space, matching native button semantics. Space is
      // prevented from scrolling the page.
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        onActivate();
      }
    },
  };
}

export default clickable;
