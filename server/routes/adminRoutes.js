import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { get, run, query, getPool, seedDefaultAppSettings } from '../config/database.js';
import { uploadVideo, uploadFont, upload, uploadBranding, optimizeImage, validateVideoSize, verifyUploadBytes, uploadToR2, multerToJson, sanitiseSvgIfPresent } from '../middleware/upload.js';
import { sendPushToUser } from '../notificationService.js';
import { requireModeratorArea, getModeratorPermissions, logModeratorAction } from '../middleware/moderator.js';
import bcrypt from 'bcryptjs';
const router = Router();
const adminOnly = (req, res, next) => {
    if (req.user?.role !== 'admin')
        return res.status(403).json({ message: 'Admin access required' });
    next();
};
// ── Bootstrap: force-set an account to admin role ────────────────────────────
// Used once when the admin account exists but has wrong role.
// Protected by ADMIN_BOOTSTRAP_SECRET env var (not JWT).
router.post('/bootstrap-admin', async (req, res) => {
    try {
        const secret = process.env.ADMIN_BOOTSTRAP_SECRET;
        if (!secret)
            return res.status(503).json({ message: 'Bootstrap not enabled. Set ADMIN_BOOTSTRAP_SECRET in .env' });
        if (req.body?.secret !== secret)
            return res.status(403).json({ message: 'Invalid bootstrap secret' });
        const email = (req.body?.email || '').trim().toLowerCase();
        if (!email)
            return res.status(400).json({ message: 'email required' });
        const user = await get('SELECT id, email, role FROM users WHERE email = ?', [email]);
        if (!user)
            return res.status(404).json({ message: 'User not found' });
        await run('UPDATE users SET role = ?, membership_paid = 1 WHERE id = ?', ['admin', user.id]);
        res.json({ message: `✅ ${email} is now admin`, previous_role: user.role });
    }
    catch (e) {
        res.status(500).json({ message: e.message });
    }
});
// ── Recent activity feed (admin dashboard) ──────────────────────────────────
// Aggregates the latest events across the app (sign-ups, posts, comments,
// tickets, challenges, training, payments) into one reverse-chronological list.
// Each source is wrapped in try/catch so a missing table degrades gracefully
// instead of failing the whole feed.
router.get('/recent-activity', authenticateToken, adminOnly, async (_req, res) => {
    const safe = async (sql, map) => {
        try {
            const rows = await query(sql);
            return rows.map(map);
        }
        catch {
            return [];
        }
    };
    try {
        const [signups, posts, comments, tickets, challenges, training, payments] = await Promise.all([
            safe("SELECT id, name, role, created_at FROM users ORDER BY id DESC LIMIT 20", r => ({ type: 'signup', title: `${r.name || 'New user'} joined${r.role && r.role !== 'user' ? ` as ${r.role}` : ''}`, created_at: r.created_at })),
            safe("SELECT p.id, p.content, u.name, p.created_at FROM posts p LEFT JOIN users u ON u.id = p.user_id ORDER BY p.id DESC LIMIT 20", r => ({ type: 'post', title: `${r.name || 'Someone'} posted in the community`, detail: r.content, created_at: r.created_at })),
            safe("SELECT pc.id, pc.content, u.name, pc.created_at FROM post_comments pc LEFT JOIN users u ON u.id = pc.user_id ORDER BY pc.id DESC LIMIT 20", r => ({ type: 'comment', title: `${r.name || 'Someone'} commented on a post`, detail: r.content, created_at: r.created_at })),
            safe("SELECT t.id, t.subject, u.name, t.created_at FROM tickets t LEFT JOIN users u ON u.id = t.user_id ORDER BY t.id DESC LIMIT 20", r => ({ type: 'ticket', title: `${r.name || 'Someone'} opened a support ticket`, detail: r.subject, created_at: r.created_at })),
            safe("SELECT c.id, c.title, u.name, c.created_at FROM challenges c LEFT JOIN users u ON u.id = c.creator_id ORDER BY c.id DESC LIMIT 20", r => ({ type: 'challenge', title: `${r.name || 'Someone'} created a challenge`, detail: r.title, created_at: r.created_at })),
            safe("SELECT e.id, e.event_type, u.name, e.created_at FROM training_events e LEFT JOIN users u ON u.id = e.user_id ORDER BY e.id DESC LIMIT 20", r => ({ type: 'training', title: `${r.name || 'Athlete'} — ${String(r.event_type || 'training update').replace(/_/g, ' ')}`, created_at: r.created_at })),
            safe("SELECT pm.id, pm.amount, pm.status, u.name, pm.created_at FROM payments pm LEFT JOIN users u ON u.id = pm.user_id ORDER BY pm.id DESC LIMIT 20", r => ({ type: 'payment', title: `${r.name || 'Someone'} — payment ${Number(r.amount) || 0} EGP (${r.status || 'pending'})`, created_at: r.created_at })),
        ]);
        const all = [...signups, ...posts, ...comments, ...tickets, ...challenges, ...training, ...payments]
            .filter(a => a.created_at)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 50);
        res.json({ activities: all });
    }
    catch {
        res.status(500).json({ message: 'Failed to load activity' });
    }
});
// ── Users ──────────────────────────────────────────────────────────────────────
router.get('/users', authenticateToken, adminOnly, async (_req, res) => {
    try {
        // LEFT JOIN coach_profiles so the admin edit modal has the coach-specific
        // fields ready without a second round-trip. Athletes and admins just get
        // NULLs in the coach_* columns.
        const users = await query(`
      SELECT u.id, u.name, u.email, u.role, u.avatar, u.is_premium,
             u.points, u.steps, u.step_goal, u.gender,
             u.membership_paid, u.coach_membership_active, u.created_at,
             cp.specialty AS coach_specialty,
             cp.bio       AS coach_bio,
             cp.location  AS coach_location,
             cp.available AS coach_available,
             cp.certified AS coach_certified
      FROM users u
      LEFT JOIN coach_profiles cp ON cp.user_id = u.id
      ORDER BY u.created_at DESC
    `);
        res.json({ users });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch users' });
    }
});
router.patch('/users/:id/role', authenticateToken, adminOnly, async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    if (!['user', 'coach', 'admin', 'moderator'].includes(role))
        return res.status(400).json({ message: 'Invalid role' });
    await run('UPDATE users SET role = ? WHERE id = ?', [role, id]);
    res.json({ message: 'Role updated' });
});
router.delete('/users/:id', authenticateToken, adminOnly, async (req, res) => {
    const userId = Number(req.params.id);
    if (!userId || userId <= 0)
        return res.status(400).json({ message: 'Invalid user ID' });
    try {
        await run('SET FOREIGN_KEY_CHECKS = 0');
        try {
            const cleanupTables = [
                'DELETE FROM post_likes WHERE user_id = ?',
                'DELETE FROM post_comments WHERE user_id = ?',
                'DELETE FROM posts WHERE user_id = ?',
                'DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?',
                'DELETE FROM coach_subscriptions WHERE user_id = ? OR coach_id = ?',
                'DELETE FROM daily_summaries WHERE user_id = ?',
                'DELETE FROM steps_entries WHERE user_id = ?',
                'DELETE FROM payments WHERE user_id = ?',
                'DELETE FROM gifts WHERE user_id = ?',
                'DELETE FROM user_follows WHERE follower_id = ? OR following_id = ?',
                'DELETE FROM challenge_participants WHERE user_id = ?',
                'DELETE FROM chat_requests WHERE sender_id = ? OR receiver_id = ?',
                'DELETE FROM workout_plans WHERE user_id = ? OR coach_id = ?',
                'DELETE FROM nutrition_plans WHERE user_id = ? OR coach_id = ?',
                'DELETE FROM notifications WHERE user_id = ?',
                'DELETE FROM credit_transactions WHERE user_id = ?',
                'DELETE FROM premium_sessions WHERE user_id = ?',
                'DELETE FROM coaching_meetings WHERE user_id = ? OR coach_id = ?',
                'DELETE FROM withdrawal_requests WHERE coach_id = ?',
                'DELETE FROM push_tokens WHERE user_id = ?',
                'DELETE FROM push_log WHERE user_id = ?',
                'DELETE FROM coach_ads WHERE coach_id = ?',
                'DELETE FROM point_transactions WHERE user_id = ?',
                'DELETE FROM coach_reviews WHERE user_id = ? OR coach_id = ?',
                'DELETE FROM coach_reports WHERE user_id = ? OR coach_id = ?',
                'DELETE FROM coaching_bookings WHERE user_id = ? OR coach_id = ?',
                'DELETE FROM user_workout_plans WHERE user_id = ?',
                'DELETE FROM user_nutrition_plans WHERE user_id = ?',
                'DELETE FROM ad_payments WHERE coach_id = ?',
                'DELETE FROM coach_follows WHERE follower_id = ? OR coach_id = ?',
                'DELETE FROM user_progress_photos WHERE user_id = ?',
                'DELETE FROM certification_requests WHERE coach_id = ?',
                'DELETE FROM meeting_files WHERE uploaded_by = ?',
                'DELETE FROM meeting_messages WHERE sender_id = ?',
                'DELETE FROM paymob_transactions WHERE user_id = ?',
                'DELETE FROM coach_profiles WHERE user_id = ?',
            ];
            for (const sql of cleanupTables) {
                try {
                    const paramCount = (sql.match(/\?/g) || []).length;
                    await run(sql, paramCount === 2 ? [userId, userId] : [userId]);
                }
                catch { }
            }
            const result = await run('DELETE FROM users WHERE id = ?', [userId]);
            if (!result?.affectedRows) {
                return res.status(404).json({ message: 'User not found' });
            }
        }
        finally {
            await run('SET FOREIGN_KEY_CHECKS = 1');
        }
        res.json({ message: 'User deleted' });
    }
    catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ message: 'Failed to delete user' });
    }
});
router.post('/users/:id/add-points', authenticateToken, adminOnly, async (req, res) => {
    const { id } = req.params;
    const { points } = req.body;
    await run('UPDATE users SET points = points + ? WHERE id = ?', [points || 0, id]);
    res.json({ message: 'Points added' });
});
// NOTE: the admin "upload medical file for user" route was removed — admins
// must not handle users' private medical data (§5.3). Medical files belong to
// the user's own profile within the coaching relationship only.
router.put('/users/:id', authenticateToken, adminOnly, async (req, res) => {
    try {
        const oldId = Number(req.params.id);
        if (!oldId)
            return res.status(400).json({ message: 'Invalid user id' });
        const existing = await get('SELECT * FROM users WHERE id = ?', [oldId]);
        if (!existing)
            return res.status(404).json({ message: 'User not found' });
        const body = req.body || {};
        // User ID is the primary key and is no longer editable from admin — the
        // PK-reassignment path was removed for data integrity and to match the
        // read-only ID field in the editor (§5.3). Always keep the existing id;
        // any body.id is ignored.
        const nextId = oldId;
        const role = body.role ?? existing.role;
        if (!['user', 'coach', 'admin', 'moderator'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role' });
        }
        const email = String(body.email ?? existing.email).trim().toLowerCase();
        if (!email)
            return res.status(400).json({ message: 'Email is required' });
        const emailConflict = await get('SELECT id FROM users WHERE email = ? AND id != ?', [email, oldId]);
        if (emailConflict)
            return res.status(409).json({ message: 'Email is already used by another account' });
        let nextPassword = existing.password;
        if (body.password !== undefined && String(body.password).trim() !== '') {
            const plain = String(body.password);
            if (plain.length < 6)
                return res.status(400).json({ message: 'Password must be at least 6 characters' });
            nextPassword = await bcrypt.hash(plain, 10);
        }
        const computedIsPremium = Number(existing.is_premium || 0);
        await run(`UPDATE users SET
        id = ?,
        name = ?,
        email = ?,
        password = ?,
        role = ?,
        avatar = ?,
        is_premium = ?,
        points = ?,
        steps = ?,
        gender = ?,
        membership_paid = ?,
        coach_membership_active = ?,
        step_goal = ?,
        updated_at = NOW()
      WHERE id = ?`, [
            nextId,
            String(body.name ?? existing.name ?? '').trim(),
            email,
            nextPassword,
            role,
            String(body.avatar ?? existing.avatar ?? '').trim(),
            computedIsPremium,
            body.points !== undefined ? Number(body.points || 0) : Number(existing.points || 0),
            body.steps !== undefined ? Number(body.steps || 0) : Number(existing.steps || 0),
            body.gender !== undefined ? String(body.gender || '').trim() : (existing.gender ?? null),
            // height/weight/medical_history/medical_file_url are intentionally not
            // updated here — private health data is never edited from admin (§5.3).
            body.membership_paid !== undefined ? (body.membership_paid ? 1 : 0) : Number(existing.membership_paid || 0),
            body.coach_membership_active !== undefined ? (body.coach_membership_active ? 1 : 0) : Number(existing.coach_membership_active || 0),
            body.step_goal !== undefined && body.step_goal !== '' ? Number(body.step_goal) : Number(existing.step_goal || 10000),
            oldId,
        ]);
        // If this account is (or just became) a coach, upsert their coach_profile
        // so admins can edit specialty/bio/location/pricing/availability inline.
        // Only fields that were sent on the body get written; the rest stay put.
        // Subscription pricing isn't per-coach — it's global package pricing set
        // in app_settings — so the coach_profiles price columns aren't editable
        // from here. We just sync the descriptive profile fields the admin needs.
        if (role === 'coach') {
            const profileFields = {};
            if (body.coach_specialty !== undefined)
                profileFields.specialty = String(body.coach_specialty || '').trim();
            if (body.coach_bio !== undefined)
                profileFields.bio = String(body.coach_bio || '').trim();
            if (body.coach_location !== undefined)
                profileFields.location = String(body.coach_location || '').trim();
            if (body.coach_available !== undefined)
                profileFields.available = body.coach_available ? 1 : 0;
            if (Object.keys(profileFields).length > 0) {
                const existingProfile = await get('SELECT id FROM coach_profiles WHERE user_id = ?', [nextId]).catch(() => null);
                if (existingProfile) {
                    const setSql = Object.keys(profileFields).map(k => `${k} = ?`).join(', ');
                    await run(`UPDATE coach_profiles SET ${setSql} WHERE user_id = ?`, [...Object.values(profileFields), nextId]);
                }
                else {
                    const cols = ['user_id', ...Object.keys(profileFields)];
                    const placeholders = cols.map(() => '?').join(', ');
                    await run(`INSERT INTO coach_profiles (${cols.join(', ')}) VALUES (${placeholders})`, [nextId, ...Object.values(profileFields)]);
                }
            }
        }
        const updated = await get(`SELECT u.id, u.name, u.email, u.role, u.avatar, u.is_premium,
              u.points, u.steps, u.step_goal, u.gender,
              u.membership_paid,
              u.coach_membership_active, u.created_at,
              cp.specialty AS coach_specialty, cp.bio AS coach_bio,
              cp.location AS coach_location, cp.available AS coach_available,
              cp.certified AS coach_certified
       FROM users u LEFT JOIN coach_profiles cp ON cp.user_id = u.id
       WHERE u.id = ?`, [nextId]);
        res.json({ message: 'User updated', user: updated });
    }
    catch {
        res.status(500).json({ message: 'Failed to update user' });
    }
});
// ── Gifts ──────────────────────────────────────────────────────────────────────
router.post('/gifts', authenticateToken, adminOnly, async (req, res) => {
    const { user_id, title, description, type, value } = req.body;
    const { insertId } = await run('INSERT INTO gifts (user_id, admin_id, title, description, type, value) VALUES (?, ?, ?, ?, ?, ?)', [user_id, req.user.id, title, description, type, value]);
    if (type === 'points' && value)
        await run('UPDATE users SET points = points + ? WHERE id = ?', [value, user_id]);
    res.json({ gift: { id: insertId, user_id, title, type, value } });
});
router.get('/gifts', authenticateToken, adminOnly, async (_req, res) => {
    try {
        const gifts = await query(`SELECT g.*, u.name as user_name, u.email as user_email FROM gifts g LEFT JOIN users u ON g.user_id = u.id ORDER BY g.created_at DESC`);
        res.json({ gifts });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch gifts' });
    }
});
// ── Trainings ──────────────────────────────────────────────────────────────────
// Trainings are admin-curated buckets that own a set of short + long workout
// videos. The athlete-facing layout is "browse a training → watch its videos",
// mirroring how App Images groups by category.
router.get('/trainings', authenticateToken, adminOnly, async (_req, res) => {
    try {
        const trainings = await query(`SELECT t.*,
              COALESCE(SUM(CASE WHEN wv.is_short = 1 THEN 1 ELSE 0 END), 0) AS short_count,
              COALESCE(SUM(CASE WHEN wv.is_short = 0 OR wv.is_short IS NULL THEN 1 ELSE 0 END), 0) AS long_count
       FROM trainings t
       LEFT JOIN workout_videos wv ON wv.training_id = t.id
       GROUP BY t.id
       ORDER BY t.sort_order ASC, t.created_at DESC`);
        res.json({ trainings });
    }
    catch (err) {
        console.error('List trainings error:', err);
        res.status(500).json({ message: 'Failed to fetch trainings' });
    }
});
router.post('/trainings', authenticateToken, adminOnly, async (req, res) => {
    try {
        const { title, description, cover_image, sort_order } = req.body || {};
        if (!title || !String(title).trim())
            return res.status(400).json({ message: 'Title is required' });
        const { insertId } = await run('INSERT INTO trainings (title, description, cover_image, sort_order) VALUES (?,?,?,?)', [String(title).trim(), description || '', cover_image || null, Number(sort_order) || 0]);
        const training = await get('SELECT * FROM trainings WHERE id = ?', [insertId]);
        res.json({ training });
    }
    catch (err) {
        console.error('Create training error:', err);
        res.status(500).json({ message: 'Failed to create training' });
    }
});
router.patch('/trainings/:id', authenticateToken, adminOnly, async (req, res) => {
    try {
        const existing = await get('SELECT * FROM trainings WHERE id = ?', [req.params.id]);
        if (!existing)
            return res.status(404).json({ message: 'Training not found' });
        const { title, description, cover_image, sort_order } = req.body || {};
        await run('UPDATE trainings SET title=?, description=?, cover_image=?, sort_order=?, updated_at=NOW() WHERE id=?', [
            title !== undefined ? String(title).trim() || existing.title : existing.title,
            description !== undefined ? (description || '') : existing.description,
            cover_image !== undefined ? (cover_image || null) : existing.cover_image,
            sort_order !== undefined ? (Number(sort_order) || 0) : existing.sort_order,
            req.params.id,
        ]);
        const training = await get('SELECT * FROM trainings WHERE id = ?', [req.params.id]);
        res.json({ training });
    }
    catch (err) {
        console.error('Update training error:', err);
        res.status(500).json({ message: 'Failed to update training' });
    }
});
router.delete('/trainings/:id', authenticateToken, adminOnly, async (req, res) => {
    try {
        // Detach any videos that belonged to this training so they aren't lost.
        await run('UPDATE workout_videos SET training_id = NULL WHERE training_id = ?', [req.params.id]);
        await run('DELETE FROM trainings WHERE id = ?', [req.params.id]);
        res.json({ message: 'Training deleted' });
    }
    catch (err) {
        console.error('Delete training error:', err);
        res.status(500).json({ message: 'Failed to delete training' });
    }
});
router.get('/trainings/:id/videos', authenticateToken, adminOnly, async (req, res) => {
    try {
        const videos = await query(`SELECT wv.* FROM workout_videos wv
       WHERE wv.training_id = ?
       ORDER BY wv.is_short DESC, wv.created_at DESC`, [req.params.id]);
        res.json({ videos });
    }
    catch (err) {
        res.status(500).json({ message: 'Failed to fetch training videos' });
    }
});
// Upload a video file straight into a training. Slim version of POST /videos —
// the training owns category/grouping so we only ask for what the admin must
// pick per-video: title, short/long, optional thumbnail. Duration is probed
// client-side from the video file and posted as `duration_seconds` + the
// formatted `duration` label, so admins don't have to type it.
router.post('/trainings/:id/videos', authenticateToken, adminOnly, uploadVideo.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
]), validateVideoSize, optimizeImage(), async (req, res) => {
    try {
        const training = await get('SELECT * FROM trainings WHERE id = ?', [req.params.id]);
        if (!training)
            return res.status(404).json({ message: 'Training not found' });
        const { title, description, duration, duration_seconds, is_premium } = req.body;
        if (!title)
            return res.status(400).json({ message: 'Title is required' });
        const isShort = req.body.is_short === '1' || req.body.is_short === true ? 1 : 0;
        const files = req.files;
        const videoFile = files?.video?.[0];
        const thumbnailFile = files?.thumbnail?.[0];
        if (!videoFile)
            return res.status(400).json({ message: 'Video file is required' });
        const videoUrl = await uploadToR2(videoFile, 'videos');
        const thumbnailUrl = thumbnailFile ? await uploadToR2(thumbnailFile, 'thumbnails') : null;
        // Trust the client-probed seconds when present; fall back to 0 otherwise.
        const durationSeconds = parseInt(duration_seconds || '0', 10) || 0;
        const durationLabel = duration || (durationSeconds > 0
            ? `${Math.floor(durationSeconds / 60)}:${String(durationSeconds % 60).padStart(2, '0')}`
            : '');
        const { insertId } = await run(`INSERT INTO workout_videos
       (title, description, url, duration, duration_seconds, category, is_premium, thumbnail, is_short, source_type, approval_status, submitted_by, approved_by, approved_at, training_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
            title, description || '', videoUrl, durationLabel, durationSeconds,
            training.title, is_premium === '1' || is_premium === true ? 1 : 0,
            thumbnailUrl || '', isShort, 'upload', 'approved',
            req.user.id, req.user.id, new Date(), training.id,
        ]);
        const video = await get('SELECT * FROM workout_videos WHERE id = ?', [insertId]);
        res.json({ video, message: 'Video uploaded' });
    }
    catch (err) {
        console.error('Training video upload error:', err);
        res.status(500).json({ message: 'Failed to upload video' });
    }
});
// ── Videos ─────────────────────────────────────────────────────────────────────
router.get('/videos', authenticateToken, adminOnly, async (_req, res) => {
    try {
        const videos = await query(`SELECT wv.*, submitter.name AS submitted_by_name, approver.name AS approved_by_name
       FROM workout_videos wv
       LEFT JOIN users submitter ON submitter.id = wv.submitted_by
       LEFT JOIN users approver ON approver.id = wv.approved_by
       ORDER BY wv.created_at DESC`);
        res.json({ videos });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch videos' });
    }
});
// Upload video file. Admin-only; client probes the file with a hidden <video>
// element and posts the real `duration_seconds`, plus the `training_id` that
// the video belongs to (workout videos are organised under trainings).
router.post('/videos', authenticateToken, adminOnly, uploadVideo.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
]), validateVideoSize, optimizeImage(), async (req, res) => {
    try {
        const { title, description, duration, duration_seconds, category, is_premium, goal, body_area, equipment, level } = req.body;
        if (!title)
            return res.status(400).json({ message: 'Title is required' });
        const isShort = req.body.is_short === '1' || req.body.is_short === true ? 1 : 0;
        const files = req.files;
        const videoFile = files?.video?.[0];
        const thumbnailFile = files?.thumbnail?.[0];
        if (!videoFile)
            return res.status(400).json({ message: 'Video file is required' });
        const videoUrl = await uploadToR2(videoFile, 'videos');
        const thumbnailUrl = thumbnailFile ? await uploadToR2(thumbnailFile, 'thumbnails') : null;
        const durationSeconds = parseInt(duration_seconds || '0', 10) || 0;
        const durationLabel = duration || (durationSeconds > 0
            ? `${Math.floor(durationSeconds / 60)}:${String(durationSeconds % 60).padStart(2, '0')}`
            : '');
        const trainingId = req.body.training_id ? parseInt(req.body.training_id) : null;
        const { insertId } = await run('INSERT INTO workout_videos (title, description, url, duration, duration_seconds, category, is_premium, thumbnail, is_short, source_type, approval_status, submitted_by, approved_by, approved_at, goal, body_area, equipment, level, training_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [title, description || '', videoUrl, durationLabel, durationSeconds, category || 'General', is_premium === '1' || is_premium === true ? 1 : 0, thumbnailUrl || '', isShort, 'upload', 'approved', req.user.id, req.user.id, new Date(), goal || null, body_area || null, equipment || null, level || null, trainingId]);
        const video = await get('SELECT * FROM workout_videos WHERE id = ?', [insertId]);
        res.json({ video, message: 'Video uploaded successfully' });
    }
    catch (err) {
        console.error('Video upload error:', err);
        res.status(500).json({ message: 'Failed to upload video' });
    }
});
// Create video from YouTube URL
router.post('/videos/youtube', authenticateToken, adminOnly, async (req, res) => {
    try {
        const { title, description, duration, category, is_premium, is_short, coach_id, youtube_url, goal, body_area, equipment, level } = req.body;
        if (!title)
            return res.status(400).json({ message: 'Title is required' });
        if (!youtube_url)
            return res.status(400).json({ message: 'YouTube URL is required' });
        // Extract video ID and normalise to a standard embed-friendly URL
        const ytRegex = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = youtube_url.match(ytRegex);
        if (!match)
            return res.status(400).json({ message: 'Invalid YouTube URL. Please provide a valid YouTube video link.' });
        const videoId = match[1];
        const embedUrl = `https://www.youtube.com/embed/${videoId}`;
        const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        const isShortVal = is_short === '1' || is_short === true ? 1 : 0;
        const isPremiumVal = is_premium === '1' || is_premium === true ? 1 : 0;
        const { insertId } = await run('INSERT INTO workout_videos (title, description, url, youtube_url, source_type, duration, duration_seconds, category, is_premium, thumbnail, is_short, approval_status, submitted_by, approved_by, approved_at, goal, body_area, equipment, level) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [title, description || '', embedUrl, youtube_url, 'youtube', duration || '', 0, category || 'General', isPremiumVal, thumbnail, isShortVal, 'approved', req.user.id, req.user.id, new Date(), goal || null, body_area || null, equipment || null, level || null]);
        const coachIdVal = coach_id ? parseInt(coach_id) : null;
        if (coachIdVal)
            await run('UPDATE workout_videos SET coach_id = ? WHERE id = ?', [coachIdVal, insertId]);
        const video = await get('SELECT * FROM workout_videos WHERE id = ?', [insertId]);
        res.json({ video, message: 'YouTube video added successfully' });
    }
    catch (err) {
        console.error('YouTube video creation error:', err);
        res.status(500).json({ message: 'Failed to add YouTube video' });
    }
});
router.patch('/videos/:id', authenticateToken, adminOnly, uploadVideo.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
]), validateVideoSize, optimizeImage(), async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await get('SELECT * FROM workout_videos WHERE id = ?', [id]);
        if (!existing)
            return res.status(404).json({ message: 'Video not found' });
        const files = req.files;
        const videoFile = files?.video?.[0];
        const thumbnailFile = files?.thumbnail?.[0];
        const videoUrl = videoFile ? await uploadToR2(videoFile, 'videos') : existing.url;
        const thumbnailUrl = thumbnailFile ? await uploadToR2(thumbnailFile, 'thumbnails') : existing.thumbnail;
        const { title, description, duration, category, is_premium, goal, body_area, equipment, level } = req.body;
        const isShort = req.body.is_short === '1' || req.body.is_short === true ? 1 : (req.body.is_short === '0' || req.body.is_short === false ? 0 : existing.is_short || 0);
        await run('UPDATE workout_videos SET title=?, description=?, url=?, duration=?, category=?, is_premium=?, thumbnail=?, is_short=?, goal=?, body_area=?, equipment=?, level=?, updated_at=NOW() WHERE id=?', [title || existing.title, description ?? existing.description, videoUrl, duration || existing.duration,
            category || existing.category, is_premium === '1' || is_premium === true ? 1 : 0, thumbnailUrl, isShort,
            goal !== undefined ? (goal || null) : existing.goal,
            body_area !== undefined ? (body_area || null) : existing.body_area,
            equipment !== undefined ? (equipment || null) : existing.equipment,
            level !== undefined ? (level || null) : existing.level,
            id]);
        const coachIdPatch = req.body.coach_id !== undefined ? (req.body.coach_id ? parseInt(req.body.coach_id) : null) : undefined;
        if (coachIdPatch !== undefined)
            await run('UPDATE workout_videos SET coach_id = ? WHERE id = ?', [coachIdPatch, id]);
        res.json({ message: 'Video updated' });
    }
    catch (err) {
        res.status(500).json({ message: 'Failed to update video' });
    }
});
router.patch('/videos/:id/approval', authenticateToken, adminOnly, async (req, res) => {
    try {
        const { status, reason } = req.body || {};
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid approval status' });
        }
        const existing = await get('SELECT * FROM workout_videos WHERE id = ?', [req.params.id]);
        if (!existing)
            return res.status(404).json({ message: 'Video not found' });
        await run('UPDATE workout_videos SET approval_status = ?, rejection_reason = ?, approved_by = ?, approved_at = ?, updated_at = NOW() WHERE id = ?', [status, status === 'rejected' ? (reason || '') : null, req.user.id, status === 'approved' ? new Date() : null, req.params.id]);
        const notifyUserId = existing.submitted_by || existing.coach_id;
        if (notifyUserId) {
            const nTitle = status === 'approved' ? 'Video Approved' : 'Video Rejected';
            const nBody = status === 'approved'
                ? `Your video "${existing.title}" is now live.`
                : `Your video "${existing.title}" was rejected.${reason ? ` Reason: ${reason}` : ''}`;
            await run('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)', [notifyUserId, 'video_review', nTitle, nBody, '/coach/profile']);
            sendPushToUser(notifyUserId, nTitle, nBody, undefined, '/coach/profile', 'video_review').catch(() => { });
        }
        const video = await get('SELECT * FROM workout_videos WHERE id = ?', [req.params.id]);
        res.json({ video, message: status === 'approved' ? 'Video approved' : 'Video rejected' });
    }
    catch (err) {
        console.error('Video approval error:', err);
        res.status(500).json({ message: 'Failed to update video approval' });
    }
});
router.delete('/videos/:id', authenticateToken, adminOnly, async (req, res) => {
    try {
        await run('DELETE FROM workout_videos WHERE id = ?', [req.params.id]);
        res.json({ message: 'Video deleted' });
    }
    catch {
        res.status(500).json({ message: 'Failed to delete video' });
    }
});
// ── Playlists ──────────────────────────────────────────────────────────────────
router.get('/playlists', authenticateToken, adminOnly, async (_req, res) => {
    try {
        const playlists = await query(`
      SELECT p.*, u.name as creator_name,
             (SELECT COUNT(*) FROM playlist_videos WHERE playlist_id = p.id) as video_count
      FROM video_playlists p
      LEFT JOIN users u ON p.created_by = u.id
      ORDER BY p.sort_order, p.created_at DESC`);
        res.json({ playlists });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch playlists' });
    }
});
router.post('/playlists', authenticateToken, adminOnly, async (req, res) => {
    try {
        const { title, description, thumbnail, is_public } = req.body;
        if (!title)
            return res.status(400).json({ message: 'Title is required' });
        const { insertId } = await run('INSERT INTO video_playlists (title, description, thumbnail, created_by, is_public) VALUES (?,?,?,?,?)', [title, description || '', thumbnail || '', req.user.id, is_public !== false ? 1 : 0]);
        const playlist = await get('SELECT * FROM video_playlists WHERE id = ?', [insertId]);
        res.json({ playlist, message: 'Playlist created' });
    }
    catch {
        res.status(500).json({ message: 'Failed to create playlist' });
    }
});
router.patch('/playlists/:id', authenticateToken, adminOnly, async (req, res) => {
    try {
        const { title, description, thumbnail, is_public } = req.body;
        await run('UPDATE video_playlists SET title=?, description=?, thumbnail=?, is_public=?, updated_at=NOW() WHERE id=?', [title, description || '', thumbnail || '', is_public ? 1 : 0, req.params.id]);
        res.json({ message: 'Playlist updated' });
    }
    catch {
        res.status(500).json({ message: 'Failed to update playlist' });
    }
});
router.delete('/playlists/:id', authenticateToken, adminOnly, async (req, res) => {
    try {
        await run('DELETE FROM video_playlists WHERE id = ?', [req.params.id]);
        res.json({ message: 'Playlist deleted' });
    }
    catch {
        res.status(500).json({ message: 'Failed to delete playlist' });
    }
});
router.get('/playlists/:id/videos', authenticateToken, adminOnly, async (req, res) => {
    try {
        const videos = await query(`SELECT v.*, pv.sort_order as playlist_order FROM playlist_videos pv
       JOIN workout_videos v ON v.id = pv.video_id
       WHERE pv.playlist_id = ?
       ORDER BY pv.sort_order`, [req.params.id]);
        res.json({ videos });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch playlist videos' });
    }
});
router.post('/playlists/:id/videos', authenticateToken, adminOnly, async (req, res) => {
    try {
        const { video_id } = req.body;
        const maxOrder = await get('SELECT MAX(sort_order) as m FROM playlist_videos WHERE playlist_id = ?', [req.params.id]);
        await run('INSERT INTO playlist_videos (playlist_id, video_id, sort_order) VALUES (?,?,?)', [req.params.id, video_id, (maxOrder?.m || 0) + 1]);
        res.json({ message: 'Video added to playlist' });
    }
    catch {
        res.status(500).json({ message: 'Failed to add video to playlist' });
    }
});
router.delete('/playlists/:id/videos/:videoId', authenticateToken, adminOnly, async (req, res) => {
    try {
        await run('DELETE FROM playlist_videos WHERE playlist_id = ? AND video_id = ?', [req.params.id, req.params.videoId]);
        res.json({ message: 'Video removed from playlist' });
    }
    catch {
        res.status(500).json({ message: 'Failed to remove video' });
    }
});
// ── Website Translations ───────────────────────────────────────────────────────
router.get('/website-translations', authenticateToken, adminOnly, async (_req, res) => {
    try {
        const rows = await query('SELECT text_key, text_ar FROM website_translations ORDER BY text_key');
        const translations = {};
        for (const r of rows)
            translations[r.text_key] = r.text_ar;
        res.json({ translations });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch translations' });
    }
});
router.put('/website-translations', authenticateToken, adminOnly, async (req, res) => {
    try {
        const entries = req.body?.translations;
        if (!entries || typeof entries !== 'object')
            return res.status(400).json({ message: 'Invalid data' });
        for (const [key, value] of Object.entries(entries)) {
            if (typeof key !== 'string' || typeof value !== 'string')
                continue;
            await run('INSERT INTO website_translations (text_key, text_ar) VALUES (?,?) ON DUPLICATE KEY UPDATE text_ar=?, updated_at=NOW()', [key.slice(0, 500), value, value]);
        }
        res.json({ message: 'Translations saved' });
    }
    catch {
        res.status(500).json({ message: 'Failed to save translations' });
    }
});
// Public endpoint for website translations (no auth required)
router.get('/website-translations/public', async (_req, res) => {
    try {
        const rows = await query('SELECT text_key, text_ar FROM website_translations ORDER BY text_key');
        const translations = {};
        for (const r of rows)
            translations[r.text_key] = r.text_ar;
        res.json({ translations });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch translations' });
    }
});
// ── Ads (full admin management) ────────────────────────────────────────────────
router.get('/ads', authenticateToken, adminOnly, async (req, res) => {
    try {
        // Auto-expire active ads past their boost_end
        await run("UPDATE coach_ads SET status = 'expired' WHERE status = 'active' AND boost_end IS NOT NULL AND boost_end < NOW()");
        const ads = await query(`
      SELECT a.*, u.name as coach_name, u.email as coach_email, u.avatar as coach_avatar,
             COALESCE(ap.amount, 0) as paid_amount, COALESCE(ap.duration_minutes, 0) as paid_minutes,
             ap.status as payment_status, ap.proof_url as payment_proof, ap.phone as payment_phone
      FROM coach_ads a
      LEFT JOIN users u ON a.coach_id = u.id
      LEFT JOIN ad_payments ap ON ap.ad_id = a.id
      ORDER BY FIELD(a.status, 'pending', 'active', 'expired', 'rejected'), a.created_at DESC`);
        res.json({ ads });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch ads' });
    }
});
router.patch('/ads/:id', authenticateToken, adminOnly, async (req, res) => {
    const { id } = req.params;
    const { title, description, specialty, cta, highlight, status } = req.body;
    try {
        await run('UPDATE coach_ads SET title=?, description=?, specialty=?, cta=?, highlight=?, status=?, updated_at=NOW() WHERE id=?', [title, description, specialty, cta, highlight, status, id]);
        res.json({ message: 'Ad updated' });
    }
    catch {
        res.status(500).json({ message: 'Failed to update ad' });
    }
});
router.patch('/ads/:id/status', authenticateToken, adminOnly, async (req, res) => {
    const { id } = req.params;
    const { status, admin_note } = req.body;
    if (!['active', 'pending', 'rejected', 'expired'].includes(status))
        return res.status(400).json({ message: 'Invalid status' });
    try {
        const ad = await get('SELECT * FROM coach_ads WHERE id = ?', [id]);
        if (status === 'active') {
            const totalMinutes = ((ad?.duration_hours || 0) * 60) + ((ad?.duration_days || 0) * 24 * 60);
            if (totalMinutes > 0) {
                await run('UPDATE coach_ads SET status = ?, admin_note = ?, boost_start = NOW(), boost_end = DATE_ADD(NOW(), INTERVAL ? MINUTE), updated_at = NOW() WHERE id = ?', [status, admin_note || null, totalMinutes, id]);
            }
            else {
                await run('UPDATE coach_ads SET status = ?, admin_note = ?, boost_start = NOW(), boost_end = DATE_ADD(NOW(), INTERVAL 7 DAY), updated_at = NOW() WHERE id = ?', [status, admin_note || null, id]);
            }
        }
        else {
            await run('UPDATE coach_ads SET status = ?, admin_note = ?, updated_at = NOW() WHERE id = ?', [status, admin_note || null, id]);
        }
        // Notify coach on rejection
        if (status === 'rejected' && ad?.coach_id) {
            const reason = admin_note ? `: ${admin_note}` : '';
            const nTitle = '❌ Ad Rejected';
            const nBody = `Your ad "${ad.title || 'Untitled'}" has been rejected${reason}`;
            await run('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)', [ad.coach_id, 'ad_rejected', nTitle, nBody, '/coach/ads/my-ads']);
            sendPushToUser(ad.coach_id, nTitle, nBody, undefined, '/coach/ads/my-ads', 'ad_rejected').catch(() => { });
        }
        res.json({ message: `Ad ${status}` });
    }
    catch {
        res.status(500).json({ message: 'Failed to update ad status' });
    }
});
router.delete('/ads/:id', authenticateToken, adminOnly, async (req, res) => {
    try {
        await run('DELETE FROM ad_payments WHERE ad_id = ?', [req.params.id]);
        await run('DELETE FROM coach_ads WHERE id = ?', [req.params.id]);
        res.json({ message: 'Ad deleted' });
    }
    catch {
        res.status(500).json({ message: 'Failed to delete ad' });
    }
});
// Admin: approve/reject ad payment
router.patch('/ads/:id/payment', authenticateToken, adminOnly, async (req, res) => {
    const { id } = req.params;
    const { payment_status } = req.body;
    try {
        await run('UPDATE ad_payments SET status = ?, updated_at = NOW() WHERE ad_id = ?', [payment_status, id]);
        if (payment_status === 'approved') {
            // Get the approved payment amount
            const payment = await get('SELECT amount, duration_minutes FROM ad_payments WHERE ad_id = ? AND status = ?', [id, 'approved']);
            const paidAmount = payment?.amount || 0;
            const totalMinutes = payment?.duration_minutes || 0;
            // Activate ad: set payment_status, paid_amount on coach_ads, then set active with schedule
            if (totalMinutes > 0) {
                await run(`UPDATE coach_ads SET status = 'active', payment_status = 'approved', paid_amount = ?,
           boost_start = NOW(), boost_end = DATE_ADD(NOW(), INTERVAL ? MINUTE), updated_at = NOW()
           WHERE id = ?`, [paidAmount, totalMinutes, id]);
            }
            else {
                // Use schedule_start/end if set, otherwise default 7 days
                const ad = await get('SELECT schedule_start, schedule_end, daily_budget, total_budget, budget_type FROM coach_ads WHERE id = ?', [id]);
                const budget = ad?.budget_type === 'daily' ? ad?.daily_budget : ad?.total_budget;
                const effectivePaid = paidAmount || budget || 0;
                await run(`UPDATE coach_ads SET status = 'active', payment_status = 'approved', paid_amount = ?,
           boost_start = NOW(),
           boost_end = COALESCE(schedule_end, DATE_ADD(NOW(), INTERVAL 7 DAY)),
           updated_at = NOW()
           WHERE id = ?`, [effectivePaid, id]);
            }
        }
        if (payment_status === 'rejected') {
            await run("UPDATE coach_ads SET status = 'rejected', payment_status = 'rejected', updated_at = NOW() WHERE id = ?", [id]);
            // Notify coach about payment rejection
            const ad = await get('SELECT coach_id, title FROM coach_ads WHERE id = ?', [id]);
            if (ad?.coach_id) {
                const nTitle = '❌ Ad Payment Rejected';
                const nBody = `Your payment for ad "${ad.title || 'Untitled'}" has been rejected.`;
                await run('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)', [ad.coach_id, 'ad_rejected', nTitle, nBody, '/coach/ads/my-ads']);
                sendPushToUser(ad.coach_id, nTitle, nBody, undefined, '/coach/ads/my-ads', 'ad_rejected').catch(() => { });
            }
        }
        res.json({ message: 'Payment status updated' });
    }
    catch {
        res.status(500).json({ message: 'Failed to update payment' });
    }
});
// Admin: ad analytics overview
router.get('/ads/stats', authenticateToken, adminOnly, async (_req, res) => {
    try {
        const [totalRow] = await query('SELECT COUNT(*) as total FROM coach_ads');
        const [activeRow] = await query("SELECT COUNT(*) as cnt FROM coach_ads WHERE status = 'active'");
        const [pendingRow] = await query("SELECT COUNT(*) as cnt FROM coach_ads WHERE status = 'pending'");
        const [rejectedRow] = await query("SELECT COUNT(*) as cnt FROM coach_ads WHERE status = 'rejected'");
        const [expiredRow] = await query("SELECT COUNT(*) as cnt FROM coach_ads WHERE status = 'expired' OR (status = 'active' AND boost_end IS NOT NULL AND boost_end < NOW())");
        const [revenueRow] = await query("SELECT IFNULL(SUM(amount),0) as total FROM ad_payments WHERE status = 'approved'");
        const [pendingRevRow] = await query("SELECT IFNULL(SUM(amount),0) as total FROM ad_payments WHERE status = 'pending'");
        const [impressionRow] = await query('SELECT IFNULL(SUM(impressions),0) as total FROM coach_ads');
        const [clickRow] = await query('SELECT IFNULL(SUM(clicks),0) as total FROM coach_ads');
        res.json({
            total: totalRow?.total || 0,
            active: activeRow?.cnt || 0,
            pending: pendingRow?.cnt || 0,
            rejected: rejectedRow?.cnt || 0,
            expired: expiredRow?.cnt || 0,
            adRevenue: parseFloat(revenueRow?.total || 0),
            pendingRevenue: parseFloat(pendingRevRow?.total || 0),
            totalImpressions: impressionRow?.total || 0,
            totalClicks: clickRow?.total || 0,
        });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch ad stats' });
    }
});
// ── Platform revenue (§5.2) ─────────────────────────────────────────────────
// "Total Revenue" = gross money the platform has actually collected:
//   • coaching subscriptions whose payment an admin has VERIFIED
//     (admin_approval_status = 'approved') and that weren't refunded — this is
//     the money that previously showed as 0 because subscription payments live
//     in coach_subscriptions, not the `payments` table the dashboard summed.
//   • approved ad payments.
//   • any completed generic payments (premium / coach membership via `payments`).
// `pendingRevenue` is subscription money awaiting admin verification (not yet
// collected), surfaced separately so held funds are visible.
router.get('/revenue', authenticateToken, adminOnly, async (_req, res) => {
    try {
        const [[subVerified], [subPending], [adApproved], [genCompleted]] = await Promise.all([
            query("SELECT IFNULL(SUM(amount),0) AS total FROM coach_subscriptions WHERE admin_approval_status = 'approved' AND refunded_at IS NULL"),
            query("SELECT IFNULL(SUM(amount),0) AS total FROM coach_subscriptions WHERE status = 'pending_admin'"),
            query("SELECT IFNULL(SUM(amount),0) AS total FROM ad_payments WHERE status = 'approved'"),
            query("SELECT IFNULL(SUM(amount),0) AS total FROM payments WHERE status = 'completed'"),
        ]);
        const subscriptionRevenue = Number(subVerified?.total || 0);
        const adRevenue = Number(adApproved?.total || 0);
        const otherRevenue = Number(genCompleted?.total || 0);
        res.json({
            totalRevenue: subscriptionRevenue + adRevenue + otherRevenue,
            subscriptionRevenue,
            adRevenue,
            otherRevenue,
            pendingRevenue: Number(subPending?.total || 0),
        });
    }
    catch (err) {
        res.status(500).json({ message: err?.message || 'Failed to compute revenue' });
    }
});
// ── Payments ───────────────────────────────────────────────────────────────────
router.get('/payments', authenticateToken, adminOnly, async (_req, res) => {
    try {
        const payments = await query(`SELECT p.*, u.name as user_name, u.email as user_email FROM payments p LEFT JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC`);
        res.json({ payments });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch payments' });
    }
});
// ── Payment Settings ───────────────────────────────────────────────────────────
router.get('/payment-settings', authenticateToken, adminOnly, async (_req, res) => {
    try {
        const rows = await query('SELECT setting_key, setting_value FROM payment_settings');
        const settings = {};
        for (const row of rows)
            settings[row.setting_key] = row.setting_value;
        res.json({ settings });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch payment settings' });
    }
});
router.put('/payment-settings', authenticateToken, adminOnly, async (req, res) => {
    const allowed = [
        // PayPal
        'paypal_user_link', 'paypal_coach_link',
        'paypal_user_client_id', 'paypal_coach_client_id',
        'paypal_user_secret', 'paypal_coach_secret',
        'paypal_mode', 'paypal_webhook_id',
        // E-Wallets (manual)
        'ewallet_phone', 'ewallet_phone_vodafone', 'ewallet_phone_orange',
        'ewallet_phone_we', 'ewallet_phone_instapay',
        // Paymob (automated)
        'paymob_api_key', 'paymob_integration_id_card', 'paymob_integration_id_wallet',
        'paymob_iframe_id', 'paymob_hmac_secret', 'paymob_disbursement_api_key',
        // Fawry
        'fawry_merchant_code', 'fawry_merchant_ref_number',
        // Mode toggles (1 = enabled, 0 = disabled)
        'paymob_auto_enabled', 'paymob_manual_enabled',
        'fawry_auto_enabled', 'fawry_manual_enabled',
        'pm_orange_cash', 'pm_vodafone_cash', 'pm_we_pay',
        'pm_paypal', 'pm_credit_card', 'pm_google_pay', 'pm_apple_pay',
        'google_play_enabled', 'google_play_product_id_monthly', 'google_play_product_id_annual',
        'apple_pay_enabled', 'apple_pay_product_id_monthly', 'apple_pay_product_id_annual',
        // Revenue & rates
        'coach_cut_percentage', 'egp_usd_rate',
    ];
    try {
        const body = req.body;
        for (const key of Object.keys(body)) {
            if (!allowed.includes(key))
                continue;
            await run('INSERT INTO payment_settings (setting_key, setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_value=?, updated_at=NOW()', [key, body[key], body[key]]);
        }
        res.json({ message: 'Payment settings saved' });
    }
    catch (err) {
        res.status(500).json({ message: 'Failed to save payment settings' });
    }
});
// ── Server URL Setting ─────────────────────────────────────────────────────────
router.get('/server-url', authenticateToken, adminOnly, async (_req, res) => {
    try {
        const rows = await query("SELECT setting_value FROM payment_settings WHERE setting_key = 'server_url'");
        res.json({ url: rows.length ? rows[0].setting_value : '' });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch server URL' });
    }
});
router.put('/server-url', authenticateToken, adminOnly, async (req, res) => {
    try {
        const { url } = req.body;
        await run("INSERT INTO payment_settings (setting_key, setting_value) VALUES ('server_url', ?) ON DUPLICATE KEY UPDATE setting_value=?, updated_at=NOW()", [url || '', url || '']);
        res.json({ message: 'Server URL saved', url: url || '' });
    }
    catch {
        res.status(500).json({ message: 'Failed to save server URL' });
    }
});
// ── Test Connection ─────────────────────────────────────────────────────────────
router.get('/ping', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// ── Activity seeder for newly created fake users and fake coaches ────────────
// Populates posts, comments, likes, follows, subscriptions, messages, steps,
// payments, and challenge participation so fake accounts look like real users
// from day one (mirrors what server/seed.ts does on a fresh DB).
async function seedActivitiesForFakeAccounts(newIds, role) {
    if (!newIds.length)
        return;
    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const daysAgo = (n) => new Date(Date.now() - n * 86400000);
    const daysAgoStr = (n) => daysAgo(n).toISOString().split('T')[0];
    const USER_POSTS = [
        'Just crushed a new personal record today 💪 Hard work pays off!',
        'Morning workout done before sunrise. This is the lifestyle 🌅',
        'Week 3 of my program and I can already see the changes!',
        'Rest day vibes 🧘 Recovery is just as important as training.',
        'Anyone else addicted to the post-workout feeling? Best natural high.',
        'Meal prepped for the whole week 🍱 Preparation is key.',
        'Hit 10,000 steps before noon! New record 🏃',
        'Finally did my first pull-up! Months of work for that one moment 🙌',
        'Consistency > intensity. Show up even when you don\'t feel like it.',
        'My coach changed my life. Down 12kg in 3 months!',
        'Down 5kg in 6 weeks. Slow and steady wins the race 🐢',
        'First time doing HIIT — I thought I was going to die but I survived 😂',
    ];
    const COACH_POSTS = [
        '💡 Coaching tip: You don\'t need to train 2 hours a day. 45 focused minutes beats 2 hours of distracted training.',
        '🥗 Nutrition myth busted: You don\'t need to eat clean 100% of the time. 80/20 rule wins.',
        '🏋️ Progressive overload is the #1 driver of muscle growth. Add weight, reps, or sets every week.',
        '💤 If your progress has stalled, check your sleep first. Everything else comes second.',
        '🔥 New spots open for online coaching this month! DM me to claim yours.',
        '⚡ Reminder: rest days are not lazy days. They\'re growth days.',
        '🎯 Your body is a long-term project, not a 30-day challenge.',
    ];
    const COMMENTS = [
        'Keep it up! 🔥', 'This is so inspiring!', 'Amazing progress!',
        'You\'re crushing it 💪', 'Goals! 🎯', 'Let\'s go! 🚀',
        'I felt that 😂', 'Proud of you!', 'Keep grinding!',
        'How long did it take you?', 'What program are you on?',
    ];
    const newIdSet = new Set(newIds);
    const coaches = await query('SELECT id FROM users WHERE role = ? ORDER BY RAND() LIMIT 30', ['coach']).catch(() => []);
    const existingUsers = await query('SELECT id FROM users WHERE role = ? ORDER BY id DESC LIMIT 80', ['user']).catch(() => []);
    const recentPosts = await query('SELECT id, user_id FROM posts ORDER BY created_at DESC LIMIT 80').catch(() => []);
    const activeChallenges = await query('SELECT id FROM challenges WHERE end_date >= CURDATE() LIMIT 5').catch(() => []);
    const coachIds = coaches.map(c => Number(c.id)).filter(id => !newIdSet.has(id));
    const peerUserIds = existingUsers.map(u => Number(u.id)).filter(id => !newIdSet.has(id));
    const recentPostsFiltered = recentPosts.filter(p => !newIdSet.has(Number(p.user_id)));
    for (let i = 0; i < newIds.length; i++) {
        const id = newIds[i];
        // 1) 14 days of step entries
        const baseSteps = rand(4000, 12000);
        for (let d = 0; d < 14; d++) {
            const steps = Math.max(500, baseSteps + rand(-2000, 3000));
            const cal = Math.round(steps * 0.05);
            const km = parseFloat((steps * 0.00075).toFixed(2));
            try {
                await run('INSERT INTO steps_entries (user_id,date,steps,calories_burned,distance_km) VALUES (?,?,?,?,?)', [id, daysAgoStr(d), steps, cal, km]);
            }
            catch { }
        }
        // 2) Community posts (more for coaches)
        const numPosts = role === 'coach' ? rand(2, 4) : rand(1, 3);
        const pool = role === 'coach' ? COACH_POSTS : USER_POSTS;
        const tag = role === 'coach' ? '#coaching #fitness #fitwayhub' : '#fitness #fitwayhub #health';
        const myPostIds = [];
        for (let p = 0; p < numPosts; p++) {
            const body = pool[(i * numPosts + p) % pool.length];
            const seedLikes = role === 'coach' ? rand(15, 120) : rand(2, 60);
            try {
                const { insertId } = await run('INSERT INTO posts (user_id,content,hashtags,likes,created_at) VALUES (?,?,?,?,?)', [id, body, tag, seedLikes, daysAgo(rand(0, 21))]);
                myPostIds.push(insertId);
            }
            catch { }
        }
        // 3) New account leaves comments on existing recent posts
        const targetsForCommenting = [...recentPostsFiltered].sort(() => Math.random() - 0.5).slice(0, rand(2, 4));
        for (const post of targetsForCommenting) {
            try {
                await run('INSERT INTO post_comments (post_id,user_id,content,created_at) VALUES (?,?,?,?)', [post.id, id, pick(COMMENTS), daysAgo(rand(0, 10))]);
            }
            catch { }
        }
        // 4) New account likes existing recent posts
        const likeTargets = [...recentPostsFiltered].sort(() => Math.random() - 0.5).slice(0, Math.min(8, recentPostsFiltered.length));
        for (const post of likeTargets) {
            try {
                await run('INSERT IGNORE INTO post_likes (post_id,user_id) VALUES (?,?)', [post.id, id]);
            }
            catch { }
        }
        // 5) Existing users and coaches engage with the new account's posts
        const engagementPool = [...peerUserIds, ...coachIds];
        for (const pid of myPostIds) {
            const numComments = rand(1, 4);
            for (let k = 0; k < numComments && engagementPool.length; k++) {
                try {
                    await run('INSERT INTO post_comments (post_id,user_id,content,created_at) VALUES (?,?,?,?)', [pid, pick(engagementPool), pick(COMMENTS), daysAgo(rand(0, 5))]);
                }
                catch { }
            }
            const likers = [...engagementPool].sort(() => Math.random() - 0.5).slice(0, rand(3, Math.min(12, engagementPool.length || 1)));
            for (const liker of likers) {
                try {
                    await run('INSERT IGNORE INTO post_likes (post_id,user_id) VALUES (?,?)', [pid, liker]);
                }
                catch { }
            }
        }
        if (role === 'user') {
            // 6) Follow a few existing coaches
            const followCoaches = [...coachIds].sort(() => Math.random() - 0.5).slice(0, Math.min(3, coachIds.length));
            for (const cid of followCoaches) {
                try {
                    await run('INSERT IGNORE INTO coach_follows (follower_id,coach_id) VALUES (?,?)', [id, cid]);
                }
                catch { }
            }
            // 7) Follow a few existing users
            const followUsers = [...peerUserIds].sort(() => Math.random() - 0.5).slice(0, rand(2, 6));
            for (const uid of followUsers) {
                try {
                    await run('INSERT IGNORE INTO user_follows (follower_id,following_id) VALUES (?,?)', [id, uid]);
                }
                catch { }
            }
            // 8) Premium payment for ~1/3 of new users
            if (i % 3 === 0) {
                try {
                    await run('INSERT INTO payments (user_id,type,plan,amount,payment_method,status,created_at) VALUES (?,?,?,?,?,?,?)', [id, 'premium', 'monthly', 50, pick(['vodafone_cash', 'orange_cash', 'paypal', 'paymob_card']), 'completed', daysAgo(rand(1, 60))]);
                }
                catch { }
            }
            // 9) Coach subscription for ~half of new users + chat exchange
            if (i % 2 === 0 && coachIds.length > 0) {
                const cid = coachIds[i % coachIds.length];
                const amount = pick([99, 149, 199, 249]);
                const status = pick(['active', 'active', 'pending']);
                try {
                    await run(`INSERT INTO coach_subscriptions (user_id,coach_id,plan_cycle,plan_type,amount,status,admin_approval_status,coach_decision_status,payment_method,started_at,expires_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [id, cid, pick(['monthly', 'yearly']), pick(['complete', 'workout']), amount, status,
                        status === 'active' ? 'approved' : 'pending',
                        status === 'active' ? 'accepted' : 'pending',
                        pick(['vodafone_cash', 'ewallet', 'paymob_card']),
                        daysAgo(rand(1, 30)), daysAgo(-rand(7, 30))]);
                    if (status === 'active') {
                        const credit = Math.round(amount * 0.85 * 100) / 100;
                        try {
                            await run('UPDATE users SET credit = credit + ? WHERE id = ?', [credit, cid]);
                        }
                        catch { }
                        try {
                            await run('INSERT INTO credit_transactions (user_id,amount,type,description) VALUES (?,?,?,?)', [cid, credit, 'subscription_earning', `Subscription from user #${id}`]);
                        }
                        catch { }
                    }
                }
                catch { }
                const convo = [
                    ['Hi Coach! I just subscribed. When do we start?', false],
                    ['Welcome! Let\'s begin with an assessment. What are your main goals?', true],
                    ['Mainly lose weight and build some muscle.', false],
                    ['Perfect! I\'ll send your Week 1 plan tonight.', true],
                ];
                for (let m = 0; m < convo.length; m++) {
                    const [msg, fromCoach] = convo[m];
                    try {
                        await run('INSERT INTO messages (sender_id,receiver_id,content,created_at) VALUES (?,?,?,?)', [fromCoach ? cid : id, fromCoach ? id : cid, msg, daysAgo(7 - m * 0.5)]);
                    }
                    catch { }
                }
            }
            // 10) Join active challenges
            for (const ch of activeChallenges.slice(0, 2)) {
                try {
                    await run('INSERT IGNORE INTO challenge_participants (challenge_id,user_id) VALUES (?,?)', [ch.id, id]);
                }
                catch { }
            }
        }
        else {
            // role === 'coach': get followers + a few paying subscribers from existing users
            const followers = [...peerUserIds].sort(() => Math.random() - 0.5).slice(0, rand(5, 15));
            for (const f of followers) {
                try {
                    await run('INSERT IGNORE INTO coach_follows (follower_id,coach_id) VALUES (?,?)', [f, id]);
                }
                catch { }
            }
            const subscribers = [...peerUserIds].sort(() => Math.random() - 0.5).slice(0, rand(2, 5));
            for (const subUserId of subscribers) {
                const amount = pick([99, 149, 199, 249]);
                try {
                    await run(`INSERT INTO coach_subscriptions (user_id,coach_id,plan_cycle,plan_type,amount,status,admin_approval_status,coach_decision_status,payment_method,started_at,expires_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [subUserId, id, pick(['monthly', 'yearly']), pick(['complete', 'workout']), amount, 'active', 'approved', 'accepted',
                        pick(['vodafone_cash', 'ewallet', 'paymob_card']),
                        daysAgo(rand(1, 30)), daysAgo(-rand(7, 30))]);
                    const credit = Math.round(amount * 0.85 * 100) / 100;
                    try {
                        await run('UPDATE users SET credit = credit + ? WHERE id = ?', [credit, id]);
                    }
                    catch { }
                    try {
                        await run('INSERT INTO credit_transactions (user_id,amount,type,description) VALUES (?,?,?,?)', [id, credit, 'subscription_earning', `Subscription from user #${subUserId}`]);
                    }
                    catch { }
                    // Short chat exchange with each subscriber
                    const convo = [
                        ['Hi! Excited to start with you 💪', false],
                        ['Welcome aboard! I\'ll send your assessment shortly.', true],
                        ['Thanks Coach!', false],
                    ];
                    for (let m = 0; m < convo.length; m++) {
                        const [msg, fromCoach] = convo[m];
                        try {
                            await run('INSERT INTO messages (sender_id,receiver_id,content,created_at) VALUES (?,?,?,?)', [fromCoach ? id : subUserId, fromCoach ? subUserId : id, msg, daysAgo(5 - m * 0.5)]);
                        }
                        catch { }
                    }
                }
                catch { }
            }
            // Coach joins (or appears in) recent challenges as a participant too
            for (const ch of activeChallenges.slice(0, 1)) {
                try {
                    await run('INSERT IGNORE INTO challenge_participants (challenge_id,user_id) VALUES (?,?)', [ch.id, id]);
                }
                catch { }
            }
            // Ad campaigns, ad sets, ads, creatives + audit logs for the new coach.
            // Mirrors server/seed.ts: schemas vary across installs, so we discover
            // available columns at runtime and only insert what the DB supports.
            try {
                await seedAdsForCoach(id);
            }
            catch (e) {
                console.warn('[seedActivitiesForFakeAccounts] ads seeding failed for coach', id, e?.message);
            }
        }
    }
}
// Build a small set of ad campaigns/sets/ads/creatives for a single coach.
// Defensive against legacy schemas — uses SHOW COLUMNS to pick valid fields.
async function seedAdsForCoach(coachId) {
    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const daysAgo = (n) => new Date(Date.now() - n * 86400000);
    const objectives = ['coaching', 'awareness', 'traffic', 'engagement', 'bookings', 'announcements'];
    const placements = ['feed', 'home_banner', 'community', 'all'];
    // Curated Unsplash photos (stable CDN URLs, no API key needed). Each ad
    // template below is paired with one of these so the creative image
    // visually supports the headline.
    // u(): build a sensibly sized Unsplash URL — capped at 800px and q=70 so
    // mobile bandwidth and on-screen layout stay reasonable.
    const u = (id) => `https://images.unsplash.com/${id}?w=800&auto=format&fit=crop&q=70`;
    const IMG = {
        transformation: u('photo-1599058917212-d750089bc07e'), // gym workout
        coaching: u('photo-1571902943202-507ec2618e8f'), // personal trainer / barbell
        strength: u('photo-1581009146145-b5ef050c2e1e'), // strength training
        fatLoss: u('photo-1517836357463-d25dfeac3438'), // running / cardio
        online: u('photo-1518611012118-696072aa579a'), // home workout
        smart: u('photo-1534438327276-14e5300c3a48'), // kettlebells
        yoga: u('photo-1545205597-3d9d02c29597'), // yoga
        running: u('photo-1571019613454-1cb2f99b2d8b'), // running outdoors
        nutrition: u('photo-1490645935967-10de6ba17061'), // healthy meal
        mobility: u('photo-1540206395-68808572332f'), // stretching
    };
    // Ad templates: headline + body + cta + image + interest keywords that this
    // ad actually targets. Interests use values that match the viewer-interest
    // vocab in coachRoutes2.ts (fitness_goal enum, workout types, common
    // post keywords) so users writing/searching about those topics see the ad.
    const AD_TEMPLATES = [
        {
            headline: 'Transform Your Body in 12 Weeks',
            body: '4 weeks to feel it. 8 weeks to see it. 12 weeks for others to notice. Let\'s go.',
            cta: 'Subscribe now',
            image: IMG.transformation,
            interests: ['lose_weight', 'build_muscle', 'weight_loss', 'strength'],
        },
        {
            headline: 'Personalized 1-on-1 Coaching',
            body: 'Customized plans, weekly check-ins, real accountability. DM me for a free consult.',
            cta: 'Book a session',
            image: IMG.coaching,
            interests: ['all'],
        },
        {
            headline: 'Build Strength, Build Confidence',
            body: 'Progressive overload programs designed around your schedule. Train 3–4x a week.',
            cta: 'Start today',
            image: IMG.strength,
            interests: ['build_muscle', 'strength', 'hypertrophy', 'gain_weight', 'muscle'],
        },
        {
            headline: 'Drop the Fat. Keep the Muscle.',
            body: 'Sustainable nutrition + smart training. Lose fat without losing energy.',
            cta: 'Learn more',
            image: IMG.fatLoss,
            interests: ['lose_weight', 'weight_loss', 'fat_loss', 'cut', 'cardio', 'hiit'],
        },
        {
            headline: 'Online Coaching, Anywhere',
            body: 'Train from home, the gym, or on the road. Same program quality.',
            cta: 'Subscribe now',
            image: IMG.online,
            interests: ['maintain_weight', 'wellness', 'all'],
        },
        {
            headline: 'Train Smarter, Not Longer',
            body: '45 focused minutes beats 2 hours of distracted training. Every time.',
            cta: 'Start today',
            image: IMG.smart,
            interests: ['build_muscle', 'strength', 'hiit', 'crossfit', 'functional'],
        },
        {
            headline: 'Find Calm. Build Mobility.',
            body: 'Yoga and mobility programs for athletes and desk-workers alike.',
            cta: 'Subscribe now',
            image: IMG.yoga,
            interests: ['yoga', 'mobility', 'flexibility', 'wellness', 'recovery'],
        },
        {
            headline: 'Run Your First 5K in 8 Weeks',
            body: 'Couch-to-5K plans, run/walk intervals, and weekly progress check-ins.',
            cta: 'Learn more',
            image: IMG.running,
            interests: ['running', 'cardio', 'endurance', 'lose_weight'],
        },
        {
            headline: 'Eat for Your Goals',
            body: 'Macro-based nutrition coaching. Real food, no extreme diets.',
            cta: 'Book a session',
            image: IMG.nutrition,
            interests: ['nutrition', 'diet', 'meal', 'protein', 'macros', 'lose_weight', 'gain_weight'],
        },
        {
            headline: 'Move Better, Feel Better',
            body: 'Mobility + stretching routines to undo a day at the desk.',
            cta: 'Start today',
            image: IMG.mobility,
            interests: ['mobility', 'flexibility', 'stretching', 'yoga', 'recovery'],
        },
    ];
    const campCols = await query('SHOW COLUMNS FROM ad_campaigns').then((r) => Array.isArray(r) ? r.map((x) => x.Field) : []).catch(() => []);
    if (!campCols.length)
        return; // no ads tables on this install
    const adSetColsRaw = await query('SHOW COLUMNS FROM ad_sets').catch(() => []);
    const adSetCols = Array.isArray(adSetColsRaw) ? adSetColsRaw.map((x) => x.Field) : [];
    const adSetColTypes = Array.isArray(adSetColsRaw)
        ? adSetColsRaw.reduce((acc, r) => { acc[r.Field] = r.Type; return acc; }, {})
        : {};
    const acCols = await query('SHOW COLUMNS FROM ad_creatives').then((r) => Array.isArray(r) ? r.map((x) => x.Field) : []).catch(() => []);
    const adCols = await query('SHOW COLUMNS FROM ads').then((r) => Array.isArray(r) ? r.map((x) => x.Field) : []).catch(() => []);
    const numCampaigns = rand(1, 2);
    for (let i = 0; i < numCampaigns; i++) {
        // Pick one ad template and derive everything (campaign name, copy,
        // creative image, target_interests) from it so the visuals match the
        // headline and the targeting matches the topic of the headline.
        const template = pick(AD_TEMPLATES);
        const campName = template.headline;
        const objective = pick(objectives);
        // Must be 'active' (not 'pending_review' or 'paused') so the ad serving
        // endpoints in coachRoutes2.ts actually return these rows.
        const status = 'active';
        const budget = rand(500, 4000);
        const start = daysAgo(rand(10, 60));
        const end = daysAgo(-rand(1, 60));
        const cCols = ['coach_id', 'name', 'status'];
        const cVals = [coachId, campName, status];
        if (campCols.includes('objective')) {
            cCols.push('objective');
            cVals.push(objective);
        }
        if (campCols.includes('daily_budget')) {
            cCols.push('daily_budget');
            cVals.push(budget);
        }
        else if (campCols.includes('lifetime_budget')) {
            cCols.push('lifetime_budget');
            cVals.push(budget);
        }
        if (campCols.includes('schedule_start')) {
            cCols.push('schedule_start');
            cVals.push(start);
        }
        if (campCols.includes('schedule_end')) {
            cCols.push('schedule_end');
            cVals.push(end);
        }
        if (campCols.includes('created_at')) {
            cCols.push('created_at');
            cVals.push(start);
        }
        if (campCols.includes('updated_at')) {
            cCols.push('updated_at');
            cVals.push(end);
        }
        let campaignId;
        try {
            const res = await run(`INSERT INTO ad_campaigns (${cCols.join(',')}) VALUES (${cCols.map(_ => '?').join(',')})`, cVals);
            campaignId = res.insertId;
        }
        catch {
            // Fallback: drop objective (enum mismatches on older schemas)
            const idx = cCols.indexOf('objective');
            if (idx !== -1) {
                cCols.splice(idx, 1);
                cVals.splice(idx, 1);
            }
            try {
                const res = await run(`INSERT INTO ad_campaigns (${cCols.join(',')}) VALUES (${cCols.map(_ => '?').join(',')})`, cVals);
                campaignId = res.insertId;
            }
            catch {
                // Last-resort minimal insert
                try {
                    const res = await run('INSERT INTO ad_campaigns (coach_id,name) VALUES (?,?)', [coachId, campName]);
                    campaignId = res.insertId;
                }
                catch {
                    continue;
                }
            }
        }
        try {
            await run(`INSERT INTO ad_audit_logs (actor_id, actor_role, action, entity_type, entity_id, new_state, created_at)
         VALUES (?,?,?,?,?,?,?)`, [coachId, 'coach', 'create', 'campaign', campaignId, JSON.stringify({ name: campName, status }), start]);
        }
        catch { }
        if (!adSetCols.length)
            continue;
        const adSetName = `${campName} Set 1`;
        // Must be 'active' so the serving query returns the row.
        const adSetStatus = 'active';
        // target_interests is matched against the viewer's interest signal in the
        // serving query (see getViewerInterestSignal + getTargetedCampaignAdsForUser
        // in coachRoutes2.ts). Pulling the keywords straight from the chosen
        // template guarantees the targeting matches the topic of the ad's
        // headline/copy/image.
        const targeting = {
            gender: pick(['all', 'male', 'female']),
            ageMin: rand(18, 30),
            ageMax: rand(45, 65),
            interests: template.interests,
        };
        const asCols = ['campaign_id', 'name', 'status'];
        const asVals = [campaignId, adSetName, adSetStatus];
        if (adSetCols.includes('placement')) {
            const placementVal = adSetColTypes['placement']?.toLowerCase().includes('json') ? JSON.stringify(pick(placements)) : pick(placements);
            asCols.push('placement');
            asVals.push(placementVal);
        }
        if (adSetCols.includes('target_gender')) {
            asCols.push('target_gender');
            asVals.push(targeting.gender);
        }
        if (adSetCols.includes('target_age_min')) {
            asCols.push('target_age_min');
            asVals.push(targeting.ageMin);
        }
        if (adSetCols.includes('target_age_max')) {
            asCols.push('target_age_max');
            asVals.push(targeting.ageMax);
        }
        if (adSetCols.includes('target_interests')) {
            asCols.push('target_interests');
            asVals.push(JSON.stringify(targeting.interests));
        }
        if (adSetCols.includes('daily_budget')) {
            asCols.push('daily_budget');
            asVals.push(budget);
        }
        if (adSetCols.includes('created_at')) {
            asCols.push('created_at');
            asVals.push(start);
        }
        if (adSetCols.includes('updated_at')) {
            asCols.push('updated_at');
            asVals.push(end);
        }
        let adSetId;
        try {
            const res = await run(`INSERT INTO ad_sets (${asCols.join(',')}) VALUES (${asCols.map(_ => '?').join(',')})`, asVals);
            adSetId = res.insertId;
        }
        catch {
            continue;
        }
        try {
            await run(`INSERT INTO ad_audit_logs (actor_id, actor_role, action, entity_type, entity_id, new_state, created_at)
         VALUES (?,?,?,?,?,?,?)`, [coachId, 'coach', 'create', 'ad_set', adSetId, JSON.stringify({ name: adSetName, status: adSetStatus }), start]);
        }
        catch { }
        // Creative — uses the template's Unsplash image so the visual supports
        // the headline/body. Always 'image' format (no fake video URLs).
        let creativeId = null;
        if (acCols.length) {
            const creativeType = 'image';
            const creativeUrl = template.image;
            const crCols = [];
            const crVals = [];
            if (acCols.includes('coach_id')) {
                crCols.push('coach_id');
                crVals.push(coachId);
            }
            else if (acCols.includes('owner_id')) {
                crCols.push('owner_id');
                crVals.push(coachId);
            }
            else if (acCols.includes('created_by')) {
                crCols.push('created_by');
                crVals.push(coachId);
            }
            if (acCols.includes('name')) {
                crCols.push('name');
                crVals.push(`${campName} creative`);
            }
            if (acCols.includes('format')) {
                crCols.push('format');
                crVals.push(creativeType);
            }
            if (acCols.includes('media_url')) {
                crCols.push('media_url');
                crVals.push(creativeUrl);
            }
            else if (acCols.includes('url')) {
                crCols.push('url');
                crVals.push(creativeUrl);
            }
            if (acCols.includes('thumbnail_url')) {
                crCols.push('thumbnail_url');
                crVals.push(null);
            }
            if (acCols.includes('carousel_items')) {
                crCols.push('carousel_items');
                crVals.push('[]');
            }
            if (acCols.includes('created_at')) {
                crCols.push('created_at');
                crVals.push(start);
            }
            if (acCols.includes('updated_at')) {
                crCols.push('updated_at');
                crVals.push(end);
            }
            if (crCols.length) {
                try {
                    const res = await run(`INSERT INTO ad_creatives (${crCols.join(',')}) VALUES (${crCols.map(_ => '?').join(',')})`, crVals);
                    creativeId = res.insertId;
                }
                catch { }
            }
        }
        // Ad
        if (adCols.length) {
            const adName = `${adSetName} Ad 1`;
            // Must be 'active' so the serving query returns the row.
            const adStatus = 'active';
            // Copy comes from the same template as the creative image and the
            // targeting, so all three are aligned ("Run Your First 5K" headline →
            // running photo → interests:['running','cardio','endurance']).
            const headline = template.headline;
            const body = template.body;
            const cta = template.cta;
            const impressions = rand(1000, 20000);
            const clicks = Math.floor(impressions * (0.01 + Math.random() * 0.04));
            const conversions = rand(0, Math.max(1, Math.floor(clicks * 0.2)));
            const spent = parseFloat((budget * (0.1 + Math.random() * 0.6)).toFixed(2));
            const aCols = [];
            const aVals = [];
            if (adCols.includes('ad_set_id')) {
                aCols.push('ad_set_id');
                aVals.push(adSetId);
            }
            if (adCols.includes('campaign_id')) {
                aCols.push('campaign_id');
                aVals.push(campaignId);
            }
            if (adCols.includes('name')) {
                aCols.push('name');
                aVals.push(adName);
            }
            if (adCols.includes('status')) {
                aCols.push('status');
                aVals.push(adStatus);
            }
            if (adCols.includes('creative_id')) {
                aCols.push('creative_id');
                aVals.push(creativeId);
            }
            if (adCols.includes('headline')) {
                aCols.push('headline');
                aVals.push(headline);
            }
            if (adCols.includes('body')) {
                aCols.push('body');
                aVals.push(body);
            }
            if (adCols.includes('cta')) {
                aCols.push('cta');
                aVals.push(cta);
            }
            if (adCols.includes('destination_type')) {
                aCols.push('destination_type');
                aVals.push('profile');
            }
            if (adCols.includes('destination_ref')) {
                aCols.push('destination_ref');
                aVals.push(String(coachId));
            }
            if (adCols.includes('placement')) {
                aCols.push('placement');
                aVals.push(pick(placements));
            }
            if (adCols.includes('impressions')) {
                aCols.push('impressions');
                aVals.push(impressions);
            }
            if (adCols.includes('clicks')) {
                aCols.push('clicks');
                aVals.push(clicks);
            }
            if (adCols.includes('conversions')) {
                aCols.push('conversions');
                aVals.push(conversions);
            }
            if (adCols.includes('amount_spent')) {
                aCols.push('amount_spent');
                aVals.push(spent);
            }
            if (adCols.includes('created_at')) {
                aCols.push('created_at');
                aVals.push(start);
            }
            if (adCols.includes('updated_at')) {
                aCols.push('updated_at');
                aVals.push(end);
            }
            if (aCols.length) {
                try {
                    const res = await run(`INSERT INTO ads (${aCols.join(',')}) VALUES (${aCols.map(_ => '?').join(',')})`, aVals);
                    const adId = res.insertId;
                    try {
                        await run(`INSERT INTO ad_audit_logs (actor_id, actor_role, action, entity_type, entity_id, new_state, created_at)
               VALUES (?,?,?,?,?,?,?)`, [coachId, 'coach', 'create', 'ad', adId, JSON.stringify({ name: adName, status: adStatus }), start]);
                    }
                    catch { }
                }
                catch { }
            }
        }
    }
}
// ── Coach Profiles Generator ────────────────────────────────────────────────
router.post('/generate-coach-profiles', authenticateToken, adminOnly, async (_req, res) => {
    try {
        const count = 5;
        const firstNames = ['Karim', 'Omar', 'Hassan', 'Mina', 'Yousef', 'Nadine', 'Rania', 'Mariam', 'Salma', 'Lina'];
        const lastNames = ['Mostafa', 'Hamed', 'Samir', 'Nabil', 'Farouk', 'Ibrahim', 'Mahmoud', 'Adel', 'Tarek', 'Kamel'];
        const CITIES = ['Cairo', 'Giza', 'Alexandria', 'Hurghada', 'Sharm El Sheikh', 'Luxor', 'Aswan', 'Mansoura', 'Tanta'];
        const SPECIALTIES = ['Strength Training', 'HIIT', 'Yoga', 'Pilates', 'CrossFit', 'Bodybuilding', 'Functional Fitness', 'Nutrition Coaching', 'Cardio & Endurance'];
        const BIOS = [
            'Certified personal trainer with 6+ years of experience helping clients reach their goals.',
            'Passionate about strength, mobility, and sustainable habits. Let\'s build the version of you that you actually like.',
            'Online & in-person coaching. Customised plans, real accountability, no gimmicks.',
            'Fitness should feel good. I design programs that fit your life, not the other way around.',
            'Athlete turned coach. I\'ll meet you where you are and push you where you need it.',
        ];
        const created = [];
        const newCoachIds = [];
        const hashed = await bcrypt.hash('CoachPass123!', 10);
        const baseTs = Date.now();
        const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
        const dobFromAge = (age) => {
            const d = new Date();
            d.setFullYear(d.getFullYear() - age);
            return d.toISOString().split('T')[0];
        };
        for (let i = 0; i < count; i++) {
            const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
            const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
            const suffix = `${baseTs}${i}`;
            const name = `${fn} ${ln}`;
            const email = `${fn.toLowerCase()}.${ln.toLowerCase()}.${suffix}@fitwayhub.coach`;
            const femaleFirsts = ['Mina', 'Nadine', 'Rania', 'Mariam', 'Salma', 'Lina'];
            const gender = femaleFirsts.includes(fn) ? 'female' : 'male';
            const height = gender === 'male' ? rand(170, 190) : rand(158, 175);
            const weight = gender === 'male' ? rand(70, 95) : rand(52, 72);
            const dob = dobFromAge(rand(25, 42));
            const city = CITIES[i % CITIES.length];
            const steps = 9000 + Math.floor(Math.random() * 7000);
            const points = 800 + Math.floor(Math.random() * 2200);
            const monthlyPrice = [149, 199, 249, 299][i % 4];
            const yearlyPrice = monthlyPrice * 10;
            const specialty = SPECIALTIES[i % SPECIALTIES.length];
            const bio = BIOS[i % BIOS.length];
            const credit = 1000;
            try {
                const { insertId } = await run(`INSERT INTO users (email, password, name, role, avatar,
            gender, height, weight, date_of_birth, city,
            is_premium, membership_paid, coach_membership_active,
            email_verified, onboarding_done, credit,
            points, steps, step_goal)
           VALUES (?, ?, ?, 'coach', ?, ?, ?, ?, ?, ?, 0, 1, 1, 1, 1, ?, ?, ?, 12000)`, [email, hashed, name, null, gender, height, weight, dob, city, credit, points, steps]);
                // Stub coach_profiles row so the coach is visible in the directory.
                try {
                    await run(`INSERT INTO coach_profiles (user_id, bio, specialty, location, price, available, plan_types, monthly_price, yearly_price)
             VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`, [insertId, bio, specialty, city, monthlyPrice, 'monthly,yearly', monthlyPrice, yearlyPrice]);
                }
                catch { /* table may not exist on legacy installs — skip */ }
                created.push(name);
                newCoachIds.push(Number(insertId));
            }
            catch {
                // Skip duplicates and continue.
            }
        }
        // Make the new coaches participate in the app like real coaches:
        // posts, comments, likes, follows from users, subscriptions, etc.
        try {
            await seedActivitiesForFakeAccounts(newCoachIds, 'coach');
        }
        catch (e) {
            console.warn('[generate-coach-profiles] activity seeding failed:', e?.message);
        }
        res.json({ message: `Created ${created.length} coach profiles`, coaches: created });
    }
    catch (err) {
        res.status(500).json({ message: 'Failed to generate coach profiles', error: err?.message || 'Unknown error' });
    }
});
// Remove every fake coach created by /generate-coach-profiles. The marker is
// the @fitwayhub.coach email domain — real coaches don't get that domain so
// this can't touch genuine accounts. Mirrors the cleanup table list used by
// /fake-users so FK constraints don't trip the delete.
router.post('/remove-fake-coaches', authenticateToken, adminOnly, async (_req, res) => {
    try {
        const fakeCoaches = await query(`SELECT id FROM users WHERE role = 'coach' AND email LIKE '%@fitwayhub.coach'`);
        if (!fakeCoaches.length)
            return res.json({ removed: 0, message: 'No fake coaches found' });
        const ids = fakeCoaches.map((u) => Number(u.id)).filter((id) => id > 0);
        const placeholders = ids.map(() => '?').join(',');
        await run('SET FOREIGN_KEY_CHECKS = 0');
        const cleanupTables = [
            { sql: `DELETE FROM post_likes WHERE user_id IN (${placeholders})` },
            { sql: `DELETE FROM post_comments WHERE user_id IN (${placeholders})` },
            { sql: `DELETE FROM posts WHERE user_id IN (${placeholders})` },
            { sql: `DELETE FROM messages WHERE sender_id IN (${placeholders}) OR receiver_id IN (${placeholders})`, double: true },
            { sql: `DELETE FROM coach_subscriptions WHERE user_id IN (${placeholders}) OR coach_id IN (${placeholders})`, double: true },
            { sql: `DELETE FROM payments WHERE user_id IN (${placeholders})` },
            { sql: `DELETE FROM gifts WHERE user_id IN (${placeholders})` },
            { sql: `DELETE FROM user_follows WHERE follower_id IN (${placeholders}) OR following_id IN (${placeholders})`, double: true },
            { sql: `DELETE FROM coach_follows WHERE follower_id IN (${placeholders}) OR coach_id IN (${placeholders})`, double: true },
            { sql: `DELETE FROM chat_requests WHERE sender_id IN (${placeholders}) OR receiver_id IN (${placeholders})`, double: true },
            { sql: `DELETE FROM workout_plans WHERE user_id IN (${placeholders}) OR coach_id IN (${placeholders})`, double: true },
            { sql: `DELETE FROM nutrition_plans WHERE user_id IN (${placeholders}) OR coach_id IN (${placeholders})`, double: true },
            { sql: `DELETE FROM notifications WHERE user_id IN (${placeholders})` },
            { sql: `DELETE FROM credit_transactions WHERE user_id IN (${placeholders})` },
            { sql: `DELETE FROM coaching_meetings WHERE user_id IN (${placeholders}) OR coach_id IN (${placeholders})`, double: true },
            { sql: `DELETE FROM withdrawal_requests WHERE coach_id IN (${placeholders})` },
            { sql: `DELETE FROM push_tokens WHERE user_id IN (${placeholders})` },
            { sql: `DELETE FROM push_log WHERE user_id IN (${placeholders})` },
            { sql: `DELETE FROM coach_ads WHERE coach_id IN (${placeholders})` },
            { sql: `DELETE FROM ad_payments WHERE coach_id IN (${placeholders})` },
            { sql: `DELETE FROM coach_reviews WHERE user_id IN (${placeholders}) OR coach_id IN (${placeholders})`, double: true },
            { sql: `DELETE FROM coach_reports WHERE user_id IN (${placeholders}) OR coach_id IN (${placeholders})`, double: true },
            { sql: `DELETE FROM coaching_bookings WHERE user_id IN (${placeholders}) OR coach_id IN (${placeholders})`, double: true },
            { sql: `DELETE FROM certification_requests WHERE coach_id IN (${placeholders})` },
            { sql: `DELETE FROM coach_profiles WHERE user_id IN (${placeholders})` },
        ];
        let removed = 0;
        try {
            for (const step of cleanupTables) {
                try {
                    const params = step.double ? [...ids, ...ids] : ids;
                    await run(step.sql, params);
                }
                catch { /* some optional tables may not exist */ }
            }
            const result = await run(`DELETE FROM users WHERE id IN (${placeholders})`, ids);
            removed = result?.affectedRows ?? ids.length;
        }
        finally {
            await run('SET FOREIGN_KEY_CHECKS = 1');
        }
        res.json({ removed, message: `Removed ${removed} fake coach${removed === 1 ? '' : 'es'}` });
    }
    catch (err) {
        try {
            await run('SET FOREIGN_KEY_CHECKS = 1');
        }
        catch { }
        res.status(500).json({ message: 'Failed to remove fake coaches', error: err?.message || 'Unknown error' });
    }
});
// ── Fake Accounts Generator ──────────────────────────────────────────────────
// ── Moderator area gating (§17) ─────────────────────────────────────────────
// The gate + the permission store now live in one place
// (server/middleware/moderator.ts) and are DEFAULT-DENY: a moderator only
// reaches an area an admin has explicitly granted in Settings → Moderators.
// `modPerm` is kept as a local alias so the route definitions below read the
// same as before.
const modPerm = requireModeratorArea;
// ── Moderator permissions (admin-managed) ───────────────────────────────────
router.get('/moderator-permissions', authenticateToken, adminOnly, async (_req, res) => {
    const perms = await getModeratorPermissions();
    res.json({ permissions: perms || {} });
});
router.put('/moderator-permissions', authenticateToken, adminOnly, async (req, res) => {
    try {
        const perms = req.body?.permissions || {};
        const value = JSON.stringify(perms);
        const existing = await get("SELECT id FROM app_settings WHERE setting_key = 'moderator_permissions'");
        if (existing) {
            await run("UPDATE app_settings SET setting_value = ? WHERE setting_key = 'moderator_permissions'", [value]);
        }
        else {
            await run("INSERT INTO app_settings (setting_key, setting_value, setting_type, category, label) VALUES ('moderator_permissions', ?, 'json', 'access', 'Moderator permissions')", [value]);
        }
        res.json({ message: 'Moderator permissions saved', permissions: perms });
    }
    catch {
        res.status(500).json({ message: 'Failed to save moderator permissions' });
    }
});
// Community moderation endpoints
router.get('/community/posts', authenticateToken, modPerm('community_view'), async (_req, res) => {
    try {
        const posts = await query(`
      SELECT p.*, u.name as user_name, u.avatar as user_avatar, u.email as user_email, u.role as user_role,
             (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes,
             (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) as comment_count,
             mu.name as moderator_name
      FROM posts p 
      JOIN users u ON p.user_id = u.id 
      LEFT JOIN users mu ON p.moderated_by = mu.id
      ORDER BY p.is_pinned DESC, p.is_announcement DESC, p.created_at DESC LIMIT 200`);
        res.json({ posts });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch posts' });
    }
});
// ── Create announcement post ─────────────────────────────────────────────────
router.post('/community/announcements', authenticateToken, modPerm('community_moderate'), async (req, res) => {
    try {
        const { content, hashtags } = req.body;
        if (!content || !content.trim())
            return res.status(400).json({ message: 'Content is required' });
        const result = await run('INSERT INTO posts (user_id, content, hashtags, is_announcement, is_pinned) VALUES (?, ?, ?, 1, 1)', [req.user.id, content.trim(), hashtags || null]);
        await logModeratorAction(req, { area: 'community_moderate', action: 'announcement_create', targetType: 'post', targetId: result.insertId });
        res.json({ message: 'Announcement posted', postId: result.insertId });
    }
    catch {
        res.status(500).json({ message: 'Failed to create announcement' });
    }
});
// ── Toggle pin on a post ─────────────────────────────────────────────────────
router.patch('/community/posts/:id/pin', authenticateToken, modPerm('community_moderate'), async (req, res) => {
    try {
        const post = await get('SELECT is_pinned FROM posts WHERE id = ?', [req.params.id]);
        if (!post)
            return res.status(404).json({ message: 'Post not found' });
        const newVal = post.is_pinned ? 0 : 1;
        await run('UPDATE posts SET is_pinned = ? WHERE id = ?', [newVal, req.params.id]);
        await logModeratorAction(req, { area: 'community_moderate', action: newVal ? 'post_pin' : 'post_unpin', targetType: 'post', targetId: req.params.id });
        res.json({ message: newVal ? 'Post pinned' : 'Post unpinned', is_pinned: newVal });
    }
    catch {
        res.status(500).json({ message: 'Failed to toggle pin' });
    }
});
router.patch('/community/posts/:id/hide', authenticateToken, modPerm('community_moderate'), async (req, res) => {
    try {
        const { reason } = req.body;
        await run('UPDATE posts SET is_hidden = 1, moderated_by = ?, moderation_reason = ? WHERE id = ?', [req.user.id, reason || 'Policy violation', req.params.id]);
        await logModeratorAction(req, { area: 'community_moderate', action: 'post_hide', targetType: 'post', targetId: req.params.id, details: { reason: reason || 'Policy violation' } });
        res.json({ message: 'Post hidden' });
    }
    catch {
        res.status(500).json({ message: 'Failed to hide post' });
    }
});
router.patch('/community/posts/:id/restore', authenticateToken, modPerm('community_moderate'), async (req, res) => {
    try {
        await run('UPDATE posts SET is_hidden = 0, moderated_by = NULL, moderation_reason = NULL WHERE id = ?', [req.params.id]);
        await logModeratorAction(req, { area: 'community_moderate', action: 'post_restore', targetType: 'post', targetId: req.params.id });
        res.json({ message: 'Post restored' });
    }
    catch {
        res.status(500).json({ message: 'Failed to restore post' });
    }
});
router.delete('/community/posts/:id', authenticateToken, modPerm('community_moderate'), async (req, res) => {
    try {
        await run('DELETE FROM posts WHERE id = ?', [req.params.id]);
        await logModeratorAction(req, { area: 'community_moderate', action: 'post_delete', targetType: 'post', targetId: req.params.id });
        res.json({ message: 'Post deleted' });
    }
    catch {
        res.status(500).json({ message: 'Failed to delete post' });
    }
});
// (role update handled by original route above - extended to support moderator)
// ── Community stats ──────────────────────────────────────────────────────────
router.get('/community/stats', authenticateToken, modPerm('community_view'), async (_req, res) => {
    try {
        const [totalPosts] = await query('SELECT COUNT(*) as cnt FROM posts');
        const [hiddenPosts] = await query('SELECT COUNT(*) as cnt FROM posts WHERE is_hidden = 1');
        const [totalComments] = await query('SELECT COUNT(*) as cnt FROM post_comments');
        const [totalChallenges] = await query('SELECT COUNT(*) as cnt FROM challenges');
        const [activeChallenges] = await query('SELECT COUNT(*) as cnt FROM challenges WHERE end_date >= CURDATE()');
        const [totalLikes] = await query('SELECT IFNULL(SUM(likes),0) as total FROM posts');
        res.json({
            totalPosts: totalPosts.cnt,
            hiddenPosts: hiddenPosts.cnt,
            totalComments: totalComments.cnt,
            totalChallenges: totalChallenges.cnt,
            activeChallenges: activeChallenges.cnt,
            totalLikes: totalLikes.total,
        });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch community stats' });
    }
});
// ── Community challenges (admin) ──────────────────────────────────────────────
router.get('/community/challenges', authenticateToken, modPerm('challenges_view'), async (_req, res) => {
    try {
        const challenges = await query(`
      SELECT c.*, u.name as creator_name, u.email as creator_email, u.avatar as creator_avatar,
             (SELECT COUNT(*) FROM challenge_participants WHERE challenge_id = c.id) as participant_count
      FROM challenges c
      LEFT JOIN users u ON c.creator_id = u.id
      ORDER BY c.created_at DESC LIMIT 100`);
        res.json({ challenges });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch challenges' });
    }
});
router.post('/community/challenges', authenticateToken, adminOnly, async (req, res) => {
    try {
        const { title, description, start_date, end_date, image_url } = req.body || {};
        if (!title || !String(title).trim())
            return res.status(400).json({ message: 'Title is required' });
        const ins = await run('INSERT INTO challenges (creator_id, title, description, start_date, end_date, image_url) VALUES (?,?,?,?,?,?)', [req.user.id, String(title).trim(), description || null, start_date || null, end_date || null, image_url || null]);
        res.json({ message: 'Challenge created', id: ins?.insertId });
    }
    catch {
        res.status(500).json({ message: 'Failed to create challenge' });
    }
});
router.patch('/community/challenges/:id', authenticateToken, adminOnly, async (req, res) => {
    try {
        const { title, description, start_date, end_date, image_url } = req.body || {};
        await run('UPDATE challenges SET title = COALESCE(?, title), description = ?, start_date = ?, end_date = ?, image_url = ? WHERE id = ?', [title != null ? String(title).trim() : null, description ?? null, start_date ?? null, end_date ?? null, image_url ?? null, req.params.id]);
        res.json({ message: 'Challenge updated' });
    }
    catch {
        res.status(500).json({ message: 'Failed to update challenge' });
    }
});
router.delete('/community/challenges/:id', authenticateToken, adminOnly, async (req, res) => {
    try {
        // Remove dependent rows first so the FK on challenge_participants (and any
        // challenge group-chat messages) doesn't block the delete.
        await run('DELETE FROM challenge_participants WHERE challenge_id = ?', [req.params.id]).catch(() => { });
        await run('DELETE FROM messages WHERE challenge_id = ?', [req.params.id]).catch(() => { });
        await run('DELETE FROM challenges WHERE id = ?', [req.params.id]);
        res.json({ message: 'Challenge deleted' });
    }
    catch (err) {
        res.status(500).json({ message: err?.message || 'Failed to delete challenge' });
    }
});
// ── Community comments (admin) ────────────────────────────────────────────────
router.get('/community/comments', authenticateToken, modPerm('community_view'), async (_req, res) => {
    try {
        const comments = await query(`
      SELECT pc.*, u.name as user_name, u.email as user_email, u.avatar as user_avatar,
             p.content as post_preview
      FROM post_comments pc
      LEFT JOIN users u ON pc.user_id = u.id
      LEFT JOIN posts p ON pc.post_id = p.id
      ORDER BY pc.created_at DESC LIMIT 200`);
        res.json({ comments });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch comments' });
    }
});
router.delete('/community/comments/:id', authenticateToken, modPerm('community_moderate'), async (req, res) => {
    try {
        await run('DELETE FROM post_comments WHERE id = ?', [req.params.id]);
        await logModeratorAction(req, { area: 'community_moderate', action: 'comment_delete', targetType: 'comment', targetId: req.params.id });
        res.json({ message: 'Comment deleted' });
    }
    catch {
        res.status(500).json({ message: 'Failed to delete comment' });
    }
});
// ── Moderation audit log (admin-only) ────────────────────────────────────────
// Read-only view of every privileged moderation action (§17). Admin-only so a
// moderator can't inspect or covertly prune the trail of their own actions.
router.get('/moderator-audit-log', authenticateToken, adminOnly, async (req, res) => {
    try {
        const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '100'), 10) || 100, 1), 500);
        const logs = await query(`
      SELECT mal.*, u.name as actor_name, u.email as actor_email
      FROM moderator_audit_log mal
      LEFT JOIN users u ON mal.actor_id = u.id
      ORDER BY mal.created_at DESC
      LIMIT ?`, [limit]);
        res.json({ logs });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch audit log' });
    }
});
// ── App Settings ─────────────────────────────────────────────────────────────
router.get('/app-settings', authenticateToken, adminOnly, async (_req, res) => {
    try {
        // Ensure all default settings exist (INSERT IGNORE is safe to call repeatedly)
        await seedDefaultAppSettings();
        const rows = await query('SELECT * FROM app_settings ORDER BY category, id');
        const byCategory = {};
        for (const r of rows) {
            if (!byCategory[r.category])
                byCategory[r.category] = [];
            byCategory[r.category].push(r);
        }
        res.json({ settings: rows, byCategory });
    }
    catch (err) {
        console.error('[app-settings] ERROR:', err?.message || err);
        res.status(500).json({ message: 'Failed to fetch settings' });
    }
});
router.put('/app-settings', authenticateToken, adminOnly, async (req, res) => {
    try {
        const updates = req.body;
        for (const [key, value] of Object.entries(updates)) {
            await run('UPDATE app_settings SET setting_value = ? WHERE setting_key = ?', [value, key]);
        }
        res.json({ message: 'Settings saved' });
    }
    catch {
        res.status(500).json({ message: 'Failed to save settings' });
    }
});
router.post('/app-settings/add', authenticateToken, adminOnly, async (req, res) => {
    try {
        const { key, value, type, category, label } = req.body;
        if (!key || !category)
            return res.status(400).json({ message: 'Key and category are required' });
        const safeKey = String(key).replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 100);
        const existing = await get('SELECT id FROM app_settings WHERE setting_key = ?', [safeKey]);
        if (existing)
            return res.status(409).json({ message: 'Setting already exists' });
        await run('INSERT INTO app_settings (setting_key, setting_value, setting_type, category, label) VALUES (?, ?, ?, ?, ?)', [safeKey, value || '', type || 'text', category, label || safeKey]);
        res.json({ message: 'Setting added', key: safeKey });
    }
    catch {
        res.status(500).json({ message: 'Failed to add setting' });
    }
});
router.delete('/app-settings/:key', authenticateToken, adminOnly, async (req, res) => {
    try {
        const safeKey = String(req.params.key).replace(/[^a-zA-Z0-9_]/g, '_');
        await run('DELETE FROM app_settings WHERE setting_key = ?', [safeKey]);
        res.json({ message: 'Setting deleted' });
    }
    catch {
        res.status(500).json({ message: 'Failed to delete setting' });
    }
});
// ── Coach membership management ──────────────────────────────────────────────
router.patch('/users/:id/coach-membership', authenticateToken, adminOnly, async (req, res) => {
    const { membership_paid, coach_membership_active } = req.body;
    try {
        await run('UPDATE users SET membership_paid = ?, coach_membership_active = ? WHERE id = ?', [membership_paid ? 1 : 0, membership_paid ? 1 : 0, req.params.id]);
        res.json({ message: 'Coach membership updated' });
    }
    catch {
        res.status(500).json({ message: 'Failed to update membership' });
    }
});
// ── Coach certification management ────────────────────────────────────────────
// List all certification requests
router.get('/certification-requests', authenticateToken, adminOnly, async (_req, res) => {
    try {
        const requests = await query(`SELECT cr.*, u.name as coach_name, u.email as coach_email, u.avatar as coach_avatar,
              cp.specialty, cp.certified, cp.certified_until,
              reviewer.name as reviewer_name
       FROM certification_requests cr
       JOIN users u ON cr.coach_id = u.id
       LEFT JOIN coach_profiles cp ON cp.user_id = u.id
       LEFT JOIN users reviewer ON cr.reviewed_by = reviewer.id
       ORDER BY FIELD(cr.status, 'pending', 'approved', 'rejected'), cr.created_at DESC`);
        res.json({ requests });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch certification requests' });
    }
});
// Approve or reject a certification request
router.patch('/certification-requests/:id', authenticateToken, adminOnly, async (req, res) => {
    const { action, admin_notes } = req.body;
    if (!['approve', 'reject'].includes(action))
        return res.status(400).json({ message: 'Invalid action' });
    try {
        const request = await get('SELECT * FROM certification_requests WHERE id = ?', [req.params.id]);
        if (!request)
            return res.status(404).json({ message: 'Request not found' });
        if (request.status !== 'pending')
            return res.status(400).json({ message: 'Request already reviewed' });
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        if (action === 'approve') {
            // Set certified = 1 and certified_until = 1 month from now
            const d = new Date();
            d.setMonth(d.getMonth() + 1);
            const until = d.toISOString().slice(0, 19).replace('T', ' ');
            const existing = await get('SELECT id FROM coach_profiles WHERE user_id = ?', [request.coach_id]);
            if (existing) {
                await run('UPDATE coach_profiles SET certified = 1, certified_until = ? WHERE user_id = ?', [until, request.coach_id]);
            }
            else {
                await run('INSERT INTO coach_profiles (user_id, certified, certified_until) VALUES (?, 1, ?)', [request.coach_id, until]);
            }
            // Update request status
            await run('UPDATE certification_requests SET status = ?, admin_notes = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?', ['approved', admin_notes || null, req.user.id, now, req.params.id]);
            // Notify coach
            {
                const nTitle = '✅ Certification Approved!';
                const nBody = `Your certification has been approved! You are now a Certified Coach until ${new Date(until).toLocaleDateString()}.`;
                await run('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?)', [request.coach_id, 'certification', nTitle, nBody, '/coach/profile']);
                sendPushToUser(request.coach_id, nTitle, nBody, undefined, '/coach/profile', 'certification').catch(() => { });
            }
        }
        else {
            // Reject — refund the payment
            if (request.amount_paid > 0) {
                await run('UPDATE users SET credit = credit + ? WHERE id = ?', [request.amount_paid, request.coach_id]);
                await run('INSERT INTO credit_transactions (user_id, amount, type, description) VALUES (?, ?, ?, ?)', [request.coach_id, request.amount_paid, 'certification_refund', `Certification request rejected - ${request.amount_paid} EGP refunded`]);
            }
            await run('UPDATE certification_requests SET status = ?, admin_notes = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?', ['rejected', admin_notes || null, req.user.id, now, req.params.id]);
            // Notify coach
            {
                const nTitle = '❌ Certification Rejected';
                const nBody = `Your certification request was rejected.${admin_notes ? ' Reason: ' + admin_notes : ''} Your payment of ${request.amount_paid} EGP has been refunded.`;
                await run('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?)', [request.coach_id, 'certification', nTitle, nBody, '/coach/profile']);
                sendPushToUser(request.coach_id, nTitle, nBody, undefined, '/coach/profile', 'certification').catch(() => { });
            }
        }
        res.json({ message: `Certification request ${action}d successfully` });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to update certification request' });
    }
});
// Admin can also directly grant/revoke (legacy endpoint)
router.patch('/users/:id/certification', authenticateToken, adminOnly, async (req, res) => {
    const { certified } = req.body;
    try {
        const existing = await get('SELECT id FROM coach_profiles WHERE user_id = ?', [req.params.id]);
        if (!existing)
            return res.status(404).json({ message: 'Coach profile not found' });
        if (certified) {
            const d = new Date();
            d.setMonth(d.getMonth() + 1);
            const until = d.toISOString().slice(0, 19).replace('T', ' ');
            await run('UPDATE coach_profiles SET certified = 1, certified_until = ? WHERE user_id = ?', [until, req.params.id]);
        }
        else {
            await run('UPDATE coach_profiles SET certified = 0, certified_until = NULL WHERE user_id = ?', [req.params.id]);
        }
        res.json({ message: `Coach certification ${certified ? 'granted' : 'revoked'}` });
    }
    catch {
        res.status(500).json({ message: 'Failed to update certification' });
    }
});
// ── Coach reports moderation ───────────────────────────────────────────────
router.get('/coach-reports', authenticateToken, adminOnly, async (_req, res) => {
    try {
        const reports = await query(`SELECT cr.*, 
              coach.name as coach_name, coach.email as coach_email, coach.avatar as coach_avatar,
              reporter.name as user_name, reporter.email as user_email,
              reviewer.name as reviewer_name
       FROM coach_reports cr
       JOIN users coach ON coach.id = cr.coach_id
       JOIN users reporter ON reporter.id = cr.user_id
       LEFT JOIN users reviewer ON reviewer.id = cr.reviewed_by
       ORDER BY FIELD(cr.status, 'pending', 'resolved', 'dismissed'), cr.created_at DESC`);
        res.json({ reports });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch coach reports' });
    }
});
router.patch('/coach-reports/:id', authenticateToken, adminOnly, async (req, res) => {
    const { status, admin_notes } = req.body || {};
    if (!['resolved', 'dismissed'].includes(status)) {
        return res.status(400).json({ message: 'Status must be resolved or dismissed' });
    }
    try {
        const report = await get('SELECT * FROM coach_reports WHERE id = ?', [req.params.id]);
        if (!report)
            return res.status(404).json({ message: 'Report not found' });
        if (report.status !== 'pending')
            return res.status(400).json({ message: 'Report already reviewed' });
        await run('UPDATE coach_reports SET status = ?, admin_notes = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?', [status, admin_notes ? String(admin_notes).trim().slice(0, 3000) : null, req.user.id, req.params.id]);
        const title = status === 'resolved' ? 'Your report was resolved' : 'Your report was reviewed';
        const body = status === 'resolved'
            ? 'Thank you. We reviewed your coach report and took action according to our policy.'
            : 'We reviewed your coach report and did not find enough evidence for action right now.';
        await run('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)', [report.user_id, 'coach_report', title, body, '/app/coaching']);
        sendPushToUser(report.user_id, title, body, undefined, '/app/coaching', 'coach_report').catch(() => { });
        res.json({ message: 'Report updated successfully' });
    }
    catch {
        res.status(500).json({ message: 'Failed to update report' });
    }
});
// ── Public font settings (no auth — used by CSS loader) ──────────────────────
router.get('/fonts', async (_req, res) => {
    try {
        const rows = await query("SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('font_en','font_ar','font_heading')");
        const fonts = {};
        for (const r of rows)
            fonts[r.setting_key] = r.setting_value;
        res.json(fonts);
    }
    catch {
        res.json({ font_en: 'Outfit', font_ar: 'Cairo', font_heading: 'Chakra Petch' });
    }
});
// ── Public branding settings (no auth — used by frontend BrandingContext) ────
router.get('/branding', async (_req, res) => {
    try {
        const rows = await query("SELECT setting_key, setting_value FROM app_settings WHERE category = 'branding'");
        const branding = {};
        for (const r of rows)
            branding[r.setting_key] = r.setting_value || '';
        res.json(branding);
    }
    catch {
        res.json({ app_name: 'FitWay Hub' });
    }
});
// ── Public feature toggles (no auth — used by app/coach navigation) ─────────
router.get('/features', async (_req, res) => {
    try {
        const rows = await query("SELECT setting_key, setting_value FROM app_settings WHERE category = 'features'");
        const features = {};
        for (const r of rows) {
            const raw = String(r.setting_value ?? '').toLowerCase();
            features[r.setting_key] = raw === '1' || raw === 'true' || raw === 'on';
        }
        res.json({ features });
    }
    catch {
        res.json({ features: {} });
    }
});
// ── Per-user feature access ─────────────────────────────────────────────────
// Global feature flags merged with the authenticated user's personal overrides.
// Lets the app grant a feature to a specific user even when it's off globally
// (or hide one that's on globally). Falls back to the global map on any error.
router.get('/features/me', authenticateToken, async (req, res) => {
    try {
        const rows = await query("SELECT setting_key, setting_value FROM app_settings WHERE category = 'features'");
        const features = {};
        for (const r of rows) {
            const raw = String(r.setting_value ?? '').toLowerCase();
            features[r.setting_key] = raw === '1' || raw === 'true' || raw === 'on';
        }
        const overrides = await query('SELECT feature_key, enabled FROM user_feature_overrides WHERE user_id = ?', [req.user.id]);
        for (const o of overrides)
            features[o.feature_key] = Number(o.enabled) === 1;
        res.json({ features });
    }
    catch {
        res.json({ features: {} });
    }
});
// Admin: list per-user feature overrides (with the username they apply to).
router.get('/feature-access', authenticateToken, adminOnly, async (_req, res) => {
    try {
        const rows = await query(`SELECT o.id, o.user_id, o.feature_key, o.enabled, u.name AS user_name, u.email AS user_email
       FROM user_feature_overrides o JOIN users u ON u.id = o.user_id
       ORDER BY o.created_at DESC`);
        res.json({ overrides: rows });
    }
    catch {
        res.status(500).json({ message: 'Failed to load feature access' });
    }
});
// Admin: grant/revoke a feature for a specific username (or email).
router.post('/feature-access', authenticateToken, adminOnly, async (req, res) => {
    try {
        const username = String(req.body?.username || '').trim();
        const featureKey = String(req.body?.feature_key || '').trim();
        const enabled = req.body?.enabled === false || req.body?.enabled === 0 || req.body?.enabled === '0' ? 0 : 1;
        if (!username || !featureKey)
            return res.status(400).json({ message: 'Username and feature are required.' });
        const target = await get('SELECT id, name FROM users WHERE name = ? OR email = ? LIMIT 1', [username, username]);
        if (!target)
            return res.status(404).json({ message: `No user found matching "${username}".` });
        await run(`INSERT INTO user_feature_overrides (user_id, feature_key, enabled) VALUES (?,?,?)
       ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)`, [target.id, featureKey, enabled]);
        res.json({ message: `${enabled ? 'Granted' : 'Revoked'} "${featureKey}" for ${target.name}.` });
    }
    catch {
        res.status(500).json({ message: 'Failed to save feature access' });
    }
});
// Admin: remove a per-user override (reverts the user to the global setting).
router.delete('/feature-access/:id', authenticateToken, adminOnly, async (req, res) => {
    try {
        await run('DELETE FROM user_feature_overrides WHERE id = ?', [req.params.id]);
        res.json({ message: 'Override removed.' });
    }
    catch {
        res.status(500).json({ message: 'Failed to remove override' });
    }
});
// ── Public dashboard config ──────────────────────────────────────────────────
router.get('/dashboard-config', async (_req, res) => {
    try {
        const rows = await query("SELECT setting_key, setting_value, setting_type FROM app_settings WHERE category = 'dashboard'");
        const config = {};
        for (const r of rows) {
            const raw = String(r.setting_value ?? '');
            if (r.setting_type === 'boolean') {
                config[r.setting_key] = raw === '1' || raw === 'true' || raw === 'on';
            }
            else {
                config[r.setting_key] = raw;
            }
        }
        res.json({ config });
    }
    catch {
        res.json({ config: {} });
    }
});
// ── Branding image upload (logo / favicon) ───────────────────────────────────
// Branding assets are stored inline as base64 data URLs in app_settings rather
// than written to disk or R2. Reasons:
//   • The local-disk fallback is wiped on every redeploy on Railway/Render-style
//     hosts, which makes the logo "disappear" once you push a new build.
//   • Branding images are small (logos, favicons, the Coming Soon background)
//     and rarely change, so inlining them avoids an extra HTTP round-trip.
// Falls back to R2 if a file would exceed INLINE_LIMIT after optimisation —
// for the typical logo/favicon/SVG path that branch never triggers.
const INLINE_LIMIT = 1.5 * 1024 * 1024; // 1.5 MB
router.post('/upload-branding-image', authenticateToken, adminOnly, multerToJson(uploadBranding.single('image')), sanitiseSvgIfPresent, optimizeImage(), async (req, res) => {
    try {
        if (!req.file)
            return res.status(400).json({ message: 'No image file provided' });
        if (req.file.buffer && req.file.buffer.length <= INLINE_LIMIT) {
            const mime = req.file.mimetype || 'application/octet-stream';
            const dataUrl = `data:${mime};base64,${req.file.buffer.toString('base64')}`;
            return res.json({ url: dataUrl });
        }
        const imageUrl = await uploadToR2(req.file, 'branding');
        res.json({ url: imageUrl });
    }
    catch (err) {
        console.error('[upload-branding-image]', err);
        res.status(500).json({ message: err?.message || 'Image upload failed' });
    }
});
// ── Dashboard image upload ───────────────────────────────────────────────────
router.post('/upload-dashboard-image', authenticateToken, adminOnly, multerToJson(uploadBranding.single('image')), optimizeImage(), async (req, res) => {
    try {
        if (!req.file)
            return res.status(400).json({ message: 'No image file provided' });
        const imageUrl = await uploadToR2(req.file, 'dashboard');
        res.json({ url: imageUrl });
    }
    catch (err) {
        console.error('[upload-dashboard-image]', err);
        res.status(500).json({ message: err?.message || 'Image upload failed' });
    }
});
// ── Font file upload ─────────────────────────────────────────────────────────
router.post('/upload-font', authenticateToken, adminOnly, uploadFont.single('font'), verifyUploadBytes('font'), async (req, res) => {
    try {
        if (!req.file)
            return res.status(400).json({ message: 'No font file provided' });
        const fontUrl = await uploadToR2(req.file, 'fonts');
        const fontName = req.body.font_name || req.file.originalname.replace(/\.[^.]+$/, '');
        res.json({ url: fontUrl, name: fontName });
    }
    catch {
        res.status(500).json({ message: 'Font upload failed' });
    }
});
export default router;
// ── Database backup download ─────────────────────────────────────────────────
router.get('/backup/database', authenticateToken, adminOnly, async (_req, res) => {
    try {
        const pool = getPool();
        // Get all table names
        const [tables] = await pool.execute(`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME`);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const dbName = process.env.DB_NAME || process.env.MYSQL_DATABASE || 'fitwayhub';
        let sql = '';
        sql += `-- FitWay Hub Database Backup\n`;
        sql += `-- Generated: ${new Date().toISOString()}\n`;
        sql += `-- Database: ${dbName}\n`;
        sql += `-- --------------------------------------------------------\n\n`;
        sql += `SET FOREIGN_KEY_CHECKS=0;\n`;
        sql += `SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";\n`;
        sql += `SET time_zone = "+00:00";\n\n`;
        for (const tableRow of tables) {
            const tableName = tableRow.TABLE_NAME;
            // CREATE TABLE statement
            const [createRows] = await pool.execute(`SHOW CREATE TABLE \`${tableName}\``);
            const createStmt = createRows[0]['Create Table'];
            sql += `-- --------------------------------------------------------\n`;
            sql += `-- Table: \`${tableName}\`\n`;
            sql += `-- --------------------------------------------------------\n\n`;
            sql += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
            sql += createStmt + ';\n\n';
            // INSERT rows
            const [rows] = await pool.execute(`SELECT * FROM \`${tableName}\``);
            if (Array.isArray(rows) && rows.length > 0) {
                const cols = Object.keys(rows[0]).map(c => `\`${c}\``).join(', ');
                const escVal = (v) => {
                    if (v === null || v === undefined)
                        return 'NULL';
                    if (typeof v === 'number')
                        return String(v);
                    if (v instanceof Date)
                        return `'${v.toISOString().slice(0, 19).replace('T', ' ')}'`;
                    if (typeof v === 'boolean')
                        return v ? '1' : '0';
                    const str = String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
                    return `'${str}'`;
                };
                sql += `INSERT INTO \`${tableName}\` (${cols}) VALUES\n`;
                const valueRows = rows.map(row => '(' + Object.values(row).map(escVal).join(', ') + ')');
                // Batch inserts every 500 rows
                for (let i = 0; i < valueRows.length; i += 500) {
                    const batch = valueRows.slice(i, i + 500);
                    if (i > 0)
                        sql += `INSERT INTO \`${tableName}\` (${cols}) VALUES\n`;
                    sql += batch.join(',\n') + ';\n';
                }
                sql += '\n';
            }
        }
        sql += `SET FOREIGN_KEY_CHECKS=1;\n`;
        sql += `-- End of backup\n`;
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="fitwayhub-backup-${timestamp}.sql"`);
        res.setHeader('Content-Length', Buffer.byteLength(sql, 'utf8'));
        res.send(sql);
    }
    catch (err) {
        console.error('[DB Backup] error:', err);
        res.status(500).json({ message: 'Backup failed', error: process.env.NODE_ENV !== 'production' ? String(err) : undefined });
    }
});
// ── Database restore (upload .sql) ───────────────────────────────────────────
router.post('/backup/restore', authenticateToken, adminOnly, upload.single('file'), async (req, res) => {
    try {
        if (!req.file)
            return res.status(400).json({ message: 'No SQL file uploaded' });
        const sql = req.file.buffer.toString('utf8');
        if (!sql.trim())
            return res.status(400).json({ message: 'Empty SQL file' });
        const pool = getPool();
        // Split by semicolons, filtering out empty statements and comments-only
        const statements = sql
            .split(/;\s*\n/)
            .map((s) => s.trim())
            .filter((s) => s && !s.startsWith('--'));
        let executed = 0;
        let errors = [];
        for (const stmt of statements) {
            if (!stmt)
                continue;
            try {
                await pool.execute(stmt);
                executed++;
            }
            catch (err) {
                errors.push(`Statement ${executed + 1}: ${err.message?.slice(0, 100)}`);
            }
        }
        res.json({ message: `Restore complete: ${executed} statements executed`, errors: errors.length ? errors.slice(0, 10) : undefined });
    }
    catch (err) {
        console.error('[DB Restore] error:', err);
        res.status(500).json({ message: 'Restore failed', error: process.env.NODE_ENV !== 'production' ? String(err) : undefined });
    }
});
// ── Generate fake user accounts ──────────────────────────────────────────────
router.post('/generate-fake-users', authenticateToken, adminOnly, async (req, res) => {
    try {
        const count = Math.min(500, Math.max(1, parseInt(req.body.count) || 10));
        const bcrypt = (await import('bcryptjs')).default;
        const { run: dbRun } = await import('../config/database.js');
        const MALE_NAMES = ['Ahmed Hassan', 'Omar Khalid', 'Youssef Ibrahim', 'Karim Mostafa', 'Tarek Nabil', 'Mohamed Farouk', 'Amir Saleh', 'Ziad Tamer', 'Sherif Adel', 'Hossam Wael', 'Mahmoud Ali', 'Bassem Nour', 'Fady George', 'Ramy Samir', 'Hazem Walid', 'Saad Moustafa', 'Amr Diab', 'Wael Khairy', 'Nader Fawzy', 'Khaled Emad'];
        const FEMALE_NAMES = ['Nour El-Din', 'Sara Ahmed', 'Hana Mostafa', 'Rana Khalil', 'Dina Fawzy', 'Maya Ibrahim', 'Laila Hassan', 'Yasmine Tarek', 'Mariam Sayed', 'Reem Nabil', 'Nadia Fouad', 'Mona Saleh', 'Aya Magdy', 'Heba Gamal', 'Ranya Sherif', 'Ghada Wahba', 'Samira Lotfy', 'Ines Adel', 'Farah Zaki', 'Lina Nasser'];
        const CITIES = ['Cairo', 'Giza', 'Alexandria', 'Hurghada', 'Sharm El Sheikh', 'Luxor', 'Aswan', 'Mansoura', 'Tanta', 'Suez', 'Ismailia', 'Port Said', 'Zagazig', 'Asyut'];
        const GOALS = ['lose_weight', 'build_muscle', 'maintain_weight', 'gain_weight'];
        const LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
        const BRACKETS = [[18, 24], [25, 34], [35, 44], [45, 54], [55, 65]];
        const fakeH = await bcrypt.hash('FakePass!2025', 10);
        const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
        const dobFromAge = (age) => {
            const d = new Date();
            d.setFullYear(d.getFullYear() - age);
            return d.toISOString().split('T')[0];
        };
        let created = 0;
        const newUserIds = [];
        const allNames = [...MALE_NAMES.map(n => ({ name: n, gender: 'male' })), ...FEMALE_NAMES.map(n => ({ name: n, gender: 'female' }))];
        for (let i = 0; i < count; i++) {
            const { name, gender } = allNames[i % allNames.length];
            const suffix = Date.now() + i;
            const email = `fake.${name.toLowerCase().replace(/[^a-z]/g, '').slice(0, 8)}${suffix}@gmail.com`;
            const goal = GOALS[i % GOALS.length];
            const level = LEVELS[i % LEVELS.length];
            const bracket = BRACKETS[i % BRACKETS.length];
            const age = rand(bracket[0], bracket[1]);
            const city = CITIES[i % CITIES.length];
            const h = gender === 'male' ? rand(168, 188) : rand(155, 172);
            const w = gender === 'male' ? rand(65, 98) : rand(48, 75);
            const tgtW = goal === 'lose_weight' ? w - rand(5, 20) : goal === 'gain_weight' ? w + rand(3, 12) : w;
            try {
                const result = await dbRun(`INSERT INTO users (name,email,password,role,is_premium,gender,height,weight,
            date_of_birth,target_weight,weekly_goal,fitness_goal,activity_level,
            onboarding_done,avg_daily_steps,streak_days,step_goal,email_verified,city)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [name, email, fakeH, 'user', i % 3 === 0 ? 1 : 0, gender, h, w,
                    dobFromAge(age), tgtW, ['0.25', '0.5', '0.75'][i % 3],
                    goal, level, 1, rand(4000, 13000), rand(0, 30),
                    [8000, 10000, 12000, 15000][i % 4], 1, city]);
                if (result?.insertId)
                    newUserIds.push(Number(result.insertId));
                created++;
            }
            catch { }
        }
        // Make the new fake users participate in the app like real users:
        // posts, comments, likes, follows, coach subscriptions, payments, etc.
        try {
            await seedActivitiesForFakeAccounts(newUserIds, 'user');
        }
        catch (e) {
            console.warn('[generate-fake-users] activity seeding failed:', e?.message);
        }
        res.json({ created, message: `Created ${created} fake users` });
    }
    catch (err) {
        console.error('[generate-fake-users] error:', err);
        res.status(500).json({ message: 'Failed to generate users' });
    }
});
// ── Seed fake subscriptions (only on fake users) ─────────────────────────
// May meeting: fake-subscription generator must never touch real accounts.
// We look up users with the fake.* email prefix and pair each with a random
// coach, then write an "active" subscription row + assign a package tier.
router.post('/generate-fake-subs', authenticateToken, adminOnly, async (_req, res) => {
    try {
        const fakeUsers = await query(`SELECT id, name FROM users WHERE email LIKE 'fake.%@gmail.com' AND role = 'user'`);
        const coaches = await query(`SELECT id FROM users WHERE role = 'coach' LIMIT 50`);
        if (!fakeUsers.length || !coaches.length) {
            return res.json({ created: 0, message: 'Need at least one fake user and one coach first.' });
        }
        const packages = ['community_premium', 'community_exclusive', 'pt_basic', 'pt_premium', 'pt_gold'];
        let created = 0;
        for (const u of fakeUsers) {
            // Skip if this fake user already has an active sub
            const existing = await get(`SELECT id FROM coach_subscriptions WHERE user_id = ? AND status = 'active' LIMIT 1`, [u.id]);
            if (existing)
                continue;
            const coach = coaches[Math.floor(Math.random() * coaches.length)];
            const pkg = packages[Math.floor(Math.random() * packages.length)];
            await run(`INSERT INTO coach_subscriptions (user_id, coach_id, plan_cycle, plan_type, amount, status, admin_approval_status, coach_decision_status, package_id, started_at)
         VALUES (?, ?, 'monthly', 'complete', 0, 'active', 'approved', 'approved', ?, NOW())`, [u.id, coach.id, pkg]);
            created++;
        }
        res.json({ created, message: `Created ${created} fake subscription(s) on fake users only.` });
    }
    catch (err) {
        res.status(500).json({ message: err?.message || 'Failed to seed fake subscriptions' });
    }
});
// ── Remove all fake user accounts ────────────────────────────────────────────
router.delete('/fake-users', authenticateToken, adminOnly, async (_req, res) => {
    try {
        const fakeUsers = await query(`SELECT id FROM users WHERE email LIKE 'fake.%@gmail.com' AND role = 'user'`);
        if (!fakeUsers.length) {
            return res.json({ removed: 0, message: 'No fake accounts found' });
        }
        const ids = fakeUsers.map((u) => Number(u.id)).filter((id) => id > 0);
        const placeholders = ids.map(() => '?').join(',');
        // Disable FK checks to avoid constraint errors from tables we may have missed
        await run('SET FOREIGN_KEY_CHECKS = 0');
        // Remove dependent rows first
        const cleanupTables = [
            { sql: `DELETE FROM post_likes WHERE user_id IN (${placeholders})` },
            { sql: `DELETE FROM post_comments WHERE user_id IN (${placeholders})` },
            { sql: `DELETE FROM posts WHERE user_id IN (${placeholders})` },
            { sql: `DELETE FROM messages WHERE sender_id IN (${placeholders}) OR receiver_id IN (${placeholders})`, double: true },
            { sql: `DELETE FROM coach_subscriptions WHERE user_id IN (${placeholders}) OR coach_id IN (${placeholders})`, double: true },
            { sql: `DELETE FROM daily_summaries WHERE user_id IN (${placeholders})` },
            { sql: `DELETE FROM steps_entries WHERE user_id IN (${placeholders})` },
            { sql: `DELETE FROM payments WHERE user_id IN (${placeholders})` },
            { sql: `DELETE FROM gifts WHERE user_id IN (${placeholders})` },
            { sql: `DELETE FROM user_follows WHERE follower_id IN (${placeholders}) OR following_id IN (${placeholders})`, double: true },
            { sql: `DELETE FROM challenge_participants WHERE user_id IN (${placeholders})` },
            { sql: `DELETE FROM chat_requests WHERE sender_id IN (${placeholders}) OR receiver_id IN (${placeholders})`, double: true },
            { sql: `DELETE FROM workout_plans WHERE user_id IN (${placeholders}) OR coach_id IN (${placeholders})`, double: true },
            { sql: `DELETE FROM nutrition_plans WHERE user_id IN (${placeholders}) OR coach_id IN (${placeholders})`, double: true },
            { sql: `DELETE FROM notifications WHERE user_id IN (${placeholders})` },
            { sql: `DELETE FROM credit_transactions WHERE user_id IN (${placeholders})` },
            { sql: `DELETE FROM premium_sessions WHERE user_id IN (${placeholders})` },
            { sql: `DELETE FROM coaching_meetings WHERE user_id IN (${placeholders}) OR coach_id IN (${placeholders})`, double: true },
            { sql: `DELETE FROM withdrawal_requests WHERE coach_id IN (${placeholders})` },
            { sql: `DELETE FROM push_tokens WHERE user_id IN (${placeholders})` },
            { sql: `DELETE FROM push_log WHERE user_id IN (${placeholders})` },
            { sql: `DELETE FROM coach_ads WHERE coach_id IN (${placeholders})` },
            { sql: `DELETE FROM point_transactions WHERE user_id IN (${placeholders})` },
            { sql: `DELETE FROM coach_reviews WHERE user_id IN (${placeholders}) OR coach_id IN (${placeholders})`, double: true },
            { sql: `DELETE FROM coach_reports WHERE user_id IN (${placeholders}) OR coach_id IN (${placeholders})`, double: true },
            { sql: `DELETE FROM coaching_bookings WHERE user_id IN (${placeholders}) OR coach_id IN (${placeholders})`, double: true },
            { sql: `DELETE FROM user_workout_plans WHERE user_id IN (${placeholders})` },
            { sql: `DELETE FROM user_nutrition_plans WHERE user_id IN (${placeholders})` },
            { sql: `DELETE FROM ad_payments WHERE coach_id IN (${placeholders})` },
            { sql: `DELETE FROM coach_follows WHERE follower_id IN (${placeholders}) OR coach_id IN (${placeholders})`, double: true },
            { sql: `DELETE FROM user_progress_photos WHERE user_id IN (${placeholders})` },
            { sql: `DELETE FROM certification_requests WHERE coach_id IN (${placeholders})` },
            { sql: `DELETE FROM meeting_files WHERE uploaded_by IN (${placeholders})` },
            { sql: `DELETE FROM meeting_messages WHERE sender_id IN (${placeholders})` },
            { sql: `DELETE FROM paymob_transactions WHERE user_id IN (${placeholders})` },
            { sql: `DELETE FROM coach_profiles WHERE user_id IN (${placeholders})` },
        ];
        let removed = 0;
        try {
            for (const step of cleanupTables) {
                try {
                    const params = step.double ? [...ids, ...ids] : ids;
                    await run(step.sql, params);
                }
                catch {
                    // Some installs may not have every optional table.
                }
            }
            // Delete users last and track actual count
            const result = await run(`DELETE FROM users WHERE id IN (${placeholders})`, ids);
            removed = result?.affectedRows ?? ids.length;
        }
        finally {
            await run('SET FOREIGN_KEY_CHECKS = 1');
        }
        res.json({ removed, message: `Removed ${removed} fake accounts` });
    }
    catch {
        // Re-enable FK checks even on unexpected error
        try {
            await run('SET FOREIGN_KEY_CHECKS = 1');
        }
        catch { }
        res.status(500).json({ message: 'Failed to remove fake accounts' });
    }
});
//# sourceMappingURL=adminRoutes.js.map