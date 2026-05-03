/* eslint-disable */
// One-shot patcher for the broken May-2 mysqldump.
//
// The export tool produced a hybrid:
//   * DDL uses ANSI-style "double-quoted" identifiers
//   * DML uses MySQL-style `backtick` identifiers
//   * JSON column values were serialized with Object.toString() →
//     '[object Object]' (invalid JSON, MySQL rejects them)
//
// We can't run it in either default mode or ANSI_QUOTES mode as-is.
// This script normalises identifiers to backticks (DDL only) and replaces
// the corrupted JSON values with NULL, so the dump can be restored cleanly.

const fs = require('fs');
const PATH = require('path').join(__dirname, 'fitwayhub-source-backup-2026-05-02T23-41-46.sql');

let s = fs.readFileSync(PATH, 'utf8');

// 1) Convert DDL identifiers from "name" to `name`. Process line-by-line so
//    we don't touch INSERT VALUES (which contain legitimate strings that
//    happen to use single quotes — but we still skip them defensively).
const fixed = s.split(/\r?\n/).map((line) => {
  if (/^INSERT INTO/.test(line)) return line;
  if (line.startsWith('--')) return line;
  return line.replace(/"([A-Za-z0-9_\-\.]+)"/g, '`$1`');
}).join('\n');

// 2) Replace all '[object Object]' (the broken JSON serialisation) with an
//    empty JSON object literal. Using NULL would fail NOT NULL constraints;
//    '{}' is valid JSON, NOT NULL friendly, and an obvious "blank" marker.
//    The original rule/setting structure is permanently lost — re-create
//    those rows from the admin UI after restore if needed.
let cleaned = fixed.replace(/'\[object Object\]'/g, "'{}'");

// 3) Restore the SET SQL_MODE line — step 1 also wrapped its string value
//    in backticks because it matched the same regex. SQL_MODE values are
//    string literals, not identifiers.
cleaned = cleaned.replace(/SET SQL_MODE = `NO_AUTO_VALUE_ON_ZERO`;/, "SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';");

fs.writeFileSync(PATH, cleaned);
console.log('patched: DDL identifiers + corrupted JSON values');
