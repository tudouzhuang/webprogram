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
    private String screenshotPath; // 问题提出时的截图

    @TableField("status")
    private ReviewProblemStatus status;

    @TableField("created_by_user_id")
    private Long createdByUserId; // 问题提出者 (审核员)

    @TableField("created_at")
    private LocalDateTime createdAt;

    // --- 确认/解决信息 ---
    @TableField("confirmed_by_user_id")
    private Long confirmedByUserId; // 问题确认/解决者 (设计员)

    @TableField("confirmed_at")
    private LocalDateTime confirmedAt; // 确认/解决时间

    // --- 【新增】闭环修复证明 ---
    @TableField("fix_screenshot_path")
    private String fixScreenshotPath; // 修改后的截图证明

    @TableField("fix_comment")
    private String fixComment; // 设计员的修改备注/说明
    // ----------------

    @TableField("updated_at")
    private LocalDateTime updatedAt;
}