/**
 * Ad Moderation Routes — review queue, approvals, rejections, audit trail.
 */
import { Router, Response } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { query, run, get } from '../config/database.js';
import { sendPushFromTemplate } from '../notificationService.js';

const router = Router();

const adminOrMod = (req: any, res: Response, next: any) => {
  if (!['admin', 'moderator'].includes(req.user?.role)) return res.status(403).json({ message: 'Admin or moderator access required' });
  next();
};

// ─────────────────────────────────────────────────────────────────────────────
// MODERATION QUEUE
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/ad-moderation — full queue */
router.get('/', authenticateToken, adminOrMod, async (req: any, res: Response) => {
  try {
    const status = req.query.status || 'pending';
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    const reviews = await query<any>(
      `SELECT r.*,
         c.name AS campaign_name, c.objective, c.daily_budget, c.lifetime_budget, c.budget_type,
         c.schedule_start, c.schedule_end, c.status AS campaign_status,
         u.name AS coach_name, u.email AS coach_email,
         rev.name AS reviewer_name
       FROM ad_moderation_reviews r
       JOIN ad_campaigns c ON c.id = r.campaign_id
       JOIN users u ON u.id = c.coach_id
       LEFT JOIN users rev ON rev.id = r.reviewer_id
       WHERE r.status = ?
       ORDER BY r.created_at ASC
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      [status],
    );

    const [counts] = await query<any>(
      `SELECT
         SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) AS approved,
         SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) AS rejected,
         SUM(CASE WHEN status='flagged' THEN 1 ELSE 0 END) AS flagged,
         SUM(CASE WHEN status='needs_changes' THEN 1 ELSE 0 END) AS needs_changes
       FROM ad_moderation_reviews`,
    );

    res.json({ reviews, counts, page, limit });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

/** GET /api/ad-moderation/:id — single review detail */
router.get('/:id', authenticateToken, adminOrMod, async (req: any, res: Response) => {
  try {
    const review = await get<any>(
      `SELECT r.*, c.*, u.name AS coach_name, u.email AS coach_email
       FROM ad_moderation_reviews r
       JOIN ad_campaigns c ON c.id = r.campaign_id
       JOIN users u ON u.id = c.coach_id
       WHERE r.id = ?`,
      [req.params.id],
    );
    if (!review) return res.status(404).json({ message: 'Review not found' });

    // Fetch the campaign's ad sets and ads
    const adSets = await query<any>('SELECT * FROM ad_sets WHERE campaign_id = ?', [review.campaign_id]);
    const adSetIds = adSets.map((s: any) => s.id);
    const ads = adSetIds.length
      ? await query<any>(`SELECT a.*, ac.media_url, ac.format FROM ads a LEFT JOIN ad_creatives ac ON ac.id = a.creative_id WHERE a.ad_set_id IN (${adSetIds.map(() => '?').join(',')})`, adSetIds)
      : [];

    res.json({ review, adSets, ads });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

/** PATCH /api/ad-moderation/:id — take a moderation action */
router.patch('/:id', authenticateToken, adminOrMod, async (req: any, res: Response) => {
  try {
    const { action, notes, flags } = req.body;
    // action: approve | reject | flag | needs_changes
    const validActions = ['approve', 'reject', 'flag', 'needs_changes'];
    if (!validActions.includes(action)) return res.status(400).json({ message: `action must be one of: ${validActions.join(', ')}` });

    const review = await get<any>('SELECT * FROM ad_moderation_reviews WHERE id = ?', [req.params.id]);
    if (!review) return res.status(404).json({ message: 'Review not found' });

    const reviewStatus = action === 'approve' ? 'approved'
      : action === 'reject' ? 'rejected'
      : action === 'flag' ? 'flagged'
      : 'needs_changes';

    // Determine what campaign status to set
    const campaignStatus = action === 'approve' ? 'active'
      : action === 'reject' ? 'rejected'
      : action === 'flag' ? 'paused'
      : 'draft'; // needs_changes → back to draft

    // Update review
    await run(
      `UPDATE ad_moderation_reviews
       SET status = ?, reviewer_id = ?, notes = ?, flags = ?, resolved_at = NOW()
       WHERE id = ?`,
      [reviewStatus, req.user.id, notes || null, flags ? JSON.stringify(flags) : null, req.params.id],
    );

    // Update campaign status
    await run(
      `UPDATE ad_campaigns
       SET status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [campaignStatus, notes || null, req.user.id, review.campaign_id],
    );

    // Notify coach on rejection / needs_changes
    if (action === 'reject' || action === 'needs_changes' || action === 'flag') {
      const campaign = await get<any>('SELECT coach_id, name FROM ad_campaigns WHERE id = ?', [review.campaign_id]);
      if (campaign?.coach_id) {
        const titles: Record<string, string> = { reject: '❌ Campaign Rejected', needs_changes: '⚠️ Campaign Needs Changes', flag: '🚩 Campaign Flagged' };
        const reason = notes ? `: ${notes}` : '';
        await run('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)',
          [campaign.coach_id, 'ad_moderation', titles[action] || 'Campaign Update', `Your campaign "${campaign.name || 'Untitled'}" has been ${action === 'reject' ? 'rejected' : action === 'flag' ? 'flagged for review' : 'sent back for changes'}${reason}`, '/coach/ads/my-ads']);
        const adPushSlug = action === 'reject' ? 'ad_rejected' : action === 'flag' ? 'ad_flagged' : 'ad_needs_changes';
        sendPushFromTemplate(campaign.coach_id, adPushSlug, { campaign_name: campaign.name || 'Untitled' }).catch(() => {});
      }
    }

    // Audit
    await run(
      `INSERT INTO ad_audit_logs (actor_id, actor_role, action, entity_type, entity_id, old_state, new_state)
       VALUES (?, ?, ?, 'campaign', ?, ?, ?)`,
      [req.user.id, req.user.role, `moderation.${action}`, review.campaign_id,
       JSON.stringify({ status: review.status }),
       JSON.stringify({ status: reviewStatus, notes })],
    );

    const updated = await get<any>('SELECT * FROM ad_moderation_reviews WHERE id = ?', [req.params.id]);
    res.json({ review: updated, campaign_status: campaignStatus });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

/** POST /api/ad-moderation/auto-scan — trigger auto-moderation scan on a campaign */
router.post('/auto-scan', authenticateToken, adminOrMod, async (req: any, res: Response) => {
  try {
    const { campaign_id } = req.body;
    if (!campaign_id) return res.status(400).json({ message: 'campaign_id required' });

    const campaign = await get<any>('SELECT * FROM ad_campaigns WHERE id = ?', [campaign_id]);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    // Load flag keywords from settings
    const kwSetting = await get<any>(`SELECT setting_value FROM admin_ad_settings WHERE setting_key = 'auto_flag_keywords'`);
    const keywords: string[] = kwSetting ? JSON.parse(kwSetting.setting_value) : [];

    const autoFlagReasons: string[] = [];

    // Check campaign name/objective for prohibited keywords
    const textToScan = `${campaign.name}`.toLowerCase();
    for (const kw of keywords) {
      if (textToScan.includes(kw.toLowerCase())) {
        autoFlagReasons.push(`Prohibited keyword: "${kw}"`);
      }
    }

    // Check for duplicate campaigns from same coach
    const dupe = await get<any>(
      `SELECT id FROM ad_campaigns WHERE coach_id = ? AND name = ? AND id != ? LIMIT 1`,
      [campaign.coach_id, campaign.name, campaign_id],
    );
    if (dupe) autoFlagReasons.push('Duplicate campaign name detected');

    const wasFlagged = autoFlagReasons.length > 0;
    if (wasFlagged) {
      const flagAction = (await get<any>(`SELECT setting_value FROM admin_ad_settings WHERE setting_key = 'flag_action'`))?.setting_value || 'pause';

      const newStatus = flagAction === 'reject' ? 'rejected' : flagAction === 'pause' ? 'paused' : 'pending_review';

      await run(`UPDATE ad_campaigns SET status = ?, updated_at = NOW() WHERE id = ?`, [newStatus, campaign_id]);
      await run(
        `UPDATE ad_moderation_reviews SET status = 'flagged', auto_flagged = 1, auto_flag_reasons = ? WHERE campaign_id = ? AND status = 'pending'`,
        [JSON.stringify(autoFlagReasons), campaign_id],
      );
    }

    res.json({ flagged: wasFlagged, reasons: autoFlagReasons });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

/** GET /api/ad-moderation/stats — moderation statistics */
router.get('/stats/summary', authenticateToken, adminOrMod, async (_req: any, res: Response) => {
  try {
    const [totals] = await query<any>(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) AS approved,
         SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) AS rejected,
         SUM(CASE WHEN status='flagged' THEN 1 ELSE 0 END) AS flagged,
         SUM(CASE WHEN auto_flagged=1 THEN 1 ELSE 0 END) AS auto_flagged
       FROM ad_moderation_reviews`,
    );
    const recent = await query<any>(
      `SELECT r.*, c.name AS campaign_name, u.name AS coach_name
       FROM ad_moderation_reviews r
       JOIN ad_campaigns c ON c.id = r.campaign_id
       JOIN users u ON u.id = c.coach_id
       WHERE r.status IN ('approved','rejected') AND r.resolved_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       ORDER BY r.resolved_at DESC LIMIT 10`,
    );
    res.json({ totals, recent });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
