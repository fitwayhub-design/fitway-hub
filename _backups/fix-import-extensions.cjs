/* eslint-disable */
// Add `.js` extensions to relative imports that lack them. Required by
// Node.js ESM resolution (and by the new tsconfig.server.json which uses
// moduleResolution: NodeNext). The source already uses `.js` for most
// imports — this script catches the stragglers.
//
// Run from project root:
//   node _backups/fix-import-extensions.cjs
//
// What it touches:
//   - import / export from '...' / "..."
//   - relative paths only (./, ../) — never npm package imports
//   - skips paths that already end in .js, .json, or have any extension
//
// Pass --dry to preview without writing.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'server');
const ROOT_FILE = path.join(__dirname, '..', 'server.ts');
const DRY = process.argv.includes('--dry');

// Match `from '...'` or `from "..."` where ... starts with ./ or ../ and
// doesn't already have a file extension. Captures the path so we can
// rewrite it.
const importRe = /(from\s*['"])(\.\.?\/[^'"]+?)(['"])/g;

function shouldAddJs(p) {
  // Skip if already has any extension (.js, .json, .ts, .css, etc.)
  if (/\.[a-zA-Z0-9]+$/.test(p)) return false;
  return true;
}

function fixContent(src) {
  return src.replace(importRe, (_, pre, p, post) => {
    if (!shouldAddJs(p)) return _;
    return `${pre}${p}.js${post}`;
  });
}

let touched = 0;
let totalAdded = 0;

function walk(target) {
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    if (path.basename(target) === 'node_modules' || path.basename(target) === '__tests__') return;
    for (const e of fs.readdirSync(target)) walk(path.join(target, e));
    return;
  }
  if (!/\.ts$/.test(target)) return;

  const src = fs.readFileSync(target, 'utf8');
  const next = fixContent(src);
  if (next === src) return;

  // Count how many imports we added .js to (just for the report).
  const added = (next.match(/\.js['"]/g) || []).length - (src.match(/\.js['"]/g) || []).length;
  touched++;
  totalAdded += added;
  if (DRY) {
    console.log(`  +${added} × ${path.relative(path.join(__dirname, '..'), target)}`);
  } else {
    fs.writeFileSync(target, next);
  }
}

console.log(DRY ? 'DRY RUN (no writes):' : 'Fixing imports…');
walk(ROOT);
walk(ROOT_FILE);
console.log(`\n${DRY ? 'Would touch' : 'Touched'} ${touched} files, added ${totalAdded} .js extensions.`);
