package org.example.project.service.impl;

// --- 基础 Spring 和 DTO/Entity/Mapper 依赖 ---
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.context.annotation.Lazy; // 【【【 1. 确保添加这个 import 】】】
import org.example.project.dto.LuckySheetJsonDTO;
import org.example.project.dto.ProcessRecordCreateDTO;
import org.example.project.entity.ProcessRecord;
import org.example.project.entity.Project;
import org.example.project.entity.ProjectFile;
import org.example.project.entity.User;
import org.example.project.mapper.ProcessRecordMapper;
import org.example.project.mapper.ProjectFileMapper;
import org.example.project.mapper.ProjectMapper;
import org.example.project.mapper.UserMapper;
import org.example.project.service.*;
import org.example.project.service.impl.*;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import java.util.Comparator;
// --- Java IO, NIO, 和 Stream 依赖 ---

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.stream.Collectors;
import org.example.project.entity.ProcessRecordStatus;

import org.springframework.security.access.AccessDeniedException;

import org.example.project.dto.LuckySheetJsonDTO;
import org.example.project.dto.StatisticsResultDTO;
import org.example.project.mapper.ProjectFileMapper;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * ProcessRecordService 的实现类。 负责处理所有与设计过程记录表相关的业务逻辑。
 */
@Service
public class ProcessRecordServiceImpl extends ServiceImpl<ProcessRecordMapper, ProcessRecord>
        implements ProcessRecordService {

    @Autowired
    private ProjectService projectService;
    @Autowired
    private UserService userService;
    @Autowired
    private StatisticsService statisticsService; // 用于获取其他文件的统计结果

    @Lazy
    @Autowired
    private ProcessRecordServiceImpl self; // 注入自己


    private static final Logger log = LoggerFactory.getLogger(ProcessRecordServiceImpl.class);

    // --- 常量定义 ---
    private static final String DOC_TYPE_PROCESS_RECORD_SHEET = "PROCESS_RECORD_SHEET";
    private static final String SPLIT_OUTPUT_DIR_NAME = "split_output";
    private static final String SOURCE_FILE_PREFIX = "source_";

    // --- 依赖注入 ---
    @Autowired
    private final ProcessRecordMapper processRecordMapper;
    private final ProjectFileMapper projectFileMapper;
    private final ExcelSplitterService excelSplitterService;
    private final UserMapper userMapper;
    private final ProjectMapper projectMapper;
    private final String uploadDir;
    private final ObjectMapper objectMapper;

    // --- 构造函数注入 ---
    @Autowired
    public ProcessRecordServiceImpl(
            ProcessRecordMapper processRecordMapper,
            ProjectFileMapper projectFileMapper,
            ExcelSplitterService excelSplitterService,
            UserMapper userMapper,
            ProjectMapper projectMapper,
            @Value("${file.upload-dir}") String uploadDir) {
        this.processRecordMapper = processRecordMapper;
        this.projectFileMapper = projectFileMapper;
        this.excelSplitterService = excelSplitterService;
        this.userMapper = userMapper;
        this.projectMapper = projectMapper;
        this.uploadDir = uploadDir;
        this.objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
    }

    /**
     * 新增的辅助方法：根据绝对路径计算相对于uploadDir的相对路径
     */
    private String calculateRelativePath(Path absolutePath) {
        Path rootPath = Paths.get(this.uploadDir);
        return rootPath.relativize(absolutePath).toString().replace("\\", "/");
    }

    // 在 ProcessRecordServiceImpl 中，添加这个新方法
    @Transactional(propagation = Propagation.REQUIRES_NEW) // 【关键】: 开启一个全新的、独立的事务
    public void triggerStatisticsCalculation(Long fileId, String filePath) {
        log.info("--- [统计-新事务] 准备触发对 fileId: {} 的统计计算...", fileId);
        try {
            List<LuckySheetJsonDTO.SheetData> sheets = excelSplitterService.convertExcelToLuckysheetJson(filePath);
            LuckySheetJsonDTO luckysheetData = new LuckySheetJsonDTO();
            luckysheetData.setSheets(sheets);
            statisticsService.calculateAndSaveStats(fileId, luckysheetData);
            log.info("--- [统计-新事务] 统计计算成功完成。 ---");
        } catch (Exception e) {
            log.error("--- [统计-新事务] 在执行统计计算时发生严重错误！统计数据可能未更新。", e);
            // 即使这里出错，也只会回滚这个新事务，不会影响外层的主事务
        }
    }

    /**
     * 辅助方法：从过程记录表DTO中提取项目信息，并更新到projects表。
     */
    private void updateProjectDetailsFromRecord(Long projectId, ProcessRecordCreateDTO createDTO) {
        Project projectToUpdate = projectMapper.selectById(projectId);
        if (projectToUpdate == null) {
            throw new java.util.NoSuchElementException("无法更新项目信息，因为ID为 " + projectId + " 的项目不存在。");
        }

        log.info("【SERVICE】正在使用过程记录表的信息，更新项目 {} 的详细数据...", projectId);

        BeanUtils.copyProperties(createDTO, projectToUpdate);

        if (createDTO.getQuoteSize() != null) {
            projectToUpdate.setQuoteLength(createDTO.getQuoteSize().getLength());
            projectToUpdate.setQuoteWidth(createDTO.getQuoteSize().getWidth());
            projectToUpdate.setQuoteHeight(createDTO.getQuoteSize().getHeight());
        }
        if (createDTO.getActualSize() != null) {
            projectToUpdate.setActualLength(createDTO.getActualSize().getLength());
            projectToUpdate.setActualWidth(createDTO.getActualSize().getWidth());
            projectToUpdate.setActualHeight(createDTO.getActualSize().getHeight());
        }

        projectMapper.updateById(projectToUpdate);
        log.info("【SERVICE】项目 {} 的详细数据已更新。", projectId);
    }

    /**
     * 辅助方法：从Spring Security上下文中获取当前登录用户的ID。
     */
    private Long getCurrentUserId() {
        try {
            Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
            if (principal instanceof UserDetails) {
                String username = ((UserDetails) principal).getUsername();
                User user = userMapper.selectOne(new QueryWrapper<User>().eq("username", username));
                if (user != null) {
                    log.info("【Security】获取到当前用户: {}, ID: {}", username, user.getId());
                    return user.getId();
                }
            }
        } catch (Exception e) {
            log.warn("【Security】获取当前登录用户ID时发生异常", e);
        }
        log.warn("【Security】无法获取当前登录用户ID，将返回 null。");
        return null;
    }

    private User getCurrentUser() {
        try {
            Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
            if (principal instanceof UserDetails) {
                String username = ((UserDetails) principal).getUsername();
                // 确保 userMapper 已经被注入
                return userMapper.selectByUsername(username);
            } else if (principal instanceof String) {
                return userMapper.selectByUsername((String) principal);
            }
        } catch (Exception e) {
            log.error("获取当前登录用户时发生异常", e);
        }
        return null;
    }

    // --- 查询方法 (保持不变) ---
    @Override
    // 【【【 修改返回类型和实现 】】】
    public List<ProcessRecord> getRecordsByProjectId(Long projectId) {
        log.info("【SERVICE】正在查询项目ID {} 的过程记录表列表...", projectId);
        // 使用 MyBatis-Plus 自带的标准查询方法
        return this.lambdaQuery()
                .eq(ProcessRecord::getProjectId, projectId)
                .orderByDesc(ProcessRecord::getUpdatedAt)
                .list();
    }

    @Override
    public ProcessRecord getRecordById(Long recordId) {
        log.info("【SERVICE】正在查询ID为 {} 的过程记录表详情...", recordId);
        ProcessRecord record = processRecordMapper.selectById(recordId);
        if (record == null) {
            log.warn("【SERVICE】找不到ID为 {} 的过程记录表。", recordId);
            throw new java.util.NoSuchElementException("找不到ID为 " + recordId + " 的过程记录表");
        }
        return record;
    }

    @Override
    public ProjectFile findReviewSheetByRecordId(Long recordId) {
        log.info("【SERVICE】正在查询 recordId {} 对应的审核表...", recordId);

        // 1. 创建查询条件
        QueryWrapper<ProjectFile> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("record_id", recordId)
                .eq("document_type", "REVIEW_SHEET")
                .orderByDesc("id");

        // 2. 查询数据库。使用 getOne 可以简化代码，它会取第一条记录
        ProjectFile reviewSheet = this.projectFileMapper.selectOne(queryWrapper);

        // 3. 判断结果
        if (reviewSheet != null) {
            // 3a. 如果找到了，正常返回
            log.info("【SERVICE】已成功找到 recordId {} 对应的审核表，文件ID为: {}", recordId, reviewSheet.getId());
            return reviewSheet;
        } else {
            // 3b. 如果没找到，构造并返回一个指向模板的“伪” ProjectFile 对象
            log.warn("【SERVICE】未找到 recordId {} 对应的审核表。将返回模板文件信息。", recordId);

            ProjectFile templateFile = new ProjectFile();
            templateFile.setId(-1L); // 使用一个特殊的ID，表示这是模板
            templateFile.setFileName("审核模板.xlsx");

            // 【核心修正】
            // 提供前端可直接访问的模板 API 端点路径，不包含 .xlsx 后缀。
            // 这个路径需要与 FileController 中的 @GetMapping("/templates/{templateName}") 匹配。
            templateFile.setFilePath("/api/files/templates/review-sheet");

            // 使用一个特殊的类型，方便前端识别并采取不同的加载策略
            templateFile.setDocumentType("TEMPLATE_SHEET");

            return templateFile;
        }
    }

    // 在你的 ProcessRecordServiceImpl.java 文件中
    @Override
    @Transactional(rollbackFor = Exception.class)
    public ProjectFile saveReviewSheet(Long recordId, MultipartFile file) throws IOException {

        // =======================================================
        // ↓↓↓ 阶段 1: 接收与验证 ↓↓↓
        // =======================================================
        log.info("==================== 开始执行 saveReviewSheet ====================");
        log.info("【Debug 1.1】接收到请求 - recordId: {}", recordId);

        if (file == null || file.isEmpty()) {
            log.error("【Debug 1.2 - 失败】传入的 MultipartFile 为空！");
            throw new IllegalArgumentException("上传的文件不能为空。");
        }
        log.info("【Debug 1.2】接收到文件 - 原始文件名: '{}', 大小: {} bytes, ContentType: {}",
                file.getOriginalFilename(), file.getSize(), file.getContentType());

        // --- 步骤 1: 验证过程记录是否存在 ---
        ProcessRecord record = processRecordMapper.selectById(recordId);
        if (record == null) {
            log.error("【Debug 1.3 - 失败】在数据库中找不到ID为 {} 的过程记录。", recordId);
            throw new NoSuchElementException("找不到ID为 " + recordId + " 的过程记录，无法保存审核表。");
        }
        log.info("【Debug 1.3】成功找到关联的过程记录: {}", record);

        // =======================================================
        // ↓↓↓ 阶段 2: 旧文件处理 ↓↓↓
        // =======================================================
        log.info("--- 阶段 2: 开始处理旧文件 ---");

        QueryWrapper<ProjectFile> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("record_id", recordId).eq("document_type", "REVIEW_SHEET");
        List<ProjectFile> existingFiles = projectFileMapper.selectList(queryWrapper);
        ProjectFile fileRecordToUpdate = existingFiles.isEmpty() ? null : existingFiles.get(0);

        if (fileRecordToUpdate != null) {
            log.info("【Debug 2.1】在数据库中找到已存在的审核表记录 (ID: {})。", fileRecordToUpdate.getId());
            Path oldFilePath = Paths.get(uploadDir, fileRecordToUpdate.getFilePath());
            log.info("【Debug 2.2】准备删除旧的物理文件，路径: {}", oldFilePath);
            try {
                boolean deleted = Files.deleteIfExists(oldFilePath);
                if (deleted) {
                    log.info("【Debug 2.3】旧的物理文件已成功删除。");
                } else {
                    log.warn("【Debug 2.3】旧的物理文件不存在于该路径，无需删除。");
                }
            } catch (IOException e) {
                log.error("【Debug 2.3 - 失败】删除旧物理文件时发生IO异常！", e);
                // 即使删除失败，我们也可以选择继续执行，用新文件覆盖
            }
        } else {
            log.info("【Debug 2.1】在数据库中未找到已存在的审核表记录，将创建新记录。");
        }

        // =======================================================
        // ↓↓↓ 阶段 3: 新文件保存 ↓↓↓
        // =======================================================
        log.info("--- 阶段 3: 开始保存新文件 ---");

        String originalFilename = StringUtils.cleanPath(file.getOriginalFilename());
        String storedFileName = "REVIEW_" + originalFilename;

        // 【重要】构建绝对物理路径
        Path physicalFilePath = Paths.get(uploadDir, String.valueOf(record.getProjectId()), String.valueOf(recordId),
                storedFileName);
        log.info("【Debug 3.1】新文件的目标绝对物理路径为: {}", physicalFilePath);

        try {
            log.info("【Debug 3.2】准备创建父目录...");
            Files.createDirectories(physicalFilePath.getParent());
            log.info("【Debug 3.3】父目录已确保存在。准备执行文件复制操作...");
            // 执行文件复制
            Files.copy(file.getInputStream(), physicalFilePath, StandardCopyOption.REPLACE_EXISTING);
            log.info("【Debug 3.4】新文件已成功保存至物理路径！");
        } catch (IOException e) {
            log.error("【Debug 3.4 - 失败】保存新物理文件时发生严重IO异常！", e);
            throw e; // 抛出异常，触发事务回滚
        }

        // =======================================================
        // ↓↓↓ 阶段 4: 数据库记录更新/插入 ↓↓↓
        // =======================================================
        log.info("--- 阶段 4: 开始更新/插入数据库记录 ---");

        String relativePath = Paths.get(String.valueOf(record.getProjectId()), String.valueOf(recordId), storedFileName)
                .toString().replace("\\", "/");

        if (fileRecordToUpdate == null) {
            log.info("【Debug 4.1】创建新的 ProjectFile 实体对象...");
            fileRecordToUpdate = new ProjectFile();
            fileRecordToUpdate.setProjectId(record.getProjectId());
            fileRecordToUpdate.setRecordId(recordId);
            fileRecordToUpdate.setDocumentType("REVIEW_SHEET");
        }

        // 统一更新属性
        fileRecordToUpdate.setFileName(storedFileName);
        fileRecordToUpdate.setFilePath(relativePath);
        fileRecordToUpdate.setFileType(file.getContentType());

        if (fileRecordToUpdate.getId() == null) {
            log.info("【Debug 4.2】准备执行 INSERT 操作，实体内容: {}", fileRecordToUpdate);
            projectFileMapper.insert(fileRecordToUpdate);
            log.info("【Debug 4.3】新的审核表文件信息已成功存入数据库, 新文件ID: {}", fileRecordToUpdate.getId());
        } else {
            log.info("【Debug 4.2】准备执行 UPDATE 操作，实体内容: {}", fileRecordToUpdate);
            projectFileMapper.updateById(fileRecordToUpdate);
            log.info("【Debug 4.3】已有的审核表文件信息已成功更新。");
        }

        // =======================================================
        // ↓↓↓ 新增：在文件保存和数据库记录更新后，执行统计计算 ↓↓↓
        // =======================================================
        if (fileRecordToUpdate.getId() != null) {
            log.info("--- [统计] 准备触发对 fileId: {} 的统计计算...", fileRecordToUpdate.getId());
            try {
                // 1. 使用 ExcelSplitterService 将刚刚保存的文件，反向解析回 Luckysheet JSON 数据
                List<LuckySheetJsonDTO.SheetData> sheets = excelSplitterService
                        .convertExcelToLuckysheetJson(physicalFilePath.toString());
                LuckySheetJsonDTO luckysheetData = new LuckySheetJsonDTO();
                luckysheetData.setSheets(sheets);

                // 2. 正式调用统计服务
                statisticsService.calculateAndSaveStats(fileRecordToUpdate.getId(), luckysheetData);
                log.info("--- [统计] 统计计算成功完成。 ---");
            } catch (Exception e) {
                // 即使统计失败，也不应该影响主流程的成功返回，只记录错误日志。
                log.error("--- [统计] 在执行统计计算时发生严重错误！统计数据可能未更新。", e);
            }
        } else {
            log.warn("--- [统计] 跳过统计，因为未能获取到文件的数据库ID。");
        }
        // --- 统计逻辑结束 ---

        // =======================================================
        // ↓↓↓ 阶段 5: 更新主记录状态 ↓↓↓
        // =======================================================
        log.info("--- 阶段 5: 开始更新主记录状态 ---");

        record.setStatus(ProcessRecordStatus.APPROVED);
        processRecordMapper.updateById(record);
        log.info("【Debug 5.1】过程记录 {} 的状态已更新为 '初步审核'。", recordId);

        log.info("==================== 成功结束 saveReviewSheet ====================");
        return fileRecordToUpdate;
    }

    /**
     * 【新增私有方法】智能分配算法的实现
     */
    private Long findLeastBusyReviewerId() {
        // 1. 获取所有审核员
        List<User> allReviewers = userService.findUsersByRole("REVIEWER"); // 假设角色名为 "REVIEWER"
        if (allReviewers == null || allReviewers.isEmpty()) {
            log.error("【智能分配-失败】系统中没有配置任何审核员！");
            // 在这里可以决定是抛出异常，还是分配给一个默认的管理员
            throw new IllegalStateException("系统中没有可用的审核员来分配任务。");
        }

        List<Long> reviewerIds = allReviewers.stream().map(User::getId).collect(Collectors.toList());

        // 2. 查询这些审核员的待办任务数
        List<Map<String, Object>> taskCountsResult = baseMapper.countPendingTasksByAssignees(reviewerIds);

        // 将查询结果转换为更易于使用的 Map<Long, Long>
        Map<Long, Long> taskCounts = taskCountsResult.stream()
                .collect(Collectors.toMap(
                        row -> (Long) row.get("assigneeId"),
                        row -> (Long) row.get("taskCount")));

        // 3. 找出任务最少的人 (Java Stream API 的优雅写法)
        return allReviewers.stream()
                .min(Comparator.comparing(reviewer -> taskCounts.getOrDefault(reviewer.getId(), 0L)))
                .map(User::getId)
                .orElseThrow(() -> new IllegalStateException("无法确定最空闲的审核员。")); // 理论上不会发生
    }

    @Override
    @Transactional
    public void reassignTask(Long recordId, Long newAssigneeId) {
        // --- 调试点 1: 获取并打印当前用户信息 ---
        User currentUser = getCurrentUser(); // 确保您有一个返回完整User对象的方法
        if (currentUser == null) {
            log.error("【SERVICE-REASSIGN-FAIL】无法获取当前用户信息，操作被拒绝！");
            throw new AccessDeniedException("无法验证当前用户信息。");
        }
        Long currentUserId = currentUser.getId();
        String currentUserRole = currentUser.getIdentity();

        log.info("--- [REASSIGN TASK] ---");
        log.info("  - Record ID: {}", recordId);
        log.info("  - Operator: {} (ID: {}, Role: {})", currentUser.getUsername(), currentUserId, currentUserRole);
        log.info("  - Target Assignee ID: {}", newAssigneeId);

        // --- 步骤 1: 验证记录 ---
        ProcessRecord record = this.getById(recordId);
        if (record == null) {
            throw new RuntimeException("操作失败：找不到ID为 " + recordId + " 的记录。");
        }
        log.info("  - Record Found. Current Assignee ID: {}", record.getAssigneeId());

        // --- 步骤 2: 【【【修正后的权限校验】】】 ---
        log.info("  - Performing permission check...");

        boolean isManagerOrAdmin = "MANAGER".equalsIgnoreCase(currentUserRole)
                || "ADMIN".equalsIgnoreCase(currentUserRole);
        boolean isCurrentAssignee = record.getAssigneeId() != null && record.getAssigneeId().equals(currentUserId);

        // 调试日志，清晰地显示判断依据
        log.info("  - Is Operator the Current Assignee? -> {}", isCurrentAssignee);
        log.info("  - Is Operator a Manager/Admin? -> {}", isManagerOrAdmin);

        // 只有“当前负责人”或者“管理员”才能执行转交
        if (!isCurrentAssignee && !isManagerOrAdmin) {
            log.error("【SERVICE-REASSIGN-FAIL】Permission Denied. Operator is neither the assignee nor an admin.");
            throw new AccessDeniedException("权限不足：您不是当前任务的负责人，也没有管理员权限。");
        }
        log.info("  - Permission Check: PASSED");

        // --- 步骤 3: 状态校验 (保持不变) ---
        if (record.getStatus() != ProcessRecordStatus.PENDING_REVIEW) {
            throw new IllegalStateException("操作失败：任务当前状态为 [" + record.getStatus() + "]，而不是[待审核]，无法转交。");
        }

        // --- 步骤 4: 校验目标用户 (保持不变) ---
        User newAssignee = userMapper.selectById(newAssigneeId);
        if (newAssignee == null) {
            throw new IllegalArgumentException("操作失败：找不到ID为 " + newAssigneeId + " 的目标用户。");
        }
        String newAssigneeRole = newAssignee.getIdentity();
        if (!"REVIEWER".equalsIgnoreCase(newAssigneeRole) && !"MANAGER".equalsIgnoreCase(newAssigneeRole)) {
            throw new IllegalArgumentException("操作失败：目标用户 " + newAssignee.getUsername() + " 不是一个有效的审核员。");
        }

        // --- 步骤 5: 执行更新 (保持不变) ---
        record.setAssigneeId(newAssigneeId);
        this.updateById(record);
        log.info("  - SUCCESS! Task reassigned to {} (ID: {})", newAssignee.getUsername(), newAssigneeId);
        log.info("--- [END REASSIGN TASK] ---");
    }

    // 在 ProcessRecordServiceImpl.java 中
    @Override
    @Transactional
    public void requestChanges(Long recordId, String comment) {
        Long currentUserId = getCurrentUserId();
        User currentUser = userMapper.selectById(currentUserId); // 获取当前用户完整信息

        if (currentUser == null) {
            throw new AccessDeniedException("无法验证当前用户信息。");
        }

        ProcessRecord record = this.getById(recordId);
        if (record == null) {
            throw new RuntimeException("记录不存在，ID: " + recordId);
        }

        // =======================================================
        // ↓↓↓ 【核心逻辑修正】 ↓↓↓
        // 重新设计权限校验，使其更健壮
        // =======================================================
        boolean hasPermission = false;

        // 场景1: 任务正在流转中 (待审核)，必须是当前负责人
        if (record.getStatus() == ProcessRecordStatus.PENDING_REVIEW) {
            if (record.getAssigneeId() != null && record.getAssigneeId().equals(currentUserId)) {
                hasPermission = true;
            }
        } // 场景2: 任务已批准，需要打回。此时应检查用户角色。
        else if (record.getStatus() == ProcessRecordStatus.APPROVED) {
            // 假设 User 实体有 getIdentity() 方法返回角色字符串, 例如 "REVIEWER"
            if ("MANAGER".equalsIgnoreCase(currentUser.getIdentity())
                    || "ADMIN".equalsIgnoreCase(currentUser.getIdentity())) {
                hasPermission = true;
            }
        }

        if (!hasPermission) {
            throw new AccessDeniedException("权限不足：您无权对此记录执行打回操作。");
        }

        // 业务规则校验 (保持不变)
        if (record.getStatus() != ProcessRecordStatus.APPROVED
                && record.getStatus() != ProcessRecordStatus.PENDING_REVIEW) {
            throw new IllegalStateException("操作失败：当前状态无法打回。");
        }

        // 执行更新 (保持不变)
        record.setRejectionComment(comment);
        record.setStatus(ProcessRecordStatus.CHANGES_REQUESTED);
        record.setAssigneeId(record.getCreatedByUserId()); // 将任务交还给创建者
        this.updateById(record);

        System.out.println("记录 " + recordId + " 已被打回，原因: " + comment);
    }

    @Override
    @Transactional
    public void approveRecord(Long recordId) {
        try {
            log.info("--- [Approve] 开始执行 approveRecord 事务 for recordId: {} ---", recordId);

            // 1. 获取当前用户和目标记录
            User currentUser = getCurrentUser();
            ProcessRecord record = this.getById(recordId);
            if (record == null) {
                throw new NoSuchElementException("记录不存在");
            }

            // 2. 权限与状态校验
            if (!Objects.equals(record.getAssigneeId(), currentUser.getId())) {
                throw new AccessDeniedException("权限不足，您不是当前任务的负责人。");
            }
            if (record.getStatus() != ProcessRecordStatus.PENDING_REVIEW) {
                throw new IllegalStateException("操作失败：当前状态无法批准。");
            }

            // 3. 校对人员判定逻辑
            if (record.getProofreaderUserId() == null && record.getRejectionComment() != null) {
                log.info("【校对判定】记录 #{} 的 rejection_comment 不为空。设置校对人员 ID: {}", recordId, currentUser.getId());
                record.setProofreaderUserId(currentUser.getId());
            }

            // 4. 更新记录状态
            record.setStatus(ProcessRecordStatus.APPROVED);
            record.setAssigneeId(null);

            log.info("--- [Approve] 准备执行 updateById 操作...");
            this.updateById(record);
            log.info("--- [Approve] updateById 操作执行完毕。数据库现在应该已更新（但事务未提交）。");

            log.info("记录 {} 已被用户 {} 批准。", recordId, currentUser.getUsername());

        } catch (Exception e) {
            // 【【【 核心修正 1：添加 catch 块以捕获任何潜在的异常 】】】
            // 如果在 try 块的任何地方（包括 log.info）发生异常，都会被这里捕获。
            log.error("--- [Approve - CATCH] 在 approveRecord 事务执行期间捕获到异常！事务将被回滚。", e);

            // 【【【 核心修正 2：重新抛出异常 】】】
            // 这一步至关重要！它告诉 Spring 的事务管理器：“嘿，出错了，快回滚！”
            // 如果没有这一行，事务管理器会认为一切正常，并尝试提交一个已被标记为 rollback-only 的事务，从而导致我们之前看到的 UnexpectedRollbackException。
            throw e;

        } finally {
            // 【【【 核心修正 3：在 finally 块中增加更详细的日志 】】】
            log.info("--- [Approve - FINALLY] 即将退出方法，事务将要提交或回滚。");
            // 重新从数据库查询，以检查（在当前事务视图内）的最终状态
            ProcessRecord finalRecordInDb = this.getById(recordId);
            if (finalRecordInDb != null) {
                log.info("    -> [FINALLY] 数据库中 proofreader_user_id 的值是: {}", finalRecordInDb.getProofreaderUserId());
                log.info("    -> [FINALLY] 数据库中 status 的值是: {}", finalRecordInDb.getStatus());
            } else {
                log.warn("    -> [FINALLY] 警告：在 finally 块中找不到记录！");
            }
            log.info("--- [Approve - FINALLY] 检查结束。---");
        }
    }

    @Override
    @Transactional // 确保文件操作和数据库更新是一个原子操作
    public void resubmit(Long recordId, MultipartFile file) throws IOException {
        Long currentUserId = getCurrentUserId();

        // 1. --- 验证记录和权限 ---
        ProcessRecord record = this.getById(recordId);
        if (record == null) {
            throw new RuntimeException("记录不存在，ID: " + recordId);
        }

        // 权限校验: 必须是当前负责人(设计员) 并且 状态必须是“待修改”
        if (!record.getAssigneeId().equals(currentUserId)) {
            throw new AccessDeniedException("权限不足：您不是当前任务的负责人。");
        }
        if (record.getStatus() != ProcessRecordStatus.CHANGES_REQUESTED) {
            throw new IllegalStateException("操作失败：记录当前状态不是“待修改”，无法重新提交。");
        }

        // 2. --- 处理文件替换 ---
        // 2.1 查找旧的源文件记录 (SOURCE_RECORD)
        QueryWrapper<ProjectFile> fileQuery = new QueryWrapper<>();
        fileQuery.eq("record_id", recordId).eq("document_type", "SOURCE_RECORD");
        ProjectFile sourceFileRecord = projectFileMapper.selectOne(fileQuery);

        if (sourceFileRecord == null) {
            // 理论上不应该发生，每个记录都应该有一个源文件
            throw new IllegalStateException("数据不一致：找不到记录ID " + recordId + " 的原始设计文件。");
        }

        // 2.2 删除旧的物理文件 (可选但推荐)
        Path oldPhysicalPath = Paths.get(uploadDir, sourceFileRecord.getFilePath());
        Files.deleteIfExists(oldPhysicalPath);

        // 2.3 保存新的物理文件
        String originalFilename = StringUtils.cleanPath(file.getOriginalFilename());
        // 保持和创建时一致的文件命名和存储结构
        String storedFileName = "source_" + originalFilename;
        Path newPhysicalPath = Paths.get(uploadDir, String.valueOf(record.getProjectId()), String.valueOf(recordId),
                storedFileName);

        Files.createDirectories(newPhysicalPath.getParent());
        Files.copy(file.getInputStream(), newPhysicalPath, StandardCopyOption.REPLACE_EXISTING);

        // 2.4 更新 project_files 表中的记录
        String newRelativePath = Paths
                .get(String.valueOf(record.getProjectId()), String.valueOf(recordId), storedFileName).toString()
                .replace("\\", "/");
        sourceFileRecord.setFileName(storedFileName);
        sourceFileRecord.setFilePath(newRelativePath);
        sourceFileRecord.setFileType(file.getContentType());
        projectFileMapper.updateById(sourceFileRecord);

        // 3. --- 更新主记录状态和负责人 ---
        record.setStatus(ProcessRecordStatus.PENDING_REVIEW); // 状态改回“待审核”
        // 将任务重新分配给审核员，这里我们使用一个“智能分配”或“固定分配”的逻辑
        // Long reviewerId = findDefaultReviewerForProject(record.getProjectId()); //
        // 示例：找到项目默认审核员
        Long reviewerId = findLeastBusyReviewerId(); // 使用你之前写的智能分配算法
        record.setAssigneeId(reviewerId);

        this.updateById(record);
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteRecordById(Long recordId) throws IOException {
        // 1. 获取当前登录用户及其角色
        Long currentUserId = getCurrentUserId();
        User currentUser = userMapper.selectById(currentUserId);
        if (currentUser == null) {
            throw new AccessDeniedException("无法验证当前用户信息。");
        }

        // 2. 查找要删除的记录
        ProcessRecord record = this.getById(recordId);
        if (record == null) {
            log.warn("用户 {} 尝试删除一个不存在的记录 #{}", currentUser.getUsername(), recordId);
            return; // 记录不存在，直接返回成功，幂等操作
        }

        // 3. 【核心权限校验】
        String userRole = currentUser.getIdentity();
        boolean isAdmin = "ADMIN".equalsIgnoreCase(userRole) || "MANAGER".equalsIgnoreCase(userRole);

        // 只有管理员才能执行删除
        if (!isAdmin) {
            throw new AccessDeniedException("权限不足：只有管理员才能删除已提交的记录。");
        }

        // 4. 执行删除操作
        log.info("管理员 {} 正在删除记录 #{}...", currentUser.getUsername(), recordId);

        // 4.1 删除所有关联的物理文件
        List<ProjectFile> associatedFiles = projectService.getFilesByRecordId(recordId);
        for (ProjectFile file : associatedFiles) {
            Path filePath = Paths.get(uploadDir, file.getFilePath());
            try {
                Files.deleteIfExists(filePath);
                log.info("已删除关联文件: {}", filePath);
            } catch (IOException e) {
                log.error("删除物理文件 {} 失败，但将继续执行数据库删除。", file.getFilePath(), e);
            }
        }

        // 4.2 (如果适用) 删除 process_records 表中的 source_file_path 指向的文件
        if (record.getSourceFilePath() != null && !record.getSourceFilePath().isEmpty()) {
            Path sourcePath = Paths.get(uploadDir, record.getSourceFilePath());
            try {
                Files.deleteIfExists(sourcePath);
                log.info("已删除主记录关联文件: {}", sourcePath);
            } catch (IOException e) {
                log.error("删除主记录文件 {} 失败。", sourcePath, e);
            }
        }

        // 4.3 删除 project_files 表中的所有关联记录
        QueryWrapper<ProjectFile> fileQuery = new QueryWrapper<>();
        fileQuery.eq("record_id", recordId);
        projectFileMapper.delete(fileQuery);

        // 4.4 删除 process_records 表中的主记录
        this.removeById(recordId);

        log.info("管理员 {} 成功删除了记录 #{}", currentUser.getUsername(), recordId);
    }

    @Override
    @Transactional
    public void updateAssociatedFile(Long recordId, Long fileId, MultipartFile file) throws IOException {
        log.info("【SERVICE-UPDATE_FILE】开始更新文件, recordId: {}, fileId: {}", recordId, fileId);

        // 1. 验证文件是否为空
        if (file.isEmpty()) {
            throw new IllegalArgumentException("上传的文件不能为空。");
        }

        // 2. 查找并验证文件记录 (ProjectFile)
        // 确保它存在，并且确实属于传入的 recordId
        ProjectFile fileRecord = projectFileMapper.selectById(fileId);
        if (fileRecord == null) {
            throw new NoSuchElementException("找不到ID为 " + fileId + " 的文件记录。");
        }
        if (!fileRecord.getRecordId().equals(recordId)) {
            // 安全性检查，防止恶意用户尝试更新不属于自己的文件
            throw new AccessDeniedException("权限错误：文件 " + fileId + " 不属于过程记录 " + recordId);
        }
        log.info("【SERVICE-UPDATE_FILE】文件记录校验通过。");

        // 3. 删除旧的物理文件
        // fileRecord.getFilePath() 中存储的是相对路径，如 "70/19/xxx.xlsx"
        Path oldPath = Paths.get(uploadDir, fileRecord.getFilePath());
        try {
            Files.deleteIfExists(oldPath);
            log.info("【SERVICE-UPDATE_FILE】旧物理文件已删除: {}", oldPath);
        } catch (IOException e) {
            log.error("【SERVICE-UPDATE_FILE】删除旧物理文件失败，但将继续执行覆盖操作。", e);
        }

        // 4. 保存新的物理文件 (保持原有的目录结构)
        String originalFilename = StringUtils.cleanPath(file.getOriginalFilename());
        // 为了避免重名，仍然建议使用时间戳或UUID
        String newStoredFileName = System.currentTimeMillis() + "_" + originalFilename;

        // 构建新的相对路径和绝对路径
        Path newRelativePath = Paths.get(String.valueOf(fileRecord.getProjectId()), String.valueOf(recordId),
                newStoredFileName);
        Path newAbsolutePath = Paths.get(uploadDir).resolve(newRelativePath);

        Files.createDirectories(newAbsolutePath.getParent());
        Files.copy(file.getInputStream(), newAbsolutePath, StandardCopyOption.REPLACE_EXISTING);
        log.info("【SERVICE-UPDATE_FILE】新物理文件已保存: {}", newAbsolutePath);
        // =======================================================
        // ↓↓↓ 新增：在文件更新成功后，执行统计计算 ↓↓↓
        // =======================================================
        if (fileId != null) {
            // 调用 self (代理对象) 的方法，这样 @Transactional(propagation = REQUIRES_NEW) 才能生效
            self.triggerStatisticsCalculation(fileId, newAbsolutePath.toString());
        } else {
            log.warn("--- [统计] 跳过统计，因为未能获取到文件的数据库ID。");
        }
        // --- 统计逻辑结束 ---
        // 5. 更新数据库中的文件记录 (ProjectFile)
        fileRecord.setFileName(originalFilename); // 存储原始文件名
        fileRecord.setFilePath(newRelativePath.toString().replace("\\", "/")); // 更新为新的相对路径
        // fileRecord.setFileType(file.getContentType()); // 可选：更新文件类型
        // fileRecord.setUpdatedAt(LocalDateTime.now()); // 可选：更新时间戳
        projectFileMapper.updateById(fileRecord);
        log.info("【SERVICE-UPDATE_FILE】数据库中的文件记录 (ID: {}) 已成功更新。", fileId);

    }

    /**
     * 【新增实现 2】: 启动审核流程
     */
    @Override
    @Transactional
    public void startReviewProcess(Long recordId) {
        // 1. 验证记录是否存在
        ProcessRecord record = processRecordMapper.selectById(recordId);
        if (record == null) {
            throw new IllegalArgumentException("ID为 " + recordId + " 的过程记录不存在。");
        }

        // 2. 状态检查：必须是 DRAFT 或 CHANGES_REQUESTED 状态才能提交
        ProcessRecordStatus currentStatus = record.getStatus();
        if (currentStatus != ProcessRecordStatus.DRAFT && currentStatus != ProcessRecordStatus.CHANGES_REQUESTED) {
            throw new IllegalStateException("当前记录状态为 " + currentStatus + "，无法提交审核。");
        }

        // 3. 智能分配审核员 (这里的逻辑可以根据你的需求调整)
        // 简单策略：找到第一个角色为 'MANAGER' 的用户
        // 复杂策略：可以查询每个审核员的待办任务数，分配给最少的那个
        List<User> reviewers = userMapper.findByRole("MANAGER"); // 假设审核员角色是 MANAGER
        if (reviewers.isEmpty()) {
            throw new IllegalStateException("系统中没有可用的审核员！");
        }
        User assignee = reviewers.get(0); // 简单地分配给第一个找到的审核员

        // 4. 更新记录状态和负责人
        record.setStatus(ProcessRecordStatus.PENDING_REVIEW);
        record.setAssigneeId(assignee.getId());
        // record.setUpdatedAt(LocalDateTime.now()); // 可选：更新修改时间

        processRecordMapper.updateById(record);

        System.out.println("成功将 recordId=" + recordId + " 提交审核，分配给 assigneeId=" + assignee.getId());
    }

/**
     * 【严格版】自动化填充逻辑
     * 规则：
     * 1. 仅在【当前记录 (Record)】的文件列表中查找。
     * 2. 如果找到对应文件 -> 读取统计结果 (OK/NG)。
     * 3. 如果没找到对应文件 -> 直接填入 "NA" (灰色)。
     */
    @Override
    public void autoFillRiskSheetData(Long recordId, List<LuckySheetJsonDTO.SheetData> sheets) {
        log.info("【AutoFill】执行风险清单填充 (严格模式)，RecordId: {}", recordId);

        // 1. 仅获取【当前记录】下的文件
        QueryWrapper<ProjectFile> query = new QueryWrapper<>();
        query.eq("record_id", recordId);
        List<ProjectFile> currentFiles = projectFileMapper.selectList(query);

        if (sheets == null || sheets.isEmpty()) return;

        for (LuckySheetJsonDTO.SheetData sheet : sheets) {
            List<LuckySheetJsonDTO.CellData> cellDataList = sheet.getCelldata();
            if (cellDataList == null || cellDataList.isEmpty()) continue;

            // 构建 Grid 索引
            Map<Integer, Map<Integer, LuckySheetJsonDTO.CellData>> grid = new HashMap<>();
            for (LuckySheetJsonDTO.CellData cell : cellDataList) {
                if (cell != null) {
                    grid.computeIfAbsent(cell.getR(), k -> new HashMap<>()).put(cell.getC(), cell);
                }
            }

            // 逐行扫描
            for (Map.Entry<Integer, Map<Integer, LuckySheetJsonDTO.CellData>> rowEntry : grid.entrySet()) {
                Integer r = rowEntry.getKey();
                Map<Integer, LuckySheetJsonDTO.CellData> rowCells = rowEntry.getValue();

                String targetFileName = null;
                int descriptionColIndex = -1;

                // 3.1 寻找引用 《...》
                for (Map.Entry<Integer, LuckySheetJsonDTO.CellData> cellEntry : rowCells.entrySet()) {
                    Integer c = cellEntry.getKey();
                    LuckySheetJsonDTO.CellData cell = cellEntry.getValue();
                    if (cell == null || cell.getV() == null || cell.getV().getV() == null) continue;
                    String cellValue = String.valueOf(cell.getV().getV());

                    java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("《([^》]+)》").matcher(cellValue);
                    if (matcher.find()) {
                        targetFileName = matcher.group(1);
                        descriptionColIndex = c;
                        break; 
                    }
                }

                // 3.2 匹配文件处理
                if (targetFileName != null) {
                    String result = "NA"; // 【核心】默认结果设为 NA

                    // 在当前记录中查找
                    ProjectFile matchFile = findFileByKeyword(currentFiles, targetFileName);

                    if (matchFile != null) {
                        try {
                            StatisticsResultDTO stats = statisticsService.getSavedStats(matchFile.getId());
                            if (stats != null) {
                                long ngCount = stats.getStats().stream().mapToLong(StatisticsResultDTO.CategoryStat::getNgCount).sum();
                                result = (ngCount > 0) ? "NG" : "OK";
                            }
                        } catch (Exception e) {
                            log.error("获取文件统计失败", e);
                            // 发生异常保持 NA，或者可以设为 Error
                        }
                    } else {
                        log.info("【AutoFill】当前记录未找到文件《{}》，设为 NA", targetFileName);
                    }

                    // 3.3 写入结果 (OK / NG / NA)
                    // 寻找写入位置
                    int targetCol = -1;
                    for (int k = descriptionColIndex + 1; k < descriptionColIndex + 15; k++) {
                        LuckySheetJsonDTO.CellData c = rowCells.get(k);
                        if (c != null && c.getV() != null && c.getV().getV() != null) {
                            String v = String.valueOf(c.getV().getV());
                            // 增加 "NA" 的识别，防止重复填充时找不到位置
                            if (v.contains("读取结果") || v.contains("待修复") || "OK".equals(v) || "NG".equals(v) || "NA".equals(v)) {
                                targetCol = k;
                                break;
                            }
                        }
                    }
                    // 没找到标记位，默认偏移 +6 (根据你的截图，描述在D列左右，结果在J/K列，+6差不多)
                    if (targetCol == -1) targetCol = descriptionColIndex + 6;

                    // 准备单元格
                    LuckySheetJsonDTO.CellData targetCell = rowCells.get(targetCol);
                    if (targetCell == null) {
                        targetCell = new LuckySheetJsonDTO.CellData();
                        targetCell.setR(r);
                        targetCell.setC(targetCol);
                        cellDataList.add(targetCell);
                        rowCells.put(targetCol, targetCell);
                    }

                    // 填值
                    LuckySheetJsonDTO.CellValue val = new LuckySheetJsonDTO.CellValue();
                    val.setV(result);
                    val.setM(result);

                    // 设置样式
                    if ("NG".equals(result)) {
                        val.setFc("#FF0000"); // 红色
                        val.setBl(1); // 加粗
                    } else if ("OK".equals(result)) {
                        val.setFc("#008000"); // 绿色
                        val.setBl(1);
                    } else {
                        val.setFc("#808080"); // 灰色 (NA)
                        val.setBl(0); // 正常粗细
                    }
                    
                    targetCell.setV(val);
                }
            }
        }
    }

    /**
     * 辅助方法：在文件列表中按关键词模糊查找
     */
    private ProjectFile findFileByKeyword(List<ProjectFile> files, String keyword) {
        if (files == null) return null;
        for (ProjectFile f : files) {
            if (f.getDocumentType() != null && f.getDocumentType().contains("风险")) continue;
            String fName = (f.getDocumentType() + f.getFileName());
            if (fName.contains(keyword)) {
                return f;
            }
        }
        return null;
    }
}
