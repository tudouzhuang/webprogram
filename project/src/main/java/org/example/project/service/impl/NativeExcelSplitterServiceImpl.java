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

    public static final Map<Long, String> ERROR_MESSAGE_MAP = new ConcurrentHashMap<>();
    
    // 进度表 (存数字)
    public static final Map<Long, Integer> PROGRESS_MAP = new ConcurrentHashMap<>();

    // 🔥【新增】状态文字表 (存给前端看的文字直播，如 "正在执行脚本...", "流程全部结束")
    public static final Map<Long, String> STATUS_MESSAGE_MAP = new ConcurrentHashMap<>();

    // 跳过列表 (ID -> 跳过的Sheet名称/索引列表)
    public static final Map<Long, List<String>> SKIPPED_SHEETS_MAP = new ConcurrentHashMap<>();

    // 预编译正则，用于提取索引号
    private static final Pattern SHEET_INDEX_PATTERN = Pattern.compile("index\\s+(\\d+)");

    public void splitExcelAsync(Long fileId, String sourceFilePath, String outputDir) {

        // 1. 初始化状态
        PROGRESS_MAP.put(fileId, 0);
        SKIPPED_SHEETS_MAP.remove(fileId);
        ERROR_MESSAGE_MAP.remove(fileId);
        
        // 🔥【新增】告诉前端：任务开始了
        STATUS_MESSAGE_MAP.put(fileId, "正在初始化 Excel 分割引擎...");

        String projectRoot = System.getProperty("user.dir");
        String scriptPath = projectRoot + File.separator + "scripts" + File.separator + "excel_splitter.vbs";

        log.info("【NativeExcel】ID={} 开始处理", fileId);

        Process process = null;
        boolean hasFatalError = false;

        try {
            // 2. 启动 VBS 进程
            ProcessBuilder pb = new ProcessBuilder("cscript", "//Nologo", scriptPath, sourceFilePath, outputDir);
            pb.redirectErrorStream(true); 
            process = pb.start();

            // 3. 读取输出流 (GBK防止乱码)
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), Charset.forName("GBK")))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    // 记录原始日志
                    log.info("【VBS-{}】{}", fileId, line);

                    String trimmedLine = line.trim();

                    // ============================================================
                    // Case 1: 致命错误检查
                    // ============================================================
                    if (trimmedLine.contains("Error opening file")
                            || trimmedLine.contains("不能取得类 Workbooks 的 Open 属性")
                            || trimmedLine.contains("VBS无法打开")) {

                        String msg = "致命错误: 文件可能已损坏或被加密，Excel无法打开";
                        log.error("【NativeExcel】ID={} {}", fileId, msg);

                        ERROR_MESSAGE_MAP.put(fileId, msg);
                        PROGRESS_MAP.put(fileId, -1);
                        
                        // 🔥【新增】更新文字状态为失败
                        STATUS_MESSAGE_MAP.put(fileId, "任务失败: 无法打开 Excel 文件");

                        hasFatalError = true;
                        process.destroy();
                        throw new RuntimeException(msg);
                    }

                    // ============================================================
                    // Case 2: 【警告】特定 Sheet 策略失败 (跳过该 Sheet)
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
                    // Case 3: 【警告】Sheet 索引无法访问 (跳过该 Sheet)
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
                                int progressVal = Integer.parseInt(numStr);
                                
                                PROGRESS_MAP.put(fileId, progressVal);
                                
                                // 🔥【新增】实时更新文字状态，让前端看到 "正在执行脚本分割: 45%"
                                STATUS_MESSAGE_MAP.put(fileId, "正在执行脚本分割: " + progressVal + "%");
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
                String msg = "Excel 处理超时 (10分钟)";
                ERROR_MESSAGE_MAP.put(fileId, msg);
                PROGRESS_MAP.put(fileId, -1);
                // 🔥【新增】超时状态
                STATUS_MESSAGE_MAP.put(fileId, "任务超时");
                throw new RuntimeException(msg);
            }

            // 检查进程退出码
            int exitCode = process.exitValue();
            if (exitCode != 0) {
                if (!hasFatalError) {
                    String msg = "脚本异常退出 (Code: " + exitCode + ")";
                    log.error("【NativeExcel】ID={} {}", fileId, msg);
                    ERROR_MESSAGE_MAP.put(fileId, msg);
                    PROGRESS_MAP.put(fileId, -1);
                    // 🔥【新增】异常退出状态
                    STATUS_MESSAGE_MAP.put(fileId, "脚本异常中断");
                }
                return;
            }

            // 5. 任务成功完成 (脚本阶段)
            log.info("【NativeExcel】处理成功完成 ID={}", fileId);
            PROGRESS_MAP.put(fileId, 98);
            
            // 🔥【新增】告诉前端：最难的脚本跑完了，现在准备存数据库
            // ⚠️ 注意：这里不能写 "流程全部结束"，因为 Controller 那边还没做 DB 入库呢！
            STATUS_MESSAGE_MAP.put(fileId, "脚本执行完毕，正在进行数据入库...");

        } catch (Exception e) {
            log.error("【NativeExcel】处理异常 ID=" + fileId, e);
            ERROR_MESSAGE_MAP.putIfAbsent(fileId, "系统异常: " + e.getMessage());
            PROGRESS_MAP.put(fileId, -1);
            
            // 🔥【新增】确保异常时前端能看到
            STATUS_MESSAGE_MAP.put(fileId, "系统处理异常");
            
            throw new RuntimeException(e);
        } finally {
            if (process != null && process.isAlive()) {
                process.destroyForcibly();
            }
        }
    }

    /**
     * 同步重置状态方法
     */
    public void resetProgress(Long fileId) {
        PROGRESS_MAP.put(fileId, 0);
        ERROR_MESSAGE_MAP.remove(fileId);
        SKIPPED_SHEETS_MAP.remove(fileId);
        
        // 🔥【新增】重置时也清理掉文字消息
        STATUS_MESSAGE_MAP.remove(fileId);
    }
}