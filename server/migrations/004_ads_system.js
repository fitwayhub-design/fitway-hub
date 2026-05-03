/**
 * Migration 004 — Internal Ad Management System
 * All tables are scoped entirely within FitWayHub.
 */
import { run } from '../config/database.js';
export async function runAdsMigration() {
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
    )`,
    ];
    console.log('⚙️  Running ads system migration (004)…');
    for (const sql of migrations) {
        try {
            await run(sql);
        }
        catch (err) {
            if (!err.message?.includes('Duplicate column') && !err.message?.includes('already exists')) {
                console.error('Migration error:', err.message);
            }
        }
    }
    // ── Patch existing tables that may have been created by an earlier migration ──
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
        `UPDATE ad_campaigns SET schedule_end = end_at WHERE schedule_end IS NULL AND end_at IS NOT NULL`,
    ];
    for (const sql of alterStmts) {
        try {
            await run(sql);
        }
        catch { /* already applied or column exists */ }
    }
    await seedDefaultPlacements();
    await seedDefaultAdSettings();
    await seedDefaultFeatureFlags();
    await seedDefaultApprovalRules();
    await seedDefaultTemplatePresets();
    console.log('✅ Ads system migration complete');
}
// ─── Seed helpers ─────────────────────────────────────────────────────────────
async function seedDefaultPlacements() {
    const placements = [
        { key: 'feed', label: 'Community Feed Cards', max_ads: 3, priority: 1, freq: 24 },
        { key: 'home_banner', label: 'Home Screen Banner', max_ads: 1, priority: 2, freq: 12 },
        { key: 'profile_boost', label: 'Coach Profile Boost', max_ads: 2, priority: 3, freq: 48 },
        { key: 'search', label: 'Search Results Boost', max_ads: 2, priority: 4, freq: 24 },
        { key: 'community', label: 'Community Discovery Page', max_ads: 4, priority: 5, freq: 24 },
        { key: 'notification', label: 'Notification Inbox Promo', max_ads: 1, priority: 6, freq: 72 },
        { key: 'discovery', label: 'Discovery / Explore Page', max_ads: 3, priority: 7, freq: 24 },
    ];
    for (const p of placements) {
        try {
            await run(`INSERT IGNORE INTO ad_placements (placement_key, label, enabled, max_ads, priority_order, frequency_cap_hours)
         VALUES (?, ?, 1, ?, ?, ?)`, [p.key, p.label, p.max_ads, p.priority, p.freq]);
        }
        catch { /* already exists */ }
    }
}
async function seedDefaultAdSettings() {
    const defaults = [
        // Global
        { key: 'ads_system_enabled', value: 'true', type: 'boolean', label: 'Ads System Enabled', category: 'global' },
        { key: 'require_admin_approval', value: 'true', type: 'boolean', label: 'Campaigns Require Admin Approval', category: 'global' },
        { key: 'default_campaign_status', value: 'draft', type: 'string', label: 'Default Status for New Campaigns', category: 'global' },
        { key: 'coaches_can_create_directly', value: 'true', type: 'boolean', label: 'Coaches Can Create Campaigns', category: 'global' },
        // Budget
        { key: 'min_daily_budget', value: '10', type: 'integer', label: 'Minimum Daily Budget (EGP)', category: 'budget' },
        { key: 'max_daily_budget', value: '5000', type: 'integer', label: 'Maximum Daily Budget (EGP)', category: 'budget' },
        { key: 'min_lifetime_budget', value: '50', type: 'integer', label: 'Minimum Lifetime Budget (EGP)', category: 'budget' },
        { key: 'max_lifetime_budget', value: '50000', type: 'integer', label: 'Maximum Lifetime Budget (EGP)', category: 'budget' },
        { key: 'auto_pause_overspend', value: 'true', type: 'boolean', label: 'Auto-Pause When Budget Exceeded', category: 'budget' },
        // Targeting
        { key: 'targeting_location_enabled', value: 'true', type: 'boolean', label: 'Allow Location Targeting', category: 'targeting' },
        { key: 'targeting_age_enabled', value: 'true', type: 'boolean', label: 'Allow Age Group Targeting', category: 'targeting' },
        { key: 'targeting_activity_enabled', value: 'true', type: 'boolean', label: 'Allow Activity Level Targeting', category: 'targeting' },
        { key: 'targeting_language_enabled', value: 'true', type: 'boolean', label: 'Allow Language Targeting', category: 'targeting' },
        { key: 'targeting_interests_enabled', value: 'true', type: 'boolean', label: 'Allow Interest Targeting', category: 'targeting' },
        // Creatives
        { key: 'allow_image_creative', value: 'true', type: 'boolean', label: 'Allow Image Creatives', category: 'creatives' },
        { key: 'allow_video_creative', value: 'true', type: 'boolean', label: 'Allow Video Creatives', category: 'creatives' },
        { key: 'allow_carousel_creative', value: 'true', type: 'boolean', label: 'Allow Carousel Creatives', category: 'creatives' },
        { key: 'allow_text_creative', value: 'true', type: 'boolean', label: 'Allow Text-Only Creatives', category: 'creatives' },
        { key: 'max_image_size_kb', value: '5120', type: 'integer', label: 'Max Image Size (KB)', category: 'creatives' },
        { key: 'max_video_size_kb', value: '102400', type: 'integer', label: 'Max Video Size (KB)', category: 'creatives' },
        // Moderation
        { key: 'auto_flag_keywords', value: '["spam","fake","guaranteed","100%","free money"]', type: 'json', label: 'Auto-Flag Keywords', category: 'moderation' },
        { key: 'auto_flag_duplicate', value: 'true', type: 'boolean', label: 'Auto-Flag Duplicate Campaigns', category: 'moderation' },
        { key: 'flag_action', value: 'pause', type: 'string', label: 'Action When Flagged (pause/review/reject)', category: 'moderation' },
        // Reporting
        { key: 'analytics_refresh_minutes', value: '30', type: 'integer', label: 'Analytics Refresh Interval (mins)', category: 'reporting' },
        { key: 'allow_csv_export', value: 'true', type: 'boolean', label: 'Allow CSV Export', category: 'reporting' },
        { key: 'default_reporting_window', value: '30', type: 'integer', label: 'Default Reporting Window (days)', category: 'reporting' },
        // Security
        { key: 'audit_log_enabled', value: 'true', type: 'boolean', label: 'Audit Log Enabled', category: 'security' },
        { key: 'session_timeout_minutes', value: '480', type: 'integer', label: 'Session Timeout (minutes)', category: 'security' },
        { key: 'rate_limit_campaigns_per_day', value: '10', type: 'integer', label: 'Max Campaign Creates Per Day', category: 'security' },
    ];
    for (const s of defaults) {
        try {
            await run(`INSERT IGNORE INTO admin_ad_settings (setting_key, setting_value, setting_type, label, category)
         VALUES (?, ?, ?, ?, ?)`, [s.key, s.value, s.type, s.label, s.category]);
        }
        catch { /* already exists */ }
    }
}
async function seedDefaultFeatureFlags() {
    const flags = [
        { key: 'ab_testing', label: 'A/B Testing', enabled: 0 },
        { key: 'advanced_targeting', label: 'Advanced Audience Targeting', enabled: 1 },
        { key: 'auto_optimization', label: 'Automatic Campaign Optimization', enabled: 0 },
        { key: 'carousel_ads', label: 'Carousel Ad Format', enabled: 1 },
        { key: 'internal_recommendations', label: 'AI-Powered Recommendations', enabled: 0 },
        { key: 'wallet_system', label: 'Internal Wallet / Credits', enabled: 1 },
        { key: 'report_snapshots', label: 'Daily Report Snapshots', enabled: 1 },
    ];
    for (const f of flags) {
        try {
            await run(`INSERT IGNORE INTO ad_feature_flags (flag_key, label, enabled) VALUES (?, ?, ?)`, [f.key, f.label, f.enabled]);
        }
        catch { /* exists */ }
    }
}
async function seedDefaultApprovalRules() {
    const rules = [
        {
            name: 'Auto-approve verified coaches with good standing',
            type: 'auto_approve',
            conditions: JSON.stringify({ coach_tier: 'verified', no_previous_violations: true }),
            priority: 10,
        },
        {
            name: 'Flag campaigns with prohibited keywords',
            type: 'flag',
            conditions: JSON.stringify({ keyword_match: true }),
            priority: 5,
        },
        {
            name: 'Require review for budgets over 2000 EGP',
            type: 'require_review',
            conditions: JSON.stringify({ daily_budget_gt: 2000 }),
            priority: 3,
        },
    ];
    for (const r of rules) {
        try {
            await run(`INSERT IGNORE INTO ad_approval_rules (rule_name, rule_type, conditions, enabled, priority)
         VALUES (?, ?, ?, 1, ?)`, [r.name, r.type, r.conditions, r.priority]);
        }
        catch { /* exists */ }
    }
}
async function seedDefaultTemplatePresets() {
    const presets = [
        {
            type: 'campaign',
            name: 'Starter Coaching Campaign',
            desc: 'Ready-to-go template for new coaches',
            config: JSON.stringify({ objective: 'coaching', budget_type: 'daily', daily_budget: 50, placement: 'feed' }),
        },
        {
            type: 'campaign',
            name: 'Class Promotion',
            desc: 'Boost a specific class or session',
            config: JSON.stringify({ objective: 'bookings', budget_type: 'lifetime', lifetime_budget: 300, placement: 'community' }),
        },
        {
            type: 'budget',
            name: 'Starter Budget',
            desc: 'Recommended for new coaches',
            config: JSON.stringify({ daily_budget: 50, budget_type: 'daily' }),
        },
        {
            type: 'budget',
            name: 'Growth Budget',
            desc: 'For established coaches',
            config: JSON.stringify({ daily_budget: 200, budget_type: 'daily' }),
        },
    ];
    for (const p of presets) {
        try {
            await run(`INSERT IGNORE INTO ad_template_presets (preset_type, name, description, config, is_default, target_role)
         VALUES (?, ?, ?, ?, 1, 'all')`, [p.type, p.name, p.desc, p.config]);
        }
        catch { /* exists */ }
    }
}
//# sourceMappingURL=004_ads_system.js.map