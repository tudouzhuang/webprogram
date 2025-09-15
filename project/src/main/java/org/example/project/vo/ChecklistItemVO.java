// src/main/java/org/example/project/vo/ChecklistItemVO.java
package org.example.project.vo;

import lombok.Data;
import lombok.EqualsAndHashCode;
import org.example.project.entity.ChecklistItem;
import org.example.project.entity.ItemScreenshot; // 引入截图实体
import java.util.List;

@Data
@EqualsAndHashCode(callSuper = true)
public class ChecklistItemVO extends ChecklistItem {
    // 【新增】用于显示用户名的字段
    private String designedByUsername;
    private String reviewedByUsername;

    // 【核心修改】用于携带截图列表
    private List<ItemScreenshot> screenshots;
}