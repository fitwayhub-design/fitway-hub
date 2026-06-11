import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveNotificationLink, safeInternalPath } from '../notificationLinks.js';

// ── safeInternalPath: the open-redirect guard for notification links ─────────

test('safeInternalPath accepts plain in-app paths', () => {
  assert.equal(safeInternalPath('/app/workouts'), '/app/workouts');
  assert.equal(safeInternalPath('/coach/profile'), '/coach/profile');
  assert.equal(safeInternalPath('/app/coaching?coach=5'), '/app/coaching?coach=5');
  assert.equal(safeInternalPath('  /app/steps  '), '/app/steps'); // trims
});

test('safeInternalPath rejects absolute and protocol-relative URLs', () => {
  assert.equal(safeInternalPath('https://evil.com/phish'), null);
  assert.equal(safeInternalPath('http://evil.com'), null);
  assert.equal(safeInternalPath('//evil.com'), null);
});

test('safeInternalPath rejects scheme smuggling', () => {
  assert.equal(safeInternalPath('javascript:alert(1)'), null);
  assert.equal(safeInternalPath('data:text/html,<script>1</script>'), null);
  // Backslashes: some URL parsers treat \ as / — refuse outright.
  assert.equal(safeInternalPath('/\\evil.com'), null);
  // Whitespace / control chars inside the path.
  assert.equal(safeInternalPath('/app/wor kouts'), null);
  assert.equal(safeInternalPath('/app/\x00x'), null);
});

test('safeInternalPath rejects empty / non-string input', () => {
  assert.equal(safeInternalPath(''), null);
  assert.equal(safeInternalPath(null), null);
  assert.equal(safeInternalPath(undefined), null);
  assert.equal(safeInternalPath(123 as any), null);
});

// ── resolveNotificationLink: type → route fallbacks ──────────────────────────

test('resolveNotificationLink prefers the explicit link', () => {
  assert.equal(resolveNotificationLink({ link: '/app/challenges', type: 'whatever' }), '/app/challenges');
});

test('resolveNotificationLink falls back on known types', () => {
  assert.equal(resolveNotificationLink({ type: 'workout_reminder' }), '/app/workouts');
  assert.equal(resolveNotificationLink({ type: 'subscription_verified_user' }), '/app/coaching');
});

test('resolveNotificationLink returns null for unknown info notifications', () => {
  assert.equal(resolveNotificationLink({ type: 'info', title: 'hello', body: 'world' }), null);
});

test('explicit malicious link is neutralised by the safeInternalPath wrapper', () => {
  const dest = safeInternalPath(resolveNotificationLink({ link: 'https://attacker.example' }));
  assert.equal(dest, null);
});
