package org.example.project.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("checklist_template_items")
public class ChecklistTemplateItem {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long templateId;
    private String itemDescription;
    private Integer displayOrder;
}