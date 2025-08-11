package org.example.project.controller;

// --- 基础 Spring 和 Java 依赖 ---
import org.example.project.entity.ProcessRecord;
import org.example.project.entity.ProjectFile;
import org.example.project.service.ProcessRecordService;
import org.example.project.service.ProjectService; // 需要它来获取文件列表
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.NoSuchElementException;

/**
 * 【专用控制器】: 负责处理所有与“设计过程记录表”相关的API请求。
 * 根路径为 /api/process-records
 */
@RestController
@RequestMapping("/api")
public class ProcessRecordController {

    private static final Logger log = LoggerFactory.getLogger(ProcessRecordController.class);
    
    @Autowired
    private ProcessRecordService processRecordService;

    // 注入ProjectService，因为它有 getFilesByRecordId 的实现
    @Autowired
    private ProjectService projectService; 

    /**
     * 【API接口：为指定项目创建一份新的设计过程记录表】
     * 路径: POST /api/projects/{projectId}/process-records
     */
    @PostMapping(value = "/projects/{projectId}/process-records", consumes = "multipart/form-data")
    public ResponseEntity<String> createProcessRecord(
            @PathVariable Long projectId,
            @RequestPart("recordMeta") String recordMetaJson,
            @RequestPart("file") MultipartFile file) {
        
        try {
            processRecordService.createProcessRecord(projectId, recordMetaJson, file);
            return ResponseEntity.ok("过程记录表提交成功！");
        } catch (Exception e) {
            log.error("创建过程记录表时失败, projectId: {}", projectId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("服务器内部错误: " + e.getMessage());
        }
    }

    /**
     * 【API接口：根据项目ID，获取该项目下所有过程记录表的主信息列表】
     * 路径: GET /api/projects/{projectId}/process-records
     */
    @GetMapping("/projects/{projectId}/process-records")
    public ResponseEntity<List<ProcessRecord>> getProcessRecordsByProjectId(@PathVariable Long projectId) {
        log.info("【Controller】获取项目 {} 的过程记录表列表...", projectId);
        try {
            List<ProcessRecord> records = processRecordService.getRecordsByProjectId(projectId);
            return ResponseEntity.ok(records);
        } catch (Exception e) {
            log.error("获取项目 {} 的过程记录表列表失败", projectId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * 【API接口：根据ID获取单个过程记录表的详细信息】
     * 路径: GET /api/process-records/{recordId}
     */
    @GetMapping("/process-records/{recordId}")
    public ResponseEntity<?> getProcessRecordById(@PathVariable Long recordId) {
        log.info("【Controller】获取单个过程记录表详情, ID: {}", recordId);
        try {
            ProcessRecord record = processRecordService.getRecordById(recordId);
            return ResponseEntity.ok(record);
        } catch (java.util.NoSuchElementException e) {
            log.warn("【Controller】请求的过程记录表ID不存在: {}", recordId);
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("获取过程记录表 {} 详情时失败", recordId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("获取记录详情失败");
        }
    }

    /**
     * 【API接口：根据过程记录表ID，获取其关联的所有文件列表】
     * 路径: GET /api/process-records/{recordId}/files
     */
    @GetMapping("/process-records/{recordId}/files")
    public ResponseEntity<?> getFilesByRecordId(@PathVariable Long recordId) {
        log.info("【Controller】获取过程记录表 {} 的关联文件列表...", recordId);
        try {
            List<ProjectFile> files = projectService.getFilesByRecordId(recordId); 
            return ResponseEntity.ok(files);
        } catch (Exception e) {
            log.error("获取过程记录表 {} 的文件列表失败", recordId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("获取文件列表失败");
        }
    }

       /**
     * 【新增API】：查询指定过程记录的审核表文件信息。
     * @param recordId 过程记录的ID
     * @return 如果审核表存在，返回文件信息；如果不存在，返回404 Not Found。
     */
    @GetMapping("/process-records/{recordId}/review-sheet-info")
    public ResponseEntity<ProjectFile> getReviewSheetInfo(@PathVariable Long recordId) {
        try {
            // Service层会处理查找逻辑
            ProjectFile reviewSheet = processRecordService.findReviewSheetByRecordId(recordId);
            return ResponseEntity.ok(reviewSheet);
        } catch (NoSuchElementException e) {
            // Service层在找不到时会抛出此异常
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("查询审核表信息时出错, recordId: {}", recordId, e);
            return ResponseEntity.status(500).build();
        }
    }

   @PostMapping(value = "/process-records/{recordId}/save-review-sheet", consumes = "multipart/form-data")
   public ResponseEntity<String> saveReviewSheet(
           @PathVariable Long recordId,
           @RequestParam("file") MultipartFile file) {
       
       log.info("【Controller】接收到保存审核表的请求, recordId: {}", recordId);
       
       if (file == null || file.isEmpty()) {
           return ResponseEntity.badRequest().body("上传的审核表文件不能为空！");
       }

       try {
           // 调用 Service 层去执行真正的保存逻辑
           processRecordService.saveReviewSheet(recordId, file);
           return ResponseEntity.ok("审核表保存成功！");
       } catch (Exception e) {
           log.error("【Controller】保存审核表时失败, recordId: {}", recordId, e);
           return ResponseEntity.status(500).body("服务器内部错误: " + e.getMessage());
       }
   }
}