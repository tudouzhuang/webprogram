package org.example.project.service.impl;

// --- 基础 Spring 和 DTO/Entity/Mapper 依赖 ---
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.context.annotation.Lazy; // 【【【 1. 确保添加这个 import 】】】
import org.example.project.dto.LuckySheetJsonDTO;
import org.example.project.dto.ProcessRecordCreateDTO;
import org.example.project.entity.AuditLog;
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
// --- Java IO, NIO, 和 Stream 依赖 ---
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;

import java.util.*;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.stream.Collectors;
import org.example.project.entity.ProcessRecordStatus;

import org.springframework.security.access.AccessDeniedException;

import org.example.project.dto.LuckySheetJsonDTO;
import org.example.project.dto.StatisticsResultDTO;
import org.example.project.mapper.AuditLogMapper;

import java.util.regex.Pattern;

/**
 * ProcessRecordService 的实现类。 负责处理所有与设计过程记录表相关的业务逻辑。
 */
@Service
public class ProcessRecordServiceImpl extends ServiceImpl<ProcessRecordMapper, ProcessRecord>
        implements ProcessRecordService {

    @Autowired
    private AuditLogMapper auditLogMapper;
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

    @Override
    @Transactional
    public void requestChanges(Long recordId, String comment) {
        Long currentUserId = getCurrentUserId();
        User currentUser = userMapper.selectById(currentUserId);

        if (currentUser == null) {
            throw new AccessDeniedException("无法验证当前用户信息。");
        }

        ProcessRecord record = this.getById(recordId);
        if (record == null) {
            throw new RuntimeException("记录不存在，ID: " + recordId);
        }

        // --- [权限校验逻辑：保持不变] ---
        boolean hasPermission = false;
        if (record.getStatus() == ProcessRecordStatus.PENDING_REVIEW) {
            if (record.getAssigneeId() != null && record.getAssigneeId().equals(currentUserId)) {
                hasPermission = true;
            }
        } else if (record.getStatus() == ProcessRecordStatus.APPROVED) {
            if ("MANAGER".equalsIgnoreCase(currentUser.getIdentity())
                    || "ADMIN".equalsIgnoreCase(currentUser.getIdentity())) {
                hasPermission = true;
            }
        }

        if (!hasPermission) {
            throw new AccessDeniedException("权限不足：您无权对此记录执行打回操作。");
        }

        if (record.getStatus() != ProcessRecordStatus.APPROVED
                && record.getStatus() != ProcessRecordStatus.PENDING_REVIEW) {
            throw new IllegalStateException("操作失败：当前状态无法打回。");
        }

        // =======================================================
        // 🔥【核心逻辑注入】执行轮次累加与日志记录
        // =======================================================
        // 1. 数据库层面原子自增 +1
        processRecordMapper.incrementAuditRound(recordId);

// 🔥【修正点】从数据库获取自增后的最新记录，确保对象里的轮次是最新的
        ProcessRecord latestRecord = this.getById(recordId);

// 2. 更新当前 record 对象的状态
        record.setRejectionComment(comment);
        record.setStatus(ProcessRecordStatus.CHANGES_REQUESTED);
        record.setAssigneeId(record.getCreatedByUserId());

// 🔥【修正点】把最新的轮次同步给准备更新的 record 对象，防止覆盖回旧值
        record.setCurrentAuditRound(latestRecord.getCurrentAuditRound());
        // 注意：这里更新 record 时，MP 会自动处理 currentAuditRound 的读取，
        // 但为了日志准确，我们手动获取自增后的最新轮次
        this.updateById(record);

        // 3. 写入审核流水表 audit_logs
        AuditLog auditLog = new AuditLog();
        auditLog.setRecordId(recordId);
        auditLog.setOperatorId(currentUserId);
        auditLog.setActionType("REJECT"); // 动作：打回
        auditLog.setAuditRound(latestRecord.getCurrentAuditRound()); // 记录发生时的轮次
        auditLog.setComment(comment);
        auditLogMapper.insert(auditLog);

        System.out.println("记录 " + recordId + " 已被打回（第 " + latestRecord.getCurrentAuditRound() + " 轮），原因: " + comment);
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

        // 2. --- 处理文件替换 (原有逻辑全部保留) ---
        QueryWrapper<ProjectFile> fileQuery = new QueryWrapper<>();
        fileQuery.eq("record_id", recordId).eq("document_type", "SOURCE_RECORD");
        ProjectFile sourceFileRecord = projectFileMapper.selectOne(fileQuery);

        if (sourceFileRecord == null) {
            throw new IllegalStateException("数据不一致：找不到记录ID " + recordId + " 的原始设计文件。");
        }

        Path oldPhysicalPath = Paths.get(uploadDir, sourceFileRecord.getFilePath());
        Files.deleteIfExists(oldPhysicalPath);

        String originalFilename = StringUtils.cleanPath(file.getOriginalFilename());
        String storedFileName = "source_" + originalFilename;
        Path newPhysicalPath = Paths.get(uploadDir, String.valueOf(record.getProjectId()), String.valueOf(recordId),
                storedFileName);

        Files.createDirectories(newPhysicalPath.getParent());
        Files.copy(file.getInputStream(), newPhysicalPath, StandardCopyOption.REPLACE_EXISTING);

        String newRelativePath = Paths
                .get(String.valueOf(record.getProjectId()), String.valueOf(recordId), storedFileName).toString()
                .replace("\\", "/");
        sourceFileRecord.setFileName(storedFileName);
        sourceFileRecord.setFilePath(newRelativePath);
        sourceFileRecord.setFileType(file.getContentType());
        projectFileMapper.updateById(sourceFileRecord);

        // 3. --- 更新主记录状态和负责人 ---
        record.setStatus(ProcessRecordStatus.PENDING_REVIEW); // 状态改回“待审核”
        Long reviewerId = findLeastBusyReviewerId(); 
        record.setAssigneeId(reviewerId);

        this.updateById(record);

        // =======================================================
        // 🔥【核心逻辑注入】记录修复提交行为
        // =======================================================
        AuditLog auditLog = new AuditLog();
        auditLog.setRecordId(recordId);
        auditLog.setOperatorId(currentUserId);
        auditLog.setActionType("FIX"); // 动作：修复并重新提交
        // 注意：这里沿用当前记录的轮次（轮次是在打回时增加的，修复不增加轮次）
        auditLog.setAuditRound(record.getCurrentAuditRound()); 
        auditLog.setComment("重新上传设计文件: " + originalFilename);
        
        auditLogMapper.insert(auditLog);
        
        System.out.println("设计师 " + currentUserId + " 已完成记录 " + recordId + " 的修复提交（第 " + record.getCurrentAuditRound() + " 轮）");
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
     * 【新增实现 2】: 启动审核流程 (智能负载均衡版) 策略：自动寻找当前工作量最小的审核员进行分配
     */
    @Override
    @Transactional
    public void startReviewProcess(Long recordId) {
        // 1. 验证记录是否存在
        ProcessRecord record = this.getById(recordId); 
        if (record == null) {
            throw new IllegalArgumentException("ID为 " + recordId + " 的过程记录不存在。");
        }

        // --- 【核心逻辑注入 A】 ---
        // 捕获原始状态，用于后续判断动作类型
        ProcessRecordStatus originalStatus = record.getStatus();
        Long currentUserId = getCurrentUserId(); // 获取当前提交人 ID

        // 2. 状态检查：必须是 DRAFT 或 CHANGES_REQUESTED 状态才能提交
        if (originalStatus != ProcessRecordStatus.DRAFT && originalStatus != ProcessRecordStatus.CHANGES_REQUESTED) {
            throw new IllegalStateException("当前记录状态为 " + originalStatus + "，无法提交审核。");
        }

        // 3. 【智能分配策略】: 负载均衡 (保持不变)
        User assignee = userMapper.findLeastLoadedUserByRole("MANAGER");

        if (assignee == null) {
            log.warn("智能分配未找到合适的审核员，尝试降级查询...");
            List<User> managers = userMapper.findByRole("MANAGER");
            if (managers == null || managers.isEmpty()) {
                throw new IllegalStateException("提交失败：系统中未找到任何拥有 'MANAGER' 角色的审核员账号，请联系管理员添加。");
            }
            assignee = managers.get(0); 
        }

        // 4. 更新记录状态和负责人
        record.setStatus(ProcessRecordStatus.PENDING_REVIEW);
        record.setAssigneeId(assignee.getId());
        record.setUpdatedAt(LocalDateTime.now()); 

        this.updateById(record); 

        // =======================================================
        // 🔥【核心逻辑注入 B】记录提交行为
        // =======================================================
        AuditLog auditLog = new AuditLog();
        auditLog.setRecordId(recordId);
        auditLog.setOperatorId(currentUserId);
        
        // 语义化区分：如果是从打回状态提交的，记为 FIX（修复）；否则记为 SUBMIT（初次提交）
        if (originalStatus == ProcessRecordStatus.CHANGES_REQUESTED) {
            auditLog.setActionType("FIX");
            auditLog.setComment("修复打回问题并重新提交");
        } else {
            auditLog.setActionType("SUBMIT");
            auditLog.setComment("完成填报并提交审核");
        }

        // 记录发生时的轮次
        auditLog.setAuditRound(record.getCurrentAuditRound());
        auditLogMapper.insert(auditLog);

        log.info("【审核提交】记录 #{} 已成功提交（动作：{}），智能分配给审核员: {} (ID: {})",
                recordId, auditLog.getActionType(), assignee.getUsername(), assignee.getId());
    }

    /**
     * 【严格版】自动化填充逻辑 规则： 1. 仅在【当前记录 (Record)】的文件列表中查找。 2. 如果找到对应文件 -> 读取统计结果
     * (OK/NG)。 3. 如果没找到对应文件 -> 直接填入 "NA" (灰色)。
     */
    @Override
    public void autoFillRiskSheetData(Long recordId, List<LuckySheetJsonDTO.SheetData> sheets) {
        log.info("【AutoFill】执行 JSON 模式自动填充，RecordId: {}", recordId);

        QueryWrapper<ProjectFile> query = new QueryWrapper<>();
        query.eq("record_id", recordId);
        List<ProjectFile> currentFiles = projectFileMapper.selectList(query);

        if (sheets == null || sheets.isEmpty()) {
            return;
        }

        for (LuckySheetJsonDTO.SheetData sheet : sheets) {
            List<LuckySheetJsonDTO.CellData> cellDataList = sheet.getCelldata();
            if (cellDataList == null || cellDataList.isEmpty()) {
                continue;
            }

            // 构建 Grid 索引
            Map<Integer, Map<Integer, LuckySheetJsonDTO.CellData>> grid = new HashMap<>();
            for (LuckySheetJsonDTO.CellData cell : cellDataList) {
                if (cell != null) {
                    grid.computeIfAbsent(cell.getR(), k -> new HashMap<>()).put(cell.getC(), cell);
                }
            }

            // 【关键修复】：将逻辑调用移入循环内部，现在 sheet 变量是可见的
            if (sheet.getName() != null && sheet.getName().contains("设计重大风险排查表")) {
                log.info(">>> [JSON模式] 命中特殊规则：设计重大风险排查表");
                applyMajorRiskSpecificLogic(recordId, grid, cellDataList, currentFiles);
            }
        }
    }

    /**
     * 辅助方法：在文件列表中按关键词模糊查找
     */
    private ProjectFile findFileByKeyword(List<ProjectFile> files, String keyword) {
        if (files == null) {
            return null;
        }
        for (ProjectFile f : files) {
            if (f.getDocumentType() != null && f.getDocumentType().contains("风险")) {
                continue;
            }
            String fName = (f.getDocumentType() + f.getFileName());
            if (fName.contains(keyword)) {
                return f;
            }
        }
        return null;
    }

    private void applyMajorRiskSpecificLogic(Long recordId,
            Map<Integer, Map<Integer, LuckySheetJsonDTO.CellData>> grid,
            List<LuckySheetJsonDTO.CellData> cellDataList,
            List<ProjectFile> currentFiles) {

        // --- 坐标定义 (0-based index) ---
        // E21: Row=20, Col=4
        final int SOURCE_ROW = 20;
        final int SOURCE_COL = 4;

        // K3: Row=2, Col=10
        final int TARGET_ROW = 2;
        final int TARGET_COL = 10;

        log.info(">>> [AutoFill-Debug] 开始执行点对点映射: FMC(E21/r20,c4) -> 风险表(K3/r2,c10)");

        // --- 1. 寻找源文件 ---
        ProjectFile sourceFile = null;
        for (ProjectFile f : currentFiles) {
            // 打印所有文件名，看看是否匹配失败
            log.info(">>> [AutoFill-Debug] 检查文件: Name={}, Type={}", f.getFileName(), f.getDocumentType());
            String fName = (f.getDocumentType() + f.getFileName());
            if (fName.contains("结构FMC审核记录表")) {
                sourceFile = f;
                log.info(">>> [AutoFill-Debug] ✅ 成功匹配源文件: {}", f.getFileName());
                break;
            }
        }

        String finalResult = "NG"; // 默认 NG

        if (sourceFile != null) {
            try {
                // --- 2. 解析源文件 ---
                Path sourcePath = Paths.get(uploadDir, sourceFile.getFilePath());
                log.info(">>> [AutoFill-Debug] 读取物理文件: {}", sourcePath);

                List<LuckySheetJsonDTO.SheetData> sourceSheets = excelSplitterService.convertExcelToLuckysheetJson(sourcePath.toString());

                if (sourceSheets != null && !sourceSheets.isEmpty()) {
                    LuckySheetJsonDTO.SheetData srcSheet = sourceSheets.get(0);
                    log.info(">>> [AutoFill-Debug] 源文件解析成功，Sheet名: {}, 单元格数量: {}",
                            srcSheet.getName(), srcSheet.getCelldata() == null ? 0 : srcSheet.getCelldata().size());

                    // --- 3. 读取 E21 ---
                    boolean foundCell = false;
                    if (srcSheet.getCelldata() != null) {
                        for (LuckySheetJsonDTO.CellData c : srcSheet.getCelldata()) {
                            // 打印前几个非空单元格，确认坐标系
                            // if (c.getR() < 2 && c.getC() < 2) log.info("Sample Cell: r={}, c={}, v={}", c.getR(), c.getC(), c.getV());

                            if (c.getR() == SOURCE_ROW && c.getC() == SOURCE_COL) {
                                foundCell = true;
                                // 获取原始值对象
                                Object rawV = c.getV();
                                String valStr = "null";

                                if (rawV != null) {
                                    if (rawV instanceof LuckySheetJsonDTO.CellValue) {
                                        LuckySheetJsonDTO.CellValue cv = (LuckySheetJsonDTO.CellValue) rawV;
                                        valStr = String.valueOf(cv.getV());
                                        log.info(">>> [AutoFill-Debug] E21 是对象类型, v={}, m={}", cv.getV(), cv.getM());
                                    } else if (rawV instanceof Map) {
                                        // 有时候 Jackson 会解析成 Map
                                        Map<?, ?> mapV = (Map<?, ?>) rawV;
                                        valStr = String.valueOf(mapV.get("v"));
                                        log.info(">>> [AutoFill-Debug] E21 是Map类型, v={}", valStr);
                                    } else {
                                        valStr = String.valueOf(rawV);
                                        log.info(">>> [AutoFill-Debug] E21 是基础类型, val={}", valStr);
                                    }
                                } else {
                                    log.info(">>> [AutoFill-Debug] E21 的值对象是 NULL");
                                }

                                // 规范化值
                                valStr = valStr.trim();
                                log.info(">>> [AutoFill-Debug] E21 最终识别值: [{}] (长度: {})", valStr, valStr.length());

                                if (isCheckMark(c)) {
                                    finalResult = "OK";
                                    log.info(">>> [AutoFill-Debug] ✅ 判定结果: 合格 (OK)");
                                } else {
                                    log.info(">>> [AutoFill-Debug] ❌ 判定结果: 不合格 (值不匹配 OK/ok/√)");
                                }
                                break;
                            }
                        }
                    }
                    if (!foundCell) {
                        log.warn(">>> [AutoFill-Debug] ❌ 警告: 在源文件中完全没找到 r=20, c=4 的单元格对象 (可能是空行)");
                    }
                } else {
                    log.warn(">>> [AutoFill-Debug] 源文件 Sheet 为空");
                }
            } catch (Exception e) {
                log.error(">>> [AutoFill-Debug] 解析源文件异常", e);
            }
        } else {
            log.warn(">>> [AutoFill-Debug] ❌ 未找到文件名包含 '结构FMC审核记录表' 的文件！");
        }

        // --- 4. 写入 K3 ---
        Map<Integer, LuckySheetJsonDTO.CellData> targetRowMap = grid.get(TARGET_ROW);
        if (targetRowMap == null) {
            targetRowMap = new HashMap<>();
            grid.put(TARGET_ROW, targetRowMap);
        }

        LuckySheetJsonDTO.CellData targetCell = targetRowMap.get(TARGET_COL);
        if (targetCell == null) {
            targetCell = new LuckySheetJsonDTO.CellData();
            targetCell.setR(TARGET_ROW);
            targetCell.setC(TARGET_COL);
            cellDataList.add(targetCell);
            targetRowMap.put(TARGET_COL, targetCell);
        }

        LuckySheetJsonDTO.CellValue val = new LuckySheetJsonDTO.CellValue();
        val.setV(finalResult);
        val.setM(finalResult);

        if ("OK".equals(finalResult)) {
            val.setBg("#00FF00");
            val.setFc("#000000");
            val.setBl(1);
        } else {
            val.setBg(null);
            val.setFc("#FF0000");
            val.setBl(1);
        }

        targetCell.setV(val);
        log.info(">>> [AutoFill-Debug] 写入操作完成: K3 (r=2, c=10) = {}", finalResult);
    }

    /**
     * 辅助判断：是否为打勾符号
     */
    private boolean isCheckMark(LuckySheetJsonDTO.CellData cell) {
        if (cell == null || cell.getV() == null) {
            return false;
        }
        String v = String.valueOf(cell.getV().getV()).trim();
        return "√".equals(v) || "OK".equalsIgnoreCase(v) || "ok".equals(v);
    }

    /**
     * 【新增实现】处理风险表的二进制流，进行动态注入 使用 Apache POI 直接修改 Excel 文件流 升级：支持多条规则配置
     */
    /**
     * 【新增实现】处理风险表的二进制流，进行动态注入 (POI 操作) 包含：一票否决逻辑 + 重量对比逻辑 + 差异化判定(只查NG)
     */
    /**
     * 【新增实现】处理风险表的二进制流，进行动态注入 (POI 操作) 包含：一票否决逻辑 + 重量对比逻辑 + 差异化判定(只查NG)
     */
    @Override
    public byte[] processRiskSheetStream(Long fileId) throws IOException {
        // 1. 获取当前文件信息
        ProjectFile currentFile = projectFileMapper.selectById(fileId);
        if (currentFile == null) {
            throw new IOException("文件记录不存在");
        }

        Path path = Paths.get(uploadDir, currentFile.getFilePath());
        if (!Files.exists(path)) {
            throw new IOException("物理文件不存在");
        }

        // ---------------------------------------------------------
        // 配置区域：定义检查规则
        // ---------------------------------------------------------
        List<RiskFillRule> rules = new ArrayList<>();

        rules.add(new RiskFillRule("结构FMC审核记录表", 20, 4, "1", 10));
        rules.add(new RiskFillRule("结构FMC审核记录表", 35, 4, "2", 10));

        for (int r = 7; r <= 22; r++) {
            rules.add(new RiskFillRule("机床参数检查表", r, 7, "3", 10));
        }

        rules.add(new RiskFillRule("结构FMC审核记录表", 49, 4, "4", 10));
        rules.add(new RiskFillRule("结构FMC审核记录表", 63, 4, "5", 10));
        rules.add(new RiskFillRule("结构FMC审核记录表", 77, 4, "6", 10));
        rules.add(new RiskFillRule(" 机床参数检查表", 1, 13, "7", 10));
        for (int r = 31; r <= 51; r++) {
            rules.add(new RiskFillRule("废料滑落检查表", r, 13, "8", 10));
        }

        for (int r = 31; r <= 51; r++) {
            rules.add(new RiskFillRule("机床参数检查", r, 13, "9", 10));
        }
        // 规则 4：[筋厚检查报告] O列 (Index 14) -> 风险表 序号"4" K列
        // 【特殊逻辑】：此项为"只查NG"模式
        for (int r = 3; r <= 50; r++) {
            rules.add(new RiskFillRule("筋厚检查报告", r, 14, "10", 10));
        }

        rules.add(new RiskFillRule("结构FMC审核记录表", 1, 4, "11", 10));

        // 规则 12：[后序压力控制专项检查表] G52 -> 风险表 序号"12" K列
        rules.add(new RiskFillRule("后序压力控制专项检查表", 51, 6, "12", 10));

        // 规则 13：[安全部件检查表] H5:H19 -> 风险表 序号"13" K列
        for (int r = 4; r <= 18; r++) {
            rules.add(new RiskFillRule("安全部件检查表", r, 7, "13", 10));
        }
        // ---------------------------------------------------------

        // 2. 准备结果集 (TargetID_TargetCol -> List<Result>)
        Map<String, List<String>> fillResults = new HashMap<>();

        QueryWrapper<ProjectFile> query = new QueryWrapper<>();
        query.eq("record_id", currentFile.getRecordId());
        List<ProjectFile> allFiles = projectFileMapper.selectList(query);

        Map<String, List<RiskFillRule>> rulesBySource = rules.stream()
                .collect(Collectors.groupingBy(r -> r.sourceKeyword));

        // 3. 批量读取源文件数据
        for (Map.Entry<String, List<RiskFillRule>> entry : rulesBySource.entrySet()) {
            String keyword = entry.getKey();
            List<RiskFillRule> fileRules = entry.getValue();

            ProjectFile sourceFile = null;
            for (ProjectFile f : allFiles) {
                if ((f.getDocumentType() + f.getFileName()).contains(keyword)) {
                    sourceFile = f;
                    break;
                }
            }

            // 【关键逻辑】区分判定模式
            // 如果是 "筋厚检查报告"，采用 "只查NG" 模式 (默认OK，有NG才挂)
            boolean isCheckNgOnly = keyword.contains("筋厚检查报告");

            if (sourceFile != null) {
                try (InputStream is = Files.newInputStream(Paths.get(uploadDir, sourceFile.getFilePath())); Workbook wb = WorkbookFactory.create(is)) {
                    Sheet sheet = wb.getSheetAt(0);

                    for (RiskFillRule rule : fileRules) {
                        Row r = sheet.getRow(rule.sourceRow);
                        String result;
                        String val = "";

                        if (r != null) {
                            Cell c = r.getCell(rule.sourceCol);
                            val = getCellValueAsString(c);
                        }

                        if (isCheckNgOnly) {
                            // --- 模式 A: 只查 NG (筋厚) ---
                            // 默认 OK，只有明确出现 NG/× 才记为 NG
                            result = "OK";
                            if ("NG".equalsIgnoreCase(val) || "×".equals(val)) {
                                result = "NG";
                            }
                        } else {
                            // --- 模式 B: 严格检查 (FMC/机床/废料/安全部件) ---
                            // 默认 NG，只有明确出现 OK/√ 才记为 OK
                            result = "NG";
                            if ("OK".equalsIgnoreCase(val) || "√".equals(val) || "ok".equals(val)) {
                                result = "OK";
                            }
                        }

                        // 存入结果
                        String key = rule.targetId + "_" + rule.targetCol;
                        fillResults.computeIfAbsent(key, k -> new ArrayList<>()).add(result);
                    }
                } catch (Exception e) {
                    log.error(">>> [POI] 读取源文件 {} 失败", keyword, e);
                    // 读取失败处理: 根据模式决定兜底值
                    String failRes = isCheckNgOnly ? "OK" : "NG";
                    for (RiskFillRule rule : fileRules) {
                        String key = rule.targetId + "_" + rule.targetCol;
                        fillResults.computeIfAbsent(key, k -> new ArrayList<>()).add(failRes);
                    }
                }
            } else {
                // 文件未找到处理: 根据模式决定兜底值
                // 筋厚没传文件暂且算过，其他没传文件算NG
                String missingRes = isCheckNgOnly ? "OK" : "NG";
                for (RiskFillRule rule : fileRules) {
                    String key = rule.targetId + "_" + rule.targetCol;
                    fillResults.computeIfAbsent(key, k -> new ArrayList<>()).add(missingRes);
                }
            }
        }

        // 4. 获取项目重量数据 (用于重量检查)
        ProcessRecord currentRecord = processRecordMapper.selectById(currentFile.getRecordId());
        Project project = projectMapper.selectById(currentRecord.getProjectId());
        Double actualWeight = null;
        Double quoteWeight = null;
        if (project != null) {
            if (project.getActualWeight() != null) {
                actualWeight = project.getActualWeight().doubleValue();
            }
            if (project.getQuoteWeight() != null) {
                quoteWeight = project.getQuoteWeight().doubleValue();
            }
        }
        // 【手术刀修改结束】--------------------------------------------------------

        // 5. 修改当前文件 (风险表)
        try (InputStream is = Files.newInputStream(path); Workbook workbook = WorkbookFactory.create(is); ByteArrayOutputStream bos = new ByteArrayOutputStream()) {

            Sheet sheet = workbook.getSheetAt(0);

            // 遍历前 100 行
            for (int i = 0; i <= sheet.getLastRowNum() && i < 100; i++) {
                Row row = sheet.getRow(i);
                if (row == null) {
                    continue;
                }

                Cell cellA = row.getCell(0); // A列: 序号
                Cell cellC = row.getCell(2); // C列: 内容

                String valA = getCellValueAsString(cellA).trim().replace(".0", "");
                String valC = getCellValueAsString(cellC).trim();

                // --- 逻辑 A: 规则填充 (一票否决) ---
                String resultKey = valA + "_10"; // K列
                if (fillResults.containsKey(resultKey)) {
                    List<String> results = fillResults.get(resultKey);
                    // 【一票否决】只要有一个 NG，就是 NG
                    boolean allOk = results.stream().allMatch(r -> "OK".equals(r));
                    String finalResult = allOk ? "OK" : "NG";

                    updateTargetCell(workbook, row, 10, finalResult);
                    log.info(">>> [POI] 序号[{}] 判定: {} (源结果: {})", valA, finalResult, results);
                }

                // --- 逻辑 B: 重量检查 ---
                if ((valC.contains("重量") || valC.contains("吨位")) && actualWeight != null && quoteWeight != null) {
                    String weightResult = "OK";
                    if (actualWeight > quoteWeight) {
                        weightResult = "NG";
                    }
                    updateTargetCell(workbook, row, 10, weightResult);
                    log.info(">>> [POI] 重量检查: 实际{} vs 报价{} -> {}", actualWeight, quoteWeight, weightResult);
                }
            }

            workbook.write(bos);
            return bos.toByteArray();
        }

    }

    private static class RiskFillRule {

        String sourceKeyword; // 源文件名关键字 (如 "结构FMC")
        int sourceRow;        // 源行号 (0-based)
        int sourceCol;        // 源列号 (0-based)
        String targetId;      // 目标表A列的值 (如 "1", "2")
        int targetCol;        // 目标列号 (0-based)

        public RiskFillRule(String sourceKeyword, int sourceRow, int sourceCol, String targetId, int targetCol) {
            this.sourceKeyword = sourceKeyword;
            this.sourceRow = sourceRow;
            this.sourceCol = sourceCol;
            this.targetId = targetId;
            this.targetCol = targetCol;
        }
    }

    /**
     * 辅助方法：安全获取单元格字符串值
     */
    private String getCellValueAsString(Cell cell) {
        if (cell == null) {
            return "";
        }
        switch (cell.getCellType()) {
            case STRING:
                return cell.getStringCellValue().trim();
            case NUMERIC:
                if (DateUtil.isCellDateFormatted(cell)) {
                    return cell.getLocalDateTimeCellValue().toString();
                }
                double val = cell.getNumericCellValue();
                if (val == (long) val) {
                    return String.valueOf((long) val);
                }
                return String.valueOf(val);
            case BOOLEAN:
                return String.valueOf(cell.getBooleanCellValue());
            case FORMULA:
                try {
                    return cell.getStringCellValue();
                } catch (Exception e) {
                    return "";
                }
            default:
                return "";
        }
    }

    /**
     * 辅助：更新目标单元格并设置样式 (红/绿)
     */
    private void updateTargetCell(Workbook workbook, Row row, int colIndex, String result) {
        Cell targetCell = row.getCell(colIndex);
        if (targetCell == null) {
            targetCell = row.createCell(colIndex);
        }

        targetCell.setCellValue(result);

        CellStyle style = workbook.createCellStyle();
        // 复制原有样式避免破坏边框
        if (targetCell.getCellStyle() != null) {
            style.cloneStyleFrom(targetCell.getCellStyle());
        }

        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        if ("OK".equals(result)) {
            style.setFillForegroundColor(IndexedColors.LIGHT_GREEN.getIndex());
            style.setFont(createFont(workbook, IndexedColors.BLACK.getIndex()));
        } else {
            style.setFillForegroundColor(IndexedColors.RED.getIndex());
            style.setFont(createFont(workbook, IndexedColors.WHITE.getIndex())); // 红底白字更清晰
        }
        targetCell.setCellStyle(style);
    }

    private Font createFont(Workbook wb, short color) {
        Font font = wb.createFont();
        font.setColor(color);
        font.setBold(true);
        return font;
    }

    @Override
    @Transactional
    public void withdrawRecord(Long recordId) {
        ProcessRecord record = this.getById(recordId);
        if (record == null) {
            throw new NoSuchElementException("记录不存在");
        }

        // 1. 权限校验：只有创建者自己可以撤回
        User currentUser = getCurrentUser();
        if (!record.getCreatedByUserId().equals(currentUser.getId())) {
            throw new AccessDeniedException("您无权撤回他人的提交记录。");
        }

        // 2. 状态校验：只有 PENDING_REVIEW (待审核) 状态可以撤回
        // 如果已经是 APPROVED (已通过) 或其他状态，则不允许撤回
        if (record.getStatus() != ProcessRecordStatus.PENDING_REVIEW) {
            throw new IllegalStateException("当前状态无法撤回，只能撤回[待审核]的任务。");
        }

        // 3. 执行撤回：状态变回 DRAFT，负责人变回创建者
        record.setStatus(ProcessRecordStatus.DRAFT);
        record.setAssigneeId(record.getCreatedByUserId()); // 重新把任务分配给自己

        // 可选：清空之前的审核日志或保留
        // record.setRejectionComment(null); 
        this.updateById(record);
        log.info("用户 {} 成功撤回了记录 #{}", currentUser.getUsername(), recordId);
    }

}
