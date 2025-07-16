package org.example.project.utils;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * 使用本地安装的LibreOffice将Office文档转换为PDF的工具类。
 */
@Component
public class OfficeConverter {

    private static final Logger log = LoggerFactory.getLogger(OfficeConverter.class);
    
    // LibreOffice的可执行文件路径。根据你的安装位置和操作系统进行修改。
    private static final String LIBREOFFICE_PATH = "C:/Program Files/LibreOffice/program/soffice.exe"; // Windows示例
    // private static final String LIBREOFFICE_PATH = "/usr/bin/libreoffice"; // Linux通用示例
    
    /**
     * 将一个Office文件（如Excel, Word）转换为PDF。
     *
     * @param inputFile  要转换的源文件
     * @param outputDir  PDF文件的输出目录
     * @throws IOException          如果文件操作或进程执行失败
     * @throws InterruptedException 如果等待进程时被中断
     */
    public void convertToPdf(File inputFile, File outputDir) throws IOException, InterruptedException {
        // 1. 检查输入文件和输出目录是否存在
        if (!inputFile.exists()) {
            throw new IOException("源文件不存在: " + inputFile.getAbsolutePath());
        }
        if (!outputDir.exists() && !outputDir.mkdirs()) {
            throw new IOException("无法创建输出目录: " + outputDir.getAbsolutePath());
        }

        log.info("准备转换文件: {}", inputFile.getName());

        // 2. 构建命令行指令
        List<String> command = new ArrayList<>();
        command.add(LIBREOFFICE_PATH);
        command.add("--headless");        // 无头模式，不在UI中显示
        command.add("--convert-to");
        command.add("pdf");               // 目标格式为PDF
        command.add("--outdir");          // 指定输出目录
        command.add(outputDir.getAbsolutePath());
        command.add(inputFile.getAbsolutePath()); // 指定源文件

        log.info("执行转换命令: {}", String.join(" ", command));

        // 3. 执行命令
        ProcessBuilder processBuilder = new ProcessBuilder(command);
        Process process = processBuilder.start();

        // 4. 等待进程结束，并设置超时（例如2分钟）
        boolean finished = process.waitFor(2, TimeUnit.MINUTES);
        if (!finished) {
            process.destroyForcibly(); // 强制销毁超时进程
            throw new IOException("LibreOffice转换超时（超过2分钟）");
        }

        // 5. 检查进程退出码
        int exitCode = process.exitValue();
        if (exitCode != 0) {
            // 如果转换失败，读取并记录错误信息，这对于调试至关重要！
            String errorOutput = readStream(new InputStreamReader(process.getErrorStream()));
            String standardOutput = readStream(new InputStreamReader(process.getInputStream()));
            log.error("LibreOffice转换失败，退出码: {}", exitCode);
            log.error("错误流输出:\n{}", errorOutput);
            log.error("标准流输出:\n{}", standardOutput);
            throw new IOException("LibreOffice转换失败，退出码: " + exitCode);
        }

        log.info("文件 '{}' 已成功转换为PDF。", inputFile.getName());
    }

    /**
     * 读取输入流并返回字符串的辅助方法。
     */
    private String readStream(InputStreamReader streamReader) throws IOException {
        StringBuilder output = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(streamReader)) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append(System.lineSeparator());
            }
        }
        return output.toString();
    }
}