package org.example.project.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QualityReportDTO {

    private GlobalSummary global;     // 顶部 KPI 卡片数据
    private List<StatEntry> list;     // 下方列表（项目/员工维度）数据

    @Data
    @Builder
    public static class GlobalSummary {

        private Double avgCompliance; // 全局平均符合率
        private Double avgRounds;     // 全局平均审核轮次
        private Double onePassRate;   // 一次通过率
        private Integer totalTasks;   // 总记录数
    }

    @Data
    @Builder
    public static class StatEntry {

        private String type;               // 维度类型: "project" 或 "employee"
        private String name;               // 显示名称
        private Double avgCompliance;      // 该维度下的平均符合率
        private Integer totalRounds;       // 该维度累计总轮次
        private Double avgRounds;          // 该维度平均轮次
        private Integer onePassCount;      // 一次通过的任务数量
        private Integer ngCount;           // NG（打回）的任务数量
        private List<DetailRecord> details; // 点击展开后的详情行
    }

    @Data
    @Builder
    public static class DetailRecord {

        private String partName;           // 零件或节点名称
        private String memberName;
        private Double compliance;         // 单个记录的符合率
        private Integer auditRounds;       // 该记录经历的轮次
        private String status;             // 当前状态
        private String lastReviewTime;     // 最后更新时间
        private Long projectId;
        private Long creatorId;
        private Boolean isOnePass;
    }
}
