import { run, get } from '../config/database.js';

export async function runWorkoutEngagementMigration() {
    const viewsCol = await get(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'workout_videos' AND COLUMN_NAME = 'views_count'`);
    if (!viewsCol) {
        await run('ALTER TABLE workout_videos ADD COLUMN views_count INT NOT NULL DEFAULT 0');
    }
    const likesCol = await get(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'workout_videos' AND COLUMN_NAME = 'likes_count'`);
    if (!likesCol) {
        await run('ALTER TABLE workout_videos ADD COLUMN likes_count INT NOT NULL DEFAULT 0');
    }
    await run(`
    CREATE TABLE IF NOT EXISTS video_views (
      id INT AUTO_INCREMENT PRIMARY KEY,
      video_id INT NOT NULL,
      user_id INT NOT NULL,
      viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      KEY idx_video_viewed_at (video_id, viewed_at),
      KEY idx_user_video (user_id, video_id),
      FOREIGN KEY (video_id) REFERENCES workout_videos(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
    await run(`
    CREATE TABLE IF NOT EXISTS video_likes (
      user_id INT NOT NULL,
      video_id INT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, video_id),
      KEY idx_video_id (video_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (video_id) REFERENCES workout_videos(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
    await run(`
    CREATE TABLE IF NOT EXISTS video_saves (
      user_id INT NOT NULL,
      video_id INT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, video_id),
      KEY idx_video_id (video_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (video_id) REFERENCES workout_videos(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
    await run(`
    CREATE TABLE IF NOT EXISTS video_progress (
      user_id INT NOT NULL,
      video_id INT NOT NULL,
      position_seconds INT NOT NULL DEFAULT 0,
      duration_seconds INT NOT NULL DEFAULT 0,
      completed TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, video_id),
      KEY idx_user_updated (user_id, updated_at),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (video_id) REFERENCES workout_videos(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}
