/**
 * Activity Profile Service
 * Automatically updates user profile fields based on real activity.
 *
 * Fields updated:
 *   computed_activity_level  — derived from avg steps + workout frequency
 *   avg_daily_steps          — rolling 14-day average
 *   streak_days              — consecutive days with steps logged
 *
 * Called after every steps entry and workout completion.
 */
import { run, get, query } from '../config/database.js';
function deriveActivityLevel(avgSteps, workoutsPerWeek) {
    const score = avgSteps / 1000 + workoutsPerWeek * 1.5;
    if (score >= 18)
        return 'very_active';
    if (score >= 12)
        return 'active';
    if (score >= 7)
        return 'moderate';
    if (score >= 3)
        return 'light';
    return 'sedentary';
}
async function computeStreak(userId) {
    const rows = await query(`SELECT date FROM steps_entries WHERE user_id = ? AND steps > 0 ORDER BY date DESC LIMIT 60`, [userId]);
    if (!rows.length)
        return 0;
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < rows.length; i++) {
        const expected = new Date(today);
        expected.setDate(today.getDate() - i);
        if (rows[i].date === expected.toISOString().split('T')[0]) {
            streak++;
        }
        else
            break;
    }
    return streak;
}
export async function updateUserActivityProfile(userId) {
    try {
        const avgRow = await get(`SELECT IFNULL(ROUND(AVG(steps)),0) as avg_steps
       FROM steps_entries
       WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)`, [userId]);
        const avgSteps = Number(avgRow?.avg_steps) || 0;
        // Workouts in last 30 days
        let recentWorkouts = 0;
        try {
            const wRow = await get(`SELECT COUNT(*) as cnt FROM workout_watch_history
         WHERE user_id = ? AND watched_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`, [userId]);
            recentWorkouts = Number(wRow?.cnt) || 0;
        }
        catch { } // table may not exist in all versions
        const workoutsPerWeek = recentWorkouts / 4.3;
        const streak = await computeStreak(userId);
        const computedLevel = deriveActivityLevel(avgSteps, workoutsPerWeek);
        await run(`UPDATE users SET
         computed_activity_level = ?,
         avg_daily_steps = ?,
         streak_days = ?,
         last_activity_update = NOW()
       WHERE id = ?`, [computedLevel, avgSteps, streak, userId]);
    }
    catch (err) {
        console.warn('updateUserActivityProfile error:', err.message);
    }
}
let lastSweepMs = 0;
export async function maybeSweepAllUsers() {
    const now = Date.now();
    if (now - lastSweepMs < 60 * 60 * 1000)
        return;
    lastSweepMs = now;
    try {
        const active = await query(`SELECT DISTINCT user_id FROM steps_entries WHERE date >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)`);
        for (const row of active) {
            await updateUserActivityProfile(row.user_id);
        }
    }
    catch { }
}
//# sourceMappingURL=activityProfileService.js.map