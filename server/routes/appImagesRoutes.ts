import { Router, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { query, get, run } from '../config/database';
import { upload, optimizeImage, uploadToR2 } from '../middleware/upload';

const router = Router();

const adminOnly = (req: any, res: Response, next: any) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
  next();
};

const SLUG_RE = /^[a-z0-9_]{1,64}$/;

// ── Public: get all images (keyed by slug) ────────────────────────────────────
router.get('/', async (_req: any, res: Response) => {
  try {
    const rows = (await query('SELECT slug, url, alt, category FROM app_images')) as any[];
    const map: Record<string, { url: string; alt: string | null; category: string | null }> = {};
    for (const r of rows) map[r.slug] = { url: r.url, alt: r.alt, category: r.category };
    res.json({ images: map });
  } catch {
    res.json({ images: {} });
  }
});

// ── Public: get a single image by slug ────────────────────────────────────────
router.get('/:slug', async (req: any, res: Response) => {
  const { slug } = req.params;
  if (!SLUG_RE.test(slug)) return res.status(400).json({ message: 'Invalid slug' });
  try {
    const row = await get<any>('SELECT slug, url, alt, category FROM app_images WHERE slug = ?', [slug]);
    if (!row) return res.status(404).json({ message: 'Not found' });
    res.json(row);
  } catch {
    res.status(500).json({ message: 'Failed' });
  }
});

// ── Admin: list all slots (with metadata) ─────────────────────────────────────
router.get('/admin/all', authenticateToken, adminOnly, async (_req: any, res: Response) => {
  try {
    const rows = await query('SELECT slug, url, alt, category, updated_at FROM app_images ORDER BY category, slug');
    res.json({ images: rows });
  } catch {
    res.status(500).json({ message: 'Failed' });
  }
});

// ── Admin: upsert a slot (upload image + slug + optional alt/category) ────────
router.post(
  '/admin/:slug',
  authenticateToken,
  adminOnly,
  upload.single('image'),
  optimizeImage(),
  async (req: any, res: Response) => {
    const { slug } = req.params;
    if (!SLUG_RE.test(slug)) return res.status(400).json({ message: 'Invalid slug (lowercase, digits, underscore only)' });
    if (!req.file) return res.status(400).json({ message: 'No image uploaded' });
    try {
      const url = await uploadToR2(req.file, 'app-images');
      const alt = typeof req.body.alt === 'string' ? String(req.body.alt).slice(0, 255) : null;
      const category = typeof req.body.category === 'string' ? String(req.body.category).slice(0, 32) : null;
      await run(
        `INSERT INTO app_images (slug, url, alt, category, updated_by)
         VALUES (?,?,?,?,?)
         ON DUPLICATE KEY UPDATE url = VALUES(url), alt = VALUES(alt), category = VALUES(category), updated_by = VALUES(updated_by)`,
        [slug, url, alt, category, req.user.id]
      );
      res.json({ slug, url, alt, category });
    } catch (err) {
      res.status(500).json({ message: 'Failed to upload' });
    }
  }
);

// ── Admin: delete a slot ──────────────────────────────────────────────────────
router.delete('/admin/:slug', authenticateToken, adminOnly, async (req: any, res: Response) => {
  const { slug } = req.params;
  if (!SLUG_RE.test(slug)) return res.status(400).json({ message: 'Invalid slug' });
  try {
    await run('DELETE FROM app_images WHERE slug = ?', [slug]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: 'Failed' });
  }
});

export default router;
