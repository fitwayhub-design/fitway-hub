import type { CSSProperties } from "react";

interface CoachSearchIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: CSSProperties;
}

/**
 * Magnifier (stroked) with a small filled coach silhouette inside the lens
 * — a head + shoulders, suggesting "find your coach". Filled body reads
 * cleanly even when the FAB is small; stroked magnifier matches the rest
 * of the navigation icon set.
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
      {/* Magnifier lens + handle */}
      <circle cx="10" cy="10" r="7.5" />
      <path d="M15.5 15.5l5.5 5.5" />

      {/* Coach silhouette inside the lens — head + shoulders, filled. */}
      <circle cx="10" cy="8.4" r="1.9" fill={color} stroke="none" />
      <path
        d="M5.7 13.6c0 -2.6 8.6 -2.6 8.6 0"
        fill={color}
        stroke="none"
      />
    </svg>
  );
}

export default CoachSearchIcon;
