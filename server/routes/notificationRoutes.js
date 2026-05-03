/**
 * Notification Routes — push tokens, templates, welcome messages, sending.
 */
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { query, get, run } from '../config/database.js';
const adminOnly = (req, res, next) => {
    if (req.user?.role !== 'admin')
        return res.status(403).json({ message: 'Admin access required' });
    next();
};
import { registerPushToken, removePushToken, sendPushToUser, sendPushFromTemplate, sendPushToSegment, } from '../notificationService.js';
const router = Router();
// ── User: register / remove push token ────────────────────────────────────────
router.post('/push-token', authenticateToken, async (req, res) => {
    try {
        const { token, platform } = req.body;
        if (!token)
            return res.status(400).json({ message: 'Push token is required' });
        await registerPushToken(req.user.id, token, platform || 'android');
        res.json({ message: 'Push token registered' });
    }
    catch (err) {
        res.status(500).json({ message: err.message || 'Failed to register token' });
    }
});
router.delete('/push-token', authenticateToken, async (req, res) => {
    try {
        const { platform } = req.body;
        await removePushToken(req.user.id, platform || 'android');
        res.json({ message: 'Push token removed' });
    }
    catch (err) {
        res.status(500).json({ message: err.message || 'Failed to remove token' });
    }
});
// ── User: list own notifications (in-app) ─────────────────────────────────────
router.get('/list', authenticateToken, async (req, res) => {
    try {
        const rows = await query('SELECT id, type, title, body, link, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [req.user.id]);
        res.json({ notifications: rows });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.put('/read/:id', authenticateToken, async (req, res) => {
    try {
        await run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        res.json({ message: 'Marked as read' });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.put('/read-all', authenticateToken, async (req, res) => {
    try {
        await run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
        res.json({ message: 'All marked as read' });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
// ── Admin: push templates ─────────────────────────────────────────────────────
router.get('/templates', authenticateToken, adminOnly, async (_req, res) => {
    try {
        const rows = await query('SELECT * FROM push_templates ORDER BY category, slug');
        res.json({ templates: rows });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.put('/templates/:id', authenticateToken, adminOnly, async (req, res) => {
    try {
        const { title, body, enabled, trigger_type } = req.body;
        const fields = [];
        const values = [];
        if (title !== undefined) {
            fields.push('title = ?');
            values.push(title);
        }
        if (body !== undefined) {
            fields.push('body = ?');
            values.push(body);
        }
        if (enabled !== undefined) {
            fields.push('enabled = ?');
            values.push(enabled ? 1 : 0);
        }
        if (trigger_type !== undefined) {
            fields.push('trigger_type = ?');
            values.push(trigger_type);
        }
        if (!fields.length)
            return res.status(400).json({ message: 'No fields to update' });
        values.push(req.params.id);
        await run(`UPDATE push_templates SET ${fields.join(', ')} WHERE id = ?`, values);
        res.json({ message: 'Template updated' });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.post('/templates', authenticateToken, adminOnly, async (req, res) => {
    try {
        const { slug, title, body, category, trigger_type } = req.body;
        if (!slug || !title || !body)
            return res.status(400).json({ message: 'slug, title, and body are required' });
        await run('INSERT INTO push_templates (slug, title, body, category, trigger_type) VALUES (?,?,?,?,?)', [slug, title, body, category || 'engagement', trigger_type || 'manual']);
        res.status(201).json({ message: 'Template created' });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.delete('/templates/:id', authenticateToken, adminOnly, async (req, res) => {
    try {
        await run('DELETE FROM push_templates WHERE id = ?', [req.params.id]);
        res.json({ message: 'Template deleted' });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
// ── Admin: welcome messages ───────────────────────────────────────────────────
router.get('/welcome-messages', authenticateToken, adminOnly, async (_req, res) => {
    try {
        const rows = await query('SELECT * FROM welcome_messages ORDER BY target, channel');
        res.json({ messages: rows });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.put('/welcome-messages/:id', authenticateToken, adminOnly, async (req, res) => {
    try {
        const { subject, title, body, html_body, enabled } = req.body;
        const fields = [];
        const values = [];
        if (subject !== undefined) {
            fields.push('subject = ?');
            values.push(subject);
        }
        if (title !== undefined) {
            fields.push('title = ?');
            values.push(title);
        }
        if (body !== undefined) {
            fields.push('body = ?');
            values.push(body);
        }
        if (html_body !== undefined) {
            fields.push('html_body = ?');
            values.push(html_body);
        }
        if (enabled !== undefined) {
            fields.push('enabled = ?');
            values.push(enabled ? 1 : 0);
        }
        if (!fields.length)
            return res.status(400).json({ message: 'No fields to update' });
        values.push(req.params.id);
        await run(`UPDATE welcome_messages SET ${fields.join(', ')} WHERE id = ?`, values);
        res.json({ message: 'Welcome message updated' });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
// ── Admin: send push notification ─────────────────────────────────────────────
router.post('/send', authenticateToken, adminOnly, async (req, res) => {
    try {
        const { userId, title, body, segment, templateSlug, vars } = req.body;
        if (templateSlug && userId) {
            // Send specific template to a specific user
            const ok = await sendPushFromTemplate(userId, templateSlug, vars || {});
            return res.json({ message: ok ? 'Sent' : 'No token or template not found', sent: ok ? 1 : 0 });
        }
        if (userId && title && body) {
            // Send custom push to a specific user
            const ok = await sendPushToUser(userId, title, body);
            return res.json({ message: ok ? 'Sent' : 'No push token for user', sent: ok ? 1 : 0 });
        }
        if (title && body) {
            // Blast to segment
            const result = await sendPushToSegment(title, body, segment || 'all');
            return res.json({ message: `Sent ${result.sent}/${result.total}`, ...result });
        }
        return res.status(400).json({ message: 'Provide title + body (and optionally userId or segment)' });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
// ── Admin: push log ───────────────────────────────────────────────────────────
router.get('/log', authenticateToken, adminOnly, async (req, res) => {
    try {
        const limit = Math.min(parseInt(String(req.query.limit)) || 50, 500);
        const rows = await query(`SELECT pl.*, u.name as user_name, u.email as user_email, pt.slug as template_slug
       FROM push_log pl
       LEFT JOIN users u ON u.id = pl.user_id
       LEFT JOIN push_templates pt ON pt.id = pl.template_id
       ORDER BY pl.created_at DESC LIMIT ?`, [limit]);
        res.json({ log: rows });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
// ── Admin: FCM config status ──────────────────────────────────────────────────
router.get('/fcm-status', authenticateToken, adminOnly, async (_req, res) => {
    const hasServiceAccountJson = !!process.env.FCM_SERVICE_ACCOUNT_JSON;
    const hasServiceAccountPath = !!process.env.FCM_SERVICE_ACCOUNT_PATH;
    const hasProjectId = !!process.env.FCM_PROJECT_ID;
    const configured = (hasServiceAccountJson || hasServiceAccountPath) && hasProjectId;
    const tokenCount = await get('SELECT COUNT(*) as cnt FROM push_tokens');
    res.json({
        configured,
        method: configured ? 'http_v1' : 'none',
        registeredDevices: tokenCount?.cnt || 0,
        hint: configured ? null : 'Set FCM_SERVICE_ACCOUNT_JSON and FCM_PROJECT_ID in your .env',
    });
});
// ── Admin: test push notification to self ─────────────────────────────────────
router.post('/test', authenticateToken, adminOnly, async (req, res) => {
    try {
        const adminId = req.user.id;
        const title = req.body?.title || '🔔 FitWay Hub Test';
        const body = req.body?.body || 'Push notifications are working correctly!';
        // Check service account config
        const hasSa = !!(process.env.FCM_SERVICE_ACCOUNT_JSON || process.env.FCM_SERVICE_ACCOUNT_PATH);
        if (!hasSa) {
            return res.status(503).json({
                sent: false,
                message: 'FCM not configured — set FCM_SERVICE_ACCOUNT_JSON in your .env',
                debug: { hasSa: false },
            });
        }
        // Get all tokens for this user
        const tokens = await query('SELECT token, platform FROM push_tokens WHERE user_id = ? ORDER BY updated_at DESC', [adminId]);
        if (!tokens.length) {
            return res.status(400).json({
                sent: false,
                message: 'No device registered yet. Open the app on your phone and log in — it will register automatically.',
                debug: { tokens: 0 },
            });
        }
        // Try sending to each registered token and collect results
        const results = [];
        for (const t of tokens) {
            const ok = await sendPushToUser(adminId, title, body);
            results.push({ platform: t.platform, token: t.token.slice(0, 20) + '...', ok });
        }
        const anyOk = results.some(r => r.ok);
        res.json({
            sent: anyOk,
            message: anyOk
                ? `✅ Test push sent to ${results.filter(r => r.ok).map(r => r.platform).join(', ')}!`
                : `❌ FCM rejected the push. Token may be expired or invalid. Try logging out and back in on your device.`,
            devices: results,
        });
    }
    catch (err) {
        console.error('Test push error:', err);
        res.status(500).json({ sent: false, message: err.message });
    }
});
export default router;
//# sourceMappingURL=notificationRoutes.js.map