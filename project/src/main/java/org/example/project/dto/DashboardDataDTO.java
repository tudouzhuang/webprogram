package org.example.project.dto;

import lombok.Data;
import java.util.List;

@Data
public class DashboardDataDTO {
    private DashboardOverviewDTO overview;
    private List<WorkloadDataPointDTO> reviewWorkload;
    private ProblemSummaryDTO problemSummary;
}