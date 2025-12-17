package org.example.project.service.impl;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap; 
import java.util.concurrent.TimeUnit;

@Service
public class NativeExcelSplitterServiceImpl {

    private static final Logger log = LoggerFactory.getLogger(NativeExcelSplitterServiceImpl.class);

    // 全局进度表
    public static final Map<Long, Integer> PROGRESS_MAP = new ConcurrentHashMap<>();

    /**
     * 执行分割 (注意：这里需要 fileId 参数)
     */
    public void splitExcelAsync(Long fileId, String sourceFilePath, String outputDir) {
        
        // 1. 初始化进度
        PROGRESS_MAP.put(fileId, 0);

        String projectRoot = System.getProperty("user.dir");
        String scriptPath = projectRoot + File.separator + "scripts" + File.separator + "excel_splitter.vbs";

        log.info("【NativeExcel】ID={} 开始处理", fileId);

        try {
            ProcessBuilder pb = new ProcessBuilder("cscript", "//Nologo", scriptPath, sourceFilePath, outputDir);
            pb.redirectErrorStream(true);
            Process process = pb.start();

            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), Charset.forName("GBK")))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    log.info("【VBS-{}】{}", fileId, line);

                    // 2. 【核心】解析进度并存入 Map
                    if (line.trim().startsWith("PROGRESS:")) {
                        try {
                            String numStr = line.split(":")[1].trim();
                            int percent = Integer.parseInt(numStr);
                            PROGRESS_MAP.put(fileId, percent);
                        } catch (Exception e) { /*忽略*/ }
                    }
                }
            }

            boolean finished = process.waitFor(10, TimeUnit.MINUTES);
            if (!finished) {
                process.destroyForcibly();
                PROGRESS_MAP.put(fileId, -1);
                throw new RuntimeException("Excel 处理超时");
            }
            
            int exitCode = process.exitValue();
            if (exitCode != 0 && exitCode != 2) {
                PROGRESS_MAP.put(fileId, -1);
                throw new RuntimeException("Excel 脚本错误码: " + exitCode);
            }

            // 3. 脚本完成，标记为 99% (等待数据库入库完成后，Controller 会设为 100)
            PROGRESS_MAP.put(fileId, 99);

        } catch (Exception e) {
            log.error("【NativeExcel】异常", e);
            PROGRESS_MAP.put(fileId, -1);
            throw new RuntimeException(e);
        }
    }
}