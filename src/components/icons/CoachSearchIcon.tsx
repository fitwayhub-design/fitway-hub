import { memo } from "react";
import type { CSSProperties } from "react";

interface CoachSearchIconProps {
  size?: number;
  color?: string;
  style?: CSSProperties;
}

// Simple magnifier (search) glass — used in the bottom-nav "Find Coach" tab.
function CoachSearchIconImpl({ size = 24, color = "currentColor", style }: CoachSearchIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export const CoachSearchIcon = memo(CoachSearchIconImpl);
export default CoachSearchIcon;
