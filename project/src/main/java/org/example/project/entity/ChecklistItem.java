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
    private ChecklistItemStatus status;
    private String designerRemarks;
    private String reviewerRemarks;
    private String screenshotPath;
    private Long checkedByUserId;
    private LocalDateTime checkedAt;
}