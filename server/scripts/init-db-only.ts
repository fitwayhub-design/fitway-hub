/**
 * One-shot DB initializer. Loads the same schema your server boots with
 * (every CREATE TABLE IF NOT EXISTS in initDatabase()) but exits cleanly
 * instead of starting the HTTP server. Safe to re-run — additive only.
 *
 * Usage: npx tsx server/scripts/init-db-only.ts
 */
import { initDatabase, query } from '../config/database.js';

async function main() {
  console.log('Initialising local database…');
  const before: any[] = await query("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE()");
  console.log(`Tables before: ${before[0]?.n ?? '?'}`);

  await initDatabase();

  const after: any[] = await query("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE()");
  console.log(`Tables after:  ${after[0]?.n ?? '?'}`);
  console.log('Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('initDatabase failed:', err);
  process.exit(1);
});
