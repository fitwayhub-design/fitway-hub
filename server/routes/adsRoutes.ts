/**
 * Ads Routes — Campaign → Ad Set → Ad hierarchy
 * All internal; no external ad networks.
 */
import { Router, Response } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { query, run, get } from '../config/database.js';
import upload, { optimizeImage } from '../middleware/upload.js';
import { sendPushFromTemplate, sendPushToUser } from '../notificationService.js';

const router = Router();

// ── Role helpers ──────────────────────────────────────────────────────────────
const adminOnly = (req: any, res: Response, next: any) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
  next();
};
const coachOrAdmin = (req: any, res: Response, next: any) => {
  if (!['coach', 'admin'].includes(req.user?.role)) return res.status(403).json({ message: 'Coach or admin access required' });
  next();
};

// ── Ownership helpers ────────────────────────────────────────────────────────
// Resolve the owning coach_id for an ad_set (via its campaign) and an ad
// (via its ad_set → campaign). Returns null when the row does not exist.
async function getAdSetOwnerCoachId(adSetId: number | string): Promise<number | null> {
  const row = await get<any>(
    `SELECT c.coach_id
       FROM ad_sets s
       JOIN ad_campaigns c ON c.id = s.campaign_id
      WHERE s.id = ?`,
    [adSetId],
  );
  return row?.coach_id ?? null;
}
async function getAdOwnerCoachId(adId: number | string): Promise<number | null> {
  const row = await get<any>(
    `SELECT c.coach_id
       FROM ads a
       JOIN ad_sets s     ON s.id = a.ad_set_id
       JOIN ad_campaigns c ON c.id = s.campaign_id
      WHERE a.id = ?`,
    [adId],
  );
  return row?.coach_id ?? null;
}

// ── Audit helper ──────────────────────────────────────────────────────────────
async function audit(req: any, action: string, entityType: string, entityId: number | null, oldState?: any, newState?: any) {
  try {
    await run(
      `INSERT INTO ad_audit_logs (actor_id, actor_role, action, entity_type, entity_id, old_state, new_state, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, req.user.role, action, entityType, entityId,
       oldState ? JSON.stringify(oldState) : null,
       newState ? JSON.stringify(newState) : null,
       req.ip],
    );
  } catch { /* non-fatal */ }
}

// ── Check global ads enabled ──────────────────────────────────────────────────
async function adsEnabled(): Promise<boolean> {
  try {
    const s = await get<any>(`SELECT setting_value FROM admin_ad_settings WHERE setting_key = 'ads_system_enabled'`);
    return s?.setting_value === 'true';
  } catch { return true; }
}

async function getSetting(key: string): Promise<string | null> {
  try {
    const s = await get<any>(`SELECT setting_value FROM admin_ad_settings WHERE setting_key = ?`, [key]);
    return s?.setting_value ?? null;
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// CAMPAIGNS
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/ads/campaigns — list campaigns for the authenticated coach (or all for admin) */
router.get('/campaigns', authenticateToken, coachOrAdmin, async (req: any, res: Response) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const coachFilter = isAdmin ? '' : 'WHERE c.coach_id = ?';
    const params = isAdmin ? [] : [req.user.id];

    const campaigns = await query<any>(
      `SELECT c.*,
         u.name AS coach_name, u.email AS coach_email,
         COUNT(DISTINCT ads.id) AS ad_sets_count,
         COALESCE(SUM(ads.daily_budget), 0) AS total_ad_set_budget
       FROM ad_campaigns c
       LEFT JOIN users u ON u.id = c.coach_id
       LEFT JOIN ad_sets ads ON ads.campaign_id = c.id
       ${coachFilter}
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      params,
    );
    res.json({ campaigns });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

/** POST /api/ads/campaigns — create a new campaign */
router.post('/campaigns', authenticateToken, coachOrAdmin, async (req: any, res: Response) => {
  try {
    if (!(await adsEnabled())) return res.status(403).json({ message: 'Ads system is currently disabled' });

    const { name, objective, daily_budget, lifetime_budget, budget_type, schedule_start, schedule_end } = req.body;
    if (!name) return res.status(400).json({ message: 'Campaign name is required' });
    // Validate budget > 0
    const bType = budget_type || 'daily';
    const campaignBudget = bType === 'daily' ? parseFloat(daily_budget || '0') : parseFloat(lifetime_budget || '0');
    if (campaignBudget <= 0) return res.status(400).json({ message: 'Budget must be greater than 0' });

    const defaultStatus = (await getSetting('default_campaign_status')) ?? 'draft';
    const requireApproval = (await getSetting('require_admin_approval')) === 'true';
    // Approval lock: a coach-created campaign can never start 'active' — only admin can flip status.
    // Even if settings misconfigure default_campaign_status to 'active', clamp it here.
    const allowedOnCreate = new Set(['draft', 'pending_review']);
    let status = requireApproval ? 'pending_review' : defaultStatus;
    if (!allowedOnCreate.has(status) && req.user.role !== 'admin') status = 'pending_review';

    const result: any = await run(
      `INSERT INTO ad_campaigns (coach_id, name, objective, daily_budget, lifetime_budget, budget_type, schedule_start, schedule_end, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, name, objective || 'coaching', daily_budget || 0, lifetime_budget || 0,
       budget_type || 'daily', schedule_start || null, schedule_end || null, status],
    );

    const campaign = await get<any>('SELECT * FROM ad_campaigns WHERE id = ?', [result.insertId]);

    // Create moderation review record whenever the campaign lands in pending_review,
    // including the clamped case above. This guarantees a paper-trail for every review.
    if (status === 'pending_review') {
      await run(
        `INSERT INTO ad_moderation_reviews (campaign_id, status) VALUES (?, 'pending')`,
        [result.insertId],
      );
    }

    await audit(req, 'campaign.create', 'campaign', result.insertId, null, campaign);
    res.status(201).json({ campaign });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

/** GET /api/ads/campaigns/:id */
router.get('/campaigns/:id', authenticateToken, coachOrAdmin, async (req: any, res: Response) => {
  try {
    const campaign = await get<any>('SELECT * FROM ad_campaigns WHERE id = ?', [req.params.id]);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    if (req.user.role !== 'admin' && campaign.coach_id !== req.user.id)
      return res.status(403).json({ message: 'Not your campaign' });

    const adSets = await query<any>('SELECT * FROM ad_sets WHERE campaign_id = ? ORDER BY id', [campaign.id]);
    const adSetIds = adSets.map((s: any) => s.id);
    const ads = adSetIds.length
      ? await query<any>(`SELECT a.*, ac.media_url, ac.format, ac.thumbnail_url FROM ads a LEFT JOIN ad_creatives ac ON ac.id = a.creative_id WHERE a.ad_set_id IN (${adSetIds.map(() => '?').join(',')})`, adSetIds)
      : [];

    res.json({ campaign, adSets, ads });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

/** PATCH /api/ads/campaigns/:id */
router.patch('/campaigns/:id', authenticateToken, coachOrAdmin, async (req: any, res: Response) => {
  try {
    const campaign = await get<any>('SELECT * FROM ad_campaigns WHERE id = ?', [req.params.id]);
    if (!campaign) return res.status(404).json({ message: 'Not found' });
    if (req.user.role !== 'admin' && campaign.coach_id !== req.user.id)
      return res.status(403).json({ message: 'Not your campaign' });

    const { name, objective, daily_budget, lifetime_budget, budget_type, schedule_start, schedule_end } = req.body;
    await run(
      `UPDATE ad_campaigns SET name=COALESCE(?,name), objective=COALESCE(?,objective),
         daily_budget=COALESCE(?,daily_budget), lifetime_budget=COALESCE(?,lifetime_budget),
         budget_type=COALESCE(?,budget_type), schedule_start=COALESCE(?,schedule_start),
         schedule_end=COALESCE(?,schedule_end), updated_at=NOW()
       WHERE id=?`,
      [name, objective, daily_budget, lifetime_budget, budget_type, schedule_start, schedule_end, req.params.id],
    );

    const updated = await get<any>('SELECT * FROM ad_campaigns WHERE id = ?', [req.params.id]);
    await audit(req, 'campaign.update', 'campaign', campaign.id, campaign, updated);
    res.json({ campaign: updated });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

/** DELETE /api/ads/campaigns/:id */
router.delete('/campaigns/:id', authenticateToken, coachOrAdmin, async (req: any, res: Response) => {
  try {
    const campaign = await get<any>('SELECT * FROM ad_campaigns WHERE id = ?', [req.params.id]);
    if (!campaign) return res.status(404).json({ message: 'Not found' });
    if (req.user.role !== 'admin' && campaign.coach_id !== req.user.id)
      return res.status(403).json({ message: 'Not your campaign' });
    await run('DELETE FROM ad_campaigns WHERE id = ?', [req.params.id]);
    await audit(req, 'campaign.delete', 'campaign', campaign.id, campaign, null);
    res.json({ message: 'Campaign deleted' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── Admin: update campaign status ────────────────────────────────────────────
router.patch('/campaigns/:id/status', authenticateToken, adminOnly, async (req: any, res: Response) => {
  try {
    const { status, admin_note } = req.body;
    const campaign = await get<any>('SELECT * FROM ad_campaigns WHERE id = ?', [req.params.id]);
    if (!campaign) return res.status(404).json({ message: 'Not found' });

    await run(
      `UPDATE ad_campaigns SET status=?, admin_note=?, reviewed_by=?, reviewed_at=NOW(), updated_at=NOW() WHERE id=?`,
      [status, admin_note || null, req.user.id, req.params.id],
    );

    // Update moderation review
    await run(
      `UPDATE ad_moderation_reviews SET status=?, reviewer_id=?, notes=?, resolved_at=NOW() WHERE campaign_id=? AND status='pending'`,
      [status === 'active' ? 'approved' : status === 'rejected' ? 'rejected' : 'flagged', req.user.id, admin_note || null, req.params.id],
    );

    // Notify coach on rejection
    if (status === 'rejected' && campaign.coach_id) {
      const reason = admin_note ? `: ${admin_note}` : '';
      await run('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)',
        [campaign.coach_id, 'ad_rejected', '\u274c Campaign Rejected', `Your campaign "${campaign.name || 'Untitled'}" has been rejected${reason}`, '/coach/ads/my-ads']);
      sendPushFromTemplate(campaign.coach_id, 'ad_rejected', { campaign_name: campaign.name || 'Untitled' }, '/coach/ads/my-ads').catch(() => {});
    }
    // Notify coach on approval
    if (status === 'active' && campaign.coach_id) {
      sendPushFromTemplate(campaign.coach_id, 'ad_approved', { campaign_name: campaign.name || 'Untitled' }, '/coach/ads/my-ads').catch(() => {});
    }

    const updated = await get<any>('SELECT * FROM ad_campaigns WHERE id = ?', [req.params.id]);
    await audit(req, `campaign.status.${status}`, 'campaign', campaign.id, { status: campaign.status }, { status });
    res.json({ campaign: updated });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AD SETS
// ─────────────────────────────────────────────────────────────────────────────

router.get('/campaigns/:campaignId/ad-sets', authenticateToken, coachOrAdmin, async (req: any, res: Response) => {
  try {
    const sets = await query<any>('SELECT * FROM ad_sets WHERE campaign_id = ? ORDER BY id', [req.params.campaignId]);
    res.json({ adSets: sets });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/campaigns/:campaignId/ad-sets', authenticateToken, coachOrAdmin, async (req: any, res: Response) => {
  try {
    const campaign = await get<any>('SELECT * FROM ad_campaigns WHERE id = ?', [req.params.campaignId]);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    if (req.user.role !== 'admin' && campaign.coach_id !== req.user.id)
      return res.status(403).json({ message: 'Not your campaign' });

    const {
      name, placement, target_gender, target_age_min, target_age_max,
      target_location, target_lat, target_lng, target_radius_km,
      target_interests, target_activity_levels, target_languages,
      exclude_existing_clients, exclude_opted_out, daily_budget,
    } = req.body;

    const result: any = await run(
      `INSERT INTO ad_sets
         (campaign_id, name, placement, target_gender, target_age_min, target_age_max,
          target_location, target_lat, target_lng, target_radius_km,
          target_interests, target_activity_levels, target_languages,
          exclude_existing_clients, exclude_opted_out, daily_budget)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.params.campaignId, name || 'Ad Set 1', placement || 'feed',
       target_gender || 'all', target_age_min || 18, target_age_max || 65,
       target_location || null, target_lat || null, target_lng || null, target_radius_km || 50,
       target_interests ? JSON.stringify(target_interests) : null,
       target_activity_levels ? JSON.stringify(target_activity_levels) : null,
       target_languages ? JSON.stringify(target_languages) : null,
       exclude_existing_clients !== false ? 1 : 0,
       exclude_opted_out !== false ? 1 : 0,
       daily_budget || 0],
    );

    const adSet = await get<any>('SELECT * FROM ad_sets WHERE id = ?', [result.insertId]);
    await audit(req, 'adset.create', 'ad_set', result.insertId, null, adSet);
    res.status(201).json({ adSet });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/ad-sets/:id', authenticateToken, coachOrAdmin, async (req: any, res: Response) => {
  try {
    const set = await get<any>('SELECT * FROM ad_sets WHERE id = ?', [req.params.id]);
    if (!set) return res.status(404).json({ message: 'Not found' });

    // SECURITY: ownership check — non-admin coaches may only mutate their own ad sets.
    const ownerCoachId = await getAdSetOwnerCoachId(req.params.id);
    if (req.user.role !== 'admin' && ownerCoachId !== req.user.id) {
      return res.status(403).json({ message: 'Not your ad set' });
    }

    const fields = ['name','placement','target_gender','target_age_min','target_age_max',
      'target_location','target_lat','target_lng','target_radius_km','exclude_existing_clients','exclude_opted_out','daily_budget','status'];
    const updates = fields.filter(f => req.body[f] !== undefined).map(f => `${f}=?`);
    const vals = fields.filter(f => req.body[f] !== undefined).map(f => req.body[f]);
    if (!updates.length) return res.status(400).json({ message: 'Nothing to update' });

    await run(`UPDATE ad_sets SET ${updates.join(',')}, updated_at=NOW() WHERE id=?`, [...vals, req.params.id]);
    const updated = await get<any>('SELECT * FROM ad_sets WHERE id = ?', [req.params.id]);
    res.json({ adSet: updated });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/ad-sets/:id', authenticateToken, coachOrAdmin, async (req: any, res: Response) => {
  try {
    // SECURITY: ownership check — non-admin coaches may only delete their own ad sets.
    const ownerCoachId = await getAdSetOwnerCoachId(req.params.id);
    if (ownerCoachId === null) return res.status(404).json({ message: 'Not found' });
    if (req.user.role !== 'admin' && ownerCoachId !== req.user.id) {
      return res.status(403).json({ message: 'Not your ad set' });
    }
    await run('DELETE FROM ad_sets WHERE id = ?', [req.params.id]);
    res.json({ message: 'Ad set deleted' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADS
// ─────────────────────────────────────────────────────────────────────────────

router.get('/ad-sets/:adSetId/ads', authenticateToken, coachOrAdmin, async (req: any, res: Response) => {
  try {
    const ads = await query<any>(
      `SELECT a.*, ac.media_url, ac.format, ac.thumbnail_url
       FROM ads a LEFT JOIN ad_creatives ac ON ac.id = a.creative_id
       WHERE a.ad_set_id = ? ORDER BY a.id`,
      [req.params.adSetId],
    );
    res.json({ ads });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/ad-sets/:adSetId/ads', authenticateToken, coachOrAdmin, async (req: any, res: Response) => {
  try {
    const { name, creative_id, headline, body, cta, destination_type, destination_ref, campaign_id, variant_group, is_control } = req.body;
    const result: any = await run(
      `INSERT INTO ads (ad_set_id, campaign_id, name, creative_id, headline, body, cta, destination_type, destination_ref, variant_group, is_control)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.params.adSetId, campaign_id, name || 'Ad 1', creative_id || null,
       headline || null, body || null, cta || null, destination_type || 'profile',
       destination_ref || null, variant_group || null, is_control ? 1 : 0],
    );
    const ad = await get<any>('SELECT * FROM ads WHERE id = ?', [result.insertId]);
    res.status(201).json({ ad });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/ads/:id', authenticateToken, coachOrAdmin, async (req: any, res: Response) => {
  try {
    // SECURITY: ownership check before mutating an ad row.
    const ownerCoachId = await getAdOwnerCoachId(req.params.id);
    if (ownerCoachId === null) return res.status(404).json({ message: 'Not found' });
    if (req.user.role !== 'admin' && ownerCoachId !== req.user.id) {
      return res.status(403).json({ message: 'Not your ad' });
    }

    const { name, headline, body, cta, status, creative_id } = req.body;
    await run(
      `UPDATE ads SET name=COALESCE(?,name), headline=COALESCE(?,headline), body=COALESCE(?,body),
         cta=COALESCE(?,cta), status=COALESCE(?,status), creative_id=COALESCE(?,creative_id), updated_at=NOW()
       WHERE id=?`,
      [name, headline, body, cta, status, creative_id, req.params.id],
    );
    const ad = await get<any>('SELECT * FROM ads WHERE id = ?', [req.params.id]);
    res.json({ ad });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/ads/:id', authenticateToken, coachOrAdmin, async (req: any, res: Response) => {
  try {
    // SECURITY: ownership check before deletion.
    const ownerCoachId = await getAdOwnerCoachId(req.params.id);
    if (ownerCoachId === null) return res.status(404).json({ message: 'Not found' });
    if (req.user.role !== 'admin' && ownerCoachId !== req.user.id) {
      return res.status(403).json({ message: 'Not your ad' });
    }
    await run('DELETE FROM ads WHERE id = ?', [req.params.id]);
    res.json({ message: 'Ad deleted' });
  } catch { res.status(500).json({ message: 'Delete failed' }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// CREATIVES
// ─────────────────────────────────────────────────────────────────────────────

router.get('/creatives', authenticateToken, coachOrAdmin, async (req: any, res: Response) => {
  try {
    const isAdmin = req.user.role === 'admin';
    // Detect owner column name (coach_id / owner_id / created_by)
    const cols: any[] = await query(`SHOW COLUMNS FROM ad_creatives`);
    const colNames = cols.map(c => c.Field);
    const ownerCol = colNames.includes('coach_id') ? 'coach_id' : colNames.includes('owner_id') ? 'owner_id' : colNames.includes('created_by') ? 'created_by' : null;
    const where = isAdmin || !ownerCol ? '' : `WHERE ${ownerCol} = ?`;
    const params = isAdmin || !ownerCol ? [] : [req.user.id];
    const creatives = await query<any>(`SELECT * FROM ad_creatives ${where} ORDER BY created_at DESC`, params);
    res.json({ creatives });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/creatives', authenticateToken, coachOrAdmin, async (req: any, res: Response) => {
  try {
    const { name, format, media_url, thumbnail_url, file_size_kb, width, height, duration_seconds, carousel_items } = req.body;
    // Insert using whatever owner column exists
    const cols: any[] = await query(`SHOW COLUMNS FROM ad_creatives`);
    const colNames = cols.map(c => c.Field);
    const ownerCol = colNames.includes('coach_id') ? 'coach_id' : colNames.includes('owner_id') ? 'owner_id' : colNames.includes('created_by') ? 'created_by' : null;
    const insertCols: string[] = [];
    const vals: any[] = [];
    if (ownerCol) { insertCols.push(ownerCol); vals.push(req.user.id); }
    if (colNames.includes('name')) { insertCols.push('name'); vals.push(name || 'Creative'); }
    if (colNames.includes('format') || colNames.includes('type')) { insertCols.push(colNames.includes('format') ? 'format' : 'type'); vals.push(format || 'image'); }
    if (colNames.includes('media_url')) { insertCols.push('media_url'); vals.push(media_url || null); }
    else if (colNames.includes('url')) { insertCols.push('url'); vals.push(media_url || null); }
    if (colNames.includes('thumbnail_url')) { insertCols.push('thumbnail_url'); vals.push(thumbnail_url || null); }
    if (colNames.includes('file_size_kb')) { insertCols.push('file_size_kb'); vals.push(file_size_kb || null); }
    if (colNames.includes('width')) { insertCols.push('width'); vals.push(width || null); }
    if (colNames.includes('height')) { insertCols.push('height'); vals.push(height || null); }
    if (colNames.includes('duration_seconds')) { insertCols.push('duration_seconds'); vals.push(duration_seconds || null); }
    if (colNames.includes('carousel_items')) { insertCols.push('carousel_items'); vals.push(carousel_items ? JSON.stringify(carousel_items) : null); }
    if (colNames.includes('status')) { insertCols.push('status'); vals.push('active'); }

    const result: any = await run(`INSERT INTO ad_creatives (${insertCols.join(',')}) VALUES (${insertCols.map(()=>'?').join(',')})`, vals);
    const creative = await get<any>('SELECT * FROM ad_creatives WHERE id = ?', [result.insertId]);
    res.status(201).json({ creative });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Upload creative file (image/video) — stores in R2 and creates ad_creatives row
router.post('/creatives/upload', authenticateToken, coachOrAdmin, upload.single('file'), optimizeImage(), async (req: any, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'file is required' });
    // Upload buffer to R2
    const { uploadToR2 } = await import('../middleware/upload.js');
    const fileUrl = await uploadToR2(req.file, 'ad_creatives');
    const { originalname, mimetype, size } = req.file;
    const format = mimetype.startsWith('image/') ? 'image' : mimetype.startsWith('video/') ? 'video' : 'file';
    // Be tolerant of different schema shapes (url vs media_url, type vs format, owner column)
    const cols: any[] = await query(`SHOW COLUMNS FROM ad_creatives`);
    const colNames = cols.map(c => c.Field);
    const ownerCol = colNames.includes('coach_id') ? 'coach_id' : colNames.includes('owner_id') ? 'owner_id' : colNames.includes('created_by') ? 'created_by' : null;
    const insertCols: string[] = [];
    const vals: any[] = [];
    if (ownerCol) { insertCols.push(ownerCol); vals.push(req.user.id); }
    if (colNames.includes('media_url')) { insertCols.push('media_url'); vals.push(fileUrl); }
    else if (colNames.includes('url')) { insertCols.push('url'); vals.push(fileUrl); }
    if (colNames.includes('format') || colNames.includes('type')) { insertCols.push(colNames.includes('format') ? 'format' : 'type'); vals.push(format); }
    if (colNames.includes('thumbnail_url') || colNames.includes('thumbnailUrl')) { insertCols.push(colNames.includes('thumbnail_url') ? 'thumbnail_url' : 'thumbnailUrl'); vals.push(null); }
    if (colNames.includes('metadata') || colNames.includes('meta')) { insertCols.push(colNames.includes('metadata') ? 'metadata' : 'meta'); vals.push(JSON.stringify({ originalname, size, mimetype })); }
    if (colNames.includes('created_at')) { insertCols.push('created_at'); vals.push(new Date()); }
    if (colNames.includes('updated_at')) { insertCols.push('updated_at'); vals.push(new Date()); }

    const result: any = await run(`INSERT INTO ad_creatives (${insertCols.join(',')}) VALUES (${insertCols.map(()=>'?').join(',')})`, vals);
    const creative = await get<any>('SELECT * FROM ad_creatives WHERE id = ?', [result.insertId]);
    res.status(201).json({ creative });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Delete creative ──
router.delete('/creatives/:id', authenticateToken, coachOrAdmin, async (req: any, res: Response) => {
  try {
    const creative = await get<any>('SELECT * FROM ad_creatives WHERE id = ?', [req.params.id]);
    if (!creative) return res.status(404).json({ message: 'Creative not found' });
    // Check ownership (unless admin)
    const cols: any[] = await query(`SHOW COLUMNS FROM ad_creatives`);
    const colNames = cols.map((c: any) => c.Field);
    const ownerCol = colNames.includes('coach_id') ? 'coach_id' : colNames.includes('owner_id') ? 'owner_id' : colNames.includes('created_by') ? 'created_by' : null;
    if (ownerCol && req.user.role !== 'admin' && creative[ownerCol] !== req.user.id) {
      return res.status(403).json({ message: 'Not your creative' });
    }
    await run('DELETE FROM ad_creatives WHERE id = ?', [req.params.id]);
    res.json({ message: 'Creative deleted' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── List all ads flat (for MyAds / Analytics) ──
router.get('/ads', authenticateToken, coachOrAdmin, async (req: any, res: Response) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const filter = isAdmin ? '' : 'WHERE c.coach_id = ?';
    const params = isAdmin ? [] : [req.user.id];
    const ads = await query<any>(
      `SELECT a.*, s.name AS ad_set_name, c.name AS campaign_name,
              ac.media_url, ac.format AS creative_format, ac.thumbnail_url
       FROM ads a
       JOIN ad_sets s ON s.id = a.ad_set_id
       JOIN ad_campaigns c ON c.id = s.campaign_id
       LEFT JOIN ad_creatives ac ON ac.id = a.creative_id
       ${filter}
       ORDER BY a.created_at DESC`,
      params,
    );
    res.json({ ads });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Analytics stats (summary numbers) ──
router.get('/analytics/stats', authenticateToken, coachOrAdmin, async (req: any, res: Response) => {
  try {
    const coachId = req.user.role === 'admin' ? req.query.coach_id : req.user.id;
    const filter = coachId ? 'WHERE c.coach_id = ?' : '';
    const params = coachId ? [coachId] : [];
    const [row] = await query<any>(
      `SELECT
         COALESCE(SUM(a.impressions),0) AS total_impressions,
         COALESCE(SUM(a.clicks),0) AS total_clicks,
         COALESCE(SUM(a.conversions),0) AS total_conversions,
         COALESCE(SUM(a.amount_spent),0) AS total_spend
       FROM ads a
       JOIN ad_sets s ON s.id = a.ad_set_id
       JOIN ad_campaigns c ON c.id = s.campaign_id
       ${filter}`,
      params,
    );
    res.json(row || { total_impressions: 0, total_clicks: 0, total_conversions: 0, total_spend: 0 });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Analytics daily breakdown ──
router.get('/analytics/daily', authenticateToken, coachOrAdmin, async (req: any, res: Response) => {
  try {
    const coachId = req.user.role === 'admin' ? req.query.coach_id : req.user.id;
    const window = parseInt(req.query.window as string) || 30;
    const analytics = await query<any>(
      `SELECT DATE(e.recorded_at) AS date, e.event_type,
              COUNT(*) AS count
       FROM ad_events e
       JOIN ad_campaigns c ON c.id = e.campaign_id
       WHERE ${coachId ? 'c.coach_id = ? AND' : ''}
         e.recorded_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY date, e.event_type
       ORDER BY date`,
      coachId ? [coachId, window] : [window],
    );
    // Pivot into per-day objects
    const dayMap: Record<string, any> = {};
    for (const row of analytics) {
      const d = row.date;
      if (!dayMap[d]) dayMap[d] = { date: d, impressions: 0, clicks: 0, conversions: 0 };
      if (row.event_type === 'impression') dayMap[d].impressions = row.count;
      else if (row.event_type === 'click') dayMap[d].clicks = row.count;
      else if (row.event_type === 'conversion') dayMap[d].conversions = row.count;
    }
    res.json({ analytics: Object.values(dayMap) });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// EVENTS / TRACKING (internal only)
// ─────────────────────────────────────────────────────────────────────────────

router.post('/events', authenticateToken, async (req: any, res: Response) => {
  try {
    const { ad_id, campaign_id, event_type, placement, session_id } = req.body;
    if (!ad_id || !campaign_id || !event_type) return res.status(400).json({ message: 'Missing required fields' });

    await run(
      `INSERT INTO ad_events (ad_id, campaign_id, event_type, user_id, session_id, placement) VALUES (?, ?, ?, ?, ?, ?)`,
      [ad_id, campaign_id, event_type, req.user.id, session_id || null, placement || null],
    );

    // Increment counters on the ad
    const col = { impression: 'impressions', click: 'clicks', save: 'saves', booking: 'conversions', purchase: 'conversions' }[event_type as string];
    if (col) await run(`UPDATE ads SET ${col} = ${col} + 1 WHERE id = ?`, [ad_id]);

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS / REPORTING
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/ads/analytics/summary — coach-level summary */
router.get('/analytics/summary', authenticateToken, coachOrAdmin, async (req: any, res: Response) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const window = parseInt(req.query.window as string) || 30;
    const coachId = isAdmin ? req.query.coach_id : req.user.id;
    const filter = coachId ? 'WHERE c.coach_id = ?' : '';
    const params = coachId ? [coachId] : [];

    const [totals] = await query<any>(
      `SELECT
         COUNT(DISTINCT c.id) AS total_campaigns,
         COUNT(DISTINCT CASE WHEN c.status='active' THEN c.id END) AS active_campaigns,
         COALESCE(SUM(a.impressions), 0) AS total_impressions,
         COALESCE(SUM(a.clicks), 0) AS total_clicks,
         COALESCE(SUM(a.conversions), 0) AS total_conversions,
         COALESCE(SUM(a.amount_spent), 0) AS total_spent
       FROM ad_campaigns c
       LEFT JOIN ad_sets ads ON ads.campaign_id = c.id
       LEFT JOIN ads a ON a.ad_set_id = ads.id
       ${filter}`,
      params,
    );

    const byDay = await query<any>(
      `SELECT DATE(recorded_at) AS day, event_type, COUNT(*) AS cnt
       FROM ad_events e
       JOIN ad_campaigns c ON c.id = e.campaign_id
       WHERE ${coachId ? 'c.coach_id = ? AND' : ''}
         e.recorded_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY day, event_type ORDER BY day`,
      coachId ? [coachId, window] : [window],
    );

    const topAds = await query<any>(
      `SELECT a.id, a.name, a.impressions, a.clicks, a.conversions, a.ctr, c.name AS campaign_name
       FROM ads a
       JOIN ad_sets s ON s.id = a.ad_set_id
       JOIN ad_campaigns c ON c.id = s.campaign_id
       ${coachId ? 'WHERE c.coach_id = ?' : ''}
       ORDER BY a.impressions DESC LIMIT 5`,
      coachId ? [coachId] : [],
    );

    res.json({ totals, byDay, topAds });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// WALLET
// ─────────────────────────────────────────────────────────────────────────────

router.get('/wallet', authenticateToken, coachOrAdmin, async (req: any, res: Response) => {
  try {
    const coachId = req.user.role === 'admin' ? (req.query.coach_id || req.user.id) : req.user.id;
    const wallet = await get<any>('SELECT * FROM ad_wallets WHERE coach_id = ?', [coachId]);
    const ledger = await query<any>('SELECT * FROM ad_wallet_ledger WHERE coach_id = ? ORDER BY created_at DESC LIMIT 50', [coachId]);
    res.json({ wallet: wallet || { coach_id: coachId, balance: 0, lifetime_spent: 0 }, ledger });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/wallet/credit', authenticateToken, adminOnly, async (req: any, res: Response) => {
  try {
    const { coach_id, amount, note } = req.body;
    if (!coach_id || !amount) return res.status(400).json({ message: 'coach_id and amount required' });

    // Upsert wallet
    await run(
      `INSERT INTO ad_wallets (coach_id, balance) VALUES (?, ?) ON DUPLICATE KEY UPDATE balance = balance + ?`,
      [coach_id, amount, amount],
    );
    const wallet = await get<any>('SELECT * FROM ad_wallets WHERE coach_id = ?', [coach_id]);
    await run(
      `INSERT INTO ad_wallet_ledger (coach_id, entry_type, amount, balance_after, note, created_by) VALUES (?, 'credit', ?, ?, ?, ?)`,
      [coach_id, amount, wallet.balance, note || null, req.user.id],
    );

    await audit(req, 'wallet.credit', 'wallet', coach_id, null, { amount, balance: wallet.balance });
    res.json({ wallet });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PLACEMENTS (admin read)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/placements', authenticateToken, async (_req: any, res: Response) => {
  try {
    const placements = await query<any>('SELECT * FROM ad_placements ORDER BY priority_order');
    res.json({ placements });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOGS
// ─────────────────────────────────────────────────────────────────────────────

router.get('/audit-logs', authenticateToken, adminOnly, async (req: any, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 50;
    const offset = (page - 1) * limit;
    const logs = await query<any>(
      `SELECT l.*, u.name AS actor_name, u.email AS actor_email
       FROM ad_audit_logs l LEFT JOIN users u ON u.id = COALESCE(l.actor_id, l.user_id)
       ORDER BY l.created_at DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
    );
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE PRESETS
// ─────────────────────────────────────────────────────────────────────────────

router.get('/presets', authenticateToken, coachOrAdmin, async (_req: any, res: Response) => {
  try {
    const presets = await query<any>('SELECT * FROM ad_template_presets ORDER BY preset_type, id');
    res.json({ presets });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});
// ─────────────────────────────────────────────────────────────────────────────
// COACH ADS — Admin management of the legacy coach_ads table
// These are the ads coaches create through their Ads Manager wizard.
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/ads/coach-ads — list all coach ads (admin sees all, coach sees own) */
router.get('/coach-ads', authenticateToken, coachOrAdmin, async (req: any, res: Response) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const where = isAdmin ? '' : 'WHERE a.coach_id = ?';
    const params = isAdmin ? [] : [req.user.id];

    const ads = await query<any>(
      `SELECT a.*,
         u.name AS coach_name, u.email AS coach_email, u.avatar AS coach_avatar,
         COALESCE(ap.amount, 0)          AS paid_amount,
         COALESCE(ap.duration_minutes, 0) AS paid_minutes,
         ap.status                        AS payment_status,
         ap.proof_url                     AS payment_proof
       FROM coach_ads a
       LEFT JOIN users u ON u.id = a.coach_id
       LEFT JOIN ad_payments ap ON ap.ad_id = a.id
       ${where}
       ORDER BY a.created_at DESC`,
      params,
    );
    res.json({ campaigns: ads });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

/** PATCH /api/ads/coach-ads/:id/status — admin approve/reject/pause/archive a coach ad */
router.patch('/coach-ads/:id/status', authenticateToken, adminOnly, async (req: any, res: Response) => {
  try {
    const { status, admin_note } = req.body;
    const validStatuses = ['active', 'pending', 'rejected', 'paused', 'archived', 'expired'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const ad = await get<any>('SELECT * FROM coach_ads WHERE id = ?', [req.params.id]);
    if (!ad) return res.status(404).json({ message: 'Ad not found' });

    await run(
      `UPDATE coach_ads SET status = ?, admin_note = ?, updated_at = NOW() WHERE id = ?`,
      [status, admin_note || null, req.params.id],
    );

    // If approving, also approve the payment status and set boost window
    if (status === 'active') {
      await run(
        `UPDATE coach_ads SET payment_status = 'approved',
         boost_start = COALESCE(boost_start, NOW()),
         boost_end = COALESCE(boost_end, COALESCE(schedule_end, DATE_ADD(NOW(), INTERVAL 30 DAY)))
         WHERE id = ? AND (payment_status IS NULL OR payment_status != 'approved')`,
        [req.params.id],
      );
      await run(
        `UPDATE ad_payments SET status = 'approved', updated_at = NOW() WHERE ad_id = ? AND status = 'pending'`,
        [req.params.id],
      );
    }

    // Notify coach on rejection
    if (status === 'rejected' && ad.coach_id) {
      const reason = admin_note ? `: ${admin_note}` : '';
      const nTitle = '❌ Ad Rejected';
      const nBody = `Your ad "${ad.title || 'Untitled'}" has been rejected${reason}`;
      await run('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)',
        [ad.coach_id, 'ad_rejected', nTitle, nBody, '/coach/ads/my-ads']);
      sendPushToUser(ad.coach_id, nTitle, nBody, undefined, '/coach/ads/my-ads', 'ad_rejected').catch(() => {});
    }

    const updated = await get<any>('SELECT * FROM coach_ads WHERE id = ?', [req.params.id]);
    await audit(req, `coach_ad.status.${status}`, 'coach_ad', ad.id, { status: ad.status }, { status });
    res.json({ campaign: updated });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
