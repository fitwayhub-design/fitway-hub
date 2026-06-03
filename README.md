# FitWay Hub

A full-stack fitness platform with role-based dashboards for **Users**, **Coaches**, and **Admins**. Includes fitness tracking, coaching subscriptions, community, messaging, blogs, ads, payments, and AI-assisted insights — with a React web frontend, Express API, MySQL database, and Capacitor Android wrapper.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS 4, Ant Design, Recharts, Lucide icons, Motion |
| Backend | Express.js, TypeScript (tsx), MySQL 8 (mysql2) |
| Auth | JWT + bcrypt, Google OAuth |
| Mobile | Capacitor 8 (Android WebView wrapper) |
| Push | Firebase Cloud Messaging (FCM HTTP v1) |
| Storage | Multer (local uploads) + Cloudflare R2 (cloud) |
| Payments | Paymob, Apple IAP, Google Play IAP |
| AI | Google Gemini API |
| Image Processing | Sharp |
| Email | Nodemailer + built-in SMTP server |
| Deployment | Railway (Nixpacks) |

## Prerequisites

- Node.js 18+
- MySQL 8 (local or hosted — Aiven, Railway, PlanetScale, etc.)
- Firebase project (for push notifications)
- Cloudflare R2 bucket (optional, for cloud file storage)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp env.example .env
```

Edit `.env` and fill in the required values. Key variables:

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Random secret string for signing tokens |
| `DATABASE_URL` | Full MySQL connection URL (or use individual `DB_*` vars) |
| `APP_BASE_URL` | Your domain (default `http://localhost:3000`) |
| `VITE_API_BASE` | API URL for the frontend (default `http://localhost:3000`) |
| `GEMINI_API_KEY` | Google Gemini API key (for AI features) |
| `R2_*` | Cloudflare R2 credentials (for cloud uploads) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials |

See [env.example](env.example) for the full list.

### 3. Start development

**Backend + Frontend (separate terminals):**

```bash
# Terminal 1 — Express API server (port 3000)
npm run dev:server

# Terminal 2 — Vite dev server (port 5173, with HMR)
npm run dev:client
```

**Or backend only (serves built frontend from `dist/`):**

```bash
npm run dev
```

### 4. Seed the database (optional)

```bash
npm run seed
```

### 5. Build for production

```bash
npm run build
npm start
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Express server (serves API + built frontend) |
| `npm run dev:server` | Start Express API server only |
| `npm run dev:client` | Start Vite dev server with HMR |
| `npm run dev:vite` | Start Vite on `0.0.0.0:5173` |
| `npm run build` | Build frontend with Vite |
| `npm run build:android` | Build + sync Capacitor Android |
| `npm run seed` | Seed database with initial data |
| `npm run lint` | TypeScript type checking |
| `npm run cap:sync` | Sync web assets to Android project |
| `npm run cap:run` | Run Android app on device/emulator |
| `npm run tunnel` | Create localtunnel to port 3000 |

## Project Structure

```
├── server.ts                    # Express server entry point (port 3000)
├── server/
│   ├── config/database.ts       # MySQL connection pool
│   ├── controllers/             # Route handlers (12 controllers)
│   ├── middleware/               # auth, error, upload middleware
│   ├── migrations/              # DB migrations (ads system, etc.)
│   ├── models/                  # User, DailySummary models
│   ├── routes/                  # 25 route modules
│   ├── services/                # Activity profiling, ad billing
│   ├── utils/                   # Video metadata helpers
│   ├── emailServer.ts           # Built-in SMTP server
│   ├── notificationService.ts   # FCM push + in-app notifications
│   └── seed.ts                  # Database seeder
├── src/
│   ├── App.tsx                  # Router and route definitions
│   ├── main.tsx                 # React entry point
│   ├── context/                 # Auth, Branding, I18n, Theme contexts
│   ├── layouts/                 # AdminLayout, AppLayout, CoachLayout, WebsiteLayout
│   ├── pages/
│   │   ├── admin/               # Dashboard, Settings, AdsManager, Blogs, Notifications, CMS, Email
│   │   ├── app/                 # Dashboard, Steps, Workouts, Analytics, Coaching, Community, Chat, Blogs, Notifications, Tools, Plans, Profile
│   │   ├── auth/                # Login, Register, ForgotPassword, SocialCallback
│   │   ├── coach/               # Dashboard, Athletes, Requests, Chat, Ads (5 sub-pages), Blogs, Community, Workouts, Notifications, Profile
│   │   └── website/             # CmsPage, About, Blogs, BlogPost
│   ├── components/              # app, auth, cms, layout, ui, website components
│   └── lib/                     # API client, Firebase, push notifications, utils
├── public/
│   └── firebase-messaging-sw.js # FCM background push service worker
├── capacitor.config.ts          # Android app config (com.peetrix.fitwayhub)
├── vite.config.ts               # Vite build config with proxy, code splitting
├── railway.toml                 # Railway deployment config
└── uploads/                     # Local file uploads directory
```

## API Routes

All routes are prefixed with `/api`.

| Endpoint | Module |
|----------|--------|
| `/api/auth` | Authentication (login, register, OAuth, password reset) |
| `/api/user` | User profile and settings |
| `/api/health` | Health data |
| `/api/steps` | Step tracking and history |
| `/api/workouts` | Workout videos, playlists, shorties |
| `/api/plans` | Workout and nutrition plans |
| `/api/coaching` | Coach marketplace, subscriptions, reviews |
| `/api/coach` | Coach-specific operations |
| `/api/community` | Posts, comments, likes, challenges, follows |
| `/api/chat` | Real-time messaging |
| `/api/blogs` | Blog posts (multilingual) |
| `/api/analytics` | Activity analytics and summaries |
| `/api/ai` | AI-powered insights (Gemini) |
| `/api/notifications` | Push tokens, in-app notifications, templates |
| `/api/email` | Email server management |
| `/api/payments` | Payment processing |
| `/api/pay` | Paymob payment gateway |
| `/api/ads` | Public ads API |
| `/api/ads-manager` | Internal ads management |
| `/api/ad-settings` | Ad configuration |
| `/api/ad-moderation` | Ad review and moderation |
| `/api/admin` | Admin operations (users, payments, withdrawals, videos) |
| `/api/cms` | Website CMS sections |
| `/api/track` | Activity tracking |
| `/api/ping` | Health check |

## Roles

| Role | Access |
|------|--------|
| **User** | Fitness tracking, workouts, coaching subscriptions, community, chat, notifications |
| **Coach** | Athlete management, workout/nutrition plans, ads campaigns, earnings/wallet, community, blogs, notifications |
| **Admin** | Full platform management — users, payments, subscriptions, ads moderation, CMS, notifications, email, settings |

## Key Features

- **Fitness Tracking** — Steps, workouts, analytics, AI-generated daily summaries
- **Coaching Marketplace** — Browse coaches, subscribe (monthly/yearly), receive personalized plans
- **Coach Dashboard** — Manage athletes, create workout/nutrition plans, process requests, track earnings
- **Ads System** — Coaches create ad campaigns with targeting, admins moderate, system tracks impressions/clicks
- **Community** — Posts with images, comments, likes, hashtags, challenges, coach profiles
- **Chat** — One-on-one messaging between users and coaches
- **Blogs** — Multilingual blog system (English/Arabic) with video support
- **Notifications** — FCM push notifications + in-app notification feed for all panels
- **Payments** — Paymob, Apple IAP, Google Play IAP; coach wallet with withdrawals
- **CMS** — Admin-managed website sections (hero, features, FAQ, carousel, etc.)
- **i18n** — English and Arabic with RTL support
- **Theming** — Dark/light mode with customizable branding

## Deployment

Configured for [Railway](https://railway.app) via `railway.toml`:

```bash
# Build
npm install && npm run build

# Start
NODE_ENV=production npm start
```

Health check: `GET /api/ping`

## Android Build

```bash
npm run build:android    # Build + sync
npx cap open android     # Open in Android Studio
npx cap run android      # Run on device/emulator
```

App ID: `com.peetrix.fitwayhub`

## Database

MySQL 8 with automatic table creation on first run. Connection priority:

1. `DATABASE_URL` (full connection string — Railway, Aiven, etc.)
2. `MYSQL_URL` (alternative full URL)
3. Individual `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` vars
4. Localhost defaults for local development

Pool: 10 connections, 20s timeout, keep-alive enabled.

## License

Private — all rights reserved.

## Software Requirements Specification (SRS)

### 1. Purpose and Scope

FitWay Hub is a role-based fitness platform that provides:
- User wellness tracking, workouts, analytics, community, subscriptions, and support communication.
- Coach operations for athlete management, planning, monetization, ads, and profile growth.
- Admin governance for moderation, settings, CMS, payments, notifications, and platform health.

The system supports web-first usage and Android packaging through Capacitor.

### 2. Product Overview

- Product type: multi-panel web application with backend APIs and persistent database.
- Primary users: athletes (users), coaches, and administrators.
- Language support: English and Arabic with RTL layout support.
- Interface modes: desktop and mobile-responsive layouts.

### 3. Stakeholders and Roles

- End User (Athlete): consumes fitness and coaching services.
- Coach: provides paid guidance and content.
- Admin: manages trust, safety, payments, content, and branding.
- Business Owner: defines monetization and platform policy.
- Support Team: handles user escalations through chat and notifications.

### 4. Functional Requirements

#### 4.1 Authentication and Access Control

- The system shall provide registration, login, token-based sessions, and role-based route protection.
- The system shall support password reset and optional social login integrations.
- The system shall enforce role boundaries for user, coach, and admin features.

#### 4.2 User Panel

- The system shall allow users to:
	- Track daily steps and goals.
	- View workout content and featured recommendations.
	- Access analytics snapshots and historical trends.
	- Browse and subscribe to coaches.
	- Join community feed, publish posts, and interact with content.
	- Chat with subscribed coaches and support.
	- Receive in-app notifications and push alerts.
	- Manage profile, preferences, and plan status.

#### 4.3 Coach Panel

- The system shall allow coaches to:
	- Create and maintain professional profile and pricing.
	- Receive and process subscription requests.
	- Manage athlete programs and training plans.
	- Track earnings and submit withdrawal requests.
	- Configure payment destination details.
	- Access community, publish content, and maintain media gallery.
	- Communicate through chat and notifications.

#### 4.4 Admin Panel

- The system shall allow admins to:
	- Manage users, roles, and sensitive profile fields.
	- Review and moderate content (videos, community, ads).
	- Configure app and website settings from database-driven forms.
	- Manage payment verification workflows and withdrawals.
	- Approve/reject coach subscription payment requests.
	- Broadcast and template notifications.
	- Operate backup/restore and test-data generation tools.
	- Configure branding, visibility toggles, and monetization controls.

#### 4.5 Ads and Campaigns

- The system shall support legacy and campaign-based ad serving.
- The system shall apply placement, schedule, and audience filtering.
- The system shall track impressions/clicks and support moderation states.

#### 4.6 Notifications and Messaging

- The system shall support:
	- In-app notification storage and read states.
	- Push notification delivery via FCM.
	- Admin-managed push templates and send logs.
	- Direct chat with role-safe policy enforcement.

#### 4.7 CMS and Website

- The system shall provide section-based website editing via admin CMS.
- The system shall support configurable hero/banner/section media.
- The system shall support branding controls (colors, fonts, logos, icons).

#### 4.8 Payments and Monetization

- The system shall support payment methods configured by admin.
- The system shall handle premium and coach subscription flows.
- The system shall maintain coach wallet balances and transaction history.
- The system shall support approval/rejection and refund-related statuses.

### 5. UI/UX Requirements

#### 5.1 Navigation

- Sidebar + top header on desktop role dashboards.
- Mobile top bar and bottom navigation.
- Upper navigation shortcuts shall be mobile-focused for quick access.

#### 5.2 Responsiveness

- All core pages shall render correctly on mobile and desktop breakpoints.
- Interactive controls shall remain touch-accessible on small screens.

#### 5.3 Accessibility and Usability

- Key actions shall be visible and discoverable with clear labels.
- Status indicators shall use color plus text semantics when possible.
- Forms shall provide validation feedback and actionable error messages.

#### 5.4 Visual System

- Branding values (color, typography, imagery) shall be admin-configurable.
- UI themes shall support light and dark contexts.
- Arabic layouts shall respect RTL directionality.

### 6. Data and Persistence Requirements

- MySQL shall be the source of truth for users, content, payments, settings, and logs.
- The app shall initialize required tables if missing.
- Settings shall be configurable via database records and consumed by UI at runtime.
- Media assets shall support local or cloud storage workflows.

### 7. API Requirements

- APIs shall use `/api/*` namespacing and JWT-protected protected routes.
- Responses shall be JSON with explicit success/failure semantics.
- Admin-only endpoints shall enforce role checks server-side.

### 8. Security Requirements

- Passwords shall be hashed before storage.
- Sensitive operations shall require authenticated tokens.
- Role escalation shall be restricted to admin workflows.
- Upload endpoints shall validate file type/size and sanitize handling.
- Secrets shall be provided through environment variables.

### 9. Performance Requirements

- UI interactions should remain responsive under typical dashboard loads.
- API queries should use filtering and pagination-ready patterns where possible.
- Build output may include chunk warnings; code-splitting strategy should be improved iteratively.

### 10. Reliability and Operations

- The system shall support backup and restore operations.
- Health endpoint(s) shall enable uptime checks.
- Logging shall support troubleshooting for payments, notifications, and moderation events.

### 11. Integration Requirements

- Optional integrations include:
	- Firebase (push notifications)
	- Google Gemini (AI features)
	- Paymob / app-store billing layers
	- Cloudflare R2 (cloud media)

### 12. Constraints and Assumptions

- Node.js and MySQL availability are required.
- Mobile app behavior depends on Capacitor WebView capabilities.
- Some features rely on external providers and valid credentials.

### 13. Acceptance Criteria (High Level)

- Users can complete core journey: onboarding, tracking, workout usage, and coaching subscription.
- Coaches can manage subscribers, payment destination, and withdrawal lifecycle.
- Admin can manage platform entities and content safely through dashboard controls.
- Mobile and desktop layouts function correctly with role-based navigation.
- Notifications and chat workflows operate with correct access restrictions.
