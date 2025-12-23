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

// 确保你的类中有定义这个正则常量
    // private static final Pattern SHEET_INDEX_PATTERN = Pattern.compile("index\\s+(\\d+)");

    public void splitExcelAsync(Long fileId, String sourceFilePath, String outputDir) {
        
        // 1. 初始化状态
        PROGRESS_MAP.put(fileId, 0);
        SKIPPED_SHEETS_MAP.remove(fileId); 

        String projectRoot = System.getProperty("user.dir");
        String scriptPath = projectRoot + File.separator + "scripts" + File.separator + "excel_splitter.vbs";

        log.info("【NativeExcel】ID={} 开始处理", fileId);

        Process process = null;
        try {
            // 2. 启动 VBS 进程
            ProcessBuilder pb = new ProcessBuilder("cscript", "//Nologo", scriptPath, sourceFilePath, outputDir);
            pb.redirectErrorStream(true); // 合并错误流
            process = pb.start();

            // 3. 读取输出流 (GBK防止乱码)
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), Charset.forName("GBK")))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    // 记录原始日志
                    log.info("【VBS-{}】{}", fileId, line);
                    
                    String trimmedLine = line.trim();

                    // ============================================================
                    // Case 1: 【致命错误】文件损坏或无法打开 (新增逻辑)
                    // ============================================================
                    // 检测关键词："Error opening file" 或 VBS 返回的中文错误
                    if (trimmedLine.contains("Error opening file") || trimmedLine.contains("不能取得类 Workbooks 的 Open 属性")) {
                        log.error("【NativeExcel】检测到致命错误: 文件可能已损坏或被加密，VBS无法打开 (ID={})", fileId);
                        
                        // 标记失败
                        PROGRESS_MAP.put(fileId, -1);
                        
                        // 抛出异常中断流程，跳到外层 catch
                        throw new RuntimeException("致命错误：Excel文件损坏或无法读取");
                    }

                    // ============================================================
                    // Case 2: 【警告】特定 Sheet 策略失败 (跳过该 Sheet，继续处理)
                    // ============================================================
                    if (trimmedLine.contains("ERROR: All strategies failed")) {
                        String errorSheetName = "未知Sheet";
                        int start = trimmedLine.indexOf("[");
                        int end = trimmedLine.indexOf("]");
                        if (start > -1 && end > start) {
                            errorSheetName = trimmedLine.substring(start + 1, end);
                        }

                        SKIPPED_SHEETS_MAP.computeIfAbsent(fileId, k -> new CopyOnWriteArrayList<>()).add(errorSheetName);
                        log.warn("【NativeExcel】已记录跳过的Sheet (策略失败): {}", errorSheetName);
                        continue; 
                    }

                    // ============================================================
                    // Case 3: 【警告】Sheet 索引无法访问 (跳过该 Sheet，继续处理)
                    // ============================================================
                    if (trimmedLine.contains("WARNING:") && trimmedLine.contains("Cannot access Sheet index")) {
                        String sheetIdx = "Unknown_Index";
                        Matcher matcher = SHEET_INDEX_PATTERN.matcher(trimmedLine);
                        if (matcher.find()) {
                            sheetIdx = matcher.group(1);
                        }

                        String recordName = "Sheet_Index_" + sheetIdx;
                        SKIPPED_SHEETS_MAP.computeIfAbsent(fileId, k -> new CopyOnWriteArrayList<>()).add(recordName);
                        log.warn("【NativeExcel】警告: VBS无法读取 Sheet 索引 {}, 已跳过。", sheetIdx);
                        continue;
                    }

                    // ============================================================
                    // Case 4: 【正常】进度更新
                    // ============================================================
                    if (trimmedLine.contains("PROGRESS:")) {
                        try {
                            String[] parts = trimmedLine.split(":");
                            if (parts.length > 1) {
                                String numStr = parts[parts.length - 1].trim();
                                PROGRESS_MAP.put(fileId, Integer.parseInt(numStr));
                            }
                        } catch (Exception e) {
                            // 解析数字失败忽略
                        }
                    }
                }
            }

            // 4. 等待进程结束
            boolean finished = process.waitFor(10, TimeUnit.MINUTES);
            if (!finished) {
                process.destroyForcibly();
                PROGRESS_MAP.put(fileId, -1);
                throw new RuntimeException("Excel 处理超时");
            }
            
            // 5. 任务成功完成
            PROGRESS_MAP.put(fileId, 99);

        } catch (Exception e) {
            // 捕获所有异常（包括上面抛出的“文件损坏”异常）
            log.error("【NativeExcel】处理异常 ID=" + fileId, e);
            PROGRESS_MAP.put(fileId, -1);
        } finally {
            // 6. 清理资源
            if (process != null && process.isAlive()) {
                process.destroyForcibly();
            }
        }
    }
}