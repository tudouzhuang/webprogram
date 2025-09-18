package org.example.project.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
@TableName("checklist_templates")
public class ChecklistTemplate {
    
    @TableId(type = IdType.AUTO)
    private Long id;
    
    // 【【【与您的表结构完全对应】】】
    private String templateName;
    private String category;
    private Boolean isActive; // 使用 Boolean 类型对应 is_active
    private LocalDateTime createdAt;

    // 【【【非数据库字段，保持不变】】】
    // 用于在查询详情时临时存放其包含的检查项列表。
    @TableField(exist = false)
    private List<ChecklistTemplateItem> items;
}