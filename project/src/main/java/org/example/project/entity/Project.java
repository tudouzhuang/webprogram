package org.example.project.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data; // 使用 Lombok 简化代码
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data // Lombok 注解，自动生成 Getter, Setter, toString() 等方法
@TableName("projects") // 告诉 MyBatis-Plus 这个类对应数据库中的 "projects" 表
public class Project {
    @TableId(type = IdType.AUTO)
    private Long id;

    private String projectNumber;
    private String productName;
    private String material;
    private String partNumber;
    private BigDecimal thickness;
    private String process;
    private BigDecimal tensileStrength;
    private String moldDrawingNumber;
    private String equipment;
    private String customerName;

    private String designerName;
    private LocalDate designerDate;
    private String checkerName;
    private LocalDate checkerDate;
    private String auditorName;
    private LocalDate auditorDate;

    private BigDecimal quoteLength;
    private BigDecimal quoteWidth;
    private BigDecimal quoteHeight;
    private BigDecimal quoteWeight;

    private BigDecimal actualLength;
    private BigDecimal actualWidth;
    private BigDecimal actualHeight;
    private BigDecimal actualWeight;

    private Long createdByUserId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}