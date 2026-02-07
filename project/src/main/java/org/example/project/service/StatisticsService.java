package org.example.project.service;

import org.example.project.dto.LuckySheetJsonDTO;
import org.example.project.dto.QualityReportDTO;
import org.example.project.dto.StatisticsResultDTO;

public interface StatisticsService {
    // 计算并保存统计数据
    void calculateAndSaveStats(Long fileId, LuckySheetJsonDTO sheetData);
    QualityReportDTO calculateFullReport();
    // 获取已保存的统计数据
    StatisticsResultDTO getSavedStats(Long fileId);
}