import { execFileSync } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * Extract video duration in seconds using ffprobe
 * Falls back to MediaInfo if ffprobe is not available.
 *
 * SECURITY: Uses execFileSync with array arguments (no shell), and rejects
 * any filePath that does not resolve to an existing regular file. This
 * prevents command injection if a caller ever passes user-controlled input.
 */
export async function getVideoDuration(filePath: string): Promise<number | null> {
  try {
    // Reject obviously unsafe / non-existent paths up front. execFileSync does
    // not invoke a shell, so even if the path contained metacharacters they'd
    // be passed verbatim — but we still want to fail fast for clearly bad input.
    if (typeof filePath !== 'string' || filePath.length === 0) return null;
    const resolved = path.resolve(filePath);
    try {
      const stat = fs.statSync(resolved);
      if (!stat.isFile()) return null;
    } catch {
      return null;
    }

    // Try using ffprobe first
    try {
      const result = execFileSync('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        resolved,
      ], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
      const duration = parseFloat(String(result).trim());
      return isNaN(duration) ? null : Math.round(duration);
    } catch {
      // ffprobe not available, try using MediaInfo if installed
      try {
        const result = execFileSync('mediainfo', [
          '--Inform=General;%Duration%',
          resolved,
        ], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
        const duration = parseInt(String(result).trim(), 10) / 1000; // MediaInfo returns ms
        return isNaN(duration) ? null : Math.round(duration);
      } catch {
        // If both tools fail, return null but don't throw
        console.warn(`Could not extract duration from video: ${path.basename(resolved)}`);
        return null;
      }
    }
  } catch (error) {
    console.error('Error getting video duration:', error);
    return null;
  }
}

/**
 * Convert seconds to a readable format (e.g., "5 min 30 sec")
 */
export function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "Unknown";
  
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  
  if (minutes < 60) {
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  }
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
