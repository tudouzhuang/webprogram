CREATE DATABASE  IF NOT EXISTS `webprogram_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `webprogram_db`;
-- MySQL dump 10.13  Distrib 8.0.41, for Win64 (x86_64)
--
-- Host: localhost    Database: webprogram_db
-- ------------------------------------------------------
-- Server version	8.0.41

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `checklist_items`
--

DROP TABLE IF EXISTS `checklist_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `checklist_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `record_id` bigint NOT NULL COMMENT '关联到 process_records 的外键',
  `item_description` text NOT NULL COMMENT '检查项/问题点的详细描述',
  `designer_status` enum('PENDING','OK','NG','NA') NOT NULL DEFAULT 'PENDING' COMMENT '设计员自检状态',
  `reviewer_status` enum('PENDING','OK','NG','NA') DEFAULT NULL COMMENT '审核员确认状态',
  `designer_remarks` text COMMENT '设计员填写的备注',
  `reviewer_remarks` text COMMENT '审核员填写的备注',
  `designed_by_user_id` bigint DEFAULT NULL COMMENT '设计员ID',
  `designed_at` timestamp NULL DEFAULT NULL COMMENT '设计时间',
  `reviewed_by_user_id` bigint DEFAULT NULL COMMENT '审核员ID',
  `reviewed_at` timestamp NULL DEFAULT NULL COMMENT '审核时间',
  PRIMARY KEY (`id`),
  KEY `idx_record_id` (`record_id`),
  CONSTRAINT `checklist_items_ibfk_1` FOREIGN KEY (`record_id`) REFERENCES `process_records` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='设计检查项/问题卡片表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `checklist_template_items`
--

DROP TABLE IF EXISTS `checklist_template_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `checklist_template_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `template_id` bigint NOT NULL,
  `item_description` text NOT NULL COMMENT '预设的检查项描述',
  `display_order` int NOT NULL DEFAULT '0' COMMENT '用于在列表中显示的顺序',
  PRIMARY KEY (`id`),
  KEY `idx_template_id` (`template_id`),
  CONSTRAINT `checklist_template_items_ibfk_1` FOREIGN KEY (`template_id`) REFERENCES `checklist_templates` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='检查项模板明细表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `checklist_templates`
--

DROP TABLE IF EXISTS `checklist_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `checklist_templates` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `template_name` varchar(255) NOT NULL COMMENT '模板名称, e.g., "FMC阶段通用检查模板"',
  `category` varchar(100) DEFAULT NULL COMMENT '分类, e.g., "冲压", "注塑"',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='检查项模板主表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `design_work_sessions`
--

DROP TABLE IF EXISTS `design_work_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `design_work_sessions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `record_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `start_time` timestamp NOT NULL,
  `end_time` timestamp NULL DEFAULT NULL,
  `duration_seconds` int NOT NULL DEFAULT '0',
  `last_heartbeat_time` timestamp NULL DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `record_id` (`record_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `design_work_sessions_ibfk_1` FOREIGN KEY (`record_id`) REFERENCES `process_records` (`id`) ON DELETE CASCADE,
  CONSTRAINT `design_work_sessions_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=143 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `excel_sheet_data`
--

DROP TABLE IF EXISTS `excel_sheet_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `excel_sheet_data` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `project_id` bigint NOT NULL COMMENT '关联的项目ID',
  `sheet_name` varchar(255) NOT NULL COMMENT '所属Sheet的名称',
  `row_index` int NOT NULL COMMENT '数据在原始Sheet中的行号',
  `row_data_json` json NOT NULL COMMENT '整行的数据，以JSON格式存储',
  PRIMARY KEY (`id`),
  KEY `idx_project_sheet` (`project_id`,`sheet_name`)
) ENGINE=InnoDB AUTO_INCREMENT=12982 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Excel Sheet行数据表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `item_screenshots`
--

DROP TABLE IF EXISTS `item_screenshots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_screenshots` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `item_id` bigint NOT NULL COMMENT '外键，关联 checklist_items 表的ID',
  `uploader_id` bigint NOT NULL COMMENT '上传者用户ID',
  `file_name` varchar(255) NOT NULL COMMENT '原始文件名',
  `file_path` varchar(512) NOT NULL COMMENT '文件在服务器上的相对存储路径',
  `uploaded_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '上传时间',
  PRIMARY KEY (`id`),
  KEY `idx_item_id` (`item_id`),
  CONSTRAINT `fk_screenshots_item_id` FOREIGN KEY (`item_id`) REFERENCES `checklist_items` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='检查项截图关联表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `process_records`
--

DROP TABLE IF EXISTS `process_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `process_records` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `project_id` bigint NOT NULL,
  `part_name` varchar(255) NOT NULL,
  `process_name` varchar(255) NOT NULL,
  `created_by_user_id` bigint DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `specifications_json` json DEFAULT NULL COMMENT '存储所有详细信息的JSON体',
  `source_file_path` varchar(512) DEFAULT NULL COMMENT '关联的原始Excel文件在服务器上的绝对路径',
  `status` varchar(50) DEFAULT 'DRAFT',
  `assignee_id` bigint DEFAULT NULL,
  `rejection_comment` text,
  `total_design_duration_seconds` int NOT NULL DEFAULT '0',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `material` varchar(100) DEFAULT NULL,
  `thickness` decimal(10,2) DEFAULT NULL,
  `tensile_strength` decimal(10,2) DEFAULT NULL,
  `customer_name` varchar(255) DEFAULT NULL,
  `mold_drawing_number` varchar(100) DEFAULT NULL,
  `equipment` varchar(255) DEFAULT NULL,
  `quote_length` decimal(10,2) DEFAULT NULL,
  `quote_width` decimal(10,2) DEFAULT NULL,
  `quote_height` decimal(10,2) DEFAULT NULL,
  `quote_weight` decimal(10,2) DEFAULT NULL,
  `actual_length` decimal(10,2) DEFAULT NULL,
  `actual_width` decimal(10,2) DEFAULT NULL,
  `actual_height` decimal(10,2) DEFAULT NULL,
  `actual_weight` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `process_records_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `project_files`
--

DROP TABLE IF EXISTS `project_files`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_files` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `project_id` bigint NOT NULL COMMENT '关联的项目ID (外键)',
  `document_type` varchar(50) NOT NULL COMMENT '文档的业务类型 (例如: PLANNING_DOCUMENT, CHECK_RECORD)',
  `file_name` varchar(255) NOT NULL COMMENT '文件名',
  `file_path` varchar(255) NOT NULL COMMENT '文件在服务器上的相对存储路径',
  `file_type` varchar(100) DEFAULT NULL COMMENT '文件MIME类型',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `record_id` bigint DEFAULT NULL,
  `sheet_json_content` json DEFAULT NULL COMMENT '存储Luckysheet格式的JSON数据',
  PRIMARY KEY (`id`),
  KEY `idx_project_document_type` (`project_id`,`document_type`),
  CONSTRAINT `project_files_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5236 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='项目关联文件表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects`
--

DROP TABLE IF EXISTS `projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '项目主键ID，自增',
  `project_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '项目号，业务主键，必须唯一',
  `product_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `material` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `part_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `thickness` decimal(10,2) DEFAULT NULL,
  `process` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tensile_strength` decimal(10,2) DEFAULT NULL,
  `mold_drawing_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `equipment` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `customer_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `designer_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `designer_date` date DEFAULT NULL,
  `checker_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `checker_date` date DEFAULT NULL,
  `auditor_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `auditor_date` date DEFAULT NULL,
  `quote_length` decimal(10,2) DEFAULT NULL,
  `quote_width` decimal(10,2) DEFAULT NULL,
  `quote_height` decimal(10,2) DEFAULT NULL,
  `quote_weight` decimal(10,2) DEFAULT NULL,
  `actual_length` decimal(10,2) DEFAULT NULL,
  `actual_width` decimal(10,2) DEFAULT NULL,
  `actual_height` decimal(10,2) DEFAULT NULL,
  `actual_weight` decimal(10,2) DEFAULT NULL,
  `created_by_user_id` int DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `project_number` (`project_number`),
  KEY `idx_product_name` (`product_name`(191)),
  KEY `idx_customer_name` (`customer_name`(191)),
  KEY `idx_part_number` (`part_number`)
) ENGINE=InnoDB AUTO_INCREMENT=88 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='项目信息主表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `review_problems`
--

DROP TABLE IF EXISTS `review_problems`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `review_problems` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `record_id` bigint NOT NULL,
  `stage` varchar(50) NOT NULL,
  `problem_point` text NOT NULL,
  `description` text,
  `screenshot_path` varchar(255) DEFAULT NULL,
  `status` enum('OPEN','RESOLVED','CLOSED') NOT NULL DEFAULT 'OPEN',
  `created_by_user_id` bigint NOT NULL,
  `confirmed_by_user_id` bigint DEFAULT NULL,
  `confirmed_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `record_id` (`record_id`),
  KEY `created_by_user_id` (`created_by_user_id`),
  CONSTRAINT `review_problems_ibfk_1` FOREIGN KEY (`record_id`) REFERENCES `process_records` (`id`) ON DELETE CASCADE,
  CONSTRAINT `review_problems_ibfk_2` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sheet_statistics`
--

DROP TABLE IF EXISTS `sheet_statistics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sheet_statistics` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `file_id` bigint NOT NULL COMMENT '关联的 project_files 表的 ID',
  `category` varchar(100) NOT NULL COMMENT '统计分类, 如 "内审" 或 "FMC"',
  `ok_count` int DEFAULT '0' COMMENT 'OK 的数量',
  `ng_count` int DEFAULT '0' COMMENT 'NG 的数量',
  `na_count` int DEFAULT '0' COMMENT 'N/A 的数量',
  `total_count` int DEFAULT '0' COMMENT '总计项数',
  `calculated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_file_id` (`file_id`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Luckysheet表格统计结果快照表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `statistics_rules`
--

DROP TABLE IF EXISTS `statistics_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `statistics_rules` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `rule_name` varchar(255) NOT NULL COMMENT '规则名称, 如 "内审项统计"',
  `category` varchar(100) NOT NULL COMMENT '统计分类, 如 "内审" 或 "FMC"',
  `sheet_name_pattern` varchar(255) DEFAULT '.*' COMMENT '匹配的工作表名(正则表达式), 默认匹配所有',
  `range_to_scan` varchar(50) NOT NULL COMMENT '要扫描的单元格范围, 如 "C5:C20"',
  `ok_symbol` varchar(10) DEFAULT '√' COMMENT '计为 "OK" 的符号',
  `ng_symbol` varchar(10) DEFAULT '×' COMMENT '计为 "NG" 的符号',
  `na_symbol` varchar(10) DEFAULT '无' COMMENT '计为 "Not Applicable" 的符号',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `total_count_range` varchar(50) DEFAULT NULL COMMENT '用于计算总项数的独立范围, 如 "A10:A50"',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Luckysheet表格统计规则定义表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '用户ID，主键，自增',
  `username` varchar(50) NOT NULL COMMENT '用户名，必须唯一',
  `password` varchar(100) NOT NULL COMMENT '加密后的密码',
  `email` varchar(100) DEFAULT NULL COMMENT '用户邮箱，唯一',
  `identity` varchar(20) DEFAULT NULL COMMENT '用户身份',
  `avatar_url` varchar(255) DEFAULT NULL COMMENT '用户头像图片的路径或URL',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户信息表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-19 13:58:10
