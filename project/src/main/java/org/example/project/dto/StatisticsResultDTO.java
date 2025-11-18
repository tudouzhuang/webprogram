package org.example.project.dto;

import lombok.Data;
import java.util.List;

@Data
public class StatisticsResultDTO {
    // 基础信息部分
    private String fileNumber; // 编号
    private String designerName;
    private String proofreaderName;
    private String auditorName;

    // 统计数据部分
    private List<CategoryStat> stats;

    @Data
    public static class CategoryStat {
        private String category; // "内审", "FMC"
        private int okCount;
        private int ngCount;
        private int naCount;
        private int totalCount;
        private double okPercentage; // OK 比例 (0.0 - 100.0)
    }
    
}