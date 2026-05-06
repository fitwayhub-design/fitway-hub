import type { CSSProperties } from "react";

interface CoachSearchIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: CSSProperties;
}

/**
 * Composite icon for the "Find a coach" FAB. Renders a stylised dumbbell
 * (coach metaphor) with a small magnifier badge overlapping the bottom-right.
 * Lucide doesn't ship a coach-search glyph and the user specifically wanted
 * search + coach (not search + person), so this is drawn as a single SVG.
 */
export function CoachSearchIcon({ size = 24, color = "currentColor", strokeWidth = 2, style }: CoachSearchIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      {/* Dumbbell — slightly tilted to leave the bottom-right corner free
          for the magnifier. The bar runs from upper-left to mid-right; two
          plate caps mark each end. */}
      <path d="M5.5 5.5l8 8" />
      <path d="M3 8l3-3" />
      <path d="M2 7l2-2" />
      <path d="M8 14l-3 3" />
      <path d="M7 16l-2 2" />
      <path d="M11.5 11.5l3-3" />

      {/* Magnifier — bottom-right corner */}
      <circle cx="16.5" cy="15.5" r="3.5" />
      <path d="M19.2 18.2l2.3 2.3" />
    </svg>
  );
}

export default CoachSearchIcon;
