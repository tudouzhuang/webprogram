package org.example.project.dto;

import lombok.Data;

@Data
public class BusinessProjectCreateDTO {
    // 只包含前端会提交的字段
    private String projectName;
}