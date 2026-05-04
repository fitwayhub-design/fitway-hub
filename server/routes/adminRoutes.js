import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { get, run, query, getPool, seedDefaultAppSettings } from '../config/database.js';
import { uploadVideo, uploadFont, upload, uploadBranding, optimizeImage, validateVideoSize, verifyUploadBytes, uploadToR2, multerToJson, sanitiseSvgIfPresent } from '../middleware/upload.js';
import { sendPushToUser } from '../notificationService.js';
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
// ── Users ──────────────────────────────────────────────────────────────────────
router.get('/users', authenticateToken, adminOnly, async (_req, res) => {
    try {
        const users = await query('SELECT id, name, email, role, avatar, is_premium, points, steps, step_goal, height, weight, gender, medical_history, medical_file_url, membership_paid, coach_membership_active, created_at FROM users ORDER BY created_at DESC');
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
router.post('/users/:id/upload-medical', authenticateToken, adminOnly, upload.single('medical'), optimizeImage(), async (req, res) => {
    try {
        if (!req.file)
            return res.status(400).json({ message: 'No file provided' });
        const userId = Number(req.params.id);
        if (!userId)
            return res.status(400).json({ message: 'Invalid user id' });
        const fileUrl = await uploadToR2(req.file, 'medical');
        await run('UPDATE users SET medical_file_url = ?, updated_at = NOW() WHERE id = ?', [fileUrl, userId]);
        res.json({ message: 'Medical file uploaded', file_url: fileUrl });
    }
    catch {
        res.status(500).json({ message: 'Failed to upload medical file' });
    }
});
router.put('/users/:id', authenticateToken, adminOnly, async (req, res) => {
    try {
        const oldId = Number(req.params.id);
        if (!oldId)
            return res.status(400).json({ message: 'Invalid user id' });
        const existing = await get('SELECT * FROM users WHERE id = ?', [oldId]);
        if (!existing)
            return res.status(404).json({ message: 'User not found' });
        const body = req.body || {};
        const nextId = body.id !== undefined && body.id !== null && String(body.id).trim() !== ''
            ? Number(body.id)
            : oldId;
        if (!nextId || Number.isNaN(nextId) || nextId < 1) {
            return res.status(400).json({ message: 'Invalid new ID' });
        }
        if (nextId !== oldId) {
            const idConflict = await get('SELECT id FROM users WHERE id = ?', [nextId]);
            if (idConflict)
                return res.status(409).json({ message: 'New ID is already used by another account' });
            // Changing primary key is only safe if no relational references exist.
            const refs = await Promise.all([
                get('SELECT COUNT(*) as c FROM daily_summaries WHERE user_id = ?', [oldId]),
                get('SELECT COUNT(*) as c FROM steps_entries WHERE user_id = ?', [oldId]),
                get('SELECT COUNT(*) as c FROM messages WHERE sender_id = ? OR receiver_id = ?', [oldId, oldId]),
                get('SELECT COUNT(*) as c FROM posts WHERE user_id = ?', [oldId]),
                get('SELECT COUNT(*) as c FROM post_likes WHERE user_id = ?', [oldId]),
                get('SELECT COUNT(*) as c FROM post_comments WHERE user_id = ?', [oldId]),
                get('SELECT COUNT(*) as c FROM user_follows WHERE follower_id = ? OR following_id = ?', [oldId, oldId]),
                get('SELECT COUNT(*) as c FROM challenge_participants WHERE user_id = ?', [oldId]),
                get('SELECT COUNT(*) as c FROM premium_sessions WHERE user_id = ?', [oldId]),
                get('SELECT COUNT(*) as c FROM chat_requests WHERE sender_id = ? OR receiver_id = ?', [oldId, oldId]),
                get('SELECT COUNT(*) as c FROM workout_plans WHERE user_id = ? OR coach_id = ?', [oldId, oldId]),
                get('SELECT COUNT(*) as c FROM nutrition_plans WHERE user_id = ? OR coach_id = ?', [oldId, oldId]),
                get('SELECT COUNT(*) as c FROM gifts WHERE user_id = ? OR admin_id = ?', [oldId, oldId]),
                get('SELECT COUNT(*) as c FROM payments WHERE user_id = ?', [oldId]),
                get('SELECT COUNT(*) as c FROM coach_subscriptions WHERE user_id = ? OR coach_id = ?', [oldId, oldId]),
                get('SELECT COUNT(*) as c FROM withdrawal_requests WHERE coach_id = ?', [oldId]),
                get('SELECT COUNT(*) as c FROM ad_payments WHERE coach_id = ?', [oldId]),
                get('SELECT COUNT(*) as c FROM coach_ads WHERE coach_id = ?', [oldId]),
            ]);
            const totalRefs = refs.reduce((sum, r) => sum + Number(r?.c || 0), 0);
            if (totalRefs > 0) {
                return res.status(409).json({
                    message: 'Cannot change user ID after activity exists. Create a new user instead.',
                });
            }
        }
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
        height = ?,
        weight = ?,
        gender = ?,
        medical_history = ?,
        medical_file_url = ?,
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
            body.height !== undefined && body.height !== '' ? Number(body.height) : (existing.height ?? null),
            body.weight !== undefined && body.weight !== '' ? Number(body.weight) : (existing.weight ?? null),
            body.gender !== undefined ? String(body.gender || '').trim() : (existing.gender ?? null),
            body.medical_history !== undefined ? String(body.medical_history || '').trim() : String(existing.medical_history || ''),
            body.medical_file_url !== undefined ? String(body.medical_file_url || '').trim() : String(existing.medical_file_url || ''),
            body.membership_paid !== undefined ? (body.membership_paid ? 1 : 0) : Number(existing.membership_paid || 0),
            body.coach_membership_active !== undefined ? (body.coach_membership_active ? 1 : 0) : Number(existing.coach_membership_active || 0),
            body.step_goal !== undefined && body.step_goal !== '' ? Number(body.step_goal) : Number(existing.step_goal || 10000),
            oldId,
        ]);
        const updated = await get('SELECT id, name, email, role, avatar, is_premium, points, steps, step_goal, height, weight, gender, medical_history, medical_file_url, membership_paid, coach_membership_active, created_at FROM users WHERE id = ?', [nextId]);
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
// Upload video file
router.post('/videos', authenticateToken, adminOnly, uploadVideo.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
]), validateVideoSize, optimizeImage(), async (req, res) => {
    try {
        const { title, description, duration, category, is_premium } = req.body;
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
        const durationSeconds = videoFile.size > 0 ? Math.ceil(videoFile.size / (1024 * 1024)) : parseInt(duration || '0');
        const { insertId } = await run('INSERT INTO workout_videos (title, description, url, duration, duration_seconds, category, is_premium, thumbnail, is_short, source_type, approval_status, submitted_by, approved_by, approved_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [title, description || '', videoUrl, duration || '', durationSeconds, category || 'General', is_premium === '1' || is_premium === true ? 1 : 0, thumbnailUrl || '', isShort, 'upload', 'approved', req.user.id, req.user.id, new Date()]);
        const coachId = req.body.coach_id ? parseInt(req.body.coach_id) : null;
        if (coachId)
            await run('UPDATE workout_videos SET coach_id = ? WHERE id = ?', [coachId, insertId]);
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
        const { title, description, duration, category, is_premium, is_short, coach_id, youtube_url } = req.body;
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
        const { insertId } = await run('INSERT INTO workout_videos (title, description, url, youtube_url, source_type, duration, duration_seconds, category, is_premium, thumbnail, is_short, approval_status, submitted_by, approved_by, approved_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [title, description || '', embedUrl, youtube_url, 'youtube', duration || '', 0, category || 'General', isPremiumVal, thumbnail, isShortVal, 'approved', req.user.id, req.user.id, new Date()]);
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
        const { title, description, duration, category, is_premium } = req.body;
        const isShort = req.body.is_short === '1' || req.body.is_short === true ? 1 : (req.body.is_short === '0' || req.body.is_short === false ? 0 : existing.is_short || 0);
        await run('UPDATE workout_videos SET title=?, description=?, url=?, duration=?, category=?, is_premium=?, thumbnail=?, is_short=?, updated_at=NOW() WHERE id=?', [title || existing.title, description ?? existing.description, videoUrl, duration || existing.duration,
            category || existing.category, is_premium === '1' || is_premium === true ? 1 : 0, thumbnailUrl, isShort, id]);
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
        'ewallet_phone_we',
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
// ── Coach Profiles Generator ────────────────────────────────────────────────
router.post('/generate-coach-profiles', authenticateToken, adminOnly, async (_req, res) => {
    try {
        const count = 5;
        const firstNames = ['Karim', 'Omar', 'Hassan', 'Mina', 'Yousef', 'Nadine', 'Rania', 'Mariam', 'Salma', 'Lina'];
        const lastNames = ['Mostafa', 'Hamed', 'Samir', 'Nabil', 'Farouk', 'Ibrahim', 'Mahmoud', 'Adel', 'Tarek', 'Kamel'];
        const created = [];
        const hashed = await bcrypt.hash('CoachPass123!', 10);
        const baseTs = Date.now();
        for (let i = 0; i < count; i++) {
            const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
            const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
            const suffix = `${baseTs}${i}`;
            const name = `${fn} ${ln}`;
            const email = `${fn.toLowerCase()}.${ln.toLowerCase()}.${suffix}@fitwayhub.coach`;
            const avatar = null;
            const steps = 9000 + Math.floor(Math.random() * 7000);
            const points = 800 + Math.floor(Math.random() * 2200);
            try {
                await run(`INSERT INTO users (email, password, name, role, avatar, is_premium, membership_paid, coach_membership_active, points, steps, step_goal)
           VALUES (?, ?, ?, 'coach', ?, 0, 1, 1, ?, ?, 12000)`, [email, hashed, name, avatar, points, steps]);
                created.push(name);
            }
            catch {
                // Skip duplicates and continue.
            }
        }
        res.json({ message: `Created ${created.length} coach profiles`, coaches: created });
    }
    catch (err) {
        res.status(500).json({ message: 'Failed to generate coach profiles', error: err?.message || 'Unknown error' });
    }
});
// ── Fake Accounts Generator ──────────────────────────────────────────────────
// ── Moderator (admin + moderator can use these) ─────────────────────────────
const adminOrModerator = (req, res, next) => {
    if (req.user?.role !== 'admin' && req.user?.role !== 'moderator')
        return res.status(403).json({ message: 'Access denied' });
    next();
};
// Community moderation endpoints
router.get('/community/posts', authenticateToken, adminOrModerator, async (_req, res) => {
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
router.post('/community/announcements', authenticateToken, adminOnly, async (req, res) => {
    try {
        const { content, hashtags } = req.body;
        if (!content || !content.trim())
            return res.status(400).json({ message: 'Content is required' });
        const result = await run('INSERT INTO posts (user_id, content, hashtags, is_announcement, is_pinned) VALUES (?, ?, ?, 1, 1)', [req.user.id, content.trim(), hashtags || null]);
        res.json({ message: 'Announcement posted', postId: result.insertId });
    }
    catch {
        res.status(500).json({ message: 'Failed to create announcement' });
    }
});
// ── Toggle pin on a post ─────────────────────────────────────────────────────
router.patch('/community/posts/:id/pin', authenticateToken, adminOnly, async (req, res) => {
    try {
        const post = await get('SELECT is_pinned FROM posts WHERE id = ?', [req.params.id]);
        if (!post)
            return res.status(404).json({ message: 'Post not found' });
        const newVal = post.is_pinned ? 0 : 1;
        await run('UPDATE posts SET is_pinned = ? WHERE id = ?', [newVal, req.params.id]);
        res.json({ message: newVal ? 'Post pinned' : 'Post unpinned', is_pinned: newVal });
    }
    catch {
        res.status(500).json({ message: 'Failed to toggle pin' });
    }
});
router.patch('/community/posts/:id/hide', authenticateToken, adminOrModerator, async (req, res) => {
    try {
        const { reason } = req.body;
        await run('UPDATE posts SET is_hidden = 1, moderated_by = ?, moderation_reason = ? WHERE id = ?', [req.user.id, reason || 'Policy violation', req.params.id]);
        res.json({ message: 'Post hidden' });
    }
    catch {
        res.status(500).json({ message: 'Failed to hide post' });
    }
});
router.patch('/community/posts/:id/restore', authenticateToken, adminOrModerator, async (req, res) => {
    try {
        await run('UPDATE posts SET is_hidden = 0, moderated_by = NULL, moderation_reason = NULL WHERE id = ?', [req.params.id]);
        res.json({ message: 'Post restored' });
    }
    catch {
        res.status(500).json({ message: 'Failed to restore post' });
    }
});
router.delete('/community/posts/:id', authenticateToken, adminOrModerator, async (req, res) => {
    try {
        await run('DELETE FROM posts WHERE id = ?', [req.params.id]);
        res.json({ message: 'Post deleted' });
    }
    catch {
        res.status(500).json({ message: 'Failed to delete post' });
    }
});
// (role update handled by original route above - extended to support moderator)
// ── Community stats ──────────────────────────────────────────────────────────
router.get('/community/stats', authenticateToken, adminOrModerator, async (_req, res) => {
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
router.get('/community/challenges', authenticateToken, adminOrModerator, async (_req, res) => {
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
router.delete('/community/challenges/:id', authenticateToken, adminOnly, async (req, res) => {
    try {
        await run('DELETE FROM challenges WHERE id = ?', [req.params.id]);
        res.json({ message: 'Challenge deleted' });
    }
    catch {
        res.status(500).json({ message: 'Failed to delete challenge' });
    }
});
// ── Community comments (admin) ────────────────────────────────────────────────
router.get('/community/comments', authenticateToken, adminOrModerator, async (_req, res) => {
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
router.delete('/community/comments/:id', authenticateToken, adminOrModerator, async (req, res) => {
    try {
        await run('DELETE FROM post_comments WHERE id = ?', [req.params.id]);
        res.json({ message: 'Comment deleted' });
    }
    catch {
        res.status(500).json({ message: 'Failed to delete comment' });
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
// Branding assets are stored inline as base64 data URLs in app_settings.
// See adminRoutes.ts for rationale.
const INLINE_LIMIT = 1.5 * 1024 * 1024;
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
                await dbRun(`INSERT INTO users (name,email,password,role,is_premium,gender,height,weight,
            date_of_birth,target_weight,weekly_goal,fitness_goal,activity_level,
            onboarding_done,avg_daily_steps,streak_days,step_goal,email_verified,city)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [name, email, fakeH, 'user', i % 3 === 0 ? 1 : 0, gender, h, w,
                    dobFromAge(age), tgtW, ['0.25', '0.5', '0.75'][i % 3],
                    goal, level, 1, rand(4000, 13000), rand(0, 30),
                    [8000, 10000, 12000, 15000][i % 4], 1, city]);
                created++;
            }
            catch { }
        }
        res.json({ created, message: `Created ${created} fake users` });
    }
    catch (err) {
        console.error('[generate-fake-users] error:', err);
        res.status(500).json({ message: 'Failed to generate users' });
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