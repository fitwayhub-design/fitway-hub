-- FitWay Hub Database Backup
-- Generated: 2026-05-02T23:40:29.324Z
-- Database: defaultdb
-- --------------------------------------------------------

SET FOREIGN_KEY_CHECKS=0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';
SET time_zone = "+00:00";

-- --------------------------------------------------------
-- Table: `ad_ab_tests`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `ad_ab_tests`;
CREATE TABLE `ad_ab_tests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `coach_id` int NOT NULL,
  `campaign_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `status` enum('running','completed','cancelled') NOT NULL DEFAULT 'running',
  `variant_a_ad_id` int DEFAULT NULL,
  `variant_b_ad_id` int DEFAULT NULL,
  `traffic_split` decimal(3,2) DEFAULT '0.50' COMMENT '0.50 = 50/50 split',
  `winner_ad_id` int DEFAULT NULL,
  `confidence` decimal(5,4) DEFAULT NULL COMMENT 'statistical significance 0-1',
  `started_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `ended_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `campaign_id` (`campaign_id`),
  KEY `variant_a_ad_id` (`variant_a_ad_id`),
  KEY `variant_b_ad_id` (`variant_b_ad_id`),
  KEY `idx_abt_coach` (`coach_id`),
  CONSTRAINT `ad_ab_tests_ibfk_1` FOREIGN KEY (`coach_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ad_ab_tests_ibfk_2` FOREIGN KEY (`campaign_id`) REFERENCES `ad_campaigns` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ad_ab_tests_ibfk_3` FOREIGN KEY (`variant_a_ad_id`) REFERENCES `ad_ads` (`id`) ON DELETE SET NULL,
  CONSTRAINT `ad_ab_tests_ibfk_4` FOREIGN KEY (`variant_b_ad_id`) REFERENCES `ad_ads` (`id`) ON DELETE SET NULL
);

-- --------------------------------------------------------
-- Table: `ad_ads`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `ad_ads`;
CREATE TABLE `ad_ads` (
  `id` int NOT NULL AUTO_INCREMENT,
  `adset_id` int NOT NULL,
  `creative_id` int DEFAULT NULL,
  `name` varchar(255) NOT NULL DEFAULT 'Untitled Ad',
  `status` enum('draft','active','paused','archived','rejected') NOT NULL DEFAULT 'draft',
  `headline` varchar(255) DEFAULT NULL,
  `description` text,
  `cta_text` varchar(100) DEFAULT 'Book Now',
  `cta_url` varchar(500) DEFAULT NULL,
  `deep_link` varchar(500) DEFAULT NULL COMMENT 'FitWayHub deep link (fitwayhub://booking/123)',
  `booking_target_id` int DEFAULT NULL COMMENT 'FK to coaching_bookings type or class id',
  `ab_test_variant` varchar(10) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `creative_id` (`creative_id`),
  KEY `idx_ada_adset` (`adset_id`),
  CONSTRAINT `ad_ads_ibfk_1` FOREIGN KEY (`adset_id`) REFERENCES `ad_sets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ad_ads_ibfk_2` FOREIGN KEY (`creative_id`) REFERENCES `ad_creatives` (`id`) ON DELETE SET NULL
);

INSERT INTO `ad_ads` (`id`, `adset_id`, `creative_id`, `name`, `status`, `headline`, `description`, `cta_text`, `cta_url`, `deep_link`, `booking_target_id`, `ab_test_variant`, `created_at`, `updated_at`) VALUES
(1, 1, 1, 'Strength Program Ad A', 'active', '💪 Get 50% Off Your First Month', 'Join Coach Peter\'s strength program. Personalized plans, real results.', 'Book Now', '/app/coaching', 'fitwayhub://booking/coach/56', NULL, NULL, '2026-03-16 20:49:06', '2026-03-16 20:49:06'),
(2, 1, 2, 'Strength Program Ad B', 'active', '🏋️ Free Trial Session Today', 'Try a free session with Coach Peter. No commitment needed.', 'Try Free', '/app/coaching', 'fitwayhub://booking/coach/56', NULL, 'B', '2026-03-16 20:49:06', '2026-03-16 20:49:06'),
(3, 2, 2, 'Awareness Video Ad', 'draft', '🔥 Meet Your New Coach', 'Certified trainer with 5+ years experience. Watch to learn more.', 'Learn More', '/app/coaching', NULL, NULL, NULL, '2026-03-16 20:49:08', '2026-03-16 20:49:08');

-- --------------------------------------------------------
-- Table: `ad_approval_rules`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `ad_approval_rules`;
CREATE TABLE `ad_approval_rules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `rule_name` varchar(200) NOT NULL,
  `rule_type` enum('auto_approve','require_review','auto_reject','flag') DEFAULT 'require_review',
  `conditions` json DEFAULT NULL,
  `enabled` tinyint(1) DEFAULT '1',
  `priority` int DEFAULT '0',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

INSERT INTO `ad_approval_rules` (`id`, `rule_name`, `rule_type`, `conditions`, `enabled`, `priority`, `created_by`, `created_at`) VALUES
(1, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-22 18:47:14'),
(2, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-22 18:47:14'),
(3, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-22 18:47:15'),
(4, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-23 02:11:25'),
(5, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-23 02:11:25'),
(6, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-23 02:11:26'),
(7, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-23 02:49:42'),
(8, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-23 02:49:43'),
(9, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-23 02:49:43'),
(10, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-23 03:07:11'),
(11, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-23 03:07:11'),
(12, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-23 03:07:11'),
(13, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-23 03:27:00'),
(14, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-23 03:27:00'),
(15, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-23 03:27:00'),
(16, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-23 03:54:43'),
(17, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-23 03:54:43'),
(18, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-23 03:54:44'),
(19, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-23 04:27:49'),
(20, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-23 04:27:49'),
(21, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-23 04:27:50'),
(22, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-23 05:07:09'),
(23, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-23 05:07:09'),
(24, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-23 05:07:09'),
(25, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-23 05:14:13'),
(26, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-23 05:14:13'),
(27, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-23 05:14:14'),
(28, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-23 07:05:20'),
(29, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-23 07:05:21'),
(30, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-23 07:05:21'),
(31, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-23 16:26:57'),
(32, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-23 16:26:57'),
(33, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-23 16:26:57'),
(34, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-23 16:36:20'),
(35, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-23 16:36:21'),
(36, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-23 16:36:21'),
(37, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-23 17:10:22'),
(38, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-23 17:10:22'),
(39, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-23 17:10:23'),
(40, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-23 17:37:35'),
(41, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-23 17:37:36'),
(42, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-23 17:37:36'),
(43, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-23 18:40:06'),
(44, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-23 18:40:06'),
(45, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-23 18:40:06'),
(46, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-23 19:10:18'),
(47, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-23 19:10:19'),
(48, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-23 19:10:19'),
(49, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-27 11:18:27'),
(50, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-27 11:18:28'),
(51, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-27 11:18:28'),
(52, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-27 12:14:37'),
(53, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-27 12:14:37'),
(54, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-27 12:14:38'),
(55, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-27 17:18:37'),
(56, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-27 17:18:37'),
(57, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-27 17:18:38'),
(58, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-27 17:59:37'),
(59, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-27 17:59:39'),
(60, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-27 17:59:41'),
(61, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-27 19:09:07'),
(62, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-27 19:09:07'),
(63, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-27 19:09:07'),
(64, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 11:47:58'),
(65, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 11:47:58'),
(66, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 11:47:58'),
(67, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 12:45:08'),
(68, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 12:45:09'),
(69, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 12:45:09'),
(70, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 12:51:29'),
(71, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 12:51:29'),
(72, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 12:51:29'),
(73, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 13:00:56'),
(74, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 13:00:56'),
(75, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 13:00:56'),
(76, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 13:07:43'),
(77, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 13:07:44'),
(78, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 13:07:44'),
(79, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 13:14:30'),
(80, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 13:14:30'),
(81, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 13:14:30'),
(82, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 13:21:40'),
(83, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 13:21:41'),
(84, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 13:21:42'),
(85, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 13:28:26'),
(86, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 13:28:26'),
(87, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 13:28:26'),
(88, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 13:35:29'),
(89, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 13:35:30'),
(90, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 13:35:30'),
(91, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 13:42:42'),
(92, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 13:42:42'),
(93, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 13:42:42'),
(94, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 13:48:53'),
(95, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 13:48:53'),
(96, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 13:48:54'),
(97, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 13:55:44'),
(98, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 13:55:44'),
(99, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 13:55:45'),
(100, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 14:02:05'),
(101, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 14:02:05'),
(102, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 14:02:06'),
(103, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 14:08:50'),
(104, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 14:08:50'),
(105, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 14:08:51'),
(106, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 14:15:06'),
(107, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 14:15:07'),
(108, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 14:15:07'),
(109, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 14:21:17'),
(110, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 14:21:17'),
(111, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 14:21:18'),
(112, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 14:28:19'),
(113, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 14:28:19'),
(114, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 14:28:19'),
(115, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 14:34:00'),
(116, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 14:34:01'),
(117, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 14:34:01'),
(118, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 14:42:09'),
(119, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 14:42:10'),
(120, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 14:42:10'),
(121, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 15:16:24'),
(122, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 15:16:27'),
(123, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 15:16:30'),
(124, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 15:31:08'),
(125, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 15:31:08'),
(126, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 15:31:08'),
(127, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 15:39:25'),
(128, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 15:39:26'),
(129, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 15:39:26'),
(130, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 15:46:45'),
(131, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 15:46:46'),
(132, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 15:46:46'),
(133, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 15:55:02'),
(134, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 15:55:02'),
(135, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 15:55:03'),
(136, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 16:02:18'),
(137, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 16:02:19'),
(138, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 16:02:19'),
(139, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 16:09:10'),
(140, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 16:09:11'),
(141, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 16:09:11'),
(142, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 16:16:00'),
(143, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 16:16:00'),
(144, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 16:16:01'),
(145, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 16:23:24'),
(146, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 16:23:24'),
(147, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 16:23:25'),
(148, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 16:30:04'),
(149, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 16:30:04'),
(150, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 16:30:05'),
(151, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 16:36:37'),
(152, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 16:36:37'),
(153, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 16:36:38'),
(154, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 16:51:35'),
(155, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 16:51:36'),
(156, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 16:51:37'),
(157, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 18:23:54'),
(158, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 18:23:54'),
(159, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 18:23:55'),
(160, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 18:31:32'),
(161, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 18:31:32'),
(162, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 18:31:33'),
(163, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 18:38:40'),
(164, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 18:38:40'),
(165, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 18:38:41'),
(166, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 19:03:35'),
(167, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 19:03:35'),
(168, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 19:03:35'),
(169, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 19:13:49'),
(170, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 19:13:49'),
(171, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 19:13:50'),
(172, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 19:25:48'),
(173, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 19:25:49'),
(174, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 19:25:49'),
(175, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-29 19:28:20'),
(176, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-29 19:28:20'),
(177, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-29 19:28:20'),
(178, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-30 05:51:23'),
(179, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-30 05:51:24'),
(180, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-30 05:51:25'),
(181, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-30 06:16:29'),
(182, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-30 06:16:29'),
(183, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-30 06:16:30'),
(184, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-30 06:47:20'),
(185, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-30 06:47:20'),
(186, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-30 06:47:20'),
(187, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-30 06:56:25'),
(188, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-30 06:56:26'),
(189, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-30 06:56:26'),
(190, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-30 09:04:05'),
(191, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-30 09:04:05'),
(192, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-30 09:04:05'),
(193, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-30 09:14:31'),
(194, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-30 09:14:31'),
(195, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-30 09:14:32'),
(196, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-30 09:17:02'),
(197, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-30 09:17:03'),
(198, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-30 09:17:03'),
(199, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-30 09:21:45'),
(200, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-30 09:21:45'),
(201, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-30 09:21:45'),
(202, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-30 09:27:00'),
(203, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-30 09:27:00'),
(204, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-30 09:27:01'),
(205, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-30 09:34:17'),
(206, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-30 09:34:18'),
(207, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-30 09:34:18'),
(208, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-30 09:41:38'),
(209, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-30 09:41:38'),
(210, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-30 09:41:38'),
(211, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-30 17:33:00'),
(212, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-30 17:33:01'),
(213, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-30 17:33:01'),
(214, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-30 22:43:22'),
(215, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-30 22:43:22'),
(216, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-30 22:43:23'),
(217, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-03-31 20:39:11'),
(218, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-03-31 20:39:11'),
(219, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-03-31 20:39:11'),
(220, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-04 11:21:54'),
(221, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-04 11:21:54'),
(222, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-04 11:21:55'),
(223, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-04 17:44:47'),
(224, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-04 17:44:47'),
(225, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-04 17:44:47'),
(226, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-04 17:51:53'),
(227, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-04 17:51:53'),
(228, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-04 17:51:54'),
(229, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-04 18:21:33'),
(230, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-04 18:21:34'),
(231, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-04 18:21:34'),
(232, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-04 20:46:18'),
(233, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-04 20:46:18'),
(234, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-04 20:46:19'),
(235, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-04 21:01:18'),
(236, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-04 21:01:18'),
(237, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-04 21:01:19'),
(238, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-04 21:35:59'),
(239, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-04 21:36:00'),
(240, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-04 21:36:00'),
(241, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-04 21:36:31'),
(242, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-04 21:36:31'),
(243, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-04 21:36:31'),
(244, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-04 21:57:19'),
(245, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-04 21:57:20'),
(246, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-04 21:57:20'),
(247, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-05 18:34:51'),
(248, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-05 18:34:52'),
(249, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-05 18:34:52'),
(250, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-05 22:27:45'),
(251, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-05 22:27:45'),
(252, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-05 22:27:46'),
(253, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-06 11:41:13'),
(254, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-06 11:41:14'),
(255, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-06 11:41:14'),
(256, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-06 11:55:40'),
(257, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-06 11:55:40'),
(258, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-06 11:55:40'),
(259, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-06 12:05:02'),
(260, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-06 12:05:03'),
(261, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-06 12:05:03'),
(262, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-06 12:12:15'),
(263, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-06 12:12:15'),
(264, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-06 12:12:15'),
(265, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-06 12:18:37'),
(266, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-06 12:18:38'),
(267, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-06 12:18:38'),
(268, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-06 12:23:39'),
(269, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-06 12:23:39'),
(270, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-06 12:23:39'),
(271, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-06 12:28:18'),
(272, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-06 12:28:18'),
(273, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-06 12:28:19'),
(274, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-06 12:33:56'),
(275, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-06 12:33:56'),
(276, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-06 12:33:56'),
(277, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-06 15:22:17'),
(278, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-06 15:22:17'),
(279, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-06 15:22:18'),
(280, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-06 20:35:06'),
(281, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-06 20:35:06'),
(282, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-06 20:35:06'),
(283, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-06 21:58:13'),
(284, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-06 21:58:14'),
(285, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-06 21:58:14'),
(286, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-06 22:25:05'),
(287, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-06 22:25:05'),
(288, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-06 22:25:05'),
(289, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-07 07:04:00'),
(290, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-07 07:04:01'),
(291, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-07 07:04:01'),
(292, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-07 12:59:54'),
(293, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-07 12:59:55'),
(294, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-07 12:59:55'),
(295, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-08 05:54:33'),
(296, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-08 05:54:33'),
(297, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-08 05:54:34'),
(298, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-09 13:26:53'),
(299, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-09 13:26:54'),
(300, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-09 13:26:54'),
(301, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-10 07:03:28'),
(302, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-10 07:03:28'),
(303, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-10 07:03:29'),
(304, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-10 08:12:54'),
(305, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-10 08:12:54'),
(306, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-10 08:12:54'),
(307, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-10 08:34:31'),
(308, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-10 08:34:32'),
(309, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-10 08:34:32'),
(310, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-10 11:25:52'),
(311, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-10 11:25:52'),
(312, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-10 11:25:52'),
(313, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-10 12:14:34'),
(314, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-10 12:14:34'),
(315, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-10 12:14:34'),
(316, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-10 13:22:54'),
(317, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-10 13:22:54'),
(318, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-10 13:22:55'),
(319, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-20 16:13:44'),
(320, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-20 16:13:45'),
(321, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-20 16:13:45'),
(322, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-21 10:41:52'),
(323, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-21 10:41:52'),
(324, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-21 10:41:53'),
(325, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-22 09:41:17'),
(326, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-22 09:41:18'),
(327, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-22 09:41:18'),
(328, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-24 19:09:37'),
(329, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-24 19:09:37'),
(330, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-24 19:09:38'),
(331, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-26 17:51:42'),
(332, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-26 17:51:43'),
(333, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-26 17:51:43'),
(334, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-04-28 21:47:24'),
(335, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-04-28 21:47:24'),
(336, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-04-28 21:47:24'),
(337, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-05-01 15:17:20'),
(338, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-05-01 15:17:20'),
(339, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-05-01 15:17:21'),
(340, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-05-02 10:18:31'),
(341, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-05-02 10:18:32'),
(342, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-05-02 10:18:32'),
(343, 'Auto-approve verified coaches with good standing', 'auto_approve', '{}', 1, 10, NULL, '2026-05-02 20:37:59'),
(344, 'Flag campaigns with prohibited keywords', 'flag', '{}', 1, 5, NULL, '2026-05-02 20:37:59'),
(345, 'Require review for budgets over 2000 EGP', 'require_review', '{}', 1, 3, NULL, '2026-05-02 20:38:00');

-- --------------------------------------------------------
-- Table: `ad_audit_logs`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `ad_audit_logs`;
CREATE TABLE `ad_audit_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `user_role` varchar(50) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `entity_type` varchar(50) NOT NULL COMMENT 'campaign, adset, ad, creative, rule, etc.',
  `entity_id` int DEFAULT NULL,
  `details` json DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `actor_id` int DEFAULT NULL,
  `actor_role` varchar(30) DEFAULT NULL,
  `old_state` json DEFAULT NULL,
  `new_state` json DEFAULT NULL,
  `user_agent` text,
  PRIMARY KEY (`id`),
  KEY `idx_aal_user` (`user_id`),
  KEY `idx_aal_entity` (`entity_type`,`entity_id`),
  KEY `idx_aal_created` (`created_at`),
  CONSTRAINT `ad_audit_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);

-- --------------------------------------------------------
-- Table: `ad_billing_transactions`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `ad_billing_transactions`;
CREATE TABLE `ad_billing_transactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `coach_id` int NOT NULL,
  `campaign_id` int DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `type` enum('charge','refund','credit','adjustment') NOT NULL DEFAULT 'charge',
  `description` varchar(500) DEFAULT NULL,
  `payment_method` varchar(50) DEFAULT 'wallet',
  `reference_id` varchar(100) DEFAULT NULL,
  `status` enum('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `campaign_id` (`campaign_id`),
  KEY `idx_abt_coach` (`coach_id`),
  KEY `idx_abt_status` (`status`),
  CONSTRAINT `ad_billing_transactions_ibfk_1` FOREIGN KEY (`coach_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ad_billing_transactions_ibfk_2` FOREIGN KEY (`campaign_id`) REFERENCES `ad_campaigns` (`id`) ON DELETE SET NULL
);

INSERT INTO `ad_billing_transactions` (`id`, `coach_id`, `campaign_id`, `amount`, `type`, `description`, `payment_method`, `reference_id`, `status`, `created_at`) VALUES
(1, 56, 1, '100.00', 'charge', 'Initial campaign funding', 'wallet', NULL, 'completed', '2026-03-16 20:49:28');

-- --------------------------------------------------------
-- Table: `ad_campaigns`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `ad_campaigns`;
CREATE TABLE `ad_campaigns` (
  `id` int NOT NULL AUTO_INCREMENT,
  `coach_id` int NOT NULL,
  `org_id` int DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `objective` enum('bookings','class_signups','package_purchases','profile_boosts','event_promotion','app_installs','awareness') NOT NULL DEFAULT 'bookings',
  `status` enum('draft','active','paused','pending_approval','archived','rejected') NOT NULL DEFAULT 'draft',
  `budget_total` decimal(12,2) DEFAULT '0.00',
  `budget_spent` decimal(12,2) DEFAULT '0.00',
  `start_at` datetime DEFAULT NULL,
  `end_at` datetime DEFAULT NULL,
  `admin_note` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `daily_budget` decimal(10,2) DEFAULT '0.00',
  `lifetime_budget` decimal(10,2) DEFAULT '0.00',
  `budget_type` enum('daily','lifetime') DEFAULT 'daily',
  `amount_spent` decimal(10,2) DEFAULT '0.00',
  `schedule_start` date DEFAULT NULL,
  `schedule_end` date DEFAULT NULL,
  `reviewed_by` int DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_adc_coach` (`coach_id`),
  KEY `idx_adc_status` (`status`),
  CONSTRAINT `ad_campaigns_ibfk_1` FOREIGN KEY (`coach_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);

INSERT INTO `ad_campaigns` (`id`, `coach_id`, `org_id`, `name`, `objective`, `status`, `budget_total`, `budget_spent`, `start_at`, `end_at`, `admin_note`, `created_at`, `updated_at`, `daily_budget`, `lifetime_budget`, `budget_type`, `amount_spent`, `schedule_start`, `schedule_end`, `reviewed_by`, `reviewed_at`) VALUES
(1, 56, NULL, 'Summer Strength Program Launch', 'bookings', 'paused', '500.00', '0.00', '2026-03-16 20:49:05', '2026-04-15 20:49:05', NULL, '2026-03-16 20:49:05', '2026-04-10 09:08:21', '500.00', '0.00', 'daily', '0.00', '2026-03-15 22:00:00', '2026-04-14 22:00:00', 936, '2026-04-10 09:08:21'),
(2, 56, NULL, 'Brand Awareness - New Coach', 'awareness', 'draft', '200.00', '0.00', '2026-03-23 20:49:07', '2026-04-22 20:49:07', NULL, '2026-03-16 20:49:07', '2026-03-30 09:34:01', '200.00', '0.00', 'daily', '0.00', '2026-03-22 22:00:00', '2026-04-21 22:00:00', NULL, NULL),
(3, 288, NULL, 'Transformation Strength 2025', 'awareness', 'paused', '0.00', '0.00', NULL, NULL, NULL, '2026-03-10 15:38:48', '2026-04-06 21:02:29', '0.00', '0.00', 'daily', '0.00', NULL, NULL, 936, '2026-04-06 21:02:29'),
(4, 369, NULL, 'Summer Fat Loss 2025', 'bookings', 'paused', '0.00', '0.00', NULL, NULL, NULL, '2026-03-17 15:59:07', '2026-05-15 15:59:07', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(5, 396, NULL, 'Summer Wellness 2025', 'bookings', 'paused', '0.00', '0.00', NULL, NULL, NULL, '2026-02-24 16:05:19', '2026-05-24 16:05:19', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(6, 450, NULL, 'Ramadan Body 2024', 'bookings', 'draft', '0.00', '0.00', NULL, NULL, NULL, '2026-02-25 16:18:15', '2026-05-14 16:18:15', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(7, 477, NULL, 'Power Wellness 2024', 'bookings', 'draft', '0.00', '0.00', NULL, NULL, NULL, '2026-02-08 16:25:19', '2026-05-13 16:25:19', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(8, 504, NULL, 'Summer Coaching 2026', 'bookings', 'draft', '0.00', '0.00', NULL, NULL, NULL, '2026-03-06 16:31:21', '2026-04-20 16:31:21', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(9, 531, NULL, 'Transformation Strength 2025', 'bookings', 'draft', '0.00', '0.00', NULL, NULL, NULL, '2026-02-25 16:37:07', '2026-05-11 16:37:07', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(10, 558, NULL, 'Transformation Coaching 2025', 'bookings', 'draft', '0.00', '0.00', NULL, NULL, NULL, '2026-02-26 16:53:25', '2026-04-18 16:53:25', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(11, 639, NULL, 'Transformation Wellness 2026', 'bookings', 'draft', '0.00', '0.00', NULL, NULL, NULL, '2026-03-17 17:43:03', '2026-05-07 17:43:03', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(12, 666, NULL, 'Transformation Coaching 2024', 'bookings', 'draft', '0.00', '0.00', NULL, NULL, NULL, '2026-02-02 17:50:02', '2026-04-02 17:50:02', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(13, 693, NULL, 'Ramadan Body 2025', 'bookings', 'paused', '0.00', '0.00', NULL, NULL, NULL, '2026-03-29 15:58:31', '2026-03-29 15:58:31', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(14, 720, NULL, 'Yoga Strength 2025', 'bookings', 'paused', '0.00', '0.00', NULL, NULL, NULL, '2026-03-29 16:05:41', '2026-04-06 21:02:11', '0.00', '0.00', 'daily', '0.00', NULL, NULL, 936, '2026-04-06 21:02:11'),
(15, 747, NULL, 'Challenge Fat Loss 2026', 'awareness', 'paused', '0.00', '0.00', NULL, NULL, NULL, '2026-03-29 16:12:44', '2026-04-06 21:02:11', '0.00', '0.00', 'daily', '0.00', NULL, NULL, 936, '2026-04-06 21:02:11'),
(16, 774, NULL, 'Summer Coaching 2025', 'bookings', 'paused', '0.00', '0.00', NULL, NULL, NULL, '2026-03-29 16:19:28', '2026-04-06 21:03:57', '0.00', '0.00', 'daily', '0.00', NULL, NULL, 936, '2026-04-06 21:03:57'),
(17, 801, NULL, 'Power Strength 2025', 'bookings', 'draft', '0.00', '0.00', NULL, NULL, NULL, '2026-03-08 18:26:32', '2026-04-23 18:26:32', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(18, 828, NULL, 'Power Coaching 2024', 'bookings', 'draft', '0.00', '0.00', NULL, NULL, NULL, '2026-03-14 18:33:20', '2026-04-10 18:33:20', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(19, 855, NULL, 'Transformation Body 2025', 'awareness', 'active', '0.00', '0.00', NULL, NULL, NULL, '2026-02-21 18:40:21', '2026-04-06 18:40:21', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(20, 855, NULL, 'Transformation Coaching 2026', 'bookings', 'paused', '0.00', '0.00', NULL, NULL, NULL, '2026-02-01 18:40:27', '2026-04-13 18:40:27', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(21, 856, NULL, 'Summer Coaching 2025', 'bookings', 'draft', '0.00', '0.00', NULL, NULL, NULL, '2026-02-16 18:40:34', '2026-04-23 18:40:34', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(22, 856, NULL, 'Summer Wellness 2024', 'bookings', 'active', '0.00', '0.00', NULL, NULL, NULL, '2026-01-31 18:40:42', '2026-05-25 18:40:42', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(23, 856, NULL, 'Ramadan Fat Loss 2024', 'bookings', 'paused', '0.00', '0.00', NULL, NULL, NULL, '2026-03-17 18:40:49', '2026-04-06 21:02:23', '0.00', '0.00', 'daily', '0.00', NULL, NULL, 936, '2026-04-06 21:02:23'),
(24, 857, NULL, 'Transformation Strength 2025', 'bookings', 'paused', '0.00', '0.00', NULL, NULL, NULL, '2026-01-29 18:40:55', '2026-05-01 18:40:55', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(25, 857, NULL, 'Challenge Fat Loss 2024', 'bookings', 'active', '0.00', '0.00', NULL, NULL, NULL, '2026-02-11 18:41:25', '2026-04-27 18:41:25', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(26, 858, NULL, 'Ramadan Body 2025', 'bookings', 'paused', '0.00', '0.00', NULL, NULL, NULL, '2026-03-17 18:42:07', '2026-04-06 21:02:21', '0.00', '0.00', 'daily', '0.00', NULL, NULL, 936, '2026-04-06 21:02:21'),
(27, 858, NULL, 'Ramadan Body 2025', 'awareness', 'active', '0.00', '0.00', NULL, NULL, NULL, '2026-02-09 18:42:47', '2026-04-05 18:42:47', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(28, 882, NULL, 'Summer Coaching 2026', 'bookings', 'draft', '0.00', '0.00', NULL, NULL, NULL, '2026-02-27 18:58:18', '2026-04-28 18:58:18', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(29, 882, NULL, 'Ramadan Fat Loss 2024', 'awareness', 'paused', '0.00', '0.00', NULL, NULL, NULL, '2026-02-04 18:59:37', '2026-05-12 18:59:37', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(30, 883, NULL, 'Ramadan Fat Loss 2026', 'bookings', 'active', '0.00', '0.00', NULL, NULL, NULL, '2026-02-15 18:59:57', '2026-05-12 18:59:57', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(31, 883, NULL, 'Transformation Strength 2026', 'bookings', 'active', '0.00', '0.00', NULL, NULL, NULL, '2026-01-30 19:00:06', '2026-04-21 19:00:06', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(32, 884, NULL, 'Yoga Wellness 2026', 'bookings', 'draft', '0.00', '0.00', NULL, NULL, NULL, '2026-02-19 19:00:32', '2026-05-26 19:00:32', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(33, 884, NULL, 'Summer Coaching 2025', 'bookings', 'draft', '0.00', '0.00', NULL, NULL, NULL, '2026-03-09 19:01:00', '2026-04-26 19:01:00', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(34, 885, NULL, 'Challenge Body 2026', 'bookings', 'active', '0.00', '0.00', NULL, NULL, NULL, '2026-01-31 19:01:16', '2026-05-08 19:01:16', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(35, 885, NULL, 'Transformation Strength 2024', 'bookings', 'paused', '0.00', '0.00', NULL, NULL, NULL, '2026-02-27 19:01:34', '2026-04-28 19:01:34', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(36, 885, NULL, 'Ramadan Coaching 2025', 'awareness', 'active', '0.00', '0.00', NULL, NULL, NULL, '2026-02-03 19:01:58', '2026-05-14 19:01:58', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(37, 909, NULL, 'Ramadan Strength 2025', 'bookings', 'paused', '0.00', '0.00', NULL, NULL, NULL, '2026-02-05 20:43:17', '2026-04-09 20:43:17', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(38, 909, NULL, 'Challenge Strength 2024', 'awareness', 'paused', '0.00', '0.00', NULL, NULL, NULL, '2026-03-18 20:43:48', '2026-04-06 21:02:14', '0.00', '0.00', 'daily', '0.00', NULL, NULL, 936, '2026-04-06 21:02:14'),
(39, 910, NULL, 'Power Wellness 2026', 'bookings', 'active', '0.00', '0.00', NULL, NULL, NULL, '2026-02-12 20:43:59', '2026-04-19 20:43:59', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(40, 910, NULL, 'Summer Fat Loss 2026', 'bookings', 'active', '0.00', '0.00', NULL, NULL, NULL, '2026-03-07 20:44:04', '2026-05-21 20:44:04', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(41, 910, NULL, 'Ramadan Coaching 2026', 'bookings', 'active', '0.00', '0.00', NULL, NULL, NULL, '2026-02-02 20:44:20', '2026-04-26 20:44:20', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(42, 911, NULL, 'Ramadan Body 2024', 'bookings', 'draft', '0.00', '0.00', NULL, NULL, NULL, '2026-02-07 20:44:32', '2026-05-03 20:44:32', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(43, 911, NULL, 'Power Body 2025', 'bookings', 'draft', '0.00', '0.00', NULL, NULL, NULL, '2026-02-01 20:44:38', '2026-05-16 20:44:38', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(44, 912, NULL, 'Transformation Strength 2026', 'bookings', 'archived', '0.00', '0.00', NULL, NULL, NULL, '2026-03-17 20:44:48', '2026-04-05 02:22:50', '0.00', '0.00', 'daily', '0.00', NULL, NULL, 908, '2026-04-05 02:22:50'),
(45, 912, NULL, 'Challenge Strength 2025', 'bookings', 'paused', '0.00', '0.00', NULL, NULL, NULL, '2026-03-05 20:44:53', '2026-05-04 20:44:53', '0.00', '0.00', 'daily', '0.00', NULL, NULL, NULL, NULL),
(46, 937, NULL, 'Summer Coaching 2025', 'bookings', 'active', '0.00', '0.00', NULL, NULL, NULL, '2026-02-15 13:58:38', '2026-05-07 13:58:38', '1845.00', '0.00', 'daily', '0.00', '2026-02-14 22:00:00', '2026-05-06 21:00:00', NULL, NULL);

-- --------------------------------------------------------
-- Table: `ad_creatives`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `ad_creatives`;
CREATE TABLE `ad_creatives` (
  `id` int NOT NULL AUTO_INCREMENT,
  `owner_id` int NOT NULL,
  `type` enum('image','video','carousel','stories','dynamic_template') NOT NULL DEFAULT 'image',
  `name` varchar(255) NOT NULL DEFAULT 'Untitled',
  `s3_path` varchar(500) DEFAULT NULL,
  `media_url` varchar(500) DEFAULT NULL,
  `thumbnail_url` varchar(500) DEFAULT NULL,
  `metadata` json DEFAULT NULL COMMENT 'dimensions, duration, carousel items, template config',
  `preview_urls` json DEFAULT NULL,
  `version` int DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `coach_id` int DEFAULT NULL,
  `format` enum('image','video','carousel','text') DEFAULT 'image',
  `file_size_kb` int DEFAULT NULL,
  `width` int DEFAULT NULL,
  `height` int DEFAULT NULL,
  `duration_seconds` int DEFAULT NULL,
  `carousel_items` json DEFAULT NULL,
  `template_id` int DEFAULT NULL,
  `status` enum('draft','active','archived') DEFAULT 'draft',
  PRIMARY KEY (`id`),
  KEY `idx_adc_owner` (`owner_id`),
  CONSTRAINT `ad_creatives_ibfk_1` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);

INSERT INTO `ad_creatives` (`id`, `owner_id`, `type`, `name`, `s3_path`, `media_url`, `thumbnail_url`, `metadata`, `preview_urls`, `version`, `created_at`, `updated_at`, `coach_id`, `format`, `file_size_kb`, `width`, `height`, `duration_seconds`, `carousel_items`, `template_id`, `status`) VALUES
(1, 56, 'image', 'Summer Strength Banner', NULL, '/uploads/sample-ad-banner.jpg', NULL, '{}', NULL, 1, '2026-03-16 20:48:56', '2026-03-30 09:33:58', 56, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(2, 56, 'video', 'HIIT Class Promo', NULL, '/uploads/sample-ad-video.mp4', NULL, '{}', NULL, 1, '2026-03-16 20:48:56', '2026-03-30 09:33:58', 56, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(3, 828, 'image', 'Power Coaching 2024 creative', NULL, 'https://fitwayhub.com/assets/ads/creative4.mp4', NULL, NULL, NULL, 1, '2026-03-14 18:33:20', '2026-03-30 09:33:58', 828, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(4, 855, 'image', 'Transformation Body 2025 creative', NULL, 'https://fitwayhub.com/assets/ads/creative1.mp4', NULL, NULL, NULL, 1, '2026-02-21 18:40:21', '2026-03-30 09:33:58', 855, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(5, 855, 'image', 'Transformation Coaching 2026 creative', NULL, 'https://fitwayhub.com/assets/ads/creative6.jpg', NULL, NULL, NULL, 1, '2026-02-01 18:40:27', '2026-03-30 09:33:58', 855, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(6, 855, 'image', 'Transformation Coaching 2026 creative', NULL, 'https://fitwayhub.com/assets/ads/creative7.jpg', NULL, NULL, NULL, 1, '2026-02-01 18:40:27', '2026-03-30 09:33:58', 855, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(7, 855, 'image', 'Transformation Coaching 2026 creative', NULL, 'https://fitwayhub.com/assets/ads/creative10.jpg', NULL, NULL, NULL, 1, '2026-02-01 18:40:27', '2026-03-30 09:33:58', 855, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(8, 856, 'image', 'Summer Coaching 2025 creative', NULL, 'https://fitwayhub.com/assets/ads/creative3.mp4', NULL, NULL, NULL, 1, '2026-02-16 18:40:34', '2026-03-30 09:33:58', 856, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(9, 856, 'image', 'Summer Coaching 2025 creative', NULL, 'https://fitwayhub.com/assets/ads/creative1.mp4', NULL, NULL, NULL, 1, '2026-02-16 18:40:34', '2026-03-30 09:33:58', 856, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(10, 856, 'image', 'Summer Coaching 2025 creative', NULL, 'https://fitwayhub.com/assets/ads/creative2.mp4', NULL, NULL, NULL, 1, '2026-02-16 18:40:34', '2026-03-30 09:33:58', 856, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(11, 856, 'image', 'Summer Wellness 2024 creative', NULL, 'https://fitwayhub.com/assets/ads/creative2.mp4', NULL, NULL, NULL, 1, '2026-01-31 18:40:42', '2026-03-30 09:33:58', 856, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(12, 856, 'image', 'Summer Wellness 2024 creative', NULL, 'https://fitwayhub.com/assets/ads/creative5.mp4', NULL, NULL, NULL, 1, '2026-01-31 18:40:42', '2026-03-30 09:33:58', 856, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(13, 856, 'image', 'Summer Wellness 2024 creative', NULL, 'https://fitwayhub.com/assets/ads/creative3.mp4', NULL, NULL, NULL, 1, '2026-01-31 18:40:42', '2026-03-30 09:33:58', 856, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(14, 856, 'image', 'Ramadan Fat Loss 2024 creative', NULL, 'https://fitwayhub.com/assets/ads/creative6.jpg', NULL, NULL, NULL, 1, '2026-03-17 18:40:49', '2026-03-30 09:33:58', 856, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(15, 856, 'image', 'Ramadan Fat Loss 2024 creative', NULL, 'https://fitwayhub.com/assets/ads/creative5.mp4', NULL, NULL, NULL, 1, '2026-03-17 18:40:49', '2026-03-30 09:33:58', 856, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(16, 857, 'image', 'Transformation Strength 2025 creative', NULL, 'https://fitwayhub.com/assets/ads/creative3.mp4', NULL, NULL, NULL, 1, '2026-01-29 18:40:55', '2026-03-30 09:33:58', 857, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(17, 857, 'image', 'Transformation Strength 2025 creative', NULL, 'https://fitwayhub.com/assets/ads/creative1.mp4', NULL, NULL, NULL, 1, '2026-01-29 18:40:55', '2026-03-30 09:33:58', 857, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(18, 857, 'image', 'Transformation Strength 2025 creative', NULL, 'https://fitwayhub.com/assets/ads/creative4.jpg', NULL, NULL, NULL, 1, '2026-01-29 18:40:55', '2026-03-30 09:33:58', 857, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(19, 857, 'image', 'Challenge Fat Loss 2024 creative', NULL, 'https://fitwayhub.com/assets/ads/creative4.mp4', NULL, NULL, NULL, 1, '2026-02-11 18:41:25', '2026-03-30 09:33:58', 857, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(20, 857, 'image', 'Challenge Fat Loss 2024 creative', NULL, 'https://fitwayhub.com/assets/ads/creative5.mp4', NULL, NULL, NULL, 1, '2026-02-11 18:41:25', '2026-03-30 09:33:58', 857, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(21, 857, 'image', 'Challenge Fat Loss 2024 creative', NULL, 'https://fitwayhub.com/assets/ads/creative4.mp4', NULL, NULL, NULL, 1, '2026-02-11 18:41:25', '2026-03-30 09:33:58', 857, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(22, 857, 'image', 'Challenge Fat Loss 2024 creative', NULL, 'https://fitwayhub.com/assets/ads/creative4.mp4', NULL, NULL, NULL, 1, '2026-02-11 18:41:25', '2026-03-30 09:33:58', 857, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(23, 858, 'image', 'Ramadan Body 2025 creative', NULL, 'https://fitwayhub.com/assets/ads/creative5.mp4', NULL, NULL, NULL, 1, '2026-03-17 18:42:07', '2026-03-30 09:33:58', 858, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(24, 858, 'image', 'Ramadan Body 2025 creative', NULL, 'https://fitwayhub.com/assets/ads/creative5.jpg', NULL, NULL, NULL, 1, '2026-03-17 18:42:07', '2026-03-30 09:33:58', 858, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(25, 858, 'image', 'Ramadan Body 2025 creative', NULL, 'https://fitwayhub.com/assets/ads/creative5.mp4', NULL, NULL, NULL, 1, '2026-03-17 18:42:07', '2026-03-30 09:33:58', 858, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(26, 858, 'image', 'Ramadan Body 2025 creative', NULL, 'https://fitwayhub.com/assets/ads/creative8.jpg', NULL, NULL, NULL, 1, '2026-02-09 18:42:47', '2026-03-30 09:33:58', 858, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(27, 858, 'image', 'Ramadan Body 2025 creative', NULL, 'https://fitwayhub.com/assets/ads/creative3.mp4', NULL, NULL, NULL, 1, '2026-02-09 18:42:47', '2026-03-30 09:33:58', 858, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(28, 858, 'image', 'Ramadan Body 2025 creative', NULL, 'https://fitwayhub.com/assets/ads/creative7.jpg', NULL, NULL, NULL, 1, '2026-02-09 18:42:47', '2026-03-30 09:33:58', 858, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(29, 882, 'image', 'Summer Coaching 2026 creative', NULL, 'https://fitwayhub.com/assets/ads/creative4.mp4', NULL, NULL, NULL, 1, '2026-02-27 18:58:18', '2026-03-30 09:33:58', 882, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(30, 882, 'image', 'Summer Coaching 2026 creative', NULL, 'https://fitwayhub.com/assets/ads/creative4.mp4', NULL, NULL, NULL, 1, '2026-02-27 18:58:18', '2026-03-30 09:33:58', 882, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(31, 882, 'image', 'Ramadan Fat Loss 2024 creative', NULL, 'https://fitwayhub.com/assets/ads/creative3.mp4', NULL, NULL, NULL, 1, '2026-02-04 18:59:37', '2026-03-30 09:33:58', 882, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(32, 882, 'image', 'Ramadan Fat Loss 2024 creative', NULL, 'https://fitwayhub.com/assets/ads/creative6.jpg', NULL, NULL, NULL, 1, '2026-02-04 18:59:37', '2026-03-30 09:33:58', 882, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(33, 882, 'image', 'Ramadan Fat Loss 2024 creative', NULL, 'https://fitwayhub.com/assets/ads/creative4.mp4', NULL, NULL, NULL, 1, '2026-02-04 18:59:37', '2026-03-30 09:33:58', 882, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(34, 883, 'image', 'Ramadan Fat Loss 2026 creative', NULL, 'https://fitwayhub.com/assets/ads/creative1.jpg', NULL, NULL, NULL, 1, '2026-02-15 18:59:57', '2026-03-30 09:33:58', 883, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(35, 883, 'image', 'Transformation Strength 2026 creative', NULL, 'https://fitwayhub.com/assets/ads/creative3.jpg', NULL, NULL, NULL, 1, '2026-01-30 19:00:06', '2026-03-30 09:33:58', 883, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(36, 883, 'image', 'Transformation Strength 2026 creative', NULL, 'https://fitwayhub.com/assets/ads/creative6.jpg', NULL, NULL, NULL, 1, '2026-01-30 19:00:06', '2026-03-30 09:33:58', 883, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(37, 883, 'image', 'Transformation Strength 2026 creative', NULL, 'https://fitwayhub.com/assets/ads/creative5.mp4', NULL, NULL, NULL, 1, '2026-01-30 19:00:06', '2026-03-30 09:33:58', 883, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(38, 884, 'image', 'Yoga Wellness 2026 creative', NULL, 'https://fitwayhub.com/assets/ads/creative4.mp4', NULL, NULL, NULL, 1, '2026-02-19 19:00:32', '2026-03-30 09:33:58', 884, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(39, 884, 'image', 'Yoga Wellness 2026 creative', NULL, 'https://fitwayhub.com/assets/ads/creative1.mp4', NULL, NULL, NULL, 1, '2026-02-19 19:00:32', '2026-03-30 09:33:58', 884, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(40, 884, 'image', 'Yoga Wellness 2026 creative', NULL, 'https://fitwayhub.com/assets/ads/creative2.mp4', NULL, NULL, NULL, 1, '2026-02-19 19:00:32', '2026-03-30 09:33:58', 884, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(41, 884, 'image', 'Summer Coaching 2025 creative', NULL, 'https://fitwayhub.com/assets/ads/creative9.jpg', NULL, NULL, NULL, 1, '2026-03-09 19:01:00', '2026-03-30 09:33:58', 884, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(42, 884, 'image', 'Summer Coaching 2025 creative', NULL, 'https://fitwayhub.com/assets/ads/creative1.mp4', NULL, NULL, NULL, 1, '2026-03-09 19:01:00', '2026-03-30 09:33:58', 884, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(43, 885, 'image', 'Challenge Body 2026 creative', NULL, 'https://fitwayhub.com/assets/ads/creative4.mp4', NULL, NULL, NULL, 1, '2026-01-31 19:01:16', '2026-03-30 09:33:58', 885, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(44, 885, 'image', 'Challenge Body 2026 creative', NULL, 'https://fitwayhub.com/assets/ads/creative3.mp4', NULL, NULL, NULL, 1, '2026-01-31 19:01:16', '2026-03-30 09:33:58', 885, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(45, 885, 'image', 'Transformation Strength 2024 creative', NULL, 'https://fitwayhub.com/assets/ads/creative7.jpg', NULL, NULL, NULL, 1, '2026-02-27 19:01:34', '2026-03-30 09:33:58', 885, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(46, 885, 'image', 'Ramadan Coaching 2025 creative', NULL, 'https://fitwayhub.com/assets/ads/creative5.jpg', NULL, NULL, NULL, 1, '2026-02-03 19:01:58', '2026-03-30 09:33:58', 885, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(47, 885, 'image', 'Ramadan Coaching 2025 creative', NULL, 'https://fitwayhub.com/assets/ads/creative2.mp4', NULL, NULL, NULL, 1, '2026-02-03 19:01:58', '2026-03-30 09:33:58', 885, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(48, 885, 'image', 'Ramadan Coaching 2025 creative', NULL, 'https://fitwayhub.com/assets/ads/creative9.jpg', NULL, NULL, NULL, 1, '2026-02-03 19:01:58', '2026-03-30 09:33:58', 885, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(49, 909, 'image', 'Ramadan Strength 2025 creative', NULL, 'https://fitwayhub.com/assets/ads/creative4.mp4', NULL, NULL, NULL, 1, '2026-02-05 20:43:17', '2026-03-30 09:33:58', 909, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(50, 909, 'image', 'Ramadan Strength 2025 creative', NULL, 'https://fitwayhub.com/assets/ads/creative4.mp4', NULL, NULL, NULL, 1, '2026-02-05 20:43:17', '2026-03-30 09:33:58', 909, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(51, 909, 'image', 'Ramadan Strength 2025 creative', NULL, 'https://fitwayhub.com/assets/ads/creative3.mp4', NULL, NULL, NULL, 1, '2026-02-05 20:43:17', '2026-03-30 09:33:58', 909, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(52, 909, 'image', 'Ramadan Strength 2025 creative', NULL, 'https://fitwayhub.com/assets/ads/creative4.mp4', NULL, NULL, NULL, 1, '2026-02-05 20:43:17', '2026-03-30 09:33:58', 909, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(53, 909, 'image', 'Challenge Strength 2024 creative', NULL, 'https://fitwayhub.com/assets/ads/creative3.mp4', NULL, NULL, NULL, 1, '2026-03-18 20:43:48', '2026-03-30 09:33:58', 909, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(54, 909, 'image', 'Challenge Strength 2024 creative', NULL, 'https://fitwayhub.com/assets/ads/creative2.mp4', NULL, NULL, NULL, 1, '2026-03-18 20:43:48', '2026-03-30 09:33:58', 909, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(55, 909, 'image', 'Challenge Strength 2024 creative', NULL, 'https://fitwayhub.com/assets/ads/creative1.mp4', NULL, NULL, NULL, 1, '2026-03-18 20:43:48', '2026-03-30 09:33:58', 909, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(56, 909, 'image', 'Challenge Strength 2024 creative', NULL, 'https://fitwayhub.com/assets/ads/creative4.mp4', NULL, NULL, NULL, 1, '2026-03-18 20:43:48', '2026-03-30 09:33:58', 909, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(57, 910, 'image', 'Power Wellness 2026 creative', NULL, 'https://fitwayhub.com/assets/ads/creative9.jpg', NULL, NULL, NULL, 1, '2026-02-12 20:43:59', '2026-03-30 09:33:58', 910, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(58, 910, 'image', 'Summer Fat Loss 2026 creative', NULL, 'https://fitwayhub.com/assets/ads/creative4.jpg', NULL, NULL, NULL, 1, '2026-03-07 20:44:04', '2026-03-30 09:33:58', 910, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(59, 910, 'image', 'Summer Fat Loss 2026 creative', NULL, 'https://fitwayhub.com/assets/ads/creative4.mp4', NULL, NULL, NULL, 1, '2026-03-07 20:44:04', '2026-03-30 09:33:58', 910, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(60, 910, 'image', 'Summer Fat Loss 2026 creative', NULL, 'https://fitwayhub.com/assets/ads/creative2.mp4', NULL, NULL, NULL, 1, '2026-03-07 20:44:04', '2026-03-30 09:33:58', 910, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(61, 910, 'image', 'Summer Fat Loss 2026 creative', NULL, 'https://fitwayhub.com/assets/ads/creative5.mp4', NULL, NULL, NULL, 1, '2026-03-07 20:44:04', '2026-03-30 09:33:58', 910, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(62, 910, 'image', 'Ramadan Coaching 2026 creative', NULL, 'https://fitwayhub.com/assets/ads/creative4.mp4', NULL, NULL, NULL, 1, '2026-02-02 20:44:20', '2026-03-30 09:33:58', 910, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(63, 910, 'image', 'Ramadan Coaching 2026 creative', NULL, 'https://fitwayhub.com/assets/ads/creative4.mp4', NULL, NULL, NULL, 1, '2026-02-02 20:44:20', '2026-03-30 09:33:58', 910, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(64, 911, 'image', 'Ramadan Body 2024 creative', NULL, 'https://fitwayhub.com/assets/ads/creative8.jpg', NULL, NULL, NULL, 1, '2026-02-07 20:44:32', '2026-03-30 09:33:58', 911, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(65, 911, 'image', 'Ramadan Body 2024 creative', NULL, 'https://fitwayhub.com/assets/ads/creative1.jpg', NULL, NULL, NULL, 1, '2026-02-07 20:44:32', '2026-03-30 09:33:58', 911, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(66, 911, 'image', 'Power Body 2025 creative', NULL, 'https://fitwayhub.com/assets/ads/creative2.mp4', NULL, NULL, NULL, 1, '2026-02-01 20:44:38', '2026-03-30 09:33:58', 911, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(67, 911, 'image', 'Power Body 2025 creative', NULL, 'https://fitwayhub.com/assets/ads/creative1.jpg', NULL, NULL, NULL, 1, '2026-02-01 20:44:38', '2026-03-30 09:33:58', 911, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(68, 912, 'image', 'Transformation Strength 2026 creative', NULL, 'https://fitwayhub.com/assets/ads/creative2.mp4', NULL, NULL, NULL, 1, '2026-03-17 20:44:48', '2026-03-30 09:33:58', 912, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(69, 912, 'image', 'Transformation Strength 2026 creative', NULL, 'https://fitwayhub.com/assets/ads/creative4.mp4', NULL, NULL, NULL, 1, '2026-03-17 20:44:48', '2026-03-30 09:33:58', 912, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(70, 912, 'image', 'Challenge Strength 2025 creative', NULL, 'https://fitwayhub.com/assets/ads/creative7.jpg', NULL, NULL, NULL, 1, '2026-03-05 20:44:53', '2026-03-30 09:33:58', 912, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft'),
(71, 912, 'image', 'Challenge Strength 2025 creative', NULL, 'https://fitwayhub.com/assets/ads/creative1.jpg', NULL, NULL, NULL, 1, '2026-03-05 20:44:53', '2026-03-30 09:33:58', 912, 'image', NULL, NULL, NULL, NULL, NULL, NULL, 'draft');

-- --------------------------------------------------------
-- Table: `ad_events`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `ad_events`;
CREATE TABLE `ad_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `ad_id` int NOT NULL,
  `adset_id` int DEFAULT NULL,
  `campaign_id` int DEFAULT NULL,
  `coach_id` int DEFAULT NULL,
  `member_id` int DEFAULT NULL,
  `event_type` enum('impression','click','booking_created','booking_confirmed','package_purchase','trial_started','message_sent','app_install','page_view') NOT NULL,
  `event_value` decimal(10,2) DEFAULT '0.00',
  `placement` varchar(50) DEFAULT NULL,
  `device` varchar(50) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(500) DEFAULT NULL,
  `referrer` varchar(500) DEFAULT NULL,
  `dedup_key` varchar(100) DEFAULT NULL COMMENT 'for deduplication',
  `attribution_window` int DEFAULT '7' COMMENT 'days',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `user_id` int DEFAULT NULL,
  `session_id` varchar(120) DEFAULT NULL,
  `recorded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ade_ad` (`ad_id`),
  KEY `idx_ade_campaign` (`campaign_id`),
  KEY `idx_ade_coach` (`coach_id`),
  KEY `idx_ade_type` (`event_type`),
  KEY `idx_ade_created` (`created_at`),
  KEY `idx_ade_dedup` (`dedup_key`)
);

INSERT INTO `ad_events` (`id`, `ad_id`, `adset_id`, `campaign_id`, `coach_id`, `member_id`, `event_type`, `event_value`, `placement`, `device`, `ip_address`, `user_agent`, `referrer`, `dedup_key`, `attribution_window`, `created_at`, `user_id`, `session_id`, `recorded_at`) VALUES
(1, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-16 20:49:09', NULL, NULL, '2026-03-30 09:33:38'),
(2, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-16 20:49:10', NULL, NULL, '2026-03-30 09:33:38'),
(3, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-16 20:49:10', NULL, NULL, '2026-03-30 09:33:38'),
(4, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-16 20:49:10', NULL, NULL, '2026-03-30 09:33:38'),
(5, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-16 20:49:11', NULL, NULL, '2026-03-30 09:33:38'),
(6, 1, 1, 1, 56, NULL, 'click', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-16 20:49:11', NULL, NULL, '2026-03-30 09:33:38'),
(7, 1, 1, 1, 56, NULL, 'click', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-16 20:49:11', NULL, NULL, '2026-03-30 09:33:38'),
(8, 1, 1, 1, 56, NULL, 'booking_created', '50.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-16 20:49:14', NULL, NULL, '2026-03-30 09:33:38'),
(9, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-15 20:49:14', NULL, NULL, '2026-03-30 09:33:38'),
(10, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-15 20:49:14', NULL, NULL, '2026-03-30 09:33:38'),
(11, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-15 20:49:15', NULL, NULL, '2026-03-30 09:33:38'),
(12, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-15 20:49:15', NULL, NULL, '2026-03-30 09:33:38'),
(13, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-15 20:49:15', NULL, NULL, '2026-03-30 09:33:38'),
(14, 1, 1, 1, 56, NULL, 'click', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-15 20:49:16', NULL, NULL, '2026-03-30 09:33:38'),
(15, 1, 1, 1, 56, NULL, 'click', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-15 20:49:16', NULL, NULL, '2026-03-30 09:33:38'),
(16, 1, 1, 1, 56, NULL, 'booking_created', '50.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-15 20:49:16', NULL, NULL, '2026-03-30 09:33:38'),
(17, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-14 20:49:16', NULL, NULL, '2026-03-30 09:33:38'),
(18, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-14 20:49:17', NULL, NULL, '2026-03-30 09:33:38'),
(19, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-14 20:49:17', NULL, NULL, '2026-03-30 09:33:38'),
(20, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-14 20:49:17', NULL, NULL, '2026-03-30 09:33:38'),
(21, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-14 20:49:17', NULL, NULL, '2026-03-30 09:33:38'),
(22, 1, 1, 1, 56, NULL, 'click', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-14 20:49:18', NULL, NULL, '2026-03-30 09:33:38'),
(23, 1, 1, 1, 56, NULL, 'click', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-14 20:49:18', NULL, NULL, '2026-03-30 09:33:38'),
(24, 1, 1, 1, 56, NULL, 'booking_created', '50.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-14 20:49:18', NULL, NULL, '2026-03-30 09:33:38'),
(25, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-13 20:49:19', NULL, NULL, '2026-03-30 09:33:38'),
(26, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-13 20:49:19', NULL, NULL, '2026-03-30 09:33:38'),
(27, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-13 20:49:19', NULL, NULL, '2026-03-30 09:33:38'),
(28, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-13 20:49:20', NULL, NULL, '2026-03-30 09:33:38'),
(29, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-13 20:49:20', NULL, NULL, '2026-03-30 09:33:38'),
(30, 1, 1, 1, 56, NULL, 'click', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-13 20:49:20', NULL, NULL, '2026-03-30 09:33:38'),
(31, 1, 1, 1, 56, NULL, 'click', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-13 20:49:20', NULL, NULL, '2026-03-30 09:33:38'),
(32, 1, 1, 1, 56, NULL, 'booking_created', '50.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-13 20:49:21', NULL, NULL, '2026-03-30 09:33:38'),
(33, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-12 20:49:21', NULL, NULL, '2026-03-30 09:33:38'),
(34, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-12 20:49:21', NULL, NULL, '2026-03-30 09:33:38'),
(35, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-12 20:49:22', NULL, NULL, '2026-03-30 09:33:38'),
(36, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-12 20:49:22', NULL, NULL, '2026-03-30 09:33:38'),
(37, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-12 20:49:22', NULL, NULL, '2026-03-30 09:33:38'),
(38, 1, 1, 1, 56, NULL, 'click', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-12 20:49:23', NULL, NULL, '2026-03-30 09:33:38'),
(39, 1, 1, 1, 56, NULL, 'click', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-12 20:49:23', NULL, NULL, '2026-03-30 09:33:38'),
(40, 1, 1, 1, 56, NULL, 'booking_created', '50.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-12 20:49:23', NULL, NULL, '2026-03-30 09:33:38'),
(41, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-11 20:49:24', NULL, NULL, '2026-03-30 09:33:38'),
(42, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-11 20:49:24', NULL, NULL, '2026-03-30 09:33:38'),
(43, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-11 20:49:24', NULL, NULL, '2026-03-30 09:33:38'),
(44, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-11 20:49:24', NULL, NULL, '2026-03-30 09:33:38'),
(45, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-11 20:49:25', NULL, NULL, '2026-03-30 09:33:38'),
(46, 1, 1, 1, 56, NULL, 'click', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-11 20:49:25', NULL, NULL, '2026-03-30 09:33:38'),
(47, 1, 1, 1, 56, NULL, 'click', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-11 20:49:25', NULL, NULL, '2026-03-30 09:33:38'),
(48, 1, 1, 1, 56, NULL, 'booking_created', '50.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-11 20:49:25', NULL, NULL, '2026-03-30 09:33:38'),
(49, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-10 20:49:26', NULL, NULL, '2026-03-30 09:33:38'),
(50, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-10 20:49:26', NULL, NULL, '2026-03-30 09:33:38'),
(51, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-10 20:49:26', NULL, NULL, '2026-03-30 09:33:38'),
(52, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-10 20:49:27', NULL, NULL, '2026-03-30 09:33:38'),
(53, 1, 1, 1, 56, NULL, 'impression', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-10 20:49:27', NULL, NULL, '2026-03-30 09:33:38'),
(54, 1, 1, 1, 56, NULL, 'click', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-10 20:49:27', NULL, NULL, '2026-03-30 09:33:38'),
(55, 1, 1, 1, 56, NULL, 'click', '0.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-10 20:49:27', NULL, NULL, '2026-03-30 09:33:38'),
(56, 1, 1, 1, 56, NULL, 'booking_created', '50.00', 'feed', 'mobile', NULL, NULL, NULL, NULL, 7, '2026-03-10 20:49:28', NULL, NULL, '2026-03-30 09:33:38');

-- --------------------------------------------------------
-- Table: `ad_feature_flags`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `ad_feature_flags`;
CREATE TABLE `ad_feature_flags` (
  `id` int NOT NULL AUTO_INCREMENT,
  `flag_key` varchar(120) NOT NULL,
  `enabled` tinyint(1) DEFAULT '0',
  `label` varchar(200) DEFAULT NULL,
  `description` text,
  `allowed_roles` json DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `flag_key` (`flag_key`)
);

INSERT INTO `ad_feature_flags` (`id`, `flag_key`, `enabled`, `label`, `description`, `allowed_roles`, `updated_by`, `updated_at`) VALUES
(1, 'ab_testing', 0, 'A/B Testing', NULL, NULL, NULL, '2026-03-22 18:47:11'),
(2, 'advanced_targeting', 1, 'Advanced Audience Targeting', NULL, NULL, NULL, '2026-03-22 18:47:11'),
(3, 'auto_optimization', 0, 'Automatic Campaign Optimization', NULL, NULL, NULL, '2026-03-22 18:47:12'),
(4, 'carousel_ads', 1, 'Carousel Ad Format', NULL, NULL, NULL, '2026-03-22 18:47:12'),
(5, 'internal_recommendations', 0, 'AI-Powered Recommendations', NULL, NULL, NULL, '2026-03-22 18:47:13'),
(6, 'wallet_system', 1, 'Internal Wallet / Credits', NULL, NULL, NULL, '2026-03-22 18:47:13'),
(7, 'report_snapshots', 1, 'Daily Report Snapshots', NULL, NULL, NULL, '2026-03-22 18:47:13');

-- --------------------------------------------------------
-- Table: `ad_moderation_reviews`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `ad_moderation_reviews`;
CREATE TABLE `ad_moderation_reviews` (
  `id` int NOT NULL AUTO_INCREMENT,
  `campaign_id` int NOT NULL,
  `reviewer_id` int DEFAULT NULL,
  `status` enum('pending','approved','rejected','flagged','needs_changes') DEFAULT 'pending',
  `flags` json DEFAULT NULL,
  `notes` text,
  `auto_flagged` tinyint(1) DEFAULT '0',
  `auto_flag_reasons` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_campaign` (`campaign_id`),
  KEY `idx_status` (`status`)
);

-- --------------------------------------------------------
-- Table: `ad_payments`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `ad_payments`;
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
);

INSERT INTO `ad_payments` (`id`, `ad_id`, `coach_id`, `duration_minutes`, `amount`, `payment_method`, `proof_url`, `phone`, `card_last4`, `status`, `created_at`, `updated_at`) VALUES
(1, 1, 79, 60, '240.00', 'ewallet', 'https://pub-a510609442944675ba8ca128930bf7ad.r2.dev/images/image-1773702541613-73676458.png', '201209883484', NULL, 'approved', '2026-03-16 21:09:05', '2026-03-16 21:10:13');

-- --------------------------------------------------------
-- Table: `ad_payout_transactions`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `ad_payout_transactions`;
CREATE TABLE `ad_payout_transactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `coach_id` int NOT NULL,
  `campaign_id` int DEFAULT NULL,
  `conversion_event_id` bigint DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `revenue_share_pct` decimal(5,2) DEFAULT '0.00',
  `description` varchar(500) DEFAULT NULL,
  `status` enum('pending','approved','paid','cancelled') NOT NULL DEFAULT 'pending',
  `paid_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `campaign_id` (`campaign_id`),
  KEY `idx_apt_coach` (`coach_id`),
  KEY `idx_apt_status` (`status`),
  CONSTRAINT `ad_payout_transactions_ibfk_1` FOREIGN KEY (`coach_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ad_payout_transactions_ibfk_2` FOREIGN KEY (`campaign_id`) REFERENCES `ad_campaigns` (`id`) ON DELETE SET NULL
);

-- --------------------------------------------------------
-- Table: `ad_placements`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `ad_placements`;
CREATE TABLE `ad_placements` (
  `id` int NOT NULL AUTO_INCREMENT,
  `placement_key` varchar(80) NOT NULL,
  `label` varchar(200) DEFAULT NULL,
  `enabled` tinyint(1) DEFAULT '1',
  `max_ads` int DEFAULT '3',
  `priority_order` int DEFAULT '0',
  `frequency_cap_hours` int DEFAULT '24',
  `description` text,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `placement_key` (`placement_key`)
);

INSERT INTO `ad_placements` (`id`, `placement_key`, `label`, `enabled`, `max_ads`, `priority_order`, `frequency_cap_hours`, `description`, `updated_at`) VALUES
(1, 'feed', 'Community Feed Cards', 1, 3, 1, 24, NULL, '2026-03-22 18:46:56'),
(2, 'home_banner', 'Home Screen Banner', 1, 1, 2, 12, NULL, '2026-03-22 18:46:57'),
(3, 'profile_boost', 'Coach Profile Boost', 1, 2, 3, 48, NULL, '2026-03-22 18:46:57'),
(4, 'search', 'Search Results Boost', 1, 2, 4, 24, NULL, '2026-03-22 18:46:57'),
(5, 'community', 'Community Discovery Page', 1, 4, 5, 24, NULL, '2026-03-22 18:46:58'),
(6, 'notification', 'Notification Inbox Promo', 1, 1, 6, 72, NULL, '2026-03-22 18:46:58'),
(7, 'discovery', 'Discovery / Explore Page', 1, 3, 7, 24, NULL, '2026-03-22 18:46:59');

-- --------------------------------------------------------
-- Table: `ad_report_snapshots`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `ad_report_snapshots`;
CREATE TABLE `ad_report_snapshots` (
  `id` int NOT NULL AUTO_INCREMENT,
  `campaign_id` int NOT NULL,
  `snapshot_date` date NOT NULL,
  `impressions` int DEFAULT '0',
  `clicks` int DEFAULT '0',
  `saves` int DEFAULT '0',
  `conversions` int DEFAULT '0',
  `amount_spent` decimal(10,2) DEFAULT '0.00',
  `reach` int DEFAULT '0',
  `ctr` decimal(6,4) DEFAULT '0.0000',
  `cpm` decimal(10,4) DEFAULT '0.0000',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_campaign_date` (`campaign_id`,`snapshot_date`),
  KEY `idx_date` (`snapshot_date`)
);

-- --------------------------------------------------------
-- Table: `ad_rules`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `ad_rules`;
CREATE TABLE `ad_rules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `coach_id` int NOT NULL,
  `campaign_id` int DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `condition_json` json NOT NULL COMMENT '{`metric`:`cpa`,`operator`:">",`value`:50}',
  `action_json` json NOT NULL COMMENT '{`type`:`pause_campaign`} or {`type`:`increase_bid`,`value`:10}',
  `is_active` tinyint(1) DEFAULT '1',
  `last_triggered_at` datetime DEFAULT NULL,
  `trigger_count` int DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `campaign_id` (`campaign_id`),
  KEY `idx_adr_coach` (`coach_id`),
  CONSTRAINT `ad_rules_ibfk_1` FOREIGN KEY (`coach_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ad_rules_ibfk_2` FOREIGN KEY (`campaign_id`) REFERENCES `ad_campaigns` (`id`) ON DELETE CASCADE
);

INSERT INTO `ad_rules` (`id`, `coach_id`, `campaign_id`, `name`, `condition_json`, `action_json`, `is_active`, `last_triggered_at`, `trigger_count`, `created_at`) VALUES
(1, 56, 1, 'Pause if CPA > 100 EGP', '{}', '{}', 1, NULL, 0, '2026-03-16 20:49:29');

-- --------------------------------------------------------
-- Table: `ad_sets`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `ad_sets`;
CREATE TABLE `ad_sets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `campaign_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `status` enum('draft','active','paused','archived') NOT NULL DEFAULT 'draft',
  `budget_type` enum('daily','lifetime') NOT NULL DEFAULT 'daily',
  `budget_amount` decimal(12,2) DEFAULT '0.00',
  `budget_spent` decimal(12,2) DEFAULT '0.00',
  `bid_strategy` enum('cpc','cpm','cpa') NOT NULL DEFAULT 'cpc',
  `bid_amount` decimal(10,2) DEFAULT '0.00',
  `placement` json DEFAULT NULL COMMENT '[`feed`,`coach_profile`,`class_listings`,`email`,`push`,`external`]',
  `frequency_cap` int DEFAULT '0' COMMENT '0 = no cap; max impressions per user per day',
  `pacing` enum('standard','accelerated') NOT NULL DEFAULT 'standard',
  `targeting_json` json DEFAULT NULL COMMENT 'demographics, interests, fitness level, programs, etc.',
  `schedule_start` datetime DEFAULT NULL,
  `schedule_end` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `target_gender` enum('all','male','female') DEFAULT 'all',
  `target_age_min` int DEFAULT '18',
  `target_age_max` int DEFAULT '65',
  `target_location` varchar(200) DEFAULT NULL,
  `target_lat` decimal(10,7) DEFAULT NULL,
  `target_lng` decimal(10,7) DEFAULT NULL,
  `target_radius_km` int DEFAULT '50',
  `target_interests` json DEFAULT NULL,
  `target_activity_levels` json DEFAULT NULL,
  `target_languages` json DEFAULT NULL,
  `exclude_existing_clients` tinyint(1) DEFAULT '1',
  `exclude_opted_out` tinyint(1) DEFAULT '1',
  `daily_budget` decimal(10,2) DEFAULT '0.00',
  `placement_type` enum('feed','home_banner','community','search','profile_boost','notification','discovery','all') DEFAULT 'all',
  PRIMARY KEY (`id`),
  KEY `idx_ads_campaign` (`campaign_id`),
  CONSTRAINT `ad_sets_ibfk_1` FOREIGN KEY (`campaign_id`) REFERENCES `ad_campaigns` (`id`) ON DELETE CASCADE
);

INSERT INTO `ad_sets` (`id`, `campaign_id`, `name`, `status`, `budget_type`, `budget_amount`, `budget_spent`, `bid_strategy`, `bid_amount`, `placement`, `frequency_cap`, `pacing`, `targeting_json`, `schedule_start`, `schedule_end`, `created_at`, `updated_at`, `target_gender`, `target_age_min`, `target_age_max`, `target_location`, `target_lat`, `target_lng`, `target_radius_km`, `target_interests`, `target_activity_levels`, `target_languages`, `exclude_existing_clients`, `exclude_opted_out`, `daily_budget`, `placement_type`) VALUES
(1, 1, 'Strength Enthusiasts 25-40', 'active', 'daily', '20.00', '0.00', 'cpc', '2.50', 'feed,coach_profile,class_listings', 0, 'standard', '{}', '2026-03-16 20:49:05', '2026-04-15 20:49:05', '2026-03-16 20:49:05', '2026-03-16 20:49:05', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(2, 2, 'All Fitness Levels', 'draft', 'lifetime', '200.00', '0.00', 'cpm', '5.00', 'feed,push', 0, 'standard', '{}', NULL, NULL, '2026-03-16 20:49:08', '2026-03-16 20:49:08', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(3, 7, 'Power Wellness 2024 Set 1', 'active', 'daily', '0.00', '0.00', 'cpc', '0.00', NULL, 0, 'standard', NULL, NULL, NULL, '2026-02-08 16:25:19', '2026-05-13 16:25:19', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(4, 8, 'Summer Coaching 2026 Set 1', 'active', 'daily', '0.00', '0.00', 'cpc', '0.00', NULL, 0, 'standard', NULL, NULL, NULL, '2026-03-06 16:31:21', '2026-04-20 16:31:21', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(5, 9, 'Transformation Strength 2025 Set 1', 'paused', 'daily', '0.00', '0.00', 'cpc', '0.00', NULL, 0, 'standard', NULL, NULL, NULL, '2026-02-25 16:37:07', '2026-05-11 16:37:07', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(6, 10, 'Transformation Coaching 2025 Set 1', 'active', 'daily', '0.00', '0.00', 'cpc', '0.00', NULL, 0, 'standard', NULL, NULL, NULL, '2026-02-26 16:53:25', '2026-04-18 16:53:25', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(7, 12, 'Transformation Coaching 2024 Set 1', 'archived', 'daily', '0.00', '0.00', 'cpc', '0.00', NULL, 0, 'standard', NULL, NULL, NULL, '2026-03-29 15:50:05', '2026-03-29 15:50:05', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(8, 13, 'Ramadan Body 2025 Set 1', 'archived', 'daily', '0.00', '0.00', 'cpc', '0.00', NULL, 0, 'standard', NULL, NULL, NULL, '2026-03-29 15:58:32', '2026-03-29 15:58:32', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(9, 14, 'Yoga Strength 2025 Set 1', 'active', 'daily', '0.00', '0.00', 'cpc', '0.00', NULL, 0, 'standard', NULL, NULL, NULL, '2026-03-29 16:05:47', '2026-03-29 16:05:47', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(10, 15, 'Challenge Fat Loss 2026 Set 1', 'paused', 'daily', '0.00', '0.00', 'cpc', '0.00', NULL, 0, 'standard', NULL, NULL, NULL, '2026-03-29 16:12:46', '2026-03-29 16:12:46', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(11, 16, 'Summer Coaching 2025 Set 1', 'active', 'daily', '0.00', '0.00', 'cpc', '0.00', NULL, 0, 'standard', NULL, NULL, NULL, '2026-03-29 16:19:30', '2026-03-29 16:19:30', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(12, 18, 'Power Coaching 2024 Set 1', 'paused', 'daily', '0.00', '0.00', 'cpc', '0.00', 'search', 0, 'standard', NULL, NULL, NULL, '2026-03-14 18:33:20', '2026-04-10 18:33:20', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(13, 19, 'Transformation Body 2025 Set 1', 'archived', 'daily', '0.00', '0.00', 'cpc', '0.00', 'notification', 0, 'standard', NULL, NULL, NULL, '2026-02-21 18:40:21', '2026-04-06 18:40:21', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(14, 20, 'Transformation Coaching 2026 Set 1', 'archived', 'daily', '0.00', '0.00', 'cpc', '0.00', 'notification', 0, 'standard', NULL, NULL, NULL, '2026-02-01 18:40:27', '2026-04-13 18:40:27', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(15, 20, 'Transformation Coaching 2026 Set 2', 'active', 'daily', '0.00', '0.00', 'cpc', '0.00', 'notification', 0, 'standard', NULL, NULL, NULL, '2026-02-01 18:40:27', '2026-04-13 18:40:27', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(16, 21, 'Summer Coaching 2025 Set 1', 'paused', 'daily', '0.00', '0.00', 'cpc', '0.00', 'home_banner', 0, 'standard', NULL, NULL, NULL, '2026-02-16 18:40:34', '2026-04-23 18:40:34', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(17, 21, 'Summer Coaching 2025 Set 2', 'archived', 'daily', '0.00', '0.00', 'cpc', '0.00', 'community', 0, 'standard', NULL, NULL, NULL, '2026-02-16 18:40:34', '2026-04-23 18:40:34', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(18, 22, 'Summer Wellness 2024 Set 1', 'paused', 'daily', '0.00', '0.00', 'cpc', '0.00', 'notification', 0, 'standard', NULL, NULL, NULL, '2026-01-31 18:40:42', '2026-05-25 18:40:42', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(19, 22, 'Summer Wellness 2024 Set 2', 'archived', 'daily', '0.00', '0.00', 'cpc', '0.00', 'feed', 0, 'standard', NULL, NULL, NULL, '2026-01-31 18:40:42', '2026-05-25 18:40:42', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(20, 23, 'Ramadan Fat Loss 2024 Set 1', 'archived', 'daily', '0.00', '0.00', 'cpc', '0.00', 'discovery', 0, 'standard', NULL, NULL, NULL, '2026-03-17 18:40:49', '2026-04-15 18:40:49', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(21, 23, 'Ramadan Fat Loss 2024 Set 2', 'paused', 'daily', '0.00', '0.00', 'cpc', '0.00', 'feed', 0, 'standard', NULL, NULL, NULL, '2026-03-17 18:40:49', '2026-04-15 18:40:49', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(22, 24, 'Transformation Strength 2025 Set 1', 'active', 'daily', '0.00', '0.00', 'cpc', '0.00', 'notification', 0, 'standard', NULL, NULL, NULL, '2026-01-29 18:40:55', '2026-05-01 18:40:55', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(23, 24, 'Transformation Strength 2025 Set 2', 'archived', 'daily', '0.00', '0.00', 'cpc', '0.00', 'search', 0, 'standard', NULL, NULL, NULL, '2026-01-29 18:40:55', '2026-05-01 18:40:55', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(24, 25, 'Challenge Fat Loss 2024 Set 1', 'archived', 'daily', '0.00', '0.00', 'cpc', '0.00', 'feed', 0, 'standard', NULL, NULL, NULL, '2026-02-11 18:41:25', '2026-04-27 18:41:25', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(25, 25, 'Challenge Fat Loss 2024 Set 2', 'active', 'daily', '0.00', '0.00', 'cpc', '0.00', 'community', 0, 'standard', NULL, NULL, NULL, '2026-02-11 18:41:25', '2026-04-27 18:41:25', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(26, 26, 'Ramadan Body 2025 Set 1', 'archived', 'daily', '0.00', '0.00', 'cpc', '0.00', 'search', 0, 'standard', NULL, NULL, NULL, '2026-03-17 18:42:07', '2026-05-16 18:42:07', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(27, 26, 'Ramadan Body 2025 Set 2', 'archived', 'daily', '0.00', '0.00', 'cpc', '0.00', 'home_banner', 0, 'standard', NULL, NULL, NULL, '2026-03-17 18:42:07', '2026-05-16 18:42:07', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(28, 27, 'Ramadan Body 2025 Set 1', 'archived', 'daily', '0.00', '0.00', 'cpc', '0.00', 'search', 0, 'standard', NULL, NULL, NULL, '2026-02-09 18:42:47', '2026-04-05 18:42:47', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(29, 27, 'Ramadan Body 2025 Set 2', 'paused', 'daily', '0.00', '0.00', 'cpc', '0.00', 'feed', 0, 'standard', NULL, NULL, NULL, '2026-02-09 18:42:47', '2026-04-05 18:42:47', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(30, 28, 'Summer Coaching 2026 Set 1', 'paused', 'daily', '0.00', '0.00', 'cpc', '0.00', 'search', 0, 'standard', NULL, NULL, NULL, '2026-02-27 18:58:18', '2026-04-28 18:58:18', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(31, 28, 'Summer Coaching 2026 Set 2', 'archived', 'daily', '0.00', '0.00', 'cpc', '0.00', 'home_banner', 0, 'standard', NULL, NULL, NULL, '2026-02-27 18:58:18', '2026-04-28 18:58:18', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(32, 29, 'Ramadan Fat Loss 2024 Set 1', 'archived', 'daily', '0.00', '0.00', 'cpc', '0.00', 'home_banner', 0, 'standard', NULL, NULL, NULL, '2026-02-04 18:59:37', '2026-05-12 18:59:37', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(33, 29, 'Ramadan Fat Loss 2024 Set 2', 'active', 'daily', '0.00', '0.00', 'cpc', '0.00', 'community', 0, 'standard', NULL, NULL, NULL, '2026-02-04 18:59:37', '2026-05-12 18:59:37', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(34, 30, 'Ramadan Fat Loss 2026 Set 1', 'paused', 'daily', '0.00', '0.00', 'cpc', '0.00', 'profile_boost', 0, 'standard', NULL, NULL, NULL, '2026-02-15 18:59:57', '2026-05-12 18:59:57', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(35, 31, 'Transformation Strength 2026 Set 1', 'paused', 'daily', '0.00', '0.00', 'cpc', '0.00', 'home_banner', 0, 'standard', NULL, NULL, NULL, '2026-01-30 19:00:06', '2026-04-21 19:00:06', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(36, 31, 'Transformation Strength 2026 Set 2', 'paused', 'daily', '0.00', '0.00', 'cpc', '0.00', 'profile_boost', 0, 'standard', NULL, NULL, NULL, '2026-01-30 19:00:06', '2026-04-21 19:00:06', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(37, 32, 'Yoga Wellness 2026 Set 1', 'archived', 'daily', '0.00', '0.00', 'cpc', '0.00', 'profile_boost', 0, 'standard', NULL, NULL, NULL, '2026-02-19 19:00:32', '2026-05-26 19:00:32', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(38, 32, 'Yoga Wellness 2026 Set 2', 'active', 'daily', '0.00', '0.00', 'cpc', '0.00', 'community', 0, 'standard', NULL, NULL, NULL, '2026-02-19 19:00:32', '2026-05-26 19:00:32', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(39, 33, 'Summer Coaching 2025 Set 1', 'paused', 'daily', '0.00', '0.00', 'cpc', '0.00', 'discovery', 0, 'standard', NULL, NULL, NULL, '2026-03-09 19:01:00', '2026-04-26 19:01:00', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(40, 33, 'Summer Coaching 2025 Set 2', 'paused', 'daily', '0.00', '0.00', 'cpc', '0.00', 'discovery', 0, 'standard', NULL, NULL, NULL, '2026-03-09 19:01:00', '2026-04-26 19:01:00', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(41, 34, 'Challenge Body 2026 Set 1', 'active', 'daily', '0.00', '0.00', 'cpc', '0.00', 'search', 0, 'standard', NULL, NULL, NULL, '2026-01-31 19:01:16', '2026-05-08 19:01:16', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(42, 35, 'Transformation Strength 2024 Set 1', 'paused', 'daily', '0.00', '0.00', 'cpc', '0.00', 'profile_boost', 0, 'standard', NULL, NULL, NULL, '2026-02-27 19:01:34', '2026-04-28 19:01:34', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(43, 36, 'Ramadan Coaching 2025 Set 1', 'active', 'daily', '0.00', '0.00', 'cpc', '0.00', 'home_banner', 0, 'standard', NULL, NULL, NULL, '2026-02-03 19:01:58', '2026-05-14 19:01:58', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(44, 36, 'Ramadan Coaching 2025 Set 2', 'active', 'daily', '0.00', '0.00', 'cpc', '0.00', 'profile_boost', 0, 'standard', NULL, NULL, NULL, '2026-02-03 19:01:58', '2026-05-14 19:01:58', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(45, 37, 'Ramadan Strength 2025 Set 1', 'active', 'daily', '0.00', '0.00', 'cpc', '0.00', 'community', 0, 'standard', NULL, NULL, NULL, '2026-02-05 20:43:17', '2026-04-09 20:43:17', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(46, 37, 'Ramadan Strength 2025 Set 2', 'paused', 'daily', '0.00', '0.00', 'cpc', '0.00', 'discovery', 0, 'standard', NULL, NULL, NULL, '2026-02-05 20:43:17', '2026-04-09 20:43:17', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(47, 38, 'Challenge Strength 2024 Set 1', 'archived', 'daily', '0.00', '0.00', 'cpc', '0.00', 'discovery', 0, 'standard', NULL, NULL, NULL, '2026-03-18 20:43:48', '2026-05-23 20:43:48', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(48, 38, 'Challenge Strength 2024 Set 2', 'paused', 'daily', '0.00', '0.00', 'cpc', '0.00', 'home_banner', 0, 'standard', NULL, NULL, NULL, '2026-03-18 20:43:48', '2026-05-23 20:43:48', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(49, 39, 'Power Wellness 2026 Set 1', 'active', 'daily', '0.00', '0.00', 'cpc', '0.00', 'home_banner', 0, 'standard', NULL, NULL, NULL, '2026-02-12 20:43:59', '2026-04-19 20:43:59', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(50, 40, 'Summer Fat Loss 2026 Set 1', 'active', 'daily', '0.00', '0.00', 'cpc', '0.00', 'feed', 0, 'standard', NULL, NULL, NULL, '2026-03-07 20:44:04', '2026-05-21 20:44:04', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(51, 40, 'Summer Fat Loss 2026 Set 2', 'active', 'daily', '0.00', '0.00', 'cpc', '0.00', 'notification', 0, 'standard', NULL, NULL, NULL, '2026-03-07 20:44:04', '2026-05-21 20:44:04', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(52, 41, 'Ramadan Coaching 2026 Set 1', 'active', 'daily', '0.00', '0.00', 'cpc', '0.00', 'feed', 0, 'standard', NULL, NULL, NULL, '2026-02-02 20:44:20', '2026-04-26 20:44:20', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(53, 41, 'Ramadan Coaching 2026 Set 2', 'active', 'daily', '0.00', '0.00', 'cpc', '0.00', 'notification', 0, 'standard', NULL, NULL, NULL, '2026-02-02 20:44:20', '2026-04-26 20:44:20', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(54, 42, 'Ramadan Body 2024 Set 1', 'active', 'daily', '0.00', '0.00', 'cpc', '0.00', 'search', 0, 'standard', NULL, NULL, NULL, '2026-02-07 20:44:32', '2026-05-03 20:44:32', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(55, 42, 'Ramadan Body 2024 Set 2', 'paused', 'daily', '0.00', '0.00', 'cpc', '0.00', 'search', 0, 'standard', NULL, NULL, NULL, '2026-02-07 20:44:32', '2026-05-03 20:44:32', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(56, 43, 'Power Body 2025 Set 1', 'active', 'daily', '0.00', '0.00', 'cpc', '0.00', 'feed', 0, 'standard', NULL, NULL, NULL, '2026-02-01 20:44:38', '2026-05-16 20:44:38', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(57, 44, 'Transformation Strength 2026 Set 1', 'paused', 'daily', '0.00', '0.00', 'cpc', '0.00', 'search', 0, 'standard', NULL, NULL, NULL, '2026-03-17 20:44:48', '2026-05-27 20:44:48', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(58, 44, 'Transformation Strength 2026 Set 2', 'active', 'daily', '0.00', '0.00', 'cpc', '0.00', 'community', 0, 'standard', NULL, NULL, NULL, '2026-03-17 20:44:48', '2026-05-27 20:44:48', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(59, 45, 'Challenge Strength 2025 Set 1', 'active', 'daily', '0.00', '0.00', 'cpc', '0.00', 'profile_boost', 0, 'standard', NULL, NULL, NULL, '2026-03-05 20:44:53', '2026-05-04 20:44:53', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(60, 45, 'Challenge Strength 2025 Set 2', 'paused', 'daily', '0.00', '0.00', 'cpc', '0.00', 'home_banner', 0, 'standard', NULL, NULL, NULL, '2026-03-05 20:44:53', '2026-05-04 20:44:53', 'all', 18, 65, NULL, NULL, NULL, 50, NULL, NULL, NULL, 1, 1, '0.00', 'all'),
(61, 46, 'Summer Coaching 2025 Set 1', 'archived', 'daily', '0.00', '0.00', 'cpc', '0.00', 'profile_boost', 0, 'standard', NULL, NULL, NULL, '2026-02-15 13:58:38', '2026-05-07 13:58:38', 'all', 23, 38, NULL, NULL, NULL, 50, 'yoga,wellness', NULL, NULL, 1, 1, '923.00', 'all');

-- --------------------------------------------------------
-- Table: `ad_setting_history`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `ad_setting_history`;
CREATE TABLE `ad_setting_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(120) NOT NULL,
  `old_value` text,
  `new_value` text,
  `changed_by` int NOT NULL,
  `changed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `reason` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`)
);

-- --------------------------------------------------------
-- Table: `ad_targeting_audiences`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `ad_targeting_audiences`;
CREATE TABLE `ad_targeting_audiences` (
  `id` int NOT NULL AUTO_INCREMENT,
  `coach_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `type` enum('custom','lookalike','retargeting') NOT NULL DEFAULT 'custom',
  `source` enum('csv_upload','top_clients','past_attendees','website_visitors') NOT NULL DEFAULT 'csv_upload',
  `member_count` int DEFAULT '0',
  `hashed_emails` json DEFAULT NULL COMMENT 'array of SHA-256 hashed emails',
  `config` json DEFAULT NULL COMMENT 'lookalike config, similarity %, source audience id',
  `status` enum('processing','ready','error') NOT NULL DEFAULT 'processing',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ata_coach` (`coach_id`),
  CONSTRAINT `ad_targeting_audiences_ibfk_1` FOREIGN KEY (`coach_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);

-- --------------------------------------------------------
-- Table: `ad_template_presets`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `ad_template_presets`;
CREATE TABLE `ad_template_presets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `preset_type` enum('campaign','ad_set','creative','budget') NOT NULL,
  `name` varchar(200) NOT NULL,
  `description` text,
  `config` json NOT NULL,
  `is_default` tinyint(1) DEFAULT '0',
  `target_role` enum('all','coach','admin') DEFAULT 'all',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

INSERT INTO `ad_template_presets` (`id`, `preset_type`, `name`, `description`, `config`, `is_default`, `target_role`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-22 18:47:16', '2026-03-22 18:47:16'),
(2, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-22 18:47:16', '2026-03-22 18:47:16'),
(3, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-22 18:47:16', '2026-03-22 18:47:16'),
(4, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-22 18:47:17', '2026-03-22 18:47:17'),
(5, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-23 02:11:26', '2026-03-23 02:11:26'),
(6, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-23 02:11:26', '2026-03-23 02:11:26'),
(7, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-23 02:11:27', '2026-03-23 02:11:27'),
(8, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-23 02:11:27', '2026-03-23 02:11:27'),
(9, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-23 02:49:43', '2026-03-23 02:49:43'),
(10, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-23 02:49:44', '2026-03-23 02:49:44'),
(11, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-23 02:49:44', '2026-03-23 02:49:44'),
(12, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-23 02:49:44', '2026-03-23 02:49:44'),
(13, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-23 03:07:12', '2026-03-23 03:07:12'),
(14, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-23 03:07:12', '2026-03-23 03:07:12'),
(15, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-23 03:07:12', '2026-03-23 03:07:12'),
(16, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-23 03:07:13', '2026-03-23 03:07:13'),
(17, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-23 03:27:01', '2026-03-23 03:27:01'),
(18, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-23 03:27:01', '2026-03-23 03:27:01'),
(19, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-23 03:27:01', '2026-03-23 03:27:01'),
(20, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-23 03:27:01', '2026-03-23 03:27:01'),
(21, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-23 03:54:44', '2026-03-23 03:54:44'),
(22, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-23 03:54:45', '2026-03-23 03:54:45'),
(23, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-23 03:54:45', '2026-03-23 03:54:45'),
(24, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-23 03:54:45', '2026-03-23 03:54:45'),
(25, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-23 04:27:50', '2026-03-23 04:27:50'),
(26, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-23 04:27:51', '2026-03-23 04:27:51'),
(27, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-23 04:27:51', '2026-03-23 04:27:51'),
(28, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-23 04:27:51', '2026-03-23 04:27:51'),
(29, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-23 05:07:10', '2026-03-23 05:07:10'),
(30, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-23 05:07:10', '2026-03-23 05:07:10'),
(31, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-23 05:07:10', '2026-03-23 05:07:10'),
(32, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-23 05:07:11', '2026-03-23 05:07:11'),
(33, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-23 05:14:14', '2026-03-23 05:14:14'),
(34, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-23 05:14:14', '2026-03-23 05:14:14'),
(35, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-23 05:14:15', '2026-03-23 05:14:15'),
(36, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-23 05:14:15', '2026-03-23 05:14:15'),
(37, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-23 07:05:21', '2026-03-23 07:05:21'),
(38, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-23 07:05:22', '2026-03-23 07:05:22'),
(39, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-23 07:05:22', '2026-03-23 07:05:22'),
(40, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-23 07:05:22', '2026-03-23 07:05:22'),
(41, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-23 16:26:58', '2026-03-23 16:26:58'),
(42, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-23 16:26:58', '2026-03-23 16:26:58'),
(43, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-23 16:26:58', '2026-03-23 16:26:58'),
(44, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-23 16:26:59', '2026-03-23 16:26:59'),
(45, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-23 16:36:21', '2026-03-23 16:36:21'),
(46, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-23 16:36:22', '2026-03-23 16:36:22'),
(47, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-23 16:36:22', '2026-03-23 16:36:22'),
(48, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-23 16:36:22', '2026-03-23 16:36:22'),
(49, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-23 17:10:23', '2026-03-23 17:10:23'),
(50, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-23 17:10:24', '2026-03-23 17:10:24'),
(51, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-23 17:10:24', '2026-03-23 17:10:24'),
(52, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-23 17:10:24', '2026-03-23 17:10:24'),
(53, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-23 17:37:37', '2026-03-23 17:37:37'),
(54, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-23 17:37:37', '2026-03-23 17:37:37'),
(55, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-23 17:37:37', '2026-03-23 17:37:37'),
(56, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-23 17:37:37', '2026-03-23 17:37:37'),
(57, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-23 18:40:07', '2026-03-23 18:40:07'),
(58, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-23 18:40:07', '2026-03-23 18:40:07'),
(59, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-23 18:40:08', '2026-03-23 18:40:08'),
(60, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-23 18:40:08', '2026-03-23 18:40:08'),
(61, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-23 19:10:20', '2026-03-23 19:10:20'),
(62, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-23 19:10:20', '2026-03-23 19:10:20'),
(63, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-23 19:10:20', '2026-03-23 19:10:20'),
(64, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-23 19:10:21', '2026-03-23 19:10:21'),
(65, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-27 11:18:28', '2026-03-27 11:18:28'),
(66, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-27 11:18:29', '2026-03-27 11:18:29'),
(67, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-27 11:18:29', '2026-03-27 11:18:29'),
(68, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-27 11:18:29', '2026-03-27 11:18:29'),
(69, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-27 12:14:38', '2026-03-27 12:14:38'),
(70, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-27 12:14:39', '2026-03-27 12:14:39'),
(71, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-27 12:14:39', '2026-03-27 12:14:39'),
(72, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-27 12:14:39', '2026-03-27 12:14:39'),
(73, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-27 17:18:38', '2026-03-27 17:18:38'),
(74, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-27 17:18:38', '2026-03-27 17:18:38'),
(75, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-27 17:18:39', '2026-03-27 17:18:39'),
(76, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-27 17:18:39', '2026-03-27 17:18:39'),
(77, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-27 17:59:46', '2026-03-27 17:59:46'),
(78, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-27 17:59:47', '2026-03-27 17:59:47'),
(79, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-27 17:59:52', '2026-03-27 17:59:52'),
(80, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-27 17:59:54', '2026-03-27 17:59:54'),
(81, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-27 19:09:08', '2026-03-27 19:09:08'),
(82, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-27 19:09:08', '2026-03-27 19:09:08'),
(83, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-27 19:09:09', '2026-03-27 19:09:09'),
(84, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-27 19:09:09', '2026-03-27 19:09:09'),
(85, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 11:47:59', '2026-03-29 11:47:59'),
(86, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 11:47:59', '2026-03-29 11:47:59'),
(87, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 11:47:59', '2026-03-29 11:47:59'),
(88, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 11:48:00', '2026-03-29 11:48:00'),
(89, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 12:45:10', '2026-03-29 12:45:10'),
(90, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 12:45:10', '2026-03-29 12:45:10'),
(91, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 12:45:10', '2026-03-29 12:45:10'),
(92, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 12:45:10', '2026-03-29 12:45:10'),
(93, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 12:51:30', '2026-03-29 12:51:30'),
(94, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 12:51:31', '2026-03-29 12:51:31'),
(95, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 12:51:31', '2026-03-29 12:51:31'),
(96, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 12:51:31', '2026-03-29 12:51:31'),
(97, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 13:00:57', '2026-03-29 13:00:57'),
(98, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 13:00:57', '2026-03-29 13:00:57'),
(99, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 13:00:58', '2026-03-29 13:00:58'),
(100, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 13:00:58', '2026-03-29 13:00:58'),
(101, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 13:07:44', '2026-03-29 13:07:44'),
(102, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 13:07:45', '2026-03-29 13:07:45'),
(103, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 13:07:45', '2026-03-29 13:07:45'),
(104, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 13:07:45', '2026-03-29 13:07:45'),
(105, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 13:14:31', '2026-03-29 13:14:31'),
(106, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 13:14:32', '2026-03-29 13:14:32'),
(107, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 13:14:32', '2026-03-29 13:14:32'),
(108, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 13:14:33', '2026-03-29 13:14:33'),
(109, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 13:21:43', '2026-03-29 13:21:43'),
(110, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 13:21:43', '2026-03-29 13:21:43'),
(111, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 13:21:43', '2026-03-29 13:21:43'),
(112, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 13:21:43', '2026-03-29 13:21:43'),
(113, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 13:28:27', '2026-03-29 13:28:27'),
(114, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 13:28:28', '2026-03-29 13:28:28'),
(115, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 13:28:28', '2026-03-29 13:28:28'),
(116, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 13:28:28', '2026-03-29 13:28:28'),
(117, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 13:35:31', '2026-03-29 13:35:31'),
(118, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 13:35:31', '2026-03-29 13:35:31'),
(119, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 13:35:31', '2026-03-29 13:35:31'),
(120, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 13:35:31', '2026-03-29 13:35:31'),
(121, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 13:42:44', '2026-03-29 13:42:44'),
(122, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 13:42:44', '2026-03-29 13:42:44'),
(123, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 13:42:45', '2026-03-29 13:42:45'),
(124, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 13:42:45', '2026-03-29 13:42:45'),
(125, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 13:48:54', '2026-03-29 13:48:54'),
(126, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 13:48:55', '2026-03-29 13:48:55'),
(127, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 13:48:55', '2026-03-29 13:48:55'),
(128, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 13:48:55', '2026-03-29 13:48:55'),
(129, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 13:55:46', '2026-03-29 13:55:46'),
(130, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 13:55:46', '2026-03-29 13:55:46'),
(131, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 13:55:46', '2026-03-29 13:55:46'),
(132, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 13:55:47', '2026-03-29 13:55:47'),
(133, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 14:02:06', '2026-03-29 14:02:06'),
(134, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 14:02:07', '2026-03-29 14:02:07'),
(135, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 14:02:07', '2026-03-29 14:02:07'),
(136, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 14:02:07', '2026-03-29 14:02:07'),
(137, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 14:08:51', '2026-03-29 14:08:51'),
(138, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 14:08:52', '2026-03-29 14:08:52'),
(139, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 14:08:52', '2026-03-29 14:08:52'),
(140, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 14:08:52', '2026-03-29 14:08:52'),
(141, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 14:15:08', '2026-03-29 14:15:08'),
(142, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 14:15:08', '2026-03-29 14:15:08'),
(143, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 14:15:08', '2026-03-29 14:15:08'),
(144, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 14:15:09', '2026-03-29 14:15:09'),
(145, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 14:21:18', '2026-03-29 14:21:18'),
(146, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 14:21:18', '2026-03-29 14:21:18'),
(147, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 14:21:19', '2026-03-29 14:21:19'),
(148, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 14:21:19', '2026-03-29 14:21:19'),
(149, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 14:28:20', '2026-03-29 14:28:20'),
(150, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 14:28:20', '2026-03-29 14:28:20'),
(151, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 14:28:20', '2026-03-29 14:28:20'),
(152, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 14:28:20', '2026-03-29 14:28:20'),
(153, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 14:34:02', '2026-03-29 14:34:02'),
(154, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 14:34:02', '2026-03-29 14:34:02'),
(155, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 14:34:02', '2026-03-29 14:34:02'),
(156, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 14:34:03', '2026-03-29 14:34:03'),
(157, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 14:42:11', '2026-03-29 14:42:11'),
(158, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 14:42:12', '2026-03-29 14:42:12'),
(159, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 14:42:12', '2026-03-29 14:42:12'),
(160, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 14:42:12', '2026-03-29 14:42:12'),
(161, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 15:16:34', '2026-03-29 15:16:34'),
(162, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 15:16:36', '2026-03-29 15:16:36'),
(163, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 15:16:39', '2026-03-29 15:16:39'),
(164, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 15:16:40', '2026-03-29 15:16:40'),
(165, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 15:31:10', '2026-03-29 15:31:10'),
(166, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 15:31:10', '2026-03-29 15:31:10'),
(167, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 15:31:10', '2026-03-29 15:31:10'),
(168, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 15:31:12', '2026-03-29 15:31:12'),
(169, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 15:39:27', '2026-03-29 15:39:27'),
(170, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 15:39:28', '2026-03-29 15:39:28'),
(171, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 15:39:28', '2026-03-29 15:39:28'),
(172, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 15:39:28', '2026-03-29 15:39:28'),
(173, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 15:46:47', '2026-03-29 15:46:47'),
(174, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 15:46:47', '2026-03-29 15:46:47'),
(175, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 15:46:47', '2026-03-29 15:46:47'),
(176, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 15:46:48', '2026-03-29 15:46:48'),
(177, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 15:55:03', '2026-03-29 15:55:03'),
(178, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 15:55:04', '2026-03-29 15:55:04'),
(179, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 15:55:04', '2026-03-29 15:55:04'),
(180, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 15:55:04', '2026-03-29 15:55:04'),
(181, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 16:02:20', '2026-03-29 16:02:20'),
(182, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 16:02:20', '2026-03-29 16:02:20'),
(183, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 16:02:20', '2026-03-29 16:02:20'),
(184, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 16:02:20', '2026-03-29 16:02:20'),
(185, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 16:09:12', '2026-03-29 16:09:12'),
(186, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 16:09:12', '2026-03-29 16:09:12'),
(187, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 16:09:13', '2026-03-29 16:09:13'),
(188, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 16:09:13', '2026-03-29 16:09:13'),
(189, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 16:16:02', '2026-03-29 16:16:02'),
(190, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 16:16:02', '2026-03-29 16:16:02'),
(191, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 16:16:03', '2026-03-29 16:16:03'),
(192, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 16:16:03', '2026-03-29 16:16:03'),
(193, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 16:23:25', '2026-03-29 16:23:25'),
(194, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 16:23:26', '2026-03-29 16:23:26'),
(195, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 16:23:26', '2026-03-29 16:23:26'),
(196, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 16:23:26', '2026-03-29 16:23:26'),
(197, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 16:30:05', '2026-03-29 16:30:05'),
(198, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 16:30:06', '2026-03-29 16:30:06'),
(199, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 16:30:06', '2026-03-29 16:30:06'),
(200, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 16:30:06', '2026-03-29 16:30:06'),
(201, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 16:36:38', '2026-03-29 16:36:38'),
(202, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 16:36:39', '2026-03-29 16:36:39'),
(203, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 16:36:39', '2026-03-29 16:36:39'),
(204, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 16:36:39', '2026-03-29 16:36:39'),
(205, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 16:51:39', '2026-03-29 16:51:39'),
(206, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 16:51:39', '2026-03-29 16:51:39'),
(207, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 16:51:39', '2026-03-29 16:51:39'),
(208, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 16:51:39', '2026-03-29 16:51:39'),
(209, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 18:23:55', '2026-03-29 18:23:55'),
(210, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 18:23:55', '2026-03-29 18:23:55'),
(211, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 18:23:56', '2026-03-29 18:23:56'),
(212, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 18:23:56', '2026-03-29 18:23:56'),
(213, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 18:31:33', '2026-03-29 18:31:33'),
(214, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 18:31:33', '2026-03-29 18:31:33'),
(215, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 18:31:34', '2026-03-29 18:31:34'),
(216, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 18:31:36', '2026-03-29 18:31:36'),
(217, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 18:38:41', '2026-03-29 18:38:41'),
(218, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 18:38:41', '2026-03-29 18:38:41'),
(219, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 18:38:42', '2026-03-29 18:38:42'),
(220, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 18:38:42', '2026-03-29 18:38:42'),
(221, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 19:03:36', '2026-03-29 19:03:36'),
(222, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 19:03:36', '2026-03-29 19:03:36'),
(223, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 19:03:36', '2026-03-29 19:03:36'),
(224, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 19:03:37', '2026-03-29 19:03:37'),
(225, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 19:13:50', '2026-03-29 19:13:50'),
(226, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 19:13:50', '2026-03-29 19:13:50'),
(227, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 19:13:51', '2026-03-29 19:13:51'),
(228, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 19:13:51', '2026-03-29 19:13:51'),
(229, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 19:25:50', '2026-03-29 19:25:50'),
(230, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 19:25:50', '2026-03-29 19:25:50'),
(231, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 19:25:51', '2026-03-29 19:25:51'),
(232, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 19:25:51', '2026-03-29 19:25:51'),
(233, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-29 19:28:21', '2026-03-29 19:28:21'),
(234, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-29 19:28:21', '2026-03-29 19:28:21'),
(235, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-29 19:28:21', '2026-03-29 19:28:21'),
(236, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-29 19:28:21', '2026-03-29 19:28:21'),
(237, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-30 05:51:26', '2026-03-30 05:51:26'),
(238, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-30 05:51:26', '2026-03-30 05:51:26'),
(239, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-30 05:51:27', '2026-03-30 05:51:27'),
(240, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-30 05:51:28', '2026-03-30 05:51:28'),
(241, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-30 06:16:32', '2026-03-30 06:16:32'),
(242, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-30 06:16:33', '2026-03-30 06:16:33'),
(243, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-30 06:16:33', '2026-03-30 06:16:33'),
(244, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-30 06:16:34', '2026-03-30 06:16:34'),
(245, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-30 06:47:21', '2026-03-30 06:47:21'),
(246, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-30 06:47:21', '2026-03-30 06:47:21'),
(247, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-30 06:47:22', '2026-03-30 06:47:22'),
(248, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-30 06:47:22', '2026-03-30 06:47:22'),
(249, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-30 06:56:27', '2026-03-30 06:56:27'),
(250, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-30 06:56:27', '2026-03-30 06:56:27'),
(251, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-30 06:56:27', '2026-03-30 06:56:27'),
(252, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-30 06:56:28', '2026-03-30 06:56:28'),
(253, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-30 09:04:06', '2026-03-30 09:04:06'),
(254, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-30 09:04:06', '2026-03-30 09:04:06'),
(255, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-30 09:04:07', '2026-03-30 09:04:07'),
(256, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-30 09:04:07', '2026-03-30 09:04:07'),
(257, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-30 09:14:32', '2026-03-30 09:14:32'),
(258, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-30 09:14:32', '2026-03-30 09:14:32'),
(259, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-30 09:14:33', '2026-03-30 09:14:33'),
(260, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-30 09:14:33', '2026-03-30 09:14:33'),
(261, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-30 09:17:04', '2026-03-30 09:17:04'),
(262, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-30 09:17:04', '2026-03-30 09:17:04'),
(263, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-30 09:17:04', '2026-03-30 09:17:04'),
(264, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-30 09:17:04', '2026-03-30 09:17:04'),
(265, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-30 09:21:46', '2026-03-30 09:21:46'),
(266, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-30 09:21:46', '2026-03-30 09:21:46'),
(267, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-30 09:21:47', '2026-03-30 09:21:47'),
(268, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-30 09:21:47', '2026-03-30 09:21:47'),
(269, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-30 09:27:01', '2026-03-30 09:27:01'),
(270, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-30 09:27:01', '2026-03-30 09:27:01'),
(271, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-30 09:27:02', '2026-03-30 09:27:02'),
(272, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-30 09:27:02', '2026-03-30 09:27:02'),
(273, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-30 09:34:19', '2026-03-30 09:34:19'),
(274, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-30 09:34:19', '2026-03-30 09:34:19'),
(275, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-30 09:34:19', '2026-03-30 09:34:19'),
(276, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-30 09:34:19', '2026-03-30 09:34:19'),
(277, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-30 09:41:39', '2026-03-30 09:41:39'),
(278, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-30 09:41:39', '2026-03-30 09:41:39'),
(279, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-30 09:41:40', '2026-03-30 09:41:40'),
(280, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-30 09:41:40', '2026-03-30 09:41:40'),
(281, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-30 17:33:02', '2026-03-30 17:33:02'),
(282, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-30 17:33:02', '2026-03-30 17:33:02'),
(283, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-30 17:33:03', '2026-03-30 17:33:03'),
(284, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-30 17:33:03', '2026-03-30 17:33:03'),
(285, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-30 22:43:23', '2026-03-30 22:43:23'),
(286, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-30 22:43:24', '2026-03-30 22:43:24'),
(287, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-30 22:43:24', '2026-03-30 22:43:24'),
(288, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-30 22:43:24', '2026-03-30 22:43:24'),
(289, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-03-31 20:39:12', '2026-03-31 20:39:12'),
(290, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-03-31 20:39:12', '2026-03-31 20:39:12'),
(291, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-03-31 20:39:13', '2026-03-31 20:39:13'),
(292, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-03-31 20:39:13', '2026-03-31 20:39:13'),
(293, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-04 11:21:55', '2026-04-04 11:21:55'),
(294, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-04 11:21:56', '2026-04-04 11:21:56'),
(295, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-04 11:21:56', '2026-04-04 11:21:56'),
(296, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-04 11:21:56', '2026-04-04 11:21:56'),
(297, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-04 17:44:48', '2026-04-04 17:44:48'),
(298, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-04 17:44:48', '2026-04-04 17:44:48'),
(299, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-04 17:44:48', '2026-04-04 17:44:48'),
(300, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-04 17:44:49', '2026-04-04 17:44:49'),
(301, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-04 17:51:54', '2026-04-04 17:51:54'),
(302, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-04 17:51:54', '2026-04-04 17:51:54'),
(303, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-04 17:51:55', '2026-04-04 17:51:55'),
(304, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-04 17:51:55', '2026-04-04 17:51:55'),
(305, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-04 18:21:34', '2026-04-04 18:21:34'),
(306, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-04 18:21:35', '2026-04-04 18:21:35'),
(307, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-04 18:21:35', '2026-04-04 18:21:35'),
(308, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-04 18:21:35', '2026-04-04 18:21:35'),
(309, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-04 20:46:20', '2026-04-04 20:46:20'),
(310, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-04 20:46:21', '2026-04-04 20:46:21'),
(311, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-04 20:46:23', '2026-04-04 20:46:23'),
(312, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-04 20:46:23', '2026-04-04 20:46:23'),
(313, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-04 21:01:19', '2026-04-04 21:01:19'),
(314, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-04 21:01:19', '2026-04-04 21:01:19'),
(315, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-04 21:01:20', '2026-04-04 21:01:20'),
(316, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-04 21:01:20', '2026-04-04 21:01:20'),
(317, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-04 21:36:00', '2026-04-04 21:36:00'),
(318, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-04 21:36:01', '2026-04-04 21:36:01'),
(319, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-04 21:36:01', '2026-04-04 21:36:01'),
(320, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-04 21:36:01', '2026-04-04 21:36:01'),
(321, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-04 21:36:32', '2026-04-04 21:36:32'),
(322, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-04 21:36:32', '2026-04-04 21:36:32'),
(323, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-04 21:36:33', '2026-04-04 21:36:33'),
(324, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-04 21:36:33', '2026-04-04 21:36:33'),
(325, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-04 21:57:20', '2026-04-04 21:57:20'),
(326, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-04 21:57:21', '2026-04-04 21:57:21'),
(327, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-04 21:57:21', '2026-04-04 21:57:21'),
(328, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-04 21:57:21', '2026-04-04 21:57:21'),
(329, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-05 18:34:52', '2026-04-05 18:34:52'),
(330, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-05 18:34:53', '2026-04-05 18:34:53'),
(331, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-05 18:34:53', '2026-04-05 18:34:53'),
(332, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-05 18:34:53', '2026-04-05 18:34:53'),
(333, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-05 22:27:46', '2026-04-05 22:27:46'),
(334, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-05 22:27:47', '2026-04-05 22:27:47'),
(335, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-05 22:27:47', '2026-04-05 22:27:47'),
(336, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-05 22:27:47', '2026-04-05 22:27:47'),
(337, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-06 11:41:19', '2026-04-06 11:41:19'),
(338, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-06 11:41:19', '2026-04-06 11:41:19'),
(339, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-06 11:41:20', '2026-04-06 11:41:20'),
(340, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-06 11:41:20', '2026-04-06 11:41:20'),
(341, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-06 11:55:41', '2026-04-06 11:55:41'),
(342, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-06 11:55:41', '2026-04-06 11:55:41'),
(343, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-06 11:55:42', '2026-04-06 11:55:42'),
(344, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-06 11:55:42', '2026-04-06 11:55:42'),
(345, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-06 12:05:04', '2026-04-06 12:05:04'),
(346, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-06 12:05:04', '2026-04-06 12:05:04'),
(347, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-06 12:05:04', '2026-04-06 12:05:04'),
(348, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-06 12:05:04', '2026-04-06 12:05:04'),
(349, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-06 12:12:16', '2026-04-06 12:12:16'),
(350, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-06 12:12:16', '2026-04-06 12:12:16'),
(351, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-06 12:12:16', '2026-04-06 12:12:16'),
(352, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-06 12:12:17', '2026-04-06 12:12:17'),
(353, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-06 12:18:38', '2026-04-06 12:18:38'),
(354, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-06 12:18:39', '2026-04-06 12:18:39'),
(355, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-06 12:18:39', '2026-04-06 12:18:39'),
(356, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-06 12:18:39', '2026-04-06 12:18:39'),
(357, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-06 12:23:40', '2026-04-06 12:23:40'),
(358, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-06 12:23:40', '2026-04-06 12:23:40'),
(359, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-06 12:23:40', '2026-04-06 12:23:40'),
(360, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-06 12:23:40', '2026-04-06 12:23:40'),
(361, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-06 12:28:19', '2026-04-06 12:28:19'),
(362, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-06 12:28:19', '2026-04-06 12:28:19'),
(363, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-06 12:28:20', '2026-04-06 12:28:20'),
(364, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-06 12:28:20', '2026-04-06 12:28:20'),
(365, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-06 12:33:57', '2026-04-06 12:33:57'),
(366, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-06 12:33:57', '2026-04-06 12:33:57'),
(367, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-06 12:33:58', '2026-04-06 12:33:58'),
(368, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-06 12:33:58', '2026-04-06 12:33:58'),
(369, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-06 15:22:18', '2026-04-06 15:22:18'),
(370, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-06 15:22:19', '2026-04-06 15:22:19'),
(371, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-06 15:22:19', '2026-04-06 15:22:19'),
(372, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-06 15:22:19', '2026-04-06 15:22:19'),
(373, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-06 20:35:07', '2026-04-06 20:35:07'),
(374, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-06 20:35:07', '2026-04-06 20:35:07'),
(375, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-06 20:35:07', '2026-04-06 20:35:07'),
(376, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-06 20:35:08', '2026-04-06 20:35:08'),
(377, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-06 21:58:15', '2026-04-06 21:58:15'),
(378, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-06 21:58:15', '2026-04-06 21:58:15'),
(379, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-06 21:58:15', '2026-04-06 21:58:15'),
(380, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-06 21:58:15', '2026-04-06 21:58:15'),
(381, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-06 22:25:06', '2026-04-06 22:25:06'),
(382, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-06 22:25:06', '2026-04-06 22:25:06'),
(383, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-06 22:25:07', '2026-04-06 22:25:07'),
(384, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-06 22:25:07', '2026-04-06 22:25:07'),
(385, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-07 07:04:02', '2026-04-07 07:04:02'),
(386, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-07 07:04:02', '2026-04-07 07:04:02'),
(387, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-07 07:04:02', '2026-04-07 07:04:02'),
(388, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-07 07:04:03', '2026-04-07 07:04:03'),
(389, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-07 12:59:55', '2026-04-07 12:59:55'),
(390, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-07 12:59:56', '2026-04-07 12:59:56'),
(391, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-07 12:59:56', '2026-04-07 12:59:56'),
(392, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-07 12:59:56', '2026-04-07 12:59:56'),
(393, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-08 05:54:34', '2026-04-08 05:54:34'),
(394, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-08 05:54:34', '2026-04-08 05:54:34'),
(395, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-08 05:54:35', '2026-04-08 05:54:35'),
(396, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-08 05:54:35', '2026-04-08 05:54:35'),
(397, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-09 13:26:55', '2026-04-09 13:26:55'),
(398, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-09 13:26:55', '2026-04-09 13:26:55'),
(399, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-09 13:26:55', '2026-04-09 13:26:55'),
(400, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-09 13:26:55', '2026-04-09 13:26:55'),
(401, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-10 07:03:29', '2026-04-10 07:03:29'),
(402, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-10 07:03:29', '2026-04-10 07:03:29'),
(403, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-10 07:03:30', '2026-04-10 07:03:30'),
(404, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-10 07:03:30', '2026-04-10 07:03:30'),
(405, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-10 08:12:55', '2026-04-10 08:12:55'),
(406, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-10 08:12:55', '2026-04-10 08:12:55'),
(407, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-10 08:12:55', '2026-04-10 08:12:55'),
(408, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-10 08:12:56', '2026-04-10 08:12:56'),
(409, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-10 08:34:32', '2026-04-10 08:34:32'),
(410, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-10 08:34:33', '2026-04-10 08:34:33'),
(411, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-10 08:34:33', '2026-04-10 08:34:33'),
(412, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-10 08:34:33', '2026-04-10 08:34:33'),
(413, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-10 11:25:53', '2026-04-10 11:25:53'),
(414, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-10 11:25:53', '2026-04-10 11:25:53'),
(415, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-10 11:25:54', '2026-04-10 11:25:54'),
(416, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-10 11:25:54', '2026-04-10 11:25:54'),
(417, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-10 12:14:35', '2026-04-10 12:14:35'),
(418, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-10 12:14:35', '2026-04-10 12:14:35'),
(419, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-10 12:14:35', '2026-04-10 12:14:35'),
(420, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-10 12:14:36', '2026-04-10 12:14:36'),
(421, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-10 13:22:55', '2026-04-10 13:22:55'),
(422, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-10 13:22:55', '2026-04-10 13:22:55'),
(423, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-10 13:22:55', '2026-04-10 13:22:55'),
(424, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-10 13:22:56', '2026-04-10 13:22:56'),
(425, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-20 16:13:45', '2026-04-20 16:13:45'),
(426, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-20 16:13:45', '2026-04-20 16:13:45'),
(427, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-20 16:13:45', '2026-04-20 16:13:45'),
(428, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-20 16:13:45', '2026-04-20 16:13:45'),
(429, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-21 10:41:53', '2026-04-21 10:41:53'),
(430, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-21 10:41:54', '2026-04-21 10:41:54'),
(431, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-21 10:41:54', '2026-04-21 10:41:54'),
(432, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-21 10:41:55', '2026-04-21 10:41:55'),
(433, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-22 09:41:18', '2026-04-22 09:41:18'),
(434, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-22 09:41:19', '2026-04-22 09:41:19'),
(435, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-22 09:41:19', '2026-04-22 09:41:19'),
(436, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-22 09:41:19', '2026-04-22 09:41:19'),
(437, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-24 19:09:38', '2026-04-24 19:09:38'),
(438, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-24 19:09:38', '2026-04-24 19:09:38'),
(439, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-24 19:09:39', '2026-04-24 19:09:39'),
(440, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-24 19:09:39', '2026-04-24 19:09:39'),
(441, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-26 17:51:43', '2026-04-26 17:51:43'),
(442, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-26 17:51:44', '2026-04-26 17:51:44'),
(443, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-26 17:51:44', '2026-04-26 17:51:44'),
(444, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-26 17:51:44', '2026-04-26 17:51:44'),
(445, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-04-28 21:47:25', '2026-04-28 21:47:25'),
(446, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-04-28 21:47:25', '2026-04-28 21:47:25'),
(447, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-04-28 21:47:25', '2026-04-28 21:47:25'),
(448, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-04-28 21:47:25', '2026-04-28 21:47:25'),
(449, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-05-01 15:17:21', '2026-05-01 15:17:21'),
(450, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-05-01 15:17:21', '2026-05-01 15:17:21'),
(451, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-05-01 15:17:21', '2026-05-01 15:17:21'),
(452, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-05-01 15:17:22', '2026-05-01 15:17:22'),
(453, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-05-02 10:18:32', '2026-05-02 10:18:32'),
(454, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-05-02 10:18:32', '2026-05-02 10:18:32'),
(455, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-05-02 10:18:33', '2026-05-02 10:18:33'),
(456, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-05-02 10:18:33', '2026-05-02 10:18:33'),
(457, 'campaign', 'Starter Coaching Campaign', 'Ready-to-go template for new coaches', '{}', 1, 'all', NULL, '2026-05-02 20:38:00', '2026-05-02 20:38:00'),
(458, 'campaign', 'Class Promotion', 'Boost a specific class or session', '{}', 1, 'all', NULL, '2026-05-02 20:38:00', '2026-05-02 20:38:00'),
(459, 'budget', 'Starter Budget', 'Recommended for new coaches', '{}', 1, 'all', NULL, '2026-05-02 20:38:00', '2026-05-02 20:38:00'),
(460, 'budget', 'Growth Budget', 'For established coaches', '{}', 1, 'all', NULL, '2026-05-02 20:38:01', '2026-05-02 20:38:01');

-- --------------------------------------------------------
-- Table: `ad_wallet_ledger`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `ad_wallet_ledger`;
CREATE TABLE `ad_wallet_ledger` (
  `id` int NOT NULL AUTO_INCREMENT,
  `coach_id` int NOT NULL,
  `entry_type` enum('credit','debit','refund','admin_grant','admin_deduct') NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `balance_after` decimal(10,2) NOT NULL,
  `campaign_id` int DEFAULT NULL,
  `reference` varchar(255) DEFAULT NULL,
  `note` text,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_coach` (`coach_id`)
);

-- --------------------------------------------------------
-- Table: `ad_wallets`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `ad_wallets`;
CREATE TABLE `ad_wallets` (
  `coach_id` int NOT NULL,
  `balance` decimal(10,2) DEFAULT '0.00',
  `lifetime_spent` decimal(10,2) DEFAULT '0.00',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`coach_id`)
);

-- --------------------------------------------------------
-- Table: `admin_ad_settings`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `admin_ad_settings`;
CREATE TABLE `admin_ad_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(120) NOT NULL,
  `setting_value` text NOT NULL,
  `setting_type` enum('boolean','integer','string','json') DEFAULT 'string',
  `label` varchar(200) DEFAULT NULL,
  `description` text,
  `category` varchar(80) DEFAULT 'general',
  `updated_by` int DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
);

INSERT INTO `admin_ad_settings` (`id`, `setting_key`, `setting_value`, `setting_type`, `label`, `description`, `category`, `updated_by`, `updated_at`) VALUES
(1, 'ads_system_enabled', 'true', 'boolean', 'Ads System Enabled', NULL, 'global', NULL, '2026-03-22 18:46:59'),
(2, 'require_admin_approval', 'true', 'boolean', 'Campaigns Require Admin Approval', NULL, 'global', NULL, '2026-03-22 18:47:00'),
(3, 'default_campaign_status', 'draft', 'string', 'Default Status for New Campaigns', NULL, 'global', NULL, '2026-03-22 18:47:00'),
(4, 'coaches_can_create_directly', 'true', 'boolean', 'Coaches Can Create Campaigns', NULL, 'global', NULL, '2026-03-22 18:47:00'),
(5, 'min_daily_budget', '10', 'integer', 'Minimum Daily Budget (EGP)', NULL, 'budget', NULL, '2026-03-22 18:47:00'),
(6, 'max_daily_budget', '5000', 'integer', 'Maximum Daily Budget (EGP)', NULL, 'budget', NULL, '2026-03-22 18:47:01'),
(7, 'min_lifetime_budget', '50', 'integer', 'Minimum Lifetime Budget (EGP)', NULL, 'budget', NULL, '2026-03-22 18:47:01'),
(8, 'max_lifetime_budget', '50000', 'integer', 'Maximum Lifetime Budget (EGP)', NULL, 'budget', NULL, '2026-03-22 18:47:01'),
(9, 'auto_pause_overspend', 'true', 'boolean', 'Auto-Pause When Budget Exceeded', NULL, 'budget', NULL, '2026-03-22 18:47:02'),
(10, 'targeting_location_enabled', 'true', 'boolean', 'Allow Location Targeting', NULL, 'targeting', NULL, '2026-03-22 18:47:03'),
(11, 'targeting_age_enabled', 'true', 'boolean', 'Allow Age Group Targeting', NULL, 'targeting', NULL, '2026-03-22 18:47:03'),
(12, 'targeting_activity_enabled', 'true', 'boolean', 'Allow Activity Level Targeting', NULL, 'targeting', NULL, '2026-03-22 18:47:03'),
(13, 'targeting_language_enabled', 'true', 'boolean', 'Allow Language Targeting', NULL, 'targeting', NULL, '2026-03-22 18:47:04'),
(14, 'targeting_interests_enabled', 'true', 'boolean', 'Allow Interest Targeting', NULL, 'targeting', NULL, '2026-03-22 18:47:04'),
(15, 'allow_image_creative', 'true', 'boolean', 'Allow Image Creatives', NULL, 'creatives', NULL, '2026-03-22 18:47:05'),
(16, 'allow_video_creative', 'true', 'boolean', 'Allow Video Creatives', NULL, 'creatives', NULL, '2026-03-22 18:47:05'),
(17, 'allow_carousel_creative', 'true', 'boolean', 'Allow Carousel Creatives', NULL, 'creatives', NULL, '2026-03-22 18:47:05'),
(18, 'allow_text_creative', 'true', 'boolean', 'Allow Text-Only Creatives', NULL, 'creatives', NULL, '2026-03-22 18:47:06'),
(19, 'max_image_size_kb', '5120', 'integer', 'Max Image Size (KB)', NULL, 'creatives', NULL, '2026-03-22 18:47:06'),
(20, 'max_video_size_kb', '102400', 'integer', 'Max Video Size (KB)', NULL, 'creatives', NULL, '2026-03-22 18:47:06'),
(21, 'auto_flag_keywords', '[`spam`,`fake`,`guaranteed`,"100%","free money"]', 'json', 'Auto-Flag Keywords', NULL, 'moderation', NULL, '2026-03-22 18:47:07'),
(22, 'auto_flag_duplicate', 'true', 'boolean', 'Auto-Flag Duplicate Campaigns', NULL, 'moderation', NULL, '2026-03-22 18:47:07'),
(23, 'flag_action', 'pause', 'string', 'Action When Flagged (pause/review/reject)', NULL, 'moderation', NULL, '2026-03-22 18:47:07'),
(24, 'analytics_refresh_minutes', '30', 'integer', 'Analytics Refresh Interval (mins)', NULL, 'reporting', NULL, '2026-03-22 18:47:08'),
(25, 'allow_csv_export', 'true', 'boolean', 'Allow CSV Export', NULL, 'reporting', NULL, '2026-03-22 18:47:08'),
(26, 'default_reporting_window', '30', 'integer', 'Default Reporting Window (days)', NULL, 'reporting', NULL, '2026-03-22 18:47:08'),
(27, 'audit_log_enabled', 'true', 'boolean', 'Audit Log Enabled', NULL, 'security', NULL, '2026-03-22 18:47:09'),
(28, 'session_timeout_minutes', '480', 'integer', 'Session Timeout (minutes)', NULL, 'security', NULL, '2026-03-22 18:47:10'),
(29, 'rate_limit_campaigns_per_day', '10', 'integer', 'Max Campaign Creates Per Day', NULL, 'security', NULL, '2026-03-22 18:47:10');

-- --------------------------------------------------------
-- Table: `ads`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `ads`;
CREATE TABLE `ads` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ad_set_id` int NOT NULL,
  `campaign_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `status` enum('active','paused','archived') DEFAULT 'active',
  `creative_id` int DEFAULT NULL,
  `headline` varchar(255) DEFAULT NULL,
  `body` text,
  `cta` varchar(100) DEFAULT NULL,
  `destination_type` enum('profile','class','package','booking','announcement') DEFAULT 'profile',
  `destination_ref` varchar(500) DEFAULT NULL,
  `impressions` int DEFAULT '0',
  `clicks` int DEFAULT '0',
  `saves` int DEFAULT '0',
  `conversions` int DEFAULT '0',
  `ctr` decimal(6,4) DEFAULT '0.0000',
  `cpm` decimal(10,4) DEFAULT '0.0000',
  `amount_spent` decimal(10,2) DEFAULT '0.00',
  `variant_group` varchar(80) DEFAULT NULL,
  `is_control` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ad_set` (`ad_set_id`),
  KEY `idx_campaign` (`campaign_id`),
  CONSTRAINT `ads_ibfk_1` FOREIGN KEY (`ad_set_id`) REFERENCES `ad_sets` (`id`) ON DELETE CASCADE
);

INSERT INTO `ads` (`id`, `ad_set_id`, `campaign_id`, `name`, `status`, `creative_id`, `headline`, `body`, `cta`, `destination_type`, `destination_ref`, `impressions`, `clicks`, `saves`, `conversions`, `ctr`, `cpm`, `amount_spent`, `variant_group`, `is_control`, `created_at`, `updated_at`) VALUES
(1, 13, 19, 'Transformation Body 2025 Set 1 Ad 1', 'paused', 4, NULL, NULL, NULL, 'profile', NULL, 12959, 400, 0, 79, '0.0000', '0.0000', '606.54', NULL, 0, '2026-02-21 18:40:21', '2026-04-06 18:40:21'),
(2, 14, 20, 'Transformation Coaching 2026 Set 1 Ad 1', 'active', 5, NULL, NULL, NULL, 'profile', NULL, 3586, 48, 0, 1, '0.0000', '0.0000', '349.85', NULL, 0, '2026-02-01 18:40:27', '2026-04-13 18:40:27'),
(3, 14, 20, 'Transformation Coaching 2026 Set 1 Ad 2', 'active', 6, NULL, NULL, NULL, 'profile', NULL, 17074, 737, 0, 57, '0.0000', '0.0000', '168.09', NULL, 0, '2026-02-01 18:40:27', '2026-04-13 18:40:27'),
(4, 15, 20, 'Transformation Coaching 2026 Set 2 Ad 1', 'paused', 7, NULL, NULL, NULL, 'profile', NULL, 10598, 337, 0, 8, '0.0000', '0.0000', '654.28', NULL, 0, '2026-02-01 18:40:27', '2026-04-13 18:40:27'),
(5, 16, 21, 'Summer Coaching 2025 Set 1 Ad 1', 'active', 8, NULL, NULL, NULL, 'profile', NULL, 8737, 365, 0, 18, '0.0000', '0.0000', '336.37', NULL, 0, '2026-02-16 18:40:34', '2026-04-23 18:40:34'),
(6, 17, 21, 'Summer Coaching 2025 Set 2 Ad 1', 'active', 9, NULL, NULL, NULL, 'profile', NULL, 14428, 637, 0, 53, '0.0000', '0.0000', '689.72', NULL, 0, '2026-02-16 18:40:34', '2026-04-23 18:40:34'),
(7, 17, 21, 'Summer Coaching 2025 Set 2 Ad 2', 'paused', 10, NULL, NULL, NULL, 'profile', NULL, 18127, 233, 0, 28, '0.0000', '0.0000', '556.89', NULL, 0, '2026-02-16 18:40:34', '2026-04-23 18:40:34'),
(8, 18, 22, 'Summer Wellness 2024 Set 1 Ad 1', 'paused', 11, NULL, NULL, NULL, 'profile', NULL, 7694, 102, 0, 12, '0.0000', '0.0000', '604.48', NULL, 0, '2026-01-31 18:40:42', '2026-05-25 18:40:42'),
(9, 18, 22, 'Summer Wellness 2024 Set 1 Ad 2', 'paused', 12, NULL, NULL, NULL, 'profile', NULL, 5118, 164, 0, 19, '0.0000', '0.0000', '207.67', NULL, 0, '2026-01-31 18:40:42', '2026-05-25 18:40:42'),
(10, 19, 22, 'Summer Wellness 2024 Set 2 Ad 1', 'paused', 13, NULL, NULL, NULL, 'profile', NULL, 4053, 48, 0, 3, '0.0000', '0.0000', '952.13', NULL, 0, '2026-01-31 18:40:42', '2026-05-25 18:40:42'),
(11, 20, 23, 'Ramadan Fat Loss 2024 Set 1 Ad 1', 'paused', 14, NULL, NULL, NULL, 'profile', NULL, 5339, 70, 0, 11, '0.0000', '0.0000', '380.54', NULL, 0, '2026-03-17 18:40:49', '2026-04-15 18:40:49'),
(12, 21, 23, 'Ramadan Fat Loss 2024 Set 2 Ad 1', 'active', 15, NULL, NULL, NULL, 'profile', NULL, 18982, 717, 0, 109, '0.0000', '0.0000', '392.24', NULL, 0, '2026-03-17 18:40:49', '2026-04-15 18:40:49'),
(13, 22, 24, 'Transformation Strength 2025 Set 1 Ad 1', 'paused', 16, NULL, NULL, NULL, 'profile', NULL, 8081, 233, 0, 11, '0.0000', '0.0000', '178.14', NULL, 0, '2026-01-29 18:40:55', '2026-05-01 18:40:55'),
(14, 23, 24, 'Transformation Strength 2025 Set 2 Ad 1', 'archived', 17, NULL, NULL, NULL, 'profile', NULL, 12760, 569, 0, 50, '0.0000', '0.0000', '121.92', NULL, 0, '2026-01-29 18:40:55', '2026-05-01 18:40:55'),
(15, 23, 24, 'Transformation Strength 2025 Set 2 Ad 2', 'archived', 18, NULL, NULL, NULL, 'profile', NULL, 8189, 226, 0, 41, '0.0000', '0.0000', '203.52', NULL, 0, '2026-01-29 18:40:55', '2026-05-01 18:40:55'),
(16, 24, 25, 'Challenge Fat Loss 2024 Set 1 Ad 1', 'paused', 19, NULL, NULL, NULL, 'profile', NULL, 9667, 194, 0, 33, '0.0000', '0.0000', '983.43', NULL, 0, '2026-02-11 18:41:25', '2026-04-27 18:41:25'),
(17, 24, 25, 'Challenge Fat Loss 2024 Set 1 Ad 2', 'active', 20, NULL, NULL, NULL, 'profile', NULL, 4534, 93, 0, 3, '0.0000', '0.0000', '1076.90', NULL, 0, '2026-02-11 18:41:25', '2026-04-27 18:41:25'),
(18, 25, 25, 'Challenge Fat Loss 2024 Set 2 Ad 1', 'archived', 21, NULL, NULL, NULL, 'profile', NULL, 9427, 447, 0, 14, '0.0000', '0.0000', '453.22', NULL, 0, '2026-02-11 18:41:25', '2026-04-27 18:41:25'),
(19, 25, 25, 'Challenge Fat Loss 2024 Set 2 Ad 2', 'paused', 22, NULL, NULL, NULL, 'profile', NULL, 15443, 350, 0, 51, '0.0000', '0.0000', '384.20', NULL, 0, '2026-02-11 18:41:25', '2026-04-27 18:41:25'),
(20, 26, 26, 'Ramadan Body 2025 Set 1 Ad 1', 'paused', 23, NULL, NULL, NULL, 'profile', NULL, 4607, 71, 0, 7, '0.0000', '0.0000', '151.64', NULL, 0, '2026-03-17 18:42:07', '2026-05-16 18:42:07'),
(21, 26, 26, 'Ramadan Body 2025 Set 1 Ad 2', 'archived', 24, NULL, NULL, NULL, 'profile', NULL, 5798, 106, 0, 15, '0.0000', '0.0000', '218.33', NULL, 0, '2026-03-17 18:42:07', '2026-05-16 18:42:07'),
(22, 27, 26, 'Ramadan Body 2025 Set 2 Ad 1', 'active', 25, NULL, NULL, NULL, 'profile', NULL, 10634, 530, 0, 28, '0.0000', '0.0000', '255.39', NULL, 0, '2026-03-17 18:42:07', '2026-05-16 18:42:07'),
(23, 28, 27, 'Ramadan Body 2025 Set 1 Ad 1', 'paused', 26, NULL, NULL, NULL, 'profile', NULL, 12820, 629, 0, 99, '0.0000', '0.0000', '373.51', NULL, 0, '2026-02-09 18:42:47', '2026-04-05 18:42:47'),
(24, 28, 27, 'Ramadan Body 2025 Set 1 Ad 2', 'paused', 27, NULL, NULL, NULL, 'profile', NULL, 10925, 323, 0, 1, '0.0000', '0.0000', '437.02', NULL, 0, '2026-02-09 18:42:47', '2026-04-05 18:42:47'),
(25, 29, 27, 'Ramadan Body 2025 Set 2 Ad 1', 'active', 28, NULL, NULL, NULL, 'profile', NULL, 5701, 195, 0, 27, '0.0000', '0.0000', '132.15', NULL, 0, '2026-02-09 18:42:47', '2026-04-05 18:42:47'),
(26, 30, 28, 'Summer Coaching 2026 Set 1 Ad 1', 'paused', 29, NULL, NULL, NULL, 'profile', NULL, 17363, 559, 0, 46, '0.0000', '0.0000', '416.08', NULL, 0, '2026-02-27 18:58:18', '2026-04-28 18:58:18'),
(27, 31, 28, 'Summer Coaching 2026 Set 2 Ad 1', 'paused', 30, NULL, NULL, NULL, 'profile', NULL, 5981, 196, 0, 32, '0.0000', '0.0000', '517.87', NULL, 0, '2026-02-27 18:58:18', '2026-04-28 18:58:18'),
(28, 32, 29, 'Ramadan Fat Loss 2024 Set 1 Ad 1', 'active', 31, NULL, NULL, NULL, 'profile', NULL, 2583, 122, 0, 24, '0.0000', '0.0000', '530.44', NULL, 0, '2026-02-04 18:59:37', '2026-05-12 18:59:37'),
(29, 33, 29, 'Ramadan Fat Loss 2024 Set 2 Ad 1', 'active', 32, NULL, NULL, NULL, 'profile', NULL, 5531, 217, 0, 30, '0.0000', '0.0000', '510.55', NULL, 0, '2026-02-04 18:59:37', '2026-05-12 18:59:37'),
(30, 33, 29, 'Ramadan Fat Loss 2024 Set 2 Ad 2', 'active', 33, NULL, NULL, NULL, 'profile', NULL, 15621, 281, 0, 43, '0.0000', '0.0000', '541.12', NULL, 0, '2026-02-04 18:59:37', '2026-05-12 18:59:37'),
(31, 34, 30, 'Ramadan Fat Loss 2026 Set 1 Ad 1', 'paused', 34, NULL, NULL, NULL, 'profile', NULL, 16473, 814, 0, 30, '0.0000', '0.0000', '1573.92', NULL, 0, '2026-02-15 18:59:57', '2026-05-12 18:59:57'),
(32, 35, 31, 'Transformation Strength 2026 Set 1 Ad 1', 'archived', 35, NULL, NULL, NULL, 'profile', NULL, 4400, 185, 0, 18, '0.0000', '0.0000', '421.89', NULL, 0, '2026-01-30 19:00:06', '2026-04-21 19:00:06'),
(33, 36, 31, 'Transformation Strength 2026 Set 2 Ad 1', 'active', 36, NULL, NULL, NULL, 'profile', NULL, 1200, 30, 0, 5, '0.0000', '0.0000', '285.92', NULL, 0, '2026-01-30 19:00:06', '2026-04-21 19:00:06'),
(34, 36, 31, 'Transformation Strength 2026 Set 2 Ad 2', 'archived', 37, NULL, NULL, NULL, 'profile', NULL, 18431, 849, 0, 42, '0.0000', '0.0000', '222.09', NULL, 0, '2026-01-30 19:00:06', '2026-04-21 19:00:06'),
(35, 37, 32, 'Yoga Wellness 2026 Set 1 Ad 1', 'active', 38, NULL, NULL, NULL, 'profile', NULL, 3328, 127, 0, 20, '0.0000', '0.0000', '1063.94', NULL, 0, '2026-02-19 19:00:32', '2026-05-26 19:00:32'),
(36, 37, 32, 'Yoga Wellness 2026 Set 1 Ad 2', 'paused', 39, NULL, NULL, NULL, 'profile', NULL, 2809, 81, 0, 1, '0.0000', '0.0000', '165.27', NULL, 0, '2026-02-19 19:00:32', '2026-05-26 19:00:32'),
(37, 38, 32, 'Yoga Wellness 2026 Set 2 Ad 1', 'archived', 40, NULL, NULL, NULL, 'profile', NULL, 10310, 505, 0, 48, '0.0000', '0.0000', '450.43', NULL, 0, '2026-02-19 19:00:32', '2026-05-26 19:00:32'),
(38, 39, 33, 'Summer Coaching 2025 Set 1 Ad 1', 'active', 41, NULL, NULL, NULL, 'profile', NULL, 19183, 496, 0, 66, '0.0000', '0.0000', '420.32', NULL, 0, '2026-03-09 19:01:00', '2026-04-26 19:01:00'),
(39, 40, 33, 'Summer Coaching 2025 Set 2 Ad 1', 'paused', 42, NULL, NULL, NULL, 'profile', NULL, 19882, 546, 0, 30, '0.0000', '0.0000', '306.41', NULL, 0, '2026-03-09 19:01:00', '2026-04-26 19:01:00'),
(40, 41, 34, 'Challenge Body 2026 Set 1 Ad 1', 'paused', 43, NULL, NULL, NULL, 'profile', NULL, 3685, 40, 0, 2, '0.0000', '0.0000', '332.87', NULL, 0, '2026-01-31 19:01:16', '2026-05-08 19:01:16'),
(41, 41, 34, 'Challenge Body 2026 Set 1 Ad 2', 'active', 44, NULL, NULL, NULL, 'profile', NULL, 3584, 136, 0, 23, '0.0000', '0.0000', '307.16', NULL, 0, '2026-01-31 19:01:16', '2026-05-08 19:01:16'),
(42, 42, 35, 'Transformation Strength 2024 Set 1 Ad 1', 'paused', 45, NULL, NULL, NULL, 'profile', NULL, 5178, 153, 0, 9, '0.0000', '0.0000', '408.69', NULL, 0, '2026-02-27 19:01:34', '2026-04-28 19:01:34'),
(43, 43, 36, 'Ramadan Coaching 2025 Set 1 Ad 1', 'paused', 46, NULL, NULL, NULL, 'profile', NULL, 14250, 340, 0, 49, '0.0000', '0.0000', '464.97', NULL, 0, '2026-02-03 19:01:58', '2026-05-14 19:01:58'),
(44, 44, 36, 'Ramadan Coaching 2025 Set 2 Ad 1', 'archived', 47, NULL, NULL, NULL, 'profile', NULL, 3426, 88, 0, 4, '0.0000', '0.0000', '623.14', NULL, 0, '2026-02-03 19:01:58', '2026-05-14 19:01:58'),
(45, 44, 36, 'Ramadan Coaching 2025 Set 2 Ad 2', 'paused', 48, NULL, NULL, NULL, 'profile', NULL, 17955, 475, 0, 18, '0.0000', '0.0000', '229.21', NULL, 0, '2026-02-03 19:01:58', '2026-05-14 19:01:58'),
(46, 45, 37, 'Ramadan Strength 2025 Set 1 Ad 1', 'active', 49, NULL, NULL, NULL, 'profile', NULL, 1119, 28, 0, 4, '0.0000', '0.0000', '193.23', NULL, 0, '2026-02-05 20:43:17', '2026-04-09 20:43:17'),
(47, 45, 37, 'Ramadan Strength 2025 Set 1 Ad 2', 'archived', 50, NULL, NULL, NULL, 'profile', NULL, 1647, 72, 0, 3, '0.0000', '0.0000', '157.88', NULL, 0, '2026-02-05 20:43:17', '2026-04-09 20:43:17'),
(48, 46, 37, 'Ramadan Strength 2025 Set 2 Ad 1', 'paused', 51, NULL, NULL, NULL, 'profile', NULL, 13823, 193, 0, 16, '0.0000', '0.0000', '168.27', NULL, 0, '2026-02-05 20:43:17', '2026-04-09 20:43:17'),
(49, 46, 37, 'Ramadan Strength 2025 Set 2 Ad 2', 'archived', 52, NULL, NULL, NULL, 'profile', NULL, 6230, 257, 0, 0, '0.0000', '0.0000', '92.27', NULL, 0, '2026-02-05 20:43:17', '2026-04-09 20:43:17'),
(50, 47, 38, 'Challenge Strength 2024 Set 1 Ad 1', 'paused', 53, NULL, NULL, NULL, 'profile', NULL, 5884, 242, 0, 11, '0.0000', '0.0000', '351.89', NULL, 0, '2026-03-18 20:43:48', '2026-05-23 20:43:48'),
(51, 47, 38, 'Challenge Strength 2024 Set 1 Ad 2', 'paused', 54, NULL, NULL, NULL, 'profile', NULL, 15294, 650, 0, 74, '0.0000', '0.0000', '274.24', NULL, 0, '2026-03-18 20:43:48', '2026-05-23 20:43:48'),
(52, 48, 38, 'Challenge Strength 2024 Set 2 Ad 1', 'paused', 55, NULL, NULL, NULL, 'profile', NULL, 13289, 137, 0, 20, '0.0000', '0.0000', '198.92', NULL, 0, '2026-03-18 20:43:48', '2026-05-23 20:43:48'),
(53, 48, 38, 'Challenge Strength 2024 Set 2 Ad 2', 'archived', 56, NULL, NULL, NULL, 'profile', NULL, 1459, 48, 0, 8, '0.0000', '0.0000', '1251.70', NULL, 0, '2026-03-18 20:43:48', '2026-05-23 20:43:48'),
(54, 49, 39, 'Power Wellness 2026 Set 1 Ad 1', 'paused', 57, NULL, NULL, NULL, 'profile', NULL, 4445, 208, 0, 27, '0.0000', '0.0000', '1617.85', NULL, 0, '2026-02-12 20:43:59', '2026-04-19 20:43:59'),
(55, 50, 40, 'Summer Fat Loss 2026 Set 1 Ad 1', 'active', 58, NULL, NULL, NULL, 'profile', NULL, 2035, 26, 0, 5, '0.0000', '0.0000', '838.19', NULL, 0, '2026-03-07 20:44:04', '2026-05-21 20:44:04'),
(56, 50, 40, 'Summer Fat Loss 2026 Set 1 Ad 2', 'active', 59, NULL, NULL, NULL, 'profile', NULL, 11431, 569, 0, 91, '0.0000', '0.0000', '583.70', NULL, 0, '2026-03-07 20:44:04', '2026-05-21 20:44:04'),
(57, 51, 40, 'Summer Fat Loss 2026 Set 2 Ad 1', 'paused', 60, NULL, NULL, NULL, 'profile', NULL, 12000, 334, 0, 5, '0.0000', '0.0000', '878.07', NULL, 0, '2026-03-07 20:44:04', '2026-05-21 20:44:04'),
(58, 51, 40, 'Summer Fat Loss 2026 Set 2 Ad 2', 'archived', 61, NULL, NULL, NULL, 'profile', NULL, 1305, 32, 0, 1, '0.0000', '0.0000', '228.81', NULL, 0, '2026-03-07 20:44:04', '2026-05-21 20:44:04'),
(59, 52, 41, 'Ramadan Coaching 2026 Set 1 Ad 1', 'archived', 62, NULL, NULL, NULL, 'profile', NULL, 8905, 373, 0, 9, '0.0000', '0.0000', '1137.90', NULL, 0, '2026-02-02 20:44:20', '2026-04-26 20:44:20'),
(60, 53, 41, 'Ramadan Coaching 2026 Set 2 Ad 1', 'paused', 63, NULL, NULL, NULL, 'profile', NULL, 11639, 119, 0, 21, '0.0000', '0.0000', '1026.18', NULL, 0, '2026-02-02 20:44:20', '2026-04-26 20:44:20'),
(61, 54, 42, 'Ramadan Body 2024 Set 1 Ad 1', 'archived', 64, NULL, NULL, NULL, 'profile', NULL, 5699, 63, 0, 7, '0.0000', '0.0000', '274.52', NULL, 0, '2026-02-07 20:44:32', '2026-05-03 20:44:32'),
(62, 55, 42, 'Ramadan Body 2024 Set 2 Ad 1', 'paused', 65, NULL, NULL, NULL, 'profile', NULL, 3190, 121, 0, 14, '0.0000', '0.0000', '632.32', NULL, 0, '2026-02-07 20:44:32', '2026-05-03 20:44:32'),
(63, 56, 43, 'Power Body 2025 Set 1 Ad 1', 'paused', 66, NULL, NULL, NULL, 'profile', NULL, 18504, 903, 0, 132, '0.0000', '0.0000', '189.63', NULL, 0, '2026-02-01 20:44:38', '2026-05-16 20:44:38'),
(64, 56, 43, 'Power Body 2025 Set 1 Ad 2', 'active', 67, NULL, NULL, NULL, 'profile', NULL, 5867, 61, 0, 11, '0.0000', '0.0000', '107.29', NULL, 0, '2026-02-01 20:44:38', '2026-05-16 20:44:38'),
(65, 57, 44, 'Transformation Strength 2026 Set 1 Ad 1', 'active', 68, NULL, NULL, NULL, 'profile', NULL, 6498, 253, 0, 38, '0.0000', '0.0000', '525.12', NULL, 0, '2026-03-17 20:44:48', '2026-05-27 20:44:48'),
(66, 58, 44, 'Transformation Strength 2026 Set 2 Ad 1', 'archived', 69, NULL, NULL, NULL, 'profile', NULL, 10752, 412, 0, 74, '0.0000', '0.0000', '458.79', NULL, 0, '2026-03-17 20:44:48', '2026-05-27 20:44:48'),
(67, 59, 45, 'Challenge Strength 2025 Set 1 Ad 1', 'archived', 70, NULL, NULL, NULL, 'profile', NULL, 11611, 494, 0, 18, '0.0000', '0.0000', '737.93', NULL, 0, '2026-03-05 20:44:53', '2026-05-04 20:44:53'),
(68, 60, 45, 'Challenge Strength 2025 Set 2 Ad 1', 'paused', 71, NULL, NULL, NULL, 'profile', NULL, 12048, 438, 0, 64, '0.0000', '0.0000', '988.42', NULL, 0, '2026-03-05 20:44:53', '2026-05-04 20:44:53'),
(69, 47, 38, 'الحق عرض الشهرين بثمن شهر', 'active', 50, 'الحق عرض الشهرين بثمن شهر', 'الحق عرض الشهرين بثمن شهرالحق عرض الشهرين بثمن شهرالحق عرض الشهرين بثمن شهر', 'احجز شهرين دلوقتي! مستني ايه', 'profile', NULL, 0, 0, 0, 0, '0.0000', '0.0000', '0.00', NULL, 0, '2026-03-30 12:28:17', '2026-03-30 12:28:17');

-- --------------------------------------------------------
-- Table: `app_images`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `app_images`;
CREATE TABLE `app_images` (
  `slug` varchar(64) NOT NULL,
  `url` text NOT NULL,
  `alt` varchar(255) DEFAULT NULL,
  `category` varchar(32) DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`slug`)
);

INSERT INTO `app_images` (`slug`, `url`, `alt`, `category`, `updated_by`, `updated_at`, `created_at`) VALUES
('feature_community_phone', 'https://pub-a510609442944675ba8ca128930bf7ad.r2.dev/app-images/image-1776859329044-736560338.png', NULL, 'features', 936, '2026-04-22 10:02:09', '2026-04-22 10:02:09'),
('feature_plans_phone', 'https://pub-a510609442944675ba8ca128930bf7ad.r2.dev/app-images/image-1776859322858-628208574.png', NULL, 'features', 936, '2026-04-22 10:02:03', '2026-04-22 10:02:03'),
('feature_progress_phone', 'https://pub-a510609442944675ba8ca128930bf7ad.r2.dev/app-images/image-1776859354635-582154576.png', NULL, 'features', 936, '2026-04-22 10:02:35', '2026-04-22 10:02:35'),
('feature_workouts_phone', 'https://pub-a510609442944675ba8ca128930bf7ad.r2.dev/app-images/image-1776861423281-394777810.png', NULL, 'features', 936, '2026-04-22 10:37:03', '2026-04-22 10:01:54'),
('onboarding_step_1', 'https://pub-a510609442944675ba8ca128930bf7ad.r2.dev/app-images/image-1776891778601-176007493.jpg', NULL, 'onboarding', 936, '2026-04-22 19:03:01', '2026-04-22 19:03:01');

-- --------------------------------------------------------
-- Table: `app_settings`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `app_settings`;
CREATE TABLE `app_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text,
  `setting_type` varchar(20) DEFAULT 'text',
  `category` varchar(50) DEFAULT 'general',
  `label` varchar(100) DEFAULT NULL,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
);

INSERT INTO `app_settings` (`id`, `setting_key`, `setting_value`, `setting_type`, `category`, `label`, `updated_at`) VALUES
(1, 'app_name', 'Fit Way Hub', 'text', 'branding', 'App Name', '2026-04-06 15:27:04'),
(2, 'app_tagline', 'Your fitness journey starts here', 'text', 'branding', 'Tagline', '2026-03-15 02:04:06'),
(3, 'logo_url_en_light', 'https://pub-a510609442944675ba8ca128930bf7ad.r2.dev/dashboard/image-1775823603043-269806940.svg', 'image', 'branding', 'English Logo (Light Mode)', '2026-04-10 10:21:34'),
(4, 'logo_url_en_dark', 'https://pub-a510609442944675ba8ca128930bf7ad.r2.dev/dashboard/image-1775823611345-272019609.svg', 'image', 'branding', 'English Logo (Dark Mode)', '2026-04-10 10:21:38'),
(5, 'logo_url_ar_light', 'https://pub-a510609442944675ba8ca128930bf7ad.r2.dev/dashboard/image-1775823631026-499856174.svg', 'image', 'branding', 'Arabic Logo (Light Mode)', '2026-04-10 10:21:42'),
(6, 'logo_url_ar_dark', 'https://pub-a510609442944675ba8ca128930bf7ad.r2.dev/dashboard/image-1775823655726-495521935.svg', 'image', 'branding', 'Arabic Logo (Dark Mode)', '2026-04-10 10:21:46'),
(7, 'favicon_url', 'https://pub-a510609442944675ba8ca128930bf7ad.r2.dev/dashboard/image-1775823660505-506239951.svg', 'image', 'branding', 'Favicon', '2026-04-10 10:21:49'),
(8, 'footer_text', 'Egypt\'s #1 digital fitness ecosystem.', 'text', 'branding', 'Footer Description', '2026-03-15 02:04:08'),
(9, 'copyright_text', '© 2025 FitWay Hub. All rights reserved.', 'text', 'branding', 'Copyright Text', '2026-03-15 02:04:08'),
(10, 'social_instagram', '', 'text', 'branding', 'Instagram URL', '2026-03-15 02:04:09'),
(11, 'social_facebook', '', 'text', 'branding', 'Facebook URL', '2026-03-15 02:04:09'),
(12, 'social_twitter', '', 'text', 'branding', 'Twitter / X URL', '2026-03-15 02:04:09'),
(13, 'social_youtube', '', 'text', 'branding', 'YouTube URL', '2026-03-15 02:04:09'),
(14, 'primary_color', '#ead917', 'color', 'branding', 'Primary Color (Accent)', '2026-04-10 10:26:34'),
(15, 'secondary_color', '#262626', 'color', 'branding', 'Secondary Color (Blue)', '2026-04-10 10:26:56'),
(16, 'bg_primary', '#0A0A0B', 'color', 'branding', 'Background Primary', '2026-03-15 02:04:10'),
(17, 'bg_card', '#111113', 'color', 'branding', 'Card Background', '2026-03-15 02:04:10'),
(18, 'font_en', 'Outfit', 'font', 'branding', 'English Font', '2026-03-15 02:04:11'),
(19, 'font_ar', 'Cairo', 'font', 'branding', 'Arabic Font', '2026-03-15 02:04:11'),
(20, 'font_heading', 'Gotham', 'font', 'branding', 'Heading Font', '2026-04-10 10:33:00'),
(21, 'free_user_max_videos', '4', 'number', 'access', 'Free Videos Limit', '2026-03-15 02:30:50'),
(22, 'free_user_can_access_coaching', '1', 'boolean', 'access', 'Free Users Can Browse Coaches', '2026-03-15 02:04:12'),
(23, 'max_video_upload_size_mb', '40', 'number', 'access', 'Max Video Upload Size (MB)', '2026-03-15 02:04:12'),
(24, 'coach_membership_fee_usd', '29.99', 'number', 'pricing', 'Coach Monthly Fee (USD)', '2026-03-15 02:04:12'),
(25, 'user_premium_fee_usd', '9.99', 'number', 'pricing', 'User Premium Monthly (USD)', '2026-03-15 02:04:12'),
(26, 'registration_points_gift', '200', 'number', 'points', 'Registration Bonus Points', '2026-03-15 02:04:13'),
(27, 'video_watch_points', '2', 'number', 'points', 'Points per Video Watch', '2026-03-15 02:04:13'),
(28, 'goal_complete_points', '2', 'number', 'points', 'Points per Goal Completed', '2026-03-15 02:04:13'),
(1238, 'ad_rate_per_min', '0.1', 'number', 'pricing', 'Ad Rate per Minute (EGP)', '2026-04-06 21:35:38'),
(1239, 'ad_package_basic_price', '100', 'number', 'pricing', 'Basic Ad Package Price (EGP)', '2026-03-16 22:54:58'),
(1240, 'ad_package_basic_duration', '2', 'number', 'pricing', 'Basic Ad Package Duration (Days)', '2026-03-16 22:57:08'),
(1241, 'ad_package_premium_price', '500', 'number', 'pricing', 'Premium Ad Package Price (EGP)', '2026-03-16 22:54:58'),
(1242, 'ad_package_premium_duration', '7', 'number', 'pricing', 'Premium Ad Package Duration (Days)', '2026-03-16 22:54:59'),
(1243, 'ad_default_cpm_bid', '2', 'number', 'pricing', 'Default CPM Bid (EGP)', '2026-03-16 22:58:21'),
(1244, 'ad_default_custom_budget', '500', 'number', 'pricing', 'Default Custom Budget (EGP)', '2026-03-16 22:54:59'),
(1245, 'ad_default_daily_budget', '20', 'number', 'pricing', 'Default Daily Budget (EGP)', '2026-03-16 22:55:00'),
(1246, 'ad_default_cpc_bid', '1', 'number', 'pricing', 'Default CPC Bid (EGP)', '2026-03-16 22:57:10'),
(1247, 'btn_hover_type', 'pulse', 'text', 'branding', 'Button Hover Effect Type', '2026-04-05 18:15:11'),
(1248, 'btn_hover_color', '#ead917', 'color', 'branding', 'Button Hover Glow Color', '2026-04-10 10:26:05'),
(1695, 'my_setting', '', 'text', 'branding', 'my_setting', '2026-03-23 04:44:06'),
(3778, 'certified_coach_fee', '500', 'number', 'pricing', 'Certified Coach Monthly Fee (EGP)', '2026-03-30 22:42:29'),
(3812, 'feature_user_workouts', '1', 'boolean', 'features', 'User: Workouts', '2026-03-31 00:02:27'),
(3813, 'feature_user_workout_plan', '1', 'boolean', 'features', 'User: Workout Plan', '2026-03-31 00:02:27'),
(3814, 'feature_user_nutrition_plan', '1', 'boolean', 'features', 'User: Nutrition Plan', '2026-03-31 00:02:27'),
(3815, 'feature_user_steps', '1', 'boolean', 'features', 'User: Steps', '2026-03-31 00:02:28'),
(3816, 'feature_user_community', '1', 'boolean', 'features', 'User: Community', '2026-03-31 00:02:28'),
(3817, 'feature_user_chat', '1', 'boolean', 'features', 'User: Chat', '2026-03-31 00:02:28'),
(3818, 'feature_user_coaching', '1', 'boolean', 'features', 'User: Coaching', '2026-03-31 00:02:28'),
(3819, 'feature_user_tools', '1', 'boolean', 'features', 'User: Tools', '2026-03-31 00:02:29'),
(3820, 'feature_user_analytics', '1', 'boolean', 'features', 'User: Analytics', '2026-03-31 00:02:29'),
(3821, 'feature_user_plans', '1', 'boolean', 'features', 'User: Plans', '2026-03-31 00:02:29'),
(3822, 'feature_user_blogs', '1', 'boolean', 'features', 'User: Blogs', '2026-03-31 00:02:30'),
(3823, 'feature_user_notifications', '1', 'boolean', 'features', 'User: Notifications', '2026-03-31 00:02:30'),
(3824, 'feature_coach_requests', '1', 'boolean', 'features', 'Coach: Requests', '2026-03-31 00:02:30'),
(3825, 'feature_coach_athletes', '1', 'boolean', 'features', 'Coach: Athletes', '2026-03-31 00:02:30'),
(3826, 'feature_coach_chat', '1', 'boolean', 'features', 'Coach: Chat', '2026-03-31 00:02:31'),
(3827, 'feature_coach_ads', '1', 'boolean', 'features', 'Coach: Ads', '2026-03-31 00:02:31'),
(3828, 'feature_coach_blogs', '1', 'boolean', 'features', 'Coach: Blogs', '2026-03-31 00:02:31'),
(3829, 'feature_coach_community', '1', 'boolean', 'features', 'Coach: Community', '2026-03-31 00:02:32'),
(3830, 'feature_coach_workouts', '1', 'boolean', 'features', 'Coach: Workouts', '2026-03-31 00:02:32'),
(3831, 'feature_coach_notifications', '1', 'boolean', 'features', 'Coach: Notifications', '2026-03-31 00:02:32'),
(4362, 'dash_greeting_visible', '1', 'boolean', 'dashboard', 'Show Greeting', '2026-04-04 21:56:21'),
(4363, 'dash_hero_visible', '1', 'boolean', 'dashboard', 'Show Hero Banner', '2026-04-04 21:56:21'),
(4364, 'dash_hero_image', 'https://pub-a510609442944675ba8ca128930bf7ad.r2.dev/dashboard/image-1775832979958-769799350.jpg', 'url', 'dashboard', 'Hero Banner Image', '2026-04-10 12:57:13'),
(4365, 'dash_hero_title', 'Ready to crush your goals?', 'text', 'dashboard', 'Hero Banner Title', '2026-04-04 21:56:22'),
(4366, 'dash_hero_subtitle', 'Track your progress and stay motivated', 'text', 'dashboard', 'Hero Banner Subtitle', '2026-04-04 21:56:22'),
(4367, 'dash_hero_cta_text', 'Start Tracking', 'text', 'dashboard', 'Hero CTA Button Text', '2026-04-10 12:57:14'),
(4368, 'dash_hero_cta_link', '/app/workouts', 'text', 'dashboard', 'Hero CTA Button Link', '2026-04-04 21:56:22'),
(4369, 'dash_stats_visible', '1', 'boolean', 'dashboard', 'Show Stats Row', '2026-04-04 21:56:23'),
(4370, 'dash_quick_actions_visible', '1', 'boolean', 'dashboard', 'Show Quick Actions', '2026-04-04 21:56:23'),
(4371, 'dash_featured_visible', '1', 'boolean', 'dashboard', 'Show Featured Card', '2026-04-04 21:56:23'),
(4372, 'dash_featured_image', 'https://pub-a510609442944675ba8ca128930bf7ad.r2.dev/dashboard/image-1775832994147-636771577.jpg', 'url', 'dashboard', 'Featured Card Image', '2026-04-10 12:57:16'),
(4373, 'dash_featured_title', 'Featured Workout', 'text', 'dashboard', 'Featured Card Title', '2026-04-04 21:56:24'),
(4374, 'dash_featured_subtitle', 'Try today\'s recommended routine', 'text', 'dashboard', 'Featured Card Subtitle', '2026-04-04 21:56:24'),
(4375, 'dash_featured_link', '/app/workouts', 'text', 'dashboard', 'Featured Card Link', '2026-04-04 21:56:24'),
(4376, 'dash_videos_visible', '1', 'boolean', 'dashboard', 'Show Videos Section', '2026-04-04 21:56:25'),
(4377, 'dash_videos_title', 'Workouts', 'text', 'dashboard', 'Videos Section Title', '2026-04-04 21:56:25'),
(4378, 'dash_coaches_visible', '1', 'boolean', 'dashboard', 'Show Coaches Section', '2026-04-04 21:56:25'),
(4379, 'dash_coaches_title', 'Top Coaches', 'text', 'dashboard', 'Coaches Section Title', '2026-04-04 21:56:26'),
(4380, 'dash_blogs_visible', '1', 'boolean', 'dashboard', 'Show Blogs Section', '2026-04-04 21:56:26'),
(4381, 'dash_blogs_title', 'Latest Articles', 'text', 'dashboard', 'Blogs Section Title', '2026-04-04 21:56:26'),
(4382, 'dash_ads_visible', '1', 'boolean', 'dashboard', 'Show Sponsored Ads', '2026-04-04 21:56:26'),
(4445, 'dash_analytics_visible', '1', 'boolean', 'dashboard', 'Show Analytics Snapshot', '2026-04-05 18:33:52'),
(4446, 'dash_analytics_title', 'Analytics Snapshot', 'text', 'dashboard', 'Analytics Section Title', '2026-04-05 18:33:52'),
(7539, 'coach_membership_fee_egp', '500', 'number', 'pricing', 'Coach Monthly Fee (EGP)', '2026-04-06 21:57:21');

-- --------------------------------------------------------
-- Table: `blog_posts`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `blog_posts`;
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
  `status` varchar(20) NOT NULL DEFAULT 'published',
  `author_id` int NOT NULL,
  `author_role` varchar(50) NOT NULL,
  `published_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `views` int DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_slug_lang` (`slug`,`language`),
  KEY `idx_blog_posts_status` (`status`),
  KEY `idx_blog_posts_author_id` (`author_id`),
  KEY `idx_blog_posts_published_at` (`published_at`),
  KEY `idx_blog_posts_language` (`language`),
  KEY `idx_blog_posts_related` (`related_blog_id`),
  CONSTRAINT `blog_posts_ibfk_1` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_blog_posts_related` FOREIGN KEY (`related_blog_id`) REFERENCES `blog_posts` (`id`) ON DELETE SET NULL
);

INSERT INTO `blog_posts` (`id`, `title`, `slug`, `language`, `related_blog_id`, `excerpt`, `content`, `header_image_url`, `video_url`, `video_duration`, `status`, `author_id`, `author_role`, `published_at`, `created_at`, `updated_at`, `views`) VALUES
(673, '10 Science-Backed Ways to Burn Fat Faster', '10-ways-burn-fat-faster', 'en', NULL, 'Discover the most effective, research-proven strategies to accelerate fat loss without sacrificing muscle.', '## The Science of Fat Loss\n\n### 1. Prioritize Protein\nEat 1.6–2.2g of protein per kg of bodyweight. Burns up to 30% of its calories during digestion.\n\n### 2. Strength Train 3–4x Per Week\nBuilds muscle, raising your resting metabolic rate.\n\n### 3. Sleep 7–9 Hours\nPoor sleep raises cortisol and hunger hormones by up to 24%.\n\n### 4. Time-Restricted Eating\nEating in an 8–10 hour window improves insulin sensitivity.\n\n### 5. Walk 8,000–10,000 Steps Daily\nNon-exercise activity accounts for 15–30% of energy expenditure.\n\n### 6. Avoid Liquid Calories\nSodas and juices add hundreds of calories without satiety.\n\n### 7. Manage Stress\nChronic stress promotes fat storage around the abdomen.\n\n### 8. Stay Hydrated\nDrinking 500ml before meals reduces caloric intake by 13%.\n\n### 9. Track Your Food\nTrackers lose 2–3x more weight than those who don\'t.\n\n### 10. Be Consistent Over Perfect\nConsistency beats perfection every single time.', NULL, NULL, NULL, 'published', 936, 'coach', '2026-04-06 12:04:03', '2026-04-06 12:04:04', '2026-04-06 12:04:04', 0),
(674, '١٠ طرق علمية لحرق الدهون بشكل أسرع', '10-ways-burn-fat-faster-ar', 'ar', 673, 'اكتشف أكثر الاستراتيجيات فعالية والمدعومة بالأبحاث لتسريع فقدان الدهون دون التضحية بالعضلات.', '## علم فقدان الدهون\n\n### ١. أعطِ الأولوية للبروتين\nتناول 1.6–2.2 غ لكل كغ من وزنك. تحرق الأطعمة الغنية بالبروتين حتى 30% من سعراتها أثناء الهضم.\n\n### ٢. تمارين القوة 3–4 مرات أسبوعياً\nتبني العضلات وترفع معدل الحرق أثناء الراحة.\n\n### ٣. نم 7–9 ساعات\nقلة النوم ترفع الكورتيزول وهرمونات الجوع بنسبة تصل إلى 24%.\n\n### ٤. الأكل في نافذة زمنية محددة\nالأكل في 8–10 ساعات يحسّن حساسية الإنسولين.\n\n### ٥. امشِ 8,000–10,000 خطوة يومياً\nالنشاط اليومي يشكل 15–30% من إجمالي إنفاق الطاقة.\n\n### ٦. تجنب السعرات السائلة\nالمشروبات الغازية تضيف مئات السعرات دون إشباع.\n\n### ٧. أدِر التوتر\nالتوتر المزمن يعزز تخزين الدهون حول البطن.\n\n### ٨. اشرب الماء الكافي\nشرب 500 مل قبل الوجبات يقلل السعرات 13%.\n\n### ٩. تتبع طعامك\nمن يتتبعون طعامهم يخسرون 2–3 أضعاف ممن لا يفعلون.\n\n### ١٠. الاستمرارية فوق الكمال\nالاستمرارية تتفوق دائماً على الكمال.', NULL, NULL, NULL, 'published', 936, 'coach', '2026-04-06 12:04:03', '2026-04-06 12:04:05', '2026-04-06 12:04:05', 0),
(675, 'The Complete Beginner\'s Guide to Building Muscle', 'beginners-guide-building-muscle', 'en', NULL, 'Everything you need to know to start gaining lean muscle mass.', '## Building Muscle: The Fundamentals\n\nThree pillars: **Progressive Overload**, **Sufficient Protein**, **Recovery**.\n\n### Training Split\n- Monday: Push (Chest, Shoulders, Triceps)\n- Wednesday: Pull (Back, Biceps)\n- Friday: Legs\n\n### Key Exercises\nSquat, Deadlift, Bench Press, Pull-Up, Overhead Press.\n\n### Nutrition\nEat at a 200–300 calorie surplus. 1.8–2.2g protein/kg bodyweight.\n\n### Recovery\nMuscles grow outside the gym. Sleep 7–9 hours.', NULL, NULL, NULL, 'published', 936, 'coach', '2026-04-06 12:04:03', '2026-04-06 12:04:05', '2026-04-06 12:04:05', 0),
(676, 'الدليل الشامل للمبتدئين لبناء العضلات', 'beginners-guide-building-muscle-ar', 'ar', 675, 'كل ما تحتاج معرفته لبدء اكتساب الكتلة العضلية.', '## بناء العضلات: الأساسيات\n\nثلاثة أعمدة: **التحميل التدريجي**، **البروتين الكافي**، **التعافي**.\n\n### برنامج التدريب\n- الاثنين: الدفع (الصدر، الأكتاف، ثلاثية الرؤوس)\n- الأربعاء: السحب (الظهر، ثنائية الرؤوس)\n- الجمعة: الأرجل\n\n### التمارين الأساسية\nالقرفصاء، الرفعة الميتة، ضغط المقعد، العقلة، الضغط فوق الرأس.\n\n### التغذية\nتناول فائضاً 200–300 سعرة. 1.8–2.2 غ بروتين/كغ.\n\n### التعافي\nتنمو العضلات خارج الصالة. نم 7–9 ساعات.', NULL, NULL, NULL, 'published', 936, 'coach', '2026-04-06 12:04:03', '2026-04-06 12:04:06', '2026-04-06 12:04:06', 0),
(677, 'How to Run Your First 5K in 8 Weeks', 'run-first-5k-8-weeks', 'en', NULL, 'A complete couch-to-5K plan for absolute beginners.', '## Couch to 5K: 8-Week Plan\n\n**Week 1–2:** 1 min run, 2 min walk × 8 rounds, 3x/week.\n**Week 3–4:** 2 min run, 1 min walk × 8 rounds.\n**Week 5–6:** 20-minute continuous jog.\n**Week 7–8:** 25–30 minute continuous run.\n\n### Race Day Tips\n- Eat light 2 hours before\n- Start slower than you think\n- Celebrate finishing — time doesn\'t matter', NULL, NULL, NULL, 'published', 936, 'coach', '2026-04-06 12:04:03', '2026-04-06 12:04:06', '2026-04-06 12:04:06', 0),
(678, 'كيف تجري أول 5 كيلومتر في 8 أسابيع', 'run-first-5k-8-weeks-ar', 'ar', 677, 'برنامج كامل من الأريكة إلى 5 كم للمبتدئين.', '## من الأريكة إلى 5 كم: 8 أسابيع\n\n**الأسبوع ١–٢:** 1 دقيقة جري، 2 دقيقة مشي × 8، 3 مرات أسبوعياً.\n**الأسبوع ٣–٤:** 2 دقيقة جري، 1 دقيقة مشي × 8.\n**الأسبوع ٥–٦:** 20 دقيقة جري متواصل.\n**الأسبوع ٧–٨:** 25–30 دقيقة جري متواصل.\n\n### نصائح يوم السباق\n- وجبة خفيفة قبل ساعتين\n- ابدأ بوتيرة أبطأ\n- احتفل بالإتمام — الوقت لا يهم', NULL, NULL, NULL, 'published', 936, 'coach', '2026-04-06 12:04:03', '2026-04-06 12:04:07', '2026-04-06 12:04:07', 0),
(679, 'The Truth About Intermittent Fasting', 'truth-about-intermittent-fasting', 'en', NULL, 'Does intermittent fasting actually work? We break down the science.', '## Intermittent Fasting: The Science\n\nIF is a calorie restriction tool. Studies show no significant difference vs continuous restriction when calories match.\n\n### Popular Protocols\n- 16:8 — Fast 16h, eat in 8h window\n- 5:2 — Normal 5 days, 500 cal on 2 days\n\n### Who Benefits\n- People not hungry in the morning\n- Those who overeat in the evening\n\n### Bottom Line\nIF works when it helps maintain a caloric deficit. It\'s a scheduling tool, not magic.', NULL, NULL, NULL, 'published', 936, 'coach', '2026-04-06 12:04:03', '2026-04-06 12:04:07', '2026-04-06 12:04:07', 0),
(680, 'الحقيقة حول الصيام المتقطع', 'truth-about-intermittent-fasting-ar', 'ar', 679, 'هل يعمل الصيام المتقطع فعلاً؟ نستعرض الأدلة العلمية.', '## الصيام المتقطع: العلم\n\nالصيام المتقطع أداة لتقليل السعرات. الدراسات لا تُظهر فرقاً يُذكر مقارنة بالتقليل المستمر عند تساوي السعرات.\n\n### البروتوكولات الشائعة\n- 16:8 — صيام 16 ساعة، أكل في نافذة 8 ساعات\n- 5:2 — طبيعي 5 أيام، 500 سعرة يومين\n\n### من يستفيد\n- من لا يشعر بالجوع صباحاً\n- من يفرط في الأكل مساءً\n\n### الخلاصة\nيعمل عندما يساعد على الحفاظ على عجز في السعرات. إنه أداة جدولة وليس سحراً.', NULL, NULL, NULL, 'published', 936, 'coach', '2026-04-06 12:04:03', '2026-04-06 12:04:08', '2026-04-06 12:04:08', 0),
(681, '5 Yoga Poses for Desk Workers', 'yoga-poses-desk-workers', 'en', NULL, 'Five poses that undo the damage of sitting all day.', '## Essential Yoga for Desk Workers\n\n1. **Cat-Cow** — spine mobility, 10 reps\n2. **Hip Flexor Lunge** — hold 30–60 sec each side\n3. **Doorframe Chest Opener** — hold 30 seconds\n4. **Seated Spinal Twist** — 30 seconds each side\n5. **Legs Up the Wall** — 5–10 minutes', NULL, NULL, NULL, 'published', 936, 'coach', '2026-04-06 12:04:03', '2026-04-06 12:04:08', '2026-04-06 12:04:08', 0),
(682, '٥ وضعيات يوغا لعمال المكاتب', 'yoga-poses-desk-workers-ar', 'ar', 681, 'خمس وضعيات لإلغاء تأثيرات الجلوس طوال اليوم.', '## اليوغا الأساسية لعمال المكاتب\n\n١. **القطة-البقرة** — مرونة العمود الفقري، 10 تكرارات\n٢. **تمدد الورك المائل** — 30–60 ثانية لكل جانب\n٣. **فتح الصدر على الباب** — 30 ثانية\n٤. **الالتواء الفقري الجالس** — 30 ثانية لكل جانب\n٥. **الأرجل على الحائط** — 5–10 دقائق', NULL, NULL, NULL, 'published', 936, 'coach', '2026-04-06 12:04:03', '2026-04-06 12:04:09', '2026-04-06 12:04:09', 0),
(683, 'Creatine: The Most Researched Supplement', 'creatine-complete-guide', 'en', NULL, 'Creatine is safe, effective, and backed by decades of research.', '## Creatine: Evidence-Based Guide\n\n### Benefits\n- 5–15% increase in strength\n- More lean muscle mass\n- Faster set recovery\n\n### Dosing\n- Loading (optional): 20g/day × 7 days\n- Maintenance: 3–5g daily\n\n### Safety\nDecades of research confirm safety for healthy individuals.\n\n### Which Form?\nCreatine monohydrate. No need for expensive variants.', NULL, NULL, NULL, 'published', 936, 'coach', '2026-04-06 12:04:03', '2026-04-06 12:04:09', '2026-04-06 12:04:09', 0),
(684, 'الكرياتين: المكمل الأكثر دراسة', 'creatine-complete-guide-ar', 'ar', 683, 'الكرياتين آمن وفعّال ومدعوم بعقود من الأبحاث.', '## الكرياتين: دليل علمي\n\n### الفوائد\n- زيادة 5–15% في القوة\n- كتلة عضلية أكبر\n- تعافٍ أسرع بين المجموعات\n\n### الجرعة\n- التحميل (اختياري): 20 غ/يوم × 7 أيام\n- الصيانة: 3–5 غ يومياً\n\n### السلامة\nعقود من الأبحاث تؤكد السلامة للأصحاء.\n\n### أي شكل؟\nكرياتين أحادي الهيدرات. لا حاجة للأشكال المكلفة.', NULL, NULL, NULL, 'published', 936, 'coach', '2026-04-06 12:04:03', '2026-04-06 12:04:10', '2026-04-06 12:04:10', 0),
(685, 'How to Build a Home Gym on a Budget', 'home-gym-on-a-budget', 'en', NULL, 'Build an effective home gym with minimal investment.', '## Home Gym on a Budget\n\n1. **Resistance Bands** — most versatile\n2. **Pull-Up Bar** — back and upper body\n3. **Jump Rope** — cardio in small spaces\n4. **Yoga Mat** — floor exercises\n5. **Bodyweight exercises** — zero equipment needed\n\nYouTube has thousands of free guided workouts.', NULL, NULL, NULL, 'published', 936, 'coach', '2026-04-06 12:04:03', '2026-04-06 12:04:10', '2026-04-06 12:04:10', 0),
(686, 'كيف تبني صالة رياضية منزلية بميزانية محدودة', 'home-gym-on-a-budget-ar', 'ar', 685, 'ابنِ صالة رياضية منزلية فعالة باستثمار بسيط.', '## صالة رياضية منزلية بميزانية محدودة\n\n١. **حزام المقاومة** — الأكثر تنوعاً\n٢. **بار العقلة** — الظهر والجزء العلوي\n٣. **حبل القفز** — كارديو في مساحة صغيرة\n٤. **حصيرة اليوغا** — التمارين الأرضية\n٥. **تمارين وزن الجسم** — لا معدات مطلوبة\n\nيوتيوب يحتوي آلاف التمارين الموجهة المجانية.', NULL, NULL, NULL, 'published', 936, 'coach', '2026-04-06 12:04:03', '2026-04-06 12:04:10', '2026-04-06 12:04:10', 0),
(687, 'Why You\'re Not Losing Weight', 'why-not-losing-weight-fix', 'en', NULL, 'The most common reasons weight loss stalls and the exact fixes.', '## Breaking a Weight Loss Plateau\n\n1. **Underestimating calories** — weigh food for one week\n2. **Metabolic adaptation** — take a 1–2 week diet break\n3. **Too much cardio** — add strength training\n4. **Poor sleep** — fix sleep before anything else\n5. **Water retention** — track trends over 2–4 weeks, not daily', NULL, NULL, NULL, 'published', 936, 'coach', '2026-04-06 12:04:03', '2026-04-06 12:04:11', '2026-04-06 12:04:11', 0),
(688, 'لماذا لا تخسر وزناً؟', 'why-not-losing-weight-fix-ar', 'ar', 687, 'أكثر أسباب توقف خسارة الوزن شيوعاً والحلول الدقيقة.', '## كسر حاجز توقف الوزن\n\n١. **التقليل من تقدير السعرات** — زن طعامك أسبوعاً\n٢. **التكيف الأيضي** — أخذ استراحة غذائية 1–2 أسبوع\n٣. **كثرة الكارديو** — أضف تمارين القوة\n٤. **قلة النوم** — اصلح النوم أولاً\n٥. **الاحتباس المائي** — تتبع الاتجاهات 2–4 أسابيع وليس يومياً', NULL, NULL, NULL, 'published', 936, 'coach', '2026-04-06 12:04:03', '2026-04-06 12:04:11', '2026-04-06 12:04:11', 0),
(689, 'The Ultimate Pre-Workout Nutrition Guide', 'pre-workout-nutrition-guide', 'en', NULL, 'What to eat before training to maximize performance.', '## Pre-Workout Nutrition\n\n**2–3 hours before:** 40–60g carbs + 20–30g protein, low fat.\n**30–60 min before:** banana + protein, or dates + coffee.\n\n### Caffeine\n3–6mg/kg bodyweight 30–60 min before = ~3–4% strength increase.\n\n### Hydration\n2% dehydration = up to 15% drop in strength output.', NULL, NULL, NULL, 'published', 936, 'coach', '2026-04-06 12:04:03', '2026-04-06 12:04:11', '2026-04-06 12:04:11', 0),
(690, 'الدليل الشامل لتغذية ما قبل التمرين', 'pre-workout-nutrition-guide-ar', 'ar', 689, 'ما الذي تأكله قبل التمرين لتعظيم الأداء.', '## تغذية ما قبل التمرين\n\n**قبل 2–3 ساعات:** 40–60 غ كربوهيدرات + 20–30 غ بروتين، دهون منخفضة.\n**قبل 30–60 دقيقة:** موزة + بروتين، أو تمر + قهوة.\n\n### الكافيين\n3–6 ملغ/كغ قبل 30–60 دقيقة = زيادة قوة ~3–4%.\n\n### الترطيب\n2% جفاف = انخفاض حتى 15% في مخرجات القوة.', NULL, NULL, NULL, 'published', 936, 'coach', '2026-04-06 12:04:03', '2026-04-06 12:04:12', '2026-04-06 12:04:12', 0),
(691, 'Sleep: The Most Underrated Performance Enhancer', 'sleep-performance-enhancer', 'en', NULL, 'Sleep is where gains are actually made.', '## Why Sleep is Your #1 Tool\n\n### During Sleep\n- Growth hormone peaks — muscle repair\n- Cortisol resets\n- Motor patterns are cemented\n- Glycogen replenishes\n\n### Requirements\n- Sedentary: 7–8h | Exercisers: 8–9h | Athletes: 9–10h\n\n### Optimize It\n1. Consistent schedule\n2. Cool room (18–20°C)\n3. No screens 1h before bed\n4. Blackout curtains\n5. No caffeine after 2pm', NULL, NULL, NULL, 'published', 936, 'coach', '2026-04-06 12:04:03', '2026-04-06 12:04:12', '2026-04-06 12:04:12', 0),
(692, 'النوم: أكثر معزز للأداء إهمالاً', 'sleep-performance-enhancer-ar', 'ar', 691, 'النوم هو المكان الذي تُصنع فيه المكاسب الحقيقية.', '## لماذا النوم هو أداتك الأولى\n\n### أثناء النوم\n- ذروة هرمون النمو — إصلاح العضلات\n- إعادة ضبط الكورتيزول\n- ترسيخ الأنماط الحركية\n- تجديد الجليكوجين\n\n### المتطلبات\n- خامل: 7–8 ساعات | متمرن: 8–9 | رياضي: 9–10\n\n### كيف تحسّنه\n١. جدول ثابت\n٢. غرفة باردة (18–20°م)\n٣. لا شاشات قبل ساعة من النوم\n٤. ستائر تعتيم\n٥. لا كافيين بعد الثانية ظهراً', NULL, NULL, NULL, 'published', 936, 'coach', '2026-04-06 12:04:03', '2026-04-06 12:04:13', '2026-04-06 12:04:13', 0);

-- --------------------------------------------------------
-- Table: `certification_requests`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `certification_requests`;
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
);

-- --------------------------------------------------------
-- Table: `challenge_participants`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `challenge_participants`;
CREATE TABLE `challenge_participants` (
  `id` int NOT NULL AUTO_INCREMENT,
  `challenge_id` int NOT NULL,
  `user_id` int NOT NULL,
  `joined_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_challenge_user` (`challenge_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `challenge_participants_ibfk_1` FOREIGN KEY (`challenge_id`) REFERENCES `challenges` (`id`),
  CONSTRAINT `challenge_participants_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
);

-- --------------------------------------------------------
-- Table: `challenges`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `challenges`;
CREATE TABLE `challenges` (
  `id` int NOT NULL AUTO_INCREMENT,
  `creator_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `start_date` varchar(20) DEFAULT NULL,
  `end_date` varchar(20) DEFAULT NULL,
  `image_url` text,
  `participant_count` int DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `creator_id` (`creator_id`),
  CONSTRAINT `challenges_ibfk_1` FOREIGN KEY (`creator_id`) REFERENCES `users` (`id`)
);

-- --------------------------------------------------------
-- Table: `chat_requests`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `chat_requests`;
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
);

-- --------------------------------------------------------
-- Table: `coach_ads`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `coach_ads`;
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
  `payment_proof` varchar(500) DEFAULT NULL,
  `target_lat` decimal(10,7) DEFAULT NULL,
  `target_lng` decimal(10,7) DEFAULT NULL,
  `target_city` varchar(100) DEFAULT NULL,
  `target_radius_km` int DEFAULT '50',
  `contact_phone` varchar(30) DEFAULT NULL,
  PRIMARY KEY (`id`)
);

-- --------------------------------------------------------
-- Table: `coach_follows`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `coach_follows`;
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
);

-- --------------------------------------------------------
-- Table: `coach_profiles`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `coach_profiles`;
CREATE TABLE `coach_profiles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `bio` text,
  `specialty` varchar(255) DEFAULT '',
  `location` varchar(255) DEFAULT '',
  `price` float DEFAULT '50',
  `available` tinyint(1) DEFAULT '1',
  `sessions_count` int DEFAULT '0',
  `plan_types` varchar(100) DEFAULT 'complete',
  `monthly_price` decimal(10,2) DEFAULT '0.00',
  `yearly_price` decimal(10,2) DEFAULT '0.00',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `certified` tinyint(1) DEFAULT '0',
  `certified_until` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `coach_profiles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
);

INSERT INTO `coach_profiles` (`id`, `user_id`, `bio`, `specialty`, `location`, `price`, `available`, `sessions_count`, `plan_types`, `monthly_price`, `yearly_price`, `created_at`, `updated_at`, `certified`, `certified_until`) VALUES
(1, 87, 'Hello This is Marc, a dedicated fitness coach committed to helping individuals unlock their full physical potential. With a passion for health, strength, and sustainable lifestyle changes, he specializes in personalized training programs tailored to each client’s unique goals—whether it’s building muscle, losing weight, or improving overall fitness.\n\nKnown for his motivating approach and attention to detail, Marc focuses not only on workouts but also on proper form, nutrition guidance, and long-term consistency. He believes fitness is more than just exercise—it’s a mindset and a lifelong journey.', 'Strength & Condition', 'Cairo', 50, 1, 0, 'complete', '300.00', '1.00', '2026-03-23 04:56:56', '2026-03-23 04:56:56', 0, NULL),
(2, 94, 'Certified Strength & Conditioning coach with 9+ years of experience. I\'ve helped 116+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Strength & Conditioning', 'Luxor', 50, 1, 0, 'complete', '249.00', '1999.00', '2026-03-23 05:07:21', '2026-03-23 05:07:21', 0, NULL),
(3, 95, 'Certified HIIT & Weight Loss coach with 6+ years of experience. I\'ve helped 115+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'HIIT & Weight Loss', 'Alexandria', 50, 1, 0, 'complete', '149.00', '999.00', '2026-03-23 05:07:22', '2026-03-23 05:07:22', 0, NULL),
(4, 96, 'Certified Yoga & Mobility coach with 9+ years of experience. I\'ve helped 170+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Yoga & Mobility', 'Hurghada', 50, 1, 0, 'workout', '199.00', '2499.00', '2026-03-23 05:07:22', '2026-03-23 05:07:22', 0, NULL),
(5, 97, 'Certified Nutrition & Fitness coach with 6+ years of experience. I\'ve helped 96+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Nutrition & Fitness', 'Mansoura', 50, 1, 0, 'complete', '99.00', '1999.00', '2026-03-23 05:07:23', '2026-03-23 05:07:23', 0, NULL),
(6, 126, 'Certified Strength & Conditioning coach with 7+ years of experience. I\'ve helped 137+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Strength & Conditioning', 'Alexandria', 50, 1, 0, 'complete', '149.00', '2499.00', '2026-03-29 12:51:51', '2026-03-29 12:51:51', 0, NULL),
(7, 127, 'Certified HIIT & Weight Loss coach with 6+ years of experience. I\'ve helped 176+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'HIIT & Weight Loss', 'Hurghada', 50, 1, 0, 'complete', '149.00', '1999.00', '2026-03-29 12:51:52', '2026-03-29 12:51:52', 0, NULL),
(8, 128, 'Certified Yoga & Mobility coach with 10+ years of experience. I\'ve helped 97+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Yoga & Mobility', 'Hurghada', 50, 1, 0, 'workout', '199.00', '999.00', '2026-03-29 12:51:52', '2026-03-29 12:51:52', 0, NULL),
(9, 129, 'Certified Nutrition & Fitness coach with 4+ years of experience. I\'ve helped 126+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Nutrition & Fitness', 'Alexandria', 50, 1, 0, 'complete', '99.00', '999.00', '2026-03-29 12:51:53', '2026-03-29 12:51:53', 0, NULL),
(10, 153, 'Certified Strength & Conditioning coach with 7+ years of experience. I\'ve helped 134+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Strength & Conditioning', 'Sharm El Sheikh', 50, 1, 0, 'complete', '199.00', '999.00', '2026-03-29 13:01:11', '2026-03-29 13:01:11', 0, NULL),
(11, 154, 'Certified HIIT & Weight Loss coach with 7+ years of experience. I\'ve helped 188+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'HIIT & Weight Loss', 'Hurghada', 50, 1, 0, 'complete', '149.00', '999.00', '2026-03-29 13:01:12', '2026-03-29 13:01:12', 0, NULL),
(12, 155, 'Certified Yoga & Mobility coach with 6+ years of experience. I\'ve helped 180+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Yoga & Mobility', 'Cairo', 50, 1, 0, 'complete', '99.00', '1999.00', '2026-03-29 13:01:13', '2026-03-29 13:01:13', 0, NULL),
(13, 156, 'Certified Nutrition & Fitness coach with 6+ years of experience. I\'ve helped 70+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Nutrition & Fitness', 'Hurghada', 50, 1, 0, 'workout', '99.00', '1999.00', '2026-03-29 13:01:13', '2026-03-29 13:01:13', 0, NULL),
(14, 180, 'Certified Strength & Conditioning coach with 5+ years of experience. I\'ve helped 169+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Strength & Conditioning', 'Tanta', 50, 1, 0, 'workout', '99.00', '1999.00', '2026-03-29 13:07:59', '2026-03-29 13:07:59', 0, NULL),
(15, 181, 'Certified HIIT & Weight Loss coach with 9+ years of experience. I\'ve helped 149+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'HIIT & Weight Loss', 'Hurghada', 50, 1, 0, 'workout', '99.00', '1499.00', '2026-03-29 13:08:00', '2026-03-29 13:08:00', 0, NULL),
(16, 182, 'Certified Yoga & Mobility coach with 5+ years of experience. I\'ve helped 110+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Yoga & Mobility', 'Sharm El Sheikh', 50, 1, 0, 'workout', '149.00', '999.00', '2026-03-29 13:08:02', '2026-03-29 13:08:02', 0, NULL),
(17, 183, 'Certified Nutrition & Fitness coach with 10+ years of experience. I\'ve helped 61+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Nutrition & Fitness', 'Luxor', 50, 1, 0, 'workout', '149.00', '1499.00', '2026-03-29 13:08:03', '2026-03-29 13:08:03', 0, NULL),
(18, 207, 'Certified Strength & Conditioning coach with 4+ years of experience. I\'ve helped 140+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Strength & Conditioning', 'Sharm El Sheikh', 50, 1, 0, 'workout', '99.00', '1999.00', '2026-03-29 13:14:48', '2026-03-29 13:14:48', 0, NULL),
(19, 208, 'Certified HIIT & Weight Loss coach with 4+ years of experience. I\'ve helped 76+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'HIIT & Weight Loss', 'Mansoura', 50, 1, 0, 'complete', '249.00', '2499.00', '2026-03-29 13:14:49', '2026-03-29 13:14:49', 0, NULL),
(20, 209, 'Certified Yoga & Mobility coach with 9+ years of experience. I\'ve helped 148+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Yoga & Mobility', 'Luxor', 50, 1, 0, 'complete', '149.00', '999.00', '2026-03-29 13:14:49', '2026-03-29 13:14:49', 0, NULL),
(21, 210, 'Certified Nutrition & Fitness coach with 10+ years of experience. I\'ve helped 109+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Nutrition & Fitness', 'Mansoura', 50, 1, 0, 'complete', '249.00', '1499.00', '2026-03-29 13:14:50', '2026-03-29 13:14:50', 0, NULL),
(22, 234, 'Certified Strength & Conditioning coach with 9+ years of experience. I\'ve helped 77+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Strength & Conditioning', 'Mansoura', 50, 1, 0, 'complete', '99.00', '999.00', '2026-03-29 13:22:00', '2026-03-29 13:22:00', 0, NULL),
(23, 235, 'Certified HIIT & Weight Loss coach with 7+ years of experience. I\'ve helped 67+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'HIIT & Weight Loss', 'Tanta', 50, 1, 0, 'workout', '199.00', '1999.00', '2026-03-29 13:22:01', '2026-03-29 13:22:01', 0, NULL),
(24, 236, 'Certified Yoga & Mobility coach with 10+ years of experience. I\'ve helped 173+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Yoga & Mobility', 'Sharm El Sheikh', 50, 1, 0, 'complete', '199.00', '1999.00', '2026-03-29 13:22:02', '2026-03-29 13:22:02', 0, NULL),
(25, 237, 'Certified Nutrition & Fitness coach with 10+ years of experience. I\'ve helped 91+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Nutrition & Fitness', 'Giza', 50, 1, 0, 'complete', '99.00', '2499.00', '2026-03-29 13:22:03', '2026-03-29 13:22:03', 0, NULL),
(26, 261, 'Certified Strength & Conditioning coach with 8+ years of experience. I\'ve helped 112+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Strength & Conditioning', 'Tanta', 50, 1, 0, 'workout', '199.00', '999.00', '2026-03-29 13:28:45', '2026-03-29 13:28:45', 0, NULL),
(27, 262, 'Certified HIIT & Weight Loss coach with 5+ years of experience. I\'ve helped 133+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'HIIT & Weight Loss', 'Mansoura', 50, 1, 0, 'complete', '249.00', '2499.00', '2026-03-29 13:28:47', '2026-03-29 13:28:47', 0, NULL),
(28, 263, 'Certified Yoga & Mobility coach with 6+ years of experience. I\'ve helped 169+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Yoga & Mobility', 'Aswan', 50, 1, 0, 'complete', '249.00', '2499.00', '2026-03-29 13:28:48', '2026-03-29 13:28:48', 0, NULL),
(29, 264, 'Certified Nutrition & Fitness coach with 6+ years of experience. I\'ve helped 132+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Nutrition & Fitness', 'Aswan', 50, 1, 0, 'complete', '249.00', '999.00', '2026-03-29 13:28:48', '2026-03-29 13:28:48', 0, NULL),
(30, 288, 'Certified Strength & Conditioning coach with 6+ years of experience. I\'ve helped 160+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Strength & Conditioning', 'Cairo', 50, 1, 0, 'complete', '99.00', '2499.00', '2026-03-29 13:35:46', '2026-03-29 13:35:46', 0, NULL),
(31, 289, 'Certified HIIT & Weight Loss coach with 6+ years of experience. I\'ve helped 175+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'HIIT & Weight Loss', 'Aswan', 50, 1, 0, 'workout', '149.00', '1999.00', '2026-03-29 13:35:48', '2026-03-29 13:35:48', 0, NULL),
(32, 290, 'Certified Yoga & Mobility coach with 7+ years of experience. I\'ve helped 165+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Yoga & Mobility', 'Tanta', 50, 1, 0, 'complete', '249.00', '2499.00', '2026-03-29 13:35:48', '2026-03-29 13:35:48', 0, NULL),
(33, 291, 'Certified Nutrition & Fitness coach with 9+ years of experience. I\'ve helped 110+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Nutrition & Fitness', 'Tanta', 50, 1, 0, 'workout', '199.00', '1999.00', '2026-03-29 13:35:49', '2026-03-29 13:35:49', 0, NULL),
(34, 315, 'Certified Strength & Conditioning coach with 4+ years of experience. I\'ve helped 50+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Strength & Conditioning', 'Luxor', 50, 1, 0, 'complete', '149.00', '1999.00', '2026-03-29 13:43:02', '2026-03-29 13:43:02', 0, NULL),
(35, 316, 'Certified HIIT & Weight Loss coach with 3+ years of experience. I\'ve helped 115+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'HIIT & Weight Loss', 'Mansoura', 50, 1, 0, 'complete', '149.00', '999.00', '2026-03-29 13:43:03', '2026-03-29 13:43:03', 0, NULL),
(36, 317, 'Certified Yoga & Mobility coach with 5+ years of experience. I\'ve helped 138+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Yoga & Mobility', 'Giza', 50, 1, 0, 'workout', '199.00', '1499.00', '2026-03-29 13:43:03', '2026-03-29 13:43:03', 0, NULL),
(37, 318, 'Certified Nutrition & Fitness coach with 8+ years of experience. I\'ve helped 177+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Nutrition & Fitness', 'Alexandria', 50, 1, 0, 'complete', '149.00', '999.00', '2026-03-29 13:43:05', '2026-03-29 13:43:05', 0, NULL),
(38, 342, 'Certified Strength & Conditioning coach with 7+ years of experience. I\'ve helped 87+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Strength & Conditioning', 'Alexandria', 50, 1, 0, 'complete', '199.00', '999.00', '2026-03-29 13:49:11', '2026-03-29 13:49:11', 0, NULL),
(39, 343, 'Certified HIIT & Weight Loss coach with 5+ years of experience. I\'ve helped 68+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'HIIT & Weight Loss', 'Hurghada', 50, 1, 0, 'complete', '149.00', '2499.00', '2026-03-29 13:49:11', '2026-03-29 13:49:11', 0, NULL),
(40, 344, 'Certified Yoga & Mobility coach with 6+ years of experience. I\'ve helped 153+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Yoga & Mobility', 'Sharm El Sheikh', 50, 1, 0, 'workout', '149.00', '999.00', '2026-03-29 13:49:12', '2026-03-29 13:49:12', 0, NULL),
(41, 345, 'Certified Nutrition & Fitness coach with 6+ years of experience. I\'ve helped 180+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Nutrition & Fitness', 'Mansoura', 50, 1, 0, 'complete', '99.00', '1999.00', '2026-03-29 13:49:12', '2026-03-29 13:49:12', 0, NULL),
(42, 369, 'Certified Strength & Conditioning coach with 6+ years of experience. I\'ve helped 188+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Strength & Conditioning', 'Tanta', 50, 1, 0, 'complete', '149.00', '1999.00', '2026-03-29 13:56:01', '2026-03-29 13:56:01', 0, NULL),
(43, 370, 'Certified HIIT & Weight Loss coach with 6+ years of experience. I\'ve helped 117+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'HIIT & Weight Loss', 'Hurghada', 50, 1, 0, 'workout', '249.00', '1999.00', '2026-03-29 13:56:02', '2026-03-29 13:56:02', 0, NULL),
(44, 371, 'Certified Yoga & Mobility coach with 5+ years of experience. I\'ve helped 172+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Yoga & Mobility', 'Luxor', 50, 1, 0, 'workout', '199.00', '999.00', '2026-03-29 13:56:03', '2026-03-29 13:56:03', 0, NULL),
(45, 372, 'Certified Nutrition & Fitness coach with 7+ years of experience. I\'ve helped 160+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Nutrition & Fitness', 'Mansoura', 50, 1, 0, 'workout', '99.00', '1499.00', '2026-03-29 13:56:04', '2026-03-29 13:56:04', 0, NULL),
(46, 396, 'Certified Strength & Conditioning coach with 6+ years of experience. I\'ve helped 137+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Strength & Conditioning', 'Aswan', 50, 1, 0, 'complete', '249.00', '1499.00', '2026-03-29 14:02:21', '2026-03-29 14:02:21', 0, NULL),
(47, 397, 'Certified HIIT & Weight Loss coach with 4+ years of experience. I\'ve helped 59+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'HIIT & Weight Loss', 'Giza', 50, 1, 0, 'complete', '99.00', '1999.00', '2026-03-29 14:02:22', '2026-03-29 14:02:22', 0, NULL),
(48, 398, 'Certified Yoga & Mobility coach with 8+ years of experience. I\'ve helped 131+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Yoga & Mobility', 'Alexandria', 50, 1, 0, 'complete', '249.00', '999.00', '2026-03-29 14:02:23', '2026-03-29 14:02:23', 0, NULL),
(49, 399, 'Certified Nutrition & Fitness coach with 9+ years of experience. I\'ve helped 124+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Nutrition & Fitness', 'Hurghada', 50, 1, 0, 'workout', '149.00', '1999.00', '2026-03-29 14:02:24', '2026-03-29 14:02:24', 0, NULL),
(50, 423, 'Certified Strength & Conditioning coach with 6+ years of experience. I\'ve helped 186+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Strength & Conditioning', 'Aswan', 50, 1, 0, 'complete', '249.00', '999.00', '2026-03-29 14:09:06', '2026-03-29 14:09:06', 0, NULL),
(51, 424, 'Certified HIIT & Weight Loss coach with 3+ years of experience. I\'ve helped 160+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'HIIT & Weight Loss', 'Tanta', 50, 1, 0, 'workout', '199.00', '1499.00', '2026-03-29 14:09:07', '2026-03-29 14:09:07', 0, NULL),
(52, 425, 'Certified Yoga & Mobility coach with 7+ years of experience. I\'ve helped 95+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Yoga & Mobility', 'Aswan', 50, 1, 0, 'complete', '249.00', '1999.00', '2026-03-29 14:09:08', '2026-03-29 14:09:08', 0, NULL),
(53, 426, 'Certified Nutrition & Fitness coach with 6+ years of experience. I\'ve helped 171+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Nutrition & Fitness', 'Aswan', 50, 1, 0, 'complete', '149.00', '999.00', '2026-03-29 14:09:08', '2026-03-29 14:09:08', 0, NULL),
(54, 450, 'Certified Strength & Conditioning coach with 5+ years of experience. I\'ve helped 78+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Strength & Conditioning', 'Mansoura', 50, 1, 0, 'complete', '199.00', '999.00', '2026-03-29 14:15:23', '2026-03-29 14:15:23', 0, NULL),
(55, 451, 'Certified HIIT & Weight Loss coach with 5+ years of experience. I\'ve helped 154+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'HIIT & Weight Loss', 'Mansoura', 50, 1, 0, 'complete', '149.00', '999.00', '2026-03-29 14:15:24', '2026-03-29 14:15:24', 0, NULL),
(56, 452, 'Certified Yoga & Mobility coach with 8+ years of experience. I\'ve helped 162+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Yoga & Mobility', 'Aswan', 50, 1, 0, 'workout', '149.00', '2499.00', '2026-03-29 14:15:25', '2026-03-29 14:15:25', 0, NULL),
(57, 453, 'Certified Nutrition & Fitness coach with 4+ years of experience. I\'ve helped 141+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Nutrition & Fitness', 'Hurghada', 50, 1, 0, 'complete', '99.00', '1499.00', '2026-03-29 14:15:25', '2026-03-29 14:15:25', 0, NULL),
(58, 477, 'Certified Strength & Conditioning coach with 9+ years of experience. I\'ve helped 135+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Strength & Conditioning', 'Giza', 50, 1, 0, 'complete', '149.00', '2499.00', '2026-03-29 14:21:33', '2026-03-29 14:21:33', 0, NULL),
(59, 478, 'Certified HIIT & Weight Loss coach with 9+ years of experience. I\'ve helped 85+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'HIIT & Weight Loss', 'Aswan', 50, 1, 0, 'workout', '199.00', '2499.00', '2026-03-29 14:21:34', '2026-03-29 14:21:34', 0, NULL),
(60, 479, 'Certified Yoga & Mobility coach with 8+ years of experience. I\'ve helped 126+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Yoga & Mobility', 'Cairo', 50, 1, 0, 'complete', '249.00', '999.00', '2026-03-29 14:21:35', '2026-03-29 14:21:35', 0, NULL),
(61, 480, 'Certified Nutrition & Fitness coach with 3+ years of experience. I\'ve helped 74+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Nutrition & Fitness', 'Sharm El Sheikh', 50, 1, 0, 'workout', '99.00', '999.00', '2026-03-29 14:21:36', '2026-03-29 14:21:36', 0, NULL),
(62, 504, 'Certified Strength & Conditioning coach with 5+ years of experience. I\'ve helped 169+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Strength & Conditioning', 'Cairo', 50, 1, 0, 'complete', '249.00', '1499.00', '2026-03-29 14:28:35', '2026-03-29 14:28:35', 0, NULL),
(63, 505, 'Certified HIIT & Weight Loss coach with 3+ years of experience. I\'ve helped 126+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'HIIT & Weight Loss', 'Tanta', 50, 1, 0, 'workout', '99.00', '2499.00', '2026-03-29 14:28:36', '2026-03-29 14:28:36', 0, NULL),
(64, 506, 'Certified Yoga & Mobility coach with 4+ years of experience. I\'ve helped 169+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Yoga & Mobility', 'Mansoura', 50, 1, 0, 'complete', '199.00', '999.00', '2026-03-29 14:28:37', '2026-03-29 14:28:37', 0, NULL),
(65, 507, 'Certified Nutrition & Fitness coach with 5+ years of experience. I\'ve helped 74+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Nutrition & Fitness', 'Alexandria', 50, 1, 0, 'complete', '149.00', '999.00', '2026-03-29 14:28:37', '2026-03-29 14:28:37', 0, NULL),
(66, 531, 'Certified Strength & Conditioning coach with 10+ years of experience. I\'ve helped 167+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Strength & Conditioning', 'Aswan', 50, 1, 0, 'complete', '249.00', '1999.00', '2026-03-29 14:34:17', '2026-03-29 14:34:17', 0, NULL),
(67, 532, 'Certified HIIT & Weight Loss coach with 5+ years of experience. I\'ve helped 166+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'HIIT & Weight Loss', 'Alexandria', 50, 1, 0, 'complete', '199.00', '999.00', '2026-03-29 14:34:18', '2026-03-29 14:34:18', 0, NULL),
(68, 533, 'Certified Yoga & Mobility coach with 9+ years of experience. I\'ve helped 59+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Yoga & Mobility', 'Alexandria', 50, 1, 0, 'workout', '149.00', '2499.00', '2026-03-29 14:34:18', '2026-03-29 14:34:18', 0, NULL),
(69, 534, 'Certified Nutrition & Fitness coach with 4+ years of experience. I\'ve helped 197+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Nutrition & Fitness', 'Alexandria', 50, 1, 0, 'complete', '99.00', '1499.00', '2026-03-29 14:34:19', '2026-03-29 14:34:19', 0, NULL),
(70, 558, 'Certified Strength & Conditioning coach with 6+ years of experience. I\'ve helped 151+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Strength & Conditioning', 'Tanta', 50, 1, 0, 'workout', '149.00', '999.00', '2026-03-29 14:42:37', '2026-03-29 14:42:37', 0, NULL),
(71, 559, 'Certified HIIT & Weight Loss coach with 7+ years of experience. I\'ve helped 73+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'HIIT & Weight Loss', 'Aswan', 50, 1, 0, 'complete', '249.00', '2499.00', '2026-03-29 14:42:41', '2026-03-29 14:42:41', 0, NULL),
(72, 560, 'Certified Yoga & Mobility coach with 4+ years of experience. I\'ve helped 77+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Yoga & Mobility', 'Sharm El Sheikh', 50, 1, 0, 'complete', '149.00', '1999.00', '2026-03-29 14:42:45', '2026-03-29 14:42:45', 0, NULL),
(73, 561, 'Certified Nutrition & Fitness coach with 4+ years of experience. I\'ve helped 85+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Nutrition & Fitness', 'Giza', 50, 1, 0, 'complete', '249.00', '2499.00', '2026-03-29 14:42:50', '2026-03-29 14:42:50', 0, NULL),
(74, 585, 'Certified Strength & Conditioning coach with 5+ years of experience. I\'ve helped 121+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Strength & Conditioning', 'Aswan', 50, 1, 0, 'workout', '99.00', '1999.00', '2026-03-29 15:18:05', '2026-03-29 15:18:05', 0, NULL),
(75, 586, 'Certified HIIT & Weight Loss coach with 6+ years of experience. I\'ve helped 126+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'HIIT & Weight Loss', 'Mansoura', 50, 1, 0, 'complete', '149.00', '999.00', '2026-03-29 15:18:06', '2026-03-29 15:18:06', 0, NULL),
(76, 587, 'Certified Yoga & Mobility coach with 9+ years of experience. I\'ve helped 158+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Yoga & Mobility', 'Sharm El Sheikh', 50, 1, 0, 'complete', '149.00', '1999.00', '2026-03-29 15:18:07', '2026-03-29 15:18:07', 0, NULL),
(77, 588, 'Certified Nutrition & Fitness coach with 9+ years of experience. I\'ve helped 98+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Nutrition & Fitness', 'Alexandria', 50, 1, 0, 'complete', '199.00', '999.00', '2026-03-29 15:18:11', '2026-03-29 15:18:11', 0, NULL),
(78, 612, 'Certified Strength & Conditioning coach with 10+ years of experience. I\'ve helped 133+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Strength & Conditioning', 'Mansoura', 50, 1, 0, 'complete', '199.00', '999.00', '2026-03-29 15:31:34', '2026-03-29 15:31:34', 0, NULL),
(79, 613, 'Certified HIIT & Weight Loss coach with 9+ years of experience. I\'ve helped 93+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'HIIT & Weight Loss', 'Aswan', 50, 1, 0, 'complete', '99.00', '999.00', '2026-03-29 15:31:35', '2026-03-29 15:31:35', 0, NULL),
(80, 614, 'Certified Yoga & Mobility coach with 3+ years of experience. I\'ve helped 185+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Yoga & Mobility', 'Mansoura', 50, 1, 0, 'complete', '249.00', '999.00', '2026-03-29 15:31:37', '2026-03-29 15:31:37', 0, NULL),
(81, 615, 'Certified Nutrition & Fitness coach with 10+ years of experience. I\'ve helped 135+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Nutrition & Fitness', 'Luxor', 50, 1, 0, 'complete', '249.00', '999.00', '2026-03-29 15:31:37', '2026-03-29 15:31:37', 0, NULL),
(82, 639, 'Certified Strength & Conditioning coach with 6+ years of experience. I\'ve helped 74+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Strength & Conditioning', 'Hurghada', 50, 1, 0, 'complete', '149.00', '1999.00', '2026-03-29 15:39:46', '2026-03-29 15:39:46', 0, NULL),
(83, 640, 'Certified HIIT & Weight Loss coach with 4+ years of experience. I\'ve helped 103+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'HIIT & Weight Loss', 'Tanta', 50, 1, 0, 'complete', '99.00', '1499.00', '2026-03-29 15:39:48', '2026-03-29 15:39:48', 0, NULL),
(84, 641, 'Certified Yoga & Mobility coach with 9+ years of experience. I\'ve helped 135+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Yoga & Mobility', 'Alexandria', 50, 1, 0, 'workout', '199.00', '999.00', '2026-03-29 15:39:50', '2026-03-29 15:39:50', 0, NULL),
(85, 642, 'Certified Nutrition & Fitness coach with 3+ years of experience. I\'ve helped 158+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Nutrition & Fitness', 'Mansoura', 50, 1, 0, 'complete', '149.00', '2499.00', '2026-03-29 15:39:50', '2026-03-29 15:39:50', 0, NULL),
(86, 666, 'Certified Strength & Conditioning coach with 8+ years of experience. I\'ve helped 194+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Strength & Conditioning', 'Sharm El Sheikh', 50, 1, 0, 'complete', '249.00', '1999.00', '2026-03-29 15:47:02', '2026-03-29 15:47:02', 0, NULL),
(87, 667, 'Certified HIIT & Weight Loss coach with 4+ years of experience. I\'ve helped 115+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'HIIT & Weight Loss', 'Aswan', 50, 1, 0, 'complete', '99.00', '1999.00', '2026-03-29 15:47:02', '2026-03-29 15:47:02', 0, NULL),
(88, 668, 'Certified Yoga & Mobility coach with 7+ years of experience. I\'ve helped 183+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Yoga & Mobility', 'Luxor', 50, 1, 0, 'workout', '249.00', '2499.00', '2026-03-29 15:47:03', '2026-03-29 15:47:03', 0, NULL),
(89, 669, 'Certified Nutrition & Fitness coach with 4+ years of experience. I\'ve helped 86+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Nutrition & Fitness', 'Mansoura', 50, 1, 0, 'workout', '199.00', '999.00', '2026-03-29 15:47:04', '2026-03-29 15:47:04', 0, NULL),
(90, 693, 'Certified Strength & Conditioning coach with 10+ years of experience. I\'ve helped 186+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Strength & Conditioning', 'Luxor', 50, 1, 0, 'complete', '149.00', '1499.00', '2026-03-29 15:55:18', '2026-03-29 15:55:18', 0, NULL),
(91, 694, 'Certified HIIT & Weight Loss coach with 10+ years of experience. I\'ve helped 126+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'HIIT & Weight Loss', 'Alexandria', 50, 1, 0, 'complete', '149.00', '1999.00', '2026-03-29 15:55:19', '2026-03-29 15:55:19', 0, NULL),
(92, 695, 'Certified Yoga & Mobility coach with 9+ years of experience. I\'ve helped 109+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Yoga & Mobility', 'Mansoura', 50, 1, 0, 'complete', '199.00', '2499.00', '2026-03-29 15:55:19', '2026-03-29 15:55:19', 0, NULL),
(93, 696, 'Certified Nutrition & Fitness coach with 7+ years of experience. I\'ve helped 75+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Nutrition & Fitness', 'Aswan', 50, 1, 0, 'complete', '149.00', '1499.00', '2026-03-29 15:55:20', '2026-03-29 15:55:20', 0, NULL),
(94, 720, 'Certified Strength & Conditioning coach with 6+ years of experience. I\'ve helped 137+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Strength & Conditioning', 'Aswan', 50, 1, 0, 'complete', '199.00', '1499.00', '2026-03-29 16:02:34', '2026-03-29 16:02:34', 0, NULL),
(95, 721, 'Certified HIIT & Weight Loss coach with 4+ years of experience. I\'ve helped 163+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'HIIT & Weight Loss', 'Giza', 50, 1, 0, 'workout', '99.00', '2499.00', '2026-03-29 16:02:35', '2026-03-29 16:02:35', 0, NULL),
(96, 722, 'Certified Yoga & Mobility coach with 5+ years of experience. I\'ve helped 137+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Yoga & Mobility', 'Luxor', 50, 1, 0, 'complete', '199.00', '1999.00', '2026-03-29 16:02:36', '2026-03-29 16:02:36', 0, NULL),
(97, 723, 'Certified Nutrition & Fitness coach with 8+ years of experience. I\'ve helped 129+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Nutrition & Fitness', 'Luxor', 50, 1, 0, 'complete', '99.00', '999.00', '2026-03-29 16:02:36', '2026-03-29 16:02:36', 0, NULL),
(98, 747, 'Certified Strength & Conditioning coach with 6+ years of experience. I\'ve helped 171+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Strength & Conditioning', 'Tanta', 50, 1, 0, 'complete', '249.00', '999.00', '2026-03-29 16:09:28', '2026-03-29 16:09:28', 0, NULL),
(99, 748, 'Certified HIIT & Weight Loss coach with 9+ years of experience. I\'ve helped 64+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'HIIT & Weight Loss', 'Hurghada', 50, 1, 0, 'complete', '199.00', '1499.00', '2026-03-29 16:09:29', '2026-03-29 16:09:29', 0, NULL),
(100, 749, 'Certified Yoga & Mobility coach with 8+ years of experience. I\'ve helped 134+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Yoga & Mobility', 'Giza', 50, 1, 0, 'complete', '199.00', '1499.00', '2026-03-29 16:09:29', '2026-03-29 16:09:29', 0, NULL),
(101, 750, 'Certified Nutrition & Fitness coach with 6+ years of experience. I\'ve helped 143+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Nutrition & Fitness', 'Luxor', 50, 1, 0, 'complete', '249.00', '1999.00', '2026-03-29 16:09:31', '2026-03-29 16:09:31', 0, NULL),
(102, 774, 'Certified Strength & Conditioning coach with 5+ years of experience. I\'ve helped 55+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Strength & Conditioning', 'Hurghada', 50, 1, 0, 'complete', '149.00', '999.00', '2026-03-29 16:16:22', '2026-03-29 16:16:22', 0, NULL),
(103, 775, 'Certified HIIT & Weight Loss coach with 9+ years of experience. I\'ve helped 80+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'HIIT & Weight Loss', 'Aswan', 50, 1, 0, 'complete', '149.00', '999.00', '2026-03-29 16:16:23', '2026-03-29 16:16:23', 0, NULL),
(104, 776, 'Certified Yoga & Mobility coach with 5+ years of experience. I\'ve helped 152+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Yoga & Mobility', 'Alexandria', 50, 1, 0, 'workout', '99.00', '1999.00', '2026-03-29 16:16:24', '2026-03-29 16:16:24', 0, NULL),
(105, 777, 'Certified Nutrition & Fitness coach with 4+ years of experience. I\'ve helped 158+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Nutrition & Fitness', 'Sharm El Sheikh', 50, 1, 0, 'workout', '249.00', '1499.00', '2026-03-29 16:16:25', '2026-03-29 16:16:25', 0, NULL),
(106, 801, 'Certified Strength & Conditioning coach with 8+ years of experience. I\'ve helped 73+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Strength & Conditioning', 'Hurghada', 50, 1, 0, 'complete', '99.00', '1499.00', '2026-03-29 16:23:40', '2026-03-29 16:23:40', 0, NULL),
(107, 802, 'Certified HIIT & Weight Loss coach with 7+ years of experience. I\'ve helped 99+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'HIIT & Weight Loss', 'Cairo', 50, 1, 0, 'complete', '99.00', '2499.00', '2026-03-29 16:23:40', '2026-03-29 16:23:40', 0, NULL),
(108, 803, 'Certified Yoga & Mobility coach with 6+ years of experience. I\'ve helped 96+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Yoga & Mobility', 'Alexandria', 50, 1, 0, 'complete', '149.00', '1999.00', '2026-03-29 16:23:41', '2026-03-29 16:23:41', 0, NULL),
(109, 804, 'Certified Nutrition & Fitness coach with 7+ years of experience. I\'ve helped 53+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Nutrition & Fitness', 'Luxor', 50, 1, 0, 'complete', '249.00', '1499.00', '2026-03-29 16:23:42', '2026-03-29 16:23:42', 0, NULL),
(110, 828, 'Certified Strength & Conditioning coach with 10+ years of experience. I\'ve helped 160+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Strength & Conditioning', 'Mansoura', 50, 1, 0, 'complete', '149.00', '1499.00', '2026-03-29 16:30:22', '2026-03-29 16:30:22', 0, NULL),
(111, 829, 'Certified HIIT & Weight Loss coach with 7+ years of experience. I\'ve helped 123+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'HIIT & Weight Loss', 'Hurghada', 50, 1, 0, 'workout', '249.00', '1499.00', '2026-03-29 16:30:22', '2026-03-29 16:30:22', 0, NULL),
(112, 830, 'Certified Yoga & Mobility coach with 9+ years of experience. I\'ve helped 170+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Yoga & Mobility', 'Aswan', 50, 1, 0, 'workout', '99.00', '1499.00', '2026-03-29 16:30:23', '2026-03-29 16:30:23', 0, NULL),
(113, 831, 'Certified Nutrition & Fitness coach with 9+ years of experience. I\'ve helped 82+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Nutrition & Fitness', 'Sharm El Sheikh', 50, 1, 0, 'complete', '249.00', '1499.00', '2026-03-29 16:30:24', '2026-03-29 16:30:24', 0, NULL),
(114, 855, 'Certified Strength & Conditioning coach with 5+ years of experience. I\'ve helped 196+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Strength & Conditioning', 'Tanta', 50, 1, 0, 'complete', '249.00', '2499.00', '2026-03-29 16:36:54', '2026-03-29 16:36:54', 0, NULL),
(115, 856, 'Certified HIIT & Weight Loss coach with 6+ years of experience. I\'ve helped 62+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'HIIT & Weight Loss', 'Giza', 50, 1, 0, 'complete', '149.00', '1499.00', '2026-03-29 16:36:54', '2026-03-29 16:36:54', 0, NULL),
(116, 857, 'Certified Yoga & Mobility coach with 8+ years of experience. I\'ve helped 124+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Yoga & Mobility', 'Tanta', 50, 1, 0, 'complete', '199.00', '1499.00', '2026-03-29 16:36:55', '2026-03-29 16:36:55', 0, NULL),
(117, 858, 'Certified Nutrition & Fitness coach with 4+ years of experience. I\'ve helped 185+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Nutrition & Fitness', 'Alexandria', 50, 1, 0, 'complete', '149.00', '1999.00', '2026-03-29 16:36:55', '2026-03-29 16:36:55', 0, NULL),
(118, 882, 'Certified Strength & Conditioning coach with 8+ years of experience. I\'ve helped 87+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Strength & Conditioning', 'Mansoura', 50, 1, 0, 'complete', '99.00', '1499.00', '2026-03-29 16:52:08', '2026-03-29 16:52:08', 0, NULL),
(119, 883, 'Certified HIIT & Weight Loss coach with 5+ years of experience. I\'ve helped 63+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'HIIT & Weight Loss', 'Luxor', 50, 1, 0, 'complete', '149.00', '1999.00', '2026-03-29 16:52:10', '2026-03-29 16:52:10', 0, NULL),
(120, 884, 'Certified Yoga & Mobility coach with 3+ years of experience. I\'ve helped 187+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Yoga & Mobility', 'Aswan', 50, 1, 0, 'complete', '149.00', '2499.00', '2026-03-29 16:52:11', '2026-03-29 16:52:11', 0, NULL),
(121, 885, 'Certified Nutrition & Fitness coach with 6+ years of experience. I\'ve helped 111+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Nutrition & Fitness', 'Cairo', 50, 1, 0, 'complete', '99.00', '2499.00', '2026-03-29 16:52:13', '2026-03-29 16:52:13', 0, NULL),
(122, 909, 'Certified Strength & Conditioning coach with 10+ years of experience. I\'ve helped 123+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Strength & Conditioning', 'Alexandria', 50, 1, 0, 'complete', '99.00', '1099.00', '2026-03-29 18:38:56', '2026-03-30 22:56:51', 1, '2026-04-30 20:56:50'),
(123, 910, 'Certified HIIT & Weight Loss coach with 6+ years of experience. I\'ve helped 162+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'HIIT & Weight Loss', 'Giza', 50, 1, 0, 'complete', '249.00', '2499.00', '2026-03-29 18:38:57', '2026-03-29 18:38:57', 0, NULL),
(124, 911, 'Certified Yoga & Mobility coach with 5+ years of experience. I\'ve helped 88+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Yoga & Mobility', 'Hurghada', 50, 1, 0, 'complete', '149.00', '2499.00', '2026-03-29 18:38:58', '2026-03-29 18:38:58', 0, NULL),
(125, 912, 'Certified Nutrition & Fitness coach with 5+ years of experience. I\'ve helped 62+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Nutrition & Fitness', 'Cairo', 50, 1, 0, 'workout', '99.00', '1499.00', '2026-03-29 18:38:58', '2026-03-29 18:38:58', 0, NULL),
(126, 937, 'Certified Strength & Conditioning coach with 3+ years of experience. I\'ve helped 127+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Strength & Conditioning', 'Aswan', 50, 1, 0, 'complete', '199.00', '999.00', '2026-04-06 11:55:56', '2026-04-06 11:55:56', 0, NULL),
(127, 938, 'Certified HIIT & Weight Loss coach with 5+ years of experience. I\'ve helped 167+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'HIIT & Weight Loss', 'Hurghada', 50, 1, 0, 'workout', '99.00', '1499.00', '2026-04-06 11:55:57', '2026-04-06 11:55:57', 0, NULL),
(128, 939, 'Certified Yoga & Mobility coach with 5+ years of experience. I\'ve helped 59+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Yoga & Mobility', 'Aswan', 50, 1, 0, 'complete', '99.00', '1999.00', '2026-04-06 11:55:58', '2026-04-06 11:55:58', 0, NULL),
(129, 940, 'Certified Nutrition & Fitness coach with 10+ years of experience. I\'ve helped 192+ clients achieve their fitness goals through personalized programming and consistent accountability.', 'Nutrition & Fitness', 'Hurghada', 50, 1, 0, 'complete', '199.00', '999.00', '2026-04-06 11:55:58', '2026-04-06 11:55:58', 0, NULL);

-- --------------------------------------------------------
-- Table: `coach_reports`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `coach_reports`;
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
);

-- --------------------------------------------------------
-- Table: `coach_reviews`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `coach_reviews`;
CREATE TABLE `coach_reviews` (
  `id` int NOT NULL AUTO_INCREMENT,
  `coach_id` int NOT NULL,
  `user_id` int NOT NULL,
  `rating` int NOT NULL,
  `text` text NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

-- --------------------------------------------------------
-- Table: `coach_subscriptions`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `coach_subscriptions`;
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
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `auto_renew` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `coach_id` (`coach_id`),
  CONSTRAINT `coach_subscriptions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `coach_subscriptions_ibfk_2` FOREIGN KEY (`coach_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);

INSERT INTO `coach_subscriptions` (`id`, `user_id`, `coach_id`, `plan_cycle`, `plan_type`, `amount`, `status`, `admin_approval_status`, `coach_decision_status`, `refund_status`, `refunded_at`, `refund_amount`, `refund_reason`, `admin_approved_at`, `coach_decided_at`, `credited_amount`, `credit_released_at`, `payer_wallet_type`, `payer_number`, `payment_method`, `payment_proof`, `started_at`, `expires_at`, `created_at`, `auto_renew`) VALUES
(466, 942, 937, 'monthly', 'workout', '249.00', 'active', 'approved', 'accepted', 'none', NULL, '0.00', NULL, NULL, NULL, '0.00', NULL, NULL, NULL, 'ewallet', NULL, '2026-03-30 13:58:15', '2026-04-25 13:58:15', '2026-04-06 11:58:15', 1),
(467, 943, 938, 'monthly', 'workout', '199.00', 'pending_coach', 'approved', 'pending', 'none', NULL, '0.00', NULL, '2026-04-06 21:58:43', NULL, '0.00', NULL, NULL, NULL, 'vodafone_cash', NULL, '2026-03-29 13:58:16', '2026-04-18 13:58:16', '2026-04-06 11:58:16', 1),
(468, 944, 939, 'yearly', 'complete', '199.00', 'pending_coach', 'approved', 'pending', 'none', NULL, '0.00', NULL, '2026-04-06 21:58:44', NULL, '0.00', NULL, NULL, NULL, 'ewallet', NULL, '2026-03-11 13:58:17', '2026-04-29 13:58:17', '2026-04-06 11:58:17', 1),
(470, 946, 937, 'monthly', 'complete', '149.00', 'pending_coach', 'approved', 'pending', 'none', NULL, '0.00', NULL, '2026-04-06 21:58:45', NULL, '0.00', NULL, NULL, NULL, 'vodafone_cash', NULL, '2026-04-04 13:58:18', '2026-04-15 13:58:18', '2026-04-06 11:58:18', 1),
(471, 947, 938, 'yearly', 'workout', '149.00', 'pending_coach', 'approved', 'pending', 'none', NULL, '0.00', NULL, '2026-04-06 21:58:46', NULL, '0.00', NULL, NULL, NULL, 'paymob_card', NULL, '2026-03-19 13:58:18', '2026-04-24 13:58:18', '2026-04-06 11:58:18', 1),
(472, 948, 939, 'monthly', 'complete', '99.00', 'active', 'approved', 'accepted', 'none', NULL, '0.00', NULL, NULL, NULL, '0.00', NULL, NULL, NULL, 'paymob_card', NULL, '2026-04-04 13:58:19', '2026-04-30 13:58:19', '2026-04-06 11:58:18', 1),
(474, 950, 937, 'monthly', 'workout', '99.00', 'pending_coach', 'approved', 'pending', 'none', NULL, '0.00', NULL, '2026-04-06 21:58:47', NULL, '0.00', NULL, NULL, NULL, 'paymob_card', NULL, '2026-04-05 13:58:20', '2026-04-07 13:58:20', '2026-04-06 11:58:19', 1),
(475, 951, 938, 'monthly', 'complete', '149.00', 'active', 'approved', 'accepted', 'none', NULL, '0.00', NULL, NULL, NULL, '0.00', NULL, NULL, NULL, 'ewallet', NULL, '2026-04-02 13:58:20', '2026-04-10 13:58:20', '2026-04-06 11:58:20', 1),
(476, 952, 939, 'monthly', 'workout', '99.00', 'pending_coach', 'approved', 'pending', 'none', NULL, '0.00', NULL, '2026-04-06 21:58:48', NULL, '0.00', NULL, NULL, NULL, 'paymob_card', NULL, '2026-03-19 13:58:21', '2026-04-08 13:58:21', '2026-04-06 11:58:21', 1),
(478, 954, 937, 'monthly', 'complete', '149.00', 'active', 'approved', 'accepted', 'none', NULL, '0.00', NULL, NULL, NULL, '0.00', NULL, NULL, NULL, 'vodafone_cash', NULL, '2026-03-08 13:58:22', '2026-04-16 13:58:22', '2026-04-06 11:58:21', 1),
(479, 955, 938, 'yearly', 'complete', '199.00', 'pending_coach', 'approved', 'pending', 'none', NULL, '0.00', NULL, '2026-04-06 21:58:49', NULL, '0.00', NULL, NULL, NULL, 'vodafone_cash', NULL, '2026-03-16 13:58:22', '2026-05-06 13:58:22', '2026-04-06 11:58:22', 1),
(480, 941, 937, 'monthly', 'complete', '149.00', 'active', 'approved', 'accepted', 'none', NULL, '0.00', NULL, NULL, NULL, '0.00', NULL, NULL, NULL, 'paymob_card', NULL, '2026-04-06 11:58:23', NULL, '2026-04-06 11:58:23', 1);

-- --------------------------------------------------------
-- Table: `coaching_bookings`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `coaching_bookings`;
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
);

-- --------------------------------------------------------
-- Table: `coaching_meetings`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `coaching_meetings`;
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
);

-- --------------------------------------------------------
-- Table: `credit_transactions`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `credit_transactions`;
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
);

INSERT INTO `credit_transactions` (`id`, `user_id`, `amount`, `type`, `reference_id`, `description`, `created_at`) VALUES
(159, 937, '211.65', 'subscription_earning', NULL, 'Subscription from user #942', '2026-04-06 11:58:16'),
(160, 940, '211.65', 'subscription_earning', NULL, 'Subscription from user #945', '2026-04-06 11:58:17'),
(161, 939, '84.15', 'subscription_earning', NULL, 'Subscription from user #948', '2026-04-06 11:58:19'),
(162, 938, '126.65', 'subscription_earning', NULL, 'Subscription from user #951', '2026-04-06 11:58:20'),
(163, 937, '126.65', 'subscription_earning', NULL, 'Subscription from user #954', '2026-04-06 11:58:22');

-- --------------------------------------------------------
-- Table: `daily_summaries`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `daily_summaries`;
CREATE TABLE `daily_summaries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `date` varchar(20) NOT NULL,
  `steps` int NOT NULL,
  `ai_analysis` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `daily_summaries_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
);

-- --------------------------------------------------------
-- Table: `email_accounts`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `email_accounts`;
CREATE TABLE `email_accounts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `display_name` varchar(255) NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
);

-- --------------------------------------------------------
-- Table: `email_settings`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `email_settings`;
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
);

INSERT INTO `email_settings` (`id`, `smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`, `smtp_secure`, `from_name`, `from_email`, `enabled`, `updated_at`) VALUES
(1, '', 587, '', '', 'starttls', '', '', 0, '2026-03-15 02:04:01');

-- --------------------------------------------------------
-- Table: `emails`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `emails`;
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
);

-- --------------------------------------------------------
-- Table: `gifts`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `gifts`;
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
);

-- --------------------------------------------------------
-- Table: `meeting_files`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `meeting_files`;
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
);

-- --------------------------------------------------------
-- Table: `meeting_messages`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `meeting_messages`;
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
);

-- --------------------------------------------------------
-- Table: `messages`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `messages`;
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
);

INSERT INTO `messages` (`id`, `sender_id`, `receiver_id`, `group_id`, `challenge_id`, `content`, `media_url`, `created_at`) VALUES
(1303, 942, 937, NULL, NULL, 'Hi Coach! I just subscribed. When do we start?', NULL, '2026-03-30 13:58:23'),
(1304, 937, 942, NULL, NULL, 'Welcome! Let\'s begin with an assessment. What are your main goals?', NULL, '2026-03-31 01:58:24'),
(1305, 942, 937, NULL, NULL, 'Mainly lose weight and build some muscle.', NULL, '2026-03-31 13:58:24'),
(1306, 937, 942, NULL, NULL, 'Perfect! I\'ll design a customized program. Do you have any injuries?', NULL, '2026-04-01 01:58:25'),
(1307, 942, 937, NULL, NULL, 'No injuries. Ready to work hard!', NULL, '2026-04-01 13:58:25'),
(1308, 937, 942, NULL, NULL, 'Great! Check your workout plan — I\'ve added Week 1.', NULL, '2026-04-02 01:58:25'),
(1309, 943, 938, NULL, NULL, 'Coach, I struggled with squats today. Any form tips?', NULL, '2026-03-30 13:58:26'),
(1310, 938, 943, NULL, NULL, 'Keep your chest up and push your knees out. Slow the descent.', NULL, '2026-03-31 01:58:26'),
(1311, 943, 938, NULL, NULL, 'Should I go lighter?', NULL, '2026-03-31 13:58:26'),
(1312, 938, 943, NULL, NULL, 'Yes, master the form first. We add weight next week.', NULL, '2026-04-01 01:58:27'),
(1313, 944, 939, NULL, NULL, 'I hit a plateau. Scale hasn\'t moved in 2 weeks.', NULL, '2026-03-30 13:58:27'),
(1314, 939, 944, NULL, NULL, 'That\'s normal. Let\'s cycle your calories — more on training days.', NULL, '2026-03-31 01:58:28'),
(1315, 944, 939, NULL, NULL, 'How much more?', NULL, '2026-03-31 13:58:28'),
(1316, 939, 944, NULL, NULL, 'Add 200 calories on your 3 training days. Same on rest days.', NULL, '2026-04-01 01:58:29'),
(1321, 946, 937, NULL, NULL, 'Hi Coach! I just subscribed. When do we start?', NULL, '2026-03-30 13:58:30'),
(1322, 937, 946, NULL, NULL, 'Welcome! Let\'s begin with an assessment. What are your main goals?', NULL, '2026-03-31 01:58:30'),
(1323, 946, 937, NULL, NULL, 'Mainly lose weight and build some muscle.', NULL, '2026-03-31 13:58:31'),
(1324, 937, 946, NULL, NULL, 'Perfect! I\'ll design a customized program. Do you have any injuries?', NULL, '2026-04-01 01:58:31'),
(1325, 946, 937, NULL, NULL, 'No injuries. Ready to work hard!', NULL, '2026-04-01 13:58:31'),
(1326, 937, 946, NULL, NULL, 'Great! Check your workout plan — I\'ve added Week 1.', NULL, '2026-04-02 01:58:32'),
(1327, 947, 938, NULL, NULL, 'Coach, I struggled with squats today. Any form tips?', NULL, '2026-03-30 13:58:32'),
(1328, 938, 947, NULL, NULL, 'Keep your chest up and push your knees out. Slow the descent.', NULL, '2026-03-31 01:58:32'),
(1329, 947, 938, NULL, NULL, 'Should I go lighter?', NULL, '2026-03-31 13:58:32'),
(1330, 938, 947, NULL, NULL, 'Yes, master the form first. We add weight next week.', NULL, '2026-04-01 01:58:33'),
(1331, 948, 939, NULL, NULL, 'I hit a plateau. Scale hasn\'t moved in 2 weeks.', NULL, '2026-03-30 13:58:33'),
(1332, 939, 948, NULL, NULL, 'That\'s normal. Let\'s cycle your calories — more on training days.', NULL, '2026-03-31 01:58:33'),
(1333, 948, 939, NULL, NULL, 'How much more?', NULL, '2026-03-31 13:58:34'),
(1334, 939, 948, NULL, NULL, 'Add 200 calories on your 3 training days. Same on rest days.', NULL, '2026-04-01 01:58:34'),
(1339, 941, 937, NULL, NULL, 'Hi! I\'m ready to start my coaching journey.', NULL, '2026-04-06 11:58:35'),
(1340, 937, 941, NULL, NULL, 'Welcome! Let me review your profile and create your plan.', NULL, '2026-04-06 11:58:36'),
(1341, 941, 937, NULL, NULL, 'That sounds great! Should I start with cardio or weights?', NULL, '2026-04-06 11:58:36'),
(1342, 937, 941, NULL, NULL, 'Let\'s start with 3 days of strength training. I\'ve added your first workout.', NULL, '2026-04-06 11:58:36'),
(1343, 941, 937, NULL, NULL, 'Done with Week 1! It was tough but I made it through 💪', NULL, '2026-04-06 11:58:37'),
(1344, 937, 941, NULL, NULL, 'Excellent! Your consistency is impressive. Week 2 is ready.', NULL, '2026-04-06 11:58:37');

-- --------------------------------------------------------
-- Table: `notifications`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `type` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `body` text,
  `link` varchar(255) DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
);

INSERT INTO `notifications` (`id`, `user_id`, `type`, `title`, `body`, `link`, `is_read`, `created_at`) VALUES
(1, 95, 'subscription', 'New Subscription Request', 'A user paid and requested to subscribe to you. Please accept or decline from Requests.', NULL, 0, '2026-03-23 05:16:47'),
(2, 112, 'subscription', 'Payment Verified', 'Admin verified your payment. Waiting for coach acceptance.', NULL, 0, '2026-03-23 05:16:48'),
(3, 96, 'subscription', 'New Subscription Request', 'A user paid and requested to subscribe to you. Please accept or decline from Requests.', NULL, 0, '2026-03-23 05:17:05'),
(4, 109, 'subscription', 'Payment Verified', 'Admin verified your payment. Waiting for coach acceptance.', NULL, 0, '2026-03-23 05:17:05'),
(5, 96, 'withdrawal', 'Withdrawal Approved! ✅', 'Your withdrawal of 797.00 EGP has been approved.', NULL, 0, '2026-03-23 05:17:25'),
(6, 97, 'withdrawal', 'Withdrawal Approved! ✅', 'Your withdrawal of 558.00 EGP has been approved.', NULL, 0, '2026-03-23 05:17:50'),
(7, 909, 'certification', '✅ Certified Coach Activated!', 'You are now a Certified Coach until 4/30/2026. The badge is visible to all users.', '/coach/profile', 1, '2026-03-30 22:56:52'),
(8, 910, 'subscription', 'New Subscription Request', 'A user paid and requested to subscribe to you. Please accept or decline from Requests.', NULL, 0, '2026-04-05 18:12:46'),
(9, 927, 'subscription', 'Payment Verified', 'Admin verified your payment. Waiting for coach acceptance.', NULL, 0, '2026-04-05 18:12:47'),
(10, 911, 'subscription', 'New Subscription Request', 'A user paid and requested to subscribe to you. Please accept or decline from Requests.', NULL, 0, '2026-04-05 18:12:50'),
(11, 924, 'subscription', 'Payment Verified', 'Admin verified your payment. Waiting for coach acceptance.', NULL, 0, '2026-04-05 18:12:50'),
(12, 912, 'subscription', 'New Subscription Request', 'A user paid and requested to subscribe to you. Please accept or decline from Requests.', NULL, 0, '2026-04-05 18:12:54'),
(14, 909, 'subscription', 'New Subscription Request', 'A user paid and requested to subscribe to you. Please accept or decline from Requests.', NULL, 0, '2026-04-05 18:12:58'),
(15, 922, 'subscription', 'Payment Verified', 'Admin verified your payment. Waiting for coach acceptance.', NULL, 0, '2026-04-05 18:12:58'),
(16, 912, 'subscription', 'New Subscription Request', 'A user paid and requested to subscribe to you. Please accept or decline from Requests.', NULL, 0, '2026-04-05 18:13:02'),
(18, 909, 'subscription', 'New Subscription Request', 'A user paid and requested to subscribe to you. Please accept or decline from Requests.', NULL, 0, '2026-04-05 18:13:05'),
(19, 918, 'subscription', 'Payment Verified', 'Admin verified your payment. Waiting for coach acceptance.', NULL, 0, '2026-04-05 18:13:05'),
(20, 910, 'subscription', 'New Subscription Request', 'A user paid and requested to subscribe to you. Please accept or decline from Requests.', NULL, 0, '2026-04-05 18:13:31'),
(21, 919, 'subscription', 'Payment Verified', 'Admin verified your payment. Waiting for coach acceptance.', NULL, 0, '2026-04-05 18:13:31'),
(22, 910, 'subscription', 'New Subscription Request', 'A user paid and requested to subscribe to you. Please accept or decline from Requests.', NULL, 0, '2026-04-05 18:13:36'),
(23, 915, 'subscription', 'Payment Verified', 'Admin verified your payment. Waiting for coach acceptance.', NULL, 0, '2026-04-05 18:13:36'),
(24, 911, 'subscription', 'New Subscription Request', 'A user paid and requested to subscribe to you. Please accept or decline from Requests.', NULL, 0, '2026-04-05 18:13:39'),
(25, 916, 'subscription', 'Payment Verified', 'Admin verified your payment. Waiting for coach acceptance.', NULL, 0, '2026-04-05 18:13:39'),
(26, 908, 'info', '🔔 FitWay Hub Test', 'Push notifications are working correctly!', '/', 1, '2026-04-05 22:44:36'),
(27, 938, 'subscription', 'New Subscription Request', 'A user paid and requested to subscribe to you. Please accept or decline from Requests.', NULL, 0, '2026-04-06 21:58:44'),
(28, 943, 'subscription', 'Payment Verified', 'Admin verified your payment. Waiting for coach acceptance.', NULL, 0, '2026-04-06 21:58:44'),
(29, 939, 'subscription', 'New Subscription Request', 'A user paid and requested to subscribe to you. Please accept or decline from Requests.', NULL, 0, '2026-04-06 21:58:44'),
(30, 944, 'subscription', 'Payment Verified', 'Admin verified your payment. Waiting for coach acceptance.', NULL, 0, '2026-04-06 21:58:45'),
(31, 937, 'subscription', 'New Subscription Request', 'A user paid and requested to subscribe to you. Please accept or decline from Requests.', NULL, 0, '2026-04-06 21:58:45'),
(32, 946, 'subscription', 'Payment Verified', 'Admin verified your payment. Waiting for coach acceptance.', NULL, 0, '2026-04-06 21:58:46'),
(33, 938, 'subscription', 'New Subscription Request', 'A user paid and requested to subscribe to you. Please accept or decline from Requests.', NULL, 0, '2026-04-06 21:58:46'),
(34, 947, 'subscription', 'Payment Verified', 'Admin verified your payment. Waiting for coach acceptance.', NULL, 0, '2026-04-06 21:58:47'),
(35, 937, 'subscription', 'New Subscription Request', 'A user paid and requested to subscribe to you. Please accept or decline from Requests.', NULL, 0, '2026-04-06 21:58:47'),
(36, 950, 'subscription', 'Payment Verified', 'Admin verified your payment. Waiting for coach acceptance.', NULL, 0, '2026-04-06 21:58:47'),
(37, 939, 'subscription', 'New Subscription Request', 'A user paid and requested to subscribe to you. Please accept or decline from Requests.', NULL, 0, '2026-04-06 21:58:48'),
(38, 952, 'subscription', 'Payment Verified', 'Admin verified your payment. Waiting for coach acceptance.', NULL, 0, '2026-04-06 21:58:48'),
(39, 938, 'subscription', 'New Subscription Request', 'A user paid and requested to subscribe to you. Please accept or decline from Requests.', NULL, 0, '2026-04-06 21:58:49'),
(40, 955, 'subscription', 'Payment Verified', 'Admin verified your payment. Waiting for coach acceptance.', NULL, 0, '2026-04-06 21:58:49'),
(41, 951, 'subscription_renewal_failed', '⚠️ Subscription Renewal Failed', 'Your subscription to Coach Sara Fitness could not be renewed. Insufficient credit (need 99 EGP). Please top up or renew manually.', '/app/coaching', 0, '2026-04-09 14:26:58'),
(42, 951, 'subscription_renewal_failed', '⚠️ Subscription Renewal Failed', 'Your subscription to Coach Sara Fitness could not be renewed. Insufficient credit (need 99 EGP). Please top up or renew manually.', '/app/coaching', 0, '2026-04-09 15:26:58'),
(43, 951, 'subscription_renewal_failed', '⚠️ Subscription Renewal Failed', 'Your subscription to Coach Sara Fitness could not be renewed. Insufficient credit (need 99 EGP). Please top up or renew manually.', '/app/coaching', 0, '2026-04-09 16:26:58'),
(44, 951, 'subscription_renewal_failed', '⚠️ Subscription Renewal Failed', 'Your subscription to Coach Sara Fitness could not be renewed. Insufficient credit (need 99 EGP). Please top up or renew manually.', '/app/coaching', 0, '2026-04-09 17:26:58'),
(45, 951, 'subscription_renewal_failed', '⚠️ Subscription Renewal Failed', 'Your subscription to Coach Sara Fitness could not be renewed. Insufficient credit (need 99 EGP). Please top up or renew manually.', '/app/coaching', 0, '2026-04-10 07:04:07'),
(46, 951, 'subscription_renewal_failed', '⚠️ Subscription Renewal Failed', 'Your subscription to Coach Sara Fitness could not be renewed. Insufficient credit (need 99 EGP). Please top up or renew manually.', '/app/coaching', 0, '2026-04-10 08:03:40'),
(47, 951, 'subscription_renewal_failed', '⚠️ Subscription Renewal Failed', 'Your subscription to Coach Sara Fitness could not be renewed. Insufficient credit (need 99 EGP). Please top up or renew manually.', '/app/coaching', 0, '2026-04-10 08:13:29'),
(48, 951, 'subscription_renewal_failed', '⚠️ Subscription Renewal Failed', 'Your subscription to Coach Sara Fitness could not be renewed. Insufficient credit (need 99 EGP). Please top up or renew manually.', '/app/coaching', 0, '2026-04-10 08:35:06'),
(49, 951, 'subscription_renewal_failed', '⚠️ Subscription Renewal Failed', 'Your subscription to Coach Sara Fitness could not be renewed. Insufficient credit (need 99 EGP). Please top up or renew manually.', '/app/coaching', 0, '2026-04-10 09:34:36'),
(50, 951, 'subscription_renewal_failed', '⚠️ Subscription Renewal Failed', 'Your subscription to Coach Sara Fitness could not be renewed. Insufficient credit (need 99 EGP). Please top up or renew manually.', '/app/coaching', 0, '2026-04-10 10:34:37'),
(51, 951, 'subscription_renewal_failed', '⚠️ Subscription Renewal Failed', 'Your subscription to Coach Sara Fitness could not be renewed. Insufficient credit (need 99 EGP). Please top up or renew manually.', '/app/coaching', 0, '2026-04-10 12:15:07'),
(52, 951, 'subscription_renewal_failed', '⚠️ Subscription Renewal Failed', 'Your subscription to Coach Sara Fitness could not be renewed. Insufficient credit (need 99 EGP). Please top up or renew manually.', '/app/coaching', 0, '2026-04-10 13:14:37'),
(53, 951, 'subscription_renewal_failed', '⚠️ Subscription Renewal Failed', 'Your subscription to Coach Sara Fitness could not be renewed. Insufficient credit (need 99 EGP). Please top up or renew manually.', '/app/coaching', 0, '2026-04-10 13:23:30'),
(54, 942, 'subscription_renewal_failed', '⚠️ Subscription Renewal Failed', 'Your subscription to Coach Ali Mahmoud could not be renewed. Insufficient credit (need 199 EGP). Please top up or renew manually.', '/app/coaching', 0, '2026-04-24 19:10:11'),
(55, 942, 'subscription_renewal_failed', '⚠️ Subscription Renewal Failed', 'Your subscription to Coach Ali Mahmoud could not be renewed. Insufficient credit (need 199 EGP). Please top up or renew manually.', '/app/coaching', 0, '2026-04-24 20:09:41'),
(56, 942, 'subscription_renewal_failed', '⚠️ Subscription Renewal Failed', 'Your subscription to Coach Ali Mahmoud could not be renewed. Insufficient credit (need 199 EGP). Please top up or renew manually.', '/app/coaching', 0, '2026-04-24 21:09:41'),
(57, 942, 'subscription_renewal_failed', '⚠️ Subscription Renewal Failed', 'Your subscription to Coach Ali Mahmoud could not be renewed. Insufficient credit (need 199 EGP). Please top up or renew manually.', '/app/coaching', 0, '2026-04-25 13:08:31'),
(58, 963, 'info', 'You missed yesterday\'s workout.', 'Ready to get back? Your progress is waiting — even a quick session counts.', '/', 1, '2026-04-28 21:48:29'),
(59, 963, 'inactive_1_day', 'You missed yesterday\'s workout.', 'Ready to get back? Your progress is waiting — even a quick session counts.', '/app/workouts', 0, '2026-05-01 15:18:25'),
(60, 963, 'inactive_3_days', 'Your progress is waiting. 📈', 'Jump back into training today. 3 days away is nothing — let\'s restart strong.', '/app/workouts', 0, '2026-05-02 10:19:36');

-- --------------------------------------------------------
-- Table: `nutrition_plans`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `nutrition_plans`;
CREATE TABLE `nutrition_plans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `coach_id` int DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `daily_calories` int DEFAULT '2000',
  `protein_g` int DEFAULT '150',
  `carbs_g` int DEFAULT '250',
  `fat_g` int DEFAULT '65',
  `meals` json DEFAULT NULL,
  `notes` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `nutrition_plans_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
);

-- --------------------------------------------------------
-- Table: `payment_settings`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `payment_settings`;
CREATE TABLE `payment_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
);

INSERT INTO `payment_settings` (`id`, `setting_key`, `setting_value`, `updated_at`) VALUES
(1, 'paypal_user_client_id', '', '2026-04-06 11:49:38'),
(2, 'paypal_user_secret', '', '2026-04-06 11:49:38'),
(3, 'paypal_coach_client_id', '', '2026-04-06 11:49:38'),
(4, 'paypal_coach_secret', '', '2026-04-06 11:49:39'),
(5, 'ewallet_phone_vodafone', '', '2026-04-06 11:49:40'),
(6, 'ewallet_phone_orange', '', '2026-04-06 11:49:40'),
(7, 'ewallet_phone_we', '', '2026-04-06 11:49:40'),
(8, 'paypal_mode', 'sandbox', '2026-04-06 11:49:39'),
(9, 'coach_cut_percentage', '90', '2026-04-06 11:49:48'),
(10, 'pm_orange_cash', '1', '2026-04-06 11:49:44'),
(11, 'pm_vodafone_cash', '1', '2026-04-06 11:49:44'),
(12, 'pm_we_pay', '1', '2026-04-06 11:49:44'),
(13, 'pm_paypal', '0', '2026-04-06 11:49:45'),
(14, 'pm_credit_card', '1', '2026-04-06 11:49:45'),
(15, 'pm_google_pay', '0', '2026-04-06 11:49:45'),
(16, 'pm_apple_pay', '0', '2026-04-06 11:49:46'),
(17, 'google_play_enabled', '0', '2026-04-06 11:49:46'),
(18, 'google_play_product_id_monthly', '', '2026-04-06 11:49:46'),
(19, 'google_play_product_id_annual', '', '2026-04-06 11:49:46'),
(20, 'apple_pay_enabled', '0', '2026-04-06 11:49:47'),
(21, 'apple_pay_product_id_monthly', '', '2026-04-06 11:49:47'),
(22, 'apple_pay_product_id_annual', '', '2026-04-06 11:49:47'),
(485, 'server_url', 'https://peter-adel.taila6a2b4.ts.net', '2026-03-30 13:05:02'),
(581, 'paypal_webhook_id', '', '2026-04-06 11:49:39'),
(585, 'paymob_api_key', '', '2026-04-06 11:49:40'),
(586, 'paymob_integration_id_card', '', '2026-04-06 11:49:41'),
(587, 'paymob_integration_id_wallet', '', '2026-04-06 11:49:41'),
(588, 'paymob_iframe_id', '', '2026-04-06 11:49:41'),
(589, 'paymob_hmac_secret', '', '2026-04-06 11:49:42'),
(590, 'paymob_disbursement_api_key', '', '2026-04-06 11:49:42'),
(591, 'fawry_merchant_code', '', '2026-04-06 11:49:42'),
(592, 'fawry_merchant_ref_number', '', '2026-04-06 11:49:42'),
(593, 'paymob_auto_enabled', '0', '2026-04-06 11:49:43'),
(594, 'paymob_manual_enabled', '0', '2026-04-06 11:49:43'),
(595, 'fawry_auto_enabled', '0', '2026-04-06 11:49:43'),
(596, 'fawry_manual_enabled', '0', '2026-04-06 11:49:44'),
(611, 'egp_usd_rate', '', '2026-04-06 11:49:48');

-- --------------------------------------------------------
-- Table: `payments`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `payments`;
CREATE TABLE `payments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `type` varchar(50) NOT NULL,
  `plan` varchar(50) NOT NULL,
  `amount` float NOT NULL,
  `payment_method` varchar(50) DEFAULT 'card',
  `card_last4` varchar(10) DEFAULT NULL,
  `card_name` varchar(255) DEFAULT NULL,
  `transaction_id` varchar(255) DEFAULT NULL,
  `proof_url` varchar(500) DEFAULT NULL,
  `wallet_type` varchar(50) DEFAULT NULL,
  `sender_number` varchar(30) DEFAULT NULL,
  `status` varchar(20) DEFAULT 'completed',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

INSERT INTO `payments` (`id`, `user_id`, `type`, `plan`, `amount`, `payment_method`, `card_last4`, `card_name`, `transaction_id`, `proof_url`, `wallet_type`, `sender_number`, `status`, `created_at`) VALUES
(249, 942, 'premium', 'monthly', 50, 'orange_cash', NULL, NULL, NULL, NULL, NULL, NULL, 'completed', '2026-03-05 13:58:12'),
(251, 948, 'premium', 'monthly', 50, 'paymob_card', NULL, NULL, NULL, NULL, NULL, NULL, 'completed', '2026-02-17 13:58:13'),
(252, 951, 'premium', 'monthly', 50, 'paypal', NULL, NULL, NULL, NULL, NULL, NULL, 'completed', '2026-02-21 13:58:13'),
(253, 954, 'premium', 'monthly', 50, 'paypal', NULL, NULL, NULL, NULL, NULL, NULL, 'completed', '2026-03-16 13:58:13'),
(255, 960, 'premium', 'monthly', 50, 'paypal', NULL, NULL, NULL, NULL, NULL, NULL, 'completed', '2026-03-19 13:58:14'),
(256, 941, 'premium', 'monthly', 50, 'paymob_card', NULL, NULL, NULL, NULL, NULL, NULL, 'completed', '2026-04-06 11:58:14');

-- --------------------------------------------------------
-- Table: `paymob_transactions`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `paymob_transactions`;
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
);

-- --------------------------------------------------------
-- Table: `playlist_videos`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `playlist_videos`;
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
);

-- --------------------------------------------------------
-- Table: `point_transactions`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `point_transactions`;
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
);

INSERT INTO `point_transactions` (`id`, `user_id`, `points`, `reason`, `reference_type`, `reference_id`, `created_at`) VALUES
(1, 24, 200, 'Welcome gift - registration bonus', 'registration', NULL, '2026-03-15 14:18:13'),
(2, 54, 200, 'Welcome gift - registration bonus', 'registration', NULL, '2026-03-16 08:46:47'),
(3, 55, 200, 'Welcome gift - google signup', 'registration', NULL, '2026-03-16 09:30:04'),
(4, 79, 200, 'Welcome gift - registration bonus', 'registration', NULL, '2026-03-16 20:58:11'),
(5, 80, 200, 'Welcome gift - registration bonus', 'registration', NULL, '2026-03-16 21:12:53'),
(6, 86, 200, 'Welcome gift - registration bonus', 'registration', NULL, '2026-03-16 22:12:34'),
(7, 87, 200, 'Welcome gift - registration bonus', 'registration', NULL, '2026-03-23 02:20:18'),
(8, 935, 200, 'Welcome gift - registration bonus', 'registration', NULL, '2026-04-04 18:28:21'),
(9, 963, 200, 'Welcome gift - registration bonus', 'registration', NULL, '2026-04-24 19:29:34');

-- --------------------------------------------------------
-- Table: `post_comments`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `post_comments`;
CREATE TABLE `post_comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `post_id` int NOT NULL,
  `user_id` int NOT NULL,
  `content` text NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `post_id` (`post_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `post_comments_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`),
  CONSTRAINT `post_comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
);

INSERT INTO `post_comments` (`id`, `post_id`, `user_id`, `content`, `created_at`) VALUES
(1857, 1670, 943, 'What program are you on?', '2026-03-31 13:57:53'),
(1858, 1671, 960, 'Goals! 🎯', '2026-04-06 13:57:54'),
(1859, 1672, 937, 'Goals! 🎯', '2026-04-04 13:57:54'),
(1860, 1672, 939, 'How long did it take you?', '2026-04-03 13:57:54'),
(1862, 1674, 948, 'How long did it take you?', '2026-04-02 13:57:55'),
(1864, 1674, 938, 'You\'re crushing it 💪', '2026-03-30 13:57:55'),
(1865, 1674, 942, 'This is so inspiring!', '2026-04-06 13:57:56'),
(1866, 1674, 958, 'This is so inspiring!', '2026-03-31 13:57:56'),
(1867, 1675, 944, 'Goals! 🎯', '2026-04-04 13:57:56'),
(1868, 1676, 952, 'Keep it up! 🔥', '2026-03-27 13:57:57'),
(1869, 1676, 960, 'I needed this motivation today, thanks!', '2026-04-06 13:57:57'),
(1870, 1676, 937, 'Same here! The consistency is key.', '2026-03-28 13:57:57'),
(1874, 1678, 947, 'Proud of you!', '2026-03-31 13:57:58'),
(1875, 1678, 959, 'I felt that 😂', '2026-04-05 13:57:59'),
(1876, 1678, 947, 'This is so inspiring!', '2026-04-02 13:57:59'),
(1877, 1679, 943, 'What program are you on?', '2026-04-03 13:57:59'),
(1878, 1679, 938, 'You\'re crushing it 💪', '2026-04-03 13:58:00'),
(1879, 1680, 939, 'Keep it up! 🔥', '2026-04-03 13:58:00'),
(1880, 1680, 938, 'Amazing progress!', '2026-04-06 13:58:00'),
(1881, 1680, 956, 'Let\'s go! 🚀', '2026-03-28 13:58:00'),
(1882, 1681, 938, 'Proud of you!', '2026-03-27 13:58:01'),
(1884, 1681, 939, 'Goals! 🎯', '2026-04-04 13:58:01'),
(1886, 1682, 948, 'Keep grinding!', '2026-03-30 13:58:02'),
(1887, 1682, 946, 'This community is everything ❤️', '2026-03-30 13:58:02'),
(1888, 1682, 960, 'I felt that 😂', '2026-04-04 13:58:03'),
(1890, 1683, 960, 'You\'re crushing it 💪', '2026-04-03 13:58:03'),
(1891, 1683, 950, 'Proud of you!', '2026-04-02 13:58:03'),
(1893, 1683, 943, 'This is so inspiring!', '2026-03-31 13:58:04'),
(1894, 1683, 940, 'Amazing progress!', '2026-03-28 13:58:04'),
(1896, 1684, 959, 'Keep grinding!', '2026-04-02 13:58:05'),
(1898, 1684, 946, 'Keep it up! 🔥', '2026-03-28 13:58:06'),
(1899, 1685, 937, 'You\'re crushing it 💪', '2026-03-28 13:58:06'),
(1900, 1685, 942, 'Let\'s go! 🚀', '2026-04-04 13:58:06'),
(1901, 1686, 944, 'This community is everything ❤️', '2026-03-28 13:58:06'),
(1902, 1686, 938, 'Keep it up! 🔥', '2026-04-06 13:58:07'),
(1903, 1686, 950, 'I felt that 😂', '2026-03-30 13:58:07'),
(1904, 1686, 948, 'Proud of you!', '2026-04-01 13:58:07'),
(1905, 1686, 947, 'Amazing progress!', '2026-04-03 13:58:08'),
(1908, 1688, 950, 'Proud of you!', '2026-03-31 13:58:09'),
(1909, 1688, 948, 'Let\'s go! 🚀', '2026-03-28 13:58:09'),
(1911, 1688, 944, 'This is so inspiring!', '2026-03-27 13:58:09'),
(1912, 1689, 944, 'I needed this motivation today, thanks!', '2026-03-27 13:58:10'),
(1913, 1689, 960, 'I needed this motivation today, thanks!', '2026-03-29 13:58:10'),
(1915, 1689, 960, 'I felt that 😂', '2026-04-03 13:58:11'),
(1916, 1689, 955, 'I needed this motivation today, thanks!', '2026-04-02 13:58:11');

-- --------------------------------------------------------
-- Table: `post_likes`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `post_likes`;
CREATE TABLE `post_likes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `post_id` int NOT NULL,
  `user_id` int NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_post_user` (`post_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `post_likes_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`),
  CONSTRAINT `post_likes_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
);

-- --------------------------------------------------------
-- Table: `posts`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `posts`;
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
);

INSERT INTO `posts` (`id`, `user_id`, `content`, `media_url`, `hashtags`, `likes`, `is_hidden`, `moderated_by`, `moderation_reason`, `is_announcement`, `is_pinned`, `created_at`) VALUES
(1670, 942, 'Just crushed a new personal record today 💪 Hard work pays off!', NULL, '#fitness #fitwayhub #health', 55, 0, NULL, NULL, 0, 0, '2026-03-20 13:57:37'),
(1671, 942, 'Morning workout done before sunrise. This is the lifestyle 🌅', NULL, '#fitness #fitwayhub #health', 51, 0, NULL, NULL, 0, 0, '2026-03-17 13:57:37'),
(1672, 942, 'Week 3 of my program and I can already see the changes! @FitWayHub', NULL, '#fitness #fitwayhub #health', 57, 0, NULL, NULL, 0, 0, '2026-03-07 13:57:38'),
(1673, 943, 'Morning workout done before sunrise. This is the lifestyle 🌅', NULL, '#fitness #fitwayhub #health', 17, 0, NULL, NULL, 0, 0, '2026-03-29 13:57:38'),
(1674, 944, 'Anyone else addicted to the post-workout feeling? Best natural high.', NULL, '#fitness #fitwayhub #health', 24, 0, NULL, NULL, 0, 0, '2026-03-14 13:57:38'),
(1675, 944, 'Meal prepped for the whole week 🍱 Preparation is key to success.', NULL, '#fitness #fitwayhub #health', 49, 0, NULL, NULL, 0, 0, '2026-03-20 13:57:38'),
(1678, 946, 'Consistency > intensity. Show up even when you don\'t feel like it.', NULL, '#fitness #fitwayhub #health', 53, 0, NULL, NULL, 0, 0, '2026-04-02 13:57:39'),
(1679, 946, 'New program starting tomorrow. Nervous and excited 🔥', NULL, '#fitness #fitwayhub #health', 7, 0, NULL, NULL, 0, 0, '2026-03-12 13:57:40'),
(1680, 947, 'My coach changed my life. I\'ve lost 12kg in 3 months!', NULL, '#fitness #fitwayhub #health', 13, 0, NULL, NULL, 0, 0, '2026-04-05 13:57:40'),
(1681, 947, 'The gym is my therapy 💙 Whatever is going on outside — in here I\'m free.', NULL, '#fitness #fitwayhub #health', 6, 0, NULL, NULL, 0, 0, '2026-03-28 13:57:40'),
(1682, 948, 'My friend laughed when I joined FitWay. Now she\'s asking me for advice 😏', NULL, '#fitness #fitwayhub #health', 24, 0, NULL, NULL, 0, 0, '2026-03-18 13:57:40'),
(1683, 948, 'Progress photo update: still a long way to go but I\'m proud of how far I\'ve come.', NULL, '#fitness #fitwayhub #health', 25, 0, NULL, NULL, 0, 0, '2026-03-16 13:57:41'),
(1684, 948, 'Just crushed a new personal record today 💪 Hard work pays off!', NULL, '#fitness #fitwayhub #health', 40, 0, NULL, NULL, 0, 0, '2026-03-18 13:57:41'),
(1686, 950, 'Anyone else addicted to the post-workout feeling? Best natural high.', NULL, '#fitness #fitwayhub #health', 32, 0, NULL, NULL, 0, 0, '2026-03-12 13:57:42'),
(1687, 950, 'Meal prepped for the whole week 🍱 Preparation is key to success.', NULL, '#fitness #fitwayhub #health', 28, 0, NULL, NULL, 0, 0, '2026-04-03 13:57:42'),
(1688, 950, 'Hit 10,000 steps before noon! That\'s a new record for me 🏃', NULL, '#fitness #fitwayhub #health', 17, 0, NULL, NULL, 0, 0, '2026-03-14 13:57:42'),
(1689, 951, 'My friend laughed when I joined FitWay. Now she\'s asking me for advice 😏', NULL, '#fitness #fitwayhub #health', 19, 0, NULL, NULL, 0, 0, '2026-03-29 13:57:43'),
(1690, 951, 'Progress photo update: still a long way to go but I\'m proud of how far I\'ve come.', NULL, '#fitness #fitwayhub #health', 55, 0, NULL, NULL, 0, 0, '2026-04-03 13:57:43'),
(1691, 952, 'My coach changed my life. I\'ve lost 12kg in 3 months!', NULL, '#fitness #fitwayhub #health', 44, 0, NULL, NULL, 0, 0, '2026-03-25 13:57:43'),
(1692, 952, 'The gym is my therapy 💙 Whatever is going on outside — in here I\'m free.', NULL, '#fitness #fitwayhub #health', 40, 0, NULL, NULL, 0, 0, '2026-03-30 13:57:43'),
(1693, 952, 'Down 5kg in 6 weeks. Slow and steady wins the race 🐢', NULL, '#fitness #fitwayhub #health', 20, 0, NULL, NULL, 0, 0, '2026-03-28 13:57:44'),
(1696, 954, 'Never miss a Monday. Never. 💯', NULL, '#fitness #fitwayhub #health', 16, 0, NULL, NULL, 0, 0, '2026-04-03 13:57:45'),
(1697, 954, 'Ate clean for 30 days and the difference is unbelievable ✨', NULL, '#fitness #fitwayhub #health', 3, 0, NULL, NULL, 0, 0, '2026-03-25 13:57:45'),
(1698, 954, 'My friend laughed when I joined FitWay. Now she\'s asking me for advice 😏', NULL, '#fitness #fitwayhub #health', 59, 0, NULL, NULL, 0, 0, '2026-03-20 13:57:45'),
(1699, 955, 'Progress photo update: still a long way to go but I\'m proud of how far I\'ve come.', NULL, '#fitness #fitwayhub #health', 36, 0, NULL, NULL, 0, 0, '2026-03-16 13:57:46'),
(1700, 955, 'Just crushed a new personal record today 💪 Hard work pays off!', NULL, '#fitness #fitwayhub #health', 8, 0, NULL, NULL, 0, 0, '2026-03-26 13:57:46'),
(1701, 955, 'Morning workout done before sunrise. This is the lifestyle 🌅', NULL, '#fitness #fitwayhub #health', 6, 0, NULL, NULL, 0, 0, '2026-03-24 13:57:46'),
(1702, 956, 'Consistency > intensity. Show up even when you don\'t feel like it.', NULL, '#fitness #fitwayhub #health', 30, 0, NULL, NULL, 0, 0, '2026-03-12 13:57:46'),
(1703, 956, 'New program starting tomorrow. Nervous and excited 🔥', NULL, '#fitness #fitwayhub #health', 38, 0, NULL, NULL, 0, 0, '2026-03-22 13:57:47'),
(1707, 958, 'Down 5kg in 6 weeks. Slow and steady wins the race 🐢', NULL, '#fitness #fitwayhub #health', 37, 0, NULL, NULL, 0, 0, '2026-03-08 13:57:48'),
(1708, 958, 'Skipped the elevator all week. Every step counts!', NULL, '#fitness #fitwayhub #health', 25, 0, NULL, NULL, 0, 0, '2026-03-17 13:57:48'),
(1709, 959, 'Ate clean for 30 days and the difference is unbelievable ✨', NULL, '#fitness #fitwayhub #health', 20, 0, NULL, NULL, 0, 0, '2026-03-25 13:57:48'),
(1710, 960, 'My friend laughed when I joined FitWay. Now she\'s asking me for advice 😏', NULL, '#fitness #fitwayhub #health', 29, 0, NULL, NULL, 0, 0, '2026-03-17 13:57:49'),
(1712, 941, 'Week 1 done! Already feeling stronger and more energetic 💪 Thanks to my FitWay coach!', NULL, '#fitnessjourney #fitwayhub', 28, 0, NULL, NULL, 0, 0, '2026-04-06 11:57:49'),
(1713, 937, '💡 Coaching tip: You don\'t need to train 2 hours a day. 45 focused minutes beats 2 hours of distracted training every time.', NULL, '#coaching #fitness #fitwayhub #Egypt', 86, 0, NULL, NULL, 0, 0, '2026-03-24 13:57:50'),
(1714, 937, '🥗 Nutrition myth busted: You don\'t need to eat clean 100% of the time. 80/20 rule is sustainable and effective.', NULL, '#coaching #fitness #fitwayhub #Egypt', 84, 0, NULL, NULL, 0, 0, '2026-03-18 13:57:50'),
(1715, 938, '🏋️ Progressive overload is the #1 driver of muscle growth. Add weight, reps, or sets every single week.', NULL, '#coaching #fitness #fitwayhub #Egypt', 117, 0, NULL, NULL, 0, 0, '2026-03-30 13:57:51'),
(1716, 938, '💤 If your progress has stalled, check your sleep first. Everything else comes second.', NULL, '#coaching #fitness #fitwayhub #Egypt', 100, 0, NULL, NULL, 0, 0, '2026-04-03 13:57:51'),
(1717, 938, '🔥 New spots open for online coaching this month! DM me to claim yours. 20 users already transformed this year.', NULL, '#coaching #fitness #fitwayhub #Egypt', 75, 0, NULL, NULL, 0, 0, '2026-04-06 13:57:51'),
(1718, 939, '💤 If your progress has stalled, check your sleep first. Everything else comes second.', NULL, '#coaching #fitness #fitwayhub #Egypt', 99, 0, NULL, NULL, 0, 0, '2026-04-05 13:57:51'),
(1719, 939, '🔥 New spots open for online coaching this month! DM me to claim yours. 20 users already transformed this year.', NULL, '#coaching #fitness #fitwayhub #Egypt', 105, 0, NULL, NULL, 0, 0, '2026-03-28 13:57:52'),
(1720, 940, '📱 Swipe to see my client\'s 12-week transformation. This is what consistent coaching looks like 👉', NULL, '#coaching #fitness #fitwayhub #Egypt', 120, 0, NULL, NULL, 0, 0, '2026-04-01 13:57:52'),
(1721, 940, '⚡ Reminder: rest days are not lazy days. They\'re growth days.', NULL, '#coaching #fitness #fitwayhub #Egypt', 34, 0, NULL, NULL, 0, 0, '2026-03-22 13:57:52');

-- --------------------------------------------------------
-- Table: `premium_sessions`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `premium_sessions`;
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
);

-- --------------------------------------------------------
-- Table: `push_log`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `push_log`;
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
);

INSERT INTO `push_log` (`id`, `user_id`, `template_id`, `title`, `body`, `status`, `error_message`, `created_at`) VALUES
(1, 2, NULL, '🔔 FitWay Hub Test', 'Push notifications are working correctly!', 'failed', 'FCM delivery failed', '2026-03-15 08:05:46'),
(2, 2, NULL, '🔔 FitWay Hub Test', 'Push notifications are working correctly!', 'sent', NULL, '2026-03-15 08:30:40'),
(3, 2, NULL, '🔔 FitWay Hub Test', 'Push notifications are working correctly!', 'sent', NULL, '2026-03-15 08:30:51'),
(4, 2, NULL, 'asdasd', 'asdasdasdasdsad', 'sent', NULL, '2026-03-15 08:31:18'),
(5, 2, NULL, '🔔 FitWay Hub Test', 'Push notifications are working correctly!', 'sent', NULL, '2026-03-15 08:39:07'),
(6, 2, NULL, '🔔 FitWay Hub Test', 'Push notifications are working correctly!', 'sent', NULL, '2026-03-15 08:46:59'),
(7, 2, NULL, '🔔 FitWay Hub Test', 'Push notifications are working correctly!', 'sent', NULL, '2026-03-15 08:57:20'),
(8, 2, NULL, 'Ffhgf', 'Do gggg', 'sent', NULL, '2026-03-15 08:59:12'),
(9, 2, NULL, '🔔 FitWay Hub Test', 'Push notifications are working correctly!', 'sent', NULL, '2026-03-15 09:05:54'),
(10, 2, NULL, '🔔 FitWay Hub Test', 'Push notifications are working correctly!', 'sent', NULL, '2026-03-15 09:06:21'),
(11, 2, NULL, 'Hello', 'Welcome guys', 'sent', NULL, '2026-03-15 09:07:01'),
(12, 2, NULL, 'Hello', 'Welcome ', 'sent', NULL, '2026-03-15 09:07:42'),
(13, 2, NULL, '🔔 FitWay Hub Test', 'Push notifications are working correctly!', 'sent', NULL, '2026-03-15 09:27:59'),
(14, 57, NULL, '🔔 FitWay Hub Test', 'Push notifications are working correctly!', 'sent', NULL, '2026-03-23 04:46:39'),
(15, 57, NULL, '🔔 FitWay Hub Test', 'Push notifications are working correctly!', 'sent', NULL, '2026-03-23 04:46:49'),
(16, 908, NULL, '🔔 FitWay Hub Test', 'Push notifications are working correctly!', 'failed', 'FCM delivery failed', '2026-04-05 22:44:36'),
(17, 963, 6, 'You missed yesterday\'s workout.', 'Ready to get back? Your progress is waiting — even a quick session counts.', 'failed', 'FCM delivery failed', '2026-04-28 21:48:29'),
(18, 963, 6, 'You missed yesterday\'s workout.', 'Ready to get back? Your progress is waiting — even a quick session counts.', 'failed', 'FCM delivery failed', '2026-05-01 15:18:25'),
(19, 963, 7, 'Your progress is waiting. 📈', 'Jump back into training today. 3 days away is nothing — let\'s restart strong.', 'failed', 'FCM delivery failed', '2026-05-02 10:19:36');

-- --------------------------------------------------------
-- Table: `push_templates`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `push_templates`;
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
);

INSERT INTO `push_templates` (`id`, `slug`, `title`, `body`, `category`, `trigger_type`, `enabled`, `created_at`, `updated_at`) VALUES
(1, 'user_register', 'Welcome to Fitway Hub! 💪', 'Your fitness journey starts today. Set up your profile and build your first workout plan.', 'new_user', 'user_registers', 1, '2026-03-15 08:02:38', '2026-03-15 08:02:38'),
(2, 'coach_register', 'Welcome Coach! Athletes are waiting.', 'Complete your profile and start connecting with athletes who need your expertise.', 'new_coach', 'coach_registers', 1, '2026-03-15 08:02:38', '2026-03-15 08:02:38'),
(3, 'profile_complete', 'Your profile is ready! 🎯', 'Great work! Now let\'s build your first workout plan and get started.', 'new_user', 'user_completes_profile', 1, '2026-03-15 08:02:38', '2026-03-15 08:02:38'),
(4, 'workout_plan_assigned', 'New workout plan assigned! 🏋️', 'Your coach assigned a new workout plan. Open the app to start training.', 'engagement', 'workout_plan_assigned', 1, '2026-03-15 08:02:39', '2026-03-15 08:02:39'),
(5, 'workout_day_reminder', 'Today is a workout day! 💪', 'Let\'s get moving! Your workout is ready and waiting for you.', 'engagement', 'workout_day_reminder', 1, '2026-03-15 08:02:39', '2026-03-15 08:02:39'),
(6, 'inactive_1_day', 'You missed yesterday\'s workout.', 'Ready to get back? Your progress is waiting — even a quick session counts.', 'inactivity', 'user_inactive_1_day', 1, '2026-03-15 08:02:39', '2026-03-15 08:02:39'),
(7, 'inactive_3_days', 'Your progress is waiting. 📈', 'Jump back into training today. 3 days away is nothing — let\'s restart strong.', 'inactivity', 'user_inactive_3_days', 1, '2026-03-15 08:02:40', '2026-03-15 08:02:40'),
(8, 'inactive_7_days', 'We miss you! 👋', 'Your fitness journey is still here. Come back and keep moving forward.', 'inactivity', 'user_inactive_7_days', 1, '2026-03-15 08:02:40', '2026-03-15 08:02:40'),
(9, 'workout_completed', 'Great job! Workout complete. ✅', 'Another session done. Keep the momentum going — your next workout is already lined up.', 'engagement', 'workout_completed', 1, '2026-03-15 08:02:40', '2026-03-15 08:02:40'),
(10, 'streak_3_days', '🔥 3-day streak!', 'Keep pushing your limits. Three days straight — you\'re building something great.', 'streak', 'streak_3_days', 1, '2026-03-15 08:02:40', '2026-03-15 08:02:40'),
(11, 'streak_7_days', '7-day streak! Real habit forming. 🏆', 'Seven days in a row! You\'re building a real fitness habit. Keep it up.', 'streak', 'streak_7_days', 1, '2026-03-15 08:02:41', '2026-03-15 08:02:41'),
(12, 'coach_message', 'Your coach sent you a message. 💬', 'Check your messages now and stay on track with your coach\'s guidance.', 'engagement', 'coach_sends_message', 1, '2026-03-15 08:02:41', '2026-03-15 08:02:41'),
(13, 'new_workout_unlocked', 'New workout available today! 🆕', 'A new workout has been unlocked. Ready to try something new?', 'engagement', 'new_workout_unlocked', 1, '2026-03-15 08:02:41', '2026-03-15 08:02:41'),
(14, 'progress_milestone', 'Progress alert! 📊', 'You\'re getting stronger every week. Open the app to see your latest stats.', 'engagement', 'progress_milestone', 1, '2026-03-15 08:02:42', '2026-03-15 08:02:42'),
(15, 'goal_achieved', 'Goal achieved! 🎉', 'You hit your goal! Celebrate the win and set your next challenge.', 'engagement', 'goal_achieved', 1, '2026-03-15 08:02:42', '2026-03-15 08:02:42'),
(16, 'weight_logged', 'Progress logged! 📝', 'Great job tracking your progress. Consistency is the key to real results.', 'engagement', 'weight_logged', 1, '2026-03-15 08:02:42', '2026-03-15 08:02:42'),
(17, 'meal_plan_updated', 'Nutrition plan updated! 🥗', 'Your coach updated your nutrition plan. Check it now and fuel your training right.', 'engagement', 'meal_plan_updated', 1, '2026-03-15 08:02:42', '2026-03-15 08:02:42'),
(18, 'new_challenge', 'New fitness challenge! 🏅', 'A new challenge just started. Join now and compete with the community.', 'engagement', 'new_challenge_available', 1, '2026-03-15 08:02:43', '2026-03-15 08:02:43'),
(19, 'streak_about_to_break', 'Your streak is about to break! ⚠️', 'One quick workout keeps your streak alive. Don\'t let it end now!', 'streak', 'user_near_streak_break', 1, '2026-03-15 08:02:43', '2026-03-15 08:02:43'),
(20, 'new_exercise_added', 'New exercises added to your program! 💪', 'Your coach added new exercises. Open the app to check your updated plan.', 'engagement', 'coach_assigns_exercise', 1, '2026-03-15 08:02:43', '2026-03-15 08:02:43'),
(21, 'morning_reminder', 'Good morning! ☀️', 'A quick workout will boost your energy and focus for the whole day.', 'engagement', 'morning_reminder', 1, '2026-03-15 08:02:44', '2026-03-15 08:02:44'),
(22, 'evening_reminder', 'Still time for today\'s workout! 🌙', 'The day isn\'t over yet. A short session now keeps your streak alive.', 'engagement', 'evening_reminder', 1, '2026-03-15 08:02:44', '2026-03-15 08:02:44'),
(23, 'personal_best', 'New personal best! 🚀', 'You broke your own record. Can you beat it again tomorrow?', 'streak', 'user_improves_record', 1, '2026-03-15 08:02:44', '2026-03-15 08:02:44'),
(24, 'friend_joined', 'Your friend joined Fitway Hub! 👥', 'Train together and push each other to new limits.', 'engagement', 'friend_joins_platform', 1, '2026-03-15 08:02:44', '2026-03-15 08:02:44'),
(25, 'challenge_completed', 'Challenge completed! 🏆', 'Amazing work finishing the challenge. Your dedication is showing real results.', 'engagement', 'challenge_completed', 1, '2026-03-15 08:02:45', '2026-03-15 08:02:45'),
(26, 'new_feature', 'New feature in Fitway Hub! ✨', 'We just launched something new. Open the app and check it out.', 'promo', 'app_feature_announcement', 1, '2026-03-15 08:02:45', '2026-03-15 08:02:45'),
(27, 'monthly_summary', 'Your monthly progress report is ready! 📅', 'Open the app to see how far you\'ve come this month.', 'engagement', 'monthly_progress_summary', 1, '2026-03-15 08:02:45', '2026-03-15 08:02:45'),
(28, 'coach_review', 'Your coach reviewed your performance. 👀', 'Your coach left feedback on your recent workouts. Check it now.', 'coach_tip', 'coach_review_posted', 1, '2026-03-15 08:02:46', '2026-03-15 08:02:46'),
(29, 'program_completed', 'Program completed! 🎓', 'You finished the full program. Ready to level up to the next challenge?', 'engagement', 'program_completed', 1, '2026-03-15 08:02:46', '2026-03-15 08:02:46'),
(30, 'inactive_14_days', 'It\'s never too late to restart. 💙', 'Your fitness journey is still here. Come back — even one session makes a difference.', 'inactivity', 'user_inactive_14_days', 1, '2026-03-15 08:02:46', '2026-03-15 08:02:46'),
(4021, 'new_message', '💬 New message from {{name}}', 'You have a new message. Open the app to read and reply.', 'engagement', 'message_received', 1, '2026-04-06 11:39:19', '2026-04-06 11:39:19'),
(4022, 'payment_approved', '✅ Payment Approved', 'Your e-wallet payment has been approved and your account is now activated.', '', 'payment_approved', 1, '2026-04-06 11:39:19', '2026-04-06 11:39:19'),
(4023, 'payment_rejected', '❌ Payment Rejected', 'Your e-wallet payment was rejected. Please check the details or contact support.', '', 'payment_rejected', 1, '2026-04-06 11:39:19', '2026-04-06 11:39:19'),
(4024, 'subscription_verified', '📋 New Subscription Request', 'A user paid and requested to subscribe to you. Please accept or decline from Requests.', '', 'subscription_verified_coach', 1, '2026-04-06 11:39:19', '2026-04-06 11:39:19'),
(4025, 'subscription_verified_user', '✅ Payment Verified', 'Admin verified your payment. Waiting for coach acceptance.', '', 'subscription_verified_user', 1, '2026-04-06 11:39:20', '2026-04-06 11:39:20'),
(4026, 'subscription_rejected', '❌ Subscription Rejected', 'Your subscription payment was rejected by admin and marked for refund.', '', 'subscription_rejected', 1, '2026-04-06 11:39:20', '2026-04-06 11:39:20'),
(4027, 'subscription_coach_accepted', '🎉 Coach Accepted Your Subscription', 'Your coach accepted your subscription and your plan is now active!', '', 'subscription_coach_accepted', 1, '2026-04-06 11:39:20', '2026-04-06 11:39:20'),
(4028, 'subscription_coach_declined', '😔 Coach Declined Subscription', 'Your coach declined the subscription request. A refund is being processed.', '', 'subscription_coach_declined', 1, '2026-04-06 11:39:21', '2026-04-06 11:39:21'),
(4029, 'booking_accepted', '🎉 Coaching Request Accepted!', 'Your coaching request has been accepted. Your coach will reach out soon.', '', 'booking_accepted', 1, '2026-04-06 11:39:21', '2026-04-06 11:39:21'),
(4030, 'booking_rejected', '😔 Coaching Request Update', 'Your coaching request was reviewed. Please reach out for more info.', '', 'booking_rejected', 1, '2026-04-06 11:39:21', '2026-04-06 11:39:21'),
(4031, 'ad_approved', '✅ Campaign Approved: {{campaign_name}}', 'Your ad campaign is now live and reaching your target audience!', '', 'ad_approved', 1, '2026-04-06 11:39:21', '2026-04-06 11:39:21'),
(4032, 'ad_rejected', '❌ Campaign Rejected: {{campaign_name}}', 'Your campaign was rejected. Please review the notes and resubmit.', '', 'ad_rejected', 1, '2026-04-06 11:39:22', '2026-04-06 11:39:22'),
(4033, 'ad_flagged', '🚩 Campaign Flagged: {{campaign_name}}', 'Your campaign has been flagged for review and is currently paused.', '', 'ad_flagged', 1, '2026-04-06 11:39:22', '2026-04-06 11:39:22'),
(4034, 'ad_needs_changes', '⚠️ Campaign Needs Changes: {{campaign_name}}', 'Your campaign requires changes before it can go live. Please review the notes.', '', 'ad_needs_changes', 1, '2026-04-06 11:39:22', '2026-04-06 11:39:22'),
(4035, 'post_liked', '❤️ {{name}} liked your post', 'Someone liked what you shared! Keep inspiring the community.', '', 'post_liked', 1, '2026-04-06 11:39:22', '2026-04-06 11:39:22'),
(4036, 'post_commented', '💬 {{name}} commented on your post', 'You got a new comment! Open the app to read and reply.', '', 'post_commented', 1, '2026-04-06 11:39:23', '2026-04-06 11:39:23'),
(4037, 'new_follower', '👤 {{name}} started following you', 'You have a new follower! Keep sharing great content.', '', 'new_follower', 1, '2026-04-06 11:39:23', '2026-04-06 11:39:23');

-- --------------------------------------------------------
-- Table: `push_tokens`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `push_tokens`;
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
);

INSERT INTO `push_tokens` (`id`, `user_id`, `token`, `platform`, `created_at`, `updated_at`) VALUES
(1, 2, 'etFvHD1-8B3OIMUIDvJTSp:APA91bFZWbY6puUpZpyHB1sn8cmv4cGDxpBFSzk8RF6WdLy-s7RuL-Kvxdz-SZlXbdmEQNDRqq6MYIzT7XbZI9n53oskN7tHhGPbMGeQ_aaC94RhAjy3eo0', 'web', '2026-03-15 08:05:40', '2026-03-16 00:34:25'),
(51, 24, 'ffYIvuk4TgOW_1LROKCfST:APA91bHHke_UOv6RKW_YxddCn2jNa40abXxp22ZH7wb1JTy_5eDye8ZfubpoR8gJATF2fTnUxJrbcyD7rqPfFEUSu0H02vSD3TxASRFFH_vwjDQ0JGbAGL4', 'android', '2026-03-15 14:18:18', '2026-03-15 14:18:18'),
(66, 26, 'etFvHD1-8B3OIMUIDvJTSp:APA91bFZWbY6puUpZpyHB1sn8cmv4cGDxpBFSzk8RF6WdLy-s7RuL-Kvxdz-SZlXbdmEQNDRqq6MYIzT7XbZI9n53oskN7tHhGPbMGeQ_aaC94RhAjy3eo0', 'web', '2026-03-16 01:12:47', '2026-03-16 01:14:52'),
(67, 54, 'd9CjDMwV8AVcymh4A6mSEN:APA91bEzQUZ_spZmdGN_xtO0Jr3lWLHOmes8lIt6lQQhO12RMxexmbefS2IIc3GN7K4XUA0CzsZ2CR6i2nZZTDDBQFdYjFAPk5daqq4Sv6OLK4Pr5WclvWA', 'web', '2026-03-16 08:47:03', '2026-03-16 08:52:46'),
(76, 79, 'dLwcT0eMn1j3oVhg-Dt17z:APA91bHZ2aO6JNtk4GprZ08gpECcNH4YesgPbzKeKPBNF8xKwUkrbz-nsavBNv9ZEnmw1jkLfB-TDi4yfD8nMWZrD-nmTTsPIlsUZSfjKJUPJsNeyEb2h9Q', 'web', '2026-03-16 20:58:29', '2026-03-16 21:02:51'),
(94, 57, 'etFvHD1-8B3OIMUIDvJTSp:APA91bFZWbY6puUpZpyHB1sn8cmv4cGDxpBFSzk8RF6WdLy-s7RuL-Kvxdz-SZlXbdmEQNDRqq6MYIzT7XbZI9n53oskN7tHhGPbMGeQ_aaC94RhAjy3eo0', 'web', '2026-03-16 21:05:12', '2026-03-23 04:32:06'),
(119, 86, 'dLwcT0eMn1j3oVhg-Dt17z:APA91bHZ2aO6JNtk4GprZ08gpECcNH4YesgPbzKeKPBNF8xKwUkrbz-nsavBNv9ZEnmw1jkLfB-TDi4yfD8nMWZrD-nmTTsPIlsUZSfjKJUPJsNeyEb2h9Q', 'web', '2026-03-16 22:18:59', '2026-03-16 22:19:29'),
(130, 58, 'etFvHD1-8B3OIMUIDvJTSp:APA91bFZWbY6puUpZpyHB1sn8cmv4cGDxpBFSzk8RF6WdLy-s7RuL-Kvxdz-SZlXbdmEQNDRqq6MYIzT7XbZI9n53oskN7tHhGPbMGeQ_aaC94RhAjy3eo0', 'web', '2026-03-23 02:13:37', '2026-03-23 02:14:14'),
(134, 87, 'etFvHD1-8B3OIMUIDvJTSp:APA91bFZWbY6puUpZpyHB1sn8cmv4cGDxpBFSzk8RF6WdLy-s7RuL-Kvxdz-SZlXbdmEQNDRqq6MYIzT7XbZI9n53oskN7tHhGPbMGeQ_aaC94RhAjy3eo0', 'web', '2026-03-23 02:22:59', '2026-03-23 04:48:58'),
(156, 93, 'etFvHD1-8B3OIMUIDvJTSp:APA91bFZWbY6puUpZpyHB1sn8cmv4cGDxpBFSzk8RF6WdLy-s7RuL-Kvxdz-SZlXbdmEQNDRqq6MYIzT7XbZI9n53oskN7tHhGPbMGeQ_aaC94RhAjy3eo0', 'web', '2026-03-23 05:15:50', '2026-03-27 18:04:40'),
(162, 98, 'etFvHD1-8B3OIMUIDvJTSp:APA91bFZWbY6puUpZpyHB1sn8cmv4cGDxpBFSzk8RF6WdLy-s7RuL-Kvxdz-SZlXbdmEQNDRqq6MYIzT7XbZI9n53oskN7tHhGPbMGeQ_aaC94RhAjy3eo0', 'web', '2026-03-23 05:54:25', '2026-03-23 19:28:23'),
(181, 881, 'etFvHD1-8B3OIMUIDvJTSp:APA91bFZWbY6puUpZpyHB1sn8cmv4cGDxpBFSzk8RF6WdLy-s7RuL-Kvxdz-SZlXbdmEQNDRqq6MYIzT7XbZI9n53oskN7tHhGPbMGeQ_aaC94RhAjy3eo0', 'web', '2026-03-29 18:34:18', '2026-03-29 18:34:19'),
(183, 908, 'etFvHD1-8B3OIMUIDvJTSp:APA91bFZWbY6puUpZpyHB1sn8cmv4cGDxpBFSzk8RF6WdLy-s7RuL-Kvxdz-SZlXbdmEQNDRqq6MYIzT7XbZI9n53oskN7tHhGPbMGeQ_aaC94RhAjy3eo0', 'web', '2026-03-29 18:46:10', '2026-04-06 10:54:16'),
(185, 909, 'etFvHD1-8B3OIMUIDvJTSp:APA91bFZWbY6puUpZpyHB1sn8cmv4cGDxpBFSzk8RF6WdLy-s7RuL-Kvxdz-SZlXbdmEQNDRqq6MYIzT7XbZI9n53oskN7tHhGPbMGeQ_aaC94RhAjy3eo0', 'web', '2026-03-29 19:21:42', '2026-04-05 17:53:04'),
(192, 913, 'etFvHD1-8B3OIMUIDvJTSp:APA91bFZWbY6puUpZpyHB1sn8cmv4cGDxpBFSzk8RF6WdLy-s7RuL-Kvxdz-SZlXbdmEQNDRqq6MYIzT7XbZI9n53oskN7tHhGPbMGeQ_aaC94RhAjy3eo0', 'web', '2026-03-30 13:37:57', '2026-04-06 09:37:12'),
(210, 936, 'etFvHD1-8B3OIMUIDvJTSp:APA91bFZWbY6puUpZpyHB1sn8cmv4cGDxpBFSzk8RF6WdLy-s7RuL-Kvxdz-SZlXbdmEQNDRqq6MYIzT7XbZI9n53oskN7tHhGPbMGeQ_aaC94RhAjy3eo0', 'web', '2026-04-10 09:05:16', '2026-05-02 20:39:56'),
(213, 941, 'etFvHD1-8B3OIMUIDvJTSp:APA91bFZWbY6puUpZpyHB1sn8cmv4cGDxpBFSzk8RF6WdLy-s7RuL-Kvxdz-SZlXbdmEQNDRqq6MYIzT7XbZI9n53oskN7tHhGPbMGeQ_aaC94RhAjy3eo0', 'web', '2026-04-10 10:03:15', '2026-04-10 12:59:37'),
(220, 963, 'etFvHD1-8B3OIMUIDvJTSp:APA91bFZWbY6puUpZpyHB1sn8cmv4cGDxpBFSzk8RF6WdLy-s7RuL-Kvxdz-SZlXbdmEQNDRqq6MYIzT7XbZI9n53oskN7tHhGPbMGeQ_aaC94RhAjy3eo0', 'web', '2026-04-24 19:29:36', '2026-05-01 17:06:37');

-- --------------------------------------------------------
-- Table: `revoked_tokens`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `revoked_tokens`;
CREATE TABLE `revoked_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `token_hash` varchar(64) NOT NULL,
  `revoked_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_revoked_tokens_hash` (`token_hash`),
  KEY `idx_revoked_tokens_user` (`user_id`)
);

INSERT INTO `revoked_tokens` (`id`, `user_id`, `token_hash`, `revoked_at`, `expires_at`) VALUES
(33, 908, '5b4a398476e03eed9afb69efbbb78e0b', '2026-04-01 22:12:01', '2026-05-02 21:12:01'),
(34, 909, '2f8e3a88b25c4929bef6e8c7d5f858b0', '2026-04-01 22:48:56', '2026-05-02 21:48:56'),
(35, 913, 'd8fcc557b41bcfc527e0e65c0d6e41c8', '2026-04-04 17:52:06', '2026-05-05 16:52:06'),
(36, 913, '7b3aee15f2f9c1ad904b4d0414dc0296', '2026-04-05 02:17:57', '2026-05-06 01:17:57'),
(37, 908, 'dd6be04248ffe2017092c8ff3588a743', '2026-04-05 17:52:45', '2026-05-06 16:52:45'),
(38, 909, 'e1fe0e7d5eb8e9527c3834c88ecc09fa', '2026-04-05 17:59:15', '2026-05-06 16:59:15'),
(39, 913, 'b54ea538b62d191a865c388c1e64650f', '2026-04-05 18:05:13', '2026-05-06 17:05:13'),
(40, 908, 'fe8c1b57204de076adddc43b1d661b86', '2026-04-05 18:18:58', '2026-05-06 17:18:58'),
(41, 908, '6e799c231076d0df9c91dd318e04b479', '2026-04-05 22:29:07', '2026-05-06 21:29:07'),
(42, 908, '2b02640a3e4ffc684af214587f92396e', '2026-04-06 09:36:50', '2026-05-07 08:36:50'),
(43, 913, '8e29b45b4c184eb1e3a9ec65c63d8764', '2026-04-06 10:53:31', '2026-05-07 09:53:31'),
(44, 936, 'a54e6ac09fd2665510fbd8671c5114cc', '2026-04-06 20:47:03', '2026-05-07 19:47:03'),
(45, 941, 'ec9e1dafb39800feafaedbcf8a39ae7f', '2026-04-06 20:56:50', '2026-05-07 19:56:50'),
(46, 936, '2f99e7f8932af1237c8fa01ed6b0df32', '2026-04-06 21:04:47', '2026-05-07 20:04:47'),
(47, 941, 'c985f674d1b47b406c37231fbd5b37d9', '2026-04-06 21:22:25', '2026-05-07 20:22:25'),
(48, 962, '51aeecf756bac8c0fa52c674b04a7a3e', '2026-04-09 15:16:25', '2026-05-10 14:16:25'),
(49, 936, '3b225fc98649be734ac2214726957b00', '2026-04-10 07:10:55', '2026-05-11 06:10:55'),
(50, 908, '4cadf7cbe1888f4c24acd62eff9c2ccf', '2026-04-10 08:55:30', '2026-05-11 07:55:30'),
(51, 936, 'a9d4ad3d288b0ad7a281b8dc9aa305a6', '2026-04-10 09:13:04', '2026-05-11 08:13:04'),
(52, 936, '4ffacb25db85216bb089f327183bea39', '2026-04-10 10:03:02', '2026-05-11 09:03:02'),
(53, 941, '8a39f03a5d29345e89baa20b2a1f1d82', '2026-04-10 10:18:34', '2026-05-11 09:18:34'),
(54, 936, '5b9a630ee827dd920c12aa33cdec8dac', '2026-04-10 10:34:03', '2026-05-11 09:34:03'),
(55, 941, '22e428a4a93ad439f86d74d2b2d29282', '2026-04-10 11:01:46', '2026-05-11 10:01:46'),
(56, 936, '8467c421352d165e288e41e6f611362e', '2026-04-10 12:59:00', '2026-05-11 11:59:00'),
(57, 941, '05ea8ece531ddaabcca7f569ccd4242a', '2026-04-21 19:34:11', '2026-05-22 18:34:11'),
(58, 936, '5a4ba0ba05f4ae01af373b60d7be61d9', '2026-04-22 10:02:48', '2026-05-23 09:02:48'),
(59, 936, '349811e1059990ffef95416e0bad4d3f', '2026-04-22 19:23:05', '2026-05-23 18:23:05'),
(60, 963, 'b893cfa001e40bcc4b4e88631c017f5a', '2026-04-24 20:12:25', '2026-05-25 20:12:25'),
(61, 963, '0b789c5a929218e4d1dd517ccfc20481', '2026-04-26 17:57:45', '2026-05-27 17:57:45'),
(62, 963, '501cc96d38fd73d5feaaa902e70157cd', '2026-05-02 20:39:30', '2026-06-02 20:39:30');

-- --------------------------------------------------------
-- Table: `steps_entries`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `steps_entries`;
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
);

INSERT INTO `steps_entries` (`id`, `user_id`, `date`, `steps`, `calories_burned`, `distance_km`, `notes`, `tracking_mode`, `created_at`) VALUES
(9120, 942, '2026-04-06', 10185, 509, 7.639999866485596, NULL, 'manual', '2026-04-06 11:56:05'),
(9121, 942, '2026-04-05', 10463, 523, 7.849999904632568, NULL, 'manual', '2026-04-06 11:56:06'),
(9122, 942, '2026-04-04', 9895, 495, 7.420000076293945, NULL, 'manual', '2026-04-06 11:56:06'),
(9123, 942, '2026-04-03', 9422, 471, 7.070000171661377, NULL, 'manual', '2026-04-06 11:56:06'),
(9124, 942, '2026-04-02', 12189, 609, 9.140000343322754, NULL, 'manual', '2026-04-06 11:56:06'),
(9125, 942, '2026-04-01', 12249, 612, 9.1899995803833, NULL, 'manual', '2026-04-06 11:56:07'),
(9126, 942, '2026-03-31', 8428, 421, 6.320000171661377, NULL, 'manual', '2026-04-06 11:56:07'),
(9127, 942, '2026-03-30', 8487, 424, 6.369999885559082, NULL, 'manual', '2026-04-06 11:56:07'),
(9128, 942, '2026-03-29', 9631, 482, 7.21999979019165, NULL, 'manual', '2026-04-06 11:56:08'),
(9129, 942, '2026-03-28', 12511, 626, 9.380000114440918, NULL, 'manual', '2026-04-06 11:56:08'),
(9130, 942, '2026-03-27', 8520, 426, 6.389999866485596, NULL, 'manual', '2026-04-06 11:56:08'),
(9131, 942, '2026-03-26', 8706, 435, 6.53000020980835, NULL, 'manual', '2026-04-06 11:56:08'),
(9132, 942, '2026-03-25', 10950, 548, 8.210000038146973, NULL, 'manual', '2026-04-06 11:56:09'),
(9133, 942, '2026-03-24', 11054, 553, 8.289999961853027, NULL, 'manual', '2026-04-06 11:56:09'),
(9134, 943, '2026-04-06', 8215, 411, 6.159999847412109, NULL, 'manual', '2026-04-06 11:56:09'),
(9135, 943, '2026-04-05', 10277, 514, 7.710000038146973, NULL, 'manual', '2026-04-06 11:56:10'),
(9136, 943, '2026-04-04', 10535, 527, 7.900000095367432, NULL, 'manual', '2026-04-06 11:56:10'),
(9137, 943, '2026-04-03', 6920, 346, 5.190000057220459, NULL, 'manual', '2026-04-06 11:56:10'),
(9138, 943, '2026-04-02', 8713, 436, 6.53000020980835, NULL, 'manual', '2026-04-06 11:56:10'),
(9139, 943, '2026-04-01', 8429, 421, 6.320000171661377, NULL, 'manual', '2026-04-06 11:56:11'),
(9140, 943, '2026-03-31', 6952, 348, 5.210000038146973, NULL, 'manual', '2026-04-06 11:56:11'),
(9141, 943, '2026-03-30', 9409, 470, 7.059999942779541, NULL, 'manual', '2026-04-06 11:56:12'),
(9142, 943, '2026-03-29', 7549, 377, 5.659999847412109, NULL, 'manual', '2026-04-06 11:56:13'),
(9143, 943, '2026-03-28', 8216, 411, 6.159999847412109, NULL, 'manual', '2026-04-06 11:56:13'),
(9144, 943, '2026-03-27', 7941, 397, 5.960000038146973, NULL, 'manual', '2026-04-06 11:56:13'),
(9145, 943, '2026-03-26', 6573, 329, 4.929999828338623, NULL, 'manual', '2026-04-06 11:56:14'),
(9146, 943, '2026-03-25', 9346, 467, 7.010000228881836, NULL, 'manual', '2026-04-06 11:56:14'),
(9147, 943, '2026-03-24', 9456, 473, 7.090000152587891, NULL, 'manual', '2026-04-06 11:56:14'),
(9148, 944, '2026-04-06', 5747, 287, 4.309999942779541, NULL, 'manual', '2026-04-06 11:56:15'),
(9149, 944, '2026-04-05', 5405, 270, 4.050000190734863, NULL, 'manual', '2026-04-06 11:56:15'),
(9150, 944, '2026-04-04', 5681, 284, 4.260000228881836, NULL, 'manual', '2026-04-06 11:56:15'),
(9151, 944, '2026-04-03', 4968, 248, 3.7300000190734863, NULL, 'manual', '2026-04-06 11:56:16'),
(9152, 944, '2026-04-02', 5030, 252, 3.7699999809265137, NULL, 'manual', '2026-04-06 11:56:16'),
(9153, 944, '2026-04-01', 6033, 302, 4.519999980926514, NULL, 'manual', '2026-04-06 11:56:16'),
(9154, 944, '2026-03-31', 5022, 251, 3.7699999809265137, NULL, 'manual', '2026-04-06 11:56:16'),
(9155, 944, '2026-03-30', 7151, 358, 5.360000133514404, NULL, 'manual', '2026-04-06 11:56:17'),
(9156, 944, '2026-03-29', 9155, 458, 6.869999885559082, NULL, 'manual', '2026-04-06 11:56:17'),
(9157, 944, '2026-03-28', 7960, 398, 5.96999979019165, NULL, 'manual', '2026-04-06 11:56:17'),
(9158, 944, '2026-03-27', 6431, 322, 4.820000171661377, NULL, 'manual', '2026-04-06 11:56:18'),
(9159, 944, '2026-03-26', 6068, 303, 4.550000190734863, NULL, 'manual', '2026-04-06 11:56:18'),
(9160, 944, '2026-03-25', 6341, 317, 4.760000228881836, NULL, 'manual', '2026-04-06 11:56:18'),
(9161, 944, '2026-03-24', 5357, 268, 4.019999980926514, NULL, 'manual', '2026-04-06 11:56:19'),
(9176, 946, '2026-04-06', 5175, 259, 3.880000114440918, NULL, 'manual', '2026-04-06 11:56:24'),
(9177, 946, '2026-04-05', 7510, 376, 5.630000114440918, NULL, 'manual', '2026-04-06 11:56:25'),
(9178, 946, '2026-04-04', 6767, 338, 5.079999923706055, NULL, 'manual', '2026-04-06 11:56:25'),
(9179, 946, '2026-04-03', 4569, 228, 3.430000066757202, NULL, 'manual', '2026-04-06 11:56:25'),
(9180, 946, '2026-04-02', 3862, 193, 2.9000000953674316, NULL, 'manual', '2026-04-06 11:56:26'),
(9181, 946, '2026-04-01', 4479, 224, 3.359999895095825, NULL, 'manual', '2026-04-06 11:56:26'),
(9182, 946, '2026-03-31', 5996, 300, 4.5, NULL, 'manual', '2026-04-06 11:56:26'),
(9183, 946, '2026-03-30', 6325, 316, 4.739999771118164, NULL, 'manual', '2026-04-06 11:56:26'),
(9184, 946, '2026-03-29', 8722, 436, 6.539999961853027, NULL, 'manual', '2026-04-06 11:56:27'),
(9185, 946, '2026-03-28', 7704, 385, 5.78000020980835, NULL, 'manual', '2026-04-06 11:56:27'),
(9186, 946, '2026-03-27', 4067, 203, 3.049999952316284, NULL, 'manual', '2026-04-06 11:56:28'),
(9187, 946, '2026-03-26', 7444, 372, 5.579999923706055, NULL, 'manual', '2026-04-06 11:56:28'),
(9188, 946, '2026-03-25', 4666, 233, 3.5, NULL, 'manual', '2026-04-06 11:56:28'),
(9189, 946, '2026-03-24', 7146, 357, 5.360000133514404, NULL, 'manual', '2026-04-06 11:56:29'),
(9190, 947, '2026-04-06', 10048, 502, 7.539999961853027, NULL, 'manual', '2026-04-06 11:56:29'),
(9191, 947, '2026-04-05', 12594, 630, 9.449999809265137, NULL, 'manual', '2026-04-06 11:56:29'),
(9192, 947, '2026-04-04', 9870, 494, 7.400000095367432, NULL, 'manual', '2026-04-06 11:56:29'),
(9193, 947, '2026-04-03', 9577, 479, 7.179999828338623, NULL, 'manual', '2026-04-06 11:56:30'),
(9194, 947, '2026-04-02', 11255, 563, 8.4399995803833, NULL, 'manual', '2026-04-06 11:56:30'),
(9195, 947, '2026-04-01', 12755, 638, 9.569999694824219, NULL, 'manual', '2026-04-06 11:56:30'),
(9196, 947, '2026-03-31', 11707, 585, 8.779999732971191, NULL, 'manual', '2026-04-06 11:56:31'),
(9197, 947, '2026-03-30', 11095, 555, 8.319999694824219, NULL, 'manual', '2026-04-06 11:56:31'),
(9198, 947, '2026-03-29', 14784, 739, 11.09000015258789, NULL, 'manual', '2026-04-06 11:56:31'),
(9199, 947, '2026-03-28', 12304, 615, 9.229999542236328, NULL, 'manual', '2026-04-06 11:56:32'),
(9200, 947, '2026-03-27', 12871, 644, 9.649999618530273, NULL, 'manual', '2026-04-06 11:56:32'),
(9201, 947, '2026-03-26', 10588, 529, 7.940000057220459, NULL, 'manual', '2026-04-06 11:56:32'),
(9202, 947, '2026-03-25', 11203, 560, 8.399999618530273, NULL, 'manual', '2026-04-06 11:56:32'),
(9203, 947, '2026-03-24', 12080, 604, 9.0600004196167, NULL, 'manual', '2026-04-06 11:56:33'),
(9204, 948, '2026-04-06', 6519, 326, 4.889999866485596, NULL, 'manual', '2026-04-06 11:56:33'),
(9205, 948, '2026-04-05', 8899, 445, 6.670000076293945, NULL, 'manual', '2026-04-06 11:56:33'),
(9206, 948, '2026-04-04', 10851, 543, 8.140000343322754, NULL, 'manual', '2026-04-06 11:56:34'),
(9207, 948, '2026-04-03', 6423, 321, 4.820000171661377, NULL, 'manual', '2026-04-06 11:56:34'),
(9208, 948, '2026-04-02', 7795, 390, 5.849999904632568, NULL, 'manual', '2026-04-06 11:56:34'),
(9209, 948, '2026-04-01', 8718, 436, 6.539999961853027, NULL, 'manual', '2026-04-06 11:56:35'),
(9210, 948, '2026-03-31', 6838, 342, 5.130000114440918, NULL, 'manual', '2026-04-06 11:56:35'),
(9211, 948, '2026-03-30', 6617, 331, 4.960000038146973, NULL, 'manual', '2026-04-06 11:56:35'),
(9212, 948, '2026-03-29', 9926, 496, 7.440000057220459, NULL, 'manual', '2026-04-06 11:56:35'),
(9213, 948, '2026-03-28', 11522, 576, 8.640000343322754, NULL, 'manual', '2026-04-06 11:56:36'),
(9214, 948, '2026-03-27', 7513, 376, 5.630000114440918, NULL, 'manual', '2026-04-06 11:56:36'),
(9215, 948, '2026-03-26', 9839, 492, 7.380000114440918, NULL, 'manual', '2026-04-06 11:56:36'),
(9216, 948, '2026-03-25', 9382, 469, 7.039999961853027, NULL, 'manual', '2026-04-06 11:56:37'),
(9217, 948, '2026-03-24', 8761, 438, 6.570000171661377, NULL, 'manual', '2026-04-06 11:56:37'),
(9232, 950, '2026-04-06', 8312, 416, 6.230000019073486, NULL, 'manual', '2026-04-06 11:56:42'),
(9233, 950, '2026-04-05', 7798, 390, 5.849999904632568, NULL, 'manual', '2026-04-06 11:56:42'),
(9234, 950, '2026-04-04', 8662, 433, 6.5, NULL, 'manual', '2026-04-06 11:56:42'),
(9235, 950, '2026-04-03', 7745, 387, 5.809999942779541, NULL, 'manual', '2026-04-06 11:56:42'),
(9236, 950, '2026-04-02', 7407, 370, 5.559999942779541, NULL, 'manual', '2026-04-06 11:56:43'),
(9237, 950, '2026-04-01', 10330, 517, 7.75, NULL, 'manual', '2026-04-06 11:56:43'),
(9238, 950, '2026-03-31', 6950, 348, 5.210000038146973, NULL, 'manual', '2026-04-06 11:56:43'),
(9239, 950, '2026-03-30', 8810, 441, 6.610000133514404, NULL, 'manual', '2026-04-06 11:56:44'),
(9240, 950, '2026-03-29', 9421, 471, 7.070000171661377, NULL, 'manual', '2026-04-06 11:56:44'),
(9241, 950, '2026-03-28', 10186, 509, 7.639999866485596, NULL, 'manual', '2026-04-06 11:56:44'),
(9242, 950, '2026-03-27', 9534, 477, 7.150000095367432, NULL, 'manual', '2026-04-06 11:56:44'),
(9243, 950, '2026-03-26', 8430, 422, 6.320000171661377, NULL, 'manual', '2026-04-06 11:56:45'),
(9244, 950, '2026-03-25', 7997, 400, 6, NULL, 'manual', '2026-04-06 11:56:45'),
(9245, 950, '2026-03-24', 9322, 466, 6.989999771118164, NULL, 'manual', '2026-04-06 11:56:45'),
(9246, 951, '2026-04-06', 4782, 239, 3.5899999141693115, NULL, 'manual', '2026-04-06 11:56:46'),
(9247, 951, '2026-04-05', 4955, 248, 3.7200000286102295, NULL, 'manual', '2026-04-06 11:56:46'),
(9248, 951, '2026-04-04', 5800, 290, 4.349999904632568, NULL, 'manual', '2026-04-06 11:56:46'),
(9249, 951, '2026-04-03', 5572, 279, 4.179999828338623, NULL, 'manual', '2026-04-06 11:56:47'),
(9250, 951, '2026-04-02', 4143, 207, 3.109999895095825, NULL, 'manual', '2026-04-06 11:56:47'),
(9251, 951, '2026-04-01', 6185, 309, 4.639999866485596, NULL, 'manual', '2026-04-06 11:56:47'),
(9252, 951, '2026-03-31', 5638, 282, 4.230000019073486, NULL, 'manual', '2026-04-06 11:56:47'),
(9253, 951, '2026-03-30', 4139, 207, 3.0999999046325684, NULL, 'manual', '2026-04-06 11:56:48'),
(9254, 951, '2026-03-29', 3467, 173, 2.5999999046325684, NULL, 'manual', '2026-04-06 11:56:48'),
(9255, 951, '2026-03-28', 4364, 218, 3.2699999809265137, NULL, 'manual', '2026-04-06 11:56:49'),
(9256, 951, '2026-03-27', 5498, 275, 4.119999885559082, NULL, 'manual', '2026-04-06 11:56:49'),
(9257, 951, '2026-03-26', 4831, 242, 3.619999885559082, NULL, 'manual', '2026-04-06 11:56:49'),
(9258, 951, '2026-03-25', 3363, 168, 2.5199999809265137, NULL, 'manual', '2026-04-06 11:56:50'),
(9259, 951, '2026-03-24', 3778, 189, 2.8299999237060547, NULL, 'manual', '2026-04-06 11:56:50'),
(9260, 952, '2026-04-06', 8491, 425, 6.369999885559082, NULL, 'manual', '2026-04-06 11:56:50'),
(9261, 952, '2026-04-05', 12375, 619, 9.279999732971191, NULL, 'manual', '2026-04-06 11:56:50'),
(9262, 952, '2026-04-04', 12948, 647, 9.710000038146973, NULL, 'manual', '2026-04-06 11:56:51'),
(9263, 952, '2026-04-03', 8080, 404, 6.059999942779541, NULL, 'manual', '2026-04-06 11:56:51'),
(9264, 952, '2026-04-02', 8082, 404, 6.059999942779541, NULL, 'manual', '2026-04-06 11:56:51'),
(9265, 952, '2026-04-01', 8368, 418, 6.28000020980835, NULL, 'manual', '2026-04-06 11:56:52'),
(9266, 952, '2026-03-31', 8649, 432, 6.489999771118164, NULL, 'manual', '2026-04-06 11:56:52'),
(9267, 952, '2026-03-30', 10972, 549, 8.229999542236328, NULL, 'manual', '2026-04-06 11:56:52'),
(9268, 952, '2026-03-29', 8368, 418, 6.28000020980835, NULL, 'manual', '2026-04-06 11:56:52'),
(9269, 952, '2026-03-28', 8313, 416, 6.230000019073486, NULL, 'manual', '2026-04-06 11:56:53'),
(9270, 952, '2026-03-27', 9829, 491, 7.369999885559082, NULL, 'manual', '2026-04-06 11:56:53'),
(9271, 952, '2026-03-26', 8174, 409, 6.130000114440918, NULL, 'manual', '2026-04-06 11:56:53'),
(9272, 952, '2026-03-25', 7635, 382, 5.730000019073486, NULL, 'manual', '2026-04-06 11:56:54'),
(9273, 952, '2026-03-24', 10063, 503, 7.550000190734863, NULL, 'manual', '2026-04-06 11:56:54'),
(9288, 954, '2026-04-06', 13632, 682, 10.220000267028809, NULL, 'manual', '2026-04-06 11:56:58'),
(9289, 954, '2026-04-05', 9724, 486, 7.289999961853027, NULL, 'manual', '2026-04-06 11:56:59'),
(9290, 954, '2026-04-04', 13670, 684, 10.25, NULL, 'manual', '2026-04-06 11:56:59'),
(9291, 954, '2026-04-03', 11619, 581, 8.710000038146973, NULL, 'manual', '2026-04-06 11:56:59'),
(9292, 954, '2026-04-02', 11896, 595, 8.920000076293945, NULL, 'manual', '2026-04-06 11:57:00'),
(9293, 954, '2026-04-01', 11748, 587, 8.8100004196167, NULL, 'manual', '2026-04-06 11:57:00'),
(9294, 954, '2026-03-31', 13688, 684, 10.270000457763672, NULL, 'manual', '2026-04-06 11:57:00'),
(9295, 954, '2026-03-30', 13342, 667, 10.010000228881836, NULL, 'manual', '2026-04-06 11:57:01'),
(9296, 954, '2026-03-29', 12188, 609, 9.140000343322754, NULL, 'manual', '2026-04-06 11:57:01'),
(9297, 954, '2026-03-28', 11907, 595, 8.930000305175781, NULL, 'manual', '2026-04-06 11:57:01'),
(9298, 954, '2026-03-27', 11727, 586, 8.800000190734863, NULL, 'manual', '2026-04-06 11:57:01'),
(9299, 954, '2026-03-26', 11781, 589, 8.84000015258789, NULL, 'manual', '2026-04-06 11:57:02'),
(9300, 954, '2026-03-25', 11983, 599, 8.989999771118164, NULL, 'manual', '2026-04-06 11:57:02'),
(9301, 954, '2026-03-24', 12100, 605, 9.079999923706055, NULL, 'manual', '2026-04-06 11:57:02'),
(9302, 955, '2026-04-06', 7737, 387, 5.800000190734863, NULL, 'manual', '2026-04-06 11:57:03'),
(9303, 955, '2026-04-05', 6355, 318, 4.769999980926514, NULL, 'manual', '2026-04-06 11:57:03'),
(9304, 955, '2026-04-04', 10753, 538, 8.0600004196167, NULL, 'manual', '2026-04-06 11:57:03'),
(9305, 955, '2026-04-03', 8552, 428, 6.409999847412109, NULL, 'manual', '2026-04-06 11:57:04'),
(9306, 955, '2026-04-02', 7502, 375, 5.630000114440918, NULL, 'manual', '2026-04-06 11:57:04'),
(9307, 955, '2026-04-01', 7421, 371, 5.570000171661377, NULL, 'manual', '2026-04-06 11:57:04'),
(9308, 955, '2026-03-31', 7599, 380, 5.699999809265137, NULL, 'manual', '2026-04-06 11:57:04'),
(9309, 955, '2026-03-30', 10306, 515, 7.730000019073486, NULL, 'manual', '2026-04-06 11:57:05'),
(9310, 955, '2026-03-29', 8671, 434, 6.5, NULL, 'manual', '2026-04-06 11:57:05'),
(9311, 955, '2026-03-28', 7125, 356, 5.340000152587891, NULL, 'manual', '2026-04-06 11:57:05'),
(9312, 955, '2026-03-27', 7218, 361, 5.409999847412109, NULL, 'manual', '2026-04-06 11:57:06'),
(9313, 955, '2026-03-26', 9139, 457, 6.849999904632568, NULL, 'manual', '2026-04-06 11:57:06'),
(9314, 955, '2026-03-25', 9136, 457, 6.849999904632568, NULL, 'manual', '2026-04-06 11:57:06'),
(9315, 955, '2026-03-24', 7250, 363, 5.440000057220459, NULL, 'manual', '2026-04-06 11:57:06'),
(9316, 956, '2026-04-06', 5427, 271, 4.070000171661377, NULL, 'manual', '2026-04-06 11:57:07'),
(9317, 956, '2026-04-05', 6276, 314, 4.710000038146973, NULL, 'manual', '2026-04-06 11:57:07'),
(9318, 956, '2026-04-04', 9529, 476, 7.150000095367432, NULL, 'manual', '2026-04-06 11:57:07'),
(9319, 956, '2026-04-03', 4794, 240, 3.5999999046325684, NULL, 'manual', '2026-04-06 11:57:08'),
(9320, 956, '2026-04-02', 4967, 248, 3.7300000190734863, NULL, 'manual', '2026-04-06 11:57:08'),
(9321, 956, '2026-04-01', 6681, 334, 5.010000228881836, NULL, 'manual', '2026-04-06 11:57:08'),
(9322, 956, '2026-03-31', 6456, 323, 4.840000152587891, NULL, 'manual', '2026-04-06 11:57:09'),
(9323, 956, '2026-03-30', 5379, 269, 4.03000020980835, NULL, 'manual', '2026-04-06 11:57:09'),
(9324, 956, '2026-03-29', 7258, 363, 5.440000057220459, NULL, 'manual', '2026-04-06 11:57:09'),
(9325, 956, '2026-03-28', 9998, 500, 7.5, NULL, 'manual', '2026-04-06 11:57:10'),
(9326, 956, '2026-03-27', 5330, 267, 4, NULL, 'manual', '2026-04-06 11:57:10'),
(9327, 956, '2026-03-26', 5833, 292, 4.369999885559082, NULL, 'manual', '2026-04-06 11:57:10'),
(9328, 956, '2026-03-25', 7237, 362, 5.429999828338623, NULL, 'manual', '2026-04-06 11:57:10'),
(9329, 956, '2026-03-24', 8190, 410, 6.139999866485596, NULL, 'manual', '2026-04-06 11:57:11'),
(9344, 958, '2026-04-06', 6646, 332, 4.980000019073486, NULL, 'manual', '2026-04-06 11:57:15'),
(9345, 958, '2026-04-05', 8546, 427, 6.409999847412109, NULL, 'manual', '2026-04-06 11:57:16'),
(9346, 958, '2026-04-04', 5492, 275, 4.119999885559082, NULL, 'manual', '2026-04-06 11:57:16'),
(9347, 958, '2026-04-03', 8365, 418, 6.269999980926514, NULL, 'manual', '2026-04-06 11:57:16'),
(9348, 958, '2026-04-02', 6960, 348, 5.21999979019165, NULL, 'manual', '2026-04-06 11:57:16'),
(9349, 958, '2026-04-01', 5031, 252, 3.7699999809265137, NULL, 'manual', '2026-04-06 11:57:17'),
(9350, 958, '2026-03-31', 5445, 272, 4.079999923706055, NULL, 'manual', '2026-04-06 11:57:17'),
(9351, 958, '2026-03-30', 7223, 361, 5.420000076293945, NULL, 'manual', '2026-04-06 11:57:17'),
(9352, 958, '2026-03-29', 8531, 427, 6.400000095367432, NULL, 'manual', '2026-04-06 11:57:18'),
(9353, 958, '2026-03-28', 7003, 350, 5.25, NULL, 'manual', '2026-04-06 11:57:18'),
(9354, 958, '2026-03-27', 6412, 321, 4.809999942779541, NULL, 'manual', '2026-04-06 11:57:18'),
(9355, 958, '2026-03-26', 8459, 423, 6.340000152587891, NULL, 'manual', '2026-04-06 11:57:19'),
(9356, 958, '2026-03-25', 6125, 306, 4.590000152587891, NULL, 'manual', '2026-04-06 11:57:19'),
(9357, 958, '2026-03-24', 7072, 354, 5.300000190734863, NULL, 'manual', '2026-04-06 11:57:19'),
(9358, 959, '2026-04-06', 8731, 437, 6.550000190734863, NULL, 'manual', '2026-04-06 11:57:19'),
(9359, 959, '2026-04-05', 9123, 456, 6.840000152587891, NULL, 'manual', '2026-04-06 11:57:20'),
(9360, 959, '2026-04-04', 5520, 276, 4.139999866485596, NULL, 'manual', '2026-04-06 11:57:20'),
(9361, 959, '2026-04-03', 8693, 435, 6.519999980926514, NULL, 'manual', '2026-04-06 11:57:20'),
(9362, 959, '2026-04-02', 6761, 338, 5.070000171661377, NULL, 'manual', '2026-04-06 11:57:21'),
(9363, 959, '2026-04-01', 5518, 276, 4.139999866485596, NULL, 'manual', '2026-04-06 11:57:21'),
(9364, 959, '2026-03-31', 6202, 310, 4.650000095367432, NULL, 'manual', '2026-04-06 11:57:21'),
(9365, 959, '2026-03-30', 5756, 288, 4.320000171661377, NULL, 'manual', '2026-04-06 11:57:22'),
(9366, 959, '2026-03-29', 8935, 447, 6.699999809265137, NULL, 'manual', '2026-04-06 11:57:22'),
(9367, 959, '2026-03-28', 6009, 300, 4.510000228881836, NULL, 'manual', '2026-04-06 11:57:22'),
(9368, 959, '2026-03-27', 8882, 444, 6.659999847412109, NULL, 'manual', '2026-04-06 11:57:23'),
(9369, 959, '2026-03-26', 8908, 445, 6.679999828338623, NULL, 'manual', '2026-04-06 11:57:23'),
(9370, 959, '2026-03-25', 6752, 338, 5.059999942779541, NULL, 'manual', '2026-04-06 11:57:23'),
(9371, 959, '2026-03-24', 7084, 354, 5.309999942779541, NULL, 'manual', '2026-04-06 11:57:23'),
(9372, 960, '2026-04-06', 7093, 355, 5.320000171661377, NULL, 'manual', '2026-04-06 11:57:24'),
(9373, 960, '2026-04-05', 10576, 529, 7.929999828338623, NULL, 'manual', '2026-04-06 11:57:24'),
(9374, 960, '2026-04-04', 6396, 320, 4.800000190734863, NULL, 'manual', '2026-04-06 11:57:24'),
(9375, 960, '2026-04-03', 6071, 304, 4.550000190734863, NULL, 'manual', '2026-04-06 11:57:25'),
(9376, 960, '2026-04-02', 9329, 466, 7, NULL, 'manual', '2026-04-06 11:57:25'),
(9377, 960, '2026-04-01', 6699, 335, 5.019999980926514, NULL, 'manual', '2026-04-06 11:57:25'),
(9378, 960, '2026-03-31', 6050, 303, 4.539999961853027, NULL, 'manual', '2026-04-06 11:57:26'),
(9379, 960, '2026-03-30', 7244, 362, 5.429999828338623, NULL, 'manual', '2026-04-06 11:57:26'),
(9380, 960, '2026-03-29', 8767, 438, 6.579999923706055, NULL, 'manual', '2026-04-06 11:57:26'),
(9381, 960, '2026-03-28', 11119, 556, 8.34000015258789, NULL, 'manual', '2026-04-06 11:57:26'),
(9382, 960, '2026-03-27', 6760, 338, 5.070000171661377, NULL, 'manual', '2026-04-06 11:57:27'),
(9383, 960, '2026-03-26', 8813, 441, 6.610000133514404, NULL, 'manual', '2026-04-06 11:57:27'),
(9384, 960, '2026-03-25', 7215, 361, 5.409999847412109, NULL, 'manual', '2026-04-06 11:57:27'),
(9385, 960, '2026-03-24', 7689, 384, 5.769999980926514, NULL, 'manual', '2026-04-06 11:57:28'),
(9400, 941, '2026-04-06', 8867, 443, 6.650000095367432, NULL, 'manual', '2026-04-06 11:57:32'),
(9401, 941, '2026-04-05', 8884, 444, 6.659999847412109, NULL, 'manual', '2026-04-06 11:57:32'),
(9402, 941, '2026-04-04', 10237, 512, 7.679999828338623, NULL, 'manual', '2026-04-06 11:57:33'),
(9403, 941, '2026-04-03', 10017, 501, 7.510000228881836, NULL, 'manual', '2026-04-06 11:57:33'),
(9404, 941, '2026-04-02', 9913, 496, 7.429999828338623, NULL, 'manual', '2026-04-06 11:57:33'),
(9405, 941, '2026-04-01', 7424, 371, 5.570000171661377, NULL, 'manual', '2026-04-06 11:57:34'),
(9406, 941, '2026-03-31', 9244, 462, 6.929999828338623, NULL, 'manual', '2026-04-06 11:57:34'),
(9407, 941, '2026-03-30', 8158, 408, 6.119999885559082, NULL, 'manual', '2026-04-06 11:57:34'),
(9408, 941, '2026-03-29', 8052, 403, 6.039999961853027, NULL, 'manual', '2026-04-06 11:57:34'),
(9409, 941, '2026-03-28', 8207, 410, 6.159999847412109, NULL, 'manual', '2026-04-06 11:57:35'),
(9410, 941, '2026-03-27', 10666, 533, 8, NULL, 'manual', '2026-04-06 11:57:35'),
(9411, 941, '2026-03-26', 7964, 398, 5.96999979019165, NULL, 'manual', '2026-04-06 11:57:35'),
(9412, 941, '2026-03-25', 7970, 399, 5.980000019073486, NULL, 'manual', '2026-04-06 11:57:36'),
(9413, 941, '2026-03-24', 10694, 535, 8.020000457763672, NULL, 'manual', '2026-04-06 11:57:36');

-- --------------------------------------------------------
-- Table: `user_follows`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `user_follows`;
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
);

-- --------------------------------------------------------
-- Table: `user_nutrition_plans`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `user_nutrition_plans`;
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
);

-- --------------------------------------------------------
-- Table: `user_progress_photos`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `user_progress_photos`;
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
);

-- --------------------------------------------------------
-- Table: `user_workout_plans`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `user_workout_plans`;
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
);

-- --------------------------------------------------------
-- Table: `users`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `role` varchar(50) DEFAULT 'user',
  `avatar` text,
  `is_premium` tinyint(1) DEFAULT '0',
  `membership_paid` tinyint(1) DEFAULT '0',
  `points` int DEFAULT '0',
  `steps` int DEFAULT '0',
  `height` int DEFAULT NULL,
  `weight` int DEFAULT NULL,
  `gender` varchar(20) DEFAULT NULL,
  `reset_token` text,
  `reset_token_expires` bigint DEFAULT NULL,
  `remember_token` text,
  `security_question` varchar(255) DEFAULT NULL,
  `security_answer` varchar(255) DEFAULT NULL,
  `offline_steps` int DEFAULT '0',
  `last_sync` datetime DEFAULT NULL,
  `coach_membership_active` tinyint(1) DEFAULT '0',
  `step_goal` int DEFAULT '10000',
  `credit` decimal(10,2) DEFAULT '0.00',
  `payment_phone` varchar(30) DEFAULT NULL,
  `payment_wallet_type` varchar(30) DEFAULT NULL,
  `payment_method_type` varchar(30) DEFAULT 'ewallet',
  `paypal_email` varchar(255) DEFAULT NULL,
  `card_holder_name` varchar(100) DEFAULT NULL,
  `card_number` varchar(30) DEFAULT NULL,
  `instapay_handle` varchar(100) DEFAULT NULL,
  `last_active` datetime DEFAULT NULL,
  `medical_history` text,
  `medical_file_url` varchar(500) DEFAULT NULL,
  `email_verified` tinyint(1) DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `location` varchar(255) DEFAULT '',
  `fitness_goal` varchar(30) DEFAULT NULL,
  `activity_level` varchar(20) DEFAULT NULL,
  `target_weight` int DEFAULT NULL,
  `weekly_goal` decimal(4,2) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
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
);

INSERT INTO `users` (`id`, `email`, `password`, `name`, `role`, `avatar`, `is_premium`, `membership_paid`, `points`, `steps`, `height`, `weight`, `gender`, `reset_token`, `reset_token_expires`, `remember_token`, `security_question`, `security_answer`, `offline_steps`, `last_sync`, `coach_membership_active`, `step_goal`, `credit`, `payment_phone`, `payment_wallet_type`, `payment_method_type`, `paypal_email`, `card_holder_name`, `card_number`, `instapay_handle`, `last_active`, `medical_history`, `medical_file_url`, `email_verified`, `created_at`, `updated_at`, `location`, `fitness_goal`, `activity_level`, `target_weight`, `weekly_goal`, `date_of_birth`, `onboarding_done`, `computed_activity_level`, `workouts_completed`, `plans_completed`, `avg_daily_steps`, `streak_days`, `last_activity_update`, `latitude`, `longitude`, `city`, `country`, `location_updated_at`, `payment_phone_vodafone`, `payment_phone_orange`, `payment_phone_we`) VALUES
(936, 'peteradmin@example.com', '$2b$10$Pn2HRGtzwl.4b1UP/Fgmgej5XCkJ8BGxE8OnYUyT/XNRyWrEphCD2', 'Peter Adel', 'admin', NULL, 0, 0, 9999, 0, 178, 80, 'male', NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 10000, '0.00', NULL, NULL, 'ewallet', NULL, NULL, NULL, NULL, '2026-04-10 09:08:27', NULL, NULL, 1, '2026-04-06 11:55:55', '2026-04-10 11:04:58', '', NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(937, 'fake.coachali100@gmail.com', '$2b$10$N4QLlB4x3HPCYcxBrmANI.2ipDiz9RlQcx8YonbuSmc3fs4kSyyji', 'Coach Ali Mahmoud', 'coach', NULL, 1, 0, 2831, 9069, 178, 86, 'male', NULL, NULL, NULL, NULL, NULL, 0, NULL, 1, 10000, '1640.30', NULL, NULL, 'ewallet', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, '2026-04-06 11:55:56', '2026-04-06 11:58:21', '', 'maintain_weight', 'active', 82, '0.25', '1995-04-05 22:00:00', 1, NULL, 0, 0, 7468, 60, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(938, 'fake.coachsar101@yahoo.com', '$2b$10$hacewYVv8YFL2Ma0pVF0G.fYeFkfDl2C5DnpNiKzwGjjwr3TugWFq', 'Coach Sara Fitness', 'coach', NULL, 1, 0, 907, 8555, 185, 79, 'male', NULL, NULL, NULL, NULL, NULL, 0, NULL, 1, 10000, '1715.65', NULL, NULL, 'ewallet', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, '2026-04-06 11:55:57', '2026-04-06 11:58:20', '', 'maintain_weight', 'active', 74, '0.25', '1988-04-05 22:00:00', 1, NULL, 0, 0, 11596, 42, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(939, 'fake.coachmon102@hotmail.com', '$2b$10$hacewYVv8YFL2Ma0pVF0G.fYeFkfDl2C5DnpNiKzwGjjwr3TugWFq', 'Coach Mona Health', 'coach', NULL, 1, 0, 2194, 11677, 172, 65, 'female', NULL, NULL, NULL, NULL, NULL, 0, NULL, 1, 10000, '2335.15', NULL, NULL, 'ewallet', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, '2026-04-06 11:55:57', '2026-04-06 11:58:19', '', 'maintain_weight', 'active', 61, '0.25', '1992-04-05 22:00:00', 1, NULL, 0, 0, 7489, 40, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(940, 'fake.coachkha103@outlook.com', '$2b$10$hacewYVv8YFL2Ma0pVF0G.fYeFkfDl2C5DnpNiKzwGjjwr3TugWFq', 'Coach Khaled Power', 'coach', NULL, 1, 0, 560, 6087, 177, 89, 'male', NULL, NULL, NULL, NULL, NULL, 0, NULL, 1, 10000, '926.65', NULL, NULL, 'ewallet', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, '2026-04-06 11:55:58', '2026-04-06 11:58:17', '', 'maintain_weight', 'active', 83, '0.25', '1987-04-05 22:00:00', 1, NULL, 0, 0, 10196, 40, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(941, 'test@example.com', '$2b$10$yv55/z.I34erT3oyybR73.dzU2c/zlMeq.NWd1Lv3vfd3.iN9to3u', 'Test User', 'user', NULL, 1, 0, 850, 9200, 175, 83, 'male', NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 10000, '0.00', NULL, NULL, 'ewallet', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, '2026-04-06 11:55:59', '2026-04-06 11:55:59', '', 'lose_weight', 'moderate', 75, '0.50', '1998-04-05 22:00:00', 1, NULL, 0, 0, 8700, 14, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(942, 'fake.ahmedhas1@yahoo.com', '$2b$10$hacewYVv8YFL2Ma0pVF0G.fYeFkfDl2C5DnpNiKzwGjjwr3TugWFq', 'Ahmed Hassan', 'user', NULL, 1, 0, 2152, 8648, 173, 85, 'male', NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 15000, '0.00', NULL, NULL, 'ewallet', NULL, NULL, NULL, NULL, '2026-04-01 13:55:59', 'Lower back pain — avoid heavy deadlifts', NULL, 1, '2026-04-06 11:55:59', '2026-04-06 11:55:59', '', 'lose_weight', 'sedentary', 72, '0.50', '2003-04-05 22:00:00', 1, NULL, 0, 0, 7406, 2, NULL, NULL, NULL, 'Cairo', NULL, NULL, NULL, NULL, NULL),
(943, 'fake.omarkhal2@hotmail.com', '$2b$10$hacewYVv8YFL2Ma0pVF0G.fYeFkfDl2C5DnpNiKzwGjjwr3TugWFq', 'Omar Khalid', 'user', NULL, 0, 0, 697, 13895, 176, 70, 'male', NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 8000, '0.00', NULL, NULL, 'ewallet', NULL, NULL, NULL, NULL, '2026-04-04 13:56:00', 'Knee injury (recovered) — no running', NULL, 1, '2026-04-06 11:56:00', '2026-04-06 11:56:00', '', 'build_muscle', 'light', 75, '0.75', '1998-04-05 22:00:00', 1, NULL, 0, 0, 6032, 23, NULL, NULL, NULL, 'Giza', NULL, NULL, NULL, NULL, NULL),
(944, 'fake.youssefi3@outlook.com', '$2b$10$hacewYVv8YFL2Ma0pVF0G.fYeFkfDl2C5DnpNiKzwGjjwr3TugWFq', 'Youssef Ibrahim', 'user', NULL, 0, 0, 218, 12225, 182, 74, 'male', NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 15000, '0.00', NULL, NULL, 'ewallet', NULL, NULL, NULL, NULL, '2026-04-06 13:56:00', '', NULL, 1, '2026-04-06 11:56:00', '2026-04-06 11:56:00', '', 'maintain_weight', 'moderate', 74, '0.75', '1987-04-05 22:00:00', 1, NULL, 0, 0, 11809, 7, NULL, NULL, NULL, 'Alexandria', NULL, NULL, NULL, NULL, NULL),
(946, 'fake.tareknab5@yahoo.com', '$2b$10$hacewYVv8YFL2Ma0pVF0G.fYeFkfDl2C5DnpNiKzwGjjwr3TugWFq', 'Tarek Nabil', 'user', NULL, 0, 0, 1083, 9600, 171, 98, 'male', NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 12000, '0.00', NULL, NULL, 'ewallet', NULL, NULL, NULL, NULL, '2026-04-05 13:56:01', 'Lower back pain — avoid heavy deadlifts', NULL, 1, '2026-04-06 11:56:00', '2026-04-06 11:56:00', '', 'lose_weight', 'very_active', 82, '0.75', '1971-04-05 22:00:00', 1, NULL, 0, 0, 4879, 14, NULL, NULL, NULL, 'Sharm El Sheikh', NULL, NULL, NULL, NULL, NULL),
(947, 'fake.mohamedf6@hotmail.com', '$2b$10$hacewYVv8YFL2Ma0pVF0G.fYeFkfDl2C5DnpNiKzwGjjwr3TugWFq', 'Mohamed Farouk', 'user', NULL, 0, 0, 405, 10293, 176, 77, 'male', NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 10000, '0.00', NULL, NULL, 'ewallet', NULL, NULL, NULL, NULL, '2026-04-06 13:56:01', 'Knee injury (recovered) — no running', NULL, 1, '2026-04-06 11:56:01', '2026-04-06 11:56:01', '', 'build_muscle', 'sedentary', 86, '0.50', '2003-04-05 22:00:00', 1, NULL, 0, 0, 5369, 7, NULL, NULL, NULL, 'Luxor', NULL, NULL, NULL, NULL, NULL),
(948, 'fake.amirsale7@outlook.com', '$2b$10$hacewYVv8YFL2Ma0pVF0G.fYeFkfDl2C5DnpNiKzwGjjwr3TugWFq', 'Amir Saleh', 'user', NULL, 1, 0, 1322, 7202, 188, 66, 'male', NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 15000, '0.00', NULL, NULL, 'ewallet', NULL, NULL, NULL, NULL, '2026-04-04 13:56:01', '', NULL, 1, '2026-04-06 11:56:01', '2026-04-06 11:56:01', '', 'maintain_weight', 'light', 66, '0.50', '1996-04-05 22:00:00', 1, NULL, 0, 0, 7558, 15, NULL, NULL, NULL, 'Aswan', NULL, NULL, NULL, NULL, NULL),
(950, 'fake.sherifad9@yahoo.com', '$2b$10$hacewYVv8YFL2Ma0pVF0G.fYeFkfDl2C5DnpNiKzwGjjwr3TugWFq', 'Sherif Adel', 'user', NULL, 0, 0, 2279, 13019, 187, 87, 'male', NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 8000, '0.00', NULL, NULL, 'ewallet', NULL, NULL, NULL, NULL, '2026-04-06 13:56:02', 'Hypertension — keep heart rate below 150bpm', NULL, 1, '2026-04-06 11:56:02', '2026-04-06 11:56:02', '', 'lose_weight', 'active', 70, '0.75', '1980-04-05 22:00:00', 1, NULL, 0, 0, 8966, 13, NULL, NULL, NULL, 'Tanta', NULL, NULL, NULL, NULL, NULL),
(951, 'fake.hossamwa10@hotmail.com', '$2b$10$hacewYVv8YFL2Ma0pVF0G.fYeFkfDl2C5DnpNiKzwGjjwr3TugWFq', 'Hossam Wael', 'user', NULL, 1, 0, 1215, 12257, 175, 84, 'male', NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 15000, '0.00', NULL, NULL, 'ewallet', NULL, NULL, NULL, NULL, '2026-04-01 13:56:02', '', NULL, 1, '2026-04-06 11:56:02', '2026-04-06 11:56:02', '', 'build_muscle', 'very_active', 87, '0.25', '1966-04-05 22:00:00', 1, NULL, 0, 0, 9477, 11, NULL, NULL, NULL, 'Cairo', NULL, NULL, NULL, NULL, NULL),
(952, 'fake.noureldi11@outlook.com', '$2b$10$hacewYVv8YFL2Ma0pVF0G.fYeFkfDl2C5DnpNiKzwGjjwr3TugWFq', 'Nour El-Din', 'user', NULL, 0, 0, 2491, 2504, 169, 48, 'female', NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 8000, '0.00', NULL, NULL, 'ewallet', NULL, NULL, NULL, NULL, '2026-04-06 13:56:02', 'Mild asthma — avoid extreme cardio intensity', NULL, 1, '2026-04-06 11:56:02', '2026-04-06 11:56:02', '', 'maintain_weight', 'sedentary', 48, '0.75', '2006-04-05 22:00:00', 1, NULL, 0, 0, 12147, 10, NULL, NULL, NULL, 'Giza', NULL, NULL, NULL, NULL, NULL),
(954, 'fake.hanamost13@yahoo.com', '$2b$10$hacewYVv8YFL2Ma0pVF0G.fYeFkfDl2C5DnpNiKzwGjjwr3TugWFq', 'Hana Mostafa', 'user', NULL, 1, 0, 1954, 7044, 158, 75, 'female', NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 15000, '0.00', NULL, NULL, 'ewallet', NULL, NULL, NULL, NULL, '2026-04-06 13:56:03', '', NULL, 1, '2026-04-06 11:56:03', '2026-04-06 11:56:03', '', 'lose_weight', 'moderate', 64, '0.75', '1982-04-05 22:00:00', 1, NULL, 0, 0, 5807, 2, NULL, NULL, NULL, 'Hurghada', NULL, NULL, NULL, NULL, NULL),
(955, 'fake.ranakhal14@hotmail.com', '$2b$10$hacewYVv8YFL2Ma0pVF0G.fYeFkfDl2C5DnpNiKzwGjjwr3TugWFq', 'Rana Khalil', 'user', NULL, 0, 0, 319, 8140, 165, 48, 'female', NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 12000, '0.00', NULL, NULL, 'ewallet', NULL, NULL, NULL, NULL, '2026-04-04 13:56:03', 'Mild asthma — avoid extreme cardio intensity', NULL, 1, '2026-04-06 11:56:03', '2026-04-06 11:56:03', '', 'build_muscle', 'active', 58, '0.75', '1976-04-05 22:00:00', 1, NULL, 0, 0, 6413, 11, NULL, NULL, NULL, 'Sharm El Sheikh', NULL, NULL, NULL, NULL, NULL),
(956, 'fake.dinafawz15@outlook.com', '$2b$10$hacewYVv8YFL2Ma0pVF0G.fYeFkfDl2C5DnpNiKzwGjjwr3TugWFq', 'Dina Fawzy', 'user', NULL, 0, 0, 1109, 8575, 160, 75, 'female', NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 12000, '0.00', NULL, NULL, 'ewallet', NULL, NULL, NULL, NULL, '2026-04-06 13:56:04', '', NULL, 1, '2026-04-06 11:56:03', '2026-04-06 11:56:03', '', 'maintain_weight', 'very_active', 75, '0.25', '1969-04-05 22:00:00', 1, NULL, 0, 0, 10702, 12, NULL, NULL, NULL, 'Luxor', NULL, NULL, NULL, NULL, NULL),
(958, 'fake.lailahas17@yahoo.com', '$2b$10$hacewYVv8YFL2Ma0pVF0G.fYeFkfDl2C5DnpNiKzwGjjwr3TugWFq', 'Laila Hassan', 'user', NULL, 0, 0, 1699, 5856, 159, 58, 'female', NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 15000, '0.00', NULL, NULL, 'ewallet', NULL, NULL, NULL, NULL, '2026-04-02 13:56:04', 'Lower back pain — avoid heavy deadlifts', NULL, 1, '2026-04-06 11:56:04', '2026-04-06 11:56:04', '', 'lose_weight', 'light', 38, '0.25', '1997-04-05 22:00:00', 1, NULL, 0, 0, 10612, 0, NULL, NULL, NULL, 'Mansoura', NULL, NULL, NULL, NULL, NULL),
(959, 'fake.yasminet18@hotmail.com', '$2b$10$hacewYVv8YFL2Ma0pVF0G.fYeFkfDl2C5DnpNiKzwGjjwr3TugWFq', 'Yasmine Tarek', 'user', NULL, 0, 0, 284, 6498, 159, 65, 'female', NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 15000, '0.00', NULL, NULL, 'ewallet', NULL, NULL, NULL, NULL, '2026-04-03 13:56:04', 'Lower back pain — avoid heavy deadlifts', NULL, 1, '2026-04-06 11:56:04', '2026-04-06 11:56:04', '', 'build_muscle', 'moderate', 76, '0.50', '1989-04-05 22:00:00', 1, NULL, 0, 0, 9529, 9, NULL, NULL, NULL, 'Tanta', NULL, NULL, NULL, NULL, NULL),
(960, 'fake.mariamsa19@outlook.com', '$2b$10$hacewYVv8YFL2Ma0pVF0G.fYeFkfDl2C5DnpNiKzwGjjwr3TugWFq', 'Mariam Sayed', 'user', NULL, 1, 0, 778, 2454, 161, 62, 'female', NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 10000, '0.00', NULL, NULL, 'ewallet', NULL, NULL, NULL, NULL, '2026-04-06 13:56:05', '', NULL, 1, '2026-04-06 11:56:04', '2026-04-06 11:56:04', '', 'maintain_weight', 'active', 62, '0.25', '1979-04-05 22:00:00', 1, NULL, 0, 0, 7365, 4, NULL, NULL, NULL, 'Cairo', NULL, NULL, NULL, NULL, NULL),
(962, 'petercoach@example.com', '$2b$10$5wLyvc522L3hb42f/xn.J.pHnARNfOjgO/JZtbIl6wXFMSJIJPc6S', 'Peter Coach', 'coach', NULL, 0, 1, 1000, 12000, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 10000, '0.00', NULL, NULL, 'ewallet', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, '2026-04-06 12:03:21', '2026-04-06 12:03:21', '', NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(963, 'nardeen_adel@gmail.com', '$2b$12$1gyqkzygz76vcUv01vOeQuMXf41h3ypoKw1P.okjQY4sKokD08pOS', 'Nardeen Adel', 'user', NULL, 0, 0, 200, 0, 165, 70, 'female', NULL, NULL, NULL, 'What was the name of your first pet?', '$2b$12$Dlr7ZAiDdedS9LVAt8hMbOn2L5Qv.KiSHyT6igmmNgkX0QdBvaW7y', 0, NULL, 0, 5000, '0.00', NULL, NULL, 'ewallet', NULL, NULL, NULL, NULL, '2026-04-28 22:07:00', '', NULL, 1, '2026-04-24 19:29:29', '2026-04-28 22:07:00', '', 'lose_weight', 'sedentary', 60, '0.25', '1994-10-03 22:00:00', 1, NULL, 0, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- --------------------------------------------------------
-- Table: `video_playlists`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `video_playlists`;
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
);

-- --------------------------------------------------------
-- Table: `website_sections`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `website_sections`;
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
);

INSERT INTO `website_sections` (`id`, `page`, `type`, `label`, `content`, `sort_order`, `is_visible`, `created_at`, `updated_at`) VALUES
(6, 'contact', 'hero', 'Contact Hero', '{`badge`:`Support`,`heading`:"Get in Touch",`subheading`:"Have questions? We\'re here to help.",`backgroundImage`:""}', 1, 1, '2026-03-15 02:04:05', '2026-03-15 02:04:05'),
(7, 'contact', 'contact_info', 'Contact Details', '{`phone`:"+20 123 456 7890",`email`:"support@fitwayhub.com",`chatHours`:"9am – 5pm EST",`faqs`:[]}', 2, 1, '2026-03-15 02:04:06', '2026-03-15 02:04:06'),
(10, 'about', 'hero', 'About Hero', '{`badge`:"Our Story",`heading`:"About Fitway Hub",`headingAccent`:"Egypt\'s #1 Fitness Platform",`subheading`:"We\'re on a mission to make world-class fitness coaching accessible to every Egyptian, anywhere, at any time.",`primaryBtnText`:"Join Us Today",`primaryBtnLink`:"/auth/register",`secondaryBtnText`:"Meet Our Coaches",`secondaryBtnLink`:"/coaches",`backgroundImage`:""}', 1, 1, '2026-03-22 08:08:03', '2026-03-22 08:08:03'),
(11, 'about', 'text_image', 'Our Mission', '{`badge`:"OUR MISSION",`heading`:"Fitness for Everyone",`body`:"Fitway Hub was founded with one belief: everyone deserves access to expert fitness guidance. We bridge the gap between certified coaches and people who want to change their lives — regardless of budget, location, or experience level.\\n\\nFrom AI-powered workout plans to real-time coaching sessions, every feature we build is designed to move you closer to your goal.",`imageUrl`:"",`imageAlt`:"Our Mission",`imagePosition`:`right`}', 2, 1, '2026-03-22 08:08:03', '2026-03-22 08:08:03'),
(12, 'about', 'stats', 'About Stats', '{`items`:[{`value`:"12,000+",`label`:"Active Members"},{`value`:"50+",`label`:"Certified Coaches"},{`value`:"200+",`label`:"Workout Programs"},{`value`:`3`,`label`:"Years Running"}]}', 3, 1, '2026-03-22 08:08:04', '2026-03-22 08:08:04'),
(13, 'about', 'features', 'What We Offer', '{`sectionLabel`:"PLATFORM FEATURES",`heading`:"Everything in one place",`items`:[{`icon`:`Dumbbell`,`title`:"Certified Workouts",`desc`:"Programs built and reviewed by certified coaches for all fitness levels."},{`icon`:`Brain`,`title`:"AI Coaching",`desc`:"Smart insights adapt to your progress, sleep, and activity data."},{`icon`:`BarChart`,`title`:"Progress Analytics",`desc`:"Visual dashboards track every step, calorie, and milestone."},{`icon`:`Users`,`title`:"Live Coaching",`desc`:"Book 1-on-1 sessions and get personalised nutrition and workout plans."},{`icon`:`Bell`,`title`:"Smart Reminders",`desc`:"Push notifications keep you on track without being annoying."},{`icon`:`Globe`,`title`:"Arabic & English",`desc`:"Fully bilingual — every screen available in English and Arabic."}]}', 4, 1, '2026-03-22 08:08:04', '2026-03-22 08:08:04'),
(14, 'about', 'team', 'Our Team', '{`sectionLabel`:"THE TEAM",`heading`:"Built by fitness lovers",`members`:[{`name`:"Ahmed Hassan",`role`:"CEO & Co-Founder",`bio`:"Former national athlete turned tech entrepreneur. 10+ years in fitness.",`imageUrl`:""},{`name`:"Sara Mostafa",`role`:"Head of Coaching",`bio`:"Certified personal trainer and nutritionist with 200+ coached clients.",`imageUrl`:""},{`name`:"Omar Khalid",`role`:`CTO`,`bio`:"Full-stack engineer passionate about building products that matter.",`imageUrl`:""}]}', 5, 1, '2026-03-22 08:08:05', '2026-03-22 08:08:05'),
(15, 'about', 'cta', 'About CTA', '{`badge`:"JOIN THE COMMUNITY",`heading`:"Ready to start your journey?",`subheading`:"Join 12,000+ members already transforming their lives with Fitway Hub.",`btnText`:"Create Free Account",`btnLink`:"/auth/register"}', 99, 1, '2026-03-22 08:08:05', '2026-03-22 08:08:05'),
(23, 'home', 'hero', 'Hero Section', '{`badge`:`NEW`,`heading`:"The Future of Fitness",`headingAccent`:"Starts Here",`subheading`:"Join FitWay Hub to transform your body and mind with our expert coaches and community.",`primaryBtnText`:"Start Now",`primaryBtnLink`:"/auth/register",`secondaryBtnText`:"Learn More",`secondaryBtnLink`:"/about",`backgroundImage`:"https://pub-a510609442944675ba8ca128930bf7ad.r2.dev/cms/image-1775821201698-869503631.jpg"}', 1, 1, '2026-03-23 17:13:01', '2026-04-10 09:40:07'),
(24, 'home', 'stats', 'Stats Section', '{`items`:[{`value`:"10K+",`label`:"Active Users"},{`value`:"50+",`label`:"Expert Coaches"},{`value`:"500+",`label`:"Success Stories"},{`value`:"4.9/5",`label`:"App Rating"}]}', 2, 1, '2026-03-23 17:13:01', '2026-04-10 09:37:47'),
(25, 'home', 'features', 'Features Section', '{`sectionLabel`:`Features`,`heading`:"Why Choose FitWay Hub?",`items`:[{`icon`:`Target`,`title`:"Goal Tracking",`desc`:"Set and achieve your fitness goals with our easy-to-use tracking tools."},{`icon`:`Users`,`title`:"Expert Coaching",`desc`:"Get personalized guidance from our certified fitness professionals."},{`icon`:`Globe`,`title`:"Community Support",`desc`:"Join an active community of fitness enthusiasts to stay motivated."}]}', 4, 1, '2026-03-23 17:13:01', '2026-04-10 09:37:46'),
(26, 'home', 'stats', 'Stats Bar', '{`items`:[{`value`:"12K+",`label`:"Active Members"},{`value`:"50+",`label`:`Programs`},{`value`:"4.9★",`label`:"App Rating"},{`value`:"98%",`label`:`Satisfaction`}]}', 3, 1, '2026-03-23 17:36:51', '2026-04-10 09:37:46'),
(27, 'home', 'features', 'Features Grid', '{`sectionLabel`:"Why Fitway",`heading`:"Everything you need to win",`items`:[{`icon`:`Dumbbell`,`title`:"50+ Workout Programs",`desc`:"Certified and structured for all levels."},{`icon`:`Brain`,`title`:"AI-Powered Coaching",`desc`:"Personalized insights and adaptive goal-setting."},{`icon`:`BarChart`,`title`:"Smart Analytics",`desc`:"Track steps, calories, and trends."},{`icon`:`Users`,`title`:"Community & Challenges",`desc`:"Stay accountable with thousands of members."}]}', 5, 1, '2026-03-23 17:36:51', '2026-04-10 09:37:46'),
(28, 'home', 'cta', 'Bottom CTA', '{`badge`:"JOIN 12,000+ MEMBERS",`heading`:"Your best shape starts today.",`subheading`:"Free to join. No credit card required.",`btnText`:"Create Free Account",`btnLink`:"/auth/register"}', 6, 1, '2026-03-23 17:36:52', '2026-04-10 09:37:46');

-- --------------------------------------------------------
-- Table: `website_translations`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `website_translations`;
CREATE TABLE `website_translations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `text_key` varchar(500) NOT NULL,
  `text_ar` text NOT NULL,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `text_key` (`text_key`)
);

-- --------------------------------------------------------
-- Table: `welcome_messages`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `welcome_messages`;
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
);

-- --------------------------------------------------------
-- Table: `withdrawal_requests`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `withdrawal_requests`;
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
);

-- --------------------------------------------------------
-- Table: `workout_plans`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `workout_plans`;
CREATE TABLE `workout_plans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `coach_id` int DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `days_per_week` int DEFAULT '3',
  `exercises` json DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `workout_plans_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
);

-- --------------------------------------------------------
-- Table: `workout_videos`
-- --------------------------------------------------------

DROP TABLE IF EXISTS `workout_videos`;
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
);

INSERT INTO `workout_videos` (`id`, `title`, `description`, `url`, `duration`, `duration_seconds`, `category`, `is_premium`, `is_short`, `thumbnail`, `coach_id`, `width`, `height`, `created_at`, `updated_at`, `source_type`, `youtube_url`, `approval_status`, `submitted_by`, `approved_by`, `approved_at`, `rejection_reason`) VALUES
(1, ' Level 4 - 30 Minute Tempo Fat-Burning!', 'Easy, Normal, Hard, Repeat! Can you keep up the pace? Powerful tempo bodyweight that burns massive calories!', 'https://www.youtube.com/embed/R30JGe23A24', '24:56', 0, 'Cardio', 0, 0, 'https://img.youtube.com/vi/R30JGe23A24/hqdefault.jpg', 909, 0, 0, '2026-03-23 17:55:31', '2026-04-05 02:24:23', 'youtube', 'https://www.youtube.com/watch?v=R30JGe23A24', 'approved', NULL, NULL, NULL, NULL),
(2, 'How to Create the Perfect Workout Plan  Beginner Guide - Magnus Method ', 'How to Create the Perfect Workout Plan  Beginner Guide - Magnus Method (720p, h264)', 'https://pub-a510609442944675ba8ca128930bf7ad.r2.dev/videos/video-1774295898357-369869236.mp4', '08:09', 40, 'General', 1, 0, '', NULL, 0, 0, '2026-03-23 18:02:15', '2026-03-23 18:02:15', 'upload', NULL, 'approved', NULL, NULL, NULL, NULL),
(3, '1 Hour Bodyweight Marathon Workout (Level 4)', '1 Hour Bodyweight Marathon Workout (Level 4)', 'https://www.youtube.com/embed/Ma6JXe-yL1M', '62:24', 0, 'Cardio', 0, 0, 'https://img.youtube.com/vi/Ma6JXe-yL1M/hqdefault.jpg', NULL, 0, 0, '2026-03-23 18:19:42', '2026-03-23 18:19:42', 'youtube', 'https://www.youtube.com/watch?v=Ma6JXe-yL1M', 'approved', NULL, NULL, NULL, NULL);

SET FOREIGN_KEY_CHECKS=1;
-- End of backup
