import type { CSSProperties } from "react";

interface CoachSearchIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: CSSProperties;
}

/**
 * Magnifier with a tiny dumbbell inside the lens — the coach metaphor sits
 * inside the search glass instead of beside it. Kept as a single SVG so it
 * scales cleanly inside the FAB.
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
      {/* Magnifier lens */}
      <circle cx="10" cy="10" r="7.5" />

      {/* Magnifier handle */}
      <path d="M15.5 15.5l5.5 5.5" />

      {/* Dumbbell inside the lens — coach metaphor */}
      <path d="M7.5 10h5" />
      <path d="M6.5 8.5v3" />
      <path d="M13.5 8.5v3" />
    </svg>
  );
}

export default CoachSearchIcon;
