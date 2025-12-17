package org.example.project.service.impl;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class NativeExcelSplitterServiceImpl {

    private static final Logger log = LoggerFactory.getLogger(NativeExcelSplitterServiceImpl.class);

    // 进度表
    public static final Map<Long, Integer> PROGRESS_MAP = new ConcurrentHashMap<>();

    // 跳过列表 (ID -> 跳过的Sheet名称/索引列表)
    public static final Map<Long, List<String>> SKIPPED_SHEETS_MAP = new ConcurrentHashMap<>();

    // 预编译正则，用于提取索引号，提高循环内的性能
    // 匹配: "index 20." 中的 20
    private static final Pattern SHEET_INDEX_PATTERN = Pattern.compile("index\\s+(\\d+)");

    public void splitExcelAsync(Long fileId, String sourceFilePath, String outputDir) {
        
        PROGRESS_MAP.put(fileId, 0);
        SKIPPED_SHEETS_MAP.remove(fileId); // 清理旧记录

        String projectRoot = System.getProperty("user.dir");
        // 注意：请确保你的脚本路径是正确的
        String scriptPath = projectRoot + File.separator + "scripts" + File.separator + "excel_splitter.vbs";

        log.info("【NativeExcel】ID={} 开始处理", fileId);

        Process process = null;
        try {
            // 调用 cscript 执行 VBS
            ProcessBuilder pb = new ProcessBuilder("cscript", "//Nologo", scriptPath, sourceFilePath, outputDir);
            pb.redirectErrorStream(true); // 将错误流合并到标准输出流
            process = pb.start();

            // 使用 GBK 读取 Windows 命令行输出，防止中文乱码
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), Charset.forName("GBK")))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    // 打印原始日志方便调试
                    log.info("【VBS-{}】{}", fileId, line);
                    
                    String trimmedLine = line.trim();

                    // ============================================================
                    // 1. 处理 VBS 明确的 ERROR (策略失败)
                    // ============================================================
                    if (trimmedLine.contains("ERROR: All strategies failed")) {
                        String errorSheetName = "未知Sheet";
                        int start = trimmedLine.indexOf("[");
                        int end = trimmedLine.indexOf("]");
                        if (start > -1 && end > start) {
                            errorSheetName = trimmedLine.substring(start + 1, end);
                        }

                        // 记录到跳过列表
                        SKIPPED_SHEETS_MAP.computeIfAbsent(fileId, k -> new CopyOnWriteArrayList<>()).add(errorSheetName);
                        
                        log.warn("【NativeExcel】已记录跳过的Sheet (策略失败): {}", errorSheetName);
                        continue; 
                    }

                    // ============================================================
                    // 2. ↓↓↓ 【新增修复】 处理 "Cannot access Sheet index" 警告 ↓↓↓
                    //    日志示例: ... WARNING: Cannot access Sheet index 20. Skipping...
                    // ============================================================
                    if (trimmedLine.contains("WARNING:") && trimmedLine.contains("Cannot access Sheet index")) {
                        String sheetIdx = "Unknown_Index";
                        
                        // 使用正则提取索引数字
                        Matcher matcher = SHEET_INDEX_PATTERN.matcher(trimmedLine);
                        if (matcher.find()) {
                            sheetIdx = matcher.group(1);
                        }

                        // 为了方便前端展示，标记为 "Sheet_索引号"
                        String recordName = "Sheet_Index_" + sheetIdx;

                        // 记录到跳过列表
                        SKIPPED_SHEETS_MAP.computeIfAbsent(fileId, k -> new CopyOnWriteArrayList<>()).add(recordName);

                        log.warn("【NativeExcel】警告: VBS无法读取 Sheet 索引 {}, 已跳过。", sheetIdx);
                        continue;
                    }

                    // ============================================================
                    // 3. 处理进度条
                    // ============================================================
                    if (trimmedLine.contains("PROGRESS:")) {
                        try {
                            // 兼容 "PROGRESS: 64" 或 "【...】PROGRESS: 64"
                            // 取冒号后的最后一部分
                            String[] parts = trimmedLine.split(":");
                            if (parts.length > 1) {
                                String numStr = parts[parts.length - 1].trim();
                                PROGRESS_MAP.put(fileId, Integer.parseInt(numStr));
                            }
                        } catch (Exception e) {
                            // 解析失败忽略，以免影响主流程
                        }
                    }
                }
            }

            // 等待完成
            boolean finished = process.waitFor(10, TimeUnit.MINUTES);
            if (!finished) {
                process.destroyForcibly();
                PROGRESS_MAP.put(fileId, -1);
                throw new RuntimeException("Excel 处理超时");
            }
            
            // 只要不是完全崩溃，就算成功走到了最后，进度设为 99 (或 100，视业务逻辑而定)
            PROGRESS_MAP.put(fileId, 99);

        } catch (Exception e) {
            log.error("【NativeExcel】异常", e);
            PROGRESS_MAP.put(fileId, -1);
        } finally {
            if (process != null && process.isAlive()) {
                process.destroyForcibly();
            }
        }
    }
}