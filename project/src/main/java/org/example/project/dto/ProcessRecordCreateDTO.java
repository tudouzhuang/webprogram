package org.example.project.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
// import java.util.List; // List 不再需要，可以移除

import lombok.Data;

/**
 * 【多文件上传版】: 用于接收前端“新建过程记录表”的元数据部分。
 * 它的字段结构与前端Vue组件中的 recordForm 对象（排除文件部分）精确匹配。
 * 不再包含文件或检查项列表信息，这些信息由 Multipart 请求的其他部分承载。
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

    // 【核心修改】: 移除了 selectedSheets 字段
    // private List<String> selectedSheets; // <-- 移除此行

    // 内部类 SizeDTO 保持不变，因为它也是元数据的一部分
    @Data
    public static class SizeDTO {
        private BigDecimal length;
        private BigDecimal width;
        private BigDecimal height;
    }
}