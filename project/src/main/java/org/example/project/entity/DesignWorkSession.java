// src/main/java/org/example/project/entity/DesignWorkSession.java
package org.example.project.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("design_work_sessions")
public class DesignWorkSession {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long recordId;
    private Long userId;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Integer durationSeconds;
    private LocalDateTime lastHeartbeatTime;
    private Boolean isActive;
}