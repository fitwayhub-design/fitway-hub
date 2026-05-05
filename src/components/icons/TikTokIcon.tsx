import type { CSSProperties } from "react";

interface TikTokIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: CSSProperties;
  className?: string;
}

/**
 * TikTok glyph rendered as an SVG. Lucide doesn't ship a TikTok icon, so we
 * provide a small inline component that matches the visual weight (stroked)
 * of the other social icons we use.
 */
export function TikTokIcon({ size = 20, color = "currentColor", strokeWidth = 1.8, style, className }: TikTokIconProps) {
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
      className={className}
      aria-hidden="true"
    >
      <path d="M21 8.5a7.5 7.5 0 0 1-5-1.9V15a6 6 0 1 1-6-6c.34 0 .68.03 1 .09v3.13a3 3 0 1 0 2 2.83V2h3a4.5 4.5 0 0 0 5 4.5z" />
    </svg>
  );
}

export default TikTokIcon;
