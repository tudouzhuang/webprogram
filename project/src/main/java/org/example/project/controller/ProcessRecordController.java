// 文件路径: src/main/java/org/example/project/controller/ProcessRecordController.java
package org.example.project.controller;

import org.example.project.dto.ReviewProblemCreateDTO;
import org.example.project.dto.ReviewProblemVO;
import org.example.project.entity.DesignWorkSession;
// --- 基础 Spring 和 Java 依赖 ---
import org.example.project.entity.ProcessRecord;
import org.example.project.entity.ProjectFile;
import org.example.project.entity.ReviewProblem;
import org.example.project.service.ProcessRecordService;
import org.example.project.service.ProjectService;
import org.example.project.service.ReviewProblemService;
import org.example.project.service.DesignWorkSessionService;
import org.example.project.service.StatisticsService;   

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException; // 【重要】确保导入这个类
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import lombok.Data;
import lombok.extern.slf4j.Slf4j; // <-- 1. 添加 import
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import javax.validation.Valid;
/**
 * 【专用控制器】: 负责处理所有与“设计过程记录表” (ProcessRecord) 资源相关的API请求。 根路径为
 * /api/process-records
 */

@Slf4j
@RestController
@RequestMapping("/api/process-records") // 【优化点】: 将根路径统一定义在类级别
public class ProcessRecordController {

    private static final Logger log = LoggerFactory.getLogger(ProcessRecordController.class);

    @Autowired
    private ProcessRecordService processRecordService;

    @Autowired
    private StatisticsService statisticsService;
    // 注入ProjectService，因为它有 getFilesByRecordId 的实现
    @Autowired
    private ProjectService projectService;

    @Autowired
    private ReviewProblemService reviewProblemService;

    @Autowired
    private DesignWorkSessionService sessionService;
    /**
     * API: 根据ID获取单个过程记录表的详细信息 路径: GET /api/process-records/{recordId}
     */

     @Data // 需要 Lombok
     public static class RequestChangesPayload {
         private String comment;
     }
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

    @PostMapping("/{recordId}/files/{fileId}")
    public ResponseEntity<Void> updateAssociatedFile(
            @PathVariable Long recordId,
            @PathVariable Long fileId,
            @RequestParam("file") MultipartFile file) {
        try {
            processRecordService.updateAssociatedFile(recordId, fileId, file);
            return ResponseEntity.ok().build();
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
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
    @PostMapping("/{recordId}/reassign")
    public ResponseEntity<?> reassignTask(@PathVariable Long recordId, @RequestBody ReassignTaskRequest dto) {
        // 【调试点1】在这里添加日志，确认请求是否已经通过了 Spring Security
        log.info(">>> [CONTROLLER] reassignTask API 被调用, Record ID: {}, New Assignee ID: {}", recordId, dto.getNewAssigneeId());
        
        processRecordService.reassignTask(recordId, dto.getNewAssigneeId());
        return ResponseEntity.ok().body("任务已成功转交。");
    }
    /**
     * API: 打回修改 路径: POST /api/process-records/{recordId}/request-changes
     */
    @PostMapping("/{recordId}/request-changes")
    public ResponseEntity<?> requestChanges(
            @PathVariable Long recordId, 
            @RequestBody RequestChangesPayload payload 
        ) {
    
        // =======================================================
        //  ↓↓↓ 【【【 核心调试代码 】】】 ↓↓↓
        // =======================================================
        log.info("--- [Request Changes] 接口 /api/process-records/{}/request-changes 被调用 ---", recordId);
        
        // 探针 1: 检查接收到的 payload 是否为 null
        if (payload == null) {
            log.error("【调试错误】: 请求体 (payload) 为 null！前端可能没有正确发送 JSON Body。");
            return ResponseEntity.badRequest().body("请求体不能为空。");
        }
        
        // 探针 2: 打印从 payload 中获取到的 comment 值
        String comment = payload.getComment();
        log.info("  -> 从 payload 中获取到的 comment 值是: '{}'", comment);
        // =======================================================
    
    
        // 4. 安全检查 (保持不变)
        if (comment == null || comment.trim().isEmpty()) {
            log.warn("  -> [验证失败] comment 为空或只有空格，返回 400 Bad Request。");
            return ResponseEntity.badRequest().body("打回意见不能为空。");
        }
    
        try {
            // 5. 将正确的 comment 值传递给 Service
            log.info("  -> [调用 Service] 准备调用 processRecordService.requestChanges...");
            processRecordService.requestChanges(recordId, comment);
            log.info("--- [Request Changes] Service 方法执行完毕，操作成功。---");
            return ResponseEntity.ok().body("记录已成功打回。");
        } catch (Exception e) {
            // 捕获 Service 层可能抛出的业务异常
            log.error("--- [Request Changes] Service 方法执行时抛出异常！---", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
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

    /**
     * 【【已改造】】 保存在线编辑后的单个关联文件（例如某个检查项）。
     *
     * @param recordId 过程记录的ID
     * @param fileId 要更新的具体文件记录的ID (来自 project_files 表)
     * @param file 新的文件内容
     * @return 操作成功的响应
     */
    @PostMapping("/{recordId}/save-draft")
    public ResponseEntity<?> saveDraft(
            @PathVariable Long recordId,
            @RequestParam("fileId") Long fileId, //  <-- 【核心修改1】: 新增 fileId 参数
            @RequestParam("file") MultipartFile file) {

        try {
            // 【核心修改2】: 调用一个新的 Service 方法
            processRecordService.updateAssociatedFile(recordId, fileId, file);

            Map<String, String> responseBody = new HashMap<>();
            responseBody.put("message", "文件更新成功");
            return ResponseEntity.ok().body(responseBody);

        } catch (IOException e) {
            e.printStackTrace();
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("message", "文件保存时发生IO错误");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);

        } catch (IllegalArgumentException | NoSuchElementException e) {
            // IllegalArgumentException: 文件为空
            // NoSuchElementException: 找不到记录
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
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

            // --- 【核心修正 3】 ---
            Map<String, String> responseBody = new HashMap<>();
            responseBody.put("message", "已成功提交审核");
            return ResponseEntity.ok().body(responseBody);

        } catch (IllegalStateException | IllegalArgumentException e) {

            // --- 【核心修正 4】 ---
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
        }
    }

    @GetMapping("/{recordId}/problems")
    // 【修改返回类型】
    public ResponseEntity<List<ReviewProblemVO>> getProblemsByRecordId(@PathVariable Long recordId) {
        List<ReviewProblemVO> problems = reviewProblemService.findProblemsByRecordId(recordId);
        return ResponseEntity.ok(problems);
    }

    /**
     * 为指定的过程记录创建一个新的问题
     * @param recordId 过程记录ID
     * @param createDTO 问题创建数据
     * @return 创建成功后的问题对象
     */
    @PostMapping("/{recordId}/problems")
    public ResponseEntity<ReviewProblem> createProblemForRecord(
            @PathVariable Long recordId,
            @Valid @RequestBody ReviewProblemCreateDTO createDTO) {
        
        ReviewProblem createdProblem = reviewProblemService.createProblem(recordId, createDTO);
        return new ResponseEntity<>(createdProblem, HttpStatus.CREATED);
    }

    @PostMapping("/{recordId}/work-sessions/start")
    public ResponseEntity<DesignWorkSession> startWorkSession(@PathVariable Long recordId) {
        DesignWorkSession session = sessionService.startSession(recordId);
        return ResponseEntity.ok(session);
    }

    @PostMapping("/{recordId}/approve")
    public ResponseEntity<Void> approveRecord(@PathVariable Long recordId) {
        processRecordService.approveRecord(recordId); // 假设Service中有此方法
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{recordId}/withdraw")
    public ResponseEntity<Void> withdrawRecord(@PathVariable Long recordId) {
        processRecordService.withdrawRecord(recordId);
        return ResponseEntity.ok().build();
    }
}
