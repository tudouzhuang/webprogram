package org.example.project.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import lombok.extern.slf4j.Slf4j;
import org.example.project.dto.LuckySheetJsonDTO;
import org.example.project.dto.StatisticsResultDTO;
import org.example.project.entity.*; // 假设您的实体都在这个包下
import org.example.project.mapper.*; // 假设您的Mapper都在这个包下
import org.example.project.service.StatisticsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
public class StatisticsServiceImpl implements StatisticsService {

    @Autowired
    private StatisticRuleMapper statisticRuleMapper;
    @Autowired
    private SheetStatisticMapper sheetStatisticMapper;
    @Autowired
    private ProjectFileMapper projectFileMapper;
    @Autowired
    private ProjectMapper projectMapper;
    @Autowired
    private UserMapper userMapper;
    @Autowired
private ProcessRecordMapper processRecordMapper;

/**
     * 【核心】计算并保存指定文件的统计数据。
     * 【已升级】：增加了对“重大风险”Sheet的特殊统计逻辑。
     * @param fileId       文件的数据库ID
     * @param luckysheetData 从前端传来的完整 Luckysheet JSON 数据
     */
    @Override
    @Transactional
    public void calculateAndSaveStats(Long fileId, LuckySheetJsonDTO luckysheetData) {
        log.info("开始为 fileId: {} 计算统计数据...", fileId);

        // --- [第一部分：执行所有数据库中定义的常规规则] ---
        List<StatisticRule> rules = statisticRuleMapper.selectList(new QueryWrapper<StatisticRule>().eq("is_active", true));
        if (rules.isEmpty()) {
            log.warn("系统中没有配置任何有效的统计规则，跳过常规计算。");
        } else {
            LuckySheetJsonDTO.SheetData sheet = luckysheetData.getSheets().get(0);
            List<LuckySheetJsonDTO.CellData> celldata = sheet.getCelldata();
            if (celldata == null || celldata.isEmpty()) {
                log.warn("Sheet '{}' 中没有任何单元格数据，跳过常规计算。", sheet.getName());
            } else {
                for (StatisticRule rule : rules) {
                    log.info(">>> 正在应用常规规则: '{}', 范围: {}", rule.getRuleName(), rule.getRangeToScan());
                    
                    Range valueRange = parseRange(rule.getRangeToScan());
                    if (valueRange == null) {
                        log.error("规则 '{}' 的扫描范围 '{}' 格式不正确，已跳过。", rule.getRuleName(), rule.getRangeToScan());
                        continue;
                    }

                    int okCount = 0, ngCount = 0, naCount = 0;
                    for (LuckySheetJsonDTO.CellData cell : celldata) {
                        if (cell.getC() >= valueRange.startCol && cell.getC() <= valueRange.endCol &&
                            cell.getR() >= valueRange.startRow && cell.getR() <= valueRange.endRow) {
                            if (cell.getV() != null && cell.getV().getV() != null) {
                                String cellValue = cell.getV().getV().trim();
                                if (Objects.equals(cellValue, rule.getOkSymbol())) okCount++;
                                else if (Objects.equals(cellValue, rule.getNgSymbol())) ngCount++;
                                else if (Objects.equals(cellValue, rule.getNaSymbol())) naCount++;
                            }
                        }
                    }
                    
                    int totalCount;
                    if (rule.getTotalCountRange() != null && !rule.getTotalCountRange().isEmpty()) {
                        Range totalRange = parseRange(rule.getTotalCountRange());
                        if (totalRange == null) {
                            totalCount = 0;
                        } else {
                            int count = 0;
                            for (LuckySheetJsonDTO.CellData cell : celldata) {
                                if (cell.getC() >= totalRange.startCol && cell.getC() <= totalRange.endCol &&
                                    cell.getR() >= totalRange.startRow && cell.getR() <= totalRange.endRow) {
                                    if (cell.getV() != null && cell.getV().getV() != null && !cell.getV().getV().trim().isEmpty()) {
                                        try {
                                            Double.parseDouble(cell.getV().getV().trim());
                                            count++;
                                        } catch (NumberFormatException e) { /* ignore */ }
                                    }
                                }
                            }
                            totalCount = count;
                        }
                    } else {
                        totalCount = okCount + ngCount + naCount;
                    }
                    
                    log.info("常规规则 '{}' 计算结果: OK={}, NG={}, NA={}, Total={}", rule.getRuleName(), okCount, ngCount, naCount, totalCount);

                    saveOrUpdateStatistic(fileId, rule.getCategory(), okCount, ngCount, naCount, totalCount);
                }
            }
        }
        
        // --- [第二部分：【【【 新增 】】】 检查并执行“重大风险”特殊规则] ---
        if (luckysheetData != null && luckysheetData.getSheets() != null && !luckysheetData.getSheets().isEmpty()) {
            LuckySheetJsonDTO.SheetData sheet = luckysheetData.getSheets().get(0);
            if (sheet.getName() != null && sheet.getName().contains("重大风险")) {
                log.info(">>> 检测到 '重大风险' Sheet，开始执行特殊统计...");
                
                List<LuckySheetJsonDTO.CellData> celldata = sheet.getCelldata();
                if (celldata == null || celldata.isEmpty()) {
                    log.warn("'重大风险' Sheet 中没有任何单元格数据，跳过特殊统计。");
                } else {
                    // 定义特殊规则
                    final int TARGET_COLUMN_I = 8; // I列是第9列，0-based索引是8
                    final String okSymbol = "OK";
                    final String ngSymbol = "NG";
                    final String naSymbol = "NA";
                    
                    int okCount = 0;
                    int ngCount = 0;
                    int naCount = 0;
                    
                    for (LuckySheetJsonDTO.CellData cell : celldata) {
                        // 只关心第 I 列
                        if (cell.getC() == TARGET_COLUMN_I) {
                            if (cell.getV() != null && cell.getV().getV() != null) {
                                String cellValue = cell.getV().getV().trim();
                                if (okSymbol.equalsIgnoreCase(cellValue)) okCount++;
                                else if (ngSymbol.equalsIgnoreCase(cellValue)) ngCount++;
                                else if (naSymbol.equalsIgnoreCase(cellValue)) naCount++;
                            }
                        }
                    }
                    
                    int totalCount = okCount + ngCount + naCount;
                    
                    log.info("特殊规则 '重大风险统计' 计算结果: OK={}, NG={}, NA={}, Total={}", okCount, ngCount, naCount, totalCount);
                    
                    // 将结果保存到数据库，使用一个固定的 category 名
                    saveOrUpdateStatistic(fileId, "重大风险", okCount, ngCount, naCount, totalCount);
                }
            }
        }
        
        log.info("fileId: {} 的统计数据计算并保存完毕。", fileId);
    }

    /**
     * 【【【 新增：辅助方法，用于保存或更新一条统计记录 】】】
     * 将重复的数据库操作逻辑提取出来。
     */
    private void saveOrUpdateStatistic(Long fileId, String category, int okCount, int ngCount, int naCount, int totalCount) {
        SheetStatistic statisticRecord = new SheetStatistic();
        statisticRecord.setFileId(fileId);
        statisticRecord.setCategory(category);
        statisticRecord.setOkCount(okCount);
        statisticRecord.setNgCount(ngCount);
        statisticRecord.setNaCount(naCount);
        statisticRecord.setTotalCount(totalCount);

        UpdateWrapper<SheetStatistic> updateWrapper = new UpdateWrapper<>();
        updateWrapper.eq("file_id", fileId).eq("category", category);
        
        int updatedRows = sheetStatisticMapper.update(statisticRecord, updateWrapper);
        if (updatedRows == 0) {
            sheetStatisticMapper.insert(statisticRecord);
        }
    }

/**
     * 【核心】获取指定文件已保存的统计数据和相关人员信息。
     * 【已修正】：改为从 ProcessRecord 实体中获取人员信息。
     * @param fileId 文件的数据库ID
     * @return 组装好的统计数据传输对象
     */
    @Override
    public StatisticsResultDTO getSavedStats(Long fileId) {
        StatisticsResultDTO resultDTO = new StatisticsResultDTO();
        
        // 1. 根据 fileId 查询 project_files 记录
        ProjectFile projectFile = projectFileMapper.selectById(fileId);
        if (projectFile == null) {
            throw new RuntimeException("找不到ID为 " + fileId + " 的文件记录");
        }
        
        // 2. 根据 projectId 查询 project 记录
        Project project = projectMapper.selectById(projectFile.getProjectId());
        if (project == null) {
             throw new RuntimeException("找不到与文件关联的项目记录");
        }
        
        // 3. 【核心修正】根据 recordId 查询 process_record 记录以获取人员信息
        ProcessRecord record = null;
        if (projectFile.getRecordId() != null) {
            record = processRecordMapper.selectById(projectFile.getRecordId());
        }

        if (record == null) {
            log.warn("找不到与 fileId {} 关联的过程记录(ProcessRecord)，部分人员信息可能为空。", fileId);
        }

        // 4. 填充DTO的基础信息
        if (record != null) {
            resultDTO.setFileNumber(record.getProcessName()); // <-- 现在它获取的是过程记录的名称
        } else {
            resultDTO.setFileNumber(project.getProjectNumber()); // 作为后备，如果找不到record，仍然显示项目编号
        }
        
        // 从 ProcessRecord 实体中获取人员ID并查找用户名
        // 注意：请根据您 ProcessRecord 实体中的【实际字段名】进行调整！
        // 这里的 createdByUserId 和 assigneeId 是基于之前代码的猜测。
        resultDTO.setDesignerName(findUsernameById(record != null ? record.getCreatedByUserId() : null));
        resultDTO.setAuditorName(findUsernameById(record != null ? record.getAssigneeId() : null));
        resultDTO.setProofreaderName(findUsernameById(record != null ? record.getProofreaderUserId() : null));


        // 5. 根据 fileId 查询 sheet_statistics 表获取统计数据
        List<SheetStatistic> stats = sheetStatisticMapper.selectList(new QueryWrapper<SheetStatistic>().eq("file_id", fileId));
        
        // 6. 将统计数据转换成 DTO 格式
        List<StatisticsResultDTO.CategoryStat> categoryStats = new ArrayList<>();
        if (stats != null) {
            categoryStats = stats.stream().map(stat -> {
                StatisticsResultDTO.CategoryStat dtoStat = new StatisticsResultDTO.CategoryStat();
                dtoStat.setCategory(stat.getCategory());
                dtoStat.setOkCount(stat.getOkCount());
                dtoStat.setNgCount(stat.getNgCount());
                dtoStat.setNaCount(stat.getNaCount());
                dtoStat.setTotalCount(stat.getTotalCount());
                
                // 计算百分比，注意避免除零错误
                if (stat.getTotalCount() > 0) {
                    double percentage = (double) stat.getOkCount() / stat.getTotalCount() * 100;
                    // 格式化为两位小数
                    dtoStat.setOkPercentage(Math.round(percentage * 100.0) / 100.0);
                } else {
                    dtoStat.setOkPercentage(0.0);
                }
                return dtoStat;
            }).collect(Collectors.toList());
        }
        
        resultDTO.setStats(categoryStats);
        return resultDTO;
    }
    // ================== 辅助方法 ==================

    /**
     * 辅助方法：根据用户ID安全地查找用户名。
     */
    private String findUsernameById(Long userId) {
        if (userId == null) {
            return "N/A";
        }
        User user = userMapper.selectById(userId);
        return (user != null) ? user.getUsername() : "未知用户";
    }

    /**
     * 辅助方法：解析 "A1:C10" 格式的范围字符串。
     * @param rangeString 如 "C5:C20"
     * @return 包含起始和结束行列索引的对象，如果格式错误则返回 null。
     */
    private Range parseRange(String rangeString) {
        if (rangeString == null || !rangeString.matches("^[A-Z]+[0-9]+:[A-Z]+[0-9]+$")) {
            return null;
        }
        String[] parts = rangeString.split(":");
        String startCell = parts[0];
        String endCell = parts[1];
        
        int startCol = columnNameToIndex(startCell.replaceAll("[0-9]", ""));
        int startRow = Integer.parseInt(startCell.replaceAll("[A-Z]", "")) - 1;
        
        int endCol = columnNameToIndex(endCell.replaceAll("[0-9]", ""));
        int endRow = Integer.parseInt(endCell.replaceAll("[A-Z]", "")) - 1;

        return new Range(startRow, startCol, endRow, endCol);
    }
    
    /**
     * 辅助方法：将Excel列名（如 "A", "B", "AA"）转换为0-based索引。
     */
    private int columnNameToIndex(String columnName) {
        int index = 0;
        for (int i = 0; i < columnName.length(); i++) {
            index = index * 26 + (columnName.charAt(i) - 'A' + 1);
        }
        return index - 1;
    }

    /**
     * 辅助内部类：用于存储解析后的范围信息。
     */
    private static class Range {
        final int startRow;
        final int startCol;
        final int endRow;
        final int endCol;

        Range(int startRow, int startCol, int endRow, int endCol) {
            this.startRow = startRow;
            this.startCol = startCol;
            this.endRow = endRow;
            this.endCol = endCol;
        }
    }
}