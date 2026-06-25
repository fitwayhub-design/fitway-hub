import { Request, Response } from 'express';
import { get, query } from '../config/database.js';

export const getMyAnalytics = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const days = Math.min(365, Math.max(7, parseInt(String(req.query.days || '30'))));

    const totalStepsRow: any = await get('SELECT IFNULL(SUM(steps),0) as totalSteps FROM steps_entries WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)', [userId, days]);
    const totalSteps = totalStepsRow?.totalSteps || 0;

    const distRow: any = await get('SELECT IFNULL(SUM(distance_km),0) as dist FROM steps_entries WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)', [userId, days]);
    const premiumDistRow: any = await get('SELECT IFNULL(SUM(total_distance_km),0) as dist FROM premium_sessions WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)', [userId, days]);
    const totalDistance = Number((distRow?.dist || 0)) + Number((premiumDistRow?.dist || 0));

    const calRow: any = await get('SELECT IFNULL(SUM(calories_burned),0) as cal FROM steps_entries WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)', [userId, days]);
    const premiumCalRow: any = await get('SELECT IFNULL(SUM(calories),0) as cal FROM premium_sessions WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)', [userId, days]);
    const totalCalories = Number((calRow?.cal || 0)) + Number((premiumCalRow?.cal || 0));

    const sessionsCountRow: any = await get('SELECT COUNT(*) as cnt FROM premium_sessions WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)', [userId, days]);
    const sessionsCount = sessionsCountRow?.cnt || 0;
    const recentSessions = await query('SELECT id, start_time, end_time, total_steps, total_distance_km, calories, path_json, created_at FROM premium_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 10', [userId]);

    // Broaden beyond steps (§3.10) using data the athlete actually logs:
    //  • activeDays  — distinct days with steps in the period (period-accurate
    //    consistency, vs the client's old 7-day-only estimate).
    //  • currentStreak — consecutive days up to today (or yesterday, so an
    //    as-yet-unlogged today doesn't break the streak) that have steps.
    //  • workoutsCompleted — coach-plan workouts the athlete marked finished,
    //    from training_events (a real "I trained" signal, not just steps).
    const activeDaysRow: any = await get('SELECT COUNT(DISTINCT date) as cnt FROM steps_entries WHERE user_id = ? AND steps > 0 AND date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)', [userId, days]);
    const activeDays = activeDaysRow?.cnt || 0;

    const workoutsRow: any = await get("SELECT COUNT(*) as cnt FROM training_events WHERE user_id = ? AND event_type = 'workout_finished' AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)", [userId, days]);
    const workoutsCompleted = workoutsRow?.cnt || 0;

    const streakRows: any[] = await query("SELECT DISTINCT date FROM steps_entries WHERE user_id = ? AND steps > 0 AND date >= DATE_SUB(CURDATE(), INTERVAL 120 DAY) ORDER BY date DESC", [userId]);
    const loggedDates = new Set(streakRows.map((r: any) => String(r.date).slice(0, 10)));
    const fmtDay = (d: Date) => d.toISOString().split('T')[0];
    let currentStreak = 0;
    const cursor = new Date();
    // If today isn't logged yet, start from yesterday so an in-progress day
    // doesn't reset the streak to 0.
    if (!loggedDates.has(fmtDay(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (loggedDates.has(fmtDay(cursor))) { currentStreak++; cursor.setDate(cursor.getDate() - 1); }

    // Weekly chart: last 7 days always for the bar chart, period applies to totals
    const weeklyRows = await query("SELECT date, steps, IFNULL(calories_burned,0) as calories FROM steps_entries WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) ORDER BY date ASC", [userId]);

    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const weeklyMap: Record<string, any> = {};
    weeklyRows.forEach((r: any) => { weeklyMap[r.date] = r; });
    const weekly = Array.from({length: 7}).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = dayNames[d.getDay()];
      return weeklyMap[dateStr] ? { day: dayLabel, steps: weeklyMap[dateStr].steps, calories: weeklyMap[dateStr].calories } : { day: dayLabel, steps: 0, calories: 0 };
    });

    res.json({ totalSteps, totalDistance, totalCalories, sessionsCount, recentSessions, weekly, days, activeDays, currentStreak, workoutsCompleted });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
