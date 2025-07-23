package org.example.project.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("excel_sheet_data")
public class ExcelSheetData {
    private Long id;
    private Long projectId;
    private String sheetName;
    private Integer rowIndex;
    private String rowDataJson; // 使用String类型接收JSON
}