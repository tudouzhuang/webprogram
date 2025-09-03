package org.example.project.service.impl;

// --- 基础 Spring 和 DTO/Entity/Mapper 依赖 ---
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.example.project.dto.ProcessRecordCreateDTO;
import org.example.project.entity.ProcessRecord;
import org.example.project.entity.Project;
import org.example.project.entity.ProjectFile;
import org.example.project.entity.User;
import org.example.project.mapper.ProcessRecordMapper;
import org.example.project.mapper.ProjectFileMapper;
import org.example.project.mapper.ProjectMapper;
import org.example.project.mapper.UserMapper;
import org.example.project.service.ExcelSplitterService;
import org.example.project.service.ProcessRecordService;
import org.example.project.service.ProjectService;
import org.example.project.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
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
import java.util.stream.Collectors;
import org.example.project.entity.ProcessRecordStatus;
import org.springframework.security.access.AccessDeniedException;

/**
 * ProcessRecordService 的实现类。 负责处理所有与设计过程记录表相关的业务逻辑。
 */
@Service
public class ProcessRecordServiceImpl extends ServiceImpl<ProcessRecordMapper, ProcessRecord> implements ProcessRecordService {

    @Autowired
    private ProjectService projectService;
    @Autowired
    private UserService userService;

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

    // --- 查询方法 (保持不变) ---
    @Override
    public List<ProcessRecord> getRecordsByProjectId(Long projectId) {
        log.info("【SERVICE】正在查询项目ID {} 的过程记录表列表...", projectId);
        return processRecordMapper.selectList(new QueryWrapper<ProcessRecord>().eq("project_id", projectId).orderByDesc("created_at"));
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

        // 2. 设置精确的查询条件
        queryWrapper
                // 条件一: 记录ID必须匹配
                .eq("record_id", recordId)
                // 条件二: 文件类型必须是 'REVIEW_SHEET'
                .eq("document_type", "REVIEW_SHEET");

        // 3. 按ID降序排序，以确保我们总是获取到最新提交的那一份审核表
        queryWrapper.orderByDesc("id");

        // 4. 使用 selectList 并取第一个，这比 selectOne 更能避免因意外查出多条记录而报错
        List<ProjectFile> reviewSheets = projectFileMapper.selectList(queryWrapper);

        // 5. 判断结果
        if (reviewSheets == null || reviewSheets.isEmpty()) {
            // 如果列表为空，说明没找到，抛出异常，Controller会将其转换为404
            log.warn("【SERVICE】未找到 recordId {} 对应的审核表。", recordId);
            throw new NoSuchElementException("未找到ID为 " + recordId + " 的过程记录所对应的审核表。");
        }

        // 返回列表中的第一个（也就是最新的那一个）
        ProjectFile latestReviewSheet = reviewSheets.get(0);
        log.info("【SERVICE】已成功找到 recordId {} 对应的审核表，文件ID为: {}", recordId, latestReviewSheet.getId());
        return latestReviewSheet;
    }

// 在你的 ProcessRecordServiceImpl.java 文件中
    @Override
    @Transactional(rollbackFor = Exception.class)
    public ProjectFile saveReviewSheet(Long recordId, MultipartFile file) throws IOException {

        // =======================================================
        //  ↓↓↓ 阶段 1: 接收与验证 ↓↓↓
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
        //  ↓↓↓ 阶段 2: 旧文件处理 ↓↓↓
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
        //  ↓↓↓ 阶段 3: 新文件保存 ↓↓↓
        // =======================================================
        log.info("--- 阶段 3: 开始保存新文件 ---");

        String originalFilename = StringUtils.cleanPath(file.getOriginalFilename());
        String storedFileName = "REVIEW_" + originalFilename;

        // 【重要】构建绝对物理路径
        Path physicalFilePath = Paths.get(uploadDir, String.valueOf(record.getProjectId()), String.valueOf(recordId), storedFileName);
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
        //  ↓↓↓ 阶段 4: 数据库记录更新/插入 ↓↓↓
        // =======================================================
        log.info("--- 阶段 4: 开始更新/插入数据库记录 ---");

        String relativePath = Paths.get(String.valueOf(record.getProjectId()), String.valueOf(recordId), storedFileName).toString().replace("\\", "/");

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
        //  ↓↓↓ 阶段 5: 更新主记录状态 ↓↓↓
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
                        row -> (Long) row.get("taskCount")
                ));

        // 3. 找出任务最少的人 (Java Stream API 的优雅写法)
        return allReviewers.stream()
                .min(Comparator.comparing(reviewer -> taskCounts.getOrDefault(reviewer.getId(), 0L)))
                .map(User::getId)
                .orElseThrow(() -> new IllegalStateException("无法确定最空闲的审核员。")); // 理论上不会发生
    }

    @Override
    @Transactional // 确保操作的原子性
    public void reassignTask(Long recordId, Long newAssigneeId) {
        Long currentUserId = getCurrentUserId();
        log.info("【SERVICE-REASSIGN】开始处理转交请求, Record ID: {}, 操作用户 ID: {}, 目标用户 ID: {}", recordId, currentUserId, newAssigneeId);

        // 1. --- 验证记录 ---
        ProcessRecord record = this.getById(recordId);
        if (record == null) {
            throw new RuntimeException("操作失败：找不到ID为 " + recordId + " 的记录。");
        }

        // 2. --- 权限与状态校验 ---
        if (record.getAssigneeId() == null) {
            throw new AccessDeniedException("权限不足：该任务当前没有指定的负责人。");
        }
        if (!record.getAssigneeId().equals(currentUserId)) {
            throw new AccessDeniedException("权限不足：您不是当前任务的负责人。");
        }
        if (record.getStatus() != ProcessRecordStatus.PENDING_REVIEW) {
            throw new IllegalStateException("操作失败：任务当前状态为 [" + record.getStatus() + "]，而不是[待审核]，无法转交。");
        }
        log.info("【SERVICE-REASSIGN】权限与状态校验通过。");

        // 3. --- 【核心修正】校验目标用户是否为有效审核员 (包括 manager) ---
        User newAssignee = userMapper.selectById(newAssigneeId);

        if (newAssignee == null) {
            throw new IllegalArgumentException("操作失败：找不到ID为 " + newAssigneeId + " 的目标用户。");
        }

        String newAssigneeRole = newAssignee.getIdentity(); // 获取目标用户的角色
        log.info("【SERVICE-REASSIGN】目标负责人 {} 的角色为: {}", newAssignee.getUsername(), newAssigneeRole);

        // 允许 'REVIEWER' 和 'MANAGER' 作为有效的审核员
        if (!"REVIEWER".equalsIgnoreCase(newAssigneeRole) && !"MANAGER".equalsIgnoreCase(newAssigneeRole)) {
            throw new IllegalArgumentException("操作失败：目标用户 " + newAssignee.getUsername() + " (" + newAssigneeRole + ") 不是一个有效的审核员。");
        }
        log.info("【SERVICE-REASSIGN】目标负责人角色校验通过。");

        // 4. --- 执行更新 ---
        record.setAssigneeId(newAssigneeId);
        this.updateById(record);
        log.info("【SERVICE-REASSIGN】任务已成功转交给用户: {} (ID: {})", newAssignee.getUsername(), newAssigneeId);
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
        //  ↓↓↓ 【核心逻辑修正】 ↓↓↓
        //  重新设计权限校验，使其更健壮
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
            if ("MANAGER".equalsIgnoreCase(currentUser.getIdentity()) || "ADMIN".equalsIgnoreCase(currentUser.getIdentity())) {
                hasPermission = true;
            }
        }

        if (!hasPermission) {
            throw new AccessDeniedException("权限不足：您无权对此记录执行打回操作。");
        }

        // 业务规则校验 (保持不变)
        if (record.getStatus() != ProcessRecordStatus.APPROVED && record.getStatus() != ProcessRecordStatus.PENDING_REVIEW) {
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
        Path newPhysicalPath = Paths.get(uploadDir, String.valueOf(record.getProjectId()), String.valueOf(recordId), storedFileName);

        Files.createDirectories(newPhysicalPath.getParent());
        Files.copy(file.getInputStream(), newPhysicalPath, StandardCopyOption.REPLACE_EXISTING);

        // 2.4 更新 project_files 表中的记录
        String newRelativePath = Paths.get(String.valueOf(record.getProjectId()), String.valueOf(recordId), storedFileName).toString().replace("\\", "/");
        sourceFileRecord.setFileName(storedFileName);
        sourceFileRecord.setFilePath(newRelativePath);
        sourceFileRecord.setFileType(file.getContentType());
        projectFileMapper.updateById(sourceFileRecord);

        // 3. --- 更新主记录状态和负责人 ---
        record.setStatus(ProcessRecordStatus.PENDING_REVIEW); // 状态改回“待审核”
        // 将任务重新分配给审核员，这里我们使用一个“智能分配”或“固定分配”的逻辑
        // Long reviewerId = findDefaultReviewerForProject(record.getProjectId()); // 示例：找到项目默认审核员
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
        //    确保它存在，并且确实属于传入的 recordId
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
        //    fileRecord.getFilePath() 中存储的是相对路径，如 "70/19/xxx.xlsx"
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
        Path newRelativePath = Paths.get(String.valueOf(fileRecord.getProjectId()), String.valueOf(recordId), newStoredFileName);
        Path newAbsolutePath = Paths.get(uploadDir).resolve(newRelativePath);
    
        Files.createDirectories(newAbsolutePath.getParent());
        Files.copy(file.getInputStream(), newAbsolutePath, StandardCopyOption.REPLACE_EXISTING);
        log.info("【SERVICE-UPDATE_FILE】新物理文件已保存: {}", newAbsolutePath);
        
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
}
