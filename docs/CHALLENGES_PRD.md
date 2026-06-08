# FitWayHub — Challenges Feature
## Product Requirements & System Design Document

> **Status:** Single-version specification (not phased)
> **Scope:** Two challenge types only — **Team Challenges** (private, invite-only) and **Community Challenges** (open, public leaderboard)
> **Explicitly excluded:** AI features of any kind; integrations with third-party devices, wearables, or external fitness platforms
> **Stack alignment:** React 19 + Vite (web + Capacitor mobile), Express + TypeScript REST API, MySQL (`mysql2`), Cloudflare R2 media, Firebase push + in-app notifications (`sendPushFromTemplate`), `zod` validation, `express-rate-limit`. Roles already in the system: `user` (athlete), `coach`, `admin`, `moderator`.

This document extends the existing minimal `challenges` / `challenge_participants` tables into a complete, fair, low-cheating, backend-ready Challenges system.

---

## 1. Feature Purpose

### Why it exists
FitWayHub already connects athletes and coaches through coaching plans, workouts, a community feed, and chat. What it lacks is a **structured, time-boxed, competitive loop** that gives people a concrete reason to train *this week* and a reason to come back tomorrow. Challenges supply that loop: a clear goal, a deadline, a scoreboard, and a reward.

### How it connects athletes and coaches
- **Team Challenges** turn the existing coach→athlete relationship into a small competitive arena. A coach runs a private challenge *only* for athletes they already serve, monitors progress, verifies effort, and celebrates winners. This deepens the paid relationship and gives coaches a retention tool they control.
- **Community Challenges** are app-wide events (run by FitWayHub admins) that pull the whole user base onto one public leaderboard, exposing free users to coaches and premium features.

### How it improves the core metrics
- **Motivation:** a visible scoreboard, streaks, and milestones convert vague intentions ("get fit") into a measurable daily target.
- **Accountability:** verification (coach approval, check-ins, evidence) means progress is *earned*, not self-reported, so the score means something.
- **Retention:** time-boxed challenges with daily reminders, streak bonuses, and "challenge ending soon" nudges create recurring return triggers. Each finished challenge ends with a hook into the next one.
- **Community engagement:** challenge feeds, cheers, comments, and winner announcements turn solo training into a social event.

### Business value for FitWayHub
| Lever | Mechanism |
|---|---|
| Coach retention & upsell | Coaches get an exclusive tool; better-engaged athletes renew subscriptions. |
| Free→premium conversion | Community Challenges surface coaches and premium-only perks to free users. |
| DAU/WAU lift | Daily reminders + streaks + leaderboard refreshes drive habitual opens. |
| Defensible content | Trophies, badges, and titles live on the user's profile — switching cost. |
| Low operational cost | Manual/coach verification (no AI, no device SDKs) keeps infra simple and cheap. |

---

## 2. Core Challenge Types

The system supports **exactly two** types, stored as `challenges.type ENUM('team','community')`.

### A. Team Challenges (private, invite-only)

| Aspect | Rule |
|---|---|
| **Who can create** | A `coach` (for their own athletes) or an `admin`. The generic term "challenge creator" = the coach who owns it. |
| **Who can join** | Only invited users. Invites may be sent **only to athletes the coach has served before** — i.e., a coaching relationship must exist (active or historical subscription / accepted coaching request / `coach_follows`). Admins may invite any user. |
| **Visibility** | Not listed in public discovery, never on the public leaderboard, not searchable. Discoverable only via an in-app invitation or a single-use invite token. |
| **Participation** | Join only after accepting an invite *and* passing eligibility. Hard participant cap (default 100, configurable). Can be grouped into **sub-teams / clubs / coach-groups** for team-vs-team scoring. |
| **Scoring** | Coach chooses the scoring model (Performance / Consistency / Improvement / Participation — see §8). Team aggregate = sum or average of members (coach choice). |
| **Winner** | Individual winner (top score) and, if sub-teams are used, a winning team (top aggregate). Coach finalizes; admin can override on dispute. |
| **Privacy** | Member identities are visible only to the coach/admin and to members who have *not* enabled hidden mode. Hidden-mode athletes (§3) appear under an alias and are absent from the chat roster and participant list. Nothing leaks to the public leaderboard. |

### B. Community Challenges (open, public leaderboard)

| Aspect | Rule |
|---|---|
| **Who can create** | `admin` only. (Coaches may *propose* one via a request; admins approve and own it. This keeps the public surface curated and abuse-controlled.) |
| **Who can join** | Anyone eligible (see eligibility rules §4). One tap to join; no invite needed. |
| **Visibility** | Listed in the Challenges discovery tab and shown on the **public leaderboard**. Indexable in-app search. |
| **Participation** | Open entry during the open-entry window. Optional global cap. Self-paced; each participant tracks their own progress. |
| **Scoring** | Admin-defined model; defaults to a verification-weighted points engine (§8) tuned so beginners and advanced athletes both have a path to placing. |
| **Winner** | Top N on the verified leaderboard at finalization. Supports multiple recognized winners (overall, most consistent, most improved). |
| **Privacy** | Leaderboard shows display name or alias per the user's privacy setting. Hidden-mode users still rank but under an alias; their profile link is suppressed. |

---

## 3. User Roles and Permissions

Roles map to the existing `users.role` values: `user` (athlete), `coach`, `admin`, `moderator`.

### Athlete (`user`) — privacy-first / "hidden" by default
The athlete is the participant. Per the product requirement, **an athlete is hidden: they do not appear in the challenge chat roster or the participant list, and on leaderboards they appear under an alias** unless they explicitly opt to reveal their real name. This is controlled by `challenge_participants.display_mode ENUM('hidden','alias','real') DEFAULT 'hidden'`.

- **Hidden (default):** Excluded from the chat member roster and the participant list entirely. On leaderboards they see *their own* row highlighted ("You — rank 14") but other users see only an anonymized alias (e.g., "Athlete #A7F3") with no profile link.
- **Alias:** Appears on the leaderboard and roster under a self-chosen handle, no real name/profile link.
- **Real:** Full name + avatar + profile link.

> The coach (in Team Challenges) and admins always see the real identity behind every entry for verification and moderation — hidden mode hides athletes *from peers*, never from the responsible coach/admin.

| Athlete can… | Detail |
|---|---|
| **Create** | Nothing public. May *request* to join Community Challenges; cannot create challenges. |
| **View** | Public Community Challenges + leaderboards (others anonymized per their settings); Team Challenges they're invited to; their own progress, rank, evidence, rewards. |
| **Edit** | Their own join state, their own privacy `display_mode`, their own evidence submissions *until* locked/approved, leave a challenge (subject to rejoin rules). |
| **Approve** | Nothing. |
| **Report/Moderate** | Report a challenge or a suspicious entry (creates a `reports` row). Cannot moderate others. |

### Coach / Challenge Creator (`coach`)
| Coach can… | Detail |
|---|---|
| **Create** | **Team Challenges** for their own served athletes only. May submit a proposal for a Community Challenge (admin approves). Cannot directly create Community Challenges. |
| **View** | Full identities, progress, evidence, and chat of *their own* Team Challenges. Their athletes' submissions. Public Community data like anyone. |
| **Edit** | Their own Team Challenge metadata before start; limited fields after start (§4 edit rules). Manage invite list, sub-teams, participant removal. |
| **Approve** | Evidence/submissions in their Team Challenges (approve/reject with reason). Finalize results. |
| **Report/Moderate** | Remove participants, mute/remove chat messages in their challenge, flag an athlete for admin review. Cannot suspend accounts. |

### Admin (`admin`) / Moderator (`moderator`)
Admins own the public surface and all global settings. Moderators are a reduced admin for day-to-day review.

| Admin can… | Detail |
|---|---|
| **Create** | Community Challenges; any Team Challenge; **reward catalog & reward settings for ALL challenges** (rewards are centrally defined by admins — see §4 & §11). |
| **View** | Everything, including hidden-mode real identities, all evidence, all audit logs, all reports. |
| **Edit** | Any challenge, any state. Approve/reject pending challenges (the **Challenge Approval** admin page). Override scores and winners. Force-finalize or cancel. |
| **Approve** | Pending challenges (Community + optionally Team), coach proposals, disputed evidence, reward payouts. |
| **Report/Moderate** | Suspend/ban users, void scores, blacklist evidence, resolve disputes, moderate the public leaderboard, soft-delete any entity. |
| **Moderator** | Same as admin **except**: cannot change global reward catalog, cannot ban accounts (can suspend ≤7 days), cannot hard-delete. All moderator actions are audit-logged. |

---

## 4. Challenge Creation Flow

A linear wizard. Team Challenges are created by coaches; Community Challenges by admins. **All challenges enter `status='pending_review'` and must be approved** before they go live (admins auto-approve their own; coach Team Challenges require admin approval only if flagged or above a participant threshold — see note). Rewards are **not** set in this wizard by coaches; rewards are attached centrally by admins from a global catalog (§11).

### Wizard steps & fields

**Step 1 — Basics**
| Field | Meaning | Req? | Default | Validation |
|---|---|---|---|---|
| `title` | Challenge name | Required | — | 3–80 chars; `containsContactInfo()` guard (no phone/email/links); profanity filter; unique-ish per creator (warn on dupes). |
| `description` | What/why/how to win | Required | — | 10–2000 chars; same contact-info & profanity guards; sanitized (DOMPurify) on render. |
| `cover_image` | Banner | Optional | Type-based placeholder | Image MIME validated by `file-type` (jpg/png/webp), ≤5 MB, re-encoded via `sharp`, uploaded to R2. |

**Step 2 — Type & schedule**
| Field | Meaning | Req? | Default | Validation |
|---|---|---|---|---|
| `type` | `team` or `community` | Required | `team` for coaches (locked), `community` for admins | Coaches cannot pick `community`. |
| `timezone` | IANA tz that all date math anchors to | Required | Creator's tz | Must be valid IANA string; stored once, never silently changed. |
| `start_date` (datetime) | Open of competition window | Required | Tomorrow 00:00 in tz | Must be ≥ now + 1h; ≤ now + 365d. |
| `end_date` (datetime) | Close of competition window | Required | start + 30d | Must be > start by ≥ the `min_duration` (default ≥1 day); ≤ start + 365d. |
| `open_entry_until` | Last moment a new participant may join | Optional | = `end_date` | Between `start_date` and `end_date`. Defines locked vs open entry (§5). |

**Step 3 — Visibility & eligibility**
| Field | Meaning | Req? | Default | Validation |
|---|---|---|---|---|
| `visibility` | `private` (team) / `public` (community) | Auto from `type` | derived | Team→private (locked); Community→public. |
| `eligibility_rules` (JSON) | Gatekeeping: min age, gender (if relevant), region, premium-only, "my athletes only", min account age (anti-throwaway) | Optional | `{}` (everyone) | Each rule validated; "premium_only" only allowed where it doesn't trap paid disputes. |
| `participant_limit` | Max participants | Optional | Team: 100 · Community: null (uncapped) | 1–10000; cannot be lowered below current count after start. |

**Step 4 — Invites & teams (Team Challenges only)**
| Field | Meaning | Req? | Default | Validation |
|---|---|---|---|---|
| `invite_list` | Users to invite | Required (≥1) | — | **Each invitee must be an athlete the coach served before** (active/historical coaching relationship). Server re-validates every id; rejects strangers. |
| `teams` (sub-teams) | Optional grouping (team/club/custom) for team-vs-team scoring | Optional | single pool | Names 2–40 chars; each invitee assignable to exactly one sub-team. |

**Step 5 — Scoring & verification**
| Field | Meaning | Req? | Default | Validation |
|---|---|---|---|---|
| `scoring_model` | `performance` / `consistency` / `improvement` / `participation` (§8) | Required | `consistency` | Enum. |
| `goal_metric` | What's counted: steps, distance_km, minutes, sessions, reps, check-ins | Required | `sessions` | Enum; drives the units shown everywhere. |
| `goal_target` | Target value for completion (e.g., 10000 steps/day, 100 km total) | Conditional | model-dependent | Positive number; sane bounds per metric. |
| `verification_methods` (array) | Allowed proof types (§6) | Required (≥1) | Team: `coach_approval` · Community: `manual_checkin` + `photo_evidence` | Must be a subset of methods allowed for that `type` (§6 matrix). |
| `min_duration_seconds` | Minimum activity length to count (anti-cheat) | Optional | metric-based (e.g., 600s for a "workout") | ≥0. |

**Step 6 — Leaderboard, rules, cancellation**
| Field | Meaning | Req? | Default | Validation |
|---|---|---|---|---|
| `leaderboard_settings` (JSON) | Which boards to show (overall/weekly/daily), whether unverified entries show greyed-out, tie-break order | Optional | overall+weekly on; unverified shown but un-ranked | Validated shape. |
| `rules_terms` | Free-text rules athletes must accept on join | Optional | template text | ≤4000 chars; sanitized. |
| `cancellation_policy` | What happens to points/rewards if cancelled | Optional | "no rewards granted if cancelled before end; partial recognition possible" | Enum + note. |

**Step 7 — Reward settings (admin-controlled, read-only to coaches)**
- Coaches **see** the reward template that admins have attached (or "Standard recognition: completion badge + leaderboard trophy") but cannot edit monetary/premium rewards.
- Admins, on the **Challenge Approval & Rewards** admin page, attach `reward_set_id` from the global catalog, set winner counts, badge tiers, expiry, and any premium perks (§11).

**Step 8 — Review & submit** → `status='pending_review'` (or `draft` if saved). Admin approval flips it to `scheduled`; at `start_date` a cron flips it to `active`.

### Approval note
- **Community Challenges** always require admin approval before publishing.
- **Team Challenges** auto-approve for verified coaches under the cap; they route to the admin queue if: participant_limit > threshold (e.g., 200), the coach is newly registered/unverified, or the description/rewards trip a filter. This keeps coach velocity high while catching abuse.

### Editing after start (the hard part)
Once `status='active'`, edits are constrained to protect fairness. The rule: **you may make a running challenge easier/clearer, never retroactively harder or score-altering.**

| Field | Editable after start? | Behavior |
|---|---|---|
| `title`, `description`, `cover_image`, `rules_terms` | Yes (logged) | Cosmetic/clarifying; version-stamped; participants notified of "rules updated". |
| `end_date` | Extend only | Extending allowed (notify all); shortening blocked unless admin + no scores invalidated. |
| `open_entry_until` | Extend only | Same. |
| `participant_limit` | Raise only | Cannot drop below current count. |
| `invite_list` | Add only | Can invite more; cannot un-invite a joined athlete (must "remove participant" with audit). |
| `goal_metric`, `goal_target`, `scoring_model`, `verification_methods`, `min_duration` | **Locked** | Changing these would rewrite history. Only an admin may change them, and doing so forces a **score recompute** with a banner ("scoring rules changed on <date>") and notifies everyone. |
| `start_date` | Only while `scheduled` | Once active it cannot move. |
| `reward_set` | Admin only | May *improve* rewards; cannot downgrade after start. |

Every edit writes to `challenge_audit_log` (who/what/old→new/when).

---

## 5. Participation Flow

The athlete journey, with all entry-window logic.

1. **Discover** — Community: Challenges tab (cards: cover, title, participant count, days left, "Join"). Team: an invitation notification + an "Invitations" inbox. Team challenges never appear in open discovery.
2. **View details** — full description, rules, schedule (rendered in the *challenge's* timezone with the viewer's local time in parentheses), scoring model, verification methods, rewards, current leaderboard (if `active`).
3. **Accept invite / join open** — Team: accept the invite (token-bound to the user; see §18 forwarded-invite handling). Community: tap Join.
4. **Confirm eligibility** — server checks `eligibility_rules` (age, region, premium, account age, "served-by-this-coach"). Failing returns a clear reason. Athlete accepts `rules_terms` (recorded with timestamp + version).
5. **Pick privacy** — choose `display_mode` (hidden default / alias / real). Can change later.
6. **Track progress** — log activity per `goal_metric`. Progress bar toward `goal_target`; streak counter; today's status.
7. **Submit proof if needed** — when a verification method requires evidence, upload/check-in (§6). Submission enters the verification pipeline.
8. **View ranking** — live-ish leaderboard; verified entries ranked above unverified (§9).
9. **Results & rewards** — at finalization, see final rank, winner status, badges/trophies; rewards land on profile; notification fires (§12).

### Entry-window logic
| Scenario | Behavior |
|---|---|
| **Join before start** (`scheduled`) | Allowed; participant is "pre-registered". No logging until `active`. Counts toward cap. Gets "starts soon" reminders. |
| **Join after start** (`active`, before `open_entry_until`) | Allowed. **Fairness handling depends on model:** Consistency/Participation models compute rates from the join date (no penalty for the days before joining). Performance/cumulative models show a "late start" badge and pro-rate or use rate-based metrics so a latecomer isn't auto-buried. The UI clearly says days remaining. |
| **Join after `open_entry_until`** | Blocked — "entry closed". This is the **locked entry period**. |
| **Leave a challenge** | Allowed any time. Soft-marks participant `status='left'`, keeps their historical evidence for audit, removes them from the *live* leaderboard. Leaving forfeits in-progress streak/rewards. |
| **Rejoin** | Allowed only while entry is open (before `open_entry_until`) and capped (default ≤2 join/leave cycles to stop leaderboard gaming). On rejoin, prior verified progress is **restored** (not double-counted) but the streak resets. |
| **Removed by creator** | `status='removed'`; cannot rejoin that challenge; evidence retained for audit; notified with reason. |

---

## 6. Verification System (non-AI)

The trust backbone. Each method has a `trust_weight` (0.0–1.0) that multiplies points (§8), so low-trust proof earns less. No AI/CV is used; "verification" = deterministic rules + human (coach/admin) review.

### Method catalog
| Method | How it works | Fits | Strengths | Weaknesses | Fraud risk | Mode | Trust |
|---|---|---|---|---|---|---|---|
| **Manual check-in** | Tap "I did it today" within the day window; one per day; server-timestamped | Habit/consistency challenges | Frictionless, high participation | Self-reported | Just taps the button | **Automatic** | 0.4 |
| **Coach approval** | Athlete submits; coach approves/rejects with reason | Team Challenges | Human judgement, high trust | Coach workload; coach bias | Collusion w/ coach | **Coach-approved** | 1.0 (team) |
| **Workout-log verification** | Counts a logged workout already in FitWayHub (session row with duration/exercises) tied to a real plan | Strength/training challenges | Reuses existing trusted data; metadata-rich | Only covers in-app logged work | Fabricated logs (rate-limited) | **Automatic (rules)** | 0.8 |
| **Time-based completion** | Activity must span ≥ `min_duration` between a start and stop event captured in-app | Timed workouts, planks, runs | Hard to fake instantly; metadata | Phone can sit idle | Idle timer | **Automatic** | 0.6 |
| **Manual step count** | User types steps for the day | Step challenges (no wearables) | Inclusive (no device needed) | Pure self-report | Type any number | **Automatic, capped** | 0.3 |
| **Manual distance** | User types distance | Run/walk/cycle | Inclusive | Self-report | Type any number | **Automatic, capped** | 0.3 |
| **Photo evidence** | Upload a photo (e.g., gym selfie, equipment, finish line) | Community, attendance | Visual, deters casual cheating | No CV check; staleness | Reused/stock photos | **Manual review / coach** | 0.5 |
| **Video evidence** | Short clip (≤60s) of the activity | High-stakes / competitive | Hard to fake; shows motion | Heavy storage/review | Replays/edits | **Manual / coach** | 0.7 |
| **Screenshot evidence** | Screenshot of an in-app result or timer | Quick proof | Easy | Trivially edited | Photoshop/reuse | **Manual, low weight** | 0.2 |
| **Attendance (in-person)** | Coach marks present, or athlete scans a per-session rotating code/QR generated by the coach at the venue | In-person team sessions | Very high trust when coach present | Requires coach/venue | Code sharing | **Coach-approved** | 1.0 |

### Allowed methods by type
- **Team Challenges:** all methods. Recommended core = `coach_approval`, `attendance`, `workout_log`, `time_based`. Coach is the trust anchor.
- **Community Challenges (no coach per-athlete):** `manual_checkin`, `workout_log`, `time_based`, `manual_step`, `manual_distance`, `photo_evidence`, `video_evidence`. **`screenshot_evidence` is allowed but capped low; `coach_approval`/`attendance` are not available at app-wide scale**, so Community relies on automatic rules + an admin/moderator review queue for high-value entries.

### Best for competitive leaderboards
`coach_approval`, `attendance`, `video_evidence`, `workout_log`, `time_based` — i.e., methods with high `trust_weight` and verifiable metadata. The leaderboard ranks verified entries above unverified (§9).

### Lower-trust / lower-weight (or capped)
`screenshot_evidence` (0.2), `manual_step` / `manual_distance` (0.3), `manual_checkin` (0.4). These keep participation inclusive but, via `trust_weight`, can't out-rank genuinely verified effort. Manual numeric inputs are additionally **bounded** (e.g., steps/day capped at a physiologically plausible 50k; anything above is clamped and flagged).

---

## 7. Anti-Cheating Logic (no AI)

Defense-in-depth using deterministic rules, rate limits, metadata, and human review — easy on honest users, expensive on cheaters.

| Control | Rule |
|---|---|
| **Duplicate submission detection** | Per (challenge, user, day, metric) uniqueness for daily methods. For evidence: store a content hash (`SHA-256` of the uploaded bytes) and an optional perceptual fingerprint of dimensions/EXIF; identical or re-used files are auto-rejected and flagged. |
| **Time-lock rules** | Submissions accepted only inside `[start_date, end_date]` in the challenge tz. Daily methods locked to one per calendar day. No backdating beyond a small grace (e.g., evidence for "today" accepted until 03:00 next day). |
| **Minimum duration** | Time-based activities below `min_duration_seconds` are rejected. |
| **Required activity metadata** | Each verifiable submission must carry: client timestamp, server receive time, method, duration (if applicable), and for evidence: capture time + file hash. Missing/implausible metadata → lower trust or auto-flag. |
| **Evidence expiration** | Evidence must be captured/submitted within N hours of the activity (default 24h). Stale evidence (old EXIF/created date vs submit time) is flagged for review and weighted down. |
| **Manual review queue** | High-value entries (top of leaderboard, big jumps, low-trust method on a competitive board, any flagged item) land in a coach (team) or admin/moderator (community) queue before counting toward final rank. |
| **Rate limits** | `express-rate-limit` per user/route: e.g., ≤1 check-in/day/challenge, ≤N evidence uploads/hour, ≤M joins/day. Burst submissions across many challenges throttle. |
| **Time-based validation** | Cross-check claimed activity windows against overlaps (a user can't have two 60-min activities in the same 30 minutes). Impossible overlaps auto-flag. |
| **Screenshot abuse** | `screenshot_evidence` is low-weight, hash-deduped, and never sufficient alone for a podium finish on a competitive board. |
| **Coach approval safeguards** | Coaches approve only their own athletes; bulk-approval velocity is monitored; abnormal approval rates (e.g., approving 100 entries in 60s) flag the coach to admins. Coach approvals are themselves audit-logged and spot-checked. |
| **Flagging suspicious activity** | Auto-flags create `reports` rows with `source='system'`: duplicate hash, clamp hit, overlap, late-evidence, velocity, manual-number outliers. Anyone may also report manually. |
| **Penalties for false claims** | Graduated: (1) entry voided + points removed; (2) `participant.flags++`; (3) at threshold, removal from challenge; (4) repeat offenders → account suspension by admin; (5) prior winners stripped of reward + leaderboard correction + public note replaced silently to avoid shaming, with audit trail. |

**Design principle:** honest users see *zero* friction (one tap to check in; logging a workout already counts). Friction scales with stakes — only high-value/anomalous entries hit review. The system is biased toward "verify the top of the leaderboard thoroughly, trust the long tail lightly."

---

## 8. Scoring System

A flexible, additive **points engine**. Final points for a submission:

```
points = base_points
       × trust_weight(method)            // §6, low-trust proof earns less
       × eligibility_multiplier          // e.g., beginner handicap
       + bonuses
       − penalties
```

### Components
| Component | Meaning | Typical |
|---|---|---|
| **Base points** | Awarded per qualifying activity/day | e.g., 10 / valid day |
| **Completion points** | One-time, on hitting `goal_target` | e.g., 100 |
| **Consistency bonus** | For hitting the daily goal a % of days | +1/day, scaling |
| **Streak bonus** | Consecutive qualifying days | +2 × streak_len, capped (e.g., max +20/day) so streaks reward without runaway leads |
| **Early completion bonus** | Completing before a date threshold | +25 if done in first half |
| **Milestone bonus** | Crossing 25/50/75% of goal | +15 each |
| **Weekly bonus** | Meeting a weekly minimum | +30/week |
| **Participation bonus** | Just for joining + ≥1 verified activity | +10 (guarantees everyone leaves with something) |
| **Penalty rules** | Voided/false entries subtract their points; missed required check-ins can break streaks | − |
| **Expired challenge logic** | At `end_date`, pending-but-unverified entries are resolved (auto-approved for high-trust automatic methods, voided for unreviewed evidence after a grace window); no new points after close | — |

### Scoring models
| Model | Optimizes | Score basis | Best for |
|---|---|---|---|
| **Performance** | Output | Total/peak of `goal_metric` (distance, reps, minutes) | Competitive Community Challenges |
| **Consistency** | Showing up | % of days meeting goal × streak bonuses | Habit-building, default |
| **Improvement** | Personal growth | Δ vs the participant's own baseline (first 3 days or pre-set baseline), normalized | Mixed-ability groups; **beginner-friendly** |
| **Participation** | Inclusion | Flat points for any verified activity, capped | Onboarding / wide-net Community events |

### Fairness for beginners *and* advanced athletes
- **Improvement model + percent-of-goal** means a beginner improving 30% scores like an advanced athlete improving 30% — relative, not absolute.
- **Consistency model** rewards effort frequency, which is equally achievable regardless of fitness level.
- **Streak caps** prevent the fittest from running away; **participation floor** guarantees beginners always bank points.
- **Optional eligibility multiplier / divisions** (e.g., a beginner bracket) let one challenge host multiple fairness brackets without splitting the event.
- **Verification weighting** ensures the win is about *real, verified* effort, not who games numeric self-reports.

---

## 9. Leaderboard Logic

| Concern | Design |
|---|---|
| **Public leaderboard (Community)** | Server-computed, cached, paginated. Shows rank, alias/name (per privacy), score, verified-share indicator. |
| **Private leaderboard (Team)** | Visible only to members + coach/admin. Supports per-sub-team boards. |
| **Overall ranking** | Total points across the whole challenge window. |
| **Weekly ranking** | Points earned within the current ISO week (in challenge tz). Resets each week; good for re-engagement. |
| **Daily ranking** | Points earned today; drives daily opens. |
| **Filters** | By sub-team / coach-group / club; by metric; "verified only" toggle; "my division". |
| **Tie-breaking (in order)** | (1) higher **verified** points; (2) more verified submissions; (3) earlier completion timestamp; (4) longer current streak; (5) earlier join date; (6) lexical on user id (stable). Deterministic, documented to users. |
| **Updates** | Near-real-time: points recompute on each verified event and write a `leaderboard_entries` row (denormalized rank cache) refreshed by a short-interval worker (e.g., every 15–30s) plus on-demand recompute on approval. Frontend already polls (existing pattern); no websockets required for v1. |

**Verified > unverified:** the leaderboard sorts on `verified_points` first. Unverified/pending entries are shown **greyed-out and un-ranked** (or in a separate "pending" section) so a wall of self-reported numbers can never sit above genuinely verified athletes. When a pending entry is approved, points convert from `pending_points` to `verified_points` and the rank updates.

**Same score:** resolved by the tie-break ladder above; if still identical (extremely rare), they share a rank and the next rank skips (standard competition ranking, 1-2-2-4).

**Anti-manipulation:** verified-first sorting, trust-weighted points, manual-number clamps, join/leave cycle limits, duplicate-hash rejection, top-of-board mandatory review, and rate limits. Sudden rank jumps auto-flag for review before they're allowed to stand at finalization.

---

## 10. Social and Engagement Features

Reuses the existing chat/feed/notification infrastructure (the current implementation already attaches a group thread per challenge).

| Feature | Behavior | Team (private) | Community (public) |
|---|---|---|---|
| **Challenge feed** | Chronological posts: system events (joins, milestones), coach posts, member updates | Members + coach only; respects hidden mode (hidden athletes' posts show alias, and they're absent from roster) | Public to participants; non-participants see a read-only highlights view |
| **Reactions** | Emoji reactions on posts/entries | On | On |
| **Comments** | Threaded comments (contact-info & profanity guarded) | Members only | Participants only; spam-rate-limited |
| **Coach announcements** | Pinned coach broadcast | Coach-authored, pinned | Admin-authored only |
| **Participant updates** | Auto "X reached 50%" cards | Shows alias for hidden athletes | Shows alias by default |
| **Milestone celebration** | Confetti card on 25/50/75/100% | On | On |
| **Winner announcement** | Finalization post + notification | In-thread, coach-issued | Public banner + notification, admin-issued |
| **Encourage / cheer** | One-tap "cheer" (lightweight reaction that can grant a tiny social bonus, capped) | On | On, rate-limited |
| **Activity history** | Per-user log of their own submissions/approvals | Visible to self + coach | Visible to self only |

**Key difference:** Team feeds are intimate and coach-led (real identities to the coach, aliases among hidden peers); Community feeds are public, admin-moderated, identity-minimized by default (hidden mode), and more heavily rate-limited against spam. **Hidden athletes never appear in the chat member roster or participant list in either type** — they interact via alias only.

---

## 11. Rewards and Recognition

**Rewards are defined centrally by admins** in a global catalog and attached to challenges on the Challenge Approval & Rewards admin page. Coaches cannot mint rewards; they can only request recognition from the catalog.

| Reward | Meaning | Selection |
|---|---|---|
| **Badges** | Earned markers (e.g., "30-Day Finisher") | Auto on completion criteria |
| **Trophies** | Placement (Gold/Silver/Bronze) | Top-3 verified at finalization |
| **Winner titles** | "Challenge Champion — <name>" | #1 verified |
| **Most consistent** | Highest consistency score | Computed |
| **Most improved** | Highest improvement-model delta | Computed |
| **Team winner** | Top sub-team aggregate | Computed |
| **Completion badge** | Reached `goal_target` | Auto, any number of winners |
| **Public recognition** | Leaderboard banner / profile pin | #1–N |
| **Coach shoutout** | Coach-issued kudos in feed/profile | Coach |
| **Reward expiry** | Time-limited perks (e.g., premium days) expire; *badges/trophies are permanent* on profile | `reward_grants.expires_at` |

### Selection logic
- **Winner = highest `verified_points`** at `finalized_at`, after the top-of-board review pass, with ties broken by §9 ladder.
- **Multiple winners:** yes — distinct categories (Champion, Most Consistent, Most Improved, Team Winner) each have a winner; completion badges are unlimited.
- **Ties:** if two genuinely tie after all tie-breakers, **co-winners** are declared (both get the trophy) rather than forcing a loser — fairer and rare.
- **Profile display:** a "Trophies & Badges" shelf on the user profile; permanent items always shown, expirable perks shown with remaining time, each links to its source challenge (subject to the challenge's privacy).

---

## 12. Notifications System

Built on the existing `sendPushFromTemplate(userId, templateKey, vars)` + in-app notifications + email service.

| Event | Channels | Optional? | Required for participation? |
|---|---|---|---|
| Invite sent | push + in-app + email | No | **Required** (you can't accept what you don't receive) |
| Invite accepted | push + in-app (to coach) | Yes | No |
| Challenge starting soon (24h/1h) | push + in-app | Yes | No (but on by default) |
| Challenge started | push + in-app | Yes | No |
| Daily reminder | push | **Yes** (user-toggle, quiet hours respected) | No |
| Milestone reached | push + in-app | Yes | No |
| Rank changed (e.g., passed/overtaken) | push (batched, throttled) | **Yes** | No |
| New comment / coach message | push + in-app | Yes | No |
| Challenge ending soon (48h/24h) | push + in-app + email | Yes | No (default on) |
| Challenge completed (you finished) | push + in-app | No | **Required** (result delivery) |
| Winner announced | push + in-app + email | No | **Required** (result delivery) |
| Reward received | push + in-app + email (if perk) | No | **Required** |

**Channel rules:** transactional/result events (invite, results, rewards) are required and use multi-channel including email; engagement nudges (daily reminder, rank change, milestones) are user-toggleable push, batched and rate-limited to avoid fatigue, and respect quiet hours and the user's global notification prefs already in the app.

---

## 13. Athlete Experience (end-to-end)

1. **Discover** — Opens the **Challenges** tab. Community Challenges show as cards (cover, "1,204 joined", "12 days left"). A red dot on the tab signals a pending **invitation** to a Team Challenge.
2. **Join** — Community: tap **Join** → eligibility check → accept rules → pick privacy (`hidden` default). Team: open invite → **Accept** → same flow. Joining before start = "pre-registered".
3. **Track** — Challenge home shows a progress ring toward the goal, today's status ("Check in"), current rank, streak flame, and days left. Logging a normal FitWayHub workout auto-counts where `workout_log` is enabled.
4. **Submit proof** — When required, a "Submit proof" sheet offers exactly the allowed methods (check-in / photo / video / time / number). Camera capture is preferred over gallery for evidence to discourage reuse. Submission shows "Pending review" or "Counted" instantly.
5. **Leaderboard** — Tab to Overall / Weekly / Daily; their own row is always pinned and highlighted; others show per privacy. A "verified only" toggle reveals the true competitive order.
6. **Rewards** — At finalization: a results screen (your rank, what you earned), confetti for winners, badges/trophies pushed to the profile shelf, and a "Join the next challenge" CTA.

---

## 14. Coach / Creator Experience (end-to-end)

1. **Create** — From the coach dashboard, **New Challenge** opens the wizard (§4). Type is locked to **Team**. Coach sets goal, scoring model, verification methods, schedule, sub-teams.
2. **Invite** — Invite picker shows **only the coach's served athletes** (searchable). Bulk-invite a group/club. Each invite is a single-use, user-bound token.
3. **Monitor** — A coach console: roster with real identities (even hidden-mode athletes are visible *to the coach*), each athlete's progress, streak, last activity, and a **pending-review** badge count.
4. **Review evidence** — A review queue: each item shows the proof (photo/video/time/number), metadata (capture time, duration, file-hash dedupe status, any system flags), and **Approve / Reject (reason)**. Bulk actions exist but are velocity-monitored.
5. **Approve / reject** — Approve → points convert to verified, leaderboard updates, athlete notified. Reject → reason sent, athlete may resubmit if within window.
6. **Communicate** — Post announcements (pinned), comment, cheer, send a coach message via the existing chat thread. Can mute/remove a disruptive participant.
7. **Finalize** — At/after `end_date`, the coach reviews any last pending items, then **Finalize**. System computes winners by category, applies admin-defined rewards, posts the winner announcement, and locks the challenge. Admin can override on dispute.

---

## 15. Admin and Moderation

A dedicated **Admin → Challenges** area with these tools (extends the existing admin challenges page):

| Tool | Function |
|---|---|
| **Challenge Approval queue** | Approve/reject pending Community Challenges and flagged Team Challenges; attach reward sets; set winner counts. |
| **Reward catalog & settings** | Define global badges/trophies/titles/perks and expiry; the single source of rewards for all challenges. |
| **Fraud review** | Cross-challenge view of flagged participants, duplicate-hash hits, manual-number outliers, velocity flags; void scores, strip rewards. |
| **Challenge reporting** | Inbox of user/system `reports`; triage, assign, resolve with notes. |
| **User suspension** | Suspend/ban abusers (moderators: ≤7-day suspend only); revoke challenge access. |
| **Challenge cancellation** | Cancel a challenge (with policy-driven handling of points/rewards) — notifies all, writes audit. |
| **Evidence review** | Open any evidence, see full metadata + history, override coach decisions. |
| **Abuse detection dashboard** | Surfaces leaders/anomalies needing review; mandatory top-of-board review before finalization. |
| **Dispute handling** | Two-sided dispute workflow (athlete vs coach decision); admin ruling is final; full audit. |
| **Public leaderboard moderation** | Hide/anonymize offensive aliases, remove voided entries, post corrections. |

All admin/moderator actions are written to `challenge_audit_log` with actor, action, target, before/after, and timestamp.

---

## 16. Database Design (MySQL, extends existing schema)

Conventions follow the codebase: `snake_case`, `INT AUTO_INCREMENT` PKs, `datetime DEFAULT CURRENT_TIMESTAMP`, FKs with `ON DELETE` rules, InnoDB/utf8mb4, idempotent migrations guarded by `INFORMATION_SCHEMA`. Existing `challenges` and `challenge_participants` are **extended** rather than replaced.

### Soft vs hard delete
- **Soft delete** (status/`deleted_at`) for: `challenges`, `challenge_participants`, `verification_records`, `comments`, `reports` — anything with audit, fairness, or dispute value. Mirrors existing `is_hidden` pattern on posts.
- **Hard delete** allowed for: `reactions`, throwaway `notifications`, expired anonymous `challenge_invitations` (after a retention window).
- **Audit fields** on every important table: `created_at`, `updated_at`, and where relevant `created_by`, `deleted_at`. Immutable history in `challenge_audit_log`.

### Entities

**`challenges`** (extend existing) — PK `id`
`creator_id→users`, `title`, `description`, `cover_image_url`, `type ENUM('team','community')`, `visibility ENUM('private','public')`, `timezone`, `start_date DATETIME`, `end_date DATETIME`, `open_entry_until DATETIME`, `goal_metric`, `goal_target`, `scoring_model`, `min_duration_seconds`, `participant_limit`, `eligibility_rules JSON`, `verification_methods JSON`, `leaderboard_settings JSON`, `rules_terms TEXT`, `cancellation_policy`, `reward_set_id→reward_sets`, `status ENUM('draft','pending_review','scheduled','active','reviewing','finalized','cancelled')`, `participant_count`, `created_at`, `updated_at`, `finalized_at`, `deleted_at`.
*Relations:* 1‑coach→many challenges; 1 challenge→many participants/invitations/teams.

**`users`** (existing) — athletes/coaches/admins via `role`. Referenced everywhere.

**`coaches`** — represented by `users.role='coach'` plus existing coaching-relationship tables (`coach_follows`/subscriptions). Used to validate "served-by-this-coach" for invites.

**`challenge_teams`** (sub-teams) — `id`, `challenge_id→challenges`, `name`, `created_at`. Optional grouping for team-vs-team scoring.

**`challenge_invitations`** — `id`, `challenge_id`, `inviter_id→users`, `invitee_id→users`, `token` (single-use, user-bound), `status ENUM('sent','accepted','declined','revoked','expired')`, `team_id→challenge_teams` (nullable), `created_at`, `responded_at`. *Unique(challenge_id, invitee_id).*

**`challenge_participants`** (extend existing) — `id`, `challenge_id`, `user_id`, `team_id` (nullable), `display_mode ENUM('hidden','alias','real')`, `alias`, `status ENUM('pre_registered','active','left','removed')`, `joined_at`, `left_at`, `rejoin_count`, `flags INT DEFAULT 0`, `baseline_value` (for improvement model), `accepted_terms_version`, `accepted_terms_at`. *Unique(challenge_id, user_id)* (keep existing constraint).

**`verification_records`** — `id`, `challenge_id`, `participant_id→challenge_participants`, `method`, `metric_value`, `duration_seconds`, `evidence_url` (R2), `evidence_hash` (SHA-256), `client_captured_at`, `submitted_at`, `status ENUM('pending','approved','rejected','voided','auto_approved')`, `reviewed_by→users`, `review_reason`, `trust_weight`, `awarded_points`, `flags JSON`, `created_at`, `deleted_at`. *Index(challenge_id, participant_id, submitted_at); Index(evidence_hash) for dedupe.*

**`activity_logs`** — append-only ledger of point-affecting events — `id`, `challenge_id`, `participant_id`, `verification_id` (nullable), `event_type` (checkin/approve/reject/void/bonus/penalty), `points_delta`, `verified TINYINT`, `created_at`. Source of truth for recompute & audit.

**`leaderboard_entries`** (denormalized cache) — `id`, `challenge_id`, `participant_id`, `scope ENUM('overall','weekly','daily')`, `period_key` (e.g., `2026-W23`), `verified_points`, `pending_points`, `rank`, `streak_len`, `updated_at`. *Unique(challenge_id, participant_id, scope, period_key).*

**`reward_sets`** + **`rewards`** (admin catalog) — `reward_sets(id, name, created_by, ...)`; `rewards(id, reward_set_id, kind ENUM('badge','trophy','title','perk'), criteria, tier, perk_payload JSON, expires_after_days)`.

**`reward_grants`** — `id`, `challenge_id`, `participant_id`, `reward_id`, `granted_at`, `expires_at`, `revoked_at`. Drives the profile trophy shelf.

**`comments`** — `id`, `challenge_id`, `parent_id` (nullable, threads), `user_id`, `content`, `is_hidden`, `created_at`, `deleted_at`.

**`reactions`** — `id`, `target_type ENUM('comment','verification','challenge_post')`, `target_id`, `user_id`, `emoji`, `created_at`. *Unique(target_type,target_id,user_id,emoji).* Hard-deletable.

**`notifications`** (existing service) — `id`, `user_id`, `template_key`, `payload JSON`, `channel`, `read_at`, `created_at`.

**`reports`** (flags) — `id`, `reporter_id` (nullable for `source='system'`), `source ENUM('user','system','coach')`, `target_type`, `target_id`, `reason`, `status ENUM('open','reviewing','resolved','dismissed')`, `resolved_by`, `resolution_note`, `created_at`.

**`challenge_audit_log`** — `id`, `challenge_id`, `actor_id`, `action`, `target_type`, `target_id`, `before JSON`, `after JSON`, `created_at`. Immutable.

---

## 17. API Design (REST, mirrors existing `/api/...` Express style)

Auth via the existing Bearer JWT middleware; role checks per endpoint. Responses JSON. Evidence uploads multipart → R2.

| Operation | Method & path | Notes |
|---|---|---|
| Create challenge | `POST /api/challenges` | Body validated by `zod`; coach→team only; enters `pending_review`. |
| Update challenge | `PATCH /api/challenges/:id` | Field-level rules per §4 edit table; audit-logged. |
| Fetch challenge details | `GET /api/challenges/:id` | Respects visibility & viewer role; includes viewer's participant state. |
| List/discover | `GET /api/challenges?type=community&status=active` | Community public; team only if invited. |
| Invite participants | `POST /api/challenges/:id/invites` | Validates each invitee is coach-served; creates tokens; notifies. |
| Respond to invite | `POST /api/challenges/:id/invites/:token/accept` \| `/decline` | Token user-bound (anti-forwarding). |
| Join challenge | `POST /api/challenges/:id/join` | Community open join; eligibility + entry-window checks; `display_mode` in body. |
| Leave challenge | `POST /api/challenges/:id/leave` | Sets `status='left'`; rejoin rules enforced. |
| Submit evidence | `POST /api/challenges/:id/submissions` | Multipart; computes hash; dedupe; rate-limited; returns pending/counted. |
| Approve evidence | `POST /api/challenges/:id/submissions/:sid/approve` | Coach(team)/admin(community); converts pending→verified; recompute. |
| Reject evidence | `POST /api/challenges/:id/submissions/:sid/reject` | Requires reason; notifies; resubmit allowed if in window. |
| Fetch leaderboard | `GET /api/challenges/:id/leaderboard?scope=overall&team=&verifiedOnly=true` | Paginated; privacy-applied; cached. |
| Fetch progress | `GET /api/challenges/:id/progress` | Viewer's own progress, streak, rank, pending items. |
| Finalize challenge | `POST /api/challenges/:id/finalize` | Coach/admin; computes winners; grants rewards; locks; announces. |
| Award rewards | `POST /api/challenges/:id/rewards` | Admin; manual grant/override from catalog. |
| Report abuse | `POST /api/reports` | `target_type`/`target_id`/`reason`; creates `reports` row. |
| Admin approve challenge | `POST /api/admin/challenges/:id/approve` \| `/reject` | Approval queue; attaches `reward_set_id`. |
| Cancel challenge | `POST /api/challenges/:id/cancel` | Policy-driven; notifies; audit. |

A thin GraphQL gateway could wrap these later, but REST matches the existing controllers/routes and keeps v1 simple.

---

## 18. Edge Cases

| Case | Handling |
|---|---|
| **User joins late** | Allowed until `open_entry_until`. Rate/relative models (consistency/improvement) compute from join date; cumulative/performance models flag "late start" and use rate-based or pro-rated scoring so they're not auto-buried. |
| **User leaves and rejoins** | Allowed while entry open, ≤2 cycles. Verified progress restored (not double-counted); streak resets; logged. |
| **Challenge start changed** | Only while `scheduled`. Once `active`, start is immutable; extending `end_date` is allowed and notifies all. |
| **Challenge cancelled** | `status='cancelled'`; per `cancellation_policy` no rewards (or partial recognition); all notified; scores frozen for audit; refunds N/A (no paid entry in v1). |
| **Challenge duplicated** | "Duplicate" creates a new `draft` with copied settings, fresh dates, **empty** participants/invites/scores. Never shares a leaderboard with the original. |
| **Participant removed by creator** | `status='removed'`; evidence retained; cannot rejoin; notified with reason; leaderboard recomputed. |
| **Evidence submitted multiple times** | Daily-uniqueness + content-hash dedupe reject duplicates; the *first valid* counts; extras flagged. |
| **Leaderboard score changes after approval** | Approval converts pending→verified and triggers recompute via the `activity_logs` ledger; ranks shift; affected users get throttled "rank changed" notifications. |
| **Challenge ends while submission pending** | A grace window (e.g., 24h) lets coach/admin resolve pending items; high-trust automatic methods auto-approve, un-reviewed evidence is voided; only then is `finalize` allowed. |
| **Multiple winners tie** | After the full tie-break ladder, declare **co-winners** (both receive the trophy/title). Completion badges are unlimited anyway. |
| **Private invite forwarded to others** | Invites are **single-use, user-bound tokens**; accepting requires the logged-in user to match `invitee_id`. A forwarded link fails for anyone else and the attempt is logged/flagged. |

---

## 19. Single-Version Implementation (one final architecture, no phases)

**One MVP-ready, production-grade build** balancing simplicity, trust, fairness, coach control, engagement, low cheating, and low ops cost:

**Data:** extend `challenges`/`challenge_participants`; add `challenge_invitations`, `challenge_teams`, `verification_records`, `activity_logs`, `leaderboard_entries`, `reward_sets`/`rewards`/`reward_grants`, `comments`, `reactions`, `reports`, `challenge_audit_log`. One idempotent migration (`009_challenges_system`).

**Backend:** a `challengesController` + `challengeRoutes` mirroring existing controllers; a `scoringService` (pure functions over `activity_logs`), a `verificationService` (rules + dedupe + trust weights), a short-interval `leaderboardWorker` (recompute cache; also recompute on approval), reuse `notificationService` and `uploadToR2`, reuse `express-rate-limit` and `containsContactInfo`.

**Frontend:** extend the existing **Challenges** page (athlete discovery/join/track/leaderboard/submit), a **coach console** (create wizard + review queue + finalize), and the **Admin → Challenges** approval/reward/fraud tools. Reuse the existing per-challenge group thread for the feed/chat.

**Trust model (the core decision):** **verified-first leaderboards + trust-weighted points + human review only at the top/anomalies.** Team Challenges lean on coach approval (cheap, high-trust); Community Challenges lean on automatic rules + admin review of leaders. No AI, no device SDKs — keeping cheating low *and* ops overhead low.

**Two types, four scoring models, ten verification methods, central admin rewards, one approval pipeline** — complete, realistic, and buildable as a single coherent release.

---

## 20. Final Recommendation

Ship **two clean challenge types** with a **verification-weighted, verified-first scoring and leaderboard engine** as the heart of the system.

- **Simplicity:** Two types, one wizard, one points ledger (`activity_logs`), REST endpoints that match the current codebase. Reuse chat, notifications, R2, rate-limiting, and content guards already in production.
- **Trust:** Every point is traceable to a `verification_record` with a method `trust_weight`; nothing self-reported can outrank verified effort.
- **Fair competition:** Improvement & consistency models, streak caps, participation floors, and optional divisions keep beginners and advanced athletes both motivated; deterministic, published tie-breaks.
- **Coach–athlete connection:** Team Challenges are private, invite-only, coach-verified, and limited to a coach's *own* athletes — turning the existing relationship into a recurring, sticky engagement loop.
- **High engagement:** Daily/weekly boards, streaks, milestones, cheers, feeds, and a hook into the next challenge drive habitual return without notification fatigue (throttled, user-toggleable nudges).
- **Low cheating:** Hash dedupe, time-locks, min-duration, manual-number clamps, single-use invites, velocity flags, and mandatory top-of-board review — defense-in-depth with zero AI.
- **Low operational overhead:** Human review is concentrated where it matters (the podium and anomalies); the long tail is trusted lightly. No third-party device/wearable integrations to maintain.
- **Easy scaling:** Denormalized `leaderboard_entries` cache + append-only `activity_logs` recompute cleanly; everything is stateless behind the existing Express API and MySQL, so it scales horizontally with the rest of FitWayHub.

**Bottom line:** a focused, trustworthy, coach-centric Challenges system that makes the score *mean something* — fair to beginners, credible for competitors, cheap to run, and ready to build in one version.
