/**
 * Ad Billing Engine
 *
 * Real money flow:
 *   1. Coach pays into ad_payments (manual e-wallet proof)
 *   2. Admin approves → ad goes active, paid_amount credited to ad budget
 *   3. Every time an impression is tracked → deduct CPM from budget
 *   4. Every time a click is tracked → deduct CPC from budget
 *   5. When budget exhausted → ad auto-pauses
 *   6. When schedule_end passes → ad auto-expires
 *
 * CPM (cost per 1000 impressions): paid_amount / estimated_reach * 1000
 * Minimum deduction per impression: 0.01 EGP
 */
import { run, get } from '../config/database.js';
const MIN_CPM = 0.01; // EGP per impression minimum
/** Deduct impression cost from ad budget. Pauses if exhausted. */
export async function billImpression(adId) {
    try {
        const ad = await get(`SELECT a.paid_amount, a.amount_spent, a.daily_budget, a.total_budget, a.budget_type,
              a.impressions, a.clicks, a.status, a.schedule_start, a.schedule_end
       FROM coach_ads a WHERE a.id = ?`, [adId]);
        if (!ad || ad.status !== 'active')
            return;
        // Cost per impression = budget / estimated total impressions
        // estimated_total_impressions = paid_amount / MIN_CPM * 1000
        const budget = ad.budget_type === 'daily' ? ad.daily_budget : ad.total_budget;
        const paidBudget = parseFloat(ad.paid_amount) || parseFloat(budget) || 0;
        const costPerImpression = paidBudget > 0
            ? Math.max(MIN_CPM, paidBudget / Math.max(1, ad.impressions + 1000) * (1000 / 1000))
            : MIN_CPM;
        const newSpent = parseFloat(ad.amount_spent || '0') + costPerImpression;
        const effectiveBudget = paidBudget || parseFloat(budget) || 999999;
        // CTR update
        const ctr = ad.impressions > 0 ? ad.clicks / ad.impressions : 0;
        // CPM update
        const cpm = ad.impressions > 0 ? (parseFloat(ad.amount_spent || '0') / ad.impressions) * 1000 : 0;
        if (newSpent >= effectiveBudget) {
            // Budget exhausted — pause the ad
            await run(`UPDATE coach_ads SET amount_spent = ?, status = 'paused', ctr = ?, cpm = ? WHERE id = ?`, [effectiveBudget, ctr, cpm, adId]);
        }
        else {
            await run(`UPDATE coach_ads SET amount_spent = ?, ctr = ?, cpm = ? WHERE id = ?`, [newSpent, ctr, cpm, adId]);
        }
    }
    catch (err) {
        console.warn('billImpression error:', err.message);
    }
}
/** Deduct click cost (CPC = 3× CPM rate). Updates reach estimate. */
export async function billClick(adId) {
    try {
        const ad = await get(`SELECT paid_amount, amount_spent, daily_budget, total_budget, budget_type,
              impressions, clicks, reach, status
       FROM coach_ads WHERE id = ?`, [adId]);
        if (!ad || ad.status !== 'active')
            return;
        const budget = ad.budget_type === 'daily' ? ad.daily_budget : ad.total_budget;
        const paidBudget = parseFloat(ad.paid_amount) || parseFloat(budget) || 0;
        const costPerClick = paidBudget > 0
            ? Math.max(0.05, paidBudget / Math.max(1, ad.clicks + 100))
            : 0.05;
        const newSpent = parseFloat(ad.amount_spent || '0') + costPerClick;
        const effectiveBudget = paidBudget || 999999;
        // Reach grows slightly with each click (unique viewer estimate)
        const newReach = Math.min((ad.reach || 0) + Math.ceil(Math.random() * 3 + 1), ad.impressions || 0);
        const ctr = ad.impressions > 0 ? ad.clicks / ad.impressions : 0;
        if (newSpent >= effectiveBudget) {
            await run(`UPDATE coach_ads SET amount_spent = ?, reach = ?, ctr = ?, status = 'paused' WHERE id = ?`, [effectiveBudget, newReach, ctr, adId]);
        }
        else {
            await run(`UPDATE coach_ads SET amount_spent = ?, reach = ?, ctr = ? WHERE id = ?`, [newSpent, newReach, ctr, adId]);
        }
    }
    catch (err) {
        console.warn('billClick error:', err.message);
    }
}
/** Check daily budget reset at midnight and schedule expiry */
export async function expireAndResetAds() {
    try {
        // Expire ads past schedule_end
        await run(`UPDATE coach_ads
       SET status = 'expired'
       WHERE status IN ('active','paused')
         AND schedule_end IS NOT NULL
         AND schedule_end < CURDATE()
         AND paid_amount > 0`);
        // Also handle old boost_end field — only expire if schedule_end also passed or is not set
        await run(`UPDATE coach_ads SET status = 'expired'
       WHERE status = 'active' AND boost_end IS NOT NULL AND boost_end < NOW()
         AND (schedule_end IS NULL OR schedule_end < CURDATE())`);
        // Reset daily spend counter for daily-budget ads at start of each day
        // (only if schedule_start <= today and schedule_end >= today)
        await run(`UPDATE coach_ads
       SET amount_spent = 0, status = 'active'
       WHERE budget_type = 'daily'
         AND status = 'paused'
         AND paid_amount > 0
         AND payment_status = 'approved'
         AND schedule_start <= CURDATE()
         AND (schedule_end IS NULL OR schedule_end >= CURDATE())
         AND DATE(updated_at) < CURDATE()`);
    }
    catch (err) {
        console.warn('expireAndResetAds error:', err.message);
    }
}
//# sourceMappingURL=adBillingService.js.map