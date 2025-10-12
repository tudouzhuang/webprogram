package org.example.project.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import java.util.List;
import java.util.Map;

/**
 * 【最终修正版】: 用于序列化和反序列化 Luckysheet 的完整JSON数据。
 * 修复了所有内部类的结构和字段缺失问题。
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true) // 忽略JSON中未在Java类定义的字段，增加健壮性
public class LuckySheetJsonDTO {

    // Luckysheet的根结构包含 sheets 列表和 images 映射
    private List<SheetData> sheets;
    private Map<String, ImageData> images;

    /**
     * 代表单个工作表 (Sheet) 的数据结构
     */
    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class SheetData {
        private String name;
        private String color;
        private Integer index;
        private Integer status;
        private Integer order;
        private Boolean hide;
        private List<CellData> celldata; // 一个Sheet包含多个单元格数据
        private Map<String, Object> config; // 用于存储合并单元格、行高、列宽等配置
        private Map<String, Object> dataVerification; // 用于存储数据验证规则
    }

    /**
     * 代表单个单元格 (Cell) 的数据结构
     * 它包含了单元格的坐标(r, c)和它的值对象(v)
     */
    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CellData {
        private int r; // 行索引 (row index)
        private int c; // 列索引 (column index)
        private CellValue v; // 单元格的值对象
    }

/**
     * 代表单元格的值 (Value) 对象
     * 这才是真正存储单元格内容和样式的地方
     */
    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CellValue {
        // 值和公式
        private String m; // 原始显示值 (如 "123" 或 "文本")
        private String v; // 格式化后的显示值
        private String f; // 公式 (formula), 例如 "=SUM(A1:A2)"

        // 字体样式
        private Integer bl; // Bold (1 for true)
        private Integer it; // Italic (1 for true)
        private Integer cl; // Strikethrough (1 for true)
        private Integer ul; // Underline (1 for true)
        private String ff;  // Font Family (e.g., "Arial")
        private short fs;   // Font Size
        private String fc;  // Font Color (e.g., "#FF0000")

        // 背景颜色
        private String bg;  // Background Color (e.g., "#00FF00")

        // 对齐方式
        private Integer ht; // Horizontal Type (0: center, 1: left, 2: right)
        private Integer vt; // Vertical Type (0: middle, 1: top, 2: bottom)
        private Integer tb; // Text Break (2 for wrap text)
    }

    /**
     * 代表单个图片的数据结构
     */
    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ImageData {
        private String src; // Base64 编码的图片数据
        private ImageDefault defaultInfo;
    }

    /**
     * 代表图片的位置、尺寸等默认信息
     */
    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ImageDefault {
        private int sheetIndex;
        private double left;
        private double top;
        private double width;
        private double height;
    }
}