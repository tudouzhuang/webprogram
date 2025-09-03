// src/main/java/org/example/project/entity/ReviewProblem.java
package org.example.project.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("review_problems")
public class ReviewProblem {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("record_id")
    private Long recordId;

    private String stage;

    @TableField("problem_point")
    private String problemPoint;

    private String description;

    @TableField("screenshot_path")
    private String screenshotPath;

    @TableField("status")
    private ReviewProblemStatus status; // 使用新的枚举

    @TableField("created_by_user_id")
    private Long createdByUserId; // 问题提出者 (审核员)

    @TableField("created_at")
    private LocalDateTime createdAt;

    // --- 新增字段 ---
    @TableField("confirmed_by_user_id")
    private Long confirmedByUserId; // 问题确认者 (设计员)

    @TableField("confirmed_at")
    private LocalDateTime confirmedAt; // 确认时间
    // ----------------

    @TableField("updated_at")
    private LocalDateTime updatedAt;
}