import { run, get } from '../config/database.js';
/**
 * 007 — engagement & progress for workout videos.
 *
 * Adds the four pieces the user asked for on the Workouts page:
 *   - real per-user playback progress (resume where you left off)
 *   - view counters, recorded with a timestamp so "trending this week"
 *     can be computed from the last 7 days rather than all-time
 *   - per-user likes (toggle) + a denormalised counter on workout_videos
 *   - per-user saves (toggle) so favorites sync across devices instead
 *     of being stuck in browser localStorage
 *
 * Each ALTER / CREATE is guarded so the migration is safe to re-run.
 */
export async function runWorkoutEngagementMigration() {
    // 1) Counters on workout_videos. Kept denormalised so we can sort cheaply
    //    without a GROUP BY per query.
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
    // 2) video_views — one row per view (per user). The KEY on (video_id,
    //    viewed_at) lets the trending query scan only the last 7 days cheaply.
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
    // 3) video_likes — toggle table. Primary key prevents double-likes.
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
    // 4) video_saves — toggle table for the "Saved" section on the Workouts
    //    page. Same shape as video_likes; kept separate so the two intents
    //    (private bookmark vs. public like) can diverge later.
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
    // 5) video_progress — last-known playback position per user/video. A row
    //    is upserted from the player's `timeupdate` event roughly every 5s.
    //    `completed` is auto-flipped server-side when position / duration
    //    crosses 90% so "Continue watching" can hide finished workouts.
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
//# sourceMappingURL=007_workout_engagement.js.map