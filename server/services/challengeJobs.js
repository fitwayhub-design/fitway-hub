import { query, get } from '../config/database.js';
import { finalizeChallengeById } from './challengeLifecycle.js';
import { createInAppNotification, sendPushFromTemplate } from '../notificationService.js';
/**
 * challengeJobs — the two recurring jobs that keep challenges self-running:
 *
 *  • autoFinalizeEndedChallenges — a challenge whose end date passed more than
 *    a grace window ago is finalized automatically (winners picked, rewards
 *    granted) so prizes never depend on someone remembering to press a button.
 *    The grace window gives coaches time to review pending evidence first.
 *
 *  • sendDailyGoalReminders — athletes in active goal-based challenges with
 *    daily goals (nutrition / habit) who haven't checked everything off get
 *    one evening nudge, in the challenge's timezone, at most once per day
 *    per user (deduped against the notifications table, so restarts are safe).
 */
const FINALIZE_GRACE_HOURS = 24;
const REMINDER_LOCAL_HOUR = 17; // 5pm in the challenge's timezone
export async function autoFinalizeEndedChallenges() {
    const rows = await query(`SELECT id, title FROM challenges
     WHERE deleted_at IS NULL
       AND status IN ('active', 'scheduled')
       AND end_at IS NOT NULL AND end_at < DATE_SUB(NOW(), INTERVAL ${FINALIZE_GRACE_HOURS} HOUR)
     ORDER BY end_at ASC LIMIT 25`);
    let finalized = 0;
    for (const c of rows) {
        try {
            const r = await finalizeChallengeById(c.id);
            if (r.ok) {
                finalized++;
                console.log(`🏁 Auto-finalized challenge #${c.id} “${c.title}”`);
            }
        }
        catch (e) {
            console.error(`Auto-finalize failed for challenge #${c.id}:`, e?.message || e);
        }
    }
    return finalized;
}
/** Hour of day (0–23) in an IANA timezone; falls back to UTC on a bad tz. */
export function localHourInTz(tz, at = new Date()) {
    try {
        return Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz || 'UTC', hour: 'numeric', hour12: false }).format(at)) % 24;
    }
    catch {
        return at.getUTCHours();
    }
}
export async function sendDailyGoalReminders() {
    // Challenges live right now that have at least one daily (check-in) goal.
    // DB status can lag the clock ('scheduled' rows go live when start_at
    // passes), so the real filter is the start/end window.
    const challenges = await query(`SELECT DISTINCT c.id, c.title, c.timezone FROM challenges c
     JOIN challenge_goals g ON g.challenge_id = c.id AND g.goal_type IN ('nutrition','habit')
     WHERE c.deleted_at IS NULL AND c.status IN ('active', 'scheduled')
       AND (c.start_at IS NULL OR c.start_at <= NOW())
       AND (c.end_at IS NULL OR c.end_at > NOW())`);
    const today = new Date().toISOString().slice(0, 10); // same date key the submit path uses
    // user_id → titles of challenges with unchecked daily goals today.
    const dueByUser = new Map();
    for (const c of challenges) {
        if (localHourInTz(c.timezone) !== REMINDER_LOCAL_HOUR)
            continue;
        const due = await query(`SELECT cp.user_id
       FROM challenge_participants cp
       JOIN challenge_goals g ON g.challenge_id = cp.challenge_id AND g.goal_type IN ('nutrition','habit')
       LEFT JOIN challenge_submissions s
         ON s.participant_id = cp.id AND s.goal_id = g.id AND s.activity_date = ?
        AND s.status <> 'rejected' AND s.deleted_at IS NULL
       WHERE cp.challenge_id = ? AND cp.status = 'active'
       GROUP BY cp.id, cp.user_id
       HAVING SUM(CASE WHEN s.id IS NULL THEN 1 ELSE 0 END) > 0`, [today, c.id]);
        for (const p of due) {
            const list = dueByUser.get(p.user_id) || [];
            list.push(c.title);
            dueByUser.set(p.user_id, list);
        }
    }
    let sent = 0;
    for (const [userId, titles] of dueByUser) {
        // At most one reminder per user per day, across all challenges.
        const already = await get(`SELECT id FROM notifications WHERE user_id = ? AND type = 'challenge_reminder' AND DATE(created_at) = CURDATE() LIMIT 1`, [userId]);
        if (already)
            continue;
        const body = titles.length === 1
            ? `Don't break your streak — check off today's goals in “${titles[0]}”.`
            : `Don't break your streak — you have unchecked daily goals in ${titles.length} challenges.`;
        try {
            await createInAppNotification(userId, 'challenge_reminder', 'Daily goals waiting ✅', body, '/app/challenges');
            sendPushFromTemplate(userId, 'challenge_reminder', { title: 'Daily goals waiting ✅', body }).catch(() => { });
            sent++;
        }
        catch (e) {
            console.error(`Daily goal reminder failed for user ${userId}:`, e?.message || e);
        }
    }
    return sent;
}
/** Register the recurring challenge jobs (called once at server start). */
export function startChallengeJobs() {
    setInterval(() => autoFinalizeEndedChallenges().catch(e => console.error('Auto-finalize error:', e)), 30 * 60 * 1000);
    setInterval(() => sendDailyGoalReminders().catch(e => console.error('Goal reminder error:', e)), 60 * 60 * 1000);
    // One pass shortly after boot so a restart never skips an overdue finalize.
    setTimeout(() => autoFinalizeEndedChallenges().catch(() => { }), 45_000);
    setTimeout(() => sendDailyGoalReminders().catch(() => { }), 90_000);
}
//# sourceMappingURL=challengeJobs.js.map