package org.example.project.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.example.project.dto.ProjectCreateDTO;
import org.example.project.entity.Project;
import org.example.project.entity.ProjectFile;
import org.example.project.service.ProjectService; // 只需要一个ProjectService
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;

/**
 * 项目相关的API控制器
 * 负责处理所有与项目创建、查询、文件列表等相关的Web请求。
 */
@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private static final Logger log = LoggerFactory.getLogger(ProjectController.class);

    @Autowired
    private ProjectService projectService;

    /**
     * 【统一的创建接口】
     * 接收项目表单数据和可选的Excel文件，并调用Service层进行处理。
     */
    @PostMapping(value = "/create", consumes = "multipart/form-data")
    public ResponseEntity<String> createProject(
            @RequestPart("projectData") String projectDataJson,
            @RequestPart(value = "file", required = false) MultipartFile file) {

        log.info("【Controller】接收到创建项目请求...");
        if (file != null && !file.isEmpty()) {
            log.info("【Controller】文件名: {}, 文件大小: {} bytes", file.getOriginalFilename(), file.getSize());
        } else {
            log.info("【Controller】本次请求未上传文件。");
        }
        
        try {
            // 1. 解析JSON数据
            log.info("【Controller】准备解析JSON数据...");
            ObjectMapper objectMapper = new ObjectMapper();
            objectMapper.registerModule(new JavaTimeModule()); 
            ProjectCreateDTO createDTO = objectMapper.readValue(projectDataJson, ProjectCreateDTO.class);
            log.info("【Controller】项目数据JSON解析成功，项目号: {}", createDTO.getProjectNumber());

            // 2. 调用Service层核心方法
            log.info("【Controller】准备调用 projectService.createProjectWithFile...");
            projectService.createProjectWithFile(createDTO, file);
            log.info("【Controller】Service方法执行完毕，准备返回成功响应。");

            // 3. 返回成功响应
            return ResponseEntity.status(HttpStatus.CREATED).body("项目创建成功");

        } catch (RuntimeException re) {
            // 【优化1】专门捕获Service层主动抛出的业务异常
            // 例如 "项目号已存在" 这种，应该返回 400 Bad Request
            log.warn("【Controller】捕获到业务逻辑异常: {}", re.getMessage());
            return ResponseEntity.badRequest().body(re.getMessage());
        } catch (Exception e) {
            // 【优化2】捕获所有其他未知异常 (IO, NullPointer, etc.)
            // 这种是真正的服务器内部错误，应该返回 500 Internal Server Error
            // 并且在日志中打印完整的堆栈信息 (e)，这对于调试至关重要！
            log.error("【Controller】创建项目时发生未知服务器错误！", e); 
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("服务器内部错误，请查看后端日志了解详情。");
        }
    }

    /**
     * 【查询所有项目列表】
     * 提供一个GET接口，用于获取所有项目的列表。
     */
    @GetMapping("/list")
    public ResponseEntity<List<Project>> listAllProjects() {
        try {
            List<Project> projects = projectService.getAllProjects();
            return ResponseEntity.ok(projects);
        } catch (Exception e) {
            log.error("【Controller】获取项目列表时发生错误", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * 【查询特定项目的文件列表】
     * 根据项目ID，获取该项目下所有关联文件的列表。
     */
    @GetMapping("/{projectId}/files")
    public ResponseEntity<List<ProjectFile>> getProjectFiles(@PathVariable Long projectId) {
        try {
            // 我们将这个查询逻辑也放在ProjectService中，保持统一
            List<ProjectFile> files = projectService.getFilesByProjectId(projectId);
            return ResponseEntity.ok(files);
        } catch (Exception e) {
            log.error("【Controller】获取项目 {} 的文件列表失败", projectId, e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/{projectId}") // 【新增】
    public ResponseEntity<Project> getProjectById(@PathVariable Long projectId) {
        Project project = projectService.getProjectById(projectId);
        if (project != null) {
            return ResponseEntity.ok(project);
        } else {
            return ResponseEntity.notFound().build();
        }
    }
}