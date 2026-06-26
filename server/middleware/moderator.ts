import { Request, Response, NextFunction } from 'express';
import { get, run } from '../config/database.js';

// ─────────────────────────────────────────────────────────────────────────────
//  Moderator access — single source of truth (§17 lockdown)
//
//  Previously moderator gating was scattered: a local `modPerm` in adminRoutes
//  that DEFAULT-ALLOWED any area (no config row = full access), plus several
//  routes that checked `['admin','moderator']` directly and therefore ignored
//  the Settings → Moderators toggles entirely. A freshly-promoted moderator
//  effectively had admin-level reach.
//
//  This module is now the ONE gate every moderator-reachable route uses:
//    • DEFAULT-DENY — an area is allowed only if explicitly set to `true`.
//    • A brand-new setup (no config row) starts at the minimal safe default
//      (community moderation only); everything else must be granted by an
//      admin in Settings → Moderators.
//    • Admins always pass. Anyone who is neither admin nor moderator is denied.
//
//  Finance / role-changes / email / website / settings stay strictly
//  `adminOnly` in their own route files — never reachable by a moderator.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimal least-privilege baseline used when no `moderator_permissions` row
 * exists yet. New moderators can moderate the community and nothing else until
 * an admin grants more.
 */
export const DEFAULT_MODERATOR_PERMISSIONS: Record<string, boolean> = {
  community_view: true,
  community_moderate: true,
  challenges_view: false,
  challenges_moderate: false,
};

/**
 * The effective moderator permission map. Returns the admin-configured object
 * verbatim when a row exists (any key absent or not `true` => denied), or the
 * least-privilege default when nothing has been configured. The enforcement
 * gate and the admin Settings UI both read this so what an admin sees matches
 * what moderators actually get.
 */
export async function getModeratorPermissions(): Promise<Record<string, boolean>> {
  try {
    const row: any = await get("SELECT setting_value FROM app_settings WHERE setting_key = 'moderator_permissions'");
    if (row?.setting_value) {
      const parsed = JSON.parse(row.setting_value);
      if (parsed && typeof parsed === 'object') return parsed as Record<string, boolean>;
    }
  } catch {
    /* fall through to the safe default */
  }
  return { ...DEFAULT_MODERATOR_PERMISSIONS };
}

/** True only when the area is explicitly enabled (default-deny). */
export function moderatorAreaAllowed(perms: Record<string, boolean>, area: string): boolean {
  return perms[area] === true;
}

/**
 * Per-moderator OVERRIDE, if one exists. A row in moderator_user_permissions
 * replaces the global config for that single moderator; absent => inherit global.
 */
export async function getModeratorUserOverride(userId: number): Promise<Record<string, boolean> | null> {
  try {
    const row: any = await get('SELECT permissions FROM moderator_user_permissions WHERE user_id = ?', [userId]);
    if (row?.permissions) {
      const parsed = JSON.parse(row.permissions);
      if (parsed && typeof parsed === 'object') return parsed as Record<string, boolean>;
    }
  } catch {
    /* fall back to global */
  }
  return null;
}

/** The permissions actually in force for a moderator: their own override, else global. */
export async function getEffectiveModeratorPermissions(userId: number): Promise<Record<string, boolean>> {
  const override = await getModeratorUserOverride(userId);
  if (override) return override;
  return getModeratorPermissions();
}

/**
 * Single source of truth for "may this user reach `area`": admin always; a
 * moderator only if their effective (override-or-global) permissions grant it;
 * anyone else never. Used by the route gate and by ad-hoc checks (e.g. tickets).
 */
export async function moderatorCanAccessArea(user: { id: number; role?: string } | undefined, area: string): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role !== 'moderator') return false;
  const perms = await getEffectiveModeratorPermissions(user.id);
  return moderatorAreaAllowed(perms, area);
}

/**
 * Gate for any route a moderator may reach. Admin passes unconditionally; a
 * moderator passes only if `area` is granted by their effective permissions
 * (per-account override, else global); everyone else 403s.
 */
export const requireModeratorArea = (area: string) =>
  async (req: any, res: Response, next: NextFunction) => {
    const role = req.user?.role;
    if (role === 'admin') return next();
    if (role !== 'moderator') return res.status(403).json({ message: 'Access denied' });
    const perms = await getEffectiveModeratorPermissions(req.user.id);
    if (moderatorAreaAllowed(perms, area)) return next();
    return res.status(403).json({ message: 'Your moderator access does not allow this action' });
  };

/** Strict admin gate (never a moderator) — for financial / config surfaces. */
export const requireAdmin = (req: any, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  next();
};

interface ModeratorActionLog {
  area?: string;
  action: string;
  targetType?: string;
  targetId?: string | number | null;
  details?: unknown;
}

/**
 * Append-only audit record for a privileged moderation action. Best-effort:
 * an audit-write failure must never break the action it is recording. Logs the
 * acting user's id + role so admin actions are auditable alongside moderators'.
 */
export async function logModeratorAction(req: Request, entry: ModeratorActionLog): Promise<void> {
  try {
    const user = (req as any).user;
    if (!user?.id) return;
    const details =
      entry.details == null ? null
      : typeof entry.details === 'string' ? entry.details
      : JSON.stringify(entry.details);
    await run(
      `INSERT INTO moderator_audit_log (actor_id, actor_role, area, action, target_type, target_id, details)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.role || 'unknown',
        entry.area || null,
        entry.action,
        entry.targetType || null,
        entry.targetId == null ? null : String(entry.targetId),
        details,
      ],
    );
  } catch (err) {
    console.error('logModeratorAction failed (non-fatal):', err);
  }
}

/**
 * Middleware that records a moderation action once the response finishes
 * successfully (2xx/3xx). Lets controller-driven routes (where the controller
 * owns the response) be audited without touching the controller body.
 */
export const auditModeratorAction = (
  area: string,
  action: string,
  targetType?: string,
  getTargetId?: (req: Request) => string | number | null | undefined,
) => (req: Request, res: Response, next: NextFunction) => {
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 400) {
      void logModeratorAction(req, {
        area,
        action,
        targetType,
        targetId: getTargetId ? getTargetId(req) : (req.params as any)?.id,
      });
    }
  });
  next();
};
