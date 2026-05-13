-- MySQL dump 10.13  Distrib 8.0.41, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: webprogram_db
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
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `record_id` bigint NOT NULL COMMENT '关联 process_records.id',
  `operator_id` bigint NOT NULL COMMENT '执行操作的人员ID (关联 users.id)',
  `action_type` varchar(50) NOT NULL COMMENT '动作类型: SUBMIT(提交), REJECT(打回), FIX(修复), PASS(通过)',
  `audit_round` int NOT NULL DEFAULT '1' COMMENT '该动作发生时的审核轮次',
  `comment` text COMMENT '打回原因或修改备注',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_record_round` (`record_id`,`audit_round`),
  KEY `idx_operator` (`operator_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='审核与修改流水记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES (1,38,15,'SUBMIT',1,'完成填报并提交审核','2026-05-12 07:43:43'),(2,39,15,'SUBMIT',1,'完成填报并提交审核','2026-05-13 14:13:08'),(3,39,15,'REJECT',2,'打回','2026-05-13 14:13:45'),(4,39,15,'FIX',2,'修复打回问题并重新提交','2026-05-13 14:14:00');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `checklist_items`
--

LOCK TABLES `checklist_items` WRITE;
/*!40000 ALTER TABLE `checklist_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `checklist_items` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `checklist_template_items`
--

LOCK TABLES `checklist_template_items` WRITE;
/*!40000 ALTER TABLE `checklist_template_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `checklist_template_items` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `checklist_templates`
--

LOCK TABLES `checklist_templates` WRITE;
/*!40000 ALTER TABLE `checklist_templates` DISABLE KEYS */;
/*!40000 ALTER TABLE `checklist_templates` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=268 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `design_work_sessions`
--

LOCK TABLES `design_work_sessions` WRITE;
/*!40000 ALTER TABLE `design_work_sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `design_work_sessions` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `excel_sheet_data`
--

LOCK TABLES `excel_sheet_data` WRITE;
/*!40000 ALTER TABLE `excel_sheet_data` DISABLE KEYS */;
/*!40000 ALTER TABLE `excel_sheet_data` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `item_screenshots`
--

LOCK TABLES `item_screenshots` WRITE;
/*!40000 ALTER TABLE `item_screenshots` DISABLE KEYS */;
/*!40000 ALTER TABLE `item_screenshots` ENABLE KEYS */;
UNLOCK TABLES;

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
  `current_audit_round` int NOT NULL DEFAULT '1' COMMENT '当前审核轮次',
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
  `proofreader_user_id` bigint DEFAULT NULL COMMENT '校对人员的用户ID',
  `sub_equipment` varchar(255) DEFAULT NULL COMMENT '使用设备(副线)',
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `process_records_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=40 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `process_records`
--

LOCK TABLES `process_records` WRITE;
/*!40000 ALTER TABLE `process_records` DISABLE KEYS */;
INSERT INTO `process_records` VALUES (38,93,'123','123',15,'2026-01-21 10:44:26',NULL,NULL,'PENDING_REVIEW',1,14,'123',0,'2026-05-12 07:43:43',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'123'),(39,96,'123','123',15,'2026-05-13 22:12:33',NULL,NULL,'APPROVED',2,15,'打回',0,'2026-05-13 14:14:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,15,'123');
/*!40000 ALTER TABLE `process_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_files`
--

DROP TABLE IF EXISTS `project_files`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_files` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `project_id` bigint NOT NULL COMMENT '关联的项目ID (外键)',
  `document_type` varchar(255) DEFAULT NULL COMMENT '文档类型',
  `file_name` varchar(255) NOT NULL COMMENT '文件名',
  `file_path` varchar(255) NOT NULL COMMENT '文件在服务器上的相对存储路径',
  `file_type` varchar(100) DEFAULT NULL COMMENT '文件MIME类型',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `record_id` bigint DEFAULT NULL,
  `sheet_json_content` json DEFAULT NULL COMMENT '存储Luckysheet格式的JSON数据',
  `parent_id` bigint DEFAULT NULL COMMENT '父文件ID(用于分割文件)',
  PRIMARY KEY (`id`),
  KEY `idx_project_document_type` (`project_id`,`document_type`),
  KEY `idx_project_files_parent_id` (`parent_id`),
  CONSTRAINT `project_files_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6026 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='项目关联文件表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_files`
--

LOCK TABLES `project_files` WRITE;
/*!40000 ALTER TABLE `project_files` DISABLE KEYS */;
INSERT INTO `project_files` VALUES (5588,94,'PLANNING_DOCUMENT_设计过程记录表修订版-V3.3-20250612.XLSX','PLANNING_DOCUMENT_设计过程记录表修订版-V3.3-20250612.XLSX-设计过程记录表修订版-V3.3-20250612.xlsx','94/PLANNING_DOCUMENT_设计过程记录表修订版-V3.3-20250612.XLSX-设计过程记录表修订版-V3.3-20250612.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2025-12-26 10:36:56',NULL,NULL,NULL),(5958,93,'recordMeta','blob','93/38/1768963466540_blob','application/json','2026-01-21 10:44:27',38,NULL,NULL),(5959,93,'包边','包边.xlsx','93/38/1768964487070_包边.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-01-21 10:44:27',38,NULL,NULL),(5960,93,'后工序','后工序.xlsx','93/38/1768963466557_后工序.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-01-21 10:44:27',38,NULL,NULL),(5961,95,'PLANNING_DOCUMENT_ST8项目模具设计策划 书-V1.7-20250414.XLSX','PLANNING_DOCUMENT_ST8项目模具设计策划 书-V1.7-20250414.XLSX-ST8项目模具设计策划 书-V1.7-20250414.xlsx','95/PLANNING_DOCUMENT_ST8项目模具设计策划 书-V1.7-20250414.XLSX-ST8项目模具设计策划 书-V1.7-20250414.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-03-10 14:38:40',NULL,NULL,NULL),(5962,95,'SPLIT_CHILD_SHEET','1-机台设备.xlsx','95/split_output_5961/1-机台设备.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-03-10 14:39:35',NULL,NULL,5961),(5963,95,'SPLIT_CHILD_SHEET','10贴字规范.xlsx','95/split_output_5961/10贴字规范.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-03-10 14:39:35',NULL,NULL,5961),(5964,95,'SPLIT_CHILD_SHEET','11压板槽.xlsx','95/split_output_5961/11压板槽.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-03-10 14:39:35',NULL,NULL,5961),(5965,95,'SPLIT_CHILD_SHEET','12材质选用.xlsx','95/split_output_5961/12材质选用.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-03-10 14:39:35',NULL,NULL,5961),(5966,95,'SPLIT_CHILD_SHEET','13平衡块、到底块、螺销钉.xlsx','95/split_output_5961/13平衡块、到底块、螺销钉.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-03-10 14:39:35',NULL,NULL,5961),(5967,95,'SPLIT_CHILD_SHEET','14标记铭牌.xlsx','95/split_output_5961/14标记铭牌.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-03-10 14:39:35',NULL,NULL,5961),(5968,95,'SPLIT_CHILD_SHEET','15图层.xlsx','95/split_output_5961/15图层.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-03-10 14:39:35',NULL,NULL,5961),(5969,95,'SPLIT_CHILD_SHEET','18修冲模.xlsx','95/split_output_5961/18修冲模.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-03-10 14:39:35',NULL,NULL,5961),(5970,95,'SPLIT_CHILD_SHEET','19翻整模.xlsx','95/split_output_5961/19翻整模.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-03-10 14:39:35',NULL,NULL,5961),(5971,95,'SPLIT_CHILD_SHEET','2-清单.xlsx','95/split_output_5961/2-清单.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-03-10 14:39:35',NULL,NULL,5961),(5972,95,'SPLIT_CHILD_SHEET','20斜楔.xlsx','95/split_output_5961/20斜楔.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-03-10 14:39:35',NULL,NULL,5961),(5973,95,'SPLIT_CHILD_SHEET','21落料模设计标准.xlsx','95/split_output_5961/21落料模设计标准.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-03-10 14:39:35',NULL,NULL,5961),(5974,95,'SPLIT_CHILD_SHEET','22自动化说明.xlsx','95/split_output_5961/22自动化说明.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-03-10 14:39:35',NULL,NULL,5961),(5975,95,'SPLIT_CHILD_SHEET','23备件要求.xlsx','95/split_output_5961/23备件要求.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-03-10 14:39:35',NULL,NULL,5961),(5976,95,'SPLIT_CHILD_SHEET','24.xlsx','95/split_output_5961/24.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-03-10 14:39:35',NULL,NULL,5961),(5977,95,'SPLIT_CHILD_SHEET','25.xlsx','95/split_output_5961/25.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-03-10 14:39:35',NULL,NULL,5961),(5978,95,'SPLIT_CHILD_SHEET','26.xlsx','95/split_output_5961/26.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-03-10 14:39:35',NULL,NULL,5961),(5979,95,'SPLIT_CHILD_SHEET','27.xlsx','95/split_output_5961/27.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-03-10 14:39:35',NULL,NULL,5961),(5980,95,'SPLIT_CHILD_SHEET','29.xlsx','95/split_output_5961/29.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-03-10 14:39:35',NULL,NULL,5961),(5981,95,'SPLIT_CHILD_SHEET','3定位、基准.xlsx','95/split_output_5961/3定位、基准.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-03-10 14:39:35',NULL,NULL,5961),(5982,95,'SPLIT_CHILD_SHEET','4模具存放、限位.xlsx','95/split_output_5961/4模具存放、限位.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-03-10 14:39:35',NULL,NULL,5961),(5983,95,'SPLIT_CHILD_SHEET','5筋厚、减轻孔.xlsx','95/split_output_5961/5筋厚、减轻孔.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-03-10 14:39:35',NULL,NULL,5961),(5984,95,'SPLIT_CHILD_SHEET','6起吊.xlsx','95/split_output_5961/6起吊.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-03-10 14:39:35',NULL,NULL,5961),(5985,95,'SPLIT_CHILD_SHEET','7模具导向.xlsx','95/split_output_5961/7模具导向.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-03-10 14:39:35',NULL,NULL,5961),(5986,95,'SPLIT_CHILD_SHEET','8压料板导向限位.xlsx','95/split_output_5961/8压料板导向限位.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-03-10 14:39:35',NULL,NULL,5961),(5987,95,'SPLIT_CHILD_SHEET','9标准件选用.xlsx','95/split_output_5961/9标准件选用.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-03-10 14:39:35',NULL,NULL,5961),(5988,95,'SPLIT_CHILD_SHEET','更新记录.xlsx','95/split_output_5961/更新记录.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-03-10 14:39:35',NULL,NULL,5961),(5989,95,'SPLIT_CHILD_SHEET','目录.xlsx','95/split_output_5961/目录.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-03-10 14:39:35',NULL,NULL,5961),(5990,95,'SPLIT_CHILD_SHEET','项目特殊说明.xlsx','95/split_output_5961/项目特殊说明.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-03-10 14:39:35',NULL,NULL,5961),(5991,96,'PLANNING_DOCUMENT_DH1项目模具设计式样书-V1.2-20251030.XLSX','PLANNING_DOCUMENT_DH1项目模具设计式样书-V1.2-20251030.XLSX-DH1项目模具设计式样书-V1.2-20251030.xlsx','96/PLANNING_DOCUMENT_DH1项目模具设计式样书-V1.2-20251030.XLSX-DH1项目模具设计式样书-V1.2-20251030.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-05-13 22:10:59',NULL,NULL,NULL),(5992,96,'SPLIT_CHILD_SHEET','1-机台设备.xlsx','96/split_output_5991/1-机台设备.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-05-13 22:11:46',NULL,NULL,5991),(5993,96,'SPLIT_CHILD_SHEET','10贴字规范.xlsx','96/split_output_5991/10贴字规范.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-05-13 22:11:46',NULL,NULL,5991),(5994,96,'SPLIT_CHILD_SHEET','11压板槽.xlsx','96/split_output_5991/11压板槽.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-05-13 22:11:46',NULL,NULL,5991),(5995,96,'SPLIT_CHILD_SHEET','12材质选用.xlsx','96/split_output_5991/12材质选用.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-05-13 22:11:46',NULL,NULL,5991),(5996,96,'SPLIT_CHILD_SHEET','13平衡块、到底块、螺销钉.xlsx','96/split_output_5991/13平衡块、到底块、螺销钉.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-05-13 22:11:46',NULL,NULL,5991),(5997,96,'SPLIT_CHILD_SHEET','14标记铭牌.xlsx','96/split_output_5991/14标记铭牌.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-05-13 22:11:46',NULL,NULL,5991),(5998,96,'SPLIT_CHILD_SHEET','15图层.xlsx','96/split_output_5991/15图层.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-05-13 22:11:46',NULL,NULL,5991),(5999,96,'SPLIT_CHILD_SHEET','18修冲模.xlsx','96/split_output_5991/18修冲模.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-05-13 22:11:46',NULL,NULL,5991),(6000,96,'SPLIT_CHILD_SHEET','19翻整模.xlsx','96/split_output_5991/19翻整模.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-05-13 22:11:46',NULL,NULL,5991),(6001,96,'SPLIT_CHILD_SHEET','2-清单.xlsx','96/split_output_5991/2-清单.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-05-13 22:11:46',NULL,NULL,5991),(6002,96,'SPLIT_CHILD_SHEET','20斜楔.xlsx','96/split_output_5991/20斜楔.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-05-13 22:11:46',NULL,NULL,5991),(6003,96,'SPLIT_CHILD_SHEET','21落料模设计标准.xlsx','96/split_output_5991/21落料模设计标准.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-05-13 22:11:46',NULL,NULL,5991),(6004,96,'SPLIT_CHILD_SHEET','22自动化说明.xlsx','96/split_output_5991/22自动化说明.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-05-13 22:11:46',NULL,NULL,5991),(6005,96,'SPLIT_CHILD_SHEET','23备件要求.xlsx','96/split_output_5991/23备件要求.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-05-13 22:11:46',NULL,NULL,5991),(6006,96,'SPLIT_CHILD_SHEET','24.xlsx','96/split_output_5991/24.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-05-13 22:11:46',NULL,NULL,5991),(6007,96,'SPLIT_CHILD_SHEET','25.xlsx','96/split_output_5991/25.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-05-13 22:11:46',NULL,NULL,5991),(6008,96,'SPLIT_CHILD_SHEET','26.xlsx','96/split_output_5991/26.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-05-13 22:11:46',NULL,NULL,5991),(6009,96,'SPLIT_CHILD_SHEET','27.xlsx','96/split_output_5991/27.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-05-13 22:11:46',NULL,NULL,5991),(6010,96,'SPLIT_CHILD_SHEET','29.xlsx','96/split_output_5991/29.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-05-13 22:11:46',NULL,NULL,5991),(6011,96,'SPLIT_CHILD_SHEET','3定位、基准.xlsx','96/split_output_5991/3定位、基准.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-05-13 22:11:46',NULL,NULL,5991),(6012,96,'SPLIT_CHILD_SHEET','4模具存放、限位.xlsx','96/split_output_5991/4模具存放、限位.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-05-13 22:11:46',NULL,NULL,5991),(6013,96,'SPLIT_CHILD_SHEET','5筋厚、减轻孔.xlsx','96/split_output_5991/5筋厚、减轻孔.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-05-13 22:11:46',NULL,NULL,5991),(6014,96,'SPLIT_CHILD_SHEET','6起吊.xlsx','96/split_output_5991/6起吊.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-05-13 22:11:46',NULL,NULL,5991),(6015,96,'SPLIT_CHILD_SHEET','7模具导向.xlsx','96/split_output_5991/7模具导向.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-05-13 22:11:46',NULL,NULL,5991),(6016,96,'SPLIT_CHILD_SHEET','8压料板导向限位.xlsx','96/split_output_5991/8压料板导向限位.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-05-13 22:11:46',NULL,NULL,5991),(6017,96,'SPLIT_CHILD_SHEET','9标准件选用.xlsx','96/split_output_5991/9标准件选用.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-05-13 22:11:46',NULL,NULL,5991),(6018,96,'SPLIT_CHILD_SHEET','更新记录.xlsx','96/split_output_5991/更新记录.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-05-13 22:11:46',NULL,NULL,5991),(6019,96,'SPLIT_CHILD_SHEET','目录.xlsx','96/split_output_5991/目录.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-05-13 22:11:46',NULL,NULL,5991),(6020,96,'SPLIT_CHILD_SHEET','项目特殊说明.xlsx','96/split_output_5991/项目特殊说明.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-05-13 22:11:46',NULL,NULL,5991),(6021,96,'recordMeta','blob','96/39/1778681553163_blob','application/json','2026-05-13 22:12:33',39,NULL,NULL),(6022,96,'包边','包边.xlsx','96/39/1778681553167_包边.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-05-13 22:12:33',39,NULL,NULL),(6023,96,'动态干涉检查','动态干涉检查.xlsx','96/39/1778681582371_动态干涉检查.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-05-13 22:12:33',39,NULL,NULL),(6024,96,'减重问题清单','减重问题清单.xlsx','96/39/1778681553174_减重问题清单.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-05-13 22:12:33',39,NULL,NULL),(6025,96,'后工序','后工序.xlsx','96/39/1778681553177_后工序.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-05-13 22:12:33',39,NULL,NULL);
/*!40000 ALTER TABLE `project_files` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=97 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='项目信息主表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projects`
--

LOCK TABLES `projects` WRITE;
/*!40000 ALTER TABLE `projects` DISABLE KEYS */;
INSERT INTO `projects` VALUES (93,'策划书','策划书',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(94,'test','test',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(95,'3.10','3.10',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(96,'2026.5.13','2026.5.13',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `projects` ENABLE KEYS */;
UNLOCK TABLES;

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
  `status` enum('OPEN','RESOLVED','CLOSED','KEPT') NOT NULL DEFAULT 'OPEN',
  `created_by_user_id` bigint NOT NULL,
  `confirmed_by_user_id` bigint DEFAULT NULL,
  `confirmed_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `fix_screenshot_path` varchar(500) DEFAULT NULL COMMENT '修改后的证明截图路径',
  `fix_comment` text COMMENT '设计员的修改备注/说明',
  PRIMARY KEY (`id`),
  KEY `record_id` (`record_id`),
  KEY `created_by_user_id` (`created_by_user_id`),
  CONSTRAINT `review_problems_ibfk_1` FOREIGN KEY (`record_id`) REFERENCES `process_records` (`id`) ON DELETE CASCADE,
  CONSTRAINT `review_problems_ibfk_2` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `review_problems`
--

LOCK TABLES `review_problems` WRITE;
/*!40000 ALTER TABLE `review_problems` DISABLE KEYS */;
INSERT INTO `review_problems` VALUES (17,38,'FMC','123','','/uploads/screenshots/2f167a5e-38ee-4399-80f6-20ed2529170f.png','RESOLVED',15,15,'2026-01-21 10:58:38','2026-01-21 02:49:03','2026-01-21 02:58:38','/uploads/screenshots/eb847836-1d9e-4637-82c9-628d57c2b41a.png','test'),(18,39,'FMC','有问题','有问题','/uploads/screenshots/705c1540-877c-4c13-b01b-6bac6c50dab5.png','KEPT',15,15,'2026-05-13 22:13:58','2026-05-13 14:13:39','2026-05-13 14:14:25','/uploads/screenshots/17b8d3d6-2011-4d94-986d-726ab7af4a27.png','解决了');
/*!40000 ALTER TABLE `review_problems` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=109 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Luckysheet表格统计结果快照表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sheet_statistics`
--

LOCK TABLES `sheet_statistics` WRITE;
/*!40000 ALTER TABLE `sheet_statistics` DISABLE KEYS */;
/*!40000 ALTER TABLE `sheet_statistics` ENABLE KEYS */;
UNLOCK TABLES;

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
  `major_risk_ok_symbol` varchar(10) DEFAULT 'OK' COMMENT '重大风险模式下的OK符号',
  `major_risk_ng_symbol` varchar(10) DEFAULT 'NG' COMMENT '重大风险模式下的NG符号',
  `major_risk_na_symbol` varchar(10) DEFAULT 'NA' COMMENT '重大风险模式下的NA符号',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Luckysheet表格统计规则定义表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `statistics_rules`
--

LOCK TABLES `statistics_rules` WRITE;
/*!40000 ALTER TABLE `statistics_rules` DISABLE KEYS */;
/*!40000 ALTER TABLE `statistics_rules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '用户ID，主键，自增',
  `employee_id` varchar(32) NOT NULL COMMENT '工号',
  `real_name` varchar(50) DEFAULT NULL COMMENT '真实姓名',
  `username` varchar(50) NOT NULL COMMENT '用户名，必须唯一',
  `password` varchar(100) NOT NULL COMMENT '加密后的密码',
  `email` varchar(100) DEFAULT NULL COMMENT '用户邮箱，唯一',
  `identity` varchar(20) DEFAULT NULL COMMENT '用户身份',
  `avatar_url` varchar(255) DEFAULT NULL COMMENT '用户头像图片的路径或URL',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `idx_employee_id` (`employee_id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户信息表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (14,'123','123','Admin','$2a$10$0b59tKpwI75KaQzh.5SrgePBQSSD1pmDkwQDuds2V15lhzQ6T0JqC','Admin@qq.com','manager','main/images/faces/default-avatar.png','2025-12-17 20:18:12','2026-03-10 14:51:56'),(15,'CT20000000','彭经纬','彭经纬CT20000000','$2a$10$jDyYTFJ7hD4FgCm.0xZCLeAQjB/hRVOEOFTPTpCRQR9lh.KCd0o3O',NULL,'manager','main/images/faces/default-avatar.png','2025-12-26 10:02:58','2025-12-26 10:02:58');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'webprogram_db'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-13 22:30:18
