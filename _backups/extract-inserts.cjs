/* eslint-disable */
// Extract INSERT statements from the patched dump into a separate file.
// Run AFTER patch-dump.cjs has run.
//
// Why: rather than fight the dump's busted DDL, we re-create tables fresh
// via the app's own initDatabase() (correct, current schema), then load
// just the data. Bad rows skip individually with mysql --force.

const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, 'fitwayhub-source-backup-2026-05-02T23-41-46.sql');
const DST = path.join(__dirname, 'fitwayhub-inserts-only.sql');

const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);
const out = [
  '-- Extracted INSERT statements only (CREATE/DROP TABLE skipped).',
  '-- Restore against a freshly initDatabase()-d schema.',
  'SET FOREIGN_KEY_CHECKS=0;',
  'SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";',
  '',
];

let inInsert = false;
for (const line of lines) {
  if (/^INSERT INTO /.test(line)) { inInsert = true; out.push(line); continue; }
  if (inInsert) {
    out.push(line);
    if (/;\s*$/.test(line)) inInsert = false;
  }
}
out.push('SET FOREIGN_KEY_CHECKS=1;');

fs.writeFileSync(DST, out.join('\n'));
const inserts = out.filter(l => /^INSERT INTO /.test(l)).length;
console.log(`extracted ${inserts} INSERT blocks → ${path.basename(DST)}`);
