package org.example.project.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("statistics_rules") // 对应数据库表名
public class StatisticRule {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String ruleName;
    private String category;
    private String sheetNamePattern;
    private String rangeToScan;
    private String okSymbol;
    private String ngSymbol;
    private String naSymbol;
    private Boolean isActive;
    private LocalDateTime createdAt;
    private String totalCountRange;
}