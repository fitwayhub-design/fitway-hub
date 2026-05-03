import { run, get } from '../config/database.js';

export async function up() {
  const col = await get<any>(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'blog_posts' AND COLUMN_NAME = 'views'`
  );
  if (!col) {
    await run('ALTER TABLE blog_posts ADD COLUMN views INT DEFAULT 0 AFTER video_duration');
  }
}
