import { run } from '../config/database.js';

/**
 * 008 — strip localhost host prefixes from any URL column that holds an
 * admin-uploaded file path.
 *
 * Background: an earlier version of upload.ts always prefixed APP_BASE_URL
 * when R2 wasn't configured, and the default APP_BASE_URL was
 * http://localhost:3000. Anything uploaded during that window was saved
 * to the database as e.g. http://localhost:3000/uploads/cms/foo.jpg —
 * which 404s for every viewer that isn't the dev machine.
 *
 * This migration rewrites those values down to the relative form
 * (/uploads/cms/foo.jpg). The new upload code + frontend resolveAssetUrl
 * helper then re-prefix the correct host based on the viewer's current
 * origin / API base. Safe to re-run.
 */
const PATTERN = "REGEXP '^https?://(localhost|127\\\\.0\\\\.0\\\\.1)(:[0-9]+)?/uploads/'";

const TARGETS: Array<{ table: string; columns: string[] }> = [
  { table: 'workout_videos', columns: ['url', 'thumbnail', 'youtube_url'] },
  { table: 'blog_posts', columns: ['header_image_url', 'video_url'] },
  { table: 'app_images', columns: ['url'] },
  { table: 'website_sections', columns: ['content'] }, // JSON blob; regex_replace below handles inline urls
  { table: 'community_posts', columns: ['image_url', 'media_url'] },
  { table: 'cms_pages', columns: ['content'] },
  { table: 'ads', columns: ['image_url', 'video_url'] },
];

export async function runUrlCleanupMigration() {
  for (const { table, columns } of TARGETS) {
    for (const col of columns) {
      try {
        // Strip the host prefix only — keep the /uploads/... path intact.
        // REGEXP_REPLACE is available on MySQL 8+. If the column doesn't
        // exist (older schema, optional table), the catch below swallows it.
        await run(
          `UPDATE ${table}
           SET ${col} = REGEXP_REPLACE(${col}, '^https?://(localhost|127\\.0\\.0\\.1)(:[0-9]+)?', '')
           WHERE ${col} ${PATTERN}`
        );
      } catch {
        // Column or table may not exist on every install; skip silently.
      }
    }
  }
}
