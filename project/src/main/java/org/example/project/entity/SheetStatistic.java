package org.example.project.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("sheet_statistics") // 对应数据库表名
public class SheetStatistic {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long fileId;
    private String category;
    private Integer okCount;
    private Integer ngCount;
    private Integer naCount;
    private Integer totalCount;
    private LocalDateTime calculatedAt;
}