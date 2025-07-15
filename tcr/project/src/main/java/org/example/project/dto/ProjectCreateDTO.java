package org.example.project.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class ProjectCreateDTO {
    // 这个类的字段完全匹配前端 projectForm 的结构
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
    
    // 用内部类来接收嵌套的尺寸对象
    private SizeDTO quoteSize;
    private SizeDTO actualSize;
    
    private BigDecimal quoteWeight;
    private BigDecimal actualWeight;

    @Data
    public static class SizeDTO {
        private BigDecimal length;
        private BigDecimal width;
        private BigDecimal height;
    }
}