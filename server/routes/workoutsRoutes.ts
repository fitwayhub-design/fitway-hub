import { Router } from 'express';
import { authenticateToken, requireActiveCoachMembershipForDeals } from '../middleware/auth.js';
import { get, query, run } from '../config/database.js';
import { optimizeImage, uploadToR2, uploadVideo, validateVideoSize } from '../middleware/upload.js';

const router = Router();

const coachOrAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'coach' && req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Coach access required' });
  }
  next();
};

function extractYouTubeVideoId(url: string): string | null {
  const match = String(url || '').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

router.get('/videos', authenticateToken, async (req: any, res: any) => {
  try {
    const videos = await query("SELECT * FROM workout_videos WHERE COALESCE(approval_status, 'approved') = 'approved' AND (is_short IS NULL OR is_short = 0) ORDER BY created_at DESC");
    res.json({ videos });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch videos' });
  }
});

// ── Shorties: short videos only ────────────────────────────────────────────────
router.get('/shorties', authenticateToken, async (req: any, res: any) => {
  try {
    const videos = await query("SELECT * FROM workout_videos WHERE COALESCE(approval_status, 'approved') = 'approved' AND is_short = 1 ORDER BY created_at DESC");
    res.json({ videos });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch shorties' });
  }
});

router.get('/my-videos', authenticateToken, coachOrAdmin, async (req: any, res: any) => {
  try {
    const videos = await query(
      `SELECT wv.*, u.name AS submitted_by_name
       FROM workout_videos wv
       LEFT JOIN users u ON u.id = wv.submitted_by
       WHERE wv.coach_id = ?
       ORDER BY wv.created_at DESC`,
      [req.user.id]
    );
    res.json({ videos });
  } catch {
    res.status(500).json({ message: 'Failed to fetch your videos' });
  }
});

router.post('/videos/submissions', authenticateToken, coachOrAdmin, requireActiveCoachMembershipForDeals, uploadVideo.fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]), validateVideoSize, optimizeImage(), async (req: any, res: any) => {
  try {
    const { title, description, duration, category, is_premium, is_short } = req.body;
    if (!title) return res.status(400).json({ message: 'Title is required' });

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const videoFile = files?.video?.[0];
    const thumbnailFile = files?.thumbnail?.[0];

    if (!videoFile) return res.status(400).json({ message: 'Video file is required' });

    const videoUrl = await uploadToR2(videoFile, 'videos');
    const thumbnailUrl = thumbnailFile ? await uploadToR2(thumbnailFile, 'thumbnails') : null;
    const durationSeconds = videoFile.size > 0 ? Math.ceil(videoFile.size / (1024 * 1024)) : parseInt(duration || '0', 10) || 0;
    const isShort = is_short === '1' || is_short === true ? 1 : 0;
    const isPremium = is_premium === '1' || is_premium === true ? 1 : 0;
    const approvalStatus = req.user.role === 'admin' ? 'approved' : 'pending';

    const result = await run(
      `INSERT INTO workout_videos
       (title, description, url, duration, duration_seconds, category, is_premium, thumbnail, is_short, source_type, coach_id, submitted_by, approval_status, approved_by, approved_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        title,
        description || '',
        videoUrl,
        duration || '',
        durationSeconds,
        category || 'General',
        isPremium,
        thumbnailUrl || '',
        isShort,
        'upload',
        req.user.id,
        req.user.id,
        approvalStatus,
        approvalStatus === 'approved' ? req.user.id : null,
        approvalStatus === 'approved' ? new Date() : null,
      ]
    );

    const video = await get('SELECT * FROM workout_videos WHERE id = ?', [result.insertId]);
    res.json({
      video,
      message: approvalStatus === 'approved'
        ? 'Video published successfully'
        : 'Video submitted for admin approval'
    });
  } catch (err) {
    console.error('Coach video submission error:', err);
    res.status(500).json({ message: 'Failed to submit video' });
  }
});

router.post('/videos/submissions/youtube', authenticateToken, coachOrAdmin, requireActiveCoachMembershipForDeals, async (req: any, res: any) => {
  try {
    const { title, description, duration, category, is_premium, is_short, youtube_url } = req.body;
    if (!title) return res.status(400).json({ message: 'Title is required' });
    if (!youtube_url) return res.status(400).json({ message: 'YouTube URL is required' });

    const videoId = extractYouTubeVideoId(youtube_url);
    if (!videoId) return res.status(400).json({ message: 'Invalid YouTube URL. Please provide a valid YouTube video link.' });

    const embedUrl = `https://www.youtube.com/embed/${videoId}`;
    const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    const isShort = is_short === '1' || is_short === true ? 1 : 0;
    const isPremium = is_premium === '1' || is_premium === true ? 1 : 0;
    const approvalStatus = req.user.role === 'admin' ? 'approved' : 'pending';

    const result = await run(
      `INSERT INTO workout_videos
       (title, description, url, youtube_url, source_type, duration, duration_seconds, category, is_premium, thumbnail, is_short, coach_id, submitted_by, approval_status, approved_by, approved_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        title,
        description || '',
        embedUrl,
        youtube_url,
        'youtube',
        duration || '',
        0,
        category || 'General',
        isPremium,
        thumbnail,
        isShort,
        req.user.id,
        req.user.id,
        approvalStatus,
        approvalStatus === 'approved' ? req.user.id : null,
        approvalStatus === 'approved' ? new Date() : null,
      ]
    );

    const video = await get('SELECT * FROM workout_videos WHERE id = ?', [result.insertId]);
    res.json({
      video,
      message: approvalStatus === 'approved'
        ? 'YouTube video published successfully'
        : 'YouTube video submitted for admin approval'
    });
  } catch (err) {
    console.error('Coach YouTube submission error:', err);
    res.status(500).json({ message: 'Failed to submit YouTube video' });
  }
});

// ── Playlists: public lists ────────────────────────────────────────────────────
router.get('/playlists', authenticateToken, async (_req: any, res: any) => {
  try {
    const playlists = await query(`
      SELECT p.*, u.name as creator_name,
             (SELECT COUNT(*) FROM playlist_videos WHERE playlist_id = p.id) as video_count
      FROM video_playlists p
      LEFT JOIN users u ON u.id = p.created_by
      WHERE p.is_public = 1
      ORDER BY p.sort_order ASC, p.created_at DESC
    `);
    res.json({ playlists });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch playlists' });
  }
});

router.get('/playlists/:id/videos', authenticateToken, async (req: any, res: any) => {
  try {
    const vids = await query(
      `SELECT v.*, pv.sort_order as playlist_order FROM playlist_videos pv
       JOIN workout_videos v ON v.id = pv.video_id
       WHERE pv.playlist_id = ? AND COALESCE(v.approval_status, 'approved') = 'approved' ORDER BY pv.sort_order ASC`, [req.params.id]);
    res.json({ videos: vids });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch playlist videos' });
  }
});

router.get('/my-plan', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const workoutPlan: any = await get('SELECT * FROM workout_plans WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [userId]);
    const nutritionPlan: any = await get('SELECT * FROM nutrition_plans WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [userId]);
    if (!workoutPlan && !nutritionPlan) return res.json(null);
    res.json({
      workout: workoutPlan ? {
        title: workoutPlan.title,
        description: workoutPlan.description,
        sessions: typeof workoutPlan.exercises === 'string' ? JSON.parse(workoutPlan.exercises || '[]') : (workoutPlan.exercises || []),
      } : null,
      nutrition: nutritionPlan ? {
        title: nutritionPlan.title,
        dailyCalories: nutritionPlan.daily_calories,
        protein: nutritionPlan.protein_g,
        carbs: nutritionPlan.carbs_g,
        fat: nutritionPlan.fat_g,
        meals: typeof nutritionPlan.meals === 'string' ? JSON.parse(nutritionPlan.meals || '[]') : (nutritionPlan.meals || []),
        notes: nutritionPlan.notes,
      } : null,
    });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch plan' });
  }
});


// ── Points: Video watched (anti-cheat) ────────────────────────────────────────
router.post('/videos/:id/watched', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const videoId = req.params.id;
    const { watchedDuration, videoDuration, seeked, speedChanged } = req.body || {};

    // Anti-cheat validations
    if (!watchedDuration || !videoDuration) return res.status(400).json({ message: 'Missing watch data', points: 0 });
    if (seeked || speedChanged) return res.json({ message: 'Not eligible — video was seeked or speed changed', points: 0 });
    // User must have watched at least 90% of the video
    if (watchedDuration < videoDuration * 0.9) return res.json({ message: 'Video not fully watched', points: 0 });

    // Check not already awarded today
    const today = new Date().toISOString().split('T')[0];
    const already = await get('SELECT id FROM point_transactions WHERE user_id = ? AND reference_type = ? AND reference_id = ? AND DATE(created_at) = ?', [userId, 'video_watch', videoId, today]);
    if (already) return res.json({ message: 'Already awarded today', points: 0 });
    await run('UPDATE users SET points = points + 2 WHERE id = ?', [userId]);
    await run('INSERT INTO point_transactions (user_id, points, reason, reference_type, reference_id) VALUES (?,?,?,?,?)', [userId, 2, 'Watched a full workout video', 'video_watch', videoId]);
    const user = await get<any>('SELECT points FROM users WHERE id = ?', [userId]);
    // Update computed activity profile (fire-and-forget)
    try {
      const { updateUserActivityProfile } = await import('../services/activityProfileService.js');
      updateUserActivityProfile(userId).catch(() => {});
    } catch {}
    res.json({ message: '+2 points for watching video!', points: user?.points || 0 });
  } catch (err) { res.status(500).json({ message: 'Failed to award points' }); }
});

export default router;
