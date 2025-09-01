// 文件路径: src/main/java/org/example/project/controller/ProcessRecordController.java
package org.example.project.controller;

// --- 基础 Spring 和 Java 依赖 ---
import org.example.project.entity.ProcessRecord;
import org.example.project.entity.ProjectFile;
import org.example.project.service.ProcessRecordService;
import org.example.project.service.ProjectService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException; // 【重要】确保导入这个类
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import lombok.Data;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

/**
 * 【专用控制器】: 负责处理所有与“设计过程记录表” (ProcessRecord) 资源相关的API请求。 根路径为
 * /api/process-records
 */
@RestController
@RequestMapping("/api/process-records") // 【优化点】: 将根路径统一定义在类级别
public class ProcessRecordController {

    private static final Logger log = LoggerFactory.getLogger(ProcessRecordController.class);

    @Autowired
    private ProcessRecordService processRecordService;

    // 注入ProjectService，因为它有 getFilesByRecordId 的实现
    @Autowired
    private ProjectService projectService;

    /**
     * API: 根据ID获取单个过程记录表的详细信息 路径: GET /api/process-records/{recordId}
     */
    @GetMapping("/{recordId}") // 【优化点】: 路径简化
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

    @DeleteMapping("/{recordId}")
    public ResponseEntity<String> deleteProcessRecord(@PathVariable Long recordId) {
        try {
            processRecordService.deleteRecordById(recordId); // 调用 Service 层方法
            return ResponseEntity.ok("记录及关联文件已成功删除。");
        } catch (AccessDeniedException e) {
            // 捕获权限异常
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(e.getMessage());
        } catch (Exception e) {
            // 捕获其他所有异常
            log.error("删除记录 {} 时发生错误", recordId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("删除失败: " + e.getMessage());
        }
    }

    /**
     * API: 根据过程记录表ID，获取其关联的所有文件列表 路径: GET /api/process-records/{recordId}/files
     */
    @GetMapping("/{recordId}/files") // 【优化点】: 路径简化
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
     * API: 查询指定过程记录的审核表文件信息。 路径: GET
     * /api/process-records/{recordId}/review-sheet-info
     */
    @GetMapping("/{recordId}/review-sheet-info") // 【优化点】: 路径简化
    public ResponseEntity<ProjectFile> getReviewSheetInfo(@PathVariable Long recordId) {
        try {
            ProjectFile reviewSheet = processRecordService.findReviewSheetByRecordId(recordId);
            return ResponseEntity.ok(reviewSheet);
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("查询审核表信息时出错, recordId: {}", recordId, e);
            return ResponseEntity.status(500).build();
        }
    }

    /**
     * API: 保存审核结果文件 路径: POST /api/process-records/{recordId}/save-review-sheet
     */
    @PostMapping(value = "/{recordId}/save-review-sheet", consumes = "multipart/form-data") // 【优化点】: 路径简化
    public ResponseEntity<String> saveReviewSheet(
            @PathVariable Long recordId,
            @RequestParam("file") MultipartFile file) {

        log.info("【Controller】接收到保存审核表的请求, recordId: {}", recordId);
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body("上传的审核表文件不能为空！");
        }
        try {
            processRecordService.saveReviewSheet(recordId, file);
            return ResponseEntity.ok("审核表保存成功！");
        } catch (Exception e) {
            log.error("【Controller】保存审核表时失败, recordId: {}", recordId, e);
            return ResponseEntity.status(500).body("服务器内部错误: " + e.getMessage());
        }
    }

    /**
     * API: 转交任务 路径: POST /api/process-records/{recordId}/reassign
     */
    @PostMapping("/{recordId}/reassign") // 【优化点】: 路径简化
    public ResponseEntity<?> reassignTask(@PathVariable Long recordId, @RequestBody ReassignTaskRequest dto) {
        processRecordService.reassignTask(recordId, dto.getNewAssigneeId());
        return ResponseEntity.ok().body("任务已成功转交。");
    }

    /**
     * API: 打回修改 路径: POST /api/process-records/{recordId}/request-changes
     */
    @PostMapping("/{recordId}/request-changes") // 【优化点】: 路径简化
    public ResponseEntity<?> requestChanges(@PathVariable Long recordId, @RequestBody RequestChangesRequest dto) {
        processRecordService.requestChanges(recordId, dto.getComment());
        return ResponseEntity.ok().body("记录已成功打回。");
    }

    /**
     * API: 设计员重新提交审核 路径: POST /api/process-records/{recordId}/resubmit
     */
    @PostMapping("/{recordId}/resubmit") // 【优化点】: 路径简化
    public ResponseEntity<?> resubmitRecord(
            @PathVariable Long recordId,
            @RequestParam("file") MultipartFile file) {

        try {
            processRecordService.resubmit(recordId, file);
            return ResponseEntity.ok().body("重新提交成功！");
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("文件保存失败：" + e.getMessage());
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // --- 内部静态 DTO 类 ---
    @Data
    public static class ReassignTaskRequest {

        private Long newAssigneeId;
    }

    @Data
    public static class RequestChangesRequest {

        private String comment;
    }

    @PostMapping("/{recordId}/save-draft")
    public ResponseEntity<?> saveDraft(
            @PathVariable Long recordId,
            @RequestParam("file") MultipartFile file) {

        try {
            processRecordService.saveDraftFile(recordId, file);
            Map<String, String> responseBody = new HashMap<>();
            responseBody.put("message", "草稿文件保存成功");
            return ResponseEntity.ok().body(responseBody);
        } catch (IOException e) {
            // 记录日志 e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("message", "文件保存失败"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", e.getMessage()));
        }
    }

    /**
     * 【新增 API 2】 触发审核流程，不接收文件，仅改变状态。
     *
     * @param recordId 过程记录的ID
     * @return 操作成功的响应
     */
    @PostMapping("/{recordId}/trigger-review")
    public ResponseEntity<?> triggerReview(@PathVariable Long recordId) {
        try {
            processRecordService.startReviewProcess(recordId);
            return ResponseEntity.ok().body(Map.of("message", "已成功提交审核"));
        } catch (IllegalStateException | IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
        }
    }
}
