// src/main/java/org/example/project/dto/ReviewProblemVO.java
package org.example.project.dto;

import lombok.Data;
import org.example.project.entity.ReviewProblemStatus;

import java.time.LocalDateTime;

@Data
public class ReviewProblemVO {
    // ReviewProblem 的所有原始字段
    private Long id;
    private Long recordId;
    private String stage;
    private String problemPoint;
    private String description;
    private String screenshotPath;
    private ReviewProblemStatus status;
    private Long createdByUserId;
    private Long confirmedByUserId;
    private LocalDateTime confirmedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // --- 【新增的关联字段】 ---
    private String createdByUsername;   // 创建人用户名
    private String confirmedByUsername; // 确认人用户名

        // --- 【【【 新增别名 Getter 】】】 ---
    public String getReviewerUsername() {
        return this.createdByUsername;
    }

    public LocalDateTime getReviewedAt() {
        return this.createdAt;
    }
}