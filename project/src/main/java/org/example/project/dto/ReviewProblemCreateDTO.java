// src/main/java/org/example/project/dto/ReviewProblemCreateDTO.java
package org.example.project.dto;

import lombok.Data;
// 可以引入 javax.validation.constraints.* 来增加校验
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
public class ReviewProblemCreateDTO {

    @NotBlank(message = "问题阶段不能为空")
    private String stage;

    @NotBlank(message = "问题点不能为空")
    private String problemPoint;

    private String description;

    // 注意：recordId 从 URL 路径获取，createdByUserId 从当前登录用户获取，所以DTO中不需要这两个字段。
}