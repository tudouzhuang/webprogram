package org.example.project.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data; // 【【【关键点1：必须导入Data】】】
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data // 【【【关键点2：必须有@Data注解！！！】】】
@TableName("process_records")
public class ProcessRecord {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long projectId;
    private String partName;
    private String processName;
    private Long createdByUserId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // 【【【关键点3：确保所有这些字段都存在，且类型为 BigDecimal】】】
    private String material;
    private BigDecimal thickness;
    private BigDecimal tensileStrength;
    private String customerName;
    private String moldDrawingNumber;
    private String equipment;
    
    private BigDecimal quoteLength;
    private BigDecimal quoteWidth;
    private BigDecimal quoteHeight;
    private BigDecimal quoteWeight;
    
    private BigDecimal actualLength;
    private BigDecimal actualWidth;
    private BigDecimal actualHeight;
    private BigDecimal actualWeight;
    
    // 流程控制字段
    private ProcessRecordStatus status;
    private Long assigneeId;
    private String rejectionComment;
    private Integer totalDesignDurationSeconds;
    
    // 旧的JSON字段，可以保留以兼容历史数据
    private String specificationsJson; 
    private String sourceFilePath;
}