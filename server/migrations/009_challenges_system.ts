import { run, get } from '../config/database.js';

/**
 * 009 — full Challenges system.
 *
 * The app shipped a minimal `challenges` table (a glorified group chat) plus a
 * bare `challenge_participants` join table. This migration grows both into a
 * real, fair, low-cheating competition engine that supports exactly two kinds
 * of challenge:
 *
 *   • team       — private, invitation-only, created by a coach for athletes
 *                  they already serve.
 *   • community  — open, public leaderboard, created by admins.
 *
 * Everything is additive and guarded so the migration is safe to re-run and
 * never drops existing data. Existing rows are back-filled to a sensible
 * `community` / `active` default so the old admin page keeps working.
 */

/** Add a column only if it isn't already there (idempotent). */
async function addColumn(table: string, column: string, definition: string) {
  const exists = await get<any>(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  if (!exists) {
    await run(`ALTER TABLE \`${table}\` ADD COLUMN ${column} ${definition}`);
  }
}

export async function runChallengesSystemMigration() {
  // ── challenges: competition metadata ───────────────────────────────────────
  await addColumn('challenges', 'type', "VARCHAR(20) NOT NULL DEFAULT 'community'");
  await addColumn('challenges', 'visibility', "VARCHAR(20) NOT NULL DEFAULT 'public'");
  await addColumn('challenges', 'status', "VARCHAR(20) NOT NULL DEFAULT 'active'");
  await addColumn('challenges', 'timezone', "VARCHAR(64) NOT NULL DEFAULT 'UTC'");
  await addColumn('challenges', 'start_at', 'DATETIME NULL');
  await addColumn('challenges', 'end_at', 'DATETIME NULL');
  await addColumn('challenges', 'open_entry_until', 'DATETIME NULL');
  await addColumn('challenges', 'goal_metric', "VARCHAR(30) NOT NULL DEFAULT 'sessions'");
  await addColumn('challenges', 'goal_target', 'DOUBLE NOT NULL DEFAULT 0');
  // Free-form goals / milestones the creator wants participants to hit
  // (one per line). Complements the single scoring metric above.
  await addColumn('challenges', 'goals', 'TEXT NULL');
  await addColumn('challenges', 'scoring_model', "VARCHAR(20) NOT NULL DEFAULT 'consistency'");
  await addColumn('challenges', 'verification_methods', "VARCHAR(500) NOT NULL DEFAULT 'manual_checkin'");
  await addColumn('challenges', 'min_duration_seconds', 'INT NOT NULL DEFAULT 0');
  await addColumn('challenges', 'participant_limit', 'INT NOT NULL DEFAULT 0');
  await addColumn('challenges', 'premium_only', 'TINYINT(1) NOT NULL DEFAULT 0');
  await addColumn('challenges', 'min_account_age_days', 'INT NOT NULL DEFAULT 0');
  await addColumn('challenges', 'rules_terms', 'TEXT NULL');
  await addColumn('challenges', 'cancellation_policy', 'VARCHAR(255) NULL');
  await addColumn('challenges', 'reward_tiers', 'TEXT NULL');
  await addColumn('challenges', 'finalized_at', 'DATETIME NULL');
  await addColumn('challenges', 'cancelled_at', 'DATETIME NULL');
  await addColumn('challenges', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
  await addColumn('challenges', 'deleted_at', 'DATETIME NULL');

  // Back-fill datetime columns from the old VARCHAR date strings where possible
  // so legacy challenges still render schedule + leaderboard correctly.
  try {
    await run(
      `UPDATE challenges
         SET start_at = COALESCE(start_at, CASE WHEN start_date IS NOT NULL AND start_date <> '' THEN STR_TO_DATE(CONCAT(start_date,' 00:00:00'), '%Y-%m-%d %H:%i:%s') END),
             end_at   = COALESCE(end_at,   CASE WHEN end_date   IS NOT NULL AND end_date   <> '' THEN STR_TO_DATE(CONCAT(end_date,' 23:59:59'),  '%Y-%m-%d %H:%i:%s') END)
       WHERE start_at IS NULL OR end_at IS NULL`,
    );
  } catch { /* best-effort back-fill */ }

  // ── challenge_participants: scoring + privacy + lifecycle ───────────────────
  await addColumn('challenge_participants', 'display_mode', "VARCHAR(10) NOT NULL DEFAULT 'hidden'");
  await addColumn('challenge_participants', 'alias', 'VARCHAR(40) NULL');
  await addColumn('challenge_participants', 'status', "VARCHAR(15) NOT NULL DEFAULT 'active'");
  await addColumn('challenge_participants', 'points', 'INT NOT NULL DEFAULT 0');
  await addColumn('challenge_participants', 'verified_points', 'INT NOT NULL DEFAULT 0');
  await addColumn('challenge_participants', 'pending_points', 'INT NOT NULL DEFAULT 0');
  await addColumn('challenge_participants', 'streak', 'INT NOT NULL DEFAULT 0');
  await addColumn('challenge_participants', 'best_streak', 'INT NOT NULL DEFAULT 0');
  await addColumn('challenge_participants', 'baseline_value', 'DOUBLE NULL');
  await addColumn('challenge_participants', 'progress_value', 'DOUBLE NOT NULL DEFAULT 0');
  await addColumn('challenge_participants', 'verified_count', 'INT NOT NULL DEFAULT 0');
  await addColumn('challenge_participants', 'flags', 'INT NOT NULL DEFAULT 0');
  await addColumn('challenge_participants', 'last_checkin_date', 'VARCHAR(20) NULL');
  await addColumn('challenge_participants', 'left_at', 'DATETIME NULL');
  await addColumn('challenge_participants', 'rejoin_count', 'INT NOT NULL DEFAULT 0');
  await addColumn('challenge_participants', 'is_winner', 'TINYINT(1) NOT NULL DEFAULT 0');
  await addColumn('challenge_participants', 'win_category', 'VARCHAR(30) NULL');
  await addColumn('challenge_participants', 'accepted_terms_at', 'DATETIME NULL');

  // ── challenge_invitations ───────────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS challenge_invitations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      challenge_id INT NOT NULL,
      inviter_id INT NOT NULL,
      invitee_id INT NOT NULL,
      token VARCHAR(64) NOT NULL,
      status VARCHAR(15) NOT NULL DEFAULT 'sent',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      responded_at DATETIME NULL,
      UNIQUE KEY uniq_challenge_invitee (challenge_id, invitee_id),
      UNIQUE KEY uniq_token (token),
      KEY idx_invitee (invitee_id, status),
      FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE,
      FOREIGN KEY (invitee_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ── challenge_submissions (verification records / activity ledger) ──────────
  await run(`
    CREATE TABLE IF NOT EXISTS challenge_submissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      challenge_id INT NOT NULL,
      participant_id INT NOT NULL,
      user_id INT NOT NULL,
      method VARCHAR(30) NOT NULL,
      metric_value DOUBLE NOT NULL DEFAULT 0,
      duration_seconds INT NOT NULL DEFAULT 0,
      evidence_url TEXT NULL,
      evidence_hash VARCHAR(64) NULL,
      note VARCHAR(500) NULL,
      activity_date VARCHAR(20) NOT NULL,
      status VARCHAR(15) NOT NULL DEFAULT 'pending',
      trust_weight DOUBLE NOT NULL DEFAULT 0.5,
      awarded_points INT NOT NULL DEFAULT 0,
      flagged TINYINT(1) NOT NULL DEFAULT 0,
      flag_reason VARCHAR(255) NULL,
      reviewed_by INT NULL,
      review_reason VARCHAR(255) NULL,
      reviewed_at DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      KEY idx_challenge_participant (challenge_id, participant_id),
      KEY idx_challenge_status (challenge_id, status),
      KEY idx_hash (challenge_id, evidence_hash),
      FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE,
      FOREIGN KEY (participant_id) REFERENCES challenge_participants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Evidence capture metadata (when the photo/video was actually taken) and
  // GPS proof-of-presence (steps-by-GPS). Added via addColumn so existing
  // installs upgrade in place.
  await addColumn('challenge_submissions', 'captured_at', 'DATETIME NULL');
  await addColumn('challenge_submissions', 'geo_lat', 'DOUBLE NULL');
  await addColumn('challenge_submissions', 'geo_lng', 'DOUBLE NULL');

  // ── challenge_reward_grants (trophies/badges on a profile) ──────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS challenge_reward_grants (
      id INT AUTO_INCREMENT PRIMARY KEY,
      challenge_id INT NOT NULL,
      participant_id INT NULL,
      user_id INT NOT NULL,
      kind VARCHAR(20) NOT NULL DEFAULT 'badge',
      label VARCHAR(120) NOT NULL,
      category VARCHAR(30) NULL,
      tier VARCHAR(20) NULL,
      points_awarded INT NOT NULL DEFAULT 0,
      expires_at DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      KEY idx_user (user_id),
      KEY idx_challenge (challenge_id),
      FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ── challenge_reports (abuse + system fraud flags) ──────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS challenge_reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      challenge_id INT NULL,
      submission_id INT NULL,
      reporter_id INT NULL,
      source VARCHAR(15) NOT NULL DEFAULT 'user',
      reason VARCHAR(255) NOT NULL,
      status VARCHAR(15) NOT NULL DEFAULT 'open',
      resolved_by INT NULL,
      resolution_note VARCHAR(255) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME NULL,
      KEY idx_status (status),
      KEY idx_challenge (challenge_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ── Global reward defaults (admin-controlled, applied to every challenge) ────
  const defaults = JSON.stringify({
    champion: { kind: 'trophy', label: 'Challenge Champion', tier: 'gold', points: 200, expires_days: 0 },
    runner_up: { kind: 'trophy', label: 'Runner-Up', tier: 'silver', points: 120, expires_days: 0 },
    third: { kind: 'trophy', label: 'Third Place', tier: 'bronze', points: 80, expires_days: 0 },
    most_consistent: { kind: 'badge', label: 'Most Consistent', points: 60, expires_days: 0 },
    most_improved: { kind: 'badge', label: 'Most Improved', points: 60, expires_days: 0 },
    completion: { kind: 'badge', label: 'Finisher', points: 40, expires_days: 0 },
    participation: { kind: 'badge', label: 'Participant', points: 10, expires_days: 0 },
    winners_count: 3,
    coach_auto_approve_limit: 200,
  });
  await run(
    `INSERT IGNORE INTO app_settings (setting_key, setting_value, setting_type, category, label)
     VALUES ('challenge_reward_defaults', ?, 'json', 'challenges', 'Challenge Reward Defaults')`,
    [defaults],
  );
}
