package org.example.project.controller;

import org.example.project.dto.DashboardDataDTO;
import org.example.project.dto.UserTaskDTO; // 确保也导入了这个
import org.example.project.service.DashboardService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List; // 【【【 核心修正：补上这个 import 】】】

@RestController
@RequestMapping("/api/stats")
public class DashboardController {

    @Autowired
    private DashboardService dashboardService;

    @GetMapping("/dashboard")
    public ResponseEntity<DashboardDataDTO> getDashboardData() {
        return ResponseEntity.ok(dashboardService.getDashboardData());
    }

    @GetMapping("/user-tasks")
    public ResponseEntity<List<UserTaskDTO>> getUserTasks() {
        return ResponseEntity.ok(dashboardService.getUserTasks());
    }
}