/**
 * Avatar utility — generates deterministic initials SVG avatars.
 */

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4',
  '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'
];

/** Deterministic hash — same seed always returns same number */
function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function getInitials(name: string): string {
  if (!name) return 'U';
  // If it's an email, try to use the part before @
  let text = name;
  if (name.includes('@')) {
    text = name.split('@')[0].replace('.', ' ');
  }
  const clean = text.trim();
  if (!clean) return 'U';
  
  const parts = clean.split(/[\s_-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }
  return clean.substring(0, 2).toUpperCase();
}

/**
 * Returns an initials-based SVG avatar URL if no uploaded image exists.
 * @param seed    - User email or name (used for deterministic color; also used for initials if no name param)
 * @param uploaded - Already-uploaded avatar URL (returned as-is if valid)
 * @param gender  - (Ignored, kept for signature compatibility)
 * @param name    - Preferred source for initials (first two letters of full name)
 */
export function getAvatar(
  seed: string | number | null | undefined,
  uploaded?: string | null,
  gender?: string | null,
  name?: string | null,
): string {
  if (uploaded && uploaded.trim() && !uploaded.includes('dicebear') && !uploaded.includes('avataaars') && !uploaded.includes('unsplash')) {
    return uploaded;
  }

  const seedStr = seed == null ? '' : String(seed);
  const initialsSource = (name && name.trim()) || seedStr || 'User';
  const colorSource = seedStr || 'User';
  const initials = getInitials(initialsSource);
  const h = hash(colorSource);
  const color = COLORS[h % COLORS.length];

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" fill="${color}" />
      <text x="50" y="50" font-family="Arial, sans-serif" font-size="44" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="central">${initials}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Drop-in helper that accepts a full user object */
export function avatarUrl(
  user: { avatar?: string | null; email?: string; name?: string; gender?: string | null } | null | undefined,
): string {
  if (!user) return getAvatar('User');
  return getAvatar(user.name || user.email || 'User', user.avatar, user.gender);
}
