/**
 * challengeGoalTypes — the goal/task catalog for multi-goal challenges.
 *
 * A challenge is no longer one metric + one number: the creator composes a
 * LIST of goals (tasks) from this catalog and athletes work through them like
 * a checklist. Each goal type fixes HOW it is tracked (which verification
 * methods are allowed) so the creator never has to reason about methods —
 * picking "Weight Loss" automatically means photo weigh-ins, picking
 * "Nutrition" automatically means daily check-ins, and so on.
 *
 * This module is intentionally pure (no DB imports) so the progress math can
 * be unit-tested and shared by the scoring engine and the controllers.
 */
export const GOAL_TYPES = {
    training: {
        key: 'training',
        label: 'Training',
        tracking: 'Timed activity + photo/video evidence',
        methods: ['time_based', 'photo_evidence', 'video_evidence'],
        unit: 'sessions',
        needsTarget: true,
        daily: false,
        needsTraining: true,
    },
    walk_run: {
        key: 'walk_run',
        label: 'Walk / Run',
        tracking: 'GPS distance + photo/video evidence',
        methods: ['gps_distance', 'photo_evidence', 'video_evidence'],
        unit: 'km',
        needsTarget: true,
        daily: false,
        needsActivity: true,
    },
    weight_loss: {
        key: 'weight_loss',
        label: 'Weight Loss',
        tracking: 'Photo weigh-ins — starting weight, current weight, progress %',
        methods: ['weigh_in'],
        unit: 'kg',
        needsTarget: true,
        daily: false,
        weighIn: true,
    },
    weight_gain: {
        key: 'weight_gain',
        label: 'Weight / Muscle Gain',
        tracking: 'Photo weigh-ins — starting weight, current weight, progress %',
        methods: ['weigh_in'],
        unit: 'kg',
        needsTarget: true,
        daily: false,
        weighIn: true,
    },
    nutrition: {
        key: 'nutrition',
        label: 'Nutrition',
        tracking: 'Daily check-in',
        methods: ['manual_checkin'],
        unit: 'days',
        needsTarget: true,
        daily: true,
    },
    habit: {
        key: 'habit',
        label: 'Habit',
        tracking: 'Daily completion checkbox',
        methods: ['manual_checkin'],
        unit: 'days',
        needsTarget: true,
        daily: true,
    },
    transformation: {
        key: 'transformation',
        label: 'Transformation',
        tracking: 'Before / after photos',
        methods: ['before_photo', 'after_photo'],
        unit: 'photos',
        needsTarget: false,
        daily: false,
    },
};
export const GOAL_TYPE_KEYS = Object.keys(GOAL_TYPES);
/**
 * Goal-based challenges measure progress as overall completion 0–100%, so
 * everywhere a legacy `goal_target` is expected, this is the target.
 */
export const GOAL_COMPLETION_TARGET = 100;
export function isGoalType(v) {
    return typeof v === 'string' && v in GOAL_TYPES;
}
/** Union of verification methods needed by a set of goals (for challenges.verification_methods). */
export function methodsForGoals(goals) {
    const out = [];
    for (const g of goals) {
        const meta = GOAL_TYPES[g.goal_type];
        if (!meta)
            continue;
        for (const m of meta.methods)
            if (!out.includes(m))
                out.push(m);
    }
    return out;
}
/** Sensible bounds for creator-entered targets, per goal type. */
export function clampGoalTarget(type, value) {
    const v = Math.max(0, Number(value) || 0);
    switch (type) {
        case 'training': return Math.min(v, 500); // sessions
        case 'walk_run': return Math.min(v, 5000); // km
        case 'weight_loss':
        case 'weight_gain': return Math.min(v, 100); // kg delta
        case 'nutrition':
        case 'habit': return Math.min(v, 366); // days
        case 'transformation': return 2; // before + after
        default: return v;
    }
}
/** Auto-title when the creator doesn't type one (e.g. "Run 50 km"). */
export function defaultGoalTitle(g) {
    const t = Number(g.target_value) || 0;
    switch (g.goal_type) {
        case 'training': return g.training_title ? `Training: ${g.training_title}` : 'Complete the training plan';
        case 'walk_run': return `${g.activity === 'run' ? 'Run' : 'Walk'} ${t} km`;
        case 'weight_loss': return `Lose ${t} kg`;
        case 'weight_gain': return `Gain ${t} kg`;
        case 'nutrition': return `Nutrition check-in — ${t} days`;
        case 'habit': return `Daily habit — ${t} days`;
        case 'transformation': return 'Before & after transformation';
        default: return 'Goal';
    }
}
const APPROVED = new Set(['approved', 'auto_approved']);
/**
 * Compute one goal's progress from the participant's approved submissions
 * for that goal. Pure + deterministic: replayable at any time.
 */
export function computeGoalProgress(goal, submissions, today) {
    const meta = GOAL_TYPES[goal.goal_type];
    const mine = submissions.filter(s => Number(s.goal_id) === Number(goal.id));
    const approved = mine
        .filter(s => APPROVED.has(s.status))
        .sort((a, b) => a.activity_date.localeCompare(b.activity_date));
    const target = meta?.needsTarget === false ? 2 : Math.max(0, Number(goal.target_value) || 0);
    const out = { current: 0, target, pct: 0, completed: false };
    if (!meta)
        return out;
    switch (meta.key) {
        case 'training': {
            // One training session per day counts — keeps a burst of uploads from
            // closing a multi-week plan in an afternoon.
            out.current = new Set(approved.map(s => s.activity_date)).size;
            break;
        }
        case 'walk_run': {
            out.current = round2(approved.reduce((a, s) => a + (Number(s.metric_value) || 0), 0));
            break;
        }
        case 'weight_loss':
        case 'weight_gain': {
            const weights = approved.filter(s => Number(s.metric_value) > 0);
            if (weights.length) {
                const start = Number(weights[0].metric_value);
                const latest = Number(weights[weights.length - 1].metric_value);
                out.start_weight = start;
                out.current_weight = latest;
                out.current = round2(Math.max(0, meta.key === 'weight_loss' ? start - latest : latest - start));
            }
            else {
                out.start_weight = null;
                out.current_weight = null;
            }
            break;
        }
        case 'nutrition':
        case 'habit': {
            const days = new Set(approved.map(s => s.activity_date));
            out.current = days.size;
            if (today) {
                // Pending check-ins still tick today's box so the athlete isn't asked twice.
                out.done_today = mine.some(s => s.activity_date === today && s.status !== 'rejected');
            }
            break;
        }
        case 'transformation': {
            out.has_before = approved.some(s => s.method === 'before_photo');
            out.has_after = approved.some(s => s.method === 'after_photo');
            out.before_pending = !out.has_before && mine.some(s => s.method === 'before_photo' && s.status === 'pending');
            out.after_pending = !out.has_after && mine.some(s => s.method === 'after_photo' && s.status === 'pending');
            out.current = (out.has_before ? 1 : 0) + (out.has_after ? 1 : 0);
            break;
        }
    }
    out.pct = target > 0 ? Math.min(100, round2((out.current / target) * 100)) : 0;
    out.completed = target > 0 && out.current >= target;
    return out;
}
/** Overall completion % across all goals (each goal capped at 100%). */
export function overallGoalsProgress(goals, submissions) {
    if (!goals.length)
        return { pct: 0, completedGoals: 0, perGoal: [] };
    const perGoal = goals.map(g => computeGoalProgress(g, submissions));
    const pct = round2(perGoal.reduce((a, p) => a + p.pct, 0) / goals.length);
    const completedGoals = perGoal.filter(p => p.completed).length;
    return { pct, completedGoals, perGoal };
}
function round2(n) {
    return Math.round(n * 100) / 100;
}
//# sourceMappingURL=challengeGoalTypes.js.map