var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/migrations/004_ads_system.ts
var ads_system_exports = {};
__export(ads_system_exports, {
  runAdsMigration: () => runAdsMigration
});
async function runAdsMigration() {
  const migrations = [
    // ── Admin-controlled settings for the entire ads system ──────────────────
    `CREATE TABLE IF NOT EXISTS admin_ad_settings (
      id INT PRIMARY KEY AUTO_INCREMENT,
      setting_key VARCHAR(120) NOT NULL UNIQUE,
      setting_value TEXT NOT NULL,
      setting_type ENUM('boolean','integer','string','json') DEFAULT 'string',
      label VARCHAR(200),
      description TEXT,
      category VARCHAR(80) DEFAULT 'general',
      updated_by INT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    // ── Audit trail for every setting change ────────────────────────────────
    `CREATE TABLE IF NOT EXISTS ad_setting_history (
      id INT PRIMARY KEY AUTO_INCREMENT,
      setting_key VARCHAR(120) NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_by INT NOT NULL,
      changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      reason VARCHAR(500)
    )`,
    // ── Feature flags ───────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS ad_feature_flags (
      id INT PRIMARY KEY AUTO_INCREMENT,
      flag_key VARCHAR(120) NOT NULL UNIQUE,
      enabled TINYINT(1) DEFAULT 0,
      label VARCHAR(200),
      description TEXT,
      allowed_roles JSON,
      updated_by INT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    // ── Campaigns (top-level entity) ────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS ad_campaigns (
      id INT PRIMARY KEY AUTO_INCREMENT,
      coach_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      objective ENUM('coaching','awareness','traffic','engagement','bookings','announcements') DEFAULT 'coaching',
      status ENUM('draft','pending_review','active','paused','rejected','archived','expired') DEFAULT 'draft',
      daily_budget DECIMAL(10,2) DEFAULT 0,
      lifetime_budget DECIMAL(10,2) DEFAULT 0,
      budget_type ENUM('daily','lifetime') DEFAULT 'daily',
      amount_spent DECIMAL(10,2) DEFAULT 0,
      schedule_start DATE,
      schedule_end DATE,
      admin_note TEXT,
      reviewed_by INT,
      reviewed_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_coach (coach_id),
      INDEX idx_status (status)
    )`,
    // ── Ad Sets (targeting + budget sub-layer) ───────────────────────────────
    `CREATE TABLE IF NOT EXISTS ad_sets (
      id INT PRIMARY KEY AUTO_INCREMENT,
      campaign_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      status ENUM('active','paused','archived') DEFAULT 'active',
      placement ENUM('feed','home_banner','community','search','profile_boost','notification','discovery','all') DEFAULT 'all',
      target_gender ENUM('all','male','female') DEFAULT 'all',
      target_age_min INT DEFAULT 18,
      target_age_max INT DEFAULT 65,
      target_location VARCHAR(200),
      target_lat DECIMAL(10,7),
      target_lng DECIMAL(10,7),
      target_radius_km INT DEFAULT 50,
      target_interests JSON,
      target_activity_levels JSON,
      target_languages JSON,
      exclude_existing_clients TINYINT(1) DEFAULT 1,
      exclude_opted_out TINYINT(1) DEFAULT 1,
      daily_budget DECIMAL(10,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES ad_campaigns(id) ON DELETE CASCADE,
      INDEX idx_campaign (campaign_id)
    )`,
    // ── Ads (individual creative-level units) ───────────────────────────────
    `CREATE TABLE IF NOT EXISTS ads (
      id INT PRIMARY KEY AUTO_INCREMENT,
      ad_set_id INT NOT NULL,
      campaign_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      status ENUM('active','paused','archived') DEFAULT 'active',
      creative_id INT,
      headline VARCHAR(255),
      body TEXT,
      cta VARCHAR(100),
      destination_type ENUM('profile','class','package','booking','announcement') DEFAULT 'profile',
      destination_ref VARCHAR(500),
      impressions INT DEFAULT 0,
      clicks INT DEFAULT 0,
      saves INT DEFAULT 0,
      conversions INT DEFAULT 0,
      ctr DECIMAL(6,4) DEFAULT 0,
      cpm DECIMAL(10,4) DEFAULT 0,
      amount_spent DECIMAL(10,2) DEFAULT 0,
      variant_group VARCHAR(80),
      is_control TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (ad_set_id) REFERENCES ad_sets(id) ON DELETE CASCADE,
      INDEX idx_ad_set (ad_set_id),
      INDEX idx_campaign (campaign_id)
    )`,
    // ── Creatives ───────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS ad_creatives (
      id INT PRIMARY KEY AUTO_INCREMENT,
      coach_id INT NOT NULL,
      name VARCHAR(255),
      format ENUM('image','video','carousel','text') DEFAULT 'image',
      media_url VARCHAR(1000),
      thumbnail_url VARCHAR(1000),
      file_size_kb INT,
      width INT,
      height INT,
      duration_seconds INT,
      carousel_items JSON,
      template_id INT,
      version INT DEFAULT 1,
      status ENUM('draft','active','archived') DEFAULT 'draft',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_coach (coach_id)
    )`,
    // ── Internal placement configuration ─────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS ad_placements (
      id INT PRIMARY KEY AUTO_INCREMENT,
      placement_key VARCHAR(80) NOT NULL UNIQUE,
      label VARCHAR(200),
      enabled TINYINT(1) DEFAULT 1,
      max_ads INT DEFAULT 3,
      priority_order INT DEFAULT 0,
      frequency_cap_hours INT DEFAULT 24,
      description TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    // ── Internal event log (impressions, clicks, conversions) ────────────────
    `CREATE TABLE IF NOT EXISTS ad_events (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      ad_id INT NOT NULL,
      campaign_id INT NOT NULL,
      event_type ENUM('impression','click','save','profile_visit','booking','purchase','message') NOT NULL,
      user_id INT,
      session_id VARCHAR(120),
      placement VARCHAR(80),
      recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ad (ad_id),
      INDEX idx_campaign (campaign_id),
      INDEX idx_type_date (event_type, recorded_at)
    )`,
    // ── Internal wallet / credit ledger ──────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS ad_wallet_ledger (
      id INT PRIMARY KEY AUTO_INCREMENT,
      coach_id INT NOT NULL,
      entry_type ENUM('credit','debit','refund','admin_grant','admin_deduct') NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      balance_after DECIMAL(10,2) NOT NULL,
      campaign_id INT,
      reference VARCHAR(255),
      note TEXT,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_coach (coach_id)
    )`,
    // ── Coach wallet balances ────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS ad_wallets (
      coach_id INT PRIMARY KEY,
      balance DECIMAL(10,2) DEFAULT 0,
      lifetime_spent DECIMAL(10,2) DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    // ── Moderation reviews ───────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS ad_moderation_reviews (
      id INT PRIMARY KEY AUTO_INCREMENT,
      campaign_id INT NOT NULL,
      reviewer_id INT,
      status ENUM('pending','approved','rejected','flagged','needs_changes') DEFAULT 'pending',
      flags JSON,
      notes TEXT,
      auto_flagged TINYINT(1) DEFAULT 0,
      auto_flag_reasons JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMP NULL,
      INDEX idx_campaign (campaign_id),
      INDEX idx_status (status)
    )`,
    // ── Full audit log ────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS ad_audit_logs (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      actor_id INT NOT NULL,
      actor_role VARCHAR(30),
      action VARCHAR(120) NOT NULL,
      entity_type VARCHAR(60),
      entity_id INT,
      old_state JSON,
      new_state JSON,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_actor (actor_id),
      INDEX idx_entity (entity_type, entity_id),
      INDEX idx_created (created_at)
    )`,
    // ── Approval rules ────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS ad_approval_rules (
      id INT PRIMARY KEY AUTO_INCREMENT,
      rule_name VARCHAR(200) NOT NULL,
      rule_type ENUM('auto_approve','require_review','auto_reject','flag') DEFAULT 'require_review',
      conditions JSON,
      enabled TINYINT(1) DEFAULT 1,
      priority INT DEFAULT 0,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    // ── Campaign template presets ─────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS ad_template_presets (
      id INT PRIMARY KEY AUTO_INCREMENT,
      preset_type ENUM('campaign','ad_set','creative','budget') NOT NULL,
      name VARCHAR(200) NOT NULL,
      description TEXT,
      config JSON NOT NULL,
      is_default TINYINT(1) DEFAULT 0,
      target_role ENUM('all','coach','admin') DEFAULT 'all',
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    // ── Reporting snapshots (cached daily aggregates) ─────────────────────────
    `CREATE TABLE IF NOT EXISTS ad_report_snapshots (
      id INT PRIMARY KEY AUTO_INCREMENT,
      campaign_id INT NOT NULL,
      snapshot_date DATE NOT NULL,
      impressions INT DEFAULT 0,
      clicks INT DEFAULT 0,
      saves INT DEFAULT 0,
      conversions INT DEFAULT 0,
      amount_spent DECIMAL(10,2) DEFAULT 0,
      reach INT DEFAULT 0,
      ctr DECIMAL(6,4) DEFAULT 0,
      cpm DECIMAL(10,4) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_campaign_date (campaign_id, snapshot_date),
      INDEX idx_date (snapshot_date)
    )`
  ];
  console.log("\u2699\uFE0F  Running ads system migration (004)\u2026");
  for (const sql of migrations) {
    try {
      await run(sql);
    } catch (err) {
      if (!err.message?.includes("Duplicate column") && !err.message?.includes("already exists")) {
        console.error("Migration error:", err.message);
      }
    }
  }
  const alterStmts = [
    // ad_campaigns — add missing columns (old schema had budget_total/budget_spent/start_at/end_at)
    `ALTER TABLE ad_campaigns ADD COLUMN daily_budget DECIMAL(10,2) DEFAULT 0`,
    `ALTER TABLE ad_campaigns ADD COLUMN lifetime_budget DECIMAL(10,2) DEFAULT 0`,
    `ALTER TABLE ad_campaigns ADD COLUMN budget_type ENUM('daily','lifetime') DEFAULT 'daily'`,
    `ALTER TABLE ad_campaigns ADD COLUMN amount_spent DECIMAL(10,2) DEFAULT 0`,
    `ALTER TABLE ad_campaigns ADD COLUMN schedule_start DATE`,
    `ALTER TABLE ad_campaigns ADD COLUMN schedule_end DATE`,
    `ALTER TABLE ad_campaigns ADD COLUMN reviewed_by INT`,
    `ALTER TABLE ad_campaigns ADD COLUMN reviewed_at TIMESTAMP NULL`,
    // ad_audit_logs — add missing columns (old schema had user_id/user_role/details)
    `ALTER TABLE ad_audit_logs ADD COLUMN actor_id INT`,
    `ALTER TABLE ad_audit_logs ADD COLUMN actor_role VARCHAR(30)`,
    `ALTER TABLE ad_audit_logs ADD COLUMN old_state JSON`,
    `ALTER TABLE ad_audit_logs ADD COLUMN new_state JSON`,
    `ALTER TABLE ad_audit_logs ADD COLUMN user_agent TEXT`,
    // backfill actor_id from user_id where actor_id is null
    `UPDATE ad_audit_logs SET actor_id = user_id WHERE actor_id IS NULL AND user_id IS NOT NULL`,
    `UPDATE ad_audit_logs SET actor_role = user_role WHERE actor_role IS NULL AND user_role IS NOT NULL`,
    // ad_events — add missing columns (old schema had member_id/created_at instead of user_id/recorded_at)
    `ALTER TABLE ad_events ADD COLUMN user_id INT`,
    `ALTER TABLE ad_events ADD COLUMN session_id VARCHAR(120)`,
    `ALTER TABLE ad_events ADD COLUMN recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
    // backfill user_id from member_id, recorded_at from created_at
    `UPDATE ad_events SET user_id = member_id WHERE user_id IS NULL AND member_id IS NOT NULL`,
    `UPDATE ad_events SET recorded_at = created_at WHERE recorded_at IS NULL AND created_at IS NOT NULL`,
    // ad_sets — add missing targeting columns (old schema used targeting_json)
    `ALTER TABLE ad_sets ADD COLUMN target_gender ENUM('all','male','female') DEFAULT 'all'`,
    `ALTER TABLE ad_sets ADD COLUMN target_age_min INT DEFAULT 18`,
    `ALTER TABLE ad_sets ADD COLUMN target_age_max INT DEFAULT 65`,
    `ALTER TABLE ad_sets ADD COLUMN target_location VARCHAR(200)`,
    `ALTER TABLE ad_sets ADD COLUMN target_lat DECIMAL(10,7)`,
    `ALTER TABLE ad_sets ADD COLUMN target_lng DECIMAL(10,7)`,
    `ALTER TABLE ad_sets ADD COLUMN target_radius_km INT DEFAULT 50`,
    `ALTER TABLE ad_sets ADD COLUMN target_interests JSON`,
    `ALTER TABLE ad_sets ADD COLUMN target_activity_levels JSON`,
    `ALTER TABLE ad_sets ADD COLUMN target_languages JSON`,
    `ALTER TABLE ad_sets ADD COLUMN exclude_existing_clients TINYINT(1) DEFAULT 1`,
    `ALTER TABLE ad_sets ADD COLUMN exclude_opted_out TINYINT(1) DEFAULT 1`,
    `ALTER TABLE ad_sets ADD COLUMN daily_budget DECIMAL(10,2) DEFAULT 0`,
    `ALTER TABLE ad_sets ADD COLUMN placement_type ENUM('feed','home_banner','community','search','profile_boost','notification','discovery','all') DEFAULT 'all'`,
    // ad_creatives — add missing columns (old schema had owner_id/type/s3_path/metadata)
    `ALTER TABLE ad_creatives ADD COLUMN coach_id INT`,
    `ALTER TABLE ad_creatives ADD COLUMN format ENUM('image','video','carousel','text') DEFAULT 'image'`,
    `ALTER TABLE ad_creatives ADD COLUMN file_size_kb INT`,
    `ALTER TABLE ad_creatives ADD COLUMN width INT`,
    `ALTER TABLE ad_creatives ADD COLUMN height INT`,
    `ALTER TABLE ad_creatives ADD COLUMN duration_seconds INT`,
    `ALTER TABLE ad_creatives ADD COLUMN carousel_items JSON`,
    `ALTER TABLE ad_creatives ADD COLUMN template_id INT`,
    `ALTER TABLE ad_creatives ADD COLUMN status ENUM('draft','active','archived') DEFAULT 'draft'`,
    // backfill coach_id from owner_id, format from type
    `UPDATE ad_creatives SET coach_id = owner_id WHERE coach_id IS NULL AND owner_id IS NOT NULL`,
    `UPDATE ad_creatives SET format = type WHERE format IS NULL AND type IS NOT NULL`,
    // backfill ad_campaigns budget columns from old columns
    `UPDATE ad_campaigns SET daily_budget = budget_total WHERE daily_budget = 0 AND budget_total IS NOT NULL AND budget_total > 0`,
    `UPDATE ad_campaigns SET amount_spent = budget_spent WHERE amount_spent = 0 AND budget_spent IS NOT NULL AND budget_spent > 0`,
    `UPDATE ad_campaigns SET schedule_start = start_at WHERE schedule_start IS NULL AND start_at IS NOT NULL`,
    `UPDATE ad_campaigns SET schedule_end = end_at WHERE schedule_end IS NULL AND end_at IS NOT NULL`
  ];
  for (const sql of alterStmts) {
    try {
      await run(sql);
    } catch {
    }
  }
  await seedDefaultPlacements();
  await seedDefaultAdSettings();
  await seedDefaultFeatureFlags();
  await seedDefaultApprovalRules();
  await seedDefaultTemplatePresets();
  console.log("\u2705 Ads system migration complete");
}
async function seedDefaultPlacements() {
  const placements = [
    { key: "feed", label: "Community Feed Cards", max_ads: 3, priority: 1, freq: 24 },
    { key: "home_banner", label: "Home Screen Banner", max_ads: 1, priority: 2, freq: 12 },
    { key: "profile_boost", label: "Coach Profile Boost", max_ads: 2, priority: 3, freq: 48 },
    { key: "search", label: "Search Results Boost", max_ads: 2, priority: 4, freq: 24 },
    { key: "community", label: "Community Discovery Page", max_ads: 4, priority: 5, freq: 24 },
    { key: "notification", label: "Notification Inbox Promo", max_ads: 1, priority: 6, freq: 72 },
    { key: "discovery", label: "Discovery / Explore Page", max_ads: 3, priority: 7, freq: 24 }
  ];
  for (const p of placements) {
    try {
      await run(
        `INSERT IGNORE INTO ad_placements (placement_key, label, enabled, max_ads, priority_order, frequency_cap_hours)
         VALUES (?, ?, 1, ?, ?, ?)`,
        [p.key, p.label, p.max_ads, p.priority, p.freq]
      );
    } catch {
    }
  }
}
async function seedDefaultAdSettings() {
  const defaults = [
    // Global
    { key: "ads_system_enabled", value: "true", type: "boolean", label: "Ads System Enabled", category: "global" },
    { key: "require_admin_approval", value: "true", type: "boolean", label: "Campaigns Require Admin Approval", category: "global" },
    { key: "default_campaign_status", value: "draft", type: "string", label: "Default Status for New Campaigns", category: "global" },
    { key: "coaches_can_create_directly", value: "true", type: "boolean", label: "Coaches Can Create Campaigns", category: "global" },
    // Budget
    { key: "min_daily_budget", value: "10", type: "integer", label: "Minimum Daily Budget (EGP)", category: "budget" },
    { key: "max_daily_budget", value: "5000", type: "integer", label: "Maximum Daily Budget (EGP)", category: "budget" },
    { key: "min_lifetime_budget", value: "50", type: "integer", label: "Minimum Lifetime Budget (EGP)", category: "budget" },
    { key: "max_lifetime_budget", value: "50000", type: "integer", label: "Maximum Lifetime Budget (EGP)", category: "budget" },
    { key: "auto_pause_overspend", value: "true", type: "boolean", label: "Auto-Pause When Budget Exceeded", category: "budget" },
    // Targeting
    { key: "targeting_location_enabled", value: "true", type: "boolean", label: "Allow Location Targeting", category: "targeting" },
    { key: "targeting_age_enabled", value: "true", type: "boolean", label: "Allow Age Group Targeting", category: "targeting" },
    { key: "targeting_activity_enabled", value: "true", type: "boolean", label: "Allow Activity Level Targeting", category: "targeting" },
    { key: "targeting_language_enabled", value: "true", type: "boolean", label: "Allow Language Targeting", category: "targeting" },
    { key: "targeting_interests_enabled", value: "true", type: "boolean", label: "Allow Interest Targeting", category: "targeting" },
    // Creatives
    { key: "allow_image_creative", value: "true", type: "boolean", label: "Allow Image Creatives", category: "creatives" },
    { key: "allow_video_creative", value: "true", type: "boolean", label: "Allow Video Creatives", category: "creatives" },
    { key: "allow_carousel_creative", value: "true", type: "boolean", label: "Allow Carousel Creatives", category: "creatives" },
    { key: "allow_text_creative", value: "true", type: "boolean", label: "Allow Text-Only Creatives", category: "creatives" },
    { key: "max_image_size_kb", value: "5120", type: "integer", label: "Max Image Size (KB)", category: "creatives" },
    { key: "max_video_size_kb", value: "102400", type: "integer", label: "Max Video Size (KB)", category: "creatives" },
    // Moderation
    { key: "auto_flag_keywords", value: '["spam","fake","guaranteed","100%","free money"]', type: "json", label: "Auto-Flag Keywords", category: "moderation" },
    { key: "auto_flag_duplicate", value: "true", type: "boolean", label: "Auto-Flag Duplicate Campaigns", category: "moderation" },
    { key: "flag_action", value: "pause", type: "string", label: "Action When Flagged (pause/review/reject)", category: "moderation" },
    // Reporting
    { key: "analytics_refresh_minutes", value: "30", type: "integer", label: "Analytics Refresh Interval (mins)", category: "reporting" },
    { key: "allow_csv_export", value: "true", type: "boolean", label: "Allow CSV Export", category: "reporting" },
    { key: "default_reporting_window", value: "30", type: "integer", label: "Default Reporting Window (days)", category: "reporting" },
    // Security
    { key: "audit_log_enabled", value: "true", type: "boolean", label: "Audit Log Enabled", category: "security" },
    { key: "session_timeout_minutes", value: "480", type: "integer", label: "Session Timeout (minutes)", category: "security" },
    { key: "rate_limit_campaigns_per_day", value: "10", type: "integer", label: "Max Campaign Creates Per Day", category: "security" }
  ];
  for (const s of defaults) {
    try {
      await run(
        `INSERT IGNORE INTO admin_ad_settings (setting_key, setting_value, setting_type, label, category)
         VALUES (?, ?, ?, ?, ?)`,
        [s.key, s.value, s.type, s.label, s.category]
      );
    } catch {
    }
  }
}
async function seedDefaultFeatureFlags() {
  const flags = [
    { key: "ab_testing", label: "A/B Testing", enabled: 0 },
    { key: "advanced_targeting", label: "Advanced Audience Targeting", enabled: 1 },
    { key: "auto_optimization", label: "Automatic Campaign Optimization", enabled: 0 },
    { key: "carousel_ads", label: "Carousel Ad Format", enabled: 1 },
    { key: "internal_recommendations", label: "AI-Powered Recommendations", enabled: 0 },
    { key: "wallet_system", label: "Internal Wallet / Credits", enabled: 1 },
    { key: "report_snapshots", label: "Daily Report Snapshots", enabled: 1 }
  ];
  for (const f of flags) {
    try {
      await run(
        `INSERT IGNORE INTO ad_feature_flags (flag_key, label, enabled) VALUES (?, ?, ?)`,
        [f.key, f.label, f.enabled]
      );
    } catch {
    }
  }
}
async function seedDefaultApprovalRules() {
  const rules = [
    {
      name: "Auto-approve verified coaches with good standing",
      type: "auto_approve",
      conditions: JSON.stringify({ coach_tier: "verified", no_previous_violations: true }),
      priority: 10
    },
    {
      name: "Flag campaigns with prohibited keywords",
      type: "flag",
      conditions: JSON.stringify({ keyword_match: true }),
      priority: 5
    },
    {
      name: "Require review for budgets over 2000 EGP",
      type: "require_review",
      conditions: JSON.stringify({ daily_budget_gt: 2e3 }),
      priority: 3
    }
  ];
  for (const r of rules) {
    try {
      await run(
        `INSERT IGNORE INTO ad_approval_rules (rule_name, rule_type, conditions, enabled, priority)
         VALUES (?, ?, ?, 1, ?)`,
        [r.name, r.type, r.conditions, r.priority]
      );
    } catch {
    }
  }
}
async function seedDefaultTemplatePresets() {
  const presets = [
    {
      type: "campaign",
      name: "Starter Coaching Campaign",
      desc: "Ready-to-go template for new coaches",
      config: JSON.stringify({ objective: "coaching", budget_type: "daily", daily_budget: 50, placement: "feed" })
    },
    {
      type: "campaign",
      name: "Class Promotion",
      desc: "Boost a specific class or session",
      config: JSON.stringify({ objective: "bookings", budget_type: "lifetime", lifetime_budget: 300, placement: "community" })
    },
    {
      type: "budget",
      name: "Starter Budget",
      desc: "Recommended for new coaches",
      config: JSON.stringify({ daily_budget: 50, budget_type: "daily" })
    },
    {
      type: "budget",
      name: "Growth Budget",
      desc: "For established coaches",
      config: JSON.stringify({ daily_budget: 200, budget_type: "daily" })
    }
  ];
  for (const p of presets) {
    try {
      await run(
        `INSERT IGNORE INTO ad_template_presets (preset_type, name, description, config, is_default, target_role)
         VALUES (?, ?, ?, ?, 1, 'all')`,
        [p.type, p.name, p.desc, p.config]
      );
    } catch {
    }
  }
}
var init_ads_system = __esm({
  "server/migrations/004_ads_system.ts"() {
    init_database();
  }
});

// server/migrations/006_app_images.ts
var app_images_exports = {};
__export(app_images_exports, {
  runAppImagesMigration: () => runAppImagesMigration
});
async function runAppImagesMigration() {
  const tbl = await get(
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
var init_app_images = __esm({
  "server/migrations/006_app_images.ts"() {
    init_database();
  }
});

// server/config/database.ts
var database_exports = {};
__export(database_exports, {
  default: () => database_default,
  get: () => get,
  getPool: () => getPool,
  initDatabase: () => initDatabase,
  query: () => query,
  run: () => run,
  seedDefaultAppSettings: () => seedDefaultAppSettings
});
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
function loadCaCert() {
  const caPath = process.env.DB_SSL_CA;
  if (!caPath) return void 0;
  try {
    const resolved = path.isAbsolute(caPath) ? caPath : path.join(process.cwd(), caPath);
    return fs.readFileSync(resolved);
  } catch (e) {
    console.warn(`\u26A0\uFE0F  Could not load DB_SSL_CA from "${caPath}": ${e.message}`);
    return void 0;
  }
}
function parseSslFromUrl(params) {
  const mode = (params.get("ssl-mode") || params.get("sslmode") || "").toLowerCase();
  const wantsSsl = ["required", "verify_ca", "verify_identity"].includes(mode);
  if (!DB_SSL && !wantsSsl) return void 0;
  return {
    rejectUnauthorized: DB_SSL_REJECT_UNAUTHORIZED,
    ...DB_SSL_CA ? { ca: DB_SSL_CA } : {}
  };
}
function getConnectionConfig(includeDatabase) {
  const base = {
    waitForConnections: true,
    connectionLimit: includeDatabase ? 10 : 2,
    connectTimeout: 2e4,
    // 20 s – generous for Railway cold starts
    enableKeepAlive: true,
    keepAliveInitialDelay: 1e4
  };
  if (DATABASE_URL) {
    const parsed = new URL(DATABASE_URL);
    const dbName = parsed.pathname.replace(/^\//, "") || DB_NAME;
    return {
      ...base,
      host: parsed.hostname || DB_HOST,
      port: parsed.port ? parseInt(parsed.port, 10) : DB_PORT,
      user: decodeURIComponent(parsed.username || DB_USER),
      password: decodeURIComponent(parsed.password || DB_PASSWORD),
      database: includeDatabase ? dbName : void 0,
      ssl: parseSslFromUrl(parsed.searchParams)
    };
  }
  return {
    ...base,
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: includeDatabase ? DB_NAME : void 0,
    ssl: DB_SSL ? { rejectUnauthorized: DB_SSL_REJECT_UNAUTHORIZED, ...DB_SSL_CA ? { ca: DB_SSL_CA } : {} } : void 0
  };
}
function getDatabaseName() {
  if (DATABASE_URL) {
    const parsed = new URL(DATABASE_URL);
    return parsed.pathname.replace(/^\//, "") || DB_NAME;
  }
  return DB_NAME;
}
function escapeDbIdentifier(name) {
  return `\`${name.replace(/`/g, "``")}\``;
}
function getPool() {
  if (!_pool) {
    _pool = mysql.createPool(getConnectionConfig(true));
  }
  return _pool;
}
async function query(sql, params) {
  const [rows] = await getPool().query(sql, params ?? []);
  return rows;
}
async function run(sql, params) {
  const [result] = await getPool().query(sql, params ?? []);
  return { insertId: result.insertId, affectedRows: result.affectedRows };
}
async function get(sql, params) {
  const rows = await query(sql, params);
  return rows[0];
}
async function initTables() {
  const p = getPool();
  const stmts = [
    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255),
      role VARCHAR(50) DEFAULT 'user',
      avatar TEXT,
      is_premium TINYINT(1) DEFAULT 0,
      membership_paid TINYINT(1) DEFAULT 0,
      points INT DEFAULT 0,
      steps INT DEFAULT 0,
      height INT,
      weight INT,
      gender VARCHAR(20),
      reset_token TEXT,
      reset_token_expires BIGINT,
      remember_token TEXT,
      security_question VARCHAR(255),
      security_answer VARCHAR(255),
      offline_steps INT DEFAULT 0,
      last_sync DATETIME,
      coach_membership_active TINYINT(1) DEFAULT 0,
      step_goal INT DEFAULT 10000,
      credit DECIMAL(10,2) DEFAULT 0,
      payment_phone VARCHAR(30),
      payment_phone_vodafone VARCHAR(30),
      payment_phone_orange VARCHAR(30),
      payment_phone_we VARCHAR(30),
      payment_wallet_type VARCHAR(30),
      payment_method_type VARCHAR(30) DEFAULT 'ewallet',
      paypal_email VARCHAR(255),
      card_holder_name VARCHAR(100),
      card_number VARCHAR(30),
      instapay_handle VARCHAR(100),
      last_active DATETIME,
      medical_history TEXT,
      medical_file_url VARCHAR(500),
      email_verified TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS daily_summaries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      date VARCHAR(20) NOT NULL,
      steps INT NOT NULL,
      ai_analysis TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS steps_entries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      date VARCHAR(20) NOT NULL,
      steps INT NOT NULL,
      calories_burned INT,
      distance_km FLOAT,
      notes TEXT,
      tracking_mode VARCHAR(50) DEFAULT 'manual',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE KEY unique_user_date (user_id, date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sender_id INT NOT NULL,
      receiver_id INT,
      group_id INT,
      challenge_id INT,
      content TEXT,
      media_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS posts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      content TEXT,
      media_url TEXT,
      hashtags TEXT,
      likes INT DEFAULT 0,
      is_hidden TINYINT(1) DEFAULT 0,
      moderated_by INT,
      moderation_reason VARCHAR(255),
      is_announcement TINYINT(1) DEFAULT 0,
      is_pinned TINYINT(1) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS challenges (
      id INT AUTO_INCREMENT PRIMARY KEY,
      creator_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      start_date VARCHAR(20),
      end_date VARCHAR(20),
      image_url TEXT,
      participant_count INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (creator_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS challenge_participants (
      id INT AUTO_INCREMENT PRIMARY KEY,
      challenge_id INT NOT NULL,
      user_id INT NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (challenge_id) REFERENCES challenges(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE KEY unique_challenge_user (challenge_id, user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS premium_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      start_time DATETIME,
      end_time DATETIME,
      total_steps INT,
      total_distance_km FLOAT,
      calories INT,
      path_json LONGTEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS post_likes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      post_id INT NOT NULL,
      user_id INT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE KEY unique_post_user (post_id, user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS post_comments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      post_id INT NOT NULL,
      user_id INT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS user_follows (
      id INT AUTO_INCREMENT PRIMARY KEY,
      follower_id INT NOT NULL,
      following_id INT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (follower_id) REFERENCES users(id),
      FOREIGN KEY (following_id) REFERENCES users(id),
      UNIQUE KEY unique_follow (follower_id, following_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS chat_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sender_id INT NOT NULL,
      receiver_id INT NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id),
      FOREIGN KEY (receiver_id) REFERENCES users(id),
      UNIQUE KEY unique_chat_req (sender_id, receiver_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS workout_plans (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      coach_id INT,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      days_per_week INT DEFAULT 3,
      exercises JSON,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS nutrition_plans (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      coach_id INT,
      title VARCHAR(255) NOT NULL,
      daily_calories INT DEFAULT 2000,
      protein_g INT DEFAULT 150,
      carbs_g INT DEFAULT 250,
      fat_g INT DEFAULT 65,
      meals JSON,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS workout_videos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      url TEXT NOT NULL,
      duration VARCHAR(20),
      duration_seconds INT DEFAULT 0,
      category VARCHAR(100) DEFAULT 'General',
      is_premium TINYINT(1) DEFAULT 0,
      is_short TINYINT(1) DEFAULT 0,
      thumbnail TEXT,
      coach_id INT DEFAULT NULL,
      width INT DEFAULT 0,
      height INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS gifts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      admin_id INT,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      type VARCHAR(50) DEFAULT 'points',
      value INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      type VARCHAR(50) NOT NULL,
      plan VARCHAR(50) NOT NULL,
      amount FLOAT NOT NULL,
      payment_method VARCHAR(50) DEFAULT 'card',
      card_last4 VARCHAR(10),
      card_name VARCHAR(255),
      transaction_id VARCHAR(255),
      proof_url VARCHAR(500),
      wallet_type VARCHAR(50),
      sender_number VARCHAR(30),
      status VARCHAR(20) DEFAULT 'completed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS coach_ads (
      id INT AUTO_INCREMENT PRIMARY KEY,
      coach_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      specialty VARCHAR(100),
      cta VARCHAR(255) DEFAULT 'Book Free Consultation',
      highlight VARCHAR(255),
      image_url VARCHAR(500),
      payment_method VARCHAR(50) DEFAULT 'free',
      status VARCHAR(20) DEFAULT 'pending',
      impressions INT DEFAULT 0,
      clicks INT DEFAULT 0,
      admin_note TEXT,
      ad_type VARCHAR(20) DEFAULT 'community',
      media_type VARCHAR(10) DEFAULT 'image',
      video_url VARCHAR(500),
      objective VARCHAR(20) DEFAULT 'coaching',
      duration_hours INT DEFAULT 0,
      duration_days INT DEFAULT 0,
      boost_start DATETIME,
      boost_end DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS coach_reviews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      coach_id INT NOT NULL,
      user_id INT NOT NULL,
      rating INT NOT NULL,
      text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS coach_reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      coach_id INT NOT NULL,
      user_id INT NOT NULL,
      reason VARCHAR(120) NOT NULL,
      details TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      admin_notes TEXT,
      reviewed_by INT,
      reviewed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_coach_reports_status (status),
      INDEX idx_coach_reports_coach (coach_id),
      INDEX idx_coach_reports_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS coach_profiles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNIQUE NOT NULL,
      bio TEXT,
      specialty VARCHAR(255) DEFAULT '',
      location VARCHAR(255) DEFAULT '',
      price FLOAT DEFAULT 50,
      available TINYINT(1) DEFAULT 1,
      sessions_count INT DEFAULT 0,
      plan_types VARCHAR(100) DEFAULT 'complete',
      monthly_price DECIMAL(10,2) DEFAULT 0,
      yearly_price DECIMAL(10,2) DEFAULT 0,
      certified TINYINT(1) DEFAULT 0,
      certified_until DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS coaching_bookings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      coach_id INT NOT NULL,
      date VARCHAR(20),
      time VARCHAR(20),
      note TEXT,
      booking_type VARCHAR(50) DEFAULT 'session',
      plan VARCHAR(50) DEFAULT 'complete',
      level VARCHAR(20) DEFAULT '1',
      now_body_photo VARCHAR(500),
      dream_body_photo VARCHAR(500),
      status VARCHAR(20) DEFAULT 'pending',
      amount FLOAT DEFAULT 0,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (coach_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      body TEXT,
      link VARCHAR(255),
      is_read TINYINT(1) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS website_sections (
      id INT AUTO_INCREMENT PRIMARY KEY,
      page VARCHAR(50) NOT NULL DEFAULT 'home',
      type VARCHAR(50) NOT NULL,
      label VARCHAR(255) NOT NULL,
      content LONGTEXT NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_visible TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS blog_posts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      slug VARCHAR(160) NOT NULL,
      language VARCHAR(5) NOT NULL DEFAULT 'en',
      related_blog_id INT,
      excerpt TEXT,
      content LONGTEXT NOT NULL,
      header_image_url VARCHAR(500),
      video_url VARCHAR(500),
      video_duration INT,
      views INT DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'published',
      author_id INT NOT NULL,
      author_role VARCHAR(50) NOT NULL,
      published_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_slug_lang (slug, language),
      INDEX idx_blog_posts_status (status),
      INDEX idx_blog_posts_author_id (author_id),
      INDEX idx_blog_posts_published_at (published_at),
      INDEX idx_blog_posts_language (language)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS payment_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      setting_key VARCHAR(100) NOT NULL UNIQUE,
      setting_value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS user_workout_plans (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      day_of_week VARCHAR(20) NOT NULL,
      workout_type VARCHAR(100) NOT NULL,
      video_url TEXT,
      time_minutes INT DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS user_nutrition_plans (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      day_of_week VARCHAR(20) NOT NULL,
      meal_time VARCHAR(50) NOT NULL,
      meal_type VARCHAR(100),
      meal_name VARCHAR(255) NOT NULL,
      contents TEXT,
      calories INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS point_transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      points INT NOT NULL,
      reason VARCHAR(255),
      reference_type VARCHAR(50),
      reference_id VARCHAR(100),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS ad_payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ad_id INT NOT NULL,
      coach_id INT NOT NULL,
      duration_minutes INT NOT NULL DEFAULT 0,
      amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      payment_method VARCHAR(50) DEFAULT 'ewallet',
      proof_url VARCHAR(500),
      phone VARCHAR(30),
      card_last4 VARCHAR(10),
      status VARCHAR(20) DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (ad_id) REFERENCES coach_ads(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS coach_follows (
      id INT AUTO_INCREMENT PRIMARY KEY,
      follower_id INT NOT NULL,
      coach_id INT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_follow (follower_id, coach_id),
      FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS coach_subscriptions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      coach_id INT NOT NULL,
      plan_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
      plan_type VARCHAR(20) NOT NULL DEFAULT 'complete',
      amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      status VARCHAR(20) DEFAULT 'pending_admin',
      admin_approval_status VARCHAR(20) DEFAULT 'pending',
      coach_decision_status VARCHAR(20) DEFAULT 'pending',
      refund_status VARCHAR(20) DEFAULT 'none',
      refunded_at DATETIME,
      refund_amount DECIMAL(10,2) DEFAULT 0,
      refund_reason VARCHAR(255),
      admin_approved_at DATETIME,
      coach_decided_at DATETIME,
      credited_amount DECIMAL(10,2) DEFAULT 0,
      credit_released_at DATETIME,
      payer_wallet_type VARCHAR(30),
      payer_number VARCHAR(30),
      payment_method VARCHAR(50),
      payment_proof VARCHAR(500),
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      auto_renew TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS withdrawal_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      coach_id INT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      payment_phone VARCHAR(30),
      wallet_type VARCHAR(30),
      payment_method_type VARCHAR(30) DEFAULT 'ewallet',
      paypal_email VARCHAR(255),
      card_holder_name VARCHAR(100),
      card_number VARCHAR(30),
      instapay_handle VARCHAR(100),
      status VARCHAR(20) DEFAULT 'pending',
      admin_note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      processed_at DATETIME,
      FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS credit_transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      type VARCHAR(30) NOT NULL,
      reference_id INT,
      description VARCHAR(255),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS coaching_meetings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      coach_id INT NOT NULL,
      user_id INT NOT NULL,
      title VARCHAR(255) DEFAULT 'Coaching Session',
      room_id VARCHAR(100) UNIQUE NOT NULL,
      status VARCHAR(20) DEFAULT 'scheduled',
      scheduled_at DATETIME,
      started_at DATETIME,
      ended_at DATETIME,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS meeting_files (
      id INT AUTO_INCREMENT PRIMARY KEY,
      meeting_id INT NOT NULL,
      uploaded_by INT NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_url VARCHAR(500) NOT NULL,
      file_type VARCHAR(100),
      file_size INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (meeting_id) REFERENCES coaching_meetings(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS meeting_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      meeting_id INT NOT NULL,
      user_id INT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (meeting_id) REFERENCES coaching_meetings(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS app_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      setting_key VARCHAR(100) UNIQUE NOT NULL,
      setting_value TEXT,
      setting_type VARCHAR(20) DEFAULT 'text',
      category VARCHAR(50) DEFAULT 'general',
      label VARCHAR(100),
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS website_translations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      text_key VARCHAR(500) NOT NULL UNIQUE,
      text_ar TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS email_settings (
      id INT PRIMARY KEY DEFAULT 1,
      smtp_host VARCHAR(255) NOT NULL DEFAULT '',
      smtp_port INT NOT NULL DEFAULT 587,
      smtp_user VARCHAR(255) NOT NULL DEFAULT '',
      smtp_pass VARCHAR(255) NOT NULL DEFAULT '',
      smtp_secure ENUM('none','tls','starttls') NOT NULL DEFAULT 'starttls',
      from_name VARCHAR(255) NOT NULL DEFAULT '',
      from_email VARCHAR(255) NOT NULL DEFAULT '',
      enabled TINYINT(1) NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS email_accounts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      display_name VARCHAR(255) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS emails (
      id INT AUTO_INCREMENT PRIMARY KEY,
      account_id INT NOT NULL,
      sender VARCHAR(500) NOT NULL,
      recipient VARCHAR(500) NOT NULL,
      subject VARCHAR(1000) NOT NULL DEFAULT '',
      text_body LONGTEXT,
      html_body LONGTEXT,
      direction ENUM('inbound','outbound') NOT NULL DEFAULT 'inbound',
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      message_id VARCHAR(500) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES email_accounts(id) ON DELETE CASCADE,
      INDEX idx_emails_account_dir (account_id, direction),
      INDEX idx_emails_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS push_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token TEXT NOT NULL,
      platform ENUM('android','ios','web') NOT NULL DEFAULT 'android',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_user_token (user_id, platform)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS push_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(100) NOT NULL UNIQUE,
      title VARCHAR(255) NOT NULL,
      body TEXT NOT NULL,
      category ENUM('new_user','new_coach','engagement','streak','inactivity','promo','coach_tip','system') NOT NULL DEFAULT 'engagement',
      trigger_type VARCHAR(100) NOT NULL DEFAULT 'manual',
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS push_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      template_id INT,
      title VARCHAR(255) NOT NULL,
      body TEXT NOT NULL,
      status ENUM('sent','failed') NOT NULL DEFAULT 'sent',
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (template_id) REFERENCES push_templates(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS welcome_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      target ENUM('user','coach') NOT NULL,
      channel ENUM('email','push','in_app') NOT NULL,
      subject VARCHAR(255) NOT NULL DEFAULT '',
      title VARCHAR(255) NOT NULL DEFAULT '',
      body LONGTEXT NOT NULL,
      html_body LONGTEXT,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_target_channel (target, channel)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS video_playlists (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      thumbnail TEXT,
      created_by INT NOT NULL,
      is_public TINYINT(1) DEFAULT 1,
      sort_order INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS playlist_videos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      playlist_id INT NOT NULL,
      video_id INT NOT NULL,
      sort_order INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (playlist_id) REFERENCES video_playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (video_id) REFERENCES workout_videos(id) ON DELETE CASCADE,
      UNIQUE KEY unique_playlist_video (playlist_id, video_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS paymob_transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      coach_id INT,
      paymob_order_id BIGINT,
      paymob_transaction_id BIGINT,
      amount DECIMAL(10,2) NOT NULL,
      type VARCHAR(50) NOT NULL,
      plan_cycle VARCHAR(20),
      plan_type VARCHAR(20),
      method VARCHAR(20) DEFAULT 'card',
      reference_id INT,
      status VARCHAR(20) DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_pt_order (paymob_order_id),
      INDEX idx_pt_user (user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS revoked_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token_hash VARCHAR(64) NOT NULL,
      revoked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      INDEX idx_revoked_tokens_hash (token_hash),
      INDEX idx_revoked_tokens_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS user_progress_photos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      before_photo VARCHAR(500),
      now_photo VARCHAR(500),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY idx_progress_user (user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS certification_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      coach_id INT NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      national_id_url VARCHAR(500) NOT NULL,
      certification_url VARCHAR(500) NOT NULL,
      amount_paid DECIMAL(10,2) DEFAULT 0,
      admin_notes TEXT,
      reviewed_by INT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reviewed_at DATETIME,
      FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_cert_req_status (status),
      INDEX idx_cert_req_coach (coach_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  ];
  for (const stmt of stmts) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await p.execute(stmt);
        break;
      } catch (err) {
        if (err.code === "ECONNRESET" && attempt < 3) {
          console.warn(`\u26A0\uFE0F  ECONNRESET during initTables (attempt ${attempt}/3), retrying\u2026`);
          await new Promise((r) => setTimeout(r, 1e3 * attempt));
          continue;
        }
        throw err;
      }
    }
  }
  const migrations = [
    `ALTER TABLE blog_posts ADD CONSTRAINT fk_blog_posts_related FOREIGN KEY (related_blog_id) REFERENCES blog_posts(id) ON DELETE SET NULL`,
    `ALTER TABLE withdrawal_requests ADD COLUMN paymob_disbursement_id VARCHAR(100)`,
    `ALTER TABLE blog_posts ADD INDEX idx_blog_posts_related (related_blog_id)`,
    `INSERT IGNORE INTO email_settings (id) VALUES (1)`,
    // ── Onboarding fields (goal, activity, targets) ──────────────────────────
    `ALTER TABLE users ADD COLUMN fitness_goal VARCHAR(30) DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN activity_level VARCHAR(20) DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN target_weight INT DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN weekly_goal DECIMAL(4,2) DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN date_of_birth DATE DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN onboarding_done TINYINT(1) DEFAULT 0`,
    // ── Activity-based auto-update fields ────────────────────────────────────
    `ALTER TABLE users ADD COLUMN computed_activity_level VARCHAR(20) DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN workouts_completed INT DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN plans_completed INT DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN avg_daily_steps INT DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN streak_days INT DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN last_activity_update DATETIME DEFAULT NULL`,
    // ── Coach Ads — Facebook-style campaign fields ───────────────────────────
    `ALTER TABLE coach_ads ADD COLUMN campaign_name VARCHAR(255)`,
    `ALTER TABLE coach_ads ADD COLUMN audience_gender VARCHAR(20) DEFAULT 'all'`,
    `ALTER TABLE coach_ads ADD COLUMN audience_age_min INT DEFAULT 18`,
    `ALTER TABLE coach_ads ADD COLUMN audience_age_max INT DEFAULT 65`,
    `ALTER TABLE coach_ads ADD COLUMN audience_interests TEXT`,
    `ALTER TABLE coach_ads ADD COLUMN audience_goals TEXT`,
    `ALTER TABLE coach_ads ADD COLUMN audience_activity_levels TEXT`,
    `ALTER TABLE coach_ads ADD COLUMN daily_budget DECIMAL(10,2) DEFAULT 0`,
    `ALTER TABLE coach_ads ADD COLUMN total_budget DECIMAL(10,2) DEFAULT 0`,
    `ALTER TABLE coach_ads ADD COLUMN budget_type VARCHAR(20) DEFAULT 'daily'`,
    `ALTER TABLE coach_ads ADD COLUMN placement VARCHAR(50) DEFAULT 'all'`,
    `ALTER TABLE coach_ads ADD COLUMN schedule_start DATE`,
    `ALTER TABLE coach_ads ADD COLUMN schedule_end DATE`,
    `ALTER TABLE coach_ads ADD COLUMN reach INT DEFAULT 0`,
    `ALTER TABLE coach_ads ADD COLUMN frequency DECIMAL(5,2) DEFAULT 0`,
    `ALTER TABLE coach_ads ADD COLUMN ctr DECIMAL(5,4) DEFAULT 0`,
    `ALTER TABLE coach_ads ADD COLUMN cpm DECIMAL(10,4) DEFAULT 0`,
    `ALTER TABLE coach_ads ADD COLUMN amount_spent DECIMAL(10,2) DEFAULT 0`,
    `ALTER TABLE coach_ads ADD COLUMN paid_amount DECIMAL(10,2) DEFAULT 0`,
    `ALTER TABLE coach_ads ADD COLUMN paid_minutes INT DEFAULT 0`,
    `ALTER TABLE coach_ads ADD COLUMN payment_status VARCHAR(20) DEFAULT 'pending'`,
    `ALTER TABLE coach_ads ADD COLUMN payment_phone VARCHAR(30)`,
    `ALTER TABLE coach_ads ADD COLUMN contact_phone VARCHAR(30) DEFAULT NULL`,
    `ALTER TABLE coach_ads ADD COLUMN payment_proof VARCHAR(500)`,
    // ── Google Play / Apple Pay ──────────────────────────────────────────────
    `INSERT IGNORE INTO payment_settings (setting_key, setting_value) VALUES ('google_play_enabled','0')`,
    `INSERT IGNORE INTO payment_settings (setting_key, setting_value) VALUES ('google_play_product_id_monthly','')`,
    `INSERT IGNORE INTO payment_settings (setting_key, setting_value) VALUES ('google_play_product_id_annual','')`,
    `INSERT IGNORE INTO payment_settings (setting_key, setting_value) VALUES ('apple_pay_enabled','0')`,
    `INSERT IGNORE INTO payment_settings (setting_key, setting_value) VALUES ('apple_pay_product_id_monthly','')`,
    `INSERT IGNORE INTO payment_settings (setting_key, setting_value) VALUES ('apple_pay_product_id_annual','')`,
    // Button hover branding settings
    // Drop the old IP-session table that was blocking logins — runs once, safe to repeat
    `DROP TABLE IF EXISTS active_sessions`,
    `INSERT IGNORE INTO app_settings (setting_key, setting_value, setting_type, category, label) VALUES ('btn_hover_type','glow','text','branding','Button Hover Effect Type')`,
    `INSERT IGNORE INTO app_settings (setting_key, setting_value, setting_type, category, label) VALUES ('btn_hover_color','','color','branding','Button Hover Glow Color')`,
    // Location fields on users
    `ALTER TABLE users ADD COLUMN latitude DECIMAL(10,7) DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN longitude DECIMAL(10,7) DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN city VARCHAR(100) DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN country VARCHAR(100) DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN location_updated_at DATETIME DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN payment_phone_vodafone VARCHAR(30) DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN payment_phone_orange VARCHAR(30) DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN payment_phone_we VARCHAR(30) DEFAULT NULL`,
    // Location targeting on ads
    `ALTER TABLE coach_ads ADD COLUMN target_lat DECIMAL(10,7) DEFAULT NULL`,
    `ALTER TABLE coach_ads ADD COLUMN target_lng DECIMAL(10,7) DEFAULT NULL`,
    `ALTER TABLE coach_ads ADD COLUMN target_city VARCHAR(100) DEFAULT NULL`,
    `ALTER TABLE coach_ads ADD COLUMN target_radius_km INT DEFAULT 50`,
    // Remove old single-section about/contact so they get re-seeded with full content
    // Only deletes if about page has fewer than 3 sections (the old thin version)
    `DELETE FROM website_sections WHERE page = 'about' AND (SELECT COUNT(*) FROM (SELECT id FROM website_sections WHERE page = 'about') t) < 3`,
    `DELETE FROM website_sections WHERE page = 'contact' AND (SELECT COUNT(*) FROM (SELECT id FROM website_sections WHERE page = 'contact') t) < 2`,
    // ── YouTube video support ────────────────────────────────────────────────
    `ALTER TABLE workout_videos ADD COLUMN source_type VARCHAR(20) DEFAULT 'upload'`,
    `ALTER TABLE workout_videos ADD COLUMN youtube_url TEXT DEFAULT NULL`,
    // ── Coach video moderation support ───────────────────────────────────────
    `ALTER TABLE workout_videos ADD COLUMN approval_status VARCHAR(20) DEFAULT 'approved'`,
    `ALTER TABLE workout_videos ADD COLUMN submitted_by INT DEFAULT NULL`,
    `ALTER TABLE workout_videos ADD COLUMN approved_by INT DEFAULT NULL`,
    `ALTER TABLE workout_videos ADD COLUMN approved_at DATETIME DEFAULT NULL`,
    `ALTER TABLE workout_videos ADD COLUMN rejection_reason VARCHAR(255) DEFAULT NULL`,
    // ── Ensure home page sections are always visible ─────────────────────────
    `UPDATE website_sections SET is_visible = 1 WHERE page = 'home'`,
    // ── Blog posts: add views + video_duration if missing ───────────────────
    `ALTER TABLE blog_posts ADD COLUMN views INT DEFAULT 0`,
    `ALTER TABLE blog_posts ADD COLUMN video_duration INT DEFAULT NULL`
  ];
  for (const sql of migrations) {
    try {
      await p.execute(sql);
    } catch {
    }
  }
  console.log("\u2705 All MySQL tables ready");
}
async function seedDefaultAccounts() {
  const bcrypt3 = (await import("bcryptjs")).default;
  const adminPw = process.env.SEED_ADMIN_PASSWORD || "AdminPass!2025";
  const coachPw = process.env.SEED_COACH_PASSWORD || "CoachPass!2025";
  const userPw = process.env.SEED_USER_PASSWORD || "UserPass!2025";
  const accounts = [
    { email: process.env.SEED_COACH_EMAIL || "petercoach@example.com", name: "Peter Coach", role: "coach", points: 1e3, steps: 12e3, pw: coachPw },
    { email: process.env.SEED_ADMIN_EMAIL || "peteradmin@example.com", name: "Peter Admin", role: "admin", points: 9999, steps: 0, pw: adminPw },
    { email: process.env.SEED_USER_EMAIL || "test@example.com", name: "Test User", role: "user", points: 500, steps: 8e3, pw: userPw }
  ];
  for (const acc of accounts) {
    const existing = await get("SELECT id, role FROM users WHERE email = ?", [acc.email]);
    if (!existing) {
      const hash = await bcrypt3.hash(acc.pw, 10);
      const avatar = null;
      await run(
        "INSERT INTO users (email, password, name, role, avatar, is_premium, membership_paid, points, steps) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          acc.email,
          hash,
          acc.name,
          acc.role,
          avatar,
          acc.role === "user" ? 1 : 0,
          acc.role !== "user" ? 1 : 0,
          acc.points,
          acc.steps
        ]
      );
      console.log(`\u2705 Created ${acc.role}: ${acc.email} / ${acc.pw}`);
    } else if (existing.role !== acc.role) {
      await run("UPDATE users SET role = ?, membership_paid = 1 WHERE id = ?", [acc.role, existing.id]);
      console.log(`\u2705 Fixed role for ${acc.email}: ${existing.role} \u2192 ${acc.role}`);
    }
  }
}
async function seedDefaultWebsiteSections() {
  const sections = [
    // ── HOME ─────────────────────────────────────────────────────────────────
    { page: "home", type: "hero", label: "Hero Section", sort_order: 1, content: JSON.stringify({ badge: "#1 DIGITAL FITNESS ECOSYSTEM IN EGYPT", heading: "Transform Your Body.", headingAccent: "Empower Your Mind.", subheading: "Join Fitway Hub \u2014 accessible, certified, human-driven fitness.", primaryBtnText: "Start Free Today", primaryBtnLink: "/auth/register", secondaryBtnText: "Learn More", secondaryBtnLink: "/about", backgroundImage: "" }) },
    { page: "home", type: "stats", label: "Stats Bar", sort_order: 2, content: JSON.stringify({ items: [{ value: "12K+", label: "Active Members" }, { value: "50+", label: "Programs" }, { value: "4.9\u2605", label: "App Rating" }, { value: "98%", label: "Satisfaction" }] }) },
    { page: "home", type: "features", label: "Features Grid", sort_order: 3, content: JSON.stringify({ sectionLabel: "Why Fitway", heading: "Everything you need to win", items: [{ icon: "Dumbbell", title: "50+ Workout Programs", desc: "Certified and structured for all levels." }, { icon: "Users", title: "Certified Human Coaches", desc: "Real certified coaches build personalised plans tailored to your goals." }, { icon: "BarChart", title: "Smart Analytics", desc: "Track steps, calories, and trends." }, { icon: "Users", title: "Community & Challenges", desc: "Stay accountable with thousands of members." }] }) },
    { page: "home", type: "cta", label: "Bottom CTA", sort_order: 99, content: JSON.stringify({ badge: "JOIN 12,000+ MEMBERS", heading: "Your best shape starts today.", subheading: "Free to join. No credit card required.", btnText: "Create Free Account", btnLink: "/auth/register" }) },
    // ── ABOUT ────────────────────────────────────────────────────────────────
    { page: "about", type: "hero", label: "About Hero", sort_order: 1, content: JSON.stringify({ badge: "Our Story", heading: "About Fitway Hub", headingAccent: "Egypt's #1 Fitness Platform", subheading: "We're on a mission to make world-class fitness coaching accessible to every Egyptian, anywhere, at any time.", primaryBtnText: "Join Us Today", primaryBtnLink: "/auth/register", secondaryBtnText: "Meet Our Coaches", secondaryBtnLink: "/coaches", backgroundImage: "" }) },
    { page: "about", type: "text_image", label: "Our Mission", sort_order: 2, content: JSON.stringify({ badge: "OUR MISSION", heading: "Fitness for Everyone", body: "Fitway Hub was founded with one belief: everyone deserves access to expert fitness guidance. We bridge the gap between certified coaches and people who want to change their lives \u2014 regardless of budget, location, or experience level.\n\nFrom certified coach-built workout plans to real-time coaching sessions, every feature we build is designed to move you closer to your goal.", imageUrl: "", imageAlt: "Our Mission", imagePosition: "right" }) },
    { page: "about", type: "stats", label: "About Stats", sort_order: 3, content: JSON.stringify({ items: [{ value: "12,000+", label: "Active Members" }, { value: "50+", label: "Certified Coaches" }, { value: "200+", label: "Workout Programs" }, { value: "3", label: "Years Running" }] }) },
    { page: "about", type: "features", label: "What We Offer", sort_order: 4, content: JSON.stringify({ sectionLabel: "PLATFORM FEATURES", heading: "Everything in one place", items: [{ icon: "Dumbbell", title: "Certified Workouts", desc: "Programs built and reviewed by certified coaches for all fitness levels." }, { icon: "Target", title: "Personalised Plans", desc: "Tailored plans from real certified coaches that adapt to your progress and lifestyle." }, { icon: "BarChart", title: "Progress Analytics", desc: "Visual dashboards track every step, calorie, and milestone." }, { icon: "Users", title: "Live Coaching", desc: "Book 1-on-1 sessions and get personalised nutrition and workout plans." }, { icon: "Bell", title: "Smart Reminders", desc: "Push notifications keep you on track without being annoying." }, { icon: "Globe", title: "Arabic & English", desc: "Fully bilingual \u2014 every screen available in English and Arabic." }] }) },
    { page: "about", type: "team", label: "Our Team", sort_order: 5, content: JSON.stringify({ sectionLabel: "THE TEAM", heading: "Built by fitness lovers", members: [{ name: "Ahmed Hassan", role: "CEO & Co-Founder", bio: "Former national athlete turned tech entrepreneur. 10+ years in fitness.", imageUrl: "" }, { name: "Sara Mostafa", role: "Head of Coaching", bio: "Certified personal trainer and nutritionist with 200+ coached clients.", imageUrl: "" }, { name: "Omar Khalid", role: "CTO", bio: "Full-stack engineer passionate about building products that matter.", imageUrl: "" }] }) },
    { page: "about", type: "cta", label: "About CTA", sort_order: 99, content: JSON.stringify({ badge: "JOIN THE COMMUNITY", heading: "Ready to start your journey?", subheading: "Join 12,000+ members already transforming their lives with Fitway Hub.", btnText: "Create Free Account", btnLink: "/auth/register" }) },
    // ── CONTACT ──────────────────────────────────────────────────────────────
    { page: "contact", type: "hero", label: "Contact Hero", sort_order: 1, content: JSON.stringify({ badge: "GET IN TOUCH", heading: "We'd love to hear from you", headingAccent: "", subheading: "Have a question, feedback, or want to partner with us? Reach out and our team will respond within 24 hours.", backgroundImage: "" }) },
    { page: "contact", type: "contact_info", label: "Contact Details", sort_order: 2, content: JSON.stringify({ phone: "+20 123 456 7890", email: "support@fitwayhub.com", chatHours: "9am \u2013 6pm Cairo Time", faqs: [{ q: "How do I subscribe to a coach?", a: "Go to the Coaching tab, browse certified coaches, and tap Subscribe on any coach profile." }, { q: "Can I cancel my premium subscription?", a: "Yes, you can cancel anytime from your Profile \u2192 Settings. No hidden fees." }, { q: "Is my payment information secure?", a: "All payments are processed through Paymob or PayPal \u2014 we never store card details." }, { q: "How do I become a coach on Fitway?", a: "Register as a coach, complete your profile, and submit your certification for admin review." }] }) }
  ];
  for (const s of sections) {
    try {
      const exists = await get("SELECT id FROM website_sections WHERE page = ? AND label = ?", [s.page, s.label]);
      if (!exists) {
        await run("INSERT INTO website_sections (page, type, label, content, sort_order, is_visible) VALUES (?,?,?,?,?,1)", [s.page, s.type, s.label, s.content, s.sort_order]);
      } else {
        if (s.page === "home") {
          await run("UPDATE website_sections SET is_visible = 1 WHERE page = ? AND label = ?", [s.page, s.label]);
        }
      }
    } catch {
    }
  }
  console.log("\u2705 Default website sections seeded");
}
async function seedDefaultAppSettings() {
  const defaults = [
    ["app_name", "FitWay Hub", "text", "branding", "App Name"],
    ["app_tagline", "Your fitness journey starts here", "text", "branding", "Tagline"],
    ["logo_url_en_light", "", "image", "branding", "English Logo (Light Mode)"],
    ["logo_url_en_dark", "", "image", "branding", "English Logo (Dark Mode)"],
    ["logo_url_ar_light", "", "image", "branding", "Arabic Logo (Light Mode)"],
    ["logo_url_ar_dark", "", "image", "branding", "Arabic Logo (Dark Mode)"],
    ["favicon_url", "", "image", "branding", "Favicon"],
    ["footer_text", "Egypt's #1 digital fitness ecosystem.", "text", "branding", "Footer Description"],
    ["copyright_text", "\xA9 2025 FitWay Hub. All rights reserved.", "text", "branding", "Copyright Text"],
    ["social_instagram", "", "text", "branding", "Instagram URL"],
    ["social_facebook", "", "text", "branding", "Facebook URL"],
    ["social_twitter", "", "text", "branding", "Twitter / X URL"],
    ["social_youtube", "", "text", "branding", "YouTube URL"],
    ["primary_color", "#7C6EFA", "color", "branding", "Primary Color (Main)"],
    ["secondary_color", "#FF7A6E", "color", "branding", "Secondary Color"],
    ["bg_primary", "#0F0F14", "color", "branding", "Background Primary"],
    ["bg_card", "#1C1C26", "color", "branding", "Card Background"],
    ["btn_hover_type", "glow", "text", "branding", "Button Hover Effect Type"],
    ["btn_hover_color", "", "color", "branding", "Button Hover Glow Color"],
    ["font_en", "Plus Jakarta Sans", "font", "branding", "English Font"],
    ["font_ar", "Cairo", "font", "branding", "Arabic Font"],
    ["font_heading", "Plus Jakarta Sans", "font", "branding", "Heading Font"],
    ["free_user_can_access_coaching", "1", "boolean", "access", "Free Users Can Browse Coaches"],
    ["max_video_upload_size_mb", "40", "number", "access", "Max Video Upload Size (MB)"],
    ["free_user_max_videos", "3", "number", "access", "Free Videos Limit"],
    ["coach_membership_fee_egp", "500", "number", "pricing", "Coach Monthly Fee (EGP)"],
    ["coach_membership_fee_usd", "29.99", "number", "pricing", "Coach Monthly Fee (USD, IAP)"],
    ["user_premium_fee_usd", "9.99", "number", "pricing", "User Premium Monthly (USD, IAP)"],
    ["registration_points_gift", "200", "number", "points", "Registration Bonus Points"],
    ["video_watch_points", "2", "number", "points", "Points per Video Watch"],
    ["goal_complete_points", "2", "number", "points", "Points per Goal Completed"],
    ["certified_coach_fee", "500", "number", "pricing", "Certified Coach Monthly Fee (EGP)"],
    ["feature_user_workouts", "1", "boolean", "features", "User: Workouts"],
    ["feature_user_workout_plan", "1", "boolean", "features", "User: Workout Plan"],
    ["feature_user_nutrition_plan", "1", "boolean", "features", "User: Nutrition Plan"],
    ["feature_user_steps", "1", "boolean", "features", "User: Steps"],
    ["feature_user_community", "1", "boolean", "features", "User: Community"],
    ["feature_user_chat", "1", "boolean", "features", "User: Chat"],
    ["feature_user_coaching", "1", "boolean", "features", "User: Coaching"],
    ["feature_user_tools", "1", "boolean", "features", "User: Tools"],
    ["feature_user_analytics", "1", "boolean", "features", "User: Analytics"],
    ["feature_user_plans", "1", "boolean", "features", "User: Plans"],
    ["feature_user_blogs", "1", "boolean", "features", "User: Blogs"],
    ["feature_user_notifications", "1", "boolean", "features", "User: Notifications"],
    ["feature_coach_requests", "1", "boolean", "features", "Coach: Requests"],
    ["feature_coach_athletes", "1", "boolean", "features", "Coach: Athletes"],
    ["feature_coach_chat", "1", "boolean", "features", "Coach: Chat"],
    ["feature_coach_ads", "1", "boolean", "features", "Coach: Ads"],
    ["feature_coach_blogs", "1", "boolean", "features", "Coach: Blogs"],
    ["feature_coach_community", "1", "boolean", "features", "Coach: Community"],
    ["feature_coach_workouts", "1", "boolean", "features", "Coach: Workouts"],
    ["feature_coach_notifications", "1", "boolean", "features", "Coach: Notifications"],
    // Dashboard layout settings
    ["dash_greeting_visible", "1", "boolean", "dashboard", "Show Greeting"],
    ["dash_hero_visible", "1", "boolean", "dashboard", "Show Hero Banner"],
    ["dash_hero_image", "", "url", "dashboard", "Hero Banner Image"],
    ["dash_hero_title", "Ready to crush your goals?", "text", "dashboard", "Hero Banner Title"],
    ["dash_hero_subtitle", "Track your progress and stay motivated", "text", "dashboard", "Hero Banner Subtitle"],
    ["dash_hero_cta_text", "Start Workout", "text", "dashboard", "Hero CTA Button Text"],
    ["dash_hero_cta_link", "/app/workouts", "text", "dashboard", "Hero CTA Button Link"],
    ["dash_stats_visible", "1", "boolean", "dashboard", "Show Stats Row"],
    ["dash_quick_actions_visible", "1", "boolean", "dashboard", "Show Quick Actions"],
    ["dash_analytics_visible", "1", "boolean", "dashboard", "Show Analytics Snapshot"],
    ["dash_analytics_title", "Analytics Snapshot", "text", "dashboard", "Analytics Section Title"],
    ["dash_featured_visible", "1", "boolean", "dashboard", "Show Featured Card"],
    ["dash_featured_image", "", "url", "dashboard", "Featured Card Image"],
    ["dash_featured_title", "Featured Workout", "text", "dashboard", "Featured Card Title"],
    ["dash_featured_subtitle", "Try today's recommended routine", "text", "dashboard", "Featured Card Subtitle"],
    ["dash_featured_link", "/app/workouts", "text", "dashboard", "Featured Card Link"],
    ["dash_videos_visible", "1", "boolean", "dashboard", "Show Videos Section"],
    ["dash_videos_title", "Workouts", "text", "dashboard", "Videos Section Title"],
    ["dash_coaches_visible", "1", "boolean", "dashboard", "Show Coaches Section"],
    ["dash_coaches_title", "Top Coaches", "text", "dashboard", "Coaches Section Title"],
    ["dash_blogs_visible", "1", "boolean", "dashboard", "Show Blogs Section"],
    ["dash_blogs_title", "Latest Articles", "text", "dashboard", "Blogs Section Title"],
    ["dash_ads_visible", "1", "boolean", "dashboard", "Show Sponsored Ads"]
  ];
  const batchSize = 10;
  for (let i = 0; i < defaults.length; i += batchSize) {
    const batch = defaults.slice(i, i + batchSize);
    const placeholders = batch.map(() => "(?,?,?,?,?)").join(",");
    const params = batch.flat();
    await getPool().execute(
      `INSERT IGNORE INTO app_settings (setting_key, setting_value, setting_type, category, label) VALUES ${placeholders}`,
      params
    );
  }
}
async function seedStandardTemplates() {
  const templates = [
    { slug: "user_register", title: "Welcome to Fitway Hub! \u{1F4AA}", body: "Your fitness journey starts today. Set up your profile and build your first workout plan.", category: "new_user", trigger_type: "user_registers", purpose: "onboarding" },
    { slug: "coach_register", title: "Welcome Coach! Athletes are waiting.", body: "Complete your profile and start connecting with athletes who need your expertise.", category: "new_coach", trigger_type: "coach_registers", purpose: "coach_onboarding" },
    { slug: "profile_complete", title: "Your profile is ready! \u{1F3AF}", body: "Great work! Now let's build your first workout plan and get started.", category: "new_user", trigger_type: "user_completes_profile", purpose: "activation" },
    { slug: "workout_plan_assigned", title: "New workout plan assigned! \u{1F3CB}\uFE0F", body: "Your coach assigned a new workout plan. Open the app to start training.", category: "engagement", trigger_type: "workout_plan_assigned", purpose: "engagement" },
    { slug: "workout_day_reminder", title: "Today is a workout day! \u{1F4AA}", body: "Let's get moving! Your workout is ready and waiting for you.", category: "engagement", trigger_type: "workout_day_reminder", purpose: "habit_building" },
    { slug: "inactive_1_day", title: "You missed yesterday's workout.", body: "Ready to get back? Your progress is waiting \u2014 even a quick session counts.", category: "inactivity", trigger_type: "user_inactive_1_day", purpose: "retention" },
    { slug: "inactive_3_days", title: "Your progress is waiting. \u{1F4C8}", body: "Jump back into training today. 3 days away is nothing \u2014 let's restart strong.", category: "inactivity", trigger_type: "user_inactive_3_days", purpose: "re_engagement" },
    { slug: "inactive_7_days", title: "We miss you! \u{1F44B}", body: "Your fitness journey is still here. Come back and keep moving forward.", category: "inactivity", trigger_type: "user_inactive_7_days", purpose: "win_back" },
    { slug: "workout_completed", title: "Great job! Workout complete. \u2705", body: "Another session done. Keep the momentum going \u2014 your next workout is already lined up.", category: "engagement", trigger_type: "workout_completed", purpose: "positive_reinforcement" },
    { slug: "streak_3_days", title: "\u{1F525} 3-day streak!", body: "Keep pushing your limits. Three days straight \u2014 you're building something great.", category: "streak", trigger_type: "streak_3_days", purpose: "motivation" },
    { slug: "streak_7_days", title: "7-day streak! Real habit forming. \u{1F3C6}", body: "Seven days in a row! You're building a real fitness habit. Keep it up.", category: "streak", trigger_type: "streak_7_days", purpose: "habit_reinforcement" },
    { slug: "coach_message", title: "Your coach sent you a message. \u{1F4AC}", body: "Check your messages now and stay on track with your coach's guidance.", category: "engagement", trigger_type: "coach_sends_message", purpose: "communication" },
    { slug: "new_workout_unlocked", title: "New workout available today! \u{1F195}", body: "A new workout has been unlocked. Ready to try something new?", category: "engagement", trigger_type: "new_workout_unlocked", purpose: "engagement" },
    { slug: "progress_milestone", title: "Progress alert! \u{1F4CA}", body: "You're getting stronger every week. Open the app to see your latest stats.", category: "engagement", trigger_type: "progress_milestone", purpose: "retention" },
    { slug: "goal_achieved", title: "Goal achieved! \u{1F389}", body: "You hit your goal! Celebrate the win and set your next challenge.", category: "engagement", trigger_type: "goal_achieved", purpose: "achievement" },
    { slug: "weight_logged", title: "Progress logged! \u{1F4DD}", body: "Great job tracking your progress. Consistency is the key to real results.", category: "engagement", trigger_type: "weight_logged", purpose: "habit_reinforcement" },
    { slug: "meal_plan_updated", title: "Nutrition plan updated! \u{1F957}", body: "Your coach updated your nutrition plan. Check it now and fuel your training right.", category: "engagement", trigger_type: "meal_plan_updated", purpose: "engagement" },
    { slug: "new_challenge", title: "New fitness challenge! \u{1F3C5}", body: "A new challenge just started. Join now and compete with the community.", category: "engagement", trigger_type: "new_challenge_available", purpose: "community_engagement" },
    { slug: "streak_about_to_break", title: "Your streak is about to break! \u26A0\uFE0F", body: "One quick workout keeps your streak alive. Don't let it end now!", category: "streak", trigger_type: "user_near_streak_break", purpose: "urgency" },
    { slug: "new_exercise_added", title: "New exercises added to your program! \u{1F4AA}", body: "Your coach added new exercises. Open the app to check your updated plan.", category: "engagement", trigger_type: "coach_assigns_exercise", purpose: "engagement" },
    { slug: "morning_reminder", title: "Good morning! \u2600\uFE0F", body: "A quick workout will boost your energy and focus for the whole day.", category: "engagement", trigger_type: "morning_reminder", purpose: "daily_activation" },
    { slug: "evening_reminder", title: "Still time for today's workout! \u{1F319}", body: "The day isn't over yet. A short session now keeps your streak alive.", category: "engagement", trigger_type: "evening_reminder", purpose: "recovery_engagement" },
    { slug: "personal_best", title: "New personal best! \u{1F680}", body: "You broke your own record. Can you beat it again tomorrow?", category: "streak", trigger_type: "user_improves_record", purpose: "motivation" },
    { slug: "friend_joined", title: "Your friend joined Fitway Hub! \u{1F465}", body: "Train together and push each other to new limits.", category: "engagement", trigger_type: "friend_joins_platform", purpose: "social_engagement" },
    { slug: "challenge_completed", title: "Challenge completed! \u{1F3C6}", body: "Amazing work finishing the challenge. Your dedication is showing real results.", category: "engagement", trigger_type: "challenge_completed", purpose: "reward_reinforcement" },
    { slug: "new_feature", title: "New feature in Fitway Hub! \u2728", body: "We just launched something new. Open the app and check it out.", category: "promo", trigger_type: "app_feature_announcement", purpose: "product_awareness" },
    { slug: "monthly_summary", title: "Your monthly progress report is ready! \u{1F4C5}", body: "Open the app to see how far you've come this month.", category: "engagement", trigger_type: "monthly_progress_summary", purpose: "retention" },
    { slug: "coach_review", title: "Your coach reviewed your performance. \u{1F440}", body: "Your coach left feedback on your recent workouts. Check it now.", category: "coach_tip", trigger_type: "coach_review_posted", purpose: "engagement" },
    { slug: "program_completed", title: "Program completed! \u{1F393}", body: "You finished the full program. Ready to level up to the next challenge?", category: "engagement", trigger_type: "program_completed", purpose: "retention" },
    { slug: "inactive_14_days", title: "It's never too late to restart. \u{1F499}", body: "Your fitness journey is still here. Come back \u2014 even one session makes a difference.", category: "inactivity", trigger_type: "user_inactive_14_days", purpose: "win_back" },
    // ── Event-triggered templates ────────────────────────────────────────────
    { slug: "new_message", title: "\u{1F4AC} New message from {{name}}", body: "You have a new message. Open the app to read and reply.", category: "engagement", trigger_type: "message_received", purpose: "communication" },
    { slug: "payment_approved", title: "\u2705 Payment Approved", body: "Your e-wallet payment has been approved and your account is now activated.", category: "payment", trigger_type: "payment_approved", purpose: "transaction" },
    { slug: "payment_rejected", title: "\u274C Payment Rejected", body: "Your e-wallet payment was rejected. Please check the details or contact support.", category: "payment", trigger_type: "payment_rejected", purpose: "transaction" },
    { slug: "subscription_verified", title: "\u{1F4CB} New Subscription Request", body: "A user paid and requested to subscribe to you. Please accept or decline from Requests.", category: "subscription", trigger_type: "subscription_verified_coach", purpose: "coach_action" },
    { slug: "subscription_verified_user", title: "\u2705 Payment Verified", body: "Admin verified your payment. Waiting for coach acceptance.", category: "subscription", trigger_type: "subscription_verified_user", purpose: "transaction" },
    { slug: "subscription_rejected", title: "\u274C Subscription Rejected", body: "Your subscription payment was rejected by admin and marked for refund.", category: "subscription", trigger_type: "subscription_rejected", purpose: "transaction" },
    { slug: "subscription_coach_accepted", title: "\u{1F389} Coach Accepted Your Subscription", body: "Your coach accepted your subscription and your plan is now active!", category: "subscription", trigger_type: "subscription_coach_accepted", purpose: "activation" },
    { slug: "subscription_coach_declined", title: "\u{1F614} Coach Declined Subscription", body: "Your coach declined the subscription request. A refund is being processed.", category: "subscription", trigger_type: "subscription_coach_declined", purpose: "transaction" },
    { slug: "booking_accepted", title: "\u{1F389} Coaching Request Accepted!", body: "Your coaching request has been accepted. Your coach will reach out soon.", category: "coaching", trigger_type: "booking_accepted", purpose: "activation" },
    { slug: "booking_rejected", title: "\u{1F614} Coaching Request Update", body: "Your coaching request was reviewed. Please reach out for more info.", category: "coaching", trigger_type: "booking_rejected", purpose: "engagement" },
    { slug: "ad_approved", title: "\u2705 Campaign Approved: {{campaign_name}}", body: "Your ad campaign is now live and reaching your target audience!", category: "ads", trigger_type: "ad_approved", purpose: "coach_action" },
    { slug: "ad_rejected", title: "\u274C Campaign Rejected: {{campaign_name}}", body: "Your campaign was rejected. Please review the notes and resubmit.", category: "ads", trigger_type: "ad_rejected", purpose: "coach_action" },
    { slug: "ad_flagged", title: "\u{1F6A9} Campaign Flagged: {{campaign_name}}", body: "Your campaign has been flagged for review and is currently paused.", category: "ads", trigger_type: "ad_flagged", purpose: "coach_action" },
    { slug: "ad_needs_changes", title: "\u26A0\uFE0F Campaign Needs Changes: {{campaign_name}}", body: "Your campaign requires changes before it can go live. Please review the notes.", category: "ads", trigger_type: "ad_needs_changes", purpose: "coach_action" },
    { slug: "post_liked", title: "\u2764\uFE0F {{name}} liked your post", body: "Someone liked what you shared! Keep inspiring the community.", category: "community", trigger_type: "post_liked", purpose: "social_engagement" },
    { slug: "post_commented", title: "\u{1F4AC} {{name}} commented on your post", body: "You got a new comment! Open the app to read and reply.", category: "community", trigger_type: "post_commented", purpose: "social_engagement" },
    { slug: "new_follower", title: "\u{1F464} {{name}} started following you", body: "You have a new follower! Keep sharing great content.", category: "community", trigger_type: "new_follower", purpose: "social_engagement" }
  ];
  for (const t of templates) {
    await getPool().execute(
      `INSERT IGNORE INTO push_templates (slug, title, body, category, trigger_type, enabled)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [t.slug, t.title, t.body, t.category, t.trigger_type]
    );
  }
  console.log("\u2705 Standard push templates seeded (30)");
}
async function seedDefaultBlogs() {
  const author = await get("SELECT id FROM users WHERE role IN ('coach','admin') ORDER BY id ASC LIMIT 1");
  if (!author) return;
  try {
    const orphaned = await query(
      "SELECT DISTINCT bp.author_id FROM blog_posts bp LEFT JOIN users u ON u.id = bp.author_id WHERE u.id IS NULL"
    );
    if (orphaned.length > 0) {
      await run("UPDATE blog_posts SET author_id = ? WHERE author_id NOT IN (SELECT id FROM users)", [author.id]);
    }
  } catch {
  }
  const existing = await get("SELECT COUNT(*) as cnt FROM blog_posts WHERE language = ?", ["en"]);
  if (existing?.cnt >= 10) return;
  const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
  const BLOGS = [
    { title: "10 Science-Backed Ways to Burn Fat Faster", title_ar: "\u0661\u0660 \u0637\u0631\u0642 \u0639\u0644\u0645\u064A\u0629 \u0644\u062D\u0631\u0642 \u0627\u0644\u062F\u0647\u0648\u0646 \u0628\u0634\u0643\u0644 \u0623\u0633\u0631\u0639", slug: "10-ways-burn-fat-faster", excerpt: "Discover the most effective, research-proven strategies to accelerate fat loss without sacrificing muscle.", excerpt_ar: "\u0627\u0643\u062A\u0634\u0641 \u0623\u0643\u062B\u0631 \u0627\u0644\u0627\u0633\u062A\u0631\u0627\u062A\u064A\u062C\u064A\u0627\u062A \u0641\u0639\u0627\u0644\u064A\u0629 \u0648\u0627\u0644\u0645\u062F\u0639\u0648\u0645\u0629 \u0628\u0627\u0644\u0623\u0628\u062D\u0627\u062B \u0644\u062A\u0633\u0631\u064A\u0639 \u0641\u0642\u062F\u0627\u0646 \u0627\u0644\u062F\u0647\u0648\u0646 \u062F\u0648\u0646 \u0627\u0644\u062A\u0636\u062D\u064A\u0629 \u0628\u0627\u0644\u0639\u0636\u0644\u0627\u062A.", content: `## The Science of Fat Loss

### 1. Prioritize Protein
Eat 1.6\u20132.2g of protein per kg of bodyweight. Burns up to 30% of its calories during digestion.

### 2. Strength Train 3\u20134x Per Week
Builds muscle, raising your resting metabolic rate.

### 3. Sleep 7\u20139 Hours
Poor sleep raises cortisol and hunger hormones by up to 24%.

### 4. Time-Restricted Eating
Eating in an 8\u201310 hour window improves insulin sensitivity.

### 5. Walk 8,000\u201310,000 Steps Daily
Non-exercise activity accounts for 15\u201330% of energy expenditure.

### 6. Avoid Liquid Calories
Sodas and juices add hundreds of calories without satiety.

### 7. Manage Stress
Chronic stress promotes fat storage around the abdomen.

### 8. Stay Hydrated
Drinking 500ml before meals reduces caloric intake by 13%.

### 9. Track Your Food
Trackers lose 2\u20133x more weight than those who don't.

### 10. Be Consistent Over Perfect
Consistency beats perfection every single time.`, content_ar: `## \u0639\u0644\u0645 \u0641\u0642\u062F\u0627\u0646 \u0627\u0644\u062F\u0647\u0648\u0646

### \u0661. \u0623\u0639\u0637\u0650 \u0627\u0644\u0623\u0648\u0644\u0648\u064A\u0629 \u0644\u0644\u0628\u0631\u0648\u062A\u064A\u0646
\u062A\u0646\u0627\u0648\u0644 1.6\u20132.2 \u063A \u0644\u0643\u0644 \u0643\u063A \u0645\u0646 \u0648\u0632\u0646\u0643. \u062A\u062D\u0631\u0642 \u0627\u0644\u0623\u0637\u0639\u0645\u0629 \u0627\u0644\u063A\u0646\u064A\u0629 \u0628\u0627\u0644\u0628\u0631\u0648\u062A\u064A\u0646 \u062D\u062A\u0649 30% \u0645\u0646 \u0633\u0639\u0631\u0627\u062A\u0647\u0627 \u0623\u062B\u0646\u0627\u0621 \u0627\u0644\u0647\u0636\u0645.

### \u0662. \u062A\u0645\u0627\u0631\u064A\u0646 \u0627\u0644\u0642\u0648\u0629 3\u20134 \u0645\u0631\u0627\u062A \u0623\u0633\u0628\u0648\u0639\u064A\u0627\u064B
\u062A\u0628\u0646\u064A \u0627\u0644\u0639\u0636\u0644\u0627\u062A \u0648\u062A\u0631\u0641\u0639 \u0645\u0639\u062F\u0644 \u0627\u0644\u062D\u0631\u0642 \u0623\u062B\u0646\u0627\u0621 \u0627\u0644\u0631\u0627\u062D\u0629.

### \u0663. \u0646\u0645 7\u20139 \u0633\u0627\u0639\u0627\u062A
\u0642\u0644\u0629 \u0627\u0644\u0646\u0648\u0645 \u062A\u0631\u0641\u0639 \u0627\u0644\u0643\u0648\u0631\u062A\u064A\u0632\u0648\u0644 \u0648\u0647\u0631\u0645\u0648\u0646\u0627\u062A \u0627\u0644\u062C\u0648\u0639 \u0628\u0646\u0633\u0628\u0629 \u062A\u0635\u0644 \u0625\u0644\u0649 24%.

### \u0664. \u0627\u0644\u0623\u0643\u0644 \u0641\u064A \u0646\u0627\u0641\u0630\u0629 \u0632\u0645\u0646\u064A\u0629 \u0645\u062D\u062F\u062F\u0629
\u0627\u0644\u0623\u0643\u0644 \u0641\u064A 8\u201310 \u0633\u0627\u0639\u0627\u062A \u064A\u062D\u0633\u0651\u0646 \u062D\u0633\u0627\u0633\u064A\u0629 \u0627\u0644\u0625\u0646\u0633\u0648\u0644\u064A\u0646.

### \u0665. \u0627\u0645\u0634\u0650 8,000\u201310,000 \u062E\u0637\u0648\u0629 \u064A\u0648\u0645\u064A\u0627\u064B
\u0627\u0644\u0646\u0634\u0627\u0637 \u0627\u0644\u064A\u0648\u0645\u064A \u064A\u0634\u0643\u0644 15\u201330% \u0645\u0646 \u0625\u062C\u0645\u0627\u0644\u064A \u0625\u0646\u0641\u0627\u0642 \u0627\u0644\u0637\u0627\u0642\u0629.

### \u0666. \u062A\u062C\u0646\u0628 \u0627\u0644\u0633\u0639\u0631\u0627\u062A \u0627\u0644\u0633\u0627\u0626\u0644\u0629
\u0627\u0644\u0645\u0634\u0631\u0648\u0628\u0627\u062A \u0627\u0644\u063A\u0627\u0632\u064A\u0629 \u062A\u0636\u064A\u0641 \u0645\u0626\u0627\u062A \u0627\u0644\u0633\u0639\u0631\u0627\u062A \u062F\u0648\u0646 \u0625\u0634\u0628\u0627\u0639.

### \u0667. \u0623\u062F\u0650\u0631 \u0627\u0644\u062A\u0648\u062A\u0631
\u0627\u0644\u062A\u0648\u062A\u0631 \u0627\u0644\u0645\u0632\u0645\u0646 \u064A\u0639\u0632\u0632 \u062A\u062E\u0632\u064A\u0646 \u0627\u0644\u062F\u0647\u0648\u0646 \u062D\u0648\u0644 \u0627\u0644\u0628\u0637\u0646.

### \u0668. \u0627\u0634\u0631\u0628 \u0627\u0644\u0645\u0627\u0621 \u0627\u0644\u0643\u0627\u0641\u064A
\u0634\u0631\u0628 500 \u0645\u0644 \u0642\u0628\u0644 \u0627\u0644\u0648\u062C\u0628\u0627\u062A \u064A\u0642\u0644\u0644 \u0627\u0644\u0633\u0639\u0631\u0627\u062A 13%.

### \u0669. \u062A\u062A\u0628\u0639 \u0637\u0639\u0627\u0645\u0643
\u0645\u0646 \u064A\u062A\u062A\u0628\u0639\u0648\u0646 \u0637\u0639\u0627\u0645\u0647\u0645 \u064A\u062E\u0633\u0631\u0648\u0646 2\u20133 \u0623\u0636\u0639\u0627\u0641 \u0645\u0645\u0646 \u0644\u0627 \u064A\u0641\u0639\u0644\u0648\u0646.

### \u0661\u0660. \u0627\u0644\u0627\u0633\u062A\u0645\u0631\u0627\u0631\u064A\u0629 \u0641\u0648\u0642 \u0627\u0644\u0643\u0645\u0627\u0644
\u0627\u0644\u0627\u0633\u062A\u0645\u0631\u0627\u0631\u064A\u0629 \u062A\u062A\u0641\u0648\u0642 \u062F\u0627\u0626\u0645\u0627\u064B \u0639\u0644\u0649 \u0627\u0644\u0643\u0645\u0627\u0644.` },
    { title: "The Complete Beginner's Guide to Building Muscle", title_ar: "\u0627\u0644\u062F\u0644\u064A\u0644 \u0627\u0644\u0634\u0627\u0645\u0644 \u0644\u0644\u0645\u0628\u062A\u062F\u0626\u064A\u0646 \u0644\u0628\u0646\u0627\u0621 \u0627\u0644\u0639\u0636\u0644\u0627\u062A", slug: "beginners-guide-building-muscle", excerpt: "Everything you need to know to start gaining lean muscle mass.", excerpt_ar: "\u0643\u0644 \u0645\u0627 \u062A\u062D\u062A\u0627\u062C \u0645\u0639\u0631\u0641\u062A\u0647 \u0644\u0628\u062F\u0621 \u0627\u0643\u062A\u0633\u0627\u0628 \u0627\u0644\u0643\u062A\u0644\u0629 \u0627\u0644\u0639\u0636\u0644\u064A\u0629.", content: `## Building Muscle: The Fundamentals

Three pillars: **Progressive Overload**, **Sufficient Protein**, **Recovery**.

### Training Split
- Monday: Push (Chest, Shoulders, Triceps)
- Wednesday: Pull (Back, Biceps)
- Friday: Legs

### Key Exercises
Squat, Deadlift, Bench Press, Pull-Up, Overhead Press.

### Nutrition
Eat at a 200\u2013300 calorie surplus. 1.8\u20132.2g protein/kg bodyweight.

### Recovery
Muscles grow outside the gym. Sleep 7\u20139 hours.`, content_ar: `## \u0628\u0646\u0627\u0621 \u0627\u0644\u0639\u0636\u0644\u0627\u062A: \u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0627\u062A

\u062B\u0644\u0627\u062B\u0629 \u0623\u0639\u0645\u062F\u0629: **\u0627\u0644\u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u062A\u062F\u0631\u064A\u062C\u064A**\u060C **\u0627\u0644\u0628\u0631\u0648\u062A\u064A\u0646 \u0627\u0644\u0643\u0627\u0641\u064A**\u060C **\u0627\u0644\u062A\u0639\u0627\u0641\u064A**.

### \u0628\u0631\u0646\u0627\u0645\u062C \u0627\u0644\u062A\u062F\u0631\u064A\u0628
- \u0627\u0644\u0627\u062B\u0646\u064A\u0646: \u0627\u0644\u062F\u0641\u0639 (\u0627\u0644\u0635\u062F\u0631\u060C \u0627\u0644\u0623\u0643\u062A\u0627\u0641\u060C \u062B\u0644\u0627\u062B\u064A\u0629 \u0627\u0644\u0631\u0624\u0648\u0633)
- \u0627\u0644\u0623\u0631\u0628\u0639\u0627\u0621: \u0627\u0644\u0633\u062D\u0628 (\u0627\u0644\u0638\u0647\u0631\u060C \u062B\u0646\u0627\u0626\u064A\u0629 \u0627\u0644\u0631\u0624\u0648\u0633)
- \u0627\u0644\u062C\u0645\u0639\u0629: \u0627\u0644\u0623\u0631\u062C\u0644

### \u0627\u0644\u062A\u0645\u0627\u0631\u064A\u0646 \u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629
\u0627\u0644\u0642\u0631\u0641\u0635\u0627\u0621\u060C \u0627\u0644\u0631\u0641\u0639\u0629 \u0627\u0644\u0645\u064A\u062A\u0629\u060C \u0636\u063A\u0637 \u0627\u0644\u0645\u0642\u0639\u062F\u060C \u0627\u0644\u0639\u0642\u0644\u0629\u060C \u0627\u0644\u0636\u063A\u0637 \u0641\u0648\u0642 \u0627\u0644\u0631\u0623\u0633.

### \u0627\u0644\u062A\u063A\u0630\u064A\u0629
\u062A\u0646\u0627\u0648\u0644 \u0641\u0627\u0626\u0636\u0627\u064B 200\u2013300 \u0633\u0639\u0631\u0629. 1.8\u20132.2 \u063A \u0628\u0631\u0648\u062A\u064A\u0646/\u0643\u063A.

### \u0627\u0644\u062A\u0639\u0627\u0641\u064A
\u062A\u0646\u0645\u0648 \u0627\u0644\u0639\u0636\u0644\u0627\u062A \u062E\u0627\u0631\u062C \u0627\u0644\u0635\u0627\u0644\u0629. \u0646\u0645 7\u20139 \u0633\u0627\u0639\u0627\u062A.` },
    { title: "How to Run Your First 5K in 8 Weeks", title_ar: "\u0643\u064A\u0641 \u062A\u062C\u0631\u064A \u0623\u0648\u0644 5 \u0643\u064A\u0644\u0648\u0645\u062A\u0631 \u0641\u064A 8 \u0623\u0633\u0627\u0628\u064A\u0639", slug: "run-first-5k-8-weeks", excerpt: "A complete couch-to-5K plan for absolute beginners.", excerpt_ar: "\u0628\u0631\u0646\u0627\u0645\u062C \u0643\u0627\u0645\u0644 \u0645\u0646 \u0627\u0644\u0623\u0631\u064A\u0643\u0629 \u0625\u0644\u0649 5 \u0643\u0645 \u0644\u0644\u0645\u0628\u062A\u062F\u0626\u064A\u0646.", content: `## Couch to 5K: 8-Week Plan

**Week 1\u20132:** 1 min run, 2 min walk \xD7 8 rounds, 3x/week.
**Week 3\u20134:** 2 min run, 1 min walk \xD7 8 rounds.
**Week 5\u20136:** 20-minute continuous jog.
**Week 7\u20138:** 25\u201330 minute continuous run.

### Race Day Tips
- Eat light 2 hours before
- Start slower than you think
- Celebrate finishing \u2014 time doesn't matter`, content_ar: `## \u0645\u0646 \u0627\u0644\u0623\u0631\u064A\u0643\u0629 \u0625\u0644\u0649 5 \u0643\u0645: 8 \u0623\u0633\u0627\u0628\u064A\u0639

**\u0627\u0644\u0623\u0633\u0628\u0648\u0639 \u0661\u2013\u0662:** 1 \u062F\u0642\u064A\u0642\u0629 \u062C\u0631\u064A\u060C 2 \u062F\u0642\u064A\u0642\u0629 \u0645\u0634\u064A \xD7 8\u060C 3 \u0645\u0631\u0627\u062A \u0623\u0633\u0628\u0648\u0639\u064A\u0627\u064B.
**\u0627\u0644\u0623\u0633\u0628\u0648\u0639 \u0663\u2013\u0664:** 2 \u062F\u0642\u064A\u0642\u0629 \u062C\u0631\u064A\u060C 1 \u062F\u0642\u064A\u0642\u0629 \u0645\u0634\u064A \xD7 8.
**\u0627\u0644\u0623\u0633\u0628\u0648\u0639 \u0665\u2013\u0666:** 20 \u062F\u0642\u064A\u0642\u0629 \u062C\u0631\u064A \u0645\u062A\u0648\u0627\u0635\u0644.
**\u0627\u0644\u0623\u0633\u0628\u0648\u0639 \u0667\u2013\u0668:** 25\u201330 \u062F\u0642\u064A\u0642\u0629 \u062C\u0631\u064A \u0645\u062A\u0648\u0627\u0635\u0644.

### \u0646\u0635\u0627\u0626\u062D \u064A\u0648\u0645 \u0627\u0644\u0633\u0628\u0627\u0642
- \u0648\u062C\u0628\u0629 \u062E\u0641\u064A\u0641\u0629 \u0642\u0628\u0644 \u0633\u0627\u0639\u062A\u064A\u0646
- \u0627\u0628\u062F\u0623 \u0628\u0648\u062A\u064A\u0631\u0629 \u0623\u0628\u0637\u0623
- \u0627\u062D\u062A\u0641\u0644 \u0628\u0627\u0644\u0625\u062A\u0645\u0627\u0645 \u2014 \u0627\u0644\u0648\u0642\u062A \u0644\u0627 \u064A\u0647\u0645` },
    { title: "The Truth About Intermittent Fasting", title_ar: "\u0627\u0644\u062D\u0642\u064A\u0642\u0629 \u062D\u0648\u0644 \u0627\u0644\u0635\u064A\u0627\u0645 \u0627\u0644\u0645\u062A\u0642\u0637\u0639", slug: "truth-about-intermittent-fasting", excerpt: "Does intermittent fasting actually work? We break down the science.", excerpt_ar: "\u0647\u0644 \u064A\u0639\u0645\u0644 \u0627\u0644\u0635\u064A\u0627\u0645 \u0627\u0644\u0645\u062A\u0642\u0637\u0639 \u0641\u0639\u0644\u0627\u064B\u061F \u0646\u0633\u062A\u0639\u0631\u0636 \u0627\u0644\u0623\u062F\u0644\u0629 \u0627\u0644\u0639\u0644\u0645\u064A\u0629.", content: `## Intermittent Fasting: The Science

IF is a calorie restriction tool. Studies show no significant difference vs continuous restriction when calories match.

### Popular Protocols
- 16:8 \u2014 Fast 16h, eat in 8h window
- 5:2 \u2014 Normal 5 days, 500 cal on 2 days

### Who Benefits
- People not hungry in the morning
- Those who overeat in the evening

### Bottom Line
IF works when it helps maintain a caloric deficit. It's a scheduling tool, not magic.`, content_ar: `## \u0627\u0644\u0635\u064A\u0627\u0645 \u0627\u0644\u0645\u062A\u0642\u0637\u0639: \u0627\u0644\u0639\u0644\u0645

\u0627\u0644\u0635\u064A\u0627\u0645 \u0627\u0644\u0645\u062A\u0642\u0637\u0639 \u0623\u062F\u0627\u0629 \u0644\u062A\u0642\u0644\u064A\u0644 \u0627\u0644\u0633\u0639\u0631\u0627\u062A. \u0627\u0644\u062F\u0631\u0627\u0633\u0627\u062A \u0644\u0627 \u062A\u064F\u0638\u0647\u0631 \u0641\u0631\u0642\u0627\u064B \u064A\u064F\u0630\u0643\u0631 \u0645\u0642\u0627\u0631\u0646\u0629 \u0628\u0627\u0644\u062A\u0642\u0644\u064A\u0644 \u0627\u0644\u0645\u0633\u062A\u0645\u0631 \u0639\u0646\u062F \u062A\u0633\u0627\u0648\u064A \u0627\u0644\u0633\u0639\u0631\u0627\u062A.

### \u0627\u0644\u0628\u0631\u0648\u062A\u0648\u0643\u0648\u0644\u0627\u062A \u0627\u0644\u0634\u0627\u0626\u0639\u0629
- 16:8 \u2014 \u0635\u064A\u0627\u0645 16 \u0633\u0627\u0639\u0629\u060C \u0623\u0643\u0644 \u0641\u064A \u0646\u0627\u0641\u0630\u0629 8 \u0633\u0627\u0639\u0627\u062A
- 5:2 \u2014 \u0637\u0628\u064A\u0639\u064A 5 \u0623\u064A\u0627\u0645\u060C 500 \u0633\u0639\u0631\u0629 \u064A\u0648\u0645\u064A\u0646

### \u0645\u0646 \u064A\u0633\u062A\u0641\u064A\u062F
- \u0645\u0646 \u0644\u0627 \u064A\u0634\u0639\u0631 \u0628\u0627\u0644\u062C\u0648\u0639 \u0635\u0628\u0627\u062D\u0627\u064B
- \u0645\u0646 \u064A\u0641\u0631\u0637 \u0641\u064A \u0627\u0644\u0623\u0643\u0644 \u0645\u0633\u0627\u0621\u064B

### \u0627\u0644\u062E\u0644\u0627\u0635\u0629
\u064A\u0639\u0645\u0644 \u0639\u0646\u062F\u0645\u0627 \u064A\u0633\u0627\u0639\u062F \u0639\u0644\u0649 \u0627\u0644\u062D\u0641\u0627\u0638 \u0639\u0644\u0649 \u0639\u062C\u0632 \u0641\u064A \u0627\u0644\u0633\u0639\u0631\u0627\u062A. \u0625\u0646\u0647 \u0623\u062F\u0627\u0629 \u062C\u062F\u0648\u0644\u0629 \u0648\u0644\u064A\u0633 \u0633\u062D\u0631\u0627\u064B.` },
    { title: "5 Yoga Poses for Desk Workers", title_ar: "\u0665 \u0648\u0636\u0639\u064A\u0627\u062A \u064A\u0648\u063A\u0627 \u0644\u0639\u0645\u0627\u0644 \u0627\u0644\u0645\u0643\u0627\u062A\u0628", slug: "yoga-poses-desk-workers", excerpt: "Five poses that undo the damage of sitting all day.", excerpt_ar: "\u062E\u0645\u0633 \u0648\u0636\u0639\u064A\u0627\u062A \u0644\u0625\u0644\u063A\u0627\u0621 \u062A\u0623\u062B\u064A\u0631\u0627\u062A \u0627\u0644\u062C\u0644\u0648\u0633 \u0637\u0648\u0627\u0644 \u0627\u0644\u064A\u0648\u0645.", content: `## Essential Yoga for Desk Workers

1. **Cat-Cow** \u2014 spine mobility, 10 reps
2. **Hip Flexor Lunge** \u2014 hold 30\u201360 sec each side
3. **Doorframe Chest Opener** \u2014 hold 30 seconds
4. **Seated Spinal Twist** \u2014 30 seconds each side
5. **Legs Up the Wall** \u2014 5\u201310 minutes`, content_ar: `## \u0627\u0644\u064A\u0648\u063A\u0627 \u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629 \u0644\u0639\u0645\u0627\u0644 \u0627\u0644\u0645\u0643\u0627\u062A\u0628

\u0661. **\u0627\u0644\u0642\u0637\u0629-\u0627\u0644\u0628\u0642\u0631\u0629** \u2014 \u0645\u0631\u0648\u0646\u0629 \u0627\u0644\u0639\u0645\u0648\u062F \u0627\u0644\u0641\u0642\u0631\u064A\u060C 10 \u062A\u0643\u0631\u0627\u0631\u0627\u062A
\u0662. **\u062A\u0645\u062F\u062F \u0627\u0644\u0648\u0631\u0643 \u0627\u0644\u0645\u0627\u0626\u0644** \u2014 30\u201360 \u062B\u0627\u0646\u064A\u0629 \u0644\u0643\u0644 \u062C\u0627\u0646\u0628
\u0663. **\u0641\u062A\u062D \u0627\u0644\u0635\u062F\u0631 \u0639\u0644\u0649 \u0627\u0644\u0628\u0627\u0628** \u2014 30 \u062B\u0627\u0646\u064A\u0629
\u0664. **\u0627\u0644\u0627\u0644\u062A\u0648\u0627\u0621 \u0627\u0644\u0641\u0642\u0631\u064A \u0627\u0644\u062C\u0627\u0644\u0633** \u2014 30 \u062B\u0627\u0646\u064A\u0629 \u0644\u0643\u0644 \u062C\u0627\u0646\u0628
\u0665. **\u0627\u0644\u0623\u0631\u062C\u0644 \u0639\u0644\u0649 \u0627\u0644\u062D\u0627\u0626\u0637** \u2014 5\u201310 \u062F\u0642\u0627\u0626\u0642` },
    { title: "Creatine: The Most Researched Supplement", title_ar: "\u0627\u0644\u0643\u0631\u064A\u0627\u062A\u064A\u0646: \u0627\u0644\u0645\u0643\u0645\u0644 \u0627\u0644\u0623\u0643\u062B\u0631 \u062F\u0631\u0627\u0633\u0629", slug: "creatine-complete-guide", excerpt: "Creatine is safe, effective, and backed by decades of research.", excerpt_ar: "\u0627\u0644\u0643\u0631\u064A\u0627\u062A\u064A\u0646 \u0622\u0645\u0646 \u0648\u0641\u0639\u0651\u0627\u0644 \u0648\u0645\u062F\u0639\u0648\u0645 \u0628\u0639\u0642\u0648\u062F \u0645\u0646 \u0627\u0644\u0623\u0628\u062D\u0627\u062B.", content: `## Creatine: Evidence-Based Guide

### Benefits
- 5\u201315% increase in strength
- More lean muscle mass
- Faster set recovery

### Dosing
- Loading (optional): 20g/day \xD7 7 days
- Maintenance: 3\u20135g daily

### Safety
Decades of research confirm safety for healthy individuals.

### Which Form?
Creatine monohydrate. No need for expensive variants.`, content_ar: `## \u0627\u0644\u0643\u0631\u064A\u0627\u062A\u064A\u0646: \u062F\u0644\u064A\u0644 \u0639\u0644\u0645\u064A

### \u0627\u0644\u0641\u0648\u0627\u0626\u062F
- \u0632\u064A\u0627\u062F\u0629 5\u201315% \u0641\u064A \u0627\u0644\u0642\u0648\u0629
- \u0643\u062A\u0644\u0629 \u0639\u0636\u0644\u064A\u0629 \u0623\u0643\u0628\u0631
- \u062A\u0639\u0627\u0641\u064D \u0623\u0633\u0631\u0639 \u0628\u064A\u0646 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0627\u062A

### \u0627\u0644\u062C\u0631\u0639\u0629
- \u0627\u0644\u062A\u062D\u0645\u064A\u0644 (\u0627\u062E\u062A\u064A\u0627\u0631\u064A): 20 \u063A/\u064A\u0648\u0645 \xD7 7 \u0623\u064A\u0627\u0645
- \u0627\u0644\u0635\u064A\u0627\u0646\u0629: 3\u20135 \u063A \u064A\u0648\u0645\u064A\u0627\u064B

### \u0627\u0644\u0633\u0644\u0627\u0645\u0629
\u0639\u0642\u0648\u062F \u0645\u0646 \u0627\u0644\u0623\u0628\u062D\u0627\u062B \u062A\u0624\u0643\u062F \u0627\u0644\u0633\u0644\u0627\u0645\u0629 \u0644\u0644\u0623\u0635\u062D\u0627\u0621.

### \u0623\u064A \u0634\u0643\u0644\u061F
\u0643\u0631\u064A\u0627\u062A\u064A\u0646 \u0623\u062D\u0627\u062F\u064A \u0627\u0644\u0647\u064A\u062F\u0631\u0627\u062A. \u0644\u0627 \u062D\u0627\u062C\u0629 \u0644\u0644\u0623\u0634\u0643\u0627\u0644 \u0627\u0644\u0645\u0643\u0644\u0641\u0629.` },
    { title: "How to Build a Home Gym on a Budget", title_ar: "\u0643\u064A\u0641 \u062A\u0628\u0646\u064A \u0635\u0627\u0644\u0629 \u0631\u064A\u0627\u0636\u064A\u0629 \u0645\u0646\u0632\u0644\u064A\u0629 \u0628\u0645\u064A\u0632\u0627\u0646\u064A\u0629 \u0645\u062D\u062F\u0648\u062F\u0629", slug: "home-gym-on-a-budget", excerpt: "Build an effective home gym with minimal investment.", excerpt_ar: "\u0627\u0628\u0646\u0650 \u0635\u0627\u0644\u0629 \u0631\u064A\u0627\u0636\u064A\u0629 \u0645\u0646\u0632\u0644\u064A\u0629 \u0641\u0639\u0627\u0644\u0629 \u0628\u0627\u0633\u062A\u062B\u0645\u0627\u0631 \u0628\u0633\u064A\u0637.", content: `## Home Gym on a Budget

1. **Resistance Bands** \u2014 most versatile
2. **Pull-Up Bar** \u2014 back and upper body
3. **Jump Rope** \u2014 cardio in small spaces
4. **Yoga Mat** \u2014 floor exercises
5. **Bodyweight exercises** \u2014 zero equipment needed

YouTube has thousands of free guided workouts.`, content_ar: `## \u0635\u0627\u0644\u0629 \u0631\u064A\u0627\u0636\u064A\u0629 \u0645\u0646\u0632\u0644\u064A\u0629 \u0628\u0645\u064A\u0632\u0627\u0646\u064A\u0629 \u0645\u062D\u062F\u0648\u062F\u0629

\u0661. **\u062D\u0632\u0627\u0645 \u0627\u0644\u0645\u0642\u0627\u0648\u0645\u0629** \u2014 \u0627\u0644\u0623\u0643\u062B\u0631 \u062A\u0646\u0648\u0639\u0627\u064B
\u0662. **\u0628\u0627\u0631 \u0627\u0644\u0639\u0642\u0644\u0629** \u2014 \u0627\u0644\u0638\u0647\u0631 \u0648\u0627\u0644\u062C\u0632\u0621 \u0627\u0644\u0639\u0644\u0648\u064A
\u0663. **\u062D\u0628\u0644 \u0627\u0644\u0642\u0641\u0632** \u2014 \u0643\u0627\u0631\u062F\u064A\u0648 \u0641\u064A \u0645\u0633\u0627\u062D\u0629 \u0635\u063A\u064A\u0631\u0629
\u0664. **\u062D\u0635\u064A\u0631\u0629 \u0627\u0644\u064A\u0648\u063A\u0627** \u2014 \u0627\u0644\u062A\u0645\u0627\u0631\u064A\u0646 \u0627\u0644\u0623\u0631\u0636\u064A\u0629
\u0665. **\u062A\u0645\u0627\u0631\u064A\u0646 \u0648\u0632\u0646 \u0627\u0644\u062C\u0633\u0645** \u2014 \u0644\u0627 \u0645\u0639\u062F\u0627\u062A \u0645\u0637\u0644\u0648\u0628\u0629

\u064A\u0648\u062A\u064A\u0648\u0628 \u064A\u062D\u062A\u0648\u064A \u0622\u0644\u0627\u0641 \u0627\u0644\u062A\u0645\u0627\u0631\u064A\u0646 \u0627\u0644\u0645\u0648\u062C\u0647\u0629 \u0627\u0644\u0645\u062C\u0627\u0646\u064A\u0629.` },
    { title: "Why You're Not Losing Weight", title_ar: "\u0644\u0645\u0627\u0630\u0627 \u0644\u0627 \u062A\u062E\u0633\u0631 \u0648\u0632\u0646\u0627\u064B\u061F", slug: "why-not-losing-weight-fix", excerpt: "The most common reasons weight loss stalls and the exact fixes.", excerpt_ar: "\u0623\u0643\u062B\u0631 \u0623\u0633\u0628\u0627\u0628 \u062A\u0648\u0642\u0641 \u062E\u0633\u0627\u0631\u0629 \u0627\u0644\u0648\u0632\u0646 \u0634\u064A\u0648\u0639\u0627\u064B \u0648\u0627\u0644\u062D\u0644\u0648\u0644 \u0627\u0644\u062F\u0642\u064A\u0642\u0629.", content: `## Breaking a Weight Loss Plateau

1. **Underestimating calories** \u2014 weigh food for one week
2. **Metabolic adaptation** \u2014 take a 1\u20132 week diet break
3. **Too much cardio** \u2014 add strength training
4. **Poor sleep** \u2014 fix sleep before anything else
5. **Water retention** \u2014 track trends over 2\u20134 weeks, not daily`, content_ar: `## \u0643\u0633\u0631 \u062D\u0627\u062C\u0632 \u062A\u0648\u0642\u0641 \u0627\u0644\u0648\u0632\u0646

\u0661. **\u0627\u0644\u062A\u0642\u0644\u064A\u0644 \u0645\u0646 \u062A\u0642\u062F\u064A\u0631 \u0627\u0644\u0633\u0639\u0631\u0627\u062A** \u2014 \u0632\u0646 \u0637\u0639\u0627\u0645\u0643 \u0623\u0633\u0628\u0648\u0639\u0627\u064B
\u0662. **\u0627\u0644\u062A\u0643\u064A\u0641 \u0627\u0644\u0623\u064A\u0636\u064A** \u2014 \u0623\u062E\u0630 \u0627\u0633\u062A\u0631\u0627\u062D\u0629 \u063A\u0630\u0627\u0626\u064A\u0629 1\u20132 \u0623\u0633\u0628\u0648\u0639
\u0663. **\u0643\u062B\u0631\u0629 \u0627\u0644\u0643\u0627\u0631\u062F\u064A\u0648** \u2014 \u0623\u0636\u0641 \u062A\u0645\u0627\u0631\u064A\u0646 \u0627\u0644\u0642\u0648\u0629
\u0664. **\u0642\u0644\u0629 \u0627\u0644\u0646\u0648\u0645** \u2014 \u0627\u0635\u0644\u062D \u0627\u0644\u0646\u0648\u0645 \u0623\u0648\u0644\u0627\u064B
\u0665. **\u0627\u0644\u0627\u062D\u062A\u0628\u0627\u0633 \u0627\u0644\u0645\u0627\u0626\u064A** \u2014 \u062A\u062A\u0628\u0639 \u0627\u0644\u0627\u062A\u062C\u0627\u0647\u0627\u062A 2\u20134 \u0623\u0633\u0627\u0628\u064A\u0639 \u0648\u0644\u064A\u0633 \u064A\u0648\u0645\u064A\u0627\u064B` },
    { title: "The Ultimate Pre-Workout Nutrition Guide", title_ar: "\u0627\u0644\u062F\u0644\u064A\u0644 \u0627\u0644\u0634\u0627\u0645\u0644 \u0644\u062A\u063A\u0630\u064A\u0629 \u0645\u0627 \u0642\u0628\u0644 \u0627\u0644\u062A\u0645\u0631\u064A\u0646", slug: "pre-workout-nutrition-guide", excerpt: "What to eat before training to maximize performance.", excerpt_ar: "\u0645\u0627 \u0627\u0644\u0630\u064A \u062A\u0623\u0643\u0644\u0647 \u0642\u0628\u0644 \u0627\u0644\u062A\u0645\u0631\u064A\u0646 \u0644\u062A\u0639\u0638\u064A\u0645 \u0627\u0644\u0623\u062F\u0627\u0621.", content: `## Pre-Workout Nutrition

**2\u20133 hours before:** 40\u201360g carbs + 20\u201330g protein, low fat.
**30\u201360 min before:** banana + protein, or dates + coffee.

### Caffeine
3\u20136mg/kg bodyweight 30\u201360 min before = ~3\u20134% strength increase.

### Hydration
2% dehydration = up to 15% drop in strength output.`, content_ar: `## \u062A\u063A\u0630\u064A\u0629 \u0645\u0627 \u0642\u0628\u0644 \u0627\u0644\u062A\u0645\u0631\u064A\u0646

**\u0642\u0628\u0644 2\u20133 \u0633\u0627\u0639\u0627\u062A:** 40\u201360 \u063A \u0643\u0631\u0628\u0648\u0647\u064A\u062F\u0631\u0627\u062A + 20\u201330 \u063A \u0628\u0631\u0648\u062A\u064A\u0646\u060C \u062F\u0647\u0648\u0646 \u0645\u0646\u062E\u0641\u0636\u0629.
**\u0642\u0628\u0644 30\u201360 \u062F\u0642\u064A\u0642\u0629:** \u0645\u0648\u0632\u0629 + \u0628\u0631\u0648\u062A\u064A\u0646\u060C \u0623\u0648 \u062A\u0645\u0631 + \u0642\u0647\u0648\u0629.

### \u0627\u0644\u0643\u0627\u0641\u064A\u064A\u0646
3\u20136 \u0645\u0644\u063A/\u0643\u063A \u0642\u0628\u0644 30\u201360 \u062F\u0642\u064A\u0642\u0629 = \u0632\u064A\u0627\u062F\u0629 \u0642\u0648\u0629 ~3\u20134%.

### \u0627\u0644\u062A\u0631\u0637\u064A\u0628
2% \u062C\u0641\u0627\u0641 = \u0627\u0646\u062E\u0641\u0627\u0636 \u062D\u062A\u0649 15% \u0641\u064A \u0645\u062E\u0631\u062C\u0627\u062A \u0627\u0644\u0642\u0648\u0629.` },
    { title: "Sleep: The Most Underrated Performance Enhancer", title_ar: "\u0627\u0644\u0646\u0648\u0645: \u0623\u0643\u062B\u0631 \u0645\u0639\u0632\u0632 \u0644\u0644\u0623\u062F\u0627\u0621 \u0625\u0647\u0645\u0627\u0644\u0627\u064B", slug: "sleep-performance-enhancer", excerpt: "Sleep is where gains are actually made.", excerpt_ar: "\u0627\u0644\u0646\u0648\u0645 \u0647\u0648 \u0627\u0644\u0645\u0643\u0627\u0646 \u0627\u0644\u0630\u064A \u062A\u064F\u0635\u0646\u0639 \u0641\u064A\u0647 \u0627\u0644\u0645\u0643\u0627\u0633\u0628 \u0627\u0644\u062D\u0642\u064A\u0642\u064A\u0629.", content: `## Why Sleep is Your #1 Tool

### During Sleep
- Growth hormone peaks \u2014 muscle repair
- Cortisol resets
- Motor patterns are cemented
- Glycogen replenishes

### Requirements
- Sedentary: 7\u20138h | Exercisers: 8\u20139h | Athletes: 9\u201310h

### Optimize It
1. Consistent schedule
2. Cool room (18\u201320\xB0C)
3. No screens 1h before bed
4. Blackout curtains
5. No caffeine after 2pm`, content_ar: `## \u0644\u0645\u0627\u0630\u0627 \u0627\u0644\u0646\u0648\u0645 \u0647\u0648 \u0623\u062F\u0627\u062A\u0643 \u0627\u0644\u0623\u0648\u0644\u0649

### \u0623\u062B\u0646\u0627\u0621 \u0627\u0644\u0646\u0648\u0645
- \u0630\u0631\u0648\u0629 \u0647\u0631\u0645\u0648\u0646 \u0627\u0644\u0646\u0645\u0648 \u2014 \u0625\u0635\u0644\u0627\u062D \u0627\u0644\u0639\u0636\u0644\u0627\u062A
- \u0625\u0639\u0627\u062F\u0629 \u0636\u0628\u0637 \u0627\u0644\u0643\u0648\u0631\u062A\u064A\u0632\u0648\u0644
- \u062A\u0631\u0633\u064A\u062E \u0627\u0644\u0623\u0646\u0645\u0627\u0637 \u0627\u0644\u062D\u0631\u0643\u064A\u0629
- \u062A\u062C\u062F\u064A\u062F \u0627\u0644\u062C\u0644\u064A\u0643\u0648\u062C\u064A\u0646

### \u0627\u0644\u0645\u062A\u0637\u0644\u0628\u0627\u062A
- \u062E\u0627\u0645\u0644: 7\u20138 \u0633\u0627\u0639\u0627\u062A | \u0645\u062A\u0645\u0631\u0646: 8\u20139 | \u0631\u064A\u0627\u0636\u064A: 9\u201310

### \u0643\u064A\u0641 \u062A\u062D\u0633\u0651\u0646\u0647
\u0661. \u062C\u062F\u0648\u0644 \u062B\u0627\u0628\u062A
\u0662. \u063A\u0631\u0641\u0629 \u0628\u0627\u0631\u062F\u0629 (18\u201320\xB0\u0645)
\u0663. \u0644\u0627 \u0634\u0627\u0634\u0627\u062A \u0642\u0628\u0644 \u0633\u0627\u0639\u0629 \u0645\u0646 \u0627\u0644\u0646\u0648\u0645
\u0664. \u0633\u062A\u0627\u0626\u0631 \u062A\u0639\u062A\u064A\u0645
\u0665. \u0644\u0627 \u0643\u0627\u0641\u064A\u064A\u0646 \u0628\u0639\u062F \u0627\u0644\u062B\u0627\u0646\u064A\u0629 \u0638\u0647\u0631\u0627\u064B` }
  ];
  const p = await getPool();
  for (const blog of BLOGS) {
    try {
      await p.execute(
        `INSERT IGNORE INTO blog_posts (title, slug, language, excerpt, content, status, author_id, author_role, published_at) VALUES (?,?,'en',?,?,'published',?,?,?)`,
        [blog.title, blog.slug, blog.excerpt, blog.content, author.id, "coach", now]
      );
      const enRow = await get("SELECT id FROM blog_posts WHERE slug=? AND language=?", [blog.slug, "en"]);
      await p.execute(
        `INSERT IGNORE INTO blog_posts (title, slug, language, related_blog_id, excerpt, content, status, author_id, author_role, published_at) VALUES (?,?,'ar',?,?,?,'published',?,?,?)`,
        [blog.title_ar, blog.slug + "-ar", enRow?.id || null, blog.excerpt_ar, blog.content_ar, author.id, "coach", now]
      );
    } catch {
    }
  }
  console.log("\u2705 Seeded 10 default blogs (EN + AR)");
}
async function initDatabase() {
  const MAX_RETRIES = 10;
  const RETRY_MS = 3e3;
  if (DB_AUTO_CREATE) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const rootPool = mysql.createPool({ ...getConnectionConfig(false), connectionLimit: 1 });
        const dbName = getDatabaseName();
        await rootPool.execute(
          `CREATE DATABASE IF NOT EXISTS ${escapeDbIdentifier(dbName)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
        );
        await rootPool.end();
        console.log(`\u2705 Database "${dbName}" ensured`);
        break;
      } catch (err) {
        const permDenied = err.code === "ER_DBACCESS_DENIED_ERROR" || err.code === "ER_ACCESS_DENIED_ERROR";
        if (permDenied) {
          console.warn("\u26A0\uFE0F  No CREATE DATABASE privilege; assuming DB already exists");
          break;
        }
        const retryable = err.code === "ECONNREFUSED" || err.code === "ETIMEDOUT" || err.code === "ENOTFOUND";
        if (!retryable || attempt === MAX_RETRIES) {
          console.error(`
\u274C Cannot connect to MySQL: ${err.message}`);
          console.error(`   Host: ${DB_HOST}  Port: ${DB_PORT}  User: ${DB_USER}`);
          console.error("   \u25BA Set DATABASE_URL in Railway Variables (or DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME for local dev)\n");
          process.exit(1);
        }
        console.warn(`\u26A0\uFE0F  MySQL not ready (attempt ${attempt}/${MAX_RETRIES}), retrying in ${RETRY_MS / 1e3}s\u2026`);
        await new Promise((r) => setTimeout(r, RETRY_MS));
      }
    }
  } else {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const conn = await getPool().getConnection();
        conn.release();
        console.log("\u2705 MySQL connection verified");
        break;
      } catch (err) {
        const retryable = err.code === "ECONNREFUSED" || err.code === "ETIMEDOUT" || err.code === "ENOTFOUND";
        if (!retryable || attempt === MAX_RETRIES) {
          console.error(`
\u274C Cannot connect to MySQL: ${err.message}`);
          console.error("   \u25BA Ensure DATABASE_URL (or MYSQL_URL) is set in Railway \u2192 Variables.\n");
          process.exit(1);
        }
        console.warn(`\u26A0\uFE0F  MySQL not ready (attempt ${attempt}/${MAX_RETRIES}), retrying in ${RETRY_MS / 1e3}s\u2026`);
        await new Promise((r) => setTimeout(r, RETRY_MS));
      }
    }
  }
  await initTables();
  await seedDefaultAccounts();
  try {
    await run("DELETE FROM revoked_tokens WHERE expires_at < NOW()");
  } catch {
  }
  await seedStandardTemplates();
  await seedDefaultWebsiteSections();
  await seedDefaultAppSettings();
  await seedDefaultBlogs();
  try {
    const { runAdsMigration: runAdsMigration2 } = await Promise.resolve().then(() => (init_ads_system(), ads_system_exports));
    await runAdsMigration2();
  } catch (e) {
    console.warn("\u26A0\uFE0F  Ads migration skipped:", e.message);
  }
  try {
    const { runAppImagesMigration: runAppImagesMigration2 } = await Promise.resolve().then(() => (init_app_images(), app_images_exports));
    await runAppImagesMigration2();
  } catch (e) {
    console.warn("\u26A0\uFE0F  App images migration skipped:", e.message);
  }
  try {
    await run("ALTER TABLE coach_profiles ADD COLUMN certified TINYINT(1) DEFAULT 0");
  } catch {
  }
  try {
    await run("ALTER TABLE coach_profiles ADD COLUMN certified_until DATETIME DEFAULT NULL");
  } catch {
  }
  try {
    await run("ALTER TABLE coach_subscriptions ADD COLUMN auto_renew TINYINT(1) DEFAULT 1");
  } catch {
  }
  console.log("\u{1F389} Database fully initialised");
}
var envResult, DATABASE_URL, DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_AUTO_CREATE, DB_SSL, DB_SSL_REJECT_UNAUTHORIZED, DB_SSL_CA, _pool, database_default;
var init_database = __esm({
  "server/config/database.ts"() {
    envResult = dotenv.config();
    if (envResult.error) {
      dotenv.config({ path: "env.txt" });
    }
    DATABASE_URL = process.env.DATABASE_URL || process.env.MYSQL_URL || "";
    DB_HOST = process.env.DB_HOST || process.env.MYSQL_HOST || process.env.MYSQLHOST || "localhost";
    DB_PORT = parseInt(
      process.env.DB_PORT || process.env.MYSQL_PORT || process.env.MYSQLPORT || "3306",
      10
    );
    DB_USER = process.env.DB_USER || process.env.MYSQL_USER || process.env.MYSQLUSER || "root";
    DB_PASSWORD = process.env.DB_PASSWORD || process.env.DB_PASS || process.env.MYSQL_PASSWORD || process.env.MYSQL_PASS || process.env.MYSQLPASSWORD || "";
    DB_NAME = process.env.DB_NAME || process.env.MYSQL_DATABASE || process.env.MYSQLDATABASE || process.env.DB_NAME || "fitwayhub";
    DB_AUTO_CREATE = process.env.DB_AUTO_CREATE ? process.env.DB_AUTO_CREATE !== "false" : !DATABASE_URL;
    DB_SSL = process.env.DB_SSL === "true";
    DB_SSL_REJECT_UNAUTHORIZED = process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false";
    DB_SSL_CA = loadCaCert();
    database_default = { query, run, get, getPool };
  }
});

// server/middleware/auth.ts
import jwt2 from "jsonwebtoken";
import { createHash as createHash2 } from "crypto";
function getDaysSince(dateInput) {
  if (!dateInput) return 0;
  const created = new Date(dateInput).getTime();
  if (Number.isNaN(created)) return 0;
  return Math.max(0, (Date.now() - created) / (1e3 * 60 * 60 * 24));
}
function getCoachMembershipPolicy(userRow) {
  const isCoach = userRow?.role === "coach";
  const membershipActive = !!(userRow?.coach_membership_active || userRow?.membership_paid);
  const daysSinceCreated = getDaysSince(userRow?.created_at);
  const isWithinGracePeriod = daysSinceCreated <= COACH_GRACE_DAYS;
  const graceDaysLeft = Math.max(0, Math.ceil(COACH_GRACE_DAYS - daysSinceCreated));
  return {
    isCoach,
    membershipActive,
    isWithinGracePeriod,
    graceDaysLeft,
    daysSinceCreated
  };
}
var COACH_GRACE_DAYS, authenticateToken, requireActiveCoachMembershipForDeals;
var init_auth = __esm({
  "server/middleware/auth.ts"() {
    init_database();
    COACH_GRACE_DAYS = 7;
    authenticateToken = async (req, res, next) => {
      const token = req.headers["authorization"]?.split(" ")[1];
      if (!token) return res.status(401).json({ message: "Access token required" });
      try {
        const secret = process.env.JWT_SECRET;
        if (!secret) return res.status(500).json({ message: "Server misconfiguration" });
        const decoded = jwt2.verify(token, secret, { algorithms: ["HS256"] });
        const JWT_ISS2 = "fitwayhub";
        const JWT_AUD_LOGIN2 = "fitwayhub:login";
        if (decoded.iss !== void 0 && decoded.iss !== JWT_ISS2) {
          return res.status(403).json({ message: "Invalid token issuer" });
        }
        if (decoded.aud !== void 0) {
          const auds = Array.isArray(decoded.aud) ? decoded.aud : [decoded.aud];
          if (!auds.includes(JWT_AUD_LOGIN2)) {
            return res.status(403).json({ message: "Token not valid for this resource" });
          }
        }
        const tokenHash = createHash2("sha256").update(token).digest("hex").slice(0, 32);
        let revoked = null;
        try {
          revoked = await get(
            "SELECT id FROM revoked_tokens WHERE token_hash = ? AND user_id = ?",
            [tokenHash, decoded.id]
          );
        } catch (dbErr) {
          console.error("Auth: revoked_tokens lookup failed (failing closed):", dbErr);
          return res.status(503).json({ message: "Authentication temporarily unavailable, please retry" });
        }
        if (revoked) return res.status(401).json({ message: "Token has been revoked. Please log in again." });
        const user = await get("SELECT role FROM users WHERE id = ?", [decoded.id]);
        req.user = { ...decoded, role: user?.role || "user" };
        next();
      } catch (err) {
        if (err?.name === "JsonWebTokenError" || err?.name === "TokenExpiredError") {
          return res.status(403).json({ message: "Invalid or expired token" });
        }
        console.error("Auth middleware error:", err);
        return res.status(500).json({ message: "Internal server error during authentication" });
      }
    };
    requireActiveCoachMembershipForDeals = async (req, res, next) => {
      try {
        if (req.user?.role === "admin") return next();
        if (req.user?.role !== "coach") return next();
        const userRow = await get(
          "SELECT role, coach_membership_active, membership_paid, created_at FROM users WHERE id = ?",
          [req.user.id]
        );
        if (!userRow) return res.status(404).json({ message: "User not found" });
        const policy = getCoachMembershipPolicy(userRow);
        if (policy.membershipActive) return next();
        return res.status(403).json({
          message: policy.isWithinGracePeriod ? `Your 7-day coach access period is active (${policy.graceDaysLeft} day(s) left), but deals are locked until membership payment is completed.` : "Coach membership payment is required to continue. Deal actions are locked until membership is activated.",
          code: "COACH_DEALS_LOCKED",
          graceDaysLeft: policy.graceDaysLeft,
          membershipActive: false
        });
      } catch {
        return res.status(500).json({ message: "Failed to validate coach membership status" });
      }
    };
  }
});

// server/middleware/upload.ts
var upload_exports = {};
__export(upload_exports, {
  default: () => upload_default,
  optimizeImage: () => optimizeImage,
  upload: () => upload,
  uploadAny: () => uploadAny,
  uploadAudio: () => uploadAudio,
  uploadFont: () => uploadFont,
  uploadToR2: () => uploadToR2,
  uploadVideo: () => uploadVideo,
  validateVideoSize: () => validateVideoSize,
  verifyUploadBytes: () => verifyUploadBytes
});
import multer from "multer";
import path2 from "path";
import sharp from "sharp";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { fileTypeFromBuffer } from "file-type";
async function uploadToR2(file, folder = "uploads") {
  const ext = path2.extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, "").toLowerCase() || ".bin";
  const safeFieldname = file.fieldname.replace(/[^a-zA-Z0-9_-]/g, "");
  const key = `${folder}/${safeFieldname}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype
  }));
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}
function isUnsafeImage(file) {
  const ext = path2.extname(file.originalname || "").toLowerCase();
  if (ext === ".svg" || ext === ".svgz") return true;
  const mt = String(file.mimetype || "").toLowerCase();
  if (mt === "image/svg+xml" || mt === "image/svg") return true;
  return false;
}
function optimizeImage(maxWidth = 1920, maxHeight = 1920, quality = 80) {
  return async (req, _res, next) => {
    try {
      const files = [];
      if (req.file) {
        files.push(req.file);
      }
      if (req.files) {
        if (Array.isArray(req.files)) {
          files.push(...req.files);
        } else {
          for (const fieldFiles of Object.values(req.files)) {
            files.push(...fieldFiles);
          }
        }
      }
      for (const file of files) {
        if (!file.mimetype.startsWith("image/")) continue;
        if (!file.buffer || file.buffer.length === 0) continue;
        const ext = path2.extname(file.originalname).toLowerCase();
        if (ext === ".svg" || ext === ".svgz" || file.mimetype === "image/svg+xml") {
          return next(new Error("SVG uploads are not allowed"));
        }
        if (ext === ".gif") {
          try {
            const meta = await sharp(file.buffer).metadata();
            if (meta.format !== "gif") return next(new Error("Invalid image: bytes do not match the declared format"));
          } catch {
            return next(new Error("Invalid image: failed to parse"));
          }
          continue;
        }
        const image = sharp(file.buffer);
        let metadata;
        try {
          metadata = await image.metadata();
        } catch {
          return next(new Error("Invalid image: failed to parse"));
        }
        const allowedFormats = /* @__PURE__ */ new Set(["jpeg", "png", "webp", "gif", "avif", "tiff", "heif"]);
        if (!metadata.format || !allowedFormats.has(metadata.format)) {
          return next(new Error("Invalid image: unsupported format"));
        }
        if (!metadata.width || !metadata.height) {
          return next(new Error("Invalid image: missing dimensions"));
        }
        let pipeline = sharp(file.buffer).rotate();
        if (metadata.width > maxWidth || metadata.height > maxHeight) {
          pipeline = pipeline.resize(maxWidth, maxHeight, {
            fit: "inside",
            withoutEnlargement: true
          });
        }
        const isPng = metadata.format === "png" || ext === ".png";
        let outputBuffer;
        if (isPng) {
          outputBuffer = await pipeline.png({ quality, compressionLevel: 8 }).toBuffer();
        } else {
          outputBuffer = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
          if (ext !== ".jpg" && ext !== ".jpeg") {
            file.originalname = file.originalname.replace(/\.[^.]+$/, ".jpg");
            file.mimetype = "image/jpeg";
          }
        }
        file.buffer = outputBuffer;
        file.size = outputBuffer.length;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
async function validateVideoSize(req, res, next) {
  try {
    let maxSizeMb = 40;
    try {
      const rows = await query("SELECT setting_value FROM app_settings WHERE setting_key = ?", ["max_video_upload_size_mb"]);
      if (rows && rows.length > 0) {
        maxSizeMb = parseInt(String(rows[0].setting_value), 10) || 40;
      }
    } catch (e) {
    }
    const maxSizeBytes = maxSizeMb * 1024 * 1024;
    const files = [];
    if (req.file) {
      files.push(req.file);
    }
    if (req.files) {
      if (Array.isArray(req.files)) {
        files.push(...req.files);
      } else {
        for (const fieldFiles of Object.values(req.files)) {
          files.push(...fieldFiles);
        }
      }
    }
    for (const file of files) {
      if (!file.mimetype.startsWith("video/")) continue;
      if (file.size > maxSizeBytes) {
        return res.status(413).json({
          message: `File too large. Maximum video size is ${maxSizeMb}MB, but file is ${(file.size / 1024 / 1024).toFixed(2)}MB`
        });
      }
      if (file.buffer && file.buffer.length > 0) {
        const sniffed = await fileTypeFromBuffer(file.buffer);
        if (!sniffed || !sniffed.mime.startsWith("video/")) {
          return res.status(400).json({
            message: "Invalid video: bytes do not match the declared content type"
          });
        }
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}
function verifyUploadBytes(kind) {
  const fontMimes = /* @__PURE__ */ new Set([
    "font/otf",
    "font/ttf",
    "font/woff",
    "font/woff2",
    "application/font-woff",
    "application/font-woff2",
    "application/vnd.ms-fontobject"
  ]);
  return async (req, res, next) => {
    try {
      const files = [];
      if (req.file) files.push(req.file);
      if (req.files) {
        if (Array.isArray(req.files)) {
          files.push(...req.files);
        } else {
          for (const ff of Object.values(req.files)) {
            files.push(...ff);
          }
        }
      }
      for (const file of files) {
        if (!file.buffer || file.buffer.length === 0) continue;
        const sniffed = await fileTypeFromBuffer(file.buffer);
        if (!sniffed) {
          return res.status(400).json({ message: `Invalid ${kind}: unrecognised file format` });
        }
        const ok = kind === "audio" ? sniffed.mime.startsWith("audio/") || sniffed.mime === "video/webm" || sniffed.mime === "application/ogg" : fontMimes.has(sniffed.mime);
        if (!ok) {
          return res.status(400).json({ message: `Invalid ${kind}: bytes do not match the declared content type` });
        }
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
var r2, storage, imageFilter, videoFilter, upload, uploadVideo, uploadAny, fontFilter, audioFilter, uploadFont, uploadAudio, upload_default;
var init_upload = __esm({
  "server/middleware/upload.ts"() {
    init_database();
    r2 = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || ""
      }
    });
    storage = multer.memoryStorage();
    imageFilter = (req, file, cb) => {
      if (isUnsafeImage(file)) return cb(new Error("SVG uploads are not allowed"), false);
      if (file.mimetype.startsWith("image/")) {
        cb(null, true);
      } else {
        cb(new Error("Only images are allowed"), false);
      }
    };
    videoFilter = (req, file, cb) => {
      if (isUnsafeImage(file)) return cb(new Error("SVG uploads are not allowed"), false);
      if (file.mimetype.startsWith("video/") || file.mimetype.startsWith("image/")) {
        cb(null, true);
      } else {
        cb(new Error("Only video or image files are allowed"), false);
      }
    };
    upload = multer({
      storage,
      fileFilter: imageFilter,
      limits: { fileSize: 5 * 1024 * 1024 }
    });
    uploadVideo = multer({
      storage,
      fileFilter: videoFilter,
      limits: { fileSize: 40 * 1024 * 1024 }
    });
    uploadAny = multer({
      storage,
      fileFilter: imageFilter,
      limits: { fileSize: 5 * 1024 * 1024 }
    });
    fontFilter = (req, file, cb) => {
      const ext = path2.extname(file.originalname).toLowerCase();
      const okExt = [".woff", ".woff2", ".ttf", ".otf"].includes(ext);
      const okMime = file.mimetype.startsWith("font/") || file.mimetype === "application/x-font-ttf" || file.mimetype === "application/x-font-opentype" || file.mimetype === "application/font-woff" || file.mimetype === "application/font-woff2" || file.mimetype === "application/vnd.ms-fontobject";
      if (okExt && okMime) {
        cb(null, true);
      } else {
        cb(new Error("Only font files (woff, woff2, ttf, otf) are allowed"), false);
      }
    };
    audioFilter = (req, file, cb) => {
      if (file.mimetype.startsWith("audio/") || file.mimetype === "application/ogg" || file.mimetype === "video/webm") {
        cb(null, true);
      } else {
        cb(new Error("Only audio files are allowed"), false);
      }
    };
    uploadFont = multer({
      storage,
      fileFilter: fontFilter,
      limits: { fileSize: 10 * 1024 * 1024 }
    });
    uploadAudio = multer({
      storage,
      fileFilter: audioFilter,
      limits: { fileSize: 10 * 1024 * 1024 }
    });
    upload_default = upload;
  }
});

// server/services/activityProfileService.ts
var activityProfileService_exports = {};
__export(activityProfileService_exports, {
  maybeSweepAllUsers: () => maybeSweepAllUsers,
  updateUserActivityProfile: () => updateUserActivityProfile
});
function deriveActivityLevel(avgSteps, workoutsPerWeek) {
  const score = avgSteps / 1e3 + workoutsPerWeek * 1.5;
  if (score >= 18) return "very_active";
  if (score >= 12) return "active";
  if (score >= 7) return "moderate";
  if (score >= 3) return "light";
  return "sedentary";
}
async function computeStreak(userId) {
  const rows = await query(
    `SELECT date FROM steps_entries WHERE user_id = ? AND steps > 0 ORDER BY date DESC LIMIT 60`,
    [userId]
  );
  if (!rows.length) return 0;
  let streak = 0;
  const today = /* @__PURE__ */ new Date();
  for (let i = 0; i < rows.length; i++) {
    const expected = new Date(today);
    expected.setDate(today.getDate() - i);
    if (rows[i].date === expected.toISOString().split("T")[0]) {
      streak++;
    } else break;
  }
  return streak;
}
async function updateUserActivityProfile(userId) {
  try {
    const avgRow = await get(
      `SELECT IFNULL(ROUND(AVG(steps)),0) as avg_steps
       FROM steps_entries
       WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)`,
      [userId]
    );
    const avgSteps = Number(avgRow?.avg_steps) || 0;
    let recentWorkouts = 0;
    try {
      const wRow = await get(
        `SELECT COUNT(*) as cnt FROM workout_watch_history
         WHERE user_id = ? AND watched_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
        [userId]
      );
      recentWorkouts = Number(wRow?.cnt) || 0;
    } catch {
    }
    const workoutsPerWeek = recentWorkouts / 4.3;
    const streak = await computeStreak(userId);
    const computedLevel = deriveActivityLevel(avgSteps, workoutsPerWeek);
    await run(
      `UPDATE users SET
         computed_activity_level = ?,
         avg_daily_steps = ?,
         streak_days = ?,
         last_activity_update = NOW()
       WHERE id = ?`,
      [computedLevel, avgSteps, streak, userId]
    );
  } catch (err) {
    console.warn("updateUserActivityProfile error:", err.message);
  }
}
async function maybeSweepAllUsers() {
  const now = Date.now();
  if (now - lastSweepMs < 60 * 60 * 1e3) return;
  lastSweepMs = now;
  try {
    const active = await query(
      `SELECT DISTINCT user_id FROM steps_entries WHERE date >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)`
    );
    for (const row of active) {
      await updateUserActivityProfile(row.user_id);
    }
  } catch {
  }
}
var lastSweepMs;
var init_activityProfileService = __esm({
  "server/services/activityProfileService.ts"() {
    init_database();
    lastSweepMs = 0;
  }
});

// server/services/adBillingService.ts
var adBillingService_exports = {};
__export(adBillingService_exports, {
  billClick: () => billClick,
  billImpression: () => billImpression,
  expireAndResetAds: () => expireAndResetAds
});
async function billImpression(adId) {
  try {
    const ad = await get(
      `SELECT a.paid_amount, a.amount_spent, a.daily_budget, a.total_budget, a.budget_type,
              a.impressions, a.clicks, a.status, a.schedule_start, a.schedule_end
       FROM coach_ads a WHERE a.id = ?`,
      [adId]
    );
    if (!ad || ad.status !== "active") return;
    const budget = ad.budget_type === "daily" ? ad.daily_budget : ad.total_budget;
    const paidBudget = parseFloat(ad.paid_amount) || parseFloat(budget) || 0;
    const costPerImpression = paidBudget > 0 ? Math.max(MIN_CPM, paidBudget / Math.max(1, ad.impressions + 1e3) * (1e3 / 1e3)) : MIN_CPM;
    const newSpent = parseFloat(ad.amount_spent || "0") + costPerImpression;
    const effectiveBudget = paidBudget || parseFloat(budget) || 999999;
    const ctr = ad.impressions > 0 ? ad.clicks / ad.impressions : 0;
    const cpm = ad.impressions > 0 ? parseFloat(ad.amount_spent || "0") / ad.impressions * 1e3 : 0;
    if (newSpent >= effectiveBudget) {
      await run(
        `UPDATE coach_ads SET amount_spent = ?, status = 'paused', ctr = ?, cpm = ? WHERE id = ?`,
        [effectiveBudget, ctr, cpm, adId]
      );
    } else {
      await run(
        `UPDATE coach_ads SET amount_spent = ?, ctr = ?, cpm = ? WHERE id = ?`,
        [newSpent, ctr, cpm, adId]
      );
    }
  } catch (err) {
    console.warn("billImpression error:", err.message);
  }
}
async function billClick(adId) {
  try {
    const ad = await get(
      `SELECT paid_amount, amount_spent, daily_budget, total_budget, budget_type,
              impressions, clicks, reach, status
       FROM coach_ads WHERE id = ?`,
      [adId]
    );
    if (!ad || ad.status !== "active") return;
    const budget = ad.budget_type === "daily" ? ad.daily_budget : ad.total_budget;
    const paidBudget = parseFloat(ad.paid_amount) || parseFloat(budget) || 0;
    const costPerClick = paidBudget > 0 ? Math.max(0.05, paidBudget / Math.max(1, ad.clicks + 100)) : 0.05;
    const newSpent = parseFloat(ad.amount_spent || "0") + costPerClick;
    const effectiveBudget = paidBudget || 999999;
    const newReach = Math.min((ad.reach || 0) + Math.ceil(Math.random() * 3 + 1), ad.impressions || 0);
    const ctr = ad.impressions > 0 ? ad.clicks / ad.impressions : 0;
    if (newSpent >= effectiveBudget) {
      await run(
        `UPDATE coach_ads SET amount_spent = ?, reach = ?, ctr = ?, status = 'paused' WHERE id = ?`,
        [effectiveBudget, newReach, ctr, adId]
      );
    } else {
      await run(
        `UPDATE coach_ads SET amount_spent = ?, reach = ?, ctr = ? WHERE id = ?`,
        [newSpent, newReach, ctr, adId]
      );
    }
  } catch (err) {
    console.warn("billClick error:", err.message);
  }
}
async function expireAndResetAds() {
  try {
    await run(
      `UPDATE coach_ads
       SET status = 'expired'
       WHERE status IN ('active','paused')
         AND schedule_end IS NOT NULL
         AND schedule_end < CURDATE()
         AND paid_amount > 0`
    );
    await run(
      `UPDATE coach_ads SET status = 'expired'
       WHERE status = 'active' AND boost_end IS NOT NULL AND boost_end < NOW()
         AND (schedule_end IS NULL OR schedule_end < CURDATE())`
    );
    await run(
      `UPDATE coach_ads
       SET amount_spent = 0, status = 'active'
       WHERE budget_type = 'daily'
         AND status = 'paused'
         AND paid_amount > 0
         AND payment_status = 'approved'
         AND schedule_start <= CURDATE()
         AND (schedule_end IS NULL OR schedule_end >= CURDATE())
         AND DATE(updated_at) < CURDATE()`
    );
  } catch (err) {
    console.warn("expireAndResetAds error:", err.message);
  }
}
var MIN_CPM;
var init_adBillingService = __esm({
  "server/services/adBillingService.ts"() {
    init_database();
    MIN_CPM = 0.01;
  }
});

// server/routes/adsManagerRoutes.ts
var adsManagerRoutes_exports = {};
__export(adsManagerRoutes_exports, {
  default: () => adsManagerRoutes_default
});
import { Router as Router23 } from "express";
var router26, adminOrMod2, coachOrAdmin4, adsManagerRoutes_default;
var init_adsManagerRoutes = __esm({
  "server/routes/adsManagerRoutes.ts"() {
    init_auth();
    init_database();
    router26 = Router23();
    adminOrMod2 = (req, res, next) => {
      if (!["admin", "moderator"].includes(req.user?.role)) return res.status(403).json({ message: "Admin or moderator access required" });
      next();
    };
    coachOrAdmin4 = (req, res, next) => {
      if (!["coach", "admin", "moderator"].includes(req.user?.role)) return res.status(403).json({ message: "Coach or admin access required" });
      next();
    };
    router26.get("/overview", authenticateToken, adminOrMod2, async (_req, res) => {
      try {
        const [campaigns] = await query(`SELECT COUNT(*) AS total, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active FROM ad_campaigns`);
        const [pending] = await query("SELECT COUNT(*) AS total FROM ad_moderation_reviews WHERE status='pending'");
        let eventsToday = 0;
        try {
          const [r] = await query("SELECT COUNT(*) AS total FROM ad_events WHERE DATE(recorded_at)=CURDATE()");
          eventsToday = r?.total || 0;
        } catch {
        }
        let spendToday = 0;
        try {
          const [r] = await query(`SELECT COALESCE(SUM(amount),0) AS total FROM ad_wallet_ledger WHERE entry_type='debit' AND DATE(created_at)=CURDATE()`);
          spendToday = r?.total || 0;
        } catch {
        }
        res.json({ campaigns: campaigns?.total || 0, active: campaigns?.active || 0, pending: pending?.total || 0, events_today: eventsToday, spend_today: spendToday });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });
    router26.get("/campaigns", authenticateToken, coachOrAdmin4, async (req, res) => {
      try {
        const status = req.query.status || null;
        const coachId = req.query.coach_id || null;
        const params = [];
        let where = [];
        if (status) {
          where.push("c.status = ?");
          params.push(status);
        }
        if (coachId) {
          where.push("c.coach_id = ?");
          params.push(coachId);
        }
        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
        const campaigns = await query(
          `SELECT c.*, u.name AS coach_name, COUNT(s.id) AS ad_set_count, COALESCE(SUM(a.impressions),0) AS impressions, COALESCE(SUM(a.clicks),0) AS clicks
       FROM ad_campaigns c
       LEFT JOIN users u ON u.id = c.coach_id
       LEFT JOIN ad_sets s ON s.campaign_id = c.id
       LEFT JOIN ads a ON a.ad_set_id = s.id
       ${whereSql}
       GROUP BY c.id ORDER BY c.created_at DESC`,
          params
        );
        res.json({ campaigns });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });
    router26.post("/campaigns", authenticateToken, coachOrAdmin4, async (req, res) => {
      try {
        const { name, objective, daily_budget, lifetime_budget, budget_type, schedule_start, schedule_end } = req.body;
        if (!name) return res.status(400).json({ message: "name required" });
        const result = await run(
          `INSERT INTO ad_campaigns (coach_id, name, objective, daily_budget, lifetime_budget, budget_type, schedule_start, schedule_end, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [req.user.id, name, objective || "coaching", daily_budget || 0, lifetime_budget || 0, budget_type || "daily", schedule_start || null, schedule_end || null, "pending_review"]
        );
        const campaign = await get("SELECT * FROM ad_campaigns WHERE id = ?", [result.insertId]);
        await run(`INSERT INTO ad_moderation_reviews (campaign_id, status, created_at) VALUES (?, 'pending', NOW())`, [result.insertId]);
        await run(`INSERT INTO ad_audit_logs (actor_id, actor_role, action, entity_type, entity_id, new_state) VALUES (?, ?, 'create', 'campaign', ?, ?)`, [req.user.id, req.user.role, result.insertId, JSON.stringify(campaign)]);
        res.status(201).json({ campaign });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });
    router26.put("/campaigns/:id", authenticateToken, coachOrAdmin4, async (req, res) => {
      try {
        const existing = await get("SELECT * FROM ad_campaigns WHERE id = ?", [req.params.id]);
        if (!existing) return res.status(404).json({ message: "Campaign not found" });
        if (req.user.role !== "admin" && existing.coach_id !== req.user.id) return res.status(403).json({ message: "Not your campaign" });
        const fields = ["name", "objective", "daily_budget", "lifetime_budget", "budget_type", "schedule_start", "schedule_end", "status"];
        const updates = fields.filter((f) => req.body[f] !== void 0).map((f) => `${f}=?`);
        const vals = fields.filter((f) => req.body[f] !== void 0).map((f) => req.body[f]);
        if (!updates.length) return res.status(400).json({ message: "Nothing to update" });
        await run(`UPDATE ad_campaigns SET ${updates.join(",")}, updated_at=NOW() WHERE id = ?`, [...vals, req.params.id]);
        const updated = await get("SELECT * FROM ad_campaigns WHERE id = ?", [req.params.id]);
        await run(`INSERT INTO ad_audit_logs (actor_id, actor_role, action, entity_type, entity_id, old_state, new_state) VALUES (?, ?, 'update', 'campaign', ?, ?, ?)`, [req.user.id, req.user.role, req.params.id, JSON.stringify(existing), JSON.stringify(updated)]);
        res.json({ campaign: updated });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });
    router26.get("/ads", authenticateToken, coachOrAdmin4, async (req, res) => {
      try {
        const isAdmin = req.user.role === "admin";
        const where = isAdmin ? "" : "WHERE c.coach_id = ?";
        const params = isAdmin ? [] : [req.user.id];
        const ads = await query(
          `SELECT a.*, ac.media_url, ac.format, s.name AS ad_set_name, c.name AS campaign_name
       FROM ads a
       JOIN ad_sets s ON s.id = a.ad_set_id
       JOIN ad_campaigns c ON c.id = s.campaign_id
       LEFT JOIN ad_creatives ac ON ac.id = a.creative_id
       ${where}
       ORDER BY a.created_at DESC`,
          params
        );
        res.json({ ads });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });
    router26.patch("/campaigns/:id/action", authenticateToken, adminOrMod2, async (req, res) => {
      try {
        const { action, note } = req.body;
        const valid = ["approve", "pause", "resume", "reject", "archive"];
        if (!valid.includes(action)) return res.status(400).json({ message: `action must be one of: ${valid.join(", ")}` });
        const campaign = await get("SELECT * FROM ad_campaigns WHERE id = ?", [req.params.id]);
        if (!campaign) return res.status(404).json({ message: "Campaign not found" });
        const newStatus = action === "approve" ? "active" : action === "pause" ? "paused" : action === "resume" ? "active" : action === "reject" ? "rejected" : "archived";
        await run("UPDATE ad_campaigns SET status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW() WHERE id = ?", [newStatus, note || null, req.user.id, req.params.id]);
        if (action === "reject" && campaign.coach_id) {
          const reason = note ? `: ${note}` : "";
          await run(
            "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
            [campaign.coach_id, "ad_rejected", "\u274C Campaign Rejected", `Your campaign "${campaign.name || "Untitled"}" has been rejected${reason}`, "/coach/ads/my-ads"]
          );
        }
        await run(
          `INSERT INTO ad_audit_logs (actor_id, actor_role, action, entity_type, entity_id, old_state, new_state) VALUES (?, ?, ?, 'campaign', ?, ?, ?)`,
          [req.user.id, req.user.role, `manager.${action}`, req.params.id, JSON.stringify({ status: campaign.status }), JSON.stringify({ status: newStatus, note })]
        );
        const updated = await get("SELECT * FROM ad_campaigns WHERE id = ?", [req.params.id]);
        res.json({ campaign: updated });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });
    router26.get("/audit", authenticateToken, adminOrMod2, async (req, res) => {
      try {
        const page = Math.max(1, Math.min(1e4, parseInt(req.query.page) || 1));
        const limit = 50;
        const offset = (page - 1) * limit;
        const logs = await query(
          `SELECT l.*, u.name AS actor_name
         FROM ad_audit_logs l
         LEFT JOIN users u ON u.id = COALESCE(l.actor_id, l.user_id)
        ORDER BY l.created_at DESC
        LIMIT ? OFFSET ?`,
          [limit, offset]
        );
        res.json({ logs, page, limit });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });
    adsManagerRoutes_default = router26;
  }
});

// server.ts
import express4 from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit3 from "express-rate-limit";
import dotenv2 from "dotenv";
import path4 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";

// server/routes/authRoutes.ts
import { Router } from "express";
import rateLimit from "express-rate-limit";

// server/controllers/authController.ts
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID, createHash } from "crypto";
import { resolve4, resolve6, resolveMx } from "dns/promises";

// server/models/User.ts
init_database();
var UserModel = {
  create: async (email, passwordHash) => {
    const { insertId } = await run("INSERT INTO users (email, password, is_premium) VALUES (?, ?, 0)", [email, passwordHash]);
    return { id: insertId, email, created_at: (/* @__PURE__ */ new Date()).toISOString() };
  },
  findByEmail: async (email) => get("SELECT * FROM users WHERE email = ?", [email]),
  findByUsername: async (username) => get("SELECT * FROM users WHERE email = ? OR name = ?", [username, username]),
  findById: async (id) => get("SELECT * FROM users WHERE id = ?", [id]),
  findByResetToken: async (token) => get("SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > ?", [token, Date.now()]),
  findByRememberToken: async (token) => get("SELECT * FROM users WHERE remember_token = ?", [token]),
  setResetToken: async (userId, token, expiresIn = 36e5) => run("UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?", [token, Date.now() + expiresIn, userId]),
  setRememberToken: async (userId, token) => run("UPDATE users SET remember_token = ? WHERE id = ?", [token, userId]),
  updatePassword: async (userId, hashedPassword) => run("UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?", [hashedPassword, userId]),
  updatePremium: async (userId, isPremium) => {
    const u = await get("SELECT role FROM users WHERE id = ?", [userId]);
    if (!u) return null;
    if (u.role !== "user") return null;
    return run("UPDATE users SET is_premium = ? WHERE id = ?", [isPremium ? 1 : 0, userId]);
  },
  updateProfile: async (userId, fields) => {
    const updates = [];
    const params = [];
    if (fields.height !== void 0) {
      updates.push("height = ?");
      params.push(fields.height);
    }
    if (fields.weight !== void 0) {
      updates.push("weight = ?");
      params.push(fields.weight);
    }
    if (fields.gender !== void 0) {
      updates.push("gender = ?");
      params.push(fields.gender);
    }
    if (fields.name !== void 0) {
      updates.push("name = ?");
      params.push(fields.name);
    }
    if (fields.avatar !== void 0) {
      updates.push("avatar = ?");
      params.push(fields.avatar);
    }
    if (updates.length === 0) return null;
    params.push(userId);
    return run(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);
  },
  setSecurityQuestion: async (userId, question, answerHash) => run("UPDATE users SET security_question = ?, security_answer = ? WHERE id = ?", [question, answerHash, userId]),
  addOfflineSteps: async (userId, steps) => run("UPDATE users SET offline_steps = offline_steps + ?, last_sync = NOW() WHERE id = ?", [steps, userId])
};

// server/controllers/authController.ts
init_database();

// server/notificationService.ts
init_database();

// server/emailServer.ts
init_database();
import { SMTPServer } from "smtp-server";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
var smtpInstance = null;
function getMailDomain() {
  const base = process.env.APP_BASE_URL || "";
  try {
    const u = new URL(base);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "localhost";
  }
}
async function getSmtpSettings() {
  return get("SELECT * FROM email_settings WHERE id = 1");
}
async function saveSmtpSettings(s) {
  const current = await getSmtpSettings();
  if (!current) {
    await run("INSERT INTO email_settings (id) VALUES (1)");
  }
  const fields = [];
  const values = [];
  for (const [k, v] of Object.entries(s)) {
    if (["smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_secure", "from_name", "from_email", "enabled"].includes(k)) {
      fields.push(`${k} = ?`);
      values.push(v);
    }
  }
  if (fields.length === 0) return;
  await run(`UPDATE email_settings SET ${fields.join(", ")} WHERE id = 1`, values);
}
function createTransporter(settings) {
  const secure = settings.smtp_secure === "tls";
  return nodemailer.createTransport({
    host: settings.smtp_host,
    port: settings.smtp_port,
    secure,
    auth: settings.smtp_user ? { user: settings.smtp_user, pass: settings.smtp_pass } : void 0,
    tls: { rejectUnauthorized: false }
  });
}
async function testSmtpConnection() {
  const settings = await getSmtpSettings();
  if (!settings || !settings.smtp_host) {
    return { ok: false, message: "SMTP not configured. Please fill in SMTP settings first." };
  }
  try {
    const transporter = createTransporter(settings);
    await transporter.verify();
    return { ok: true, message: "SMTP connection successful!" };
  } catch (err) {
    return { ok: false, message: `Connection failed: ${err.message}` };
  }
}
async function sendMail(opts) {
  const settings = await getSmtpSettings();
  if (!settings || !settings.smtp_host) {
    throw new Error("Email sending is not configured. Go to Admin \u2192 Email Server \u2192 SMTP Settings to set up your SMTP relay.");
  }
  if (!settings.enabled) {
    throw new Error("Email sending is disabled. Enable it in Admin \u2192 Email Server \u2192 SMTP Settings.");
  }
  const account = await get("SELECT * FROM email_accounts WHERE id = ?", [opts.fromAccountId]);
  if (!account) throw new Error("Email account not found");
  const transporter = createTransporter(settings);
  const envelopeFrom = settings.from_email || settings.smtp_user;
  const envelopeName = settings.from_name || account.display_name || "FitWay Hub";
  const info = await transporter.sendMail({
    from: `${envelopeName} <${envelopeFrom}>`,
    replyTo: `${account.display_name} <${account.email}>`,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html
  });
  await run(
    `INSERT INTO emails (account_id, sender, recipient, subject, text_body, html_body, direction, message_id)
     VALUES (?, ?, ?, ?, ?, ?, 'outbound', ?)`,
    [opts.fromAccountId, account.email, opts.to, opts.subject, opts.text || "", opts.html || "", info.messageId || ""]
  );
  return info;
}
async function sendSystemEmail(opts) {
  const settings = await getSmtpSettings();
  if (!settings || !settings.smtp_host || !settings.enabled) return false;
  try {
    const transporter = createTransporter(settings);
    const fromAddr = settings.from_email || settings.smtp_user;
    const fromName = settings.from_name || "FitWay Hub";
    await transporter.sendMail({
      from: `${fromName} <${fromAddr}>`,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html
    });
    return true;
  } catch (err) {
    console.error("System email send error:", err);
    return false;
  }
}
function startSmtpServer(port = 2525) {
  if (smtpInstance) return;
  const domain = getMailDomain();
  smtpInstance = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS"],
    name: domain,
    banner: `${domain} SMTP`,
    size: 10 * 1024 * 1024,
    async onData(stream, session, callback) {
      try {
        const parsed = await simpleParser(stream);
        const from = parsed.from?.text || "";
        const toList = parsed.to ? Array.isArray(parsed.to) ? parsed.to : [parsed.to] : [];
        const subject = parsed.subject || "(no subject)";
        const textBody = parsed.text || "";
        const htmlBody = parsed.html || "";
        for (const addr of toList) {
          const addresses = addr.value || [];
          for (const a of addresses) {
            const email = (a.address || "").toLowerCase();
            const acct = await get("SELECT id FROM email_accounts WHERE email = ?", [email]);
            if (acct) {
              await run(
                `INSERT INTO emails (account_id, sender, recipient, subject, text_body, html_body, direction)
                 VALUES (?, ?, ?, ?, ?, ?, 'inbound')`,
                [acct.id, from, email, subject, textBody, htmlBody]
              );
            }
          }
        }
        callback();
      } catch (err) {
        console.error("SMTP onData error:", err);
        callback(new Error("Processing failed"));
      }
    },
    onError(err) {
      console.error("SMTP server error:", err);
    }
  });
  smtpInstance.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`\u26A0\uFE0F  SMTP port ${port} already in use \u2014 skipping SMTP server`);
    } else {
      console.error("SMTP server error:", err);
    }
  });
  smtpInstance.listen(port, "0.0.0.0", () => {
    console.log(`\u{1F4E7}  SMTP server listening on port ${port} (domain: ${domain})`);
  });
}

// server/notificationService.ts
function replaceTokens(text, vars) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}
var _fcmTokenCache = null;
async function getFcmAccessToken() {
  if (_fcmTokenCache && Date.now() < _fcmTokenCache.exp) return _fcmTokenCache.token;
  let sa = null;
  try {
    if (process.env.FCM_SERVICE_ACCOUNT_JSON) {
      sa = JSON.parse(process.env.FCM_SERVICE_ACCOUNT_JSON);
    } else if (process.env.FCM_SERVICE_ACCOUNT_PATH) {
      const fs3 = await import("fs");
      sa = JSON.parse(fs3.readFileSync(process.env.FCM_SERVICE_ACCOUNT_PATH, "utf-8"));
    }
  } catch (err) {
    console.error("FCM: failed to load service account:", err);
    return null;
  }
  if (!sa?.private_key || !sa?.client_email) return null;
  try {
    const jwt3 = await import("jsonwebtoken");
    const now = Math.floor(Date.now() / 1e3);
    const assertion = jwt3.default.sign(
      {
        iss: sa.client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600
      },
      sa.private_key,
      { algorithm: "RS256" }
    );
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion
      })
    });
    const data = await resp.json();
    if (!data.access_token) {
      console.error("FCM token exchange failed:", data);
      return null;
    }
    _fcmTokenCache = { token: data.access_token, exp: Date.now() + 50 * 60 * 1e3 };
    return data.access_token;
  } catch (err) {
    console.error("FCM access token error:", err);
    return null;
  }
}
async function sendFcmPush(fcmToken, title, body, link = "/", type = "info") {
  const projectId = process.env.FCM_PROJECT_ID || "fitwayhubpn";
  const accessToken = await getFcmAccessToken();
  if (!accessToken) {
    console.warn("FCM: no access token \u2014 service account not configured");
    return false;
  }
  try {
    const resp = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          message: {
            token: fcmToken,
            notification: { title, body },
            data: { title, body, link: link || "/", type: type || "info" },
            webpush: {
              notification: {
                title,
                body,
                icon: "/logo.svg",
                badge: "/logo.svg",
                requireInteraction: false
              },
              fcmOptions: { link: link || "/" }
            }
          }
        })
      }
    );
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      console.error("FCM send failed:", err);
    }
    return resp.ok;
  } catch (err) {
    console.error("FCM send error:", err);
    return false;
  }
}
async function registerPushToken(userId, token, platform = "android") {
  await run(
    `INSERT INTO push_tokens (user_id, token, platform) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE token = VALUES(token), updated_at = NOW()`,
    [userId, token, platform]
  );
}
async function removePushToken(userId, platform = "android") {
  await run("DELETE FROM push_tokens WHERE user_id = ? AND platform = ?", [userId, platform]);
}
function linkForTemplate(slug) {
  switch (slug) {
    // Inactivity tiers — short tiers should land on the workout list so the
    // user can immediately resume; longer tiers land on the dashboard.
    case "inactive_1_day":
    case "inactive_3_days":
      return "/app/workouts";
    case "inactive_7_days":
    case "inactive_14_days":
      return "/app/dashboard";
    // Workouts / training prompts
    case "missed_workout":
    case "workout_reminder":
    case "workout_plan_assigned":
    case "workout_day_reminder":
    case "workout_completed":
    case "new_workout_unlocked":
    case "new_exercise_added":
    case "morning_reminder":
    case "evening_reminder":
    case "program_completed":
      return "/app/workouts";
    // Nutrition
    case "meal_plan_updated":
      return "/app/plans";
    // Direct messaging
    case "new_message":
    case "coach_message":
      return "/app/chat";
    // Community / social / challenges
    case "post_liked":
    case "post_commented":
    case "new_follower":
    case "friend_joined":
    case "new_challenge":
    case "challenge_completed":
      return "/app/community";
    // Progress / achievements / streaks
    case "progress_milestone":
    case "goal_achieved":
    case "weight_logged":
    case "personal_best":
    case "monthly_summary":
    case "streak_3_days":
    case "streak_7_days":
    case "streak_about_to_break":
      return "/app/analytics";
    // Onboarding
    case "user_register":
    case "profile_complete":
      return "/app/onboarding";
    case "coach_register":
      return "/coach/profile";
    case "coach_review":
      return "/app/dashboard";
    case "new_feature":
      return "/app/dashboard";
    // Coaching lifecycle
    case "coaching_request":
    case "coaching_accepted":
    case "coaching_rejected":
    case "coaching_disband":
    case "booking_accepted":
    case "booking_rejected":
    case "subscription_verified_user":
    case "subscription_coach_accepted":
    case "subscription_coach_declined":
    case "subscription_rejected":
      return "/app/coaching";
    // Coach-side wallet / payments / certification
    case "subscription_verified":
    case "payment_received":
    case "payment_approved":
    case "payment_rejected":
    case "payment_failed":
    case "withdrawal_approved":
    case "withdrawal_rejected":
    case "certification":
    case "video_review":
      return "/coach/profile";
    // Ads
    case "ad_approved":
    case "ad_rejected":
    case "ad_paused":
    case "ad_flagged":
    case "ad_needs_changes":
      return "/coach/ads/my-ads";
    case "welcome":
      return "/app/dashboard";
    default:
      return "/";
  }
}
async function sendPushToUser(userId, title, body, templateId, link = "/", type = "info") {
  const tokens = await query("SELECT token FROM push_tokens WHERE user_id = ?", [userId]);
  if (!tokens.length) {
    try {
      await createInAppNotification(userId, type, title, body, link);
    } catch {
    }
    return false;
  }
  let anySuccess = false;
  for (const t of tokens) {
    const ok = await sendFcmPush(t.token, title, body, link, type);
    await run(
      "INSERT INTO push_log (user_id, template_id, title, body, status, error_message) VALUES (?,?,?,?,?,?)",
      [userId, templateId || null, title, body, ok ? "sent" : "failed", ok ? null : "FCM delivery failed"]
    );
    if (ok) anySuccess = true;
  }
  try {
    await createInAppNotification(userId, type, title, body, link);
  } catch {
  }
  return anySuccess;
}
async function sendPushFromTemplate(userId, slug, vars = {}, link, type) {
  const tpl = await get("SELECT * FROM push_templates WHERE slug = ? AND enabled = 1", [slug]);
  if (!tpl) return false;
  const title = replaceTokens(tpl.title, vars);
  const body = replaceTokens(tpl.body, vars);
  const resolvedLink = link || linkForTemplate(slug);
  const resolvedType = type || slug;
  return sendPushToUser(userId, title, body, tpl.id, resolvedLink, resolvedType);
}
async function sendPushToSegment(title, body, segment = "all", templateId, link = "/", type = "info") {
  let sql = "SELECT DISTINCT pt.user_id, pt.token, u.name FROM push_tokens pt JOIN users u ON u.id = pt.user_id";
  if (segment === "users") sql += " WHERE u.role = 'user'";
  else if (segment === "coaches") sql += " WHERE u.role = 'coach'";
  else if (segment === "inactive") sql += " WHERE u.last_active < DATE_SUB(NOW(), INTERVAL 7 DAY)";
  const rows = await query(sql);
  let sent = 0, failed = 0;
  for (const r of rows) {
    const vars = { first_name: (r.name || "").split(" ")[0] };
    const t = replaceTokens(title, vars);
    const b = replaceTokens(body, vars);
    const ok = await sendFcmPush(r.token, t, b, link, type);
    await run(
      "INSERT INTO push_log (user_id, template_id, title, body, status) VALUES (?,?,?,?,?)",
      [r.user_id, templateId || null, t, b, ok ? "sent" : "failed"]
    );
    try {
      await createInAppNotification(r.user_id, type, t, b, link);
    } catch {
    }
    if (ok) sent++;
    else failed++;
  }
  return { sent, failed, total: rows.length };
}
async function createInAppNotification(userId, type, title, body, link) {
  await run(
    "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
    [userId, type, title, body, link || null]
  );
}
async function runScheduledPushes() {
  const tiers = [
    { days: 1, maxDays: 3, slug: "inactive_1_day" },
    { days: 3, maxDays: 7, slug: "inactive_3_days" },
    { days: 7, maxDays: 14, slug: "inactive_7_days" },
    { days: 14, maxDays: 60, slug: "inactive_14_days" }
  ];
  for (const tier of tiers) {
    try {
      const users = await query(
        `SELECT DISTINCT pt.user_id, u.name
         FROM push_tokens pt
         JOIN users u ON u.id = pt.user_id
         WHERE u.role = 'user'
           AND u.last_active < DATE_SUB(NOW(), INTERVAL ? DAY)
           AND u.last_active >= DATE_SUB(NOW(), INTERVAL ? DAY)
           AND pt.user_id NOT IN (
             SELECT pl.user_id FROM push_log pl
             JOIN push_templates t ON t.id = pl.template_id
             WHERE t.slug = ? AND pl.created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
           )
         LIMIT 100`,
        [tier.days, tier.maxDays, tier.slug]
      );
      for (const user of users) {
        const firstName = (user.name || "").split(" ")[0] || "there";
        await sendPushFromTemplate(user.user_id, tier.slug, { first_name: firstName });
      }
      if (users.length) console.log(`[Push] Sent ${tier.slug} to ${users.length} users`);
    } catch (err) {
      console.error(`[Push] Error processing ${tier.slug}:`, err);
    }
  }
}
async function sendWelcomeMessages(userId, role, name, email) {
  const firstName = (name || email.split("@")[0]).split(" ")[0];
  const appUrl = (process.env.APP_BASE_URL || "https://localhost").replace(/\/+$/, "");
  const vars = { first_name: firstName, app_url: appUrl };
  const target = role === "coach" ? "coach" : "user";
  const msgs = await query("SELECT * FROM welcome_messages WHERE target = ? AND enabled = 1", [target]);
  for (const msg of msgs) {
    const title = replaceTokens(msg.title, vars);
    const body = replaceTokens(msg.body, vars);
    if (msg.channel === "push") {
      await sendPushToUser(userId, title, body);
    } else if (msg.channel === "in_app") {
      await createInAppNotification(userId, "welcome", title, body, role === "coach" ? "/coach/profile" : "/app/onboarding");
    } else if (msg.channel === "email") {
      try {
        const smtpSettings = await getSmtpSettings();
        if (smtpSettings?.enabled && smtpSettings?.smtp_host) {
          const subject = replaceTokens(msg.subject, vars);
          const htmlBody = msg.html_body ? replaceTokens(msg.html_body, vars) : void 0;
          const textBody = replaceTokens(msg.body, vars);
          const accounts = await query("SELECT id FROM email_accounts LIMIT 1");
          if (accounts.length > 0) {
            await sendMail({
              fromAccountId: accounts[0].id,
              to: email,
              subject,
              text: textBody,
              html: htmlBody
            });
          } else {
            await sendSystemEmail({ to: email, subject, text: textBody, html: htmlBody });
          }
        }
      } catch (err) {
        console.error("Welcome email send error:", err);
      }
    }
  }
}

// server/controllers/authController.ts
var DISPOSABLE_OR_FAKE_DOMAINS = /* @__PURE__ */ new Set([
  "example.com",
  "example.org",
  "example.net",
  "mailinator.com",
  "tempmail.com",
  "10minutemail.com",
  "guerrillamail.com"
]);
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is required");
  return secret;
}
function normalizeEmail(input) {
  return String(input || "").trim().toLowerCase();
}
async function hasMailCapableDomain(email) {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain || DISPOSABLE_OR_FAKE_DOMAINS.has(domain)) return false;
  try {
    const mx = await resolveMx(domain);
    if (mx && mx.length > 0) return true;
  } catch (err) {
    if (["ENOTFOUND", "ENODATA", "ENOTIMP", "SERVFAIL"].includes(err?.code)) {
      return false;
    }
  }
  try {
    const [a4, a6] = await Promise.allSettled([resolve4(domain), resolve6(domain)]);
    const hasA4 = a4.status === "fulfilled" && a4.value.length > 0;
    const hasA6 = a6.status === "fulfilled" && a6.value.length > 0;
    return hasA4 || hasA6;
  } catch {
    return false;
  }
}
var FALLBACK_BASE_HOSTS = /* @__PURE__ */ new Set([
  "localhost",
  "127.0.0.1",
  "peter-adel.taila6a2b4.ts.net"
]);
function getAppBaseUrl(req) {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  const host = String(req.get("host") || "").split(":")[0].toLowerCase();
  if (FALLBACK_BASE_HOSTS.has(host)) {
    return `${req.protocol}://${req.get("host")}`;
  }
  return "http://localhost";
}
function getMobileAppBaseUrl() {
  const scheme = String(process.env.MOBILE_APP_SCHEME || "fitwayhub").trim().toLowerCase();
  return `${scheme}://auth`;
}
var JWT_ISS = "fitwayhub";
var JWT_AUD_LOGIN = "fitwayhub:login";
var JWT_AUD_OAUTH = "fitwayhub:oauth-state";
function issueLoginToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    getJwtSecret(),
    { algorithm: "HS256", expiresIn: "30d", issuer: JWT_ISS, audience: JWT_AUD_LOGIN }
  );
}
function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.ip || req.socket.remoteAddress || "unknown";
}
function issueOauthState(provider, mobile = false) {
  return jwt.sign(
    { provider, nonce: randomUUID(), mobile },
    getJwtSecret(),
    { algorithm: "HS256", expiresIn: "10m", issuer: JWT_ISS, audience: JWT_AUD_OAUTH }
  );
}
function verifyOauthState(state, provider) {
  if (!state) return { valid: false, mobile: false };
  try {
    const decoded = jwt.verify(state, getJwtSecret(), {
      algorithms: ["HS256"],
      issuer: JWT_ISS,
      audience: JWT_AUD_OAUTH
    });
    return { valid: decoded?.provider === provider, mobile: !!decoded?.mobile };
  } catch {
    return { valid: false, mobile: false };
  }
}
async function createOrGetSocialUser(params) {
  const email = normalizeEmail(params.email);
  const existing = await UserModel.findByEmail(email);
  if (existing) {
    if (params.name || params.avatar) {
      await UserModel.updateProfile(existing.id, { name: params.name, avatar: params.avatar });
    }
    return existing;
  }
  const generatedPasswordHash = await bcrypt.hash(`social-${params.provider}-${randomUUID()}`, 12);
  const user = await UserModel.create(email, generatedPasswordHash);
  await run(
    "UPDATE users SET name = ?, role = ?, avatar = ?, is_premium = 0, membership_paid = 0 WHERE id = ?",
    [params.name || email.split("@")[0], "user", params.avatar || null, user.id]
  );
  const regPoints = await get("SELECT setting_value FROM app_settings WHERE setting_key = ?", ["registration_points_gift"]);
  const pointsGift = parseInt(regPoints?.setting_value || "200");
  await run("UPDATE users SET points = ? WHERE id = ?", [pointsGift, user.id]);
  await run("INSERT INTO point_transactions (user_id, points, reason, reference_type) VALUES (?,?,?,?)", [user.id, pointsGift, `Welcome gift - ${params.provider} signup`, "registration"]);
  const userName = params.name || email.split("@")[0];
  sendWelcomeMessages(user.id, "user", userName, email).catch((e) => console.error("Welcome messages error:", e));
  return user;
}
async function finalizeSocialLogin(res, req, data, mobile = false) {
  const user = await createOrGetSocialUser(data);
  const token = issueLoginToken(user);
  const base = mobile ? getMobileAppBaseUrl() : getAppBaseUrl(req);
  return res.redirect(`${base}/auth/social-callback?token=${encodeURIComponent(token)}`);
}
function validatePasswordComplexity(password) {
  if (typeof password !== "string") return "Password is required";
  if (password.length < 8) return "Password must be at least 8 characters long";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must contain at least one special character";
  return null;
}
var register = async (req, res) => {
  try {
    const { password, name, role, securityQuestion, securityAnswer } = req.body;
    const email = normalizeEmail(req.body?.email);
    if (!email || !password) return res.status(400).json({ message: "Email and password are required" });
    if (!securityQuestion || !securityAnswer) return res.status(400).json({ message: "Security question and answer are required" });
    const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) return res.status(400).json({ message: "Please enter a valid email address" });
    const hasValidDomain = await hasMailCapableDomain(email);
    if (!hasValidDomain) return res.status(400).json({ message: "Email domain is not valid for receiving mail" });
    const passwordError = validatePasswordComplexity(password);
    if (passwordError) return res.status(400).json({ message: passwordError });
    const existing = await UserModel.findByEmail(email);
    if (existing) return res.status(409).json({ message: "An account with this email already exists" });
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await UserModel.create(email, hashedPassword);
    const PUBLIC_ROLES = ["user", "coach"];
    const userRole = PUBLIC_ROLES.includes(role) ? role : "user";
    if (name) await run("UPDATE users SET name = ?, role = ?, is_premium = 0, membership_paid = 0 WHERE id = ?", [name, userRole, user.id]);
    else await run("UPDATE users SET role = ?, is_premium = 0, membership_paid = 0 WHERE id = ?", [userRole, user.id]);
    const hashedAnswer = await bcrypt.hash(securityAnswer.trim().toLowerCase(), 12);
    await UserModel.setSecurityQuestion(user.id, securityQuestion, hashedAnswer);
    const regPoints = await get("SELECT setting_value FROM app_settings WHERE setting_key = ?", ["registration_points_gift"]);
    const pointsGift = parseInt(regPoints?.setting_value || "200");
    await run("UPDATE users SET points = ? WHERE id = ?", [pointsGift, user.id]);
    await run("INSERT INTO point_transactions (user_id, points, reason, reference_type) VALUES (?,?,?,?)", [user.id, pointsGift, "Welcome gift - registration bonus", "registration"]);
    let rememberRenewToken = null;
    if (String(req.body?.rememberMe) === "true") {
      rememberRenewToken = randomUUID();
      await UserModel.setRememberToken(user.id, rememberRenewToken);
    }
    const token = issueLoginToken(user);
    const ip = getClientIp(req);
    const fullUser = await get("SELECT id, name, email, role, avatar, is_premium, coach_membership_active, membership_paid, points, steps, step_goal, height, weight, gender, created_at FROM users WHERE id = ?", [user.id]);
    res.status(201).json({ message: "User registered successfully", token, user: fullUser, rememberToken: rememberRenewToken });
    sendWelcomeMessages(user.id, userRole, name || email.split("@")[0], email).catch((e) => console.error("Welcome messages error:", e));
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error during registration" });
  }
};
var login = async (req, res) => {
  try {
    const password = req.body?.password;
    const email = normalizeEmail(req.body?.email);
    if (!email || !password) return res.status(400).json({ message: "Email and password are required" });
    const user = await UserModel.findByEmail(email) || await UserModel.findByUsername(email);
    if (!user || !user.password) return res.status(401).json({ message: "Invalid credentials" });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });
    let rememberRenewToken = null;
    if (String(req.body?.rememberMe) === "true") {
      rememberRenewToken = randomUUID();
      await UserModel.setRememberToken(user.id, rememberRenewToken);
    }
    const token = issueLoginToken(user);
    const ip = getClientIp(req);
    const fullUser = await get("SELECT id, name, email, role, avatar, is_premium, coach_membership_active, membership_paid, points, steps, step_goal, height, weight, gender, created_at FROM users WHERE id = ?", [user.id]);
    res.json({ message: "Login successful", token, user: fullUser, rememberToken: rememberRenewToken });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login" });
  }
};
var forgotPasswordGetQuestion = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ message: "Email is required" });
    const user = await UserModel.findByEmail(email) || await UserModel.findByUsername(email);
    if (!user || !user.security_question) return res.json({ question: "Please answer your security question" });
    return res.json({ question: user.security_question });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
var forgotPasswordVerify = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const { securityAnswer, newPassword } = req.body;
    if (!email || !securityAnswer || !newPassword) return res.status(400).json({ message: "Email, security answer, and new password are required" });
    const passwordError = validatePasswordComplexity(newPassword);
    if (passwordError) return res.status(400).json({ message: passwordError });
    const user = await UserModel.findByEmail(email) || await UserModel.findByUsername(email);
    if (!user || !user.security_answer) {
      return res.status(401).json({ message: "Email or security answer is incorrect" });
    }
    const answerMatch = await bcrypt.compare(securityAnswer.trim().toLowerCase(), user.security_answer);
    if (!answerMatch) return res.status(401).json({ message: "Email or security answer is incorrect" });
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await UserModel.updatePassword(user.id, hashedPassword);
    try {
      await UserModel.setRememberToken(user.id, null);
    } catch {
    }
    return res.json({ message: "Password reset successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
var logout = async (req, res) => {
  try {
    const userId = req.user?.id;
    const authHeader = req.headers["authorization"] || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (userId) {
    }
    if (token && userId) {
      try {
        const tokenHash = createHash("sha256").update(token).digest("hex").slice(0, 32);
        await run(
          "INSERT IGNORE INTO revoked_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 31 DAY))",
          [userId, tokenHash]
        );
        await run("DELETE FROM revoked_tokens WHERE expires_at < NOW()").catch(() => {
        });
      } catch {
      }
    }
    res.json({ message: "Logged out successfully" });
  } catch {
    res.json({ message: "Logged out" });
  }
};
var changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: "Current and new password are required" });
    const passwordError = validatePasswordComplexity(newPassword);
    if (passwordError) return res.status(400).json({ message: passwordError });
    const user = await UserModel.findById(userId);
    if (!user || !user.password) return res.status(404).json({ message: "User not found" });
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(401).json({ message: "Current password is incorrect" });
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await UserModel.updatePassword(userId, hashedPassword);
    try {
      await UserModel.setRememberToken(userId, null);
    } catch {
    }
    return res.json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
var changeEmail = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { currentPassword, newEmail } = req.body || {};
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!currentPassword || !newEmail) {
      return res.status(400).json({ message: "Current password and new email are required" });
    }
    const normalizedEmail = normalizeEmail(newEmail);
    const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ message: "Please enter a valid email address" });
    }
    const user = await UserModel.findById(userId);
    if (!user || !user.password) return res.status(404).json({ message: "User not found" });
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(401).json({ message: "Current password is incorrect" });
    const existing = await UserModel.findByEmail(normalizedEmail);
    if (existing && existing.id !== userId) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }
    if (normalizedEmail === normalizeEmail(user.email)) {
      return res.status(400).json({ message: "New email is the same as current email" });
    }
    await run("UPDATE users SET email = ? WHERE id = ?", [normalizedEmail, userId]);
    return res.json({ message: "Email changed successfully", email: normalizedEmail });
  } catch {
    return res.status(500).json({ message: "Server error" });
  }
};
var loginWithRememberToken = async (req, res) => {
  try {
    const { rememberToken } = req.body;
    if (!rememberToken) return res.status(400).json({ message: "Remember token is required" });
    const user = await UserModel.findByRememberToken(rememberToken);
    if (!user) return res.status(401).json({ message: "Invalid remember token" });
    const token = jwt.sign(
      { id: user.id, email: user.email },
      getJwtSecret(),
      { algorithm: "HS256", expiresIn: "1d", issuer: JWT_ISS, audience: JWT_AUD_LOGIN }
    );
    try {
      const rotated = randomUUID();
      await UserModel.setRememberToken(user.id, rotated);
      const { password: _, ...userWithoutPassword } = user;
      return res.json({ message: "Auto-login successful", token, user: userWithoutPassword, rememberToken: rotated });
    } catch {
      const { password: _, ...userWithoutPassword } = user;
      return res.json({ message: "Auto-login successful", token, user: userWithoutPassword });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
var oauthGoogleStart = async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return res.redirect(`${getAppBaseUrl(req)}/auth/login?error=${encodeURIComponent("Google OAuth is not configured")}`);
  }
  const isMobile = req.query.platform === "mobile";
  const state = issueOauthState("google", isMobile);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account"
  });
  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
};
var oauthGoogleCallback = async (req, res) => {
  try {
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    const { valid, mobile } = verifyOauthState(state, "google");
    const errorBase = mobile ? getMobileAppBaseUrl() : getAppBaseUrl(req);
    if (!valid) {
      return res.redirect(`${errorBase}/auth/login?error=${encodeURIComponent("Invalid OAuth state")}`);
    }
    if (!code) {
      return res.redirect(`${errorBase}/auth/login?error=${encodeURIComponent("Missing Google OAuth code")}`);
    }
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
      return res.redirect(`${errorBase}/auth/login?error=${encodeURIComponent("Google OAuth not configured")}`);
    }
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });
    const tokenData = await tokenResp.json();
    if (!tokenResp.ok || !tokenData.access_token) {
      return res.redirect(`${errorBase}/auth/login?error=${encodeURIComponent("Google token exchange failed")}`);
    }
    const profileResp = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const profile = await profileResp.json();
    const email = normalizeEmail(profile?.email);
    if (!email) {
      return res.redirect(`${errorBase}/auth/login?error=${encodeURIComponent("Google account has no email")}`);
    }
    return finalizeSocialLogin(res, req, {
      provider: "google",
      email,
      name: profile?.name,
      avatar: profile?.picture
    }, mobile);
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return res.redirect(`${getAppBaseUrl(req)}/auth/login?error=${encodeURIComponent("Google login failed")}`);
  }
};
var updateProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const { height, weight, gender, name, avatar } = req.body;
    const result = await UserModel.updateProfile(userId, { height, weight, gender, name, avatar });
    if (result === null) return res.status(400).json({ message: "No profile fields provided" });
    const updated = await UserModel.findById(userId);
    const { password: _, ...userWithoutPassword } = updated || {};
    res.json({ message: "Profile updated", user: userWithoutPassword });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
var addOfflineSteps = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const body = req.body;
    const entries = Array.isArray(body) ? body : [body];
    let synced = 0;
    for (const entry of entries) {
      const { steps, date, caloriesBurned, distanceKm, trackingMode, notes } = entry;
      if (!steps || !date) continue;
      const existing = await get("SELECT id, steps FROM steps_entries WHERE user_id = ? AND date = ?", [userId, date]);
      if (existing) {
        const newSteps = Math.max(existing.steps, steps);
        await run(
          "UPDATE steps_entries SET steps = ?, calories_burned = COALESCE(?, calories_burned), distance_km = COALESCE(?, distance_km), tracking_mode = COALESCE(?, tracking_mode), notes = COALESCE(?, notes) WHERE user_id = ? AND date = ?",
          [newSteps, caloriesBurned || null, distanceKm || null, trackingMode || null, notes || null, userId, date]
        );
      } else {
        await run(
          "INSERT INTO steps_entries (user_id, date, steps, calories_burned, distance_km, tracking_mode, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [userId, date, steps, caloriesBurned || null, distanceKm || null, trackingMode || "manual", notes || null]
        );
      }
      await run("UPDATE users SET steps = ?, last_sync = NOW() WHERE id = ?", [steps, userId]);
      synced++;
    }
    res.json({ message: `Synced ${synced} entr${synced === 1 ? "y" : "ies"}`, synced });
  } catch (error) {
    console.error("addOfflineSteps error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// server/routes/authRoutes.ts
init_auth();
init_database();
var router = Router();
var authLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 10,
  message: { message: "Too many attempts, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false
});
var strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  max: 5,
  message: { message: "Too many attempts, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false
});
var loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  max: 10,
  message: { message: "Too many login attempts. Please wait 15 minutes before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});
router.post("/register", authLimiter, register);
router.post("/login", loginLimiter, login);
router.post("/logout", authenticateToken, logout);
router.get("/oauth/google", oauthGoogleStart);
router.get("/oauth/google/callback", oauthGoogleCallback);
router.post("/forgot-password/question", strictLimiter, forgotPasswordGetQuestion);
router.post("/forgot-password/verify", strictLimiter, forgotPasswordVerify);
router.post("/change-password", authenticateToken, changePassword);
router.post("/change-email", authenticateToken, changeEmail);
router.post("/login-remember", authLimiter, loginWithRememberToken);
router.post("/offline-steps", authenticateToken, addOfflineSteps);
router.post("/update-profile", authenticateToken, updateProfile);
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await get("SELECT id, name, email, role, avatar, is_premium, coach_membership_active, membership_paid, medical_history, medical_file_url, points, steps, step_goal, height, weight, gender, fitness_goal, activity_level, computed_activity_level, target_weight, weekly_goal, date_of_birth, onboarding_done, city, country, latitude, longitude, created_at FROM users WHERE id = ?", [req.user.id]);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch user" });
  }
});
var authRoutes_default = router;

// server/routes/healthRoutes.ts
import { Router as Router2 } from "express";

// server/controllers/healthController.ts
init_database();
var getDailySteps = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const entry = await get(
      "SELECT steps, calories_burned, distance_km FROM steps_entries WHERE user_id = ? AND date = ?",
      [userId, today]
    );
    if (entry) {
      return res.json({ steps: entry.steps, calories: entry.calories_burned, distance: entry.distance_km, source: "steps_entries" });
    }
    return res.json({ steps: 0, message: "No step data found for today" });
  } catch (error) {
    console.error("Get steps error:", error);
    res.status(500).json({ message: "Error fetching steps" });
  }
};
var syncSteps = async (req, res) => {
  try {
    const { steps, date, caloriesBurned, distanceKm } = req.body;
    const userId = req.user?.id;
    if (!userId || steps === void 0) {
      return res.status(400).json({ message: "Steps and valid user required" });
    }
    const summaryDate = date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const existing = await get(
      "SELECT id FROM steps_entries WHERE user_id = ? AND date = ?",
      [userId, summaryDate]
    );
    if (existing) {
      await run(
        "UPDATE steps_entries SET steps = ?, calories_burned = ?, distance_km = ? WHERE user_id = ? AND date = ?",
        [steps, caloriesBurned || null, distanceKm || null, userId, summaryDate]
      );
      return res.json({ message: "Steps updated successfully", date: summaryDate, steps });
    }
    const { insertId } = await run(
      "INSERT INTO steps_entries (user_id, date, steps, calories_burned, distance_km, tracking_mode) VALUES (?, ?, ?, ?, ?, ?)",
      [userId, summaryDate, steps, caloriesBurned || null, distanceKm || null, "manual"]
    );
    res.status(201).json({ message: "Steps synced successfully", entry_id: insertId, date: summaryDate, steps });
  } catch (error) {
    console.error("Sync steps error:", error);
    res.status(500).json({ message: "Error syncing steps" });
  }
};

// server/routes/healthRoutes.ts
init_auth();
var router2 = Router2();
router2.get("/steps/today", authenticateToken, getDailySteps);
router2.post("/steps/sync", authenticateToken, syncSteps);
var healthRoutes_default = router2;

// server/routes/aiRoutes.ts
import { Router as Router3 } from "express";

// server/controllers/aiController.ts
init_database();
import { GoogleGenAI } from "@google/genai";

// server/models/DailySummary.ts
init_database();
var DailySummaryModel = {
  create: async (userId, date, steps, aiAnalysis) => {
    const { insertId } = await run("INSERT INTO daily_summaries (user_id, date, steps, ai_analysis) VALUES (?, ?, ?, ?)", [userId, date, steps, aiAnalysis]);
    return { id: insertId, user_id: userId, date, steps, ai_analysis: aiAnalysis, created_at: (/* @__PURE__ */ new Date()).toISOString() };
  },
  findByUserAndDate: async (userId, date) => get("SELECT * FROM daily_summaries WHERE user_id = ? AND date = ?", [userId, date]),
  findByUser: async (userId) => query("SELECT * FROM daily_summaries WHERE user_id = ? ORDER BY date DESC", [userId])
};

// server/controllers/aiController.ts
var analyzeSteps = async (req, res) => {
  try {
    const userId = req.user?.id;
    const rawSteps = (req.body || {}).steps;
    const stepsNum = Number(rawSteps);
    if (!Number.isFinite(stepsNum) || stepsNum < 0 || stepsNum > 2e5) {
      return res.status(400).json({ message: "Steps must be a non-negative number \u2264 200000" });
    }
    const steps = Math.floor(stepsNum);
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: "Gemini API key not configured" });
    }
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `
      User walked ${steps} steps today.
      Return a JSON object with the following fields:
      1. performance_rating (string: "Excellent", "Good", "Fair", "Needs Improvement")
      2. health_advice (string: one sentence advice)
      3. motivational_message (string: short encouraging message)
      4. tomorrow_goal (number: suggested step count for tomorrow)

      Do not include markdown formatting, just the raw JSON.
    `;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });
    const text = response.text;
    let analysisData;
    try {
      const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
      analysisData = JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse AI response:", text);
      analysisData = {
        performance_rating: "Unknown",
        health_advice: "Keep moving!",
        motivational_message: "Great job tracking your steps.",
        tomorrow_goal: steps + 500
      };
    }
    if (userId) {
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const existing = await DailySummaryModel.findByUserAndDate(userId, today);
      if (existing) {
        await run(
          "UPDATE daily_summaries SET steps = ?, ai_analysis = ? WHERE user_id = ? AND date = ?",
          [steps, JSON.stringify(analysisData), userId, today]
        );
      } else {
        await DailySummaryModel.create(userId, today, steps, JSON.stringify(analysisData));
      }
    }
    res.json(analysisData);
  } catch (error) {
    console.error("AI Analysis error:", error);
    res.status(500).json({ message: "Error generating AI analysis" });
  }
};

// server/routes/aiRoutes.ts
init_auth();
import rateLimit2, { ipKeyGenerator } from "express-rate-limit";
var router3 = Router3();
var aiLimiter = rateLimit2({
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 20,
  // 20 requests / 15 min per user (or per IP)
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const uid = req.user?.id;
    return uid ? `u:${uid}` : `ip:${ipKeyGenerator(req.ip || "")}`;
  },
  message: { message: "Too many AI requests, please try again later." }
});
router3.post("/analyze-steps", authenticateToken, aiLimiter, analyzeSteps);
var aiRoutes_default = router3;

// server/routes/chatRoutes.ts
import express from "express";

// server/controllers/chatController.ts
init_database();
init_upload();
var PRESENCE_TTL_MS = 2e4;
var presenceMap = /* @__PURE__ */ new Map();
function markOnline(userId) {
  if (!userId) return;
  presenceMap.set(userId, Date.now());
}
function getOnlineUserSet() {
  const now = Date.now();
  for (const [id, ts] of presenceMap.entries()) {
    if (now - ts > PRESENCE_TTL_MS) presenceMap.delete(id);
  }
  return new Set(presenceMap.keys());
}
async function canDirectChat(senderId, senderRole, receiverId) {
  const receiver = await get("SELECT id, role FROM users WHERE id = ?", [receiverId]);
  if (!receiver) return { ok: false, status: 404, message: "Recipient not found" };
  if (receiver.role === "admin" && senderRole !== "admin") {
    return { ok: true, receiverRole: receiver.role };
  }
  if (senderRole === "admin") {
    return { ok: true, receiverRole: receiver.role };
  }
  if (senderRole === "user" && receiver.role === "coach") {
    const activeSub = await get(
      `SELECT id FROM coach_subscriptions
       WHERE user_id = ? AND coach_id = ? AND status = 'active'
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [senderId, receiverId]
    );
    if (!activeSub) {
      return { ok: false, status: 403, message: "You must subscribe to this coach before chatting. Go to Coaching to subscribe." };
    }
    return { ok: true, receiverRole: receiver.role };
  }
  if (senderRole === "coach" && receiver.role === "user") {
    const activeSub = await get(
      `SELECT id FROM coach_subscriptions
       WHERE user_id = ? AND coach_id = ? AND status = 'active'
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [receiverId, senderId]
    );
    if (!activeSub) {
      return { ok: false, status: 403, message: "This user does not have an active subscription with you." };
    }
    return { ok: true, receiverRole: receiver.role };
  }
  if (senderRole === "user" && receiver.role === "user") {
    return { ok: false, status: 403, message: "Direct messaging between users is not available. You can chat only with your subscribed coach." };
  }
  if (senderRole === "coach" && receiver.role === "coach") {
    return { ok: false, status: 403, message: "Direct messaging between coaches is not available." };
  }
  return { ok: false, status: 403, message: "Direct chat is not allowed for this pair." };
}
var getChatHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    markOnline(userId);
    const senderRole = req.user.role;
    const otherUserId = Number(req.params.userId);
    if (!otherUserId) return res.status(400).json({ message: "Invalid user id" });
    const allowed = await canDirectChat(userId, senderRole, otherUserId);
    if (!allowed.ok) return res.status(allowed.status).json({ message: allowed.message });
    const messages = await query(`
      SELECT m.*, s.name as sender_name, s.avatar as sender_avatar
      FROM messages m JOIN users s ON m.sender_id = s.id
      WHERE ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))
        AND m.challenge_id IS NULL AND m.group_id IS NULL
      ORDER BY m.created_at ASC
    `, [userId, otherUserId, otherUserId, userId]);
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch chat history" });
  }
};
var getChallengeMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    markOnline(userId);
    const challengeId = req.params.challengeId;
    const participantCheck = await get(
      "SELECT id FROM challenge_participants WHERE challenge_id = ? AND user_id = ?",
      [challengeId, userId]
    );
    if (!participantCheck && userRole !== "admin") {
      return res.status(403).json({ message: "Join the challenge to view its messages" });
    }
    const messages = await query(`
      SELECT m.*, s.name as sender_name, s.avatar as sender_avatar
      FROM messages m JOIN users s ON m.sender_id = s.id
      WHERE m.challenge_id = ? ORDER BY m.created_at ASC
    `, [challengeId]);
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch challenge messages" });
  }
};
var sendMessage = async (req, res) => {
  try {
    const senderId = req.user.id;
    markOnline(senderId);
    const senderRole = req.user.role;
    const { receiverId, challengeId, content } = req.body;
    const mediaUrl = req.file ? await uploadToR2(req.file, "chat") : null;
    if (!receiverId && !challengeId || !content && !mediaUrl) return res.status(400).json({ message: "Receiver ID or Challenge ID and content/media are required" });
    if (receiverId) {
      const allowed = await canDirectChat(senderId, senderRole, Number(receiverId));
      if (!allowed.ok) return res.status(allowed.status).json({ message: allowed.message });
    }
    let insertId;
    if (challengeId) {
      try {
        await run("INSERT IGNORE INTO challenge_participants (challenge_id, user_id) VALUES (?, ?)", [challengeId, senderId]);
      } catch {
      }
      ({ insertId } = await run("INSERT INTO messages (sender_id, challenge_id, content, media_url) VALUES (?, ?, ?, ?)", [senderId, challengeId, content, mediaUrl]));
    } else {
      ({ insertId } = await run("INSERT INTO messages (sender_id, receiver_id, content, media_url) VALUES (?, ?, ?, ?)", [senderId, receiverId, content, mediaUrl]));
    }
    const newMessage = await get(`
      SELECT m.*, s.name as sender_name, s.avatar as sender_avatar
      FROM messages m JOIN users s ON m.sender_id = s.id WHERE m.id = ?
    `, [insertId]);
    if (receiverId) {
      sendPushFromTemplate(Number(receiverId), "new_message", { name: newMessage?.sender_name || "Someone" }).catch(() => {
      });
    }
    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ message: "Failed to send message" });
  }
};
var getContacts = async (req, res) => {
  try {
    const userId = req.user.id;
    markOnline(userId);
    const userRole = req.user.role;
    const supportOnly = String(req.query?.supportOnly || "") === "1";
    let contacts = [];
    if (userRole === "admin") {
      if (supportOnly) {
        contacts = await query(
          `SELECT DISTINCT u.id, u.name, u.avatar, u.role, u.is_premium
           FROM users u
           INNER JOIN messages m ON m.sender_id = u.id
           INNER JOIN users admin_u ON admin_u.id = m.receiver_id AND admin_u.role = 'admin'
           WHERE u.role IN ('user', 'coach')
           ORDER BY u.name ASC`,
          []
        );
      } else {
        contacts = await query(
          "SELECT id, name, avatar, role, is_premium FROM users WHERE id != ? AND role != 'admin' ORDER BY name ASC",
          [userId]
        );
      }
    } else if (userRole === "coach") {
      const athletes = await query(`
        SELECT DISTINCT u.id, u.name, u.avatar, u.role, u.is_premium
        FROM users u
        INNER JOIN coach_subscriptions cs ON cs.user_id = u.id
        WHERE cs.coach_id = ? AND cs.status = 'active' AND (cs.expires_at IS NULL OR cs.expires_at > NOW()) AND u.id != ?
        ORDER BY u.name ASC
      `, [userId, userId]);
      const admins = await query(
        `SELECT id, name, avatar, role, is_premium FROM users WHERE role = 'admin' ORDER BY name ASC`,
        []
      );
      contacts = [...athletes, ...admins];
    } else {
      const subscribedCoaches = await query(`
        SELECT DISTINCT u.id, u.name, u.avatar, u.role, u.is_premium
        FROM users u
        INNER JOIN coach_subscriptions cs ON cs.coach_id = u.id
        WHERE cs.user_id = ? AND cs.status = 'active' AND (cs.expires_at IS NULL OR cs.expires_at > NOW())
        ORDER BY u.name ASC
      `, [userId]);
      const admins = await query(
        `SELECT id, name, avatar, role, is_premium FROM users WHERE role = 'admin' ORDER BY name ASC`,
        []
      );
      contacts = [...subscribedCoaches, ...admins];
    }
    const filtered = [];
    for (const c of contacts || []) {
      const allowed = await canDirectChat(userId, userRole, Number(c.id));
      if (allowed.ok) filtered.push(c);
    }
    const uniqueById = Array.from(new Map(filtered.map((u) => [u.id, u])).values());
    const onlineSet = getOnlineUserSet();
    res.json({ users: uniqueById.map((u) => ({ ...u, online: onlineSet.has(Number(u.id)) })) });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch contacts" });
  }
};
var pingPresence = async (req, res) => {
  try {
    const userId = Number(req.user?.id || 0);
    markOnline(userId);
    await run("UPDATE users SET last_active = NOW() WHERE id = ?", [userId]);
    res.json({ ok: true, ts: Date.now() });
  } catch {
    res.status(500).json({ message: "Failed to update presence" });
  }
};
var getPresence = async (req, res) => {
  try {
    const userId = Number(req.user?.id || 0);
    markOnline(userId);
    const memoryOnline = Array.from(getOnlineUserSet());
    const dbOnline = await query(
      "SELECT id FROM users WHERE last_active >= DATE_SUB(NOW(), INTERVAL 25 SECOND)",
      []
    );
    const combined = new Set(memoryOnline);
    for (const row of dbOnline) combined.add(Number(row.id));
    res.json({ onlineUserIds: Array.from(combined) });
  } catch {
    res.status(500).json({ message: "Failed to fetch presence" });
  }
};

// server/routes/chatRoutes.ts
init_auth();
init_upload();
init_upload();
var router4 = express.Router();
router4.get("/users", authenticateToken, getContacts);
router4.get("/contacts", authenticateToken, getContacts);
router4.get("/messages/:userId", authenticateToken, getChatHistory);
router4.get("/history/:userId", authenticateToken, getChatHistory);
router4.get("/challenge/:challengeId/messages", authenticateToken, getChallengeMessages);
router4.get("/challenge/:challengeId", authenticateToken, getChallengeMessages);
router4.post("/send", authenticateToken, sendMessage);
router4.post("/send-media", authenticateToken, upload_default.single("file"), optimizeImage(), sendMessage);
router4.post("/send-voice", authenticateToken, uploadAudio.single("file"), verifyUploadBytes("audio"), sendMessage);
router4.post("/presence/ping", authenticateToken, pingPresence);
router4.get("/presence", authenticateToken, getPresence);
router4.get("/support-contact", authenticateToken, async (req, res) => {
  try {
    const { get: get2 } = await Promise.resolve().then(() => (init_database(), database_exports));
    const admin = await get2("SELECT id, name, avatar, role, is_premium FROM users WHERE role = 'admin' LIMIT 1");
    if (!admin) return res.status(404).json({ message: "No support agent found" });
    res.json({ contact: admin });
  } catch {
    res.status(500).json({ message: "Failed" });
  }
});
var chatRoutes_default = router4;

// server/routes/communityRoutes.ts
import express2 from "express";

// server/controllers/communityController.ts
init_database();
init_upload();
var getPosts = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role || "user";
    const tag = req.query.tag || null;
    const hiddenFilter = userRole === "admin" || userRole === "moderator" ? "" : "AND p.is_hidden = 0";
    let posts;
    if (tag) {
      const like = `%#${tag}%`;
      posts = await query(
        `SELECT p.*, u.name as user_name, u.avatar as user_avatar, u.role as user_role,
                CASE WHEN cf.follower_id IS NOT NULL THEN 1 ELSE 0 END as is_followed,
                CASE WHEN pl.user_id IS NOT NULL THEN 1 ELSE 0 END as isLiked,
                (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) as comment_count
         FROM posts p
         LEFT JOIN users u ON p.user_id = u.id
         LEFT JOIN coach_follows cf ON cf.coach_id = p.user_id AND cf.follower_id = ?
         LEFT JOIN post_likes pl ON pl.post_id = p.id AND pl.user_id = ?
         WHERE (p.hashtags LIKE ? OR p.content LIKE ?) ${hiddenFilter}
         ORDER BY p.is_pinned DESC, is_followed DESC, p.created_at DESC LIMIT 50`,
        [userId, userId, like, like]
      );
    } else {
      posts = await query(
        `SELECT p.*, u.name as user_name, u.avatar as user_avatar, u.role as user_role,
                CASE WHEN cf.follower_id IS NOT NULL THEN 1 ELSE 0 END as is_followed,
                CASE WHEN pl.user_id IS NOT NULL THEN 1 ELSE 0 END as isLiked,
                (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) as comment_count
         FROM posts p
         LEFT JOIN users u ON p.user_id = u.id
         LEFT JOIN coach_follows cf ON cf.coach_id = p.user_id AND cf.follower_id = ?
         LEFT JOIN post_likes pl ON pl.post_id = p.id AND pl.user_id = ?
         WHERE 1=1 ${hiddenFilter}
         ORDER BY p.is_pinned DESC, is_followed DESC, p.created_at DESC LIMIT 50`,
        [userId, userId]
      );
    }
    for (const post of posts) {
      const comments = await query(
        `SELECT pc.*, u.name as user_name, u.avatar as user_avatar FROM post_comments pc LEFT JOIN users u ON pc.user_id = u.id WHERE pc.post_id = ? ORDER BY pc.created_at ASC`,
        [post.id]
      );
      post.comments = comments;
    }
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch posts" });
  }
};
var deletePost = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user?.role || "user";
    const postId = req.params.id;
    const post = await get("SELECT * FROM posts WHERE id = ?", [postId]);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (userRole === "admin" || userRole === "moderator") {
      await run("UPDATE posts SET is_hidden = 1 WHERE id = ?", [postId]);
    } else if (post.user_id === userId) {
      await run("DELETE FROM post_comments WHERE post_id = ?", [postId]);
      await run("DELETE FROM post_likes WHERE post_id = ?", [postId]);
      await run("DELETE FROM posts WHERE id = ?", [postId]);
    } else {
      return res.status(403).json({ message: "Not authorized" });
    }
    res.json({ message: "Post removed" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete post" });
  }
};
var getTrendingTags = async (_req, res) => {
  try {
    const rows = await query(
      `SELECT hashtags FROM posts WHERE hashtags IS NOT NULL AND hashtags != '' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) ORDER BY created_at DESC LIMIT 200`
    );
    const tagCounts = {};
    for (const row of rows) {
      const tags = (row.hashtags || "").match(/#[\w\u0600-\u06FF]+/g) || [];
      for (const t of tags) tagCounts[t] = (tagCounts[t] || 0) + 1;
    }
    const trending = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([tag, count]) => ({ tag, count }));
    res.json(trending);
  } catch {
    res.status(500).json({ message: "Failed to fetch trending tags" });
  }
};
var createPost = async (req, res) => {
  try {
    const userId = req.user.id;
    const { content, hashtags } = req.body;
    const files = req.files;
    const mediaUrl = files && files.length > 0 ? await uploadToR2(files[0], "community") : null;
    if (!content && !mediaUrl) return res.status(400).json({ message: "Content or media is required" });
    const { insertId } = await run("INSERT INTO posts (user_id, content, media_url, hashtags) VALUES (?, ?, ?, ?)", [userId, content, mediaUrl, hashtags]);
    const newPost = await get(`SELECT p.*, u.name as user_name, u.avatar as user_avatar, u.role as user_role FROM posts p LEFT JOIN users u ON p.user_id = u.id WHERE p.id = ?`, [insertId]);
    res.status(201).json(newPost);
  } catch (error) {
    res.status(500).json({ message: "Failed to create post" });
  }
};
var getChallenges = async (req, res) => {
  try {
    const userId = req.user?.id;
    const challenges = await query(
      `SELECT c.*, u.name as creator_name, u.avatar as creator_avatar,
              (SELECT COUNT(*) FROM challenge_participants WHERE challenge_id = c.id) as participant_count,
              CASE WHEN cp.user_id IS NOT NULL THEN 1 ELSE 0 END as is_joined
       FROM challenges c
       LEFT JOIN users u ON c.creator_id = u.id
       LEFT JOIN challenge_participants cp ON cp.challenge_id = c.id AND cp.user_id = ?
       ORDER BY c.created_at DESC`,
      [userId]
    );
    res.json(challenges);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch challenges" });
  }
};
var createChallenge = async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, description, startDate, endDate } = req.body;
    const imgFiles = req.files;
    const imageUrl = imgFiles && imgFiles.length > 0 ? await uploadToR2(imgFiles[0], "community") : null;
    if (!title) return res.status(400).json({ message: "Title is required" });
    const { insertId } = await run("INSERT INTO challenges (creator_id, title, description, start_date, end_date, image_url) VALUES (?, ?, ?, ?, ?, ?)", [userId, title, description, startDate, endDate, imageUrl]);
    await run("INSERT INTO challenge_participants (challenge_id, user_id) VALUES (?, ?)", [insertId, userId]);
    const newChallenge = await get(`SELECT c.*, u.name as creator_name, u.avatar as creator_avatar, (SELECT COUNT(*) FROM challenge_participants WHERE challenge_id = c.id) as participant_count FROM challenges c LEFT JOIN users u ON c.creator_id = u.id WHERE c.id = ?`, [insertId]);
    res.status(201).json(newChallenge);
  } catch (error) {
    res.status(500).json({ message: "Failed to create challenge" });
  }
};
var joinChallenge = async (req, res) => {
  try {
    const userId = req.user.id;
    const challengeId = req.params.id;
    await run("INSERT IGNORE INTO challenge_participants (challenge_id, user_id) VALUES (?, ?)", [challengeId, userId]);
    res.json({ message: "Joined challenge successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to join challenge" });
  }
};
var inviteToChallenge = async (_req, res) => {
  res.json({ message: "Invitation sent successfully" });
};
var likePost = async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.id;
    await run("INSERT IGNORE INTO post_likes (post_id, user_id) VALUES (?, ?)", [postId, userId]);
    const countRow = await get("SELECT COUNT(*) as count FROM post_likes WHERE post_id = ?", [postId]);
    const count = countRow?.count || 0;
    await run("UPDATE posts SET likes = ? WHERE id = ?", [count, postId]);
    try {
      const post = await get("SELECT user_id FROM posts WHERE id = ?", [postId]);
      if (post && post.user_id !== userId) {
        const liker = await get("SELECT name FROM users WHERE id = ?", [userId]);
        sendPushFromTemplate(post.user_id, "post_liked", { name: liker?.name || "Someone" }).catch(() => {
        });
      }
    } catch {
    }
    res.json({ likes: count });
  } catch (error) {
    res.status(500).json({ message: "Failed to like post" });
  }
};
var unlikePost = async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.id;
    await run("DELETE FROM post_likes WHERE post_id = ? AND user_id = ?", [postId, userId]);
    const countRow = await get("SELECT COUNT(*) as count FROM post_likes WHERE post_id = ?", [postId]);
    const count = countRow?.count || 0;
    await run("UPDATE posts SET likes = ? WHERE id = ?", [count, postId]);
    res.json({ likes: count });
  } catch (error) {
    res.status(500).json({ message: "Failed to unlike post" });
  }
};
var getPostComments = async (req, res) => {
  try {
    const postId = req.params.id;
    const comments = await query(`SELECT pc.*, u.name as user_name, u.avatar as user_avatar FROM post_comments pc LEFT JOIN users u ON pc.user_id = u.id WHERE pc.post_id = ? ORDER BY pc.created_at DESC`, [postId]);
    res.json(comments);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch comments" });
  }
};
var addComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.id;
    const { content } = req.body;
    if (!content.trim()) return res.status(400).json({ message: "Comment content is required" });
    const { insertId } = await run("INSERT INTO post_comments (post_id, user_id, content) VALUES (?, ?, ?)", [postId, userId, content]);
    const newComment = await get(`SELECT pc.*, u.name as user_name, u.avatar as user_avatar FROM post_comments pc LEFT JOIN users u ON pc.user_id = u.id WHERE pc.id = ?`, [insertId]);
    try {
      const post = await get("SELECT user_id FROM posts WHERE id = ?", [postId]);
      if (post && post.user_id !== userId) {
        const commenter = await get("SELECT name FROM users WHERE id = ?", [userId]);
        sendPushFromTemplate(post.user_id, "post_commented", { name: commenter?.name || "Someone" }).catch(() => {
        });
      }
    } catch {
    }
    res.status(201).json(newComment);
  } catch (error) {
    res.status(500).json({ message: "Failed to add comment" });
  }
};
var followUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const targetUserId = req.params.id;
    if (userId === parseInt(targetUserId)) return res.status(400).json({ message: "Cannot follow yourself" });
    await run("INSERT IGNORE INTO user_follows (follower_id, following_id) VALUES (?, ?)", [userId, targetUserId]);
    try {
      const follower = await get("SELECT name FROM users WHERE id = ?", [userId]);
      sendPushFromTemplate(Number(targetUserId), "new_follower", { name: follower?.name || "Someone" }).catch(() => {
      });
    } catch {
    }
    res.json({ message: "Followed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to follow user" });
  }
};
var unfollowUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const targetUserId = req.params.id;
    await run("DELETE FROM user_follows WHERE follower_id = ? AND following_id = ?", [userId, targetUserId]);
    res.json({ message: "Unfollowed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to unfollow user" });
  }
};
var requestChat = async (req, res) => {
  return res.status(403).json({
    message: "Legacy community chat is disabled. Use the main chat module where only admin and subscribed coach-user pairs can chat."
  });
};
var acceptChatRequest = async (req, res) => {
  return res.status(403).json({
    message: "Legacy community chat is disabled. Use the main chat module where only admin and subscribed coach-user pairs can chat."
  });
};
var getChatRequests = async (req, res) => {
  return res.json([]);
};
var getMessages = async (req, res) => {
  return res.status(403).json({
    message: "Legacy community chat is disabled. Use /api/chat endpoints with enforced subscription/admin rules."
  });
};
var sendMessage2 = async (req, res) => {
  return res.status(403).json({
    message: "Legacy community chat is disabled. Use /api/chat/send which enforces subscription/admin rules."
  });
};
var getUserProfile = async (req, res) => {
  try {
    const userId = req.params.id;
    const currentUserId = req.user.id;
    const user = await get("SELECT id, name, avatar, role, points, steps, height, weight FROM users WHERE id = ?", [userId]);
    if (!user) return res.status(404).json({ message: "User not found" });
    const followRow = await get("SELECT id FROM user_follows WHERE follower_id = ? AND following_id = ?", [currentUserId, userId]);
    res.json({ ...user, isFollowing: !!followRow, chatStatus: null });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch user profile" });
  }
};

// server/routes/communityRoutes.ts
init_auth();
init_upload();
import multer2 from "multer";
import path3 from "path";
import fs2 from "fs";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path3.dirname(__filename);
var uploadDir = path3.join(__dirname, "../../uploads");
if (!fs2.existsSync(uploadDir)) fs2.mkdirSync(uploadDir, { recursive: true });
var storage2 = multer2.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path3.extname(file.originalname));
  }
});
var upload2 = multer2({ storage: storage2, limits: { fileSize: 5 * 1024 * 1024 } });
var router5 = express2.Router();
router5.get("/posts", authenticateToken, getPosts);
router5.post("/posts", authenticateToken, upload2.any(), optimizeImage(), createPost);
router5.delete("/posts/:id", authenticateToken, deletePost);
router5.get("/posts/trending-tags", authenticateToken, getTrendingTags);
router5.post("/posts/:id/like", authenticateToken, likePost);
router5.delete("/posts/:id/like", authenticateToken, unlikePost);
router5.get("/posts/:id/comments", authenticateToken, getPostComments);
router5.post("/posts/:id/comments", authenticateToken, addComment);
router5.get("/challenges", authenticateToken, getChallenges);
router5.post("/challenges", authenticateToken, upload2.any(), optimizeImage(), createChallenge);
router5.post("/challenges/:id/join", authenticateToken, joinChallenge);
router5.post("/challenges/:id/invite", authenticateToken, inviteToChallenge);
router5.post("/users/:id/follow", authenticateToken, followUser);
router5.delete("/users/:id/follow", authenticateToken, unfollowUser);
router5.post("/users/:id/chat", authenticateToken, requestChat);
router5.post("/chat-requests/:id/accept", authenticateToken, acceptChatRequest);
router5.get("/chat-requests", authenticateToken, getChatRequests);
router5.get("/messages", authenticateToken, getMessages);
router5.post("/messages", authenticateToken, sendMessage2);
router5.get("/users/:id/profile", authenticateToken, getUserProfile);
router5.get("/stats", authenticateToken, async (req, res) => {
  if (req.user?.role !== "admin") return res.status(403).json({ message: "Admin only" });
  try {
    const { query: query6 } = await Promise.resolve().then(() => (init_database(), database_exports));
    const [postRow] = await query6("SELECT COUNT(*) as cnt FROM posts");
    const [likeRow] = await query6("SELECT COUNT(*) as cnt FROM post_likes");
    const [commentRow] = await query6("SELECT COUNT(*) as cnt FROM post_comments");
    const [challengeRow] = await query6("SELECT COUNT(*) as cnt FROM challenges");
    const [userRow] = await query6("SELECT COUNT(DISTINCT user_id) as cnt FROM posts WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)");
    res.json({ total_posts: postRow?.cnt || 0, total_likes: likeRow?.cnt || 0, total_comments: commentRow?.cnt || 0, total_challenges: challengeRow?.cnt || 0, active_users: userRow?.cnt || 0 });
  } catch {
    res.status(500).json({ message: "Failed to fetch stats" });
  }
});
var communityRoutes_default = router5;

// server/routes/stepsRoutes.ts
import { Router as Router4 } from "express";

// server/controllers/stepsController.ts
init_database();
var getStepsHistory = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const entries = await query("SELECT id, user_id, date, steps, calories_burned, distance_km, notes, created_at FROM steps_entries WHERE user_id = ? ORDER BY date DESC LIMIT 90", [userId]);
    res.json({ entries, total: entries.length });
  } catch (error) {
    res.status(500).json({ message: "Error fetching steps history" });
  }
};
var getStepsByDate = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { date } = req.params;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const entry = await get("SELECT id, user_id, date, steps, calories_burned, distance_km, notes, created_at FROM steps_entries WHERE user_id = ? AND date = ?", [userId, date]);
    if (!entry) return res.json({ entry: null, message: "No data for this date" });
    res.json({ entry });
  } catch (error) {
    res.status(500).json({ message: "Error fetching steps" });
  }
};
var addSteps = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { date, steps, caloriesBurned, distanceKm, notes, trackingMode } = req.body;
    if (!userId || !date || steps === void 0) return res.status(400).json({ message: "Missing required fields: date, steps" });
    if (typeof steps !== "number" || steps < 0 || steps > 1e5) return res.status(400).json({ message: "Steps must be between 0 and 100000" });
    const existing = await get("SELECT id FROM steps_entries WHERE user_id = ? AND date = ?", [userId, date]);
    if (existing) {
      await run(
        "UPDATE steps_entries SET steps = ?, calories_burned = ?, distance_km = ?, notes = ?, tracking_mode = ? WHERE user_id = ? AND date = ?",
        [steps, caloriesBurned || null, distanceKm || null, notes || null, trackingMode || "manual", userId, date]
      );
      return res.json({ message: "Steps updated successfully", date, steps });
    } else {
      const { insertId } = await run(
        "INSERT INTO steps_entries (user_id, date, steps, calories_burned, distance_km, notes, tracking_mode) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [userId, date, steps, caloriesBurned || null, distanceKm || null, notes || null, trackingMode || "manual"]
      );
      return res.json({ message: "Steps added successfully", entry_id: insertId, date, steps });
    }
  } catch (error) {
    console.error("Add steps error:", error);
    res.status(500).json({ message: "Error adding steps" });
  }
};
var getWeeklyStats = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const entries = await query("SELECT date, steps, calories_burned, distance_km FROM steps_entries WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) ORDER BY date ASC", [userId]);
    const totalSteps = entries.reduce((s, e) => s + e.steps, 0);
    const avgSteps = entries.length > 0 ? Math.round(totalSteps / entries.length) : 0;
    const maxSteps = entries.length > 0 ? Math.max(...entries.map((e) => e.steps)) : 0;
    const totalCalories = entries.reduce((s, e) => s + (e.calories_burned || 0), 0);
    res.json({ weeklyStats: { totalSteps, avgSteps, maxSteps, totalCalories, daysTracked: entries.length, entries } });
  } catch (error) {
    res.status(500).json({ message: "Error fetching weekly stats" });
  }
};
var getMonthlyStats = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const entries = await query("SELECT date, steps, calories_burned, distance_km FROM steps_entries WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) ORDER BY date ASC", [userId]);
    const totalSteps = entries.reduce((s, e) => s + e.steps, 0);
    const avgSteps = entries.length > 0 ? Math.round(totalSteps / entries.length) : 0;
    const maxSteps = entries.length > 0 ? Math.max(...entries.map((e) => e.steps)) : 0;
    const totalCalories = entries.reduce((s, e) => s + (e.calories_burned || 0), 0);
    res.json({ monthlyStats: { totalSteps, avgSteps, maxSteps, totalCalories, daysTracked: entries.length, entries } });
  } catch (error) {
    res.status(500).json({ message: "Error fetching monthly stats" });
  }
};

// server/routes/stepsRoutes.ts
init_auth();
init_database();
var router6 = Router4();
router6.get("/history", authenticateToken, getStepsHistory);
router6.get("/stats/weekly", authenticateToken, getWeeklyStats);
router6.get("/stats/monthly", authenticateToken, getMonthlyStats);
router6.get("/:date", authenticateToken, getStepsByDate);
router6.post("/add", authenticateToken, async (req, res, next) => {
  await addSteps(req, res);
  try {
    const { updateUserActivityProfile: updateUserActivityProfile2 } = await Promise.resolve().then(() => (init_activityProfileService(), activityProfileService_exports));
    updateUserActivityProfile2(req.user?.id).catch(() => {
    });
  } catch {
  }
});
router6.post("/goal-completed", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const already = await get("SELECT id FROM point_transactions WHERE user_id = ? AND reference_type = ? AND DATE(created_at) = ?", [userId, "goal_complete", today]);
    if (already) return res.json({ message: "Already awarded today", points: 0 });
    await run("UPDATE users SET points = points + 2 WHERE id = ?", [userId]);
    await run("INSERT INTO point_transactions (user_id, points, reason, reference_type) VALUES (?,?,?,?)", [userId, 2, "Completed daily step goal", "goal_complete"]);
    const user = await get("SELECT points FROM users WHERE id = ?", [userId]);
    res.json({ message: "+2 points for completing your goal!", points: user?.points || 0 });
  } catch (err) {
    res.status(500).json({ message: "Failed to award points" });
  }
});
var stepsRoutes_default = router6;

// server/routes/trackRoutes.ts
import express3 from "express";

// server/controllers/trackController.ts
init_database();
function toMySQLDatetime(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 19).replace("T", " ");
  } catch {
    return null;
  }
}
var saveSession = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const { startTime, endTime, totalSteps, totalDistanceKm, totalDistanceMeters, calories, path: path5 } = req.body;
    let distKm = 0;
    if (totalDistanceKm != null && typeof totalDistanceKm === "number" && totalDistanceKm >= 0) {
      distKm = totalDistanceKm;
    } else if (totalDistanceMeters != null && typeof totalDistanceMeters === "number" && totalDistanceMeters >= 0) {
      distKm = totalDistanceMeters / 1e3;
    }
    const safeSteps = typeof totalSteps === "number" && totalSteps >= 0 ? Math.round(totalSteps) : 0;
    const safeCals = typeof calories === "number" && calories >= 0 ? Math.round(calories) : 0;
    const safePath = Array.isArray(path5) ? path5 : [];
    const { insertId } = await run(
      "INSERT INTO premium_sessions (user_id, start_time, end_time, total_steps, total_distance_km, calories, path_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [userId, toMySQLDatetime(startTime), toMySQLDatetime(endTime), safeSteps, +distKm.toFixed(3), safeCals, JSON.stringify(safePath)]
    );
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const existing = await get("SELECT id, steps, calories_burned, distance_km FROM steps_entries WHERE user_id = ? AND date = ?", [userId, today]);
    if (existing) {
      const mergedSteps = Math.max(existing.steps || 0, safeSteps);
      const mergedCals = Math.max(existing.calories_burned || 0, safeCals);
      const mergedDist = Math.max(existing.distance_km || 0, distKm);
      await run(
        "UPDATE steps_entries SET steps = ?, calories_burned = ?, distance_km = ?, tracking_mode = ? WHERE id = ?",
        [mergedSteps, mergedCals, +mergedDist.toFixed(3), "live", existing.id]
      );
    } else {
      await run(
        "INSERT INTO steps_entries (user_id, date, steps, calories_burned, distance_km, tracking_mode) VALUES (?, ?, ?, ?, ?, ?)",
        [userId, today, safeSteps, safeCals, +distKm.toFixed(3), "live"]
      );
    }
    return res.json({ ok: true, sessionId: insertId });
  } catch (err) {
    console.error("saveSession error", err);
    return res.status(500).json({ message: "Failed to save session" });
  }
};

// server/routes/trackRoutes.ts
init_auth();
var router7 = express3.Router();
router7.post("/sessions", authenticateToken, saveSession);
var trackRoutes_default = router7;

// server/routes/analyticsRoutes.ts
import { Router as Router5 } from "express";

// server/controllers/analyticsController.ts
init_database();
var getMyAnalytics = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const days = Math.min(365, Math.max(7, parseInt(String(req.query.days || "30"))));
    const totalStepsRow = await get("SELECT IFNULL(SUM(steps),0) as totalSteps FROM steps_entries WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)", [userId, days]);
    const totalSteps = totalStepsRow?.totalSteps || 0;
    const distRow = await get("SELECT IFNULL(SUM(distance_km),0) as dist FROM steps_entries WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)", [userId, days]);
    const premiumDistRow = await get("SELECT IFNULL(SUM(total_distance_km),0) as dist FROM premium_sessions WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)", [userId, days]);
    const totalDistance = Number(distRow?.dist || 0) + Number(premiumDistRow?.dist || 0);
    const calRow = await get("SELECT IFNULL(SUM(calories_burned),0) as cal FROM steps_entries WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)", [userId, days]);
    const premiumCalRow = await get("SELECT IFNULL(SUM(calories),0) as cal FROM premium_sessions WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)", [userId, days]);
    const totalCalories = Number(calRow?.cal || 0) + Number(premiumCalRow?.cal || 0);
    const sessionsCountRow = await get("SELECT COUNT(*) as cnt FROM premium_sessions WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)", [userId, days]);
    const sessionsCount = sessionsCountRow?.cnt || 0;
    const recentSessions = await query("SELECT id, start_time, end_time, total_steps, total_distance_km, calories, path_json, created_at FROM premium_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 10", [userId]);
    const weeklyRows = await query("SELECT date, steps, IFNULL(calories_burned,0) as calories FROM steps_entries WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) ORDER BY date ASC", [userId]);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weeklyMap = {};
    weeklyRows.forEach((r) => {
      weeklyMap[r.date] = r;
    });
    const weekly = Array.from({ length: 7 }).map((_, i) => {
      const d = /* @__PURE__ */ new Date();
      d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toISOString().split("T")[0];
      const dayLabel = dayNames[d.getDay()];
      return weeklyMap[dateStr] ? { day: dayLabel, steps: weeklyMap[dateStr].steps, calories: weeklyMap[dateStr].calories } : { day: dayLabel, steps: 0, calories: 0 };
    });
    res.json({ totalSteps, totalDistance, totalCalories, sessionsCount, recentSessions, weekly, days });
  } catch (error) {
    console.error("Get analytics error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// server/routes/analyticsRoutes.ts
init_auth();
var router8 = Router5();
router8.get("/me", authenticateToken, getMyAnalytics);
var analyticsRoutes_default = router8;

// server/routes/coachingRoutes.ts
import { Router as Router6 } from "express";

// server/controllers/coachingController.ts
init_database();
init_upload();
var bookSession = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { coachId, date, time, note, bookingType, plan, level } = req.body;
    if (!coachId) return res.status(400).json({ message: "coachId required" });
    const nowBodyPhoto = req.files?.nowBodyPhoto?.[0] ? await uploadToR2(req.files.nowBodyPhoto[0], "coaching") : null;
    const dreamBodyPhoto = req.files?.dreamBodyPhoto?.[0] ? await uploadToR2(req.files.dreamBodyPhoto[0], "coaching") : null;
    const { insertId } = await run(
      "INSERT INTO coaching_bookings (user_id, coach_id, date, time, note, booking_type, plan, level, now_body_photo, dream_body_photo, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')",
      [userId, coachId, date || "", time || "", note || "", bookingType || "session", plan || "complete", level || "1", nowBodyPhoto, dreamBodyPhoto]
    );
    return res.json({ success: true, bookingId: insertId });
  } catch (err) {
    console.error("Booking error", err);
    return res.status(500).json({ message: "Booking failed" });
  }
};

// server/routes/coachingRoutes.ts
init_auth();
init_upload();
init_database();
var router9 = Router6();
router9.post("/book", authenticateToken, upload.fields([{ name: "nowBodyPhoto", maxCount: 1 }, { name: "dreamBodyPhoto", maxCount: 1 }]), optimizeImage(), bookSession);
router9.get("/reviews/:coachId", authenticateToken, async (req, res) => {
  try {
    const reviews = await query(`SELECT r.id, r.rating, r.text, r.created_at, u.name as userName FROM coach_reviews r LEFT JOIN users u ON r.user_id = u.id WHERE r.coach_id = ? ORDER BY r.created_at DESC LIMIT 50`, [req.params.coachId]);
    res.json({ reviews });
  } catch {
    res.status(500).json({ message: "Failed to fetch reviews" });
  }
});
router9.post("/reviews", authenticateToken, async (req, res) => {
  const { coachId, rating, text } = req.body;
  if (!coachId || !rating || !text?.trim()) return res.status(400).json({ message: "Coach ID, rating, and text are required" });
  if (rating < 1 || rating > 5) return res.status(400).json({ message: "Rating must be between 1 and 5" });
  try {
    const existing = await get("SELECT id FROM coach_reviews WHERE coach_id = ? AND user_id = ?", [coachId, req.user.id]);
    if (existing) {
      await run("UPDATE coach_reviews SET rating = ?, text = ?, created_at = NOW() WHERE coach_id = ? AND user_id = ?", [rating, text.trim(), coachId, req.user.id]);
    } else {
      await run("INSERT INTO coach_reviews (coach_id, user_id, rating, text) VALUES (?, ?, ?, ?)", [coachId, req.user.id, rating, text.trim()]);
    }
    res.json({ message: "Review submitted successfully" });
  } catch {
    res.status(500).json({ message: "Failed to submit review" });
  }
});
router9.post("/reports", authenticateToken, async (req, res) => {
  const { coachId, reason, details } = req.body || {};
  if (req.user?.role !== "user") {
    return res.status(403).json({ message: "Only users can submit coach reports" });
  }
  if (!coachId || !reason?.trim()) {
    return res.status(400).json({ message: "Coach and reason are required" });
  }
  try {
    const coach = await get("SELECT id, role, name FROM users WHERE id = ?", [coachId]);
    if (!coach || coach.role !== "coach") return res.status(404).json({ message: "Coach not found" });
    const existing = await get(
      `SELECT id FROM coach_reports
       WHERE coach_id = ? AND user_id = ? AND status = 'pending' AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
       LIMIT 1`,
      [coachId, req.user.id]
    );
    if (existing) {
      return res.status(400).json({ message: "You already sent a recent pending report for this coach" });
    }
    await run(
      "INSERT INTO coach_reports (coach_id, user_id, reason, details) VALUES (?,?,?,?)",
      [coachId, req.user.id, String(reason).trim().slice(0, 120), details ? String(details).trim().slice(0, 3e3) : null]
    );
    const admins = await query("SELECT id FROM users WHERE role = 'admin'");
    for (const admin of admins) {
      const nTitle = "\u{1F6A9} New Coach Report";
      const nBody = `A user reported coach ${coach.name || "#" + coachId}.`;
      await run(
        "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
        [admin.id, "coach_report", nTitle, nBody, "/admin/coach-reports"]
      );
      sendPushToUser(admin.id, nTitle, nBody, void 0, "/admin/coach-reports", "coach_report").catch(() => {
      });
    }
    res.json({ message: "Report submitted. Our team will review it." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to submit report" });
  }
});
router9.get("/coaches", authenticateToken, async (_req, res) => {
  try {
    const coaches = await query(`
      SELECT u.id, u.name, u.email, u.avatar, u.role,
        u.membership_paid, u.coach_membership_active,
        COALESCE(cp.bio, '') as bio, 
        COALESCE(cp.specialty, 'General Fitness') as specialty,
        COALESCE(cp.location, '') as location,
        COALESCE(cp.price, 50) as price,
        COALESCE(cp.available, 1) as available,
        COALESCE(cp.sessions_count, 0) as sessions_count,
        COALESCE(cp.plan_types, 'complete') as plan_types,
        COALESCE(cp.monthly_price, 0) as monthly_price,
        COALESCE(cp.yearly_price, 0) as yearly_price,
        COALESCE(cp.certified, 0) as certified,
        cp.certified_until,
        COALESCE(AVG(cr.rating), 0) as rating,
        COUNT(DISTINCT cr.id) as review_count
      FROM users u
      LEFT JOIN coach_profiles cp ON u.id = cp.user_id
      LEFT JOIN coach_reviews cr ON u.id = cr.coach_id
      WHERE u.role = 'coach'
      GROUP BY u.id
      ORDER BY u.membership_paid DESC, rating DESC, u.created_at ASC
    `);
    res.json({ coaches });
  } catch {
    res.status(500).json({ message: "Failed to fetch coaches" });
  }
});
router9.get("/profile", authenticateToken, async (req, res) => {
  try {
    const profile = await get("SELECT * FROM coach_profiles WHERE user_id = ?", [req.user.id]);
    res.json({ profile });
  } catch {
    res.status(500).json({ message: "Failed to fetch profile" });
  }
});
router9.post("/profile", authenticateToken, async (req, res) => {
  const { bio, specialty, location, price, available, planTypes, monthlyPrice, yearlyPrice } = req.body;
  try {
    const existing = await get("SELECT id FROM coach_profiles WHERE user_id = ?", [req.user.id]);
    if (existing) {
      await run(
        "UPDATE coach_profiles SET bio=?, specialty=?, location=?, price=?, available=?, plan_types=?, monthly_price=?, yearly_price=? WHERE user_id=?",
        [bio || "", specialty || "", location || "", price || 50, available ? 1 : 0, planTypes || "complete", monthlyPrice || 0, yearlyPrice || 0, req.user.id]
      );
    } else {
      await run(
        "INSERT INTO coach_profiles (user_id, bio, specialty, location, price, available, plan_types, monthly_price, yearly_price) VALUES (?,?,?,?,?,?,?,?,?)",
        [req.user.id, bio || "", specialty || "", location || "", price || 50, available ? 1 : 0, planTypes || "complete", monthlyPrice || 0, yearlyPrice || 0]
      );
    }
    res.json({ message: "Profile updated" });
  } catch {
    res.status(500).json({ message: "Failed to update profile" });
  }
});
router9.get("/requests", authenticateToken, async (req, res) => {
  try {
    const bookings = await query(`SELECT b.*, u.name as user_name, u.email as user_email, u.avatar as user_avatar FROM coaching_bookings b LEFT JOIN users u ON b.user_id = u.id WHERE b.coach_id = ? ORDER BY b.created_at DESC`, [req.user.id]);
    res.json({ requests: bookings });
  } catch {
    res.status(500).json({ message: "Failed to fetch requests" });
  }
});
router9.patch("/requests/:id/status", authenticateToken, requireActiveCoachMembershipForDeals, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!["accepted", "rejected"].includes(status)) return res.status(400).json({ message: "Invalid status" });
  try {
    const booking = await get("SELECT cb.*, cp.price FROM coaching_bookings cb LEFT JOIN coach_profiles cp ON cb.coach_id = cp.user_id WHERE cb.id = ? AND cb.coach_id = ?", [id, req.user.id]);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    const amount = booking.price || 0;
    const completedAt = status === "accepted" ? (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ") : null;
    await run(
      "UPDATE coaching_bookings SET status = ?, amount = ?, completed_at = ? WHERE id = ? AND coach_id = ?",
      [status, status === "accepted" ? amount : 0, completedAt, id, req.user.id]
    );
    const notifTitle = status === "accepted" ? "Coaching Request Accepted! \u{1F389}" : "Coaching Request Update";
    const notifBody = status === "accepted" ? `Your coaching request has been accepted. Your coach will reach out soon.` : `Your coaching request was reviewed. Please reach out for more info.`;
    await run(
      "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
      [booking.user_id, status === "accepted" ? "booking_accepted" : "booking_rejected", notifTitle, notifBody, "/app/coaching"]
    );
    sendPushFromTemplate(booking.user_id, status === "accepted" ? "booking_accepted" : "booking_rejected", {}, "/app/coaching").catch(() => {
    });
    res.json({ message: "Status updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update status" });
  }
});
router9.get("/my-coach", authenticateToken, async (req, res) => {
  try {
    const booking = await get(
      `SELECT cb.*, u.name as coach_name, u.avatar as coach_avatar, u.email as coach_email,
       cp.specialty, cp.bio, cp.price
       FROM coaching_bookings cb
       LEFT JOIN users u ON cb.coach_id = u.id
       LEFT JOIN coach_profiles cp ON cp.user_id = u.id
       WHERE cb.user_id = ? AND cb.status = 'accepted'
       ORDER BY cb.created_at DESC LIMIT 1`,
      [req.user.id]
    );
    if (!booking) return res.json({ coach: null });
    res.json({ coach: { id: booking.coach_id, name: booking.coach_name, avatar: booking.coach_avatar, email: booking.coach_email, specialty: booking.specialty, bio: booking.bio, price: booking.price } });
  } catch {
    res.status(500).json({ message: "Failed to fetch coach" });
  }
});
router9.post("/gift", authenticateToken, async (req, res) => {
  const { coachId, amount, message } = req.body;
  if (!coachId || !amount || amount <= 0) return res.status(400).json({ message: "Coach ID and valid amount required" });
  try {
    const sub = await get("SELECT id FROM coach_subscriptions WHERE user_id = ? AND coach_id = ? AND status = ? AND (expires_at IS NULL OR expires_at > NOW())", [req.user.id, coachId, "active"]);
    if (!sub) return res.status(403).json({ message: "You can only send gifts to coaches you are subscribed to" });
    const user = await get("SELECT points FROM users WHERE id = ?", [req.user.id]);
    if (!user || user.points < amount) return res.status(400).json({ message: "Insufficient points balance" });
    await run("UPDATE users SET points = points - ? WHERE id = ?", [amount, req.user.id]);
    await run("UPDATE users SET credit = credit + ? WHERE id = ?", [amount, coachId]);
    await run(
      "INSERT INTO credit_transactions (user_id, amount, type, description) VALUES (?, ?, ?, ?)",
      [coachId, amount, "gift", `Gift from user #${req.user.id}: ${message || "No message"}`]
    );
    await run(
      "INSERT INTO point_transactions (user_id, points, reason, reference_type) VALUES (?, ?, ?, ?)",
      [req.user.id, -amount, `Gift to coach #${coachId}`, "gift"]
    );
    const sender = await get("SELECT name FROM users WHERE id = ?", [req.user.id]);
    const nTitle = "\u{1F381} Gift Received!";
    const nBody = `${sender?.name || "A user"} sent you ${amount} points${message ? ": " + message : ""}`;
    await run(
      "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?)",
      [coachId, "gift_received", nTitle, nBody, "/coach/profile"]
    );
    sendPushToUser(coachId, nTitle, nBody, void 0, "/coach/profile", "gift_received").catch(() => {
    });
    res.json({ message: "Gift sent successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send gift" });
  }
});
router9.get("/certification", authenticateToken, async (req, res) => {
  try {
    const profile = await get("SELECT certified, certified_until FROM coach_profiles WHERE user_id = ?", [req.user.id]);
    const feeSetting = await get("SELECT setting_value FROM app_settings WHERE setting_key = 'certified_coach_fee'");
    const fee = Number(feeSetting?.setting_value) || 500;
    const isCertified = profile?.certified === 1 && profile?.certified_until && new Date(profile.certified_until) > /* @__PURE__ */ new Date();
    const pendingReq = await get(
      "SELECT id, status, national_id_url, certification_url, admin_notes, created_at, reviewed_at FROM certification_requests WHERE coach_id = ? ORDER BY created_at DESC LIMIT 1",
      [req.user.id]
    );
    res.json({
      certified: !!isCertified,
      certified_until: profile?.certified_until || null,
      fee,
      request: pendingReq || null
    });
  } catch {
    res.status(500).json({ message: "Failed to fetch certification status" });
  }
});
router9.post("/certification/subscribe", authenticateToken, upload.fields([
  { name: "nationalId", maxCount: 1 },
  { name: "certificationDoc", maxCount: 1 }
]), optimizeImage(), async (req, res) => {
  try {
    const files = req.files;
    if (!files?.nationalId?.[0] || !files?.certificationDoc?.[0]) {
      return res.status(400).json({ message: "Both National ID and Certification document are required" });
    }
    const existing = await get(
      "SELECT id FROM certification_requests WHERE coach_id = ? AND status = 'pending'",
      [req.user.id]
    );
    if (existing) {
      return res.status(400).json({ message: "You already have a pending certification request. Please wait for admin review." });
    }
    const feeSetting = await get("SELECT setting_value FROM app_settings WHERE setting_key = 'certified_coach_fee'");
    const fee = Number(feeSetting?.setting_value) || 500;
    const user = await get("SELECT credit FROM users WHERE id = ?", [req.user.id]);
    if (!user || Number(user.credit) < fee) {
      return res.status(400).json({ message: `Insufficient credit. You need ${fee} EGP. Current balance: ${Number(user?.credit || 0)} EGP` });
    }
    const nationalIdUrl = await uploadToR2(files.nationalId[0], "certifications");
    const certificationUrl = await uploadToR2(files.certificationDoc[0], "certifications");
    await run("UPDATE users SET credit = credit - ? WHERE id = ?", [fee, req.user.id]);
    await run(
      "INSERT INTO credit_transactions (user_id, amount, type, description) VALUES (?, ?, ?, ?)",
      [req.user.id, -fee, "certification", `Certified Coach request - ${fee} EGP`]
    );
    await run(
      "INSERT INTO certification_requests (coach_id, status, national_id_url, certification_url, amount_paid) VALUES (?, ?, ?, ?, ?)",
      [req.user.id, "pending", nationalIdUrl, certificationUrl, fee]
    );
    const admins = await query("SELECT id FROM users WHERE role = 'admin'");
    for (const admin of admins) {
      const nTitle = "\u{1F4CB} New Certification Request";
      const nBody = "A coach has submitted a certification request for review.";
      await run(
        "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?)",
        [admin.id, "certification_request", nTitle, nBody, "/admin/certifications"]
      );
      sendPushToUser(admin.id, nTitle, nBody, void 0, "/admin/certifications", "certification_request").catch(() => {
      });
    }
    res.json({ message: "Certification request submitted! Please wait for admin review." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to submit certification request" });
  }
});
var coachingRoutes_default = router9;

// server/routes/adminRoutes.ts
init_auth();
init_database();
init_upload();
import { Router as Router7 } from "express";
import bcrypt2 from "bcryptjs";
var router10 = Router7();
var adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") return res.status(403).json({ message: "Admin access required" });
  next();
};
router10.post("/bootstrap-admin", async (req, res) => {
  try {
    const secret = process.env.ADMIN_BOOTSTRAP_SECRET;
    if (!secret) return res.status(503).json({ message: "Bootstrap not enabled. Set ADMIN_BOOTSTRAP_SECRET in .env" });
    if (req.body?.secret !== secret) return res.status(403).json({ message: "Invalid bootstrap secret" });
    const email = (req.body?.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ message: "email required" });
    const user = await get("SELECT id, email, role FROM users WHERE email = ?", [email]);
    if (!user) return res.status(404).json({ message: "User not found" });
    await run("UPDATE users SET role = ?, membership_paid = 1 WHERE id = ?", ["admin", user.id]);
    res.json({ message: `\u2705 ${email} is now admin`, previous_role: user.role });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});
router10.get("/users", authenticateToken, adminOnly, async (_req, res) => {
  try {
    const users = await query("SELECT id, name, email, role, avatar, is_premium, points, steps, step_goal, height, weight, gender, medical_history, medical_file_url, membership_paid, coach_membership_active, created_at FROM users ORDER BY created_at DESC");
    res.json({ users });
  } catch {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});
router10.patch("/users/:id/role", authenticateToken, adminOnly, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  if (!["user", "coach", "admin", "moderator"].includes(role)) return res.status(400).json({ message: "Invalid role" });
  await run("UPDATE users SET role = ? WHERE id = ?", [role, id]);
  res.json({ message: "Role updated" });
});
router10.delete("/users/:id", authenticateToken, adminOnly, async (req, res) => {
  const userId = Number(req.params.id);
  if (!userId || userId <= 0) return res.status(400).json({ message: "Invalid user ID" });
  try {
    await run("SET FOREIGN_KEY_CHECKS = 0");
    try {
      const cleanupTables = [
        "DELETE FROM post_likes WHERE user_id = ?",
        "DELETE FROM post_comments WHERE user_id = ?",
        "DELETE FROM posts WHERE user_id = ?",
        "DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?",
        "DELETE FROM coach_subscriptions WHERE user_id = ? OR coach_id = ?",
        "DELETE FROM daily_summaries WHERE user_id = ?",
        "DELETE FROM steps_entries WHERE user_id = ?",
        "DELETE FROM payments WHERE user_id = ?",
        "DELETE FROM gifts WHERE user_id = ?",
        "DELETE FROM user_follows WHERE follower_id = ? OR following_id = ?",
        "DELETE FROM challenge_participants WHERE user_id = ?",
        "DELETE FROM chat_requests WHERE sender_id = ? OR receiver_id = ?",
        "DELETE FROM workout_plans WHERE user_id = ? OR coach_id = ?",
        "DELETE FROM nutrition_plans WHERE user_id = ? OR coach_id = ?",
        "DELETE FROM notifications WHERE user_id = ?",
        "DELETE FROM credit_transactions WHERE user_id = ?",
        "DELETE FROM premium_sessions WHERE user_id = ?",
        "DELETE FROM coaching_meetings WHERE user_id = ? OR coach_id = ?",
        "DELETE FROM withdrawal_requests WHERE coach_id = ?",
        "DELETE FROM push_tokens WHERE user_id = ?",
        "DELETE FROM push_log WHERE user_id = ?",
        "DELETE FROM coach_ads WHERE coach_id = ?",
        "DELETE FROM point_transactions WHERE user_id = ?",
        "DELETE FROM coach_reviews WHERE user_id = ? OR coach_id = ?",
        "DELETE FROM coach_reports WHERE user_id = ? OR coach_id = ?",
        "DELETE FROM coaching_bookings WHERE user_id = ? OR coach_id = ?",
        "DELETE FROM user_workout_plans WHERE user_id = ?",
        "DELETE FROM user_nutrition_plans WHERE user_id = ?",
        "DELETE FROM ad_payments WHERE coach_id = ?",
        "DELETE FROM coach_follows WHERE follower_id = ? OR coach_id = ?",
        "DELETE FROM user_progress_photos WHERE user_id = ?",
        "DELETE FROM certification_requests WHERE coach_id = ?",
        "DELETE FROM meeting_files WHERE uploaded_by = ?",
        "DELETE FROM meeting_messages WHERE sender_id = ?",
        "DELETE FROM paymob_transactions WHERE user_id = ?",
        "DELETE FROM coach_profiles WHERE user_id = ?"
      ];
      for (const sql of cleanupTables) {
        try {
          const paramCount = (sql.match(/\?/g) || []).length;
          await run(sql, paramCount === 2 ? [userId, userId] : [userId]);
        } catch {
        }
      }
      const result = await run("DELETE FROM users WHERE id = ?", [userId]);
      if (!result?.affectedRows) {
        return res.status(404).json({ message: "User not found" });
      }
    } finally {
      await run("SET FOREIGN_KEY_CHECKS = 1");
    }
    res.json({ message: "User deleted" });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ message: "Failed to delete user" });
  }
});
router10.post("/users/:id/add-points", authenticateToken, adminOnly, async (req, res) => {
  const { id } = req.params;
  const { points } = req.body;
  await run("UPDATE users SET points = points + ? WHERE id = ?", [points || 0, id]);
  res.json({ message: "Points added" });
});
router10.post("/users/:id/upload-medical", authenticateToken, adminOnly, upload.single("medical"), optimizeImage(), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file provided" });
    const userId = Number(req.params.id);
    if (!userId) return res.status(400).json({ message: "Invalid user id" });
    const fileUrl = await uploadToR2(req.file, "medical");
    await run("UPDATE users SET medical_file_url = ?, updated_at = NOW() WHERE id = ?", [fileUrl, userId]);
    res.json({ message: "Medical file uploaded", file_url: fileUrl });
  } catch {
    res.status(500).json({ message: "Failed to upload medical file" });
  }
});
router10.put("/users/:id", authenticateToken, adminOnly, async (req, res) => {
  try {
    const oldId = Number(req.params.id);
    if (!oldId) return res.status(400).json({ message: "Invalid user id" });
    const existing = await get("SELECT * FROM users WHERE id = ?", [oldId]);
    if (!existing) return res.status(404).json({ message: "User not found" });
    const body = req.body || {};
    const nextId = body.id !== void 0 && body.id !== null && String(body.id).trim() !== "" ? Number(body.id) : oldId;
    if (!nextId || Number.isNaN(nextId) || nextId < 1) {
      return res.status(400).json({ message: "Invalid new ID" });
    }
    if (nextId !== oldId) {
      const idConflict = await get("SELECT id FROM users WHERE id = ?", [nextId]);
      if (idConflict) return res.status(409).json({ message: "New ID is already used by another account" });
      const refs = await Promise.all([
        get("SELECT COUNT(*) as c FROM daily_summaries WHERE user_id = ?", [oldId]),
        get("SELECT COUNT(*) as c FROM steps_entries WHERE user_id = ?", [oldId]),
        get("SELECT COUNT(*) as c FROM messages WHERE sender_id = ? OR receiver_id = ?", [oldId, oldId]),
        get("SELECT COUNT(*) as c FROM posts WHERE user_id = ?", [oldId]),
        get("SELECT COUNT(*) as c FROM post_likes WHERE user_id = ?", [oldId]),
        get("SELECT COUNT(*) as c FROM post_comments WHERE user_id = ?", [oldId]),
        get("SELECT COUNT(*) as c FROM user_follows WHERE follower_id = ? OR following_id = ?", [oldId, oldId]),
        get("SELECT COUNT(*) as c FROM challenge_participants WHERE user_id = ?", [oldId]),
        get("SELECT COUNT(*) as c FROM premium_sessions WHERE user_id = ?", [oldId]),
        get("SELECT COUNT(*) as c FROM chat_requests WHERE sender_id = ? OR receiver_id = ?", [oldId, oldId]),
        get("SELECT COUNT(*) as c FROM workout_plans WHERE user_id = ? OR coach_id = ?", [oldId, oldId]),
        get("SELECT COUNT(*) as c FROM nutrition_plans WHERE user_id = ? OR coach_id = ?", [oldId, oldId]),
        get("SELECT COUNT(*) as c FROM gifts WHERE user_id = ? OR admin_id = ?", [oldId, oldId]),
        get("SELECT COUNT(*) as c FROM payments WHERE user_id = ?", [oldId]),
        get("SELECT COUNT(*) as c FROM coach_subscriptions WHERE user_id = ? OR coach_id = ?", [oldId, oldId]),
        get("SELECT COUNT(*) as c FROM withdrawal_requests WHERE coach_id = ?", [oldId]),
        get("SELECT COUNT(*) as c FROM ad_payments WHERE coach_id = ?", [oldId]),
        get("SELECT COUNT(*) as c FROM coach_ads WHERE coach_id = ?", [oldId])
      ]);
      const totalRefs = refs.reduce((sum, r) => sum + Number(r?.c || 0), 0);
      if (totalRefs > 0) {
        return res.status(409).json({
          message: "Cannot change user ID after activity exists. Create a new user instead."
        });
      }
    }
    const role = body.role ?? existing.role;
    if (!["user", "coach", "admin", "moderator"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }
    const email = String(body.email ?? existing.email).trim().toLowerCase();
    if (!email) return res.status(400).json({ message: "Email is required" });
    const emailConflict = await get("SELECT id FROM users WHERE email = ? AND id != ?", [email, oldId]);
    if (emailConflict) return res.status(409).json({ message: "Email is already used by another account" });
    let nextPassword = existing.password;
    if (body.password !== void 0 && String(body.password).trim() !== "") {
      const plain = String(body.password);
      if (plain.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
      nextPassword = await bcrypt2.hash(plain, 10);
    }
    const computedIsPremium = Number(existing.is_premium || 0);
    await run(
      `UPDATE users SET
        id = ?,
        name = ?,
        email = ?,
        password = ?,
        role = ?,
        avatar = ?,
        is_premium = ?,
        points = ?,
        steps = ?,
        height = ?,
        weight = ?,
        gender = ?,
        medical_history = ?,
        medical_file_url = ?,
        membership_paid = ?,
        coach_membership_active = ?,
        step_goal = ?,
        updated_at = NOW()
      WHERE id = ?`,
      [
        nextId,
        String(body.name ?? existing.name ?? "").trim(),
        email,
        nextPassword,
        role,
        String(body.avatar ?? existing.avatar ?? "").trim(),
        computedIsPremium,
        body.points !== void 0 ? Number(body.points || 0) : Number(existing.points || 0),
        body.steps !== void 0 ? Number(body.steps || 0) : Number(existing.steps || 0),
        body.height !== void 0 && body.height !== "" ? Number(body.height) : existing.height ?? null,
        body.weight !== void 0 && body.weight !== "" ? Number(body.weight) : existing.weight ?? null,
        body.gender !== void 0 ? String(body.gender || "").trim() : existing.gender ?? null,
        body.medical_history !== void 0 ? String(body.medical_history || "").trim() : String(existing.medical_history || ""),
        body.medical_file_url !== void 0 ? String(body.medical_file_url || "").trim() : String(existing.medical_file_url || ""),
        body.membership_paid !== void 0 ? body.membership_paid ? 1 : 0 : Number(existing.membership_paid || 0),
        body.coach_membership_active !== void 0 ? body.coach_membership_active ? 1 : 0 : Number(existing.coach_membership_active || 0),
        body.step_goal !== void 0 && body.step_goal !== "" ? Number(body.step_goal) : Number(existing.step_goal || 1e4),
        oldId
      ]
    );
    const updated = await get(
      "SELECT id, name, email, role, avatar, is_premium, points, steps, step_goal, height, weight, gender, medical_history, medical_file_url, membership_paid, coach_membership_active, created_at FROM users WHERE id = ?",
      [nextId]
    );
    res.json({ message: "User updated", user: updated });
  } catch {
    res.status(500).json({ message: "Failed to update user" });
  }
});
router10.post("/gifts", authenticateToken, adminOnly, async (req, res) => {
  const { user_id, title, description, type, value } = req.body;
  const { insertId } = await run("INSERT INTO gifts (user_id, admin_id, title, description, type, value) VALUES (?, ?, ?, ?, ?, ?)", [user_id, req.user.id, title, description, type, value]);
  if (type === "points" && value) await run("UPDATE users SET points = points + ? WHERE id = ?", [value, user_id]);
  res.json({ gift: { id: insertId, user_id, title, type, value } });
});
router10.get("/gifts", authenticateToken, adminOnly, async (_req, res) => {
  try {
    const gifts = await query(`SELECT g.*, u.name as user_name, u.email as user_email FROM gifts g LEFT JOIN users u ON g.user_id = u.id ORDER BY g.created_at DESC`);
    res.json({ gifts });
  } catch {
    res.status(500).json({ message: "Failed to fetch gifts" });
  }
});
router10.get("/videos", authenticateToken, adminOnly, async (_req, res) => {
  try {
    const videos = await query(
      `SELECT wv.*, submitter.name AS submitted_by_name, approver.name AS approved_by_name
       FROM workout_videos wv
       LEFT JOIN users submitter ON submitter.id = wv.submitted_by
       LEFT JOIN users approver ON approver.id = wv.approved_by
       ORDER BY wv.created_at DESC`
    );
    res.json({ videos });
  } catch {
    res.status(500).json({ message: "Failed to fetch videos" });
  }
});
router10.post("/videos", authenticateToken, adminOnly, uploadVideo.fields([
  { name: "video", maxCount: 1 },
  { name: "thumbnail", maxCount: 1 }
]), validateVideoSize, optimizeImage(), async (req, res) => {
  try {
    const { title, description, duration, category, is_premium } = req.body;
    if (!title) return res.status(400).json({ message: "Title is required" });
    const isShort = req.body.is_short === "1" || req.body.is_short === true ? 1 : 0;
    const files = req.files;
    const videoFile = files?.video?.[0];
    const thumbnailFile = files?.thumbnail?.[0];
    if (!videoFile) return res.status(400).json({ message: "Video file is required" });
    const videoUrl = await uploadToR2(videoFile, "videos");
    const thumbnailUrl = thumbnailFile ? await uploadToR2(thumbnailFile, "thumbnails") : null;
    const durationSeconds = videoFile.size > 0 ? Math.ceil(videoFile.size / (1024 * 1024)) : parseInt(duration || "0");
    const { insertId } = await run(
      "INSERT INTO workout_videos (title, description, url, duration, duration_seconds, category, is_premium, thumbnail, is_short, source_type, approval_status, submitted_by, approved_by, approved_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [title, description || "", videoUrl, duration || "", durationSeconds, category || "General", is_premium === "1" || is_premium === true ? 1 : 0, thumbnailUrl || "", isShort, "upload", "approved", req.user.id, req.user.id, /* @__PURE__ */ new Date()]
    );
    const coachId = req.body.coach_id ? parseInt(req.body.coach_id) : null;
    if (coachId) await run("UPDATE workout_videos SET coach_id = ? WHERE id = ?", [coachId, insertId]);
    const video = await get("SELECT * FROM workout_videos WHERE id = ?", [insertId]);
    res.json({ video, message: "Video uploaded successfully" });
  } catch (err) {
    console.error("Video upload error:", err);
    res.status(500).json({ message: "Failed to upload video" });
  }
});
router10.post("/videos/youtube", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { title, description, duration, category, is_premium, is_short, coach_id, youtube_url } = req.body;
    if (!title) return res.status(400).json({ message: "Title is required" });
    if (!youtube_url) return res.status(400).json({ message: "YouTube URL is required" });
    const ytRegex = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = youtube_url.match(ytRegex);
    if (!match) return res.status(400).json({ message: "Invalid YouTube URL. Please provide a valid YouTube video link." });
    const videoId = match[1];
    const embedUrl = `https://www.youtube.com/embed/${videoId}`;
    const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    const isShortVal = is_short === "1" || is_short === true ? 1 : 0;
    const isPremiumVal = is_premium === "1" || is_premium === true ? 1 : 0;
    const { insertId } = await run(
      "INSERT INTO workout_videos (title, description, url, youtube_url, source_type, duration, duration_seconds, category, is_premium, thumbnail, is_short, approval_status, submitted_by, approved_by, approved_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [title, description || "", embedUrl, youtube_url, "youtube", duration || "", 0, category || "General", isPremiumVal, thumbnail, isShortVal, "approved", req.user.id, req.user.id, /* @__PURE__ */ new Date()]
    );
    const coachIdVal = coach_id ? parseInt(coach_id) : null;
    if (coachIdVal) await run("UPDATE workout_videos SET coach_id = ? WHERE id = ?", [coachIdVal, insertId]);
    const video = await get("SELECT * FROM workout_videos WHERE id = ?", [insertId]);
    res.json({ video, message: "YouTube video added successfully" });
  } catch (err) {
    console.error("YouTube video creation error:", err);
    res.status(500).json({ message: "Failed to add YouTube video" });
  }
});
router10.patch("/videos/:id", authenticateToken, adminOnly, uploadVideo.fields([
  { name: "video", maxCount: 1 },
  { name: "thumbnail", maxCount: 1 }
]), validateVideoSize, optimizeImage(), async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await get("SELECT * FROM workout_videos WHERE id = ?", [id]);
    if (!existing) return res.status(404).json({ message: "Video not found" });
    const files = req.files;
    const videoFile = files?.video?.[0];
    const thumbnailFile = files?.thumbnail?.[0];
    const videoUrl = videoFile ? await uploadToR2(videoFile, "videos") : existing.url;
    const thumbnailUrl = thumbnailFile ? await uploadToR2(thumbnailFile, "thumbnails") : existing.thumbnail;
    const { title, description, duration, category, is_premium } = req.body;
    const isShort = req.body.is_short === "1" || req.body.is_short === true ? 1 : req.body.is_short === "0" || req.body.is_short === false ? 0 : existing.is_short || 0;
    await run(
      "UPDATE workout_videos SET title=?, description=?, url=?, duration=?, category=?, is_premium=?, thumbnail=?, is_short=?, updated_at=NOW() WHERE id=?",
      [
        title || existing.title,
        description ?? existing.description,
        videoUrl,
        duration || existing.duration,
        category || existing.category,
        is_premium === "1" || is_premium === true ? 1 : 0,
        thumbnailUrl,
        isShort,
        id
      ]
    );
    const coachIdPatch = req.body.coach_id !== void 0 ? req.body.coach_id ? parseInt(req.body.coach_id) : null : void 0;
    if (coachIdPatch !== void 0) await run("UPDATE workout_videos SET coach_id = ? WHERE id = ?", [coachIdPatch, id]);
    res.json({ message: "Video updated" });
  } catch (err) {
    res.status(500).json({ message: "Failed to update video" });
  }
});
router10.patch("/videos/:id/approval", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { status, reason } = req.body || {};
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid approval status" });
    }
    const existing = await get("SELECT * FROM workout_videos WHERE id = ?", [req.params.id]);
    if (!existing) return res.status(404).json({ message: "Video not found" });
    await run(
      "UPDATE workout_videos SET approval_status = ?, rejection_reason = ?, approved_by = ?, approved_at = ?, updated_at = NOW() WHERE id = ?",
      [status, status === "rejected" ? reason || "" : null, req.user.id, status === "approved" ? /* @__PURE__ */ new Date() : null, req.params.id]
    );
    const notifyUserId = existing.submitted_by || existing.coach_id;
    if (notifyUserId) {
      const nTitle = status === "approved" ? "Video Approved" : "Video Rejected";
      const nBody = status === "approved" ? `Your video "${existing.title}" is now live.` : `Your video "${existing.title}" was rejected.${reason ? ` Reason: ${reason}` : ""}`;
      await run(
        "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
        [notifyUserId, "video_review", nTitle, nBody, "/coach/profile"]
      );
      sendPushToUser(notifyUserId, nTitle, nBody, void 0, "/coach/profile", "video_review").catch(() => {
      });
    }
    const video = await get("SELECT * FROM workout_videos WHERE id = ?", [req.params.id]);
    res.json({ video, message: status === "approved" ? "Video approved" : "Video rejected" });
  } catch (err) {
    console.error("Video approval error:", err);
    res.status(500).json({ message: "Failed to update video approval" });
  }
});
router10.delete("/videos/:id", authenticateToken, adminOnly, async (req, res) => {
  try {
    await run("DELETE FROM workout_videos WHERE id = ?", [req.params.id]);
    res.json({ message: "Video deleted" });
  } catch {
    res.status(500).json({ message: "Failed to delete video" });
  }
});
router10.get("/playlists", authenticateToken, adminOnly, async (_req, res) => {
  try {
    const playlists = await query(`
      SELECT p.*, u.name as creator_name,
             (SELECT COUNT(*) FROM playlist_videos WHERE playlist_id = p.id) as video_count
      FROM video_playlists p
      LEFT JOIN users u ON p.created_by = u.id
      ORDER BY p.sort_order, p.created_at DESC`);
    res.json({ playlists });
  } catch {
    res.status(500).json({ message: "Failed to fetch playlists" });
  }
});
router10.post("/playlists", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { title, description, thumbnail, is_public } = req.body;
    if (!title) return res.status(400).json({ message: "Title is required" });
    const { insertId } = await run(
      "INSERT INTO video_playlists (title, description, thumbnail, created_by, is_public) VALUES (?,?,?,?,?)",
      [title, description || "", thumbnail || "", req.user.id, is_public !== false ? 1 : 0]
    );
    const playlist = await get("SELECT * FROM video_playlists WHERE id = ?", [insertId]);
    res.json({ playlist, message: "Playlist created" });
  } catch {
    res.status(500).json({ message: "Failed to create playlist" });
  }
});
router10.patch("/playlists/:id", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { title, description, thumbnail, is_public } = req.body;
    await run(
      "UPDATE video_playlists SET title=?, description=?, thumbnail=?, is_public=?, updated_at=NOW() WHERE id=?",
      [title, description || "", thumbnail || "", is_public ? 1 : 0, req.params.id]
    );
    res.json({ message: "Playlist updated" });
  } catch {
    res.status(500).json({ message: "Failed to update playlist" });
  }
});
router10.delete("/playlists/:id", authenticateToken, adminOnly, async (req, res) => {
  try {
    await run("DELETE FROM video_playlists WHERE id = ?", [req.params.id]);
    res.json({ message: "Playlist deleted" });
  } catch {
    res.status(500).json({ message: "Failed to delete playlist" });
  }
});
router10.get("/playlists/:id/videos", authenticateToken, adminOnly, async (req, res) => {
  try {
    const videos = await query(
      `SELECT v.*, pv.sort_order as playlist_order FROM playlist_videos pv
       JOIN workout_videos v ON v.id = pv.video_id
       WHERE pv.playlist_id = ?
       ORDER BY pv.sort_order`,
      [req.params.id]
    );
    res.json({ videos });
  } catch {
    res.status(500).json({ message: "Failed to fetch playlist videos" });
  }
});
router10.post("/playlists/:id/videos", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { video_id } = req.body;
    const maxOrder = await get("SELECT MAX(sort_order) as m FROM playlist_videos WHERE playlist_id = ?", [req.params.id]);
    await run(
      "INSERT INTO playlist_videos (playlist_id, video_id, sort_order) VALUES (?,?,?)",
      [req.params.id, video_id, (maxOrder?.m || 0) + 1]
    );
    res.json({ message: "Video added to playlist" });
  } catch {
    res.status(500).json({ message: "Failed to add video to playlist" });
  }
});
router10.delete("/playlists/:id/videos/:videoId", authenticateToken, adminOnly, async (req, res) => {
  try {
    await run("DELETE FROM playlist_videos WHERE playlist_id = ? AND video_id = ?", [req.params.id, req.params.videoId]);
    res.json({ message: "Video removed from playlist" });
  } catch {
    res.status(500).json({ message: "Failed to remove video" });
  }
});
router10.get("/website-translations", authenticateToken, adminOnly, async (_req, res) => {
  try {
    const rows = await query("SELECT text_key, text_ar FROM website_translations ORDER BY text_key");
    const translations = {};
    for (const r of rows) translations[r.text_key] = r.text_ar;
    res.json({ translations });
  } catch {
    res.status(500).json({ message: "Failed to fetch translations" });
  }
});
router10.put("/website-translations", authenticateToken, adminOnly, async (req, res) => {
  try {
    const entries = req.body?.translations;
    if (!entries || typeof entries !== "object") return res.status(400).json({ message: "Invalid data" });
    for (const [key, value] of Object.entries(entries)) {
      if (typeof key !== "string" || typeof value !== "string") continue;
      await run(
        "INSERT INTO website_translations (text_key, text_ar) VALUES (?,?) ON DUPLICATE KEY UPDATE text_ar=?, updated_at=NOW()",
        [key.slice(0, 500), value, value]
      );
    }
    res.json({ message: "Translations saved" });
  } catch {
    res.status(500).json({ message: "Failed to save translations" });
  }
});
router10.get("/website-translations/public", async (_req, res) => {
  try {
    const rows = await query("SELECT text_key, text_ar FROM website_translations ORDER BY text_key");
    const translations = {};
    for (const r of rows) translations[r.text_key] = r.text_ar;
    res.json({ translations });
  } catch {
    res.status(500).json({ message: "Failed to fetch translations" });
  }
});
router10.get("/ads", authenticateToken, adminOnly, async (req, res) => {
  try {
    await run("UPDATE coach_ads SET status = 'expired' WHERE status = 'active' AND boost_end IS NOT NULL AND boost_end < NOW()");
    const ads = await query(`
      SELECT a.*, u.name as coach_name, u.email as coach_email, u.avatar as coach_avatar,
             COALESCE(ap.amount, 0) as paid_amount, COALESCE(ap.duration_minutes, 0) as paid_minutes,
             ap.status as payment_status, ap.proof_url as payment_proof, ap.phone as payment_phone
      FROM coach_ads a
      LEFT JOIN users u ON a.coach_id = u.id
      LEFT JOIN ad_payments ap ON ap.ad_id = a.id
      ORDER BY FIELD(a.status, 'pending', 'active', 'expired', 'rejected'), a.created_at DESC`);
    res.json({ ads });
  } catch {
    res.status(500).json({ message: "Failed to fetch ads" });
  }
});
router10.patch("/ads/:id", authenticateToken, adminOnly, async (req, res) => {
  const { id } = req.params;
  const { title, description, specialty, cta, highlight, status } = req.body;
  try {
    await run(
      "UPDATE coach_ads SET title=?, description=?, specialty=?, cta=?, highlight=?, status=?, updated_at=NOW() WHERE id=?",
      [title, description, specialty, cta, highlight, status, id]
    );
    res.json({ message: "Ad updated" });
  } catch {
    res.status(500).json({ message: "Failed to update ad" });
  }
});
router10.patch("/ads/:id/status", authenticateToken, adminOnly, async (req, res) => {
  const { id } = req.params;
  const { status, admin_note } = req.body;
  if (!["active", "pending", "rejected", "expired"].includes(status)) return res.status(400).json({ message: "Invalid status" });
  try {
    const ad = await get("SELECT * FROM coach_ads WHERE id = ?", [id]);
    if (status === "active") {
      const totalMinutes = (ad?.duration_hours || 0) * 60 + (ad?.duration_days || 0) * 24 * 60;
      if (totalMinutes > 0) {
        await run("UPDATE coach_ads SET status = ?, admin_note = ?, boost_start = NOW(), boost_end = DATE_ADD(NOW(), INTERVAL ? MINUTE), updated_at = NOW() WHERE id = ?", [status, admin_note || null, totalMinutes, id]);
      } else {
        await run("UPDATE coach_ads SET status = ?, admin_note = ?, boost_start = NOW(), boost_end = DATE_ADD(NOW(), INTERVAL 7 DAY), updated_at = NOW() WHERE id = ?", [status, admin_note || null, id]);
      }
    } else {
      await run("UPDATE coach_ads SET status = ?, admin_note = ?, updated_at = NOW() WHERE id = ?", [status, admin_note || null, id]);
    }
    if (status === "rejected" && ad?.coach_id) {
      const reason = admin_note ? `: ${admin_note}` : "";
      const nTitle = "\u274C Ad Rejected";
      const nBody = `Your ad "${ad.title || "Untitled"}" has been rejected${reason}`;
      await run(
        "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
        [ad.coach_id, "ad_rejected", nTitle, nBody, "/coach/ads/my-ads"]
      );
      sendPushToUser(ad.coach_id, nTitle, nBody, void 0, "/coach/ads/my-ads", "ad_rejected").catch(() => {
      });
    }
    res.json({ message: `Ad ${status}` });
  } catch {
    res.status(500).json({ message: "Failed to update ad status" });
  }
});
router10.delete("/ads/:id", authenticateToken, adminOnly, async (req, res) => {
  try {
    await run("DELETE FROM ad_payments WHERE ad_id = ?", [req.params.id]);
    await run("DELETE FROM coach_ads WHERE id = ?", [req.params.id]);
    res.json({ message: "Ad deleted" });
  } catch {
    res.status(500).json({ message: "Failed to delete ad" });
  }
});
router10.patch("/ads/:id/payment", authenticateToken, adminOnly, async (req, res) => {
  const { id } = req.params;
  const { payment_status } = req.body;
  try {
    await run("UPDATE ad_payments SET status = ?, updated_at = NOW() WHERE ad_id = ?", [payment_status, id]);
    if (payment_status === "approved") {
      const payment = await get("SELECT amount, duration_minutes FROM ad_payments WHERE ad_id = ? AND status = ?", [id, "approved"]);
      const paidAmount = payment?.amount || 0;
      const totalMinutes = payment?.duration_minutes || 0;
      if (totalMinutes > 0) {
        await run(
          `UPDATE coach_ads SET status = 'active', payment_status = 'approved', paid_amount = ?,
           boost_start = NOW(), boost_end = DATE_ADD(NOW(), INTERVAL ? MINUTE), updated_at = NOW()
           WHERE id = ?`,
          [paidAmount, totalMinutes, id]
        );
      } else {
        const ad = await get("SELECT schedule_start, schedule_end, daily_budget, total_budget, budget_type FROM coach_ads WHERE id = ?", [id]);
        const budget = ad?.budget_type === "daily" ? ad?.daily_budget : ad?.total_budget;
        const effectivePaid = paidAmount || budget || 0;
        await run(
          `UPDATE coach_ads SET status = 'active', payment_status = 'approved', paid_amount = ?,
           boost_start = NOW(),
           boost_end = COALESCE(schedule_end, DATE_ADD(NOW(), INTERVAL 7 DAY)),
           updated_at = NOW()
           WHERE id = ?`,
          [effectivePaid, id]
        );
      }
    }
    if (payment_status === "rejected") {
      await run("UPDATE coach_ads SET status = 'rejected', payment_status = 'rejected', updated_at = NOW() WHERE id = ?", [id]);
      const ad = await get("SELECT coach_id, title FROM coach_ads WHERE id = ?", [id]);
      if (ad?.coach_id) {
        const nTitle = "\u274C Ad Payment Rejected";
        const nBody = `Your payment for ad "${ad.title || "Untitled"}" has been rejected.`;
        await run(
          "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
          [ad.coach_id, "ad_rejected", nTitle, nBody, "/coach/ads/my-ads"]
        );
        sendPushToUser(ad.coach_id, nTitle, nBody, void 0, "/coach/ads/my-ads", "ad_rejected").catch(() => {
        });
      }
    }
    res.json({ message: "Payment status updated" });
  } catch {
    res.status(500).json({ message: "Failed to update payment" });
  }
});
router10.get("/ads/stats", authenticateToken, adminOnly, async (_req, res) => {
  try {
    const [totalRow] = await query("SELECT COUNT(*) as total FROM coach_ads");
    const [activeRow] = await query("SELECT COUNT(*) as cnt FROM coach_ads WHERE status = 'active'");
    const [pendingRow] = await query("SELECT COUNT(*) as cnt FROM coach_ads WHERE status = 'pending'");
    const [rejectedRow] = await query("SELECT COUNT(*) as cnt FROM coach_ads WHERE status = 'rejected'");
    const [expiredRow] = await query("SELECT COUNT(*) as cnt FROM coach_ads WHERE status = 'expired' OR (status = 'active' AND boost_end IS NOT NULL AND boost_end < NOW())");
    const [revenueRow] = await query("SELECT IFNULL(SUM(amount),0) as total FROM ad_payments WHERE status = 'approved'");
    const [pendingRevRow] = await query("SELECT IFNULL(SUM(amount),0) as total FROM ad_payments WHERE status = 'pending'");
    const [impressionRow] = await query("SELECT IFNULL(SUM(impressions),0) as total FROM coach_ads");
    const [clickRow] = await query("SELECT IFNULL(SUM(clicks),0) as total FROM coach_ads");
    res.json({
      total: totalRow?.total || 0,
      active: activeRow?.cnt || 0,
      pending: pendingRow?.cnt || 0,
      rejected: rejectedRow?.cnt || 0,
      expired: expiredRow?.cnt || 0,
      adRevenue: parseFloat(revenueRow?.total || 0),
      pendingRevenue: parseFloat(pendingRevRow?.total || 0),
      totalImpressions: impressionRow?.total || 0,
      totalClicks: clickRow?.total || 0
    });
  } catch {
    res.status(500).json({ message: "Failed to fetch ad stats" });
  }
});
router10.get("/payments", authenticateToken, adminOnly, async (_req, res) => {
  try {
    const payments = await query(`SELECT p.*, u.name as user_name, u.email as user_email FROM payments p LEFT JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC`);
    res.json({ payments });
  } catch {
    res.status(500).json({ message: "Failed to fetch payments" });
  }
});
router10.get("/payment-settings", authenticateToken, adminOnly, async (_req, res) => {
  try {
    const rows = await query("SELECT setting_key, setting_value FROM payment_settings");
    const settings = {};
    for (const row of rows) settings[row.setting_key] = row.setting_value;
    res.json({ settings });
  } catch {
    res.status(500).json({ message: "Failed to fetch payment settings" });
  }
});
router10.put("/payment-settings", authenticateToken, adminOnly, async (req, res) => {
  const allowed = [
    // PayPal
    "paypal_user_link",
    "paypal_coach_link",
    "paypal_user_client_id",
    "paypal_coach_client_id",
    "paypal_user_secret",
    "paypal_coach_secret",
    "paypal_mode",
    "paypal_webhook_id",
    // E-Wallets (manual)
    "ewallet_phone",
    "ewallet_phone_vodafone",
    "ewallet_phone_orange",
    "ewallet_phone_we",
    // Paymob (automated)
    "paymob_api_key",
    "paymob_integration_id_card",
    "paymob_integration_id_wallet",
    "paymob_iframe_id",
    "paymob_hmac_secret",
    "paymob_disbursement_api_key",
    // Fawry
    "fawry_merchant_code",
    "fawry_merchant_ref_number",
    // Mode toggles (1 = enabled, 0 = disabled)
    "paymob_auto_enabled",
    "paymob_manual_enabled",
    "fawry_auto_enabled",
    "fawry_manual_enabled",
    "pm_orange_cash",
    "pm_vodafone_cash",
    "pm_we_pay",
    "pm_paypal",
    "pm_credit_card",
    "pm_google_pay",
    "pm_apple_pay",
    "google_play_enabled",
    "google_play_product_id_monthly",
    "google_play_product_id_annual",
    "apple_pay_enabled",
    "apple_pay_product_id_monthly",
    "apple_pay_product_id_annual",
    // Revenue & rates
    "coach_cut_percentage",
    "egp_usd_rate"
  ];
  try {
    const body = req.body;
    for (const key of Object.keys(body)) {
      if (!allowed.includes(key)) continue;
      await run(
        "INSERT INTO payment_settings (setting_key, setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_value=?, updated_at=NOW()",
        [key, body[key], body[key]]
      );
    }
    res.json({ message: "Payment settings saved" });
  } catch (err) {
    res.status(500).json({ message: "Failed to save payment settings" });
  }
});
router10.get("/server-url", authenticateToken, adminOnly, async (_req, res) => {
  try {
    const rows = await query(
      "SELECT setting_value FROM payment_settings WHERE setting_key = 'server_url'"
    );
    res.json({ url: rows.length ? rows[0].setting_value : "" });
  } catch {
    res.status(500).json({ message: "Failed to fetch server URL" });
  }
});
router10.put("/server-url", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { url } = req.body;
    await run(
      "INSERT INTO payment_settings (setting_key, setting_value) VALUES ('server_url', ?) ON DUPLICATE KEY UPDATE setting_value=?, updated_at=NOW()",
      [url || "", url || ""]
    );
    res.json({ message: "Server URL saved", url: url || "" });
  } catch {
    res.status(500).json({ message: "Failed to save server URL" });
  }
});
router10.get("/ping", (_req, res) => {
  res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
router10.post("/generate-coach-profiles", authenticateToken, adminOnly, async (_req, res) => {
  try {
    const count = 5;
    const firstNames = ["Karim", "Omar", "Hassan", "Mina", "Yousef", "Nadine", "Rania", "Mariam", "Salma", "Lina"];
    const lastNames = ["Mostafa", "Hamed", "Samir", "Nabil", "Farouk", "Ibrahim", "Mahmoud", "Adel", "Tarek", "Kamel"];
    const created = [];
    const hashed = await bcrypt2.hash("CoachPass123!", 10);
    const baseTs = Date.now();
    for (let i = 0; i < count; i++) {
      const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
      const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
      const suffix = `${baseTs}${i}`;
      const name = `${fn} ${ln}`;
      const email = `${fn.toLowerCase()}.${ln.toLowerCase()}.${suffix}@fitwayhub.coach`;
      const avatar = null;
      const steps = 9e3 + Math.floor(Math.random() * 7e3);
      const points = 800 + Math.floor(Math.random() * 2200);
      try {
        await run(
          `INSERT INTO users (email, password, name, role, avatar, is_premium, membership_paid, coach_membership_active, points, steps, step_goal)
           VALUES (?, ?, ?, 'coach', ?, 0, 1, 1, ?, ?, 12000)`,
          [email, hashed, name, avatar, points, steps]
        );
        created.push(name);
      } catch {
      }
    }
    res.json({ message: `Created ${created.length} coach profiles`, coaches: created });
  } catch (err) {
    res.status(500).json({ message: "Failed to generate coach profiles", error: err?.message || "Unknown error" });
  }
});
var adminOrModerator = (req, res, next) => {
  if (req.user?.role !== "admin" && req.user?.role !== "moderator") return res.status(403).json({ message: "Access denied" });
  next();
};
router10.get("/community/posts", authenticateToken, adminOrModerator, async (_req, res) => {
  try {
    const posts = await query(`
      SELECT p.*, u.name as user_name, u.avatar as user_avatar, u.email as user_email, u.role as user_role,
             (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes,
             (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) as comment_count,
             mu.name as moderator_name
      FROM posts p 
      JOIN users u ON p.user_id = u.id 
      LEFT JOIN users mu ON p.moderated_by = mu.id
      ORDER BY p.is_pinned DESC, p.is_announcement DESC, p.created_at DESC LIMIT 200`);
    res.json({ posts });
  } catch {
    res.status(500).json({ message: "Failed to fetch posts" });
  }
});
router10.post("/community/announcements", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { content, hashtags } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ message: "Content is required" });
    const result = await run(
      "INSERT INTO posts (user_id, content, hashtags, is_announcement, is_pinned) VALUES (?, ?, ?, 1, 1)",
      [req.user.id, content.trim(), hashtags || null]
    );
    res.json({ message: "Announcement posted", postId: result.insertId });
  } catch {
    res.status(500).json({ message: "Failed to create announcement" });
  }
});
router10.patch("/community/posts/:id/pin", authenticateToken, adminOnly, async (req, res) => {
  try {
    const post = await get("SELECT is_pinned FROM posts WHERE id = ?", [req.params.id]);
    if (!post) return res.status(404).json({ message: "Post not found" });
    const newVal = post.is_pinned ? 0 : 1;
    await run("UPDATE posts SET is_pinned = ? WHERE id = ?", [newVal, req.params.id]);
    res.json({ message: newVal ? "Post pinned" : "Post unpinned", is_pinned: newVal });
  } catch {
    res.status(500).json({ message: "Failed to toggle pin" });
  }
});
router10.patch("/community/posts/:id/hide", authenticateToken, adminOrModerator, async (req, res) => {
  try {
    const { reason } = req.body;
    await run("UPDATE posts SET is_hidden = 1, moderated_by = ?, moderation_reason = ? WHERE id = ?", [req.user.id, reason || "Policy violation", req.params.id]);
    res.json({ message: "Post hidden" });
  } catch {
    res.status(500).json({ message: "Failed to hide post" });
  }
});
router10.patch("/community/posts/:id/restore", authenticateToken, adminOrModerator, async (req, res) => {
  try {
    await run("UPDATE posts SET is_hidden = 0, moderated_by = NULL, moderation_reason = NULL WHERE id = ?", [req.params.id]);
    res.json({ message: "Post restored" });
  } catch {
    res.status(500).json({ message: "Failed to restore post" });
  }
});
router10.delete("/community/posts/:id", authenticateToken, adminOrModerator, async (req, res) => {
  try {
    await run("DELETE FROM posts WHERE id = ?", [req.params.id]);
    res.json({ message: "Post deleted" });
  } catch {
    res.status(500).json({ message: "Failed to delete post" });
  }
});
router10.get("/community/stats", authenticateToken, adminOrModerator, async (_req, res) => {
  try {
    const [totalPosts] = await query("SELECT COUNT(*) as cnt FROM posts");
    const [hiddenPosts] = await query("SELECT COUNT(*) as cnt FROM posts WHERE is_hidden = 1");
    const [totalComments] = await query("SELECT COUNT(*) as cnt FROM post_comments");
    const [totalChallenges] = await query("SELECT COUNT(*) as cnt FROM challenges");
    const [activeChallenges] = await query("SELECT COUNT(*) as cnt FROM challenges WHERE end_date >= CURDATE()");
    const [totalLikes] = await query("SELECT IFNULL(SUM(likes),0) as total FROM posts");
    res.json({
      totalPosts: totalPosts.cnt,
      hiddenPosts: hiddenPosts.cnt,
      totalComments: totalComments.cnt,
      totalChallenges: totalChallenges.cnt,
      activeChallenges: activeChallenges.cnt,
      totalLikes: totalLikes.total
    });
  } catch {
    res.status(500).json({ message: "Failed to fetch community stats" });
  }
});
router10.get("/community/challenges", authenticateToken, adminOrModerator, async (_req, res) => {
  try {
    const challenges = await query(`
      SELECT c.*, u.name as creator_name, u.email as creator_email, u.avatar as creator_avatar,
             (SELECT COUNT(*) FROM challenge_participants WHERE challenge_id = c.id) as participant_count
      FROM challenges c
      LEFT JOIN users u ON c.creator_id = u.id
      ORDER BY c.created_at DESC LIMIT 100`);
    res.json({ challenges });
  } catch {
    res.status(500).json({ message: "Failed to fetch challenges" });
  }
});
router10.delete("/community/challenges/:id", authenticateToken, adminOnly, async (req, res) => {
  try {
    await run("DELETE FROM challenges WHERE id = ?", [req.params.id]);
    res.json({ message: "Challenge deleted" });
  } catch {
    res.status(500).json({ message: "Failed to delete challenge" });
  }
});
router10.get("/community/comments", authenticateToken, adminOrModerator, async (_req, res) => {
  try {
    const comments = await query(`
      SELECT pc.*, u.name as user_name, u.email as user_email, u.avatar as user_avatar,
             p.content as post_preview
      FROM post_comments pc
      LEFT JOIN users u ON pc.user_id = u.id
      LEFT JOIN posts p ON pc.post_id = p.id
      ORDER BY pc.created_at DESC LIMIT 200`);
    res.json({ comments });
  } catch {
    res.status(500).json({ message: "Failed to fetch comments" });
  }
});
router10.delete("/community/comments/:id", authenticateToken, adminOrModerator, async (req, res) => {
  try {
    await run("DELETE FROM post_comments WHERE id = ?", [req.params.id]);
    res.json({ message: "Comment deleted" });
  } catch {
    res.status(500).json({ message: "Failed to delete comment" });
  }
});
router10.get("/app-settings", authenticateToken, adminOnly, async (_req, res) => {
  try {
    await seedDefaultAppSettings();
    const rows = await query("SELECT * FROM app_settings ORDER BY category, id");
    const byCategory = {};
    for (const r of rows) {
      if (!byCategory[r.category]) byCategory[r.category] = [];
      byCategory[r.category].push(r);
    }
    res.json({ settings: rows, byCategory });
  } catch (err) {
    console.error("[app-settings] ERROR:", err?.message || err);
    res.status(500).json({ message: "Failed to fetch settings" });
  }
});
router10.put("/app-settings", authenticateToken, adminOnly, async (req, res) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      await run("UPDATE app_settings SET setting_value = ? WHERE setting_key = ?", [value, key]);
    }
    res.json({ message: "Settings saved" });
  } catch {
    res.status(500).json({ message: "Failed to save settings" });
  }
});
router10.post("/app-settings/add", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { key, value, type, category, label } = req.body;
    if (!key || !category) return res.status(400).json({ message: "Key and category are required" });
    const safeKey = String(key).replace(/[^a-zA-Z0-9_]/g, "_").substring(0, 100);
    const existing = await get("SELECT id FROM app_settings WHERE setting_key = ?", [safeKey]);
    if (existing) return res.status(409).json({ message: "Setting already exists" });
    await run(
      "INSERT INTO app_settings (setting_key, setting_value, setting_type, category, label) VALUES (?, ?, ?, ?, ?)",
      [safeKey, value || "", type || "text", category, label || safeKey]
    );
    res.json({ message: "Setting added", key: safeKey });
  } catch {
    res.status(500).json({ message: "Failed to add setting" });
  }
});
router10.delete("/app-settings/:key", authenticateToken, adminOnly, async (req, res) => {
  try {
    const safeKey = String(req.params.key).replace(/[^a-zA-Z0-9_]/g, "_");
    await run("DELETE FROM app_settings WHERE setting_key = ?", [safeKey]);
    res.json({ message: "Setting deleted" });
  } catch {
    res.status(500).json({ message: "Failed to delete setting" });
  }
});
router10.patch("/users/:id/coach-membership", authenticateToken, adminOnly, async (req, res) => {
  const { membership_paid, coach_membership_active } = req.body;
  try {
    await run(
      "UPDATE users SET membership_paid = ?, coach_membership_active = ? WHERE id = ?",
      [membership_paid ? 1 : 0, membership_paid ? 1 : 0, req.params.id]
    );
    res.json({ message: "Coach membership updated" });
  } catch {
    res.status(500).json({ message: "Failed to update membership" });
  }
});
router10.get("/certification-requests", authenticateToken, adminOnly, async (_req, res) => {
  try {
    const requests = await query(
      `SELECT cr.*, u.name as coach_name, u.email as coach_email, u.avatar as coach_avatar,
              cp.specialty, cp.certified, cp.certified_until,
              reviewer.name as reviewer_name
       FROM certification_requests cr
       JOIN users u ON cr.coach_id = u.id
       LEFT JOIN coach_profiles cp ON cp.user_id = u.id
       LEFT JOIN users reviewer ON cr.reviewed_by = reviewer.id
       ORDER BY FIELD(cr.status, 'pending', 'approved', 'rejected'), cr.created_at DESC`
    );
    res.json({ requests });
  } catch {
    res.status(500).json({ message: "Failed to fetch certification requests" });
  }
});
router10.patch("/certification-requests/:id", authenticateToken, adminOnly, async (req, res) => {
  const { action, admin_notes } = req.body;
  if (!["approve", "reject"].includes(action)) return res.status(400).json({ message: "Invalid action" });
  try {
    const request = await get("SELECT * FROM certification_requests WHERE id = ?", [req.params.id]);
    if (!request) return res.status(404).json({ message: "Request not found" });
    if (request.status !== "pending") return res.status(400).json({ message: "Request already reviewed" });
    const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
    if (action === "approve") {
      const d = /* @__PURE__ */ new Date();
      d.setMonth(d.getMonth() + 1);
      const until = d.toISOString().slice(0, 19).replace("T", " ");
      const existing = await get("SELECT id FROM coach_profiles WHERE user_id = ?", [request.coach_id]);
      if (existing) {
        await run("UPDATE coach_profiles SET certified = 1, certified_until = ? WHERE user_id = ?", [until, request.coach_id]);
      } else {
        await run("INSERT INTO coach_profiles (user_id, certified, certified_until) VALUES (?, 1, ?)", [request.coach_id, until]);
      }
      await run(
        "UPDATE certification_requests SET status = ?, admin_notes = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?",
        ["approved", admin_notes || null, req.user.id, now, req.params.id]
      );
      {
        const nTitle = "\u2705 Certification Approved!";
        const nBody = `Your certification has been approved! You are now a Certified Coach until ${new Date(until).toLocaleDateString()}.`;
        await run(
          "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?)",
          [request.coach_id, "certification", nTitle, nBody, "/coach/profile"]
        );
        sendPushToUser(request.coach_id, nTitle, nBody, void 0, "/coach/profile", "certification").catch(() => {
        });
      }
    } else {
      if (request.amount_paid > 0) {
        await run("UPDATE users SET credit = credit + ? WHERE id = ?", [request.amount_paid, request.coach_id]);
        await run(
          "INSERT INTO credit_transactions (user_id, amount, type, description) VALUES (?, ?, ?, ?)",
          [request.coach_id, request.amount_paid, "certification_refund", `Certification request rejected - ${request.amount_paid} EGP refunded`]
        );
      }
      await run(
        "UPDATE certification_requests SET status = ?, admin_notes = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?",
        ["rejected", admin_notes || null, req.user.id, now, req.params.id]
      );
      {
        const nTitle = "\u274C Certification Rejected";
        const nBody = `Your certification request was rejected.${admin_notes ? " Reason: " + admin_notes : ""} Your payment of ${request.amount_paid} EGP has been refunded.`;
        await run(
          "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?)",
          [request.coach_id, "certification", nTitle, nBody, "/coach/profile"]
        );
        sendPushToUser(request.coach_id, nTitle, nBody, void 0, "/coach/profile", "certification").catch(() => {
        });
      }
    }
    res.json({ message: `Certification request ${action}d successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update certification request" });
  }
});
router10.patch("/users/:id/certification", authenticateToken, adminOnly, async (req, res) => {
  const { certified } = req.body;
  try {
    const existing = await get("SELECT id FROM coach_profiles WHERE user_id = ?", [req.params.id]);
    if (!existing) return res.status(404).json({ message: "Coach profile not found" });
    if (certified) {
      const d = /* @__PURE__ */ new Date();
      d.setMonth(d.getMonth() + 1);
      const until = d.toISOString().slice(0, 19).replace("T", " ");
      await run("UPDATE coach_profiles SET certified = 1, certified_until = ? WHERE user_id = ?", [until, req.params.id]);
    } else {
      await run("UPDATE coach_profiles SET certified = 0, certified_until = NULL WHERE user_id = ?", [req.params.id]);
    }
    res.json({ message: `Coach certification ${certified ? "granted" : "revoked"}` });
  } catch {
    res.status(500).json({ message: "Failed to update certification" });
  }
});
router10.get("/coach-reports", authenticateToken, adminOnly, async (_req, res) => {
  try {
    const reports = await query(
      `SELECT cr.*, 
              coach.name as coach_name, coach.email as coach_email, coach.avatar as coach_avatar,
              reporter.name as user_name, reporter.email as user_email,
              reviewer.name as reviewer_name
       FROM coach_reports cr
       JOIN users coach ON coach.id = cr.coach_id
       JOIN users reporter ON reporter.id = cr.user_id
       LEFT JOIN users reviewer ON reviewer.id = cr.reviewed_by
       ORDER BY FIELD(cr.status, 'pending', 'resolved', 'dismissed'), cr.created_at DESC`
    );
    res.json({ reports });
  } catch {
    res.status(500).json({ message: "Failed to fetch coach reports" });
  }
});
router10.patch("/coach-reports/:id", authenticateToken, adminOnly, async (req, res) => {
  const { status, admin_notes } = req.body || {};
  if (!["resolved", "dismissed"].includes(status)) {
    return res.status(400).json({ message: "Status must be resolved or dismissed" });
  }
  try {
    const report = await get("SELECT * FROM coach_reports WHERE id = ?", [req.params.id]);
    if (!report) return res.status(404).json({ message: "Report not found" });
    if (report.status !== "pending") return res.status(400).json({ message: "Report already reviewed" });
    await run(
      "UPDATE coach_reports SET status = ?, admin_notes = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?",
      [status, admin_notes ? String(admin_notes).trim().slice(0, 3e3) : null, req.user.id, req.params.id]
    );
    const title = status === "resolved" ? "Your report was resolved" : "Your report was reviewed";
    const body = status === "resolved" ? "Thank you. We reviewed your coach report and took action according to our policy." : "We reviewed your coach report and did not find enough evidence for action right now.";
    await run(
      "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
      [report.user_id, "coach_report", title, body, "/app/coaching"]
    );
    sendPushToUser(report.user_id, title, body, void 0, "/app/coaching", "coach_report").catch(() => {
    });
    res.json({ message: "Report updated successfully" });
  } catch {
    res.status(500).json({ message: "Failed to update report" });
  }
});
router10.get("/fonts", async (_req, res) => {
  try {
    const rows = await query("SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('font_en','font_ar','font_heading')");
    const fonts = {};
    for (const r of rows) fonts[r.setting_key] = r.setting_value;
    res.json(fonts);
  } catch {
    res.json({ font_en: "Outfit", font_ar: "Cairo", font_heading: "Chakra Petch" });
  }
});
router10.get("/branding", async (_req, res) => {
  try {
    const rows = await query("SELECT setting_key, setting_value FROM app_settings WHERE category = 'branding'");
    const branding = {};
    for (const r of rows) branding[r.setting_key] = r.setting_value || "";
    res.json(branding);
  } catch {
    res.json({ app_name: "FitWay Hub" });
  }
});
router10.get("/features", async (_req, res) => {
  try {
    const rows = await query("SELECT setting_key, setting_value FROM app_settings WHERE category = 'features'");
    const features = {};
    for (const r of rows) {
      const raw = String(r.setting_value ?? "").toLowerCase();
      features[r.setting_key] = raw === "1" || raw === "true" || raw === "on";
    }
    res.json({ features });
  } catch {
    res.json({ features: {} });
  }
});
router10.get("/dashboard-config", async (_req, res) => {
  try {
    const rows = await query("SELECT setting_key, setting_value, setting_type FROM app_settings WHERE category = 'dashboard'");
    const config = {};
    for (const r of rows) {
      const raw = String(r.setting_value ?? "");
      if (r.setting_type === "boolean") {
        config[r.setting_key] = raw === "1" || raw === "true" || raw === "on";
      } else {
        config[r.setting_key] = raw;
      }
    }
    res.json({ config });
  } catch {
    res.json({ config: {} });
  }
});
router10.post("/upload-branding-image", authenticateToken, adminOnly, upload.single("image"), optimizeImage(), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No image file provided" });
    const imageUrl = await uploadToR2(req.file, "branding");
    res.json({ url: imageUrl });
  } catch {
    res.status(500).json({ message: "Image upload failed" });
  }
});
router10.post("/upload-dashboard-image", authenticateToken, adminOnly, upload.single("image"), optimizeImage(), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No image file provided" });
    const imageUrl = await uploadToR2(req.file, "dashboard");
    res.json({ url: imageUrl });
  } catch {
    res.status(500).json({ message: "Image upload failed" });
  }
});
router10.post("/upload-font", authenticateToken, adminOnly, uploadFont.single("font"), verifyUploadBytes("font"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No font file provided" });
    const fontUrl = await uploadToR2(req.file, "fonts");
    const fontName = req.body.font_name || req.file.originalname.replace(/\.[^.]+$/, "");
    res.json({ url: fontUrl, name: fontName });
  } catch {
    res.status(500).json({ message: "Font upload failed" });
  }
});
var adminRoutes_default = router10;
router10.get("/backup/database", authenticateToken, adminOnly, async (_req, res) => {
  try {
    const pool = getPool();
    const [tables] = await pool.execute(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME`
    );
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const dbName = process.env.DB_NAME || process.env.MYSQL_DATABASE || "fitwayhub";
    let sql = "";
    sql += `-- FitWay Hub Database Backup
`;
    sql += `-- Generated: ${(/* @__PURE__ */ new Date()).toISOString()}
`;
    sql += `-- Database: ${dbName}
`;
    sql += `-- --------------------------------------------------------

`;
    sql += `SET FOREIGN_KEY_CHECKS=0;
`;
    sql += `SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
`;
    sql += `SET time_zone = "+00:00";

`;
    for (const tableRow of tables) {
      const tableName = tableRow.TABLE_NAME;
      const [createRows] = await pool.execute(`SHOW CREATE TABLE \`${tableName}\``);
      const createStmt = createRows[0]["Create Table"];
      sql += `-- --------------------------------------------------------
`;
      sql += `-- Table: \`${tableName}\`
`;
      sql += `-- --------------------------------------------------------

`;
      sql += `DROP TABLE IF EXISTS \`${tableName}\`;
`;
      sql += createStmt + ";\n\n";
      const [rows] = await pool.execute(`SELECT * FROM \`${tableName}\``);
      if (Array.isArray(rows) && rows.length > 0) {
        const cols = Object.keys(rows[0]).map((c) => `\`${c}\``).join(", ");
        const escVal = (v) => {
          if (v === null || v === void 0) return "NULL";
          if (typeof v === "number") return String(v);
          if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace("T", " ")}'`;
          if (typeof v === "boolean") return v ? "1" : "0";
          const str = String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "\\r");
          return `'${str}'`;
        };
        sql += `INSERT INTO \`${tableName}\` (${cols}) VALUES
`;
        const valueRows = rows.map(
          (row) => "(" + Object.values(row).map(escVal).join(", ") + ")"
        );
        for (let i = 0; i < valueRows.length; i += 500) {
          const batch = valueRows.slice(i, i + 500);
          if (i > 0) sql += `INSERT INTO \`${tableName}\` (${cols}) VALUES
`;
          sql += batch.join(",\n") + ";\n";
        }
        sql += "\n";
      }
    }
    sql += `SET FOREIGN_KEY_CHECKS=1;
`;
    sql += `-- End of backup
`;
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="fitwayhub-backup-${timestamp}.sql"`);
    res.setHeader("Content-Length", Buffer.byteLength(sql, "utf8"));
    res.send(sql);
  } catch (err) {
    console.error("[DB Backup] error:", err);
    res.status(500).json({ message: "Backup failed", error: process.env.NODE_ENV !== "production" ? String(err) : void 0 });
  }
});
router10.post("/backup/restore", authenticateToken, adminOnly, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No SQL file uploaded" });
    const sql = req.file.buffer.toString("utf8");
    if (!sql.trim()) return res.status(400).json({ message: "Empty SQL file" });
    const pool = getPool();
    const statements = sql.split(/;\s*\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith("--"));
    let executed = 0;
    let errors = [];
    for (const stmt of statements) {
      if (!stmt) continue;
      try {
        await pool.execute(stmt);
        executed++;
      } catch (err) {
        errors.push(`Statement ${executed + 1}: ${err.message?.slice(0, 100)}`);
      }
    }
    res.json({ message: `Restore complete: ${executed} statements executed`, errors: errors.length ? errors.slice(0, 10) : void 0 });
  } catch (err) {
    console.error("[DB Restore] error:", err);
    res.status(500).json({ message: "Restore failed", error: process.env.NODE_ENV !== "production" ? String(err) : void 0 });
  }
});
router10.post("/generate-fake-users", authenticateToken, adminOnly, async (req, res) => {
  try {
    const count = Math.min(500, Math.max(1, parseInt(req.body.count) || 10));
    const bcrypt3 = (await import("bcryptjs")).default;
    const { run: dbRun } = await Promise.resolve().then(() => (init_database(), database_exports));
    const MALE_NAMES = ["Ahmed Hassan", "Omar Khalid", "Youssef Ibrahim", "Karim Mostafa", "Tarek Nabil", "Mohamed Farouk", "Amir Saleh", "Ziad Tamer", "Sherif Adel", "Hossam Wael", "Mahmoud Ali", "Bassem Nour", "Fady George", "Ramy Samir", "Hazem Walid", "Saad Moustafa", "Amr Diab", "Wael Khairy", "Nader Fawzy", "Khaled Emad"];
    const FEMALE_NAMES = ["Nour El-Din", "Sara Ahmed", "Hana Mostafa", "Rana Khalil", "Dina Fawzy", "Maya Ibrahim", "Laila Hassan", "Yasmine Tarek", "Mariam Sayed", "Reem Nabil", "Nadia Fouad", "Mona Saleh", "Aya Magdy", "Heba Gamal", "Ranya Sherif", "Ghada Wahba", "Samira Lotfy", "Ines Adel", "Farah Zaki", "Lina Nasser"];
    const CITIES = ["Cairo", "Giza", "Alexandria", "Hurghada", "Sharm El Sheikh", "Luxor", "Aswan", "Mansoura", "Tanta", "Suez", "Ismailia", "Port Said", "Zagazig", "Asyut"];
    const GOALS = ["lose_weight", "build_muscle", "maintain_weight", "gain_weight"];
    const LEVELS = ["sedentary", "light", "moderate", "active", "very_active"];
    const BRACKETS = [[18, 24], [25, 34], [35, 44], [45, 54], [55, 65]];
    const fakeH = await bcrypt3.hash("FakePass!2025", 10);
    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const dobFromAge = (age) => {
      const d = /* @__PURE__ */ new Date();
      d.setFullYear(d.getFullYear() - age);
      return d.toISOString().split("T")[0];
    };
    let created = 0;
    const allNames = [...MALE_NAMES.map((n) => ({ name: n, gender: "male" })), ...FEMALE_NAMES.map((n) => ({ name: n, gender: "female" }))];
    for (let i = 0; i < count; i++) {
      const { name, gender } = allNames[i % allNames.length];
      const suffix = Date.now() + i;
      const email = `fake.${name.toLowerCase().replace(/[^a-z]/g, "").slice(0, 8)}${suffix}@gmail.com`;
      const goal = GOALS[i % GOALS.length];
      const level = LEVELS[i % LEVELS.length];
      const bracket = BRACKETS[i % BRACKETS.length];
      const age = rand(bracket[0], bracket[1]);
      const city = CITIES[i % CITIES.length];
      const h = gender === "male" ? rand(168, 188) : rand(155, 172);
      const w = gender === "male" ? rand(65, 98) : rand(48, 75);
      const tgtW = goal === "lose_weight" ? w - rand(5, 20) : goal === "gain_weight" ? w + rand(3, 12) : w;
      try {
        await dbRun(
          `INSERT INTO users (name,email,password,role,is_premium,gender,height,weight,
            date_of_birth,target_weight,weekly_goal,fitness_goal,activity_level,
            onboarding_done,avg_daily_steps,streak_days,step_goal,email_verified,city)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            name,
            email,
            fakeH,
            "user",
            i % 3 === 0 ? 1 : 0,
            gender,
            h,
            w,
            dobFromAge(age),
            tgtW,
            ["0.25", "0.5", "0.75"][i % 3],
            goal,
            level,
            1,
            rand(4e3, 13e3),
            rand(0, 30),
            [8e3, 1e4, 12e3, 15e3][i % 4],
            1,
            city
          ]
        );
        created++;
      } catch {
      }
    }
    res.json({ created, message: `Created ${created} fake users` });
  } catch (err) {
    console.error("[generate-fake-users] error:", err);
    res.status(500).json({ message: "Failed to generate users" });
  }
});
router10.delete("/fake-users", authenticateToken, adminOnly, async (_req, res) => {
  try {
    const fakeUsers = await query(
      `SELECT id FROM users WHERE email LIKE 'fake.%@gmail.com' AND role = 'user'`
    );
    if (!fakeUsers.length) {
      return res.json({ removed: 0, message: "No fake accounts found" });
    }
    const ids = fakeUsers.map((u) => Number(u.id)).filter((id) => id > 0);
    const placeholders = ids.map(() => "?").join(",");
    await run("SET FOREIGN_KEY_CHECKS = 0");
    const cleanupTables = [
      { sql: `DELETE FROM post_likes WHERE user_id IN (${placeholders})` },
      { sql: `DELETE FROM post_comments WHERE user_id IN (${placeholders})` },
      { sql: `DELETE FROM posts WHERE user_id IN (${placeholders})` },
      { sql: `DELETE FROM messages WHERE sender_id IN (${placeholders}) OR receiver_id IN (${placeholders})`, double: true },
      { sql: `DELETE FROM coach_subscriptions WHERE user_id IN (${placeholders}) OR coach_id IN (${placeholders})`, double: true },
      { sql: `DELETE FROM daily_summaries WHERE user_id IN (${placeholders})` },
      { sql: `DELETE FROM steps_entries WHERE user_id IN (${placeholders})` },
      { sql: `DELETE FROM payments WHERE user_id IN (${placeholders})` },
      { sql: `DELETE FROM gifts WHERE user_id IN (${placeholders})` },
      { sql: `DELETE FROM user_follows WHERE follower_id IN (${placeholders}) OR following_id IN (${placeholders})`, double: true },
      { sql: `DELETE FROM challenge_participants WHERE user_id IN (${placeholders})` },
      { sql: `DELETE FROM chat_requests WHERE sender_id IN (${placeholders}) OR receiver_id IN (${placeholders})`, double: true },
      { sql: `DELETE FROM workout_plans WHERE user_id IN (${placeholders}) OR coach_id IN (${placeholders})`, double: true },
      { sql: `DELETE FROM nutrition_plans WHERE user_id IN (${placeholders}) OR coach_id IN (${placeholders})`, double: true },
      { sql: `DELETE FROM notifications WHERE user_id IN (${placeholders})` },
      { sql: `DELETE FROM credit_transactions WHERE user_id IN (${placeholders})` },
      { sql: `DELETE FROM premium_sessions WHERE user_id IN (${placeholders})` },
      { sql: `DELETE FROM coaching_meetings WHERE user_id IN (${placeholders}) OR coach_id IN (${placeholders})`, double: true },
      { sql: `DELETE FROM withdrawal_requests WHERE coach_id IN (${placeholders})` },
      { sql: `DELETE FROM push_tokens WHERE user_id IN (${placeholders})` },
      { sql: `DELETE FROM push_log WHERE user_id IN (${placeholders})` },
      { sql: `DELETE FROM coach_ads WHERE coach_id IN (${placeholders})` },
      { sql: `DELETE FROM point_transactions WHERE user_id IN (${placeholders})` },
      { sql: `DELETE FROM coach_reviews WHERE user_id IN (${placeholders}) OR coach_id IN (${placeholders})`, double: true },
      { sql: `DELETE FROM coach_reports WHERE user_id IN (${placeholders}) OR coach_id IN (${placeholders})`, double: true },
      { sql: `DELETE FROM coaching_bookings WHERE user_id IN (${placeholders}) OR coach_id IN (${placeholders})`, double: true },
      { sql: `DELETE FROM user_workout_plans WHERE user_id IN (${placeholders})` },
      { sql: `DELETE FROM user_nutrition_plans WHERE user_id IN (${placeholders})` },
      { sql: `DELETE FROM ad_payments WHERE coach_id IN (${placeholders})` },
      { sql: `DELETE FROM coach_follows WHERE follower_id IN (${placeholders}) OR coach_id IN (${placeholders})`, double: true },
      { sql: `DELETE FROM user_progress_photos WHERE user_id IN (${placeholders})` },
      { sql: `DELETE FROM certification_requests WHERE coach_id IN (${placeholders})` },
      { sql: `DELETE FROM meeting_files WHERE uploaded_by IN (${placeholders})` },
      { sql: `DELETE FROM meeting_messages WHERE sender_id IN (${placeholders})` },
      { sql: `DELETE FROM paymob_transactions WHERE user_id IN (${placeholders})` },
      { sql: `DELETE FROM coach_profiles WHERE user_id IN (${placeholders})` }
    ];
    let removed = 0;
    try {
      for (const step of cleanupTables) {
        try {
          const params = step.double ? [...ids, ...ids] : ids;
          await run(step.sql, params);
        } catch {
        }
      }
      const result = await run(`DELETE FROM users WHERE id IN (${placeholders})`, ids);
      removed = result?.affectedRows ?? ids.length;
    } finally {
      await run("SET FOREIGN_KEY_CHECKS = 1");
    }
    res.json({ removed, message: `Removed ${removed} fake accounts` });
  } catch {
    try {
      await run("SET FOREIGN_KEY_CHECKS = 1");
    } catch {
    }
    res.status(500).json({ message: "Failed to remove fake accounts" });
  }
});

// server/routes/coachRoutes2.ts
init_auth();
init_upload();
init_database();
import { Router as Router8 } from "express";
var router11 = Router8();
var coachOrAdmin = (req, res, next) => {
  if (req.user?.role !== "coach" && req.user?.role !== "admin")
    return res.status(403).json({ message: "Coach access required" });
  next();
};
function sanitizeAdText(input, maxLen = 500) {
  if (input == null) return "";
  const raw = String(input);
  const noTags = raw.replace(/<[^>]*>/g, "");
  const cleaned = noTags.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").replace(/\s+/g, " ").trim();
  return cleaned.slice(0, maxLen);
}
async function expireAds(coachId) {
  const { expireAndResetAds: expireAndResetAds2 } = await Promise.resolve().then(() => (init_adBillingService(), adBillingService_exports)).catch(() => ({ expireAndResetAds: async () => {
  } }));
  await expireAndResetAds2();
  if (coachId) {
    await run("UPDATE coach_ads SET status='expired' WHERE status='active' AND boost_end IS NOT NULL AND boost_end < NOW() AND (schedule_end IS NULL OR schedule_end < CURDATE()) AND coach_id=?", [coachId]);
  } else {
    await run("UPDATE coach_ads SET status='expired' WHERE status='active' AND boost_end IS NOT NULL AND boost_end < NOW() AND (schedule_end IS NULL OR schedule_end < CURDATE())");
  }
}
async function getTargetedAdsForUser(userId, placementFilter, limit = 20) {
  const viewer = await get(
    `SELECT gender, date_of_birth, fitness_goal, activity_level, computed_activity_level,
            step_goal, latitude, longitude, city, country
     FROM users WHERE id = ?`,
    [userId]
  );
  let viewerAge = null;
  if (viewer?.date_of_birth) {
    const dob = new Date(viewer.date_of_birth);
    viewerAge = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1e3));
  }
  const viewerGender = viewer?.gender || null;
  const viewerGoal = viewer?.fitness_goal || null;
  const viewerActivityLevel = viewer?.computed_activity_level || viewer?.activity_level || null;
  const viewerLat = viewer?.latitude ? parseFloat(viewer.latitude) : null;
  const viewerLng = viewer?.longitude ? parseFloat(viewer.longitude) : null;
  let sql = `
    SELECT a.*, u.name AS coach_name, u.avatar AS coach_avatar, u.email AS coach_email
    FROM coach_ads a
    INNER JOIN users u ON a.coach_id = u.id AND u.role = 'coach'
    WHERE a.status = 'active'
      AND a.coach_id IS NOT NULL
      AND (a.payment_status = 'approved' OR a.payment_status IS NULL OR a.payment_status = '')
  `;
  const params = [];
  if (placementFilter) {
    sql += ` AND (a.placement = 'all' OR a.placement = ? OR a.ad_type = ?)`;
    params.push(placementFilter, placementFilter);
  }
  if (viewerGender) {
    sql += ` AND (a.audience_gender IS NULL OR a.audience_gender = 'all' OR a.audience_gender = ?)`;
    params.push(viewerGender);
  }
  if (viewerAge !== null) {
    sql += ` AND (a.audience_age_min IS NULL OR a.audience_age_min = 0 OR a.audience_age_min <= ?)`;
    params.push(viewerAge);
    sql += ` AND (a.audience_age_max IS NULL OR a.audience_age_max = 0 OR a.audience_age_max >= ?)`;
    params.push(viewerAge);
  }
  if (viewerGoal) {
    sql += ` AND (
      a.audience_goals IS NULL OR a.audience_goals = '' OR
      FIND_IN_SET(?, a.audience_goals) > 0
    )`;
    params.push(viewerGoal);
  }
  if (viewerActivityLevel) {
    sql += ` AND (
      a.audience_activity_levels IS NULL OR a.audience_activity_levels = '' OR
      FIND_IN_SET(?, a.audience_activity_levels) > 0
    )`;
    params.push(viewerActivityLevel);
  }
  if (viewerLat !== null && viewerLng !== null) {
    sql += ` AND (
      a.target_lat IS NULL OR a.target_lng IS NULL OR
      (
        6371 * ACOS(
          LEAST(1.0, COS(RADIANS(?)) * COS(RADIANS(a.target_lat)) *
          COS(RADIANS(a.target_lng) - RADIANS(?)) +
          SIN(RADIANS(?)) * SIN(RADIANS(a.target_lat)))
        ) <= COALESCE(a.target_radius_km, 50)
      )
    )`;
    params.push(viewerLat, viewerLng, viewerLat);
  }
  sql += ` AND (a.schedule_start IS NULL OR a.schedule_start <= CURDATE())`;
  sql += ` AND (a.schedule_end IS NULL OR a.schedule_end >= CURDATE())`;
  sql += ` ORDER BY a.amount_spent DESC, a.created_at DESC LIMIT ?`;
  params.push(limit);
  return query(sql, params);
}
router11.get("/ads/public", authenticateToken, async (req, res) => {
  try {
    await expireAds();
    const ads = await getTargetedAdsForUser(req.user.id, void 0, 20);
    res.json({ ads });
  } catch {
    res.status(500).json({ message: "Failed to fetch ads" });
  }
});
router11.get("/ads/public/home", authenticateToken, async (req, res) => {
  try {
    await expireAds();
    const coachAds = await getTargetedAdsForUser(req.user.id, "home_banner", 5);
    let campaignAds = [];
    try {
      campaignAds = await query(
        `SELECT a.id, a.headline AS title, a.body AS description, 
                c.media_url AS image_url, c.thumbnail_url,
                a.cta, a.destination_type, a.destination_ref,
                camp.objective, camp.coach_id,
                u.name AS coach_name, u.avatar AS coach_avatar
         FROM ads a
         JOIN ad_sets s ON a.ad_set_id = s.id
         JOIN ad_campaigns camp ON a.campaign_id = camp.id
         LEFT JOIN ad_creatives c ON a.creative_id = c.id
         INNER JOIN users u ON camp.coach_id = u.id AND u.role = 'coach'
         WHERE a.status = 'active'
           AND camp.status = 'active'
           AND s.status = 'active'
           AND camp.coach_id IS NOT NULL
           AND (s.placement = 'all' OR s.placement = 'home_banner' OR s.placement = 'feed')
           AND (camp.schedule_start IS NULL OR camp.schedule_start <= CURDATE())
           AND (camp.schedule_end IS NULL OR camp.schedule_end >= CURDATE())
         ORDER BY camp.amount_spent DESC, camp.created_at DESC
         LIMIT 5`,
        []
      );
    } catch {
    }
    const merged = [
      ...coachAds.map((a) => ({ ...a, _src: "coach" })),
      ...campaignAds.map((a) => ({ ...a, _src: "campaign" }))
    ].slice(0, 5);
    res.json({ ads: merged });
  } catch {
    res.status(500).json({ message: "Failed to fetch home ads" });
  }
});
router11.get("/ads/public/community", authenticateToken, async (req, res) => {
  try {
    await expireAds();
    const coachAds = await getTargetedAdsForUser(req.user.id, "community", 5);
    let campaignAds = [];
    try {
      campaignAds = await query(
        `SELECT a.id, a.headline AS title, a.body AS description, 
                c.media_url AS image_url, c.thumbnail_url,
                a.cta, a.destination_type, a.destination_ref,
                camp.objective, camp.coach_id,
                u.name AS coach_name, u.avatar AS coach_avatar
         FROM ads a
         JOIN ad_sets s ON a.ad_set_id = s.id
         JOIN ad_campaigns camp ON a.campaign_id = camp.id
         LEFT JOIN ad_creatives c ON a.creative_id = c.id
         INNER JOIN users u ON camp.coach_id = u.id AND u.role = 'coach'
         WHERE a.status = 'active'
           AND camp.status = 'active'
           AND s.status = 'active'
           AND camp.coach_id IS NOT NULL
           AND (s.placement = 'all' OR s.placement = 'community' OR s.placement = 'feed')
           AND (camp.schedule_start IS NULL OR camp.schedule_start <= CURDATE())
           AND (camp.schedule_end IS NULL OR camp.schedule_end >= CURDATE())
         ORDER BY camp.amount_spent DESC, camp.created_at DESC
         LIMIT 5`,
        []
      );
    } catch {
    }
    const merged = [
      ...coachAds.map((a) => ({ ...a, _src: "coach" })),
      ...campaignAds.map((a) => ({ ...a, _src: "campaign" }))
    ].slice(0, 5);
    res.json({ ads: merged });
  } catch {
    res.status(500).json({ message: "Failed to fetch community ads" });
  }
});
router11.post("/ads/audience-estimate", authenticateToken, coachOrAdmin, async (req, res) => {
  try {
    const {
      audience_gender,
      audience_age_min,
      audience_age_max,
      audience_goals,
      audience_activity_levels,
      target_city,
      target_radius_km,
      target_lat,
      target_lng
    } = req.body;
    const ALL_GOALS = ["lose_weight", "build_muscle", "maintain_weight", "gain_weight"];
    const ALL_LEVELS = ["sedentary", "light", "moderate", "active", "very_active"];
    const SLIDER_MIN = 13;
    const SLIDER_MAX = 65;
    const goals = (Array.isArray(audience_goals) ? audience_goals : (audience_goals || "").split(",")).filter(Boolean);
    const levels = (Array.isArray(audience_activity_levels) ? audience_activity_levels : (audience_activity_levels || "").split(",")).filter(Boolean);
    const ageMin = Number(audience_age_min) || SLIDER_MIN;
    const ageMax = Number(audience_age_max) || SLIDER_MAX;
    const filterGoals = goals.length > 0 && goals.length < ALL_GOALS.length;
    const filterLevels = levels.length > 0 && levels.length < ALL_LEVELS.length;
    const filterAge = ageMin > SLIDER_MIN || ageMax < SLIDER_MAX;
    let sql = `SELECT COUNT(DISTINCT u.id) AS cnt FROM users u WHERE u.role = 'user'`;
    const params = [];
    if (audience_gender && audience_gender !== "all") {
      sql += ` AND u.gender = ?`;
      params.push(audience_gender);
    }
    if (filterAge) {
      sql += ` AND u.date_of_birth IS NOT NULL`;
      if (ageMin > SLIDER_MIN) {
        sql += ` AND u.date_of_birth <= DATE_SUB(CURDATE(), INTERVAL ? YEAR)`;
        params.push(ageMin);
      }
      if (ageMax < SLIDER_MAX) {
        sql += ` AND u.date_of_birth >= DATE_SUB(CURDATE(), INTERVAL ? YEAR)`;
        params.push(ageMax);
      }
    }
    if (filterGoals) {
      sql += ` AND u.fitness_goal IN (${goals.map(() => "?").join(",")})`;
      params.push(...goals);
    }
    if (filterLevels) {
      sql += ` AND (u.computed_activity_level IN (${levels.map(() => "?").join(",")}) OR u.activity_level IN (${levels.map(() => "?").join(",")}))`;
      params.push(...levels, ...levels);
    }
    const cityStr = (target_city || "").trim();
    const pinLat = target_lat ? parseFloat(String(target_lat)) : null;
    const pinLng = target_lng ? parseFloat(String(target_lng)) : null;
    const rad = Math.max(5, Math.min(200, parseInt(String(target_radius_km || "50"))));
    if (pinLat !== null && pinLng !== null) {
      sql += ` AND (
        (u.latitude IS NOT NULL AND 6371 * ACOS(LEAST(1.0,
          COS(RADIANS(?)) * COS(RADIANS(u.latitude)) *
          COS(RADIANS(u.longitude) - RADIANS(?)) +
          SIN(RADIANS(?)) * SIN(RADIANS(u.latitude))
        )) <= ?)
        OR (u.latitude IS NULL AND u.city IS NOT NULL AND u.city != '')
      )`;
      params.push(pinLat, pinLng, pinLat, rad);
    } else if (cityStr && cityStr.toLowerCase() !== "all egypt") {
      sql += ` AND u.city = ?`;
      params.push(cityStr);
    }
    const row = await get(sql, params);
    const count = row ? Number(row.cnt) : 0;
    if (process.env.NODE_ENV !== "production") {
      console.log("[audience-estimate] SQL:", sql);
      console.log("[audience-estimate] params:", params);
      console.log("[audience-estimate] result:", count);
    }
    res.json({ count });
  } catch (err) {
    console.error("[audience-estimate] ERROR:", err);
    if (process.env.NODE_ENV !== "production") {
      res.status(500).json({ count: 0, error: String(err) });
    } else {
      res.status(500).json({ count: 0 });
    }
  }
});
router11.get("/ads", authenticateToken, coachOrAdmin, async (req, res) => {
  try {
    await expireAds(req.user.id);
    const ads = await query(
      `SELECT a.*,
              COALESCE(ap.amount, 0)            AS paid_amount,
              COALESCE(ap.duration_minutes, 0)  AS paid_minutes,
              ap.status                         AS payment_status,
              ap.proof_url                      AS payment_proof
       FROM coach_ads a LEFT JOIN ad_payments ap ON ap.ad_id = a.id
       WHERE a.coach_id = ? ORDER BY a.created_at DESC`,
      [req.user.id]
    );
    res.json({ ads });
  } catch {
    res.status(500).json({ message: "Failed to fetch ads" });
  }
});
router11.post(
  "/ads",
  authenticateToken,
  coachOrAdmin,
  requireActiveCoachMembershipForDeals,
  uploadVideo.fields([{ name: "image", maxCount: 1 }, { name: "video", maxCount: 1 }]),
  validateVideoSize,
  optimizeImage(),
  async (req, res) => {
    const {
      title,
      description,
      specialty,
      cta,
      highlight,
      paymentMethod,
      ad_type,
      media_type,
      objective,
      duration_hours,
      duration_days,
      campaign_name,
      audience_gender,
      audience_age_min,
      audience_age_max,
      audience_goals,
      audience_activity_levels,
      budget_type,
      daily_budget,
      total_budget,
      schedule_start,
      schedule_end,
      placement,
      target_city,
      target_radius_km,
      target_lat,
      target_lng,
      contact_phone
    } = req.body;
    if (!title || !description) return res.status(400).json({ message: "Title and description required" });
    const safeTitle = sanitizeAdText(title, 120);
    const safeDescription = sanitizeAdText(description, 1e3);
    const safeSpecialty = sanitizeAdText(specialty, 80);
    const safeCta = sanitizeAdText(cta, 40) || "Book Free Consultation";
    const safeHighlight = sanitizeAdText(highlight, 120);
    const safeCampaignName = sanitizeAdText(campaign_name || title, 120);
    if (!safeTitle || !safeDescription) return res.status(400).json({ message: "Title and description required" });
    const bType = budget_type || "daily";
    const effectiveBudget = bType === "daily" ? parseFloat(daily_budget || "0") : parseFloat(total_budget || "0");
    if (effectiveBudget <= 0) return res.status(400).json({ message: "Budget must be greater than 0" });
    try {
      const files = req.files;
      const imageUrl = files?.image?.[0] ? await uploadToR2(files.image[0], "ads") : null;
      const videoUrl = media_type === "youtube" ? req.body.video_url : files?.video?.[0] ? await uploadToR2(files.video[0], "ads") : null;
      const { insertId } = await run(
        `INSERT INTO coach_ads (
          coach_id, title, description, specialty, cta, highlight, image_url, video_url,
          payment_method, ad_type, media_type, objective, duration_hours, duration_days,
          campaign_name, audience_gender, audience_age_min, audience_age_max,
          audience_goals, audience_activity_levels,
          budget_type, daily_budget, total_budget, schedule_start, schedule_end, placement,
          target_city, target_radius_km, target_lat, target_lng, contact_phone
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          req.user.id,
          safeTitle,
          safeDescription,
          safeSpecialty,
          safeCta,
          safeHighlight,
          imageUrl,
          videoUrl,
          paymentMethod || "ewallet",
          ad_type || placement || "community",
          media_type || "image",
          objective || "coaching",
          parseInt(duration_hours || "0"),
          parseInt(duration_days || "0"),
          safeCampaignName,
          audience_gender || "all",
          parseInt(audience_age_min || "18"),
          parseInt(audience_age_max || "65"),
          audience_goals || "",
          audience_activity_levels || "",
          budget_type || "daily",
          parseFloat(daily_budget || "0"),
          parseFloat(total_budget || "0"),
          schedule_start || null,
          schedule_end || null,
          placement || "all",
          target_city || null,
          parseInt(target_radius_km || "50"),
          target_lat ? parseFloat(target_lat) : null,
          target_lng ? parseFloat(target_lng) : null,
          contact_phone || null
        ]
      );
      const ad = await get("SELECT * FROM coach_ads WHERE id = ?", [insertId]);
      res.json({ ad, message: "Ad submitted for review" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to create ad" });
    }
  }
);
router11.put(
  "/ads/:id",
  authenticateToken,
  coachOrAdmin,
  requireActiveCoachMembershipForDeals,
  uploadVideo.fields([{ name: "image", maxCount: 1 }, { name: "video", maxCount: 1 }]),
  validateVideoSize,
  optimizeImage(),
  async (req, res) => {
    const { title, description, specialty, cta, highlight, paymentMethod, ad_type, media_type, objective, duration_hours, duration_days } = req.body;
    try {
      const existing = await get("SELECT * FROM coach_ads WHERE id = ? AND coach_id = ?", [req.params.id, req.user.id]);
      if (!existing) return res.status(404).json({ message: "Ad not found" });
      const safeTitle = sanitizeAdText(title, 120);
      const safeDescription = sanitizeAdText(description, 1e3);
      const safeSpecialty = sanitizeAdText(specialty, 80);
      const safeCta = sanitizeAdText(cta, 40);
      const safeHighlight = sanitizeAdText(highlight, 120);
      if (!safeTitle || !safeDescription) return res.status(400).json({ message: "Title and description required" });
      const files = req.files;
      const imageUrl = files?.image?.[0] ? await uploadToR2(files.image[0], "ads") : existing.image_url;
      const videoUrl = media_type === "youtube" ? req.body.video_url : files?.video?.[0] ? await uploadToR2(files.video[0], "ads") : existing.video_url;
      await run(
        "UPDATE coach_ads SET title=?, description=?, specialty=?, cta=?, highlight=?, image_url=?, video_url=?, payment_method=?, ad_type=?, media_type=?, objective=?, duration_hours=?, duration_days=?, status='pending', updated_at=NOW() WHERE id=?",
        [safeTitle, safeDescription, safeSpecialty, safeCta, safeHighlight, imageUrl, videoUrl, paymentMethod || "ewallet", ad_type || existing.ad_type, media_type || existing.media_type, objective || existing.objective, parseInt(duration_hours ?? existing.duration_hours ?? "0"), parseInt(duration_days ?? existing.duration_days ?? "0"), req.params.id]
      );
      res.json({ message: "Ad updated, pending review" });
    } catch {
      res.status(500).json({ message: "Failed to update ad" });
    }
  }
);
router11.delete("/ads/:id", authenticateToken, coachOrAdmin, requireActiveCoachMembershipForDeals, async (req, res) => {
  try {
    const existing = await get("SELECT id FROM coach_ads WHERE id = ? AND coach_id = ?", [req.params.id, req.user.id]);
    if (!existing) return res.status(404).json({ message: "Ad not found" });
    await run("DELETE FROM coach_ads WHERE id = ?", [req.params.id]);
    res.json({ message: "Ad deleted" });
  } catch {
    res.status(500).json({ message: "Failed to delete ad" });
  }
});
router11.post("/ads/:id/payment", authenticateToken, coachOrAdmin, requireActiveCoachMembershipForDeals, async (req, res) => {
  const { duration_minutes, payment_method, proof_url, phone, card_last4 } = req.body;
  if (!duration_minutes || duration_minutes < 1) return res.status(400).json({ message: "Duration must be at least 1 minute" });
  const RATE_PER_MINUTE = 4;
  const amount = parseFloat((duration_minutes * RATE_PER_MINUTE).toFixed(2));
  try {
    const ad = await get("SELECT id, coach_id FROM coach_ads WHERE id = ? AND coach_id = ?", [req.params.id, req.user.id]);
    if (!ad) return res.status(404).json({ message: "Ad not found" });
    const existing = await get("SELECT id FROM ad_payments WHERE ad_id = ?", [req.params.id]);
    if (existing) {
      await run(
        "UPDATE ad_payments SET duration_minutes=?, amount=?, payment_method=?, proof_url=?, phone=?, card_last4=?, status=?, updated_at=NOW() WHERE ad_id=?",
        [duration_minutes, amount, payment_method || "ewallet", proof_url || null, phone || null, card_last4 || null, "pending", req.params.id]
      );
    } else {
      await run(
        "INSERT INTO ad_payments (ad_id, coach_id, duration_minutes, amount, payment_method, proof_url, phone, card_last4, status) VALUES (?,?,?,?,?,?,?,?,?)",
        [req.params.id, req.user.id, duration_minutes, amount, payment_method || "ewallet", proof_url || null, phone || null, card_last4 || null, "pending"]
      );
    }
    await run("UPDATE coach_ads SET status='pending', updated_at=NOW() WHERE id=?", [req.params.id]);
    res.json({ message: "Payment submitted, awaiting admin approval", amount, duration_minutes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to submit payment" });
  }
});
router11.get("/ads/:id/payment", authenticateToken, coachOrAdmin, async (req, res) => {
  try {
    const payment = await get("SELECT * FROM ad_payments WHERE ad_id = ?", [req.params.id]);
    res.json({ payment: payment || null });
  } catch {
    res.status(500).json({ message: "Failed to fetch payment" });
  }
});
var CLICK_DEDUP_WINDOW_MS = 3e4;
var recentClicks = /* @__PURE__ */ new Map();
setInterval(() => {
  const cutoff = Date.now() - CLICK_DEDUP_WINDOW_MS;
  for (const [k, t] of recentClicks) if (t < cutoff) recentClicks.delete(k);
}, 6e4).unref?.();
router11.post("/ads/:id/click", authenticateToken, async (req, res) => {
  try {
    const adId = parseInt(req.params.id);
    if (!Number.isFinite(adId) || adId <= 0) return res.status(400).json({ message: "Invalid ad id" });
    const key = `${req.user.id}:${adId}`;
    const last = recentClicks.get(key) || 0;
    if (Date.now() - last < CLICK_DEDUP_WINDOW_MS) {
      return res.json({ ok: true, deduped: true });
    }
    recentClicks.set(key, Date.now());
    await run("UPDATE coach_ads SET clicks = clicks + 1 WHERE id = ?", [adId]);
    const { billClick: billClick2 } = await Promise.resolve().then(() => (init_adBillingService(), adBillingService_exports));
    billClick2(adId).catch(() => {
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Failed to track click" });
  }
});
router11.post("/ads/:id/impression", authenticateToken, async (req, res) => {
  try {
    const adId = parseInt(req.params.id);
    await run("UPDATE coach_ads SET impressions = impressions + 1 WHERE id = ?", [adId]);
    const { billImpression: billImpression2 } = await Promise.resolve().then(() => (init_adBillingService(), adBillingService_exports));
    billImpression2(adId).catch(() => {
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Failed to track impression" });
  }
});
router11.post("/ads/impressions", authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    if (Array.isArray(ids) && ids.length > 0) {
      await run(`UPDATE coach_ads SET impressions = impressions + 1 WHERE id IN (${ids.map(() => "?").join(",")})`, ids);
      const { billImpression: billImpression2, expireAndResetAds: expireAndResetAds2 } = await Promise.resolve().then(() => (init_adBillingService(), adBillingService_exports));
      expireAndResetAds2().catch(() => {
      });
      ids.forEach((id) => billImpression2(id).catch(() => {
      }));
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Failed to track impressions" });
  }
});
router11.post("/follow/:coachId", authenticateToken, async (req, res) => {
  try {
    await run("INSERT IGNORE INTO coach_follows (follower_id, coach_id) VALUES (?,?)", [req.user.id, req.params.coachId]);
    res.json({ following: true });
  } catch {
    res.status(500).json({ message: "Failed to follow coach" });
  }
});
router11.delete("/follow/:coachId", authenticateToken, async (req, res) => {
  try {
    await run("DELETE FROM coach_follows WHERE follower_id=? AND coach_id=?", [req.user.id, req.params.coachId]);
    res.json({ following: false });
  } catch {
    res.status(500).json({ message: "Failed to unfollow coach" });
  }
});
router11.get("/follow/:coachId/status", authenticateToken, async (req, res) => {
  try {
    const row = await get("SELECT id FROM coach_follows WHERE follower_id=? AND coach_id=?", [req.user.id, req.params.coachId]);
    res.json({ following: !!row });
  } catch {
    res.status(500).json({ message: "Failed to check follow status" });
  }
});
router11.get("/following", authenticateToken, async (req, res) => {
  try {
    const coaches = await query(
      `SELECT u.id, u.name, u.avatar, u.email, cp.specialty, cp.bio
       FROM coach_follows cf
       JOIN users u ON cf.coach_id = u.id
       LEFT JOIN coach_profiles cp ON cp.user_id = u.id
       WHERE cf.follower_id = ? ORDER BY cf.created_at DESC`,
      [req.user.id]
    );
    res.json({ coaches });
  } catch {
    res.status(500).json({ message: "Failed to fetch following" });
  }
});
router11.get("/users", authenticateToken, coachOrAdmin, async (req, res) => {
  try {
    const users = await query(
      `SELECT DISTINCT u.id, u.name, u.email, u.avatar, u.points, u.steps,
              u.height, u.weight, u.gender, u.step_goal, u.date_of_birth,
              u.fitness_goal, u.activity_level, u.target_weight, u.weekly_goal,
              u.computed_activity_level, u.city, u.country, u.medical_history, u.medical_file_url
       FROM users u
       INNER JOIN coach_subscriptions cs ON cs.user_id = u.id
       WHERE cs.coach_id = ? AND cs.status = 'active' AND (cs.expires_at IS NULL OR cs.expires_at > NOW())
       ORDER BY u.name ASC`,
      [req.user.id]
    );
    res.json({ users });
  } catch {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});
router11.get("/users/:id/profile", authenticateToken, coachOrAdmin, async (req, res) => {
  try {
    const user = await get(
      `SELECT id, name, email, avatar, height, weight, gender, points, steps, step_goal,
              date_of_birth, fitness_goal, activity_level, target_weight, weekly_goal,
              computed_activity_level, city, country, medical_history, medical_file_url
       FROM users WHERE id = ?`,
      [req.params.id]
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user });
  } catch {
    res.status(500).json({ message: "Failed to fetch user" });
  }
});
router11.get("/users/:id/workout-plan", authenticateToken, coachOrAdmin, async (req, res) => {
  const plan = await get("SELECT * FROM workout_plans WHERE user_id = ? ORDER BY created_at DESC LIMIT 1", [req.params.id]);
  if (plan) {
    try {
      plan.exercises = typeof plan.exercises === "string" ? JSON.parse(plan.exercises) : plan.exercises || [];
    } catch {
      plan.exercises = [];
    }
  }
  res.json({ plan: plan || null });
});
router11.post("/users/:id/workout-plan", authenticateToken, coachOrAdmin, requireActiveCoachMembershipForDeals, async (req, res) => {
  const { title, description, days_per_week, exercises } = req.body;
  const exercisesJson = JSON.stringify(exercises || []);
  const existing = await get("SELECT id FROM workout_plans WHERE user_id = ?", [req.params.id]);
  if (existing) {
    await run(
      "UPDATE workout_plans SET title=?, description=?, days_per_week=?, exercises=?, coach_id=? WHERE user_id=?",
      [title, description, days_per_week, exercisesJson, req.user.id, req.params.id]
    );
  } else {
    await run(
      "INSERT INTO workout_plans (user_id, coach_id, title, description, days_per_week, exercises) VALUES (?,?,?,?,?,?)",
      [req.params.id, req.user.id, title, description, days_per_week, exercisesJson]
    );
  }
  res.json({ message: "Workout plan saved" });
});
router11.get("/users/:id/nutrition-plan", authenticateToken, coachOrAdmin, async (req, res) => {
  const plan = await get("SELECT * FROM nutrition_plans WHERE user_id = ? ORDER BY created_at DESC LIMIT 1", [req.params.id]);
  if (plan) {
    try {
      plan.meals = typeof plan.meals === "string" ? JSON.parse(plan.meals) : plan.meals || [];
    } catch {
      plan.meals = [];
    }
  }
  res.json({ plan: plan || null });
});
router11.post("/users/:id/nutrition-plan", authenticateToken, coachOrAdmin, requireActiveCoachMembershipForDeals, async (req, res) => {
  const { title, daily_calories, protein_g, carbs_g, fat_g, meals, notes } = req.body;
  const mealsJson = JSON.stringify(meals || []);
  const existing = await get("SELECT id FROM nutrition_plans WHERE user_id = ?", [req.params.id]);
  if (existing) {
    await run(
      "UPDATE nutrition_plans SET title=?, daily_calories=?, protein_g=?, carbs_g=?, fat_g=?, meals=?, notes=?, coach_id=? WHERE user_id=?",
      [title, daily_calories, protein_g, carbs_g, fat_g, mealsJson, notes, req.user.id, req.params.id]
    );
  } else {
    await run(
      "INSERT INTO nutrition_plans (user_id, coach_id, title, daily_calories, protein_g, carbs_g, fat_g, meals, notes) VALUES (?,?,?,?,?,?,?,?,?)",
      [req.params.id, req.user.id, title, daily_calories, protein_g, carbs_g, fat_g, mealsJson, notes]
    );
  }
  res.json({ message: "Nutrition plan saved" });
});
router11.patch("/users/:id/step-goal", authenticateToken, coachOrAdmin, requireActiveCoachMembershipForDeals, async (req, res) => {
  const { step_goal } = req.body;
  if (!step_goal || step_goal < 100) return res.status(400).json({ message: "Invalid step goal" });
  try {
    await run("UPDATE users SET step_goal = ? WHERE id = ?", [step_goal, req.params.id]);
    res.json({ success: true, step_goal, message: "Step goal updated" });
  } catch {
    res.status(500).json({ message: "Failed to update step goal" });
  }
});
router11.get("/stats", authenticateToken, coachOrAdmin, async (req, res) => {
  try {
    const coachId = req.user.id;
    const now = /* @__PURE__ */ new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekStartStr = weekStart.toISOString().split("T")[0];
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const [[athleteRow], [pendingRow], [revenueRow], [ratingRow], [weekSessionsRow], [totalRow]] = await Promise.all([
      query("SELECT COUNT(DISTINCT user_id) AS cnt FROM coach_subscriptions WHERE coach_id = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > NOW())", [coachId]),
      query("SELECT COUNT(*) AS cnt FROM coaching_bookings WHERE coach_id = ? AND status = 'pending'", [coachId]),
      query("SELECT IFNULL(SUM(credited_amount), 0) AS total FROM coach_subscriptions WHERE coach_id = ? AND status = 'active' AND created_at >= ?", [coachId, monthStart]),
      query("SELECT IFNULL(AVG(rating), 0) AS avg, COUNT(*) AS cnt FROM coach_reviews WHERE coach_id = ?", [coachId]),
      query("SELECT COUNT(*) AS cnt FROM coaching_bookings WHERE coach_id = ? AND status = 'accepted' AND date >= ?", [coachId, weekStartStr]),
      query("SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) AS accepted FROM coaching_bookings WHERE coach_id = ?", [coachId])
    ]);
    const completionRate = totalRow?.total > 0 ? Math.round(totalRow.accepted / totalRow.total * 100) : 0;
    const weeklyRows = await query(
      "SELECT date, COUNT(*) AS sessions FROM coaching_bookings WHERE coach_id = ? AND status = 'accepted' AND date >= ? GROUP BY date ORDER BY date ASC",
      [coachId, weekStartStr]
    );
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weeklyMap = {};
    weeklyRows.forEach((r) => {
      weeklyMap[r.date] = r;
    });
    const weekly = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const ds = d.toISOString().split("T")[0];
      return { day: days[d.getDay()], sessions: weeklyMap[ds]?.sessions || 0 };
    });
    res.json({
      athletes: athleteRow?.cnt || 0,
      pendingRequests: pendingRow?.cnt || 0,
      monthlyRevenue: revenueRow?.total || 0,
      avgRating: parseFloat((ratingRow?.avg || 0).toFixed(1)),
      reviewCount: ratingRow?.cnt || 0,
      sessionsThisWeek: weekSessionsRow?.cnt || 0,
      completionRate,
      weekly
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
});
router11.get("/upcoming-sessions", authenticateToken, coachOrAdmin, async (req, res) => {
  try {
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const sessions = await query(
      `SELECT cb.*, u.name AS athlete_name, u.avatar AS athlete_avatar
       FROM coaching_bookings cb LEFT JOIN users u ON cb.user_id = u.id
       WHERE cb.coach_id = ? AND cb.status IN ('accepted','pending') AND (cb.date >= ? OR cb.date IS NULL OR cb.date = '')
       ORDER BY cb.date ASC, cb.time ASC LIMIT 10`,
      [req.user.id, today]
    );
    res.json({ sessions });
  } catch {
    res.status(500).json({ message: "Failed to fetch sessions" });
  }
});
router11.get("/activity", authenticateToken, coachOrAdmin, async (req, res) => {
  try {
    const coachId = req.user.id;
    const [bookings, msgs, reviews] = await Promise.all([
      query(`SELECT 'booking' AS type, cb.id, cb.status, cb.created_at, u.name AS actor_name, u.avatar AS actor_avatar FROM coaching_bookings cb LEFT JOIN users u ON cb.user_id = u.id WHERE cb.coach_id = ? ORDER BY cb.created_at DESC LIMIT 5`, [coachId]),
      query(`SELECT 'message' AS type, m.id, m.content, m.created_at, u.name AS actor_name, u.avatar AS actor_avatar FROM messages m LEFT JOIN users u ON m.sender_id = u.id WHERE m.receiver_id = ? AND m.sender_id != ? ORDER BY m.created_at DESC LIMIT 5`, [coachId, coachId]),
      query(`SELECT 'review' AS type, r.id, r.rating, r.text, r.created_at, u.name AS actor_name, u.avatar AS actor_avatar FROM coach_reviews r LEFT JOIN users u ON r.user_id = u.id WHERE r.coach_id = ? ORDER BY r.created_at DESC LIMIT 5`, [coachId])
    ]);
    const all = [...bookings, ...msgs, ...reviews].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10);
    res.json({ activity: all });
  } catch {
    res.status(500).json({ message: "Failed to fetch activity" });
  }
});
router11.get("/dashboard-home", authenticateToken, coachOrAdmin, async (req, res) => {
  try {
    const coachId = req.user.id;
    const [athletes, recentRequests, recentPosts, recentTransactions] = await Promise.all([
      query(
        `SELECT u.id, u.name, u.avatar, u.email,
                cs.plan_type, cs.plan_cycle, cs.created_at AS subscribed_at
         FROM coach_subscriptions cs
         INNER JOIN users u ON u.id = cs.user_id
         WHERE cs.coach_id = ?
           AND cs.status = 'active'
           AND (cs.expires_at IS NULL OR cs.expires_at > NOW())
         ORDER BY cs.created_at DESC
         LIMIT 6`,
        [coachId]
      ),
      query(
        `SELECT cb.id, cb.status, cb.date, cb.time, cb.created_at,
                u.id AS user_id, u.name AS user_name, u.avatar AS user_avatar
         FROM coaching_bookings cb
         LEFT JOIN users u ON u.id = cb.user_id
         WHERE cb.coach_id = ?
         ORDER BY cb.created_at DESC
         LIMIT 6`,
        [coachId]
      ),
      query(
        `SELECT p.id, p.content, p.media_url, p.created_at,
                u.id AS author_id, u.name AS author_name, u.avatar AS author_avatar,
                (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS likes,
                (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) AS comments
         FROM posts p
         INNER JOIN users u ON u.id = p.user_id
         ORDER BY p.created_at DESC
         LIMIT 6`
      ),
      query(
        `SELECT cs.id, cs.status, cs.amount, cs.credited_amount, cs.plan_type, cs.plan_cycle, cs.created_at,
                u.id AS user_id, u.name AS user_name, u.avatar AS user_avatar
         FROM coach_subscriptions cs
         LEFT JOIN users u ON u.id = cs.user_id
         WHERE cs.coach_id = ?
         ORDER BY cs.created_at DESC
         LIMIT 6`,
        [coachId]
      )
    ]);
    res.json({
      athletes,
      recentRequests,
      recentPosts,
      recentTransactions
    });
  } catch {
    res.status(500).json({ message: "Failed to fetch dashboard home data" });
  }
});
router11.get("/notifications", authenticateToken, async (req, res) => {
  try {
    const notifs = await query("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20", [req.user.id]);
    res.json({ notifications: notifs });
  } catch {
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
});
router11.patch("/notifications/:id/read", authenticateToken, async (req, res) => {
  try {
    await run("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Failed to mark read" });
  }
});
router11.post("/notifications/read-all", authenticateToken, async (req, res) => {
  try {
    await run("UPDATE notifications SET is_read = 1 WHERE user_id = ?", [req.user.id]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Failed to mark all read" });
  }
});
router11.get("/profile/:coachId/stats", authenticateToken, async (req, res) => {
  try {
    const coachId = req.params.coachId;
    const [[followRow], [postRow], [athleteRow], [ratingRow]] = await Promise.all([
      query("SELECT COUNT(*) AS cnt FROM coach_follows WHERE coach_id=?", [coachId]),
      query("SELECT COUNT(*) AS cnt FROM posts WHERE user_id=?", [coachId]),
      query("SELECT COUNT(DISTINCT user_id) AS cnt FROM coach_subscriptions WHERE coach_id=? AND status='active' AND (expires_at IS NULL OR expires_at > NOW())", [coachId]),
      query("SELECT IFNULL(AVG(rating), 0) AS avg, COUNT(*) AS cnt FROM coach_reviews WHERE coach_id=?", [coachId])
    ]);
    res.json({ followers: followRow?.cnt || 0, posts: postRow?.cnt || 0, athletes: athleteRow?.cnt || 0, avgRating: parseFloat((ratingRow?.avg || 0).toFixed(1)), reviewCount: ratingRow?.cnt || 0 });
  } catch {
    res.status(500).json({ message: "Failed to fetch coach stats" });
  }
});
router11.get("/profile/:coachId/posts", authenticateToken, async (req, res) => {
  try {
    const posts = await query(
      `SELECT p.*, u.name AS user_name, u.avatar AS user_avatar, u.role AS user_role,
              (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) AS likes,
              (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) AS comment_count
       FROM posts p JOIN users u ON p.user_id = u.id
       WHERE p.user_id = ? ORDER BY p.created_at DESC LIMIT 30`,
      [req.params.coachId]
    );
    res.json({ posts });
  } catch {
    res.status(500).json({ message: "Failed to fetch coach posts" });
  }
});
router11.get("/profile/:coachId/videos", authenticateToken, async (req, res) => {
  try {
    const videos = await query(
      "SELECT id, title, description, url, thumbnail, duration, duration_seconds, category, is_premium FROM workout_videos WHERE coach_id = ? AND COALESCE(approval_status, 'approved') = 'approved' AND (is_short IS NULL OR is_short = 0) ORDER BY created_at DESC LIMIT 30",
      [req.params.coachId]
    );
    res.json({ videos });
  } catch {
    res.status(500).json({ message: "Failed to fetch coach videos" });
  }
});
router11.get("/profile/:coachId/shorties", authenticateToken, async (req, res) => {
  try {
    const videos = await query(
      "SELECT id, title, description, url, thumbnail, duration, duration_seconds, width, height FROM workout_videos WHERE coach_id = ? AND COALESCE(approval_status, 'approved') = 'approved' AND is_short = 1 ORDER BY created_at DESC LIMIT 30",
      [req.params.coachId]
    );
    res.json({ videos });
  } catch {
    res.status(500).json({ message: "Failed to fetch coach shorties" });
  }
});
router11.get("/profile/:coachId/photos", authenticateToken, async (req, res) => {
  try {
    const photos = await query(
      `SELECT id, media_url, content, created_at FROM posts
       WHERE user_id = ? AND media_url IS NOT NULL AND media_url != ''
         AND media_url NOT LIKE '%.mp4' AND media_url NOT LIKE '%.mov' AND media_url NOT LIKE '%.webm'
       ORDER BY created_at DESC LIMIT 50`,
      [req.params.coachId]
    );
    res.json({ photos });
  } catch {
    res.status(500).json({ message: "Failed to fetch coach photos" });
  }
});
var coachRoutes2_default = router11;

// server/routes/userRoutes.ts
init_auth();
init_database();
init_upload();
import { Router as Router9 } from "express";
var router12 = Router9();
router12.patch("/profile", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, height, weight, gender, avatar, points, fitness_goal, activity_level, target_weight, weekly_goal, date_of_birth, onboarding_done } = req.body;
    const fields = [];
    const values = [];
    if (name !== void 0) {
      fields.push("name = ?");
      values.push(name);
    }
    if (height !== void 0) {
      fields.push("height = ?");
      values.push(height);
    }
    if (weight !== void 0) {
      fields.push("weight = ?");
      values.push(weight);
    }
    if (gender !== void 0) {
      fields.push("gender = ?");
      values.push(gender);
    }
    if (avatar !== void 0) {
      fields.push("avatar = ?");
      values.push(avatar);
    }
    if (points !== void 0) {
      fields.push("points = ?");
      values.push(points);
    }
    if (fitness_goal !== void 0) {
      fields.push("fitness_goal = ?");
      values.push(fitness_goal);
    }
    if (activity_level !== void 0) {
      fields.push("activity_level = ?");
      values.push(activity_level);
    }
    if (target_weight !== void 0) {
      fields.push("target_weight = ?");
      values.push(target_weight);
    }
    if (weekly_goal !== void 0) {
      fields.push("weekly_goal = ?");
      values.push(weekly_goal);
    }
    if (date_of_birth !== void 0) {
      fields.push("date_of_birth = ?");
      values.push(date_of_birth);
    }
    if (onboarding_done !== void 0) {
      fields.push("onboarding_done = ?");
      values.push(onboarding_done ? 1 : 0);
    }
    if (fields.length === 0) return res.status(400).json({ message: "No fields to update" });
    values.push(userId);
    await run(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values);
    const updated = await get(
      "SELECT id, name, email, role, avatar, is_premium, coach_membership_active, points, steps, step_goal, height, weight, gender, fitness_goal, activity_level, computed_activity_level, target_weight, weekly_goal, date_of_birth, onboarding_done, avg_daily_steps, streak_days, created_at FROM users WHERE id = ?",
      [userId]
    );
    res.json({ success: true, user: updated });
  } catch (err) {
    res.status(500).json({ message: "Failed to update profile" });
  }
});
router12.post("/points", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { points } = req.body;
    if (points === void 0) return res.status(400).json({ message: "points required" });
    await run("UPDATE users SET points = ? WHERE id = ?", [points, userId]);
    const updated = await get("SELECT id, name, email, role, avatar, is_premium, coach_membership_active, points, steps, step_goal, height, weight, gender, created_at FROM users WHERE id = ?", [userId]);
    return res.json({ success: true, user: updated });
  } catch (err) {
    return res.status(500).json({ message: "Could not update points" });
  }
});
router12.patch("/location", authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude, city, country } = req.body;
    if (latitude == null || longitude == null) return res.status(400).json({ message: "latitude and longitude required" });
    await run(
      "UPDATE users SET latitude=?, longitude=?, city=?, country=?, location_updated_at=NOW() WHERE id=?",
      [parseFloat(latitude), parseFloat(longitude), city || null, country || null, req.user.id]
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Failed to save location" });
  }
});
router12.patch("/step-goal", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { step_goal } = req.body;
    if (!step_goal || step_goal < 100) return res.status(400).json({ message: "Invalid step goal" });
    const bookings = await query("SELECT id FROM coaching_bookings WHERE user_id = ? AND status = ? LIMIT 1", [userId, "accepted"]);
    if (bookings.length > 0) return res.status(403).json({ message: "Your step goal is set by your coach" });
    await run("UPDATE users SET step_goal = ? WHERE id = ?", [step_goal, userId]);
    res.json({ success: true, step_goal });
  } catch {
    res.status(500).json({ message: "Failed to update step goal" });
  }
});
router12.post("/upload-proof", authenticateToken, upload.single("image"), optimizeImage(), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    res.json({ url: await uploadToR2(req.file, "images") });
  } catch {
    res.status(500).json({ message: "Upload failed" });
  }
});
router12.get("/points/history", authenticateToken, async (req, res) => {
  try {
    const transactions = await query("SELECT * FROM point_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50", [req.user.id]);
    res.json({ transactions });
  } catch {
    res.status(500).json({ message: "Failed to fetch point history" });
  }
});
router12.get("/medical-history", authenticateToken, async (req, res) => {
  try {
    const user = await get("SELECT medical_history, medical_file_url FROM users WHERE id = ?", [req.user.id]);
    res.json({ medical_history: user?.medical_history || "", medical_file_url: user?.medical_file_url || null });
  } catch {
    res.status(500).json({ message: "Failed to fetch medical history" });
  }
});
router12.post("/medical-history", authenticateToken, upload.single("medical"), optimizeImage(), async (req, res) => {
  try {
    const { medical_history } = req.body;
    const fileUrl = req.file ? await uploadToR2(req.file, "medical") : null;
    if (fileUrl) {
      await run("UPDATE users SET medical_history = ?, medical_file_url = ? WHERE id = ?", [medical_history || "", fileUrl, req.user.id]);
      res.json({ message: "Saved", file_url: fileUrl });
    } else {
      await run("UPDATE users SET medical_history = ? WHERE id = ?", [medical_history || "", req.user.id]);
      res.json({ message: "Saved" });
    }
  } catch {
    res.status(500).json({ message: "Failed to save medical history" });
  }
});
router12.get("/progress-photos", authenticateToken, async (req, res) => {
  try {
    const row = await get("SELECT before_photo, now_photo FROM user_progress_photos WHERE user_id = ?", [req.user.id]);
    res.json({ before: row?.before_photo || null, now: row?.now_photo || null });
  } catch {
    res.status(500).json({ message: "Failed to fetch progress photos" });
  }
});
router12.post("/progress-photos", authenticateToken, upload.single("photo"), optimizeImage(), async (req, res) => {
  try {
    const { type } = req.body;
    if (!type || !["before", "now"].includes(type)) return res.status(400).json({ message: 'type must be "before" or "now"' });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const url = await uploadToR2(req.file, "progress");
    const col = type === "before" ? "before_photo" : "now_photo";
    const existing = await get("SELECT id FROM user_progress_photos WHERE user_id = ?", [req.user.id]);
    if (existing) {
      await run(`UPDATE user_progress_photos SET ${col} = ?, updated_at = NOW() WHERE user_id = ?`, [url, req.user.id]);
    } else {
      await run(`INSERT INTO user_progress_photos (user_id, ${col}, created_at, updated_at) VALUES (?, ?, NOW(), NOW())`, [req.user.id, url]);
    }
    res.json({ url });
  } catch {
    res.status(500).json({ message: "Failed to upload progress photo" });
  }
});
var userRoutes_default = router12;

// server/routes/workoutsRoutes.ts
init_auth();
init_database();
init_upload();
import { Router as Router10 } from "express";
var router13 = Router10();
var coachOrAdmin2 = (req, res, next) => {
  if (req.user?.role !== "coach" && req.user?.role !== "admin") {
    return res.status(403).json({ message: "Coach access required" });
  }
  next();
};
function extractYouTubeVideoId(url) {
  const match = String(url || "").match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}
router13.get("/videos", authenticateToken, async (req, res) => {
  try {
    const videos = await query("SELECT * FROM workout_videos WHERE COALESCE(approval_status, 'approved') = 'approved' AND (is_short IS NULL OR is_short = 0) ORDER BY created_at DESC");
    res.json({ videos });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch videos" });
  }
});
router13.get("/shorties", authenticateToken, async (req, res) => {
  try {
    const videos = await query("SELECT * FROM workout_videos WHERE COALESCE(approval_status, 'approved') = 'approved' AND is_short = 1 ORDER BY created_at DESC");
    res.json({ videos });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch shorties" });
  }
});
router13.get("/my-videos", authenticateToken, coachOrAdmin2, async (req, res) => {
  try {
    const videos = await query(
      `SELECT wv.*, u.name AS submitted_by_name
       FROM workout_videos wv
       LEFT JOIN users u ON u.id = wv.submitted_by
       WHERE wv.coach_id = ?
       ORDER BY wv.created_at DESC`,
      [req.user.id]
    );
    res.json({ videos });
  } catch {
    res.status(500).json({ message: "Failed to fetch your videos" });
  }
});
router13.post("/videos/submissions", authenticateToken, coachOrAdmin2, requireActiveCoachMembershipForDeals, uploadVideo.fields([
  { name: "video", maxCount: 1 },
  { name: "thumbnail", maxCount: 1 }
]), validateVideoSize, optimizeImage(), async (req, res) => {
  try {
    const { title, description, duration, category, is_premium, is_short } = req.body;
    if (!title) return res.status(400).json({ message: "Title is required" });
    const files = req.files;
    const videoFile = files?.video?.[0];
    const thumbnailFile = files?.thumbnail?.[0];
    if (!videoFile) return res.status(400).json({ message: "Video file is required" });
    const videoUrl = await uploadToR2(videoFile, "videos");
    const thumbnailUrl = thumbnailFile ? await uploadToR2(thumbnailFile, "thumbnails") : null;
    const durationSeconds = videoFile.size > 0 ? Math.ceil(videoFile.size / (1024 * 1024)) : parseInt(duration || "0", 10) || 0;
    const isShort = is_short === "1" || is_short === true ? 1 : 0;
    const isPremium = is_premium === "1" || is_premium === true ? 1 : 0;
    const approvalStatus = req.user.role === "admin" ? "approved" : "pending";
    const result = await run(
      `INSERT INTO workout_videos
       (title, description, url, duration, duration_seconds, category, is_premium, thumbnail, is_short, source_type, coach_id, submitted_by, approval_status, approved_by, approved_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        title,
        description || "",
        videoUrl,
        duration || "",
        durationSeconds,
        category || "General",
        isPremium,
        thumbnailUrl || "",
        isShort,
        "upload",
        req.user.id,
        req.user.id,
        approvalStatus,
        approvalStatus === "approved" ? req.user.id : null,
        approvalStatus === "approved" ? /* @__PURE__ */ new Date() : null
      ]
    );
    const video = await get("SELECT * FROM workout_videos WHERE id = ?", [result.insertId]);
    res.json({
      video,
      message: approvalStatus === "approved" ? "Video published successfully" : "Video submitted for admin approval"
    });
  } catch (err) {
    console.error("Coach video submission error:", err);
    res.status(500).json({ message: "Failed to submit video" });
  }
});
router13.post("/videos/submissions/youtube", authenticateToken, coachOrAdmin2, requireActiveCoachMembershipForDeals, async (req, res) => {
  try {
    const { title, description, duration, category, is_premium, is_short, youtube_url } = req.body;
    if (!title) return res.status(400).json({ message: "Title is required" });
    if (!youtube_url) return res.status(400).json({ message: "YouTube URL is required" });
    const videoId = extractYouTubeVideoId(youtube_url);
    if (!videoId) return res.status(400).json({ message: "Invalid YouTube URL. Please provide a valid YouTube video link." });
    const embedUrl = `https://www.youtube.com/embed/${videoId}`;
    const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    const isShort = is_short === "1" || is_short === true ? 1 : 0;
    const isPremium = is_premium === "1" || is_premium === true ? 1 : 0;
    const approvalStatus = req.user.role === "admin" ? "approved" : "pending";
    const result = await run(
      `INSERT INTO workout_videos
       (title, description, url, youtube_url, source_type, duration, duration_seconds, category, is_premium, thumbnail, is_short, coach_id, submitted_by, approval_status, approved_by, approved_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        title,
        description || "",
        embedUrl,
        youtube_url,
        "youtube",
        duration || "",
        0,
        category || "General",
        isPremium,
        thumbnail,
        isShort,
        req.user.id,
        req.user.id,
        approvalStatus,
        approvalStatus === "approved" ? req.user.id : null,
        approvalStatus === "approved" ? /* @__PURE__ */ new Date() : null
      ]
    );
    const video = await get("SELECT * FROM workout_videos WHERE id = ?", [result.insertId]);
    res.json({
      video,
      message: approvalStatus === "approved" ? "YouTube video published successfully" : "YouTube video submitted for admin approval"
    });
  } catch (err) {
    console.error("Coach YouTube submission error:", err);
    res.status(500).json({ message: "Failed to submit YouTube video" });
  }
});
router13.get("/playlists", authenticateToken, async (_req, res) => {
  try {
    const playlists = await query(`
      SELECT p.*, u.name as creator_name,
             (SELECT COUNT(*) FROM playlist_videos WHERE playlist_id = p.id) as video_count
      FROM video_playlists p
      LEFT JOIN users u ON u.id = p.created_by
      WHERE p.is_public = 1
      ORDER BY p.sort_order ASC, p.created_at DESC
    `);
    res.json({ playlists });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch playlists" });
  }
});
router13.get("/playlists/:id/videos", authenticateToken, async (req, res) => {
  try {
    const vids = await query(
      `SELECT v.*, pv.sort_order as playlist_order FROM playlist_videos pv
       JOIN workout_videos v ON v.id = pv.video_id
       WHERE pv.playlist_id = ? AND COALESCE(v.approval_status, 'approved') = 'approved' ORDER BY pv.sort_order ASC`,
      [req.params.id]
    );
    res.json({ videos: vids });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch playlist videos" });
  }
});
router13.get("/my-plan", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const workoutPlan = await get("SELECT * FROM workout_plans WHERE user_id = ? ORDER BY created_at DESC LIMIT 1", [userId]);
    const nutritionPlan = await get("SELECT * FROM nutrition_plans WHERE user_id = ? ORDER BY created_at DESC LIMIT 1", [userId]);
    if (!workoutPlan && !nutritionPlan) return res.json(null);
    res.json({
      workout: workoutPlan ? {
        title: workoutPlan.title,
        description: workoutPlan.description,
        sessions: typeof workoutPlan.exercises === "string" ? JSON.parse(workoutPlan.exercises || "[]") : workoutPlan.exercises || []
      } : null,
      nutrition: nutritionPlan ? {
        title: nutritionPlan.title,
        dailyCalories: nutritionPlan.daily_calories,
        protein: nutritionPlan.protein_g,
        carbs: nutritionPlan.carbs_g,
        fat: nutritionPlan.fat_g,
        meals: typeof nutritionPlan.meals === "string" ? JSON.parse(nutritionPlan.meals || "[]") : nutritionPlan.meals || [],
        notes: nutritionPlan.notes
      } : null
    });
  } catch (err) {
    res.status(500).json({ message: "Could not fetch plan" });
  }
});
router13.post("/videos/:id/watched", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const videoId = req.params.id;
    const { watchedDuration, videoDuration, seeked, speedChanged } = req.body || {};
    if (!watchedDuration || !videoDuration) return res.status(400).json({ message: "Missing watch data", points: 0 });
    if (seeked || speedChanged) return res.json({ message: "Not eligible \u2014 video was seeked or speed changed", points: 0 });
    if (watchedDuration < videoDuration * 0.9) return res.json({ message: "Video not fully watched", points: 0 });
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const already = await get("SELECT id FROM point_transactions WHERE user_id = ? AND reference_type = ? AND reference_id = ? AND DATE(created_at) = ?", [userId, "video_watch", videoId, today]);
    if (already) return res.json({ message: "Already awarded today", points: 0 });
    await run("UPDATE users SET points = points + 2 WHERE id = ?", [userId]);
    await run("INSERT INTO point_transactions (user_id, points, reason, reference_type, reference_id) VALUES (?,?,?,?,?)", [userId, 2, "Watched a full workout video", "video_watch", videoId]);
    const user = await get("SELECT points FROM users WHERE id = ?", [userId]);
    try {
      const { updateUserActivityProfile: updateUserActivityProfile2 } = await Promise.resolve().then(() => (init_activityProfileService(), activityProfileService_exports));
      updateUserActivityProfile2(userId).catch(() => {
      });
    } catch {
    }
    res.json({ message: "+2 points for watching video!", points: user?.points || 0 });
  } catch (err) {
    res.status(500).json({ message: "Failed to award points" });
  }
});
var workoutsRoutes_default = router13;

// server/routes/plansRoutes.ts
init_auth();
init_upload();
init_database();
import { Router as Router11 } from "express";
var router14 = Router11();
router14.get("/workouts", authenticateToken, async (req, res) => {
  try {
    const plans = await query(
      "SELECT * FROM user_workout_plans WHERE user_id = ? ORDER BY day_of_week ASC, created_at DESC",
      [req.user.id]
    );
    res.json({ plans });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch workout plans" });
  }
});
router14.post("/workouts", authenticateToken, uploadVideo.single("video"), async (req, res) => {
  try {
    const { day_of_week, workout_type, time_minutes, notes } = req.body;
    if (!day_of_week || !workout_type) {
      return res.status(400).json({ message: "Day and workout type are required" });
    }
    const videoUrl = req.file ? await uploadToR2(req.file, "plans") : null;
    const result = await run(
      `INSERT INTO user_workout_plans (user_id, day_of_week, workout_type, video_url, time_minutes, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, day_of_week, workout_type, videoUrl, parseInt(time_minutes) || 0, notes || null]
    );
    const plan = await get("SELECT * FROM user_workout_plans WHERE id = ?", [result.insertId]);
    res.json({ plan });
  } catch (err) {
    res.status(500).json({ message: "Failed to create workout plan" });
  }
});
router14.delete("/workouts/:id", authenticateToken, async (req, res) => {
  try {
    await run("DELETE FROM user_workout_plans WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete" });
  }
});
router14.get("/nutrition", authenticateToken, async (req, res) => {
  try {
    const plans = await query(
      "SELECT * FROM user_nutrition_plans WHERE user_id = ? ORDER BY day_of_week ASC, meal_time ASC, created_at DESC",
      [req.user.id]
    );
    res.json({ plans });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch nutrition plans" });
  }
});
router14.post("/nutrition", authenticateToken, async (req, res) => {
  try {
    const { day_of_week, meal_time, meal_type, meal_name, contents, calories } = req.body;
    if (!day_of_week || !meal_time || !meal_name) {
      return res.status(400).json({ message: "Day, meal time, and meal name are required" });
    }
    const result = await run(
      `INSERT INTO user_nutrition_plans (user_id, day_of_week, meal_time, meal_type, meal_name, contents, calories)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, day_of_week, meal_time, meal_type || null, meal_name, contents || null, parseInt(calories) || 0]
    );
    const plan = await get("SELECT * FROM user_nutrition_plans WHERE id = ?", [result.insertId]);
    res.json({ plan });
  } catch (err) {
    res.status(500).json({ message: "Failed to create nutrition plan" });
  }
});
router14.delete("/nutrition/:id", authenticateToken, async (req, res) => {
  try {
    await run("DELETE FROM user_nutrition_plans WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete" });
  }
});
router14.get("/coach-workout-plan", authenticateToken, async (req, res) => {
  try {
    const plan = await get(
      `SELECT wp.*, u.name AS coach_name FROM workout_plans wp
       LEFT JOIN users u ON u.id = wp.coach_id
       WHERE wp.user_id = ? ORDER BY wp.created_at DESC LIMIT 1`,
      [req.user.id]
    );
    if (!plan) return res.json({ plan: null });
    res.json({ plan });
  } catch {
    res.status(500).json({ message: "Failed to fetch coach workout plan" });
  }
});
router14.get("/coach-nutrition-plan", authenticateToken, async (req, res) => {
  try {
    const plan = await get(
      `SELECT np.*, u.name AS coach_name FROM nutrition_plans np
       LEFT JOIN users u ON u.id = np.coach_id
       WHERE np.user_id = ? ORDER BY np.created_at DESC LIMIT 1`,
      [req.user.id]
    );
    if (!plan) return res.json({ plan: null });
    res.json({ plan });
  } catch {
    res.status(500).json({ message: "Failed to fetch coach nutrition plan" });
  }
});
var plansRoutes_default = router14;

// server/routes/paymentRoutes.ts
import { Router as Router13 } from "express";

// server/routes/paymobRoutes.ts
init_auth();
init_database();
import { Router as Router12 } from "express";
import https from "https";
var router15 = Router12();
var _settingsCache = {};
var _settingsCacheTs = 0;
async function getSettings() {
  if (Date.now() - _settingsCacheTs < 6e4) return _settingsCache;
  try {
    const rows = await query("SELECT setting_key, setting_value FROM payment_settings");
    const m = {};
    for (const r of rows) m[r.setting_key] = r.setting_value || "";
    _settingsCache = m;
    _settingsCacheTs = Date.now();
  } catch {
  }
  return _settingsCache;
}
async function setting(dbKey, envVar, fallback = "") {
  const s = await getSettings();
  return s[dbKey] || process.env[envVar] || fallback;
}
var ENV = {
  paypalClientId: () => setting("paypal_user_client_id", "PAYPAL_CLIENT_ID"),
  paypalSecret: () => setting("paypal_user_secret", "PAYPAL_SECRET"),
  paypalMode: () => setting("paypal_mode", "PAYPAL_MODE", "sandbox"),
  paypalWebhookId: () => setting("paypal_webhook_id", "PAYPAL_WEBHOOK_ID"),
  coachCutPct: async () => Math.min(100, Math.max(0, Number(await setting("coach_cut_percentage", "COACH_CUT_PERCENT", "85")))),
  appBaseUrl: () => process.env.APP_BASE_URL || "http://localhost:3000"
};
function httpPost(hostname, path5, headers, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request(
      { hostname, path: path5, method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload), ...headers } },
      (res) => {
        let d = "";
        res.on("data", (c) => d += c);
        res.on("end", () => {
          try {
            resolve(JSON.parse(d));
          } catch {
            reject(new Error("Bad JSON: " + d.slice(0, 200)));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}
async function paypalHost() {
  return await ENV.paypalMode() === "live" ? "api-m.paypal.com" : "api-m.sandbox.paypal.com";
}
var ppTokenCache = null;
async function paypalToken() {
  if (ppTokenCache && Date.now() < ppTokenCache.exp) return ppTokenCache.token;
  const cid = await ENV.paypalClientId();
  const sec = await ENV.paypalSecret();
  if (!cid || !sec) throw new Error("PayPal not configured");
  const auth = Buffer.from(`${cid}:${sec}`).toString("base64");
  const ppHost = await paypalHost();
  return new Promise((resolve, reject) => {
    const body = "grant_type=client_credentials";
    const req = https.request({
      hostname: ppHost,
      path: "/v1/oauth2/token",
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded", "Content-Length": body.length }
    }, (res) => {
      let d = "";
      res.on("data", (c) => d += c);
      res.on("end", () => {
        try {
          const j = JSON.parse(d);
          ppTokenCache = { token: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1e3 };
          resolve(j.access_token);
        } catch {
          reject(new Error("PayPal token parse error"));
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}
async function ppCall(method, path5, body) {
  const token = await paypalToken();
  const ppHost = await paypalHost();
  if (method === "GET") {
    return new Promise((resolve, reject) => {
      const r = https.request(
        { hostname: ppHost, path: path5, method: "GET", headers: { Authorization: `Bearer ${token}` } },
        (res) => {
          let d = "";
          res.on("data", (c) => d += c);
          res.on("end", () => {
            try {
              resolve(JSON.parse(d));
            } catch {
              reject(new Error("Bad JSON"));
            }
          });
        }
      );
      r.on("error", reject);
      r.end();
    });
  }
  return httpPost(ppHost, path5, { Authorization: `Bearer ${token}` }, body || {});
}
var rateCache = null;
async function egpToUsd(egp) {
  const fixed = process.env.EGP_USD_RATE;
  if (fixed && Number(fixed) > 0) return Math.round(egp / Number(fixed) * 100) / 100;
  if (rateCache && Date.now() - rateCache.ts < 6 * 36e5) return Math.round(egp / rateCache.rate * 100) / 100;
  try {
    const r = await new Promise((resolve, reject) => {
      const req = https.request(
        { hostname: "open.er-api.com", path: "/v6/latest/USD", method: "GET" },
        (res) => {
          let d = "";
          res.on("data", (c) => d += c);
          res.on("end", () => {
            try {
              resolve(JSON.parse(d));
            } catch {
              reject(new Error("Bad JSON"));
            }
          });
        }
      );
      req.on("error", reject);
      req.end();
    });
    if (r?.rates?.EGP) {
      rateCache = { rate: r.rates.EGP, ts: Date.now() };
      return Math.round(egp / r.rates.EGP * 100) / 100;
    }
  } catch {
  }
  return Math.round(egp / 50.5 * 100) / 100;
}
async function paypalPayout(coachId, amountEGP, recipientEmail, ref) {
  if (!await ENV.paypalClientId()) return { ok: false, error: "PayPal not configured" };
  try {
    const usd = await egpToUsd(amountEGP);
    const r = await ppCall("POST", "/v1/payments/payouts", {
      sender_batch_header: { sender_batch_id: `fw_${ref}_${Date.now()}`, email_subject: "FitWay Hub \u2014 Your earnings payout", email_message: `You have received a payout of $${usd} USD for your coaching earnings.` },
      items: [{ recipient_type: "EMAIL", amount: { value: usd.toFixed(2), currency: "USD" }, receiver: recipientEmail, note: "FitWay Hub payout", sender_item_id: ref }]
    });
    if (r.batch_header?.payout_batch_id) {
      await run(
        "INSERT INTO credit_transactions (user_id, amount, type, reference_id, description) VALUES (?,?,?,?,?)",
        [coachId, -amountEGP, "auto_payout_paypal", r.batch_header.payout_batch_id, `PayPal payout to ${recipientEmail}`]
      );
      return { ok: true, batchId: r.batch_header.payout_batch_id };
    }
    return { ok: false, error: JSON.stringify(r.errors || r) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
async function activateSubscription(userId, coachId, planCycle, planType, amountEGP, paymentMethod, txRef) {
  const active = await get(
    `SELECT id FROM coach_subscriptions WHERE user_id=? AND coach_id=? AND status='active' AND (expires_at IS NULL OR expires_at > NOW())`,
    [userId, coachId]
  );
  if (active) return;
  const months = planCycle === "yearly" ? 12 : 1;
  const expiresAt = /* @__PURE__ */ new Date();
  expiresAt.setMonth(expiresAt.getMonth() + months);
  const coachCut = Math.round(amountEGP * (await ENV.coachCutPct() / 100) * 100) / 100;
  await run(
    `INSERT INTO coach_subscriptions (user_id, coach_id, plan_cycle, plan_type, amount, payment_method, transaction_id, status, expires_at)
     VALUES (?,?,?,?,?,?,?, 'active', ?)`,
    [userId, coachId, planCycle, planType, amountEGP, paymentMethod, txRef, expiresAt]
  );
  await run("UPDATE users SET credit = COALESCE(credit, 0) + ? WHERE id=?", [coachCut, coachId]);
  await run(
    "INSERT INTO credit_transactions (user_id, amount, type, reference_id, description) VALUES (?,?,?,?,?)",
    [coachId, coachCut, "subscription", txRef, `Subscription from user #${userId} (${planCycle} ${planType})`]
  );
  await run(
    "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
    [userId, "subscription", "\u2705 Subscription Active!", "Your coach subscription is now active. Start training!", "/app/coaching"]
  );
  await run(
    "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
    [coachId, "new_subscription", "\u{1F389} New Subscriber!", `A new athlete just subscribed. You earned ${coachCut} EGP.`, "/coach/profile"]
  );
}
async function activatePremium(userId, planCycle, amountEGP, paymentMethod, txRef) {
  await run("UPDATE users SET is_premium=1 WHERE id=? AND role=?", [userId, "user"]);
  await run(
    "INSERT INTO payments (user_id, type, plan, amount, payment_method, transaction_id, status) VALUES (?,?,?,?,?,?,?)",
    [userId, "premium", planCycle, amountEGP, paymentMethod, txRef, "completed"]
  );
  await run(
    "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
    [userId, "premium", "\u26A1 Premium Activated!", "You now have full access to all premium features.", "/app/dashboard"]
  );
}
async function autoPayout(coachId, amount, withdrawalId) {
  const user = await get("SELECT payment_method_type, payment_phone, payment_wallet_type, paypal_email FROM users WHERE id=?", [coachId]);
  if (!user) return { ok: false, error: "User not found" };
  const method = user.payment_method_type || "ewallet";
  if (method === "paypal" && user.paypal_email) {
    const r = await paypalPayout(coachId, amount, user.paypal_email, String(withdrawalId));
    return { ok: r.ok, ref: r.batchId, error: r.error };
  }
  if (method === "ewallet" && user.payment_phone) {
    return { ok: true, queuedManual: true, ref: void 0 };
  }
  return { ok: false, error: `No payout method set. Method="${method}", phone="${user.payment_phone}", paypal="${user.paypal_email}"` };
}
router15.get("/config", async (_req, res) => {
  try {
    const [ppClientId, ppSecret, ppMode] = await Promise.all([
      ENV.paypalClientId(),
      ENV.paypalSecret(),
      ENV.paypalMode()
    ]);
    res.json({
      paypal: {
        configured: !!(ppClientId && ppSecret),
        clientId: ppClientId,
        mode: ppMode
      },
      // Manual e-wallet (Orange/Vodafone/WE) is always available — the actual
      // upload + admin approval flow lives at /api/payments/ewallet.
      manualEwallet: { enabled: true },
      disbursement: { paypal: !!ppClientId, ewalletManual: true }
    });
  } catch {
    res.status(500).json({ message: "Failed to load config" });
  }
});
router15.post("/intention", authenticateToken, async (req, res) => {
  const { provider, amount, type, coachId, planCycle, planType } = req.body;
  if (!amount || !type) return res.status(400).json({ message: "amount and type are required" });
  if (provider && provider !== "paypal") {
    return res.status(400).json({ message: `Unsupported provider "${provider}". Use 'paypal' or POST /api/payments/ewallet for manual wallets.` });
  }
  const user = await get("SELECT id, name, email FROM users WHERE id=?", [req.user.id]);
  if (!user) return res.status(404).json({ message: "User not found" });
  try {
    const ppClientIdEarly = await ENV.paypalClientId();
    if (!ppClientIdEarly) return res.status(503).json({ message: "PayPal not configured" });
    const usd = await egpToUsd(Number(amount));
    const desc = coachId ? `FitWay Coach Subscription (${planCycle} ${planType})` : `FitWay ${type} (${planCycle})`;
    const origin = req.headers.origin || ENV.appBaseUrl();
    const order = await ppCall("POST", "/v2/checkout/orders", {
      intent: "CAPTURE",
      purchase_units: [{ amount: { currency_code: "USD", value: usd.toFixed(2) }, description: desc }],
      application_context: {
        return_url: `${origin}/payment/success`,
        cancel_url: `${origin}/payment/cancel`,
        brand_name: "FitWay Hub",
        user_action: "PAY_NOW",
        shipping_preference: "NO_SHIPPING"
      }
    });
    if (!order.id) return res.status(500).json({ message: "PayPal order creation failed", detail: order });
    await run(
      `INSERT INTO paymob_transactions (user_id, coach_id, paymob_order_id, amount, type, plan_cycle, plan_type, method, status) VALUES (?,?,?,?,?,?,?,?,?)`,
      [user.id, coachId || null, order.id, amount, type, planCycle || null, planType || null, "paypal", "pending"]
    );
    return res.json({ provider: "paypal", orderId: order.id, clientId: ppClientIdEarly });
  } catch (err) {
    console.error("Payment intention error:", err.message);
    res.status(500).json({ message: "Failed to create payment" });
  }
});
router15.post("/paypal/capture", authenticateToken, async (req, res) => {
  const { orderId } = req.body;
  if (!orderId || typeof orderId !== "string" || !/^[A-Z0-9-]{6,40}$/i.test(orderId)) {
    return res.status(400).json({ message: "orderId required" });
  }
  try {
    const tx = await get("SELECT * FROM paymob_transactions WHERE paymob_order_id=?", [orderId]);
    if (!tx) return res.status(404).json({ message: "Transaction record not found" });
    if (Number(tx.user_id) !== Number(req.user.id)) {
      return res.status(403).json({ message: "You do not own this order" });
    }
    if (tx.status === "paid") return res.json({ message: "Already processed", status: "paid" });
    const capture = await ppCall("POST", `/v2/checkout/orders/${orderId}/capture`, {});
    if (capture.status !== "COMPLETED") {
      return res.status(400).json({ message: "PayPal payment not completed", status: capture.status });
    }
    const txId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.id || orderId;
    await run("UPDATE paymob_transactions SET status=?, paymob_transaction_id=? WHERE id=?", ["paid", txId, tx.id]);
    if (tx.type === "subscription" && tx.coach_id) {
      await activateSubscription(tx.user_id, tx.coach_id, tx.plan_cycle || "monthly", tx.plan_type || "complete", tx.amount, "paypal", txId);
    } else if (tx.type === "premium") {
      await activatePremium(tx.user_id, tx.plan_cycle || "monthly", tx.amount, "paypal", txId);
    }
    res.json({ message: "Payment captured successfully", status: "COMPLETED" });
  } catch (err) {
    console.error("PayPal capture error:", err.message);
    res.status(500).json({ message: "Failed to capture payment" });
  }
});
async function verifyPayPalWebhookSig(req) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    console.error("PayPal webhook rejected: PAYPAL_WEBHOOK_ID not configured");
    return false;
  }
  const headers = req.headers;
  const required = [
    "paypal-auth-algo",
    "paypal-cert-url",
    "paypal-transmission-id",
    "paypal-transmission-sig",
    "paypal-transmission-time"
  ];
  for (const h of required) {
    if (!headers[h]) return false;
  }
  try {
    const result = await ppCall("POST", "/v1/notifications/verify-webhook-signature", {
      auth_algo: headers["paypal-auth-algo"],
      cert_url: headers["paypal-cert-url"],
      transmission_id: headers["paypal-transmission-id"],
      transmission_sig: headers["paypal-transmission-sig"],
      transmission_time: headers["paypal-transmission-time"],
      webhook_id: webhookId,
      webhook_event: req.body
    });
    return result?.verification_status === "SUCCESS";
  } catch (e) {
    console.error("PayPal webhook verify failed:", e?.message || e);
    return false;
  }
}
router15.post("/webhook/paypal", async (req, res) => {
  res.sendStatus(200);
  try {
    const verified = await verifyPayPalWebhookSig(req);
    if (!verified) {
      console.warn("PayPal webhook rejected: signature did not verify");
      return;
    }
    const event = req.body;
    const type = event?.event_type;
    if (!type) return;
    if (type === "PAYMENT.CAPTURE.COMPLETED") {
      const orderId = event?.resource?.supplementary_data?.related_ids?.order_id;
      if (!orderId) return;
      const tx = await get("SELECT * FROM paymob_transactions WHERE paymob_order_id=? AND status=?", [orderId, "pending"]);
      if (!tx) return;
      await run("UPDATE paymob_transactions SET status=?, paymob_transaction_id=? WHERE id=?", ["paid", event.resource.id, tx.id]);
      if (tx.type === "subscription" && tx.coach_id) {
        await activateSubscription(tx.user_id, tx.coach_id, tx.plan_cycle, tx.plan_type, tx.amount, "paypal", event.resource.id);
      } else if (tx.type === "premium") {
        await activatePremium(tx.user_id, tx.plan_cycle, tx.amount, "paypal", event.resource.id);
      }
    }
  } catch (err) {
    console.error("PayPal webhook error:", err.message);
  }
});
router15.post("/withdraw", authenticateToken, async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount < 50) return res.status(400).json({ message: "Minimum withdrawal is 50 EGP" });
  try {
    const user = await get(
      "SELECT id, name, credit, payment_method_type, payment_phone, payment_wallet_type, paypal_email FROM users WHERE id=?",
      [req.user.id]
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    if ((user.credit || 0) < amount) return res.status(400).json({ message: "Insufficient balance" });
    const method = user.payment_method_type || "ewallet";
    if (method === "ewallet" && !user.payment_phone)
      return res.status(400).json({ message: "Please set your mobile wallet number in Profile \u2192 Payment Info" });
    if (method === "paypal" && !user.paypal_email)
      return res.status(400).json({ message: "Please set your PayPal email in Profile \u2192 Payment Info" });
    const { insertId } = await run(
      `INSERT INTO withdrawal_requests (coach_id, amount, payment_phone, wallet_type, payment_method_type, paypal_email, status)
       VALUES (?,?,?,?,?,?,'processing')`,
      [req.user.id, amount, user.payment_phone, user.payment_wallet_type, method, user.paypal_email]
    );
    await run("UPDATE users SET credit = credit - ? WHERE id=?", [amount, req.user.id]);
    await run(
      "INSERT INTO credit_transactions (user_id, amount, type, reference_id, description) VALUES (?,?,?,?,?)",
      [req.user.id, -amount, "withdrawal_processing", insertId, `Withdrawal of ${amount} EGP initiated`]
    );
    res.json({
      message: method === "paypal" ? `Processing ${amount} EGP payout to your PayPal. Funds arrive within minutes.` : `Your withdrawal request has been queued. An admin will send ${amount} EGP to your ${user.payment_wallet_type} wallet shortly.`,
      withdrawalId: insertId
    });
    autoPayout(req.user.id, amount, insertId).then(async (result) => {
      if (result.ok && !result.queuedManual) {
        await run(
          "UPDATE withdrawal_requests SET status=?, processed_at=NOW() WHERE id=?",
          ["approved", insertId]
        );
        await run(
          "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
          [req.user.id, "withdrawal", "\u2705 Payout Sent!", `${amount} EGP has been sent to your PayPal (${user.paypal_email}).`, "/coach/profile"]
        );
        console.log(`\u2705 Auto-payout ${amount} EGP \u2192 coach #${req.user.id}`);
      } else if (result.queuedManual) {
        await run(
          "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
          [req.user.id, "withdrawal", "\u23F3 Withdrawal Queued", `Your ${amount} EGP withdrawal request is queued for admin processing.`, "/coach/profile"]
        );
      } else {
        await run("UPDATE users SET credit = credit + ? WHERE id=?", [amount, req.user.id]);
        await run("UPDATE withdrawal_requests SET status=?, admin_note=? WHERE id=?", ["rejected", result.error, insertId]);
        await run(
          "INSERT INTO credit_transactions (user_id, amount, type, reference_id, description) VALUES (?,?,?,?,?)",
          [req.user.id, amount, "withdrawal_refund", insertId, `Payout failed \u2014 credit restored: ${result.error}`]
        );
        await run(
          "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
          [req.user.id, "withdrawal", "\u26A0\uFE0F Payout Failed", `Could not send ${amount} EGP. Your balance has been restored. Error: ${result.error}`, "/coach/profile"]
        );
        console.error(`\u274C Payout failed coach #${req.user.id}: ${result.error}`);
      }
    }).catch(async (err) => {
      await run("UPDATE users SET credit = credit + ? WHERE id=?", [amount, req.user.id]);
      await run("UPDATE withdrawal_requests SET status=?, admin_note=? WHERE id=?", ["rejected", err.message, insertId]);
      await run(
        "INSERT INTO credit_transactions (user_id, amount, type, reference_id, description) VALUES (?,?,?,?,?)",
        [req.user.id, amount, "withdrawal_refund", insertId, `Payout exception: ${err.message}`]
      );
      console.error("Payout exception:", err.message);
    });
  } catch (err) {
    console.error("Withdraw route error:", err.message);
    res.status(500).json({ message: "Failed to initiate withdrawal" });
  }
});
router15.get("/withdraw/:id", authenticateToken, async (req, res) => {
  try {
    const wr = await get("SELECT * FROM withdrawal_requests WHERE id=? AND coach_id=?", [req.params.id, req.user.id]);
    if (!wr) return res.status(404).json({ message: "Not found" });
    res.json({ withdrawal: wr });
  } catch {
    res.status(500).json({ message: "Failed to fetch withdrawal" });
  }
});
async function autoRefundSubscription(subscriptionId) {
  try {
    const sub = await get("SELECT * FROM coach_subscriptions WHERE id=?", [subscriptionId]);
    if (!sub) return false;
    const tx = await get(
      `SELECT * FROM paymob_transactions WHERE user_id=? AND coach_id=? AND type='subscription' AND status='paid' ORDER BY created_at DESC LIMIT 1`,
      [sub.user_id, sub.coach_id]
    );
    if (!tx) return false;
    await run("UPDATE coach_subscriptions SET refund_status=? WHERE id=?", ["pending", subscriptionId]);
    await run(
      "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
      [sub.user_id, "refund", "\u21A9\uFE0F Refund Pending", `Your payment of ${tx.amount} EGP is being refunded by an admin.`, "/app/coaching"]
    );
    return true;
  } catch (err) {
    console.error("Auto-refund error:", err.message);
    return false;
  }
}
router15.get("/history", authenticateToken, async (req, res) => {
  try {
    const txs = await query(
      `SELECT pt.*, c.name AS coach_name FROM paymob_transactions pt LEFT JOIN users c ON pt.coach_id = c.id
       WHERE pt.user_id=? ORDER BY pt.created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json({ transactions: txs });
  } catch {
    res.status(500).json({ message: "Failed to fetch history" });
  }
});
router15.get("/balance", authenticateToken, async (req, res) => {
  try {
    const user = await get(
      "SELECT credit, payment_method_type, payment_phone, payment_wallet_type, paypal_email FROM users WHERE id=?",
      [req.user.id]
    );
    const txs = await query("SELECT * FROM credit_transactions WHERE user_id=? ORDER BY created_at DESC LIMIT 50", [req.user.id]);
    const pending = await query("SELECT * FROM withdrawal_requests WHERE coach_id=? AND status=? ORDER BY created_at DESC", [req.user.id, "processing"]);
    res.json({ balance: user?.credit || 0, transactions: txs, pendingPayouts: pending, paymentInfo: { method: user?.payment_method_type, phone: user?.payment_phone, wallet: user?.payment_wallet_type, paypal: user?.paypal_email } });
  } catch {
    res.status(500).json({ message: "Failed to fetch balance" });
  }
});
var paymobRoutes_default = router15;

// server/routes/paymentRoutes.ts
init_auth();
init_database();
init_upload();
import https2 from "https";
var router16 = Router13();
var uploadPaymentProof = (req, res, next) => {
  upload.single("proof")(req, res, (err) => {
    if (!err) return next();
    const msg = String(err?.message || "Invalid upload");
    if (msg.toLowerCase().includes("file too large")) {
      return res.status(400).json({ message: "Proof image is too large. Please upload an image up to 5MB." });
    }
    if (msg.toLowerCase().includes("only images are allowed")) {
      return res.status(400).json({ message: "Only image files are allowed for payment proof." });
    }
    return res.status(400).json({ message: msg });
  });
};
async function getSetting(key) {
  const row = await get("SELECT setting_value FROM payment_settings WHERE setting_key = ?", [key]);
  return row ? row.setting_value : null;
}
function normalizeCoachSubscriptionStatus(status) {
  if (!status) return "pending_admin";
  if (status === "pending") return "pending_admin";
  return status;
}
function getCoachSubscriptionDurationMonths(planCycle) {
  return planCycle === "yearly" ? 12 : 1;
}
async function computeCoachCut(amount) {
  const pctStr = await getSetting("coach_cut_percentage");
  const pct = pctStr ? Math.min(100, Math.max(0, Number(pctStr))) : 90;
  return Math.round(amount * (pct / 100) * 100) / 100;
}
async function getPayPalHostname() {
  const mode = await getSetting("paypal_mode");
  return mode === "live" ? "api-m.paypal.com" : "api-m.sandbox.paypal.com";
}
function normalizePhone(v) {
  return String(v || "").trim().replace(/\s+/g, "");
}
function isWalletPhoneValid(walletType, phone) {
  const clean = normalizePhone(phone);
  if (!/^\d{11}$/.test(clean)) return false;
  if (walletType === "vodafone") return clean.startsWith("010");
  if (walletType === "orange") return clean.startsWith("012");
  if (walletType === "we") return clean.startsWith("011");
  return false;
}
function pickWalletPhone(user) {
  const walletType = String(user?.payment_wallet_type || "vodafone");
  if (walletType === "orange") return user?.payment_phone_orange || user?.payment_phone || null;
  if (walletType === "we") return user?.payment_phone_we || user?.payment_phone || null;
  return user?.payment_phone_vodafone || user?.payment_phone || null;
}
var cachedRate = null;
var RATE_TTL = 6 * 36e5;
async function egpToUsd2(egpAmount) {
  const fixedRate = await getSetting("egp_usd_rate");
  if (fixedRate && Number(fixedRate) > 0) {
    return Math.round(egpAmount / Number(fixedRate) * 100) / 100;
  }
  if (cachedRate && Date.now() - cachedRate.ts < RATE_TTL) {
    return Math.round(egpAmount / cachedRate.rate * 100) / 100;
  }
  try {
    const rate = await new Promise((resolve, reject) => {
      const req = https2.request({
        hostname: "open.er-api.com",
        path: "/v6/latest/USD",
        method: "GET",
        timeout: 5e3
      }, (res) => {
        let data = "";
        res.on("data", (c) => data += c);
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (json?.result === "success" && json.rates?.EGP) {
              resolve(Number(json.rates.EGP));
            } else {
              reject(new Error("bad response"));
            }
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("timeout"));
      });
      req.end();
    });
    cachedRate = { rate, ts: Date.now() };
    return Math.round(egpAmount / rate * 100) / 100;
  } catch {
    return Math.round(egpAmount / 50.5 * 100) / 100;
  }
}
async function getPayPalToken(clientId, secret) {
  const hostname = await getPayPalHostname();
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
    const body = "grant_type=client_credentials";
    const opts = {
      hostname,
      path: "/v1/oauth2/token",
      method: "POST",
      headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded", "Content-Length": body.length }
    };
    const req = https2.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => data += c);
      res.on("end", () => {
        try {
          resolve(JSON.parse(data).access_token);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}
async function paypalRequest(clientId, secret, method, path5, body) {
  const hostname = await getPayPalHostname();
  const token = await getPayPalToken(clientId, secret);
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : "";
    const opts = {
      hostname,
      path: path5,
      method,
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(bodyStr || " ") }
    };
    const req = https2.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => data += c);
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({});
        }
      });
    });
    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}
router16.get("/public-settings", async (_req, res) => {
  try {
    const rows = await query("SELECT setting_key, setting_value FROM payment_settings");
    const settings = {};
    for (const row of rows) {
      if (["paypal_user_link", "paypal_coach_link", "ewallet_phone", "ewallet_phone_vodafone", "ewallet_phone_orange", "ewallet_phone_we", "paypal_user_client_id", "paypal_coach_client_id", "pm_orange_cash", "pm_vodafone_cash", "pm_we_pay", "pm_paypal", "pm_credit_card", "pm_google_pay", "pm_apple_pay"].includes(row.setting_key)) {
        settings[row.setting_key] = row.setting_value;
      }
    }
    res.json({ settings });
  } catch {
    res.status(500).json({ message: "Failed to fetch settings" });
  }
});
router16.post("/paypal/create-order", authenticateToken, async (req, res) => {
  const { amount, plan, type, coachId, coachName } = req.body;
  try {
    const clientIdKey = type === "coach" ? "paypal_coach_client_id" : "paypal_user_client_id";
    const secretKey = type === "coach" ? "paypal_coach_secret" : "paypal_user_secret";
    const clientId = await getSetting(clientIdKey);
    const secret = await getSetting(secretKey);
    if (!clientId || !secret) {
      return res.status(503).json({ message: "PayPal not configured by admin yet" });
    }
    const description = coachId ? `FitWay Coach Subscription - ${coachName || "Coach"} (${plan})` : `FitWay ${type === "coach" ? "Coach Membership" : "Premium"} - ${plan}`;
    const usdAmount = await egpToUsd2(parseFloat(amount));
    const origin = req.headers.origin || process.env.APP_BASE_URL || "http://localhost:3000";
    const order = await paypalRequest(clientId, secret, "POST", "/v2/checkout/orders", {
      intent: "CAPTURE",
      purchase_units: [{
        amount: { currency_code: "USD", value: String(usdAmount.toFixed(2)) },
        description
      }],
      application_context: {
        return_url: `${origin}/payment/success?plan=${plan}&type=${type}&amount=${amount}`,
        cancel_url: `${origin}/payment/cancel`,
        brand_name: "FitWay Hub",
        user_action: "PAY_NOW"
      }
    });
    if (order.id) {
      res.json({ id: order.id });
    } else {
      res.status(500).json({ message: "Failed to create PayPal order", detail: order });
    }
  } catch (err) {
    res.status(500).json({ message: "Failed to create PayPal order", error: err.message });
  }
});
router16.post("/paypal/capture-order", authenticateToken, async (req, res) => {
  const { orderId, plan, type, amount, coachId } = req.body;
  try {
    const clientIdKey = type === "coach" ? "paypal_coach_client_id" : "paypal_user_client_id";
    const secretKey = type === "coach" ? "paypal_coach_secret" : "paypal_user_secret";
    const clientId = await getSetting(clientIdKey);
    const secret = await getSetting(secretKey);
    if (!clientId || !secret) return res.status(503).json({ message: "PayPal not configured" });
    const capture = await paypalRequest(clientId, secret, "POST", `/v2/checkout/orders/${orderId}/capture`, {});
    if (capture.status === "COMPLETED") {
      if (coachId) {
        const coach = await get(
          `SELECT u.id, COALESCE(cp.monthly_price, 0) as monthly_price, COALESCE(cp.yearly_price, 0) as yearly_price, COALESCE(cp.plan_types, 'complete') as plan_types
           FROM users u LEFT JOIN coach_profiles cp ON cp.user_id = u.id
           WHERE u.id = ? AND u.role = 'coach'`,
          [coachId]
        );
        if (!coach) return res.status(404).json({ message: "Coach not found" });
        const planCycle = plan === "annual" ? "yearly" : "monthly";
        const subAmount = planCycle === "yearly" ? Number(coach.yearly_price || 0) : Number(coach.monthly_price || 0);
        const existingPending = await get(
          `SELECT id FROM coach_subscriptions
           WHERE user_id = ? AND coach_id = ? AND status IN ('pending_admin', 'pending_coach', 'pending')
           ORDER BY created_at DESC LIMIT 1`,
          [req.user.id, coachId]
        );
        if (existingPending) {
          return res.status(400).json({ message: "You already have a pending subscription request for this coach." });
        }
        const expiresAt = /* @__PURE__ */ new Date();
        expiresAt.setMonth(expiresAt.getMonth() + getCoachSubscriptionDurationMonths(planCycle));
        const coachCutAmt = Math.round(subAmount * (Number(process.env.COACH_CUT_PERCENT || 85) / 100) * 100) / 100;
        await run(
          `INSERT INTO coach_subscriptions
           (user_id, coach_id, plan_cycle, plan_type, amount, status,
            admin_approval_status, coach_decision_status,
            payment_method, started_at, expires_at, credited_amount, credit_released_at)
           VALUES (?,?,?,?,?,'active','approved','accepted','paypal',NOW(),?,?,NOW())`,
          [
            req.user.id,
            coachId,
            planCycle,
            coach.plan_types || "complete",
            subAmount,
            expiresAt.toISOString().slice(0, 19).replace("T", " "),
            coachCutAmt
          ]
        );
        await run("UPDATE users SET credit = credit + ? WHERE id=?", [coachCutAmt, coachId]);
        const payer = await get("SELECT name FROM users WHERE id = ?", [req.user.id]);
        const payerName = payer?.name || "Subscriber";
        await run(
          "INSERT INTO credit_transactions (user_id, amount, type, description) VALUES (?,?,?,?)",
          [coachId, coachCutAmt, "subscription_income", `PayPal subscription from ${payerName}`]
        );
        await run(
          "INSERT INTO payments (user_id, type, plan, amount, payment_method, transaction_id, status) VALUES (?,?,?,?,?,?,?)",
          [req.user.id, "coach_subscription", plan, subAmount, "paypal", orderId, "completed"]
        );
        await Promise.all([
          run(
            "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
            [req.user.id, "subscription", "\u2705 Subscription Active!", `Your ${planCycle} plan with the coach is now active.`, "/app/coaching"]
          ),
          run(
            "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
            [coachId, "subscription", "\u{1F4B0} New Subscriber!", `A user subscribed via PayPal. ${coachCutAmt} EGP added to your balance.`, "/coach/profile"]
          )
        ]);
        sendPushToUser(req.user.id, "\u2705 Subscription Active!", `Your ${planCycle} plan with the coach is now active.`, void 0, "/app/coaching", "subscription").catch(() => {
        });
        sendPushToUser(coachId, "\u{1F4B0} New Subscriber!", `A user subscribed via PayPal. ${coachCutAmt} EGP added to your balance.`, void 0, "/coach/profile", "subscription").catch(() => {
        });
        res.json({ message: "Subscription activated! Your plan is now active.", status: "COMPLETED" });
        return;
      }
      await run(
        "INSERT INTO payments (user_id, type, plan, amount, payment_method, transaction_id, status) VALUES (?,?,?,?,?,?,?)",
        [req.user.id, type === "coach" ? "coach_membership" : "premium", plan, amount, "paypal", orderId, "completed"]
      );
      if (type === "coach") {
        await run("UPDATE users SET coach_membership_active = 1 WHERE id = ?", [req.user.id]);
      } else {
        const u = await get("SELECT role FROM users WHERE id = ?", [req.user.id]);
        if (u && u.role === "user") {
          await run("UPDATE users SET is_premium = 1 WHERE id = ?", [req.user.id]);
        }
      }
      res.json({ message: "Payment completed", status: "COMPLETED" });
    } else {
      res.status(400).json({ message: "Payment not completed", status: capture.status });
    }
  } catch (err) {
    res.status(500).json({ message: "Failed to capture PayPal order", error: err.message });
  }
});
function getPremiumAmount(plan) {
  return plan === "annual" ? 450 : 50;
}
router16.post("/ewallet", authenticateToken, uploadPaymentProof, optimizeImage(), async (req, res) => {
  const { plan, type, walletType, senderNumber, coachId } = req.body;
  if (!plan || !type || !walletType || !senderNumber) return res.status(400).json({ message: "All fields required" });
  if (!req.file) return res.status(400).json({ message: "Payment proof screenshot is required" });
  const proofUrl = await uploadToR2(req.file, "proofs");
  try {
    if (coachId) {
      const coach = await get(
        `SELECT u.id, COALESCE(cp.monthly_price, 0) as monthly_price, COALESCE(cp.yearly_price, 0) as yearly_price, COALESCE(cp.plan_types, 'complete') as plan_types
         FROM users u LEFT JOIN coach_profiles cp ON cp.user_id = u.id
         WHERE u.id = ? AND u.role = 'coach'`,
        [coachId]
      );
      if (!coach) return res.status(404).json({ message: "Coach not found" });
      const planCycle = plan === "annual" ? "yearly" : "monthly";
      const amount2 = planCycle === "yearly" ? Number(coach.yearly_price || 0) : Number(coach.monthly_price || 0);
      if (amount2 <= 0) return res.status(400).json({ message: "Coach has not set pricing for this plan" });
      const existingPending = await get(
        `SELECT id FROM coach_subscriptions
         WHERE user_id = ? AND coach_id = ? AND status IN ('pending_admin', 'pending_coach', 'pending')
         ORDER BY created_at DESC LIMIT 1`,
        [req.user.id, coachId]
      );
      if (existingPending) {
        return res.status(400).json({ message: "You already have a pending subscription request for this coach." });
      }
      const expiresAt = /* @__PURE__ */ new Date();
      expiresAt.setMonth(expiresAt.getMonth() + getCoachSubscriptionDurationMonths(planCycle));
      await run(
        `INSERT INTO coach_subscriptions
         (user_id, coach_id, plan_cycle, plan_type, amount, status, payment_method, payment_proof, expires_at, payer_wallet_type, payer_number)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [
          req.user.id,
          coachId,
          planCycle,
          coach.plan_types || "complete",
          amount2,
          "pending_admin",
          `ewallet_${walletType}`,
          proofUrl,
          expiresAt.toISOString().slice(0, 19).replace("T", " "),
          walletType,
          senderNumber
        ]
      );
      return res.json({
        message: "Payment proof submitted. Awaiting admin verification, then coach confirmation.",
        proofUrl,
        status: "pending_admin"
      });
    }
    const amount = getPremiumAmount(plan);
    await run(
      "INSERT INTO payments (user_id, type, plan, amount, payment_method, proof_url, wallet_type, sender_number, status) VALUES (?,?,?,?,?,?,?,?,?)",
      [req.user.id, type === "coach" ? "coach_membership" : "premium", plan, amount, "ewallet", proofUrl, walletType, senderNumber, "pending"]
    );
    res.json({
      message: "Payment proof submitted. Your request is pending admin approval. You will be notified once approved.",
      proofUrl,
      status: "pending"
    });
  } catch (err) {
    console.error("E-wallet payment submit error:", err?.message || err);
    res.status(500).json({ message: "Failed to process e-wallet payment" });
  }
});
router16.patch("/approve/:paymentId", authenticateToken, async (req, res) => {
  if (req.user?.role !== "admin") return res.status(403).json({ message: "Admin only" });
  const { paymentId } = req.params;
  try {
    const payment = await get("SELECT * FROM payments WHERE id = ?", [paymentId]);
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    await run("UPDATE payments SET status = ? WHERE id = ?", ["completed", paymentId]);
    if (payment.type === "coach_membership") {
      await run("UPDATE users SET coach_membership_active = 1 WHERE id = ?", [payment.user_id]);
    } else if (payment.type === "premium") {
      const target = await get("SELECT role FROM users WHERE id = ?", [payment.user_id]);
      if (target && target.role === "user") {
        await run("UPDATE users SET is_premium = 1 WHERE id = ?", [payment.user_id]);
      }
    }
    res.json({ message: "Payment approved and account activated" });
    if (payment.user_id) {
      sendPushFromTemplate(payment.user_id, "payment_approved", {}).catch(() => {
      });
    }
  } catch {
    res.status(500).json({ message: "Failed to approve payment" });
  }
});
router16.patch("/reject/:paymentId", authenticateToken, async (req, res) => {
  if (req.user?.role !== "admin") return res.status(403).json({ message: "Admin only" });
  const { paymentId } = req.params;
  const { reason } = req.body;
  try {
    const payment = await get("SELECT user_id, amount, type FROM payments WHERE id = ?", [paymentId]);
    await run("UPDATE payments SET status = ? WHERE id = ?", ["rejected", paymentId]);
    if (payment?.user_id) {
      const note = reason ? `: ${reason}` : "";
      await run(
        "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
        [payment.user_id, "payment_rejected", "\u274C Payment Rejected", `Your e-wallet payment of ${payment.amount || ""} EGP has been rejected${note}`, "/app/coaching"]
      );
      sendPushFromTemplate(payment.user_id, "payment_rejected", {}, "/app/coaching").catch(() => {
      });
    }
    res.json({ message: "Payment rejected" });
  } catch {
    res.status(500).json({ message: "Failed to reject payment" });
  }
});
router16.post("/booking/paypal/create-order", authenticateToken, async (req, res) => {
  const { bookingId, amount, coachName } = req.body;
  try {
    const clientId = await getSetting("paypal_user_client_id");
    const secret = await getSetting("paypal_user_secret");
    if (!clientId || !secret) return res.status(503).json({ message: "PayPal not configured" });
    const bookingUsd = await egpToUsd2(parseFloat(amount));
    const origin = req.headers.origin || process.env.APP_BASE_URL || "http://localhost:3000";
    const order = await paypalRequest(clientId, secret, "POST", "/v2/checkout/orders", {
      intent: "CAPTURE",
      purchase_units: [{
        amount: { currency_code: "USD", value: String(bookingUsd.toFixed(2)) },
        description: `FitWay Coaching - ${coachName}`
      }],
      application_context: {
        return_url: `${origin}/app/coaching?booking_success=${bookingId}`,
        cancel_url: `${origin}/app/coaching?booking_cancel=${bookingId}`,
        brand_name: "FitWay Hub",
        user_action: "PAY_NOW"
      }
    });
    if (order.id) {
      res.json({ id: order.id });
    } else {
      res.status(500).json({ message: "Failed to create order", detail: order });
    }
  } catch (err) {
    res.status(500).json({ message: "Failed to create PayPal order", error: err.message });
  }
});
router16.post("/booking/paypal/capture", authenticateToken, async (req, res) => {
  const { orderId, bookingId } = req.body;
  try {
    const clientId = await getSetting("paypal_user_client_id");
    const secret = await getSetting("paypal_user_secret");
    if (!clientId || !secret) return res.status(503).json({ message: "PayPal not configured" });
    const capture = await paypalRequest(clientId, secret, "POST", `/v2/checkout/orders/${orderId}/capture`, {});
    if (capture.status === "COMPLETED") {
      await run(
        "UPDATE coaching_bookings SET payment_status = ?, payment_transaction_id = ?, payment_method = ? WHERE id = ? AND user_id = ?",
        ["paid", orderId, "paypal", bookingId, req.user.id]
      );
      res.json({ message: "Booking payment completed", status: "COMPLETED" });
    } else {
      res.status(400).json({ message: "Payment not completed", status: capture.status });
    }
  } catch (err) {
    res.status(500).json({ message: "Capture failed", error: err.message });
  }
});
router16.post("/booking/ewallet", authenticateToken, upload.single("proof"), optimizeImage(), async (req, res) => {
  const { bookingId, walletType, senderNumber } = req.body;
  if (!bookingId || !walletType || !senderNumber || !req.file) {
    return res.status(400).json({ message: "All fields and proof screenshot required" });
  }
  const proofUrl = await uploadToR2(req.file, "proofs");
  try {
    await run(
      "UPDATE coaching_bookings SET payment_status = ?, payment_proof = ?, payment_method = ? WHERE id = ? AND user_id = ?",
      ["proof_submitted", proofUrl, `ewallet_${walletType}`, bookingId, req.user.id]
    );
    res.json({ message: "Payment proof submitted. Coach will confirm once verified.", proofUrl });
  } catch {
    res.status(500).json({ message: "Failed to submit proof" });
  }
});
router16.patch("/booking/confirm-payment/:bookingId", authenticateToken, async (req, res) => {
  const { bookingId } = req.params;
  try {
    const booking = await get("SELECT * FROM coaching_bookings WHERE id = ? AND coach_id = ?", [bookingId, req.user.id]);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    await run("UPDATE coaching_bookings SET payment_status = ? WHERE id = ?", ["paid", bookingId]);
    res.json({ message: "Payment confirmed" });
  } catch {
    res.status(500).json({ message: "Failed to confirm payment" });
  }
});
router16.post("/coach-subscribe", authenticateToken, upload.single("proof"), optimizeImage(), async (req, res) => {
  const { coachId, planCycle, planType, walletType, senderNumber } = req.body;
  if (!coachId || !planCycle || !planType) return res.status(400).json({ message: "Coach ID, plan cycle, and plan type are required" });
  if (!req.file) return res.status(400).json({ message: "Payment proof screenshot is required" });
  if (!walletType || !senderNumber) return res.status(400).json({ message: "Wallet type and sender number are required" });
  try {
    const coach = await get(
      `SELECT u.id, COALESCE(cp.monthly_price, 0) as monthly_price, COALESCE(cp.yearly_price, 0) as yearly_price, COALESCE(cp.plan_types, 'complete') as plan_types
       FROM users u LEFT JOIN coach_profiles cp ON cp.user_id = u.id
       WHERE u.id = ? AND u.role = 'coach'`,
      [coachId]
    );
    if (!coach) return res.status(404).json({ message: "Coach not found" });
    const amount = planCycle === "yearly" ? coach.yearly_price || 0 : coach.monthly_price || 0;
    if (amount <= 0) return res.status(400).json({ message: "Coach has not set pricing for this plan" });
    const proofUrl = await uploadToR2(req.file, "proofs");
    const expiresAt = /* @__PURE__ */ new Date();
    if (planCycle === "yearly") {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }
    await run(
      `INSERT INTO coach_subscriptions
       (user_id, coach_id, plan_cycle, plan_type, amount, status, payment_method, payment_proof, expires_at, payer_wallet_type, payer_number)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        req.user.id,
        coachId,
        planCycle,
        planType,
        amount,
        "pending_admin",
        `ewallet_${walletType}`,
        proofUrl,
        expiresAt.toISOString().slice(0, 19).replace("T", " "),
        walletType,
        senderNumber
      ]
    );
    res.json({ message: "Subscription request submitted! Awaiting admin verification, then coach approval.", status: "pending_admin", amount });
  } catch (err) {
    console.error("Coach subscribe error:", err);
    res.status(500).json({ message: "Failed to process subscription" });
  }
});
router16.get("/coach-subscriptions", authenticateToken, async (req, res) => {
  if (req.user?.role !== "admin") return res.status(403).json({ message: "Admin only" });
  try {
    const statusFilter = req.query.status ? String(req.query.status) : null;
    const subs = await query(
      `SELECT cs.*,
              u.name AS user_name, u.email AS user_email, u.avatar AS user_avatar,
              c.name AS coach_name, c.email AS coach_email, c.avatar AS coach_avatar
       FROM coach_subscriptions cs
       LEFT JOIN users u ON cs.user_id = u.id
       LEFT JOIN users c ON cs.coach_id = c.id
       ${statusFilter ? "WHERE cs.status = '" + statusFilter.replace(/[^a-z_]/g, "") + "'" : ""}
       ORDER BY cs.created_at DESC`
    );
    res.json({ subscriptions: subs });
  } catch {
    res.status(500).json({ message: "Failed to fetch subscriptions" });
  }
});
router16.patch("/coach-subscriptions/:id/approve", authenticateToken, async (req, res) => {
  if (req.user?.role !== "admin") return res.status(403).json({ message: "Admin only" });
  const { id } = req.params;
  try {
    const sub = await get("SELECT * FROM coach_subscriptions WHERE id = ?", [id]);
    if (!sub) return res.status(404).json({ message: "Subscription not found" });
    const currentStatus = normalizeCoachSubscriptionStatus(sub.status);
    if (currentStatus === "active") return res.json({ message: "Already active" });
    if (currentStatus === "rejected_admin" || currentStatus === "rejected_by_coach" || currentStatus === "refunded") {
      return res.status(400).json({ message: "Cannot approve a rejected/refunded subscription" });
    }
    await run("UPDATE coach_subscriptions SET status = ?, admin_approval_status = ?, admin_approved_at = NOW() WHERE id = ?", ["pending_coach", "approved", id]);
    await run(
      "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
      [sub.coach_id, "subscription", "New Subscription Request", "A user paid and requested to subscribe to you. Please accept or decline from Requests.", "/coach/profile"]
    );
    sendPushFromTemplate(sub.coach_id, "subscription_verified", {}, "/coach/profile").catch(() => {
    });
    await run(
      "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
      [sub.user_id, "subscription", "Payment Verified", "Admin verified your payment. Waiting for coach acceptance.", "/app/coaching"]
    );
    sendPushFromTemplate(sub.user_id, "subscription_verified_user", {}, "/app/coaching").catch(() => {
    });
    res.json({ message: "Payment verified. Waiting for coach decision." });
  } catch (err) {
    console.error("Approve sub error:", err);
    res.status(500).json({ message: "Failed to approve subscription" });
  }
});
router16.patch("/coach-subscriptions/approve-all", authenticateToken, async (req, res) => {
  if (req.user?.role !== "admin") return res.status(403).json({ message: "Admin only" });
  try {
    const pendingSubs = await query(
      `SELECT id, user_id, coach_id
       FROM coach_subscriptions
       WHERE status IN ('pending_admin', 'pending')
       ORDER BY created_at ASC`
    );
    if (!pendingSubs.length) {
      return res.json({ message: "No pending subscriptions found", approved: 0 });
    }
    for (const sub of pendingSubs) {
      await run(
        "UPDATE coach_subscriptions SET status = ?, admin_approval_status = ?, admin_approved_at = NOW() WHERE id = ?",
        ["pending_coach", "approved", sub.id]
      );
      await run(
        "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
        [sub.coach_id, "subscription", "New Subscription Request", "A user paid and requested to subscribe to you. Please accept or decline from Requests.", "/coach/profile"]
      );
      sendPushToUser(sub.coach_id, "New Subscription Request", "A user paid and requested to subscribe to you. Please accept or decline from Requests.", void 0, "/coach/profile", "subscription").catch(() => {
      });
      await run(
        "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
        [sub.user_id, "subscription", "Payment Verified", "Admin verified your payment. Waiting for coach acceptance.", "/app/coaching"]
      );
      sendPushToUser(sub.user_id, "Payment Verified", "Admin verified your payment. Waiting for coach acceptance.", void 0, "/app/coaching", "subscription").catch(() => {
      });
    }
    res.json({ message: `Verified ${pendingSubs.length} pending subscriptions`, approved: pendingSubs.length });
  } catch {
    res.status(500).json({ message: "Failed to verify all subscriptions" });
  }
});
router16.patch("/coach-subscriptions/:id/reject", authenticateToken, async (req, res) => {
  if (req.user?.role !== "admin") return res.status(403).json({ message: "Admin only" });
  const { id } = req.params;
  const { note } = req.body;
  try {
    const sub = await get("SELECT * FROM coach_subscriptions WHERE id = ?", [id]);
    if (!sub) return res.status(404).json({ message: "Subscription not found" });
    const currentStatus = normalizeCoachSubscriptionStatus(sub.status);
    if (currentStatus === "active") return res.status(400).json({ message: "Active subscription cannot be rejected" });
    if (currentStatus === "rejected_admin" || currentStatus === "rejected_by_coach" || currentStatus === "refunded") {
      return res.json({ message: "Already rejected/refunded" });
    }
    await run(
      `UPDATE coach_subscriptions
       SET status = ?, admin_approval_status = ?, refund_status = ?, refunded_at = NOW(), refund_amount = amount, refund_reason = ?
       WHERE id = ?`,
      ["rejected_admin", "rejected", "completed", note || "Rejected by admin", id]
    );
    await run(
      "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
      [sub.user_id, "refund", "Subscription Rejected and Refunded", `Your payment for coach subscription was rejected by admin and marked as refunded.${note ? ` Reason: ${note}` : ""}`, "/app/coaching"]
    );
    sendPushFromTemplate(sub.user_id, "subscription_rejected", {}, "/app/coaching").catch(() => {
    });
    res.json({ message: "Subscription rejected and user marked refunded." });
  } catch {
    res.status(500).json({ message: "Failed to reject subscription" });
  }
});
router16.get("/coach-subscription-requests", authenticateToken, async (req, res) => {
  if (req.user?.role !== "coach" && req.user?.role !== "admin") {
    return res.status(403).json({ message: "Coach access required" });
  }
  try {
    const subs = await query(
      `SELECT cs.*, u.name as user_name, u.email as user_email, u.avatar as user_avatar
       FROM coach_subscriptions cs
       LEFT JOIN users u ON cs.user_id = u.id
       WHERE cs.coach_id = ? AND cs.status IN ('pending_coach', 'pending_admin', 'pending')
       ORDER BY cs.created_at DESC`,
      [req.user.id]
    );
    res.json({ subscriptions: subs });
  } catch {
    res.status(500).json({ message: "Failed to fetch coach subscription requests" });
  }
});
router16.get("/coach-active-subscriptions", authenticateToken, async (req, res) => {
  if (req.user?.role !== "coach" && req.user?.role !== "admin") {
    return res.status(403).json({ message: "Coach access required" });
  }
  try {
    const subs = await query(
      `SELECT cs.*, u.name as user_name, u.email as user_email, u.avatar as user_avatar
       FROM coach_subscriptions cs
       LEFT JOIN users u ON cs.user_id = u.id
       WHERE cs.coach_id = ? AND cs.status = 'active' AND (cs.expires_at IS NULL OR cs.expires_at > NOW())
       ORDER BY cs.expires_at ASC, cs.created_at DESC`,
      [req.user.id]
    );
    res.json({ subscriptions: subs });
  } catch {
    res.status(500).json({ message: "Failed to fetch active subscriptions" });
  }
});
router16.patch("/coach-subscriptions/:id/coach-accept", authenticateToken, async (req, res) => {
  if (req.user?.role !== "coach" && req.user?.role !== "admin") {
    return res.status(403).json({ message: "Coach access required" });
  }
  const { id } = req.params;
  try {
    const sub = await get("SELECT * FROM coach_subscriptions WHERE id = ? AND coach_id = ?", [id, req.user.id]);
    if (!sub) return res.status(404).json({ message: "Subscription request not found" });
    const currentStatus = normalizeCoachSubscriptionStatus(sub.status);
    if (currentStatus !== "pending_coach") {
      return res.status(400).json({ message: "This subscription is not waiting for coach decision" });
    }
    const coachCut = await computeCoachCut(Number(sub.amount || 0));
    await run(
      `UPDATE coach_subscriptions
       SET status = ?, coach_decision_status = ?, coach_decided_at = NOW(), started_at = NOW(), credited_amount = ?, credit_released_at = NOW()
       WHERE id = ?`,
      ["active", "accepted", coachCut, id]
    );
    await run("UPDATE users SET credit = credit + ? WHERE id = ?", [coachCut, sub.coach_id]);
    const payer = await get("SELECT name FROM users WHERE id = ?", [sub.user_id]);
    const payerName = payer?.name || `User ${sub.user_id}`;
    await run(
      "INSERT INTO credit_transactions (user_id, amount, type, reference_id, description) VALUES (?,?,?,?,?)",
      [sub.coach_id, coachCut, "subscription_income", sub.id, `Subscription accepted from ${payerName} (${sub.plan_cycle} ${sub.plan_type})`]
    );
    await run(
      "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
      [sub.user_id, "subscription", "Coach Accepted Your Subscription \u2705", "Your coach accepted your subscription and your plan is now active.", "/app/coaching"]
    );
    sendPushFromTemplate(sub.user_id, "subscription_coach_accepted", {}, "/app/coaching").catch(() => {
    });
    res.json({ message: `Subscription activated. Coach credited ${coachCut} EGP.` });
  } catch {
    res.status(500).json({ message: "Failed to accept subscription" });
  }
});
router16.patch("/coach-subscriptions/:id/coach-decline", authenticateToken, async (req, res) => {
  if (req.user?.role !== "coach" && req.user?.role !== "admin") {
    return res.status(403).json({ message: "Coach access required" });
  }
  const { id } = req.params;
  const { reason } = req.body;
  try {
    const sub = await get("SELECT * FROM coach_subscriptions WHERE id = ? AND coach_id = ?", [id, req.user.id]);
    if (!sub) return res.status(404).json({ message: "Subscription request not found" });
    const currentStatus = normalizeCoachSubscriptionStatus(sub.status);
    if (currentStatus !== "pending_coach") {
      return res.status(400).json({ message: "This subscription is not waiting for coach decision" });
    }
    await run(
      `UPDATE coach_subscriptions
       SET status = ?, coach_decision_status = ?, coach_decided_at = NOW(), refund_status = ?, refund_reason = ?
       WHERE id = ?`,
      ["rejected_by_coach", "rejected", "processing", reason || "Declined by coach", id]
    );
    autoRefundSubscription(Number(id)).then(async (refunded) => {
      if (!refunded) {
        await run(
          "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
          [sub.user_id, "refund", "Subscription Declined \u2014 Refund Pending", `The coach declined. Your refund is being processed and will appear soon.${reason ? " Reason: " + reason : ""}`, "/app/coaching"]
        );
      }
    }).catch(() => {
    });
    await run(
      "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
      [sub.user_id, "refund", "Coach Declined Subscription", `Your coach declined the subscription request. If you paid, a refund is being processed automatically.${reason ? " Reason: " + reason : ""}`, "/app/coaching"]
    );
    sendPushFromTemplate(sub.user_id, "subscription_coach_declined", {}, "/app/coaching").catch(() => {
    });
    res.json({ message: "Subscription declined. Auto-refund initiated." });
  } catch {
    res.status(500).json({ message: "Failed to decline subscription" });
  }
});
router16.get("/coach-subscription-status/:coachId", authenticateToken, async (req, res) => {
  try {
    const activeSub = await get(
      `SELECT * FROM coach_subscriptions WHERE user_id = ? AND coach_id = ? AND status = 'active' AND expires_at > NOW() ORDER BY expires_at DESC LIMIT 1`,
      [req.user.id, req.params.coachId]
    );
    const latestSub = await get(
      `SELECT * FROM coach_subscriptions WHERE user_id = ? AND coach_id = ? ORDER BY created_at DESC LIMIT 1`,
      [req.user.id, req.params.coachId]
    );
    const latestStatus = normalizeCoachSubscriptionStatus(latestSub?.status);
    res.json({
      subscribed: !!activeSub,
      subscription: activeSub || null,
      latestRequest: latestSub || null,
      latestStatus,
      canRequestNew: !latestSub || !["pending_admin", "pending_coach", "pending"].includes(latestStatus)
    });
  } catch {
    res.status(500).json({ message: "Failed to check subscription" });
  }
});
router16.get("/my-subscriptions", authenticateToken, async (req, res) => {
  try {
    const subs = await query(
      `SELECT cs.*, c.name as coach_name, c.avatar as coach_avatar, cp.specialty
       FROM coach_subscriptions cs
       LEFT JOIN users c ON cs.coach_id = c.id
       LEFT JOIN coach_profiles cp ON cp.user_id = c.id
       WHERE cs.user_id = ? AND cs.status = 'active' AND (cs.expires_at IS NULL OR cs.expires_at > NOW())
       ORDER BY cs.expires_at DESC`,
      [req.user.id]
    );
    res.json({ subscriptions: subs });
  } catch {
    res.status(500).json({ message: "Failed to fetch subscriptions" });
  }
});
router16.patch("/subscriptions/:id/auto-renew", authenticateToken, async (req, res) => {
  const { auto_renew } = req.body;
  try {
    const sub = await get("SELECT id, user_id FROM coach_subscriptions WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    if (!sub) return res.status(404).json({ message: "Subscription not found" });
    await run("UPDATE coach_subscriptions SET auto_renew = ? WHERE id = ?", [auto_renew ? 1 : 0, req.params.id]);
    res.json({ message: `Auto-renew ${auto_renew ? "enabled" : "disabled"}`, auto_renew: !!auto_renew });
  } catch {
    res.status(500).json({ message: "Failed to update auto-renew" });
  }
});
router16.get("/my-credit", authenticateToken, async (req, res) => {
  try {
    const user = await get("SELECT credit, payment_phone, payment_phone_vodafone, payment_phone_orange, payment_phone_we, payment_wallet_type, payment_method_type, paypal_email, card_holder_name, card_number, instapay_handle FROM users WHERE id = ?", [req.user.id]);
    const transactions = await query(
      `SELECT ct.*, su.name AS payer_name
       FROM credit_transactions ct
       LEFT JOIN coach_subscriptions cs ON cs.id = ct.reference_id
       LEFT JOIN users su ON su.id = cs.user_id
       WHERE ct.user_id = ?
       ORDER BY ct.created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json({
      credit: user?.credit || 0,
      paymentPhone: pickWalletPhone(user),
      paymentPhoneVodafone: user?.payment_phone_vodafone || "",
      paymentPhoneOrange: user?.payment_phone_orange || "",
      paymentPhoneWe: user?.payment_phone_we || "",
      walletType: user?.payment_wallet_type,
      paymentMethodType: user?.payment_method_type || "ewallet",
      paypalEmail: user?.paypal_email,
      cardHolderName: user?.card_holder_name,
      cardNumber: user?.card_number,
      instapayHandle: user?.instapay_handle,
      transactions
    });
  } catch {
    res.status(500).json({ message: "Failed to fetch credit" });
  }
});
router16.get("/payment-info", authenticateToken, async (req, res) => {
  try {
    const user = await get(
      "SELECT payment_method_type, payment_phone, payment_phone_vodafone, payment_phone_orange, payment_phone_we, payment_wallet_type, paypal_email, card_holder_name, card_number, instapay_handle FROM users WHERE id = ?",
      [req.user.id]
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      paymentMethodType: user.payment_method_type || "ewallet",
      paymentPhone: pickWalletPhone(user) || "",
      paymentPhoneVodafone: user.payment_phone_vodafone || "",
      paymentPhoneOrange: user.payment_phone_orange || "",
      paymentPhoneWe: user.payment_phone_we || "",
      walletType: user.payment_wallet_type || "vodafone",
      paypalEmail: user.paypal_email || "",
      cardHolderName: user.card_holder_name || "",
      instapayHandle: user.instapay_handle || ""
    });
  } catch {
    res.status(500).json({ message: "Failed to load payment info" });
  }
});
router16.post("/payment-info", authenticateToken, async (req, res) => {
  const {
    paymentMethodType,
    paymentPhone,
    paymentPhoneVodafone,
    paymentPhoneOrange,
    paymentPhoneWe,
    walletType,
    paypalEmail,
    cardHolderName,
    cardNumber,
    instapayHandle
  } = req.body;
  const methodType = paymentMethodType || "ewallet";
  try {
    const wallet = String(walletType || "vodafone");
    const vodafone = normalizePhone(paymentPhoneVodafone ?? (wallet === "vodafone" ? paymentPhone : ""));
    const orange = normalizePhone(paymentPhoneOrange ?? (wallet === "orange" ? paymentPhone : ""));
    const we = normalizePhone(paymentPhoneWe ?? (wallet === "we" ? paymentPhone : ""));
    if (methodType === "ewallet") {
      if (vodafone && !isWalletPhoneValid("vodafone", vodafone)) {
        return res.status(400).json({ message: "Vodafone number must be 11 digits and start with 010." });
      }
      if (orange && !isWalletPhoneValid("orange", orange)) {
        return res.status(400).json({ message: "Orange number must be 11 digits and start with 012." });
      }
      if (we && !isWalletPhoneValid("we", we)) {
        return res.status(400).json({ message: "WE number must be 11 digits and start with 011." });
      }
      const selectedPhone = wallet === "orange" ? orange : wallet === "we" ? we : vodafone;
      if (!selectedPhone) {
        return res.status(400).json({ message: "Please provide a phone number for the selected wallet type." });
      }
    }
    const effectivePhone = wallet === "orange" ? orange || null : wallet === "we" ? we || null : vodafone || null;
    await run(
      "UPDATE users SET payment_method_type = ?, payment_phone = ?, payment_phone_vodafone = ?, payment_phone_orange = ?, payment_phone_we = ?, payment_wallet_type = ?, paypal_email = ?, card_holder_name = ?, card_number = ?, instapay_handle = ? WHERE id = ?",
      [methodType, effectivePhone, vodafone || null, orange || null, we || null, wallet || null, paypalEmail || null, cardHolderName || null, cardNumber || null, instapayHandle || null, req.user.id]
    );
    res.json({ message: "Payment info updated" });
  } catch {
    res.status(500).json({ message: "Failed to update payment info" });
  }
});
router16.post("/withdraw", authenticateToken, async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ message: "Valid amount required" });
  try {
    const user = await get("SELECT credit, payment_phone, payment_phone_vodafone, payment_phone_orange, payment_phone_we, payment_wallet_type, payment_method_type, paypal_email, card_holder_name, card_number, instapay_handle FROM users WHERE id = ?", [req.user.id]);
    if (!user) return res.status(404).json({ message: "User not found" });
    if ((user.credit || 0) < amount) return res.status(400).json({ message: "Insufficient credit balance" });
    const methodType = user.payment_method_type || "ewallet";
    const selectedPhone = pickWalletPhone(user);
    if (methodType === "ewallet" && !selectedPhone) return res.status(400).json({ message: "Please set your e-wallet number first" });
    if (methodType === "paypal" && !user.paypal_email) return res.status(400).json({ message: "Please set your PayPal email first" });
    if (methodType === "credit_card" && !user.card_number) return res.status(400).json({ message: "Please set your credit card info first" });
    if (methodType === "instapay" && !user.instapay_handle) return res.status(400).json({ message: "Please set your InstaPay handle first" });
    await run(
      "INSERT INTO withdrawal_requests (coach_id, amount, payment_phone, wallet_type, payment_method_type, paypal_email, card_holder_name, card_number, instapay_handle) VALUES (?,?,?,?,?,?,?,?,?)",
      [req.user.id, amount, selectedPhone, user.payment_wallet_type, methodType, user.paypal_email, user.card_holder_name, user.card_number, user.instapay_handle]
    );
    await run("UPDATE users SET credit = credit - ? WHERE id = ?", [amount, req.user.id]);
    await run(
      "INSERT INTO credit_transactions (user_id, amount, type, description) VALUES (?,?,?,?)",
      [req.user.id, -amount, "withdrawal_request", `Withdrawal request for ${amount} EGP`]
    );
    res.json({ message: "Withdrawal request submitted. Admin will process it soon." });
  } catch (err) {
    console.error("Withdraw error:", err);
    res.status(500).json({ message: "Failed to submit withdrawal" });
  }
});
router16.get("/my-withdrawals", authenticateToken, async (req, res) => {
  try {
    const withdrawals = await query(
      "SELECT * FROM withdrawal_requests WHERE coach_id = ? ORDER BY created_at DESC",
      [req.user.id]
    );
    res.json({ withdrawals });
  } catch {
    res.status(500).json({ message: "Failed to fetch withdrawals" });
  }
});
router16.get("/withdrawals", authenticateToken, async (req, res) => {
  if (req.user?.role !== "admin") return res.status(403).json({ message: "Admin only" });
  try {
    const withdrawals = await query(
      `SELECT wr.*, u.name as coach_name, u.email as coach_email
       FROM withdrawal_requests wr
       LEFT JOIN users u ON wr.coach_id = u.id
       ORDER BY wr.created_at DESC`
    );
    res.json({ withdrawals });
  } catch {
    res.status(500).json({ message: "Failed to fetch withdrawals" });
  }
});
router16.patch("/withdrawals/:id/approve", authenticateToken, async (req, res) => {
  if (req.user?.role !== "admin") return res.status(403).json({ message: "Admin only" });
  try {
    const wr = await get("SELECT * FROM withdrawal_requests WHERE id = ?", [req.params.id]);
    if (!wr) return res.status(404).json({ message: "Request not found" });
    if (wr.status !== "pending") return res.status(400).json({ message: `Cannot approve \u2014 status is already '${wr.status}'` });
    const { note } = req.body;
    await run(
      "UPDATE withdrawal_requests SET status = ?, admin_note = ?, processed_at = NOW() WHERE id = ? AND status = ?",
      ["approved", note || "", req.params.id, "pending"]
    );
    await run(
      "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
      [
        wr.coach_id,
        "withdrawal",
        "Withdrawal Approved! \u2705",
        `Your withdrawal of ${wr.amount} EGP has been approved.${note ? " Note: " + note : ""}`,
        "/coach/profile"
      ]
    );
    sendPushToUser(wr.coach_id, "Withdrawal Approved! \u2705", `Your withdrawal of ${wr.amount} EGP has been approved.${note ? " Note: " + note : ""}`, void 0, "/coach/profile", "withdrawal_approved").catch(() => {
    });
    await run(
      "INSERT INTO credit_transactions (user_id, amount, type, description) VALUES (?,?,?,?)",
      [wr.coach_id, -wr.amount, "withdrawal_approved", `Withdrawal of ${wr.amount} EGP approved by admin`]
    );
    res.json({ message: "Withdrawal approved" });
  } catch {
    res.status(500).json({ message: "Failed to approve withdrawal" });
  }
});
router16.patch("/withdrawals/:id/reject", authenticateToken, async (req, res) => {
  if (req.user?.role !== "admin") return res.status(403).json({ message: "Admin only" });
  const { note } = req.body;
  try {
    const wr = await get("SELECT * FROM withdrawal_requests WHERE id = ?", [req.params.id]);
    if (!wr) return res.status(404).json({ message: "Request not found" });
    if (wr.status !== "pending") return res.status(400).json({ message: `Cannot reject \u2014 status is already '${wr.status}'` });
    await run(
      "UPDATE withdrawal_requests SET status = ?, admin_note = ?, processed_at = NOW() WHERE id = ? AND status = ?",
      ["rejected", note || "", req.params.id, "pending"]
    );
    await run("UPDATE users SET credit = credit + ? WHERE id = ?", [wr.amount, wr.coach_id]);
    await run(
      "INSERT INTO credit_transactions (user_id, amount, type, description) VALUES (?,?,?,?)",
      [wr.coach_id, wr.amount, "withdrawal_refund", `Withdrawal rejected: ${note || "No reason given"}`]
    );
    await run(
      "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
      [wr.coach_id, "withdrawal", "Withdrawal Declined", `Your withdrawal of ${wr.amount} EGP was declined. Credit has been refunded. ${note ? "Reason: " + note : ""}`, "/coach/profile"]
    );
    sendPushToUser(wr.coach_id, "Withdrawal Declined", `Your withdrawal of ${wr.amount} EGP was declined. Credit has been refunded. ${note ? "Reason: " + note : ""}`, void 0, "/coach/profile", "withdrawal_rejected").catch(() => {
    });
    res.json({ message: "Withdrawal rejected, credit refunded" });
  } catch {
    res.status(500).json({ message: "Failed to reject withdrawal" });
  }
});
var paymentRoutes_default = router16;

// server/routes/cmsRoutes.ts
init_auth();
init_database();
init_upload();
import { Router as Router14 } from "express";
var router17 = Router14();
var adminOnly2 = (req, res, next) => {
  if (req.user?.role !== "admin") return res.status(403).json({ message: "Admin access required" });
  next();
};
router17.get("/translations", async (_req, res) => {
  try {
    const rows = await query("SELECT text_key, text_ar FROM website_translations ORDER BY text_key");
    const translations = {};
    for (const r of rows) translations[r.text_key] = r.text_ar;
    res.json({ translations });
  } catch {
    res.json({ translations: {} });
  }
});
router17.get("/sections/:page", async (req, res) => {
  try {
    const { page } = req.params;
    const sections = await query(
      "SELECT * FROM website_sections WHERE page = ? AND is_visible = 1 ORDER BY sort_order ASC",
      [page]
    );
    const parsed = sections.map((s) => ({
      ...s,
      content: typeof s.content === "string" ? JSON.parse(s.content) : s.content
    }));
    res.json({ sections: parsed });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch sections" });
  }
});
router17.get("/admin/sections/:page", authenticateToken, adminOnly2, async (req, res) => {
  try {
    const { page } = req.params;
    const sections = await query(
      "SELECT * FROM website_sections WHERE page = ? ORDER BY sort_order ASC",
      [page]
    );
    const parsed = sections.map((s) => ({
      ...s,
      content: typeof s.content === "string" ? JSON.parse(s.content) : s.content
    }));
    res.json({ sections: parsed });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch sections" });
  }
});
router17.post("/admin/sections", authenticateToken, adminOnly2, async (req, res) => {
  const { page, type, label, content, sort_order } = req.body;
  if (!page || !type || !label) return res.status(400).json({ message: "page, type, label required" });
  try {
    const maxOrder = await get("SELECT MAX(sort_order) as max FROM website_sections WHERE page = ?", [page]);
    const order = sort_order ?? (maxOrder?.max || 0) + 1;
    const { insertId } = await run(
      "INSERT INTO website_sections (page, type, label, content, sort_order) VALUES (?,?,?,?,?)",
      [page, type, label, JSON.stringify(content || {}), order]
    );
    const section = await get("SELECT * FROM website_sections WHERE id = ?", [insertId]);
    res.json({ section: { ...section, content: JSON.parse(section.content) } });
  } catch (err) {
    res.status(500).json({ message: "Failed to create section" });
  }
});
router17.put("/admin/sections/:id", authenticateToken, adminOnly2, async (req, res) => {
  const { id } = req.params;
  const { label, content, is_visible, sort_order, type } = req.body;
  try {
    const fields = [];
    const values = [];
    if (label !== void 0) {
      fields.push("label = ?");
      values.push(label);
    }
    if (content !== void 0) {
      fields.push("content = ?");
      values.push(JSON.stringify(content));
    }
    if (is_visible !== void 0) {
      fields.push("is_visible = ?");
      values.push(is_visible ? 1 : 0);
    }
    if (sort_order !== void 0) {
      fields.push("sort_order = ?");
      values.push(sort_order);
    }
    if (type !== void 0) {
      fields.push("type = ?");
      values.push(type);
    }
    if (fields.length === 0) return res.status(400).json({ message: "No fields" });
    values.push(id);
    await run(`UPDATE website_sections SET ${fields.join(", ")}, updated_at = NOW() WHERE id = ?`, values);
    const updated = await get("SELECT * FROM website_sections WHERE id = ?", [id]);
    res.json({ section: { ...updated, content: typeof updated.content === "string" ? JSON.parse(updated.content) : updated.content } });
  } catch (err) {
    res.status(500).json({ message: "Failed to update section" });
  }
});
router17.post("/admin/sections/reorder", authenticateToken, adminOnly2, async (req, res) => {
  const { orders } = req.body;
  if (!Array.isArray(orders)) return res.status(400).json({ message: "orders array required" });
  try {
    for (const { id, sort_order } of orders) {
      await run("UPDATE website_sections SET sort_order = ? WHERE id = ?", [sort_order, id]);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to reorder" });
  }
});
router17.delete("/admin/sections/:id", authenticateToken, adminOnly2, async (req, res) => {
  try {
    await run("DELETE FROM website_sections WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete section" });
  }
});
router17.post("/admin/upload-image", authenticateToken, adminOnly2, upload.single("image"), optimizeImage(), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No image uploaded" });
  res.json({ url: await uploadToR2(req.file, "cms") });
});
var cmsRoutes_default = router17;

// server/routes/blogRoutes.ts
init_database();
init_auth();
init_upload();
import { Router as Router15 } from "express";

// server/controllers/blogController.ts
init_database();
init_upload();
var WRITER_ROLES = /* @__PURE__ */ new Set(["coach", "admin"]);
function toSlug(input) {
  return String(input || "").toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
}
async function uniqueSlug(base, ignoreId, language = "en") {
  const safeBase = base || `post-${Date.now()}`;
  let slug = safeBase;
  let i = 1;
  while (true) {
    const row = await get("SELECT id FROM blog_posts WHERE slug = ? AND language = ?", [slug, language]);
    if (!row || ignoreId && Number(row.id) === Number(ignoreId)) return slug;
    slug = `${safeBase}-${i++}`;
  }
}
function canWrite(role) {
  return WRITER_ROLES.has(role);
}
async function computeMediaPath(file) {
  if (!file?.buffer || file.buffer.length === 0) return null;
  return uploadToR2(file, "blogs");
}
var getPublicBlogs = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 30), 1), 100);
    const q = String(req.query.q || "").trim();
    const lang = String(req.query.lang || "en").trim();
    const where = ["bp.status = 'published'", "bp.language = ?"];
    const params = [lang];
    if (q) {
      where.push("(bp.title LIKE ? OR bp.excerpt LIKE ? OR bp.content LIKE ?)");
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    const posts = await query(
      `SELECT bp.id, bp.title, bp.slug, bp.excerpt, bp.content, bp.header_image_url, bp.video_url,
              bp.video_duration, bp.views, bp.language, bp.related_blog_id, bp.status, bp.author_id, bp.author_role, 
              bp.created_at, bp.updated_at, bp.published_at,
              u.name AS author_name, u.avatar AS author_avatar
       FROM blog_posts bp
       LEFT JOIN users u ON u.id = bp.author_id
       WHERE ${where.join(" AND ")}
       ORDER BY COALESCE(bp.published_at, bp.created_at) DESC
       LIMIT ${limit}`,
      params
    );
    res.json({ posts });
  } catch (err) {
    console.error("getPublicBlogs error:", err);
    res.status(500).json({ message: "Failed to fetch public blogs" });
  }
};
var getPublicBlogBySlug = async (req, res) => {
  try {
    const key = String(req.params.slug || "").trim();
    const lang = String(req.query.lang || "en").trim();
    if (!key) return res.status(400).json({ message: "Blog slug is required" });
    const byId = Number(key);
    const post = Number.isFinite(byId) && byId > 0 ? await get(
      `SELECT bp.*, u.name AS author_name, u.avatar AS author_avatar
         FROM blog_posts bp
         LEFT JOIN users u ON u.id = bp.author_id
         WHERE bp.id = ? AND bp.language = ? AND bp.status = 'published'`,
      [byId, lang]
    ) : await get(
      `SELECT bp.*, u.name AS author_name, u.avatar AS author_avatar
         FROM blog_posts bp
         LEFT JOIN users u ON u.id = bp.author_id
         WHERE bp.slug = ? AND bp.language = ? AND bp.status = 'published'`,
      [key, lang]
    );
    if (!post) return res.status(404).json({ message: "Blog post not found" });
    res.json({ post });
  } catch {
    res.status(500).json({ message: "Failed to fetch blog post" });
  }
};
var getBlogs = async (req, res) => {
  try {
    const role = req.user?.role || "user";
    const userId = Number(req.user?.id || 0);
    const mode = String(req.query.mode || "feed");
    const langRaw = String(req.query.lang || "en").trim().toLowerCase();
    const lang = langRaw === "ar" ? "ar" : "en";
    const q = String(req.query.q || "").trim();
    const limit = Math.min(Math.max(Number(req.query.limit || 60), 1), 150);
    const where = [];
    const params = [];
    where.push("bp.language = ?");
    params.push(lang);
    if (mode === "manage") {
      if (role === "admin") {
      } else if (role === "coach") {
        where.push("bp.author_id = ?");
        params.push(userId);
      } else {
        return res.status(403).json({ message: "Only coaches and admins can manage blog posts" });
      }
    } else {
      where.push("bp.status = 'published'");
    }
    if (q) {
      where.push("(bp.title LIKE ? OR bp.excerpt LIKE ? OR bp.content LIKE ?)");
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    const posts = await query(
      `SELECT bp.id, bp.title, bp.slug, bp.excerpt, bp.content, bp.header_image_url, bp.video_url,
              bp.video_duration, bp.views, bp.language, bp.related_blog_id, bp.status, bp.author_id, bp.author_role, 
              bp.created_at, bp.updated_at, bp.published_at,
              u.name AS author_name, u.avatar AS author_avatar
       FROM blog_posts bp
       LEFT JOIN users u ON u.id = bp.author_id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY COALESCE(bp.published_at, bp.created_at) DESC, bp.updated_at DESC
       LIMIT ${limit}`,
      params
    );
    res.json({ posts });
  } catch {
    res.status(500).json({ message: "Failed to fetch blog posts" });
  }
};
var createBlog = async (req, res) => {
  try {
    const role = req.user?.role || "user";
    const userId = Number(req.user?.id || 0);
    if (!canWrite(role)) {
      return res.status(403).json({ message: "Only coaches and admins can create blog posts" });
    }
    const files = req.files;
    console.log("\u{1F4C1} Blog create - files received:", {
      headerImage: files?.headerImage?.[0]?.originalname,
      video: files?.video?.[0]?.originalname
    });
    const headerImage = await computeMediaPath(files?.headerImage?.[0]);
    const video = await computeMediaPath(files?.video?.[0]);
    const title = String(req.body.title || "").trim();
    const excerpt = String(req.body.excerpt || "").trim();
    const content = String(req.body.content || "").trim();
    const videoDuration = parseInt(req.body.videoDuration || "0") || null;
    const language = String(req.body.language || "en").trim().toLowerCase();
    const relatedBlogId = req.body.relatedBlogId ? Number(req.body.relatedBlogId) : null;
    let status;
    if (role === "admin") {
      status = req.body.status === "draft" ? "draft" : "published";
    } else {
      status = req.body.status === "draft" ? "draft" : "pending_review";
    }
    if (!title) return res.status(400).json({ message: "Title is required" });
    if (!content) return res.status(400).json({ message: "Content is required" });
    if (!["en", "ar"].includes(language)) {
      return res.status(400).json({ message: 'Language must be "en" or "ar"' });
    }
    if (relatedBlogId) {
      const relatedPost = await get("SELECT id, language FROM blog_posts WHERE id = ?", [relatedBlogId]);
      if (!relatedPost) {
        return res.status(400).json({ message: "Related blog post not found" });
      }
      if (relatedPost.language === language) {
        return res.status(400).json({ message: "Related blog must be in a different language" });
      }
    }
    const slugBase = toSlug(title);
    const slug = await uniqueSlug(slugBase, void 0, language);
    const publishedAt = status === "published" ? /* @__PURE__ */ new Date() : null;
    const { insertId } = await run(
      `INSERT INTO blog_posts
        (title, slug, excerpt, content, header_image_url, video_url, video_duration, language, related_blog_id, status, author_id, author_role, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, slug, excerpt, content, headerImage, video, videoDuration, language, relatedBlogId, status, userId, role, publishedAt]
    );
    const post = await get(
      `SELECT bp.*, u.name AS author_name, u.avatar AS author_avatar
       FROM blog_posts bp
       LEFT JOIN users u ON u.id = bp.author_id
       WHERE bp.id = ?`,
      [insertId]
    );
    res.status(201).json({ post });
  } catch (err) {
    console.error("createBlog error:", err);
    console.error("Request body:", JSON.stringify(req.body, null, 2));
    const errorMessage = err instanceof Error ? err.message : "Failed to create blog post";
    const errorStack = err instanceof Error ? err.stack : "";
    console.error("Error stack:", errorStack);
    res.status(500).json({ message: "Failed to create blog post", error: errorMessage });
  }
};
var updateBlog = async (req, res) => {
  try {
    const role = req.user?.role || "user";
    const userId = Number(req.user?.id || 0);
    const postId = Number(req.params.id || 0);
    if (!postId) return res.status(400).json({ message: "Invalid blog post id" });
    if (!canWrite(role)) {
      return res.status(403).json({ message: "Only coaches and admins can update blog posts" });
    }
    const existing = await get("SELECT * FROM blog_posts WHERE id = ?", [postId]);
    if (!existing) return res.status(404).json({ message: "Blog post not found" });
    if (role !== "admin" && Number(existing.author_id) !== userId) {
      return res.status(403).json({ message: "You can only edit your own blog posts" });
    }
    const files = req.files;
    const headerImage = await computeMediaPath(files?.headerImage?.[0]);
    const video = await computeMediaPath(files?.video?.[0]);
    const title = String(req.body.title ?? existing.title).trim();
    const excerpt = String(req.body.excerpt ?? existing.excerpt ?? "").trim();
    const content = String(req.body.content ?? existing.content ?? "").trim();
    const videoDuration = parseInt(req.body.videoDuration ?? existing.video_duration ?? "0") || null;
    const language = existing.language || "en";
    const relatedBlogId = req.body.relatedBlogId ? Number(req.body.relatedBlogId) : existing.related_blog_id;
    let status;
    if (role === "admin") {
      status = req.body.status === "draft" ? "draft" : "published";
    } else {
      status = req.body.status === "draft" ? "draft" : "pending_review";
    }
    if (!title) return res.status(400).json({ message: "Title is required" });
    if (!content) return res.status(400).json({ message: "Content is required" });
    const slugBase = toSlug(title);
    const slug = title === existing.title ? existing.slug : await uniqueSlug(slugBase, postId, language);
    const nextHeaderImage = req.body.removeHeaderImage === "1" ? null : headerImage ?? existing.header_image_url ?? null;
    const nextVideo = req.body.removeVideo === "1" ? null : video ?? existing.video_url ?? null;
    const publishedAt = status === "published" ? existing.published_at || /* @__PURE__ */ new Date() : null;
    await run(
      `UPDATE blog_posts
       SET title = ?, slug = ?, excerpt = ?, content = ?, header_image_url = ?, video_url = ?, video_duration = ?,
           related_blog_id = ?, status = ?, published_at = ?, updated_at = NOW()
       WHERE id = ?`,
      [title, slug, excerpt, content, nextHeaderImage, nextVideo, videoDuration, relatedBlogId, status, publishedAt, postId]
    );
    const post = await get(
      `SELECT bp.*, u.name AS author_name, u.avatar AS author_avatar
       FROM blog_posts bp
       LEFT JOIN users u ON u.id = bp.author_id
       WHERE bp.id = ?`,
      [postId]
    );
    res.json({ post });
  } catch (err) {
    console.error("updateBlog error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to update blog post";
    res.status(500).json({ message: "Failed to update blog post", error: errorMessage });
  }
};
var deleteBlog = async (req, res) => {
  try {
    const role = req.user?.role || "user";
    const userId = Number(req.user?.id || 0);
    const postId = Number(req.params.id || 0);
    if (!postId) return res.status(400).json({ message: "Invalid blog post id" });
    const existing = await get("SELECT id, author_id FROM blog_posts WHERE id = ?", [postId]);
    if (!existing) return res.status(404).json({ message: "Blog post not found" });
    if (role !== "admin" && Number(existing.author_id) !== userId) {
      return res.status(403).json({ message: "You can only delete your own blog posts" });
    }
    await run("DELETE FROM blog_posts WHERE id = ?", [postId]);
    res.json({ message: "Blog post deleted" });
  } catch {
    res.status(500).json({ message: "Failed to delete blog post" });
  }
};

// server/routes/blogRoutes.ts
var router18 = Router15();
router18.get("/public", getPublicBlogs);
router18.get("/public/:slug", getPublicBlogBySlug);
router18.get("/", authenticateToken, getBlogs);
router18.post(
  "/",
  authenticateToken,
  uploadVideo.fields([
    { name: "headerImage", maxCount: 1 },
    { name: "video", maxCount: 1 }
  ]),
  validateVideoSize,
  optimizeImage(),
  createBlog
);
router18.put(
  "/:id",
  authenticateToken,
  uploadVideo.fields([
    { name: "headerImage", maxCount: 1 },
    { name: "video", maxCount: 1 }
  ]),
  validateVideoSize,
  optimizeImage(),
  updateBlog
);
router18.delete("/:id", authenticateToken, deleteBlog);
router18.post("/:id/view", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || id < 1) return res.status(400).json({ message: "Invalid post id" });
    await run("UPDATE blog_posts SET views = views + 1 WHERE id = ?", [id]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Failed to record view" });
  }
});
router18.put("/:id/review", authenticateToken, async (req, res) => {
  try {
    if (req.user?.role !== "admin") return res.status(403).json({ message: "Admin only" });
    const postId = Number(req.params.id);
    const action = req.body.action;
    if (!["approve", "reject"].includes(action)) return res.status(400).json({ message: "action must be approve or reject" });
    const post = await get("SELECT * FROM blog_posts WHERE id = ?", [postId]);
    if (!post) return res.status(404).json({ message: "Blog post not found" });
    if (action === "approve") {
      await run("UPDATE blog_posts SET status = ?, published_at = COALESCE(published_at, NOW()), updated_at = NOW() WHERE id = ?", ["published", postId]);
    } else {
      await run("UPDATE blog_posts SET status = ?, updated_at = NOW() WHERE id = ?", ["draft", postId]);
    }
    const updated = await get(
      `SELECT bp.*, u.name AS author_name, u.avatar AS author_avatar FROM blog_posts bp LEFT JOIN users u ON u.id = bp.author_id WHERE bp.id = ?`,
      [postId]
    );
    res.json({ post: updated, message: action === "approve" ? "Blog approved and published" : "Blog rejected and moved to draft" });
  } catch {
    res.status(500).json({ message: "Failed to review blog" });
  }
});
var blogRoutes_default = router18;

// server/routes/emailRoutes.ts
init_auth();
init_database();
import { Router as Router16 } from "express";
var router19 = Router16();
var adminOnly3 = (req, res, next) => {
  if (req.user?.role !== "admin") return res.status(403).json({ message: "Admin access required" });
  next();
};
router19.get("/domain", authenticateToken, adminOnly3, (_req, res) => {
  res.json({ domain: getMailDomain() });
});
router19.get("/settings", authenticateToken, adminOnly3, async (_req, res) => {
  try {
    const settings = await getSmtpSettings();
    if (!settings) return res.json({ settings: { smtp_host: "", smtp_port: 587, smtp_user: "", smtp_pass: "", smtp_secure: "starttls", from_name: "", from_email: "", enabled: 0 } });
    const masked = { ...settings, smtp_pass: settings.smtp_pass ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "" };
    res.json({ settings: masked });
  } catch (err) {
    console.error("Get settings error:", err);
    res.status(500).json({ message: "Failed to load settings" });
  }
});
router19.put("/settings", authenticateToken, adminOnly3, async (req, res) => {
  try {
    const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, from_name, from_email, enabled } = req.body;
    const update = {};
    if (smtp_host !== void 0) update.smtp_host = String(smtp_host).trim();
    if (smtp_port !== void 0) update.smtp_port = Number(smtp_port) || 587;
    if (smtp_user !== void 0) update.smtp_user = String(smtp_user).trim();
    if (smtp_pass !== void 0 && smtp_pass !== "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022") update.smtp_pass = String(smtp_pass);
    if (smtp_secure !== void 0 && ["none", "tls", "starttls"].includes(smtp_secure)) update.smtp_secure = smtp_secure;
    if (from_name !== void 0) update.from_name = String(from_name).trim();
    if (from_email !== void 0) update.from_email = String(from_email).trim();
    if (enabled !== void 0) update.enabled = enabled ? 1 : 0;
    await saveSmtpSettings(update);
    res.json({ message: "Settings saved" });
  } catch (err) {
    console.error("Save settings error:", err);
    res.status(500).json({ message: "Failed to save settings" });
  }
});
router19.post("/settings/test", authenticateToken, adminOnly3, async (_req, res) => {
  try {
    const result = await testSmtpConnection();
    res.json(result);
  } catch (err) {
    res.json({ ok: false, message: err.message || "Test failed" });
  }
});
router19.post("/settings/test-send", authenticateToken, adminOnly3, async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ ok: false, message: "Recipient email is required" });
    const settings = await getSmtpSettings();
    if (!settings || !settings.smtp_host) {
      return res.json({ ok: false, message: "SMTP not configured" });
    }
    const nodemailer2 = await import("nodemailer");
    const secure = settings.smtp_secure === "tls";
    const transporter = nodemailer2.createTransport({
      host: settings.smtp_host,
      port: settings.smtp_port,
      secure,
      auth: settings.smtp_user ? { user: settings.smtp_user, pass: settings.smtp_pass } : void 0,
      tls: { rejectUnauthorized: false }
    });
    await transporter.sendMail({
      from: settings.from_email ? `${settings.from_name || "FitWay Hub"} <${settings.from_email}>` : settings.smtp_user,
      to: String(to).trim(),
      subject: "FitWay Hub - Test Email",
      text: "This is a test email from FitWay Hub Email Server. If you received this, your SMTP settings are working correctly!",
      html: '<div style="font-family:sans-serif;padding:20px"><h2>FitWay Hub - Test Email</h2><p>If you received this, your SMTP settings are working correctly!</p></div>'
    });
    res.json({ ok: true, message: `Test email sent to ${to}` });
  } catch (err) {
    res.json({ ok: false, message: `Send failed: ${err.message}` });
  }
});
router19.get("/accounts", authenticateToken, adminOnly3, async (_req, res) => {
  try {
    const accounts = await query("SELECT id, email, display_name, created_at FROM email_accounts ORDER BY created_at DESC");
    res.json({ accounts });
  } catch (err) {
    console.error("List accounts error:", err);
    res.status(500).json({ message: "Failed to list email accounts" });
  }
});
router19.post("/accounts", authenticateToken, adminOnly3, async (req, res) => {
  try {
    const domain = getMailDomain();
    const localPart = String(req.body.local_part || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
    const displayName = String(req.body.display_name || "").trim();
    if (!localPart) return res.status(400).json({ message: "Local part (before @) is required" });
    if (localPart.length > 64) return res.status(400).json({ message: "Local part too long (max 64 chars)" });
    const email = `${localPart}@${domain}`;
    const existing = await get("SELECT id FROM email_accounts WHERE email = ?", [email]);
    if (existing) return res.status(409).json({ message: `Email ${email} already exists` });
    const { insertId } = await run(
      "INSERT INTO email_accounts (email, display_name) VALUES (?, ?)",
      [email, displayName || localPart]
    );
    res.status(201).json({ id: insertId, email, display_name: displayName || localPart });
  } catch (err) {
    console.error("Create account error:", err);
    res.status(500).json({ message: "Failed to create email account" });
  }
});
router19.delete("/accounts/:id", authenticateToken, adminOnly3, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await run("DELETE FROM email_accounts WHERE id = ?", [id]);
    res.json({ message: "Account deleted" });
  } catch (err) {
    console.error("Delete account error:", err);
    res.status(500).json({ message: "Failed to delete account" });
  }
});
router19.get("/accounts/:id/emails", authenticateToken, adminOnly3, async (req, res) => {
  try {
    const accountId = Number(req.params.id);
    const direction = req.query.direction === "outbound" ? "outbound" : "inbound";
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
    const emails = await query(
      `SELECT id, sender, recipient, subject, text_body, html_body, direction, is_read, message_id, created_at
       FROM emails
       WHERE account_id = ? AND direction = ?
       ORDER BY created_at DESC
       LIMIT ${limit}`,
      [accountId, direction]
    );
    res.json({ emails });
  } catch (err) {
    console.error("List emails error:", err);
    res.status(500).json({ message: "Failed to list emails" });
  }
});
router19.get("/emails/:id", authenticateToken, adminOnly3, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const email = await get(
      `SELECT e.*, ea.email AS account_email, ea.display_name AS account_name
       FROM emails e
       JOIN email_accounts ea ON ea.id = e.account_id
       WHERE e.id = ?`,
      [id]
    );
    if (!email) return res.status(404).json({ message: "Email not found" });
    if (!email.is_read) {
      await run("UPDATE emails SET is_read = 1 WHERE id = ?", [id]);
      email.is_read = 1;
    }
    res.json({ email });
  } catch (err) {
    console.error("Get email error:", err);
    res.status(500).json({ message: "Failed to get email" });
  }
});
router19.post("/send", authenticateToken, adminOnly3, async (req, res) => {
  try {
    const { account_id, to, subject, text, html } = req.body;
    if (!account_id || !to || !subject) {
      return res.status(400).json({ message: "account_id, to, and subject are required" });
    }
    const toAddress = String(to).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toAddress)) {
      return res.status(400).json({ message: "Invalid recipient email address" });
    }
    await sendMail({
      fromAccountId: Number(account_id),
      to: toAddress,
      subject: String(subject),
      text: text ? String(text) : void 0,
      html: html ? String(html) : void 0
    });
    res.json({ message: "Email sent" });
  } catch (err) {
    console.error("Send email error:", err);
    res.status(500).json({ message: err.message || "Failed to send email" });
  }
});
router19.delete("/emails/:id", authenticateToken, adminOnly3, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await run("DELETE FROM emails WHERE id = ?", [id]);
    res.json({ message: "Email deleted" });
  } catch (err) {
    console.error("Delete email error:", err);
    res.status(500).json({ message: "Failed to delete email" });
  }
});
var emailRoutes_default = router19;

// server/routes/notificationRoutes.ts
init_auth();
init_database();
import { Router as Router17 } from "express";
var adminOnly4 = (req, res, next) => {
  if (req.user?.role !== "admin") return res.status(403).json({ message: "Admin access required" });
  next();
};
var router20 = Router17();
router20.post("/push-token", authenticateToken, async (req, res) => {
  try {
    const { token, platform } = req.body;
    if (!token) return res.status(400).json({ message: "Push token is required" });
    await registerPushToken(req.user.id, token, platform || "android");
    res.json({ message: "Push token registered" });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to register token" });
  }
});
router20.delete("/push-token", authenticateToken, async (req, res) => {
  try {
    const { platform } = req.body;
    await removePushToken(req.user.id, platform || "android");
    res.json({ message: "Push token removed" });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to remove token" });
  }
});
router20.get("/list", authenticateToken, async (req, res) => {
  try {
    const rows = await query(
      "SELECT id, type, title, body, link, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
      [req.user.id]
    );
    res.json({ notifications: rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router20.put("/read/:id", authenticateToken, async (req, res) => {
  try {
    await run("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    res.json({ message: "Marked as read" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router20.put("/read-all", authenticateToken, async (req, res) => {
  try {
    await run("UPDATE notifications SET is_read = 1 WHERE user_id = ?", [req.user.id]);
    res.json({ message: "All marked as read" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router20.get("/templates", authenticateToken, adminOnly4, async (_req, res) => {
  try {
    const rows = await query("SELECT * FROM push_templates ORDER BY category, slug");
    res.json({ templates: rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router20.put("/templates/:id", authenticateToken, adminOnly4, async (req, res) => {
  try {
    const { title, body, enabled, trigger_type } = req.body;
    const fields = [];
    const values = [];
    if (title !== void 0) {
      fields.push("title = ?");
      values.push(title);
    }
    if (body !== void 0) {
      fields.push("body = ?");
      values.push(body);
    }
    if (enabled !== void 0) {
      fields.push("enabled = ?");
      values.push(enabled ? 1 : 0);
    }
    if (trigger_type !== void 0) {
      fields.push("trigger_type = ?");
      values.push(trigger_type);
    }
    if (!fields.length) return res.status(400).json({ message: "No fields to update" });
    values.push(req.params.id);
    await run(`UPDATE push_templates SET ${fields.join(", ")} WHERE id = ?`, values);
    res.json({ message: "Template updated" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router20.post("/templates", authenticateToken, adminOnly4, async (req, res) => {
  try {
    const { slug, title, body, category, trigger_type } = req.body;
    if (!slug || !title || !body) return res.status(400).json({ message: "slug, title, and body are required" });
    await run(
      "INSERT INTO push_templates (slug, title, body, category, trigger_type) VALUES (?,?,?,?,?)",
      [slug, title, body, category || "engagement", trigger_type || "manual"]
    );
    res.status(201).json({ message: "Template created" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router20.delete("/templates/:id", authenticateToken, adminOnly4, async (req, res) => {
  try {
    await run("DELETE FROM push_templates WHERE id = ?", [req.params.id]);
    res.json({ message: "Template deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router20.get("/welcome-messages", authenticateToken, adminOnly4, async (_req, res) => {
  try {
    const rows = await query("SELECT * FROM welcome_messages ORDER BY target, channel");
    res.json({ messages: rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router20.put("/welcome-messages/:id", authenticateToken, adminOnly4, async (req, res) => {
  try {
    const { subject, title, body, html_body, enabled } = req.body;
    const fields = [];
    const values = [];
    if (subject !== void 0) {
      fields.push("subject = ?");
      values.push(subject);
    }
    if (title !== void 0) {
      fields.push("title = ?");
      values.push(title);
    }
    if (body !== void 0) {
      fields.push("body = ?");
      values.push(body);
    }
    if (html_body !== void 0) {
      fields.push("html_body = ?");
      values.push(html_body);
    }
    if (enabled !== void 0) {
      fields.push("enabled = ?");
      values.push(enabled ? 1 : 0);
    }
    if (!fields.length) return res.status(400).json({ message: "No fields to update" });
    values.push(req.params.id);
    await run(`UPDATE welcome_messages SET ${fields.join(", ")} WHERE id = ?`, values);
    res.json({ message: "Welcome message updated" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router20.post("/send", authenticateToken, adminOnly4, async (req, res) => {
  try {
    const { userId, title, body, segment, templateSlug, vars } = req.body;
    if (templateSlug && userId) {
      const ok = await sendPushFromTemplate(userId, templateSlug, vars || {});
      return res.json({ message: ok ? "Sent" : "No token or template not found", sent: ok ? 1 : 0 });
    }
    if (userId && title && body) {
      const ok = await sendPushToUser(userId, title, body);
      return res.json({ message: ok ? "Sent" : "No push token for user", sent: ok ? 1 : 0 });
    }
    if (title && body) {
      const result = await sendPushToSegment(title, body, segment || "all");
      return res.json({ message: `Sent ${result.sent}/${result.total}`, ...result });
    }
    return res.status(400).json({ message: "Provide title + body (and optionally userId or segment)" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router20.get("/log", authenticateToken, adminOnly4, async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit)) || 50, 500);
    const rows = await query(
      `SELECT pl.*, u.name as user_name, u.email as user_email, pt.slug as template_slug
       FROM push_log pl
       LEFT JOIN users u ON u.id = pl.user_id
       LEFT JOIN push_templates pt ON pt.id = pl.template_id
       ORDER BY pl.created_at DESC LIMIT ?`,
      [limit]
    );
    res.json({ log: rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router20.get("/fcm-status", authenticateToken, adminOnly4, async (_req, res) => {
  const hasServiceAccountJson = !!process.env.FCM_SERVICE_ACCOUNT_JSON;
  const hasServiceAccountPath = !!process.env.FCM_SERVICE_ACCOUNT_PATH;
  const hasProjectId = !!process.env.FCM_PROJECT_ID;
  const configured = (hasServiceAccountJson || hasServiceAccountPath) && hasProjectId;
  const tokenCount = await get("SELECT COUNT(*) as cnt FROM push_tokens");
  res.json({
    configured,
    method: configured ? "http_v1" : "none",
    registeredDevices: tokenCount?.cnt || 0,
    hint: configured ? null : "Set FCM_SERVICE_ACCOUNT_JSON and FCM_PROJECT_ID in your .env"
  });
});
router20.post("/test", authenticateToken, adminOnly4, async (req, res) => {
  try {
    const adminId = req.user.id;
    const title = req.body?.title || "\u{1F514} FitWay Hub Test";
    const body = req.body?.body || "Push notifications are working correctly!";
    const hasSa = !!(process.env.FCM_SERVICE_ACCOUNT_JSON || process.env.FCM_SERVICE_ACCOUNT_PATH);
    if (!hasSa) {
      return res.status(503).json({
        sent: false,
        message: "FCM not configured \u2014 set FCM_SERVICE_ACCOUNT_JSON in your .env",
        debug: { hasSa: false }
      });
    }
    const tokens = await query(
      "SELECT token, platform FROM push_tokens WHERE user_id = ? ORDER BY updated_at DESC",
      [adminId]
    );
    if (!tokens.length) {
      return res.status(400).json({
        sent: false,
        message: "No device registered yet. Open the app on your phone and log in \u2014 it will register automatically.",
        debug: { tokens: 0 }
      });
    }
    const results = [];
    for (const t of tokens) {
      const ok = await sendPushToUser(adminId, title, body);
      results.push({ platform: t.platform, token: t.token.slice(0, 20) + "...", ok });
    }
    const anyOk = results.some((r) => r.ok);
    res.json({
      sent: anyOk,
      message: anyOk ? `\u2705 Test push sent to ${results.filter((r) => r.ok).map((r) => r.platform).join(", ")}!` : `\u274C FCM rejected the push. Token may be expired or invalid. Try logging out and back in on your device.`,
      devices: results
    });
  } catch (err) {
    console.error("Test push error:", err);
    res.status(500).json({ sent: false, message: err.message });
  }
});
var notificationRoutes_default = router20;

// server/routes/adsRoutes.ts
init_auth();
init_database();
init_upload();
import { Router as Router18 } from "express";
var router21 = Router18();
var adminOnly5 = (req, res, next) => {
  if (req.user?.role !== "admin") return res.status(403).json({ message: "Admin access required" });
  next();
};
var coachOrAdmin3 = (req, res, next) => {
  if (!["coach", "admin"].includes(req.user?.role)) return res.status(403).json({ message: "Coach or admin access required" });
  next();
};
async function getAdSetOwnerCoachId(adSetId) {
  const row = await get(
    `SELECT c.coach_id
       FROM ad_sets s
       JOIN ad_campaigns c ON c.id = s.campaign_id
      WHERE s.id = ?`,
    [adSetId]
  );
  return row?.coach_id ?? null;
}
async function getAdOwnerCoachId(adId) {
  const row = await get(
    `SELECT c.coach_id
       FROM ads a
       JOIN ad_sets s     ON s.id = a.ad_set_id
       JOIN ad_campaigns c ON c.id = s.campaign_id
      WHERE a.id = ?`,
    [adId]
  );
  return row?.coach_id ?? null;
}
async function audit(req, action, entityType, entityId, oldState, newState) {
  try {
    await run(
      `INSERT INTO ad_audit_logs (actor_id, actor_role, action, entity_type, entity_id, old_state, new_state, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        req.user.role,
        action,
        entityType,
        entityId,
        oldState ? JSON.stringify(oldState) : null,
        newState ? JSON.stringify(newState) : null,
        req.ip
      ]
    );
  } catch {
  }
}
async function adsEnabled() {
  try {
    const s = await get(`SELECT setting_value FROM admin_ad_settings WHERE setting_key = 'ads_system_enabled'`);
    return s?.setting_value === "true";
  } catch {
    return true;
  }
}
async function getSetting2(key) {
  try {
    const s = await get(`SELECT setting_value FROM admin_ad_settings WHERE setting_key = ?`, [key]);
    return s?.setting_value ?? null;
  } catch {
    return null;
  }
}
router21.get("/campaigns", authenticateToken, coachOrAdmin3, async (req, res) => {
  try {
    const isAdmin = req.user.role === "admin";
    const coachFilter = isAdmin ? "" : "WHERE c.coach_id = ?";
    const params = isAdmin ? [] : [req.user.id];
    const campaigns = await query(
      `SELECT c.*,
         u.name AS coach_name, u.email AS coach_email,
         COUNT(DISTINCT ads.id) AS ad_sets_count,
         COALESCE(SUM(ads.daily_budget), 0) AS total_ad_set_budget
       FROM ad_campaigns c
       LEFT JOIN users u ON u.id = c.coach_id
       LEFT JOIN ad_sets ads ON ads.campaign_id = c.id
       ${coachFilter}
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      params
    );
    res.json({ campaigns });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router21.post("/campaigns", authenticateToken, coachOrAdmin3, async (req, res) => {
  try {
    if (!await adsEnabled()) return res.status(403).json({ message: "Ads system is currently disabled" });
    const { name, objective, daily_budget, lifetime_budget, budget_type, schedule_start, schedule_end } = req.body;
    if (!name) return res.status(400).json({ message: "Campaign name is required" });
    const bType = budget_type || "daily";
    const campaignBudget = bType === "daily" ? parseFloat(daily_budget || "0") : parseFloat(lifetime_budget || "0");
    if (campaignBudget <= 0) return res.status(400).json({ message: "Budget must be greater than 0" });
    const defaultStatus = await getSetting2("default_campaign_status") ?? "draft";
    const requireApproval = await getSetting2("require_admin_approval") === "true";
    const allowedOnCreate = /* @__PURE__ */ new Set(["draft", "pending_review"]);
    let status = requireApproval ? "pending_review" : defaultStatus;
    if (!allowedOnCreate.has(status) && req.user.role !== "admin") status = "pending_review";
    const result = await run(
      `INSERT INTO ad_campaigns (coach_id, name, objective, daily_budget, lifetime_budget, budget_type, schedule_start, schedule_end, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        name,
        objective || "coaching",
        daily_budget || 0,
        lifetime_budget || 0,
        budget_type || "daily",
        schedule_start || null,
        schedule_end || null,
        status
      ]
    );
    const campaign = await get("SELECT * FROM ad_campaigns WHERE id = ?", [result.insertId]);
    if (status === "pending_review") {
      await run(
        `INSERT INTO ad_moderation_reviews (campaign_id, status) VALUES (?, 'pending')`,
        [result.insertId]
      );
    }
    await audit(req, "campaign.create", "campaign", result.insertId, null, campaign);
    res.status(201).json({ campaign });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router21.get("/campaigns/:id", authenticateToken, coachOrAdmin3, async (req, res) => {
  try {
    const campaign = await get("SELECT * FROM ad_campaigns WHERE id = ?", [req.params.id]);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    if (req.user.role !== "admin" && campaign.coach_id !== req.user.id)
      return res.status(403).json({ message: "Not your campaign" });
    const adSets = await query("SELECT * FROM ad_sets WHERE campaign_id = ? ORDER BY id", [campaign.id]);
    const adSetIds = adSets.map((s) => s.id);
    const ads = adSetIds.length ? await query(`SELECT a.*, ac.media_url, ac.format, ac.thumbnail_url FROM ads a LEFT JOIN ad_creatives ac ON ac.id = a.creative_id WHERE a.ad_set_id IN (${adSetIds.map(() => "?").join(",")})`, adSetIds) : [];
    res.json({ campaign, adSets, ads });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router21.patch("/campaigns/:id", authenticateToken, coachOrAdmin3, async (req, res) => {
  try {
    const campaign = await get("SELECT * FROM ad_campaigns WHERE id = ?", [req.params.id]);
    if (!campaign) return res.status(404).json({ message: "Not found" });
    if (req.user.role !== "admin" && campaign.coach_id !== req.user.id)
      return res.status(403).json({ message: "Not your campaign" });
    const { name, objective, daily_budget, lifetime_budget, budget_type, schedule_start, schedule_end } = req.body;
    await run(
      `UPDATE ad_campaigns SET name=COALESCE(?,name), objective=COALESCE(?,objective),
         daily_budget=COALESCE(?,daily_budget), lifetime_budget=COALESCE(?,lifetime_budget),
         budget_type=COALESCE(?,budget_type), schedule_start=COALESCE(?,schedule_start),
         schedule_end=COALESCE(?,schedule_end), updated_at=NOW()
       WHERE id=?`,
      [name, objective, daily_budget, lifetime_budget, budget_type, schedule_start, schedule_end, req.params.id]
    );
    const updated = await get("SELECT * FROM ad_campaigns WHERE id = ?", [req.params.id]);
    await audit(req, "campaign.update", "campaign", campaign.id, campaign, updated);
    res.json({ campaign: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router21.delete("/campaigns/:id", authenticateToken, coachOrAdmin3, async (req, res) => {
  try {
    const campaign = await get("SELECT * FROM ad_campaigns WHERE id = ?", [req.params.id]);
    if (!campaign) return res.status(404).json({ message: "Not found" });
    if (req.user.role !== "admin" && campaign.coach_id !== req.user.id)
      return res.status(403).json({ message: "Not your campaign" });
    await run("DELETE FROM ad_campaigns WHERE id = ?", [req.params.id]);
    await audit(req, "campaign.delete", "campaign", campaign.id, campaign, null);
    res.json({ message: "Campaign deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router21.patch("/campaigns/:id/status", authenticateToken, adminOnly5, async (req, res) => {
  try {
    const { status, admin_note } = req.body;
    const campaign = await get("SELECT * FROM ad_campaigns WHERE id = ?", [req.params.id]);
    if (!campaign) return res.status(404).json({ message: "Not found" });
    await run(
      `UPDATE ad_campaigns SET status=?, admin_note=?, reviewed_by=?, reviewed_at=NOW(), updated_at=NOW() WHERE id=?`,
      [status, admin_note || null, req.user.id, req.params.id]
    );
    await run(
      `UPDATE ad_moderation_reviews SET status=?, reviewer_id=?, notes=?, resolved_at=NOW() WHERE campaign_id=? AND status='pending'`,
      [status === "active" ? "approved" : status === "rejected" ? "rejected" : "flagged", req.user.id, admin_note || null, req.params.id]
    );
    if (status === "rejected" && campaign.coach_id) {
      const reason = admin_note ? `: ${admin_note}` : "";
      await run(
        "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
        [campaign.coach_id, "ad_rejected", "\u274C Campaign Rejected", `Your campaign "${campaign.name || "Untitled"}" has been rejected${reason}`, "/coach/ads/my-ads"]
      );
      sendPushFromTemplate(campaign.coach_id, "ad_rejected", { campaign_name: campaign.name || "Untitled" }, "/coach/ads/my-ads").catch(() => {
      });
    }
    if (status === "active" && campaign.coach_id) {
      sendPushFromTemplate(campaign.coach_id, "ad_approved", { campaign_name: campaign.name || "Untitled" }, "/coach/ads/my-ads").catch(() => {
      });
    }
    const updated = await get("SELECT * FROM ad_campaigns WHERE id = ?", [req.params.id]);
    await audit(req, `campaign.status.${status}`, "campaign", campaign.id, { status: campaign.status }, { status });
    res.json({ campaign: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router21.get("/campaigns/:campaignId/ad-sets", authenticateToken, coachOrAdmin3, async (req, res) => {
  try {
    const sets = await query("SELECT * FROM ad_sets WHERE campaign_id = ? ORDER BY id", [req.params.campaignId]);
    res.json({ adSets: sets });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router21.post("/campaigns/:campaignId/ad-sets", authenticateToken, coachOrAdmin3, async (req, res) => {
  try {
    const campaign = await get("SELECT * FROM ad_campaigns WHERE id = ?", [req.params.campaignId]);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    if (req.user.role !== "admin" && campaign.coach_id !== req.user.id)
      return res.status(403).json({ message: "Not your campaign" });
    const {
      name,
      placement,
      target_gender,
      target_age_min,
      target_age_max,
      target_location,
      target_lat,
      target_lng,
      target_radius_km,
      target_interests,
      target_activity_levels,
      target_languages,
      exclude_existing_clients,
      exclude_opted_out,
      daily_budget
    } = req.body;
    const result = await run(
      `INSERT INTO ad_sets
         (campaign_id, name, placement, target_gender, target_age_min, target_age_max,
          target_location, target_lat, target_lng, target_radius_km,
          target_interests, target_activity_levels, target_languages,
          exclude_existing_clients, exclude_opted_out, daily_budget)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.params.campaignId,
        name || "Ad Set 1",
        placement || "feed",
        target_gender || "all",
        target_age_min || 18,
        target_age_max || 65,
        target_location || null,
        target_lat || null,
        target_lng || null,
        target_radius_km || 50,
        target_interests ? JSON.stringify(target_interests) : null,
        target_activity_levels ? JSON.stringify(target_activity_levels) : null,
        target_languages ? JSON.stringify(target_languages) : null,
        exclude_existing_clients !== false ? 1 : 0,
        exclude_opted_out !== false ? 1 : 0,
        daily_budget || 0
      ]
    );
    const adSet = await get("SELECT * FROM ad_sets WHERE id = ?", [result.insertId]);
    await audit(req, "adset.create", "ad_set", result.insertId, null, adSet);
    res.status(201).json({ adSet });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router21.patch("/ad-sets/:id", authenticateToken, coachOrAdmin3, async (req, res) => {
  try {
    const set = await get("SELECT * FROM ad_sets WHERE id = ?", [req.params.id]);
    if (!set) return res.status(404).json({ message: "Not found" });
    const ownerCoachId = await getAdSetOwnerCoachId(req.params.id);
    if (req.user.role !== "admin" && ownerCoachId !== req.user.id) {
      return res.status(403).json({ message: "Not your ad set" });
    }
    const fields = [
      "name",
      "placement",
      "target_gender",
      "target_age_min",
      "target_age_max",
      "target_location",
      "target_lat",
      "target_lng",
      "target_radius_km",
      "exclude_existing_clients",
      "exclude_opted_out",
      "daily_budget",
      "status"
    ];
    const updates = fields.filter((f) => req.body[f] !== void 0).map((f) => `${f}=?`);
    const vals = fields.filter((f) => req.body[f] !== void 0).map((f) => req.body[f]);
    if (!updates.length) return res.status(400).json({ message: "Nothing to update" });
    await run(`UPDATE ad_sets SET ${updates.join(",")}, updated_at=NOW() WHERE id=?`, [...vals, req.params.id]);
    const updated = await get("SELECT * FROM ad_sets WHERE id = ?", [req.params.id]);
    res.json({ adSet: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router21.delete("/ad-sets/:id", authenticateToken, coachOrAdmin3, async (req, res) => {
  try {
    const ownerCoachId = await getAdSetOwnerCoachId(req.params.id);
    if (ownerCoachId === null) return res.status(404).json({ message: "Not found" });
    if (req.user.role !== "admin" && ownerCoachId !== req.user.id) {
      return res.status(403).json({ message: "Not your ad set" });
    }
    await run("DELETE FROM ad_sets WHERE id = ?", [req.params.id]);
    res.json({ message: "Ad set deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router21.get("/ad-sets/:adSetId/ads", authenticateToken, coachOrAdmin3, async (req, res) => {
  try {
    const ads = await query(
      `SELECT a.*, ac.media_url, ac.format, ac.thumbnail_url
       FROM ads a LEFT JOIN ad_creatives ac ON ac.id = a.creative_id
       WHERE a.ad_set_id = ? ORDER BY a.id`,
      [req.params.adSetId]
    );
    res.json({ ads });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router21.post("/ad-sets/:adSetId/ads", authenticateToken, coachOrAdmin3, async (req, res) => {
  try {
    const { name, creative_id, headline, body, cta, destination_type, destination_ref, campaign_id, variant_group, is_control } = req.body;
    const result = await run(
      `INSERT INTO ads (ad_set_id, campaign_id, name, creative_id, headline, body, cta, destination_type, destination_ref, variant_group, is_control)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.params.adSetId,
        campaign_id,
        name || "Ad 1",
        creative_id || null,
        headline || null,
        body || null,
        cta || null,
        destination_type || "profile",
        destination_ref || null,
        variant_group || null,
        is_control ? 1 : 0
      ]
    );
    const ad = await get("SELECT * FROM ads WHERE id = ?", [result.insertId]);
    res.status(201).json({ ad });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router21.patch("/ads/:id", authenticateToken, coachOrAdmin3, async (req, res) => {
  try {
    const ownerCoachId = await getAdOwnerCoachId(req.params.id);
    if (ownerCoachId === null) return res.status(404).json({ message: "Not found" });
    if (req.user.role !== "admin" && ownerCoachId !== req.user.id) {
      return res.status(403).json({ message: "Not your ad" });
    }
    const { name, headline, body, cta, status, creative_id } = req.body;
    await run(
      `UPDATE ads SET name=COALESCE(?,name), headline=COALESCE(?,headline), body=COALESCE(?,body),
         cta=COALESCE(?,cta), status=COALESCE(?,status), creative_id=COALESCE(?,creative_id), updated_at=NOW()
       WHERE id=?`,
      [name, headline, body, cta, status, creative_id, req.params.id]
    );
    const ad = await get("SELECT * FROM ads WHERE id = ?", [req.params.id]);
    res.json({ ad });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router21.delete("/ads/:id", authenticateToken, coachOrAdmin3, async (req, res) => {
  try {
    const ownerCoachId = await getAdOwnerCoachId(req.params.id);
    if (ownerCoachId === null) return res.status(404).json({ message: "Not found" });
    if (req.user.role !== "admin" && ownerCoachId !== req.user.id) {
      return res.status(403).json({ message: "Not your ad" });
    }
    await run("DELETE FROM ads WHERE id = ?", [req.params.id]);
    res.json({ message: "Ad deleted" });
  } catch {
    res.status(500).json({ message: "Delete failed" });
  }
});
router21.get("/creatives", authenticateToken, coachOrAdmin3, async (req, res) => {
  try {
    const isAdmin = req.user.role === "admin";
    const cols = await query(`SHOW COLUMNS FROM ad_creatives`);
    const colNames = cols.map((c) => c.Field);
    const ownerCol = colNames.includes("coach_id") ? "coach_id" : colNames.includes("owner_id") ? "owner_id" : colNames.includes("created_by") ? "created_by" : null;
    const where = isAdmin || !ownerCol ? "" : `WHERE ${ownerCol} = ?`;
    const params = isAdmin || !ownerCol ? [] : [req.user.id];
    const creatives = await query(`SELECT * FROM ad_creatives ${where} ORDER BY created_at DESC`, params);
    res.json({ creatives });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router21.post("/creatives", authenticateToken, coachOrAdmin3, async (req, res) => {
  try {
    const { name, format, media_url, thumbnail_url, file_size_kb, width, height, duration_seconds, carousel_items } = req.body;
    const cols = await query(`SHOW COLUMNS FROM ad_creatives`);
    const colNames = cols.map((c) => c.Field);
    const ownerCol = colNames.includes("coach_id") ? "coach_id" : colNames.includes("owner_id") ? "owner_id" : colNames.includes("created_by") ? "created_by" : null;
    const insertCols = [];
    const vals = [];
    if (ownerCol) {
      insertCols.push(ownerCol);
      vals.push(req.user.id);
    }
    if (colNames.includes("name")) {
      insertCols.push("name");
      vals.push(name || "Creative");
    }
    if (colNames.includes("format") || colNames.includes("type")) {
      insertCols.push(colNames.includes("format") ? "format" : "type");
      vals.push(format || "image");
    }
    if (colNames.includes("media_url")) {
      insertCols.push("media_url");
      vals.push(media_url || null);
    } else if (colNames.includes("url")) {
      insertCols.push("url");
      vals.push(media_url || null);
    }
    if (colNames.includes("thumbnail_url")) {
      insertCols.push("thumbnail_url");
      vals.push(thumbnail_url || null);
    }
    if (colNames.includes("file_size_kb")) {
      insertCols.push("file_size_kb");
      vals.push(file_size_kb || null);
    }
    if (colNames.includes("width")) {
      insertCols.push("width");
      vals.push(width || null);
    }
    if (colNames.includes("height")) {
      insertCols.push("height");
      vals.push(height || null);
    }
    if (colNames.includes("duration_seconds")) {
      insertCols.push("duration_seconds");
      vals.push(duration_seconds || null);
    }
    if (colNames.includes("carousel_items")) {
      insertCols.push("carousel_items");
      vals.push(carousel_items ? JSON.stringify(carousel_items) : null);
    }
    if (colNames.includes("status")) {
      insertCols.push("status");
      vals.push("active");
    }
    const result = await run(`INSERT INTO ad_creatives (${insertCols.join(",")}) VALUES (${insertCols.map(() => "?").join(",")})`, vals);
    const creative = await get("SELECT * FROM ad_creatives WHERE id = ?", [result.insertId]);
    res.status(201).json({ creative });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router21.post("/creatives/upload", authenticateToken, coachOrAdmin3, upload_default.single("file"), optimizeImage(), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "file is required" });
    const { uploadToR2: uploadToR22 } = await Promise.resolve().then(() => (init_upload(), upload_exports));
    const fileUrl = await uploadToR22(req.file, "ad_creatives");
    const { originalname, mimetype, size } = req.file;
    const format = mimetype.startsWith("image/") ? "image" : mimetype.startsWith("video/") ? "video" : "file";
    const cols = await query(`SHOW COLUMNS FROM ad_creatives`);
    const colNames = cols.map((c) => c.Field);
    const ownerCol = colNames.includes("coach_id") ? "coach_id" : colNames.includes("owner_id") ? "owner_id" : colNames.includes("created_by") ? "created_by" : null;
    const insertCols = [];
    const vals = [];
    if (ownerCol) {
      insertCols.push(ownerCol);
      vals.push(req.user.id);
    }
    if (colNames.includes("media_url")) {
      insertCols.push("media_url");
      vals.push(fileUrl);
    } else if (colNames.includes("url")) {
      insertCols.push("url");
      vals.push(fileUrl);
    }
    if (colNames.includes("format") || colNames.includes("type")) {
      insertCols.push(colNames.includes("format") ? "format" : "type");
      vals.push(format);
    }
    if (colNames.includes("thumbnail_url") || colNames.includes("thumbnailUrl")) {
      insertCols.push(colNames.includes("thumbnail_url") ? "thumbnail_url" : "thumbnailUrl");
      vals.push(null);
    }
    if (colNames.includes("metadata") || colNames.includes("meta")) {
      insertCols.push(colNames.includes("metadata") ? "metadata" : "meta");
      vals.push(JSON.stringify({ originalname, size, mimetype }));
    }
    if (colNames.includes("created_at")) {
      insertCols.push("created_at");
      vals.push(/* @__PURE__ */ new Date());
    }
    if (colNames.includes("updated_at")) {
      insertCols.push("updated_at");
      vals.push(/* @__PURE__ */ new Date());
    }
    const result = await run(`INSERT INTO ad_creatives (${insertCols.join(",")}) VALUES (${insertCols.map(() => "?").join(",")})`, vals);
    const creative = await get("SELECT * FROM ad_creatives WHERE id = ?", [result.insertId]);
    res.status(201).json({ creative });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router21.delete("/creatives/:id", authenticateToken, coachOrAdmin3, async (req, res) => {
  try {
    const creative = await get("SELECT * FROM ad_creatives WHERE id = ?", [req.params.id]);
    if (!creative) return res.status(404).json({ message: "Creative not found" });
    const cols = await query(`SHOW COLUMNS FROM ad_creatives`);
    const colNames = cols.map((c) => c.Field);
    const ownerCol = colNames.includes("coach_id") ? "coach_id" : colNames.includes("owner_id") ? "owner_id" : colNames.includes("created_by") ? "created_by" : null;
    if (ownerCol && req.user.role !== "admin" && creative[ownerCol] !== req.user.id) {
      return res.status(403).json({ message: "Not your creative" });
    }
    await run("DELETE FROM ad_creatives WHERE id = ?", [req.params.id]);
    res.json({ message: "Creative deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router21.get("/ads", authenticateToken, coachOrAdmin3, async (req, res) => {
  try {
    const isAdmin = req.user.role === "admin";
    const filter = isAdmin ? "" : "WHERE c.coach_id = ?";
    const params = isAdmin ? [] : [req.user.id];
    const ads = await query(
      `SELECT a.*, s.name AS ad_set_name, c.name AS campaign_name,
              ac.media_url, ac.format AS creative_format, ac.thumbnail_url
       FROM ads a
       JOIN ad_sets s ON s.id = a.ad_set_id
       JOIN ad_campaigns c ON c.id = s.campaign_id
       LEFT JOIN ad_creatives ac ON ac.id = a.creative_id
       ${filter}
       ORDER BY a.created_at DESC`,
      params
    );
    res.json({ ads });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router21.get("/analytics/stats", authenticateToken, coachOrAdmin3, async (req, res) => {
  try {
    const coachId = req.user.role === "admin" ? req.query.coach_id : req.user.id;
    const filter = coachId ? "WHERE c.coach_id = ?" : "";
    const params = coachId ? [coachId] : [];
    const [row] = await query(
      `SELECT
         COALESCE(SUM(a.impressions),0) AS total_impressions,
         COALESCE(SUM(a.clicks),0) AS total_clicks,
         COALESCE(SUM(a.conversions),0) AS total_conversions,
         COALESCE(SUM(a.amount_spent),0) AS total_spend
       FROM ads a
       JOIN ad_sets s ON s.id = a.ad_set_id
       JOIN ad_campaigns c ON c.id = s.campaign_id
       ${filter}`,
      params
    );
    res.json(row || { total_impressions: 0, total_clicks: 0, total_conversions: 0, total_spend: 0 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router21.get("/analytics/daily", authenticateToken, coachOrAdmin3, async (req, res) => {
  try {
    const coachId = req.user.role === "admin" ? req.query.coach_id : req.user.id;
    const window = parseInt(req.query.window) || 30;
    const analytics = await query(
      `SELECT DATE(e.recorded_at) AS date, e.event_type,
              COUNT(*) AS count
       FROM ad_events e
       JOIN ad_campaigns c ON c.id = e.campaign_id
       WHERE ${coachId ? "c.coach_id = ? AND" : ""}
         e.recorded_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY date, e.event_type
       ORDER BY date`,
      coachId ? [coachId, window] : [window]
    );
    const dayMap = {};
    for (const row of analytics) {
      const d = row.date;
      if (!dayMap[d]) dayMap[d] = { date: d, impressions: 0, clicks: 0, conversions: 0 };
      if (row.event_type === "impression") dayMap[d].impressions = row.count;
      else if (row.event_type === "click") dayMap[d].clicks = row.count;
      else if (row.event_type === "conversion") dayMap[d].conversions = row.count;
    }
    res.json({ analytics: Object.values(dayMap) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router21.post("/events", authenticateToken, async (req, res) => {
  try {
    const { ad_id, campaign_id, event_type, placement, session_id } = req.body;
    if (!ad_id || !campaign_id || !event_type) return res.status(400).json({ message: "Missing required fields" });
    await run(
      `INSERT INTO ad_events (ad_id, campaign_id, event_type, user_id, session_id, placement) VALUES (?, ?, ?, ?, ?, ?)`,
      [ad_id, campaign_id, event_type, req.user.id, session_id || null, placement || null]
    );
    const col = { impression: "impressions", click: "clicks", save: "saves", booking: "conversions", purchase: "conversions" }[event_type];
    if (col) await run(`UPDATE ads SET ${col} = ${col} + 1 WHERE id = ?`, [ad_id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router21.get("/analytics/summary", authenticateToken, coachOrAdmin3, async (req, res) => {
  try {
    const isAdmin = req.user.role === "admin";
    const window = parseInt(req.query.window) || 30;
    const coachId = isAdmin ? req.query.coach_id : req.user.id;
    const filter = coachId ? "WHERE c.coach_id = ?" : "";
    const params = coachId ? [coachId] : [];
    const [totals] = await query(
      `SELECT
         COUNT(DISTINCT c.id) AS total_campaigns,
         COUNT(DISTINCT CASE WHEN c.status='active' THEN c.id END) AS active_campaigns,
         COALESCE(SUM(a.impressions), 0) AS total_impressions,
         COALESCE(SUM(a.clicks), 0) AS total_clicks,
         COALESCE(SUM(a.conversions), 0) AS total_conversions,
         COALESCE(SUM(a.amount_spent), 0) AS total_spent
       FROM ad_campaigns c
       LEFT JOIN ad_sets ads ON ads.campaign_id = c.id
       LEFT JOIN ads a ON a.ad_set_id = ads.id
       ${filter}`,
      params
    );
    const byDay = await query(
      `SELECT DATE(recorded_at) AS day, event_type, COUNT(*) AS cnt
       FROM ad_events e
       JOIN ad_campaigns c ON c.id = e.campaign_id
       WHERE ${coachId ? "c.coach_id = ? AND" : ""}
         e.recorded_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY day, event_type ORDER BY day`,
      coachId ? [coachId, window] : [window]
    );
    const topAds = await query(
      `SELECT a.id, a.name, a.impressions, a.clicks, a.conversions, a.ctr, c.name AS campaign_name
       FROM ads a
       JOIN ad_sets s ON s.id = a.ad_set_id
       JOIN ad_campaigns c ON c.id = s.campaign_id
       ${coachId ? "WHERE c.coach_id = ?" : ""}
       ORDER BY a.impressions DESC LIMIT 5`,
      coachId ? [coachId] : []
    );
    res.json({ totals, byDay, topAds });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router21.get("/wallet", authenticateToken, coachOrAdmin3, async (req, res) => {
  try {
    const coachId = req.user.role === "admin" ? req.query.coach_id || req.user.id : req.user.id;
    const wallet = await get("SELECT * FROM ad_wallets WHERE coach_id = ?", [coachId]);
    const ledger = await query("SELECT * FROM ad_wallet_ledger WHERE coach_id = ? ORDER BY created_at DESC LIMIT 50", [coachId]);
    res.json({ wallet: wallet || { coach_id: coachId, balance: 0, lifetime_spent: 0 }, ledger });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router21.post("/wallet/credit", authenticateToken, adminOnly5, async (req, res) => {
  try {
    const { coach_id, amount, note } = req.body;
    if (!coach_id || !amount) return res.status(400).json({ message: "coach_id and amount required" });
    await run(
      `INSERT INTO ad_wallets (coach_id, balance) VALUES (?, ?) ON DUPLICATE KEY UPDATE balance = balance + ?`,
      [coach_id, amount, amount]
    );
    const wallet = await get("SELECT * FROM ad_wallets WHERE coach_id = ?", [coach_id]);
    await run(
      `INSERT INTO ad_wallet_ledger (coach_id, entry_type, amount, balance_after, note, created_by) VALUES (?, 'credit', ?, ?, ?, ?)`,
      [coach_id, amount, wallet.balance, note || null, req.user.id]
    );
    await audit(req, "wallet.credit", "wallet", coach_id, null, { amount, balance: wallet.balance });
    res.json({ wallet });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router21.get("/placements", authenticateToken, async (_req, res) => {
  try {
    const placements = await query("SELECT * FROM ad_placements ORDER BY priority_order");
    res.json({ placements });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router21.get("/audit-logs", authenticateToken, adminOnly5, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 50;
    const offset = (page - 1) * limit;
    const logs = await query(
      `SELECT l.*, u.name AS actor_name, u.email AS actor_email
       FROM ad_audit_logs l LEFT JOIN users u ON u.id = COALESCE(l.actor_id, l.user_id)
       ORDER BY l.created_at DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`
    );
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router21.get("/presets", authenticateToken, coachOrAdmin3, async (_req, res) => {
  try {
    const presets = await query("SELECT * FROM ad_template_presets ORDER BY preset_type, id");
    res.json({ presets });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router21.get("/coach-ads", authenticateToken, coachOrAdmin3, async (req, res) => {
  try {
    const isAdmin = req.user.role === "admin";
    const where = isAdmin ? "" : "WHERE a.coach_id = ?";
    const params = isAdmin ? [] : [req.user.id];
    const ads = await query(
      `SELECT a.*,
         u.name AS coach_name, u.email AS coach_email, u.avatar AS coach_avatar,
         COALESCE(ap.amount, 0)          AS paid_amount,
         COALESCE(ap.duration_minutes, 0) AS paid_minutes,
         ap.status                        AS payment_status,
         ap.proof_url                     AS payment_proof
       FROM coach_ads a
       LEFT JOIN users u ON u.id = a.coach_id
       LEFT JOIN ad_payments ap ON ap.ad_id = a.id
       ${where}
       ORDER BY a.created_at DESC`,
      params
    );
    res.json({ campaigns: ads });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router21.patch("/coach-ads/:id/status", authenticateToken, adminOnly5, async (req, res) => {
  try {
    const { status, admin_note } = req.body;
    const validStatuses = ["active", "pending", "rejected", "paused", "archived", "expired"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `status must be one of: ${validStatuses.join(", ")}` });
    }
    const ad = await get("SELECT * FROM coach_ads WHERE id = ?", [req.params.id]);
    if (!ad) return res.status(404).json({ message: "Ad not found" });
    await run(
      `UPDATE coach_ads SET status = ?, admin_note = ?, updated_at = NOW() WHERE id = ?`,
      [status, admin_note || null, req.params.id]
    );
    if (status === "active") {
      await run(
        `UPDATE coach_ads SET payment_status = 'approved',
         boost_start = COALESCE(boost_start, NOW()),
         boost_end = COALESCE(boost_end, COALESCE(schedule_end, DATE_ADD(NOW(), INTERVAL 30 DAY)))
         WHERE id = ? AND (payment_status IS NULL OR payment_status != 'approved')`,
        [req.params.id]
      );
      await run(
        `UPDATE ad_payments SET status = 'approved', updated_at = NOW() WHERE ad_id = ? AND status = 'pending'`,
        [req.params.id]
      );
    }
    if (status === "rejected" && ad.coach_id) {
      const reason = admin_note ? `: ${admin_note}` : "";
      const nTitle = "\u274C Ad Rejected";
      const nBody = `Your ad "${ad.title || "Untitled"}" has been rejected${reason}`;
      await run(
        "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
        [ad.coach_id, "ad_rejected", nTitle, nBody, "/coach/ads/my-ads"]
      );
      sendPushToUser(ad.coach_id, nTitle, nBody, void 0, "/coach/ads/my-ads", "ad_rejected").catch(() => {
      });
    }
    const updated = await get("SELECT * FROM coach_ads WHERE id = ?", [req.params.id]);
    await audit(req, `coach_ad.status.${status}`, "coach_ad", ad.id, { status: ad.status }, { status });
    res.json({ campaign: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
var adsRoutes_default = router21;

// server/routes/adSettingsRoutes.ts
init_auth();
init_database();
import { Router as Router19 } from "express";
var router22 = Router19();
var adminOnly6 = (req, res, next) => {
  if (req.user?.role !== "admin") return res.status(403).json({ message: "Admin access required" });
  next();
};
router22.get("/", authenticateToken, adminOnly6, async (_req, res) => {
  try {
    const settings = await query("SELECT * FROM admin_ad_settings ORDER BY category, id");
    const grouped = {};
    for (const s of settings) {
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push(s);
    }
    res.json({ settings, grouped });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router22.get("/public", authenticateToken, async (_req, res) => {
  try {
    const publicKeys = [
      "ads_system_enabled",
      "require_admin_approval",
      "coaches_can_create_directly",
      "min_daily_budget",
      "max_daily_budget",
      "min_lifetime_budget",
      "max_lifetime_budget",
      "allow_image_creative",
      "allow_video_creative",
      "allow_carousel_creative",
      "allow_text_creative",
      "max_image_size_kb",
      "max_video_size_kb",
      "targeting_location_enabled",
      "targeting_age_enabled",
      "targeting_activity_enabled",
      "targeting_language_enabled",
      "targeting_interests_enabled"
    ];
    const placeholders = publicKeys.map(() => "?").join(",");
    const settings = await query(
      `SELECT setting_key, setting_value, setting_type, label FROM admin_ad_settings WHERE setting_key IN (${placeholders})`,
      publicKeys
    );
    const map = {};
    for (const s of settings) {
      map[s.setting_key] = s.setting_type === "boolean" ? s.setting_value === "true" : s.setting_type === "integer" ? parseInt(s.setting_value) : s.setting_type === "json" ? JSON.parse(s.setting_value) : s.setting_value;
    }
    res.json({ settings: map });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router22.patch("/:key", authenticateToken, adminOnly6, async (req, res) => {
  try {
    const { key } = req.params;
    const { value, reason } = req.body;
    if (value === void 0) return res.status(400).json({ message: "value is required" });
    const existing = await get("SELECT * FROM admin_ad_settings WHERE setting_key = ?", [key]);
    if (!existing) return res.status(404).json({ message: `Setting '${key}' not found` });
    const strValue = typeof value === "object" ? JSON.stringify(value) : String(value);
    await run(
      `INSERT INTO ad_setting_history (setting_key, old_value, new_value, changed_by, reason) VALUES (?, ?, ?, ?, ?)`,
      [key, existing.setting_value, strValue, req.user.id, reason || null]
    );
    await run(
      `UPDATE admin_ad_settings SET setting_value = ?, updated_by = ?, updated_at = NOW() WHERE setting_key = ?`,
      [strValue, req.user.id, key]
    );
    await run(
      `INSERT INTO ad_audit_logs (actor_id, actor_role, action, entity_type, entity_id, old_state, new_state)
       VALUES (?, 'admin', 'settings.update', 'setting', NULL, ?, ?)`,
      [req.user.id, JSON.stringify({ [key]: existing.setting_value }), JSON.stringify({ [key]: strValue })]
    );
    res.json({ key, value: strValue });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router22.post("/bulk", authenticateToken, adminOnly6, async (req, res) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates) || !updates.length) return res.status(400).json({ message: "updates array required" });
    for (const { key, value, reason } of updates) {
      const existing = await get("SELECT * FROM admin_ad_settings WHERE setting_key = ?", [key]);
      if (!existing) continue;
      const strValue = typeof value === "object" ? JSON.stringify(value) : String(value);
      await run(
        `INSERT INTO ad_setting_history (setting_key, old_value, new_value, changed_by, reason) VALUES (?, ?, ?, ?, ?)`,
        [key, existing.setting_value, strValue, req.user.id, reason || null]
      );
      await run(
        `UPDATE admin_ad_settings SET setting_value = ?, updated_by = ?, updated_at = NOW() WHERE setting_key = ?`,
        [strValue, req.user.id, key]
      );
    }
    await run(
      `INSERT INTO ad_audit_logs (actor_id, actor_role, action, entity_type, new_state)
       VALUES (?, 'admin', 'settings.bulk_update', 'setting', ?)`,
      [req.user.id, JSON.stringify(updates.map((u) => u.key))]
    );
    const all = await query("SELECT * FROM admin_ad_settings ORDER BY category, id");
    res.json({ settings: all, updated: updates.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router22.get("/history", authenticateToken, adminOnly6, async (req, res) => {
  try {
    const history = await query(
      `SELECT h.*, u.name AS changed_by_name, u.email AS changed_by_email
       FROM ad_setting_history h LEFT JOIN users u ON u.id = h.changed_by
       ORDER BY h.changed_at DESC LIMIT 100`
    );
    res.json({ history });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router22.get("/placements", authenticateToken, adminOnly6, async (_req, res) => {
  try {
    const placements = await query("SELECT * FROM ad_placements ORDER BY priority_order");
    res.json({ placements });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router22.patch("/placements/:key", authenticateToken, adminOnly6, async (req, res) => {
  try {
    const { enabled, max_ads, priority_order, frequency_cap_hours, label, description } = req.body;
    await run(
      `UPDATE ad_placements SET
         enabled = COALESCE(?, enabled),
         max_ads = COALESCE(?, max_ads),
         priority_order = COALESCE(?, priority_order),
         frequency_cap_hours = COALESCE(?, frequency_cap_hours),
         label = COALESCE(?, label),
         description = COALESCE(?, description),
         updated_at = NOW()
       WHERE placement_key = ?`,
      [enabled !== void 0 ? enabled ? 1 : 0 : null, max_ads, priority_order, frequency_cap_hours, label, description, req.params.key]
    );
    const p = await get("SELECT * FROM ad_placements WHERE placement_key = ?", [req.params.key]);
    res.json({ placement: p });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router22.get("/feature-flags", authenticateToken, adminOnly6, async (_req, res) => {
  try {
    const flags = await query("SELECT * FROM ad_feature_flags ORDER BY id");
    res.json({ flags });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router22.patch("/feature-flags/:key", authenticateToken, adminOnly6, async (req, res) => {
  try {
    const { enabled } = req.body;
    await run(
      `UPDATE ad_feature_flags SET enabled = ?, updated_by = ?, updated_at = NOW() WHERE flag_key = ?`,
      [enabled ? 1 : 0, req.user.id, req.params.key]
    );
    const flag = await get("SELECT * FROM ad_feature_flags WHERE flag_key = ?", [req.params.key]);
    res.json({ flag });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router22.get("/approval-rules", authenticateToken, adminOnly6, async (_req, res) => {
  try {
    const rules = await query("SELECT * FROM ad_approval_rules ORDER BY priority DESC");
    res.json({ rules });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router22.post("/approval-rules", authenticateToken, adminOnly6, async (req, res) => {
  try {
    const { rule_name, rule_type, conditions, enabled, priority } = req.body;
    const result = await run(
      `INSERT INTO ad_approval_rules (rule_name, rule_type, conditions, enabled, priority, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
      [rule_name, rule_type || "require_review", conditions ? JSON.stringify(conditions) : null, enabled !== false ? 1 : 0, priority || 0, req.user.id]
    );
    const rule = await get("SELECT * FROM ad_approval_rules WHERE id = ?", [result.insertId]);
    res.status(201).json({ rule });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router22.patch("/approval-rules/:id", authenticateToken, adminOnly6, async (req, res) => {
  try {
    const { rule_name, rule_type, conditions, enabled, priority } = req.body;
    await run(
      `UPDATE ad_approval_rules SET
         rule_name=COALESCE(?,rule_name), rule_type=COALESCE(?,rule_type),
         conditions=COALESCE(?,conditions), enabled=COALESCE(?,enabled), priority=COALESCE(?,priority)
       WHERE id=?`,
      [rule_name, rule_type, conditions ? JSON.stringify(conditions) : null, enabled !== void 0 ? enabled ? 1 : 0 : null, priority, req.params.id]
    );
    const rule = await get("SELECT * FROM ad_approval_rules WHERE id = ?", [req.params.id]);
    res.json({ rule });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router22.delete("/approval-rules/:id", authenticateToken, adminOnly6, async (req, res) => {
  try {
    await run("DELETE FROM ad_approval_rules WHERE id = ?", [req.params.id]);
    res.json({ message: "Rule deleted" });
  } catch {
    res.status(500).json({ message: "Delete failed" });
  }
});
router22.get("/presets", authenticateToken, adminOnly6, async (_req, res) => {
  try {
    const presets = await query("SELECT * FROM ad_template_presets ORDER BY preset_type, id");
    res.json({ presets });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router22.post("/presets", authenticateToken, adminOnly6, async (req, res) => {
  try {
    const { preset_type, name, description, config, is_default, target_role } = req.body;
    const result = await run(
      `INSERT INTO ad_template_presets (preset_type, name, description, config, is_default, target_role, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [preset_type, name, description || null, JSON.stringify(config), is_default ? 1 : 0, target_role || "all", req.user.id]
    );
    const preset = await get("SELECT * FROM ad_template_presets WHERE id = ?", [result.insertId]);
    res.status(201).json({ preset });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router22.patch("/presets/:id", authenticateToken, adminOnly6, async (req, res) => {
  try {
    const { name, description, config, is_default, target_role } = req.body;
    await run(
      `UPDATE ad_template_presets SET
         name=COALESCE(?,name), description=COALESCE(?,description),
         config=COALESCE(?,config), is_default=COALESCE(?,is_default),
         target_role=COALESCE(?,target_role), updated_at=NOW()
       WHERE id=?`,
      [name, description, config ? JSON.stringify(config) : null, is_default !== void 0 ? is_default ? 1 : 0 : null, target_role, req.params.id]
    );
    const preset = await get("SELECT * FROM ad_template_presets WHERE id = ?", [req.params.id]);
    res.json({ preset });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router22.delete("/presets/:id", authenticateToken, adminOnly6, async (req, res) => {
  try {
    await run("DELETE FROM ad_template_presets WHERE id = ?", [req.params.id]);
    res.json({ message: "Preset deleted" });
  } catch {
    res.status(500).json({ message: "Delete failed" });
  }
});
router22.get("/overview", authenticateToken, adminOnly6, async (_req, res) => {
  try {
    const [campaigns] = await query(`SELECT COUNT(*) AS total, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active, SUM(CASE WHEN status='pending_review' THEN 1 ELSE 0 END) AS pending FROM ad_campaigns`);
    const [pending_reviews] = await query(`SELECT COUNT(*) AS total FROM ad_moderation_reviews WHERE status='pending'`);
    const [events_today] = await query("SELECT COUNT(*) AS total FROM ad_events WHERE DATE(recorded_at)=CURDATE()");
    const [spend_today] = await query(`SELECT COALESCE(SUM(amount),0) AS total FROM ad_wallet_ledger WHERE entry_type='debit' AND DATE(created_at)=CURDATE()`);
    const flagged = await query(`SELECT * FROM ad_moderation_reviews WHERE status='flagged' LIMIT 5`);
    res.json({ campaigns, pending_reviews: pending_reviews.total, events_today: events_today.total, spend_today: spend_today.total, flagged });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
var adSettingsRoutes_default = router22;

// server/routes/adModerationRoutes.ts
init_auth();
init_database();
import { Router as Router20 } from "express";
var router23 = Router20();
var adminOrMod = (req, res, next) => {
  if (!["admin", "moderator"].includes(req.user?.role)) return res.status(403).json({ message: "Admin or moderator access required" });
  next();
};
router23.get("/", authenticateToken, adminOrMod, async (req, res) => {
  try {
    const status = req.query.status || "pending";
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;
    const reviews = await query(
      `SELECT r.*,
         c.name AS campaign_name, c.objective, c.daily_budget, c.lifetime_budget, c.budget_type,
         c.schedule_start, c.schedule_end, c.status AS campaign_status,
         u.name AS coach_name, u.email AS coach_email,
         rev.name AS reviewer_name
       FROM ad_moderation_reviews r
       JOIN ad_campaigns c ON c.id = r.campaign_id
       JOIN users u ON u.id = c.coach_id
       LEFT JOIN users rev ON rev.id = r.reviewer_id
       WHERE r.status = ?
       ORDER BY r.created_at ASC
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      [status]
    );
    const [counts] = await query(
      `SELECT
         SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) AS approved,
         SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) AS rejected,
         SUM(CASE WHEN status='flagged' THEN 1 ELSE 0 END) AS flagged,
         SUM(CASE WHEN status='needs_changes' THEN 1 ELSE 0 END) AS needs_changes
       FROM ad_moderation_reviews`
    );
    res.json({ reviews, counts, page, limit });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router23.get("/:id", authenticateToken, adminOrMod, async (req, res) => {
  try {
    const review = await get(
      `SELECT r.*, c.*, u.name AS coach_name, u.email AS coach_email
       FROM ad_moderation_reviews r
       JOIN ad_campaigns c ON c.id = r.campaign_id
       JOIN users u ON u.id = c.coach_id
       WHERE r.id = ?`,
      [req.params.id]
    );
    if (!review) return res.status(404).json({ message: "Review not found" });
    const adSets = await query("SELECT * FROM ad_sets WHERE campaign_id = ?", [review.campaign_id]);
    const adSetIds = adSets.map((s) => s.id);
    const ads = adSetIds.length ? await query(`SELECT a.*, ac.media_url, ac.format FROM ads a LEFT JOIN ad_creatives ac ON ac.id = a.creative_id WHERE a.ad_set_id IN (${adSetIds.map(() => "?").join(",")})`, adSetIds) : [];
    res.json({ review, adSets, ads });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router23.patch("/:id", authenticateToken, adminOrMod, async (req, res) => {
  try {
    const { action, notes, flags } = req.body;
    const validActions = ["approve", "reject", "flag", "needs_changes"];
    if (!validActions.includes(action)) return res.status(400).json({ message: `action must be one of: ${validActions.join(", ")}` });
    const review = await get("SELECT * FROM ad_moderation_reviews WHERE id = ?", [req.params.id]);
    if (!review) return res.status(404).json({ message: "Review not found" });
    const reviewStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : action === "flag" ? "flagged" : "needs_changes";
    const campaignStatus = action === "approve" ? "active" : action === "reject" ? "rejected" : action === "flag" ? "paused" : "draft";
    await run(
      `UPDATE ad_moderation_reviews
       SET status = ?, reviewer_id = ?, notes = ?, flags = ?, resolved_at = NOW()
       WHERE id = ?`,
      [reviewStatus, req.user.id, notes || null, flags ? JSON.stringify(flags) : null, req.params.id]
    );
    await run(
      `UPDATE ad_campaigns
       SET status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [campaignStatus, notes || null, req.user.id, review.campaign_id]
    );
    if (action === "reject" || action === "needs_changes" || action === "flag") {
      const campaign = await get("SELECT coach_id, name FROM ad_campaigns WHERE id = ?", [review.campaign_id]);
      if (campaign?.coach_id) {
        const titles = { reject: "\u274C Campaign Rejected", needs_changes: "\u26A0\uFE0F Campaign Needs Changes", flag: "\u{1F6A9} Campaign Flagged" };
        const reason = notes ? `: ${notes}` : "";
        await run(
          "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
          [campaign.coach_id, "ad_moderation", titles[action] || "Campaign Update", `Your campaign "${campaign.name || "Untitled"}" has been ${action === "reject" ? "rejected" : action === "flag" ? "flagged for review" : "sent back for changes"}${reason}`, "/coach/ads/my-ads"]
        );
        const adPushSlug = action === "reject" ? "ad_rejected" : action === "flag" ? "ad_flagged" : "ad_needs_changes";
        sendPushFromTemplate(campaign.coach_id, adPushSlug, { campaign_name: campaign.name || "Untitled" }).catch(() => {
        });
      }
    }
    await run(
      `INSERT INTO ad_audit_logs (actor_id, actor_role, action, entity_type, entity_id, old_state, new_state)
       VALUES (?, ?, ?, 'campaign', ?, ?, ?)`,
      [
        req.user.id,
        req.user.role,
        `moderation.${action}`,
        review.campaign_id,
        JSON.stringify({ status: review.status }),
        JSON.stringify({ status: reviewStatus, notes })
      ]
    );
    const updated = await get("SELECT * FROM ad_moderation_reviews WHERE id = ?", [req.params.id]);
    res.json({ review: updated, campaign_status: campaignStatus });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router23.post("/auto-scan", authenticateToken, adminOrMod, async (req, res) => {
  try {
    const { campaign_id } = req.body;
    if (!campaign_id) return res.status(400).json({ message: "campaign_id required" });
    const campaign = await get("SELECT * FROM ad_campaigns WHERE id = ?", [campaign_id]);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    const kwSetting = await get(`SELECT setting_value FROM admin_ad_settings WHERE setting_key = 'auto_flag_keywords'`);
    const keywords = kwSetting ? JSON.parse(kwSetting.setting_value) : [];
    const autoFlagReasons = [];
    const textToScan = `${campaign.name}`.toLowerCase();
    for (const kw of keywords) {
      if (textToScan.includes(kw.toLowerCase())) {
        autoFlagReasons.push(`Prohibited keyword: "${kw}"`);
      }
    }
    const dupe = await get(
      `SELECT id FROM ad_campaigns WHERE coach_id = ? AND name = ? AND id != ? LIMIT 1`,
      [campaign.coach_id, campaign.name, campaign_id]
    );
    if (dupe) autoFlagReasons.push("Duplicate campaign name detected");
    const wasFlagged = autoFlagReasons.length > 0;
    if (wasFlagged) {
      const flagAction = (await get(`SELECT setting_value FROM admin_ad_settings WHERE setting_key = 'flag_action'`))?.setting_value || "pause";
      const newStatus = flagAction === "reject" ? "rejected" : flagAction === "pause" ? "paused" : "pending_review";
      await run(`UPDATE ad_campaigns SET status = ?, updated_at = NOW() WHERE id = ?`, [newStatus, campaign_id]);
      await run(
        `UPDATE ad_moderation_reviews SET status = 'flagged', auto_flagged = 1, auto_flag_reasons = ? WHERE campaign_id = ? AND status = 'pending'`,
        [JSON.stringify(autoFlagReasons), campaign_id]
      );
    }
    res.json({ flagged: wasFlagged, reasons: autoFlagReasons });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router23.get("/stats/summary", authenticateToken, adminOrMod, async (_req, res) => {
  try {
    const [totals] = await query(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) AS approved,
         SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) AS rejected,
         SUM(CASE WHEN status='flagged' THEN 1 ELSE 0 END) AS flagged,
         SUM(CASE WHEN auto_flagged=1 THEN 1 ELSE 0 END) AS auto_flagged
       FROM ad_moderation_reviews`
    );
    const recent = await query(
      `SELECT r.*, c.name AS campaign_name, u.name AS coach_name
       FROM ad_moderation_reviews r
       JOIN ad_campaigns c ON c.id = r.campaign_id
       JOIN users u ON u.id = c.coach_id
       WHERE r.status IN ('approved','rejected') AND r.resolved_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       ORDER BY r.resolved_at DESC LIMIT 10`
    );
    res.json({ totals, recent });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
var adModerationRoutes_default = router23;

// server/routes/appImagesRoutes.ts
init_auth();
init_database();
init_upload();
import { Router as Router21 } from "express";
var router24 = Router21();
var adminOnly7 = (req, res, next) => {
  if (req.user?.role !== "admin") return res.status(403).json({ message: "Admin access required" });
  next();
};
var SLUG_RE = /^[a-z0-9_]{1,64}$/;
router24.get("/", async (_req, res) => {
  try {
    const rows = await query("SELECT slug, url, alt, category FROM app_images");
    const map = {};
    for (const r of rows) map[r.slug] = { url: r.url, alt: r.alt, category: r.category };
    res.json({ images: map });
  } catch {
    res.json({ images: {} });
  }
});
router24.get("/:slug", async (req, res) => {
  const { slug } = req.params;
  if (!SLUG_RE.test(slug)) return res.status(400).json({ message: "Invalid slug" });
  try {
    const row = await get("SELECT slug, url, alt, category FROM app_images WHERE slug = ?", [slug]);
    if (!row) return res.status(404).json({ message: "Not found" });
    res.json(row);
  } catch {
    res.status(500).json({ message: "Failed" });
  }
});
router24.get("/admin/all", authenticateToken, adminOnly7, async (_req, res) => {
  try {
    const rows = await query("SELECT slug, url, alt, category, updated_at FROM app_images ORDER BY category, slug");
    res.json({ images: rows });
  } catch {
    res.status(500).json({ message: "Failed" });
  }
});
router24.post(
  "/admin/:slug",
  authenticateToken,
  adminOnly7,
  upload.single("image"),
  optimizeImage(),
  async (req, res) => {
    const { slug } = req.params;
    if (!SLUG_RE.test(slug)) return res.status(400).json({ message: "Invalid slug (lowercase, digits, underscore only)" });
    if (!req.file) return res.status(400).json({ message: "No image uploaded" });
    try {
      const url = await uploadToR2(req.file, "app-images");
      const alt = typeof req.body.alt === "string" ? String(req.body.alt).slice(0, 255) : null;
      const category = typeof req.body.category === "string" ? String(req.body.category).slice(0, 32) : null;
      await run(
        `INSERT INTO app_images (slug, url, alt, category, updated_by)
         VALUES (?,?,?,?,?)
         ON DUPLICATE KEY UPDATE url = VALUES(url), alt = VALUES(alt), category = VALUES(category), updated_by = VALUES(updated_by)`,
        [slug, url, alt, category, req.user.id]
      );
      res.json({ slug, url, alt, category });
    } catch (err) {
      res.status(500).json({ message: "Failed to upload" });
    }
  }
);
router24.delete("/admin/:slug", authenticateToken, adminOnly7, async (req, res) => {
  const { slug } = req.params;
  if (!SLUG_RE.test(slug)) return res.status(400).json({ message: "Invalid slug" });
  try {
    await run("DELETE FROM app_images WHERE slug = ?", [slug]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Failed" });
  }
});
var appImagesRoutes_default = router24;

// server/routes/debugRoutes.ts
init_database();
import { Router as Router22 } from "express";
var router25 = Router22();
router25.get("/db-check", async (_req, res) => {
  try {
    const pool = getPool();
    const conn = await pool.getConnection();
    conn.release();
    const tablesToCheck = ["ad_moderation_reviews", "ad_campaigns", "ad_creatives", "ad_audit_logs"];
    const checks = {};
    for (const t of tablesToCheck) {
      try {
        const safe = t.replace(/'/g, "''");
        const rows = await query(`SHOW TABLES LIKE '${safe}'`);
        checks[t] = rows && rows.length ? true : false;
      } catch (e) {
        checks[t] = { ok: false, error: e.message };
      }
    }
    const counts = {};
    try {
      counts.ad_moderation_reviews = (await get("SELECT COUNT(*) as cnt FROM ad_moderation_reviews"))?.cnt ?? null;
    } catch (e) {
      counts.ad_moderation_reviews = e.message;
    }
    try {
      counts.ad_campaigns = (await get("SELECT COUNT(*) as cnt FROM ad_campaigns"))?.cnt ?? null;
    } catch (e) {
      counts.ad_campaigns = e.message;
    }
    res.json({ ok: true, connection: "ok", checks, counts });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message, stack: err.stack });
  }
});
var debugRoutes_default = router25;

// server/middleware/error.ts
var errorHandler = (err, _req, res, _next) => {
  if (process.env.NODE_ENV !== "production") {
    console.error("[ERROR]", err.stack || err.message);
  } else {
    console.error("[ERROR]", err.message || "Unknown error");
  }
  const status = typeof err.status === "number" ? err.status : 500;
  res.status(status).json({
    message: status < 500 ? err.message || "Request failed" : "Something went wrong. Please try again."
  });
};

// server.ts
init_database();
var envResult2 = dotenv2.config();
if (envResult2.error) {
  dotenv2.config({ path: "env.txt" });
}
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = path4.dirname(__filename2);
function buildAllowedOrigins() {
  const base = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "capacitor://localhost",
    "https://localhost",
    "http://localhost",
    "https://peter-adel.taila6a2b4.ts.net"
  ];
  if (process.env.APP_BASE_URL) {
    const url = process.env.APP_BASE_URL.replace(/\/$/, "");
    base.push(url);
    base.push(url.replace("https://", "http://"));
  }
  if (process.env.EXTRA_ORIGINS) {
    process.env.EXTRA_ORIGINS.split(",").forEach((o) => base.push(o.trim()));
  }
  return [...new Set(base)];
}
var ALLOWED_ORIGINS = buildAllowedOrigins();
async function processAutoRenewals() {
  try {
    const expiring = await query(
      `SELECT cs.*, u.credit as user_credit, u.name as user_name,
              cp.monthly_price, cp.yearly_price, coach.name as coach_name
       FROM coach_subscriptions cs
       JOIN users u ON cs.user_id = u.id
       LEFT JOIN coach_profiles cp ON cs.coach_id = cp.user_id
       LEFT JOIN users coach ON cs.coach_id = coach.id
       WHERE cs.status = 'active'
         AND cs.auto_renew = 1
         AND cs.expires_at IS NOT NULL
         AND cs.expires_at <= DATE_ADD(NOW(), INTERVAL 24 HOUR)
         AND cs.expires_at > NOW()`
    );
    for (const sub of expiring) {
      const price = sub.plan_cycle === "yearly" ? Number(sub.yearly_price || sub.amount || 0) : Number(sub.monthly_price || sub.amount || 0);
      if (price <= 0) continue;
      if (Number(sub.user_credit) < price) {
        await run(
          "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
          [
            sub.user_id,
            "subscription_renewal_failed",
            "\u26A0\uFE0F Subscription Renewal Failed",
            `Your subscription to ${sub.coach_name || "your coach"} could not be renewed. Insufficient credit (need ${price} EGP). Please top up or renew manually.`,
            "/app/coaching"
          ]
        );
        continue;
      }
      await run("UPDATE users SET credit = credit - ? WHERE id = ?", [price, sub.user_id]);
      const interval = sub.plan_cycle === "yearly" ? 12 : 1;
      await run(
        "UPDATE coach_subscriptions SET expires_at = DATE_ADD(expires_at, INTERVAL ? MONTH), amount = ? WHERE id = ?",
        [interval, price, sub.id]
      );
      await run("UPDATE users SET credit = credit + ? WHERE id = ?", [price, sub.coach_id]);
      await run(
        "INSERT INTO credit_transactions (user_id, amount, type, description) VALUES (?,?,?,?)",
        [sub.coach_id, price, "subscription_renewal", `Auto-renewal from ${sub.user_name || "user #" + sub.user_id} (${sub.plan_cycle})`]
      );
      await run(
        "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
        [
          sub.user_id,
          "subscription_renewed",
          "\u2705 Subscription Renewed",
          `Your ${sub.plan_cycle} subscription to ${sub.coach_name || "your coach"} was auto-renewed for ${price} EGP.`,
          "/app/coaching"
        ]
      );
      await run(
        "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
        [
          sub.coach_id,
          "subscription_renewed",
          "\u{1F4B0} Subscription Renewed",
          `${sub.user_name || "A user"}'s ${sub.plan_cycle} subscription was auto-renewed (+${price} EGP credit).`,
          "/coach/profile"
        ]
      );
      console.log(`\u2705 Auto-renewed subscription #${sub.id} for user #${sub.user_id} \u2192 coach #${sub.coach_id} (${price} EGP)`);
    }
    const expiringCerts = await query(
      `SELECT cp.user_id, cp.certified_until, u.credit, u.name
       FROM coach_profiles cp
       JOIN users u ON cp.user_id = u.id
       WHERE cp.certified = 1
         AND cp.certified_until IS NOT NULL
         AND cp.certified_until <= DATE_ADD(NOW(), INTERVAL 24 HOUR)
         AND cp.certified_until > NOW()`
    );
    const feeSetting = await query("SELECT setting_value FROM app_settings WHERE setting_key = 'certified_coach_fee'");
    const certFee = Number(feeSetting?.[0]?.setting_value) || 500;
    for (const cert of expiringCerts) {
      if (Number(cert.credit) < certFee) {
        await run("UPDATE coach_profiles SET certified = 0 WHERE user_id = ?", [cert.user_id]);
        await run(
          "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
          [
            cert.user_id,
            "certification_expired",
            "\u26A0\uFE0F Certification Expired",
            `Your Certified Coach badge has expired. Insufficient credit to renew (need ${certFee} EGP).`,
            "/coach/profile"
          ]
        );
        continue;
      }
      await run("UPDATE users SET credit = credit - ? WHERE id = ?", [certFee, cert.user_id]);
      await run(
        "UPDATE coach_profiles SET certified_until = DATE_ADD(certified_until, INTERVAL 1 MONTH) WHERE user_id = ?",
        [cert.user_id]
      );
      await run(
        "INSERT INTO credit_transactions (user_id, amount, type, description) VALUES (?,?,?,?)",
        [cert.user_id, -certFee, "certification_renewal", `Certified Coach auto-renewal - ${certFee} EGP/month`]
      );
      await run(
        "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
        [
          cert.user_id,
          "certification_renewed",
          "\u2705 Certification Renewed",
          `Your Certified Coach badge was auto-renewed for ${certFee} EGP.`,
          "/coach/profile"
        ]
      );
      console.log(`\u2705 Auto-renewed certification for coach #${cert.user_id} (${certFee} EGP)`);
    }
  } catch (err) {
    console.error("Auto-renewal processing error:", err);
  }
}
async function startServer() {
  const { initDatabase: initDatabase2 } = await Promise.resolve().then(() => (init_database(), database_exports));
  await initDatabase2();
  const app = express4();
  const PORT = process.env.PORT || 3e3;
  app.set("trust proxy", 1);
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
        frameSrc: ["'self'", "https:"]
      }
    },
    crossOriginResourcePolicy: { policy: "cross-origin" }
  }));
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  }));
  if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));
  app.use(express4.json({ limit: "1mb" }));
  app.use(express4.urlencoded({ extended: false, limit: "1mb" }));
  app.use("/api/auth/", rateLimit3({
    windowMs: 15 * 60 * 1e3,
    // 15 minutes
    max: 20,
    // 20 attempts per 15 min per IP
    message: { message: "Too many login attempts. Please wait 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true
  }));
  app.use("/api/", rateLimit3({
    windowMs: 1 * 60 * 1e3,
    // 1 minute
    max: 120,
    message: { message: "Too many requests, please slow down." },
    standardHeaders: true,
    legacyHeaders: false
  }));
  app.use("/uploads", (req, res, next) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|mp4|webm|mov|mp3|webm|ogg|pdf)$/i;
    if (!allowed.test(req.path)) return res.status(403).json({ message: "Forbidden" });
    next();
  }, express4.static(path4.join(__dirname2, "uploads"), {
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
  }));
  app.get("/api/ping", (_req, res) => res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() }));
  app.get("/api/public/stats", async (_req, res) => {
    try {
      const { get: dbGet, query: dbQuery } = await Promise.resolve().then(() => (init_database(), database_exports));
      const [users, coaches, programs, ratings] = await Promise.all([
        dbGet("SELECT COUNT(*) as cnt FROM users WHERE role = ?", ["user"]),
        dbGet("SELECT COUNT(*) as cnt FROM users WHERE role = ?", ["coach"]),
        dbGet("SELECT COUNT(*) as cnt FROM workout_videos"),
        dbGet("SELECT ROUND(AVG(rating),1) as avg, COUNT(*) as cnt FROM coach_reviews WHERE rating > 0")
      ]);
      res.json({
        members: users?.cnt || 0,
        coaches: coaches?.cnt || 0,
        programs: programs?.cnt || 0,
        rating: ratings?.avg ? parseFloat(ratings.avg).toFixed(1) : "5.0",
        reviews: ratings?.cnt || 0
      });
    } catch {
      res.status(500).json({ message: "Failed" });
    }
  });
  app.use("/api/auth", authRoutes_default);
  app.use("/api/health", healthRoutes_default);
  app.use("/api/steps", stepsRoutes_default);
  app.use("/api/ai", aiRoutes_default);
  app.use("/api/chat", chatRoutes_default);
  app.use("/api/community", communityRoutes_default);
  app.use("/api/track", trackRoutes_default);
  app.use("/api/analytics", analyticsRoutes_default);
  app.use("/api/coaching", coachingRoutes_default);
  app.use("/api/admin", adminRoutes_default);
  app.use("/api/coach", coachRoutes2_default);
  app.use("/api/payments", paymentRoutes_default);
  app.use("/api/user", userRoutes_default);
  app.use("/api/workouts", workoutsRoutes_default);
  app.use("/api/plans", plansRoutes_default);
  app.use("/api/cms", cmsRoutes_default);
  app.use("/api/blogs", blogRoutes_default);
  app.use("/api/email", emailRoutes_default);
  app.use("/api/notifications", notificationRoutes_default);
  app.use("/api/pay", paymobRoutes_default);
  app.use("/api/ads", adsRoutes_default);
  const { default: adsManagerRoutes } = await Promise.resolve().then(() => (init_adsManagerRoutes(), adsManagerRoutes_exports));
  app.use("/api/ads-manager", adsManagerRoutes);
  if (process.env.NODE_ENV !== "production") app.use("/api/debug", debugRoutes_default);
  app.use("/api/ad-settings", adSettingsRoutes_default);
  app.use("/api/ad-moderation", adModerationRoutes_default);
  app.use("/api/app-images", appImagesRoutes_default);
  try {
    startSmtpServer(Number(process.env.SMTP_PORT || 2525));
  } catch (e) {
    console.warn("SMTP server failed to start:", e);
  }
  const distDir = path4.join(__dirname2, "dist");
  const distIndex = path4.join(distDir, "index.html");
  const { existsSync } = await import("fs");
  if (existsSync(distIndex)) {
    app.use(express4.static(distDir));
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(distIndex);
    });
    console.log("\u2705 Serving built frontend from dist/");
  } else {
    app.get("/", (_req, res) => {
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
          <h1>\u26A1 FitWay Hub</h1>
          <p>The server is running but the frontend hasn't been built yet.</p>
          <p>Run this command in your project folder, then restart:</p>
          <code>npm run build</code>
          <p style="margin-top:8px">The API is fully available at <code>/api/...</code></p>
        </body></html>`);
    });
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.redirect("/");
    });
    console.log("\u26A0\uFE0F  dist/ not found \u2014 run: npm run build");
  }
  app.use(errorHandler);
  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`
\u{1F3CB}\uFE0F  FitWay Hub Server running on port ${PORT}`);
    console.log(`\u{1F4F1}  Local:    http://localhost:${PORT}`);
    console.log(`\u{1F310}  Network: ${process.env.APP_BASE_URL || "http://localhost:" + PORT}`);
    if (process.env.NODE_ENV !== "production") {
      console.log(`
\u{1F4E6}  Run frontend: npx vite --host 0.0.0.0`);
    }
    console.log(`
\u25B6  Run seed: npx tsx server/seed.ts
`);
    setInterval(async () => {
      try {
        await processAutoRenewals();
      } catch (e) {
        console.error("Auto-renew error:", e);
      }
    }, 60 * 60 * 1e3);
    setInterval(async () => {
      try {
        await runScheduledPushes();
      } catch (e) {
        console.error("Scheduled push error:", e);
      }
    }, 6 * 60 * 60 * 1e3);
    setTimeout(() => processAutoRenewals().catch(() => {
    }), 3e4);
    setTimeout(() => runScheduledPushes().catch(() => {
    }), 6e4);
  });
}
startServer();
var server_default = startServer;
export {
  server_default as default
};
