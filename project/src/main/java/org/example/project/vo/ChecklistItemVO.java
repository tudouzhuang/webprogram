package org.example.project.vo;

import lombok.Data;
import lombok.EqualsAndHashCode;
import org.example.project.entity.ChecklistItem;
import org.example.project.entity.ItemScreenshot;
import java.util.List;

@Data
@EqualsAndHashCode(callSuper = true)
public class ChecklistItemVO extends ChecklistItem {
    
    // 用于显示用户名的字段
    private String designedByUsername;
    private String reviewedByUsername;

    // 用于携带截图列表
    private List<ItemScreenshot> screenshots;
    
    // 【【【请确保这里没有其他多余的、没有方法体的方法声明】】】
}