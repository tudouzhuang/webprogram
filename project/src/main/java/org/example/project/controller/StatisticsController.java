package org.example.project.controller;

import org.example.project.dto.QualityReportDTO;
import org.example.project.service.StatisticsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 独立统计控制器
 * 专门处理质量看板与效能监控相关的聚合数据
 */
@RestController
@RequestMapping("/api/stats")
public class StatisticsController {

    @Autowired
    private StatisticsService statisticsService;

    /**
     * 获取全量质量报告数据
     * 权限控制：仅允许管理员(ADMIN)或主管(MANAGER)访问
     * 注：角色名称需与你数据库/Security配置中的 identity 字段对应
     */
    @GetMapping("/full-quality-report")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'manager', 'MANAGER')")
    public ResponseEntity<QualityReportDTO> getFullReport() {
        // 调用 Service 层执行跨表聚合计算
        QualityReportDTO report = statisticsService.calculateFullReport();
        return ResponseEntity.ok(report);
    }
}