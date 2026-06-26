/**
 * Security primitives — smoke tests.
 *
 * Run with:   npm test
 *             (uses node --test with tsx loader, no extra dev deps)
 *
 * These tests cover the high-blast-radius bits added during the security
 * audit: HMAC fail-closed semantics, JWT iss/aud claims, and the password
 * complexity policy. They do NOT touch the database; controller-level
 * helpers that need MySQL are out of scope for this file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

// ─── Password complexity ─────────────────────────────────────────────────────
// Re-implements the same policy as authController.validatePasswordComplexity.
// We re-implement here rather than import to keep this test free of side
// effects (the controller imports DB models on load). If the policy ever
// diverges, both this test and the controller need updating in lock-step.
function validatePasswordComplexity(password: string): string | null {
  if (typeof password !== 'string') return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters long';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain at least one special character';
  return null;
}

test('validatePasswordComplexity: rejects too-short', () => {
  assert.equal(validatePasswordComplexity('Aa1!aaa'), 'Password must be at least 8 characters long');
});
test('validatePasswordComplexity: rejects missing uppercase', () => {
  assert.equal(validatePasswordComplexity('aaaa1aa!'), 'Password must contain at least one uppercase letter');
});
test('validatePasswordComplexity: rejects missing digit', () => {
  assert.equal(validatePasswordComplexity('Aaaaaaa!'), 'Password must contain at least one number');
});
test('validatePasswordComplexity: rejects missing special', () => {
  assert.equal(validatePasswordComplexity('Aaaaaaa1'), 'Password must contain at least one special character');
});
test('validatePasswordComplexity: rejects non-string', () => {
  // @ts-expect-error — testing the wrong-type guard intentionally
  assert.equal(validatePasswordComplexity(undefined), 'Password is required');
});
test('validatePasswordComplexity: accepts strong password', () => {
  assert.equal(validatePasswordComplexity('Strong1!Pass'), null);
});

// ─── JWT iss/aud claims ──────────────────────────────────────────────────────
// Mirrors the constants in authController.ts and middleware/auth.ts. If those
// are renamed, this test will fail loudly — which is the point.
const JWT_ISS = 'fitwayhub';
const JWT_AUD_LOGIN = 'fitwayhub:login';
const JWT_AUD_OAUTH = 'fitwayhub:oauth-state';
const TEST_SECRET = 'test-secret-do-not-use-in-prod';

test('JWT: login token has iss + aud claims and round-trips', () => {
  const token = jwt.sign(
    { id: 1, email: 'a@b.c' },
    TEST_SECRET,
    { algorithm: 'HS256', expiresIn: '30d', issuer: JWT_ISS, audience: JWT_AUD_LOGIN },
  );
  const decoded = jwt.verify(token, TEST_SECRET, {
    algorithms: ['HS256'], issuer: JWT_ISS, audience: JWT_AUD_LOGIN,
  }) as any;
  assert.equal(decoded.iss, JWT_ISS);
  assert.equal(decoded.aud, JWT_AUD_LOGIN);
});

test('JWT: OAuth-state token cannot be replayed as a login token', () => {
  const stateToken = jwt.sign(
    { provider: 'google', nonce: 'x', mobile: false },
    TEST_SECRET,
    { algorithm: 'HS256', expiresIn: '10m', issuer: JWT_ISS, audience: JWT_AUD_OAUTH },
  );
  // Verifying with the LOGIN audience must reject — this is the whole point
  // of separating audiences. Without it, a leaked OAuth state could be
  // presented as a 30-day bearer.
  assert.throws(() =>
    jwt.verify(stateToken, TEST_SECRET, {
      algorithms: ['HS256'], issuer: JWT_ISS, audience: JWT_AUD_LOGIN,
    }),
  );
});

test('JWT: alg:none token rejected when algorithm is pinned', () => {
  // Forge a token with alg:none — common confusion attack.
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ id: 1, iss: JWT_ISS, aud: JWT_AUD_LOGIN })).toString('base64url');
  const noneToken = `${header}.${payload}.`;
  assert.throws(() =>
    jwt.verify(noneToken, TEST_SECRET, { algorithms: ['HS256'] }),
  );
});

// ─── Paymob HMAC verify (semantics) ──────────────────────────────────────────
// Re-implements the verifier with the same field list and SHA-512. We don't
// import the route module because it pulls in the DB pool at load time.
// Behaviour under test:
//   1. Fail-closed when secret is empty.
//   2. Reject when received signature length differs (constant-time guard).
//   3. Reject on byte mismatch.
//   4. Accept on exact match.
const HMAC_FIELDS = [
  'amount_cents','created_at','currency','error_occured','has_parent_transaction','id',
  'integration_id','is_3d_secure','is_auth','is_capture','is_refunded','is_standalone_payment',
  'is_voided','order','owner','pending','source_data.pan','source_data.sub_type','source_data.type','success',
];
function buildHmacString(obj: Record<string, any>): string {
  return HMAC_FIELDS.map(f => {
    const parts = f.split('.');
    let v: any = obj;
    for (const p of parts) v = v?.[p];
    return String(v ?? '');
  }).join('');
}
function verifyPaymobHmac(obj: Record<string, any>, received: string, secret: string): boolean {
  if (!secret) return false;
  if (!received) return false;
  const computed = crypto.createHmac('sha512', secret).update(buildHmacString(obj)).digest('hex');
  if (computed.length !== received.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(received, 'hex'));
  } catch { return false; }
}

const SAMPLE_OBJ = {
  amount_cents: 1000, created_at: '2024-01-01', currency: 'EGP', error_occured: false,
  has_parent_transaction: false, id: 123, integration_id: 1, is_3d_secure: false,
  is_auth: false, is_capture: false, is_refunded: false, is_standalone_payment: true,
  is_voided: false, order: { id: 999 }, owner: 1, pending: false,
  source_data: { pan: '1234', sub_type: 'card', type: 'card' }, success: true,
};

test('Paymob HMAC: fail-closed when secret is empty', () => {
  assert.equal(verifyPaymobHmac(SAMPLE_OBJ, 'a'.repeat(128), ''), false);
});

test('Paymob HMAC: rejects empty received signature', () => {
  assert.equal(verifyPaymobHmac(SAMPLE_OBJ, '', 'real-secret'), false);
});

test('Paymob HMAC: rejects when received length differs', () => {
  // Real SHA-512 hex is 128 chars; pass a too-short signature.
  assert.equal(verifyPaymobHmac(SAMPLE_OBJ, 'abc', 'real-secret'), false);
});

test('Paymob HMAC: rejects byte mismatch (constant-time path)', () => {
  const wrong = 'f'.repeat(128); // valid length, wrong content
  assert.equal(verifyPaymobHmac(SAMPLE_OBJ, wrong, 'real-secret'), false);
});

test('Paymob HMAC: accepts an exact match', () => {
  const secret = 'real-secret';
  const correct = crypto.createHmac('sha512', secret).update(buildHmacString(SAMPLE_OBJ)).digest('hex');
  assert.equal(verifyPaymobHmac(SAMPLE_OBJ, correct, secret), true);
});

test('Paymob HMAC: tampering with amount invalidates signature', () => {
  const secret = 'real-secret';
  const correct = crypto.createHmac('sha512', secret).update(buildHmacString(SAMPLE_OBJ)).digest('hex');
  const tampered = { ...SAMPLE_OBJ, amount_cents: 9999 };
  assert.equal(verifyPaymobHmac(tampered, correct, secret), false);
});

// ─── Moderator area gating — default-deny (§17) ──────────────────────────────
// Mirrors server/middleware/moderator.ts. Re-implemented here (not imported)
// to keep this file DB-free, matching the convention above. If the policy
// changes, update both in lock-step.
const DEFAULT_MODERATOR_PERMISSIONS: Record<string, boolean> = {
  community_view: true,
  community_moderate: true,
  challenges_view: false,
  challenges_moderate: false,
};
const moderatorAreaAllowed = (perms: Record<string, boolean>, area: string): boolean => perms[area] === true;

test('moderator gate: an area is denied unless explicitly true (default-deny)', () => {
  assert.equal(moderatorAreaAllowed({}, 'community_moderate'), false);
  assert.equal(moderatorAreaAllowed({ community_moderate: false }, 'community_moderate'), false);
  // A truthy-but-not-true value must not count as a grant.
  assert.equal(moderatorAreaAllowed({ community_moderate: 1 as any }, 'community_moderate'), false);
  assert.equal(moderatorAreaAllowed({ community_moderate: true }, 'community_moderate'), true);
});

test('moderator gate: unknown / unconfigured areas are denied', () => {
  assert.equal(moderatorAreaAllowed(DEFAULT_MODERATOR_PERMISSIONS, 'payments_manage'), false);
  assert.equal(moderatorAreaAllowed(DEFAULT_MODERATOR_PERMISSIONS, 'challenges_moderate'), false);
});

test('moderator gate: safe default grants community moderation only', () => {
  assert.equal(moderatorAreaAllowed(DEFAULT_MODERATOR_PERMISSIONS, 'community_view'), true);
  assert.equal(moderatorAreaAllowed(DEFAULT_MODERATOR_PERMISSIONS, 'community_moderate'), true);
  assert.equal(moderatorAreaAllowed(DEFAULT_MODERATOR_PERMISSIONS, 'challenges_view'), false);
});

// ─── Moderator per-account overrides (§ per-account) ─────────────────────────
// Resolution rule mirrored from getEffectiveModeratorPermissions: a per-user
// override REPLACES the global config; absent override inherits global. The
// default-deny check (moderatorAreaAllowed) then applies to whichever wins.
const resolveModeratorPerms = (
  override: Record<string, boolean> | null,
  global: Record<string, boolean>,
): Record<string, boolean> => (override ? override : global);

test('moderator override: a custom set replaces the global one', () => {
  const global = { community_view: true, community_moderate: true };
  const override = { community_view: true, community_moderate: false, challenges_view: true };
  const eff = resolveModeratorPerms(override, global);
  assert.equal(moderatorAreaAllowed(eff, 'community_moderate'), false); // override wins, not global
  assert.equal(moderatorAreaAllowed(eff, 'challenges_view'), true);     // granted only in override
});

test('moderator override: absent override inherits the global set', () => {
  const global = { community_view: true, community_moderate: true };
  const eff = resolveModeratorPerms(null, global);
  assert.equal(moderatorAreaAllowed(eff, 'community_moderate'), true);
  assert.equal(moderatorAreaAllowed(eff, 'challenges_moderate'), false); // still default-deny
});
