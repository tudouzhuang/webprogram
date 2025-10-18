package org.example.project.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.example.project.dto.DashboardDataDTO;
import org.example.project.dto.DashboardOverviewDTO;
import org.example.project.dto.ProblemSummaryDTO;
import org.example.project.dto.WorkloadDataPointDTO;
import org.example.project.entity.ProcessRecord;
import org.example.project.entity.ProcessRecordStatus;
import org.example.project.mapper.ProcessRecordMapper;
import org.example.project.mapper.ReviewProblemMapper;
import org.example.project.service.DashboardService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class DashboardServiceImpl implements DashboardService {

    @Autowired
    private ProcessRecordMapper processRecordMapper;
    @Autowired
    private ReviewProblemMapper reviewProblemMapper;

    @Override
    public DashboardDataDTO getDashboardData() {
        DashboardDataDTO dashboardData = new DashboardDataDTO();
        dashboardData.setOverview(calculateOverviewStats());
        dashboardData.setReviewWorkload(calculateReviewWorkload());
        dashboardData.setProblemSummary(reviewProblemMapper.getProblemSummary());
        return dashboardData;
    }

    private DashboardOverviewDTO calculateOverviewStats() {
        DashboardOverviewDTO dto = new DashboardOverviewDTO();
        long totalCount = processRecordMapper.selectCount(null);
        long approvedCount = processRecordMapper.selectCount(new QueryWrapper<ProcessRecord>().eq("status", ProcessRecordStatus.APPROVED));
        dto.setCompletionRate(totalCount > 0 ? ((double) approvedCount / totalCount) * 100 : 0);
        dto.setCompletionRateTrend(-0.5);
        LocalDate monday = LocalDate.now().with(DayOfWeek.MONDAY);
        dto.setNewRecordsThisWeek(processRecordMapper.selectCount(new QueryWrapper<ProcessRecord>().ge("created_at", monday)));
        dto.setProcessedTasks(processRecordMapper.selectCount(new QueryWrapper<ProcessRecord>().in("status", ProcessRecordStatus.APPROVED, ProcessRecordStatus.CHANGES_REQUESTED)));
        QueryWrapper<ProcessRecord> avgWrapper = new QueryWrapper<>();
        avgWrapper.select("AVG(total_design_duration_seconds) as avg_time").eq("status", ProcessRecordStatus.APPROVED);
        List<Map<String, Object>> avgResultList = processRecordMapper.selectMaps(avgWrapper);
        Map<String, Object> avgResult = (avgResultList != null && !avgResultList.isEmpty()) ? avgResultList.get(0) : null;
        if (avgResult != null && avgResult.get("avg_time") != null) {
            dto.setAverageWorkTimeSeconds(((Number) avgResult.get("avg_time")).doubleValue());
        }
        dto.setPendingTasks(processRecordMapper.selectCount(new QueryWrapper<ProcessRecord>().eq("status", ProcessRecordStatus.PENDING_REVIEW)));
        dto.setAverageReviewCycleSeconds(3600 * 8); // 简化值
        return dto;
    }

    private List<WorkloadDataPointDTO> calculateReviewWorkload() {
        LocalDate sevenDaysAgo = LocalDate.now().minusDays(7);
        List<Map<String, Object>> results = processRecordMapper.getReviewWorkloadByDate(sevenDaysAgo);
        if (results == null) return Collections.emptyList();
        return results.stream().map(row -> {
            WorkloadDataPointDTO point = new WorkloadDataPointDTO();
            Object dateObj = row.get("date");
            if (dateObj instanceof java.sql.Date) {
                point.setDate(((java.sql.Date) dateObj).toLocalDate());
            } else if (dateObj instanceof LocalDate) {
                point.setDate((LocalDate) dateObj);
            }
            point.setCount((Long) row.get("count"));
            return point;
        }).collect(Collectors.toList());
    }
}