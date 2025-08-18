package org.example.project.service.impl;

// --- 基础 Spring 和 DTO/Entity/Mapper 依赖 ---
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.fasterxml.jackson.core.JsonProcessingException;
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
import java.io.File;
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
    private UserService userService;

    private static final Logger log = LoggerFactory.getLogger(ProcessRecordServiceImpl.class);

    // --- 常量定义 ---
    private static final String DOC_TYPE_PROCESS_RECORD_SHEET = "PROCESS_RECORD_SHEET";
    private static final String SPLIT_OUTPUT_DIR_NAME = "split_output";
    private static final String SOURCE_FILE_PREFIX = "source_";

    // --- 依赖注入 ---
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

    @Override
    @Transactional
    public void resubmit(Long recordId, MultipartFile file) throws IOException {
        Long currentUserId = getCurrentUserId();
        log.info("【SERVICE-RESUBMIT】开始处理重提请求, Record ID: {}, 操作用户 ID: {}", recordId, currentUserId);
    
        // 1. --- 验证记录、权限与状态 (逻辑保持不变) ---
        ProcessRecord record = this.getById(recordId);
        if (record == null) {
            throw new RuntimeException("操作失败：找不到ID为 " + recordId + " 的记录。");
        }
        if (record.getAssigneeId() == null) {
            throw new AccessDeniedException("权限不足：该任务当前没有指定的负责人。");
        }
        if (!record.getAssigneeId().equals(currentUserId)) {
            throw new AccessDeniedException("权限不足：您不是当前任务的负责人。");
        }
        if (record.getStatus() != ProcessRecordStatus.CHANGES_REQUESTED) {
            throw new IllegalStateException("操作失败：记录当前状态不是“待修改”，无法重新提交。");
        }
        log.info("【SERVICE-RESUBMIT】权限与状态校验通过。");
    
        // =======================================================
        //  ↓↓↓ 【核心修正】: 文件处理逻辑完全基于 process_records 表 ↓↓↓
        // =======================================================
    
        // 2. --- 处理文件替换 ---
        // 2.1 从主记录中获取旧文件的相对路径
        String oldRelativePath = record.getSourceFilePath();
        
        // 2.2 删除旧的物理文件
        if (oldRelativePath != null && !oldRelativePath.isEmpty()) {
            Path oldPhysicalPath = Paths.get(uploadDir, oldRelativePath);
            log.info("【SERVICE-RESUBMIT】准备删除旧文件: {}", oldPhysicalPath);
            Files.deleteIfExists(oldPhysicalPath);
        } else {
            log.warn("【SERVICE-RESUBMIT】警告: 记录中没有旧文件路径，无法执行删除。");
        }
    
        // 2.3 保存新的物理文件
        String originalFilename = StringUtils.cleanPath(file.getOriginalFilename());
        String storedFileName = "source_" + System.currentTimeMillis() + "_" + originalFilename;
        Path newPhysicalPath = Paths.get(uploadDir, String.valueOf(record.getProjectId()), String.valueOf(recordId), storedFileName);
    
        Files.createDirectories(newPhysicalPath.getParent());
        Files.copy(file.getInputStream(), newPhysicalPath, StandardCopyOption.REPLACE_EXISTING);
        log.info("【SERVICE-RESUBMIT】新文件已保存至: {}", newPhysicalPath);
    
        String newRelativePath = Paths.get(String.valueOf(record.getProjectId()), String.valueOf(recordId), storedFileName).toString().replace("\\", "/");
        
        // 3. --- 更新主记录的状态、负责人、以及新的文件路径 ---
        record.setStatus(ProcessRecordStatus.PENDING_REVIEW);
        
        Long reviewerId = findLeastBusyReviewerId();
        record.setAssigneeId(reviewerId);
        
        // 【核心】将新文件的路径直接回填到 process_records 表的 source_file_path 字段
        record.setSourceFilePath(newRelativePath);
    
        this.updateById(record);
        log.info("【SERVICE-RESUBMIT】ProcessRecord {} 已被重提，文件路径、状态和负责人均已更新。", recordId);
    }

    /**
     * 辅助方法：处理文件的拆分和数据库记录
     */
    private void handleFileSplittingAndDBLogging(Long projectId, Long newRecordId, File sourceFile, Long currentUserId, ProcessRecordCreateDTO createDTO) throws IOException {
        String splitOutputDirPath = sourceFile.getParent() + File.separator + SPLIT_OUTPUT_DIR_NAME;
        List<File> splitFiles = excelSplitterService.splitExcel(sourceFile, splitOutputDirPath);

        // 清理前端传来的Sheet名，使其与文件名清理规则一致
        List<String> cleanedSelectedSheets = createDTO.getSelectedSheets().stream()
                .map(s -> s.replaceAll("[\\\\/:*?\"<>|\\s]", "_"))
                .collect(Collectors.toList());

        for (File splitFile : splitFiles) {
            String cleanedSheetNameFromFile = splitFile.getName().replaceAll("\\.xlsx$", "");

            if (cleanedSelectedSheets.contains(cleanedSheetNameFromFile)) {
                String finalFileName = renameSplitFile(splitFile, currentUserId);
                saveSplitFileInfo(finalFileName, projectId, newRecordId);
            } else {
                if (!splitFile.delete()) {
                    log.warn("【SERVICE】删除未选中的拆分文件失败: {}", splitFile.getAbsolutePath());
                }
            }
        }
    }

    /**
     * 辅助方法：保存拆分文件的数据库记录
     */
    private void saveSplitFileInfo(String fileName, Long projectId, Long recordId) {
        ProjectFile projectFile = new ProjectFile();
        projectFile.setProjectId(projectId);
        projectFile.setRecordId(recordId);
        projectFile.setFileName(fileName);

        String relativePath = Paths.get(String.valueOf(projectId), String.valueOf(recordId), SPLIT_OUTPUT_DIR_NAME, fileName).toString().replace("\\", "/");
        projectFile.setFilePath(relativePath);

        projectFile.setFileType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        projectFile.setDocumentType(DOC_TYPE_PROCESS_RECORD_SHEET);

        projectFileMapper.insert(projectFile);
        log.info("【SERVICE】已将拆分文件 '{}' 信息存入数据库。", fileName);
    }

    /**
     * 辅助方法：将上传的原始文件保存到服务器磁盘。
     */
    private Path saveOriginalFile(MultipartFile file, Long projectId, Long recordId) throws IOException {
        String originalFilename = StringUtils.cleanPath(file.getOriginalFilename());
        Path recordUploadPath = Paths.get(uploadDir, String.valueOf(projectId), String.valueOf(recordId));
        if (!Files.exists(recordUploadPath)) {
            Files.createDirectories(recordUploadPath);
        }
        Path sourceFilePath = recordUploadPath.resolve(SOURCE_FILE_PREFIX + originalFilename);
        Files.copy(file.getInputStream(), sourceFilePath, StandardCopyOption.REPLACE_EXISTING);
        log.info("【SERVICE】原始Excel文件已保存至: {}", sourceFilePath);
        return sourceFilePath;
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
     * 辅助方法：重命名文件，添加用户ID前缀。
     */
    private String renameSplitFile(File splitFile, Long userId) {
        String userIdPrefix = (userId != null) ? userId.toString() : "user_unknown";
        String finalFileName = userIdPrefix + "_" + splitFile.getName();
        Path finalFilePath = Paths.get(splitFile.getParent(), finalFileName);

        try {
            Files.move(splitFile.toPath(), finalFilePath, StandardCopyOption.REPLACE_EXISTING);
            log.info("【SERVICE】文件已重命名为: {}", finalFileName);
            return finalFileName;
        } catch (IOException e) {
            log.error("【SERVICE】重命名文件失败: {} -> {}", splitFile.getName(), finalFileName, e);
            return splitFile.getName(); // 如果重命名失败，返回原文件名
        }
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
    @Transactional
    public void reassignTask(Long recordId, Long newAssigneeId) {
        Long currentUserId = getCurrentUserId();

        ProcessRecord record = this.getById(recordId);
        if (record == null) {
            throw new RuntimeException("记录不存在，ID: " + recordId); // 建议使用自定义的业务异常
        }

        if (!record.getAssigneeId().equals(currentUserId)) {
            throw new AccessDeniedException("权限不足：您不是当前任务的负责人。");
        }

        if (record.getStatus() != ProcessRecordStatus.PENDING_REVIEW) {
            throw new IllegalStateException("操作失败：任务当前状态为 " + record.getStatus() + "，无法转交。");
        }

        User newAssignee = userMapper.selectById(newAssigneeId);
        // 假设你的 User 实体有 getIdentity() 或 getRole() 方法返回角色字符串
        if (newAssignee == null || !"REVIEWER".equals(newAssignee.getIdentity())) {
            throw new IllegalArgumentException("操作失败：目标用户不是一个有效的审核员。");
        }

        record.setAssigneeId(newAssigneeId);
        this.updateById(record);
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


}
