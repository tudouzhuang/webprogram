package org.example.project.service.impl;

// --- 基础 Spring 和 DTO/Entity/Mapper 依赖 ---
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
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

// --- Java IO, NIO, 和 Stream 依赖 ---
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;

/**
 * ProcessRecordService 的实现类。
 * 负责处理所有与设计过程记录表相关的业务逻辑。
 */
@Service
public class ProcessRecordServiceImpl implements ProcessRecordService {

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

    /**
     * 【核心方法】创建设计过程记录表，并使用其信息更新项目主表。
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public void createProcessRecord(Long projectId, String recordMetaJson, MultipartFile file) throws IOException {
        
        log.info("【SERVICE】开始创建过程记录表, 项目ID: {}", projectId);
        
        // 1. 解析元数据JSON
        ProcessRecordCreateDTO createDTO = objectMapper.readValue(recordMetaJson, ProcessRecordCreateDTO.class);
        
        // 2. 更新项目主表信息
        updateProjectDetailsFromRecord(projectId, createDTO);
        
        // =======================================================
        //  ↓↓↓ 【核心修正】: 采用“先插后改”模式解决路径依赖问题 ↓↓↓
        // =======================================================

        // 3. 创建主记录实体 (但不设置文件路径) 并【立即插入】以获取ID
        ProcessRecord record = new ProcessRecord();
        record.setProjectId(projectId);
        record.setPartName(createDTO.getPartName());
        record.setProcessName(createDTO.getProcessName());
        record.setCreatedByUserId(getCurrentUserId());
        record.setSpecificationsJson(objectMapper.writeValueAsString(createDTO));
        
        processRecordMapper.insert(record);
        Long newRecordId = record.getId();
        log.info("【SERVICE】过程记录表主信息已初步保存，新记录ID: {}", newRecordId);

        // 4. 处理关联文件 (现在我们已经有了 newRecordId)
        if (file != null && !file.isEmpty()) {
            // a. 将原始文件保存到包含 recordId 的最终路径
            Path sourceFilePath = saveOriginalFile(file, projectId, newRecordId);
            String relativeSourcePath = calculateRelativePath(sourceFilePath);
            
            // b. 【回填】用获取到的文件路径更新刚刚插入的数据库记录
            record.setSourceFilePath(relativeSourcePath);
            processRecordMapper.updateById(record);
            log.info("【SERVICE】已回填原始文件路径到记录 {} 中。", newRecordId);

            // c. 执行文件拆分和后续的数据库记录
            handleFileSplittingAndDBLogging(projectId, newRecordId, sourceFilePath.toFile(), record.getCreatedByUserId(), createDTO);
        } else {
            log.warn("【SERVICE】未提供关联的Excel文件。");
        }
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
        if (!Files.exists(recordUploadPath)) Files.createDirectories(recordUploadPath);
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

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ProjectFile saveReviewSheet(Long recordId, MultipartFile file) throws IOException {
        
        // --- 步骤 1: 验证过程记录是否存在 (不变) ---
        ProcessRecord record = processRecordMapper.selectById(recordId);
        if (record == null) {
            throw new NoSuchElementException("找不到ID为 " + recordId + " 的过程记录，无法保存审核表。");
        }

        // --- 步骤 2: 查找是否已存在同类型的审核表记录 ---
        QueryWrapper<ProjectFile> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("record_id", recordId).eq("document_type", "REVIEW_SHEET");
        // 【重要】改用selectList，避免因意外数据导致TooManyResultsException
        List<ProjectFile> existingFiles = projectFileMapper.selectList(queryWrapper);
        ProjectFile fileRecordToUpdate = existingFiles.isEmpty() ? null : existingFiles.get(0);

        // --- 步骤 3: 保存新的物理文件，并删除旧文件 ---
        String originalFilename = StringUtils.cleanPath(file.getOriginalFilename());
        // 【优化】文件名不再需要时间戳，因为我们总是覆盖
        String storedFileName = "REVIEW_" + originalFilename; 
        Path filePath = Paths.get(uploadDir, String.valueOf(record.getProjectId()), String.valueOf(recordId), storedFileName);
        
        // 【优化】如果存在旧文件记录，先从磁盘删除对应的物理文件
        if (fileRecordToUpdate != null) {
            Path oldFilePath = Paths.get(uploadDir, fileRecordToUpdate.getFilePath());
            Files.deleteIfExists(oldFilePath);
            log.info("【Service】已删除旧的审核物理文件: {}", oldFilePath);
        }
        
        // 保存新文件
        Files.createDirectories(filePath.getParent());
        Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);
        log.info("【Service】已将新的审核表保存至物理路径: {}", filePath);
        
        String relativePath = Paths.get(String.valueOf(record.getProjectId()), String.valueOf(recordId), storedFileName).toString().replace("\\", "/");

        // --- 步骤 4: 更新或插入数据库记录 ---
        if (fileRecordToUpdate == null) {
            // 【Insert路径】: 如果记录不存在，则创建新记录
            log.info("【Service】在数据库中为 recordId {} 创建新的审核表记录", recordId);
            fileRecordToUpdate = new ProjectFile();
            fileRecordToUpdate.setProjectId(record.getProjectId());
            fileRecordToUpdate.setRecordId(recordId);
            fileRecordToUpdate.setDocumentType("REVIEW_SHEET");
        }

        // 统一更新记录的属性
        fileRecordToUpdate.setFileName(storedFileName);
        fileRecordToUpdate.setFilePath(relativePath);
        fileRecordToUpdate.setFileType(file.getContentType());
        
        if (fileRecordToUpdate.getId() == null) {
            // 执行插入
            projectFileMapper.insert(fileRecordToUpdate);
            log.info("【Service】新的审核表文件信息已存入数据库, 文件ID: {}", fileRecordToUpdate.getId());
        } else {
            // 【Update路径】: 更新现有记录
            log.info("【Service】更新数据库中已有的审核表记录 (ID: {})", fileRecordToUpdate.getId());
            projectFileMapper.updateById(fileRecordToUpdate);
        }
        
        // --- 步骤 5: 更新主记录状态 (保持不变) ---
        record.setStatus("REVIEWED"); 
        processRecordMapper.updateById(record);
        log.info("【Service】过程记录 {} 的状态已更新为 'REVIEWED'。", recordId);

        return fileRecordToUpdate;
    }
}