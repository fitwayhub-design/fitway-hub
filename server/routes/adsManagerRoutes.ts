/**
 * Ads Manager Routes — admin/manager-focused endpoints for bulk actions,
 * quick overview, and manager dashboards. Wraps lower-level queries used
 * by the admin UI.
 */
import { Router, Response } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { query, run, get } from '../config/database.js';

const router = Router();

const adminOrMod = (req: any, res: Response, next: any) => {
  if (!['admin', 'moderator'].includes(req.user?.role)) return res.status(403).json({ message: 'Admin or moderator access required' });
  next();
};

const coachOrAdmin = (req: any, res: Response, next: any) => {
  if (!['coach', 'admin', 'moderator'].includes(req.user?.role)) return res.status(403).json({ message: 'Coach or admin access required' });
  next();
};

/** GET /api/ads-manager/overview — high level metrics for manager dashboard */
router.get('/overview', authenticateToken, adminOrMod, async (_req: any, res: Response) => {
  try {
    const [campaigns] = await query<any>(`SELECT COUNT(*) AS total, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active FROM ad_campaigns`);
    const [pending] = await query<any>("SELECT COUNT(*) AS total FROM ad_moderation_reviews WHERE status='pending'");
    let eventsToday = 0;
    try { const [r] = await query<any>('SELECT COUNT(*) AS total FROM ad_events WHERE DATE(recorded_at)=CURDATE()'); eventsToday = r?.total || 0; } catch {}
    let spendToday = 0;
    try { const [r] = await query<any>(`SELECT COALESCE(SUM(amount),0) AS total FROM ad_wallet_ledger WHERE entry_type='debit' AND DATE(created_at)=CURDATE()`); spendToday = r?.total || 0; } catch {}
    res.json({ campaigns: campaigns?.total || 0, active: campaigns?.active || 0, pending: pending?.total || 0, events_today: eventsToday, spend_today: spendToday });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

/** GET /api/ads-manager/campaigns — list with filters */
router.get('/campaigns', authenticateToken, coachOrAdmin, async (req: any, res: Response) => {
  try {
    const status = req.query.status || null;
    const coachId = req.query.coach_id || null;
    const params: any[] = [];
    let where: string[] = [];
    if (status) { where.push('c.status = ?'); params.push(status); }
    if (coachId) { where.push('c.coach_id = ?'); params.push(coachId); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const campaigns = await query<any>(
      `SELECT c.*, u.name AS coach_name, COUNT(s.id) AS ad_set_count, COALESCE(SUM(a.impressions),0) AS impressions, COALESCE(SUM(a.clicks),0) AS clicks
       FROM ad_campaigns c
       LEFT JOIN users u ON u.id = c.coach_id
       LEFT JOIN ad_sets s ON s.campaign_id = c.id
       LEFT JOIN ads a ON a.ad_set_id = s.id
       ${whereSql}
       GROUP BY c.id ORDER BY c.created_at DESC`,
      params,
    );
    res.json({ campaigns });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

/** POST /api/ads-manager/campaigns — create campaign (coach or admin) */
router.post('/campaigns', authenticateToken, coachOrAdmin, async (req: any, res: Response) => {
  try {
    const { name, objective, daily_budget, lifetime_budget, budget_type, schedule_start, schedule_end } = req.body;
    if (!name) return res.status(400).json({ message: 'name required' });
    const result: any = await run(
      `INSERT INTO ad_campaigns (coach_id, name, objective, daily_budget, lifetime_budget, budget_type, schedule_start, schedule_end, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [req.user.id, name, objective || 'coaching', daily_budget || 0, lifetime_budget || 0, budget_type || 'daily', schedule_start || null, schedule_end || null, 'pending_review']
    );
    const campaign = await get<any>('SELECT * FROM ad_campaigns WHERE id = ?', [result.insertId]);
    await run(`INSERT INTO ad_moderation_reviews (campaign_id, status, created_at) VALUES (?, 'pending', NOW())`, [result.insertId]);
    await run(`INSERT INTO ad_audit_logs (actor_id, actor_role, action, entity_type, entity_id, new_state) VALUES (?, ?, 'create', 'campaign', ?, ?)`, [req.user.id, req.user.role, result.insertId, JSON.stringify(campaign)]);
    res.status(201).json({ campaign });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

/** PUT /api/ads-manager/campaigns/:id — update campaign (coach updates own campaign or admin) */
router.put('/campaigns/:id', authenticateToken, coachOrAdmin, async (req: any, res: Response) => {
  try {
    const existing = await get<any>('SELECT * FROM ad_campaigns WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ message: 'Campaign not found' });
    if (req.user.role !== 'admin' && existing.coach_id !== req.user.id) return res.status(403).json({ message: 'Not your campaign' });
    const fields = ['name','objective','daily_budget','lifetime_budget','budget_type','schedule_start','schedule_end','status'];
    const updates = fields.filter(f => req.body[f] !== undefined).map(f => `${f}=?`);
    const vals = fields.filter(f => req.body[f] !== undefined).map(f => req.body[f]);
    if (!updates.length) return res.status(400).json({ message: 'Nothing to update' });
    await run(`UPDATE ad_campaigns SET ${updates.join(',')}, updated_at=NOW() WHERE id = ?`, [...vals, req.params.id]);
    const updated = await get<any>('SELECT * FROM ad_campaigns WHERE id = ?', [req.params.id]);
    await run(`INSERT INTO ad_audit_logs (actor_id, actor_role, action, entity_type, entity_id, old_state, new_state) VALUES (?, ?, 'update', 'campaign', ?, ?, ?)`, [req.user.id, req.user.role, req.params.id, JSON.stringify(existing), JSON.stringify(updated)]);
    res.json({ campaign: updated });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

/** GET /api/ads-manager/ads — list ads for the authenticated coach (or all for admin) */
router.get('/ads', authenticateToken, coachOrAdmin, async (req: any, res: Response) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const where = isAdmin ? '' : 'WHERE c.coach_id = ?';
    const params = isAdmin ? [] : [req.user.id];
    const ads = await query<any>(
      `SELECT a.*, ac.media_url, ac.format, s.name AS ad_set_name, c.name AS campaign_name
       FROM ads a
       JOIN ad_sets s ON s.id = a.ad_set_id
       JOIN ad_campaigns c ON c.id = s.campaign_id
       LEFT JOIN ad_creatives ac ON ac.id = a.creative_id
       ${where}
       ORDER BY a.created_at DESC`, params
    );
    res.json({ ads });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

/** PATCH /api/ads-manager/campaigns/:id/action — approve/pause/resume/reject */
router.patch('/campaigns/:id/action', authenticateToken, adminOrMod, async (req: any, res: Response) => {
  try {
    const { action, note } = req.body;
    const valid = ['approve','pause','resume','reject','archive'];
    if (!valid.includes(action)) return res.status(400).json({ message: `action must be one of: ${valid.join(', ')}` });
    const campaign = await get<any>('SELECT * FROM ad_campaigns WHERE id = ?', [req.params.id]);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    const newStatus = action === 'approve' ? 'active'
      : action === 'pause' ? 'paused'
      : action === 'resume' ? 'active'
      : action === 'reject' ? 'rejected'
      : 'archived';

    await run('UPDATE ad_campaigns SET status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW() WHERE id = ?', [newStatus, note || null, req.user.id, req.params.id]);
    // Notify coach on rejection
    if (action === 'reject' && campaign.coach_id) {
      const reason = note ? `: ${note}` : '';
      await run('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)',
        [campaign.coach_id, 'ad_rejected', '\u274c Campaign Rejected', `Your campaign "${campaign.name || 'Untitled'}" has been rejected${reason}`, '/coach/ads/my-ads']);
    }
    // record an audit row
    await run(`INSERT INTO ad_audit_logs (actor_id, actor_role, action, entity_type, entity_id, old_state, new_state) VALUES (?, ?, ?, 'campaign', ?, ?, ?)`,
      [req.user.id, req.user.role, `manager.${action}`, req.params.id, JSON.stringify({ status: campaign.status }), JSON.stringify({ status: newStatus, note })]);

    const updated = await get<any>('SELECT * FROM ad_campaigns WHERE id = ?', [req.params.id]);
    res.json({ campaign: updated });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

/** GET /api/ads-manager/audit — audit log listing (paginated) */
router.get('/audit', authenticateToken, adminOrMod, async (req: any, res: Response) => {
  try {
    // SECURITY: bound page/limit and use placeholders. mysql2 supports binding
    // LIMIT/OFFSET when the values are integers, removing the template-literal path entirely.
    const page = Math.max(1, Math.min(10_000, parseInt(req.query.page as string) || 1));
    const limit = 50;
    const offset = (page - 1) * limit;
    const logs = await query<any>(
      `SELECT l.*, u.name AS actor_name
         FROM ad_audit_logs l
         LEFT JOIN users u ON u.id = COALESCE(l.actor_id, l.user_id)
        ORDER BY l.created_at DESC
        LIMIT ? OFFSET ?`,
      [limit, offset],
    );
    res.json({ logs, page, limit });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
