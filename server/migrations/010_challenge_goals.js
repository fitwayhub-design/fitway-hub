import { run, get } from '../config/database.js';
/**
 * 010 — multi-goal challenges + per-challenge reward.
 *
 * Replaces the single goal_metric/goal_target pair with a LIST of typed goals
 * (training / walk-run / weight loss / weight gain / nutrition / habit /
 * transformation), each tracked by the verification methods its type dictates.
 * Also gives every challenge its own admin-set reward (title, description,
 * bonus points) on top of the global reward-tier catalog.
 *
 * Additive + idempotent: legacy challenges keep working off goal_metric /
 * goal_target / goals(TEXT); new ones get challenge_goals rows.
 */
async function addColumn(table, column, definition) {
    const exists = await get(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`, [table, column]);
    if (!exists) {
        await run(`ALTER TABLE \`${table}\` ADD COLUMN ${column} ${definition}`);
    }
}
export async function runChallengeGoalsMigration() {
    // ── challenge_goals: the task list a challenge is made of ───────────────────
    await run(`
    CREATE TABLE IF NOT EXISTS challenge_goals (
      id INT AUTO_INCREMENT PRIMARY KEY,
      challenge_id INT NOT NULL,
      position INT NOT NULL DEFAULT 0,
      goal_type VARCHAR(30) NOT NULL,
      title VARCHAR(160) NOT NULL,
      description VARCHAR(500) NULL,
      training_id INT NULL,
      activity VARCHAR(20) NULL,
      target_value DOUBLE NOT NULL DEFAULT 0,
      target_unit VARCHAR(20) NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      KEY idx_challenge (challenge_id),
      FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
    // Submissions link to the specific goal they advance (NULL = legacy).
    await addColumn('challenge_submissions', 'goal_id', 'INT NULL');
    // ── per-challenge reward (set by the admin / creator in challenge settings) ─
    await addColumn('challenges', 'reward_title', 'VARCHAR(160) NULL');
    await addColumn('challenges', 'reward_description', 'VARCHAR(500) NULL');
    await addColumn('challenges', 'reward_points', 'INT NOT NULL DEFAULT 0');
}
//# sourceMappingURL=010_challenge_goals.js.map