import { run } from '../config/database.js';

const PATTERN = "REGEXP '^https?://(localhost|127\\\\.0\\\\.0\\\\.1)(:[0-9]+)?/uploads/'";

const TARGETS = [
    { table: 'workout_videos', columns: ['url', 'thumbnail', 'youtube_url'] },
    { table: 'blog_posts', columns: ['header_image_url', 'video_url'] },
    { table: 'app_images', columns: ['url'] },
    { table: 'website_sections', columns: ['content'] },
    { table: 'community_posts', columns: ['image_url', 'media_url'] },
    { table: 'cms_pages', columns: ['content'] },
    { table: 'ads', columns: ['image_url', 'video_url'] },
];

export async function runUrlCleanupMigration() {
    for (const { table, columns } of TARGETS) {
        for (const col of columns) {
            try {
                await run(`UPDATE ${table}
           SET ${col} = REGEXP_REPLACE(${col}, '^https?://(localhost|127\\.0\\.0\\.1)(:[0-9]+)?', '')
           WHERE ${col} ${PATTERN}`);
            }
            catch {
                // Column or table may not exist on every install; skip silently.
            }
        }
    }
}
