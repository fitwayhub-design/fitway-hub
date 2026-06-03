import { Router } from 'express';
import { getPool, query, get } from '../config/database.js';
const router = Router();
// Dev-only endpoint to diagnose DB connectivity and key tables
router.get('/db-check', async (_req, res) => {
    try {
        // Verify a connection can be acquired
        const pool = getPool();
        const conn = await pool.getConnection();
        conn.release();
        // Check for presence of critical tables used by the ads system
        const tablesToCheck = ['ad_moderation_reviews', 'ad_campaigns', 'ad_creatives', 'ad_audit_logs'];
        const checks = {};
        for (const t of tablesToCheck) {
            try {
                // Some MySQL servers/drivers don't support parameter binding for SHOW TABLES
                const safe = t.replace(/'/g, "''");
                const rows = await query(`SHOW TABLES LIKE '${safe}'`);
                checks[t] = (rows && rows.length) ? true : false;
            }
            catch (e) {
                checks[t] = { ok: false, error: e.message };
            }
        }
        // Run simple counts where available
        const counts = {};
        try {
            counts.ad_moderation_reviews = (await get('SELECT COUNT(*) as cnt FROM ad_moderation_reviews'))?.cnt ?? null;
        }
        catch (e) {
            counts.ad_moderation_reviews = e.message;
        }
        try {
            counts.ad_campaigns = (await get('SELECT COUNT(*) as cnt FROM ad_campaigns'))?.cnt ?? null;
        }
        catch (e) {
            counts.ad_campaigns = e.message;
        }
        res.json({ ok: true, connection: 'ok', checks, counts });
    }
    catch (err) {
        res.status(500).json({ ok: false, message: err.message, stack: err.stack });
    }
});
export default router;
//# sourceMappingURL=debugRoutes.js.map