package org.example.project.service.impl;

// --- 基础依赖 ---
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.example.project.dto.ProjectCreateDTO;
import org.example.project.entity.Project;
import org.example.project.entity.ProjectFile;
import org.example.project.mapper.ProjectFileMapper;
import org.example.project.mapper.ProjectMapper;
import org.example.project.service.ProjectService;
import org.example.project.utils.WpsConverter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;

// --- 文件处理依赖 ---
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;

@Service
public class ProjectServiceImpl implements ProjectService {

    private static final Logger log = LoggerFactory.getLogger(ProjectServiceImpl.class);

    @Autowired
    private ProjectMapper projectMapper;

    @Autowired
    private ProjectFileMapper projectFileMapper;
    
    @Autowired
    private WpsConverter wpsConverter;

    @Value("${file.upload-dir}")
    private String uploadDir;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void createProjectWithFile(ProjectCreateDTO createDTO, MultipartFile file) throws IOException, InterruptedException {
        
        // --- 步骤 0：前置检查 ---
        QueryWrapper<Project> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("project_number", createDTO.getProjectNumber());
        if (projectMapper.selectCount(queryWrapper) > 0) {
            throw new RuntimeException("项目号 '" + createDTO.getProjectNumber() + "' 已存在，请勿重复创建！");
        }

        // --- 步骤 1：保存项目基础信息 ---
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
        log.info("【Service】项目信息已保存，新项目ID为: {}", newProjectId);
        
        // --- 步骤 2：处理关联的Excel文件 ---
        if (file != null && !file.isEmpty()) {
            Path sourceFilePath = saveOriginalFile(file, newProjectId);
            
            File imageOutputDir = new File(uploadDir, newProjectId + File.separator + "images");
            if (!imageOutputDir.exists()) {
                imageOutputDir.mkdirs();
            }
            wpsConverter.convertToPng(sourceFilePath.toFile(), imageOutputDir);
            
            scanAndSaveGeneratedPngs(imageOutputDir, newProjectId);

        } else {
            log.warn("【Service】未提供关联文件，仅创建项目信息。");
        }
    }

    @Override
    public List<Project> getAllProjects() {
        log.info("【Service】正在查询所有项目列表...");
        return projectMapper.selectList(null);
    }
    
    /**
     * 【新增】根据项目ID获取其所有关联的文件列表。
     * @param projectId 项目的ID
     * @return 该项目的文件列表
     */
    @Override
    public List<ProjectFile> getFilesByProjectId(Long projectId) {
        log.info("【Service】正在查询项目ID {} 的文件列表...", projectId);
        QueryWrapper<ProjectFile> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("project_id", projectId);
        // 按文件名进行排序，确保前端显示顺序一致
        queryWrapper.orderByAsc("file_name");
        return projectFileMapper.selectList(queryWrapper);
    }

    // =======================================================
    //  私有辅助方法
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

    private void scanAndSaveGeneratedPngs(File imageOutputDir, Long projectId) {
        File[] generatedFiles = imageOutputDir.listFiles((dir, name) -> name.toLowerCase().endsWith(".png"));
        
        if (generatedFiles == null || generatedFiles.length == 0) {
            log.error("WPS转换后在目录 {} 中未找到任何PNG文件。", imageOutputDir.getAbsolutePath());
            throw new RuntimeException("WPS转换失败，未生成任何图片。请检查WPS配置和命令行参数。");
        }

        log.info("扫描到 {} 个由WPS生成的PNG文件，准备存入数据库...", generatedFiles.length);

        for (File pngFile : generatedFiles) {
            ProjectFile projectFile = new ProjectFile();
            projectFile.setProjectId(projectId);
            projectFile.setFileName(pngFile.getName());
            String relativePath = Paths.get(String.valueOf(projectId), "images", pngFile.getName()).toString().replace("\\", "/");
            projectFile.setFilePath(relativePath);
            projectFile.setFileType("image/png");
            projectFileMapper.insert(projectFile);
        }
        log.info("所有PNG文件信息已成功存入数据库。");
    }
    
    @Override
    public Project getProjectById(Long projectId) {
        log.info("【Service】正在查询项目ID {} 的详细信息...", projectId);
        // MyBatis-Plus自带的方法
        return projectMapper.selectById(projectId);
    }
}