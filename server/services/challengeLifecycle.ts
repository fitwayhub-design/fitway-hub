import { query, get, run } from '../config/database.js';
import { createInAppNotification, sendPushFromTemplate } from '../notificationService.js';
import { recomputeAll } from './challengeScoring.js';
import { GOAL_COMPLETION_TARGET } from './challengeGoalTypes.js';

/**
 * challengeLifecycle — finalization shared by the API route and the
 * auto-finalize background job.
 *
 * Finalizing resolves leftover pending evidence, recomputes every score,
 * grants podium trophies + category badges + the challenge's own reward
 * (champion prize), notifies everyone, and locks the challenge.
 */

function notify(userId: number, type: string, title: string, body: string, link: string) {
  createInAppNotification(userId, type, title, body, link).catch(() => {});
  sendPushFromTemplate(userId, type, { title, body }).catch(() => {});
}

/**
 * Finalize one challenge. The caller is responsible for permission checks;
 * this enforces only data-level guards (exists, not already finalized).
 */
export async function finalizeChallengeById(challengeId: number): Promise<{ ok: boolean; message: string }> {
  const c = await get<any>('SELECT * FROM challenges WHERE id = ? AND deleted_at IS NULL', [challengeId]);
  if (!c) return { ok: false, message: 'Challenge not found' };
  if (c.status === 'finalized') return { ok: false, message: 'Already finalized.' };

  // Resolve leftover pending evidence: unreviewed at finalize = rejected.
  await run("UPDATE challenge_submissions SET status='rejected', review_reason='unreviewed at finalize' WHERE challenge_id = ? AND status='pending'", [c.id]);
  await recomputeAll(c.id);

  const tiers = (() => { try { return JSON.parse(c.reward_tiers || '{}'); } catch { return {}; } })();
  const winnersCount = Number(tiers.winners_count) || 3;
  const goalCount = await get<any>('SELECT COUNT(*) n FROM challenge_goals WHERE challenge_id = ?', [c.id]);
  // Goal-based challenges: progress_value is overall completion %, target 100.
  const goalTarget = (goalCount?.n || 0) > 0 ? GOAL_COMPLETION_TARGET : Number(c.goal_target) || 0;

  const ranked = await query<any>(
    `SELECT cp.*, u.name AS user_name FROM challenge_participants cp JOIN users u ON cp.user_id = u.id
     WHERE cp.challenge_id = ? AND cp.status='active'
     ORDER BY cp.verified_points DESC, cp.progress_value DESC, cp.best_streak DESC, cp.joined_at ASC, cp.user_id ASC`,
    [c.id],
  );

  const grant = async (p: any, kind: string, label: string, category: string, tier: string | null, points: number, expiresDays: number) => {
    const expires = expiresDays > 0 ? new Date(Date.now() + expiresDays * 86400000) : null;
    await run(`INSERT INTO challenge_reward_grants (challenge_id, participant_id, user_id, kind, label, category, tier, points_awarded, expires_at) VALUES (?,?,?,?,?,?,?,?,?)`,
      [c.id, p.id, p.user_id, kind, label, category, tier, points, expires]);
    if (points > 0) {
      await run('UPDATE users SET points = points + ? WHERE id = ?', [points, p.user_id]);
      await run('INSERT INTO point_transactions (user_id, points, reason, reference_type, reference_id) VALUES (?,?,?,?,?)', [p.user_id, points, `Challenge reward: ${label}`, 'challenge', String(c.id)]);
    }
  };

  // Podium (top N). Co-winners allowed implicitly — equal scores keep their order
  // but each still receives the trophy for its rank.
  const podiumKeys = ['champion', 'runner_up', 'third'];
  for (let i = 0; i < Math.min(winnersCount, ranked.length, podiumKeys.length); i++) {
    const p = ranked[i];
    if ((Number(p.verified_points) || 0) <= 0) break; // no points → no trophy
    const t = tiers[podiumKeys[i]] || {};
    await run("UPDATE challenge_participants SET is_winner=1, win_category=? WHERE id = ?", [podiumKeys[i], p.id]);
    await grant(p, t.kind || 'trophy', t.label || podiumKeys[i], podiumKeys[i], t.tier || null, Number(t.points) || 0, Number(t.expires_days) || 0);
    // The challenge's own reward (set by the admin/creator) goes to the champion.
    if (i === 0 && c.reward_title) {
      await grant(p, 'prize', String(c.reward_title), 'challenge_reward', null, Number(c.reward_points) || 0, 0);
    }
    notify(p.user_id, 'challenge_winner', '🏆 You placed!', `You finished #${i + 1} in “${c.title}”.${i === 0 && c.reward_title ? ` Reward: ${c.reward_title}` : ''}`, '/app/challenges');
  }

  // Most consistent (best streak) + most improved (improvement progress).
  const consistent = [...ranked].sort((a, b) => (b.best_streak - a.best_streak) || (b.verified_points - a.verified_points))[0];
  if (consistent && consistent.best_streak > 0 && tiers.most_consistent) await grant(consistent, 'badge', tiers.most_consistent.label || 'Most Consistent', 'most_consistent', null, Number(tiers.most_consistent.points) || 0, Number(tiers.most_consistent.expires_days) || 0);
  if (c.scoring_model === 'improvement') {
    const improved = [...ranked].sort((a, b) => b.progress_value - a.progress_value)[0];
    if (improved && improved.progress_value > 0 && tiers.most_improved) await grant(improved, 'badge', tiers.most_improved.label || 'Most Improved', 'most_improved', null, Number(tiers.most_improved.points) || 0, Number(tiers.most_improved.expires_days) || 0);
  }

  // Completion + participation badges.
  for (const p of ranked) {
    const completed = goalTarget > 0 && Number(p.progress_value) >= goalTarget;
    if (completed && tiers.completion) await grant(p, 'badge', tiers.completion.label || 'Finisher', 'completion', null, Number(tiers.completion.points) || 0, Number(tiers.completion.expires_days) || 0);
    else if (Number(p.verified_count) > 0 && tiers.participation) await grant(p, 'badge', tiers.participation.label || 'Participant', 'participation', null, Number(tiers.participation.points) || 0, Number(tiers.participation.expires_days) || 0);
    if (!p.is_winner) notify(p.user_id, 'challenge_completed', 'Challenge finished', `“${c.title}” has ended. See your final rank and rewards.`, '/app/challenges');
  }

  await run("UPDATE challenges SET status='finalized', finalized_at=NOW() WHERE id = ?", [c.id]);
  return { ok: true, message: 'Challenge finalized and rewards granted.' };
}
