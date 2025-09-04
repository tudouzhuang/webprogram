// src/main/java/org/example/project/dto/ReviewProblemUpdateDTO.java
package org.example.project.dto;

import lombok.Data;
import org.example.project.entity.ReviewProblemStatus;

@Data
public class ReviewProblemUpdateDTO {
    // 允许更新的字段
    private String stage;
    private String problemPoint;
    private String description;
    private ReviewProblemStatus status; // 允许前端直接更新状态
}