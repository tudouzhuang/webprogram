package org.example.project.dto;

import lombok.Data;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
public class ProcessRecordTemplateCreateDTO {

    @NotBlank(message = "零件名称不能为空")
    private String partName;

    @NotBlank(message = "工序名称不能为空")
    private String processName;

    @NotNull(message = "必须选择一个检查项模板")
    private Long templateId; // 【核心字段】

    // 可以根据需要添加其他从表单接收的字段
}