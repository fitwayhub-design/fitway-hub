import { createHash, randomBytes } from 'crypto';
import { query, get, run } from '../config/database.js';
import { uploadToR2 } from '../middleware/upload.js';
import { createInAppNotification, sendPushFromTemplate } from '../notificationService.js';
import { containsContactInfo, CONTACT_INFO_MESSAGE } from '../utils/contentGuard.js';
import { METHODS, METRICS, isMethodAllowed, clampMetric, basePointsForSubmission, recomputeParticipant, recomputeAll, aliasForParticipant, } from '../services/challengeScoring.js';
import { GOAL_TYPES, GOAL_TYPE_KEYS, isGoalType, methodsForGoals, clampGoalTarget, defaultGoalTitle, computeGoalProgress, GOAL_COMPLETION_TARGET, } from '../services/challengeGoalTypes.js';
import { finalizeChallengeById } from '../services/challengeLifecycle.js';
// ── helpers ──────────────────────────────────────────────────────────────────
const uid = (req) => Number(req.user?.id);
const role = (req) => String(req.user?.role || 'user');
const isAdmin = (req) => ['admin', 'moderator'].includes(role(req));
function notify(userId, type, title, body, link) {
    createInAppNotification(userId, type, title, body, link).catch(() => { });
    sendPushFromTemplate(userId, type, { title, body }).catch(() => { });
}
/** Derived lifecycle state from the stored status + the clock. */
function computeState(c) {
    if (['draft', 'pending_review', 'rejected', 'cancelled', 'finalized'].includes(c.status))
        return c.status;
    const now = Date.now();
    const start = c.start_at ? Date.parse(c.start_at) : 0;
    const end = c.end_at ? Date.parse(c.end_at) : 0;
    if (start && now < start)
        return 'scheduled';
    if (end && now > end)
        return 'ended';
    return 'active';
}
function canManage(c, req) {
    return isAdmin(req) || Number(c.creator_id) === uid(req);
}
function parseMethods(input) {
    if (Array.isArray(input))
        return input.map(String);
    if (typeof input === 'string' && input.trim())
        return input.split(',').map(s => s.trim()).filter(Boolean);
    return [];
}
async function defaultRewardTiers() {
    const row = await get("SELECT setting_value FROM app_settings WHERE setting_key = 'challenge_reward_defaults'");
    try {
        return JSON.parse(row?.setting_value || '{}');
    }
    catch {
        return {};
    }
}
/** A challenge's goal list (joined with training titles for display). */
async function loadGoals(challengeId) {
    const rows = await query(`SELECT g.*, t.title AS training_title
     FROM challenge_goals g LEFT JOIN trainings t ON t.id = g.training_id
     WHERE g.challenge_id = ? ORDER BY g.position ASC, g.id ASC`, [challengeId]);
    return rows.map(g => ({
        ...g,
        methods: GOAL_TYPES[g.goal_type]?.methods || [],
        tracking: GOAL_TYPES[g.goal_type]?.tracking || '',
    }));
}
const MAX_GOALS = 10;
/**
 * Validate + normalize the creator's goal list (from the `goals_json` form
 * field). Returns clean rows ready to insert, or a user-facing error string.
 */
async function parseGoalsInput(input) {
    let raw;
    if (input == null || input === '')
        return { goals: [] };
    if (typeof input === 'string') {
        try {
            raw = JSON.parse(input);
        }
        catch {
            return { error: 'Invalid goals payload.' };
        }
    }
    else
        raw = input;
    if (!Array.isArray(raw))
        return { error: 'Goals must be a list.' };
    if (raw.length > MAX_GOALS)
        return { error: `A challenge can have at most ${MAX_GOALS} goals.` };
    const goals = [];
    for (const [i, g] of raw.entries()) {
        const type = String(g?.goal_type || '');
        if (!isGoalType(type))
            return { error: `Goal ${i + 1}: unknown goal type.` };
        const meta = GOAL_TYPES[type];
        const target = clampGoalTarget(type, Number(g?.target_value) || 0);
        if (meta.needsTarget && target <= 0)
            return { error: `Goal ${i + 1} (${meta.label}): a positive target is required.` };
        let trainingId = null;
        let trainingTitle = null;
        if (meta.needsTraining) {
            trainingId = Number(g?.training_id) || 0;
            if (!trainingId)
                return { error: `Goal ${i + 1} (${meta.label}): pick a training from the list.` };
            const t = await get('SELECT id, title FROM trainings WHERE id = ?', [trainingId]);
            if (!t)
                return { error: `Goal ${i + 1} (${meta.label}): that training no longer exists.` };
            trainingTitle = t.title;
        }
        let activity = null;
        if (meta.needsActivity) {
            activity = ['walk', 'run'].includes(g?.activity) ? g.activity : null;
            if (!activity)
                return { error: `Goal ${i + 1} (${meta.label}): choose walking or running.` };
        }
        const customTitle = String(g?.title || '').trim().slice(0, 160);
        const description = String(g?.description || '').trim().slice(0, 500) || null;
        if (containsContactInfo(customTitle) || containsContactInfo(description || ''))
            return { error: CONTACT_INFO_MESSAGE };
        goals.push({
            position: i,
            goal_type: type,
            title: customTitle || defaultGoalTitle({ goal_type: type, target_value: target, activity, training_title: trainingTitle }),
            description,
            training_id: trainingId,
            activity,
            target_value: meta.needsTarget ? target : 2,
            target_unit: meta.unit,
        });
    }
    return { goals };
}
async function insertGoals(challengeId, goals) {
    for (const g of goals) {
        await run(`INSERT INTO challenge_goals (challenge_id, position, goal_type, title, description, training_id, activity, target_value, target_unit)
       VALUES (?,?,?,?,?,?,?,?,?)`, [challengeId, g.position, g.goal_type, g.title, g.description, g.training_id, g.activity, g.target_value, g.target_unit]);
    }
}
async function refreshCount(challengeId) {
    const r = await get(`SELECT COUNT(*) c FROM challenge_participants WHERE challenge_id = ? AND status = 'active'`, [challengeId]);
    await run('UPDATE challenges SET participant_count = ? WHERE id = ?', [r?.c || 0, challengeId]);
}
function todayInTz(_tz) {
    // Date-only key. We keep it UTC-stable; the challenge timezone is informative.
    return new Date().toISOString().slice(0, 10);
}
async function isServedAthlete(coachId, athleteId) {
    const r = await get(`SELECT 1 AS ok FROM users u WHERE u.id = ? AND (
        EXISTS(SELECT 1 FROM coach_subscriptions s WHERE s.coach_id = ? AND s.user_id = u.id)
     OR EXISTS(SELECT 1 FROM coaching_bookings b WHERE b.coach_id = ? AND b.user_id = u.id)
     OR EXISTS(SELECT 1 FROM coach_follows f WHERE f.coach_id = ? AND f.follower_id = u.id))`, [athleteId, coachId, coachId, coachId]);
    return !!r;
}
// ─────────────────────────────────────────────────────────────────────────────
// DISCOVERY / DETAILS
// ─────────────────────────────────────────────────────────────────────────────
export const listChallenges = async (req, res) => {
    try {
        const me = uid(req);
        const view = String(req.query.view || 'discover');
        const q = String(req.query.q || '').trim();
        let rows;
        if (view === 'mine') {
            rows = await query(`SELECT c.*, u.name AS creator_name, u.avatar AS creator_avatar,
                (SELECT COUNT(*) FROM challenge_participants WHERE challenge_id = c.id AND status='active') AS participant_count,
                (SELECT COUNT(*) FROM challenge_goals WHERE challenge_id = c.id) AS goals_count,
                cp.status AS my_status, cp.points AS my_points
         FROM challenges c
         LEFT JOIN users u ON c.creator_id = u.id
         LEFT JOIN challenge_participants cp ON cp.challenge_id = c.id AND cp.user_id = ?
         WHERE c.deleted_at IS NULL AND (c.creator_id = ? OR (cp.id IS NOT NULL AND cp.status IN ('active','left')))
         ORDER BY c.created_at DESC`, [me, me]);
        }
        else {
            // Discover: public community challenges + team challenges I'm invited to / in.
            rows = await query(`SELECT c.*, u.name AS creator_name, u.avatar AS creator_avatar,
                (SELECT COUNT(*) FROM challenge_participants WHERE challenge_id = c.id AND status='active') AS participant_count,
                (SELECT COUNT(*) FROM challenge_goals WHERE challenge_id = c.id) AS goals_count,
                cp.status AS my_status
         FROM challenges c
         LEFT JOIN users u ON c.creator_id = u.id
         LEFT JOIN challenge_participants cp ON cp.challenge_id = c.id AND cp.user_id = ?
         WHERE c.deleted_at IS NULL AND (
            (c.type = 'community' AND c.status IN ('scheduled','active','finalized'))
            OR c.creator_id = ?
            OR cp.id IS NOT NULL
            OR EXISTS(SELECT 1 FROM challenge_invitations i WHERE i.challenge_id = c.id AND i.invitee_id = ?)
         )
         ORDER BY c.created_at DESC`, [me, me, me]);
        }
        let list = rows.map(c => ({
            ...c,
            state: computeState(c),
            is_joined: c.my_status === 'active' ? 1 : 0,
            goal_label: Number(c.goals_count) > 0
                ? `${c.goals_count} goal${Number(c.goals_count) > 1 ? 's' : ''}`
                : METRICS[c.goal_metric]?.label || c.goal_metric,
        }));
        if (q)
            list = list.filter(c => String(c.title || '').toLowerCase().includes(q.toLowerCase()));
        res.json({ challenges: list });
    }
    catch (e) {
        res.status(500).json({ message: 'Failed to fetch challenges' });
    }
};
export const listMyInvitations = async (req, res) => {
    try {
        const me = uid(req);
        const rows = await query(`SELECT i.id AS invitation_id, i.token, i.status AS invite_status, i.created_at AS invited_at,
              c.*, u.name AS creator_name, u.avatar AS creator_avatar,
              (SELECT COUNT(*) FROM challenge_participants WHERE challenge_id = c.id AND status='active') AS participant_count
       FROM challenge_invitations i
       JOIN challenges c ON c.id = i.challenge_id AND c.deleted_at IS NULL
       LEFT JOIN users u ON c.creator_id = u.id
       WHERE i.invitee_id = ? AND i.status = 'sent'
       ORDER BY i.created_at DESC`, [me]);
        res.json({ invitations: rows.map(c => ({ ...c, state: computeState(c) })) });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch invitations' });
    }
};
export const getChallenge = async (req, res) => {
    try {
        const me = uid(req);
        const c = await get(`SELECT c.*, u.name AS creator_name, u.avatar AS creator_avatar FROM challenges c
       LEFT JOIN users u ON c.creator_id = u.id WHERE c.id = ? AND c.deleted_at IS NULL`, [req.params.id]);
        if (!c)
            return res.status(404).json({ message: 'Challenge not found' });
        const me_part = await get('SELECT * FROM challenge_participants WHERE challenge_id = ? AND user_id = ?', [c.id, me]);
        const invited = await get("SELECT id, token FROM challenge_invitations WHERE challenge_id = ? AND invitee_id = ? AND status='sent'", [c.id, me]);
        // Private team challenges are only visible to creator/admin/participants/invitees.
        if (c.type === 'team' && !canManage(c, req) && !me_part && !invited) {
            return res.status(403).json({ message: 'This is a private challenge.' });
        }
        const counts = await get(`SELECT COUNT(*) total FROM challenge_participants WHERE challenge_id = ? AND status='active'`, [c.id]);
        let pendingReview = 0;
        if (canManage(c, req)) {
            const pr = await get(`SELECT COUNT(*) n FROM challenge_submissions WHERE challenge_id = ? AND status='pending'`, [c.id]);
            pendingReview = pr?.n || 0;
        }
        const goals = await loadGoals(c.id);
        const goalBased = goals.length > 0;
        res.json({
            challenge: {
                ...c,
                state: computeState(c),
                verification_methods: parseMethods(c.verification_methods),
                reward_tiers: (() => { try {
                    return JSON.parse(c.reward_tiers || '{}');
                }
                catch {
                    return {};
                } })(),
                // Goal-based challenges track overall completion (0–100%); legacy ones
                // keep their single-metric goal.
                goal_label: goalBased ? 'Goal completion' : METRICS[c.goal_metric]?.label || c.goal_metric,
                goal_unit: goalBased ? '%' : METRICS[c.goal_metric]?.unit || '',
                goal_target: goalBased ? GOAL_COMPLETION_TARGET : c.goal_target,
                goals_list: goals,
                participant_count: counts?.total || 0,
                can_manage: canManage(c, req),
                pending_review: pendingReview,
            },
            participant: me_part || null,
            invitation: invited || null,
        });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch challenge' });
    }
};
// ─────────────────────────────────────────────────────────────────────────────
// CREATE / UPDATE / DELETE
// ─────────────────────────────────────────────────────────────────────────────
export const createChallenge = async (req, res) => {
    try {
        const me = uid(req);
        const r = role(req);
        if (!['coach', 'admin'].includes(r))
            return res.status(403).json({ message: 'Only coaches and admins can create challenges.' });
        const b = req.body || {};
        const type = r === 'coach' ? 'team' : (b.type === 'team' ? 'team' : 'community');
        const title = String(b.title || '').trim();
        const description = String(b.description || '').trim();
        if (title.length < 3 || title.length > 80)
            return res.status(400).json({ message: 'Title must be 3–80 characters.' });
        if (containsContactInfo(title) || containsContactInfo(description))
            return res.status(400).json({ message: CONTACT_INFO_MESSAGE });
        const startAt = b.start_at ? new Date(b.start_at) : null;
        const endAt = b.end_at ? new Date(b.end_at) : null;
        if (!startAt || isNaN(+startAt) || !endAt || isNaN(+endAt))
            return res.status(400).json({ message: 'Valid start and end dates are required.' });
        if (+endAt <= +startAt)
            return res.status(400).json({ message: 'End date must be after the start date.' });
        const openEntry = b.open_entry_until ? new Date(b.open_entry_until) : endAt;
        const goalMetric = METRICS[b.goal_metric] ? b.goal_metric : 'sessions';
        const goalTarget = Math.max(0, Number(b.goal_target) || 0);
        // Free-form goals / milestones the creator wants participants to hit
        // (one per line). Stored as-is; the client splits on newlines for display.
        const goals = String(b.goals || '').slice(0, 2000).trim() || null;
        const scoringModel = ['performance', 'consistency', 'improvement', 'participation'].includes(b.scoring_model) ? b.scoring_model : 'consistency';
        // Structured goal list (the new task-based system). When present it also
        // dictates which verification methods the challenge accepts.
        const parsedGoals = await parseGoalsInput(b.goals_json);
        if (parsedGoals.error)
            return res.status(400).json({ message: parsedGoals.error });
        const goalRows = parsedGoals.goals || [];
        // Per-challenge reward, shown to athletes and granted to the champion.
        const rewardTitle = String(b.reward_title || '').trim().slice(0, 160) || null;
        const rewardDescription = String(b.reward_description || '').trim().slice(0, 500) || null;
        const rewardPoints = Math.min(100000, Math.max(0, parseInt(b.reward_points, 10) || 0));
        if (containsContactInfo(rewardTitle || '') || containsContactInfo(rewardDescription || '')) {
            return res.status(400).json({ message: CONTACT_INFO_MESSAGE });
        }
        let methods;
        if (goalRows.length) {
            methods = methodsForGoals(goalRows);
        }
        else {
            methods = parseMethods(b.verification_methods).filter(m => isMethodAllowed(type, m));
            if (methods.length === 0)
                methods = type === 'team' ? ['coach_approval'] : ['manual_checkin', 'photo_evidence'];
        }
        const participantLimit = b.participant_limit != null && b.participant_limit !== ''
            ? Math.max(0, parseInt(b.participant_limit, 10) || 0)
            : (type === 'team' ? 100 : 0);
        // Cover image (optional).
        const files = req.files;
        const coverFile = files?.find(f => f.fieldname === 'cover' || f.fieldname === 'image') || files?.[0];
        const imageUrl = coverFile ? await uploadToR2(coverFile, 'challenges') : null;
        // Approval: admins auto-approve; coach team challenges auto-approve under the
        // configured cap, otherwise they go to the admin review queue.
        const defaults = await defaultRewardTiers();
        const autoLimit = Number(defaults.coach_auto_approve_limit) || 200;
        let status;
        if (r === 'admin')
            status = +startAt > Date.now() ? 'scheduled' : 'active';
        else
            status = (participantLimit > 0 && participantLimit <= autoLimit) || participantLimit === 0 && 100 <= autoLimit
                ? (+startAt > Date.now() ? 'scheduled' : 'active')
                : 'pending_review';
        const visibility = type === 'team' ? 'private' : 'public';
        const startDate = startAt.toISOString().slice(0, 10);
        const endDate = endAt.toISOString().slice(0, 10);
        const { insertId } = await run(`INSERT INTO challenges
        (creator_id, title, description, image_url, type, visibility, status, timezone,
         start_at, end_at, open_entry_until, start_date, end_date,
         goal_metric, goal_target, goals, scoring_model, verification_methods, min_duration_seconds,
         participant_limit, premium_only, min_account_age_days, rules_terms, cancellation_policy, reward_tiers,
         reward_title, reward_description, reward_points)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
            me, title, description, imageUrl, type, visibility, status, String(b.timezone || 'UTC'),
            startAt, endAt, openEntry, startDate, endDate,
            goalMetric, goalTarget, goals, scoringModel, methods.join(','), Math.max(0, parseInt(b.min_duration_seconds, 10) || 0),
            participantLimit, b.premium_only ? 1 : 0, Math.max(0, parseInt(b.min_account_age_days, 10) || 0),
            String(b.rules_terms || '').slice(0, 4000) || null, String(b.cancellation_policy || '').slice(0, 255) || null,
            JSON.stringify(defaults),
            rewardTitle, rewardDescription, rewardPoints,
        ]);
        if (goalRows.length)
            await insertGoals(insertId, goalRows);
        res.status(201).json({ id: insertId, status, message: status === 'pending_review' ? 'Submitted for admin review.' : 'Challenge created.' });
    }
    catch (e) {
        res.status(500).json({ message: 'Failed to create challenge' });
    }
};
export const updateChallenge = async (req, res) => {
    try {
        const c = await get('SELECT * FROM challenges WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
        if (!c)
            return res.status(404).json({ message: 'Challenge not found' });
        if (!canManage(c, req))
            return res.status(403).json({ message: 'Not authorized' });
        const state = computeState(c);
        if (['finalized', 'cancelled'].includes(state))
            return res.status(400).json({ message: 'A finalized or cancelled challenge cannot be edited.' });
        const b = req.body || {};
        const sets = [];
        const vals = [];
        const admin = isAdmin(req);
        const running = state === 'active' || state === 'ended';
        // Always-editable (cosmetic/clarifying).
        if (b.title != null) {
            const t = String(b.title).trim();
            if (t.length < 3 || t.length > 80)
                return res.status(400).json({ message: 'Title must be 3–80 characters.' });
            if (containsContactInfo(t))
                return res.status(400).json({ message: CONTACT_INFO_MESSAGE });
            sets.push('title = ?');
            vals.push(t);
        }
        if (b.description != null) {
            if (containsContactInfo(String(b.description)))
                return res.status(400).json({ message: CONTACT_INFO_MESSAGE });
            sets.push('description = ?');
            vals.push(String(b.description));
        }
        if (b.rules_terms != null) {
            sets.push('rules_terms = ?');
            vals.push(String(b.rules_terms).slice(0, 4000));
        }
        // Per-challenge reward — admins/creators may set or improve it at any time
        // before finalization (announcing a better prize never hurts fairness).
        if (b.reward_title != null) {
            const rt = String(b.reward_title).trim().slice(0, 160);
            if (containsContactInfo(rt))
                return res.status(400).json({ message: CONTACT_INFO_MESSAGE });
            sets.push('reward_title = ?');
            vals.push(rt || null);
        }
        if (b.reward_description != null) {
            const rd = String(b.reward_description).trim().slice(0, 500);
            if (containsContactInfo(rd))
                return res.status(400).json({ message: CONTACT_INFO_MESSAGE });
            sets.push('reward_description = ?');
            vals.push(rd || null);
        }
        if (b.reward_points != null) {
            sets.push('reward_points = ?');
            vals.push(Math.min(100000, Math.max(0, parseInt(b.reward_points, 10) || 0)));
        }
        const files = req.files;
        if (files && files.length) {
            const url = await uploadToR2(files[0], 'challenges');
            sets.push('image_url = ?');
            vals.push(url);
        }
        // end_at: extend-only while running; free before start; admin override.
        if (b.end_at != null) {
            const ne = new Date(b.end_at);
            if (isNaN(+ne))
                return res.status(400).json({ message: 'Invalid end date.' });
            if (running && !admin && +ne < +new Date(c.end_at))
                return res.status(400).json({ message: 'A running challenge can only be extended, not shortened.' });
            sets.push('end_at = ?');
            vals.push(ne);
            sets.push('end_date = ?');
            vals.push(ne.toISOString().slice(0, 10));
        }
        // participant_limit: raise-only while running.
        if (b.participant_limit != null) {
            const nl = Math.max(0, parseInt(b.participant_limit, 10) || 0);
            if (running && !admin && nl !== 0 && nl < Number(c.participant_limit))
                return res.status(400).json({ message: 'Participant limit can only be raised while running.' });
            sets.push('participant_limit = ?');
            vals.push(nl);
        }
        // Score-altering fields: locked while running unless admin.
        const locked = running && !admin;
        let goalsReplaced = false;
        if (!locked) {
            if (b.start_at != null && state !== 'active' && state !== 'ended') {
                const ns = new Date(b.start_at);
                if (!isNaN(+ns)) {
                    sets.push('start_at = ?');
                    vals.push(ns);
                    sets.push('start_date = ?');
                    vals.push(ns.toISOString().slice(0, 10));
                }
            }
            if (b.goal_metric != null && METRICS[b.goal_metric]) {
                sets.push('goal_metric = ?');
                vals.push(b.goal_metric);
            }
            if (b.goal_target != null) {
                sets.push('goal_target = ?');
                vals.push(Math.max(0, Number(b.goal_target) || 0));
            }
            if (b.goals != null) {
                sets.push('goals = ?');
                vals.push(String(b.goals || '').slice(0, 2000).trim() || null);
            }
            if (b.scoring_model != null && ['performance', 'consistency', 'improvement', 'participation'].includes(b.scoring_model)) {
                sets.push('scoring_model = ?');
                vals.push(b.scoring_model);
            }
            // Replace the structured goal list. Existing submissions keep their
            // goal_id; orphaned ones simply stop counting after the recompute below.
            if (b.goals_json != null) {
                const parsed = await parseGoalsInput(b.goals_json);
                if (parsed.error)
                    return res.status(400).json({ message: parsed.error });
                await run('DELETE FROM challenge_goals WHERE challenge_id = ?', [c.id]);
                await insertGoals(c.id, parsed.goals || []);
                goalsReplaced = true;
                if (parsed.goals?.length) {
                    sets.push('verification_methods = ?');
                    vals.push(methodsForGoals(parsed.goals).join(','));
                }
            }
            if (b.goals_json == null && b.verification_methods != null) {
                const m = parseMethods(b.verification_methods).filter(x => isMethodAllowed(c.type, x));
                if (m.length) {
                    sets.push('verification_methods = ?');
                    vals.push(m.join(','));
                }
            }
        }
        if (!sets.length && !goalsReplaced)
            return res.status(400).json({ message: 'Nothing to update.' });
        if (!sets.length) {
            sets.push('updated_at = NOW()');
        }
        vals.push(c.id);
        await run(`UPDATE challenges SET ${sets.join(', ')} WHERE id = ?`, vals);
        // Notify participants when the rules of a running challenge change.
        if (running) {
            const parts = await query(`SELECT user_id FROM challenge_participants WHERE challenge_id = ? AND status='active'`, [c.id]);
            for (const p of parts)
                notify(p.user_id, 'challenge_updated', 'Challenge updated', `“${c.title}” was updated.`, `/app/challenges`);
        }
        if (locked || goalsReplaced)
            await recomputeAll(c.id);
        res.json({ message: 'Challenge updated.' });
    }
    catch {
        res.status(500).json({ message: 'Failed to update challenge' });
    }
};
export const deleteChallenge = async (req, res) => {
    try {
        const c = await get('SELECT * FROM challenges WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
        if (!c)
            return res.status(404).json({ message: 'Challenge not found' });
        if (!canManage(c, req))
            return res.status(403).json({ message: 'Not authorized' });
        await run("UPDATE challenges SET deleted_at = NOW(), status = 'cancelled', cancelled_at = NOW() WHERE id = ?", [c.id]);
        const parts = await query(`SELECT user_id FROM challenge_participants WHERE challenge_id = ? AND status='active'`, [c.id]);
        for (const p of parts)
            notify(p.user_id, 'challenge_cancelled', 'Challenge cancelled', `“${c.title}” was cancelled.`, '/app/challenges');
        res.json({ message: 'Challenge cancelled.' });
    }
    catch {
        res.status(500).json({ message: 'Failed to delete challenge' });
    }
};
// ─────────────────────────────────────────────────────────────────────────────
// INVITES (team)
// ─────────────────────────────────────────────────────────────────────────────
export const getInvitableAthletes = async (req, res) => {
    try {
        const c = await get('SELECT * FROM challenges WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
        if (!c)
            return res.status(404).json({ message: 'Challenge not found' });
        if (!canManage(c, req))
            return res.status(403).json({ message: 'Not authorized' });
        const coachId = Number(c.creator_id);
        const rows = await query(`SELECT DISTINCT u.id, u.name, u.avatar FROM users u
       WHERE u.role = 'user' AND (
            u.id IN (SELECT user_id FROM coach_subscriptions WHERE coach_id = ?)
         OR u.id IN (SELECT user_id FROM coaching_bookings WHERE coach_id = ?)
         OR u.id IN (SELECT follower_id FROM coach_follows WHERE coach_id = ?))
         AND u.id NOT IN (SELECT user_id FROM challenge_participants WHERE challenge_id = ?)
         AND u.id NOT IN (SELECT invitee_id FROM challenge_invitations WHERE challenge_id = ? AND status='sent')
       ORDER BY u.name ASC LIMIT 500`, [coachId, coachId, coachId, c.id, c.id]);
        res.json({ athletes: rows });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch athletes' });
    }
};
export const inviteParticipants = async (req, res) => {
    try {
        const c = await get('SELECT * FROM challenges WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
        if (!c)
            return res.status(404).json({ message: 'Challenge not found' });
        if (!canManage(c, req))
            return res.status(403).json({ message: 'Not authorized' });
        if (c.type !== 'team')
            return res.status(400).json({ message: 'Only team challenges use invitations.' });
        const ids = Array.isArray(req.body?.userIds) ? req.body.userIds.map(Number).filter(Boolean) : [];
        if (!ids.length)
            return res.status(400).json({ message: 'No athletes selected.' });
        let invited = 0;
        const rejected = [];
        for (const athleteId of ids) {
            if (!isAdmin(req) && !(await isServedAthlete(Number(c.creator_id), athleteId))) {
                rejected.push(athleteId);
                continue;
            }
            const token = randomBytes(24).toString('hex');
            const r = await run(`INSERT IGNORE INTO challenge_invitations (challenge_id, inviter_id, invitee_id, token) VALUES (?,?,?,?)`, [c.id, uid(req), athleteId, token]);
            if (r.affectedRows) {
                invited++;
                notify(athleteId, 'challenge_invite', 'Challenge invitation', `You're invited to “${c.title}”.`, '/app/challenges');
            }
        }
        res.json({ invited, rejected, message: `${invited} invitation(s) sent.` + (rejected.length ? ` ${rejected.length} skipped (not your athlete).` : '') });
    }
    catch {
        res.status(500).json({ message: 'Failed to send invitations' });
    }
};
export const respondInvitation = async (req, res) => {
    try {
        const me = uid(req);
        const { token, accept } = req.body || {};
        const inv = await get('SELECT * FROM challenge_invitations WHERE challenge_id = ? AND token = ?', [req.params.id, String(token || '')]);
        // Tokens are single-use AND user-bound: a forwarded link fails for anyone else.
        if (!inv || Number(inv.invitee_id) !== me)
            return res.status(403).json({ message: 'This invitation is not valid for your account.' });
        if (inv.status !== 'sent')
            return res.status(400).json({ message: 'This invitation was already used.' });
        if (!accept) {
            await run("UPDATE challenge_invitations SET status='declined', responded_at=NOW() WHERE id = ?", [inv.id]);
            return res.json({ message: 'Invitation declined.' });
        }
        await run("UPDATE challenge_invitations SET status='accepted', responded_at=NOW() WHERE id = ?", [inv.id]);
        await joinInternal(Number(req.params.id), me, req.body, res, /*skipEligibility*/ true);
    }
    catch {
        res.status(500).json({ message: 'Failed to respond to invitation' });
    }
};
// ─────────────────────────────────────────────────────────────────────────────
// JOIN / LEAVE
// ─────────────────────────────────────────────────────────────────────────────
async function joinInternal(challengeId, userId, body, res, skipEligibility) {
    const c = await get('SELECT * FROM challenges WHERE id = ? AND deleted_at IS NULL', [challengeId]);
    if (!c)
        return res.status(404).json({ message: 'Challenge not found' });
    const state = computeState(c);
    if (!['scheduled', 'active'].includes(state))
        return res.status(400).json({ message: 'This challenge is not open for joining.' });
    // Entry window (locked vs open).
    const openUntil = c.open_entry_until ? Date.parse(c.open_entry_until) : (c.end_at ? Date.parse(c.end_at) : 0);
    if (openUntil && Date.now() > openUntil)
        return res.status(400).json({ message: 'Entry for this challenge has closed.' });
    // Capacity.
    if (Number(c.participant_limit) > 0) {
        const cnt = await get(`SELECT COUNT(*) n FROM challenge_participants WHERE challenge_id = ? AND status='active'`, [challengeId]);
        if ((cnt?.n || 0) >= Number(c.participant_limit))
            return res.status(400).json({ message: 'This challenge is full.' });
    }
    // Eligibility (community open join). Invites skip this.
    if (!skipEligibility) {
        if (c.type === 'team')
            return res.status(403).json({ message: 'Team challenges are invitation-only.' });
        const u = await get('SELECT is_premium, created_at FROM users WHERE id = ?', [userId]);
        if (c.premium_only && !u?.is_premium)
            return res.status(403).json({ message: 'This challenge is for premium members only.' });
        if (Number(c.min_account_age_days) > 0 && u?.created_at) {
            const ageDays = (Date.now() - new Date(u.created_at).getTime()) / 86400000;
            if (ageDays < Number(c.min_account_age_days))
                return res.status(403).json({ message: 'Your account is too new to join this challenge.' });
        }
    }
    const displayMode = ['hidden', 'alias', 'real'].includes(body?.display_mode) ? body.display_mode : 'hidden';
    const alias = String(body?.alias || '').slice(0, 40) || null;
    const existing = await get('SELECT * FROM challenge_participants WHERE challenge_id = ? AND user_id = ?', [challengeId, userId]);
    if (existing) {
        if (existing.status === 'active')
            return res.json({ message: 'Already joined.' });
        if (existing.status === 'removed')
            return res.status(403).json({ message: 'You were removed from this challenge.' });
        if (existing.status === 'left') {
            if (openUntil && Date.now() > openUntil)
                return res.status(400).json({ message: 'Entry has closed — you cannot rejoin.' });
            if (Number(existing.rejoin_count) >= 2)
                return res.status(400).json({ message: 'Rejoin limit reached.' });
            await run("UPDATE challenge_participants SET status='active', left_at=NULL, rejoin_count=rejoin_count+1, streak=0, display_mode=?, alias=?, accepted_terms_at=NOW() WHERE id = ?", [displayMode, alias, existing.id]);
            await refreshCount(challengeId);
            return res.json({ message: 'Rejoined the challenge.' });
        }
    }
    await run(`INSERT INTO challenge_participants (challenge_id, user_id, display_mode, alias, status, accepted_terms_at)
     VALUES (?,?,?,?, 'active', NOW())`, [challengeId, userId, displayMode, alias]);
    await refreshCount(challengeId);
    if (Number(c.creator_id) !== userId)
        notify(Number(c.creator_id), 'challenge_joined', 'New participant', `Someone joined “${c.title}”.`, '/coach/challenges');
    res.json({ message: 'Joined the challenge.' });
}
export const joinChallenge = (req, res) => joinInternal(Number(req.params.id), uid(req), req.body, res, false);
export const leaveChallenge = async (req, res) => {
    try {
        const me = uid(req);
        const p = await get("SELECT * FROM challenge_participants WHERE challenge_id = ? AND user_id = ? AND status='active'", [req.params.id, me]);
        if (!p)
            return res.status(404).json({ message: 'You are not in this challenge.' });
        await run("UPDATE challenge_participants SET status='left', left_at=NOW() WHERE id = ?", [p.id]);
        await refreshCount(Number(req.params.id));
        res.json({ message: 'You left the challenge.' });
    }
    catch {
        res.status(500).json({ message: 'Failed to leave challenge' });
    }
};
export const removeParticipant = async (req, res) => {
    try {
        const c = await get('SELECT * FROM challenges WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
        if (!c)
            return res.status(404).json({ message: 'Challenge not found' });
        if (!canManage(c, req))
            return res.status(403).json({ message: 'Not authorized' });
        const p = await get('SELECT * FROM challenge_participants WHERE id = ? AND challenge_id = ?', [req.params.pid, c.id]);
        if (!p)
            return res.status(404).json({ message: 'Participant not found' });
        await run("UPDATE challenge_participants SET status='removed', left_at=NOW() WHERE id = ?", [p.id]);
        await refreshCount(c.id);
        notify(p.user_id, 'challenge_removed', 'Removed from challenge', `You were removed from “${c.title}”.`, '/app/challenges');
        res.json({ message: 'Participant removed.' });
    }
    catch {
        res.status(500).json({ message: 'Failed to remove participant' });
    }
};
// ─────────────────────────────────────────────────────────────────────────────
// SUBMISSIONS / VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────
export const submitEvidence = async (req, res) => {
    try {
        const me = uid(req);
        const c = await get('SELECT * FROM challenges WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
        if (!c)
            return res.status(404).json({ message: 'Challenge not found' });
        const p = await get("SELECT * FROM challenge_participants WHERE challenge_id = ? AND user_id = ? AND status='active'", [c.id, me]);
        if (!p)
            return res.status(403).json({ message: 'Join the challenge before submitting progress.' });
        const state = computeState(c);
        if (state !== 'active')
            return res.status(400).json({ message: state === 'scheduled' ? 'The challenge has not started yet.' : 'The challenge is closed for submissions.' });
        const method = String(req.body?.method || '');
        if (!METHODS[method])
            return res.status(400).json({ message: 'Unknown verification method.' });
        const meta = METHODS[method];
        // Goal-based challenges: every submission targets one goal on the list,
        // and the goal's type dictates the allowed methods.
        const goals = await loadGoals(c.id);
        let goal = null;
        if (goals.length) {
            const goalId = Number(req.body?.goal_id) || 0;
            goal = goals.find(g => Number(g.id) === goalId);
            if (!goal)
                return res.status(400).json({ message: 'Pick which goal this progress is for.' });
            if (!goal.methods.includes(method))
                return res.status(400).json({ message: `“${goal.title}” is tracked by: ${goal.tracking}.` });
        }
        else {
            const allowed = parseMethods(c.verification_methods);
            if (!allowed.includes(method))
                return res.status(400).json({ message: 'This verification method is not allowed for this challenge.' });
        }
        const activityDate = String(req.body?.activity_date || todayInTz(c.timezone)).slice(0, 10);
        const durationSeconds = Math.max(0, parseInt(req.body?.duration_seconds, 10) || 0);
        // Min-duration guard.
        if (method === 'time_based' && Number(c.min_duration_seconds) > 0 && durationSeconds < Number(c.min_duration_seconds)) {
            return res.status(400).json({ message: `Activity must be at least ${Math.round(Number(c.min_duration_seconds) / 60)} minutes.` });
        }
        // Numeric clamp for self-reported metrics.
        let metricValue = Number(req.body?.metric_value) || 0;
        let flagged = false;
        let flagReason = null;
        const addFlag = (reason) => { flagged = true; flagReason = flagReason ? `${flagReason}; ${reason}` : reason; };
        if (method === 'manual_step') {
            const r = clampMetric('steps', metricValue);
            metricValue = r.value;
            if (r.clamped)
                addFlag('step count clamped to plausible max');
        }
        if (method === 'manual_distance') {
            const r = clampMetric('distance_km', metricValue);
            metricValue = r.value;
            if (r.clamped)
                addFlag('distance clamped to plausible max');
        }
        if (method === 'gps_steps') {
            const r = clampMetric('steps', metricValue);
            metricValue = r.value;
            if (r.clamped)
                addFlag('GPS step count clamped to plausible max');
        }
        if (method === 'manual_checkin')
            metricValue = 1;
        // Goal-type-specific value handling.
        if (goal) {
            if (goal.goal_type === 'walk_run') {
                // Whatever the method, the number on a walk/run goal is kilometres.
                const r = clampMetric('distance_km', metricValue);
                metricValue = r.value;
                if (r.clamped)
                    addFlag('distance clamped to plausible max');
                if (metricValue <= 0)
                    return res.status(400).json({ message: 'Enter the distance you covered (km).' });
            }
            else if (goal.goal_type === 'training') {
                metricValue = 1; // one session — progress counts distinct days
            }
            else if (goal.goal_type === 'transformation') {
                metricValue = 1;
                // One before + one after per goal. A rejected photo can be resubmitted.
                const dupPhoto = await get(`SELECT id FROM challenge_submissions WHERE participant_id = ? AND goal_id = ? AND method = ? AND status <> 'rejected' AND deleted_at IS NULL`, [p.id, goal.id, method]);
                if (dupPhoto)
                    return res.status(400).json({ message: `You already submitted your ${method === 'before_photo' ? 'before' : 'after'} photo.` });
            }
        }
        if (method === 'weigh_in' && goal) { // weigh_in is only reachable through a weight goal
            if (!(metricValue >= 20 && metricValue <= 400))
                return res.status(400).json({ message: 'Enter your current weight in kg (20–400).' });
            // One weigh-in per day keeps the trend honest.
            const dupWeigh = await get(`SELECT id FROM challenge_submissions WHERE participant_id = ? AND goal_id = ? AND method='weigh_in' AND activity_date = ? AND status <> 'rejected' AND deleted_at IS NULL`, [p.id, goal.id, activityDate]);
            if (dupWeigh)
                return res.status(400).json({ message: 'You already logged a weigh-in today.' });
        }
        // One check-in per day (per goal when goal-based).
        if (method === 'manual_checkin') {
            const dup = goal
                ? await get(`SELECT id FROM challenge_submissions WHERE participant_id = ? AND goal_id = ? AND method='manual_checkin' AND activity_date = ? AND status <> 'rejected' AND deleted_at IS NULL`, [p.id, goal.id, activityDate])
                : await get(`SELECT id FROM challenge_submissions WHERE challenge_id = ? AND participant_id = ? AND method='manual_checkin' AND activity_date = ? AND status <> 'rejected' AND deleted_at IS NULL`, [c.id, p.id, activityDate]);
            if (dup)
                return res.status(400).json({ message: 'You already checked in for this day.' });
        }
        // Evidence handling: hash + dedupe.
        let evidenceUrl = null;
        let evidenceHash = null;
        const files = req.files;
        const file = files?.[0];
        if (meta.needsEvidence) {
            if (!file)
                return res.status(400).json({ message: 'This method requires a photo/video/screenshot.' });
            evidenceHash = createHash('sha256').update(file.buffer).digest('hex');
            const dupHash = await get('SELECT id FROM challenge_submissions WHERE challenge_id = ? AND evidence_hash = ? AND deleted_at IS NULL', [c.id, evidenceHash]);
            if (dupHash)
                return res.status(400).json({ message: 'This exact file was already submitted.' });
            evidenceUrl = await uploadToR2(file, 'challenge-evidence');
        }
        else if (file) {
            evidenceHash = createHash('sha256').update(file.buffer).digest('hex');
            evidenceUrl = await uploadToR2(file, 'challenge-evidence');
        }
        // Capture-time anti-cheat: read when the photo/video was actually taken
        // (stamped by stampMediaCapture from EXIF/mvhd) and flag stale or back-dated
        // evidence. capturedAt stays null when the file has no embedded timestamp.
        const capturedAt = file && file.capturedAt instanceof Date ? file.capturedAt : null;
        if (capturedAt) {
            const now = Date.now();
            const startMs = c.start_at ? +new Date(c.start_at) : 0;
            if (+capturedAt > now + 3600000)
                addFlag('capture time is in the future');
            else if (startMs && +capturedAt < startMs)
                addFlag('media captured before the challenge started');
            else if ((now - +capturedAt) / 3600000 > 48)
                addFlag(`media is ~${Math.round((now - +capturedAt) / 3600000)}h old`);
        }
        // GPS proof-of-presence (GPS-tracked methods and any geo-tagged submission).
        const geoLat = req.body?.geo_lat != null && req.body.geo_lat !== '' ? Number(req.body.geo_lat) : null;
        const geoLng = req.body?.geo_lng != null && req.body.geo_lng !== '' ? Number(req.body.geo_lng) : null;
        if ((method === 'gps_distance' || method === 'gps_steps') && (geoLat == null || geoLng == null)) {
            addFlag('GPS method submitted without location proof');
        }
        const trust = meta.trust;
        const awarded = basePointsForSubmission(method);
        const status = meta.auto ? 'auto_approved' : 'pending';
        const { insertId } = await run(`INSERT INTO challenge_submissions
        (challenge_id, participant_id, user_id, goal_id, method, metric_value, duration_seconds, evidence_url, evidence_hash, note, activity_date, status, trust_weight, awarded_points, flagged, flag_reason, captured_at, geo_lat, geo_lng)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [c.id, p.id, me, goal ? goal.id : null, method, metricValue, durationSeconds, evidenceUrl, evidenceHash, String(req.body?.note || '').slice(0, 500) || null, activityDate, status, trust, awarded, flagged ? 1 : 0, flagReason, capturedAt, geoLat, geoLng]);
        if (flagged)
            await run(`INSERT INTO challenge_reports (challenge_id, submission_id, source, reason) VALUES (?,?, 'system', ?)`, [c.id, insertId, flagReason]);
        await recomputeParticipant(c.id, p.id);
        if (status === 'pending')
            notify(Number(c.creator_id), 'challenge_review', 'Submission to review', `New evidence in “${c.title}”.`, '/coach/challenges');
        res.status(201).json({ id: insertId, status, message: status === 'pending' ? 'Submitted — awaiting review.' : 'Logged and counted.' });
    }
    catch (e) {
        res.status(500).json({ message: 'Failed to submit progress' });
    }
};
export const listSubmissions = async (req, res) => {
    try {
        const c = await get('SELECT * FROM challenges WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
        if (!c)
            return res.status(404).json({ message: 'Challenge not found' });
        if (!canManage(c, req))
            return res.status(403).json({ message: 'Not authorized' });
        const status = String(req.query.status || 'pending');
        const rows = await query(`SELECT s.*, u.name AS user_name, u.avatar AS user_avatar, g.title AS goal_title, g.goal_type
       FROM challenge_submissions s JOIN users u ON s.user_id = u.id
       LEFT JOIN challenge_goals g ON g.id = s.goal_id
       WHERE s.challenge_id = ? AND s.deleted_at IS NULL ${status !== 'all' ? 'AND s.status = ?' : ''}
       ORDER BY s.created_at DESC LIMIT 300`, status !== 'all' ? [c.id, status] : [c.id]);
        res.json({ submissions: rows });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch submissions' });
    }
};
async function reviewSubmission(req, res, approve) {
    const c = await get('SELECT * FROM challenges WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (!c)
        return res.status(404).json({ message: 'Challenge not found' });
    if (!canManage(c, req))
        return res.status(403).json({ message: 'Not authorized' });
    const s = await get('SELECT * FROM challenge_submissions WHERE id = ? AND challenge_id = ?', [req.params.sid, c.id]);
    if (!s)
        return res.status(404).json({ message: 'Submission not found' });
    const reason = String(req.body?.reason || '').slice(0, 255) || null;
    await run('UPDATE challenge_submissions SET status = ?, reviewed_by = ?, review_reason = ?, reviewed_at = NOW() WHERE id = ?', [approve ? 'approved' : 'rejected', uid(req), reason, s.id]);
    await recomputeParticipant(c.id, s.participant_id);
    notify(s.user_id, approve ? 'challenge_approved' : 'challenge_rejected', approve ? 'Submission approved' : 'Submission rejected', `Your submission in “${c.title}” was ${approve ? 'approved' : 'rejected'}.${reason ? ' ' + reason : ''}`, '/app/challenges');
    res.json({ message: approve ? 'Approved.' : 'Rejected.' });
}
export const approveSubmission = (req, res) => reviewSubmission(req, res, true).catch(() => res.status(500).json({ message: 'Failed' }));
export const rejectSubmission = (req, res) => reviewSubmission(req, res, false).catch(() => res.status(500).json({ message: 'Failed' }));
// ─────────────────────────────────────────────────────────────────────────────
// LEADERBOARD / PROGRESS
// ─────────────────────────────────────────────────────────────────────────────
function displayName(row, viewerId, reveal) {
    if (Number(row.user_id) === viewerId)
        return { name: row.user_name || 'You', avatar: row.user_avatar, you: true, link_id: null };
    if (reveal || row.display_mode === 'real')
        return { name: row.user_name || 'Athlete', avatar: row.user_avatar, you: false, link_id: row.display_mode === 'real' || reveal ? row.user_id : null };
    return { name: aliasForParticipant(row), avatar: null, you: false, link_id: null };
}
export const getLeaderboard = async (req, res) => {
    try {
        const me = uid(req);
        const c = await get('SELECT * FROM challenges WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
        if (!c)
            return res.status(404).json({ message: 'Challenge not found' });
        const myPart = await get('SELECT id FROM challenge_participants WHERE challenge_id = ? AND user_id = ?', [c.id, me]);
        if (c.type === 'team' && !canManage(c, req) && !myPart)
            return res.status(403).json({ message: 'Private leaderboard.' });
        const scope = String(req.query.scope || 'overall');
        const reveal = canManage(c, req); // managers see real identities
        let rows;
        if (scope === 'overall') {
            rows = await query(`SELECT cp.*, u.name AS user_name, u.avatar AS user_avatar
         FROM challenge_participants cp JOIN users u ON cp.user_id = u.id
         WHERE cp.challenge_id = ? AND cp.status = 'active'
         ORDER BY cp.verified_points DESC, cp.progress_value DESC, cp.best_streak DESC, cp.joined_at ASC, cp.user_id ASC
         LIMIT 200`, [c.id]);
        }
        else {
            // weekly = last 7 days, daily = today. Points summed from approved submissions in the window.
            const since = scope === 'daily' ? todayInTz(c.timezone) : new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
            rows = await query(`SELECT cp.id, cp.user_id, cp.display_mode, cp.alias, cp.joined_at, cp.best_streak, cp.progress_value,
                u.name AS user_name, u.avatar AS user_avatar,
                COALESCE(SUM(CASE WHEN s.status IN ('approved','auto_approved') THEN s.awarded_points ELSE 0 END),0) AS verified_points,
                COALESCE(SUM(CASE WHEN s.status='pending' THEN s.awarded_points ELSE 0 END),0) AS pending_points
         FROM challenge_participants cp
         JOIN users u ON cp.user_id = u.id
         LEFT JOIN challenge_submissions s ON s.participant_id = cp.id AND s.activity_date >= ? AND s.deleted_at IS NULL
         WHERE cp.challenge_id = ? AND cp.status = 'active'
         GROUP BY cp.id, u.id
         ORDER BY verified_points DESC, cp.progress_value DESC, cp.best_streak DESC, cp.joined_at ASC, cp.user_id ASC
         LIMIT 200`, [since, c.id]);
        }
        const board = rows.map((r, i) => {
            const d = displayName(r, me, reveal);
            return {
                rank: i + 1,
                participant_id: r.id,
                ...d,
                verified_points: Number(r.verified_points) || 0,
                pending_points: Number(r.pending_points) || 0,
                progress_value: Number(r.progress_value) || 0,
                streak: Number(r.best_streak) || 0,
                is_winner: !!r.is_winner,
                win_category: r.win_category || null,
                has_pending: (Number(r.pending_points) || 0) > 0,
            };
        });
        const goalCount = await get('SELECT COUNT(*) n FROM challenge_goals WHERE challenge_id = ?', [c.id]);
        const goalBased = (goalCount?.n || 0) > 0;
        res.json({
            leaderboard: board, scope,
            goal_label: goalBased ? 'Goal completion' : METRICS[c.goal_metric]?.label,
            goal_unit: goalBased ? '%' : METRICS[c.goal_metric]?.unit,
            goal_target: goalBased ? GOAL_COMPLETION_TARGET : c.goal_target,
        });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch leaderboard' });
    }
};
export const getProgress = async (req, res) => {
    try {
        const me = uid(req);
        const c = await get('SELECT * FROM challenges WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
        if (!c)
            return res.status(404).json({ message: 'Challenge not found' });
        const goals = await loadGoals(c.id);
        const goalBased = goals.length > 0;
        const p = await get('SELECT * FROM challenge_participants WHERE challenge_id = ? AND user_id = ?', [c.id, me]);
        if (!p)
            return res.json({ participant: null, submissions: [], rank: null, goals: goals.map(g => ({ ...g, progress: null })) });
        // Full history (no LIMIT): per-goal progress must replay everything — a
        // weigh-in baseline or distance sum computed over a truncated window
        // would drift from the scoring engine. The response itself stays capped.
        const subs = await query('SELECT * FROM challenge_submissions WHERE participant_id = ? AND deleted_at IS NULL ORDER BY created_at DESC', [p.id]);
        const rk = await get(`SELECT COUNT(*)+1 AS rank FROM challenge_participants
       WHERE challenge_id = ? AND status='active' AND (verified_points > ? OR (verified_points = ? AND progress_value > ?))`, [c.id, p.verified_points, p.verified_points, p.progress_value]);
        const today = todayInTz(c.timezone);
        const goalsWithProgress = goals.map(g => ({
            ...g,
            progress: computeGoalProgress(g, subs, today),
        }));
        res.json({
            participant: p,
            submissions: subs.slice(0, 100),
            rank: rk?.rank || null,
            goals: goalsWithProgress,
            goal_target: goalBased ? GOAL_COMPLETION_TARGET : c.goal_target,
            goal_unit: goalBased ? '%' : METRICS[c.goal_metric]?.unit,
            scoring_model: c.scoring_model,
        });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch progress' });
    }
};
// ─────────────────────────────────────────────────────────────────────────────
// FINALIZE  (winners + rewards)
// ─────────────────────────────────────────────────────────────────────────────
export const finalizeChallenge = async (req, res) => {
    try {
        const c = await get('SELECT * FROM challenges WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
        if (!c)
            return res.status(404).json({ message: 'Challenge not found' });
        if (!canManage(c, req))
            return res.status(403).json({ message: 'Not authorized' });
        if (c.status === 'finalized')
            return res.status(400).json({ message: 'Already finalized.' });
        const force = String(req.query.force || '') === '1' && isAdmin(req);
        if (!force && c.end_at && Date.now() < Date.parse(c.end_at))
            return res.status(400).json({ message: 'The challenge has not ended yet.' });
        const result = await finalizeChallengeById(c.id);
        res.status(result.ok ? 200 : 400).json({ message: result.message });
    }
    catch (e) {
        res.status(500).json({ message: 'Failed to finalize challenge' });
    }
};
// ─────────────────────────────────────────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────────────────────────────────────────
export const reportChallenge = async (req, res) => {
    try {
        const reason = String(req.body?.reason || '').slice(0, 255);
        if (!reason)
            return res.status(400).json({ message: 'A reason is required.' });
        await run(`INSERT INTO challenge_reports (challenge_id, submission_id, reporter_id, source, reason) VALUES (?,?,?, 'user', ?)`, [req.params.id, req.body?.submission_id || null, uid(req), reason]);
        res.json({ message: 'Report submitted. Our team will review it.' });
    }
    catch {
        res.status(500).json({ message: 'Failed to submit report' });
    }
};
// ─────────────────────────────────────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────────────────────────────────────
export const adminListChallenges = async (req, res) => {
    try {
        const filter = String(req.query.filter || 'all');
        const where = filter === 'pending' ? "AND c.status='pending_review'" : '';
        const rows = await query(`SELECT c.*, u.name AS creator_name, u.avatar AS creator_avatar,
              (SELECT COUNT(*) FROM challenge_participants WHERE challenge_id = c.id AND status='active') AS participant_count,
              (SELECT COUNT(*) FROM challenge_goals WHERE challenge_id = c.id) AS goals_count
       FROM challenges c LEFT JOIN users u ON c.creator_id = u.id
       WHERE c.deleted_at IS NULL ${where} ORDER BY c.created_at DESC LIMIT 300`);
        res.json({ challenges: rows.map(c => ({ ...c, state: computeState(c) })) });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch challenges' });
    }
};
export const adminReviewChallenge = async (req, res) => {
    try {
        const approve = String(req.params.decision) === 'approve';
        const c = await get('SELECT * FROM challenges WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
        if (!c)
            return res.status(404).json({ message: 'Challenge not found' });
        if (approve) {
            const status = c.start_at && Date.parse(c.start_at) > Date.now() ? 'scheduled' : 'active';
            const sets = ['status = ?'];
            const vals = [status];
            if (req.body?.reward_tiers) {
                sets.push('reward_tiers = ?');
                vals.push(JSON.stringify(req.body.reward_tiers));
            }
            vals.push(c.id);
            await run(`UPDATE challenges SET ${sets.join(', ')} WHERE id = ?`, vals);
            notify(Number(c.creator_id), 'challenge_approved', 'Challenge approved', `“${c.title}” is now live.`, '/coach/challenges');
        }
        else {
            await run("UPDATE challenges SET status='rejected' WHERE id = ?", [c.id]);
            notify(Number(c.creator_id), 'challenge_rejected', 'Challenge needs changes', `“${c.title}” was not approved.${req.body?.reason ? ' ' + req.body.reason : ''}`, '/coach/challenges');
        }
        res.json({ message: approve ? 'Approved.' : 'Rejected.' });
    }
    catch {
        res.status(500).json({ message: 'Failed to review challenge' });
    }
};
export const getRewardSettings = async (_req, res) => {
    try {
        const row = await get("SELECT setting_value FROM app_settings WHERE setting_key='challenge_reward_defaults'");
        res.json({ settings: row?.setting_value ? JSON.parse(row.setting_value) : {} });
    }
    catch {
        res.status(500).json({ message: 'Failed to load reward settings' });
    }
};
export const saveRewardSettings = async (req, res) => {
    try {
        const value = JSON.stringify(req.body?.settings || {});
        await run(`INSERT INTO app_settings (setting_key, setting_value, setting_type, category, label)
       VALUES ('challenge_reward_defaults', ?, 'json', 'challenges', 'Challenge Reward Defaults')
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`, [value]);
        res.json({ message: 'Reward settings saved.' });
    }
    catch {
        res.status(500).json({ message: 'Failed to save reward settings' });
    }
};
export const adminListReports = async (_req, res) => {
    try {
        const rows = await query(`SELECT r.*, c.title AS challenge_title FROM challenge_reports r
       LEFT JOIN challenges c ON r.challenge_id = c.id
       WHERE r.status='open' ORDER BY r.created_at DESC LIMIT 200`);
        res.json({ reports: rows });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch reports' });
    }
};
export const adminResolveReport = async (req, res) => {
    try {
        await run("UPDATE challenge_reports SET status='resolved', resolved_by=?, resolution_note=?, resolved_at=NOW() WHERE id = ?", [uid(req), String(req.body?.note || '').slice(0, 255) || null, req.params.id]);
        res.json({ message: 'Report resolved.' });
    }
    catch {
        res.status(500).json({ message: 'Failed to resolve report' });
    }
};
// Goal catalog + trainings list for the create-challenge goal builder.
export const getGoalOptions = async (_req, res) => {
    try {
        const trainings = await query('SELECT id, title FROM trainings ORDER BY sort_order ASC, title ASC');
        res.json({
            goal_types: GOAL_TYPE_KEYS.map(k => {
                const m = GOAL_TYPES[k];
                return {
                    key: m.key, label: m.label, tracking: m.tracking, unit: m.unit,
                    needs_target: m.needsTarget, needs_training: !!m.needsTraining,
                    needs_activity: !!m.needsActivity, daily: m.daily, weigh_in: !!m.weighIn,
                    methods: m.methods,
                };
            }),
            trainings,
        });
    }
    catch {
        res.status(500).json({ message: 'Failed to load goal options' });
    }
};
// Profile trophy shelf.
export const getUserRewards = async (req, res) => {
    try {
        const userId = req.params.userId ? Number(req.params.userId) : uid(req);
        const rows = await query(`SELECT g.*, c.title AS challenge_title FROM challenge_reward_grants g
       LEFT JOIN challenges c ON g.challenge_id = c.id
       WHERE g.user_id = ? AND (g.expires_at IS NULL OR g.expires_at > NOW())
       ORDER BY g.created_at DESC`, [userId]);
        res.json({ rewards: rows });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch rewards' });
    }
};
//# sourceMappingURL=challengesController.js.map