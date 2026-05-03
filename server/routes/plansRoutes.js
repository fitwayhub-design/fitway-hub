import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { uploadVideo, uploadToR2 } from '../middleware/upload.js';
import { get, query, run } from '../config/database.js';
const router = Router();
// ── Workout Plans ──────────────────────────────────────────────────────────
// Get all self-created workout plan entries for the user
router.get('/workouts', authenticateToken, async (req, res) => {
    try {
        const plans = await query('SELECT * FROM user_workout_plans WHERE user_id = ? ORDER BY day_of_week ASC, created_at DESC', [req.user.id]);
        res.json({ plans });
    }
    catch (err) {
        res.status(500).json({ message: 'Failed to fetch workout plans' });
    }
});
// Insert a workout plan entry
router.post('/workouts', authenticateToken, uploadVideo.single('video'), async (req, res) => {
    try {
        const { day_of_week, workout_type, time_minutes, notes } = req.body;
        if (!day_of_week || !workout_type) {
            return res.status(400).json({ message: 'Day and workout type are required' });
        }
        const videoUrl = req.file ? await uploadToR2(req.file, 'plans') : null;
        const result = await run(`INSERT INTO user_workout_plans (user_id, day_of_week, workout_type, video_url, time_minutes, notes)
       VALUES (?, ?, ?, ?, ?, ?)`, [req.user.id, day_of_week, workout_type, videoUrl, parseInt(time_minutes) || 0, notes || null]);
        const plan = await get('SELECT * FROM user_workout_plans WHERE id = ?', [result.insertId]);
        res.json({ plan });
    }
    catch (err) {
        res.status(500).json({ message: 'Failed to create workout plan' });
    }
});
// Delete a workout plan entry
router.delete('/workouts/:id', authenticateToken, async (req, res) => {
    try {
        await run('DELETE FROM user_workout_plans WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        res.json({ message: 'Deleted' });
    }
    catch (err) {
        res.status(500).json({ message: 'Failed to delete' });
    }
});
// ── Nutrition Plans ────────────────────────────────────────────────────────
// Get all self-created nutrition plan entries for the user
router.get('/nutrition', authenticateToken, async (req, res) => {
    try {
        const plans = await query('SELECT * FROM user_nutrition_plans WHERE user_id = ? ORDER BY day_of_week ASC, meal_time ASC, created_at DESC', [req.user.id]);
        res.json({ plans });
    }
    catch (err) {
        res.status(500).json({ message: 'Failed to fetch nutrition plans' });
    }
});
// Insert a nutrition plan entry
router.post('/nutrition', authenticateToken, async (req, res) => {
    try {
        const { day_of_week, meal_time, meal_type, meal_name, contents, calories } = req.body;
        if (!day_of_week || !meal_time || !meal_name) {
            return res.status(400).json({ message: 'Day, meal time, and meal name are required' });
        }
        const result = await run(`INSERT INTO user_nutrition_plans (user_id, day_of_week, meal_time, meal_type, meal_name, contents, calories)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [req.user.id, day_of_week, meal_time, meal_type || null, meal_name, contents || null, parseInt(calories) || 0]);
        const plan = await get('SELECT * FROM user_nutrition_plans WHERE id = ?', [result.insertId]);
        res.json({ plan });
    }
    catch (err) {
        res.status(500).json({ message: 'Failed to create nutrition plan' });
    }
});
// Delete a nutrition plan entry
router.delete('/nutrition/:id', authenticateToken, async (req, res) => {
    try {
        await run('DELETE FROM user_nutrition_plans WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        res.json({ message: 'Deleted' });
    }
    catch (err) {
        res.status(500).json({ message: 'Failed to delete' });
    }
});
// ── Coach-assigned plans (read-only for users) ────────────────────────────────
router.get('/coach-workout-plan', authenticateToken, async (req, res) => {
    try {
        const plan = await get(`SELECT wp.*, u.name AS coach_name FROM workout_plans wp
       LEFT JOIN users u ON u.id = wp.coach_id
       WHERE wp.user_id = ? ORDER BY wp.created_at DESC LIMIT 1`, [req.user.id]);
        if (!plan)
            return res.json({ plan: null });
        res.json({ plan });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch coach workout plan' });
    }
});
router.get('/coach-nutrition-plan', authenticateToken, async (req, res) => {
    try {
        const plan = await get(`SELECT np.*, u.name AS coach_name FROM nutrition_plans np
       LEFT JOIN users u ON u.id = np.coach_id
       WHERE np.user_id = ? ORDER BY np.created_at DESC LIMIT 1`, [req.user.id]);
        if (!plan)
            return res.json({ plan: null });
        res.json({ plan });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch coach nutrition plan' });
    }
});
export default router;
//# sourceMappingURL=plansRoutes.js.map