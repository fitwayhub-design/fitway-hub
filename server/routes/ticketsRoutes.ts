/**
 * Tickets / Forms routes
 * ─────────────────────────────────────────────────────────
 * Replaces the direct-chat between athlete and coach per the May meeting.
 * Athletes file a ticket attached to a workout plan / nutrition plan /
 * specific exercise, the coach gets a notification, replies, and either
 * resolves it or closes it. Both sides can read their own tickets.
 *
 * Also exposes plan-comments and training-events endpoints because they
 * share the same access pattern (coach ↔ athlete on a plan item).
 */
import { Router, Response } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { get, run, query } from '../config/database.js';
import { containsContactInfo, CONTACT_INFO_MESSAGE } from '../utils/contentGuard.js';
import { moderatorCanAccessArea } from '../middleware/moderator.js';

const router = Router();

// General support tickets (athlete → platform staff) use coach_id = 0 as a
// sentinel meaning "no coach — handled by admins/moderators". The tickets table
// has no FK on coach_id, so this needs no schema change.
const SUPPORT_COACH_ID = 0;
const isSupportTicket = (t: any) => Number(t?.coach_id) === SUPPORT_COACH_ID || t?.kind === 'support';

// ── helpers ────────────────────────────────────────────────────────────────
async function notify(userId: number, type: string, title: string, body: string, link: string | null) {
  try {
    await run(
      'INSERT INTO notifications (user_id, type, title, message, link, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [userId, type, title, body, link]
    );
  } catch { /* notifications table optional in some deployments */ }
}

// Notify every admin (and moderator) about a support-ticket event.
async function notifySupportStaff(type: string, title: string, body: string, link: string | null) {
  try {
    const staff: any[] = await query("SELECT id FROM users WHERE role IN ('admin','moderator')");
    for (const s of staff) await notify(s.id, type, title, body, link);
  } catch { /* best-effort */ }
}

async function canSeeTicket(req: any, ticket: any): Promise<boolean> {
  const u = req.user;
  if (!u || !ticket) return false;
  if (u.role === 'admin') return true;
  // Support tickets: the athlete who opened it, or staff with tickets access
  // (admins, or moderators whose effective per-account/global perms grant it).
  if (isSupportTicket(ticket)) {
    if (ticket.user_id === u.id) return true;
    return await moderatorCanAccessArea(u, 'tickets_view');
  }
  return ticket.user_id === u.id || ticket.coach_id === u.id;
}

// ── Tickets ────────────────────────────────────────────────────────────────

// Admin: every ticket in the system. Mounted under /api/tickets so it
// shares the canSeeTicket / status / reply endpoints below (admins pass the
// role check). Keeps everything in one router rather than scattering into
// adminRoutes.
router.get('/admin/all', authenticateToken, async (req: any, res: Response) => {
  const role = req.user?.role;
  const isAdmin = role === 'admin';
  // Admins see every ticket; a moderator with the `tickets_view` area (per their
  // effective per-account/global perms) sees only general support tickets.
  if (!isAdmin && !(await moderatorCanAccessArea(req.user, 'tickets_view'))) return res.status(403).json({ message: 'Forbidden' });
  try {
    const rows = await query(
      `SELECT t.*, u.name AS user_name, u.avatar AS user_avatar,
              c.name AS coach_name, c.avatar AS coach_avatar
       FROM tickets t
       LEFT JOIN users u ON u.id = t.user_id
       LEFT JOIN users c ON c.id = t.coach_id
       ${isAdmin ? '' : 'WHERE t.coach_id = 0'}
       ORDER BY t.updated_at DESC, t.id DESC
       LIMIT 500`,
      []
    );
    res.json({ tickets: rows });
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to list tickets' });
  }
});

// List my tickets (athlete) or tickets sent to me (coach).
router.get('/', authenticateToken, async (req: any, res: Response) => {
  try {
    const u = req.user;
    const isCoach = u.role === 'coach';
    const rows = await query(
      `SELECT t.*, u.name AS user_name, u.avatar AS user_avatar,
              c.name AS coach_name, c.avatar AS coach_avatar
       FROM tickets t
       LEFT JOIN users u ON u.id = t.user_id
       LEFT JOIN users c ON c.id = t.coach_id
       WHERE ${isCoach ? 't.coach_id = ?' : 't.user_id = ?'}
       ORDER BY t.updated_at DESC, t.id DESC
       LIMIT 200`,
      [u.id]
    );
    res.json({ tickets: rows });
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to list tickets' });
  }
});

// Open a new ticket (athlete → coach).
// Enforced rules:
//   • Athlete must have an active subscription to the coach they're filing
//     against (no random coach DMs anymore).
//   • Ticket must reference a workout in the coach's plan (workout_plan_id
//     + exercise_key required) — tickets are workout-specific per meeting.
//   • Counted against the athlete's package's monthly allowance
//     (ticket_limit_<package_id>; 0 = unlimited for paid tiers,
//     0 = none for the freemium tier — see settings).
router.post('/', authenticateToken, async (req: any, res: Response) => {
  try {
    const u = req.user;
    const { coach_id, subject, body, kind, workout_plan_id, nutrition_plan_id, exercise_key, meal_key } = req.body || {};
    if (!coach_id || !subject) return res.status(400).json({ message: 'coach_id and subject are required' });
    if (containsContactInfo(subject) || containsContactInfo(body)) return res.status(400).json({ message: CONTACT_INFO_MESSAGE });
    const isWorkout = !!workout_plan_id && !!exercise_key;
    const isNutrition = !!nutrition_plan_id && !!meal_key;
    if (!isWorkout && !isNutrition) {
      return res.status(400).json({ message: 'Pick a workout (day + exercise) or a nutrition meal from your coach plan.' });
    }
    // We stash the meal_key in exercise_key for nutrition tickets so we don't
    // need a schema change — the column is just a free-form item identifier.
    const itemKey = isWorkout ? exercise_key : meal_key;

    // Subscription gate
    const sub: any = await get(
      `SELECT * FROM coach_subscriptions
       WHERE user_id = ? AND coach_id = ? AND status = 'active'
       ORDER BY id DESC LIMIT 1`,
      [u.id, coach_id]
    );
    if (!sub) return res.status(403).json({ message: 'You can only file tickets to a coach you are subscribed to.' });

    // Package allowance
    const packageId: string = sub.package_id || 'basic';
    const settingKey = `ticket_limit_${packageId}`;
    const limitRow: any = await get(`SELECT setting_value FROM app_settings WHERE setting_key = ?`, [settingKey]).catch(() => null);
    const limit = Number(limitRow?.setting_value) || 0;
    if (limit > 0) {
      // Tickets used this calendar month for this subscription
      const usedRow: any = await get(
        `SELECT COUNT(*) AS used FROM tickets
         WHERE user_id = ? AND coach_id = ?
         AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')`,
        [u.id, coach_id]
      );
      const used = Number(usedRow?.used) || 0;
      if (used >= limit) {
        return res.status(429).json({ message: `Monthly ticket allowance reached (${limit}). Upgrade your package for more tickets.`, limit, used });
      }
    } else if (packageId === 'community_freemium' || packageId === 'freemium') {
      // Explicit zero on the freemium tier = no tickets at all
      return res.status(403).json({ message: 'Tickets are not included in the Freemium package. Upgrade to file tickets to your coach.' });
    }

    const result: any = await run(
      `INSERT INTO tickets (user_id, coach_id, kind, subject, body, status, workout_plan_id, nutrition_plan_id, exercise_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, NOW(), NOW())`,
      [u.id, coach_id, kind || (isWorkout ? 'workout_question' : 'nutrition_question'), subject, body || '', workout_plan_id || null, nutrition_plan_id || null, itemKey || null]
    );
    const ticketId = result.insertId || result.lastID;
    try { await run('UPDATE coach_subscriptions SET tickets_used = COALESCE(tickets_used,0) + 1 WHERE id = ?', [sub.id]); } catch {}
    await notify(coach_id, 'ticket_opened', 'New ticket', `${u.name || 'An athlete'} opened "${subject}"`, `/coach/tickets/${ticketId}`);
    const ticket = await get('SELECT * FROM tickets WHERE id = ?', [ticketId]);
    res.json({ ticket });
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to open ticket' });
  }
});

// Open a GENERAL SUPPORT ticket (athlete → platform staff, no coach). §2.3.
// Available to subscribed athletes for account/billing/general questions that
// aren't tied to a coach plan. Routed to admins + moderators (tickets area),
// not a coach. Uses coach_id = 0 as the "no coach" sentinel.
router.post('/support', authenticateToken, async (req: any, res: Response) => {
  try {
    const u = req.user;
    const { subject, body } = req.body || {};
    if (!subject || !String(subject).trim()) return res.status(400).json({ message: 'A subject is required.' });
    if (containsContactInfo(subject) || containsContactInfo(body)) return res.status(400).json({ message: CONTACT_INFO_MESSAGE });

    // Scoped to subscribed athletes (any active subscription).
    const sub: any = await get(
      "SELECT id FROM coach_subscriptions WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1",
      [u.id]
    );
    if (!sub) return res.status(403).json({ message: 'General support is available to subscribed athletes. Subscribe to a coach to open a support request.' });

    const result: any = await run(
      `INSERT INTO tickets (user_id, coach_id, kind, subject, body, status, created_at, updated_at)
       VALUES (?, ?, 'support', ?, ?, 'open', NOW(), NOW())`,
      [u.id, SUPPORT_COACH_ID, String(subject).trim(), body ? String(body) : '']
    );
    const ticketId = result.insertId || result.lastID;
    await notifySupportStaff('ticket_opened', 'New support request', `${u.name || 'An athlete'} opened "${subject}"`, `/admin/tickets`);
    const ticket = await get('SELECT * FROM tickets WHERE id = ?', [ticketId]);
    res.json({ ticket });
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to open support ticket' });
  }
});

// Get one ticket with all replies.
router.get('/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const ticket: any = await get(
      `SELECT t.*, u.name AS user_name, u.avatar AS user_avatar,
              c.name AS coach_name, c.avatar AS coach_avatar
       FROM tickets t
       LEFT JOIN users u ON u.id = t.user_id
       LEFT JOIN users c ON c.id = t.coach_id
       WHERE t.id = ?`,
      [req.params.id]
    );
    if (!ticket) return res.status(404).json({ message: 'Not found' });
    if (!(await canSeeTicket(req, ticket))) return res.status(403).json({ message: 'Forbidden' });
    const replies = await query(
      `SELECT r.*, u.name AS author_name, u.avatar AS author_avatar
       FROM ticket_replies r LEFT JOIN users u ON u.id = r.author_id
       WHERE r.ticket_id = ? ORDER BY r.id ASC`,
      [ticket.id]
    );
    res.json({ ticket, replies });
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to load ticket' });
  }
});

// Reply on a ticket (either side).
router.post('/:id/reply', authenticateToken, async (req: any, res: Response) => {
  try {
    const u = req.user;
    const ticket: any = await get('SELECT * FROM tickets WHERE id = ?', [req.params.id]);
    if (!ticket) return res.status(404).json({ message: 'Not found' });
    if (!(await canSeeTicket(req, ticket))) return res.status(403).json({ message: 'Forbidden' });
    const { body } = req.body || {};
    if (!body) return res.status(400).json({ message: 'body required' });
    if (containsContactInfo(body)) return res.status(400).json({ message: CONTACT_INFO_MESSAGE });
    await run(
      'INSERT INTO ticket_replies (ticket_id, author_id, author_role, body, created_at) VALUES (?, ?, ?, ?, NOW())',
      [ticket.id, u.id, u.role, body]
    );
    await run('UPDATE tickets SET updated_at = NOW(), status = IF(status = "closed", "open", status) WHERE id = ?', [ticket.id]);
    if (isSupportTicket(ticket)) {
      // No coach: route the notification between the athlete and the staff pool.
      if (u.id === ticket.user_id) {
        await notifySupportStaff('ticket_reply', 'New reply on support ticket', `${u.name || 'Someone'} replied on "${ticket.subject}"`, `/admin/tickets`);
      } else {
        await notify(ticket.user_id, 'ticket_reply', 'New reply on ticket', `${u.name || 'Support'} replied on "${ticket.subject}"`, `/app/tickets/${ticket.id}`);
      }
    } else {
      const other = u.id === ticket.user_id ? ticket.coach_id : ticket.user_id;
      if (other) await notify(other, 'ticket_reply', 'New reply on ticket', `${u.name || 'Someone'} replied on "${ticket.subject}"`, `/app/tickets/${ticket.id}`);
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to reply' });
  }
});

// Change status (coach can resolve/close; either can reopen).
router.patch('/:id/status', authenticateToken, async (req: any, res: Response) => {
  try {
    const ticket: any = await get('SELECT * FROM tickets WHERE id = ?', [req.params.id]);
    if (!ticket) return res.status(404).json({ message: 'Not found' });
    if (!(await canSeeTicket(req, ticket))) return res.status(403).json({ message: 'Forbidden' });
    const { status } = req.body || {};
    if (!['open', 'resolved', 'closed'].includes(status)) return res.status(400).json({ message: 'invalid status' });
    await run('UPDATE tickets SET status = ?, updated_at = NOW() WHERE id = ?', [status, ticket.id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to update status' });
  }
});

// ── Plan comments (Asana-style) ────────────────────────────────────────────
// GET /plan-comments?workout_plan_id=... or ?nutrition_plan_id=...
router.get('/plan-comments/list', authenticateToken, async (req: any, res: Response) => {
  try {
    const { workout_plan_id, nutrition_plan_id } = req.query;
    const where: string[] = [];
    const params: any[] = [];
    if (workout_plan_id)   { where.push('workout_plan_id = ?');   params.push(Number(workout_plan_id)); }
    if (nutrition_plan_id) { where.push('nutrition_plan_id = ?'); params.push(Number(nutrition_plan_id)); }
    if (where.length === 0) return res.json({ comments: [] });
    const rows = await query(
      `SELECT c.*, u.name AS author_name, u.avatar AS author_avatar
       FROM plan_comments c LEFT JOIN users u ON u.id = c.author_id
       WHERE ${where.join(' AND ')}
       ORDER BY c.id ASC LIMIT 500`,
      params
    );
    res.json({ comments: rows });
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to list comments' });
  }
});

router.post('/plan-comments', authenticateToken, async (req: any, res: Response) => {
  try {
    const u = req.user;
    const { workout_plan_id, nutrition_plan_id, exercise_key, meal_key, body, parent_id } = req.body || {};
    if (!body) return res.status(400).json({ message: 'body required' });
    if (containsContactInfo(body)) return res.status(400).json({ message: CONTACT_INFO_MESSAGE });
    if (!workout_plan_id && !nutrition_plan_id) return res.status(400).json({ message: 'plan id required' });
    const result: any = await run(
      `INSERT INTO plan_comments (workout_plan_id, nutrition_plan_id, exercise_key, meal_key, author_id, author_role, body, status, parent_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, NOW(), NOW())`,
      [workout_plan_id || null, nutrition_plan_id || null, exercise_key || null, meal_key || null, u.id, u.role, body, parent_id || null]
    );
    const id = result.insertId || result.lastID;
    res.json({ comment: { id } });
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to add comment' });
  }
});

router.patch('/plan-comments/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const { status, body } = req.body || {};
    if (status && !['open', 'resolved'].includes(status)) return res.status(400).json({ message: 'invalid status' });
    const fields: string[] = [];
    const vals: any[] = [];
    if (status !== undefined) { fields.push('status = ?'); vals.push(status); }
    if (body   !== undefined) { fields.push('body = ?');   vals.push(body); }
    if (!fields.length) return res.status(400).json({ message: 'nothing to update' });
    vals.push(req.params.id);
    await run(`UPDATE plan_comments SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`, vals);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to update' });
  }
});

router.delete('/plan-comments/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const u = req.user;
    const row: any = await get('SELECT author_id FROM plan_comments WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ message: 'Not found' });
    if (row.author_id !== u.id && u.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    await run('DELETE FROM plan_comments WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to delete' });
  }
});

// ── Training events (start / finish workout / finish plan) ─────────────────
router.post('/training-events', authenticateToken, async (req: any, res: Response) => {
  try {
    const u = req.user;
    const { event_type, workout_plan_id, payload } = req.body || {};
    if (!event_type) return res.status(400).json({ message: 'event_type required' });
    // Look up the assigned coach so coach feed + notifications work even when
    // the client doesn't pass coach_id explicitly.
    let coachId: number | null = null;
    if (workout_plan_id) {
      const row: any = await get('SELECT coach_id FROM workout_plans WHERE id = ?', [workout_plan_id]);
      coachId = row?.coach_id || null;
    }
    await run(
      `INSERT INTO training_events (user_id, coach_id, workout_plan_id, event_type, payload, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [u.id, coachId, workout_plan_id || null, event_type, payload ? JSON.stringify(payload) : null]
    );
    if (coachId) {
      const titles: Record<string, string> = {
        workout_started:  'Athlete started training',
        workout_finished: 'Athlete finished a workout',
        plan_finished:    'Athlete finished their plan 🎉',
      };
      const title = titles[event_type] || 'Training update';
      // Surface how far through their plan the athlete is, so the coach can see
      // progress at a glance in the notification itself.
      const rawPct = payload && typeof payload.progress_percent === 'number' ? payload.progress_percent : null;
      const pct = rawPct === null ? null : Math.max(0, Math.min(100, Math.round(rawPct)));
      let body = `${u.name || 'Your athlete'} — ${title.toLowerCase()}.`;
      if (pct !== null) body += ` Plan progress: ${pct}% complete.`;
      await notify(coachId, event_type, title, body, `/coach/athletes/${u.id}`);
    }

    // Award completion credit when a plan is finished. Reward amount is
    // admin-controlled via app_settings.plan_finish_credit (default 50 EGP),
    // and we de-dupe per workout_plan_id so a user can't claim it twice.
    if (event_type === 'plan_finished' && workout_plan_id) {
      const prior: any = await get(
        `SELECT id FROM credit_transactions WHERE user_id = ? AND type = 'plan_finish_bonus' AND reference_id = ? LIMIT 1`,
        [u.id, workout_plan_id]
      ).catch(() => null);
      if (!prior) {
        const setting: any = await get(`SELECT setting_value FROM app_settings WHERE setting_key = 'plan_finish_credit'`).catch(() => null);
        const amount = Number(setting?.setting_value) || 50;
        try {
          await run('UPDATE users SET credit = COALESCE(credit, 0) + ? WHERE id = ?', [amount, u.id]);
          await run(
            `INSERT INTO credit_transactions (user_id, amount, type, reference_id, description, created_at)
             VALUES (?, ?, 'plan_finish_bonus', ?, ?, NOW())`,
            [u.id, amount, workout_plan_id, `Bonus for finishing plan #${workout_plan_id}`]
          );
          await notify(u.id, 'credit_awarded', 'You earned credit 🎁', `Nice work — ${amount} EGP added to your wallet for finishing your plan.`, '/app/profile');
        } catch { /* credit table may not exist yet on fresh installs */ }
      }
    }

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to log training event' });
  }
});

// Coach feed of recent events for one athlete (or all their athletes).
router.get('/training-events', authenticateToken, async (req: any, res: Response) => {
  try {
    const u = req.user;
    const { user_id } = req.query;
    const params: any[] = [];
    let where: string;
    if (u.role === 'coach') {
      where = 'coach_id = ?';
      params.push(u.id);
      if (user_id) { where += ' AND user_id = ?'; params.push(Number(user_id)); }
    } else {
      where = 'user_id = ?'; params.push(u.id);
    }
    const rows = await query(
      `SELECT e.*, u.name AS user_name, u.avatar AS user_avatar
       FROM training_events e LEFT JOIN users u ON u.id = e.user_id
       WHERE ${where} ORDER BY e.id DESC LIMIT 100`,
      params
    );
    res.json({ events: rows });
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to load events' });
  }
});

// ── Profile "Recent activity" feed ─────────────────────────────────────────
// Combines posts, tickets, plan-comments, and training events into one
// reverse-chronological feed for either the logged-in user or another user
// (admins/coaches can request another id; everyone else only their own).
router.get('/recent-activity', authenticateToken, async (req: any, res: Response) => {
  try {
    const u = req.user;
    const target = Number(req.query.user_id) || u.id;
    if (target !== u.id && u.role !== 'admin' && u.role !== 'coach') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const [posts, tickets, comments, events] = await Promise.all([
      query("SELECT 'post' AS kind, id, content AS title, created_at FROM posts WHERE user_id = ? ORDER BY id DESC LIMIT 20", [target]),
      query("SELECT 'ticket' AS kind, id, subject AS title, created_at FROM tickets WHERE user_id = ? ORDER BY id DESC LIMIT 20", [target]),
      query("SELECT 'comment' AS kind, id, body AS title, created_at FROM plan_comments WHERE author_id = ? ORDER BY id DESC LIMIT 20", [target]),
      query("SELECT 'training' AS kind, id, event_type AS title, created_at FROM training_events WHERE user_id = ? ORDER BY id DESC LIMIT 20", [target]),
    ]);
    const merged = [...(posts as any[]), ...(tickets as any[]), ...(comments as any[]), ...(events as any[])]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 40);
    res.json({ activity: merged });
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to load activity' });
  }
});

export default router;
