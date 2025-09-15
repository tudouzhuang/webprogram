// src/main/java/org/example/project/entity/ChecklistItem.java
package org.example.project.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import org.example.project.entity.enums.ChecklistItemStatus;
import java.time.LocalDateTime;

@Data
@TableName("checklist_items")
public class ChecklistItem {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long recordId;
    private String itemDescription;

    // --- 设计员数据 ---
    private ChecklistItemStatus designerStatus;
    private String designerRemarks;
    private Long designedByUserId;
    private LocalDateTime designedAt;

    // --- 审核员数据 ---
    private ChecklistItemStatus reviewerStatus;
    private String reviewerRemarks;
    private Long reviewedByUserId;
    private LocalDateTime reviewedAt;
}