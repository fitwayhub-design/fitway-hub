import { query, get, run } from '../config/database.js';

/**
 * challengeScoring — the non-AI, deterministic trust + points engine.
 *
 * Every point a participant earns is traceable to an approved submission with
 * a per-method `trust_weight`. Low-trust proof (a typed step count, a
 * screenshot) is worth less than high-trust proof (a coach approval, a logged
 * workout), so self-reported numbers can never out-rank genuinely verified
 * effort. Bonuses (streak, consistency, completion, milestone, participation,
 * early-finish) sit on top of that base. No machine learning anywhere — just
 * rules a human can read and audit.
 */

// ── Verification methods ─────────────────────────────────────────────────────
// trust: 0..1 weight on base points. auto: counts the moment it's submitted
// (rule-checked, no human). evidence: needs a coach/admin to look at a file.
export interface MethodMeta {
  key: string;
  label: string;
  trust: number;
  auto: boolean;        // auto-approved by rules vs. needs human review
  needsEvidence: boolean;
  teamOnly?: boolean;   // coach-anchored, not available app-wide
}

export const METHODS: Record<string, MethodMeta> = {
  manual_checkin:      { key: 'manual_checkin',      label: 'Daily check-in',        trust: 0.4, auto: true,  needsEvidence: false },
  workout_log:         { key: 'workout_log',         label: 'Workout log',           trust: 0.8, auto: true,  needsEvidence: false },
  time_based:          { key: 'time_based',          label: 'Timed activity',        trust: 0.6, auto: true,  needsEvidence: false },
  manual_step:         { key: 'manual_step',         label: 'Step count (manual)',   trust: 0.3, auto: true,  needsEvidence: false },
  manual_distance:     { key: 'manual_distance',     label: 'Distance (manual)',     trust: 0.3, auto: true,  needsEvidence: false },
  gps_steps:           { key: 'gps_steps',           label: 'Steps (GPS)',           trust: 0.6, auto: true,  needsEvidence: false },
  photo_evidence:      { key: 'photo_evidence',      label: 'Photo evidence',        trust: 0.5, auto: false, needsEvidence: true },
  video_evidence:      { key: 'video_evidence',      label: 'Video evidence',        trust: 0.7, auto: false, needsEvidence: true },
  screenshot_evidence: { key: 'screenshot_evidence', label: 'Screenshot evidence',   trust: 0.2, auto: false, needsEvidence: true },
  coach_approval:      { key: 'coach_approval',      label: 'Coach approval',        trust: 1.0, auto: false, needsEvidence: false, teamOnly: true },
  attendance:          { key: 'attendance',          label: 'In-person attendance',  trust: 1.0, auto: false, needsEvidence: false, teamOnly: true },
};

export const ALL_METHODS = Object.keys(METHODS);

/** Methods a given challenge type is allowed to use. */
export function methodsForType(type: string): string[] {
  if (type === 'team') return ALL_METHODS;
  // Community has no per-athlete coach, so coach-anchored methods are excluded.
  return ALL_METHODS.filter(k => !METHODS[k].teamOnly);
}

export function isMethodAllowed(type: string, method: string): boolean {
  return methodsForType(type).includes(method);
}

// ── Metrics ──────────────────────────────────────────────────────────────────
export interface MetricMeta { key: string; label: string; unit: string; max: number; }
export const METRICS: Record<string, MetricMeta> = {
  sessions:    { key: 'sessions',    label: 'Sessions',  unit: 'sessions', max: 50 },
  steps:       { key: 'steps',       label: 'Steps',     unit: 'steps',    max: 50000 },
  distance_km: { key: 'distance_km', label: 'Distance',  unit: 'km',       max: 200 },
  minutes:     { key: 'minutes',     label: 'Minutes',   unit: 'min',      max: 600 },
  reps:        { key: 'reps',        label: 'Reps',      unit: 'reps',     max: 5000 },
  checkins:    { key: 'checkins',    label: 'Check-ins', unit: 'check-ins',max: 1 },
};

/** Clamp a self-reported number to a physiologically plausible per-day ceiling. */
export function clampMetric(metricKey: string, value: number): { value: number; clamped: boolean } {
  const m = METRICS[metricKey] || METRICS.sessions;
  const v = Math.max(0, Number(value) || 0);
  if (v > m.max) return { value: m.max, clamped: true };
  return { value: v, clamped: false };
}

// ── Base points for one submission ───────────────────────────────────────────
const BASE_POINTS = 10;
export function basePointsForSubmission(method: string): number {
  const meta = METHODS[method] || METHODS.manual_checkin;
  return Math.round(BASE_POINTS * meta.trust);
}

// ── Privacy alias ────────────────────────────────────────────────────────────
/** Stable, non-reversible-looking alias for a hidden participant. */
export function aliasForParticipant(p: { id: number; alias?: string | null; display_mode?: string }): string {
  if (p.display_mode === 'alias' && p.alias) return p.alias;
  return 'Athlete #' + Number(p.id).toString(36).toUpperCase().padStart(4, '0');
}

// ── Recompute one participant from their approved submissions ─────────────────
/**
 * Rebuilds points/streak/progress for a single participant by replaying their
 * submissions. Idempotent — safe to call after every submit/approve/reject.
 * Verified (approved) submissions drive the real score; pending submissions are
 * summed separately so the UI can show "pending" greyed-out without ranking it.
 */
export async function recomputeParticipant(challengeId: number, participantId: number): Promise<void> {
  const challenge = await get<any>('SELECT * FROM challenges WHERE id = ?', [challengeId]);
  if (!challenge) return;
  const model = challenge.scoring_model || 'consistency';
  const goalTarget = Number(challenge.goal_target) || 0;

  const subs = await query<any>(
    `SELECT * FROM challenge_submissions
     WHERE challenge_id = ? AND participant_id = ? AND deleted_at IS NULL
     ORDER BY activity_date ASC, id ASC`,
    [challengeId, participantId],
  );

  const approved = subs.filter(s => s.status === 'approved' || s.status === 'auto_approved');
  const pending = subs.filter(s => s.status === 'pending');

  // Baseline (for the improvement model) = first approved metric value.
  let baseline: number | null = null;
  for (const s of approved) {
    if (Number(s.metric_value) > 0) { baseline = Number(s.metric_value); break; }
  }

  // Distinct active days + longest consecutive streak.
  const days = [...new Set(approved.map(s => s.activity_date))].sort();
  let bestStreak = 0, curStreak = 0; let prev: number | null = null;
  for (const d of days) {
    const t = Date.parse(d + 'T00:00:00Z');
    if (prev !== null && t - prev === 86400000) curStreak += 1; else curStreak = 1;
    bestStreak = Math.max(bestStreak, curStreak);
    prev = t;
  }

  // Progress depends on the scoring model.
  const sumMetric = approved.reduce((a, s) => a + (Number(s.metric_value) || 0), 0);
  const maxMetric = approved.reduce((a, s) => Math.max(a, Number(s.metric_value) || 0), 0);
  let progress = 0;
  switch (model) {
    case 'performance':   progress = sumMetric; break;
    case 'consistency':   progress = days.length; break;
    case 'participation': progress = approved.length; break;
    case 'improvement':   progress = baseline && baseline > 0 ? Math.max(0, ((maxMetric - baseline) / baseline) * 100) : 0; break;
    default:              progress = days.length;
  }

  // ── Points ──
  let verified = approved.reduce((a, s) => a + (Number(s.awarded_points) || 0), 0);

  // Participation floor — anyone with ≥1 verified activity banks something.
  if (approved.length > 0) verified += 10;
  // Consistency bonus — reward frequency.
  verified += days.length * 1;
  // Streak bonus — capped so the fittest can't run away.
  verified += Math.min(bestStreak, 10) * 2;
  // Milestone bonuses — 25/50/75% of the goal.
  if (goalTarget > 0) {
    const pct = model === 'improvement' ? progress : (progress / goalTarget) * 100;
    for (const m of [25, 50, 75]) if (pct >= m) verified += 15;
  }
  // Completion + early-completion bonus.
  let completed = false;
  if (goalTarget > 0) {
    completed = model === 'improvement' ? progress >= goalTarget : progress >= goalTarget;
    if (completed) {
      verified += 100;
      const start = challenge.start_at ? Date.parse(challenge.start_at) : null;
      const end = challenge.end_at ? Date.parse(challenge.end_at) : null;
      if (start && end) {
        const midpoint = start + (end - start) / 2;
        if (Date.now() < midpoint) verified += 25; // early finish
      }
    }
  }

  const pendingPts = pending.reduce((a, s) => a + (Number(s.awarded_points) || 0), 0);

  await run(
    `UPDATE challenge_participants
       SET points = ?, verified_points = ?, pending_points = ?, streak = ?, best_streak = ?,
           progress_value = ?, verified_count = ?, baseline_value = COALESCE(baseline_value, ?),
           last_checkin_date = ?
     WHERE id = ?`,
    [
      verified, verified, pendingPts, bestStreak, bestStreak,
      Math.round(progress * 100) / 100, approved.length, baseline,
      days.length ? days[days.length - 1] : null,
      participantId,
    ],
  );
}

/** Recompute every active participant (used at finalize / rule changes). */
export async function recomputeAll(challengeId: number): Promise<void> {
  const parts = await query<any>(
    `SELECT id FROM challenge_participants WHERE challenge_id = ? AND status IN ('active','left')`,
    [challengeId],
  );
  for (const p of parts) await recomputeParticipant(challengeId, p.id);
}

/** Whether a participant has met the challenge goal (for completion badges). */
export function hasCompleted(model: string, progress: number, goalTarget: number): boolean {
  if (!goalTarget || goalTarget <= 0) return false;
  return progress >= goalTarget;
}
