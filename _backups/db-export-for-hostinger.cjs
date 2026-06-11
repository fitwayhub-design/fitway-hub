/* eslint-disable */
// Exports the local MySQL database into a Hostinger-friendly SQL file
// (data only, no schema). Hostinger's `initDatabase()` already creates the
// schema on first boot; this file just fills it with your existing rows.
//
// Usage:
//   npm run db:export                  # writes _backups/fitwayhub-for-hostinger.sql
//
// Then in Hostinger hPanel → phpMyAdmin → Import → upload that file.
//
// Safety:
//   --no-create-info  → data only, no DROP/CREATE TABLE
//   --skip-triggers   → triggers (if any) live in your schema, not the dump
//   --insert-ignore   → duplicate-key conflicts on already-seeded rows skip silently
//   --no-tablespaces  → required when the MySQL user lacks PROCESS priv (common)
//   --hex-blob        → preserves binary columns

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load env (look in project root)
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) dotenv.config({ path: envFile });

const HOST = process.env.DB_HOST || 'localhost';
const PORT = process.env.DB_PORT || '3306';
const USER = process.env.DB_USER || 'root';
const PASS = process.env.DB_PASSWORD || '';
const DB   = process.env.DB_NAME || 'fitwayhub';

// Try to find mysqldump.exe in the standard MySQL Server install path on
// Windows; on other platforms, assume it's on PATH.
const candidates = [
  'C:/Program Files/MySQL/MySQL Server 8.0/bin/mysqldump.exe',
  'C:/Program Files/MySQL/MySQL Server 9.0/bin/mysqldump.exe',
  '/usr/bin/mysqldump',
  '/usr/local/bin/mysqldump',
  'mysqldump',
];
const dumpBin = candidates.find(p => p === 'mysqldump' || (p.includes('/') && fs.existsSync(p))) || 'mysqldump';

const out = path.join(__dirname, 'fitwayhub-for-hostinger.sql');

console.log(`Exporting ${DB} from ${HOST}:${PORT} as ${USER}…`);
const args = [
  '-h', HOST,
  '-P', PORT,
  '-u', USER,
  PASS ? `-p${PASS}` : '--skip-password',
  '--no-create-info',
  '--skip-triggers',
  '--no-tablespaces',
  '--insert-ignore',
  '--hex-blob',
  '--single-transaction',
  '--default-character-set=utf8mb4',
  DB,
].filter(Boolean);

const r = spawnSync(dumpBin, args, { encoding: 'buffer' });
if (r.status !== 0) {
  console.error('mysqldump failed:', r.stderr?.toString() || r.error?.message);
  process.exit(1);
}

fs.writeFileSync(out, r.stdout);
const sizeMb = (fs.statSync(out).size / (1024 * 1024)).toFixed(2);
console.log(`✅ wrote ${out}  (${sizeMb} MB)`);
console.log(`\nNext: open hPanel → Databases → phpMyAdmin → Import → upload this file.`);
console.log('If the file is >50 MB, use SSH:  mysql -u USER -p DBNAME < fitwayhub-for-hostinger.sql');
