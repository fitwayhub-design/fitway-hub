import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
// Load .env (fall back to env.txt for legacy setups)
const envResult = dotenv.config();
if (envResult.error) {
    dotenv.config({ path: 'env.txt' });
}
// ── Resolve connection params ─────────────────────────────────────────────────
// Priority:
//   1. DATABASE_URL / MYSQL_URL   (full connection string – Railway public proxy)
//   2. Individual MYSQL_* vars    (Railway auto-injects these – no DB_ prefix!)
//   3. Individual DB_* vars       (manual / local dev config)
//   4. Hardcoded local defaults
const DATABASE_URL = process.env.DATABASE_URL ||
    process.env.MYSQL_URL ||
    '';
// Railway injects MYSQLHOST, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE (no underscores)
// and also MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE (with underscores).
// We read both so either convention works.
const DB_HOST = process.env.DB_HOST ||
    process.env.MYSQL_HOST ||
    process.env.MYSQLHOST ||
    'localhost';
const DB_PORT = parseInt(process.env.DB_PORT ||
    process.env.MYSQL_PORT ||
    process.env.MYSQLPORT ||
    '3306', 10);
const DB_USER = process.env.DB_USER ||
    process.env.MYSQL_USER ||
    process.env.MYSQLUSER ||
    'root';
const DB_PASSWORD = process.env.DB_PASSWORD ||
    process.env.DB_PASS ||
    process.env.MYSQL_PASSWORD ||
    process.env.MYSQL_PASS ||
    process.env.MYSQLPASSWORD ||
    '';
const DB_NAME = process.env.DB_NAME ||
    process.env.MYSQL_DATABASE ||
    process.env.MYSQLDATABASE ||
    process.env.DB_NAME || 'fitwayhub';
// When a full connection URL is provided the provider already manages the DB,
// so skip CREATE DATABASE unless the caller explicitly opts in.
const DB_AUTO_CREATE = process.env.DB_AUTO_CREATE
    ? process.env.DB_AUTO_CREATE !== 'false'
    : !DATABASE_URL;
const DB_SSL = process.env.DB_SSL === 'true';
const DB_SSL_REJECT_UNAUTHORIZED = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';
// Load CA certificate if provided (e.g. Aiven self-signed CA)
function loadCaCert() {
    const caPath = process.env.DB_SSL_CA;
    if (!caPath)
        return undefined;
    try {
        const resolved = path.isAbsolute(caPath) ? caPath : path.join(process.cwd(), caPath);
        return fs.readFileSync(resolved);
    }
    catch (e) {
        console.warn(`⚠️  Could not load DB_SSL_CA from "${caPath}": ${e.message}`);
        return undefined;
    }
}
const DB_SSL_CA = loadCaCert();
// ── Build mysql2 pool options ─────────────────────────────────────────────────
function parseSslFromUrl(params) {
    const mode = (params.get('ssl-mode') || params.get('sslmode') || '').toLowerCase();
    const wantsSsl = ['required', 'verify_ca', 'verify_identity'].includes(mode);
    if (!DB_SSL && !wantsSsl)
        return undefined;
    return {
        rejectUnauthorized: DB_SSL_REJECT_UNAUTHORIZED,
        ...(DB_SSL_CA ? { ca: DB_SSL_CA } : {}),
    };
}
function getConnectionConfig(includeDatabase) {
    const base = {
        waitForConnections: true,
        connectionLimit: includeDatabase ? 10 : 2,
        connectTimeout: 20_000, // 20 s – generous for Railway cold starts
        enableKeepAlive: true,
        keepAliveInitialDelay: 10_000,
    };
    if (DATABASE_URL) {
        const parsed = new URL(DATABASE_URL);
        const dbName = parsed.pathname.replace(/^\//, '') || DB_NAME;
        return {
            ...base,
            host: parsed.hostname || DB_HOST,
            port: parsed.port ? parseInt(parsed.port, 10) : DB_PORT,
            user: decodeURIComponent(parsed.username || DB_USER),
            password: decodeURIComponent(parsed.password || DB_PASSWORD),
            database: includeDatabase ? dbName : undefined,
            ssl: parseSslFromUrl(parsed.searchParams),
        };
    }
    return {
        ...base,
        host: DB_HOST,
        port: DB_PORT,
        user: DB_USER,
        password: DB_PASSWORD,
        database: includeDatabase ? DB_NAME : undefined,
        ssl: DB_SSL ? { rejectUnauthorized: DB_SSL_REJECT_UNAUTHORIZED, ...(DB_SSL_CA ? { ca: DB_SSL_CA } : {}) } : undefined,
    };
}
function getDatabaseName() {
    if (DATABASE_URL) {
        const parsed = new URL(DATABASE_URL);
        return parsed.pathname.replace(/^\//, '') || DB_NAME;
    }
    return DB_NAME;
}
function escapeDbIdentifier(name) {
    return `\`${name.replace(/`/g, '``')}\``;
}
// ── Lazy-initialised pool ─────────────────────────────────────────────────────
// Creating the pool at module load would fail if the DB doesn't exist yet.
// Instead we create it on first use, after initDatabase() has run.
let _pool;
export function getPool() {
    if (!_pool) {
        _pool = mysql.createPool(getConnectionConfig(true));
    }
    return _pool;
}
// ── Query helpers ─────────────────────────────────────────────────────────────
export async function query(sql, params) {
    const [rows] = await getPool().query(sql, params ?? []);
    return rows;
}
export async function run(sql, params) {
    const [result] = (await getPool().query(sql, params ?? []));
    return { insertId: result.insertId, affectedRows: result.affectedRows };
}
export async function get(sql, params) {
    const rows = await query(sql, params);
    return rows[0];
}
// ── Table definitions ─────────────────────────────────────────────────────────
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    ];
    for (const stmt of stmts) {
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                await p.execute(stmt);
                break;
            }
            catch (err) {
                if (err.code === 'ECONNRESET' && attempt < 3) {
                    console.warn(`⚠️  ECONNRESET during initTables (attempt ${attempt}/3), retrying…`);
                    await new Promise(r => setTimeout(r, 1000 * attempt));
                    continue;
                }
                throw err;
            }
        }
    }
    // One-off migrations (safe to run repeatedly)
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
        `ALTER TABLE blog_posts ADD COLUMN video_duration INT DEFAULT NULL`,
    ];
    for (const sql of migrations) {
        try {
            await p.execute(sql);
        }
        catch { /* already applied */ }
    }
    console.log('✅ All MySQL tables ready');
}
// ── Seed helpers ──────────────────────────────────────────────────────────────
async function seedDefaultAccounts() {
    const bcrypt = (await import('bcryptjs')).default;
    // Seed passwords read from env vars — never hardcoded.
    // Set SEED_ADMIN_PASSWORD, SEED_COACH_PASSWORD, SEED_USER_PASSWORD in .env
    // or they fall back to safe random-looking defaults (change them!).
    const adminPw = process.env.SEED_ADMIN_PASSWORD || 'AdminPass!2025';
    const coachPw = process.env.SEED_COACH_PASSWORD || 'CoachPass!2025';
    const userPw = process.env.SEED_USER_PASSWORD || 'UserPass!2025';
    const accounts = [
        { email: process.env.SEED_COACH_EMAIL || 'petercoach@example.com', name: 'Peter Coach', role: 'coach', points: 1000, steps: 12000, pw: coachPw },
        { email: process.env.SEED_ADMIN_EMAIL || 'peteradmin@example.com', name: 'Peter Admin', role: 'admin', points: 9999, steps: 0, pw: adminPw },
        { email: process.env.SEED_USER_EMAIL || 'test@example.com', name: 'Test User', role: 'user', points: 500, steps: 8000, pw: userPw },
    ];
    for (const acc of accounts) {
        const existing = await get('SELECT id, role FROM users WHERE email = ?', [acc.email]);
        if (!existing) {
            const hash = await bcrypt.hash(acc.pw, 10);
            const avatar = null; // frontend assigns a real face photo placeholder
            await run('INSERT INTO users (email, password, name, role, avatar, is_premium, membership_paid, points, steps) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [acc.email, hash, acc.name, acc.role, avatar,
                acc.role === 'user' ? 1 : 0,
                acc.role !== 'user' ? 1 : 0,
                acc.points, acc.steps]);
            console.log(`✅ Created ${acc.role}: ${acc.email} / ${acc.pw}`);
        }
        else if (existing.role !== acc.role) {
            // Account exists but has wrong role — fix it (e.g. admin registered as user)
            await run('UPDATE users SET role = ?, membership_paid = 1 WHERE id = ?', [acc.role, existing.id]);
            console.log(`✅ Fixed role for ${acc.email}: ${existing.role} → ${acc.role}`);
        }
    }
}
async function seedDefaultWebsiteSections() {
    // Use INSERT IGNORE per section label+page so re-runs are safe and new pages always get seeded
    const sections = [
        // ── HOME ─────────────────────────────────────────────────────────────────
        { page: 'home', type: 'hero', label: 'Hero Section', sort_order: 1, content: JSON.stringify({ badge: '#1 DIGITAL FITNESS ECOSYSTEM IN EGYPT', heading: 'Transform Your Body.', headingAccent: 'Empower Your Mind.', subheading: 'Join Fitway Hub — accessible, certified, human-driven fitness.', primaryBtnText: 'Start Free Today', primaryBtnLink: '/auth/register', secondaryBtnText: 'Learn More', secondaryBtnLink: '/about', backgroundImage: '' }) },
        { page: 'home', type: 'stats', label: 'Stats Bar', sort_order: 2, content: JSON.stringify({ items: [{ value: '12K+', label: 'Active Members' }, { value: '50+', label: 'Programs' }, { value: '4.9★', label: 'App Rating' }, { value: '98%', label: 'Satisfaction' }] }) },
        { page: 'home', type: 'features', label: 'Features Grid', sort_order: 3, content: JSON.stringify({ sectionLabel: 'Why Fitway', heading: 'Everything you need to win', items: [{ icon: 'Dumbbell', title: '50+ Workout Programs', desc: 'Certified and structured for all levels.' }, { icon: 'Users', title: 'Certified Human Coaches', desc: 'Real certified coaches build personalised plans tailored to your goals.' }, { icon: 'BarChart', title: 'Smart Analytics', desc: 'Track steps, calories, and trends.' }, { icon: 'Users', title: 'Community & Challenges', desc: 'Stay accountable with thousands of members.' }] }) },
        { page: 'home', type: 'cta', label: 'Bottom CTA', sort_order: 99, content: JSON.stringify({ badge: 'JOIN 12,000+ MEMBERS', heading: 'Your best shape starts today.', subheading: 'Free to join. No credit card required.', btnText: 'Create Free Account', btnLink: '/auth/register' }) },
        // ── ABOUT ────────────────────────────────────────────────────────────────
        { page: 'about', type: 'hero', label: 'About Hero', sort_order: 1, content: JSON.stringify({ badge: 'Our Story', heading: 'About Fitway Hub', headingAccent: "Egypt's #1 Fitness Platform", subheading: "We're on a mission to make world-class fitness coaching accessible to every Egyptian, anywhere, at any time.", primaryBtnText: 'Join Us Today', primaryBtnLink: '/auth/register', secondaryBtnText: 'Meet Our Coaches', secondaryBtnLink: '/coaches', backgroundImage: '' }) },
        { page: 'about', type: 'text_image', label: 'Our Mission', sort_order: 2, content: JSON.stringify({ badge: 'OUR MISSION', heading: 'Fitness for Everyone', body: "Fitway Hub was founded with one belief: everyone deserves access to expert fitness guidance. We bridge the gap between certified coaches and people who want to change their lives — regardless of budget, location, or experience level.\n\nFrom certified coach-built workout plans to real-time coaching sessions, every feature we build is designed to move you closer to your goal.", imageUrl: '', imageAlt: 'Our Mission', imagePosition: 'right' }) },
        { page: 'about', type: 'stats', label: 'About Stats', sort_order: 3, content: JSON.stringify({ items: [{ value: '12,000+', label: 'Active Members' }, { value: '50+', label: 'Certified Coaches' }, { value: '200+', label: 'Workout Programs' }, { value: '3', label: 'Years Running' }] }) },
        { page: 'about', type: 'features', label: 'What We Offer', sort_order: 4, content: JSON.stringify({ sectionLabel: 'PLATFORM FEATURES', heading: 'Everything in one place', items: [{ icon: 'Dumbbell', title: 'Certified Workouts', desc: 'Programs built and reviewed by certified coaches for all fitness levels.' }, { icon: 'Target', title: 'Personalised Plans', desc: 'Tailored plans from real certified coaches that adapt to your progress and lifestyle.' }, { icon: 'BarChart', title: 'Progress Analytics', desc: 'Visual dashboards track every step, calorie, and milestone.' }, { icon: 'Users', title: 'Live Coaching', desc: 'Book 1-on-1 sessions and get personalised nutrition and workout plans.' }, { icon: 'Bell', title: 'Smart Reminders', desc: 'Push notifications keep you on track without being annoying.' }, { icon: 'Globe', title: 'Arabic & English', desc: 'Fully bilingual — every screen available in English and Arabic.' }] }) },
        { page: 'about', type: 'team', label: 'Our Team', sort_order: 5, content: JSON.stringify({ sectionLabel: 'THE TEAM', heading: 'Built by fitness lovers', members: [{ name: 'Ahmed Hassan', role: 'CEO & Co-Founder', bio: 'Former national athlete turned tech entrepreneur. 10+ years in fitness.', imageUrl: '' }, { name: 'Sara Mostafa', role: 'Head of Coaching', bio: 'Certified personal trainer and nutritionist with 200+ coached clients.', imageUrl: '' }, { name: 'Omar Khalid', role: 'CTO', bio: 'Full-stack engineer passionate about building products that matter.', imageUrl: '' }] }) },
        { page: 'about', type: 'cta', label: 'About CTA', sort_order: 99, content: JSON.stringify({ badge: 'JOIN THE COMMUNITY', heading: 'Ready to start your journey?', subheading: 'Join 12,000+ members already transforming their lives with Fitway Hub.', btnText: 'Create Free Account', btnLink: '/auth/register' }) },
        // ── CONTACT ──────────────────────────────────────────────────────────────
        { page: 'contact', type: 'hero', label: 'Contact Hero', sort_order: 1, content: JSON.stringify({ badge: 'GET IN TOUCH', heading: 'We\'d love to hear from you', headingAccent: '', subheading: 'Have a question, feedback, or want to partner with us? Reach out and our team will respond within 24 hours.', backgroundImage: '' }) },
        { page: 'contact', type: 'contact_info', label: 'Contact Details', sort_order: 2, content: JSON.stringify({ phone: '+20 123 456 7890', email: 'support@fitwayhub.com', chatHours: '9am – 6pm Cairo Time', faqs: [{ q: 'How do I subscribe to a coach?', a: 'Go to the Coaching tab, browse certified coaches, and tap Subscribe on any coach profile.' }, { q: 'Can I cancel my premium subscription?', a: 'Yes, you can cancel anytime from your Profile → Settings. No hidden fees.' }, { q: 'Is my payment information secure?', a: 'All payments are processed through Paymob or PayPal — we never store card details.' }, { q: 'How do I become a coach on Fitway?', a: 'Register as a coach, complete your profile, and submit your certification for admin review.' }] }) },
    ];
    for (const s of sections) {
        try {
            // INSERT IGNORE based on unique (page, label) pair — safe to re-run
            const exists = await get('SELECT id FROM website_sections WHERE page = ? AND label = ?', [s.page, s.label]);
            if (!exists) {
                await run('INSERT INTO website_sections (page, type, label, content, sort_order, is_visible) VALUES (?,?,?,?,?,1)', [s.page, s.type, s.label, s.content, s.sort_order]);
            }
            else {
                // Always ensure home sections are visible — fix accidental hidden state
                if (s.page === 'home') {
                    await run('UPDATE website_sections SET is_visible = 1 WHERE page = ? AND label = ?', [s.page, s.label]);
                }
            }
        }
        catch { /* skip on error */ }
    }
    console.log('✅ Default website sections seeded');
}
export async function seedDefaultAppSettings() {
    const defaults = [
        ['app_name', 'FitWay Hub', 'text', 'branding', 'App Name'],
        ['app_tagline', 'Your fitness journey starts here', 'text', 'branding', 'Tagline'],
        ['logo_url_en_light', '', 'image', 'branding', 'English Logo (Light Mode)'],
        ['logo_url_en_dark', '', 'image', 'branding', 'English Logo (Dark Mode)'],
        ['logo_url_ar_light', '', 'image', 'branding', 'Arabic Logo (Light Mode)'],
        ['logo_url_ar_dark', '', 'image', 'branding', 'Arabic Logo (Dark Mode)'],
        ['favicon_url', '', 'image', 'branding', 'Favicon'],
        ['footer_text', "Egypt's #1 digital fitness ecosystem.", 'text', 'branding', 'Footer Description'],
        ['copyright_text', '© 2025 FitWay Hub. All rights reserved.', 'text', 'branding', 'Copyright Text'],
        ['social_instagram', '', 'text', 'branding', 'Instagram URL'],
        ['social_facebook', '', 'text', 'branding', 'Facebook URL'],
        ['social_twitter', '', 'text', 'branding', 'Twitter / X URL'],
        ['social_youtube', '', 'text', 'branding', 'YouTube URL'],
        ['primary_color', '#7C6EFA', 'color', 'branding', 'Primary Color (Main)'],
        ['secondary_color', '#FF7A6E', 'color', 'branding', 'Secondary Color'],
        ['bg_primary', '#0F0F14', 'color', 'branding', 'Background Primary'],
        ['bg_card', '#1C1C26', 'color', 'branding', 'Card Background'],
        ['btn_hover_type', 'glow', 'text', 'branding', 'Button Hover Effect Type'],
        ['btn_hover_color', '', 'color', 'branding', 'Button Hover Glow Color'],
        ['font_en', 'Plus Jakarta Sans', 'font', 'branding', 'English Font'],
        ['font_ar', 'Cairo', 'font', 'branding', 'Arabic Font'],
        ['font_heading', 'Plus Jakarta Sans', 'font', 'branding', 'Heading Font'],
        ['coming_soon_enabled', '0', 'boolean', 'branding', 'Coming Soon Mode'],
        ['coming_soon_bg_image', '', 'image', 'branding', 'Coming Soon Background'],
        ['max_video_upload_size_mb', '40', 'number', 'access', 'Max Video Upload Size (MB)'],
        ['free_user_max_videos', '3', 'number', 'access', 'Free Videos Limit'],
        ['coach_membership_fee_egp', '500', 'number', 'pricing', 'Coach Monthly Fee (EGP)'],
        ['coach_membership_fee_usd', '29.99', 'number', 'pricing', 'Coach Monthly Fee (USD, IAP)'],
        ['coach_membership_cycle', 'monthly', 'text', 'pricing', 'Coach Membership Cycle'],
        ['user_premium_fee_usd', '9.99', 'number', 'pricing', 'User Premium Monthly (USD, IAP)'],
        ['registration_points_gift', '200', 'number', 'points', 'Registration Bonus Points'],
        ['video_watch_points', '2', 'number', 'points', 'Points per Video Watch'],
        ['goal_complete_points', '2', 'number', 'points', 'Points per Goal Completed'],
        ['certified_coach_fee', '500', 'number', 'pricing', 'Certified Coach Monthly Fee (EGP)'],
        ['feature_user_workouts', '1', 'boolean', 'features', 'User: Workouts'],
        ['feature_user_workout_plan', '1', 'boolean', 'features', 'User: Workout Plan'],
        ['feature_user_nutrition_plan', '1', 'boolean', 'features', 'User: Nutrition Plan'],
        ['feature_user_steps', '1', 'boolean', 'features', 'User: Steps'],
        ['feature_user_community', '1', 'boolean', 'features', 'User: Community'],
        ['feature_user_chat', '1', 'boolean', 'features', 'User: Chat'],
        ['feature_user_coaching', '1', 'boolean', 'features', 'User: Coaching'],
        ['feature_user_tools', '1', 'boolean', 'features', 'User: Tools'],
        ['feature_user_analytics', '1', 'boolean', 'features', 'User: Analytics'],
        ['feature_user_plans', '1', 'boolean', 'features', 'User: Plans'],
        ['feature_user_blogs', '1', 'boolean', 'features', 'User: Blogs'],
        ['feature_user_notifications', '1', 'boolean', 'features', 'User: Notifications'],
        ['feature_coach_requests', '1', 'boolean', 'features', 'Coach: Requests'],
        ['feature_coach_athletes', '1', 'boolean', 'features', 'Coach: Athletes'],
        ['feature_coach_chat', '1', 'boolean', 'features', 'Coach: Chat'],
        ['feature_coach_ads', '1', 'boolean', 'features', 'Coach: Ads'],
        ['feature_coach_blogs', '1', 'boolean', 'features', 'Coach: Blogs'],
        ['feature_coach_community', '1', 'boolean', 'features', 'Coach: Community'],
        ['feature_coach_workouts', '1', 'boolean', 'features', 'Coach: Workouts'],
        ['feature_coach_notifications', '1', 'boolean', 'features', 'Coach: Notifications'],
        // Dashboard layout settings
        ['dash_greeting_visible', '1', 'boolean', 'dashboard', 'Show Greeting'],
        ['dash_hero_visible', '1', 'boolean', 'dashboard', 'Show Hero Banner'],
        ['dash_hero_image', '', 'url', 'dashboard', 'Hero Banner Image'],
        ['dash_hero_title', 'Ready to crush your goals?', 'text', 'dashboard', 'Hero Banner Title'],
        ['dash_hero_subtitle', 'Track your progress and stay motivated', 'text', 'dashboard', 'Hero Banner Subtitle'],
        ['dash_hero_cta_text', 'Start Workout', 'text', 'dashboard', 'Hero CTA Button Text'],
        ['dash_hero_cta_link', '/app/workouts', 'text', 'dashboard', 'Hero CTA Button Link'],
        ['dash_stats_visible', '1', 'boolean', 'dashboard', 'Show Stats Row'],
        ['dash_quick_actions_visible', '1', 'boolean', 'dashboard', 'Show Quick Actions'],
        ['dash_analytics_visible', '1', 'boolean', 'dashboard', 'Show Analytics Snapshot'],
        ['dash_analytics_title', 'Analytics Snapshot', 'text', 'dashboard', 'Analytics Section Title'],
        ['dash_featured_visible', '1', 'boolean', 'dashboard', 'Show Featured Card'],
        ['dash_featured_image', '', 'url', 'dashboard', 'Featured Card Image'],
        ['dash_featured_title', 'Featured Workout', 'text', 'dashboard', 'Featured Card Title'],
        ['dash_featured_subtitle', 'Try today\'s recommended routine', 'text', 'dashboard', 'Featured Card Subtitle'],
        ['dash_featured_link', '/app/workouts', 'text', 'dashboard', 'Featured Card Link'],
        ['dash_videos_visible', '1', 'boolean', 'dashboard', 'Show Videos Section'],
        ['dash_videos_title', 'Workouts', 'text', 'dashboard', 'Videos Section Title'],
        ['dash_coaches_visible', '1', 'boolean', 'dashboard', 'Show Coaches Section'],
        ['dash_coaches_title', 'Top Coaches', 'text', 'dashboard', 'Coaches Section Title'],
        ['dash_blogs_visible', '1', 'boolean', 'dashboard', 'Show Blogs Section'],
        ['dash_blogs_title', 'Latest Articles', 'text', 'dashboard', 'Blogs Section Title'],
        ['dash_ads_visible', '1', 'boolean', 'dashboard', 'Show Sponsored Ads'],
    ];
    const batchSize = 10;
    for (let i = 0; i < defaults.length; i += batchSize) {
        const batch = defaults.slice(i, i + batchSize);
        const placeholders = batch.map(() => '(?,?,?,?,?)').join(',');
        const params = batch.flat();
        await getPool().execute(`INSERT IGNORE INTO app_settings (setting_key, setting_value, setting_type, category, label) VALUES ${placeholders}`, params);
    }
}
// ── Bootstrap ─────────────────────────────────────────────────────────────────
// ── Seed the 30 standard push notification templates ─────────────────────────
async function seedStandardTemplates() {
    const templates = [
        { slug: 'user_register', title: 'Welcome to Fitway Hub! 💪', body: 'Your fitness journey starts today. Set up your profile and build your first workout plan.', category: 'new_user', trigger_type: 'user_registers', purpose: 'onboarding' },
        { slug: 'coach_register', title: 'Welcome Coach! Athletes are waiting.', body: 'Complete your profile and start connecting with athletes who need your expertise.', category: 'new_coach', trigger_type: 'coach_registers', purpose: 'coach_onboarding' },
        { slug: 'profile_complete', title: 'Your profile is ready! 🎯', body: 'Great work! Now let\'s build your first workout plan and get started.', category: 'new_user', trigger_type: 'user_completes_profile', purpose: 'activation' },
        { slug: 'workout_plan_assigned', title: 'New workout plan assigned! 🏋️', body: 'Your coach assigned a new workout plan. Open the app to start training.', category: 'engagement', trigger_type: 'workout_plan_assigned', purpose: 'engagement' },
        { slug: 'workout_day_reminder', title: "Today is a workout day! 💪", body: "Let\'s get moving! Your workout is ready and waiting for you.", category: 'engagement', trigger_type: 'workout_day_reminder', purpose: 'habit_building' },
        { slug: 'inactive_1_day', title: 'You missed yesterday\'s workout.', body: "Ready to get back? Your progress is waiting — even a quick session counts.", category: 'inactivity', trigger_type: 'user_inactive_1_day', purpose: 'retention' },
        { slug: 'inactive_3_days', title: 'Your progress is waiting. 📈', body: 'Jump back into training today. 3 days away is nothing — let\'s restart strong.', category: 'inactivity', trigger_type: 'user_inactive_3_days', purpose: 're_engagement' },
        { slug: 'inactive_7_days', title: 'We miss you! 👋', body: 'Your fitness journey is still here. Come back and keep moving forward.', category: 'inactivity', trigger_type: 'user_inactive_7_days', purpose: 'win_back' },
        { slug: 'workout_completed', title: 'Great job! Workout complete. ✅', body: 'Another session done. Keep the momentum going — your next workout is already lined up.', category: 'engagement', trigger_type: 'workout_completed', purpose: 'positive_reinforcement' },
        { slug: 'streak_3_days', title: '🔥 3-day streak!', body: 'Keep pushing your limits. Three days straight — you\'re building something great.', category: 'streak', trigger_type: 'streak_3_days', purpose: 'motivation' },
        { slug: 'streak_7_days', title: '7-day streak! Real habit forming. 🏆', body: 'Seven days in a row! You\'re building a real fitness habit. Keep it up.', category: 'streak', trigger_type: 'streak_7_days', purpose: 'habit_reinforcement' },
        { slug: 'coach_message', title: 'Your coach sent you a message. 💬', body: 'Check your messages now and stay on track with your coach\'s guidance.', category: 'engagement', trigger_type: 'coach_sends_message', purpose: 'communication' },
        { slug: 'new_workout_unlocked', title: 'New workout available today! 🆕', body: 'A new workout has been unlocked. Ready to try something new?', category: 'engagement', trigger_type: 'new_workout_unlocked', purpose: 'engagement' },
        { slug: 'progress_milestone', title: 'Progress alert! 📊', body: "You\'re getting stronger every week. Open the app to see your latest stats.", category: 'engagement', trigger_type: 'progress_milestone', purpose: 'retention' },
        { slug: 'goal_achieved', title: 'Goal achieved! 🎉', body: 'You hit your goal! Celebrate the win and set your next challenge.', category: 'engagement', trigger_type: 'goal_achieved', purpose: 'achievement' },
        { slug: 'weight_logged', title: 'Progress logged! 📝', body: 'Great job tracking your progress. Consistency is the key to real results.', category: 'engagement', trigger_type: 'weight_logged', purpose: 'habit_reinforcement' },
        { slug: 'meal_plan_updated', title: 'Nutrition plan updated! 🥗', body: 'Your coach updated your nutrition plan. Check it now and fuel your training right.', category: 'engagement', trigger_type: 'meal_plan_updated', purpose: 'engagement' },
        { slug: 'new_challenge', title: 'New fitness challenge! 🏅', body: 'A new challenge just started. Join now and compete with the community.', category: 'engagement', trigger_type: 'new_challenge_available', purpose: 'community_engagement' },
        { slug: 'streak_about_to_break', title: 'Your streak is about to break! ⚠️', body: 'One quick workout keeps your streak alive. Don\'t let it end now!', category: 'streak', trigger_type: 'user_near_streak_break', purpose: 'urgency' },
        { slug: 'new_exercise_added', title: 'New exercises added to your program! 💪', body: 'Your coach added new exercises. Open the app to check your updated plan.', category: 'engagement', trigger_type: 'coach_assigns_exercise', purpose: 'engagement' },
        { slug: 'morning_reminder', title: 'Good morning! ☀️', body: 'A quick workout will boost your energy and focus for the whole day.', category: 'engagement', trigger_type: 'morning_reminder', purpose: 'daily_activation' },
        { slug: 'evening_reminder', title: 'Still time for today\'s workout! 🌙', body: "The day isn\'t over yet. A short session now keeps your streak alive.", category: 'engagement', trigger_type: 'evening_reminder', purpose: 'recovery_engagement' },
        { slug: 'personal_best', title: 'New personal best! 🚀', body: "You broke your own record. Can you beat it again tomorrow?", category: 'streak', trigger_type: 'user_improves_record', purpose: 'motivation' },
        { slug: 'friend_joined', title: 'Your friend joined Fitway Hub! 👥', body: 'Train together and push each other to new limits.', category: 'engagement', trigger_type: 'friend_joins_platform', purpose: 'social_engagement' },
        { slug: 'challenge_completed', title: 'Challenge completed! 🏆', body: 'Amazing work finishing the challenge. Your dedication is showing real results.', category: 'engagement', trigger_type: 'challenge_completed', purpose: 'reward_reinforcement' },
        { slug: 'new_feature', title: 'New feature in Fitway Hub! ✨', body: 'We just launched something new. Open the app and check it out.', category: 'promo', trigger_type: 'app_feature_announcement', purpose: 'product_awareness' },
        { slug: 'monthly_summary', title: 'Your monthly progress report is ready! 📅', body: 'Open the app to see how far you\'ve come this month.', category: 'engagement', trigger_type: 'monthly_progress_summary', purpose: 'retention' },
        { slug: 'coach_review', title: 'Your coach reviewed your performance. 👀', body: 'Your coach left feedback on your recent workouts. Check it now.', category: 'coach_tip', trigger_type: 'coach_review_posted', purpose: 'engagement' },
        { slug: 'program_completed', title: 'Program completed! 🎓', body: 'You finished the full program. Ready to level up to the next challenge?', category: 'engagement', trigger_type: 'program_completed', purpose: 'retention' },
        { slug: 'inactive_14_days', title: "It\'s never too late to restart. 💙", body: 'Your fitness journey is still here. Come back — even one session makes a difference.', category: 'inactivity', trigger_type: 'user_inactive_14_days', purpose: 'win_back' },
        // ── Event-triggered templates ────────────────────────────────────────────
        { slug: 'new_message', title: '💬 New message from {{name}}', body: 'You have a new message. Open the app to read and reply.', category: 'engagement', trigger_type: 'message_received', purpose: 'communication' },
        { slug: 'payment_approved', title: '✅ Payment Approved', body: 'Your e-wallet payment has been approved and your account is now activated.', category: 'payment', trigger_type: 'payment_approved', purpose: 'transaction' },
        { slug: 'payment_rejected', title: '❌ Payment Rejected', body: 'Your e-wallet payment was rejected. Please check the details or contact support.', category: 'payment', trigger_type: 'payment_rejected', purpose: 'transaction' },
        { slug: 'subscription_verified', title: '📋 New Subscription Request', body: 'A user paid and requested to subscribe to you. Please accept or decline from Requests.', category: 'subscription', trigger_type: 'subscription_verified_coach', purpose: 'coach_action' },
        { slug: 'subscription_verified_user', title: '✅ Payment Verified', body: 'Admin verified your payment. Waiting for coach acceptance.', category: 'subscription', trigger_type: 'subscription_verified_user', purpose: 'transaction' },
        { slug: 'subscription_rejected', title: '❌ Subscription Rejected', body: 'Your subscription payment was rejected by admin and marked for refund.', category: 'subscription', trigger_type: 'subscription_rejected', purpose: 'transaction' },
        { slug: 'subscription_coach_accepted', title: '🎉 Coach Accepted Your Subscription', body: 'Your coach accepted your subscription and your plan is now active!', category: 'subscription', trigger_type: 'subscription_coach_accepted', purpose: 'activation' },
        { slug: 'subscription_coach_declined', title: '😔 Coach Declined Subscription', body: 'Your coach declined the subscription request. A refund is being processed.', category: 'subscription', trigger_type: 'subscription_coach_declined', purpose: 'transaction' },
        { slug: 'booking_accepted', title: '🎉 Coaching Request Accepted!', body: 'Your coaching request has been accepted. Your coach will reach out soon.', category: 'coaching', trigger_type: 'booking_accepted', purpose: 'activation' },
        { slug: 'booking_rejected', title: '😔 Coaching Request Update', body: 'Your coaching request was reviewed. Please reach out for more info.', category: 'coaching', trigger_type: 'booking_rejected', purpose: 'engagement' },
        { slug: 'ad_approved', title: '✅ Campaign Approved: {{campaign_name}}', body: 'Your ad campaign is now live and reaching your target audience!', category: 'ads', trigger_type: 'ad_approved', purpose: 'coach_action' },
        { slug: 'ad_rejected', title: '❌ Campaign Rejected: {{campaign_name}}', body: 'Your campaign was rejected. Please review the notes and resubmit.', category: 'ads', trigger_type: 'ad_rejected', purpose: 'coach_action' },
        { slug: 'ad_flagged', title: '🚩 Campaign Flagged: {{campaign_name}}', body: 'Your campaign has been flagged for review and is currently paused.', category: 'ads', trigger_type: 'ad_flagged', purpose: 'coach_action' },
        { slug: 'ad_needs_changes', title: '⚠️ Campaign Needs Changes: {{campaign_name}}', body: 'Your campaign requires changes before it can go live. Please review the notes.', category: 'ads', trigger_type: 'ad_needs_changes', purpose: 'coach_action' },
        { slug: 'post_liked', title: '❤️ {{name}} liked your post', body: 'Someone liked what you shared! Keep inspiring the community.', category: 'community', trigger_type: 'post_liked', purpose: 'social_engagement' },
        { slug: 'post_commented', title: '💬 {{name}} commented on your post', body: 'You got a new comment! Open the app to read and reply.', category: 'community', trigger_type: 'post_commented', purpose: 'social_engagement' },
        { slug: 'new_follower', title: '👤 {{name}} started following you', body: 'You have a new follower! Keep sharing great content.', category: 'community', trigger_type: 'new_follower', purpose: 'social_engagement' },
    ];
    for (const t of templates) {
        await getPool().execute(`INSERT IGNORE INTO push_templates (slug, title, body, category, trigger_type, enabled)
       VALUES (?, ?, ?, ?, ?, 1)`, [t.slug, t.title, t.body, t.category, t.trigger_type]);
    }
    console.log('✅ Standard push templates seeded (30)');
}
async function seedDefaultBlogs() {
    // Get the first available coach/admin to be author
    const author = await get("SELECT id FROM users WHERE role IN ('coach','admin') ORDER BY id ASC LIMIT 1");
    if (!author)
        return; // No users yet — will run again on next restart
    // Fix orphaned blogs — find blogs whose author_id doesn't exist in users table
    try {
        const orphaned = await query('SELECT DISTINCT bp.author_id FROM blog_posts bp LEFT JOIN users u ON u.id = bp.author_id WHERE u.id IS NULL');
        if (orphaned.length > 0) {
            await run('UPDATE blog_posts SET author_id = ? WHERE author_id NOT IN (SELECT id FROM users)', [author.id]);
        }
    }
    catch { /* non-fatal */ }
    // Count valid EN blogs
    const existing = await get('SELECT COUNT(*) as cnt FROM blog_posts WHERE language = ?', ['en']);
    if (existing?.cnt >= 10)
        return; // Already seeded
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const BLOGS = [
        { title: '10 Science-Backed Ways to Burn Fat Faster', title_ar: '١٠ طرق علمية لحرق الدهون بشكل أسرع', slug: '10-ways-burn-fat-faster', excerpt: 'Discover the most effective, research-proven strategies to accelerate fat loss without sacrificing muscle.', excerpt_ar: 'اكتشف أكثر الاستراتيجيات فعالية والمدعومة بالأبحاث لتسريع فقدان الدهون دون التضحية بالعضلات.', content: `## The Science of Fat Loss\n\n### 1. Prioritize Protein\nEat 1.6–2.2g of protein per kg of bodyweight. Burns up to 30% of its calories during digestion.\n\n### 2. Strength Train 3–4x Per Week\nBuilds muscle, raising your resting metabolic rate.\n\n### 3. Sleep 7–9 Hours\nPoor sleep raises cortisol and hunger hormones by up to 24%.\n\n### 4. Time-Restricted Eating\nEating in an 8–10 hour window improves insulin sensitivity.\n\n### 5. Walk 8,000–10,000 Steps Daily\nNon-exercise activity accounts for 15–30% of energy expenditure.\n\n### 6. Avoid Liquid Calories\nSodas and juices add hundreds of calories without satiety.\n\n### 7. Manage Stress\nChronic stress promotes fat storage around the abdomen.\n\n### 8. Stay Hydrated\nDrinking 500ml before meals reduces caloric intake by 13%.\n\n### 9. Track Your Food\nTrackers lose 2–3x more weight than those who don't.\n\n### 10. Be Consistent Over Perfect\nConsistency beats perfection every single time.`, content_ar: `## علم فقدان الدهون\n\n### ١. أعطِ الأولوية للبروتين\nتناول 1.6–2.2 غ لكل كغ من وزنك. تحرق الأطعمة الغنية بالبروتين حتى 30% من سعراتها أثناء الهضم.\n\n### ٢. تمارين القوة 3–4 مرات أسبوعياً\nتبني العضلات وترفع معدل الحرق أثناء الراحة.\n\n### ٣. نم 7–9 ساعات\nقلة النوم ترفع الكورتيزول وهرمونات الجوع بنسبة تصل إلى 24%.\n\n### ٤. الأكل في نافذة زمنية محددة\nالأكل في 8–10 ساعات يحسّن حساسية الإنسولين.\n\n### ٥. امشِ 8,000–10,000 خطوة يومياً\nالنشاط اليومي يشكل 15–30% من إجمالي إنفاق الطاقة.\n\n### ٦. تجنب السعرات السائلة\nالمشروبات الغازية تضيف مئات السعرات دون إشباع.\n\n### ٧. أدِر التوتر\nالتوتر المزمن يعزز تخزين الدهون حول البطن.\n\n### ٨. اشرب الماء الكافي\nشرب 500 مل قبل الوجبات يقلل السعرات 13%.\n\n### ٩. تتبع طعامك\nمن يتتبعون طعامهم يخسرون 2–3 أضعاف ممن لا يفعلون.\n\n### ١٠. الاستمرارية فوق الكمال\nالاستمرارية تتفوق دائماً على الكمال.` },
        { title: "The Complete Beginner's Guide to Building Muscle", title_ar: 'الدليل الشامل للمبتدئين لبناء العضلات', slug: 'beginners-guide-building-muscle', excerpt: 'Everything you need to know to start gaining lean muscle mass.', excerpt_ar: 'كل ما تحتاج معرفته لبدء اكتساب الكتلة العضلية.', content: `## Building Muscle: The Fundamentals\n\nThree pillars: **Progressive Overload**, **Sufficient Protein**, **Recovery**.\n\n### Training Split\n- Monday: Push (Chest, Shoulders, Triceps)\n- Wednesday: Pull (Back, Biceps)\n- Friday: Legs\n\n### Key Exercises\nSquat, Deadlift, Bench Press, Pull-Up, Overhead Press.\n\n### Nutrition\nEat at a 200–300 calorie surplus. 1.8–2.2g protein/kg bodyweight.\n\n### Recovery\nMuscles grow outside the gym. Sleep 7–9 hours.`, content_ar: `## بناء العضلات: الأساسيات\n\nثلاثة أعمدة: **التحميل التدريجي**، **البروتين الكافي**، **التعافي**.\n\n### برنامج التدريب\n- الاثنين: الدفع (الصدر، الأكتاف، ثلاثية الرؤوس)\n- الأربعاء: السحب (الظهر، ثنائية الرؤوس)\n- الجمعة: الأرجل\n\n### التمارين الأساسية\nالقرفصاء، الرفعة الميتة، ضغط المقعد، العقلة، الضغط فوق الرأس.\n\n### التغذية\nتناول فائضاً 200–300 سعرة. 1.8–2.2 غ بروتين/كغ.\n\n### التعافي\nتنمو العضلات خارج الصالة. نم 7–9 ساعات.` },
        { title: 'How to Run Your First 5K in 8 Weeks', title_ar: 'كيف تجري أول 5 كيلومتر في 8 أسابيع', slug: 'run-first-5k-8-weeks', excerpt: 'A complete couch-to-5K plan for absolute beginners.', excerpt_ar: 'برنامج كامل من الأريكة إلى 5 كم للمبتدئين.', content: `## Couch to 5K: 8-Week Plan\n\n**Week 1–2:** 1 min run, 2 min walk × 8 rounds, 3x/week.\n**Week 3–4:** 2 min run, 1 min walk × 8 rounds.\n**Week 5–6:** 20-minute continuous jog.\n**Week 7–8:** 25–30 minute continuous run.\n\n### Race Day Tips\n- Eat light 2 hours before\n- Start slower than you think\n- Celebrate finishing — time doesn't matter`, content_ar: `## من الأريكة إلى 5 كم: 8 أسابيع\n\n**الأسبوع ١–٢:** 1 دقيقة جري، 2 دقيقة مشي × 8، 3 مرات أسبوعياً.\n**الأسبوع ٣–٤:** 2 دقيقة جري، 1 دقيقة مشي × 8.\n**الأسبوع ٥–٦:** 20 دقيقة جري متواصل.\n**الأسبوع ٧–٨:** 25–30 دقيقة جري متواصل.\n\n### نصائح يوم السباق\n- وجبة خفيفة قبل ساعتين\n- ابدأ بوتيرة أبطأ\n- احتفل بالإتمام — الوقت لا يهم` },
        { title: 'The Truth About Intermittent Fasting', title_ar: 'الحقيقة حول الصيام المتقطع', slug: 'truth-about-intermittent-fasting', excerpt: 'Does intermittent fasting actually work? We break down the science.', excerpt_ar: 'هل يعمل الصيام المتقطع فعلاً؟ نستعرض الأدلة العلمية.', content: `## Intermittent Fasting: The Science\n\nIF is a calorie restriction tool. Studies show no significant difference vs continuous restriction when calories match.\n\n### Popular Protocols\n- 16:8 — Fast 16h, eat in 8h window\n- 5:2 — Normal 5 days, 500 cal on 2 days\n\n### Who Benefits\n- People not hungry in the morning\n- Those who overeat in the evening\n\n### Bottom Line\nIF works when it helps maintain a caloric deficit. It's a scheduling tool, not magic.`, content_ar: `## الصيام المتقطع: العلم\n\nالصيام المتقطع أداة لتقليل السعرات. الدراسات لا تُظهر فرقاً يُذكر مقارنة بالتقليل المستمر عند تساوي السعرات.\n\n### البروتوكولات الشائعة\n- 16:8 — صيام 16 ساعة، أكل في نافذة 8 ساعات\n- 5:2 — طبيعي 5 أيام، 500 سعرة يومين\n\n### من يستفيد\n- من لا يشعر بالجوع صباحاً\n- من يفرط في الأكل مساءً\n\n### الخلاصة\nيعمل عندما يساعد على الحفاظ على عجز في السعرات. إنه أداة جدولة وليس سحراً.` },
        { title: '5 Yoga Poses for Desk Workers', title_ar: '٥ وضعيات يوغا لعمال المكاتب', slug: 'yoga-poses-desk-workers', excerpt: 'Five poses that undo the damage of sitting all day.', excerpt_ar: 'خمس وضعيات لإلغاء تأثيرات الجلوس طوال اليوم.', content: `## Essential Yoga for Desk Workers\n\n1. **Cat-Cow** — spine mobility, 10 reps\n2. **Hip Flexor Lunge** — hold 30–60 sec each side\n3. **Doorframe Chest Opener** — hold 30 seconds\n4. **Seated Spinal Twist** — 30 seconds each side\n5. **Legs Up the Wall** — 5–10 minutes`, content_ar: `## اليوغا الأساسية لعمال المكاتب\n\n١. **القطة-البقرة** — مرونة العمود الفقري، 10 تكرارات\n٢. **تمدد الورك المائل** — 30–60 ثانية لكل جانب\n٣. **فتح الصدر على الباب** — 30 ثانية\n٤. **الالتواء الفقري الجالس** — 30 ثانية لكل جانب\n٥. **الأرجل على الحائط** — 5–10 دقائق` },
        { title: 'Creatine: The Most Researched Supplement', title_ar: 'الكرياتين: المكمل الأكثر دراسة', slug: 'creatine-complete-guide', excerpt: "Creatine is safe, effective, and backed by decades of research.", excerpt_ar: 'الكرياتين آمن وفعّال ومدعوم بعقود من الأبحاث.', content: `## Creatine: Evidence-Based Guide\n\n### Benefits\n- 5–15% increase in strength\n- More lean muscle mass\n- Faster set recovery\n\n### Dosing\n- Loading (optional): 20g/day × 7 days\n- Maintenance: 3–5g daily\n\n### Safety\nDecades of research confirm safety for healthy individuals.\n\n### Which Form?\nCreatine monohydrate. No need for expensive variants.`, content_ar: `## الكرياتين: دليل علمي\n\n### الفوائد\n- زيادة 5–15% في القوة\n- كتلة عضلية أكبر\n- تعافٍ أسرع بين المجموعات\n\n### الجرعة\n- التحميل (اختياري): 20 غ/يوم × 7 أيام\n- الصيانة: 3–5 غ يومياً\n\n### السلامة\nعقود من الأبحاث تؤكد السلامة للأصحاء.\n\n### أي شكل؟\nكرياتين أحادي الهيدرات. لا حاجة للأشكال المكلفة.` },
        { title: 'How to Build a Home Gym on a Budget', title_ar: 'كيف تبني صالة رياضية منزلية بميزانية محدودة', slug: 'home-gym-on-a-budget', excerpt: "Build an effective home gym with minimal investment.", excerpt_ar: 'ابنِ صالة رياضية منزلية فعالة باستثمار بسيط.', content: `## Home Gym on a Budget\n\n1. **Resistance Bands** — most versatile\n2. **Pull-Up Bar** — back and upper body\n3. **Jump Rope** — cardio in small spaces\n4. **Yoga Mat** — floor exercises\n5. **Bodyweight exercises** — zero equipment needed\n\nYouTube has thousands of free guided workouts.`, content_ar: `## صالة رياضية منزلية بميزانية محدودة\n\n١. **حزام المقاومة** — الأكثر تنوعاً\n٢. **بار العقلة** — الظهر والجزء العلوي\n٣. **حبل القفز** — كارديو في مساحة صغيرة\n٤. **حصيرة اليوغا** — التمارين الأرضية\n٥. **تمارين وزن الجسم** — لا معدات مطلوبة\n\nيوتيوب يحتوي آلاف التمارين الموجهة المجانية.` },
        { title: "Why You're Not Losing Weight", title_ar: 'لماذا لا تخسر وزناً؟', slug: 'why-not-losing-weight-fix', excerpt: 'The most common reasons weight loss stalls and the exact fixes.', excerpt_ar: 'أكثر أسباب توقف خسارة الوزن شيوعاً والحلول الدقيقة.', content: `## Breaking a Weight Loss Plateau\n\n1. **Underestimating calories** — weigh food for one week\n2. **Metabolic adaptation** — take a 1–2 week diet break\n3. **Too much cardio** — add strength training\n4. **Poor sleep** — fix sleep before anything else\n5. **Water retention** — track trends over 2–4 weeks, not daily`, content_ar: `## كسر حاجز توقف الوزن\n\n١. **التقليل من تقدير السعرات** — زن طعامك أسبوعاً\n٢. **التكيف الأيضي** — أخذ استراحة غذائية 1–2 أسبوع\n٣. **كثرة الكارديو** — أضف تمارين القوة\n٤. **قلة النوم** — اصلح النوم أولاً\n٥. **الاحتباس المائي** — تتبع الاتجاهات 2–4 أسابيع وليس يومياً` },
        { title: 'The Ultimate Pre-Workout Nutrition Guide', title_ar: 'الدليل الشامل لتغذية ما قبل التمرين', slug: 'pre-workout-nutrition-guide', excerpt: 'What to eat before training to maximize performance.', excerpt_ar: 'ما الذي تأكله قبل التمرين لتعظيم الأداء.', content: `## Pre-Workout Nutrition\n\n**2–3 hours before:** 40–60g carbs + 20–30g protein, low fat.\n**30–60 min before:** banana + protein, or dates + coffee.\n\n### Caffeine\n3–6mg/kg bodyweight 30–60 min before = ~3–4% strength increase.\n\n### Hydration\n2% dehydration = up to 15% drop in strength output.`, content_ar: `## تغذية ما قبل التمرين\n\n**قبل 2–3 ساعات:** 40–60 غ كربوهيدرات + 20–30 غ بروتين، دهون منخفضة.\n**قبل 30–60 دقيقة:** موزة + بروتين، أو تمر + قهوة.\n\n### الكافيين\n3–6 ملغ/كغ قبل 30–60 دقيقة = زيادة قوة ~3–4%.\n\n### الترطيب\n2% جفاف = انخفاض حتى 15% في مخرجات القوة.` },
        { title: 'Sleep: The Most Underrated Performance Enhancer', title_ar: 'النوم: أكثر معزز للأداء إهمالاً', slug: 'sleep-performance-enhancer', excerpt: "Sleep is where gains are actually made.", excerpt_ar: 'النوم هو المكان الذي تُصنع فيه المكاسب الحقيقية.', content: `## Why Sleep is Your #1 Tool\n\n### During Sleep\n- Growth hormone peaks — muscle repair\n- Cortisol resets\n- Motor patterns are cemented\n- Glycogen replenishes\n\n### Requirements\n- Sedentary: 7–8h | Exercisers: 8–9h | Athletes: 9–10h\n\n### Optimize It\n1. Consistent schedule\n2. Cool room (18–20°C)\n3. No screens 1h before bed\n4. Blackout curtains\n5. No caffeine after 2pm`, content_ar: `## لماذا النوم هو أداتك الأولى\n\n### أثناء النوم\n- ذروة هرمون النمو — إصلاح العضلات\n- إعادة ضبط الكورتيزول\n- ترسيخ الأنماط الحركية\n- تجديد الجليكوجين\n\n### المتطلبات\n- خامل: 7–8 ساعات | متمرن: 8–9 | رياضي: 9–10\n\n### كيف تحسّنه\n١. جدول ثابت\n٢. غرفة باردة (18–20°م)\n٣. لا شاشات قبل ساعة من النوم\n٤. ستائر تعتيم\n٥. لا كافيين بعد الثانية ظهراً` },
    ];
    const p = await getPool();
    for (const blog of BLOGS) {
        try {
            await p.execute(`INSERT IGNORE INTO blog_posts (title, slug, language, excerpt, content, status, author_id, author_role, published_at) VALUES (?,?,'en',?,?,'published',?,?,?)`, [blog.title, blog.slug, blog.excerpt, blog.content, author.id, 'coach', now]);
            const enRow = await get('SELECT id FROM blog_posts WHERE slug=? AND language=?', [blog.slug, 'en']);
            await p.execute(`INSERT IGNORE INTO blog_posts (title, slug, language, related_blog_id, excerpt, content, status, author_id, author_role, published_at) VALUES (?,?,'ar',?,?,?,'published',?,?,?)`, [blog.title_ar, blog.slug + '-ar', enRow?.id || null, blog.excerpt_ar, blog.content_ar, author.id, 'coach', now]);
        }
        catch { /* skip duplicates */ }
    }
    console.log('✅ Seeded 10 default blogs (EN + AR)');
}
export async function initDatabase() {
    const MAX_RETRIES = 10;
    const RETRY_MS = 3000;
    if (DB_AUTO_CREATE) {
        // Create the DB if it doesn't exist yet (local dev mode)
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const rootPool = mysql.createPool({ ...getConnectionConfig(false), connectionLimit: 1 });
                const dbName = getDatabaseName();
                await rootPool.execute(`CREATE DATABASE IF NOT EXISTS ${escapeDbIdentifier(dbName)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
                await rootPool.end();
                console.log(`✅ Database "${dbName}" ensured`);
                break;
            }
            catch (err) {
                const permDenied = err.code === 'ER_DBACCESS_DENIED_ERROR' ||
                    err.code === 'ER_ACCESS_DENIED_ERROR';
                if (permDenied) {
                    // Provider manages the DB — just continue
                    console.warn('⚠️  No CREATE DATABASE privilege; assuming DB already exists');
                    break;
                }
                const retryable = err.code === 'ECONNREFUSED' ||
                    err.code === 'ETIMEDOUT' ||
                    err.code === 'ENOTFOUND';
                if (!retryable || attempt === MAX_RETRIES) {
                    console.error(`\n❌ Cannot connect to MySQL: ${err.message}`);
                    console.error(`   Host: ${DB_HOST}  Port: ${DB_PORT}  User: ${DB_USER}`);
                    console.error('   ► Set DATABASE_URL in Railway Variables (or DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME for local dev)\n');
                    process.exit(1);
                }
                console.warn(`⚠️  MySQL not ready (attempt ${attempt}/${MAX_RETRIES}), retrying in ${RETRY_MS / 1000}s…`);
                await new Promise(r => setTimeout(r, RETRY_MS));
            }
        }
    }
    else {
        // Managed DB (Railway, PlanetScale…) – just verify connectivity
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const conn = await getPool().getConnection();
                conn.release();
                console.log('✅ MySQL connection verified');
                break;
            }
            catch (err) {
                const retryable = err.code === 'ECONNREFUSED' ||
                    err.code === 'ETIMEDOUT' ||
                    err.code === 'ENOTFOUND';
                if (!retryable || attempt === MAX_RETRIES) {
                    console.error(`\n❌ Cannot connect to MySQL: ${err.message}`);
                    console.error('   ► Ensure DATABASE_URL (or MYSQL_URL) is set in Railway → Variables.\n');
                    process.exit(1);
                }
                console.warn(`⚠️  MySQL not ready (attempt ${attempt}/${MAX_RETRIES}), retrying in ${RETRY_MS / 1000}s…`);
                await new Promise(r => setTimeout(r, RETRY_MS));
            }
        }
    }
    await initTables();
    await seedDefaultAccounts();
    // Purge expired revoked tokens on startup
    try {
        await run('DELETE FROM revoked_tokens WHERE expires_at < NOW()');
    }
    catch { }
    await seedStandardTemplates();
    await seedDefaultWebsiteSections();
    await seedDefaultAppSettings();
    await seedDefaultBlogs();
    // Ads system migration (004)
    try {
        const { runAdsMigration } = await import('../migrations/004_ads_system.js');
        await runAdsMigration();
    }
    catch (e) {
        console.warn('⚠️  Ads migration skipped:', e.message);
    }
    // App images migration (006)
    try {
        const { runAppImagesMigration } = await import('../migrations/006_app_images.js');
        await runAppImagesMigration();
    }
    catch (e) {
        console.warn('⚠️  App images migration skipped:', e.message);
    }
    // Certified coach migration
    try {
        await run('ALTER TABLE coach_profiles ADD COLUMN certified TINYINT(1) DEFAULT 0');
    }
    catch { }
    try {
        await run('ALTER TABLE coach_profiles ADD COLUMN certified_until DATETIME DEFAULT NULL');
    }
    catch { }
    // Auto-renew migration
    try {
        await run('ALTER TABLE coach_subscriptions ADD COLUMN auto_renew TINYINT(1) DEFAULT 1');
    }
    catch { }
    // Cleanup: remove deprecated settings
    try {
        await run("DELETE FROM app_settings WHERE setting_key = 'free_user_can_access_coaching'");
    }
    catch { }
    // Force monthly cycle + monthly label for existing coach fee rows
    try {
        await run("UPDATE app_settings SET setting_value = 'monthly' WHERE setting_key = 'coach_membership_cycle'");
        await run("UPDATE app_settings SET label = 'Coach Monthly Fee (EGP)' WHERE setting_key = 'coach_membership_fee_egp'");
        await run("UPDATE app_settings SET label = 'Coach Monthly Fee (USD, IAP)' WHERE setting_key = 'coach_membership_fee_usd'");
    }
    catch { }
    // Seed default welcome push messages so new athletes/coaches get a push on registration
    try {
        await getPool().execute(
            `INSERT IGNORE INTO welcome_messages (target, channel, subject, title, body, enabled) VALUES
        ('user', 'push', '', 'Welcome to {{app_name}}, {{first_name}}! 💪', 'Your fitness journey starts now. Tap to set up your profile and crush your first workout.', 1),
        ('coach', 'push', '', 'Welcome Coach {{first_name}}! 🏆', 'Athletes are waiting. Complete your profile and start coaching today.', 1)`,
            []
        );
    }
    catch { }
    console.log('🎉 Database fully initialised');
}
export default { query, run, get, getPool };
//# sourceMappingURL=database.js.map