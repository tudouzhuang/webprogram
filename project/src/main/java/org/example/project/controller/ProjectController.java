package org.example.project.controller;

// --- 基础 Spring 和 Java 依赖 ---
import org.example.project.dto.ProjectCreateDTO;
import org.example.project.entity.Project;
import org.example.project.entity.ProjectFile;
import org.example.project.service.ProcessRecordService; // 【注入】: 导入新服务的接口
import org.example.project.service.ProjectService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

// --- JSON处理 ---
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import java.util.List;
import java.util.NoSuchElementException;

/**
 * 项目相关的API控制器
 * 负责处理所有与项目创建、查询、更新以及关联文件管理的Web请求。
 */
@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private static final Logger log = LoggerFactory.getLogger(ProjectController.class);

    @Autowired
    private ProjectService projectService;
    
    // =======================================================
    //  ↓↓↓ 【核心修改 1】: 在这里注入 ProcessRecordService ↓↓↓
    // =======================================================
    @Autowired
    private ProcessRecordService processRecordService;


    // =======================================================
    //  一、项目主体信息管理 (Project CRUD)
    // =======================================================

    /**
     * 【API 1 - 创建项目】
     * 接收纯JSON格式的项目数据。根据传入的JSON内容，可以同时支持“极简创建”和“完整信息创建”。
     * - 如果前端只传来 projectName，Service层只保存名称。
     * - 如果前端传来所有信息，Service层保存所有信息。
     * HTTP 方法: POST /api/projects
     */
    @PostMapping
    public ResponseEntity<?> createProject(@RequestBody ProjectCreateDTO createDTO) {
        log.info("【Controller】接收到创建项目请求: {}", createDTO);
        try {
            // 调用Service中统一的创建方法
            Project newProject = projectService.createProject(createDTO);
            return ResponseEntity.status(HttpStatus.CREATED).body(newProject);
        } catch (RuntimeException e) {
            log.warn("【Controller】创建项目失败，业务异常: {}", e.getMessage());
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            log.error("【Controller】创建项目时发生未知服务器错误", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("服务器内部错误");
        }
    }

    /**
     * 【API 2 - 完整创建项目，带文件】(保持不变)
     * 同时接收项目的所有基础信息(JSON)和关联的Excel文件。
     * HTTP 方法: POST /api/projects/create-with-file
     */
    @PostMapping(value = "/create-with-file", consumes = "multipart/form-data")
    public ResponseEntity<String> createFullProjectWithFile(
            @RequestPart("projectData") String projectDataJson,
            @RequestPart("file") MultipartFile file) {
        
        log.info("【Controller】接收到完整创建项目（带文件）的请求");
        try {
            ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
            ProjectCreateDTO createDTO = objectMapper.readValue(projectDataJson, ProjectCreateDTO.class);
            
            projectService.createProjectWithFile(createDTO, file);

            return ResponseEntity.status(HttpStatus.CREATED).body("项目及关联文件已成功创建");
        } catch (RuntimeException e) {
            log.warn("【Controller】创建项目失败，业务异常: {}", e.getMessage());
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            log.error("【Controller】完整创建项目时发生错误", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("服务器内部错误，请查看日志");
        }
    }

    /**
     * 【查询所有项目列表接口】 (保持不变)
     */
    @GetMapping("/list")
    public ResponseEntity<List<Project>> listAllProjects() {
        log.info("【Controller】接收到获取所有项目列表的请求。");
        try {
            List<Project> projects = projectService.getAllProjects();
            return ResponseEntity.ok(projects);
        } catch (Exception e) {
            log.error("【Controller】获取项目列表时发生错误", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * 【查询单个项目详情接口】 (保持不变)
     */
    @GetMapping("/{projectId}")
    public ResponseEntity<Project> getProjectById(@PathVariable Long projectId) {
        log.info("【Controller】接收到获取项目详情的请求, ID: {}", projectId);
        try {
            Project project = projectService.getProjectById(projectId);
            return ResponseEntity.ok(project);
        } catch (NoSuchElementException nse) {
            log.warn("【Controller】请求的项目ID不存在: {}", projectId);
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("【Controller】获取项目 {} 详情时发生错误", projectId, e);
            return ResponseEntity.internalServerError().build();
        }
    }

    // =======================================================
    //  二、项目关联文件管理 (Project File Management)
    // =======================================================

    /**
     * 【上传/更新特定类型文件的接口】 (保持不变)
     */
    @PostMapping(value = "/{projectId}/files/{documentType}", consumes = "multipart/form-data")
    public ResponseEntity<String> uploadOrUpdateDocument(
            @PathVariable Long projectId,
            @PathVariable String documentType,
            @RequestParam("file") MultipartFile file) {
        
        log.info("【Controller】接收到为项目ID {} 上传'{}'的请求", projectId, documentType);

        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body("上传的文件不能为空！");
        }
        
        try {
            projectService.uploadOrUpdateProjectFile(projectId, file, documentType.toUpperCase());
            return ResponseEntity.ok("文档 '" + documentType + "' 上传/更新成功！");
        } catch (NoSuchElementException e) {
            log.warn("【Controller】上传文件失败: {}", e.getMessage());
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("【Controller】为项目 {} 上传'{}'时发生错误", projectId, documentType, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("文件处理失败，请查看服务器日志。");
        }
    }

    /**
     * 【查询特定项目的文件列表接口】 (保持不变)
     */
    @GetMapping("/{projectId}/files")
    public ResponseEntity<List<ProjectFile>> getProjectFiles(@PathVariable Long projectId) {
        log.info("【Controller】接收到获取项目 {} 文件列表的请求", projectId);
        try {
            List<ProjectFile> files = projectService.getFilesByProjectId(projectId);
            return ResponseEntity.ok(files);
        } catch (Exception e) {
            log.error("【Controller】获取项目 {} 的文件列表失败", projectId, e);
            return ResponseEntity.internalServerError().build();
        }
    }
    
    
    // ======================================================================
    //  ↓↓↓ 【核心修改 2】: 在文件末尾添加新的 API 方法 ↓↓↓
    // ======================================================================

    /**
     * 【API接口：为指定项目创建一份新的设计过程记录表】
     * @param projectId       从URL路径中获取的项目ID
     * @param recordMetaJson  包含记录表元数据的JSON字符串
     * @param file            上传的Excel文件
     * @return                操作结果
     */
    @PostMapping(value = "/{projectId}/process-records", consumes = "multipart/form-data")
    public ResponseEntity<String> createProcessRecord(
            @PathVariable Long projectId,
            @RequestPart("recordMeta") String recordMetaJson,
            @RequestPart("file") MultipartFile file) {
        
        try {
            // 调用新注入的 ProcessRecordService 来处理业务逻辑
            processRecordService.createProcessRecord(projectId, recordMetaJson, file);
            return ResponseEntity.ok("过程记录表提交成功！");
        } catch (Exception e) {
            log.error("创建过程记录表时失败, projectId: {}", projectId, e);
            // 返回具体的错误信息给前端，体验更好
            return ResponseEntity.status(500).body("服务器内部错误: " + e.getMessage());
        }
    }
}