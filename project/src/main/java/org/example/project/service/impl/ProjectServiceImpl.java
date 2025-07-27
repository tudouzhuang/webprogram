package org.example.project.service.impl;

// --- 基础依赖 ---
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.example.project.dto.ProjectCreateDTO;
import org.example.project.entity.Project;
import org.example.project.entity.ProjectFile;
import org.example.project.mapper.ProjectFileMapper;
import org.example.project.mapper.ProjectMapper;
import org.example.project.service.ExcelSplitterService; // 【注入】: 导入新服务的接口
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
import java.util.List;
import java.util.NoSuchElementException;

@Service
public class ProjectServiceImpl implements ProjectService {

    private static final Logger log = LoggerFactory.getLogger(ProjectServiceImpl.class);

    @Autowired
    private ProjectMapper projectMapper;

    @Autowired
    private ProjectFileMapper projectFileMapper;

    // 【注入】: 注入我们新创建的Excel拆分服务
    @Autowired
    private ExcelSplitterService excelSplitterService;

    @Value("${file.upload-dir}")
    private String uploadDir;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void createProjectWithFile(ProjectCreateDTO createDTO, MultipartFile file) throws IOException {

        // --- 1. 检查项目号唯一性 (保持不变) ---
        QueryWrapper<Project> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("project_number", createDTO.getProjectNumber());
        if (projectMapper.selectCount(queryWrapper) > 0) {
            throw new RuntimeException("项目号 '" + createDTO.getProjectNumber() + "' 已存在！");
        }

        // --- 2. 保存项目基础信息 (保持不变) ---
        Project projectEntity = new Project();
        BeanUtils.copyProperties(createDTO, projectEntity);
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
        log.info("【步骤1】项目信息已保存，新项目ID为: {}", newProjectId);

        // --- 3. 【核心修改】处理并拆分关联的Excel文件 ---
        if (file != null && !file.isEmpty()) {
            // a. 保存原始Excel文件到服务器 (保持不变)
            Path sourceFilePath = saveOriginalFile(file, newProjectId);

            // b. 将原始文件的信息存入 `project_files` 表 (保持不变)
            saveProjectFileInfo(file.getOriginalFilename(), sourceFilePath, newProjectId);

            // c. 【替换逻辑】调用 ExcelSplitterService 进行文件拆分
            log.info("【步骤2c】准备调用Excel拆分服务...");
            String splitOutputDirPath = Paths.get(uploadDir, String.valueOf(newProjectId), "split_output").toString();
            List<File> splitFiles = excelSplitterService.splitExcel(sourceFilePath.toFile(), splitOutputDirPath);

            // d. 【新增逻辑】将拆分后的每个文件信息也存入数据库
            for (File splitFile : splitFiles) {
                ProjectFile projectFile = new ProjectFile();
                projectFile.setProjectId(newProjectId);
                projectFile.setFileName(splitFile.getName());
                // 构造相对路径
                String relativePath = Paths.get(String.valueOf(newProjectId), "split_output", splitFile.getName()).toString().replace("\\", "/");
                projectFile.setFilePath(relativePath);
                projectFile.setFileType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"); // 文件类型是xlsx
                projectFileMapper.insert(projectFile);
                log.info("【步骤2d】已将拆分文件 '{}' 的信息存入数据库。", splitFile.getName());
            }
        }
    }

    /**
     * 辅助方法：将上传的原始Excel文件保存到服务器磁盘。 (保持不变)
     */
    private Path saveOriginalFile(MultipartFile file, Long projectId) throws IOException {
        String originalFilename = StringUtils.cleanPath(file.getOriginalFilename());
        Path projectUploadPath = Paths.get(uploadDir, String.valueOf(projectId));
        if (!Files.exists(projectUploadPath)) {
            Files.createDirectories(projectUploadPath);
        }
        Path sourceFilePath = projectUploadPath.resolve("source_" + originalFilename);
        Files.copy(file.getInputStream(), sourceFilePath, StandardCopyOption.REPLACE_EXISTING);
        log.info("【步骤2a】原始Excel文件已保存至: {}", sourceFilePath);
        return sourceFilePath;
    }

    /**
     * 辅助方法：将原始Excel文件的元信息保存到 project_files 数据表。 (保持不变)
     */
    private void saveProjectFileInfo(String originalFilename, Path sourceFilePath, Long projectId) {
        ProjectFile projectFile = new ProjectFile();
        projectFile.setProjectId(projectId);
        projectFile.setFileName("source_" + originalFilename);
        String relativePath = Paths.get(String.valueOf(projectId), "source_" + originalFilename).toString().replace("\\", "/");
        projectFile.setFilePath(relativePath);
        String fileExtension = "";
        int i = originalFilename.lastIndexOf('.');
        if (i > 0) fileExtension = originalFilename.substring(i);
        projectFile.setFileType(fileExtension);
        projectFileMapper.insert(projectFile);
        log.info("【步骤2b】原始文件信息已存入数据库。");
    }

    // =======================================================
    //  查询相关的 Service 方法 (保持不变，无需修改)
    // =======================================================

    @Override
    public List<Project> getAllProjects() {
        log.info("【Service】正在查询所有项目列表...");
        return projectMapper.selectList(null);
    }

    @Override
    public List<ProjectFile> getFilesByProjectId(Long projectId) {
        log.info("【Service】正在查询项目ID {} 的文件列表...", projectId);
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
}