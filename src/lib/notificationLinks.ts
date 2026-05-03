/**
 * Resolves a notification's destination route.
 *
 * Strategy: prefer the explicit `link` set by the server. If the server didn't
 * set one (legacy rows, old broadcasts, push payloads with bare title/body),
 * fall back to a sensible default keyed on the notification `type` (which we
 * also use as the template slug). For "info"-typed legacy rows we sniff the
 * title/body for keywords to recover the most common cases (e.g. the
 * inactivity push notifications that landed users on the dashboard before
 * this fix).
 */
export type NotificationLike = {
  type?: string | null;
  link?: string | null;
  title?: string | null;
  body?: string | null;
};

export function resolveNotificationLink(n: NotificationLike): string | null {
  if (n?.link) return n.link;
  const type = (n?.type || '').toLowerCase();
  switch (type) {
    // Inactivity / workout reminders
    case 'inactive_1_day':
    case 'inactive_3_days':
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
    case 'inactive_7_days':
    case 'inactive_14_days':
      return '/app/dashboard';

    // Nutrition / meal planning
    case 'meal_plan_updated':
      return '/app/plans';

    // Direct messaging
    case 'new_message':
    case 'coach_message':
      return '/app/chat';

    // Community / social
    case 'post_liked':
    case 'post_commented':
    case 'new_follower':
    case 'friend_joined':
      return '/app/community';

    // Challenges (live in community feed)
    case 'new_challenge':
    case 'challenge_completed':
      return '/app/community';

    // Progress / achievements / streaks → analytics surface
    case 'progress_milestone':
    case 'goal_achieved':
    case 'weight_logged':
    case 'personal_best':
    case 'monthly_summary':
    case 'streak_3_days':
    case 'streak_7_days':
    case 'streak_about_to_break':
      return '/app/analytics';

    // Onboarding / new-user nudges
    case 'user_register':
    case 'profile_complete':
      return '/app/onboarding';
    case 'coach_register':
      return '/coach/profile';

    // Coach feedback on athlete
    case 'coach_review':
      return '/app/dashboard';

    // Generic product announcements
    case 'new_feature':
      return '/app/dashboard';

    // Coaching lifecycle
    case 'coaching_request':
    case 'coaching_accepted':
    case 'coaching_rejected':
    case 'coaching_disband':
    case 'booking_accepted':
    case 'booking_rejected':
    case 'subscription':
    case 'subscription_verified_user':
    case 'subscription_coach_accepted':
    case 'subscription_coach_declined':
    case 'subscription_rejected':
      return '/app/coaching';

    // Coach-side wallet / membership / payments
    case 'subscription_verified':
    case 'subscription_coach':
    case 'gift_received':
    case 'payment_received':
    case 'withdrawal':
    case 'withdrawal_approved':
    case 'withdrawal_rejected':
    case 'certification':
    case 'certification_request':
    case 'video_review':
      return '/coach/profile';

    // Ads
    case 'ad_approved':
    case 'ad_rejected':
    case 'ad_paused':
    case 'ad_flagged':
    case 'ad_needs_changes':
    case 'ad_moderation':
      return '/coach/ads/my-ads';

    // Refunds / payment failures (athlete side)
    case 'payment_failed':
    case 'payment_rejected':
    case 'payment_approved':
    case 'refund':
      return '/app/coaching';

    // Premium upgrades
    case 'premium':
      return '/app/dashboard';

    // Misc
    case 'coach_report':
      return '/app/coaching';
    case 'welcome':
      return '/app/dashboard';

    case 'info':
    case '':
    default: {
      // Legacy "info"-typed rows (created before we threaded link/type
      // through the server). Sniff for the inactivity messages so users land
      // on the workout list when they tap "you missed your workout".
      const txt = `${n?.title || ''} ${n?.body || ''}`.toLowerCase();
      if (txt.includes('workout') || txt.includes("missed") || txt.includes("miss your")) {
        return '/app/workouts';
      }
      if (txt.includes('subscrib') || txt.includes('coach')) {
        return '/app/coaching';
      }
      if (txt.includes('payout') || txt.includes('withdraw')) {
        return '/coach/profile';
      }
      if (txt.includes('campaign') || txt.includes('ad ')) {
        return '/coach/ads/my-ads';
      }
      // No safe default — return null so the caller can keep the user on
      // the current page rather than dumping them on /.
      return null;
    }
  }
}

export default resolveNotificationLink;
