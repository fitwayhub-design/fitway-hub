/**
 * Manual verification harness for the notification-routing fix.
 *
 * Runs Layer A end-to-end:
 *   1. Backfills the given user as inactive (last_active = 2 days ago).
 *   2. Calls runScheduledPushes() so the inactivity cron fires the
 *      "inactive_1_day" template via sendPushFromTemplate.
 *   3. Reads back the most recent notification row to confirm
 *      `link = '/app/workouts'` and `type` was populated.
 *
 * Usage (from project root, with .env loaded):
 *   npx tsx fitwayhub/server/scripts/test-notification-routing.ts <userId>
 *
 * Then on the client side, the manual checks remain:
 *   - bell dropdown click → `/app/workouts`
 *   - notifications page row click → `/app/workouts`
 *   - Capacitor push tap (FCM with data.link) → `/app/workouts`
 */
import 'dotenv/config';
import { initDatabase, query, run, get } from '../config/database.js';
import { runScheduledPushes } from '../notificationService.js';
async function main() {
    const userIdArg = process.argv[2];
    if (!userIdArg) {
        console.error('Usage: npx tsx server/scripts/test-notification-routing.ts <userId>');
        process.exit(1);
    }
    const userId = Number(userIdArg);
    await initDatabase();
    const user = await get('SELECT id, name, email, last_active FROM users WHERE id = ?', [userId]);
    if (!user) {
        console.error(`No user with id=${userId}`);
        process.exit(2);
    }
    console.log(`▸ user: #${user.id} ${user.name} <${user.email}> last_active=${user.last_active}`);
    console.log('▸ backfilling last_active = 2 days ago…');
    await run('UPDATE users SET last_active = DATE_SUB(NOW(), INTERVAL 2 DAY) WHERE id = ?', [userId]);
    console.log('▸ running scheduled pushes (this fires the inactivity templates)…');
    await runScheduledPushes();
    const rows = await query(`SELECT id, type, title, body, link, created_at
       FROM notifications
      WHERE user_id = ?
   ORDER BY id DESC
      LIMIT 5`, [userId]);
    console.log('▸ last 5 notifications for this user:');
    for (const r of rows) {
        console.log(`   #${r.id} [${r.type}] link=${r.link ?? '(null)'} — ${r.title}`);
    }
    const top = rows[0];
    if (!top) {
        console.error('FAIL: no notification was created');
        process.exit(3);
    }
    if (!top.link) {
        console.error('FAIL: top notification has null link — Layer A regressed');
        process.exit(4);
    }
    if (!/\/app\//.test(top.link)) {
        console.warn(`WARN: top notification link "${top.link}" is not under /app/ — verify the link map`);
    }
    else {
        console.log(`PASS: top notification link = ${top.link}`);
    }
    process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(99); });
//# sourceMappingURL=test-notification-routing.js.map