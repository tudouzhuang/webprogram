package org.example.project.service.impl;

// --- 基础依赖 ---
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.example.project.mapper.ProcessRecordMapper;
import org.example.project.dto.ProcessRecordCreateDTO;
import org.example.project.dto.ProjectCreateDTO;
import org.example.project.dto.ProjectFullCreateDTO;
import org.example.project.entity.ProcessRecord;
import org.example.project.entity.ProcessRecordStatus;
import org.example.project.entity.Project;
import org.example.project.entity.ProjectFile;
import org.example.project.mapper.ProjectFileMapper;
import org.example.project.mapper.ProjectMapper;
import org.example.project.service.ExcelSplitterService;
import org.example.project.service.ProjectService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

@Service
public class ProjectServiceImpl implements ProjectService {

    private static final Logger log = LoggerFactory.getLogger(ProjectServiceImpl.class);

    @Autowired
    private ProjectMapper projectMapper;

    @Autowired
    private ProjectFileMapper projectFileMapper;

    @Autowired
    private ProcessRecordMapper processRecordMapper; 

    @Autowired(required = false) // 设置为非必须，如果暂时没有这个Bean也不会报错
    private ExcelSplitterService excelSplitterService;

    
    @Value("${file.upload-dir}")
    private String uploadDir;

    // =======================================================
    //  【修正】createProject 方法，以匹配“极简创建”需求
    // =======================================================
    @Override
    @Transactional
    public Project createProject(ProjectCreateDTO createDTO) {
        // 前端传的是 projectName
        if (!StringUtils.hasText(createDTO.getProjectNumber())) {
            throw new IllegalArgumentException("项目名称不能为空！");
        }

        // =======================================================
        //  ↓↓↓ 【核心修正】在这里修改查询的列名 ↓↓↓
        // =======================================================
        QueryWrapper<Project> queryWrapper = new QueryWrapper<>();

        // 【修正前，错误的】:
        // queryWrapper.eq("project_name", createDTO.getProjectName());
        // 【修正后，正确的】: 
        // 使用数据库中真实存在的列 `project_number` 来进行唯一性检查。
        queryWrapper.eq("project_number", createDTO.getProjectNumber());

        if (projectMapper.selectCount(queryWrapper) > 0) {
            // 提示信息也应该更准确
            throw new RuntimeException("项目号 '" + createDTO.getProjectNumber() + "' 已存在！");
        }

        // 创建实体对象
        Project projectEntity = new Project();

        // 【关键】确保为数据库中所有 NOT NULL 的列都提供了值
        // 根据你的表结构，project_number 和 product_name 很可能都是 NOT NULL
        projectEntity.setProjectNumber(createDTO.getProjectNumber()); // 用 projectName 填充 project_number
        projectEntity.setProductName(createDTO.getProjectNumber()); // 同时也填充 product_name

        // 插入数据库
        projectMapper.insert(projectEntity);
        log.info("【Service】极简项目创建成功，新项目ID: {}", projectEntity.getId());

        return projectEntity;
    }

    // =======================================================
    //  【补全】createProjectWithFile 方法实现
    // =======================================================
    @Override
    @Transactional(rollbackFor = Exception.class)
    // 【核心修正】: 将方法参数的类型从 ProjectCreateDTO 改为 ProjectFullCreateDTO
    public void createProjectWithFile(ProjectFullCreateDTO createDTO, MultipartFile file) throws IOException {
        log.info("【Service】开始执行“完整创建项目（带文件）”流程...");

        // 1. 检查项目号唯一性
        QueryWrapper<Project> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("project_number", createDTO.getProjectNumber());
        if (projectMapper.selectCount(queryWrapper) > 0) {
            throw new RuntimeException("项目号 '" + createDTO.getProjectNumber() + "' 已存在！");
        }

        // 2. 保存项目基础信息
        Project projectEntity = new Project();
        BeanUtils.copyProperties(createDTO, projectEntity);

        // 【现在不再报错】: 因为 createDTO (ProjectFullCreateDTO类型) 中确实有 getQuoteSize() 方法
        if (createDTO.getQuoteSize() != null) {
            projectEntity.setQuoteLength(createDTO.getQuoteSize().getLength());
            projectEntity.setQuoteWidth(createDTO.getQuoteSize().getWidth());
            projectEntity.setQuoteHeight(createDTO.getQuoteSize().getHeight());
        }
        if (createDTO.getActualSize() != null) {
            projectEntity.setActualLength(createDTO.getActualSize().getLength());
            projectEntity.setActualWidth(createDTO.getActualSize().getWidth());
            projectEntity.setActualHeight(createDTO.getActualSize().getHeight());
        }

        projectMapper.insert(projectEntity);
        Long newProjectId = projectEntity.getId();
        log.info("【Service】完整项目信息已保存，ID: {}", newProjectId);

        // 3. 处理文件（如果存在）
        if (file != null && !file.isEmpty()) {
            Path sourceFilePath = saveOriginalFile(file, newProjectId);
            saveProjectFileInfo(file.getOriginalFilename(), sourceFilePath, newProjectId, "INITIAL_DOCUMENT");
        }
    }

    // =======================================================
    //  【补全】查询相关的 Service 方法
    // =======================================================
    @Override
    public List<Project> getAllProjects() {
        log.info("【Service】正在查询所有项目列表...");
        return projectMapper.selectList(null);
    }

    @Override
    public List<ProjectFile> getFilesByProjectId(Long projectId) {
        log.info("【Service】正在查询项目ID {} 的【所有】文件列表...", projectId);
        QueryWrapper<ProjectFile> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("project_id", projectId);
        return projectFileMapper.selectList(queryWrapper);
    }

    @Override
    public Project getProjectById(Long projectId) {
        log.info("【Service】正在查询项目ID {} 的详细信息...", projectId);
        Project project = projectMapper.selectById(projectId);
        if (project == null) {
            throw new NoSuchElementException("找不到ID为 " + projectId + " 的项目");
        }
        return project;
    }

    // =======================================================
    //  【补全】uploadOrUpdateProjectFile 方法
    // =======================================================
    @Override
    @Transactional(rollbackFor = Exception.class)
    public void uploadOrUpdateProjectFile(Long projectId, MultipartFile file, String documentType) throws IOException {
        // 1. 检查项目是否存在
        if (projectMapper.selectById(projectId) == null) {
            throw new NoSuchElementException("无法为不存在的项目 (ID: " + projectId + ") 上传文件");
        }

        // 2. 查找是否已存在同类型的旧文件记录
        QueryWrapper<ProjectFile> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("project_id", projectId).eq("document_type", documentType);
        ProjectFile existingFileRecord = projectFileMapper.selectOne(queryWrapper);

        // 3. 如果存在旧文件，先从磁盘删除
        if (existingFileRecord != null) {
            Path oldFilePath = Paths.get(uploadDir, existingFileRecord.getFilePath());
            Files.deleteIfExists(oldFilePath);
            log.info("【Service】已删除旧的'{}'物理文件: {}", documentType, oldFilePath);
        }

        // 4. 保存新文件到磁盘
        String originalFilename = StringUtils.cleanPath(file.getOriginalFilename());
        String storedFileName = documentType + "-" + originalFilename;
        Path filePath = Paths.get(uploadDir, String.valueOf(projectId), storedFileName);

        Files.createDirectories(filePath.getParent());
        Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);
        log.info("【Service】项目 {} 的新'{}'文件已保存至: {}", projectId, documentType, filePath);

        // 5. 更新或插入数据库记录
        String relativePath = Paths.get(String.valueOf(projectId), storedFileName).toString().replace("\\", "/");
        if (existingFileRecord != null) {
            log.info("【Service】更新数据库中已有的'{}'记录 (ID: {})", documentType, existingFileRecord.getId());
            existingFileRecord.setFileName(storedFileName);
            existingFileRecord.setFilePath(relativePath);
            projectFileMapper.updateById(existingFileRecord);
        } else {
            log.info("【Service】在数据库中为'{}'创建新记录", documentType);
            ProjectFile newFile = new ProjectFile();
            newFile.setProjectId(projectId);
            newFile.setDocumentType(documentType);
            newFile.setFileName(storedFileName);
            newFile.setFilePath(relativePath);
            newFile.setFileType(file.getContentType());
            projectFileMapper.insert(newFile);
        }
    }

    // =======================================================
    //  辅助方法 (保持不变)
    // =======================================================
    private Path saveOriginalFile(MultipartFile file, Long projectId) throws IOException {
        String originalFilename = StringUtils.cleanPath(file.getOriginalFilename());
        Path projectUploadPath = Paths.get(uploadDir, String.valueOf(projectId));
        if (!Files.exists(projectUploadPath)) {
            Files.createDirectories(projectUploadPath);
        }
        Path sourceFilePath = projectUploadPath.resolve("source_" + originalFilename);
        Files.copy(file.getInputStream(), sourceFilePath, StandardCopyOption.REPLACE_EXISTING);
        log.info("【Service】原始Excel文件已保存至: {}", sourceFilePath);
        return sourceFilePath;
    }

    private void saveProjectFileInfo(String originalFilename, Path sourceFilePath, Long projectId, String documentType) {
        ProjectFile projectFile = new ProjectFile();
        projectFile.setProjectId(projectId);
        projectFile.setFileName("source_" + originalFilename);
        String relativePath = Paths.get(String.valueOf(projectId), "source_" + originalFilename).toString().replace("\\", "/");
        projectFile.setFilePath(relativePath);
        projectFile.setDocumentType(documentType);

        String fileExtension = "";
        int i = originalFilename.lastIndexOf('.');
        if (i > 0) {
            fileExtension = originalFilename.substring(i);
        }
        projectFile.setFileType(fileExtension);

        projectFileMapper.insert(projectFile);
        log.info("【Service】文件信息 (类型: {}) 已存入数据库。", documentType);
    }

    @Override
    public void createProjectWithFile(ProjectCreateDTO createDTO, MultipartFile file) throws IOException {
        // TODO Auto-generated method stub
        throw new UnsupportedOperationException("Unimplemented method 'createProjectWithFile'");
    }

    @Override
    public List<ProjectFile> getFilesByRecordId(Long recordId) {
        log.info("【Service】正在查询过程记录ID {} 的所有关联文件...", recordId);
        QueryWrapper<ProjectFile> queryWrapper = new QueryWrapper<>();
        // 查询条件是 record_id，完全正确
        queryWrapper.eq("record_id", recordId);
        return projectFileMapper.selectList(queryWrapper);
    }

    @Override
    public List<ProcessRecord> getRecordsByProjectId(Long projectId) {
        // TODO Auto-generated method stub
        throw new UnsupportedOperationException("Unimplemented method 'getRecordsByProjectId'");
    }

    @Override
    @Transactional
    public ProcessRecord createRecordWithMultipleFiles(Long projectId, ProcessRecordCreateDTO recordMeta, Map<String, MultipartFile> files) throws IOException {
        // 1. 创建并保存 ProcessRecord 主记录
        ProcessRecord record = new ProcessRecord();
        BeanUtils.copyProperties(recordMeta, record); // 复制元数据
        record.setProjectId(projectId);
        record.setStatus(ProcessRecordStatus.DRAFT);
        // 假设创建者ID从SecurityContext获取
        // record.setCreatedByUserId(currentUserId); 
        // record.setAssigneeId(currentUserId);
        processRecordMapper.insert(record);

        // 2. 遍历上传的文件Map，为每个文件创建一条 project_files 记录
        for (Map.Entry<String, MultipartFile> entry : files.entrySet()) {
            String sheetKey = entry.getKey();
            MultipartFile file = entry.getValue();

            if (file.isEmpty()) {
                continue;
            }

            // 2.1 保存文件到服务器
            String originalFilename = StringUtils.cleanPath(file.getOriginalFilename());
            String newFileName = System.currentTimeMillis() + "_" + originalFilename;
            Path destinationPath = Paths.get(this.uploadDir, String.valueOf(projectId), String.valueOf(record.getId()), newFileName).normalize();
            Files.createDirectories(destinationPath.getParent());
            Files.copy(file.getInputStream(), destinationPath, StandardCopyOption.REPLACE_EXISTING);

            // 2.2 创建 ProjectFile 实体并保存
            ProjectFile projectFile = new ProjectFile();
            projectFile.setProjectId(projectId);
            projectFile.setRecordId(record.getId());
            projectFile.setFileName(originalFilename);
            // 使用文件的相对路径进行存储
            projectFile.setFilePath(Paths.get(String.valueOf(projectId), String.valueOf(record.getId()), newFileName).toString());
            projectFile.setDocumentType(sheetKey); // 【关键】用检查项的key作为文档类型
            projectFile.setFileType(file.getContentType());
            projectFile.setCreatedAt(LocalDateTime.now());

            projectFileMapper.insert(projectFile);
        }

        return record;
    }
}
