mysqldump: [Warning] Using a password on the command line interface can be insecure.
-- MySQL dump 10.13  Distrib 8.0.45, for Win64 (x86_64)
--
-- Host: localhost    Database: fitwayhub
-- ------------------------------------------------------
-- Server version	8.0.45

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `activity_logs`
--

DROP TABLE IF EXISTS `activity_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `activity_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `action` varchar(100) NOT NULL,
  `details` json DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `activity_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `activity_logs`
--

LOCK TABLES `activity_logs` WRITE;
/*!40000 ALTER TABLE `activity_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `activity_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ad_payments`
--

DROP TABLE IF EXISTS `ad_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ad_payments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ad_id` int NOT NULL,
  `coach_id` int NOT NULL,
  `duration_minutes` int NOT NULL DEFAULT '0',
  `amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `payment_method` varchar(50) DEFAULT 'ewallet',
  `proof_url` varchar(500) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `card_last4` varchar(10) DEFAULT NULL,
  `status` varchar(20) DEFAULT 'pending',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ad_id` (`ad_id`),
  CONSTRAINT `ad_payments_ibfk_1` FOREIGN KEY (`ad_id`) REFERENCES `coach_ads` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ad_payments`
--

LOCK TABLES `ad_payments` WRITE;
/*!40000 ALTER TABLE `ad_payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `ad_payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ad_settings`
--

DROP TABLE IF EXISTS `ad_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ad_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(255) NOT NULL,
  `setting_value` text,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ad_settings`
--

LOCK TABLES `ad_settings` WRITE;
/*!40000 ALTER TABLE `ad_settings` DISABLE KEYS */;
/*!40000 ALTER TABLE `ad_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ads`
--

DROP TABLE IF EXISTS `ads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ads` (
  `id` int NOT NULL AUTO_INCREMENT,
  `coach_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `image` varchar(500) DEFAULT NULL,
  `link` varchar(500) DEFAULT NULL,
  `placement` enum('feed','sidebar','banner','popup') DEFAULT 'feed',
  `status` enum('pending','active','paused','rejected','completed') DEFAULT 'pending',
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `budget` decimal(10,2) DEFAULT '0.00',
  `spent` decimal(10,2) DEFAULT '0.00',
  `impressions` int DEFAULT '0',
  `clicks` int DEFAULT '0',
  `target_audience` json DEFAULT NULL,
  `is_campaign` tinyint(1) DEFAULT '0',
  `rejection_reason` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `coach_id` (`coach_id`),
  CONSTRAINT `ads_ibfk_1` FOREIGN KEY (`coach_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ads`
--

LOCK TABLES `ads` WRITE;
/*!40000 ALTER TABLE `ads` DISABLE KEYS */;
/*!40000 ALTER TABLE `ads` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `app_settings`
--

DROP TABLE IF EXISTS `app_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `app_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(255) NOT NULL,
  `setting_value` text,
  `category` varchar(100) DEFAULT 'general',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `app_settings`
--

LOCK TABLES `app_settings` WRITE;
/*!40000 ALTER TABLE `app_settings` DISABLE KEYS */;
INSERT INTO `app_settings` VALUES (1,'app_name','FitWay Hub','branding','2026-04-06 00:13:27'),(2,'primary_color','#6366f1','branding','2026-04-06 00:13:27'),(3,'tagline','Transform Your Fitness Journey','branding','2026-04-06 00:13:27'),(4,'platform_commission','20','payments','2026-04-06 00:13:27'),(5,'min_withdrawal','50','payments','2026-04-06 00:13:27'),(6,'currency','USD','payments','2026-04-06 00:13:27');
/*!40000 ALTER TABLE `app_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `blog_posts`
--

DROP TABLE IF EXISTS `blog_posts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `blog_posts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `slug` varchar(160) NOT NULL,
  `language` varchar(5) NOT NULL DEFAULT 'en',
  `related_blog_id` int DEFAULT NULL,
  `excerpt` text,
  `content` longtext NOT NULL,
  `header_image_url` varchar(500) DEFAULT NULL,
  `video_url` varchar(500) DEFAULT NULL,
  `video_duration` int DEFAULT NULL,
  `views` int DEFAULT '0',
  `status` varchar(20) NOT NULL DEFAULT 'published',
  `author_id` int NOT NULL,
  `author_role` varchar(50) NOT NULL,
  `published_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_slug_lang` (`slug`,`language`),
  KEY `idx_blog_posts_status` (`status`),
  KEY `idx_blog_posts_author_id` (`author_id`),
  KEY `idx_blog_posts_published_at` (`published_at`),
  KEY `idx_blog_posts_language` (`language`),
  KEY `idx_blog_posts_related` (`related_blog_id`),
  CONSTRAINT `blog_posts_ibfk_1` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_blog_posts_related` FOREIGN KEY (`related_blog_id`) REFERENCES `blog_posts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `blog_posts`
--

LOCK TABLES `blog_posts` WRITE;
/*!40000 ALTER TABLE `blog_posts` DISABLE KEYS */;
/*!40000 ALTER TABLE `blog_posts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `blogs`
--

DROP TABLE IF EXISTS `blogs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `blogs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `author_id` int NOT NULL,
  `title` varchar(500) NOT NULL,
  `title_ar` varchar(500) DEFAULT NULL,
  `slug` varchar(500) NOT NULL,
  `content` longtext NOT NULL,
  `content_ar` longtext,
  `excerpt` text,
  `excerpt_ar` text,
  `cover_image` varchar(500) DEFAULT NULL,
  `video_url` varchar(500) DEFAULT NULL,
  `category` varchar(100) DEFAULT NULL,
  `tags` json DEFAULT NULL,
  `status` enum('draft','published','archived') DEFAULT 'draft',
  `view_count` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  KEY `author_id` (`author_id`),
  CONSTRAINT `blogs_ibfk_1` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `blogs`
--

LOCK TABLES `blogs` WRITE;
/*!40000 ALTER TABLE `blogs` DISABLE KEYS */;
INSERT INTO `blogs` VALUES (1,2,'10 Tips for Staying Consistent',NULL,'10-tips-consistency','Consistency is the key to any fitness journey. Here are 10 proven strategies to help you stay on track...',NULL,'Building lasting fitness habits doesn\'t have to be hard.',NULL,NULL,NULL,'tips',NULL,'published',0,'2026-04-06 00:13:27','2026-04-06 00:13:27'),(2,2,'Nutrition Basics for Athletes',NULL,'nutrition-basics','Proper nutrition is the foundation of athletic performance. In this guide, we break down the essentials...',NULL,'Understanding macros and meal timing for optimal performance.',NULL,NULL,NULL,'nutrition',NULL,'published',0,'2026-04-06 00:13:27','2026-04-06 00:13:27'),(3,2,'The Science of Recovery',NULL,'science-of-recovery','Many people underestimate the importance of recovery. Your muscles grow during rest, not during training...',NULL,'Why rest days are just as important as training days.',NULL,NULL,NULL,'wellness',NULL,'published',0,'2026-04-06 00:13:27','2026-04-06 00:13:27');
/*!40000 ALTER TABLE `blogs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `certification_requests`
--

DROP TABLE IF EXISTS `certification_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `certification_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `coach_id` int NOT NULL,
  `status` varchar(20) DEFAULT 'pending',
  `national_id_url` varchar(500) NOT NULL,
  `certification_url` varchar(500) NOT NULL,
  `amount_paid` decimal(10,2) DEFAULT '0.00',
  `admin_notes` text,
  `reviewed_by` int DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_cert_req_status` (`status`),
  KEY `idx_cert_req_coach` (`coach_id`),
  CONSTRAINT `certification_requests_ibfk_1` FOREIGN KEY (`coach_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `certification_requests`
--

LOCK TABLES `certification_requests` WRITE;
/*!40000 ALTER TABLE `certification_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `certification_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `challenge_participants`
--

DROP TABLE IF EXISTS `challenge_participants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `challenge_participants` (
  `challenge_id` int NOT NULL,
  `user_id` int NOT NULL,
  `progress` int DEFAULT '0',
  `completed` tinyint(1) DEFAULT '0',
  `joined_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`challenge_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `challenge_participants_ibfk_1` FOREIGN KEY (`challenge_id`) REFERENCES `challenges` (`id`) ON DELETE CASCADE,
  CONSTRAINT `challenge_participants_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `challenge_participants`
--

LOCK TABLES `challenge_participants` WRITE;
/*!40000 ALTER TABLE `challenge_participants` DISABLE KEYS */;
/*!40000 ALTER TABLE `challenge_participants` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `challenges`
--

DROP TABLE IF EXISTS `challenges`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `challenges` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `description` text,
  `type` enum('steps','workout','custom') DEFAULT 'custom',
  `target_value` int DEFAULT '0',
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `participant_count` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `challenges_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `challenges`
--

LOCK TABLES `challenges` WRITE;
/*!40000 ALTER TABLE `challenges` DISABLE KEYS */;
/*!40000 ALTER TABLE `challenges` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chat_conversations`
--

DROP TABLE IF EXISTS `chat_conversations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chat_conversations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `participant1_id` int NOT NULL,
  `participant2_id` int NOT NULL,
  `last_message` text,
  `last_message_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `participant1_id` (`participant1_id`),
  KEY `participant2_id` (`participant2_id`),
  CONSTRAINT `chat_conversations_ibfk_1` FOREIGN KEY (`participant1_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chat_conversations_ibfk_2` FOREIGN KEY (`participant2_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chat_conversations`
--

LOCK TABLES `chat_conversations` WRITE;
/*!40000 ALTER TABLE `chat_conversations` DISABLE KEYS */;
/*!40000 ALTER TABLE `chat_conversations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chat_messages`
--

DROP TABLE IF EXISTS `chat_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chat_messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `conversation_id` int NOT NULL,
  `sender_id` int NOT NULL,
  `content` text NOT NULL,
  `message_type` enum('text','image','file') DEFAULT 'text',
  `file_url` varchar(500) DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `conversation_id` (`conversation_id`),
  KEY `sender_id` (`sender_id`),
  CONSTRAINT `chat_messages_ibfk_1` FOREIGN KEY (`conversation_id`) REFERENCES `chat_conversations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chat_messages_ibfk_2` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chat_messages`
--

LOCK TABLES `chat_messages` WRITE;
/*!40000 ALTER TABLE `chat_messages` DISABLE KEYS */;
/*!40000 ALTER TABLE `chat_messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chat_requests`
--

DROP TABLE IF EXISTS `chat_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chat_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sender_id` int NOT NULL,
  `receiver_id` int NOT NULL,
  `status` varchar(20) DEFAULT 'pending',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_chat_req` (`sender_id`,`receiver_id`),
  KEY `receiver_id` (`receiver_id`),
  CONSTRAINT `chat_requests_ibfk_1` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`),
  CONSTRAINT `chat_requests_ibfk_2` FOREIGN KEY (`receiver_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chat_requests`
--

LOCK TABLES `chat_requests` WRITE;
/*!40000 ALTER TABLE `chat_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `chat_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cms_sections`
--

DROP TABLE IF EXISTS `cms_sections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cms_sections` (
  `id` int NOT NULL AUTO_INCREMENT,
  `page` varchar(100) NOT NULL,
  `section_key` varchar(100) NOT NULL,
  `title` varchar(500) DEFAULT NULL,
  `title_ar` varchar(500) DEFAULT NULL,
  `content` longtext,
  `content_ar` longtext,
  `media` varchar(500) DEFAULT NULL,
  `settings` json DEFAULT NULL,
  `sort_order` int DEFAULT '0',
  `is_visible` tinyint(1) DEFAULT '1',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_page_section` (`page`,`section_key`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cms_sections`
--

LOCK TABLES `cms_sections` WRITE;
/*!40000 ALTER TABLE `cms_sections` DISABLE KEYS */;
INSERT INTO `cms_sections` VALUES (1,'home','homepage-hero','Homepage Hero',NULL,'{\"heading\":\"Transform Your Fitness Journey\",\"subheading\":\"Track, train, and transform with FitWay Hub\"}',NULL,NULL,NULL,1,1,'2026-04-06 00:13:27'),(2,'home','homepage-features','Features Section',NULL,'{\"heading\":\"Everything You Need\"}',NULL,NULL,NULL,2,1,'2026-04-06 00:13:27');
/*!40000 ALTER TABLE `cms_sections` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `coach_ads`
--

DROP TABLE IF EXISTS `coach_ads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `coach_ads` (
  `id` int NOT NULL AUTO_INCREMENT,
  `coach_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `specialty` varchar(100) DEFAULT NULL,
  `cta` varchar(255) DEFAULT 'Book Free Consultation',
  `highlight` varchar(255) DEFAULT NULL,
  `image_url` varchar(500) DEFAULT NULL,
  `payment_method` varchar(50) DEFAULT 'free',
  `status` varchar(20) DEFAULT 'pending',
  `impressions` int DEFAULT '0',
  `clicks` int DEFAULT '0',
  `admin_note` text,
  `ad_type` varchar(20) DEFAULT 'community',
  `media_type` varchar(10) DEFAULT 'image',
  `video_url` varchar(500) DEFAULT NULL,
  `objective` varchar(20) DEFAULT 'coaching',
  `duration_hours` int DEFAULT '0',
  `duration_days` int DEFAULT '0',
  `boost_start` datetime DEFAULT NULL,
  `boost_end` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `campaign_name` varchar(255) DEFAULT NULL,
  `audience_gender` varchar(20) DEFAULT 'all',
  `audience_age_min` int DEFAULT '18',
  `audience_age_max` int DEFAULT '65',
  `audience_interests` text,
  `audience_goals` text,
  `audience_activity_levels` text,
  `daily_budget` decimal(10,2) DEFAULT '0.00',
  `total_budget` decimal(10,2) DEFAULT '0.00',
  `budget_type` varchar(20) DEFAULT 'daily',
  `placement` varchar(50) DEFAULT 'all',
  `schedule_start` date DEFAULT NULL,
  `schedule_end` date DEFAULT NULL,
  `reach` int DEFAULT '0',
  `frequency` decimal(5,2) DEFAULT '0.00',
  `ctr` decimal(5,4) DEFAULT '0.0000',
  `cpm` decimal(10,4) DEFAULT '0.0000',
  `amount_spent` decimal(10,2) DEFAULT '0.00',
  `paid_amount` decimal(10,2) DEFAULT '0.00',
  `paid_minutes` int DEFAULT '0',
  `payment_status` varchar(20) DEFAULT 'pending',
  `payment_phone` varchar(30) DEFAULT NULL,
  `contact_phone` varchar(30) DEFAULT NULL,
  `payment_proof` varchar(500) DEFAULT NULL,
  `target_lat` decimal(10,7) DEFAULT NULL,
  `target_lng` decimal(10,7) DEFAULT NULL,
  `target_city` varchar(100) DEFAULT NULL,
  `target_radius_km` int DEFAULT '50',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `coach_ads`
--

LOCK TABLES `coach_ads` WRITE;
/*!40000 ALTER TABLE `coach_ads` DISABLE KEYS */;
/*!40000 ALTER TABLE `coach_ads` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `coach_follows`
--

DROP TABLE IF EXISTS `coach_follows`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `coach_follows` (
  `id` int NOT NULL AUTO_INCREMENT,
  `follower_id` int NOT NULL,
  `coach_id` int NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_follow` (`follower_id`,`coach_id`),
  KEY `coach_id` (`coach_id`),
  CONSTRAINT `coach_follows_ibfk_1` FOREIGN KEY (`follower_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `coach_follows_ibfk_2` FOREIGN KEY (`coach_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `coach_follows`
--

LOCK TABLES `coach_follows` WRITE;
/*!40000 ALTER TABLE `coach_follows` DISABLE KEYS */;
/*!40000 ALTER TABLE `coach_follows` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `coach_profiles`
--

DROP TABLE IF EXISTS `coach_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `coach_profiles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `specialty` varchar(255) DEFAULT NULL,
  `experience_years` int DEFAULT '0',
  `certifications` text,
  `monthly_price` decimal(10,2) DEFAULT '0.00',
  `yearly_price` decimal(10,2) DEFAULT '0.00',
  `rating` decimal(3,2) DEFAULT '0.00',
  `total_reviews` int DEFAULT '0',
  `total_athletes` int DEFAULT '0',
  `is_featured` tinyint(1) DEFAULT '0',
  `is_verified` tinyint(1) DEFAULT '0',
  `payment_method` varchar(50) DEFAULT NULL,
  `payment_details` text,
  `wallet_balance` decimal(10,2) DEFAULT '0.00',
  `about` text,
  `gallery` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `coach_profiles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `coach_profiles`
--

LOCK TABLES `coach_profiles` WRITE;
/*!40000 ALTER TABLE `coach_profiles` DISABLE KEYS */;
INSERT INTO `coach_profiles` VALUES (1,2,'fitness',5,NULL,49.99,499.99,0.00,0,0,0,1,NULL,NULL,0.00,'Passionate about helping people achieve their fitness goals through personalized training programs.',NULL,'2026-04-06 00:13:27','2026-04-06 00:13:27');
/*!40000 ALTER TABLE `coach_profiles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `coach_reports`
--

DROP TABLE IF EXISTS `coach_reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `coach_reports` (
  `id` int NOT NULL AUTO_INCREMENT,
  `coach_id` int NOT NULL,
  `user_id` int NOT NULL,
  `reason` varchar(120) NOT NULL,
  `details` text,
  `status` varchar(20) DEFAULT 'pending',
  `admin_notes` text,
  `reviewed_by` int DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `reviewed_by` (`reviewed_by`),
  KEY `idx_coach_reports_status` (`status`),
  KEY `idx_coach_reports_coach` (`coach_id`),
  KEY `idx_coach_reports_user` (`user_id`),
  CONSTRAINT `coach_reports_ibfk_1` FOREIGN KEY (`coach_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `coach_reports_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `coach_reports_ibfk_3` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `coach_reports`
--

LOCK TABLES `coach_reports` WRITE;
/*!40000 ALTER TABLE `coach_reports` DISABLE KEYS */;
/*!40000 ALTER TABLE `coach_reports` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `coach_reviews`
--

DROP TABLE IF EXISTS `coach_reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `coach_reviews` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `coach_id` int NOT NULL,
  `rating` int NOT NULL,
  `comment` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `coach_id` (`coach_id`),
  CONSTRAINT `coach_reviews_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `coach_reviews_ibfk_2` FOREIGN KEY (`coach_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `coach_reviews`
--

LOCK TABLES `coach_reviews` WRITE;
/*!40000 ALTER TABLE `coach_reviews` DISABLE KEYS */;
/*!40000 ALTER TABLE `coach_reviews` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `coach_subscriptions`
--

DROP TABLE IF EXISTS `coach_subscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `coach_subscriptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `coach_id` int NOT NULL,
  `plan_cycle` varchar(20) NOT NULL DEFAULT 'monthly',
  `plan_type` varchar(20) NOT NULL DEFAULT 'complete',
  `amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `status` varchar(20) DEFAULT 'pending_admin',
  `admin_approval_status` varchar(20) DEFAULT 'pending',
  `coach_decision_status` varchar(20) DEFAULT 'pending',
  `refund_status` varchar(20) DEFAULT 'none',
  `refunded_at` datetime DEFAULT NULL,
  `refund_amount` decimal(10,2) DEFAULT '0.00',
  `refund_reason` varchar(255) DEFAULT NULL,
  `admin_approved_at` datetime DEFAULT NULL,
  `coach_decided_at` datetime DEFAULT NULL,
  `credited_amount` decimal(10,2) DEFAULT '0.00',
  `credit_released_at` datetime DEFAULT NULL,
  `payer_wallet_type` varchar(30) DEFAULT NULL,
  `payer_number` varchar(30) DEFAULT NULL,
  `payment_method` varchar(50) DEFAULT NULL,
  `payment_proof` varchar(500) DEFAULT NULL,
  `started_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime DEFAULT NULL,
  `auto_renew` tinyint(1) DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `coach_id` (`coach_id`),
  CONSTRAINT `coach_subscriptions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `coach_subscriptions_ibfk_2` FOREIGN KEY (`coach_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `coach_subscriptions`
--

LOCK TABLES `coach_subscriptions` WRITE;
/*!40000 ALTER TABLE `coach_subscriptions` DISABLE KEYS */;
/*!40000 ALTER TABLE `coach_subscriptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `coaching_bookings`
--

DROP TABLE IF EXISTS `coaching_bookings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `coaching_bookings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `coach_id` int NOT NULL,
  `date` varchar(20) DEFAULT NULL,
  `time` varchar(20) DEFAULT NULL,
  `note` text,
  `booking_type` varchar(50) DEFAULT 'session',
  `plan` varchar(50) DEFAULT 'complete',
  `level` varchar(20) DEFAULT '1',
  `now_body_photo` varchar(500) DEFAULT NULL,
  `dream_body_photo` varchar(500) DEFAULT NULL,
  `status` varchar(20) DEFAULT 'pending',
  `amount` float DEFAULT '0',
  `completed_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `coach_id` (`coach_id`),
  CONSTRAINT `coaching_bookings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `coaching_bookings_ibfk_2` FOREIGN KEY (`coach_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `coaching_bookings`
--

LOCK TABLES `coaching_bookings` WRITE;
/*!40000 ALTER TABLE `coaching_bookings` DISABLE KEYS */;
/*!40000 ALTER TABLE `coaching_bookings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `coaching_meetings`
--

DROP TABLE IF EXISTS `coaching_meetings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `coaching_meetings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `coach_id` int NOT NULL,
  `user_id` int NOT NULL,
  `title` varchar(255) DEFAULT 'Coaching Session',
  `room_id` varchar(100) NOT NULL,
  `status` varchar(20) DEFAULT 'scheduled',
  `scheduled_at` datetime DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `ended_at` datetime DEFAULT NULL,
  `notes` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `room_id` (`room_id`),
  KEY `coach_id` (`coach_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `coaching_meetings_ibfk_1` FOREIGN KEY (`coach_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `coaching_meetings_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `coaching_meetings`
--

LOCK TABLES `coaching_meetings` WRITE;
/*!40000 ALTER TABLE `coaching_meetings` DISABLE KEYS */;
/*!40000 ALTER TABLE `coaching_meetings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `coaching_subscriptions`
--

DROP TABLE IF EXISTS `coaching_subscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `coaching_subscriptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `coach_id` int NOT NULL,
  `plan_type` enum('monthly','yearly') DEFAULT 'monthly',
  `status` enum('pending','active','cancelled','expired','rejected') DEFAULT 'pending',
  `payment_status` enum('pending','paid','refunded','failed') DEFAULT 'pending',
  `payment_proof` varchar(500) DEFAULT NULL,
  `amount` decimal(10,2) DEFAULT '0.00',
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `coach_id` (`coach_id`),
  CONSTRAINT `coaching_subscriptions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `coaching_subscriptions_ibfk_2` FOREIGN KEY (`coach_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `coaching_subscriptions`
--

LOCK TABLES `coaching_subscriptions` WRITE;
/*!40000 ALTER TABLE `coaching_subscriptions` DISABLE KEYS */;
/*!40000 ALTER TABLE `coaching_subscriptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `community_posts`
--

DROP TABLE IF EXISTS `community_posts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `community_posts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `content` text NOT NULL,
  `images` json DEFAULT NULL,
  `hashtags` json DEFAULT NULL,
  `like_count` int DEFAULT '0',
  `comment_count` int DEFAULT '0',
  `is_pinned` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `community_posts_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `community_posts`
--

LOCK TABLES `community_posts` WRITE;
/*!40000 ALTER TABLE `community_posts` DISABLE KEYS */;
INSERT INTO `community_posts` VALUES (1,3,'Just completed my first month of consistent training! 💪 Feeling stronger every day. #fitness #milestone #motivation',NULL,'[\"fitness\", \"milestone\", \"motivation\"]',0,0,0,'2026-04-06 00:13:27','2026-04-06 00:13:27'),(2,2,'New upper body workout just dropped! Check it out in the workouts section. Perfect for intermediate lifters. #workout #strength #coaching',NULL,'[\"workout\", \"strength\", \"coaching\"]',0,0,0,'2026-04-06 00:13:27','2026-04-06 00:13:27');
/*!40000 ALTER TABLE `community_posts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `credit_transactions`
--

DROP TABLE IF EXISTS `credit_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `credit_transactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `type` varchar(30) NOT NULL,
  `reference_id` int DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `credit_transactions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `credit_transactions`
--

LOCK TABLES `credit_transactions` WRITE;
/*!40000 ALTER TABLE `credit_transactions` DISABLE KEYS */;
/*!40000 ALTER TABLE `credit_transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `daily_summaries`
--

DROP TABLE IF EXISTS `daily_summaries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `daily_summaries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `date` date NOT NULL,
  `steps` int DEFAULT '0',
  `calories` decimal(10,2) DEFAULT '0.00',
  `water` decimal(5,2) DEFAULT '0.00',
  `sleep` decimal(4,2) DEFAULT '0.00',
  `workouts_completed` int DEFAULT '0',
  `ai_summary` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_date` (`user_id`,`date`),
  CONSTRAINT `daily_summaries_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `daily_summaries`
--

LOCK TABLES `daily_summaries` WRITE;
/*!40000 ALTER TABLE `daily_summaries` DISABLE KEYS */;
/*!40000 ALTER TABLE `daily_summaries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `email_accounts`
--

DROP TABLE IF EXISTS `email_accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `email_accounts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `display_name` varchar(255) NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `email_accounts`
--

LOCK TABLES `email_accounts` WRITE;
/*!40000 ALTER TABLE `email_accounts` DISABLE KEYS */;
/*!40000 ALTER TABLE `email_accounts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `email_settings`
--

DROP TABLE IF EXISTS `email_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `email_settings` (
  `id` int NOT NULL DEFAULT '1',
  `smtp_host` varchar(255) NOT NULL DEFAULT '',
  `smtp_port` int NOT NULL DEFAULT '587',
  `smtp_user` varchar(255) NOT NULL DEFAULT '',
  `smtp_pass` varchar(255) NOT NULL DEFAULT '',
  `smtp_secure` enum('none','tls','starttls') NOT NULL DEFAULT 'starttls',
  `from_name` varchar(255) NOT NULL DEFAULT '',
  `from_email` varchar(255) NOT NULL DEFAULT '',
  `enabled` tinyint(1) NOT NULL DEFAULT '0',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `email_settings`
--

LOCK TABLES `email_settings` WRITE;
/*!40000 ALTER TABLE `email_settings` DISABLE KEYS */;
INSERT INTO `email_settings` VALUES (1,'',587,'','','starttls','','',0,'2026-05-03 02:55:17');
/*!40000 ALTER TABLE `email_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `emails`
--

DROP TABLE IF EXISTS `emails`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `emails` (
  `id` int NOT NULL AUTO_INCREMENT,
  `account_id` int NOT NULL,
  `sender` varchar(500) NOT NULL,
  `recipient` varchar(500) NOT NULL,
  `subject` varchar(1000) NOT NULL DEFAULT '',
  `text_body` longtext,
  `html_body` longtext,
  `direction` enum('inbound','outbound') NOT NULL DEFAULT 'inbound',
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `message_id` varchar(500) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_emails_account_dir` (`account_id`,`direction`),
  KEY `idx_emails_created` (`created_at`),
  CONSTRAINT `emails_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `email_accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `emails`
--

LOCK TABLES `emails` WRITE;
/*!40000 ALTER TABLE `emails` DISABLE KEYS */;
/*!40000 ALTER TABLE `emails` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `follows`
--

DROP TABLE IF EXISTS `follows`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `follows` (
  `follower_id` int NOT NULL,
  `following_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`follower_id`,`following_id`),
  KEY `following_id` (`following_id`),
  CONSTRAINT `follows_ibfk_1` FOREIGN KEY (`follower_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `follows_ibfk_2` FOREIGN KEY (`following_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `follows`
--

LOCK TABLES `follows` WRITE;
/*!40000 ALTER TABLE `follows` DISABLE KEYS */;
/*!40000 ALTER TABLE `follows` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `gifts`
--

DROP TABLE IF EXISTS `gifts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `gifts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `admin_id` int DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `type` varchar(50) DEFAULT 'points',
  `value` int DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `gifts_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `gifts`
--

LOCK TABLES `gifts` WRITE;
/*!40000 ALTER TABLE `gifts` DISABLE KEYS */;
/*!40000 ALTER TABLE `gifts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `health_data`
--

DROP TABLE IF EXISTS `health_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `health_data` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `date` date NOT NULL,
  `water_intake` decimal(5,2) DEFAULT '0.00',
  `sleep_hours` decimal(4,2) DEFAULT '0.00',
  `heart_rate` int DEFAULT NULL,
  `blood_pressure` varchar(20) DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_date` (`user_id`,`date`),
  CONSTRAINT `health_data_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `health_data`
--

LOCK TABLES `health_data` WRITE;
/*!40000 ALTER TABLE `health_data` DISABLE KEYS */;
INSERT INTO `health_data` VALUES (1,3,'2026-04-06',1.20,5.50,66,'115/75',NULL,'2026-04-06 00:13:27'),(2,3,'2026-04-05',2.60,5.40,64,'127/72',NULL,'2026-04-06 00:13:27'),(3,3,'2026-04-04',1.50,7.30,66,'125/78',NULL,'2026-04-06 00:13:27'),(4,3,'2026-04-03',1.90,5.70,63,'121/70',NULL,'2026-04-06 00:13:27'),(5,3,'2026-04-02',2.30,5.70,65,'114/72',NULL,'2026-04-06 00:13:27'),(6,3,'2026-04-01',2.90,7.70,73,'111/76',NULL,'2026-04-06 00:13:27'),(7,3,'2026-03-31',1.40,6.00,71,'120/71',NULL,'2026-04-06 00:13:27'),(8,3,'2026-03-30',1.50,5.80,68,'127/74',NULL,'2026-04-06 00:13:27'),(9,3,'2026-03-29',1.10,6.00,62,'127/75',NULL,'2026-04-06 00:13:27'),(10,3,'2026-03-28',1.20,6.50,64,'127/78',NULL,'2026-04-06 00:13:27'),(11,3,'2026-03-27',1.80,5.60,77,'126/70',NULL,'2026-04-06 00:13:27'),(12,3,'2026-03-26',1.90,5.40,67,'120/71',NULL,'2026-04-06 00:13:27'),(13,3,'2026-03-25',2.00,6.30,78,'112/75',NULL,'2026-04-06 00:13:27'),(14,3,'2026-03-24',2.10,5.10,72,'117/78',NULL,'2026-04-06 00:13:27'),(15,3,'2026-03-23',2.00,5.40,63,'125/73',NULL,'2026-04-06 00:13:27'),(16,3,'2026-03-22',2.40,6.20,64,'122/76',NULL,'2026-04-06 00:13:27'),(17,3,'2026-03-21',1.20,6.20,64,'111/78',NULL,'2026-04-06 00:13:27'),(18,3,'2026-03-20',1.80,6.90,66,'119/75',NULL,'2026-04-06 00:13:27'),(19,3,'2026-03-19',2.20,6.40,74,'121/72',NULL,'2026-04-06 00:13:27'),(20,3,'2026-03-18',1.60,7.70,62,'119/78',NULL,'2026-04-06 00:13:27'),(21,3,'2026-03-17',1.70,6.10,74,'115/70',NULL,'2026-04-06 00:13:27'),(22,3,'2026-03-16',2.00,5.50,62,'128/77',NULL,'2026-04-06 00:13:27'),(23,3,'2026-03-15',1.90,6.00,64,'111/71',NULL,'2026-04-06 00:13:27'),(24,3,'2026-03-14',1.50,5.90,64,'117/75',NULL,'2026-04-06 00:13:27'),(25,3,'2026-03-13',1.30,5.40,77,'128/77',NULL,'2026-04-06 00:13:27'),(26,3,'2026-03-12',1.60,5.90,62,'114/77',NULL,'2026-04-06 00:13:27'),(27,3,'2026-03-11',1.90,5.80,69,'110/70',NULL,'2026-04-06 00:13:27'),(28,3,'2026-03-10',2.80,6.20,65,'116/74',NULL,'2026-04-06 00:13:27'),(29,3,'2026-03-09',1.40,6.70,65,'116/70',NULL,'2026-04-06 00:13:27'),(30,3,'2026-03-08',2.60,6.20,67,'124/70',NULL,'2026-04-06 00:13:27');
/*!40000 ALTER TABLE `health_data` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `meeting_files`
--

DROP TABLE IF EXISTS `meeting_files`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `meeting_files` (
  `id` int NOT NULL AUTO_INCREMENT,
  `meeting_id` int NOT NULL,
  `uploaded_by` int NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_url` varchar(500) NOT NULL,
  `file_type` varchar(100) DEFAULT NULL,
  `file_size` int DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `meeting_id` (`meeting_id`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `meeting_files_ibfk_1` FOREIGN KEY (`meeting_id`) REFERENCES `coaching_meetings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `meeting_files_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `meeting_files`
--

LOCK TABLES `meeting_files` WRITE;
/*!40000 ALTER TABLE `meeting_files` DISABLE KEYS */;
/*!40000 ALTER TABLE `meeting_files` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `meeting_messages`
--

DROP TABLE IF EXISTS `meeting_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `meeting_messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `meeting_id` int NOT NULL,
  `user_id` int NOT NULL,
  `message` text NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `meeting_id` (`meeting_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `meeting_messages_ibfk_1` FOREIGN KEY (`meeting_id`) REFERENCES `coaching_meetings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `meeting_messages_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `meeting_messages`
--

LOCK TABLES `meeting_messages` WRITE;
/*!40000 ALTER TABLE `meeting_messages` DISABLE KEYS */;
/*!40000 ALTER TABLE `meeting_messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `messages`
--

DROP TABLE IF EXISTS `messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sender_id` int NOT NULL,
  `receiver_id` int DEFAULT NULL,
  `group_id` int DEFAULT NULL,
  `challenge_id` int DEFAULT NULL,
  `content` text,
  `media_url` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `sender_id` (`sender_id`),
  CONSTRAINT `messages_ibfk_1` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `messages`
--

LOCK TABLES `messages` WRITE;
/*!40000 ALTER TABLE `messages` DISABLE KEYS */;
/*!40000 ALTER TABLE `messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notification_templates`
--

DROP TABLE IF EXISTS `notification_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `title` varchar(255) NOT NULL,
  `body` text NOT NULL,
  `type` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification_templates`
--

LOCK TABLES `notification_templates` WRITE;
/*!40000 ALTER TABLE `notification_templates` DISABLE KEYS */;
/*!40000 ALTER TABLE `notification_templates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `body` text,
  `type` varchar(50) DEFAULT 'general',
  `data` json DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nutrition_plans`
--

DROP TABLE IF EXISTS `nutrition_plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nutrition_plans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `coach_id` int NOT NULL,
  `athlete_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `plan_data` json DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `status` enum('draft','active','completed') DEFAULT 'draft',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `coach_id` (`coach_id`),
  KEY `athlete_id` (`athlete_id`),
  CONSTRAINT `nutrition_plans_ibfk_1` FOREIGN KEY (`coach_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `nutrition_plans_ibfk_2` FOREIGN KEY (`athlete_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nutrition_plans`
--

LOCK TABLES `nutrition_plans` WRITE;
/*!40000 ALTER TABLE `nutrition_plans` DISABLE KEYS */;
/*!40000 ALTER TABLE `nutrition_plans` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment_settings`
--

DROP TABLE IF EXISTS `payment_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_settings`
--

LOCK TABLES `payment_settings` WRITE;
/*!40000 ALTER TABLE `payment_settings` DISABLE KEYS */;
INSERT INTO `payment_settings` VALUES (1,'google_play_enabled','0','2026-05-03 02:55:25'),(2,'google_play_product_id_monthly','','2026-05-03 02:55:25'),(3,'google_play_product_id_annual','','2026-05-03 02:55:25'),(4,'apple_pay_enabled','0','2026-05-03 02:55:25'),(5,'apple_pay_product_id_monthly','','2026-05-03 02:55:25'),(6,'apple_pay_product_id_annual','','2026-05-03 02:55:25');
/*!40000 ALTER TABLE `payment_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `type` enum('premium','coaching','withdrawal') NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `currency` varchar(10) DEFAULT 'USD',
  `status` enum('pending','completed','failed','refunded','approved','rejected') DEFAULT 'pending',
  `method` varchar(50) DEFAULT NULL,
  `transaction_id` varchar(255) DEFAULT NULL,
  `reference_id` int DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `payments_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payments`
--

LOCK TABLES `payments` WRITE;
/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paymob_transactions`
--

DROP TABLE IF EXISTS `paymob_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paymob_transactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `coach_id` int DEFAULT NULL,
  `paymob_order_id` bigint DEFAULT NULL,
  `paymob_transaction_id` bigint DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL,
  `type` varchar(50) NOT NULL,
  `plan_cycle` varchar(20) DEFAULT NULL,
  `plan_type` varchar(20) DEFAULT NULL,
  `method` varchar(20) DEFAULT 'card',
  `reference_id` int DEFAULT NULL,
  `status` varchar(20) DEFAULT 'pending',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pt_order` (`paymob_order_id`),
  KEY `idx_pt_user` (`user_id`),
  CONSTRAINT `paymob_transactions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paymob_transactions`
--

LOCK TABLES `paymob_transactions` WRITE;
/*!40000 ALTER TABLE `paymob_transactions` DISABLE KEYS */;
/*!40000 ALTER TABLE `paymob_transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `playlist_videos`
--

DROP TABLE IF EXISTS `playlist_videos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `playlist_videos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `playlist_id` int NOT NULL,
  `video_id` int NOT NULL,
  `sort_order` int DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_playlist_video` (`playlist_id`,`video_id`),
  KEY `video_id` (`video_id`),
  CONSTRAINT `playlist_videos_ibfk_1` FOREIGN KEY (`playlist_id`) REFERENCES `video_playlists` (`id`) ON DELETE CASCADE,
  CONSTRAINT `playlist_videos_ibfk_2` FOREIGN KEY (`video_id`) REFERENCES `workout_videos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `playlist_videos`
--

LOCK TABLES `playlist_videos` WRITE;
/*!40000 ALTER TABLE `playlist_videos` DISABLE KEYS */;
/*!40000 ALTER TABLE `playlist_videos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `playlist_workouts`
--

DROP TABLE IF EXISTS `playlist_workouts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `playlist_workouts` (
  `playlist_id` int NOT NULL,
  `workout_id` int NOT NULL,
  `sort_order` int DEFAULT '0',
  PRIMARY KEY (`playlist_id`,`workout_id`),
  KEY `workout_id` (`workout_id`),
  CONSTRAINT `playlist_workouts_ibfk_1` FOREIGN KEY (`playlist_id`) REFERENCES `workout_playlists` (`id`) ON DELETE CASCADE,
  CONSTRAINT `playlist_workouts_ibfk_2` FOREIGN KEY (`workout_id`) REFERENCES `workouts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `playlist_workouts`
--

LOCK TABLES `playlist_workouts` WRITE;
/*!40000 ALTER TABLE `playlist_workouts` DISABLE KEYS */;
/*!40000 ALTER TABLE `playlist_workouts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `point_transactions`
--

DROP TABLE IF EXISTS `point_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `point_transactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `points` int NOT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `reference_type` varchar(50) DEFAULT NULL,
  `reference_id` varchar(100) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `point_transactions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `point_transactions`
--

LOCK TABLES `point_transactions` WRITE;
/*!40000 ALTER TABLE `point_transactions` DISABLE KEYS */;
/*!40000 ALTER TABLE `point_transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `post_comments`
--

DROP TABLE IF EXISTS `post_comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `post_comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `post_id` int NOT NULL,
  `user_id` int NOT NULL,
  `content` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `post_id` (`post_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `post_comments_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `community_posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `post_comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `post_comments`
--

LOCK TABLES `post_comments` WRITE;
/*!40000 ALTER TABLE `post_comments` DISABLE KEYS */;
/*!40000 ALTER TABLE `post_comments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `post_likes`
--

DROP TABLE IF EXISTS `post_likes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `post_likes` (
  `user_id` int NOT NULL,
  `post_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`post_id`),
  KEY `post_id` (`post_id`),
  CONSTRAINT `post_likes_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `post_likes_ibfk_2` FOREIGN KEY (`post_id`) REFERENCES `community_posts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `post_likes`
--

LOCK TABLES `post_likes` WRITE;
/*!40000 ALTER TABLE `post_likes` DISABLE KEYS */;
/*!40000 ALTER TABLE `post_likes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `posts`
--

DROP TABLE IF EXISTS `posts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `posts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `content` text,
  `media_url` text,
  `hashtags` text,
  `likes` int DEFAULT '0',
  `is_hidden` tinyint(1) DEFAULT '0',
  `moderated_by` int DEFAULT NULL,
  `moderation_reason` varchar(255) DEFAULT NULL,
  `is_announcement` tinyint(1) DEFAULT '0',
  `is_pinned` tinyint(1) DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `posts_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `posts`
--

LOCK TABLES `posts` WRITE;
/*!40000 ALTER TABLE `posts` DISABLE KEYS */;
/*!40000 ALTER TABLE `posts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `premium_sessions`
--

DROP TABLE IF EXISTS `premium_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `premium_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `start_time` datetime DEFAULT NULL,
  `end_time` datetime DEFAULT NULL,
  `total_steps` int DEFAULT NULL,
  `total_distance_km` float DEFAULT NULL,
  `calories` int DEFAULT NULL,
  `path_json` longtext,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `premium_sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `premium_sessions`
--

LOCK TABLES `premium_sessions` WRITE;
/*!40000 ALTER TABLE `premium_sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `premium_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `push_log`
--

DROP TABLE IF EXISTS `push_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `push_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `template_id` int DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `body` text NOT NULL,
  `status` enum('sent','failed') NOT NULL DEFAULT 'sent',
  `error_message` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `template_id` (`template_id`),
  CONSTRAINT `push_log_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `push_log_ibfk_2` FOREIGN KEY (`template_id`) REFERENCES `push_templates` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `push_log`
--

LOCK TABLES `push_log` WRITE;
/*!40000 ALTER TABLE `push_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `push_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `push_logs`
--

DROP TABLE IF EXISTS `push_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `push_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `template_id` int DEFAULT NULL,
  `target_role` varchar(50) DEFAULT NULL,
  `target_user_id` int DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `body` text,
  `sent_count` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `push_logs`
--

LOCK TABLES `push_logs` WRITE;
/*!40000 ALTER TABLE `push_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `push_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `push_templates`
--

DROP TABLE IF EXISTS `push_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `push_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `slug` varchar(100) NOT NULL,
  `title` varchar(255) NOT NULL,
  `body` text NOT NULL,
  `category` enum('new_user','new_coach','engagement','streak','inactivity','promo','coach_tip','system') NOT NULL DEFAULT 'engagement',
  `trigger_type` varchar(100) NOT NULL DEFAULT 'manual',
  `enabled` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `push_templates`
--

LOCK TABLES `push_templates` WRITE;
/*!40000 ALTER TABLE `push_templates` DISABLE KEYS */;
/*!40000 ALTER TABLE `push_templates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `push_tokens`
--

DROP TABLE IF EXISTS `push_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `push_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `token` text NOT NULL,
  `platform` enum('android','ios','web') NOT NULL DEFAULT 'android',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_token` (`user_id`,`platform`),
  CONSTRAINT `push_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `push_tokens`
--

LOCK TABLES `push_tokens` WRITE;
/*!40000 ALTER TABLE `push_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `push_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `revoked_tokens`
--

DROP TABLE IF EXISTS `revoked_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `revoked_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `token_hash` varchar(64) NOT NULL,
  `revoked_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_revoked_tokens_hash` (`token_hash`),
  KEY `idx_revoked_tokens_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `revoked_tokens`
--

LOCK TABLES `revoked_tokens` WRITE;
/*!40000 ALTER TABLE `revoked_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `revoked_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `steps`
--

DROP TABLE IF EXISTS `steps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `steps` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `date` date NOT NULL,
  `count` int DEFAULT '0',
  `goal` int DEFAULT '10000',
  `distance` decimal(10,2) DEFAULT '0.00',
  `calories` decimal(10,2) DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_date` (`user_id`,`date`),
  CONSTRAINT `steps_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `steps`
--

LOCK TABLES `steps` WRITE;
/*!40000 ALTER TABLE `steps` DISABLE KEYS */;
INSERT INTO `steps` VALUES (1,3,'2026-04-06',9900,10000,6.93,396.00,'2026-04-06 00:13:27','2026-04-06 00:13:27'),(2,3,'2026-04-05',4306,10000,3.01,172.00,'2026-04-06 00:13:27','2026-04-06 00:13:27'),(3,3,'2026-04-04',3240,10000,2.27,129.00,'2026-04-06 00:13:27','2026-04-06 00:13:27'),(4,3,'2026-04-03',2915,10000,2.04,116.00,'2026-04-06 00:13:27','2026-04-06 00:13:27'),(5,3,'2026-04-02',5003,10000,3.50,200.00,'2026-04-06 00:13:27','2026-04-06 00:13:27'),(6,3,'2026-04-01',5110,10000,3.58,204.00,'2026-04-06 00:13:27','2026-04-06 00:13:27'),(7,3,'2026-03-31',3892,10000,2.72,155.00,'2026-04-06 00:13:27','2026-04-06 00:13:27'),(8,3,'2026-03-30',3253,10000,2.28,130.00,'2026-04-06 00:13:27','2026-04-06 00:13:27'),(9,3,'2026-03-29',6569,10000,4.60,262.00,'2026-04-06 00:13:27','2026-04-06 00:13:27'),(10,3,'2026-03-28',3476,10000,2.43,139.00,'2026-04-06 00:13:27','2026-04-06 00:13:27'),(11,3,'2026-03-27',8884,10000,6.22,355.00,'2026-04-06 00:13:27','2026-04-06 00:13:27'),(12,3,'2026-03-26',8841,10000,6.19,353.00,'2026-04-06 00:13:27','2026-04-06 00:13:27'),(13,3,'2026-03-25',2007,10000,1.40,80.00,'2026-04-06 00:13:27','2026-04-06 00:13:27'),(14,3,'2026-03-24',9089,10000,6.36,363.00,'2026-04-06 00:13:27','2026-04-06 00:13:27'),(15,3,'2026-03-23',9702,10000,6.79,388.00,'2026-04-06 00:13:27','2026-04-06 00:13:27'),(16,3,'2026-03-22',8478,10000,5.93,339.00,'2026-04-06 00:13:27','2026-04-06 00:13:27'),(17,3,'2026-03-21',7233,10000,5.06,289.00,'2026-04-06 00:13:27','2026-04-06 00:13:27'),(18,3,'2026-03-20',8638,10000,6.05,345.00,'2026-04-06 00:13:27','2026-04-06 00:13:27'),(19,3,'2026-03-19',2085,10000,1.46,83.00,'2026-04-06 00:13:27','2026-04-06 00:13:27'),(20,3,'2026-03-18',7082,10000,4.96,283.00,'2026-04-06 00:13:27','2026-04-06 00:13:27'),(21,3,'2026-03-17',7004,10000,4.90,280.00,'2026-04-06 00:13:27','2026-04-06 00:13:27'),(22,3,'2026-03-16',7043,10000,4.93,281.00,'2026-04-06 00:13:27','2026-04-06 00:13:27'),(23,3,'2026-03-15',3114,10000,2.18,124.00,'2026-04-06 00:13:27','2026-04-06 00:13:27'),(24,3,'2026-03-14',6914,10000,4.84,276.00,'2026-04-06 00:13:27','2026-04-06 00:13:27'),(25,3,'2026-03-13',8799,10000,6.16,351.00,'2026-04-06 00:13:27','2026-04-06 00:13:27'),(26,3,'2026-03-12',7639,10000,5.35,305.00,'2026-04-06 00:13:27','2026-04-06 00:13:27'),(27,3,'2026-03-11',7461,10000,5.22,298.00,'2026-04-06 00:13:27','2026-04-06 00:13:27'),(28,3,'2026-03-10',6210,10000,4.35,248.00,'2026-04-06 00:13:27','2026-04-06 00:13:27'),(29,3,'2026-03-09',7706,10000,5.39,308.00,'2026-04-06 00:13:27','2026-04-06 00:13:27'),(30,3,'2026-03-08',6945,10000,4.86,277.00,'2026-04-06 00:13:27','2026-04-06 00:13:27');
/*!40000 ALTER TABLE `steps` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `steps_entries`
--

DROP TABLE IF EXISTS `steps_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `steps_entries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `date` varchar(20) NOT NULL,
  `steps` int NOT NULL,
  `calories_burned` int DEFAULT NULL,
  `distance_km` float DEFAULT NULL,
  `notes` text,
  `tracking_mode` varchar(50) DEFAULT 'manual',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_date` (`user_id`,`date`),
  CONSTRAINT `steps_entries_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `steps_entries`
--

LOCK TABLES `steps_entries` WRITE;
/*!40000 ALTER TABLE `steps_entries` DISABLE KEYS */;
/*!40000 ALTER TABLE `steps_entries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_follows`
--

DROP TABLE IF EXISTS `user_follows`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_follows` (
  `id` int NOT NULL AUTO_INCREMENT,
  `follower_id` int NOT NULL,
  `following_id` int NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_follow` (`follower_id`,`following_id`),
  KEY `following_id` (`following_id`),
  CONSTRAINT `user_follows_ibfk_1` FOREIGN KEY (`follower_id`) REFERENCES `users` (`id`),
  CONSTRAINT `user_follows_ibfk_2` FOREIGN KEY (`following_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_follows`
--

LOCK TABLES `user_follows` WRITE;
/*!40000 ALTER TABLE `user_follows` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_follows` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_nutrition_plans`
--

DROP TABLE IF EXISTS `user_nutrition_plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_nutrition_plans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `day_of_week` varchar(20) NOT NULL,
  `meal_time` varchar(50) NOT NULL,
  `meal_type` varchar(100) DEFAULT NULL,
  `meal_name` varchar(255) NOT NULL,
  `contents` text,
  `calories` int DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `user_nutrition_plans_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_nutrition_plans`
--

LOCK TABLES `user_nutrition_plans` WRITE;
/*!40000 ALTER TABLE `user_nutrition_plans` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_nutrition_plans` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_progress_photos`
--

DROP TABLE IF EXISTS `user_progress_photos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_progress_photos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `before_photo` varchar(500) DEFAULT NULL,
  `now_photo` varchar(500) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_progress_user` (`user_id`),
  CONSTRAINT `user_progress_photos_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_progress_photos`
--

LOCK TABLES `user_progress_photos` WRITE;
/*!40000 ALTER TABLE `user_progress_photos` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_progress_photos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_workout_plans`
--

DROP TABLE IF EXISTS `user_workout_plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_workout_plans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `day_of_week` varchar(20) NOT NULL,
  `workout_type` varchar(100) NOT NULL,
  `video_url` text,
  `time_minutes` int DEFAULT '0',
  `notes` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `user_workout_plans_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_workout_plans`
--

LOCK TABLES `user_workout_plans` WRITE;
/*!40000 ALTER TABLE `user_workout_plans` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_workout_plans` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `role` enum('user','coach','admin') DEFAULT 'user',
  `avatar` varchar(500) DEFAULT NULL,
  `bio` text,
  `phone` varchar(50) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `gender` enum('male','female','other') DEFAULT NULL,
  `height` decimal(5,2) DEFAULT NULL,
  `weight` decimal(5,2) DEFAULT NULL,
  `fitness_goal` varchar(255) DEFAULT NULL,
  `google_id` varchar(255) DEFAULT NULL,
  `fcm_token` text,
  `is_active` tinyint(1) DEFAULT '1',
  `is_verified` tinyint(1) DEFAULT '0',
  `reset_token` varchar(255) DEFAULT NULL,
  `reset_token_expires` datetime DEFAULT NULL,
  `preferred_language` enum('en','ar') DEFAULT 'en',
  `theme` enum('light','dark') DEFAULT 'light',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `activity_level` varchar(20) DEFAULT NULL,
  `target_weight` int DEFAULT NULL,
  `weekly_goal` decimal(4,2) DEFAULT NULL,
  `onboarding_done` tinyint(1) DEFAULT '0',
  `computed_activity_level` varchar(20) DEFAULT NULL,
  `workouts_completed` int DEFAULT '0',
  `plans_completed` int DEFAULT '0',
  `avg_daily_steps` int DEFAULT '0',
  `streak_days` int DEFAULT '0',
  `last_activity_update` datetime DEFAULT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `location_updated_at` datetime DEFAULT NULL,
  `payment_phone_vodafone` varchar(30) DEFAULT NULL,
  `payment_phone_orange` varchar(30) DEFAULT NULL,
  `payment_phone_we` varchar(30) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'admin@fitwayhub.com','$2b$12$/5pPeum.vYz3s39kcq3LQerdj2ir0UY.EC4VSWJvhY5m1nd2iNSui','Admin','admin',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,0,NULL,NULL,'en','light','2026-04-06 00:13:27','2026-04-06 00:13:27',NULL,NULL,NULL,0,NULL,0,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(2,'coach@fitwayhub.com','$2b$12$lHRT8buN0T.bO/ouJefTZuCUuntflVbfLxLtBYxBLddH9sb0E.QFy','Coach Sarah','coach',NULL,'Certified fitness coach with 5 years experience',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,0,NULL,NULL,'en','light','2026-04-06 00:13:27','2026-04-06 00:13:27',NULL,NULL,NULL,0,NULL,0,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(3,'user@fitwayhub.com','$2b$12$UfK/froluxjjMr/oQ5F/H.hLGqT6LkqS8YQg.ncVPTDZlIm4/MrAW','John Doe','user',NULL,'Fitness enthusiast',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,0,NULL,NULL,'en','light','2026-04-06 00:13:27','2026-04-06 00:13:27',NULL,NULL,NULL,0,NULL,0,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `video_playlists`
--

DROP TABLE IF EXISTS `video_playlists`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `video_playlists` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `description` text,
  `thumbnail` text,
  `created_by` int NOT NULL,
  `is_public` tinyint(1) DEFAULT '1',
  `sort_order` int DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `video_playlists_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `video_playlists`
--

LOCK TABLES `video_playlists` WRITE;
/*!40000 ALTER TABLE `video_playlists` DISABLE KEYS */;
/*!40000 ALTER TABLE `video_playlists` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `website_sections`
--

DROP TABLE IF EXISTS `website_sections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `website_sections` (
  `id` int NOT NULL AUTO_INCREMENT,
  `page` varchar(50) NOT NULL DEFAULT 'home',
  `type` varchar(50) NOT NULL,
  `label` varchar(255) NOT NULL,
  `content` longtext NOT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `is_visible` tinyint(1) DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `website_sections`
--

LOCK TABLES `website_sections` WRITE;
/*!40000 ALTER TABLE `website_sections` DISABLE KEYS */;
/*!40000 ALTER TABLE `website_sections` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `website_translations`
--

DROP TABLE IF EXISTS `website_translations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `website_translations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `text_key` varchar(500) NOT NULL,
  `text_ar` text NOT NULL,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `text_key` (`text_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `website_translations`
--

LOCK TABLES `website_translations` WRITE;
/*!40000 ALTER TABLE `website_translations` DISABLE KEYS */;
/*!40000 ALTER TABLE `website_translations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `welcome_messages`
--

DROP TABLE IF EXISTS `welcome_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `welcome_messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `target` enum('user','coach') NOT NULL,
  `channel` enum('email','push','in_app') NOT NULL,
  `subject` varchar(255) NOT NULL DEFAULT '',
  `title` varchar(255) NOT NULL DEFAULT '',
  `body` longtext NOT NULL,
  `html_body` longtext,
  `enabled` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_target_channel` (`target`,`channel`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `welcome_messages`
--

LOCK TABLES `welcome_messages` WRITE;
/*!40000 ALTER TABLE `welcome_messages` DISABLE KEYS */;
/*!40000 ALTER TABLE `welcome_messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `withdrawal_requests`
--

DROP TABLE IF EXISTS `withdrawal_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `withdrawal_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `coach_id` int NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `payment_phone` varchar(30) DEFAULT NULL,
  `wallet_type` varchar(30) DEFAULT NULL,
  `payment_method_type` varchar(30) DEFAULT 'ewallet',
  `paypal_email` varchar(255) DEFAULT NULL,
  `card_holder_name` varchar(100) DEFAULT NULL,
  `card_number` varchar(30) DEFAULT NULL,
  `instapay_handle` varchar(100) DEFAULT NULL,
  `status` varchar(20) DEFAULT 'pending',
  `admin_note` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `processed_at` datetime DEFAULT NULL,
  `paymob_disbursement_id` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `coach_id` (`coach_id`),
  CONSTRAINT `withdrawal_requests_ibfk_1` FOREIGN KEY (`coach_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `withdrawal_requests`
--

LOCK TABLES `withdrawal_requests` WRITE;
/*!40000 ALTER TABLE `withdrawal_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `withdrawal_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `withdrawals`
--

DROP TABLE IF EXISTS `withdrawals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `withdrawals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `coach_id` int NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `status` enum('pending','approved','rejected','completed') DEFAULT 'pending',
  `payment_method` varchar(50) DEFAULT NULL,
  `payment_details` text,
  `admin_notes` text,
  `processed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `coach_id` (`coach_id`),
  CONSTRAINT `withdrawals_ibfk_1` FOREIGN KEY (`coach_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `withdrawals`
--

LOCK TABLES `withdrawals` WRITE;
/*!40000 ALTER TABLE `withdrawals` DISABLE KEYS */;
/*!40000 ALTER TABLE `withdrawals` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `workout_plans`
--

DROP TABLE IF EXISTS `workout_plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workout_plans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `coach_id` int NOT NULL,
  `athlete_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `plan_data` json DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `status` enum('draft','active','completed') DEFAULT 'draft',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `coach_id` (`coach_id`),
  KEY `athlete_id` (`athlete_id`),
  CONSTRAINT `workout_plans_ibfk_1` FOREIGN KEY (`coach_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `workout_plans_ibfk_2` FOREIGN KEY (`athlete_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `workout_plans`
--

LOCK TABLES `workout_plans` WRITE;
/*!40000 ALTER TABLE `workout_plans` DISABLE KEYS */;
/*!40000 ALTER TABLE `workout_plans` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `workout_playlists`
--

DROP TABLE IF EXISTS `workout_playlists`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workout_playlists` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text,
  `cover_image` varchar(500) DEFAULT NULL,
  `coach_id` int DEFAULT NULL,
  `is_public` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `coach_id` (`coach_id`),
  CONSTRAINT `workout_playlists_ibfk_1` FOREIGN KEY (`coach_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `workout_playlists`
--

LOCK TABLES `workout_playlists` WRITE;
/*!40000 ALTER TABLE `workout_playlists` DISABLE KEYS */;
/*!40000 ALTER TABLE `workout_playlists` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `workout_videos`
--

DROP TABLE IF EXISTS `workout_videos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workout_videos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `description` text,
  `url` text NOT NULL,
  `duration` varchar(20) DEFAULT NULL,
  `duration_seconds` int DEFAULT '0',
  `category` varchar(100) DEFAULT 'General',
  `is_premium` tinyint(1) DEFAULT '0',
  `is_short` tinyint(1) DEFAULT '0',
  `thumbnail` text,
  `coach_id` int DEFAULT NULL,
  `width` int DEFAULT '0',
  `height` int DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `source_type` varchar(20) DEFAULT 'upload',
  `youtube_url` text,
  `approval_status` varchar(20) DEFAULT 'approved',
  `submitted_by` int DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `rejection_reason` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `workout_videos`
--

LOCK TABLES `workout_videos` WRITE;
/*!40000 ALTER TABLE `workout_videos` DISABLE KEYS */;
/*!40000 ALTER TABLE `workout_videos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `workouts`
--

DROP TABLE IF EXISTS `workouts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workouts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `description` text,
  `category` varchar(100) DEFAULT NULL,
  `difficulty` enum('beginner','intermediate','advanced') DEFAULT 'beginner',
  `duration` int DEFAULT '0',
  `calories_burn` int DEFAULT '0',
  `video_url` varchar(500) DEFAULT NULL,
  `thumbnail` varchar(500) DEFAULT NULL,
  `coach_id` int DEFAULT NULL,
  `is_featured` tinyint(1) DEFAULT '0',
  `is_shorty` tinyint(1) DEFAULT '0',
  `view_count` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `coach_id` (`coach_id`),
  CONSTRAINT `workouts_ibfk_1` FOREIGN KEY (`coach_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `workouts`
--

LOCK TABLES `workouts` WRITE;
/*!40000 ALTER TABLE `workouts` DISABLE KEYS */;
INSERT INTO `workouts` VALUES (1,'Full Body HIIT','High-intensity interval training targeting all muscle groups','hiit','intermediate',30,350,NULL,NULL,2,0,0,0,'2026-04-06 00:13:27'),(2,'Morning Yoga Flow','Gentle yoga routine to start your day with energy','yoga','beginner',20,120,NULL,NULL,2,0,0,0,'2026-04-06 00:13:27'),(3,'Upper Body Strength','Build upper body strength with compound movements','strength','intermediate',45,280,NULL,NULL,2,0,0,0,'2026-04-06 00:13:27'),(4,'Core Crusher','Intense core workout for abs and obliques','core','advanced',25,200,NULL,NULL,2,0,0,0,'2026-04-06 00:13:27'),(5,'Cardio Blast','Heart-pumping cardio session for endurance','cardio','intermediate',35,400,NULL,NULL,2,0,0,0,'2026-04-06 00:13:27'),(6,'Leg Day Power','Comprehensive lower body workout with squats and lunges','strength','advanced',50,380,NULL,NULL,2,0,0,0,'2026-04-06 00:13:27'),(7,'Stretching & Recovery','Post-workout stretching and recovery routine','flexibility','beginner',15,60,NULL,NULL,2,0,0,0,'2026-04-06 00:13:27'),(8,'Boxing Fitness','Learn boxing basics while getting a killer workout','cardio','intermediate',40,450,NULL,NULL,2,0,0,0,'2026-04-06 00:13:27');
/*!40000 ALTER TABLE `workouts` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-03  2:58:46
