import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { get, run, query } from '../config/database.js';
const router = Router();
router.patch('/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, height, weight, gender, avatar, points, fitness_goal, activity_level, target_weight, weekly_goal, date_of_birth, onboarding_done } = req.body;
        const fields = [];
        const values = [];
        if (name !== undefined) {
            fields.push('name = ?');
            values.push(name);
        }
        if (height !== undefined) {
            fields.push('height = ?');
            values.push(height);
        }
        if (weight !== undefined) {
            fields.push('weight = ?');
            values.push(weight);
        }
        if (gender !== undefined) {
            fields.push('gender = ?');
            values.push(gender);
        }
        if (avatar !== undefined) {
            fields.push('avatar = ?');
            values.push(avatar);
        }
        if (points !== undefined) {
            fields.push('points = ?');
            values.push(points);
        }
        if (fitness_goal !== undefined) {
            fields.push('fitness_goal = ?');
            values.push(fitness_goal);
        }
        if (activity_level !== undefined) {
            fields.push('activity_level = ?');
            values.push(activity_level);
        }
        if (target_weight !== undefined) {
            fields.push('target_weight = ?');
            values.push(target_weight);
        }
        if (weekly_goal !== undefined) {
            fields.push('weekly_goal = ?');
            values.push(weekly_goal);
        }
        if (date_of_birth !== undefined) {
            fields.push('date_of_birth = ?');
            values.push(date_of_birth);
        }
        if (onboarding_done !== undefined) {
            fields.push('onboarding_done = ?');
            values.push(onboarding_done ? 1 : 0);
        }
        if (fields.length === 0)
            return res.status(400).json({ message: 'No fields to update' });
        values.push(userId);
        await run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
        const updated = await get('SELECT id, name, email, role, avatar, is_premium, coach_membership_active, points, steps, step_goal, height, weight, gender, fitness_goal, activity_level, computed_activity_level, target_weight, weekly_goal, date_of_birth, onboarding_done, avg_daily_steps, streak_days, created_at FROM users WHERE id = ?', [userId]);
        res.json({ success: true, user: updated });
    }
    catch (err) {
        res.status(500).json({ message: 'Failed to update profile' });
    }
});
/**
 * Limited "public profile" — anyone authenticated can call /public-profile/:id
 * and get back ONLY the bare minimum the May meeting agreed to expose:
 * id + name + the user's community posts. No avatar, no email, no fitness
 * data. Coaches see this version of every athlete who isn't subscribed
 * to them; other athletes always see this version.
 */
router.get('/public-profile/:id', authenticateToken, async (req, res) => {
    try {
        const target = Number(req.params.id);
        if (!Number.isFinite(target))
            return res.status(400).json({ message: 'invalid id' });
        const user = await get('SELECT id, name FROM users WHERE id = ?', [target]);
        if (!user)
            return res.status(404).json({ message: 'Not found' });
        const posts = await query(`SELECT id, content, media_url, hashtags, likes, created_at
       FROM posts WHERE user_id = ? ORDER BY id DESC LIMIT 20`, [target]);
        res.json({ user, posts });
    }
    catch {
        res.status(500).json({ message: 'Failed to load profile' });
    }
});
router.post('/points', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { points } = req.body;
        if (points === undefined)
            return res.status(400).json({ message: 'points required' });
        await run('UPDATE users SET points = ? WHERE id = ?', [points, userId]);
        const updated = await get('SELECT id, name, email, role, avatar, is_premium, coach_membership_active, points, steps, step_goal, height, weight, gender, created_at FROM users WHERE id = ?', [userId]);
        return res.json({ success: true, user: updated });
    }
    catch (err) {
        return res.status(500).json({ message: 'Could not update points' });
    }
});
// User/Coach: save GPS location
router.patch('/location', authenticateToken, async (req, res) => {
    try {
        const { latitude, longitude, city, country } = req.body;
        if (latitude == null || longitude == null)
            return res.status(400).json({ message: 'latitude and longitude required' });
        await run('UPDATE users SET latitude=?, longitude=?, city=?, country=?, location_updated_at=NOW() WHERE id=?', [parseFloat(latitude), parseFloat(longitude), city || null, country || null, req.user.id]);
        res.json({ success: true });
    }
    catch {
        res.status(500).json({ message: 'Failed to save location' });
    }
});
// User: set own step goal (only if no active coach)
router.patch('/step-goal', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { step_goal } = req.body;
        if (!step_goal || step_goal < 100)
            return res.status(400).json({ message: 'Invalid step goal' });
        const bookings = await query('SELECT id FROM coaching_bookings WHERE user_id = ? AND status = ? LIMIT 1', [userId, 'accepted']);
        if (bookings.length > 0)
            return res.status(403).json({ message: 'Your step goal is set by your coach' });
        await run('UPDATE users SET step_goal = ? WHERE id = ?', [step_goal, userId]);
        res.json({ success: true, step_goal });
    }
    catch {
        res.status(500).json({ message: 'Failed to update step goal' });
    }
});
// ── Upload proof image ─────────────────────────────────────────────────────────
import { upload, optimizeImage, uploadToR2 } from '../middleware/upload.js';
router.post('/upload-proof', authenticateToken, upload.single('image'), optimizeImage(), async (req, res) => {
    try {
        if (!req.file)
            return res.status(400).json({ message: 'No file uploaded' });
        res.json({ url: await uploadToR2(req.file, 'images') });
    }
    catch {
        res.status(500).json({ message: 'Upload failed' });
    }
});
// ── Point transactions history ─────────────────────────────────────────────────
router.get('/points/history', authenticateToken, async (req, res) => {
    try {
        const transactions = await query('SELECT * FROM point_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [req.user.id]);
        res.json({ transactions });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch point history' });
    }
});
// Medical history
router.get('/medical-history', authenticateToken, async (req, res) => {
    try {
        const user = await get('SELECT medical_history, medical_file_url FROM users WHERE id = ?', [req.user.id]);
        res.json({ medical_history: user?.medical_history || '', medical_file_url: user?.medical_file_url || null });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch medical history' });
    }
});
router.post('/medical-history', authenticateToken, upload.single('medical'), optimizeImage(), async (req, res) => {
    try {
        const { medical_history } = req.body;
        const fileUrl = req.file ? await uploadToR2(req.file, 'medical') : null;
        if (fileUrl) {
            await run('UPDATE users SET medical_history = ?, medical_file_url = ? WHERE id = ?', [medical_history || '', fileUrl, req.user.id]);
            res.json({ message: 'Saved', file_url: fileUrl });
        }
        else {
            await run('UPDATE users SET medical_history = ? WHERE id = ?', [medical_history || '', req.user.id]);
            res.json({ message: 'Saved' });
        }
    }
    catch {
        res.status(500).json({ message: 'Failed to save medical history' });
    }
});
// ── Progress photos (before/now) ───────────────────────────────────────────────
router.get('/progress-photos', authenticateToken, async (req, res) => {
    try {
        const row = await get('SELECT before_photo, now_photo FROM user_progress_photos WHERE user_id = ?', [req.user.id]);
        res.json({ before: row?.before_photo || null, now: row?.now_photo || null });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch progress photos' });
    }
});
router.post('/progress-photos', authenticateToken, upload.single('photo'), optimizeImage(), async (req, res) => {
    try {
        const { type } = req.body;
        if (!type || !['before', 'now'].includes(type))
            return res.status(400).json({ message: 'type must be "before" or "now"' });
        if (!req.file)
            return res.status(400).json({ message: 'No file uploaded' });
        const url = await uploadToR2(req.file, 'progress');
        const col = type === 'before' ? 'before_photo' : 'now_photo';
        const existing = await get('SELECT id FROM user_progress_photos WHERE user_id = ?', [req.user.id]);
        if (existing) {
            await run(`UPDATE user_progress_photos SET ${col} = ?, updated_at = NOW() WHERE user_id = ?`, [url, req.user.id]);
        }
        else {
            await run(`INSERT INTO user_progress_photos (user_id, ${col}, created_at, updated_at) VALUES (?, ?, NOW(), NOW())`, [req.user.id, url]);
        }
        res.json({ url });
    }
    catch {
        res.status(500).json({ message: 'Failed to upload progress photo' });
    }
});
// ── Per-account preferences (key/value, scoped to the logged-in user) ────────
// Used for things like an admin's customized upper menu bar so the choice
// follows the account across devices instead of living in localStorage.
const PREF_KEY_RE = /^[a-z0-9_]{1,80}$/i;
router.get('/preferences/:key', authenticateToken, async (req, res) => {
    try {
        const key = String(req.params.key || '');
        if (!PREF_KEY_RE.test(key))
            return res.status(400).json({ message: 'Invalid preference key' });
        const row = await get('SELECT pref_value FROM user_preferences WHERE user_id = ? AND pref_key = ?', [req.user.id, key]);
        let value = null;
        if (row?.pref_value != null) {
            try {
                value = JSON.parse(row.pref_value);
            }
            catch {
                value = row.pref_value;
            }
        }
        res.json({ value });
    }
    catch {
        res.status(500).json({ message: 'Failed to load preference' });
    }
});
router.put('/preferences/:key', authenticateToken, async (req, res) => {
    try {
        const key = String(req.params.key || '');
        if (!PREF_KEY_RE.test(key))
            return res.status(400).json({ message: 'Invalid preference key' });
        const value = JSON.stringify(req.body?.value ?? null);
        await run(`INSERT INTO user_preferences (user_id, pref_key, pref_value) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE pref_value = VALUES(pref_value)`, [req.user.id, key, value]);
        res.json({ ok: true });
    }
    catch {
        res.status(500).json({ message: 'Failed to save preference' });
    }
});
export default router;
//# sourceMappingURL=userRoutes.js.map