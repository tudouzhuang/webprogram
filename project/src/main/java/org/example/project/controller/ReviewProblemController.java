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
    @PostMapping("/{problemId}/screenshot")
    public ResponseEntity<Map<String, String>> uploadScreenshot(
            @PathVariable Long problemId,
            @RequestParam("file") MultipartFile file) throws IOException {
        String filePath = reviewProblemService.uploadAndLinkScreenshot(problemId, file);
        return ResponseEntity.ok(Map.of("filePath", filePath));
    }
}