// src/main/java/org/example/project/entity/ItemScreenshot.java
package org.example.project.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("item_screenshots")
public class ItemScreenshot {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long itemId;
    private Long uploaderId;
    private String fileName;
    private String filePath;
    private LocalDateTime uploadedAt;
}