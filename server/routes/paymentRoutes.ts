import { Router, Request, Response } from 'express';
import { autoRefundSubscription } from './paymobRoutes.js';
import { authenticateToken } from '../middleware/auth.js';
import { run, get, query } from '../config/database.js';
import { upload, optimizeImage, uploadToR2 } from '../middleware/upload.js';
import https from 'https';
import { sendPushFromTemplate, sendPushToUser } from '../notificationService.js';

const router = Router();

const uploadPaymentProof = (req: Request, res: Response, next: any) => {
  upload.single('proof')(req as any, res as any, (err: any) => {
    if (!err) return next();
    const msg = String(err?.message || 'Invalid upload');
    if (msg.toLowerCase().includes('file too large')) {
      return res.status(400).json({ message: 'Proof image is too large. Please upload an image up to 5MB.' });
    }
    if (msg.toLowerCase().includes('only images are allowed')) {
      return res.status(400).json({ message: 'Only image files are allowed for payment proof.' });
    }
    return res.status(400).json({ message: msg });
  });
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getSetting(key: string): Promise<string | null> {
  const row = await get('SELECT setting_value FROM payment_settings WHERE setting_key = ?', [key]) as any;
  return row ? row.setting_value : null;
}

function normalizeCoachSubscriptionStatus(status: string | null | undefined): string {
  if (!status) return 'pending_admin';
  if (status === 'pending') return 'pending_admin';
  return status;
}

function getCoachSubscriptionDurationMonths(planCycle: string): number {
  return planCycle === 'yearly' ? 12 : 1;
}

async function computeCoachCut(amount: number): Promise<number> {
  const pctStr = await getSetting('coach_cut_percentage');
  const pct = pctStr ? Math.min(100, Math.max(0, Number(pctStr))) : 90;
  return Math.round(amount * (pct / 100) * 100) / 100;
}

async function getPayPalHostname(): Promise<string> {
  const mode = await getSetting('paypal_mode');
  return mode === 'live' ? 'api-m.paypal.com' : 'api-m.sandbox.paypal.com';
}

function normalizePhone(v: string | null | undefined): string {
  return String(v || '').trim().replace(/\s+/g, '');
}

function isWalletPhoneValid(walletType: string, phone: string): boolean {
  const clean = normalizePhone(phone);
  if (!/^\d{11}$/.test(clean)) return false;
  if (walletType === 'vodafone') return clean.startsWith('010');
  if (walletType === 'orange') return clean.startsWith('012');
  if (walletType === 'we') return clean.startsWith('011');
  return false;
}

function pickWalletPhone(user: any): string | null {
  const walletType = String(user?.payment_wallet_type || 'vodafone');
  if (walletType === 'orange') return user?.payment_phone_orange || user?.payment_phone || null;
  if (walletType === 'we') return user?.payment_phone_we || user?.payment_phone || null;
  return user?.payment_phone_vodafone || user?.payment_phone || null;
}

// ── EGP → USD conversion ─────────────────────────────────────────────────────
let cachedRate: { rate: number; ts: number } | null = null;
const RATE_TTL = 6 * 3600_000; // cache 6 hours

async function egpToUsd(egpAmount: number): Promise<number> {
  // 1) try admin-configured fixed rate
  const fixedRate = await getSetting('egp_usd_rate');
  if (fixedRate && Number(fixedRate) > 0) {
    return Math.round((egpAmount / Number(fixedRate)) * 100) / 100;
  }

  // 2) use cached live rate if fresh
  if (cachedRate && Date.now() - cachedRate.ts < RATE_TTL) {
    return Math.round((egpAmount / cachedRate.rate) * 100) / 100;
  }

  // 3) fetch live rate
  try {
    const rate: number = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'open.er-api.com',
        path: '/v6/latest/USD',
        method: 'GET',
        timeout: 5000,
      }, (res) => {
        let data = '';
        res.on('data', (c: string) => data += c);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json?.result === 'success' && json.rates?.EGP) {
              resolve(Number(json.rates.EGP));
            } else {
              reject(new Error('bad response'));
            }
          } catch (e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      req.end();
    });
    cachedRate = { rate, ts: Date.now() };
    return Math.round((egpAmount / rate) * 100) / 100;
  } catch {
    // 4) fallback ~50.5 EGP per USD
    return Math.round((egpAmount / 50.5) * 100) / 100;
  }
}

async function getPayPalToken(clientId: string, secret: string): Promise<string> {
  const hostname = await getPayPalHostname();
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
    const body = 'grant_type=client_credentials';
    const opts = {
      hostname,
      path: '/v1/oauth2/token',
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': body.length }
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c: string) => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data).access_token); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function paypalRequest(clientId: string, secret: string, method: string, path: string, body?: object): Promise<any> {
  const hostname = await getPayPalHostname();
  const token = await getPayPalToken(clientId, secret);
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const opts: any = {
      hostname,
      path,
      method,
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr || ' ') }
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c: string) => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── Public: fetch payment settings for frontend ───────────────────────────────
router.get('/public-settings', async (_req: Request, res: Response) => {
  try {
    const rows = await query('SELECT setting_key, setting_value FROM payment_settings') as any[];
    const settings: Record<string, string> = {};
    for (const row of rows) {
      if (['paypal_user_link', 'paypal_coach_link', 'ewallet_phone', 'ewallet_phone_vodafone', 'ewallet_phone_orange', 'ewallet_phone_we', 'paypal_user_client_id', 'paypal_coach_client_id', 'pm_orange_cash', 'pm_vodafone_cash', 'pm_we_pay', 'pm_paypal', 'pm_credit_card', 'pm_google_pay', 'pm_apple_pay'].includes(row.setting_key)) {
        settings[row.setting_key] = row.setting_value;
      }
    }
    res.json({ settings });
  } catch { res.status(500).json({ message: 'Failed to fetch settings' }); }
});

// ── PayPal: Create Order ──────────────────────────────────────────────────────
router.post('/paypal/create-order', authenticateToken, async (req: any, res: Response) => {
  const { amount, plan, type, coachId, coachName } = req.body;
  try {
    const clientIdKey = type === 'coach' ? 'paypal_coach_client_id' : 'paypal_user_client_id';
    const secretKey = type === 'coach' ? 'paypal_coach_secret' : 'paypal_user_secret';
    const clientId = await getSetting(clientIdKey);
    const secret = await getSetting(secretKey);
    if (!clientId || !secret) {
      return res.status(503).json({ message: 'PayPal not configured by admin yet' });
    }
    const description = coachId
      ? `FitWay Coach Subscription - ${coachName || 'Coach'} (${plan})`
      : `FitWay ${type === 'coach' ? 'Coach Membership' : 'Premium'} - ${plan}`;
    const usdAmount = await egpToUsd(parseFloat(amount));
    const origin = req.headers.origin || process.env.APP_BASE_URL || 'http://localhost:3000';
    const order = await paypalRequest(clientId, secret, 'POST', '/v2/checkout/orders', {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: { currency_code: 'USD', value: String(usdAmount.toFixed(2)) },
        description
      }],
      application_context: {
        return_url: `${origin}/payment/success?plan=${plan}&type=${type}&amount=${amount}`,
        cancel_url: `${origin}/payment/cancel`,
        brand_name: 'FitWay Hub',
        user_action: 'PAY_NOW'
      }
    });
    if (order.id) {
      res.json({ id: order.id });
    } else {
      res.status(500).json({ message: 'Failed to create PayPal order', detail: order });
    }
  } catch (err: any) {
    res.status(500).json({ message: 'Failed to create PayPal order', error: err.message });
  }
});

// ── PayPal: Capture Order ─────────────────────────────────────────────────────
router.post('/paypal/capture-order', authenticateToken, async (req: any, res: Response) => {
  const { orderId, plan, type, amount, coachId } = req.body;
  try {
    const clientIdKey = type === 'coach' ? 'paypal_coach_client_id' : 'paypal_user_client_id';
    const secretKey = type === 'coach' ? 'paypal_coach_secret' : 'paypal_user_secret';
    const clientId = await getSetting(clientIdKey);
    const secret = await getSetting(secretKey);
    if (!clientId || !secret) return res.status(503).json({ message: 'PayPal not configured' });

    const capture = await paypalRequest(clientId, secret, 'POST', `/v2/checkout/orders/${orderId}/capture`, {});
    if (capture.status === 'COMPLETED') {
      // ── Coach subscription via PayPal (user subscribes to a coach) ──
      if (coachId) {
        const coach = await get(
          `SELECT u.id, COALESCE(cp.monthly_price, 0) as monthly_price, COALESCE(cp.yearly_price, 0) as yearly_price, COALESCE(cp.plan_types, 'complete') as plan_types
           FROM users u LEFT JOIN coach_profiles cp ON cp.user_id = u.id
           WHERE u.id = ? AND u.role = 'coach'`, [coachId]
        ) as any;
        if (!coach) return res.status(404).json({ message: 'Coach not found' });

        const planCycle = plan === 'annual' ? 'yearly' : 'monthly';
        const subAmount = planCycle === 'yearly' ? Number(coach.yearly_price || 0) : Number(coach.monthly_price || 0);

        // Check for existing pending subscription
        const existingPending = await get(
          `SELECT id FROM coach_subscriptions
           WHERE user_id = ? AND coach_id = ? AND status IN ('pending_admin', 'pending_coach', 'pending')
           ORDER BY created_at DESC LIMIT 1`,
          [req.user.id, coachId]
        ) as any;
        if (existingPending) {
          return res.status(400).json({ message: 'You already have a pending subscription request for this coach.' });
        }

        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + getCoachSubscriptionDurationMonths(planCycle));

        // PayPal verified — activate immediately, credit coach, no human approval needed
        const coachCutAmt = Math.round(subAmount * (Number(process.env.COACH_CUT_PERCENT || 85) / 100) * 100) / 100;
        await run(
          `INSERT INTO coach_subscriptions
           (user_id, coach_id, plan_cycle, plan_type, amount, status,
            admin_approval_status, coach_decision_status,
            payment_method, started_at, expires_at, credited_amount, credit_released_at)
           VALUES (?,?,?,?,?,'active','approved','accepted','paypal',NOW(),?,?,NOW())`,
          [req.user.id, coachId, planCycle, coach.plan_types || 'complete', subAmount,
           expiresAt.toISOString().slice(0, 19).replace('T', ' '), coachCutAmt]
        );
        await run('UPDATE users SET credit = credit + ? WHERE id=?', [coachCutAmt, coachId]);
        const payer = await get<any>('SELECT name FROM users WHERE id = ?', [req.user.id]);
        const payerName = payer?.name || 'Subscriber';
        await run('INSERT INTO credit_transactions (user_id, amount, type, description) VALUES (?,?,?,?)',
          [coachId, coachCutAmt, 'subscription_income', `PayPal subscription from ${payerName}`]);
        await run('INSERT INTO payments (user_id, type, plan, amount, payment_method, transaction_id, status) VALUES (?,?,?,?,?,?,?)',
          [req.user.id, 'coach_subscription', plan, subAmount, 'paypal', orderId, 'completed']);
        await Promise.all([
          run('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)',
            [req.user.id, 'subscription', '✅ Subscription Active!', `Your ${planCycle} plan with the coach is now active.`, '/app/coaching']),
          run('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)',
            [coachId, 'subscription', '💰 New Subscriber!', `A user subscribed via PayPal. ${coachCutAmt} EGP added to your balance.`, '/coach/profile']),
        ]);
        sendPushToUser(req.user.id, '✅ Subscription Active!', `Your ${planCycle} plan with the coach is now active.`, undefined, '/app/coaching', 'subscription').catch(() => {});
        sendPushToUser(coachId, '💰 New Subscriber!', `A user subscribed via PayPal. ${coachCutAmt} EGP added to your balance.`, undefined, '/coach/profile', 'subscription').catch(() => {});

        // Subscription now activates immediately — no coach approval step needed for paid subscriptions
        res.json({ message: 'Subscription activated! Your plan is now active.', status: 'COMPLETED' });
        return;
      }

      // ── Regular premium / coach membership PayPal payment ──
      await run('INSERT INTO payments (user_id, type, plan, amount, payment_method, transaction_id, status) VALUES (?,?,?,?,?,?,?)',
        [req.user.id, type === 'coach' ? 'coach_membership' : 'premium', plan, amount, 'paypal', orderId, 'completed']);
      if (type === 'coach') {
        // PayPal/card coach payment → immediate activation
        await run('UPDATE users SET coach_membership_active = 1 WHERE id = ?', [req.user.id]);
      } else {
        // Only set `is_premium` for users (not coaches/admins)
        const u = await get('SELECT role FROM users WHERE id = ?', [req.user.id]) as any;
        if (u && u.role === 'user') {
          await run('UPDATE users SET is_premium = 1 WHERE id = ?', [req.user.id]);
        }
      }
      res.json({ message: 'Payment completed', status: 'COMPLETED' });
    } else {
      res.status(400).json({ message: 'Payment not completed', status: capture.status });
    }
  } catch (err: any) {
    res.status(500).json({ message: 'Failed to capture PayPal order', error: err.message });
  }
});

// ── Pricing: same for both user and coach ─────────────────────────────────
// Monthly: 50 EGP, Annual: 450 EGP
function getPremiumAmount(plan: string): number {
  return plan === 'annual' ? 450 : 50;
}

// ── Credit/Debit Card endpoints REMOVED ───────────────────────────────────────
// Card payments are not supported — use E-Wallet or PayPal.

// ── E-Wallet: Coach or User ───────────────────────────────────────────────────
// Coach e-wallet → PENDING (requires admin approval)
// User e-wallet → PENDING (requires admin approval)
router.post('/ewallet', authenticateToken, uploadPaymentProof, optimizeImage(), async (req: any, res: Response) => {
  const { plan, type, walletType, senderNumber, coachId } = req.body;
  if (!plan || !type || !walletType || !senderNumber) return res.status(400).json({ message: 'All fields required' });
  if (!req.file) return res.status(400).json({ message: 'Payment proof screenshot is required' });
  const proofUrl = await uploadToR2(req.file, 'proofs');
  try {
    // Coach subscription payment flow (user pays for a specific coach)
    if (coachId) {
      const coach = await get(
        `SELECT u.id, COALESCE(cp.monthly_price, 0) as monthly_price, COALESCE(cp.yearly_price, 0) as yearly_price, COALESCE(cp.plan_types, 'complete') as plan_types
         FROM users u LEFT JOIN coach_profiles cp ON cp.user_id = u.id
         WHERE u.id = ? AND u.role = 'coach'`, [coachId]
      ) as any;
      if (!coach) return res.status(404).json({ message: 'Coach not found' });

      const planCycle = plan === 'annual' ? 'yearly' : 'monthly';
      const amount = planCycle === 'yearly' ? Number(coach.yearly_price || 0) : Number(coach.monthly_price || 0);
      if (amount <= 0) return res.status(400).json({ message: 'Coach has not set pricing for this plan' });

      const existingPending = await get(
        `SELECT id FROM coach_subscriptions
         WHERE user_id = ? AND coach_id = ? AND status IN ('pending_admin', 'pending_coach', 'pending')
         ORDER BY created_at DESC LIMIT 1`,
        [req.user.id, coachId]
      ) as any;
      if (existingPending) {
        return res.status(400).json({ message: 'You already have a pending subscription request for this coach.' });
      }

      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + getCoachSubscriptionDurationMonths(planCycle));

      await run(
        `INSERT INTO coach_subscriptions
         (user_id, coach_id, plan_cycle, plan_type, amount, status, payment_method, payment_proof, expires_at, payer_wallet_type, payer_number)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [
          req.user.id,
          coachId,
          planCycle,
          coach.plan_types || 'complete',
          amount,
          'pending_admin',
          `ewallet_${walletType}`,
          proofUrl,
          expiresAt.toISOString().slice(0, 19).replace('T', ' '),
          walletType,
          senderNumber,
        ]
      );

      return res.json({
        message: 'Payment proof submitted. Awaiting admin verification, then coach confirmation.',
        proofUrl,
        status: 'pending_admin',
      });
    }

    const amount = getPremiumAmount(plan);
    await run(
      'INSERT INTO payments (user_id, type, plan, amount, payment_method, proof_url, wallet_type, sender_number, status) VALUES (?,?,?,?,?,?,?,?,?)',
      [req.user.id, type === 'coach' ? 'coach_membership' : 'premium', plan, amount, 'ewallet', proofUrl, walletType, senderNumber, 'pending']
    );
    res.json({
      message: 'Payment proof submitted. Your request is pending admin approval. You will be notified once approved.',
      proofUrl,
      status: 'pending'
    });
  } catch (err: any) {
    console.error('E-wallet payment submit error:', err?.message || err);
    res.status(500).json({ message: 'Failed to process e-wallet payment' });
  }
});

// ── Admin: Approve manual e-wallet payment (legacy — Paymob/PayPal payments are auto) ──────
// These endpoints still work for any manually submitted proof screenshots.
// Paymob and PayPal payments go through /api/pay/webhook and need no approval.
router.patch('/approve/:paymentId', authenticateToken, async (req: any, res: Response) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  const { paymentId } = req.params;
  try {
    const payment = await get('SELECT * FROM payments WHERE id = ?', [paymentId]) as any;
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    await run('UPDATE payments SET status = ? WHERE id = ?', ['completed', paymentId]);
    if (payment.type === 'coach_membership') {
      await run('UPDATE users SET coach_membership_active = 1 WHERE id = ?', [payment.user_id]);
    } else if (payment.type === 'premium') {
      // Only grant premium if the target account is a user
      const target = await get('SELECT role FROM users WHERE id = ?', [payment.user_id]) as any;
      if (target && target.role === 'user') {
        await run('UPDATE users SET is_premium = 1 WHERE id = ?', [payment.user_id]);
      }
    }
    res.json({ message: 'Payment approved and account activated' });
    // Push notification (fire-and-forget)
    if (payment.user_id) {
      sendPushFromTemplate(payment.user_id, 'payment_approved', {}).catch(() => {});
    }
  } catch {
    res.status(500).json({ message: 'Failed to approve payment' });
  }
});

// Admin: Reject e-wallet payment
router.patch('/reject/:paymentId', authenticateToken, async (req: any, res: Response) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  const { paymentId } = req.params;
  const { reason } = req.body;
  try {
    const payment = await get<any>('SELECT user_id, amount, type FROM payments WHERE id = ?', [paymentId]);
    await run('UPDATE payments SET status = ? WHERE id = ?', ['rejected', paymentId]);
    // Notify user about payment rejection
    if (payment?.user_id) {
      const note = reason ? `: ${reason}` : '';
      await run('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)',
        [payment.user_id, 'payment_rejected', '❌ Payment Rejected', `Your e-wallet payment of ${payment.amount || ''} EGP has been rejected${note}`, '/app/coaching']);
      sendPushFromTemplate(payment.user_id, 'payment_rejected', {}, '/app/coaching').catch(() => {});
    }
    res.json({ message: 'Payment rejected' });
  } catch {
    res.status(500).json({ message: 'Failed to reject payment' });
  }
});

// ── Coaching Booking Payment: Create PayPal order for a booking ───────────────
router.post('/booking/paypal/create-order', authenticateToken, async (req: any, res: Response) => {
  const { bookingId, amount, coachName } = req.body;
  try {
    const clientId = await getSetting('paypal_user_client_id');
    const secret = await getSetting('paypal_user_secret');
    if (!clientId || !secret) return res.status(503).json({ message: 'PayPal not configured' });
    const bookingUsd = await egpToUsd(parseFloat(amount));
    const origin = req.headers.origin || process.env.APP_BASE_URL || 'http://localhost:3000';
    const order = await paypalRequest(clientId, secret, 'POST', '/v2/checkout/orders', {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: { currency_code: 'USD', value: String(bookingUsd.toFixed(2)) },
        description: `FitWay Coaching - ${coachName}`
      }],
      application_context: {
        return_url: `${origin}/app/coaching?booking_success=${bookingId}`,
        cancel_url: `${origin}/app/coaching?booking_cancel=${bookingId}`,
        brand_name: 'FitWay Hub',
        user_action: 'PAY_NOW'
      }
    });
    if (order.id) {
      res.json({ id: order.id });
    } else {
      res.status(500).json({ message: 'Failed to create order', detail: order });
    }
  } catch (err: any) {
    res.status(500).json({ message: 'Failed to create PayPal order', error: err.message });
  }
});

// Capture booking PayPal payment
router.post('/booking/paypal/capture', authenticateToken, async (req: any, res: Response) => {
  const { orderId, bookingId } = req.body;
  try {
    const clientId = await getSetting('paypal_user_client_id');
    const secret = await getSetting('paypal_user_secret');
    if (!clientId || !secret) return res.status(503).json({ message: 'PayPal not configured' });
    const capture = await paypalRequest(clientId, secret, 'POST', `/v2/checkout/orders/${orderId}/capture`, {});
    if (capture.status === 'COMPLETED') {
      await run('UPDATE coaching_bookings SET payment_status = ?, payment_transaction_id = ?, payment_method = ? WHERE id = ? AND user_id = ?',
        ['paid', orderId, 'paypal', bookingId, req.user.id]);
      res.json({ message: 'Booking payment completed', status: 'COMPLETED' });
    } else {
      res.status(400).json({ message: 'Payment not completed', status: capture.status });
    }
  } catch (err: any) {
    res.status(500).json({ message: 'Capture failed', error: err.message });
  }
});

// E-wallet proof for booking payment
router.post('/booking/ewallet', authenticateToken, upload.single('proof'), optimizeImage(), async (req: any, res: Response) => {
  const { bookingId, walletType, senderNumber } = req.body;
  if (!bookingId || !walletType || !senderNumber || !req.file) {
    return res.status(400).json({ message: 'All fields and proof screenshot required' });
  }
  const proofUrl = await uploadToR2(req.file, 'proofs');
  try {
    await run('UPDATE coaching_bookings SET payment_status = ?, payment_proof = ?, payment_method = ? WHERE id = ? AND user_id = ?',
      ['proof_submitted', proofUrl, `ewallet_${walletType}`, bookingId, req.user.id]);
    res.json({ message: 'Payment proof submitted. Coach will confirm once verified.', proofUrl });
  } catch {
    res.status(500).json({ message: 'Failed to submit proof' });
  }
});

// Coach confirms booking e-wallet payment
router.patch('/booking/confirm-payment/:bookingId', authenticateToken, async (req: any, res: Response) => {
  const { bookingId } = req.params;
  try {
    const booking = await get('SELECT * FROM coaching_bookings WHERE id = ? AND coach_id = ?', [bookingId, req.user.id]) as any;
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    await run('UPDATE coaching_bookings SET payment_status = ? WHERE id = ?', ['paid', bookingId]);
    res.json({ message: 'Payment confirmed' });
  } catch {
    res.status(500).json({ message: 'Failed to confirm payment' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── COACH SUBSCRIPTION SYSTEM ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// User subscribes to a coach (monthly/yearly) via e-wallet
router.post('/coach-subscribe', authenticateToken, upload.single('proof'), optimizeImage(), async (req: any, res: Response) => {
  const { coachId, planCycle, planType, walletType, senderNumber } = req.body;
  if (!coachId || !planCycle || !planType) return res.status(400).json({ message: 'Coach ID, plan cycle, and plan type are required' });
  if (!req.file) return res.status(400).json({ message: 'Payment proof screenshot is required' });
  if (!walletType || !senderNumber) return res.status(400).json({ message: 'Wallet type and sender number are required' });

  try {
    // Get coach's pricing
    const coach = await get(
      `SELECT u.id, COALESCE(cp.monthly_price, 0) as monthly_price, COALESCE(cp.yearly_price, 0) as yearly_price, COALESCE(cp.plan_types, 'complete') as plan_types
       FROM users u LEFT JOIN coach_profiles cp ON cp.user_id = u.id
       WHERE u.id = ? AND u.role = 'coach'`, [coachId]
    ) as any;
    if (!coach) return res.status(404).json({ message: 'Coach not found' });

    const amount = planCycle === 'yearly' ? (coach.yearly_price || 0) : (coach.monthly_price || 0);
    if (amount <= 0) return res.status(400).json({ message: 'Coach has not set pricing for this plan' });

    const proofUrl = await uploadToR2(req.file, 'proofs');
    const expiresAt = new Date();
    if (planCycle === 'yearly') {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }

    await run(
      `INSERT INTO coach_subscriptions
       (user_id, coach_id, plan_cycle, plan_type, amount, status, payment_method, payment_proof, expires_at, payer_wallet_type, payer_number)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        req.user.id,
        coachId,
        planCycle,
        planType,
        amount,
        'pending_admin',
        `ewallet_${walletType}`,
        proofUrl,
        expiresAt.toISOString().slice(0, 19).replace('T', ' '),
        walletType,
        senderNumber,
      ]
    );

    res.json({ message: 'Subscription request submitted! Awaiting admin verification, then coach approval.', status: 'pending_admin', amount });
  } catch (err: any) {
    console.error('Coach subscribe error:', err);
    res.status(500).json({ message: 'Failed to process subscription' });
  }
});

// Admin: list pending coach subscriptions
router.get('/coach-subscriptions', authenticateToken, async (req: any, res: Response) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const statusFilter = req.query.status ? String(req.query.status) : null;
    const subs = await query(
      `SELECT cs.*,
              u.name AS user_name, u.email AS user_email, u.avatar AS user_avatar,
              c.name AS coach_name, c.email AS coach_email, c.avatar AS coach_avatar
       FROM coach_subscriptions cs
       LEFT JOIN users u ON cs.user_id = u.id
       LEFT JOIN users c ON cs.coach_id = c.id
       ${statusFilter ? "WHERE cs.status = '" + statusFilter.replace(/[^a-z_]/g, '') + "'" : ''}
       ORDER BY cs.created_at DESC`
    );
    res.json({ subscriptions: subs });
  } catch {
    res.status(500).json({ message: 'Failed to fetch subscriptions' });
  }
});

// Admin: verify payment proof for coach subscription
router.patch('/coach-subscriptions/:id/approve', authenticateToken, async (req: any, res: Response) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  const { id } = req.params;
  try {
    const sub = await get('SELECT * FROM coach_subscriptions WHERE id = ?', [id]) as any;
    if (!sub) return res.status(404).json({ message: 'Subscription not found' });
    const currentStatus = normalizeCoachSubscriptionStatus(sub.status);
    if (currentStatus === 'active') return res.json({ message: 'Already active' });
    if (currentStatus === 'rejected_admin' || currentStatus === 'rejected_by_coach' || currentStatus === 'refunded') {
      return res.status(400).json({ message: 'Cannot approve a rejected/refunded subscription' });
    }

    await run('UPDATE coach_subscriptions SET status = ?, admin_approval_status = ?, admin_approved_at = NOW() WHERE id = ?', ['pending_coach', 'approved', id]);

    await run(
      'INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)',
      [sub.coach_id, 'subscription', 'New Subscription Request', 'A user paid and requested to subscribe to you. Please accept or decline from Requests.', '/coach/profile']
    );
    sendPushFromTemplate(sub.coach_id, 'subscription_verified', {}, '/coach/profile').catch(() => {});
    await run(
      'INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)',
      [sub.user_id, 'subscription', 'Payment Verified', 'Admin verified your payment. Waiting for coach acceptance.', '/app/coaching']
    );
    sendPushFromTemplate(sub.user_id, 'subscription_verified_user', {}, '/app/coaching').catch(() => {});

    res.json({ message: 'Payment verified. Waiting for coach decision.' });
  } catch (err: any) {
    console.error('Approve sub error:', err);
    res.status(500).json({ message: 'Failed to approve subscription' });
  }
});

// Admin: bulk verify all pending coach subscription payments
router.patch('/coach-subscriptions/approve-all', authenticateToken, async (req: any, res: Response) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const pendingSubs = await query<any>(
      `SELECT id, user_id, coach_id
       FROM coach_subscriptions
       WHERE status IN ('pending_admin', 'pending')
       ORDER BY created_at ASC`
    );

    if (!pendingSubs.length) {
      return res.json({ message: 'No pending subscriptions found', approved: 0 });
    }

    for (const sub of pendingSubs) {
      await run(
        'UPDATE coach_subscriptions SET status = ?, admin_approval_status = ?, admin_approved_at = NOW() WHERE id = ?',
        ['pending_coach', 'approved', sub.id]
      );
      await run(
        'INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)',
        [sub.coach_id, 'subscription', 'New Subscription Request', 'A user paid and requested to subscribe to you. Please accept or decline from Requests.', '/coach/profile']
      );
      sendPushToUser(sub.coach_id, 'New Subscription Request', 'A user paid and requested to subscribe to you. Please accept or decline from Requests.', undefined, '/coach/profile', 'subscription').catch(() => {});
      await run(
        'INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)',
        [sub.user_id, 'subscription', 'Payment Verified', 'Admin verified your payment. Waiting for coach acceptance.', '/app/coaching']
      );
      sendPushToUser(sub.user_id, 'Payment Verified', 'Admin verified your payment. Waiting for coach acceptance.', undefined, '/app/coaching', 'subscription').catch(() => {});
    }

    res.json({ message: `Verified ${pendingSubs.length} pending subscriptions`, approved: pendingSubs.length });
  } catch {
    res.status(500).json({ message: 'Failed to verify all subscriptions' });
  }
});

// Admin: reject coach subscription and refund user
router.patch('/coach-subscriptions/:id/reject', authenticateToken, async (req: any, res: Response) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  const { id } = req.params;
  const { note } = req.body;
  try {
    const sub = await get('SELECT * FROM coach_subscriptions WHERE id = ?', [id]) as any;
    if (!sub) return res.status(404).json({ message: 'Subscription not found' });
    const currentStatus = normalizeCoachSubscriptionStatus(sub.status);
    if (currentStatus === 'active') return res.status(400).json({ message: 'Active subscription cannot be rejected' });
    if (currentStatus === 'rejected_admin' || currentStatus === 'rejected_by_coach' || currentStatus === 'refunded') {
      return res.json({ message: 'Already rejected/refunded' });
    }

    await run(
      `UPDATE coach_subscriptions
       SET status = ?, admin_approval_status = ?, refund_status = ?, refunded_at = NOW(), refund_amount = amount, refund_reason = ?
       WHERE id = ?`,
      ['rejected_admin', 'rejected', 'completed', note || 'Rejected by admin', id]
    );

    await run(
      'INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)',
      [sub.user_id, 'refund', 'Subscription Rejected and Refunded', `Your payment for coach subscription was rejected by admin and marked as refunded.${note ? ` Reason: ${note}` : ''}`, '/app/coaching']
    );
    sendPushFromTemplate(sub.user_id, 'subscription_rejected', {}, '/app/coaching').catch(() => {});

    res.json({ message: 'Subscription rejected and user marked refunded.' });
  } catch {
    res.status(500).json({ message: 'Failed to reject subscription' });
  }
});

// Coach: list subscription requests waiting coach decision
router.get('/coach-subscription-requests', authenticateToken, async (req: any, res: Response) => {
  if (req.user?.role !== 'coach' && req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Coach access required' });
  }

  try {
    const subs = await query(
      `SELECT cs.*, u.name as user_name, u.email as user_email, u.avatar as user_avatar
       FROM coach_subscriptions cs
       LEFT JOIN users u ON cs.user_id = u.id
       WHERE cs.coach_id = ? AND cs.status IN ('pending_coach', 'pending_admin', 'pending')
       ORDER BY cs.created_at DESC`,
      [req.user.id]
    );
    res.json({ subscriptions: subs });
  } catch {
    res.status(500).json({ message: 'Failed to fetch coach subscription requests' });
  }
});

// Coach: list active subscriptions
router.get('/coach-active-subscriptions', authenticateToken, async (req: any, res: Response) => {
  if (req.user?.role !== 'coach' && req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Coach access required' });
  }

  try {
    const subs = await query(
      `SELECT cs.*, u.name as user_name, u.email as user_email, u.avatar as user_avatar
       FROM coach_subscriptions cs
       LEFT JOIN users u ON cs.user_id = u.id
       WHERE cs.coach_id = ? AND cs.status = 'active' AND (cs.expires_at IS NULL OR cs.expires_at > NOW())
       ORDER BY cs.expires_at ASC, cs.created_at DESC`,
      [req.user.id]
    );
    res.json({ subscriptions: subs });
  } catch {
    res.status(500).json({ message: 'Failed to fetch active subscriptions' });
  }
});

// Coach: accept paid subscription request (credits coach)
router.patch('/coach-subscriptions/:id/coach-accept', authenticateToken, async (req: any, res: Response) => {
  if (req.user?.role !== 'coach' && req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Coach access required' });
  }

  const { id } = req.params;
  try {
    const sub = await get('SELECT * FROM coach_subscriptions WHERE id = ? AND coach_id = ?', [id, req.user.id]) as any;
    if (!sub) return res.status(404).json({ message: 'Subscription request not found' });
    const currentStatus = normalizeCoachSubscriptionStatus(sub.status);
    if (currentStatus !== 'pending_coach') {
      return res.status(400).json({ message: 'This subscription is not waiting for coach decision' });
    }

    const coachCut = await computeCoachCut(Number(sub.amount || 0));

    await run(
      `UPDATE coach_subscriptions
       SET status = ?, coach_decision_status = ?, coach_decided_at = NOW(), started_at = NOW(), credited_amount = ?, credit_released_at = NOW()
       WHERE id = ?`,
      ['active', 'accepted', coachCut, id]
    );
    await run('UPDATE users SET credit = credit + ? WHERE id = ?', [coachCut, sub.coach_id]);
    const payer = await get<any>('SELECT name FROM users WHERE id = ?', [sub.user_id]);
    const payerName = payer?.name || `User ${sub.user_id}`;
    await run(
      'INSERT INTO credit_transactions (user_id, amount, type, reference_id, description) VALUES (?,?,?,?,?)',
      [sub.coach_id, coachCut, 'subscription_income', sub.id, `Subscription accepted from ${payerName} (${sub.plan_cycle} ${sub.plan_type})`]
    );
    await run(
      'INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)',
      [sub.user_id, 'subscription', 'Coach Accepted Your Subscription ✅', 'Your coach accepted your subscription and your plan is now active.', '/app/coaching']
    );
    sendPushFromTemplate(sub.user_id, 'subscription_coach_accepted', {}, '/app/coaching').catch(() => {});

    res.json({ message: `Subscription activated. Coach credited ${coachCut} EGP.` });
  } catch {
    res.status(500).json({ message: 'Failed to accept subscription' });
  }
});

// Coach: decline paid subscription request (refund user)
router.patch('/coach-subscriptions/:id/coach-decline', authenticateToken, async (req: any, res: Response) => {
  if (req.user?.role !== 'coach' && req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Coach access required' });
  }

  const { id } = req.params;
  const { reason } = req.body;
  try {
    const sub = await get('SELECT * FROM coach_subscriptions WHERE id = ? AND coach_id = ?', [id, req.user.id]) as any;
    if (!sub) return res.status(404).json({ message: 'Subscription request not found' });
    const currentStatus = normalizeCoachSubscriptionStatus(sub.status);
    if (currentStatus !== 'pending_coach') {
      return res.status(400).json({ message: 'This subscription is not waiting for coach decision' });
    }

    await run(
      `UPDATE coach_subscriptions
       SET status = ?, coach_decision_status = ?, coach_decided_at = NOW(), refund_status = ?, refund_reason = ?
       WHERE id = ?`,
      ['rejected_by_coach', 'rejected', 'processing', reason || 'Declined by coach', id]
    );

    // Attempt automatic refund via Paymob (fire-and-forget)
    autoRefundSubscription(Number(id))
      .then(async (refunded) => {
        if (!refunded) {
          // Paymob refund not available — notify admin to handle manually
          await run(
            'INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)',
            [sub.user_id, 'refund', 'Subscription Declined — Refund Pending', `The coach declined. Your refund is being processed and will appear soon.${reason ? ' Reason: ' + reason : ''}`, '/app/coaching']
          );
        }
      })
      .catch(() => {});

    await run(
      'INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)',
      [sub.user_id, 'refund', 'Coach Declined Subscription', `Your coach declined the subscription request. If you paid, a refund is being processed automatically.${reason ? ' Reason: ' + reason : ''}`, '/app/coaching']
    );
    sendPushFromTemplate(sub.user_id, 'subscription_coach_declined', {}, '/app/coaching').catch(() => {});

    res.json({ message: 'Subscription declined. Auto-refund initiated.' });
  } catch {
    res.status(500).json({ message: 'Failed to decline subscription' });
  }
});

// User: check if subscribed to a coach
router.get('/coach-subscription-status/:coachId', authenticateToken, async (req: any, res: Response) => {
  try {
    const activeSub = await get(
      `SELECT * FROM coach_subscriptions WHERE user_id = ? AND coach_id = ? AND status = 'active' AND expires_at > NOW() ORDER BY expires_at DESC LIMIT 1`,
      [req.user.id, req.params.coachId]
    ) as any;

    const latestSub = await get(
      `SELECT * FROM coach_subscriptions WHERE user_id = ? AND coach_id = ? ORDER BY created_at DESC LIMIT 1`,
      [req.user.id, req.params.coachId]
    ) as any;

    const latestStatus = normalizeCoachSubscriptionStatus(latestSub?.status);

    res.json({
      subscribed: !!activeSub,
      subscription: activeSub || null,
      latestRequest: latestSub || null,
      latestStatus,
      canRequestNew: !latestSub || !['pending_admin', 'pending_coach', 'pending'].includes(latestStatus),
    });
  } catch {
    res.status(500).json({ message: 'Failed to check subscription' });
  }
});

// User: list my active subscriptions
router.get('/my-subscriptions', authenticateToken, async (req: any, res: Response) => {
  try {
    const subs = await query(
      `SELECT cs.*, c.name as coach_name, c.avatar as coach_avatar, cp.specialty
       FROM coach_subscriptions cs
       LEFT JOIN users c ON cs.coach_id = c.id
       LEFT JOIN coach_profiles cp ON cp.user_id = c.id
       WHERE cs.user_id = ? AND cs.status = 'active' AND (cs.expires_at IS NULL OR cs.expires_at > NOW())
       ORDER BY cs.expires_at DESC`,
      [req.user.id]
    );
    res.json({ subscriptions: subs });
  } catch {
    res.status(500).json({ message: 'Failed to fetch subscriptions' });
  }
});

// User: toggle auto-renew on a subscription
router.patch('/subscriptions/:id/auto-renew', authenticateToken, async (req: any, res: Response) => {
  const { auto_renew } = req.body;
  try {
    const sub: any = await get('SELECT id, user_id FROM coach_subscriptions WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!sub) return res.status(404).json({ message: 'Subscription not found' });
    await run('UPDATE coach_subscriptions SET auto_renew = ? WHERE id = ?', [auto_renew ? 1 : 0, req.params.id]);
    res.json({ message: `Auto-renew ${auto_renew ? 'enabled' : 'disabled'}`, auto_renew: !!auto_renew });
  } catch { res.status(500).json({ message: 'Failed to update auto-renew' }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── COACH CREDIT & WITHDRAWAL SYSTEM ─────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// Coach: get my credit balance
router.get('/my-credit', authenticateToken, async (req: any, res: Response) => {
  try {
    const user = await get('SELECT credit, payment_phone, payment_phone_vodafone, payment_phone_orange, payment_phone_we, payment_wallet_type, payment_method_type, paypal_email, card_holder_name, card_number, instapay_handle FROM users WHERE id = ?', [req.user.id]) as any;
    const transactions = await query(
      `SELECT ct.*, su.name AS payer_name
       FROM credit_transactions ct
       LEFT JOIN coach_subscriptions cs ON cs.id = ct.reference_id
       LEFT JOIN users su ON su.id = cs.user_id
       WHERE ct.user_id = ?
       ORDER BY ct.created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json({
      credit: user?.credit || 0,
      paymentPhone: pickWalletPhone(user),
      paymentPhoneVodafone: user?.payment_phone_vodafone || '',
      paymentPhoneOrange: user?.payment_phone_orange || '',
      paymentPhoneWe: user?.payment_phone_we || '',
      walletType: user?.payment_wallet_type,
      paymentMethodType: user?.payment_method_type || 'ewallet',
      paypalEmail: user?.paypal_email,
      cardHolderName: user?.card_holder_name,
      cardNumber: user?.card_number,
      instapayHandle: user?.instapay_handle,
      transactions
    });
  } catch {
    res.status(500).json({ message: 'Failed to fetch credit' });
  }
});

// User/Coach: get saved payment info
router.get('/payment-info', authenticateToken, async (req: any, res: Response) => {
  try {
    const user = await get(
      'SELECT payment_method_type, payment_phone, payment_phone_vodafone, payment_phone_orange, payment_phone_we, payment_wallet_type, paypal_email, card_holder_name, card_number, instapay_handle FROM users WHERE id = ?',
      [req.user.id]
    ) as any;
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({
      paymentMethodType: user.payment_method_type || 'ewallet',
      paymentPhone:      pickWalletPhone(user) || '',
      paymentPhoneVodafone: user.payment_phone_vodafone || '',
      paymentPhoneOrange: user.payment_phone_orange || '',
      paymentPhoneWe: user.payment_phone_we || '',
      walletType:        user.payment_wallet_type || 'vodafone',
      paypalEmail:       user.paypal_email || '',
      cardHolderName:    user.card_holder_name || '',
      instapayHandle:    user.instapay_handle || '',
    });
  } catch { res.status(500).json({ message: 'Failed to load payment info' }); }
});

// Coach: update payment info
router.post('/payment-info', authenticateToken, async (req: any, res: Response) => {
  const {
    paymentMethodType,
    paymentPhone,
    paymentPhoneVodafone,
    paymentPhoneOrange,
    paymentPhoneWe,
    walletType,
    paypalEmail,
    cardHolderName,
    cardNumber,
    instapayHandle,
  } = req.body;
  const methodType = paymentMethodType || 'ewallet';
  try {
    const wallet = String(walletType || 'vodafone');
    const vodafone = normalizePhone(paymentPhoneVodafone ?? (wallet === 'vodafone' ? paymentPhone : ''));
    const orange = normalizePhone(paymentPhoneOrange ?? (wallet === 'orange' ? paymentPhone : ''));
    const we = normalizePhone(paymentPhoneWe ?? (wallet === 'we' ? paymentPhone : ''));

    if (methodType === 'ewallet') {
      if (vodafone && !isWalletPhoneValid('vodafone', vodafone)) {
        return res.status(400).json({ message: 'Vodafone number must be 11 digits and start with 010.' });
      }
      if (orange && !isWalletPhoneValid('orange', orange)) {
        return res.status(400).json({ message: 'Orange number must be 11 digits and start with 012.' });
      }
      if (we && !isWalletPhoneValid('we', we)) {
        return res.status(400).json({ message: 'WE number must be 11 digits and start with 011.' });
      }

      const selectedPhone = wallet === 'orange' ? orange : wallet === 'we' ? we : vodafone;
      if (!selectedPhone) {
        return res.status(400).json({ message: 'Please provide a phone number for the selected wallet type.' });
      }
    }

    const effectivePhone = wallet === 'orange'
      ? (orange || null)
      : wallet === 'we'
        ? (we || null)
        : (vodafone || null);

    await run(
      'UPDATE users SET payment_method_type = ?, payment_phone = ?, payment_phone_vodafone = ?, payment_phone_orange = ?, payment_phone_we = ?, payment_wallet_type = ?, paypal_email = ?, card_holder_name = ?, card_number = ?, instapay_handle = ? WHERE id = ?',
      [methodType, effectivePhone, vodafone || null, orange || null, we || null, wallet || null, paypalEmail || null, cardHolderName || null, cardNumber || null, instapayHandle || null, req.user.id]
    );
    res.json({ message: 'Payment info updated' });
  } catch {
    res.status(500).json({ message: 'Failed to update payment info' });
  }
});

// Coach: request withdrawal
router.post('/withdraw', authenticateToken, async (req: any, res: Response) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ message: 'Valid amount required' });
  try {
    const user = await get('SELECT credit, payment_phone, payment_phone_vodafone, payment_phone_orange, payment_phone_we, payment_wallet_type, payment_method_type, paypal_email, card_holder_name, card_number, instapay_handle FROM users WHERE id = ?', [req.user.id]) as any;
    if (!user) return res.status(404).json({ message: 'User not found' });
    if ((user.credit || 0) < amount) return res.status(400).json({ message: 'Insufficient credit balance' });

    const methodType = user.payment_method_type || 'ewallet';
    const selectedPhone = pickWalletPhone(user);
    // Validate payment info exists for chosen method
    if (methodType === 'ewallet' && !selectedPhone) return res.status(400).json({ message: 'Please set your e-wallet number first' });
    if (methodType === 'paypal' && !user.paypal_email) return res.status(400).json({ message: 'Please set your PayPal email first' });
    if (methodType === 'credit_card' && !user.card_number) return res.status(400).json({ message: 'Please set your credit card info first' });
    if (methodType === 'instapay' && !user.instapay_handle) return res.status(400).json({ message: 'Please set your InstaPay handle first' });

    await run(
      'INSERT INTO withdrawal_requests (coach_id, amount, payment_phone, wallet_type, payment_method_type, paypal_email, card_holder_name, card_number, instapay_handle) VALUES (?,?,?,?,?,?,?,?,?)',
      [req.user.id, amount, selectedPhone, user.payment_wallet_type, methodType, user.paypal_email, user.card_holder_name, user.card_number, user.instapay_handle]
    );
    // Deduct credit immediately (held until admin processes)
    await run('UPDATE users SET credit = credit - ? WHERE id = ?', [amount, req.user.id]);
    await run(
      'INSERT INTO credit_transactions (user_id, amount, type, description) VALUES (?,?,?,?)',
      [req.user.id, -amount, 'withdrawal_request', `Withdrawal request for ${amount} EGP`]
    );

    res.json({ message: 'Withdrawal request submitted. Admin will process it soon.' });
  } catch (err: any) {
    console.error('Withdraw error:', err);
    res.status(500).json({ message: 'Failed to submit withdrawal' });
  }
});

// Coach: list my withdrawal requests
router.get('/my-withdrawals', authenticateToken, async (req: any, res: Response) => {
  try {
    const withdrawals = await query(
      'SELECT * FROM withdrawal_requests WHERE coach_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ withdrawals });
  } catch {
    res.status(500).json({ message: 'Failed to fetch withdrawals' });
  }
});

// Admin: list withdrawal requests
router.get('/withdrawals', authenticateToken, async (req: any, res: Response) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const withdrawals = await query(
      `SELECT wr.*, u.name as coach_name, u.email as coach_email
       FROM withdrawal_requests wr
       LEFT JOIN users u ON wr.coach_id = u.id
       ORDER BY wr.created_at DESC`
    );
    res.json({ withdrawals });
  } catch {
    res.status(500).json({ message: 'Failed to fetch withdrawals' });
  }
});

// Admin: approve withdrawal
router.patch('/withdrawals/:id/approve', authenticateToken, async (req: any, res: Response) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const wr = await get('SELECT * FROM withdrawal_requests WHERE id = ?', [req.params.id]) as any;
    if (!wr) return res.status(404).json({ message: 'Request not found' });
    if (wr.status !== 'pending') return res.status(400).json({ message: `Cannot approve — status is already '${wr.status}'` });

    const { note } = req.body;
    await run('UPDATE withdrawal_requests SET status = ?, admin_note = ?, processed_at = NOW() WHERE id = ? AND status = ?',
      ['approved', note || '', req.params.id, 'pending']);
    await run(
      'INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)',
      [wr.coach_id, 'withdrawal', 'Withdrawal Approved! ✅',
       `Your withdrawal of ${wr.amount} EGP has been approved.${note ? ' Note: ' + note : ''}`, '/coach/profile']
    );
    sendPushToUser(wr.coach_id, 'Withdrawal Approved! ✅', `Your withdrawal of ${wr.amount} EGP has been approved.${note ? ' Note: ' + note : ''}`, undefined, '/coach/profile', 'withdrawal_approved').catch(() => {});
    await run(
      'INSERT INTO credit_transactions (user_id, amount, type, description) VALUES (?,?,?,?)',
      [wr.coach_id, -wr.amount, 'withdrawal_approved', `Withdrawal of ${wr.amount} EGP approved by admin`]
    );
    res.json({ message: 'Withdrawal approved' });
  } catch {
    res.status(500).json({ message: 'Failed to approve withdrawal' });
  }
});

// Admin: reject withdrawal (refund credit)
router.patch('/withdrawals/:id/reject', authenticateToken, async (req: any, res: Response) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  const { note } = req.body;
  try {
    const wr = await get('SELECT * FROM withdrawal_requests WHERE id = ?', [req.params.id]) as any;
    if (!wr) return res.status(404).json({ message: 'Request not found' });
    if (wr.status !== 'pending') return res.status(400).json({ message: `Cannot reject — status is already '${wr.status}'` });

    await run('UPDATE withdrawal_requests SET status = ?, admin_note = ?, processed_at = NOW() WHERE id = ? AND status = ?',
      ['rejected', note || '', req.params.id, 'pending']);
    // Refund credit
    await run('UPDATE users SET credit = credit + ? WHERE id = ?', [wr.amount, wr.coach_id]);
    await run(
      'INSERT INTO credit_transactions (user_id, amount, type, description) VALUES (?,?,?,?)',
      [wr.coach_id, wr.amount, 'withdrawal_refund', `Withdrawal rejected: ${note || 'No reason given'}`]
    );
    await run(
      'INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)',
      [wr.coach_id, 'withdrawal', 'Withdrawal Declined', `Your withdrawal of ${wr.amount} EGP was declined. Credit has been refunded. ${note ? 'Reason: ' + note : ''}`, '/coach/profile']
    );
    sendPushToUser(wr.coach_id, 'Withdrawal Declined', `Your withdrawal of ${wr.amount} EGP was declined. Credit has been refunded. ${note ? 'Reason: ' + note : ''}`, undefined, '/coach/profile', 'withdrawal_rejected').catch(() => {});
    res.json({ message: 'Withdrawal rejected, credit refunded' });
  } catch {
    res.status(500).json({ message: 'Failed to reject withdrawal' });
  }
});

export default router;
