import { run, get } from '../config/database.js';

/**
 * app_images — admin-managed image slots keyed by slug.
 * Used for onboarding screens, loader branding, feature phone mockups, etc.
 */
export async function runAppImagesMigration() {
  const tbl = await get<any>(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'app_images'`
  );
  if (!tbl) {
    await run(`
      CREATE TABLE app_images (
        slug VARCHAR(64) PRIMARY KEY,
        url TEXT NOT NULL,
        alt VARCHAR(255) DEFAULT NULL,
        category VARCHAR(32) DEFAULT NULL,
        updated_by INT DEFAULT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }
}
