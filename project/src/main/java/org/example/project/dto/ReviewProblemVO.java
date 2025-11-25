package org.example.project.dto;

import lombok.Data;
import org.example.project.entity.ReviewProblemStatus;
import java.time.LocalDateTime;

/**
 * 用于前端列表展示的视图对象
 * 包含了 ReviewProblem 的所有数据，外加用户名
 */
@Data
public class ReviewProblemVO {
    private Long id;
    private Long recordId;
    private String stage;
    private String problemPoint;
    private String description;
    private String screenshotPath;
    private ReviewProblemStatus status;
    private Long createdByUserId;
    private LocalDateTime createdAt;
    
    // 确认人信息
    private Long confirmedByUserId;
    private LocalDateTime confirmedAt;
    
    // --- 【新增】闭环修复证明 (必须添加，否则前端拿不到) ---
    private String fixScreenshotPath;
    private String fixComment;
    // --------------------------------------------------

    private LocalDateTime updatedAt;

    // 关联查询出来的用户名
    private String createdByUsername;
    private String confirmedByUsername;
}