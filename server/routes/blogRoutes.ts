import { Router, Request, Response } from 'express';
import { run, get } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { uploadVideo, optimizeImage, validateVideoSize } from '../middleware/upload.js';
import {
  createBlog,
  deleteBlog,
  getBlogs,
  getPublicBlogBySlug,
  getPublicBlogs,
  updateBlog,
} from '../controllers/blogController.js';

const router = Router();

// Public read endpoints for website visitors
router.get('/public', getPublicBlogs);
router.get('/public/:slug', getPublicBlogBySlug);

// Authenticated feed + management endpoints
router.get('/', authenticateToken, getBlogs);

router.post(
  '/',
  authenticateToken,
  uploadVideo.fields([
    { name: 'headerImage', maxCount: 1 },
    { name: 'video', maxCount: 1 },
  ]),
  validateVideoSize,
  optimizeImage(),
  createBlog
);

router.put(
  '/:id',
  authenticateToken,
  uploadVideo.fields([
    { name: 'headerImage', maxCount: 1 },
    { name: 'video', maxCount: 1 },
  ]),
  validateVideoSize,
  optimizeImage(),
  updateBlog
);

router.delete('/:id', authenticateToken, deleteBlog);

// Increment view count
router.post('/:id/view', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id || id < 1) return res.status(400).json({ message: 'Invalid post id' });
    await run('UPDATE blog_posts SET views = views + 1 WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: 'Failed to record view' });
  }
});

// Admin approve / reject a pending_review blog
router.put('/:id/review', authenticateToken, async (req: any, res: Response) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    const postId = Number(req.params.id);
    const action = req.body.action; // 'approve' or 'reject'
    if (!['approve', 'reject'].includes(action)) return res.status(400).json({ message: 'action must be approve or reject' });

    const post = await get<any>('SELECT * FROM blog_posts WHERE id = ?', [postId]);
    if (!post) return res.status(404).json({ message: 'Blog post not found' });

    if (action === 'approve') {
      await run('UPDATE blog_posts SET status = ?, published_at = COALESCE(published_at, NOW()), updated_at = NOW() WHERE id = ?', ['published', postId]);
    } else {
      await run('UPDATE blog_posts SET status = ?, updated_at = NOW() WHERE id = ?', ['draft', postId]);
    }

    const updated = await get<any>(
      `SELECT bp.*, u.name AS author_name, u.avatar AS author_avatar FROM blog_posts bp LEFT JOIN users u ON u.id = bp.author_id WHERE bp.id = ?`, [postId]
    );
    res.json({ post: updated, message: action === 'approve' ? 'Blog approved and published' : 'Blog rejected and moved to draft' });
  } catch { res.status(500).json({ message: 'Failed to review blog' }); }
});

export default router;
