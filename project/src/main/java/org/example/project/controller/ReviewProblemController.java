package org.example.project.controller;

import org.example.project.dto.ReviewProblemUpdateDTO;
import org.example.project.entity.ReviewProblem;
import org.example.project.service.ReviewProblemService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/problems")
public class ReviewProblemController {

    @Autowired
    private ReviewProblemService reviewProblemService;

    /**
     * 更新一个已存在的问题
     */
    @PutMapping("/{problemId}")
    public ResponseEntity<ReviewProblem> updateProblem(
            @PathVariable Long problemId,
            @RequestBody ReviewProblemUpdateDTO updateDTO) {
        ReviewProblem updatedProblem = reviewProblemService.updateProblem(problemId, updateDTO);
        return ResponseEntity.ok(updatedProblem);
    }

    /**
     * 删除一个问题
     */
    @DeleteMapping("/{problemId}")
    public ResponseEntity<Void> deleteProblem(@PathVariable Long problemId) {
        reviewProblemService.deleteProblem(problemId);
        return ResponseEntity.noContent().build();
    }

    /**
     * 上传【问题描述】的截图（审核员用）
     */
    @PostMapping("/{problemId}/screenshot")
    public ResponseEntity<Map<String, String>> uploadScreenshot(
            @PathVariable Long problemId,
            @RequestParam("file") MultipartFile file) throws IOException {
        
        String filePath = reviewProblemService.uploadAndLinkScreenshot(problemId, file);

        Map<String, String> responseBody = new HashMap<>();
        responseBody.put("filePath", filePath);
        return ResponseEntity.ok(responseBody);
    }

    /**
     * 【新增接口】上传【修改证明】的截图（设计员用）
     * 用于问题闭环，设计员上传修改后的状态截图
     */
    @PostMapping("/{problemId}/fix-screenshot")
    public ResponseEntity<Map<String, String>> uploadFixScreenshot(
            @PathVariable Long problemId,
            @RequestParam("file") MultipartFile file) throws IOException {
        
        // 注意：你需要确保 Service 层实现了 uploadAndLinkFixScreenshot 方法
        // 如果 Service 还没实现，你可以先复用 uploadAndLinkScreenshot 逻辑或者创建一个新的
        // 这里假设 Service 层会同步增加该方法
        String filePath = reviewProblemService.uploadAndLinkFixScreenshot(problemId, file);

        Map<String, String> responseBody = new HashMap<>();
        responseBody.put("filePath", filePath);
        return ResponseEntity.ok(responseBody);
    }

    /**
     * 设计员确认解决一个问题
     * 【优化】增加了 requestBody，允许在点击“已解决”时同时提交备注和截图路径
     */
    @PostMapping("/{problemId}/resolve")
    public ResponseEntity<ReviewProblem> resolveProblem(
            @PathVariable Long problemId,
            @RequestBody(required = false) ReviewProblemUpdateDTO resolveInfo) {
        
        // 如果前端传了备注或截图路径，先执行更新
        if (resolveInfo != null) {
            reviewProblemService.updateProblem(problemId, resolveInfo);
        }

        ReviewProblem resolvedProblem = reviewProblemService.resolveProblem(problemId);
        return ResponseEntity.ok(resolvedProblem);
    }

    /**
     * 审核员关闭一个已解决的问题
     */
    @PostMapping("/{problemId}/close")
    public ResponseEntity<ReviewProblem> closeProblem(@PathVariable Long problemId) {
        ReviewProblem closedProblem = reviewProblemService.closeProblem(problemId);
        return ResponseEntity.ok(closedProblem);
    }

    @lombok.Data
    public static class ReopenRequest {
        private String comment;
    }

    /**
     * 打回一个待复核的问题
     */
    @PostMapping("/{problemId}/reopen")
    public ResponseEntity<ReviewProblem> reopenProblem(
            @PathVariable Long problemId,
            @RequestBody ReopenRequest request) {
        
        ReviewProblem updatedProblem = reviewProblemService.reopenProblem(problemId, request.getComment());
        return ResponseEntity.ok(updatedProblem);
    }

    /**
     * 审核员将问题设为保留 (不予处理/日后处理)
     */
    @PostMapping("/{problemId}/keep")
    public ResponseEntity<ReviewProblem> keepProblem(@PathVariable Long problemId) {
        ReviewProblem keptProblem = reviewProblemService.keepProblem(problemId);
        return ResponseEntity.ok(keptProblem);
    }
}