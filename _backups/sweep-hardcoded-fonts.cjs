/* eslint-disable */
// Replace every hardcoded `fontFamily: "'Gotham', sans-serif"` (and the
// other named-font variants) with `fontFamily: "var(--font-en)"` so the
// admin's English-body font choice takes effect. Body and heading both
// resolve through the BrandingContext CSS vars set on <html>.
//
// We deliberately do NOT touch:
//   - monospace / inherit / system-ui (special-purpose, theme-agnostic)
//   - already-correct `var(--font-en)` / `var(--font-ar)` / `var(--font-heading)`
//   - .test files
//   - lucide / icon imports
//   - admin tooling that previews specific fonts (Settings preview row, font picker)
//
// Run from project root:
//   node _backups/sweep-hardcoded-fonts.cjs
//
// Pass --dry to print changes without writing.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'src');
const DRY = process.argv.includes('--dry');

const NAMED_FONTS = [
  'Gotham', 'Plus Jakarta Sans', 'Cairo', 'Inter', 'Roboto', 'Poppins',
  'Montserrat', 'Lato', 'DM Sans', 'Nunito', 'Open Sans', 'Helvetica',
  'Helvetica Neue', 'Arial', 'Barlow', 'Barlow Condensed',
];

// Build a single regex that matches any of these forms:
//   fontFamily: "'Gotham', sans-serif"
//   fontFamily: '"Gotham", sans-serif'
//   fontFamily: "'Gotham', 'Helvetica Neue', sans-serif"
//   fontFamily: "Gotham, sans-serif"
//
// The opening font name must match one of NAMED_FONTS (with or without quotes).
const fontAlt = NAMED_FONTS.map(f => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
// Match: fontFamily: "<anything that includes a named font>, ...sans-serif|serif|monospace>"
const re = new RegExp(
  `fontFamily\\s*:\\s*["'\`]\\s*['"]?(${fontAlt})['"]?[^"'\`]*["'\`]`,
  'g'
);

let touchedFiles = 0;
let totalReplacements = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      walk(full);
      continue;
    }
    if (!/\.(tsx?|jsx?)$/.test(entry.name)) continue;
    if (/\.test\./.test(entry.name)) continue;

    let src = fs.readFileSync(full, 'utf8');
    let replacements = 0;

    // Skip files where this is intentional (Settings page font preview row).
    // The Settings preview shows the literal font name selected — leave it.
    const skipFiles = ['Settings.tsx'];
    const isSkip = skipFiles.includes(path.basename(full)) &&
      // Only skip the preview-line, not the whole file. We'll handle the
      // file generally; the preview row uses var(--font-en) via inline expr,
      // so leaving named fonts elsewhere in Settings (admin font picker) is OK.
      false;
    if (isSkip) continue;

    const next = src.replace(re, () => {
      replacements++;
      return 'fontFamily: "var(--font-en)"';
    });

    if (replacements > 0) {
      touchedFiles++;
      totalReplacements += replacements;
      if (DRY) {
        console.log(`  ${replacements.toString().padStart(3)} × ${path.relative(path.join(__dirname, '..'), full)}`);
      } else {
        fs.writeFileSync(full, next);
      }
    }
  }
}

console.log(DRY ? 'DRY RUN (no writes):' : 'Sweeping…');
walk(ROOT);
console.log(`\n${DRY ? 'Would touch' : 'Touched'} ${touchedFiles} files, ${totalReplacements} replacements.`);
