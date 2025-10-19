package org.example.project.service;

import org.example.project.dto.DashboardDataDTO;
import org.example.project.dto.UserTaskDTO; // 【【【 新增 】】】
import java.util.List;                     // 【【【 新增 】】】

public interface DashboardService {
    DashboardDataDTO getDashboardData();
    List<UserTaskDTO> getUserTasks();
}