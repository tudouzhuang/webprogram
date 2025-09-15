package com.example.project.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("checklist_templates")
public class ChecklistTemplate {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String templateName;
    private String description;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}