# Deploying FitWay Hub to Hostinger

End-to-end guide. Read in order, top to bottom. Assumes a Hostinger plan that
includes the **Node.js** feature in hPanel (Premium / Business / Cloud). Shared
plans without Node.js cannot run this app — you'll need to upgrade.

## What you're deploying

- **Backend**: Node.js + Express (compiled from TypeScript to `server.js`)
- **Frontend**: React + Vite (built into `dist/`, served by the same Express)
- **Database**: MySQL 8 (Hostinger-hosted, you create one DB)
- **Storage**: Cloudflare R2 for uploads (NOT Hostinger — keep your existing R2)

There is **only one process** to run on Hostinger: `node server.js`. The
Express server serves both the API and the static React build out of the
same port, so there's no separate "frontend deploy".

---

## 1. Set up the Hostinger MySQL database

You only do this once.

1. Log in to **hPanel** → your domain (`fitwayhub.com`) → **Databases** → **Management**.
2. Click **Create database** (or "Create a new MySQL database").
3. Fill in:
   - **Database name**: `fitwayhub` (Hostinger may prefix it like `u123456_fitwayhub` — use whatever they give you)
   - **Database user**: pick a name (e.g. `fitwayhub_app`)
   - **Password**: generate a strong one — save it somewhere secure
4. Hit **Create**. Hostinger shows you four values:
   - `Database name`  → `MYSQL_DATABASE`
   - `Database user`  → `MYSQL_USER`
   - `Database password`  → `MYSQL_PASSWORD`
   - `Database host` — for Hostinger Premium/Business hPanel use **`127.0.0.1`** (the loopback IP, NOT the literal string `localhost` — Hostinger's MySQL socket only resolves on `127.0.0.1`). For Hostinger Cloud Databases it's a managed remote host like `mysql-fitwayhub.hostinger.io` instead. → `DB_HOST`

Keep this tab open — you'll paste these in step 4.

> The DATABASE TABLES are created **automatically** the first time the server
> boots — `initDatabase()` runs every CREATE TABLE IF NOT EXISTS, seeds the
> default settings, and runs the ads-system migration. You don't need to
> import any schema by hand.

## 2. Push the code to GitHub

From your local machine:

```bash
cd C:/Users/Peter/Downloads/fitwayhub-ads-system/fitwayhub
git init                         # only if not already a repo
git add .
git commit -m "Initial Hostinger deployment"
git branch -M main
git remote add origin git@github.com:YOUR_USERNAME/fitwayhub.git
git push -u origin main
```

What does NOT get pushed (already in `.gitignore`):

- `node_modules/` — Hostinger runs `npm install` and rebuilds it
- `dist/` — Hostinger builds it via the postinstall hook
- `server.js`, `server/**/*.js` — compiled outputs, regenerated each deploy
- `.env`, `.env.aiven-backup-*` — secrets, configured in hPanel
- `_backups/` — local-only DB tooling
- `aiven-ca.crt` is intentionally KEPT in git — it's a public CA cert that's safe to commit

## 3. Connect the GitHub repo in Hostinger

1. hPanel → your domain → **Git** (or "GitHub Auto Deployment").
2. **Connect repository**: paste `https://github.com/YOUR_USERNAME/fitwayhub.git`
3. Branch: `main`
4. Install path: leave at the domain root (e.g. `public_html` or `domains/fitwayhub.com/public_html`)
5. Hostinger pulls the code immediately. After this any `git push` to `main` triggers a re-pull.

## 4. Create the Node.js application

1. hPanel → **Advanced** → **Node.js**.
2. Click **Create application** with:
   - **Node.js version**: 20 LTS (or 22)
   - **Application root**: same path you set in step 3 (e.g. `/home/u123456/public_html`)
   - **Application URL**: `https://www.fitwayhub.com`
   - **Application startup file**: `server.js`
   - **Run NPM Install**: yes
3. Save. Hostinger runs `npm install` — that triggers our `postinstall` hook,
   which compiles `server.ts` → `server.js` and builds the React frontend
   into `dist/`.

> First install takes 4–8 minutes (sharp + bcrypt build native binaries).
> Subsequent installs take 30–90 seconds.

## 5. Set environment variables

Still on the Node.js app page in hPanel, scroll to **Environment Variables**.
Click **Add variable** for each of these. The minimum to boot:

| Key                           | Value                                                                |
|-------------------------------|----------------------------------------------------------------------|
| `NODE_ENV`                    | `production`                                                         |
| `PORT`                        | `3000` (Hostinger may auto-set this — leave it as Hostinger's default) |
| `APP_BASE_URL`                | `https://www.fitwayhub.com`                                          |
| `DB_HOST`                     | `127.0.0.1` (Hostinger hPanel) — see step 1. Don't write `localhost` |
| `DB_USER`                     | (from step 1)                                                        |
| `DB_PASSWORD`                 | (from step 1)                                                        |
| `DB_NAME`                     | (from step 1)                                                        |
| `DB_PORT`                     | `3306`                                                               |
| `DB_SSL`                      | `false` (Hostinger's hPanel MySQL is local; if you use Hostinger Cloud DB, set `true`) |
| `DB_AUTO_CREATE`              | `false` (DB is already created; don't try to CREATE DATABASE)        |
| `JWT_SECRET`                  | A 48-byte random string. Generate with: `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` |
| `R2_ACCOUNT_ID`               | (your Cloudflare R2 account ID)                                      |
| `R2_ACCESS_KEY_ID`            | (R2 access key)                                                      |
| `R2_SECRET_ACCESS_KEY`        | (R2 secret)                                                          |
| `R2_BUCKET_NAME`              | (R2 bucket name)                                                     |
| `R2_PUBLIC_URL`               | (R2 public URL, e.g. `https://pub-xxxx.r2.dev`)                      |

Optional but recommended (paste only what you use — leaving them blank disables that feature):

| Key                           | Value                                                                |
|-------------------------------|----------------------------------------------------------------------|
| `GEMINI_API_KEY`              | For `/api/ai/analyze-steps` (otherwise that endpoint returns 500)    |
| `PAYPAL_CLIENT_ID`            | PayPal payment processor                                             |
| `PAYPAL_SECRET`               | PayPal API secret                                                    |
| `PAYPAL_WEBHOOK_ID`           | Required for PayPal webhooks (without it they fail closed)           |
| `PAYPAL_MODE`                 | `live` for production, `sandbox` for testing                         |
| `FCM_PROJECT_ID`              | Firebase Cloud Messaging project                                     |
| `FCM_SERVICE_ACCOUNT_JSON`    | The full service-account JSON (base64-encode it for safety)          |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASSWORD` | Outbound email                                          |
| `MOBILE_APP_SCHEME`           | `fitwayhub` (deep-link scheme for Capacitor app)                     |

After saving, click **Restart** on the Node.js app card. Wait ~30s.

## 6. Smoke test

```bash
curl https://www.fitwayhub.com/api/ping
# → {"status":"ok","timestamp":"..."}
```

If you see that, the server booted and connected to MySQL. Open the homepage:
`https://www.fitwayhub.com` should now serve the React app.

## 7. Login + first-run admin setup

The seed creates three default accounts on first DB boot. Their passwords are
hashed in `server/config/database.ts → seedDefaultAccounts()` — you'll need
to **reset them** before going live:

| Email                     | Role  | What to do                                                        |
|---------------------------|-------|-------------------------------------------------------------------|
| `peteradmin@example.com`  | admin | Use Forgot-Password flow OR set a new bcrypt hash via SQL         |
| `petercoach@example.com`  | coach | Same                                                              |
| `test@example.com`        | user  | Delete OR rename to a real test account                           |

To set a known password for the admin via SQL (run from hPanel → MySQL → phpMyAdmin → SQL tab):

```sql
-- Hash for the password "ChangeMeNow!2026" generated with: node -e "console.log(require('bcryptjs').hashSync('ChangeMeNow!2026', 12))"
UPDATE users
SET password = '$2b$12$REPLACE_WITH_GENERATED_HASH'
WHERE email = 'peteradmin@example.com';
```

Now log in at `https://www.fitwayhub.com/auth/login` with that email + password.
Open `/admin/website` and:

1. **Branding** → set app name, logos, primary color, fonts
2. **Pages → Home** → upload hero images, configure features
3. **Settings → Payments** → paste your PayPal client ID + secret + e-wallet numbers

## 8. Importing your existing data (optional)

If you want to bring in data from your local DB (3 users, 129 coach profiles,
12 subscriptions, 20 blog posts, etc. that we restored locally earlier):

### Export from local

```bash
cd fitwayhub/_backups
"/c/Program Files/MySQL/MySQL Server 8.0/bin/mysqldump.exe" \
  -u root -pPeterishere1 \
  --no-create-info --skip-triggers --no-tablespaces \
  --insert-ignore \
  fitwayhub > fitwayhub-data-only.sql
```

`--no-create-info` means data only, no `CREATE TABLE` statements (Hostinger
already has the tables from `initDatabase()`).
`--insert-ignore` means duplicate-key conflicts (e.g. seeded settings rows)
silently skip instead of aborting.

### Import on Hostinger

1. hPanel → **Databases** → click on your fitwayhub DB → **phpMyAdmin**.
2. Select the `fitwayhub` (or `u123456_fitwayhub`) database in the left tree.
3. Click **Import** tab → **Choose File** → upload `fitwayhub-data-only.sql`.
4. Hit **Go**. Watch for "Import has been successfully finished" at the top.

> Hostinger's phpMyAdmin caps file uploads at ~50 MB. If your dump is bigger,
> use SSH + `mysql -u USER -p DBNAME < dump.sql` instead.

## 9. Auto-deploy on every git push

Once steps 3–5 are done, the loop is:

```
local edit → git push origin main → Hostinger pulls → npm install
                                      ↓
                       postinstall: npm run build
                                      ↓
                  build:client (vite → dist/) + build:server (tsc → server.js)
                                      ↓
                       Hostinger restarts node process
                                      ↓
                   live in ~60-90 seconds
```

If a deploy fails, hPanel → **Node.js app** → **Logs** shows the failure.
Common causes:

- New env var introduced in code but not added to Hostinger → boot fails
- Pushed a change that breaks `npm run build` (`tsc` error) → postinstall exits non-zero, Hostinger keeps the OLD `server.js` running, so the site doesn't go down. You'll see the failed deploy in Git → Deployments
- Forgot to update `package.json` lockfile after adding a dep → `npm install` fails

## 10. Custom domain SSL

Hostinger handles SSL automatically via Let's Encrypt — once your DNS points at
Hostinger and the domain is added in hPanel, HTTPS just works. The Node app's
`trust proxy` setting in `server.ts` is already correct for Hostinger's reverse
proxy.

If `https://www.fitwayhub.com` shows a self-signed warning:
- hPanel → SSL → **Force HTTPS** → enable
- Wait 5 minutes for the cert to provision

---

## Troubleshooting

### "Application failed to start"

Check the Node.js app log. Common failures:

- **`Error: connect ECONNREFUSED 127.0.0.1:3306`** (or `localhost:3306`) — wrong
  `DB_HOST`. On Hostinger hPanel, set it to `127.0.0.1` (NOT `localhost` —
  Hostinger's MySQL socket only listens on the IP, not the hostname). On
  Hostinger Cloud DB plans it's the remote host shown on the DB page.
- **`Access denied for user 'X'@'%'`** — wrong `DB_USER` / `DB_PASSWORD`. Reset
  the password in hPanel → Databases → ⋯ → Change password.
- **`JWT_SECRET environment variable is required`** — you forgot to set it.
- **`Cannot find module '/.../server.js'`** — postinstall didn't run. Check
  the install log; if `npm run build` failed, fix that locally and push again.

### "ENOENT: no such file or directory, open '/.../dist/index.html'"

Frontend build didn't run. Check that `postinstall` ran successfully — search
the Node.js install log for `vite v` (Vite's banner). If it didn't run:

```bash
# SSH into Hostinger and manually rebuild:
cd ~/public_html      # or wherever your app root is
npm run build
# Then restart the Node app from hPanel
```

### "MySQL too many connections" / intermittent 503s

The DB connection pool default is fine for Hostinger's MySQL. If you see
"too many connections" errors, lower it: edit `server/config/database.ts`
`connectionLimit` from `10` → `3` and redeploy.

### Disk usage growing fast

Most likely culprit:
- `_backups/` (gitignored, but if you SSH'd in and ran something there it can grow)
- `uploads/` (should be empty — files are stored in R2)

Clean up via SSH:
```bash
rm -rf ~/public_html/_backups ~/public_html/uploads/*
```

### Need to re-seed the CMS content

```bash
# SSH in
cd ~/public_html
node -e "import('./server/seed_cms.js').then(m => m.default || m).catch(e => console.error(e))"
# OR with the safer approach using the source:
SKIP_BUILD=1 npm install -g tsx
npx tsx server/seed_cms.ts            # non-destructive
npx tsx server/seed_cms.ts --force    # overwrites existing CMS rows
```

## Quick reference

| What you want | How |
|---|---|
| Trigger a redeploy | `git push` (Hostinger auto-pulls) |
| Look at server logs | hPanel → Node.js app → **Logs** |
| Look at MySQL data | hPanel → Databases → phpMyAdmin |
| Open SSH into the server | hPanel → **SSH Access** (must be enabled in your plan) |
| Roll back a bad deploy | hPanel → Git → **Deployments** → click an older deploy → **Redeploy** |
| Restart Node manually | hPanel → Node.js app → **Restart** |
| Full re-init the DB | Drop the DB in hPanel, recreate it, restart the Node app — `initDatabase()` runs again on next boot |
