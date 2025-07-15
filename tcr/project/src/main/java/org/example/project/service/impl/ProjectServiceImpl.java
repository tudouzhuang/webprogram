package org.example.project.service.impl;

import org.example.project.dto.ProjectCreateDTO;
import org.example.project.entity.Project;
import org.example.project.mapper.ProjectMapper;
import org.example.project.service.ProjectService;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value; // 【1. 导入】
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional; // 【1. 导入】
import org.springframework.web.multipart.MultipartFile; // 【1. 导入】

import java.io.IOException; // 【1. 导入】
import java.nio.file.Files; // 【1. 导入】
import java.nio.file.Path; // 【1. 导入】
import java.nio.file.Paths; // 【1. 导入】
import java.util.UUID; // 【1. 导入】

@Service
public class ProjectServiceImpl implements ProjectService {

    @Autowired
    private ProjectMapper projectMapper;

    // 【2. 新增】从配置文件注入文件上传的根目录
    @Value("${file.upload-dir}")
    private String uploadDir;

    /**
     * 【保持不变】处理不带文件的项目创建
     * 这个方法现在可以被新的方法复用
     */
    @Override
    public void createProject(ProjectCreateDTO createDTO) {
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
    }
    
    /**
     * 【3. 新增】实现创建项目并保存关联文件的方法
     * @Transactional 注解确保项目信息保存和文件保存（未来还有文件记录保存）要么都成功，要么都回滚。
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public void createProjectWithFile(ProjectCreateDTO createDTO, MultipartFile file) throws IOException {
        
        // --- 第一步：保存项目基础信息到数据库 ---
        // 我们复用你已经写好的逻辑，但需要稍作调整以获取新ID
        Project projectEntity = new Project();
        BeanUtils.copyProperties(createDTO, projectEntity);
        // ... (处理嵌套尺寸的逻辑) ...
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

        // 调用 insert 方法，MyBatis-Plus 会自动将生成的主键ID回填到 projectEntity 对象中
        projectMapper.insert(projectEntity);
        
        // 获取新生成的项目ID
        Long newProjectId = projectEntity.getId();
        System.out.println("项目信息已保存，新项目ID为: " + newProjectId);

        // --- 第二步：保存上传的文件到服务器磁盘 ---
        if (file != null && !file.isEmpty()) {
            
            // 为该项目创建一个专属的子目录，例如 /project-uploads/123/
            Path projectUploadPath = Paths.get(uploadDir, String.valueOf(newProjectId));
            if (!Files.exists(projectUploadPath)) {
                Files.createDirectories(projectUploadPath);
            }
            
            // 直接使用原始文件名进行保存
            String originalFilename = file.getOriginalFilename();
            Path filePath = projectUploadPath.resolve(originalFilename);

            // 保存文件
            Files.copy(file.getInputStream(), filePath);

            System.out.println("关联文件已成功保存到: " + filePath.toString());

            // --- 后续步骤的占位 ---
            // TODO: (阶段1完成后) 在这里将文件信息(newProjectId, originalFilename, 相对路径等)保存到 `project_files` 表
        }
    }
}