/**
 * VideoPlayer
 * Renders a YouTube <iframe> or a plain <video> tag depending on the URL.
 * Handles every YouTube URL format:
 *   - https://www.youtube.com/watch?v=VIDEO_ID
 *   - https://youtu.be/VIDEO_ID
 *   - https://www.youtube.com/embed/VIDEO_ID  (already normalised)
 *   - https://www.youtube.com/shorts/VIDEO_ID
 */

import type { CSSProperties } from "react";

// ── URL helpers ──────────────────────────────────────────────────────────────

export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  try {
    const match = url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export function toYouTubeEmbedUrl(url: string): string | null {
  const id = extractYouTubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

export function isYouTubeUrl(url: string): boolean {
  return extractYouTubeId(url) !== null;
}

// ── Component ────────────────────────────────────────────────────────────────

interface VideoPlayerProps {
  /** The raw URL (watch, youtu.be, embed, or a direct video file URL) */
  url: string;
  /**
   * Explicit media type. When "youtube" the player always uses an iframe.
   * When "video" it always uses <video>.
   * When omitted the component auto-detects from the URL.
   */
  mediaType?: "youtube" | "video" | string;
  height?: number | string;
  style?: CSSProperties;
  autoPlay?: boolean;
  /**
   * Resume position in seconds. Set on the <video> element on mount so the
   * native HTML5 player picks up where the user left off. YouTube iframes
   * don't honour this without the IFrame API, which we don't load here.
   */
  startAt?: number;
  /**
   * Fired on `timeupdate` (~every 250ms on most browsers) with the current
   * playback position and total duration. Only emitted for native <video>;
   * YouTube iframes don't expose playback time without the IFrame API.
   */
  onProgress?: (positionSeconds: number, durationSeconds: number) => void;
}

export default function VideoPlayer({
  url,
  mediaType,
  height = 280,
  style,
  autoPlay = false,
  startAt,
  onProgress,
}: VideoPlayerProps) {
  if (!url) return null;

  const isYT = mediaType === "youtube" || isYouTubeUrl(url);
  const embedUrl = isYT ? toYouTubeEmbedUrl(url) : null;

  const baseStyle: CSSProperties = {
    width: "100%",
    display: "block",
    borderRadius: 12,
    background: "#000",
    border: "none",
    ...style,
  };

  if (isYT && embedUrl) {
    return (
      <iframe
        src={embedUrl}
        height={height}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        style={{ ...baseStyle, height }}
        title="Video player"
      />
    );
  }

  // Fallback: plain HTML5 video
  return (
    <video
      src={url}
      controls
      autoPlay={autoPlay}
      onLoadedMetadata={(e) => {
        const el = e.currentTarget;
        if (startAt && startAt > 0 && Number.isFinite(el.duration) && startAt < el.duration - 1) {
          el.currentTime = startAt;
        }
      }}
      onTimeUpdate={(e) => {
        if (!onProgress) return;
        const el = e.currentTarget;
        const dur = Number.isFinite(el.duration) ? el.duration : 0;
        onProgress(el.currentTime || 0, dur);
      }}
      style={{ ...baseStyle, maxHeight: height }}
    />
  );
}
