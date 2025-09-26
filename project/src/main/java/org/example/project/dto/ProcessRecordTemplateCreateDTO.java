// src/main/java/org/example/project/dto/ProcessRecordTemplateCreateDTO.java
package org.example.project.dto;

import lombok.Data;
import java.util.List;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotEmpty;

// 【【【修改】】】我们重用这个DTO，但改变其内部结构
@Data
public class ProcessRecordTemplateCreateDTO {

    // --- 主记录信息 (保留) ---
    @NotBlank(message = "零件名称不能为空")
    private String partName;

    @NotBlank(message = "工序名称不能为空")
    private String processName;

    // --- 检查项列表 (将 templateId 替换为 items) ---
    @NotEmpty(message = "至少需要一个检查项")
    private List<ChecklistItemData> items;

    // --- 内部类，用于定义检查项的数据结构 ---
    @Data
    public static class ChecklistItemData {
        @NotBlank(message = "检查项描述不能为空")
        private String itemDescription;
    }
}