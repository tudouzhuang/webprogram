// src/main/java/org/example/project/dto/ProcessRecordVO.java
package org.example.project.dto;

import lombok.Data;
import org.example.project.entity.ProcessRecordStatus;
import org.example.project.entity.User; // 确保导入 User 实体

import java.time.LocalDateTime;

@Data
public class ProcessRecordVO {
    // ProcessRecord 的所有原始字段
    private Long id;
    private Long projectId;
    private String partName;
    private String processName;
    private Long createdByUserId;
    private LocalDateTime createdAt;
    private String specificationsJson;
    private String sourceFilePath;
    private ProcessRecordStatus status;
    private Long assigneeId;
    private String rejectionComment;
    private LocalDateTime updatedAt; // 确保这个字段存在
    private Integer totalDesignDurationSeconds;

    // --- 【【【 新增的关联对象 】】】 ---
    private UserSummaryDto assignee; // 使用一个简化的 User DTO 来表示负责人
}