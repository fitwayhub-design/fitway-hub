/**
 * Ad Settings Routes — Admin master control panel for the entire ads system.
 * Every behaviorial rule of the ads system is configurable here.
 */
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { query, run, get } from '../config/database.js';
const router = Router();
const adminOnly = (req, res, next) => {
    if (req.user?.role !== 'admin')
        return res.status(403).json({ message: 'Admin access required' });
    next();
};
// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL SETTINGS
// ─────────────────────────────────────────────────────────────────────────────
/** GET /api/ad-settings — all settings grouped by category */
router.get('/', authenticateToken, adminOnly, async (_req, res) => {
    try {
        const settings = await query('SELECT * FROM admin_ad_settings ORDER BY category, id');
        const grouped = {};
        for (const s of settings) {
            if (!grouped[s.category])
                grouped[s.category] = [];
            grouped[s.category].push(s);
        }
        res.json({ settings, grouped });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
/** GET /api/ad-settings/public — non-sensitive settings readable by coaches */
router.get('/public', authenticateToken, async (_req, res) => {
    try {
        const publicKeys = [
            'ads_system_enabled', 'require_admin_approval', 'coaches_can_create_directly',
            'min_daily_budget', 'max_daily_budget', 'min_lifetime_budget', 'max_lifetime_budget',
            'allow_image_creative', 'allow_video_creative', 'allow_carousel_creative', 'allow_text_creative',
            'max_image_size_kb', 'max_video_size_kb',
            'targeting_location_enabled', 'targeting_age_enabled', 'targeting_activity_enabled',
            'targeting_language_enabled', 'targeting_interests_enabled',
        ];
        const placeholders = publicKeys.map(() => '?').join(',');
        const settings = await query(`SELECT setting_key, setting_value, setting_type, label FROM admin_ad_settings WHERE setting_key IN (${placeholders})`, publicKeys);
        // Convert to a flat map
        const map = {};
        for (const s of settings) {
            map[s.setting_key] = s.setting_type === 'boolean' ? s.setting_value === 'true'
                : s.setting_type === 'integer' ? parseInt(s.setting_value)
                    : s.setting_type === 'json' ? JSON.parse(s.setting_value)
                        : s.setting_value;
        }
        res.json({ settings: map });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
/** PATCH /api/ad-settings/:key — update one setting */
router.patch('/:key', authenticateToken, adminOnly, async (req, res) => {
    try {
        const { key } = req.params;
        const { value, reason } = req.body;
        if (value === undefined)
            return res.status(400).json({ message: 'value is required' });
        const existing = await get('SELECT * FROM admin_ad_settings WHERE setting_key = ?', [key]);
        if (!existing)
            return res.status(404).json({ message: `Setting '${key}' not found` });
        const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        // Save history before updating
        await run(`INSERT INTO ad_setting_history (setting_key, old_value, new_value, changed_by, reason) VALUES (?, ?, ?, ?, ?)`, [key, existing.setting_value, strValue, req.user.id, reason || null]);
        await run(`UPDATE admin_ad_settings SET setting_value = ?, updated_by = ?, updated_at = NOW() WHERE setting_key = ?`, [strValue, req.user.id, key]);
        // Audit
        await run(`INSERT INTO ad_audit_logs (actor_id, actor_role, action, entity_type, entity_id, old_state, new_state)
       VALUES (?, 'admin', 'settings.update', 'setting', NULL, ?, ?)`, [req.user.id, JSON.stringify({ [key]: existing.setting_value }), JSON.stringify({ [key]: strValue })]);
        res.json({ key, value: strValue });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
/** POST /api/ad-settings/bulk — update multiple settings at once */
router.post('/bulk', authenticateToken, adminOnly, async (req, res) => {
    try {
        const { updates } = req.body; // [{ key, value, reason }]
        if (!Array.isArray(updates) || !updates.length)
            return res.status(400).json({ message: 'updates array required' });
        for (const { key, value, reason } of updates) {
            const existing = await get('SELECT * FROM admin_ad_settings WHERE setting_key = ?', [key]);
            if (!existing)
                continue;
            const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
            await run(`INSERT INTO ad_setting_history (setting_key, old_value, new_value, changed_by, reason) VALUES (?, ?, ?, ?, ?)`, [key, existing.setting_value, strValue, req.user.id, reason || null]);
            await run(`UPDATE admin_ad_settings SET setting_value = ?, updated_by = ?, updated_at = NOW() WHERE setting_key = ?`, [strValue, req.user.id, key]);
        }
        await run(`INSERT INTO ad_audit_logs (actor_id, actor_role, action, entity_type, new_state)
       VALUES (?, 'admin', 'settings.bulk_update', 'setting', ?)`, [req.user.id, JSON.stringify(updates.map(u => u.key))]);
        const all = await query('SELECT * FROM admin_ad_settings ORDER BY category, id');
        res.json({ settings: all, updated: updates.length });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
/** GET /api/ad-settings/history — settings change history */
router.get('/history', authenticateToken, adminOnly, async (req, res) => {
    try {
        const history = await query(`SELECT h.*, u.name AS changed_by_name, u.email AS changed_by_email
       FROM ad_setting_history h LEFT JOIN users u ON u.id = h.changed_by
       ORDER BY h.changed_at DESC LIMIT 100`);
        res.json({ history });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// PLACEMENTS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/placements', authenticateToken, adminOnly, async (_req, res) => {
    try {
        const placements = await query('SELECT * FROM ad_placements ORDER BY priority_order');
        res.json({ placements });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.patch('/placements/:key', authenticateToken, adminOnly, async (req, res) => {
    try {
        const { enabled, max_ads, priority_order, frequency_cap_hours, label, description } = req.body;
        await run(`UPDATE ad_placements SET
         enabled = COALESCE(?, enabled),
         max_ads = COALESCE(?, max_ads),
         priority_order = COALESCE(?, priority_order),
         frequency_cap_hours = COALESCE(?, frequency_cap_hours),
         label = COALESCE(?, label),
         description = COALESCE(?, description),
         updated_at = NOW()
       WHERE placement_key = ?`, [enabled !== undefined ? (enabled ? 1 : 0) : null, max_ads, priority_order, frequency_cap_hours, label, description, req.params.key]);
        const p = await get('SELECT * FROM ad_placements WHERE placement_key = ?', [req.params.key]);
        res.json({ placement: p });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// FEATURE FLAGS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/feature-flags', authenticateToken, adminOnly, async (_req, res) => {
    try {
        const flags = await query('SELECT * FROM ad_feature_flags ORDER BY id');
        res.json({ flags });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.patch('/feature-flags/:key', authenticateToken, adminOnly, async (req, res) => {
    try {
        const { enabled } = req.body;
        await run(`UPDATE ad_feature_flags SET enabled = ?, updated_by = ?, updated_at = NOW() WHERE flag_key = ?`, [enabled ? 1 : 0, req.user.id, req.params.key]);
        const flag = await get('SELECT * FROM ad_feature_flags WHERE flag_key = ?', [req.params.key]);
        res.json({ flag });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// APPROVAL RULES
// ─────────────────────────────────────────────────────────────────────────────
router.get('/approval-rules', authenticateToken, adminOnly, async (_req, res) => {
    try {
        const rules = await query('SELECT * FROM ad_approval_rules ORDER BY priority DESC');
        res.json({ rules });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.post('/approval-rules', authenticateToken, adminOnly, async (req, res) => {
    try {
        const { rule_name, rule_type, conditions, enabled, priority } = req.body;
        const result = await run(`INSERT INTO ad_approval_rules (rule_name, rule_type, conditions, enabled, priority, created_by) VALUES (?, ?, ?, ?, ?, ?)`, [rule_name, rule_type || 'require_review', conditions ? JSON.stringify(conditions) : null, enabled !== false ? 1 : 0, priority || 0, req.user.id]);
        const rule = await get('SELECT * FROM ad_approval_rules WHERE id = ?', [result.insertId]);
        res.status(201).json({ rule });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.patch('/approval-rules/:id', authenticateToken, adminOnly, async (req, res) => {
    try {
        const { rule_name, rule_type, conditions, enabled, priority } = req.body;
        await run(`UPDATE ad_approval_rules SET
         rule_name=COALESCE(?,rule_name), rule_type=COALESCE(?,rule_type),
         conditions=COALESCE(?,conditions), enabled=COALESCE(?,enabled), priority=COALESCE(?,priority)
       WHERE id=?`, [rule_name, rule_type, conditions ? JSON.stringify(conditions) : null, enabled !== undefined ? (enabled ? 1 : 0) : null, priority, req.params.id]);
        const rule = await get('SELECT * FROM ad_approval_rules WHERE id = ?', [req.params.id]);
        res.json({ rule });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.delete('/approval-rules/:id', authenticateToken, adminOnly, async (req, res) => {
    try {
        await run('DELETE FROM ad_approval_rules WHERE id = ?', [req.params.id]);
        res.json({ message: 'Rule deleted' });
    }
    catch {
        res.status(500).json({ message: 'Delete failed' });
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE PRESETS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/presets', authenticateToken, adminOnly, async (_req, res) => {
    try {
        const presets = await query('SELECT * FROM ad_template_presets ORDER BY preset_type, id');
        res.json({ presets });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.post('/presets', authenticateToken, adminOnly, async (req, res) => {
    try {
        const { preset_type, name, description, config, is_default, target_role } = req.body;
        const result = await run(`INSERT INTO ad_template_presets (preset_type, name, description, config, is_default, target_role, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [preset_type, name, description || null, JSON.stringify(config), is_default ? 1 : 0, target_role || 'all', req.user.id]);
        const preset = await get('SELECT * FROM ad_template_presets WHERE id = ?', [result.insertId]);
        res.status(201).json({ preset });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.patch('/presets/:id', authenticateToken, adminOnly, async (req, res) => {
    try {
        const { name, description, config, is_default, target_role } = req.body;
        await run(`UPDATE ad_template_presets SET
         name=COALESCE(?,name), description=COALESCE(?,description),
         config=COALESCE(?,config), is_default=COALESCE(?,is_default),
         target_role=COALESCE(?,target_role), updated_at=NOW()
       WHERE id=?`, [name, description, config ? JSON.stringify(config) : null, is_default !== undefined ? (is_default ? 1 : 0) : null, target_role, req.params.id]);
        const preset = await get('SELECT * FROM ad_template_presets WHERE id = ?', [req.params.id]);
        res.json({ preset });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.delete('/presets/:id', authenticateToken, adminOnly, async (req, res) => {
    try {
        await run('DELETE FROM ad_template_presets WHERE id = ?', [req.params.id]);
        res.json({ message: 'Preset deleted' });
    }
    catch {
        res.status(500).json({ message: 'Delete failed' });
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM OVERVIEW (for admin settings dashboard)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/overview', authenticateToken, adminOnly, async (_req, res) => {
    try {
        const [campaigns] = await query(`SELECT COUNT(*) AS total, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active, SUM(CASE WHEN status='pending_review' THEN 1 ELSE 0 END) AS pending FROM ad_campaigns`);
        const [pending_reviews] = await query(`SELECT COUNT(*) AS total FROM ad_moderation_reviews WHERE status='pending'`);
        const [events_today] = await query('SELECT COUNT(*) AS total FROM ad_events WHERE DATE(recorded_at)=CURDATE()');
        const [spend_today] = await query(`SELECT COALESCE(SUM(amount),0) AS total FROM ad_wallet_ledger WHERE entry_type='debit' AND DATE(created_at)=CURDATE()`);
        const flagged = await query(`SELECT * FROM ad_moderation_reviews WHERE status='flagged' LIMIT 5`);
        res.json({ campaigns, pending_reviews: pending_reviews.total, events_today: events_today.total, spend_today: spend_today.total, flagged });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
export default router;
//# sourceMappingURL=adSettingsRoutes.js.map