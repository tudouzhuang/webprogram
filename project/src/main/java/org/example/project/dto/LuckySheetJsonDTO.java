package org.example.project.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;

/**
 * 【完整版】: 用于反序列化前端 Luckysheet 回传的完整JSON数据。
 * 包含了所有必需的嵌套内部类，以解决编译错误。
 */
@Data
public class LuckySheetJsonDTO {

    // 主体包含 sheets 列表 和 images 映射
    private List<SheetData> sheets;
    private Map<String, ImageData> images;

    /**
     * 代表单个Sheet的数据结构
     */
    @Data
    public static class SheetData {
        private String name;
        private String color;
        private Integer index;
        private Integer status;
        private Integer order;
        private Boolean hide;
        private List<CellData> celldata;
        private Map<String, Object> config; // config 结构复杂，用 Map 接收
    }

    /**
     * 【关键】: 代表单个单元格的数据结构
     */
    @Data
    public static class CellData {
        private int r; // row index
        private int c; // column index
        private CellValue v;
    }

    /**
     * 代表单元格的值和显示格式
     */
    @Data
    public static class CellValue {
        private String m; // original value (e.g., formula or raw text)
        private String v; // displayed value
        // ... 可能还有其他字段，如 ct (cell type), f (formula) 等
    }

    /**
     * 代表单个图片的数据结构
     */
    @Data
    public static class ImageData {
        private String src; // Base64 encoded image data
        private ImageDefault defaultInfo;
        
        // 名字可能叫 default 或 defaultInfo，用 @JsonProperty 兼容
        // @com.fasterxml.jackson.annotation.JsonProperty("default")
        // private ImageDefault defaultInfo;
    }

    /**
     * 代表图片的位置、尺寸等信息
     */
    @Data
    public static class ImageDefault {
        private int sheetIndex;
        private double left;
        private double top;
        private double width;
        private double height;
    }
}