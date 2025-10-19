package org.example.project.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.extern.slf4j.Slf4j;
import org.example.project.dto.DashboardDataDTO;
import org.example.project.dto.DashboardOverviewDTO;
import org.example.project.dto.ProblemSummaryDTO;
import org.example.project.dto.UserTaskDTO;
import org.example.project.dto.WorkloadDataPointDTO;
import org.example.project.entity.ProcessRecord;
import org.example.project.entity.ProcessRecordStatus;
import org.example.project.entity.Project;
import org.example.project.entity.User;
import org.example.project.mapper.ProcessRecordMapper;
import org.example.project.mapper.ProjectMapper;
import org.example.project.mapper.ReviewProblemMapper;
import org.example.project.mapper.UserMapper;
import org.example.project.service.DashboardService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
public class DashboardServiceImpl implements DashboardService {

    @Autowired
    private ProcessRecordMapper processRecordMapper;
    @Autowired
    private ReviewProblemMapper reviewProblemMapper;

        @Autowired
    private UserMapper userMapper;
    @Autowired
    private ProjectMapper projectMapper;
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
        if (results == null) {
            return Collections.emptyList();
        }
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

    /**
     * 【【【 新增：获取当前用户的待办任务列表 】】】
     */
    @Override
    public List<UserTaskDTO> getUserTasks() {
        // 1. 获取当前登录用户
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (!(principal instanceof UserDetails)) {
            return Collections.emptyList(); // 未登录则返回空列表
        }
        String username = ((UserDetails) principal).getUsername();
        User currentUser = userMapper.selectByUsername(username);
        if (currentUser == null) {
            return Collections.emptyList();
        }

        List<UserTaskDTO> tasks = new ArrayList<>();
        String userRole = currentUser.getIdentity().toUpperCase();

        // 2. 根据用户角色，查询不同的任务
        if ("REVIEWER".equals(userRole) || "MANAGER".equals(userRole)) {
            // --- 场景A：如果是审核员或经理 ---
            // 查询所有分配给TA的、状态为“待审核”的记录
            QueryWrapper<ProcessRecord> reviewQuery = new QueryWrapper<>();
            reviewQuery.eq("assignee_id", currentUser.getId())
                    .eq("status", ProcessRecordStatus.PENDING_REVIEW);

            List<ProcessRecord> reviewRecords = processRecordMapper.selectList(reviewQuery);
            tasks.addAll(convertToTaskDTO(reviewRecords, "待审核"));

        } else if ("DESIGNER".equals(userRole)) {
            // --- 场景B：如果是设计员 ---
            // 查询所有分配给TA的、状态为“待修改”的记录
            QueryWrapper<ProcessRecord> changeQuery = new QueryWrapper<>();
            changeQuery.eq("assignee_id", currentUser.getId())
                    .eq("status", ProcessRecordStatus.CHANGES_REQUESTED);

            List<ProcessRecord> changeRecords = processRecordMapper.selectList(changeQuery);
            tasks.addAll(convertToTaskDTO(changeRecords, "待修改"));
        }

        // (可选) 为所有用户都显示他们创建的、处于草稿状态的记录
        QueryWrapper<ProcessRecord> draftQuery = new QueryWrapper<>();
        draftQuery.eq("created_by_user_id", currentUser.getId())
                .eq("status", ProcessRecordStatus.DRAFT);
        List<ProcessRecord> draftRecords = processRecordMapper.selectList(draftQuery);
        tasks.addAll(convertToTaskDTO(draftRecords, "草稿"));

        // 3. 按更新时间降序排序
        tasks.sort(Comparator.comparing(UserTaskDTO::getUpdatedAt).reversed());

        return tasks;
    }

    /**
     * 辅助方法：将 ProcessRecord 列表转换为 UserTaskDTO 列表
     */
    private List<UserTaskDTO> convertToTaskDTO(List<ProcessRecord> records, String taskType) {
        if (records == null || records.isEmpty()) {
            return Collections.emptyList();
        }
        return records.stream().map(record -> {
            UserTaskDTO dto = new UserTaskDTO();
            dto.setTaskType(taskType);
            dto.setRecordId(record.getId());
            dto.setRecordName(record.getPartName() + " - " + record.getProcessName());
            dto.setProjectId(record.getProjectId());
            dto.setUpdatedAt(record.getUpdatedAt());
            dto.setStatus(record.getStatus().name());

            // 补充项目编号
            Project project = projectMapper.selectById(record.getProjectId());
            if (project != null) {
                dto.setProjectNumber(project.getProjectNumber());
            }
            return dto;
        }).collect(Collectors.toList());
    }
}
