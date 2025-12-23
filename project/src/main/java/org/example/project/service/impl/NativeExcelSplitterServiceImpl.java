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
    // 进度表
    public static final Map<Long, Integer> PROGRESS_MAP = new ConcurrentHashMap<>();

    // 跳过列表 (ID -> 跳过的Sheet名称/索引列表)
    public static final Map<Long, List<String>> SKIPPED_SHEETS_MAP = new ConcurrentHashMap<>();

    // 预编译正则，用于提取索引号，提高循环内的性能
    // 匹配: "index 20." 中的 20
    private static final Pattern SHEET_INDEX_PATTERN = Pattern.compile("index\\s+(\\d+)");

    public void splitExcelAsync(Long fileId, String sourceFilePath, String outputDir) {

        // 1. 初始化状态
        PROGRESS_MAP.put(fileId, 0);
        SKIPPED_SHEETS_MAP.remove(fileId);
        ERROR_MESSAGE_MAP.remove(fileId); // 【修复】清理上次的错误信息

        String projectRoot = System.getProperty("user.dir");
        String scriptPath = projectRoot + File.separator + "scripts" + File.separator + "excel_splitter.vbs";

        log.info("【NativeExcel】ID={} 开始处理", fileId);

        Process process = null;
        // 标记位：用于判断是否在日志流中已经发现了致命错误
        boolean hasFatalError = false;

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

                    if (trimmedLine.contains("Error opening file")
                            || trimmedLine.contains("不能取得类 Workbooks 的 Open 属性")
                            || trimmedLine.contains("VBS无法打开")) {

                        String msg = "致命错误: 文件可能已损坏或被加密，Excel无法打开";
                        log.error("【NativeExcel】ID={} {}", fileId, msg);

                        // 1. 记录错误原因
                        ERROR_MESSAGE_MAP.put(fileId, msg);
                        PROGRESS_MAP.put(fileId, -1);

                        // 2. 标记标志位
                        hasFatalError = true;

                        // 3. 杀死进程 (必须在抛异常之前做)
                        process.destroy();

                        // 4. 抛出异常中断流程 (使用 msg 而不是 e)
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
                String msg = "Excel 处理超时 (10分钟)";
                ERROR_MESSAGE_MAP.put(fileId, msg);
                PROGRESS_MAP.put(fileId, -1);
                throw new RuntimeException(msg);
            }

            // ============================================================
            // 【核心修复】检查进程退出码 (Exit Code)
            // ============================================================
            // 0 表示成功，非 0 表示脚本中途崩溃或调用了 WScript.Quit(1)
            int exitCode = process.exitValue();

            if (exitCode != 0) {
                // 如果之前没捕获到 fatal error，但退出码不对，说明是未知错误崩溃
                if (!hasFatalError) {
                    String msg = "脚本异常退出 (Code: " + exitCode + ")";
                    log.error("【NativeExcel】ID={} {}", fileId, msg);
                    ERROR_MESSAGE_MAP.put(fileId, msg);
                    PROGRESS_MAP.put(fileId, -1);
                }
                // 只要退出码不是0，绝对不能标记为成功
                return;
            }

            // 5. 任务成功完成
            // 只有 exitCode == 0 且没有抛出异常才走到这里
            log.info("【NativeExcel】处理成功完成 ID={}", fileId);
            PROGRESS_MAP.put(fileId, 98);

        } catch (Exception e) {
// 1. 记录日志
            log.error("【NativeExcel】处理异常 ID=" + fileId, e);

// 2. 存入错误信息 (供前端展示)
            ERROR_MESSAGE_MAP.putIfAbsent(fileId, "系统异常: " + e.getMessage());

// 3. 设置失败状态
            PROGRESS_MAP.put(fileId, -1);

// =======================================================
// 【核心修复】必须抛出异常！打断 Controller 的后续逻辑
// =======================================================
// 如果不抛出，Controller 会以为执行成功，继续把进度改成 100
            throw new RuntimeException(e);
        } finally {
            // 6. 清理资源
            if (process != null && process.isAlive()) {
                process.destroyForcibly();
            }
        }
    }

    /**
     * 【必须新增】同步重置状态方法 防止前端在异步任务启动前就查到了上一次的错误状态
     */
    public void resetProgress(Long fileId) {
        PROGRESS_MAP.put(fileId, 0);
        ERROR_MESSAGE_MAP.remove(fileId);
        SKIPPED_SHEETS_MAP.remove(fileId);
    }
}
