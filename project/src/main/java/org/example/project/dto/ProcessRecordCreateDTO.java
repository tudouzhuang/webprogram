package org.example.project.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import lombok.Data;

/**
 * 【最终版】: 用于接收前端“新建过程记录表”的完整表单数据。
 * 它的字段结构与前端Vue组件中的 recordForm 对象精确匹配。
 */
@Data
public class ProcessRecordCreateDTO {

    // 核心信息
    private String partName;
    private String processName;

    // 详细规格信息
    private String material;
    private BigDecimal thickness;
    private BigDecimal tensileStrength;
    private String customerName;
    private String moldDrawingNumber;
    private String equipment;

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

    // 检查项
    private List<String> selectedSheets;

    // 内部类，用于匹配嵌套的尺寸对象
    @Data
    public static class SizeDTO {
        private BigDecimal length;
        private BigDecimal width;
        private BigDecimal height;
    }
}