import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID, createHash } from 'crypto';
import { resolve4, resolve6, resolveMx } from 'dns/promises';
import { UserModel } from '../models/User.js';
import { get, run, query } from '../config/database.js';
import { sendWelcomeMessages } from '../notificationService.js';

const DISPOSABLE_OR_FAKE_DOMAINS = new Set([
  'example.com',
  'example.org',
  'example.net',
  'mailinator.com',
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
]);

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is required');
  return secret;
}

function normalizeEmail(input: string) {
  return String(input || '').trim().toLowerCase();
}

async function hasMailCapableDomain(email: string): Promise<boolean> {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain || DISPOSABLE_OR_FAKE_DOMAINS.has(domain)) return false;

  try {
    const mx = await resolveMx(domain);
    if (mx && mx.length > 0) return true;
  } catch (err: any) {
    if (['ENOTFOUND', 'ENODATA', 'ENOTIMP', 'SERVFAIL'].includes(err?.code)) {
      return false;
    }
  }

  try {
    const [a4, a6] = await Promise.allSettled([resolve4(domain), resolve6(domain)]);
    const hasA4 = a4.status === 'fulfilled' && a4.value.length > 0;
    const hasA6 = a6.status === 'fulfilled' && a6.value.length > 0;
    return hasA4 || hasA6;
  } catch {
    return false;
  }
}

// Allowlist of hosts the OAuth callback is allowed to redirect to when
// APP_BASE_URL is unset. Mirrors the CORS `buildAllowedOrigins()` set in
// server.ts so we cannot trust an origin that CORS would reject.
const FALLBACK_BASE_HOSTS = new Set([
  'localhost', '127.0.0.1', 'peter-adel.taila6a2b4.ts.net',
]);

function getAppBaseUrl(req: Request) {
  // Prefer the explicit env var (production deployments must set this).
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, '');

  // SECURITY: the Host header is attacker-controlled. Without validation an
  // attacker can poison OAuth callback URLs to exfiltrate the issued token via
  // `Host: attacker.com`. Validate against an allowlist before trusting it,
  // and fall back to a safe default rather than echoing the spoofed host.
  const host = String(req.get('host') || '').split(':')[0].toLowerCase();
  if (FALLBACK_BASE_HOSTS.has(host)) {
    return `${req.protocol}://${req.get('host')}`;
  }
  // Last-resort safe default. In production APP_BASE_URL must be set.
  return 'http://localhost';
}

function getMobileAppBaseUrl() {
  const scheme = String(process.env.MOBILE_APP_SCHEME || 'fitwayhub').trim().toLowerCase();
  return `${scheme}://auth`;
}

// SECURITY: JWT issuer + audience claims. The same secret is used to mint
// login tokens and short-lived OAuth state tokens. Without `aud` separation,
// an OAuth state token (10 min, low value) could be replayed as a login token
// (30 day, full session). The issuer claim narrows the trust boundary so
// tokens minted by other services that share the secret can't impersonate us.
//
// Verification is intentionally tolerant of missing claims (legacy tokens
// issued before this change) so existing logged-in users aren't kicked out
// on deploy. After ~30 days every legacy token will have expired and the
// `requireClaims` flag below can be flipped to `true`.
export const JWT_ISS = 'fitwayhub';
export const JWT_AUD_LOGIN = 'fitwayhub:login';
export const JWT_AUD_OAUTH = 'fitwayhub:oauth-state';

function issueLoginToken(user: any) {
  // Pin algorithm explicitly to defeat algorithm-confusion attacks (e.g. forced "alg: none"
  // or RS256→HS256 substitution if the secret is ever reused as a public key).
  return jwt.sign(
    { id: user.id, email: user.email },
    getJwtSecret(),
    { algorithm: 'HS256', expiresIn: '30d', issuer: JWT_ISS, audience: JWT_AUD_LOGIN },
  );
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function issueOauthState(provider: 'google' | 'facebook', mobile: boolean = false) {
  return jwt.sign(
    { provider, nonce: randomUUID(), mobile },
    getJwtSecret(),
    { algorithm: 'HS256', expiresIn: '10m', issuer: JWT_ISS, audience: JWT_AUD_OAUTH },
  );
}

function verifyOauthState(state: string | undefined, provider: 'google' | 'facebook'): { valid: boolean; mobile: boolean } {
  if (!state) return { valid: false, mobile: false };
  try {
    // Restrict to HS256 AND require the OAuth-state audience so a stolen
    // 30-day login token cannot be replayed as a 10-minute OAuth state.
    const decoded = jwt.verify(state, getJwtSecret(), {
      algorithms: ['HS256'],
      issuer: JWT_ISS,
      audience: JWT_AUD_OAUTH,
    }) as any;
    return { valid: decoded?.provider === provider, mobile: !!decoded?.mobile };
  } catch {
    return { valid: false, mobile: false };
  }
}

async function createOrGetSocialUser(params: { email: string; name?: string; avatar?: string; provider: 'google' | 'facebook' }) {
  const email = normalizeEmail(params.email);
  const existing = await UserModel.findByEmail(email);
  if (existing) {
    if (params.name || params.avatar) {
      await UserModel.updateProfile(existing.id, { name: params.name, avatar: params.avatar });
    }
    return existing;
  }

  const generatedPasswordHash = await bcrypt.hash(`social-${params.provider}-${randomUUID()}`, 12);
  const user = await UserModel.create(email, generatedPasswordHash);
  await run(
    'UPDATE users SET name = ?, role = ?, avatar = ?, is_premium = 0, membership_paid = 0 WHERE id = ?',
    [params.name || email.split('@')[0], 'user', params.avatar || null, user.id]
  );

  const regPoints = await get<any>('SELECT setting_value FROM app_settings WHERE setting_key = ?', ['registration_points_gift']);
  const pointsGift = parseInt((regPoints as any)?.setting_value || '200');
  await run('UPDATE users SET points = ? WHERE id = ?', [pointsGift, user.id]);
  await run('INSERT INTO point_transactions (user_id, points, reason, reference_type) VALUES (?,?,?,?)', [user.id, pointsGift, `Welcome gift - ${params.provider} signup`, 'registration']);

  // Fire-and-forget: send welcome messages for new social user
  const userName = params.name || email.split('@')[0];
  sendWelcomeMessages(user.id, 'user', userName, email).catch(e => console.error('Welcome messages error:', e));

  return user;
}

async function finalizeSocialLogin(res: Response, req: Request, data: { email: string; name?: string; avatar?: string; provider: 'google' | 'facebook' }, mobile: boolean = false) {
  const user = await createOrGetSocialUser(data);
  const token = issueLoginToken(user);
  const base = mobile ? getMobileAppBaseUrl() : getAppBaseUrl(req);
  return res.redirect(`${base}/auth/social-callback?token=${encodeURIComponent(token)}`);
}

// Password complexity policy — keep in sync with forgotPasswordVerify and changePassword.
function validatePasswordComplexity(password: string): string | null {
  if (typeof password !== 'string') return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters long';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain at least one special character';
  return null;
}

export const register = async (req: Request, res: Response) => {
  try {
    const { password, name, role, securityQuestion, securityAnswer } = req.body;
    const email = normalizeEmail(req.body?.email);
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });
    if (!securityQuestion || !securityAnswer) return res.status(400).json({ message: 'Security question and answer are required' });

    // Email format validation
    const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) return res.status(400).json({ message: 'Please enter a valid email address' });

    const hasValidDomain = await hasMailCapableDomain(email);
    if (!hasValidDomain) return res.status(400).json({ message: 'Email domain is not valid for receiving mail' });

    const passwordError = validatePasswordComplexity(password);
    if (passwordError) return res.status(400).json({ message: passwordError });

    const existing = await UserModel.findByEmail(email);
    if (existing) return res.status(409).json({ message: 'An account with this email already exists' });
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await UserModel.create(email, hashedPassword);

    // SECURITY: strict allowlist — only 'user' or 'coach' may be self-selected.
    // Privileged roles ('admin', 'moderator') are NEVER assignable from the registration body
    // and must be granted by an existing admin via /api/admin/users/:id/role. Coach actions
    // that earn money are still gated by `coach_membership_active` (see requireActiveCoachMembershipForDeals).
    const PUBLIC_ROLES = ['user', 'coach'] as const;
    type PublicRole = typeof PUBLIC_ROLES[number];
    const userRole: PublicRole = (PUBLIC_ROLES as readonly string[]).includes(role) ? role as PublicRole : 'user';
    if (name) await run('UPDATE users SET name = ?, role = ?, is_premium = 0, membership_paid = 0 WHERE id = ?', [name, userRole, user.id]);
    else await run('UPDATE users SET role = ?, is_premium = 0, membership_paid = 0 WHERE id = ?', [userRole, user.id]);
    
    // Save security question & hashed answer
    const hashedAnswer = await bcrypt.hash(securityAnswer.trim().toLowerCase(), 12);
    await UserModel.setSecurityQuestion(user.id, securityQuestion, hashedAnswer);
    
    // Gift system: 200 points on registration
    const regPoints = await get<any>('SELECT setting_value FROM app_settings WHERE setting_key = ?', ['registration_points_gift']);
    const pointsGift = parseInt((regPoints as any)?.setting_value || '200');
    await run('UPDATE users SET points = ? WHERE id = ?', [pointsGift, user.id]);
    await run('INSERT INTO point_transactions (user_id, points, reason, reference_type) VALUES (?,?,?,?)', [user.id, pointsGift, 'Welcome gift - registration bonus', 'registration']);
    
    let rememberRenewToken = null;
    if (String(req.body?.rememberMe) === 'true') {
      rememberRenewToken = randomUUID();
      await UserModel.setRememberToken(user.id, rememberRenewToken);
    }

    const token = issueLoginToken(user);
    const ip = getClientIp(req);
    const fullUser = await get('SELECT id, name, email, role, avatar, is_premium, coach_membership_active, membership_paid, points, steps, step_goal, height, weight, gender, created_at FROM users WHERE id = ?', [user.id]);
    res.status(201).json({ message: 'User registered successfully', token, user: fullUser, rememberToken: rememberRenewToken });

    // Fire-and-forget: send welcome messages (push, email, in-app)
    sendWelcomeMessages(user.id, userRole as 'user' | 'coach', name || email.split('@')[0], email).catch(e => console.error('Welcome messages error:', e));
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const password = req.body?.password;
    const email = normalizeEmail(req.body?.email);
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });
    const user = await UserModel.findByEmail(email) || await UserModel.findByUsername(email);
    if (!user || !user.password) return res.status(401).json({ message: 'Invalid credentials' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });
    
    let rememberRenewToken = null;
    if (String(req.body?.rememberMe) === 'true') {
      rememberRenewToken = randomUUID();
      await UserModel.setRememberToken(user.id, rememberRenewToken);
    }
    
    const token = issueLoginToken(user);
    const ip = getClientIp(req);

    const fullUser = await get('SELECT id, name, email, role, avatar, is_premium, coach_membership_active, membership_paid, points, steps, step_goal, height, weight, gender, created_at FROM users WHERE id = ?', [user.id]);
    res.json({ message: 'Login successful', token, user: fullUser, rememberToken: rememberRenewToken });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

export const forgotPasswordGetQuestion = async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ message: 'Email is required' });
    const user = await UserModel.findByEmail(email) || await UserModel.findByUsername(email);
    // Don't reveal whether account exists — always return a generic response
    if (!user || !user.security_question) return res.json({ question: 'Please answer your security question' });
    return res.json({ question: user.security_question });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const forgotPasswordVerify = async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const { securityAnswer, newPassword } = req.body;
    if (!email || !securityAnswer || !newPassword) return res.status(400).json({ message: 'Email, security answer, and new password are required' });

    // Enforce the same complexity policy as registration. Mismatched policies let
    // attackers reset to weaker passwords and bypass the entropy floor at the front door.
    const passwordError = validatePasswordComplexity(newPassword);
    if (passwordError) return res.status(400).json({ message: passwordError });

    const user = await UserModel.findByEmail(email) || await UserModel.findByUsername(email);
    // Constant-ish response: do not reveal whether the email exists. We always return
    // the same generic 401 for "no such account" or "wrong answer" so the endpoint
    // can't be used for account enumeration.
    if (!user || !user.security_answer) {
      return res.status(401).json({ message: 'Email or security answer is incorrect' });
    }
    const answerMatch = await bcrypt.compare(securityAnswer.trim().toLowerCase(), user.security_answer);
    if (!answerMatch) return res.status(401).json({ message: 'Email or security answer is incorrect' });
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await UserModel.updatePassword(user.id, hashedPassword);

    // Invalidate any outstanding remember tokens — they were issued under the old credential.
    try { await UserModel.setRememberToken(user.id, null as any); } catch { /* table column nullable; non-fatal */ }
    return res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const logout = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (userId) {
    }

    // Blacklist the token so it's dead immediately even though JWT is stateless
    if (token && userId) {
      try {
        const tokenHash = createHash('sha256').update(token).digest('hex').slice(0, 32);
        await run(
          'INSERT IGNORE INTO revoked_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 31 DAY))',
          [userId, tokenHash]
        );
        // Prune old revoked tokens while we're here (non-fatal)
        await run('DELETE FROM revoked_tokens WHERE expires_at < NOW()').catch(() => {});
      } catch { /* revoked_tokens table may not exist yet — non-fatal */ }
    }

    res.json({ message: 'Logged out successfully' });
  } catch {
    res.json({ message: 'Logged out' });
  }
};

export const changePassword = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Current and new password are required' });
    const passwordError = validatePasswordComplexity(newPassword);
    if (passwordError) return res.status(400).json({ message: passwordError });
    const user = await UserModel.findById(userId);
    if (!user || !user.password) return res.status(404).json({ message: 'User not found' });
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Current password is incorrect' });
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await UserModel.updatePassword(userId, hashedPassword);
    // Rotate any active remember-me token after a password change.
    try { await UserModel.setRememberToken(userId, null as any); } catch { /* non-fatal */ }
    return res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const changeEmail = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { currentPassword, newEmail } = req.body || {};
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!currentPassword || !newEmail) {
      return res.status(400).json({ message: 'Current password and new email are required' });
    }

    const normalizedEmail = normalizeEmail(newEmail);
    const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    const user = await UserModel.findById(userId);
    if (!user || !user.password) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Current password is incorrect' });

    const existing = await UserModel.findByEmail(normalizedEmail);
    if (existing && existing.id !== userId) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    if (normalizedEmail === normalizeEmail(user.email)) {
      return res.status(400).json({ message: 'New email is the same as current email' });
    }

    await run('UPDATE users SET email = ? WHERE id = ?', [normalizedEmail, userId]);
    return res.json({ message: 'Email changed successfully', email: normalizedEmail });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};

export const loginWithRememberToken = async (req: Request, res: Response) => {
  try {
    const { rememberToken } = req.body;
    if (!rememberToken) return res.status(400).json({ message: 'Remember token is required' });
    const user = await UserModel.findByRememberToken(rememberToken);
    if (!user) return res.status(401).json({ message: 'Invalid remember token' });
    const token = jwt.sign(
      { id: user.id, email: user.email },
      getJwtSecret(),
      { algorithm: 'HS256', expiresIn: '1d', issuer: JWT_ISS, audience: JWT_AUD_LOGIN },
    );
    // Rotate the remember-me token on each silent login so a stolen token only buys one redemption.
    try {
      const rotated = randomUUID();
      await UserModel.setRememberToken(user.id, rotated);
      const { password: _, ...userWithoutPassword } = user;
      return res.json({ message: 'Auto-login successful', token, user: userWithoutPassword, rememberToken: rotated });
    } catch {
      const { password: _, ...userWithoutPassword } = user;
      return res.json({ message: 'Auto-login successful', token, user: userWithoutPassword });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const oauthGoogleStart = async (req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return res.redirect(`${getAppBaseUrl(req)}/auth/login?error=${encodeURIComponent('Google OAuth is not configured')}`);
  }

  const isMobile = req.query.platform === 'mobile';
  const state = issueOauthState('google', isMobile);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
};

export const oauthGoogleCallback = async (req: Request, res: Response) => {
  try {
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    const { valid, mobile } = verifyOauthState(state, 'google');
    const errorBase = mobile ? getMobileAppBaseUrl() : getAppBaseUrl(req);
    if (!valid) {
      return res.redirect(`${errorBase}/auth/login?error=${encodeURIComponent('Invalid OAuth state')}`);
    }
    if (!code) {
      return res.redirect(`${errorBase}/auth/login?error=${encodeURIComponent('Missing Google OAuth code')}`);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
      return res.redirect(`${errorBase}/auth/login?error=${encodeURIComponent('Google OAuth not configured')}`);
    }

    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData: any = await tokenResp.json();
    if (!tokenResp.ok || !tokenData.access_token) {
      return res.redirect(`${errorBase}/auth/login?error=${encodeURIComponent('Google token exchange failed')}`);
    }

    const profileResp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile: any = await profileResp.json();

    const email = normalizeEmail(profile?.email);
    if (!email) {
      return res.redirect(`${errorBase}/auth/login?error=${encodeURIComponent('Google account has no email')}`);
    }

    return finalizeSocialLogin(res, req, {
      provider: 'google',
      email,
      name: profile?.name,
      avatar: profile?.picture,
    }, mobile);
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return res.redirect(`${getAppBaseUrl(req)}/auth/login?error=${encodeURIComponent('Google login failed')}`);
  }
};

export const oauthFacebookStart = async (req: Request, res: Response) => {
  const clientId = process.env.FACEBOOK_APP_ID;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return res.redirect(`${getAppBaseUrl(req)}/auth/login?error=${encodeURIComponent('Facebook OAuth is not configured')}`);
  }

  const isMobile = req.query.platform === 'mobile';
  const state = issueOauthState('facebook', isMobile);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'email,public_profile',
    state,
  });
  return res.redirect(`https://www.facebook.com/v20.0/dialog/oauth?${params.toString()}`);
};

export const oauthFacebookCallback = async (req: Request, res: Response) => {
  try {
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    const { valid, mobile } = verifyOauthState(state, 'facebook');
    const errorBase = mobile ? getMobileAppBaseUrl() : getAppBaseUrl(req);
    if (!valid) {
      return res.redirect(`${errorBase}/auth/login?error=${encodeURIComponent('Invalid OAuth state')}`);
    }
    if (!code) {
      return res.redirect(`${errorBase}/auth/login?error=${encodeURIComponent('Missing Facebook OAuth code')}`);
    }

    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    const redirectUri = process.env.FACEBOOK_REDIRECT_URI;
    if (!appId || !appSecret || !redirectUri) {
      return res.redirect(`${errorBase}/auth/login?error=${encodeURIComponent('Facebook OAuth not configured')}`);
    }

    const tokenParams = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    });
    const tokenResp = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token?${tokenParams.toString()}`);
    const tokenData: any = await tokenResp.json();
    if (!tokenResp.ok || !tokenData.access_token) {
      return res.redirect(`${errorBase}/auth/login?error=${encodeURIComponent('Facebook token exchange failed')}`);
    }

    const profileParams = new URLSearchParams({
      fields: 'id,name,email,picture.type(large)',
      access_token: tokenData.access_token,
    });
    const profileResp = await fetch(`https://graph.facebook.com/me?${profileParams.toString()}`);
    const profile: any = await profileResp.json();

    const email = normalizeEmail(profile?.email);
    if (!email) {
      return res.redirect(`${errorBase}/auth/login?error=${encodeURIComponent('Facebook account has no email')}`);
    }

    return finalizeSocialLogin(res, req, {
      provider: 'facebook',
      email,
      name: profile?.name,
      avatar: profile?.picture?.data?.url,
    }, mobile);
  } catch (error) {
    console.error('Facebook OAuth callback error:', error);
    return res.redirect(`${getAppBaseUrl(req)}/auth/login?error=${encodeURIComponent('Facebook login failed')}`);
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const { height, weight, gender, name, avatar } = req.body;
    const result = await UserModel.updateProfile(userId, { height, weight, gender, name, avatar });
    if (result === null) return res.status(400).json({ message: 'No profile fields provided' });
    const updated = await UserModel.findById(userId);
    const { password: _, ...userWithoutPassword } = updated || {} as any;
    res.json({ message: 'Profile updated', user: userWithoutPassword });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const addOfflineSteps = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    // Accept both single entry and batch array
    const body = req.body;
    const entries: any[] = Array.isArray(body) ? body : [body];

    let synced = 0;
    for (const entry of entries) {
      const { steps, date, caloriesBurned, distanceKm, trackingMode, notes } = entry;
      if (!steps || !date) continue;

      // Upsert — if entry already exists for that date, accumulate steps
      const existing: any = await get('SELECT id, steps FROM steps_entries WHERE user_id = ? AND date = ?', [userId, date]);
      if (existing) {
        const newSteps = Math.max(existing.steps, steps); // take highest value to avoid doubling
        await run(
          'UPDATE steps_entries SET steps = ?, calories_burned = COALESCE(?, calories_burned), distance_km = COALESCE(?, distance_km), tracking_mode = COALESCE(?, tracking_mode), notes = COALESCE(?, notes) WHERE user_id = ? AND date = ?',
          [newSteps, caloriesBurned || null, distanceKm || null, trackingMode || null, notes || null, userId, date]
        );
      } else {
        await run(
          'INSERT INTO steps_entries (user_id, date, steps, calories_burned, distance_km, tracking_mode, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [userId, date, steps, caloriesBurned || null, distanceKm || null, trackingMode || 'manual', notes || null]
        );
      }

      // Update the user's overall steps to the most recent day's total
      await run('UPDATE users SET steps = ?, last_sync = NOW() WHERE id = ?', [steps, userId]);
      synced++;
    }

    res.json({ message: `Synced ${synced} entr${synced === 1 ? 'y' : 'ies'}`, synced });
  } catch (error) {
    console.error('addOfflineSteps error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
