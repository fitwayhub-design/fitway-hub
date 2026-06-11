/**
 * Challenge goals — unit tests for the pure goal/progress engine.
 *
 * Run with:   npm test
 *
 * challengeGoalTypes.ts deliberately has no DB imports, so these tests cover
 * the per-goal-type progress math (training sessions, walk/run distance,
 * weigh-in baselines, daily check-ins, before/after photos) and the catalog
 * helpers the controllers rely on for validation.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GOAL_TYPES, GOAL_TYPE_KEYS, isGoalType, methodsForGoals, clampGoalTarget,
  defaultGoalTitle, computeGoalProgress, overallGoalsProgress,
} from '../services/challengeGoalTypes.js';

const sub = (over: Partial<any> = {}) => ({
  goal_id: 1, method: 'manual_checkin', metric_value: 1,
  activity_date: '2026-06-01', status: 'approved', ...over,
});

// ─── Catalog ─────────────────────────────────────────────────────────────────
test('catalog: all 7 goal types exist with the agreed tracking methods', () => {
  assert.deepEqual(GOAL_TYPE_KEYS.sort(), [
    'habit', 'nutrition', 'training', 'transformation', 'walk_run', 'weight_gain', 'weight_loss',
  ]);
  assert.deepEqual(GOAL_TYPES.training.methods, ['time_based', 'photo_evidence', 'video_evidence']);
  assert.deepEqual(GOAL_TYPES.walk_run.methods, ['gps_distance', 'photo_evidence', 'video_evidence']);
  assert.deepEqual(GOAL_TYPES.weight_loss.methods, ['weigh_in']);
  assert.deepEqual(GOAL_TYPES.weight_gain.methods, ['weigh_in']);
  assert.deepEqual(GOAL_TYPES.nutrition.methods, ['manual_checkin']);
  assert.deepEqual(GOAL_TYPES.habit.methods, ['manual_checkin']);
  assert.deepEqual(GOAL_TYPES.transformation.methods, ['before_photo', 'after_photo']);
});

test('isGoalType: accepts catalog keys, rejects junk', () => {
  assert.ok(isGoalType('training'));
  assert.ok(!isGoalType('steps'));
  assert.ok(!isGoalType(undefined));
});

test('methodsForGoals: union without duplicates', () => {
  const m = methodsForGoals([{ goal_type: 'training' }, { goal_type: 'walk_run' }, { goal_type: 'habit' }]);
  assert.deepEqual(m.sort(), ['gps_distance', 'manual_checkin', 'photo_evidence', 'time_based', 'video_evidence'].sort());
});

test('clampGoalTarget: bounds per type, transformation pinned to 2', () => {
  assert.equal(clampGoalTarget('walk_run', 99999), 5000);
  assert.equal(clampGoalTarget('weight_loss', 500), 100);
  assert.equal(clampGoalTarget('habit', -5), 0);
  assert.equal(clampGoalTarget('transformation', 77), 2);
});

test('defaultGoalTitle: readable titles per type', () => {
  assert.equal(defaultGoalTitle({ goal_type: 'walk_run', target_value: 50, activity: 'run' }), 'Run 50 km');
  assert.equal(defaultGoalTitle({ goal_type: 'walk_run', target_value: 30, activity: 'walk' }), 'Walk 30 km');
  assert.equal(defaultGoalTitle({ goal_type: 'weight_loss', target_value: 5 }), 'Lose 5 kg');
  assert.equal(defaultGoalTitle({ goal_type: 'training', training_title: 'Full-Body Burn' }), 'Training: Full-Body Burn');
});

// ─── Per-goal progress ───────────────────────────────────────────────────────
test('training: counts distinct approved days, not raw submissions', () => {
  const goal = { id: 1, goal_type: 'training', target_value: 3 };
  const p = computeGoalProgress(goal, [
    sub({ method: 'time_based' }),
    sub({ method: 'time_based' }),                                  // same day — no double count
    sub({ method: 'photo_evidence', activity_date: '2026-06-02' }),
    sub({ method: 'time_based', activity_date: '2026-06-03', status: 'pending' }), // pending — not counted
  ]);
  assert.equal(p.current, 2);
  assert.equal(p.completed, false);
  assert.equal(Math.round(p.pct), 67);
});

test('walk_run: sums approved kilometres toward the distance target', () => {
  const goal = { id: 1, goal_type: 'walk_run', target_value: 10 };
  const p = computeGoalProgress(goal, [
    sub({ method: 'gps_distance', metric_value: 4.5 }),
    sub({ method: 'photo_evidence', metric_value: 5.5, activity_date: '2026-06-02' }),
    sub({ method: 'gps_distance', metric_value: 99, status: 'rejected' }),
  ]);
  assert.equal(p.current, 10);
  assert.equal(p.pct, 100);
  assert.equal(p.completed, true);
});

test('weight_loss: first weigh-in is the baseline, latest is current', () => {
  const goal = { id: 1, goal_type: 'weight_loss', target_value: 5 };
  const p = computeGoalProgress(goal, [
    sub({ method: 'weigh_in', metric_value: 92, activity_date: '2026-06-01' }),
    sub({ method: 'weigh_in', metric_value: 90.5, activity_date: '2026-06-08' }),
    sub({ method: 'weigh_in', metric_value: 89.5, activity_date: '2026-06-15' }),
  ]);
  assert.equal(p.start_weight, 92);
  assert.equal(p.current_weight, 89.5);
  assert.equal(p.current, 2.5);
  assert.equal(p.pct, 50);
  assert.equal(p.completed, false);
});

test('weight_loss: gaining weight never goes negative', () => {
  const goal = { id: 1, goal_type: 'weight_loss', target_value: 5 };
  const p = computeGoalProgress(goal, [
    sub({ method: 'weigh_in', metric_value: 80, activity_date: '2026-06-01' }),
    sub({ method: 'weigh_in', metric_value: 83, activity_date: '2026-06-10' }),
  ]);
  assert.equal(p.current, 0);
  assert.equal(p.pct, 0);
});

test('weight_gain: measures upward delta from baseline', () => {
  const goal = { id: 1, goal_type: 'weight_gain', target_value: 4 };
  const p = computeGoalProgress(goal, [
    sub({ method: 'weigh_in', metric_value: 70, activity_date: '2026-06-01' }),
    sub({ method: 'weigh_in', metric_value: 74, activity_date: '2026-06-20' }),
  ]);
  assert.equal(p.current, 4);
  assert.equal(p.completed, true);
});

test('habit: counts distinct days and flags done_today (pending included)', () => {
  const goal = { id: 1, goal_type: 'habit', target_value: 30 };
  const p = computeGoalProgress(goal, [
    sub({ activity_date: '2026-06-01' }),
    sub({ activity_date: '2026-06-02' }),
    sub({ activity_date: '2026-06-03', status: 'pending' }),
  ], '2026-06-03');
  assert.equal(p.current, 2);            // pending doesn't count toward total…
  assert.equal(p.done_today, true);      // …but does tick today's checkbox
});

test('transformation: needs one before and one after photo', () => {
  const goal = { id: 1, goal_type: 'transformation', target_value: 2 };
  const before = computeGoalProgress(goal, [sub({ method: 'before_photo' })]);
  assert.equal(before.has_before, true);
  assert.equal(before.has_after, false);
  assert.equal(before.completed, false);

  const both = computeGoalProgress(goal, [
    sub({ method: 'before_photo' }),
    sub({ method: 'after_photo', activity_date: '2026-06-20' }),
  ]);
  assert.equal(both.completed, true);
  assert.equal(both.pct, 100);
});

test('transformation: pending photos are surfaced but do not complete the goal', () => {
  const goal = { id: 1, goal_type: 'transformation', target_value: 2 };
  const p = computeGoalProgress(goal, [
    sub({ method: 'before_photo', status: 'pending' }),
  ]);
  assert.equal(p.has_before, false);
  assert.equal(p.before_pending, true);
  assert.equal(p.after_pending, false);
  assert.equal(p.current, 0);
});

test('progress only counts submissions for the right goal_id', () => {
  const goal = { id: 7, goal_type: 'habit', target_value: 10 };
  const p = computeGoalProgress(goal, [
    sub({ goal_id: 7 }),
    sub({ goal_id: 8, activity_date: '2026-06-02' }), // another goal
    sub({ goal_id: null, activity_date: '2026-06-03' }), // legacy
  ]);
  assert.equal(p.current, 1);
});

// ─── Overall ─────────────────────────────────────────────────────────────────
test('overallGoalsProgress: averages per-goal pct, counts completed goals', () => {
  const goals = [
    { id: 1, goal_type: 'habit', target_value: 2 },
    { id: 2, goal_type: 'walk_run', target_value: 10 },
  ];
  const subs = [
    sub({ goal_id: 1 }),
    sub({ goal_id: 1, activity_date: '2026-06-02' }),       // habit complete (100%)
    sub({ goal_id: 2, method: 'gps_distance', metric_value: 5 }), // 50%
  ];
  const o = overallGoalsProgress(goals, subs);
  assert.equal(o.pct, 75);
  assert.equal(o.completedGoals, 1);
  assert.equal(o.perGoal.length, 2);
});

test('overallGoalsProgress: empty goal list is 0 / no goals', () => {
  const o = overallGoalsProgress([], []);
  assert.equal(o.pct, 0);
  assert.equal(o.completedGoals, 0);
});
