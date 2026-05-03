import { Router, Response } from 'express';
import { authenticateToken, requireActiveCoachMembershipForDeals } from '../middleware/auth.js';
import { upload, uploadVideo, optimizeImage, validateVideoSize, uploadToR2 } from '../middleware/upload.js';
import { get, run, query } from '../config/database.js';

const router = Router();

// ── Guards ────────────────────────────────────────────────────────────────────
const coachOrAdmin = (req: any, res: Response, next: any) => {
  if (req.user?.role !== 'coach' && req.user?.role !== 'admin')
    return res.status(403).json({ message: 'Coach access required' });
  next();
};

/** Strip HTML tags and control chars, collapse whitespace, clamp length. Prevents XSS in ad copy. */
function sanitizeAdText(input: unknown, maxLen = 500): string {
  if (input == null) return '';
  const raw = String(input);
  const noTags = raw.replace(/<[^>]*>/g, '');
  const cleaned = noTags.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').replace(/\s+/g, ' ').trim();
  return cleaned.slice(0, maxLen);
}

// ── Ads ───────────────────────────────────────────────────────────────────────

/** Auto-expire ads whose schedule_end has passed */
async function expireAds(coachId?: number) {
  const { expireAndResetAds } = await import('../services/adBillingService.js').catch(() => ({ expireAndResetAds: async () => {} }));
  await expireAndResetAds();
  // Only expire by boost_end if there is no schedule_end or schedule_end has also passed
  if (coachId) {
    await run("UPDATE coach_ads SET status='expired' WHERE status='active' AND boost_end IS NOT NULL AND boost_end < NOW() AND (schedule_end IS NULL OR schedule_end < CURDATE()) AND coach_id=?", [coachId]);
  } else {
    await run("UPDATE coach_ads SET status='expired' WHERE status='active' AND boost_end IS NOT NULL AND boost_end < NOW() AND (schedule_end IS NULL OR schedule_end < CURDATE())");
  }
}

/**
 * Build audience-targeted WHERE conditions based on the requesting user's real profile.
 * Matches against ad's audience_gender, audience_age_min/max, audience_goals, audience_activity_levels.
 */
async function getTargetedAdsForUser(userId: number, placementFilter?: string, limit = 20): Promise<any[]> {
  // Get viewer profile including location
  const viewer = await get<any>(
    `SELECT gender, date_of_birth, fitness_goal, activity_level, computed_activity_level,
            step_goal, latitude, longitude, city, country
     FROM users WHERE id = ?`,
    [userId]
  );

  // Compute viewer age
  let viewerAge: number | null = null;
  if (viewer?.date_of_birth) {
    const dob = new Date(viewer.date_of_birth);
    viewerAge = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000));
  }

  const viewerGender        = viewer?.gender || null;
  const viewerGoal          = viewer?.fitness_goal || null;
  const viewerActivityLevel = viewer?.computed_activity_level || viewer?.activity_level || null;
  const viewerLat           = viewer?.latitude ? parseFloat(viewer.latitude) : null;
  const viewerLng           = viewer?.longitude ? parseFloat(viewer.longitude) : null;

  // Build SQL — ad is shown if viewer matches ALL non-null audience criteria
  let sql = `
    SELECT a.*, u.name AS coach_name, u.avatar AS coach_avatar, u.email AS coach_email
    FROM coach_ads a
    INNER JOIN users u ON a.coach_id = u.id AND u.role = 'coach'
    WHERE a.status = 'active'
      AND a.coach_id IS NOT NULL
      AND (a.payment_status = 'approved' OR a.payment_status IS NULL OR a.payment_status = '')
  `;
  const params: any[] = [];

  // Placement filter
  if (placementFilter) {
    sql += ` AND (a.placement = 'all' OR a.placement = ? OR a.ad_type = ?)`;
    params.push(placementFilter, placementFilter);
  }

  // Gender targeting
  if (viewerGender) {
    sql += ` AND (a.audience_gender IS NULL OR a.audience_gender = 'all' OR a.audience_gender = ?)`;
    params.push(viewerGender);
  }

  // Age targeting
  if (viewerAge !== null) {
    sql += ` AND (a.audience_age_min IS NULL OR a.audience_age_min = 0 OR a.audience_age_min <= ?)`;
    params.push(viewerAge);
    sql += ` AND (a.audience_age_max IS NULL OR a.audience_age_max = 0 OR a.audience_age_max >= ?)`;
    params.push(viewerAge);
  }

  // Goal targeting
  if (viewerGoal) {
    sql += ` AND (
      a.audience_goals IS NULL OR a.audience_goals = '' OR
      FIND_IN_SET(?, a.audience_goals) > 0
    )`;
    params.push(viewerGoal);
  }

  // Activity level targeting
  if (viewerActivityLevel) {
    sql += ` AND (
      a.audience_activity_levels IS NULL OR a.audience_activity_levels = '' OR
      FIND_IN_SET(?, a.audience_activity_levels) > 0
    )`;
    params.push(viewerActivityLevel);
  }

  // Location targeting — Haversine distance filter
  // Only apply if BOTH the viewer has a location AND the ad has a target location set
  if (viewerLat !== null && viewerLng !== null) {
    sql += ` AND (
      a.target_lat IS NULL OR a.target_lng IS NULL OR
      (
        6371 * ACOS(
          LEAST(1.0, COS(RADIANS(?)) * COS(RADIANS(a.target_lat)) *
          COS(RADIANS(a.target_lng) - RADIANS(?)) +
          SIN(RADIANS(?)) * SIN(RADIANS(a.target_lat)))
        ) <= COALESCE(a.target_radius_km, 50)
      )
    )`;
    params.push(viewerLat, viewerLng, viewerLat);
  }

  // Schedule: only show ads within their run window
  sql += ` AND (a.schedule_start IS NULL OR a.schedule_start <= CURDATE())`;
  sql += ` AND (a.schedule_end IS NULL OR a.schedule_end >= CURDATE())`;

  sql += ` ORDER BY a.amount_spent DESC, a.created_at DESC LIMIT ?`;
  params.push(limit);

  return query(sql, params);
}

router.get('/ads/public', authenticateToken, async (req: any, res) => {
  try {
    await expireAds();
    const ads = await getTargetedAdsForUser(req.user.id, undefined, 20);
    res.json({ ads });
  } catch { res.status(500).json({ message: 'Failed to fetch ads' }); }
});

router.get('/ads/public/home', authenticateToken, async (req: any, res) => {
  try {
    await expireAds();
    // Fetch from legacy coach_ads table
    const coachAds = await getTargetedAdsForUser(req.user.id, 'home_banner', 5);

    // Also fetch from campaign-based ads system (ad_campaigns → ad_sets → ads → ad_creatives)
    let campaignAds: any[] = [];
    try {
      campaignAds = await query(
        `SELECT a.id, a.headline AS title, a.body AS description, 
                c.media_url AS image_url, c.thumbnail_url,
                a.cta, a.destination_type, a.destination_ref,
                camp.objective, camp.coach_id,
                u.name AS coach_name, u.avatar AS coach_avatar
         FROM ads a
         JOIN ad_sets s ON a.ad_set_id = s.id
         JOIN ad_campaigns camp ON a.campaign_id = camp.id
         LEFT JOIN ad_creatives c ON a.creative_id = c.id
         INNER JOIN users u ON camp.coach_id = u.id AND u.role = 'coach'
         WHERE a.status = 'active'
           AND camp.status = 'active'
           AND s.status = 'active'
           AND camp.coach_id IS NOT NULL
           AND (s.placement = 'all' OR s.placement = 'home_banner' OR s.placement = 'feed')
           AND (camp.schedule_start IS NULL OR camp.schedule_start <= CURDATE())
           AND (camp.schedule_end IS NULL OR camp.schedule_end >= CURDATE())
         ORDER BY camp.amount_spent DESC, camp.created_at DESC
         LIMIT 5`,
        []
      );
    } catch { /* campaign tables may not exist yet */ }

    // Merge both sources, coach_ads first, deduplicate by id prefix
    const merged = [
      ...coachAds.map((a: any) => ({ ...a, _src: 'coach' })),
      ...campaignAds.map((a: any) => ({ ...a, _src: 'campaign' })),
    ].slice(0, 5);

    res.json({ ads: merged });
  } catch { res.status(500).json({ message: 'Failed to fetch home ads' }); }
});

router.get('/ads/public/community', authenticateToken, async (req: any, res) => {
  try {
    await expireAds();
    const coachAds = await getTargetedAdsForUser(req.user.id, 'community', 5);

    // Also fetch from campaign-based ads system
    let campaignAds: any[] = [];
    try {
      campaignAds = await query(
        `SELECT a.id, a.headline AS title, a.body AS description, 
                c.media_url AS image_url, c.thumbnail_url,
                a.cta, a.destination_type, a.destination_ref,
                camp.objective, camp.coach_id,
                u.name AS coach_name, u.avatar AS coach_avatar
         FROM ads a
         JOIN ad_sets s ON a.ad_set_id = s.id
         JOIN ad_campaigns camp ON a.campaign_id = camp.id
         LEFT JOIN ad_creatives c ON a.creative_id = c.id
         INNER JOIN users u ON camp.coach_id = u.id AND u.role = 'coach'
         WHERE a.status = 'active'
           AND camp.status = 'active'
           AND s.status = 'active'
           AND camp.coach_id IS NOT NULL
           AND (s.placement = 'all' OR s.placement = 'community' OR s.placement = 'feed')
           AND (camp.schedule_start IS NULL OR camp.schedule_start <= CURDATE())
           AND (camp.schedule_end IS NULL OR camp.schedule_end >= CURDATE())
         ORDER BY camp.amount_spent DESC, camp.created_at DESC
         LIMIT 5`,
        []
      );
    } catch { /* campaign tables may not exist yet */ }

    const merged = [
      ...coachAds.map((a: any) => ({ ...a, _src: 'coach' })),
      ...campaignAds.map((a: any) => ({ ...a, _src: 'campaign' })),
    ].slice(0, 5);

    res.json({ ads: merged });
  } catch { res.status(500).json({ message: 'Failed to fetch community ads' }); }
});

// Audience size estimator — real DB count matching targeting criteria
// Hardcoded Egypt city coordinates for audience geo-estimation
const EGYPT_CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'Cairo':          { lat: 30.0444, lng: 31.2357 },
  'Giza':           { lat: 30.0131, lng: 31.2089 },
  'Alexandria':     { lat: 31.2001, lng: 29.9187 },
  'Hurghada':       { lat: 27.2579, lng: 33.8116 },
  'Sharm El Sheikh':{ lat: 27.9158, lng: 34.3300 },
  'Luxor':          { lat: 25.6872, lng: 32.6396 },
  'Aswan':          { lat: 24.0889, lng: 32.8998 },
  'Mansoura':       { lat: 31.0364, lng: 31.3807 },
  'Tanta':          { lat: 30.7865, lng: 31.0004 },
  'Suez':           { lat: 29.9668, lng: 32.5498 },
  'Ismailia':       { lat: 30.5965, lng: 32.2715 },
  'Port Said':      { lat: 31.2565, lng: 32.2841 },
  'Zagazig':        { lat: 30.5877, lng: 31.5021 },
  'Faiyum':         { lat: 29.3084, lng: 30.8428 },
  'Asyut':          { lat: 27.1809, lng: 31.1837 },
  'Egypt':          { lat: 26.8206, lng: 30.8025 }, // country centre
};

router.post('/ads/audience-estimate', authenticateToken, coachOrAdmin, async (req: any, res) => {
  try {
    const {
      audience_gender, audience_age_min, audience_age_max,
      audience_goals, audience_activity_levels,
      target_city, target_radius_km, target_lat, target_lng,
    } = req.body;

    const ALL_GOALS   = ['lose_weight','build_muscle','maintain_weight','gain_weight'];
    const ALL_LEVELS  = ['sedentary','light','moderate','active','very_active'];
    const SLIDER_MIN  = 13;
    const SLIDER_MAX  = 65;

    const goals  = (Array.isArray(audience_goals)           ? audience_goals           : (audience_goals  || '').split(',')).filter(Boolean);
    const levels = (Array.isArray(audience_activity_levels) ? audience_activity_levels : (audience_activity_levels || '').split(',')).filter(Boolean);
    const ageMin = Number(audience_age_min) || SLIDER_MIN;
    const ageMax = Number(audience_age_max) || SLIDER_MAX;

    // Rule: empty selection = all. If all items are selected = same as empty = all.
    const filterGoals  = goals.length > 0  && goals.length  < ALL_GOALS.length;
    const filterLevels = levels.length > 0 && levels.length < ALL_LEVELS.length;
    const filterAge    = ageMin > SLIDER_MIN || ageMax < SLIDER_MAX;

    let sql = `SELECT COUNT(DISTINCT u.id) AS cnt FROM users u WHERE u.role = 'user'`;
    const params: any[] = [];

    // ── Gender ────────────────────────────────────────────────────────────────
    if (audience_gender && audience_gender !== 'all') {
      sql += ` AND u.gender = ?`;
      params.push(audience_gender);
    }

    // ── Age — only filter when user actually moved the slider from defaults ───
    if (filterAge) {
      sql += ` AND u.date_of_birth IS NOT NULL`;
      if (ageMin > SLIDER_MIN) {
        sql += ` AND u.date_of_birth <= DATE_SUB(CURDATE(), INTERVAL ? YEAR)`;
        params.push(ageMin);
      }
      if (ageMax < SLIDER_MAX) {
        sql += ` AND u.date_of_birth >= DATE_SUB(CURDATE(), INTERVAL ? YEAR)`;
        params.push(ageMax);
      }
    }

    // ── Fitness Goals — only filter when a subset is chosen ──────────────────
    if (filterGoals) {
      sql += ` AND u.fitness_goal IN (${goals.map(() => '?').join(',')})`;
      params.push(...goals);
    }

    // ── Activity Level — only filter when a subset is chosen ─────────────────
    if (filterLevels) {
      sql += ` AND (u.computed_activity_level IN (${levels.map(() => '?').join(',')}) OR u.activity_level IN (${levels.map(() => '?').join(',')}))`;
      params.push(...levels, ...levels);
    }

    // ── Location ─────────────────────────────────────────────────────────────
    const cityStr = (target_city || '').trim();
    const pinLat  = target_lat ? parseFloat(String(target_lat)) : null;
    const pinLng  = target_lng ? parseFloat(String(target_lng)) : null;
    const rad     = Math.max(5, Math.min(200, parseInt(String(target_radius_km || '50'))));

    if (pinLat !== null && pinLng !== null) {
      sql += ` AND (
        (u.latitude IS NOT NULL AND 6371 * ACOS(LEAST(1.0,
          COS(RADIANS(?)) * COS(RADIANS(u.latitude)) *
          COS(RADIANS(u.longitude) - RADIANS(?)) +
          SIN(RADIANS(?)) * SIN(RADIANS(u.latitude))
        )) <= ?)
        OR (u.latitude IS NULL AND u.city IS NOT NULL AND u.city != '')
      )`;
      params.push(pinLat, pinLng, pinLat, rad);
    } else if (cityStr && cityStr.toLowerCase() !== 'all egypt') {
      sql += ` AND u.city = ?`;
      params.push(cityStr);
    }

    const row = await get<any>(sql, params);
    const count = row ? Number(row.cnt) : 0;
    // Debug: log the query in dev
    if (process.env.NODE_ENV !== 'production') {
      console.log('[audience-estimate] SQL:', sql);
      console.log('[audience-estimate] params:', params);
      console.log('[audience-estimate] result:', count);
    }
    res.json({ count });
  } catch (err) {
    console.error('[audience-estimate] ERROR:', err);
    // Return error details in dev so coach can debug
    if (process.env.NODE_ENV !== 'production') {
      res.status(500).json({ count: 0, error: String(err) });
    } else {
      res.status(500).json({ count: 0 });
    }
  }
});

router.get('/ads', authenticateToken, coachOrAdmin, async (req: any, res) => {
  try {
    await expireAds(req.user.id);
    const ads = await query(
      `SELECT a.*,
              COALESCE(ap.amount, 0)            AS paid_amount,
              COALESCE(ap.duration_minutes, 0)  AS paid_minutes,
              ap.status                         AS payment_status,
              ap.proof_url                      AS payment_proof
       FROM coach_ads a LEFT JOIN ad_payments ap ON ap.ad_id = a.id
       WHERE a.coach_id = ? ORDER BY a.created_at DESC`,
      [req.user.id]
    );
    res.json({ ads });
  } catch { res.status(500).json({ message: 'Failed to fetch ads' }); }
});

router.post('/ads', authenticateToken, coachOrAdmin, requireActiveCoachMembershipForDeals,
  uploadVideo.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]),
  validateVideoSize, optimizeImage(),
  async (req: any, res) => {
    const {
      title, description, specialty, cta, highlight, paymentMethod,
      ad_type, media_type, objective, duration_hours, duration_days,
      campaign_name, audience_gender, audience_age_min, audience_age_max,
      audience_goals, audience_activity_levels,
      budget_type, daily_budget, total_budget, schedule_start, schedule_end, placement,
      target_city, target_radius_km, target_lat, target_lng,
      contact_phone,
    } = req.body;
    if (!title || !description) return res.status(400).json({ message: 'Title and description required' });
    // Sanitize user-supplied ad copy to prevent XSS / control-char abuse
    const safeTitle       = sanitizeAdText(title, 120);
    const safeDescription = sanitizeAdText(description, 1000);
    const safeSpecialty   = sanitizeAdText(specialty, 80);
    const safeCta         = sanitizeAdText(cta, 40) || 'Book Free Consultation';
    const safeHighlight   = sanitizeAdText(highlight, 120);
    const safeCampaignName= sanitizeAdText(campaign_name || title, 120);
    if (!safeTitle || !safeDescription) return res.status(400).json({ message: 'Title and description required' });
    // Validate budget > 0
    const bType = budget_type || 'daily';
    const effectiveBudget = bType === 'daily' ? parseFloat(daily_budget || '0') : parseFloat(total_budget || '0');
    if (effectiveBudget <= 0) return res.status(400).json({ message: 'Budget must be greater than 0' });
    try {
      const files = req.files as { [f: string]: Express.Multer.File[] };
      const imageUrl = files?.image?.[0] ? await uploadToR2(files.image[0], 'ads') : null;
      const videoUrl = media_type === 'youtube' ? req.body.video_url : (files?.video?.[0] ? await uploadToR2(files.video[0], 'ads') : null);
      const { insertId } = await run(
        `INSERT INTO coach_ads (
          coach_id, title, description, specialty, cta, highlight, image_url, video_url,
          payment_method, ad_type, media_type, objective, duration_hours, duration_days,
          campaign_name, audience_gender, audience_age_min, audience_age_max,
          audience_goals, audience_activity_levels,
          budget_type, daily_budget, total_budget, schedule_start, schedule_end, placement,
          target_city, target_radius_km, target_lat, target_lng, contact_phone
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          req.user.id, safeTitle, safeDescription, safeSpecialty, safeCta, safeHighlight,
          imageUrl, videoUrl, paymentMethod || 'ewallet',
          ad_type || placement || 'community', media_type || 'image',
          objective || 'coaching', parseInt(duration_hours || '0'), parseInt(duration_days || '0'),
          safeCampaignName,
          audience_gender || 'all',
          parseInt(audience_age_min || '18'), parseInt(audience_age_max || '65'),
          audience_goals || '', audience_activity_levels || '',
          budget_type || 'daily',
          parseFloat(daily_budget || '0'), parseFloat(total_budget || '0'),
          schedule_start || null, schedule_end || null,
          placement || 'all',
          target_city || null, parseInt(target_radius_km || '50'),
          target_lat ? parseFloat(target_lat) : null, target_lng ? parseFloat(target_lng) : null,
          contact_phone || null,
        ]
      );
      const ad = await get('SELECT * FROM coach_ads WHERE id = ?', [insertId]);
      res.json({ ad, message: 'Ad submitted for review' });
    } catch (err) { console.error(err); res.status(500).json({ message: 'Failed to create ad' }); }
  }
);

router.put('/ads/:id', authenticateToken, coachOrAdmin, requireActiveCoachMembershipForDeals,
  uploadVideo.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]),
  validateVideoSize, optimizeImage(),
  async (req: any, res) => {
    const { title, description, specialty, cta, highlight, paymentMethod, ad_type, media_type, objective, duration_hours, duration_days } = req.body;
    try {
      const existing = await get<any>('SELECT * FROM coach_ads WHERE id = ? AND coach_id = ?', [req.params.id, req.user.id]);
      if (!existing) return res.status(404).json({ message: 'Ad not found' });
      const safeTitle       = sanitizeAdText(title, 120);
      const safeDescription = sanitizeAdText(description, 1000);
      const safeSpecialty   = sanitizeAdText(specialty, 80);
      const safeCta         = sanitizeAdText(cta, 40);
      const safeHighlight   = sanitizeAdText(highlight, 120);
      if (!safeTitle || !safeDescription) return res.status(400).json({ message: 'Title and description required' });
      const files = req.files as { [f: string]: Express.Multer.File[] };
      const imageUrl = files?.image?.[0] ? await uploadToR2(files.image[0], 'ads') : existing.image_url;
      const videoUrl = media_type === 'youtube' ? req.body.video_url : (files?.video?.[0] ? await uploadToR2(files.video[0], 'ads') : existing.video_url);
      await run(
        "UPDATE coach_ads SET title=?, description=?, specialty=?, cta=?, highlight=?, image_url=?, video_url=?, payment_method=?, ad_type=?, media_type=?, objective=?, duration_hours=?, duration_days=?, status='pending', updated_at=NOW() WHERE id=?",
        [safeTitle, safeDescription, safeSpecialty, safeCta, safeHighlight, imageUrl, videoUrl, paymentMethod || 'ewallet', ad_type || existing.ad_type, media_type || existing.media_type, objective || existing.objective, parseInt(duration_hours ?? existing.duration_hours ?? '0'), parseInt(duration_days ?? existing.duration_days ?? '0'), req.params.id]
      );
      res.json({ message: 'Ad updated, pending review' });
    } catch { res.status(500).json({ message: 'Failed to update ad' }); }
  }
);

router.delete('/ads/:id', authenticateToken, coachOrAdmin, requireActiveCoachMembershipForDeals, async (req: any, res) => {
  try {
    const existing = await get('SELECT id FROM coach_ads WHERE id = ? AND coach_id = ?', [req.params.id, req.user.id]);
    if (!existing) return res.status(404).json({ message: 'Ad not found' });
    await run('DELETE FROM coach_ads WHERE id = ?', [req.params.id]);
    res.json({ message: 'Ad deleted' });
  } catch { res.status(500).json({ message: 'Failed to delete ad' }); }
});

router.post('/ads/:id/payment', authenticateToken, coachOrAdmin, requireActiveCoachMembershipForDeals, async (req: any, res) => {
  const { duration_minutes, payment_method, proof_url, phone, card_last4 } = req.body;
  if (!duration_minutes || duration_minutes < 1) return res.status(400).json({ message: 'Duration must be at least 1 minute' });
  const RATE_PER_MINUTE = 4;
  const amount = parseFloat((duration_minutes * RATE_PER_MINUTE).toFixed(2));
  try {
    const ad = await get<any>('SELECT id, coach_id FROM coach_ads WHERE id = ? AND coach_id = ?', [req.params.id, req.user.id]);
    if (!ad) return res.status(404).json({ message: 'Ad not found' });
    const existing = await get('SELECT id FROM ad_payments WHERE ad_id = ?', [req.params.id]);
    if (existing) {
      await run('UPDATE ad_payments SET duration_minutes=?, amount=?, payment_method=?, proof_url=?, phone=?, card_last4=?, status=?, updated_at=NOW() WHERE ad_id=?',
        [duration_minutes, amount, payment_method || 'ewallet', proof_url || null, phone || null, card_last4 || null, 'pending', req.params.id]);
    } else {
      await run('INSERT INTO ad_payments (ad_id, coach_id, duration_minutes, amount, payment_method, proof_url, phone, card_last4, status) VALUES (?,?,?,?,?,?,?,?,?)',
        [req.params.id, req.user.id, duration_minutes, amount, payment_method || 'ewallet', proof_url || null, phone || null, card_last4 || null, 'pending']);
    }
    await run("UPDATE coach_ads SET status='pending', updated_at=NOW() WHERE id=?", [req.params.id]);
    res.json({ message: 'Payment submitted, awaiting admin approval', amount, duration_minutes });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Failed to submit payment' }); }
});

router.get('/ads/:id/payment', authenticateToken, coachOrAdmin, async (req, res) => {
  try {
    const payment = await get('SELECT * FROM ad_payments WHERE ad_id = ?', [req.params.id]);
    res.json({ payment: payment || null });
  } catch { res.status(500).json({ message: 'Failed to fetch payment' }); }
});

// ── Ad tracking ───────────────────────────────────────────────────────────────

// In-memory dedup: same user+ad within window is treated as one click. Prevents accidental
// double-taps, rage-clicks, and rudimentary click fraud from inflating metrics or billing.
const CLICK_DEDUP_WINDOW_MS = 30_000;
const recentClicks = new Map<string, number>();
setInterval(() => {
  const cutoff = Date.now() - CLICK_DEDUP_WINDOW_MS;
  for (const [k, t] of recentClicks) if (t < cutoff) recentClicks.delete(k);
}, 60_000).unref?.();

router.post('/ads/:id/click', authenticateToken, async (req: any, res) => {
  try {
    const adId = parseInt(req.params.id);
    if (!Number.isFinite(adId) || adId <= 0) return res.status(400).json({ message: 'Invalid ad id' });
    const key = `${req.user.id}:${adId}`;
    const last = recentClicks.get(key) || 0;
    if (Date.now() - last < CLICK_DEDUP_WINDOW_MS) {
      return res.json({ ok: true, deduped: true });
    }
    recentClicks.set(key, Date.now());
    await run('UPDATE coach_ads SET clicks = clicks + 1 WHERE id = ?', [adId]);
    // Real billing — deduct click cost from budget
    const { billClick } = await import('../services/adBillingService.js');
    billClick(adId).catch(() => {});
    res.json({ ok: true });
  } catch { res.status(500).json({ message: 'Failed to track click' }); }
});

router.post('/ads/:id/impression', authenticateToken, async (req, res) => {
  try {
    const adId = parseInt(req.params.id);
    await run('UPDATE coach_ads SET impressions = impressions + 1 WHERE id = ?', [adId]);
    const { billImpression } = await import('../services/adBillingService.js');
    billImpression(adId).catch(() => {});
    res.json({ ok: true });
  } catch { res.status(500).json({ message: 'Failed to track impression' }); }
});

router.post('/ads/impressions', authenticateToken, async (req: any, res) => {
  try {
    const { ids } = req.body;
    if (Array.isArray(ids) && ids.length > 0) {
      await run(`UPDATE coach_ads SET impressions = impressions + 1 WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
      // Bill each ad
      const { billImpression, expireAndResetAds } = await import('../services/adBillingService.js');
      expireAndResetAds().catch(() => {});
      ids.forEach((id: number) => billImpression(id).catch(() => {}));
    }
    res.json({ ok: true });
  } catch { res.status(500).json({ message: 'Failed to track impressions' }); }
});

// ── Coach follow / unfollow ───────────────────────────────────────────────────

router.post('/follow/:coachId', authenticateToken, async (req: any, res) => {
  try {
    await run('INSERT IGNORE INTO coach_follows (follower_id, coach_id) VALUES (?,?)', [req.user.id, req.params.coachId]);
    res.json({ following: true });
  } catch { res.status(500).json({ message: 'Failed to follow coach' }); }
});

router.delete('/follow/:coachId', authenticateToken, async (req: any, res) => {
  try {
    await run('DELETE FROM coach_follows WHERE follower_id=? AND coach_id=?', [req.user.id, req.params.coachId]);
    res.json({ following: false });
  } catch { res.status(500).json({ message: 'Failed to unfollow coach' }); }
});

router.get('/follow/:coachId/status', authenticateToken, async (req: any, res) => {
  try {
    const row = await get('SELECT id FROM coach_follows WHERE follower_id=? AND coach_id=?', [req.user.id, req.params.coachId]);
    res.json({ following: !!row });
  } catch { res.status(500).json({ message: 'Failed to check follow status' }); }
});

router.get('/following', authenticateToken, async (req: any, res) => {
  try {
    const coaches = await query(
      `SELECT u.id, u.name, u.avatar, u.email, cp.specialty, cp.bio
       FROM coach_follows cf
       JOIN users u ON cf.coach_id = u.id
       LEFT JOIN coach_profiles cp ON cp.user_id = u.id
       WHERE cf.follower_id = ? ORDER BY cf.created_at DESC`,
      [req.user.id]
    );
    res.json({ coaches });
  } catch { res.status(500).json({ message: 'Failed to fetch following' }); }
});

// ── Coach-managed athletes ────────────────────────────────────────────────────

router.get('/users', authenticateToken, coachOrAdmin, async (req: any, res) => {
  try {
    const users = await query(
      `SELECT DISTINCT u.id, u.name, u.email, u.avatar, u.points, u.steps,
              u.height, u.weight, u.gender, u.step_goal, u.date_of_birth,
              u.fitness_goal, u.activity_level, u.target_weight, u.weekly_goal,
              u.computed_activity_level, u.city, u.country, u.medical_history, u.medical_file_url
       FROM users u
       INNER JOIN coach_subscriptions cs ON cs.user_id = u.id
       WHERE cs.coach_id = ? AND cs.status = 'active' AND (cs.expires_at IS NULL OR cs.expires_at > NOW())
       ORDER BY u.name ASC`,
      [req.user.id]
    );
    res.json({ users });
  } catch { res.status(500).json({ message: 'Failed to fetch users' }); }
});

router.get('/users/:id/profile', authenticateToken, coachOrAdmin, async (req, res) => {
  try {
    const user = await get<any>(
      `SELECT id, name, email, avatar, height, weight, gender, points, steps, step_goal,
              date_of_birth, fitness_goal, activity_level, target_weight, weekly_goal,
              computed_activity_level, city, country, medical_history, medical_file_url
       FROM users WHERE id = ?`,
      [req.params.id]
    );
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch { res.status(500).json({ message: 'Failed to fetch user' }); }
});

router.get('/users/:id/workout-plan', authenticateToken, coachOrAdmin, async (req, res) => {
  const plan: any = await get('SELECT * FROM workout_plans WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [req.params.id]);
  if (plan) { try { plan.exercises = typeof plan.exercises === 'string' ? JSON.parse(plan.exercises) : plan.exercises || []; } catch { plan.exercises = []; } }
  res.json({ plan: plan || null });
});

router.post('/users/:id/workout-plan', authenticateToken, coachOrAdmin, requireActiveCoachMembershipForDeals, async (req: any, res) => {
  const { title, description, days_per_week, exercises } = req.body;
  const exercisesJson = JSON.stringify(exercises || []);
  const existing = await get('SELECT id FROM workout_plans WHERE user_id = ?', [req.params.id]);
  if (existing) {
    await run('UPDATE workout_plans SET title=?, description=?, days_per_week=?, exercises=?, coach_id=? WHERE user_id=?',
      [title, description, days_per_week, exercisesJson, req.user.id, req.params.id]);
  } else {
    await run('INSERT INTO workout_plans (user_id, coach_id, title, description, days_per_week, exercises) VALUES (?,?,?,?,?,?)',
      [req.params.id, req.user.id, title, description, days_per_week, exercisesJson]);
  }
  res.json({ message: 'Workout plan saved' });
});

router.get('/users/:id/nutrition-plan', authenticateToken, coachOrAdmin, async (req, res) => {
  const plan: any = await get('SELECT * FROM nutrition_plans WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [req.params.id]);
  if (plan) { try { plan.meals = typeof plan.meals === 'string' ? JSON.parse(plan.meals) : plan.meals || []; } catch { plan.meals = []; } }
  res.json({ plan: plan || null });
});

router.post('/users/:id/nutrition-plan', authenticateToken, coachOrAdmin, requireActiveCoachMembershipForDeals, async (req: any, res) => {
  const { title, daily_calories, protein_g, carbs_g, fat_g, meals, notes } = req.body;
  const mealsJson = JSON.stringify(meals || []);
  const existing = await get('SELECT id FROM nutrition_plans WHERE user_id = ?', [req.params.id]);
  if (existing) {
    await run('UPDATE nutrition_plans SET title=?, daily_calories=?, protein_g=?, carbs_g=?, fat_g=?, meals=?, notes=?, coach_id=? WHERE user_id=?',
      [title, daily_calories, protein_g, carbs_g, fat_g, mealsJson, notes, req.user.id, req.params.id]);
  } else {
    await run('INSERT INTO nutrition_plans (user_id, coach_id, title, daily_calories, protein_g, carbs_g, fat_g, meals, notes) VALUES (?,?,?,?,?,?,?,?,?)',
      [req.params.id, req.user.id, title, daily_calories, protein_g, carbs_g, fat_g, mealsJson, notes]);
  }
  res.json({ message: 'Nutrition plan saved' });
});

router.patch('/users/:id/step-goal', authenticateToken, coachOrAdmin, requireActiveCoachMembershipForDeals, async (req, res) => {
  const { step_goal } = req.body;
  if (!step_goal || step_goal < 100) return res.status(400).json({ message: 'Invalid step goal' });
  try {
    await run('UPDATE users SET step_goal = ? WHERE id = ?', [step_goal, req.params.id]);
    res.json({ success: true, step_goal, message: 'Step goal updated' });
  } catch { res.status(500).json({ message: 'Failed to update step goal' }); }
});

// ── Coach dashboard stats ─────────────────────────────────────────────────────

router.get('/stats', authenticateToken, coachOrAdmin, async (req: any, res) => {
  try {
    const coachId = req.user.id;
    const now = new Date();
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const [[athleteRow], [pendingRow], [revenueRow], [ratingRow], [weekSessionsRow], [totalRow]] = await Promise.all([
      query("SELECT COUNT(DISTINCT user_id) AS cnt FROM coach_subscriptions WHERE coach_id = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > NOW())", [coachId]) as any,
      query("SELECT COUNT(*) AS cnt FROM coaching_bookings WHERE coach_id = ? AND status = 'pending'", [coachId]) as any,
      query("SELECT IFNULL(SUM(credited_amount), 0) AS total FROM coach_subscriptions WHERE coach_id = ? AND status = 'active' AND created_at >= ?", [coachId, monthStart]) as any,
      query("SELECT IFNULL(AVG(rating), 0) AS avg, COUNT(*) AS cnt FROM coach_reviews WHERE coach_id = ?", [coachId]) as any,
      query("SELECT COUNT(*) AS cnt FROM coaching_bookings WHERE coach_id = ? AND status = 'accepted' AND date >= ?", [coachId, weekStartStr]) as any,
      query("SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) AS accepted FROM coaching_bookings WHERE coach_id = ?", [coachId]) as any,
    ]);

    const completionRate = totalRow?.total > 0 ? Math.round((totalRow.accepted / totalRow.total) * 100) : 0;

    const weeklyRows = await query(
      "SELECT date, COUNT(*) AS sessions FROM coaching_bookings WHERE coach_id = ? AND status = 'accepted' AND date >= ? GROUP BY date ORDER BY date ASC",
      [coachId, weekStartStr]
    ) as any[];

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyMap: Record<string, any> = {};
    weeklyRows.forEach((r: any) => { weeklyMap[r.date] = r; });
    const weekly = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
      const ds = d.toISOString().split('T')[0];
      return { day: days[d.getDay()], sessions: weeklyMap[ds]?.sessions || 0 };
    });

    res.json({
      athletes: athleteRow?.cnt || 0,
      pendingRequests: pendingRow?.cnt || 0,
      monthlyRevenue: revenueRow?.total || 0,
      avgRating: parseFloat((ratingRow?.avg || 0).toFixed(1)),
      reviewCount: ratingRow?.cnt || 0,
      sessionsThisWeek: weekSessionsRow?.cnt || 0,
      completionRate,
      weekly,
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Failed to fetch stats' }); }
});

router.get('/upcoming-sessions', authenticateToken, coachOrAdmin, async (req: any, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const sessions = await query(
      `SELECT cb.*, u.name AS athlete_name, u.avatar AS athlete_avatar
       FROM coaching_bookings cb LEFT JOIN users u ON cb.user_id = u.id
       WHERE cb.coach_id = ? AND cb.status IN ('accepted','pending') AND (cb.date >= ? OR cb.date IS NULL OR cb.date = '')
       ORDER BY cb.date ASC, cb.time ASC LIMIT 10`,
      [req.user.id, today]
    );
    res.json({ sessions });
  } catch { res.status(500).json({ message: 'Failed to fetch sessions' }); }
});

router.get('/activity', authenticateToken, coachOrAdmin, async (req: any, res) => {
  try {
    const coachId = req.user.id;
    const [bookings, msgs, reviews] = await Promise.all([
      query(`SELECT 'booking' AS type, cb.id, cb.status, cb.created_at, u.name AS actor_name, u.avatar AS actor_avatar FROM coaching_bookings cb LEFT JOIN users u ON cb.user_id = u.id WHERE cb.coach_id = ? ORDER BY cb.created_at DESC LIMIT 5`, [coachId]) as any,
      query(`SELECT 'message' AS type, m.id, m.content, m.created_at, u.name AS actor_name, u.avatar AS actor_avatar FROM messages m LEFT JOIN users u ON m.sender_id = u.id WHERE m.receiver_id = ? AND m.sender_id != ? ORDER BY m.created_at DESC LIMIT 5`, [coachId, coachId]) as any,
      query(`SELECT 'review' AS type, r.id, r.rating, r.text, r.created_at, u.name AS actor_name, u.avatar AS actor_avatar FROM coach_reviews r LEFT JOIN users u ON r.user_id = u.id WHERE r.coach_id = ? ORDER BY r.created_at DESC LIMIT 5`, [coachId]) as any,
    ]);
    const all = [...bookings, ...msgs, ...reviews]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);
    res.json({ activity: all });
  } catch { res.status(500).json({ message: 'Failed to fetch activity' }); }
});

router.get('/dashboard-home', authenticateToken, coachOrAdmin, async (req: any, res) => {
  try {
    const coachId = req.user.id;
    const [athletes, recentRequests, recentPosts, recentTransactions] = await Promise.all([
      query(
        `SELECT u.id, u.name, u.avatar, u.email,
                cs.plan_type, cs.plan_cycle, cs.created_at AS subscribed_at
         FROM coach_subscriptions cs
         INNER JOIN users u ON u.id = cs.user_id
         WHERE cs.coach_id = ?
           AND cs.status = 'active'
           AND (cs.expires_at IS NULL OR cs.expires_at > NOW())
         ORDER BY cs.created_at DESC
         LIMIT 6`,
        [coachId]
      ),
      query(
        `SELECT cb.id, cb.status, cb.date, cb.time, cb.created_at,
                u.id AS user_id, u.name AS user_name, u.avatar AS user_avatar
         FROM coaching_bookings cb
         LEFT JOIN users u ON u.id = cb.user_id
         WHERE cb.coach_id = ?
         ORDER BY cb.created_at DESC
         LIMIT 6`,
        [coachId]
      ),
      query(
        `SELECT p.id, p.content, p.media_url, p.created_at,
                u.id AS author_id, u.name AS author_name, u.avatar AS author_avatar,
                (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS likes,
                (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) AS comments
         FROM posts p
         INNER JOIN users u ON u.id = p.user_id
         ORDER BY p.created_at DESC
         LIMIT 6`
      ),
      query(
        `SELECT cs.id, cs.status, cs.amount, cs.credited_amount, cs.plan_type, cs.plan_cycle, cs.created_at,
                u.id AS user_id, u.name AS user_name, u.avatar AS user_avatar
         FROM coach_subscriptions cs
         LEFT JOIN users u ON u.id = cs.user_id
         WHERE cs.coach_id = ?
         ORDER BY cs.created_at DESC
         LIMIT 6`,
        [coachId]
      ),
    ]);

    res.json({
      athletes,
      recentRequests,
      recentPosts,
      recentTransactions,
    });
  } catch {
    res.status(500).json({ message: 'Failed to fetch dashboard home data' });
  }
});

// ── Notifications ─────────────────────────────────────────────────────────────

router.get('/notifications', authenticateToken, async (req: any, res) => {
  try {
    const notifs = await query('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20', [req.user.id]);
    res.json({ notifications: notifs });
  } catch { res.status(500).json({ message: 'Failed to fetch notifications' }); }
});

router.patch('/notifications/:id/read', authenticateToken, async (req: any, res) => {
  try {
    await run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch { res.status(500).json({ message: 'Failed to mark read' }); }
});

router.post('/notifications/read-all', authenticateToken, async (req: any, res) => {
  try {
    await run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ ok: true });
  } catch { res.status(500).json({ message: 'Failed to mark all read' }); }
});

// ── Coach public profile ──────────────────────────────────────────────────────

router.get('/profile/:coachId/stats', authenticateToken, async (req, res) => {
  try {
    const coachId = req.params.coachId;
    const [[followRow], [postRow], [athleteRow], [ratingRow]] = await Promise.all([
      query('SELECT COUNT(*) AS cnt FROM coach_follows WHERE coach_id=?', [coachId]) as any,
      query('SELECT COUNT(*) AS cnt FROM posts WHERE user_id=?', [coachId]) as any,
      query("SELECT COUNT(DISTINCT user_id) AS cnt FROM coach_subscriptions WHERE coach_id=? AND status='active' AND (expires_at IS NULL OR expires_at > NOW())", [coachId]) as any,
      query('SELECT IFNULL(AVG(rating), 0) AS avg, COUNT(*) AS cnt FROM coach_reviews WHERE coach_id=?', [coachId]) as any,
    ]);
    res.json({ followers: followRow?.cnt || 0, posts: postRow?.cnt || 0, athletes: athleteRow?.cnt || 0, avgRating: parseFloat((ratingRow?.avg || 0).toFixed(1)), reviewCount: ratingRow?.cnt || 0 });
  } catch { res.status(500).json({ message: 'Failed to fetch coach stats' }); }
});

router.get('/profile/:coachId/posts', authenticateToken, async (req, res) => {
  try {
    const posts = await query(
      `SELECT p.*, u.name AS user_name, u.avatar AS user_avatar, u.role AS user_role,
              (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) AS likes,
              (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) AS comment_count
       FROM posts p JOIN users u ON p.user_id = u.id
       WHERE p.user_id = ? ORDER BY p.created_at DESC LIMIT 30`,
      [req.params.coachId]
    );
    res.json({ posts });
  } catch { res.status(500).json({ message: 'Failed to fetch coach posts' }); }
});

router.get('/profile/:coachId/videos', authenticateToken, async (req, res) => {
  try {
    const videos = await query(
      "SELECT id, title, description, url, thumbnail, duration, duration_seconds, category, is_premium FROM workout_videos WHERE coach_id = ? AND COALESCE(approval_status, 'approved') = 'approved' AND (is_short IS NULL OR is_short = 0) ORDER BY created_at DESC LIMIT 30",
      [req.params.coachId]
    );
    res.json({ videos });
  } catch { res.status(500).json({ message: 'Failed to fetch coach videos' }); }
});

router.get('/profile/:coachId/shorties', authenticateToken, async (req, res) => {
  try {
    const videos = await query(
      "SELECT id, title, description, url, thumbnail, duration, duration_seconds, width, height FROM workout_videos WHERE coach_id = ? AND COALESCE(approval_status, 'approved') = 'approved' AND is_short = 1 ORDER BY created_at DESC LIMIT 30",
      [req.params.coachId]
    );
    res.json({ videos });
  } catch { res.status(500).json({ message: 'Failed to fetch coach shorties' }); }
});

router.get('/profile/:coachId/photos', authenticateToken, async (req, res) => {
  try {
    const photos = await query(
      `SELECT id, media_url, content, created_at FROM posts
       WHERE user_id = ? AND media_url IS NOT NULL AND media_url != ''
         AND media_url NOT LIKE '%.mp4' AND media_url NOT LIKE '%.mov' AND media_url NOT LIKE '%.webm'
       ORDER BY created_at DESC LIMIT 50`,
      [req.params.coachId]
    );
    res.json({ photos });
  } catch { res.status(500).json({ message: 'Failed to fetch coach photos' }); }
});

export default router;
