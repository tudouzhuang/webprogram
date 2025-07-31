package org.example.project.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 【专用DTO】：用于接收“完整创建项目”时前端发送的所有表单数据。
 * 它的结构与包含所有字段的旧版前端表单完全匹配。
 */
@Data
public class ProjectFullCreateDTO {

    // 基础信息
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

    // 人员信息
    private String designerName;
    private LocalDate designerDate;
    private String checkerName;
    private LocalDate checkerDate;
    private String auditorName;
    private LocalDate auditorDate;

    // 尺寸与重量
    private SizeDTO quoteSize;
    private BigDecimal quoteWeight;
    private SizeDTO actualSize;
    private BigDecimal actualWeight;

    @Data
    public static class SizeDTO {
        private BigDecimal length;
        private BigDecimal width;
        private BigDecimal height;
    }
}