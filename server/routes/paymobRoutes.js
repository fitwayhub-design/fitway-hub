/**
 * ════════════════════════════════════════════════════════════════════
 *  FitWay Hub — Unified Payment Engine (PayPal + manual e-wallet)
 *  v3.0 — Paymob auto-flow removed (2026-05).
 *
 *  History:
 *  - Earlier versions handled Paymob auto card/wallet/fawry processing.
 *    All Paymob auto code was removed in May 2026 — the project now
 *    accepts ONLY PayPal (international) and manual e-wallet uploads
 *    (Orange Cash / Vodafone Cash / WE Pay) where the user pays from
 *    their phone wallet to a published number and uploads a screenshot.
 *  - The `paymob_transactions` DB table is intentionally retained
 *    (and still used here for PayPal orders) to avoid a destructive
 *    migration. Historical Paymob rows are preserved read-only.
 * ════════════════════════════════════════════════════════════════════
 *
 *  INCOMING (collecting money):
 *    POST /api/pay/intention          – start a PayPal payment
 *    POST /api/pay/paypal/capture     – capture PayPal order after user approves
 *    POST /api/pay/webhook/paypal     – PayPal fires this for subscriptions/renewals
 *
 *  OUTGOING (paying coaches):
 *    POST /api/pay/withdraw           – coach withdraws → PayPal Payouts (auto)
 *                                        or queues for manual e-wallet payout
 *    GET  /api/pay/withdraw/:id       – check payout status
 *
 *  INFO:
 *    GET  /api/pay/config             – frontend reads available providers
 *    GET  /api/pay/history            – user's transaction history
 *    GET  /api/pay/balance            – coach's credit balance + history
 */
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { get, run, query } from '../config/database.js';
import https from 'https';
const router = Router();
// ══════════════════════════════════════════════════════════════════════════════
//  CONFIG — read from environment (DB settings override env vars)
// ══════════════════════════════════════════════════════════════════════════════
let _settingsCache = {};
let _settingsCacheTs = 0;
async function getSettings() {
    if (Date.now() - _settingsCacheTs < 60_000)
        return _settingsCache;
    try {
        const rows = await query('SELECT setting_key, setting_value FROM payment_settings');
        const m = {};
        for (const r of rows)
            m[r.setting_key] = r.setting_value || '';
        _settingsCache = m;
        _settingsCacheTs = Date.now();
    }
    catch { /* use cache / env fallback */ }
    return _settingsCache;
}
async function setting(dbKey, envVar, fallback = '') {
    const s = await getSettings();
    return s[dbKey] || process.env[envVar] || fallback;
}
const ENV = {
    paypalClientId: () => setting('paypal_user_client_id', 'PAYPAL_CLIENT_ID'),
    paypalSecret: () => setting('paypal_user_secret', 'PAYPAL_SECRET'),
    paypalMode: () => setting('paypal_mode', 'PAYPAL_MODE', 'sandbox'),
    paypalWebhookId: () => setting('paypal_webhook_id', 'PAYPAL_WEBHOOK_ID'),
    coachCutPct: async () => Math.min(100, Math.max(0, Number(await setting('coach_cut_percentage', 'COACH_CUT_PERCENT', '85')))),
    appBaseUrl: () => process.env.APP_BASE_URL || 'http://localhost:3000',
};
// ══════════════════════════════════════════════════════════════════════════════
//  LOW-LEVEL HTTP
// ══════════════════════════════════════════════════════════════════════════════
function httpPost(hostname, path, headers, body) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(body);
        const req = https.request({ hostname, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), ...headers } }, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try {
            resolve(JSON.parse(d));
        }
        catch {
            reject(new Error('Bad JSON: ' + d.slice(0, 200)));
        } }); });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}
// ══════════════════════════════════════════════════════════════════════════════
//  PAYPAL HELPERS
// ══════════════════════════════════════════════════════════════════════════════
async function paypalHost() {
    return (await ENV.paypalMode()) === 'live' ? 'api-m.paypal.com' : 'api-m.sandbox.paypal.com';
}
let ppTokenCache = null;
async function paypalToken() {
    if (ppTokenCache && Date.now() < ppTokenCache.exp)
        return ppTokenCache.token;
    const cid = await ENV.paypalClientId();
    const sec = await ENV.paypalSecret();
    if (!cid || !sec)
        throw new Error('PayPal not configured');
    const auth = Buffer.from(`${cid}:${sec}`).toString('base64');
    const ppHost = await paypalHost();
    return new Promise((resolve, reject) => {
        const body = 'grant_type=client_credentials';
        const req = https.request({
            hostname: ppHost,
            path: '/v1/oauth2/token',
            method: 'POST',
            headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': body.length },
        }, (res) => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => {
                try {
                    const j = JSON.parse(d);
                    ppTokenCache = { token: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000 };
                    resolve(j.access_token);
                }
                catch {
                    reject(new Error('PayPal token parse error'));
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}
async function ppCall(method, path, body) {
    const token = await paypalToken();
    const ppHost = await paypalHost();
    if (method === 'GET') {
        return new Promise((resolve, reject) => {
            const r = https.request({ hostname: ppHost, path, method: 'GET', headers: { Authorization: `Bearer ${token}` } }, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try {
                resolve(JSON.parse(d));
            }
            catch {
                reject(new Error('Bad JSON'));
            } }); });
            r.on('error', reject);
            r.end();
        });
    }
    return httpPost(ppHost, path, { Authorization: `Bearer ${token}` }, body || {});
}
// EGP → USD conversion (cached 6h). PayPal charges in USD even though our
// pricing is set in EGP, so we convert at intent-creation time.
let rateCache = null;
async function egpToUsd(egp) {
    const fixed = process.env.EGP_USD_RATE;
    if (fixed && Number(fixed) > 0)
        return Math.round(egp / Number(fixed) * 100) / 100;
    if (rateCache && Date.now() - rateCache.ts < 6 * 3_600_000)
        return Math.round(egp / rateCache.rate * 100) / 100;
    try {
        const r = await new Promise((resolve, reject) => {
            const req = https.request({ hostname: 'open.er-api.com', path: '/v6/latest/USD', method: 'GET' }, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try {
                resolve(JSON.parse(d));
            }
            catch {
                reject(new Error('Bad JSON'));
            } }); });
            req.on('error', reject);
            req.end();
        });
        if (r?.rates?.EGP) {
            rateCache = { rate: r.rates.EGP, ts: Date.now() };
            return Math.round(egp / r.rates.EGP * 100) / 100;
        }
    }
    catch { }
    return Math.round(egp / 50.5 * 100) / 100;
}
// PayPal Payouts (send money to coach PayPal email)
async function paypalPayout(coachId, amountEGP, recipientEmail, ref) {
    if (!(await ENV.paypalClientId()))
        return { ok: false, error: 'PayPal not configured' };
    try {
        const usd = await egpToUsd(amountEGP);
        const r = await ppCall('POST', '/v1/payments/payouts', {
            sender_batch_header: { sender_batch_id: `fw_${ref}_${Date.now()}`, email_subject: 'FitWay Hub — Your earnings payout', email_message: `You have received a payout of $${usd} USD for your coaching earnings.` },
            items: [{ recipient_type: 'EMAIL', amount: { value: usd.toFixed(2), currency: 'USD' }, receiver: recipientEmail, note: 'FitWay Hub payout', sender_item_id: ref }],
        });
        if (r.batch_header?.payout_batch_id) {
            await run('INSERT INTO credit_transactions (user_id, amount, type, reference_id, description) VALUES (?,?,?,?,?)', [coachId, -amountEGP, 'auto_payout_paypal', r.batch_header.payout_batch_id, `PayPal payout to ${recipientEmail}`]);
            return { ok: true, batchId: r.batch_header.payout_batch_id };
        }
        return { ok: false, error: JSON.stringify(r.errors || r) };
    }
    catch (e) {
        return { ok: false, error: e.message };
    }
}
// ══════════════════════════════════════════════════════════════════════════════
//  CORE BUSINESS LOGIC — shared by all payment providers
// ══════════════════════════════════════════════════════════════════════════════
/** Activate a coach subscription after successful payment */
async function activateSubscription(userId, coachId, planCycle, planType, amountEGP, paymentMethod, txRef) {
    const active = await get(`SELECT id FROM coach_subscriptions WHERE user_id=? AND coach_id=? AND status='active' AND (expires_at IS NULL OR expires_at > NOW())`, [userId, coachId]);
    if (active)
        return;
    const months = planCycle === 'yearly' ? 12 : 1;
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + months);
    const coachCut = Math.round(amountEGP * ((await ENV.coachCutPct()) / 100) * 100) / 100;
    await run(`INSERT INTO coach_subscriptions (user_id, coach_id, plan_cycle, plan_type, amount, payment_method, transaction_id, status, expires_at)
     VALUES (?,?,?,?,?,?,?, 'active', ?)`, [userId, coachId, planCycle, planType, amountEGP, paymentMethod, txRef, expiresAt]);
    await run('UPDATE users SET credit = COALESCE(credit, 0) + ? WHERE id=?', [coachCut, coachId]);
    await run('INSERT INTO credit_transactions (user_id, amount, type, reference_id, description) VALUES (?,?,?,?,?)', [coachId, coachCut, 'subscription', txRef, `Subscription from user #${userId} (${planCycle} ${planType})`]);
    await run('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)', [userId, 'subscription', '✅ Subscription Active!', 'Your coach subscription is now active. Start training!', '/app/coaching']);
    await run('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)', [coachId, 'new_subscription', '🎉 New Subscriber!', `A new athlete just subscribed. You earned ${coachCut} EGP.`, '/coach/profile']);
}
/** Activate premium for a user */
async function activatePremium(userId, planCycle, amountEGP, paymentMethod, txRef) {
    await run('UPDATE users SET is_premium=1 WHERE id=? AND role=?', [userId, 'user']);
    await run('INSERT INTO payments (user_id, type, plan, amount, payment_method, transaction_id, status) VALUES (?,?,?,?,?,?,?)', [userId, 'premium', planCycle, amountEGP, paymentMethod, txRef, 'completed']);
    await run('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)', [userId, 'premium', '⚡ Premium Activated!', 'You now have full access to all premium features.', '/app/dashboard']);
}
/**
 * Auto-disburse to a coach. Only PayPal supports automated payout now —
 * e-wallet (Vodafone/Orange/WE) coaches must be paid manually by an admin
 * via the /api/payments/withdrawals/:id/approve endpoint after the admin
 * sends money from the platform's wallet.
 */
async function autoPayout(coachId, amount, withdrawalId) {
    const user = await get('SELECT payment_method_type, payment_phone, payment_wallet_type, paypal_email FROM users WHERE id=?', [coachId]);
    if (!user)
        return { ok: false, error: 'User not found' };
    const method = user.payment_method_type || 'ewallet';
    if (method === 'paypal' && user.paypal_email) {
        const r = await paypalPayout(coachId, amount, user.paypal_email, String(withdrawalId));
        return { ok: r.ok, ref: r.batchId, error: r.error };
    }
    // E-wallet payouts are manual — leave the withdrawal in `processing` so an
    // admin sees it in the queue and can mark it approved/rejected after sending
    // money from the platform's Vodafone/Orange/WE Pay wallet.
    if (method === 'ewallet' && user.payment_phone) {
        return { ok: true, queuedManual: true, ref: undefined };
    }
    return { ok: false, error: `No payout method set. Method="${method}", phone="${user.payment_phone}", paypal="${user.paypal_email}"` };
}
// ══════════════════════════════════════════════════════════════════════════════
//  ROUTES — INCOMING
// ══════════════════════════════════════════════════════════════════════════════
/**
 * GET /api/pay/config
 * Frontend reads which providers are available.
 */
router.get('/config', async (_req, res) => {
    try {
        const [ppClientId, ppSecret, ppMode] = await Promise.all([
            ENV.paypalClientId(), ENV.paypalSecret(), ENV.paypalMode(),
        ]);
        res.json({
            paypal: {
                configured: !!(ppClientId && ppSecret),
                clientId: ppClientId,
                mode: ppMode,
            },
            // Manual e-wallet (Orange/Vodafone/WE) is always available — the actual
            // upload + admin approval flow lives at /api/payments/ewallet.
            manualEwallet: { enabled: true },
            disbursement: { paypal: !!ppClientId, ewalletManual: true },
        });
    }
    catch {
        res.status(500).json({ message: 'Failed to load config' });
    }
});
/**
 * POST /api/pay/intention
 * Creates a PayPal order. (The Paymob auto-flow was removed in v3.0;
 * manual e-wallet payments use POST /api/payments/ewallet instead.)
 *
 * Body: { provider: 'paypal', amount, type, coachId?, planCycle?, planType? }
 */
router.post('/intention', authenticateToken, async (req, res) => {
    const { provider, amount, type, coachId, planCycle, planType } = req.body;
    if (!amount || !type)
        return res.status(400).json({ message: 'amount and type are required' });
    if (provider && provider !== 'paypal') {
        return res.status(400).json({ message: `Unsupported provider "${provider}". Use 'paypal' or POST /api/payments/ewallet for manual wallets.` });
    }
    const user = await get('SELECT id, name, email FROM users WHERE id=?', [req.user.id]);
    if (!user)
        return res.status(404).json({ message: 'User not found' });
    try {
        const ppClientIdEarly = await ENV.paypalClientId();
        if (!ppClientIdEarly)
            return res.status(503).json({ message: 'PayPal not configured' });
        const usd = await egpToUsd(Number(amount));
        const desc = coachId ? `FitWay Coach Subscription (${planCycle} ${planType})` : `FitWay ${type} (${planCycle})`;
        const origin = req.headers.origin || ENV.appBaseUrl();
        const order = await ppCall('POST', '/v2/checkout/orders', {
            intent: 'CAPTURE',
            purchase_units: [{ amount: { currency_code: 'USD', value: usd.toFixed(2) }, description: desc }],
            application_context: {
                return_url: `${origin}/payment/success`,
                cancel_url: `${origin}/payment/cancel`,
                brand_name: 'FitWay Hub',
                user_action: 'PAY_NOW',
                shipping_preference: 'NO_SHIPPING',
            },
        });
        if (!order.id)
            return res.status(500).json({ message: 'PayPal order creation failed', detail: order });
        // Save pending PayPal transaction. Note: the table is still named
        // `paymob_transactions` for historical reasons (see file header) — it now
        // stores PayPal orders only for new traffic.
        await run(`INSERT INTO paymob_transactions (user_id, coach_id, paymob_order_id, amount, type, plan_cycle, plan_type, method, status) VALUES (?,?,?,?,?,?,?,?,?)`, [user.id, coachId || null, order.id, amount, type, planCycle || null, planType || null, 'paypal', 'pending']);
        return res.json({ provider: 'paypal', orderId: order.id, clientId: ppClientIdEarly });
    }
    catch (err) {
        console.error('Payment intention error:', err.message);
        res.status(500).json({ message: 'Failed to create payment' });
    }
});
/**
 * POST /api/pay/paypal/capture
 * Called by frontend after user approves PayPal payment.
 */
router.post('/paypal/capture', authenticateToken, async (req, res) => {
    const { orderId } = req.body;
    if (!orderId || typeof orderId !== 'string' || !/^[A-Z0-9-]{6,40}$/i.test(orderId)) {
        return res.status(400).json({ message: 'orderId required' });
    }
    try {
        // SECURITY: bind orderId to the calling user before hitting PayPal.
        const tx = await get('SELECT * FROM paymob_transactions WHERE paymob_order_id=?', [orderId]);
        if (!tx)
            return res.status(404).json({ message: 'Transaction record not found' });
        if (Number(tx.user_id) !== Number(req.user.id)) {
            return res.status(403).json({ message: 'You do not own this order' });
        }
        if (tx.status === 'paid')
            return res.json({ message: 'Already processed', status: 'paid' });
        const capture = await ppCall('POST', `/v2/checkout/orders/${orderId}/capture`, {});
        if (capture.status !== 'COMPLETED') {
            return res.status(400).json({ message: 'PayPal payment not completed', status: capture.status });
        }
        const txId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.id || orderId;
        await run('UPDATE paymob_transactions SET status=?, paymob_transaction_id=? WHERE id=?', ['paid', txId, tx.id]);
        if (tx.type === 'subscription' && tx.coach_id) {
            await activateSubscription(tx.user_id, tx.coach_id, tx.plan_cycle || 'monthly', tx.plan_type || 'complete', tx.amount, 'paypal', txId);
        }
        else if (tx.type === 'premium') {
            await activatePremium(tx.user_id, tx.plan_cycle || 'monthly', tx.amount, 'paypal', txId);
        }
        res.json({ message: 'Payment captured successfully', status: 'COMPLETED' });
    }
    catch (err) {
        console.error('PayPal capture error:', err.message);
        res.status(500).json({ message: 'Failed to capture payment' });
    }
});
// PayPal webhook signature verification. Without this, any unauthenticated
// caller could POST a forged "payment completed" event and trigger activation.
async function verifyPayPalWebhookSig(req) {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) {
        console.error('PayPal webhook rejected: PAYPAL_WEBHOOK_ID not configured');
        return false;
    }
    const headers = req.headers;
    const required = [
        'paypal-auth-algo',
        'paypal-cert-url',
        'paypal-transmission-id',
        'paypal-transmission-sig',
        'paypal-transmission-time',
    ];
    for (const h of required) {
        if (!headers[h])
            return false;
    }
    try {
        const result = await ppCall('POST', '/v1/notifications/verify-webhook-signature', {
            auth_algo: headers['paypal-auth-algo'],
            cert_url: headers['paypal-cert-url'],
            transmission_id: headers['paypal-transmission-id'],
            transmission_sig: headers['paypal-transmission-sig'],
            transmission_time: headers['paypal-transmission-time'],
            webhook_id: webhookId,
            webhook_event: req.body,
        });
        return result?.verification_status === 'SUCCESS';
    }
    catch (e) {
        console.error('PayPal webhook verify failed:', e?.message || e);
        return false;
    }
}
router.post('/webhook/paypal', async (req, res) => {
    res.sendStatus(200);
    try {
        const verified = await verifyPayPalWebhookSig(req);
        if (!verified) {
            console.warn('PayPal webhook rejected: signature did not verify');
            return;
        }
        const event = req.body;
        const type = event?.event_type;
        if (!type)
            return;
        if (type === 'PAYMENT.CAPTURE.COMPLETED') {
            const orderId = event?.resource?.supplementary_data?.related_ids?.order_id;
            if (!orderId)
                return;
            const tx = await get('SELECT * FROM paymob_transactions WHERE paymob_order_id=? AND status=?', [orderId, 'pending']);
            if (!tx)
                return;
            await run('UPDATE paymob_transactions SET status=?, paymob_transaction_id=? WHERE id=?', ['paid', event.resource.id, tx.id]);
            if (tx.type === 'subscription' && tx.coach_id) {
                await activateSubscription(tx.user_id, tx.coach_id, tx.plan_cycle, tx.plan_type, tx.amount, 'paypal', event.resource.id);
            }
            else if (tx.type === 'premium') {
                await activatePremium(tx.user_id, tx.plan_cycle, tx.amount, 'paypal', event.resource.id);
            }
        }
    }
    catch (err) {
        console.error('PayPal webhook error:', err.message);
    }
});
// ══════════════════════════════════════════════════════════════════════════════
//  ROUTES — OUTGOING (PAYOUTS TO COACHES)
// ══════════════════════════════════════════════════════════════════════════════
/**
 * POST /api/pay/withdraw
 * Coach requests payout. PayPal accounts are paid automatically via PayPal
 * Payouts; e-wallet (Vodafone/Orange/WE Pay) accounts are queued for manual
 * admin approval — see /api/payments/withdrawals.
 */
router.post('/withdraw', authenticateToken, async (req, res) => {
    const { amount } = req.body;
    if (!amount || amount < 50)
        return res.status(400).json({ message: 'Minimum withdrawal is 50 EGP' });
    try {
        const user = await get('SELECT id, name, credit, payment_method_type, payment_phone, payment_wallet_type, paypal_email FROM users WHERE id=?', [req.user.id]);
        if (!user)
            return res.status(404).json({ message: 'User not found' });
        if ((user.credit || 0) < amount)
            return res.status(400).json({ message: 'Insufficient balance' });
        const method = user.payment_method_type || 'ewallet';
        if (method === 'ewallet' && !user.payment_phone)
            return res.status(400).json({ message: 'Please set your mobile wallet number in Profile → Payment Info' });
        if (method === 'paypal' && !user.paypal_email)
            return res.status(400).json({ message: 'Please set your PayPal email in Profile → Payment Info' });
        const { insertId } = await run(`INSERT INTO withdrawal_requests (coach_id, amount, payment_phone, wallet_type, payment_method_type, paypal_email, status)
       VALUES (?,?,?,?,?,?,'processing')`, [req.user.id, amount, user.payment_phone, user.payment_wallet_type, method, user.paypal_email]);
        await run('UPDATE users SET credit = credit - ? WHERE id=?', [amount, req.user.id]);
        await run('INSERT INTO credit_transactions (user_id, amount, type, reference_id, description) VALUES (?,?,?,?,?)', [req.user.id, -amount, 'withdrawal_processing', insertId, `Withdrawal of ${amount} EGP initiated`]);
        res.json({
            message: method === 'paypal'
                ? `Processing ${amount} EGP payout to your PayPal. Funds arrive within minutes.`
                : `Your withdrawal request has been queued. An admin will send ${amount} EGP to your ${user.payment_wallet_type} wallet shortly.`,
            withdrawalId: insertId,
        });
        // PayPal: fire automated payout. E-wallet: stays in `processing` queue.
        autoPayout(req.user.id, amount, insertId)
            .then(async (result) => {
            if (result.ok && !result.queuedManual) {
                await run('UPDATE withdrawal_requests SET status=?, processed_at=NOW() WHERE id=?', ['approved', insertId]);
                await run('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)', [req.user.id, 'withdrawal', '✅ Payout Sent!', `${amount} EGP has been sent to your PayPal (${user.paypal_email}).`, '/coach/profile']);
                console.log(`✅ Auto-payout ${amount} EGP → coach #${req.user.id}`);
            }
            else if (result.queuedManual) {
                // Manual queue — do not move out of `processing`. Notify the coach.
                await run('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)', [req.user.id, 'withdrawal', '⏳ Withdrawal Queued', `Your ${amount} EGP withdrawal request is queued for admin processing.`, '/coach/profile']);
            }
            else {
                await run('UPDATE users SET credit = credit + ? WHERE id=?', [amount, req.user.id]);
                await run('UPDATE withdrawal_requests SET status=?, admin_note=? WHERE id=?', ['rejected', result.error, insertId]);
                await run('INSERT INTO credit_transactions (user_id, amount, type, reference_id, description) VALUES (?,?,?,?,?)', [req.user.id, amount, 'withdrawal_refund', insertId, `Payout failed — credit restored: ${result.error}`]);
                await run('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)', [req.user.id, 'withdrawal', '⚠️ Payout Failed', `Could not send ${amount} EGP. Your balance has been restored. Error: ${result.error}`, '/coach/profile']);
                console.error(`❌ Payout failed coach #${req.user.id}: ${result.error}`);
            }
        })
            .catch(async (err) => {
            await run('UPDATE users SET credit = credit + ? WHERE id=?', [amount, req.user.id]);
            await run('UPDATE withdrawal_requests SET status=?, admin_note=? WHERE id=?', ['rejected', err.message, insertId]);
            await run('INSERT INTO credit_transactions (user_id, amount, type, reference_id, description) VALUES (?,?,?,?,?)', [req.user.id, amount, 'withdrawal_refund', insertId, `Payout exception: ${err.message}`]);
            console.error('Payout exception:', err.message);
        });
    }
    catch (err) {
        console.error('Withdraw route error:', err.message);
        res.status(500).json({ message: 'Failed to initiate withdrawal' });
    }
});
/**
 * GET /api/pay/withdraw/:id
 * Check withdrawal status. (Live polling against the gateway was removed
 * with Paymob — PayPal status is updated by the payouts callback or the
 * admin manual-approve flow.)
 */
router.get('/withdraw/:id', authenticateToken, async (req, res) => {
    try {
        const wr = await get('SELECT * FROM withdrawal_requests WHERE id=? AND coach_id=?', [req.params.id, req.user.id]);
        if (!wr)
            return res.status(404).json({ message: 'Not found' });
        res.json({ withdrawal: wr });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch withdrawal' });
    }
});
// ══════════════════════════════════════════════════════════════════════════════
//  AUTO-REFUND (called from paymentRoutes when coach declines a subscription)
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Mark a subscription as needing manual refund. With Paymob removed there is
 * no automated refund path — an admin must issue the PayPal refund from the
 * PayPal dashboard or refund the user via wallet/credit. We mark the row so
 * it shows up in the admin refund queue.
 */
export async function autoRefundSubscription(subscriptionId) {
    try {
        const sub = await get('SELECT * FROM coach_subscriptions WHERE id=?', [subscriptionId]);
        if (!sub)
            return false;
        const tx = await get(`SELECT * FROM paymob_transactions WHERE user_id=? AND coach_id=? AND type='subscription' AND status='paid' ORDER BY created_at DESC LIMIT 1`, [sub.user_id, sub.coach_id]);
        if (!tx)
            return false;
        await run('UPDATE coach_subscriptions SET refund_status=? WHERE id=?', ['pending', subscriptionId]);
        await run('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)', [sub.user_id, 'refund', '↩️ Refund Pending', `Your payment of ${tx.amount} EGP is being refunded by an admin.`, '/app/coaching']);
        return true;
    }
    catch (err) {
        console.error('Auto-refund error:', err.message);
        return false;
    }
}
// ══════════════════════════════════════════════════════════════════════════════
//  INFO ROUTES
// ══════════════════════════════════════════════════════════════════════════════
router.get('/history', authenticateToken, async (req, res) => {
    try {
        const txs = await query(`SELECT pt.*, c.name AS coach_name FROM paymob_transactions pt LEFT JOIN users c ON pt.coach_id = c.id
       WHERE pt.user_id=? ORDER BY pt.created_at DESC LIMIT 50`, [req.user.id]);
        res.json({ transactions: txs });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch history' });
    }
});
router.get('/balance', authenticateToken, async (req, res) => {
    try {
        const user = await get('SELECT credit, payment_method_type, payment_phone, payment_wallet_type, paypal_email FROM users WHERE id=?', [req.user.id]);
        const txs = await query('SELECT * FROM credit_transactions WHERE user_id=? ORDER BY created_at DESC LIMIT 50', [req.user.id]);
        const pending = await query('SELECT * FROM withdrawal_requests WHERE coach_id=? AND status=? ORDER BY created_at DESC', [req.user.id, 'processing']);
        res.json({ balance: user?.credit || 0, transactions: txs, pendingPayouts: pending, paymentInfo: { method: user?.payment_method_type, phone: user?.payment_phone, wallet: user?.payment_wallet_type, paypal: user?.paypal_email } });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch balance' });
    }
});
export default router;
//# sourceMappingURL=paymobRoutes.js.map