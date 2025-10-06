// src/main/java/org/example/project/controller/ReviewProblemController.java
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
     * @param problemId 问题ID
     * @param updateDTO 更新数据
     * @return 更新后的问题对象
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
     * @param problemId 问题ID
     * @return 无内容响应
     */
    @DeleteMapping("/{problemId}")
    public ResponseEntity<Void> deleteProblem(@PathVariable Long problemId) {
        reviewProblemService.deleteProblem(problemId);
        return ResponseEntity.noContent().build();
    }

    /**
     * 为指定问题上传截图
     * @param problemId 问题ID
     * @param file 上传的文件
     * @return 包含文件路径的响应
     * @throws IOException 文件保存异常
     */
/**
     * 【【【修正后的版本】】】
     * 处理对单个 ReviewProblem 的截图上传请求。
     * @param problemId 问题的ID
     * @param file 上传的截图文件
     * @return 包含文件访问路径的JSON响应, e.g., {"filePath": "/uploads/..."}
     * @throws IOException 如果文件保存失败
     */
    @PostMapping("/{problemId}/screenshot")
    public ResponseEntity<Map<String, String>> uploadScreenshot(
            @PathVariable Long problemId,
            @RequestParam("file") MultipartFile file) throws IOException {
        
        // 调用 Service 层处理文件保存和数据库更新的业务逻辑
        String filePath = reviewProblemService.uploadAndLinkScreenshot(problemId, file);

        // 【【【核心修正】】】
        // 使用 HashMap 来创建响应体，以兼容旧版Java
        Map<String, String> responseBody = new HashMap<>();
        responseBody.put("filePath", filePath);
        
        // 返回包含了 {"filePath": "..."} 的JSON对象
        return ResponseEntity.ok(responseBody);
    }

        /**
     * [NEW] 设计员确认解决一个问题
     * @param problemId 问题ID
     * @return 更新后的问题对象
     */
    @PostMapping("/{problemId}/resolve")
    public ResponseEntity<ReviewProblem> resolveProblem(@PathVariable Long problemId) {
        ReviewProblem resolvedProblem = reviewProblemService.resolveProblem(problemId);
        return ResponseEntity.ok(resolvedProblem);
    }

    
    /**
     * [NEW] 审核员关闭一个已解决的问题
     * @param problemId 问题ID
     * @return 更新后的问题对象
     */
    @PostMapping("/{problemId}/close")
    public ResponseEntity<ReviewProblem> closeProblem(@PathVariable Long problemId) {
        ReviewProblem closedProblem = reviewProblemService.closeProblem(problemId);
        return ResponseEntity.ok(closedProblem);
    }
}