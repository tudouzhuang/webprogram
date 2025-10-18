package org.example.project.dto;

import lombok.Data;

@Data
public class DashboardOverviewDTO {
    private double completionRate;
    private double completionRateTrend;
    private long newRecordsThisWeek;
    private long processedTasks;
    private double averageWorkTimeSeconds;
    private long pendingTasks;
    private double averageReviewCycleSeconds;
}