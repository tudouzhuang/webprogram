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
 * 使用本地安装的WPS Office将Excel文件转换为PNG图片的工具类。
 */
@Component
public class WpsConverter {

    private static final Logger log = LoggerFactory.getLogger(WpsConverter.class);
    
    /**
     * 【核心】WPS表格程序(et.exe)的完整路径。
     * 请务必将其修改为你电脑上的实际路径！
     */
    private static final String WPS_ET_PATH = "D:\\WPS\\WPS Office\\12.1.0.21915\\office6";

    /**
     * 将一个Excel文件转换为PNG图片。
     * 注意：WPS命令行转换似乎是将整个工作簿作为一个长图片或多张图片输出，
     * 或者只转换第一个sheet，具体行为可能因版本而异。
     * 我们先假设它能正确处理。
     *
     * @param inputFile  要转换的源Excel文件
     * @param outputDir  PNG图片的输出目录
     * @throws IOException          如果文件操作或进程执行失败
     * @throws InterruptedException 如果等待进程时被中断
     */
    public void convertToPng(File inputFile, File outputDir) throws IOException, InterruptedException {
        if (!inputFile.exists()) {
            throw new IOException("源文件不存在: " + inputFile.getAbsolutePath());
        }
        if (!outputDir.exists() && !outputDir.mkdirs()) {
            throw new IOException("无法创建输出目录: " + outputDir.getAbsolutePath());
        }

        log.info("准备使用WPS转换文件: {}", inputFile.getName());

        // 构建命令行指令。WPS的参数比较特殊，通常是 "源文件路径 -o 输出文件路径 -t png" 的形式
        // 我们需要先定义好输出文件的完整路径
        String outputFileName = inputFile.getName().replaceAll("\\.[^.]+$", ".png");
        File outputFile = new File(outputDir, outputFileName);

        List<String> command = new ArrayList<>();
        command.add(WPS_ET_PATH);
        command.add(inputFile.getAbsolutePath());
        command.add("-o"); // 指定输出文件
        command.add(outputFile.getAbsolutePath());
        command.add("-t"); // 指定转换类型
        command.add("png");

        log.info("执行WPS转换命令: {}", String.join(" ", command));
        
        ProcessBuilder processBuilder = new ProcessBuilder(command);
        Process process = processBuilder.start();

        boolean finished = process.waitFor(2, TimeUnit.MINUTES);
        if (!finished) {
            process.destroyForcibly();
            throw new IOException("WPS转换超时（超过2分钟）");
        }

        int exitCode = process.exitValue();
        if (exitCode != 0) {
            String errorOutput = readStream(new InputStreamReader(process.getErrorStream()));
            log.error("WPS转换失败，退出码: {}", exitCode);
            log.error("错误流输出:\n{}", errorOutput);
            throw new IOException("WPS转换失败，退出码: " + exitCode + "。错误: " + errorOutput);
        }
        
        // 检查输出文件是否存在
        if (!outputFile.exists()) {
            // 有时WPS不会返回错误码，但就是没生成文件，需要额外检查
            log.error("WPS进程执行完毕，但未找到预期的输出文件: {}", outputFile.getAbsolutePath());
            throw new IOException("WPS转换后未生成PNG文件，请检查WPS命令行参数是否正确。");
        }

        log.info("文件 '{}' 已成功使用WPS转换为PNG。", inputFile.getName());
    }
    
    // 如果WPS是将每个sheet转成一张图，我们需要一个方法来处理这种情况
    // 但首先我们先用上面的简单方法测试，如果不行再用下面的复杂方法
    
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