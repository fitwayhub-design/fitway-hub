/**
 * Notification Service — FCM push, welcome emails, in-app notifications.
 *
 * Push notifications use Firebase Cloud Messaging (FCM) HTTP v1 API.
 * Welcome emails are sent via the existing SMTP email system.
 */

import { run, query, get } from './config/database.js';
import { getSmtpSettings, sendMail, sendSystemEmail } from './emailServer.js';

// ── Token helpers ──────────────────────────────────────────────────────────────

function replaceTokens(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

// ── FCM Push via HTTP v1 ───────────────────────────────────────────────────────

// Cache the OAuth token so we don't re-sign every send
let _fcmTokenCache: { token: string; exp: number } | null = null;

async function getFcmAccessToken(): Promise<string | null> {
  // Return cached token if still valid
  if (_fcmTokenCache && Date.now() < _fcmTokenCache.exp) return _fcmTokenCache.token;

  // Load service account — from JSON env var (preferred) or file path
  let sa: any = null;
  try {
    if (process.env.FCM_SERVICE_ACCOUNT_JSON) {
      sa = JSON.parse(process.env.FCM_SERVICE_ACCOUNT_JSON);
    } else if (process.env.FCM_SERVICE_ACCOUNT_PATH) {
      const fs = await import('fs');
      sa = JSON.parse(fs.readFileSync(process.env.FCM_SERVICE_ACCOUNT_PATH, 'utf-8'));
    }
  } catch (err) {
    console.error('FCM: failed to load service account:', err);
    return null;
  }

  if (!sa?.private_key || !sa?.client_email) return null;

  try {
    const jwt = await import('jsonwebtoken');
    const now = Math.floor(Date.now() / 1000);
    const assertion = jwt.default.sign(
      {
        iss: sa.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      },
      sa.private_key,
      { algorithm: 'RS256' }
    );

    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });
    const data: any = await resp.json();
    if (!data.access_token) { console.error('FCM token exchange failed:', data); return null; }
    // Cache for 50 minutes (token lasts 60)
    _fcmTokenCache = { token: data.access_token, exp: Date.now() + 50 * 60 * 1000 };
    return data.access_token;
  } catch (err) {
    console.error('FCM access token error:', err);
    return null;
  }
}

async function sendFcmPush(fcmToken: string, title: string, body: string, link = "/", type: string = 'info'): Promise<boolean> {
  const projectId = process.env.FCM_PROJECT_ID || 'fitwayhubpn';

  const accessToken = await getFcmAccessToken();
  if (!accessToken) {
    console.warn('FCM: no access token — service account not configured');
    return false;
  }

  try {
    const resp = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          message: {
            token: fcmToken,
            notification: { title, body },
            data: { title, body, link: link || '/', type: type || 'info' },
            webpush: {
              notification: {
                title,
                body,
                icon: '/logo.svg',
                badge: '/logo.svg',
                requireInteraction: false,
              },
              fcmOptions: { link: link || '/' },
            },
          },
        }),
      }
    );
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      console.error('FCM send failed:', err);
    }
    return resp.ok;
  } catch (err) {
    console.error('FCM send error:', err);
    return false;
  }
}

// ── Public API ──────────────────────────────────────────────────────────────────

/** Register or update a user's FCM push token */
export async function registerPushToken(userId: number, token: string, platform: 'android' | 'ios' | 'web' = 'android') {
  await run(
    `INSERT INTO push_tokens (user_id, token, platform) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE token = VALUES(token), updated_at = NOW()`,
    [userId, token, platform]
  );
}

/** Remove a user's push token (e.g. on logout) */
export async function removePushToken(userId: number, platform: 'android' | 'ios' | 'web' = 'android') {
  await run('DELETE FROM push_tokens WHERE user_id = ? AND platform = ?', [userId, platform]);
}

/**
 * Map a template slug → default destination route. This lives here so callers
 * who use sendPushFromTemplate without an explicit `link` still get a sensible
 * landing page when the user taps the notification.
 */
export function linkForTemplate(slug: string): string {
  switch (slug) {
    // Inactivity tiers — short tiers should land on the workout list so the
    // user can immediately resume; longer tiers land on the dashboard.
    case 'inactive_1_day':
    case 'inactive_3_days':
      return '/app/workouts';
    case 'inactive_7_days':
    case 'inactive_14_days':
      return '/app/dashboard';

    // Workouts / training prompts
    case 'missed_workout':
    case 'workout_reminder':
    case 'workout_plan_assigned':
    case 'workout_day_reminder':
    case 'workout_completed':
    case 'new_workout_unlocked':
    case 'new_exercise_added':
    case 'morning_reminder':
    case 'evening_reminder':
    case 'program_completed':
      return '/app/workouts';

    // Nutrition
    case 'meal_plan_updated':
      return '/app/plans';

    // Direct messaging
    case 'new_message':
    case 'coach_message':
      return '/app/chat';

    // Community / social / challenges
    case 'post_liked':
    case 'post_commented':
    case 'new_follower':
    case 'friend_joined':
    case 'new_challenge':
    case 'challenge_completed':
      return '/app/community';

    // Progress / achievements / streaks
    case 'progress_milestone':
    case 'goal_achieved':
    case 'weight_logged':
    case 'personal_best':
    case 'monthly_summary':
    case 'streak_3_days':
    case 'streak_7_days':
    case 'streak_about_to_break':
      return '/app/analytics';

    // Onboarding
    case 'user_register':
    case 'profile_complete':
      return '/app/onboarding';
    case 'coach_register':
      return '/coach/profile';
    case 'coach_review':
      return '/app/dashboard';
    case 'new_feature':
      return '/app/dashboard';

    // Coaching lifecycle
    case 'coaching_request':
    case 'coaching_accepted':
    case 'coaching_rejected':
    case 'coaching_disband':
    case 'booking_accepted':
    case 'booking_rejected':
    case 'subscription_verified_user':
    case 'subscription_coach_accepted':
    case 'subscription_coach_declined':
    case 'subscription_rejected':
      return '/app/coaching';

    // Coach-side wallet / payments / certification
    case 'subscription_verified':
    case 'payment_received':
    case 'payment_approved':
    case 'payment_rejected':
    case 'payment_failed':
    case 'withdrawal_approved':
    case 'withdrawal_rejected':
    case 'certification':
    case 'video_review':
      return '/coach/profile';

    // Ads
    case 'ad_approved':
    case 'ad_rejected':
    case 'ad_paused':
    case 'ad_flagged':
    case 'ad_needs_changes':
      return '/coach/ads/my-ads';

    case 'welcome':
      return '/app/dashboard';
    default:
      return '/';
  }
}

/** Send a push notification to a specific user */
export async function sendPushToUser(
  userId: number,
  title: string,
  body: string,
  templateId?: number,
  link = '/',
  type: string = 'info'
): Promise<boolean> {
  const tokens = await query<any>('SELECT token FROM push_tokens WHERE user_id = ?', [userId]);
  if (!tokens.length) {
    // Still create the in-app notification even if there are no push tokens
    try {
      await createInAppNotification(userId, type, title, body, link);
    } catch {}
    return false;
  }

  let anySuccess = false;
  for (const t of tokens) {
    const ok = await sendFcmPush(t.token, title, body, link, type);
    await run(
      'INSERT INTO push_log (user_id, template_id, title, body, status, error_message) VALUES (?,?,?,?,?,?)',
      [userId, templateId || null, title, body, ok ? 'sent' : 'failed', ok ? null : 'FCM delivery failed']
    );
    if (ok) anySuccess = true;
  }
  // Also save as in-app notification so it appears in the notifications feed
  try {
    await createInAppNotification(userId, type, title, body, link);
  } catch {}
  return anySuccess;
}

/** Send a push notification from a template slug to a user, with token replacement */
export async function sendPushFromTemplate(
  userId: number,
  slug: string,
  vars: Record<string, string> = {},
  link?: string,
  type?: string
): Promise<boolean> {
  const tpl = await get<any>('SELECT * FROM push_templates WHERE slug = ? AND enabled = 1', [slug]);
  if (!tpl) return false;

  const title = replaceTokens(tpl.title, vars);
  const body = replaceTokens(tpl.body, vars);
  // If caller didn't pass an explicit link, derive one from the template slug.
  const resolvedLink = link || linkForTemplate(slug);
  // Use slug as the type if no explicit type is provided so the front-end
  // fallback can route based on slug-as-type.
  const resolvedType = type || slug;
  return sendPushToUser(userId, title, body, tpl.id, resolvedLink, resolvedType);
}

/** Send push to all users matching a segment */
export async function sendPushToSegment(
  title: string,
  body: string,
  segment: 'all' | 'users' | 'coaches' | 'inactive' = 'all',
  templateId?: number,
  link: string = '/',
  type: string = 'info'
) {
  let sql = 'SELECT DISTINCT pt.user_id, pt.token, u.name FROM push_tokens pt JOIN users u ON u.id = pt.user_id';
  if (segment === 'users') sql += " WHERE u.role = 'user'";
  else if (segment === 'coaches') sql += " WHERE u.role = 'coach'";
  else if (segment === 'inactive') sql += ' WHERE u.last_active < DATE_SUB(NOW(), INTERVAL 7 DAY)';

  const rows = await query<any>(sql);
  let sent = 0, failed = 0;
  for (const r of rows) {
    const vars: Record<string, string> = { first_name: (r.name || '').split(' ')[0] };
    const t = replaceTokens(title, vars);
    const b = replaceTokens(body, vars);
    const ok = await sendFcmPush(r.token, t, b, link, type);
    await run(
      'INSERT INTO push_log (user_id, template_id, title, body, status) VALUES (?,?,?,?,?)',
      [r.user_id, templateId || null, t, b, ok ? 'sent' : 'failed']
    );
    // Also save as in-app notification
    try { await createInAppNotification(r.user_id, type, t, b, link); } catch {}
    if (ok) sent++; else failed++;
  }
  return { sent, failed, total: rows.length };
}

/** Create an in-app notification */
export async function createInAppNotification(userId: number, type: string, title: string, body: string, link?: string) {
  await run(
    'INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)',
    [userId, type, title, body, link || null]
  );
}

// ── Scheduled push notifications ────────────────────────────────────────────────

/** Run scheduled push notifications for inactive users */
export async function runScheduledPushes() {
  const tiers = [
    { days: 1, maxDays: 3, slug: 'inactive_1_day' },
    { days: 3, maxDays: 7, slug: 'inactive_3_days' },
    { days: 7, maxDays: 14, slug: 'inactive_7_days' },
    { days: 14, maxDays: 60, slug: 'inactive_14_days' },
  ];

  for (const tier of tiers) {
    try {
      const users = await query<any>(
        `SELECT DISTINCT pt.user_id, u.name
         FROM push_tokens pt
         JOIN users u ON u.id = pt.user_id
         WHERE u.role = 'user'
           AND u.last_active < DATE_SUB(NOW(), INTERVAL ? DAY)
           AND u.last_active >= DATE_SUB(NOW(), INTERVAL ? DAY)
           AND pt.user_id NOT IN (
             SELECT pl.user_id FROM push_log pl
             JOIN push_templates t ON t.id = pl.template_id
             WHERE t.slug = ? AND pl.created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
           )
         LIMIT 100`,
        [tier.days, tier.maxDays, tier.slug]
      );

      for (const user of users) {
        const firstName = (user.name || '').split(' ')[0] || 'there';
        await sendPushFromTemplate(user.user_id, tier.slug, { first_name: firstName });
      }
      if (users.length) console.log(`[Push] Sent ${tier.slug} to ${users.length} users`);
    } catch (err) {
      console.error(`[Push] Error processing ${tier.slug}:`, err);
    }
  }
}

// ── Welcome flow ────────────────────────────────────────────────────────────────

/** Send all enabled welcome messages for a new user or coach */
export async function sendWelcomeMessages(userId: number, role: 'user' | 'coach', name: string, email: string) {
  const firstName = (name || email.split('@')[0]).split(' ')[0];
  const appUrl = (process.env.APP_BASE_URL || 'https://localhost').replace(/\/+$/, '');
  const vars: Record<string, string> = { first_name: firstName, app_url: appUrl };

  const target = role === 'coach' ? 'coach' : 'user';
  const msgs = await query<any>('SELECT * FROM welcome_messages WHERE target = ? AND enabled = 1', [target]);

  for (const msg of msgs) {
    const title = replaceTokens(msg.title, vars);
    const body = replaceTokens(msg.body, vars);

    if (msg.channel === 'push') {
      await sendPushToUser(userId, title, body);
    } else if (msg.channel === 'in_app') {
      await createInAppNotification(userId, 'welcome', title, body, role === 'coach' ? '/coach/profile' : '/app/onboarding');
    } else if (msg.channel === 'email') {
      try {
        const smtpSettings = await getSmtpSettings();
        if (smtpSettings?.enabled && smtpSettings?.smtp_host) {
          const subject = replaceTokens(msg.subject, vars);
          const htmlBody = msg.html_body ? replaceTokens(msg.html_body, vars) : undefined;
          const textBody = replaceTokens(msg.body, vars);

          // Try using an email account first, fall back to system email
          const accounts = await query<any>('SELECT id FROM email_accounts LIMIT 1');
          if (accounts.length > 0) {
            await sendMail({
              fromAccountId: accounts[0].id,
              to: email,
              subject,
              text: textBody,
              html: htmlBody,
            });
          } else {
            await sendSystemEmail({ to: email, subject, text: textBody, html: htmlBody });
          }
        }
      } catch (err) {
        console.error('Welcome email send error:', err);
      }
    }
  }
}
