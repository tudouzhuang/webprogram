package org.example.project.utils;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Component
public class WpsConverter { // 建议可以重命名为 FileConverter

    private static final Logger log = LoggerFactory.getLogger(WpsConverter.class);

    @Value("${wps.executable.path}")
    private String converterExecutablePath;

    /**
     * 【核心方法】将Excel文件通过中间PDF格式，转换为多个PNG图片。
     * @param excelFile 要转换的源Excel文件
     * @param outputDir PNG图片最终输出的目录
     * @return 生成的PNG文件列表
     */
    public List<File> convertExcelToPngs(File excelFile, File outputDir) throws IOException, InterruptedException {
        // --- 第一步：将 Excel 转换为一个多页的 PDF 文件 ---
        File intermediatePdfFile = convertToPdf(excelFile);
        
        if (intermediatePdfFile == null || !intermediatePdfFile.exists()) {
            throw new IOException("Excel转换为PDF失败，未找到中间PDF文件。");
        }

        // --- 第二步：将多页的 PDF 转换为多个 PNG 图片 ---
        List<File> pngFiles = convertPdfToPngs(intermediatePdfFile, outputDir);
        
        // --- 第三步：清理中间产生的PDF文件 ---
        try {
            Files.delete(intermediatePdfFile.toPath());
            log.info("已清理中间PDF文件: {}", intermediatePdfFile.getName());
        } catch (IOException e) {
            log.warn("清理中间PDF文件失败: {}", e.getMessage());
        }

        return pngFiles;
    }

    /**
     * [私有辅助方法1] 调用LibreOffice将文件转换为PDF。
     */
    private File convertToPdf(File inputFile) throws IOException, InterruptedException {
        File outputDir = inputFile.getParentFile();

        List<String> commandList = new ArrayList<>();
        commandList.add(converterExecutablePath);
        commandList.add("--headless");
        commandList.add("--convert-to");
        commandList.add("pdf"); // 目标格式是 PDF
        commandList.add("--outdir");
        commandList.add(outputDir.getAbsolutePath());
        commandList.add(inputFile.getAbsolutePath());
        
        log.info("【步骤1/2】准备执行Excel转PDF命令: {}", commandList);
        Process process = new ProcessBuilder(commandList).start();

        if (!process.waitFor(2, TimeUnit.MINUTES)) {
            process.destroyForcibly();
            throw new IOException("LibreOffice转换PDF超时");
        }
        if (process.exitValue() != 0) {
            throw new IOException("LibreOffice转换PDF失败，退出码: " + process.exitValue());
        }
        log.info("【步骤1/2】Excel转PDF成功！");
        
        String pdfFileName = inputFile.getName().replaceAll("\\.[^.]+$", "") + ".pdf";
        return new File(outputDir, pdfFileName);
    }

    /**
     * [私有辅助方法2] 使用Apache PDFBox将PDF的每一页转换为PNG。
     */
    private List<File> convertPdfToPngs(File pdfFile, File outputDir) throws IOException {
        log.info("【步骤2/2】准备使用PDFBox将 {} 转换为PNG...", pdfFile.getName());
        List<File> generatedPngs = new ArrayList<>();

        try (PDDocument document = PDDocument.load(pdfFile)) {
            PDFRenderer pdfRenderer = new PDFRenderer(document);
            int pageCount = document.getNumberOfPages();
            log.info("PDF文件包含 {} 页，准备逐页转换。", pageCount);

            for (int i = 0; i < pageCount; ++i) {
                // DPI (Dots Per Inch) 决定了图片的清晰度，150是一个不错的通用值
                BufferedImage bim = pdfRenderer.renderImageWithDPI(i, 150);
                
                // 文件名格式：Sheet_1.png, Sheet_2.png ...
                // 这里的文件名是根据PDF页码来的，正好对应Excel的Sheet顺序
                String fileName = "Sheet_" + (i + 1) + ".png";
                File outputFile = new File(outputDir, fileName);
                
                ImageIO.write(bim, "PNG", outputFile);
                generatedPngs.add(outputFile);
                log.info("已生成PNG: {}", outputFile.getName());
            }
        }
        log.info("【步骤2/2】所有PDF页面已成功转换为PNG！");
        return generatedPngs;
    }
}