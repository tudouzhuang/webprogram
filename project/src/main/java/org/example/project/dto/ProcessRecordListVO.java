// src/main/java/org/example/project/dto/ProcessRecordListVO.java
package org.example.project.dto;

import lombok.Data;
import org.example.project.entity.ProcessRecordStatus;

import java.time.LocalDateTime;

@Data
public class ProcessRecordListVO {
    
    // 这里我们只包含列表页需要展示的字段，而不是 ProcessRecord 的所有字段
    private Long id;
    private String partName;
    private String processName;
    private ProcessRecordStatus status;
    private LocalDateTime updatedAt;

    // --- 【关键的关联对象】 ---
    
    // 负责人信息（用于审核员列表页）
    private UserSummaryDto assignee; 
    
    // 创建人信息（用于设计员列表页）
    private UserSummaryDto creator;
}