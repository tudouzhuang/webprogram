package org.example.project.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import lombok.extern.slf4j.Slf4j;
import org.example.project.dto.LuckySheetJsonDTO;
import org.example.project.dto.QualityReportDTO;
import org.example.project.dto.StatisticsResultDTO;
import org.example.project.entity.*; // 假设您的实体都在这个包下
import org.example.project.mapper.*; // 假设您的Mapper都在这个包下
import org.example.project.service.StatisticsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
public class StatisticsServiceImpl implements StatisticsService {

    @Autowired
    private AuditLogMapper auditLogMapper;
    private static final java.time.format.DateTimeFormatter DATE_FORMATTER
            = java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
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
            // 安全检查
            if (luckysheetData == null || luckysheetData.getSheets() == null || luckysheetData.getSheets().isEmpty()) {
                log.warn("Luckysheet 数据为空，无法统计。");
                return;
            }

            LuckySheetJsonDTO.SheetData sheet = luckysheetData.getSheets().get(0);
            List<LuckySheetJsonDTO.CellData> celldata = sheet.getCelldata();

            if (celldata == null || celldata.isEmpty()) {
                log.warn("Sheet '{}' 中没有任何单元格数据，跳过常规计算。", sheet.getName());
            } else {
                for (StatisticRule rule : rules) {
                    Range valueRange = parseRange(rule.getRangeToScan());
                    if (valueRange == null) {
                        continue;
                    }

                    // 1. 先计算总数 (Total)
                    int totalCount = 0;
                    Range totalRange = null;

                    if (rule.getTotalCountRange() != null && !rule.getTotalCountRange().isEmpty()) {
                        totalRange = parseRange(rule.getTotalCountRange());
                        if (totalRange != null) {
                            for (LuckySheetJsonDTO.CellData cell : celldata) {
                                if (cell.getC() >= totalRange.startCol && cell.getC() <= totalRange.endCol
                                        && cell.getR() >= totalRange.startRow && cell.getR() <= totalRange.endRow) {
                                    if (cell.getV() != null && cell.getV().getV() != null && !String.valueOf(cell.getV().getV()).trim().isEmpty()) {
                                        totalCount++;
                                    }
                                }
                            }
                        }
                    }

                    // 2. 统计 OK 和 NG
                    int okCount = 0;
                    int ngCount = 0;
                    int explicitNaCount = 0;

                    for (LuckySheetJsonDTO.CellData cell : celldata) {
                        if (cell.getC() >= valueRange.startCol && cell.getC() <= valueRange.endCol
                                && cell.getR() >= valueRange.startRow && cell.getR() <= valueRange.endRow) {

                            if (cell.getV() != null && cell.getV().getV() != null) {
                                String cellValue = String.valueOf(cell.getV().getV()).trim();
                                if (cellValue.isEmpty()) {
                                    continue;
                                }

                                // 【这里调用了 isOkSymbol 和 isNgSymbol】
                                if (isOkSymbol(cellValue, rule.getOkSymbol())) {
                                    okCount++;
                                } else if (isNgSymbol(cellValue, rule.getNgSymbol())) {
                                    ngCount++;
                                } else {
                                    explicitNaCount++;
                                }
                            }
                        }
                    }

                    // 3. 计算最终的 NA 和 Total
                    int naCount;
                    if (totalRange != null) {
                        naCount = Math.max(0, totalCount - okCount - ngCount);
                    } else {
                        naCount = explicitNaCount;
                        totalCount = okCount + ngCount + naCount;
                    }

                    log.info("规则 '{}' 统计: OK={}, NG={}, NA={}, Total={}", rule.getRuleName(), okCount, ngCount, naCount, totalCount);
                    saveOrUpdateStatistic(fileId, rule.getCategory(), okCount, ngCount, naCount, totalCount);
                }
            }
        }

        // --- [第二部分：特殊统计逻辑 (重大风险)] ---
        if (luckysheetData != null && luckysheetData.getSheets() != null && !luckysheetData.getSheets().isEmpty()) {
            LuckySheetJsonDTO.SheetData sheet = luckysheetData.getSheets().get(0);
            if (sheet.getName() != null && sheet.getName().contains("重大风险")) {
                List<LuckySheetJsonDTO.CellData> celldata = sheet.getCelldata();
                if (celldata != null && !celldata.isEmpty()) {
                    final int TARGET_COLUMN_I = 8; // I列 (结果列)

                    int totalRiskItems = 0;
                    for (LuckySheetJsonDTO.CellData cell : celldata) {
                        if (cell.getC() == 0) { // A列
                            if (cell.getV() != null && cell.getV().getV() != null && !String.valueOf(cell.getV().getV()).trim().isEmpty()) {
                                String val = String.valueOf(cell.getV().getV()).trim();
                                if (val.matches("^[0-9]+(\\.0)?$")) {
                                    totalRiskItems++;
                                }
                            }
                        }
                    }
                    if (totalRiskItems == 0) {
                        totalRiskItems = 13;
                    }

                    int okCount = 0;
                    int ngCount = 0;

                    for (LuckySheetJsonDTO.CellData cell : celldata) {
                        if (cell.getC() == TARGET_COLUMN_I) { // I列
                            if (cell.getV() != null && cell.getV().getV() != null) {
                                String cellValue = String.valueOf(cell.getV().getV()).trim();
                                if (cellValue.isEmpty()) {
                                    continue;
                                }

                                // 【这里也调用了 isOkSymbol 和 isNgSymbol】
                                if (isOkSymbol(cellValue, "OK")) {
                                    okCount++;
                                } else if (isNgSymbol(cellValue, "NG")) {
                                    ngCount++;
                                }
                            }
                        }
                    }

                    int naCount = Math.max(0, totalRiskItems - okCount - ngCount);
                    saveOrUpdateStatistic(fileId, "重大风险", okCount, ngCount, naCount, totalRiskItems);
                }
            }
        }
        log.info("统计完成 fileId: {}", fileId);
    }

    /**
     * 【补全】宽松的 OK 判定逻辑
     */
    private boolean isOkSymbol(String value, String dbSymbol) {
        if (value == null) {
            return false;
        }
        if (dbSymbol != null && value.equals(dbSymbol)) {
            return true;
        }

        String v = value.toUpperCase();
        return v.equals("OK") || v.equals("√") || v.equals("TRUE") || v.equals("PASS") || v.equals("YES");
    }

    /**
     * 【补全】宽松的 NG 判定逻辑
     */
    private boolean isNgSymbol(String value, String dbSymbol) {
        if (value == null) {
            return false;
        }
        if (dbSymbol != null && value.equals(dbSymbol)) {
            return true;
        }

        String v = value.toUpperCase();
        return v.equals("NG") || v.equals("×") || v.equals("X") || v.equals("FALSE") || v.equals("FAIL") || v.equals("NO");
    }

    // =================================================================================
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
     * 【核心】获取指定文件已保存的统计数据和相关人员信息。 【最终完整版】：基于你的原始代码和固定DTO进行修改，确保编译通过且无省略。
     *
     * @param fileId 文件的数据库ID
     * @return 组装好的统计数据传输对象
     */
    @Override
    public StatisticsResultDTO getSavedStats(Long fileId) {
        // 1. 根据 fileId 查询 project_files 记录
        ProjectFile projectFile = projectFileMapper.selectById(fileId);
        if (projectFile == null) {
            throw new RuntimeException("找不到ID为 " + fileId + " 的文件记录");
        }

        // 2. 根据 recordId 查询 process_record 记录
        ProcessRecord record = null;
        if (projectFile.getRecordId() != null) {
            record = processRecordMapper.selectById(projectFile.getRecordId());
        }

        // 3. 准备用于存储人员姓名的变量，并设置默认值
        String designerName = "（未知）";
        String proofreaderName = "N/A";
        String auditorName = "（待审核）";
        String fileNumber = projectFile.getFileName(); // 默认使用文件名作为编号

        // 4. 如果找到了关联的 ProcessRecord，则从中获取人员信息
        if (record != null) {
            fileNumber = record.getProcessName(); // 优先使用过程记录的名称作为编号

            // a. 收集所有需要查询的用户ID
            Set<Long> userIds = new HashSet<>();
            if (record.getCreatedByUserId() != null) {
                userIds.add(record.getCreatedByUserId());
            }
            if (record.getProofreaderUserId() != null) {
                userIds.add(record.getProofreaderUserId());
            }
            if (record.getAssigneeId() != null) {
                userIds.add(record.getAssigneeId());
            }

            // b. 如果有ID需要查询，则一次性批量从数据库获取
            if (!userIds.isEmpty()) {
                // 【重要修正】使用 getUsername()，确保能编译通过
                Map<Long, String> userMap = userMapper.selectBatchIds(userIds).stream()
                        .collect(Collectors.toMap(User::getId, User::getUsername));

                // c. 从Map中安全地获取姓名并赋值给局部变量
                designerName = userMap.getOrDefault(record.getCreatedByUserId(), "（未知）");
                proofreaderName = userMap.getOrDefault(record.getProofreaderUserId(), "N/A");

                String tempAuditorName = userMap.get(record.getProofreaderUserId());
                if (tempAuditorName == null || tempAuditorName.equals("N/A")) {
                    tempAuditorName = userMap.getOrDefault(record.getAssigneeId(), "（待审核）");
                }
                auditorName = tempAuditorName;
            }
        } else {
            log.warn("找不到与 fileId {} 关联的过程记录(ProcessRecord)，将使用默认人员信息。", fileId);
        }

        // 5. 根据 fileId 查询并转换统计数据 (这是你原有的、完整的逻辑)
        List<SheetStatistic> stats = sheetStatisticMapper.selectList(new QueryWrapper<SheetStatistic>().eq("file_id", fileId));
        List<StatisticsResultDTO.CategoryStat> categoryStats = new ArrayList<>();
        if (stats != null) {
            categoryStats = stats.stream().map(stat -> {
                StatisticsResultDTO.CategoryStat dtoStat = new StatisticsResultDTO.CategoryStat();
                dtoStat.setCategory(stat.getCategory());
                dtoStat.setOkCount(stat.getOkCount());
                dtoStat.setNgCount(stat.getNgCount());
                dtoStat.setNaCount(stat.getNaCount());
                dtoStat.setTotalCount(stat.getTotalCount());

                if (stat.getTotalCount() != null && stat.getTotalCount() > 0 && stat.getOkCount() != null) {
                    double percentage = (double) stat.getOkCount() / stat.getTotalCount() * 100;
                    dtoStat.setOkPercentage(Math.round(percentage * 100.0) / 100.0);
                } else {
                    dtoStat.setOkPercentage(0.0);
                }
                return dtoStat;
            }).collect(Collectors.toList());
        }

        // 6. 组装最终的DTO并返回
        StatisticsResultDTO resultDTO = new StatisticsResultDTO();
        resultDTO.setStats(categoryStats); // 设置统计列表

        // 设置所有顶层的人员和基础信息字段
        resultDTO.setFileNumber(fileNumber);
        resultDTO.setDesignerName(designerName);
        resultDTO.setProofreaderName(proofreaderName);
        resultDTO.setAuditorName(auditorName);

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
     *
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

    @Override
    public org.example.project.dto.QualityReportDTO calculateFullReport() {
        // --- 1. 获取全量基础数据快照 (必须放在最前面) ---
        List<Project> allProjects = projectMapper.selectList(null);
        List<ProcessRecord> allRecords = processRecordMapper.selectList(null);
        List<AuditLog> allLogs = auditLogMapper.selectList(null);
        List<SheetStatistic> allStats = sheetStatisticMapper.selectList(null);
        List<ProjectFile> allFiles = projectFileMapper.selectList(null);
        List<User> allUsers = userMapper.selectList(null);

        // --- 2. 建立内存索引映射 (用于后续计算和名称转换) ---
        // 用户 ID -> 真实姓名
        Map<Long, String> userNameMap = allUsers.stream()
                .collect(Collectors.toMap(User::getId, User::getRealName, (k1, k2) -> k1));

        // 项目 ID -> 项目编号 (解决你要求的显示名称问题)
        Map<Long, String> projectNameMap = allProjects.stream()
                .collect(Collectors.toMap(
                        Project::getId,
                        p -> p.getProjectNumber() != null ? p.getProjectNumber() : "未命名项目",
                        (k1, k2) -> k1
                ));

        // 文件 ID -> 统计数据详情
        Map<Long, SheetStatistic> fileStatMap = allStats.stream()
                .collect(Collectors.toMap(SheetStatistic::getFileId, s -> s, (k1, k2) -> k1));

        // 记录 ID -> 关联的所有文件 ID 列表 (处理一个零件对应多个表单的情况)
        Map<Long, List<Long>> recordFilesMap = allFiles.stream()
                .filter(f -> f.getRecordId() != null)
                .collect(Collectors.groupingBy(
                        ProjectFile::getRecordId,
                        Collectors.mapping(ProjectFile::getId, Collectors.toList())
                ));

        // --- 3. 执行累加聚合计算：生成每一个零件的明细 (details) ---
        List<QualityReportDTO.DetailRecord> details = allRecords.stream().map(record -> {
            int combinedOk = 0, combinedNg = 0, combinedNa = 0, combinedTotal = 0;

            // 获取该记录关联的所有文件 ID 列表并累加数据
            List<Long> associatedFileIds = recordFilesMap.getOrDefault(record.getId(), new java.util.ArrayList<>());
            for (Long fId : associatedFileIds) {
                if (fileStatMap.containsKey(fId)) {
                    SheetStatistic s = fileStatMap.get(fId);
                    combinedOk += (s.getOkCount() != null ? s.getOkCount() : 0);
                    combinedNg += (s.getNgCount() != null ? s.getNgCount() : 0);
                    combinedNa += (s.getNaCount() != null ? s.getNaCount() : 0);
                    combinedTotal += (s.getTotalCount() != null ? s.getTotalCount() : 0);
                }
            }

            double compliance = 0.0;
            String partName = record.getPartName() != null ? record.getPartName() : "";
            String statusStr = record.getStatus() != null ? record.getStatus().name() : "UNKNOWN";

            if (combinedTotal > 0) {
                if (partName.contains("校审")) {
                    // 校审算法：(总数 - 差异数) / 总数
                    compliance = ((double) (combinedTotal - combinedNg) * 100.0) / combinedTotal;
                } else {
                    // 设计算法：OK / (总数 - NA)
                    int effectiveTotal = combinedTotal - combinedNa;
                    if (effectiveTotal > 0) {
                        compliance = (combinedOk * 100.0) / effectiveTotal;
                    }
                }
            }

            return org.example.project.dto.QualityReportDTO.DetailRecord.builder()
                    .partName(record.getPartName())
                    .memberName(userNameMap.getOrDefault(record.getCreatedByUserId(), "未知"))
                    .compliance(Math.round(compliance * 10) / 10.0)
                    .auditRounds(record.getCurrentAuditRound() != null ? record.getCurrentAuditRound() : 1)
                    .status(statusStr)
                    .lastReviewTime(record.getUpdatedAt() != null ? record.getUpdatedAt().format(DATE_FORMATTER) : "-")
                    .projectId(record.getProjectId())
                    .creatorId(record.getCreatedByUserId())
                    .isOnePass(record.getCurrentAuditRound() != null && record.getCurrentAuditRound() == 1 && "APPROVED".equals(statusStr))
                    .build();
        }).collect(Collectors.toList());

        // --- 4. 执行双维度聚合 (调用你定义的 4 参数方法) ---
        // 注意：这里必须放在 details 和 Map 计算好之后
        List<org.example.project.dto.QualityReportDTO.StatEntry> projectEntries = groupByDimension(details, "project", userNameMap, projectNameMap);
        List<org.example.project.dto.QualityReportDTO.StatEntry> employeeEntries = groupByDimension(details, "employee", userNameMap, projectNameMap);

        List<org.example.project.dto.QualityReportDTO.StatEntry> combinedList = new ArrayList<>();
        combinedList.addAll(projectEntries);
        combinedList.addAll(employeeEntries);

        // --- 5. 计算全局 KPI 指标 ---
        int totalTasks = details.size();
        double avgComp = details.stream().mapToDouble(d -> d.getCompliance()).average().orElse(0.0);
        double avgRnd = details.stream().mapToInt(d -> d.getAuditRounds()).average().orElse(0.0);
        long onePassCount = details.stream().filter(d -> d.getIsOnePass()).count();

        return org.example.project.dto.QualityReportDTO.builder()
                .global(org.example.project.dto.QualityReportDTO.GlobalSummary.builder()
                        .avgCompliance(Math.round(avgComp * 10) / 10.0)
                        .avgRounds(Math.round(avgRnd * 10) / 10.0)
                        .onePassRate(totalTasks > 0 ? Math.round((onePassCount * 100.0 / totalTasks) * 10) / 10.0 : 0.0)
                        .totalTasks(totalTasks)
                        .build())
                .list(combinedList)
                .build();
    }

    private List<org.example.project.dto.QualityReportDTO.StatEntry> groupByDimension(
            List<org.example.project.dto.QualityReportDTO.DetailRecord> details,
            String dimension,
            Map<Long, String> userNameMap,
            Map<Long, String> projectNameMap) { // 👈 参数里多传一个 projectNameMap

        Map<String, List<org.example.project.dto.QualityReportDTO.DetailRecord>> grouped;

        if ("project".equals(dimension)) {
            // 使用项目名称映射
            grouped = details.stream().collect(Collectors.groupingBy(d
                    -> projectNameMap.getOrDefault(d.getProjectId(), "未知项目(ID:" + d.getProjectId() + ")")
            ));
        } else {
            // 使用用户名映射
            grouped = details.stream().collect(Collectors.groupingBy(d
                    -> userNameMap.getOrDefault(d.getCreatorId(), "未知员工")
            ));
        }

        return grouped.entrySet().stream().map(entry -> {
            List<org.example.project.dto.QualityReportDTO.DetailRecord> subList = entry.getValue();
            double comp = subList.stream().mapToDouble(d -> d.getCompliance()).average().orElse(0.0);
            double rnds = subList.stream().mapToInt(d -> d.getAuditRounds()).average().orElse(0.0);
            long onePass = subList.stream().filter(d -> d.getIsOnePass()).count();
            long ng = subList.stream().filter(d -> "CHANGES_REQUESTED".equals(d.getStatus())).count();

            return org.example.project.dto.QualityReportDTO.StatEntry.builder()
                    .type(dimension)
                    .name(entry.getKey())
                    .avgCompliance(Math.round(comp * 10) / 10.0)
                    .totalRounds(subList.stream().mapToInt(d -> d.getAuditRounds()).sum())
                    .avgRounds(Math.round(rnds * 10) / 10.0)
                    .onePassCount((int) onePass)
                    .ngCount((int) ng)
                    .details(subList)
                    .build();
        }).collect(Collectors.toList());
    }
}
