package org.example.project.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class UserTaskDTO {
    private String taskType;        // 任务类型, e.g., "待审核", "待修改"
    private Long recordId;          // 关联的过程记录ID
    private String recordName;      // 过程记录的名称 (e.g., "零件A-工序1")
    private Long projectId;         // 关联的项目ID
    private String projectNumber;   // 关联的项目编号
    private LocalDateTime updatedAt; // 任务的最后更新时间，用于排序
    private String status;          // 任务当前的状态
}