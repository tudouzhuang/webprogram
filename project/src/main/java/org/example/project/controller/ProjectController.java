package org.example.project.controller;

// --- 基础 Spring 和 Java 依赖 ---
import org.example.project.dto.ProjectCreateDTO;
import org.example.project.entity.Project;
import org.example.project.entity.ProjectFile;
import org.example.project.service.ProjectService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;
import java.util.NoSuchElementException; // 用于捕获Service层抛出的特定异常

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
    //  一、项目主体信息管理 (Project CRUD)
    // =======================================================

    /**
     * 【创建项目基础信息接口】
     * 接收纯JSON格式的项目表单数据，用于创建项目的核心信息。
     * @param createDTO 包含项目基础信息的DTO对象。
     * @return 成功或失败的响应。
     */
    @PostMapping("/create-info")
    public ResponseEntity<String> createProjectInfo(@RequestBody ProjectCreateDTO createDTO) {
        log.info("【Controller】接收到创建项目基础信息请求，项目号: {}", createDTO.getProjectNumber());
        try {
            // 调用Service层方法，此时文件参数为null
            projectService.createProjectWithFile(createDTO, null);
            log.info("【Controller】项目基础信息创建成功。");
            return ResponseEntity.status(HttpStatus.CREATED).body("项目基础信息创建成功");
        } catch (RuntimeException re) {
            // 捕获业务异常，如“项目号已存在”
            log.warn("【Controller】业务逻辑异常: {}", re.getMessage());
            return ResponseEntity.badRequest().body(re.getMessage());
        } catch (Exception e) {
            // 捕获其他未知异常
            log.error("【Controller】创建项目信息时发生未知服务器错误！", e); 
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("服务器内部错误，请查看后端日志。");
        }
    }

    /**
     * 【查询所有项目列表接口】
     * 提供一个GET接口，用于获取所有项目的列表。
     * @return 包含所有项目信息的列表。
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
     * 【查询单个项目详情接口】
     * 根据项目ID，获取该项目的详细基础信息。
     * @param projectId 项目的唯一ID。
     * @return 项目的详细信息或404 Not Found。
     */
    @GetMapping("/{projectId}")
    public ResponseEntity<Project> getProjectById(@PathVariable Long projectId) {
        log.info("【Controller】接收到获取项目详情的请求, ID: {}", projectId);
        try {
            Project project = projectService.getProjectById(projectId);
            return ResponseEntity.ok(project);
        } catch (NoSuchElementException nse) {
            // 捕获Service层抛出的“找不到”异常，并返回404
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
     * 【上传/更新 设计策划书 接口】
     * 为指定的项目上传或替换“设计策划书”文件。
     * @param projectId 要关联的项目ID。
     * @param file      上传的Excel文件（设计策划书）。
     * @return 成功或失败的响应。
     */
    @PostMapping(value = "/{projectId}/upload/planning-document", consumes = "multipart/form-data")
    public ResponseEntity<String> uploadPlanningDocument(
            @PathVariable Long projectId,
            @RequestParam("file") MultipartFile file) {
        
        final String documentType = "PLANNING_DOCUMENT"; // 定义文档类型常量
        log.info("【Controller】接收到为项目ID {} 上传'{}'的请求", projectId, documentType);

        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body("上传的文件不能为空！");
        }
        
        try {
            projectService.uploadOrUpdateProjectFile(projectId, file, documentType);
            return ResponseEntity.ok("设计策划书上传成功！");
        } catch (Exception e) {
            log.error("【Controller】为项目 {} 上传'{}'时发生错误", projectId, documentType, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("文件上传失败，请查看服务器日志。");
        }
    }

    /**
     * 【上传/更新 设计过程记录表 接口】
     * 为指定的项目上传或替换“设计过程记录表”文件。
     * @param projectId 要关联的项目ID。
     * @param file      上传的Excel文件（设计过程记录表）。
     * @return 成功或失败的响应。
     */
    @PostMapping(value = "/{projectId}/upload/check-record", consumes = "multipart/form-data")
    public ResponseEntity<String> uploadCheckRecord(
            @PathVariable Long projectId,
            @RequestParam("file") MultipartFile file) {
            
        final String documentType = "CHECK_RECORD"; // 定义文档类型常量
        log.info("【Controller】接收到为项目ID {} 上传'{}'的请求", projectId, documentType);
        
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body("上传的文件不能为空！");
        }

        try {
            projectService.uploadOrUpdateProjectFile(projectId, file, documentType);
            return ResponseEntity.ok("设计过程记录表上传成功！");
        } catch (Exception e) {
            log.error("【Controller】为项目 {} 上传'{}'时发生错误", projectId, documentType, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("文件上传失败，请查看服务器日志。");
        }
    }

    /**
     * 【查询特定项目的文件列表接口】
     * 根据项目ID，获取该项目下所有关联文件的列表（包括策划书、记录表等）。
     * @param projectId 项目的唯一ID。
     * @return 该项目所有文件的元信息列表。
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
}