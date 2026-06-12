import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
const envResult = dotenv.config();
if (envResult.error) {
    dotenv.config({ path: 'env.txt' });
}
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import authRoutes from './server/routes/authRoutes.js';
import healthRoutes from './server/routes/healthRoutes.js';
import aiRoutes from './server/routes/aiRoutes.js';
import chatRoutes from './server/routes/chatRoutes.js';
import communityRoutes from './server/routes/communityRoutes.js';
import challengeRoutes from './server/routes/challengeRoutes.js';
import stepsRoutes from './server/routes/stepsRoutes.js';
import trackRoutes from './server/routes/trackRoutes.js';
import analyticsRoutes from './server/routes/analyticsRoutes.js';
import coachingRoutes from './server/routes/coachingRoutes.js';
import adminRoutes from './server/routes/adminRoutes.js';
import coachRoutes from './server/routes/coachRoutes2.js';
import userRoutes from './server/routes/userRoutes.js';
import workoutsRoutes from './server/routes/workoutsRoutes.js';
import plansRoutes from './server/routes/plansRoutes.js';
import paymentRoutes from './server/routes/paymentRoutes.js';
import cmsRoutes from './server/routes/cmsRoutes.js';
import blogRoutes from './server/routes/blogRoutes.js';
import emailRoutes from './server/routes/emailRoutes.js';
import notificationRoutes from './server/routes/notificationRoutes.js';
import paymentEngine from './server/routes/paymobRoutes.js';
import adsRoutes from './server/routes/adsRoutes.js';
import adSettingsRoutes from './server/routes/adSettingsRoutes.js';
import adModerationRoutes from './server/routes/adModerationRoutes.js';
import appImagesRoutes from './server/routes/appImagesRoutes.js';
import debugRoutes from './server/routes/debugRoutes.js';
import ticketsRoutes from './server/routes/ticketsRoutes.js';
import { startSmtpServer } from './server/emailServer.js';
import { errorHandler } from './server/middleware/error.js';
import { query as dbQuery, run as dbRun, get as dbGet } from './server/config/database.js';
import { runScheduledPushes } from './server/notificationService.js';
import { startChallengeJobs } from './server/services/challengeJobs.js';
// Build allowed origins from env so nothing is hardcoded.
// APP_BASE_URL is your backend domain (e.g. https://peter-adel.taila6a2b4.ts.net).
// EXTRA_ORIGINS is an optional comma-separated list of additional allowed origins.
function buildAllowedOrigins() {
    const base = [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173',
        'capacitor://localhost',
        'https://localhost',
        'http://localhost',
        'https://peter-adel.taila6a2b4.ts.net',
    ];
    if (process.env.APP_BASE_URL) {
        const url = process.env.APP_BASE_URL.replace(/\/$/, '');
        base.push(url);
        // also allow http variant
        base.push(url.replace('https://', 'http://'));
    }
    if (process.env.EXTRA_ORIGINS) {
        process.env.EXTRA_ORIGINS.split(',').forEach(o => base.push(o.trim()));
    }
    return [...new Set(base)];
}
const ALLOWED_ORIGINS = buildAllowedOrigins();
// ── Auto-renew subscriptions (credit-based) ─────────────────────────────────
async function processAutoRenewals() {
    try {
        // Find active subscriptions with auto_renew=1 that expire within the next 24 hours
        const expiring = await dbQuery(`SELECT cs.*, u.credit as user_credit, u.name as user_name,
              cp.monthly_price, cp.yearly_price, coach.name as coach_name
       FROM coach_subscriptions cs
       JOIN users u ON cs.user_id = u.id
       LEFT JOIN coach_profiles cp ON cs.coach_id = cp.user_id
       LEFT JOIN users coach ON cs.coach_id = coach.id
       WHERE cs.status = 'active'
         AND cs.auto_renew = 1
         AND cs.expires_at IS NOT NULL
         AND cs.expires_at <= DATE_ADD(NOW(), INTERVAL 24 HOUR)
         AND cs.expires_at > NOW()`);
        for (const sub of expiring) {
            const price = sub.plan_cycle === 'yearly'
                ? Number(sub.yearly_price || sub.amount || 0)
                : Number(sub.monthly_price || sub.amount || 0);
            if (price <= 0)
                continue;
            if (Number(sub.user_credit) < price) {
                // Notify user insufficient credit
                await dbRun('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)', [sub.user_id, 'subscription_renewal_failed', '⚠️ Subscription Renewal Failed',
                    `Your subscription to ${sub.coach_name || 'your coach'} could not be renewed. Insufficient credit (need ${price} EGP). Please top up or renew manually.`,
                    '/app/coaching']);
                continue;
            }
            // Deduct credit from user
            await dbRun('UPDATE users SET credit = credit - ? WHERE id = ?', [price, sub.user_id]);
            // Extend subscription
            const interval = sub.plan_cycle === 'yearly' ? 12 : 1;
            await dbRun('UPDATE coach_subscriptions SET expires_at = DATE_ADD(expires_at, INTERVAL ? MONTH), amount = ? WHERE id = ?', [interval, price, sub.id]);
            // Credit coach
            await dbRun('UPDATE users SET credit = credit + ? WHERE id = ?', [price, sub.coach_id]);
            await dbRun('INSERT INTO credit_transactions (user_id, amount, type, description) VALUES (?,?,?,?)', [sub.coach_id, price, 'subscription_renewal', `Auto-renewal from ${sub.user_name || 'user #' + sub.user_id} (${sub.plan_cycle})`]);
            // Notify both parties
            await dbRun('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)', [sub.user_id, 'subscription_renewed', '✅ Subscription Renewed',
                `Your ${sub.plan_cycle} subscription to ${sub.coach_name || 'your coach'} was auto-renewed for ${price} EGP.`,
                '/app/coaching']);
            await dbRun('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)', [sub.coach_id, 'subscription_renewed', '💰 Subscription Renewed',
                `${sub.user_name || 'A user'}'s ${sub.plan_cycle} subscription was auto-renewed (+${price} EGP credit).`,
                '/coach/profile']);
            console.log(`✅ Auto-renewed subscription #${sub.id} for user #${sub.user_id} → coach #${sub.coach_id} (${price} EGP)`);
        }
        // Also auto-renew certified coach subscriptions
        const expiringCerts = await dbQuery(`SELECT cp.user_id, cp.certified_until, u.credit, u.name
       FROM coach_profiles cp
       JOIN users u ON cp.user_id = u.id
       WHERE cp.certified = 1
         AND cp.certified_until IS NOT NULL
         AND cp.certified_until <= DATE_ADD(NOW(), INTERVAL 24 HOUR)
         AND cp.certified_until > NOW()`);
        const feeSetting = await dbQuery("SELECT setting_value FROM app_settings WHERE setting_key = 'certified_coach_fee'");
        const certFee = Number(feeSetting?.[0]?.setting_value) || 500;
        for (const cert of expiringCerts) {
            if (Number(cert.credit) < certFee) {
                await dbRun('UPDATE coach_profiles SET certified = 0 WHERE user_id = ?', [cert.user_id]);
                await dbRun('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)', [cert.user_id, 'certification_expired', '⚠️ Certification Expired',
                    `Your Certified Coach badge has expired. Insufficient credit to renew (need ${certFee} EGP).`,
                    '/coach/profile']);
                continue;
            }
            await dbRun('UPDATE users SET credit = credit - ? WHERE id = ?', [certFee, cert.user_id]);
            await dbRun('UPDATE coach_profiles SET certified_until = DATE_ADD(certified_until, INTERVAL 1 MONTH) WHERE user_id = ?', [cert.user_id]);
            await dbRun('INSERT INTO credit_transactions (user_id, amount, type, description) VALUES (?,?,?,?)', [cert.user_id, -certFee, 'certification_renewal', `Certified Coach auto-renewal - ${certFee} EGP/month`]);
            await dbRun('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)', [cert.user_id, 'certification_renewed', '✅ Certification Renewed',
                `Your Certified Coach badge was auto-renewed for ${certFee} EGP.`,
                '/coach/profile']);
            console.log(`✅ Auto-renewed certification for coach #${cert.user_id} (${certFee} EGP)`);
        }
    }
    catch (err) {
        console.error('Auto-renewal processing error:', err);
    }
}
async function startServer() {
    // Initialize MySQL
    const { initDatabase } = await import("./server/config/database.js");
    await initDatabase();
    const app = express();
    const PORT = process.env.PORT || 3000;
    // Trust proxy headers (X-Forwarded-For) — required when behind Tailscale, nginx, Railway, etc.
    app.set('trust proxy', 1);
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://apis.google.com"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
                imgSrc: ["'self'", "data:", "https:", "blob:"],
                connectSrc: ["'self'", "https:", "wss:"],
                mediaSrc: ["'self'", "https:", "blob:"],
                frameSrc: ["'self'", "https:"],
            },
        },
        crossOriginResourcePolicy: { policy: "cross-origin" }
    }));
    // Allow all origins — this is a mobile-first app (Capacitor).
    // The API is protected by JWT so CORS is not a meaningful security boundary here.
    app.use(cors({
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    }));
    // Only log requests in development — avoid leaking paths in production
    if (process.env.NODE_ENV !== 'production')
        app.use(morgan('dev'));
    app.use(express.json({ limit: '5mb' }));
    app.use(express.urlencoded({ extended: false, limit: '5mb' }));
    // Auth rate limiter — strict brute-force protection
    app.use('/api/auth/', rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 20, // 20 attempts per 15 min per IP
        message: { message: 'Too many login attempts. Please wait 15 minutes.' },
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: true,
    }));
    // Global API rate limiter
    app.use('/api/', rateLimit({
        windowMs: 1 * 60 * 1000, // 1 minute
        max: 120,
        message: { message: 'Too many requests, please slow down.' },
        standardHeaders: true,
        legacyHeaders: false,
    }));
    // Serve uploads — restrict to known media file extensions only. The
    // backing directory is `UPLOADS_DIR` if set (must be absolute); otherwise
    // it defaults to <home>/fitway-uploads so files survive `git pull` and
    // app redeploys without any admin setup. The directory is created on
    // boot, and the resolved path is logged so it's easy to verify.
    const uploadsBaseDir = process.env.UPLOADS_DIR && path.isAbsolute(process.env.UPLOADS_DIR)
        ? process.env.UPLOADS_DIR
        : path.join(os.homedir(), 'fitway-uploads');
    try {
        fs.mkdirSync(uploadsBaseDir, { recursive: true });
        console.log(`📁 Uploads directory: ${uploadsBaseDir}`);
    }
    catch (err) {
        console.warn(`⚠️  Could not create uploads directory ${uploadsBaseDir}: ${err.message}`);
    }
    app.use('/uploads', (req, res, next) => {
        const allowed = /\.(jpg|jpeg|png|gif|webp|svg|mp4|webm|mov|mp3|webm|ogg|pdf)$/i;
        if (!allowed.test(req.path))
            return res.status(403).json({ message: 'Forbidden' });
        next();
    }, express.static(uploadsBaseDir, {
        setHeaders: (res, filePath) => {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            // SVG: force the correct MIME (so nosniff doesn't block it) and a
            // strict CSP that disables script execution even if any sneaks past
            // the upload-time sanitiser.
            if (/\.svg$/i.test(filePath)) {
                res.setHeader('Content-Type', 'image/svg+xml');
                res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:;");
            }
        }
    }));
    // ── Health check – Railway uses this to confirm the service is alive ──
    app.get('/api/ping', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
    // Public platform stats — used by the About page (no auth needed)
    app.get('/api/public/stats', async (_req, res) => {
        try {
            const { get: dbGet, query: dbQuery } = await import('./server/config/database.js');
            const [users, coaches, programs, ratings] = await Promise.all([
                dbGet('SELECT COUNT(*) as cnt FROM users WHERE role = ?', ['user']),
                dbGet('SELECT COUNT(*) as cnt FROM users WHERE role = ?', ['coach']),
                dbGet('SELECT COUNT(*) as cnt FROM workout_videos'),
                dbGet('SELECT ROUND(AVG(rating),1) as avg, COUNT(*) as cnt FROM coach_reviews WHERE rating > 0'),
            ]);
            res.json({
                members: users?.cnt || 0,
                coaches: coaches?.cnt || 0,
                programs: programs?.cnt || 0,
                rating: ratings?.avg ? parseFloat(ratings.avg).toFixed(1) : '5.0',
                reviews: ratings?.cnt || 0,
            });
        }
        catch {
            res.status(500).json({ message: 'Failed' });
        }
    });
    app.use('/api/auth', authRoutes);
    app.use('/api/health', healthRoutes);
    app.use('/api/steps', stepsRoutes);
    app.use('/api/ai', aiRoutes);
    app.use('/api/chat', chatRoutes);
    app.use('/api/community', communityRoutes);
    app.use('/api/challenges', challengeRoutes);
    app.use('/api/track', trackRoutes);
    app.use('/api/analytics', analyticsRoutes);
    app.use('/api/coaching', coachingRoutes);
    app.use('/api/admin', adminRoutes);
    app.use('/api/coach', coachRoutes);
    app.use('/api/payments', paymentRoutes);
    app.use('/api/user', userRoutes);
    app.use('/api/workouts', workoutsRoutes);
    app.use('/api/plans', plansRoutes);
    app.use('/api/cms', cmsRoutes);
    app.use('/api/blogs', blogRoutes);
    app.use('/api/email', emailRoutes);
    app.use('/api/notifications', notificationRoutes);
    app.use('/api/pay', paymentEngine);
    app.use('/api/ads', adsRoutes);
    // Internal Ads Manager API
    const { default: adsManagerRoutes } = await import('./server/routes/adsManagerRoutes.js');
    app.use('/api/ads-manager', adsManagerRoutes);
    // Dev debug endpoints
    if (process.env.NODE_ENV !== 'production')
        app.use('/api/debug', debugRoutes);
    app.use('/api/ad-settings', adSettingsRoutes);
    app.use('/api/ad-moderation', adModerationRoutes);
    app.use('/api/app-images', appImagesRoutes);
    app.use('/api/tickets', ticketsRoutes);
    // Start SMTP receive server
    try {
        startSmtpServer(Number(process.env.SMTP_PORT || 2525));
    }
    catch (e) {
        console.warn('SMTP server failed to start:', e);
    }
    // In production serve the built frontend; in dev, run `npx vite` separately
    const distDir = path.join(__dirname, 'dist');
    const distIndex = path.join(distDir, 'index.html');
    const { existsSync } = await import('fs');
    // ── SEO: crawlers and link-preview bots don't run the SPA, so the server
    // injects per-route <title>/<meta>/<og:*> into the built index.html for the
    // public pages, and generates robots.txt + sitemap.xml dynamically. ──────────
    const SITE_NAME = 'FitWay Hub';
    const PUBLIC_META = {
        '/': { title: `${SITE_NAME} — Fitness Coaching, Workouts & Community`, desc: 'Train with certified coaches, follow workout programs, track steps, join challenges, and stay accountable with the FitWay Hub community.' },
        '/about': { title: `About — ${SITE_NAME}`, desc: 'What FitWay Hub is, how coaching works, and the team behind the platform.' },
        '/contact': { title: `Contact — ${SITE_NAME}`, desc: 'Get in touch with the FitWay Hub team.' },
        '/blogs': { title: `Blog — ${SITE_NAME}`, desc: 'Training tips, nutrition guidance, and fitness insights from FitWay Hub coaches.' },
        '/privacy': { title: `Privacy Policy — ${SITE_NAME}`, desc: 'How FitWay Hub collects, uses, and protects your data.' },
        '/terms': { title: `Terms of Service — ${SITE_NAME}`, desc: 'The terms that govern your use of FitWay Hub.' },
    };
    const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const siteBase = () => (process.env.APP_BASE_URL || '').replace(/\/$/, '');
    const injectMeta = (html, meta) => {
        const tags = [
            `<meta name="description" content="${escapeHtml(meta.desc)}" data-seo />`,
            `<meta property="og:site_name" content="${SITE_NAME}" data-seo />`,
            `<meta property="og:type" content="${meta.type || 'website'}" data-seo />`,
            `<meta property="og:title" content="${escapeHtml(meta.title)}" data-seo />`,
            `<meta property="og:description" content="${escapeHtml(meta.desc)}" data-seo />`,
            meta.url ? `<link rel="canonical" href="${escapeHtml(meta.url)}" data-seo /><meta property="og:url" content="${escapeHtml(meta.url)}" data-seo />` : '',
            meta.image ? `<meta property="og:image" content="${escapeHtml(meta.image)}" data-seo /><meta name="twitter:card" content="summary_large_image" data-seo />` : '',
            `<meta name="twitter:title" content="${escapeHtml(meta.title)}" data-seo />`,
            `<meta name="twitter:description" content="${escapeHtml(meta.desc)}" data-seo />`,
        ].filter(Boolean).join('\n    ');
        return html
            // Drop the static fallback description/OG tags so crawlers don't see duplicates.
            .replace(/\n?\s*<meta (?:name="description"|property="og:[^"]*"|name="twitter:[^"]*")[^>]*>/g, '')
            .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(meta.title)}</title>`)
            .replace('</head>', `    ${tags}\n  </head>`);
    };
    app.get('/robots.txt', (_req, res) => {
        const base = siteBase();
        res.type('text/plain').send(['User-agent: *', 'Allow: /', 'Disallow: /app/', 'Disallow: /admin/', 'Disallow: /coach/',
            'Disallow: /auth/', 'Disallow: /api/', 'Disallow: /uploads/',
            ...(base ? [``, `Sitemap: ${base}/sitemap.xml`] : [])].join('\n'));
    });
    app.get('/sitemap.xml', async (_req, res) => {
        try {
            const base = siteBase();
            if (!base)
                return res.status(404).send('Set APP_BASE_URL to enable the sitemap');
            const staticPaths = Object.keys(PUBLIC_META);
            let posts = [];
            try {
                posts = await dbQuery("SELECT slug, updated_at FROM blog_posts WHERE status = 'published' ORDER BY COALESCE(published_at, created_at) DESC LIMIT 500");
            }
            catch { /* table may not exist on a fresh install — sitemap still serves static pages */ }
            const urls = [
                ...staticPaths.map(p => `  <url><loc>${base}${p === '/' ? '' : p}</loc></url>`),
                ...posts.map((p) => {
                    const lastmod = p.updated_at ? `<lastmod>${new Date(p.updated_at).toISOString().slice(0, 10)}</lastmod>` : '';
                    return `  <url><loc>${base}/blogs/${encodeURIComponent(p.slug)}</loc>${lastmod}</url>`;
                }),
            ].join('\n');
            res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`);
        }
        catch {
            res.status(500).send('');
        }
    });
    if (existsSync(distIndex)) {
        const readIndex = () => fs.promises.readFile(distIndex, 'utf8');
        // Blog posts get their real title/excerpt/cover as OG tags so shared links
        // unfurl properly — the single highest-value SEO surface of the site.
        app.get('/blogs/:slug', async (req, res, next) => {
            try {
                const html = await readIndex();
                const post = await dbGet("SELECT title, excerpt, header_image_url, slug FROM blog_posts WHERE slug = ? AND status = 'published'", [String(req.params.slug || '')]);
                if (!post)
                    return res.send(injectMeta(html, { ...PUBLIC_META['/blogs'], url: siteBase() ? `${siteBase()}/blogs` : undefined }));
                const base = siteBase();
                const img = post.header_image_url && /^https?:\/\//i.test(post.header_image_url)
                    ? post.header_image_url
                    : (post.header_image_url && base ? `${base}${post.header_image_url.startsWith('/') ? '' : '/'}${post.header_image_url}` : undefined);
                res.send(injectMeta(html, {
                    title: `${post.title} — ${SITE_NAME}`,
                    desc: String(post.excerpt || '').slice(0, 300) || `Read "${post.title}" on the ${SITE_NAME} blog.`,
                    url: base ? `${base}/blogs/${encodeURIComponent(post.slug)}` : undefined,
                    image: img,
                    type: 'article',
                }));
            }
            catch {
                next();
            }
        });
        // Static public pages: per-route title/description/canonical.
        for (const [route, meta] of Object.entries(PUBLIC_META)) {
            app.get(route, async (_req, res, next) => {
                try {
                    const base = siteBase();
                    res.send(injectMeta(await readIndex(), { ...meta, url: base ? `${base}${route === '/' ? '' : route}` : undefined }));
                }
                catch {
                    next();
                }
            });
        }
        app.use(express.static(distDir));
        app.get(/^(?!\/api\/).*/, (_req, res) => {
            res.sendFile(distIndex);
        });
        console.log('✅ Serving built frontend from dist/ (with SEO meta injection)');
    }
    else {
        // dist/ not built yet — show helpful message instead of blank page
        app.get('/', (_req, res) => {
            res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>FitWay Hub</title>
        <style>
          body{background:#0F0F14;color:#F0F0F8;font-family:sans-serif;display:flex;align-items:center;
               justify-content:center;min-height:100vh;margin:0;flex-direction:column;gap:12px;padding:20px;text-align:center}
          h1{color:#7C6EFA;font-size:28px;margin:0}
          p{color:#8B8B9E;margin:0;font-size:14px}
          code{display:inline-block;background:#1C1C26;border:1px solid rgba(255,255,255,0.1);
               padding:8px 18px;border-radius:10px;font-size:15px;color:#7C6EFA;margin:6px 0}
        </style></head>
        <body>
          <h1>⚡ FitWay Hub</h1>
          <p>The server is running but the frontend hasn't been built yet.</p>
          <p>Run this command in your project folder, then restart:</p>
          <code>npm run build</code>
          <p style="margin-top:8px">The API is fully available at <code>/api/...</code></p>
        </body></html>`);
        });
        app.get(/^(?!\/api\/).*/, (_req, res) => { res.redirect('/'); });
        console.log('⚠️  dist/ not found — run: npm run build');
    }
    app.use(errorHandler);
    app.listen(Number(PORT), '0.0.0.0', () => {
        console.log(`\n🏋️  FitWay Hub Server running on port ${PORT}`);
        console.log(`📱  Local:    http://localhost:${PORT}`);
        console.log(`🌐  Network: ${process.env.APP_BASE_URL || 'http://localhost:' + PORT}`);
        if (process.env.NODE_ENV !== 'production') {
            console.log(`\n📦  Run frontend: npx vite --host 0.0.0.0`);
        }
        console.log(`\n▶  Run seed: npx tsx server/seed.ts\n`);
        // Auto-renew subscriptions check every hour
        setInterval(async () => {
            try {
                await processAutoRenewals();
            }
            catch (e) {
                console.error('Auto-renew error:', e);
            }
        }, 60 * 60 * 1000);
        // Scheduled push notifications every 6 hours
        setInterval(async () => {
            try {
                await runScheduledPushes();
            }
            catch (e) {
                console.error('Scheduled push error:', e);
            }
        }, 6 * 60 * 60 * 1000);
        // Also run once on startup after a short delay
        setTimeout(() => processAutoRenewals().catch(() => { }), 30_000);
        setTimeout(() => runScheduledPushes().catch(() => { }), 60_000);
        // Challenge jobs: auto-finalize ended challenges + daily goal reminders.
        startChallengeJobs();
    });
}
startServer();
export default startServer;
//# sourceMappingURL=server.js.map