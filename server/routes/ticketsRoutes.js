/**
 * Tickets / Forms routes (JS twin of ticketsRoutes.ts — built without tsc so
 * we ship a runnable copy alongside the source). Keep the two in sync when
 * editing either.
 */
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { get, run, query } from '../config/database.js';

const router = Router();

async function notify(userId, type, title, body, link) {
    try {
        await run('INSERT INTO notifications (user_id, type, title, message, link, created_at) VALUES (?, ?, ?, ?, ?, NOW())', [userId, type, title, body, link]);
    } catch { }
}
async function canSeeTicket(req, ticket) {
    const u = req.user;
    if (!u || !ticket) return false;
    if (u.role === 'admin') return true;
    return ticket.user_id === u.id || ticket.coach_id === u.id;
}

router.get('/', authenticateToken, async (req, res) => {
    try {
        const u = req.user;
        const isCoach = u.role === 'coach';
        const rows = await query(`SELECT t.*, u.name AS user_name, u.avatar AS user_avatar,
                  c.name AS coach_name, c.avatar AS coach_avatar
           FROM tickets t
           LEFT JOIN users u ON u.id = t.user_id
           LEFT JOIN users c ON c.id = t.coach_id
           WHERE ${isCoach ? 't.coach_id = ?' : 't.user_id = ?'}
           ORDER BY t.updated_at DESC, t.id DESC LIMIT 200`, [u.id]);
        res.json({ tickets: rows });
    } catch (err) { res.status(500).json({ message: err?.message || 'Failed to list tickets' }); }
});

router.post('/', authenticateToken, async (req, res) => {
    try {
        const u = req.user;
        const { coach_id, subject, body, kind, workout_plan_id, nutrition_plan_id, exercise_key } = req.body || {};
        if (!coach_id || !subject) return res.status(400).json({ message: 'coach_id and subject are required' });
        const result = await run(`INSERT INTO tickets (user_id, coach_id, kind, subject, body, status, workout_plan_id, nutrition_plan_id, exercise_key, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, NOW(), NOW())`,
            [u.id, coach_id, kind || 'general', subject, body || '', workout_plan_id || null, nutrition_plan_id || null, exercise_key || null]);
        const ticketId = result.insertId || result.lastID;
        await notify(coach_id, 'ticket_opened', 'New ticket', `${u.name || 'An athlete'} opened "${subject}"`, `/coach/tickets/${ticketId}`);
        const ticket = await get('SELECT * FROM tickets WHERE id = ?', [ticketId]);
        res.json({ ticket });
    } catch (err) { res.status(500).json({ message: err?.message || 'Failed to open ticket' }); }
});

router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const ticket = await get(`SELECT t.*, u.name AS user_name, u.avatar AS user_avatar,
                  c.name AS coach_name, c.avatar AS coach_avatar
           FROM tickets t
           LEFT JOIN users u ON u.id = t.user_id
           LEFT JOIN users c ON c.id = t.coach_id
           WHERE t.id = ?`, [req.params.id]);
        if (!ticket) return res.status(404).json({ message: 'Not found' });
        if (!(await canSeeTicket(req, ticket))) return res.status(403).json({ message: 'Forbidden' });
        const replies = await query(`SELECT r.*, u.name AS author_name, u.avatar AS author_avatar
           FROM ticket_replies r LEFT JOIN users u ON u.id = r.author_id
           WHERE r.ticket_id = ? ORDER BY r.id ASC`, [ticket.id]);
        res.json({ ticket, replies });
    } catch (err) { res.status(500).json({ message: err?.message || 'Failed to load ticket' }); }
});

router.post('/:id/reply', authenticateToken, async (req, res) => {
    try {
        const u = req.user;
        const ticket = await get('SELECT * FROM tickets WHERE id = ?', [req.params.id]);
        if (!ticket) return res.status(404).json({ message: 'Not found' });
        if (!(await canSeeTicket(req, ticket))) return res.status(403).json({ message: 'Forbidden' });
        const { body } = req.body || {};
        if (!body) return res.status(400).json({ message: 'body required' });
        await run('INSERT INTO ticket_replies (ticket_id, author_id, author_role, body, created_at) VALUES (?, ?, ?, ?, NOW())', [ticket.id, u.id, u.role, body]);
        await run('UPDATE tickets SET updated_at = NOW(), status = IF(status = "closed", "open", status) WHERE id = ?', [ticket.id]);
        const other = u.id === ticket.user_id ? ticket.coach_id : ticket.user_id;
        if (other) await notify(other, 'ticket_reply', 'New reply on ticket', `${u.name || 'Someone'} replied on "${ticket.subject}"`, `/app/tickets/${ticket.id}`);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ message: err?.message || 'Failed to reply' }); }
});

router.patch('/:id/status', authenticateToken, async (req, res) => {
    try {
        const ticket = await get('SELECT * FROM tickets WHERE id = ?', [req.params.id]);
        if (!ticket) return res.status(404).json({ message: 'Not found' });
        if (!(await canSeeTicket(req, ticket))) return res.status(403).json({ message: 'Forbidden' });
        const { status } = req.body || {};
        if (!['open', 'resolved', 'closed'].includes(status)) return res.status(400).json({ message: 'invalid status' });
        await run('UPDATE tickets SET status = ?, updated_at = NOW() WHERE id = ?', [status, ticket.id]);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ message: err?.message || 'Failed to update status' }); }
});

router.get('/plan-comments/list', authenticateToken, async (req, res) => {
    try {
        const { workout_plan_id, nutrition_plan_id } = req.query;
        const where = [];
        const params = [];
        if (workout_plan_id) { where.push('workout_plan_id = ?'); params.push(Number(workout_plan_id)); }
        if (nutrition_plan_id) { where.push('nutrition_plan_id = ?'); params.push(Number(nutrition_plan_id)); }
        if (where.length === 0) return res.json({ comments: [] });
        const rows = await query(`SELECT c.*, u.name AS author_name, u.avatar AS author_avatar
           FROM plan_comments c LEFT JOIN users u ON u.id = c.author_id
           WHERE ${where.join(' AND ')} ORDER BY c.id ASC LIMIT 500`, params);
        res.json({ comments: rows });
    } catch (err) { res.status(500).json({ message: err?.message || 'Failed to list comments' }); }
});

router.post('/plan-comments', authenticateToken, async (req, res) => {
    try {
        const u = req.user;
        const { workout_plan_id, nutrition_plan_id, exercise_key, meal_key, body, parent_id } = req.body || {};
        if (!body) return res.status(400).json({ message: 'body required' });
        if (!workout_plan_id && !nutrition_plan_id) return res.status(400).json({ message: 'plan id required' });
        const result = await run(`INSERT INTO plan_comments (workout_plan_id, nutrition_plan_id, exercise_key, meal_key, author_id, author_role, body, status, parent_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, NOW(), NOW())`,
            [workout_plan_id || null, nutrition_plan_id || null, exercise_key || null, meal_key || null, u.id, u.role, body, parent_id || null]);
        const id = result.insertId || result.lastID;
        res.json({ comment: { id } });
    } catch (err) { res.status(500).json({ message: err?.message || 'Failed to add comment' }); }
});

router.patch('/plan-comments/:id', authenticateToken, async (req, res) => {
    try {
        const { status, body } = req.body || {};
        if (status && !['open', 'resolved'].includes(status)) return res.status(400).json({ message: 'invalid status' });
        const fields = [];
        const vals = [];
        if (status !== undefined) { fields.push('status = ?'); vals.push(status); }
        if (body !== undefined) { fields.push('body = ?'); vals.push(body); }
        if (!fields.length) return res.status(400).json({ message: 'nothing to update' });
        vals.push(req.params.id);
        await run(`UPDATE plan_comments SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`, vals);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ message: err?.message || 'Failed to update' }); }
});

router.delete('/plan-comments/:id', authenticateToken, async (req, res) => {
    try {
        const u = req.user;
        const row = await get('SELECT author_id FROM plan_comments WHERE id = ?', [req.params.id]);
        if (!row) return res.status(404).json({ message: 'Not found' });
        if (row.author_id !== u.id && u.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
        await run('DELETE FROM plan_comments WHERE id = ?', [req.params.id]);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ message: err?.message || 'Failed to delete' }); }
});

router.post('/training-events', authenticateToken, async (req, res) => {
    try {
        const u = req.user;
        const { event_type, workout_plan_id, payload } = req.body || {};
        if (!event_type) return res.status(400).json({ message: 'event_type required' });
        let coachId = null;
        if (workout_plan_id) {
            const row = await get('SELECT coach_id FROM workout_plans WHERE id = ?', [workout_plan_id]);
            coachId = row?.coach_id || null;
        }
        await run(`INSERT INTO training_events (user_id, coach_id, workout_plan_id, event_type, payload, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
            [u.id, coachId, workout_plan_id || null, event_type, payload ? JSON.stringify(payload) : null]);
        if (coachId) {
            const titles = {
                workout_started: 'Athlete started training',
                workout_finished: 'Athlete finished a workout',
                plan_finished: 'Athlete finished their plan 🎉',
            };
            const title = titles[event_type] || 'Training update';
            const body = `${u.name || 'Your athlete'} — ${title.toLowerCase()}.`;
            await notify(coachId, event_type, title, body, `/coach/athletes/${u.id}`);
        }
        // Plan-finish credit: admin-controlled amount, de-duped per plan.
        if (event_type === 'plan_finished' && workout_plan_id) {
            const prior = await get(`SELECT id FROM credit_transactions WHERE user_id = ? AND type = 'plan_finish_bonus' AND reference_id = ? LIMIT 1`,
                [u.id, workout_plan_id]).catch(() => null);
            if (!prior) {
                const setting = await get(`SELECT setting_value FROM app_settings WHERE setting_key = 'plan_finish_credit'`).catch(() => null);
                const amount = Number(setting?.setting_value) || 50;
                try {
                    await run('UPDATE users SET credit = COALESCE(credit, 0) + ? WHERE id = ?', [amount, u.id]);
                    await run(`INSERT INTO credit_transactions (user_id, amount, type, reference_id, description, created_at)
                       VALUES (?, ?, 'plan_finish_bonus', ?, ?, NOW())`,
                        [u.id, amount, workout_plan_id, `Bonus for finishing plan #${workout_plan_id}`]);
                    await notify(u.id, 'credit_awarded', 'You earned credit 🎁', `Nice work — ${amount} EGP added to your wallet for finishing your plan.`, '/app/profile');
                } catch { }
            }
        }
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ message: err?.message || 'Failed to log training event' }); }
});

router.get('/training-events', authenticateToken, async (req, res) => {
    try {
        const u = req.user;
        const { user_id } = req.query;
        const params = [];
        let where;
        if (u.role === 'coach') {
            where = 'coach_id = ?';
            params.push(u.id);
            if (user_id) { where += ' AND user_id = ?'; params.push(Number(user_id)); }
        } else {
            where = 'user_id = ?'; params.push(u.id);
        }
        const rows = await query(`SELECT e.*, u.name AS user_name, u.avatar AS user_avatar
           FROM training_events e LEFT JOIN users u ON u.id = e.user_id
           WHERE ${where} ORDER BY e.id DESC LIMIT 100`, params);
        res.json({ events: rows });
    } catch (err) { res.status(500).json({ message: err?.message || 'Failed to load events' }); }
});

router.get('/recent-activity', authenticateToken, async (req, res) => {
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
        const merged = [...posts, ...tickets, ...comments, ...events]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 40);
        res.json({ activity: merged });
    } catch (err) { res.status(500).json({ message: err?.message || 'Failed to load activity' }); }
});

export default router;
