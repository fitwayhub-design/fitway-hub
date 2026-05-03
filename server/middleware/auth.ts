import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { get } from '../config/database';

interface JwtPayload { id: number; email: string; role?: string; }

const COACH_GRACE_DAYS = 7;

interface CoachMembershipPolicy {
  isCoach: boolean;
  membershipActive: boolean;
  isWithinGracePeriod: boolean;
  graceDaysLeft: number;
  daysSinceCreated: number;
}

function getDaysSince(dateInput: string | null | undefined): number {
  if (!dateInput) return 0;
  const created = new Date(dateInput).getTime();
  if (Number.isNaN(created)) return 0;
  return Math.max(0, (Date.now() - created) / (1000 * 60 * 60 * 24));
}

function getCoachMembershipPolicy(userRow: any): CoachMembershipPolicy {
  const isCoach = userRow?.role === 'coach';
  const membershipActive = !!(userRow?.coach_membership_active || userRow?.membership_paid);
  const daysSinceCreated = getDaysSince(userRow?.created_at);
  const isWithinGracePeriod = daysSinceCreated <= COACH_GRACE_DAYS;
  const graceDaysLeft = Math.max(0, Math.ceil(COACH_GRACE_DAYS - daysSinceCreated));

  return {
    isCoach,
    membershipActive,
    isWithinGracePeriod,
    graceDaysLeft,
    daysSinceCreated,
  };
}

declare global {
  namespace Express {
    interface Request { user?: JwtPayload & { role: string }; }
  }
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access token required' });
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ message: 'Server misconfiguration' });
    // Pin algorithm to HS256 — refuse 'none' and asymmetric/HS-confusion attempts.
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as JwtPayload & { iss?: string; aud?: string | string[] };

    // SECURITY: enforce iss/aud claims when present (tolerant of legacy tokens
    // issued before these claims were added — they keep working until they
    // expire). New tokens always have these claims. After all legacy tokens
    // have expired (~30 days post-deploy) this should become strict by passing
    // { issuer, audience } directly to jwt.verify above.
    const JWT_ISS = 'fitwayhub';
    const JWT_AUD_LOGIN = 'fitwayhub:login';
    if (decoded.iss !== undefined && decoded.iss !== JWT_ISS) {
      return res.status(403).json({ message: 'Invalid token issuer' });
    }
    if (decoded.aud !== undefined) {
      const auds = Array.isArray(decoded.aud) ? decoded.aud : [decoded.aud];
      if (!auds.includes(JWT_AUD_LOGIN)) {
        // An OAuth-state token (or any other audience) was presented as a
        // bearer login token — refuse it.
        return res.status(403).json({ message: 'Token not valid for this resource' });
      }
    }

    // Check if this token was explicitly revoked (via logout).
    // SECURITY: previously this query had a `.catch(() => null)` fallback that
    // failed OPEN — any DB error (table missing, connection drop, replication
    // lag) would silently allow revoked tokens through. The table is created
    // unconditionally in initDatabase() so it always exists after first boot.
    // For transient DB errors we now fail CLOSED with 503 so the client retries
    // rather than being silently authenticated with a revoked bearer.
    const tokenHash = createHash('sha256').update(token).digest('hex').slice(0, 32);
    let revoked: any = null;
    try {
      revoked = await get<any>(
        'SELECT id FROM revoked_tokens WHERE token_hash = ? AND user_id = ?',
        [tokenHash, decoded.id],
      );
    } catch (dbErr) {
      console.error('Auth: revoked_tokens lookup failed (failing closed):', dbErr);
      return res.status(503).json({ message: 'Authentication temporarily unavailable, please retry' });
    }
    if (revoked) return res.status(401).json({ message: 'Token has been revoked. Please log in again.' });

    const user = await get<any>('SELECT role FROM users WHERE id = ?', [decoded.id]);
    (req as any).user = { ...decoded, role: user?.role || 'user' };
    next();
  } catch (err: any) {
    // If it's specifically a JWT verification error
    if (err?.name === 'JsonWebTokenError' || err?.name === 'TokenExpiredError') {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    // Database or other internal errors should not trigger a 403 (logoff)
    console.error('Auth middleware error:', err);
    return res.status(500).json({ message: 'Internal server error during authentication' });
  }
};

// Coaches can access the app without membership, but deal actions require active membership.
export const requireActiveCoachMembershipForDeals = async (req: any, res: Response, next: NextFunction) => {
  try {
    if (req.user?.role === 'admin') return next();
    if (req.user?.role !== 'coach') return next();

    const userRow = await get<any>(
      'SELECT role, coach_membership_active, membership_paid, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!userRow) return res.status(404).json({ message: 'User not found' });

    const policy = getCoachMembershipPolicy(userRow);
    if (policy.membershipActive) return next();

    return res.status(403).json({
      message: policy.isWithinGracePeriod
        ? `Your 7-day coach access period is active (${policy.graceDaysLeft} day(s) left), but deals are locked until membership payment is completed.`
        : 'Coach membership payment is required to continue. Deal actions are locked until membership is activated.',
      code: 'COACH_DEALS_LOCKED',
      graceDaysLeft: policy.graceDaysLeft,
      membershipActive: false,
    });
  } catch {
    return res.status(500).json({ message: 'Failed to validate coach membership status' });
  }
};
