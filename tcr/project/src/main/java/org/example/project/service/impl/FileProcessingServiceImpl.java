package org.example.project.service.impl;

// --- 基础依赖 ---
import org.example.project.entity.ProjectFile;
import org.example.project.mapper.ProjectFileMapper;
import org.example.project.service.FileProcessingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

// --- 文件处理和Excel解析依赖 ---
import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.Rectangle2D;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.nio.file.Paths;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.hssf.util.HSSFColor; // 导入HSSFColor以处理.xls颜色
import org.apache.poi.hssf.usermodel.HSSFPalette; // 导入HSSFPalette

@Service
public class FileProcessingServiceImpl implements FileProcessingService {

    private static final Logger log = LoggerFactory.getLogger(FileProcessingServiceImpl.class);
    private static final String IMAGES_SUBDIR = "images";
    private static final float DPI = 72.0f; 

    @Autowired
    private ProjectFileMapper projectFileMapper;

    @Value("${file.upload-dir}")
    private String uploadDir;

    @Override
    public void processExcelToImages(File excelFile, Long projectId) throws IOException {
        log.info("开始处理Excel文件: {}, 关联项目ID: {}", excelFile.getName(), projectId);

        File imageOutputDir = new File(uploadDir, projectId + File.separator + IMAGES_SUBDIR);
        if (!imageOutputDir.exists() && !imageOutputDir.mkdirs()) {
            throw new IOException("无法创建图片输出目录: " + imageOutputDir.getAbsolutePath());
        }

        try (FileInputStream fis = new FileInputStream(excelFile);
             Workbook workbook = WorkbookFactory.create(fis)) {

            DataFormatter dataFormatter = new DataFormatter();
            for (int i = 0; i < workbook.getNumberOfSheets(); i++) {
                Sheet sheet = workbook.getSheetAt(i);
                if (sheet == null || workbook.isSheetHidden(i)) continue;
                
                String sheetName = sheet.getSheetName();
                log.info("正在处理Sheet: '{}'", sheetName);
                try {
                    BufferedImage image = sheetToImage(sheet, dataFormatter);
                    String pngFileName = sheetName.replaceAll("[\\\\/:*?\"<>|\\s]", "_") + ".png";
                    File outputFile = new File(imageOutputDir, pngFileName);
                    ImageIO.write(image, "PNG", outputFile);
                    log.info("图片已保存到: {}", outputFile.getAbsolutePath());

                    ProjectFile projectFile = new ProjectFile();
                    projectFile.setProjectId(projectId);
                    projectFile.setFileName(pngFileName);
                    String relativePath = Paths.get(String.valueOf(projectId), IMAGES_SUBDIR, pngFileName).toString().replace("\\", "/");
                    projectFile.setFilePath(relativePath);
                    projectFile.setFileType("image/png");
                    projectFileMapper.insert(projectFile);
                } catch (Exception e) {
                    log.error("处理Sheet '{}' 时发生严重错误: ", sheetName, e);
                }
            }
        }
    }

    /**
     * 【修正版】: 手动遍历和绘制Sheet，不使用XSSFDrawing.draw()
     */
    private BufferedImage sheetToImage(Sheet sheet, DataFormatter dataFormatter) {
        // 1. 计算图片尺寸
        int lastCol = 0;
        for (Row row : sheet) {
            if (row != null) lastCol = Math.max(lastCol, row.getLastCellNum());
        }
        if (lastCol == 0) return new BufferedImage(1, 1, BufferedImage.TYPE_INT_RGB); // 空白sheet

        int imageWidth = 0;
        for (int i = 0; i < lastCol; i++) {
            imageWidth += Math.round(sheet.getColumnWidth(i) / 256f * 8f); // 经验值调整
        }

        int imageHeight = 0;
        for (int i = 0; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            float rowHeightInPoints = (row != null) ? row.getHeightInPoints() : sheet.getDefaultRowHeightInPoints();
            imageHeight += Math.round(rowHeightInPoints * DPI / 72f);
        }
        if (imageWidth <= 0) imageWidth = 800; // 默认宽度
        if (imageHeight <= 0) imageHeight = 600; // 默认高度

        // 2. 创建画布
        BufferedImage image = new BufferedImage(imageWidth, imageHeight, BufferedImage.TYPE_INT_RGB);
        Graphics2D g2d = image.createGraphics();
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g2d.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        g2d.setColor(Color.WHITE);
        g2d.fillRect(0, 0, imageWidth, imageHeight);

        // 3. 绘制单元格
        int currentY = 0;
        for (int i = 0; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            float rowHeightInPoints = (row != null) ? row.getHeightInPoints() : sheet.getDefaultRowHeightInPoints();
            int rowHeight = Math.round(rowHeightInPoints * DPI / 72f);
            
            int currentX = 0;
            for (int j = 0; j < lastCol; j++) {
                int colWidth = Math.round(sheet.getColumnWidth(j) / 256f * 8f);
                
                if (isCellMergedAndNotTopLeft(sheet, i, j)) {
                    currentX += colWidth;
                    continue;
                }
                
                Cell cell = (row != null) ? row.getCell(j) : null;
                CellRangeAddress region = getMergedRegionForCell(sheet, i, j);

                int cellWidth = (region != null) ? getMergedWidthInPixels(sheet, region) : colWidth;
                int cellHeight = (region != null) ? getMergedHeightInPixels(sheet, region) : rowHeight;

                drawCell(g2d, cell, currentX, currentY, cellWidth, cellHeight, dataFormatter);
                currentX += colWidth;
            }
            currentY += rowHeight;
        }

        g2d.dispose();
        return image;
    }

    private void drawCell(Graphics2D g2d, Cell cell, int x, int y, int width, int height, DataFormatter formatter) {
        if (cell == null) {
            g2d.setColor(new Color(224, 224, 224)); // 灰色边框
            g2d.drawRect(x, y, width, height); // 绘制空单元格边框
            return;
        }

        CellStyle style = cell.getCellStyle();
        
        // 绘制背景色
        Color bgColor = convertPOIToAwtColor(style.getFillForegroundColorColor());
        if (style.getFillPattern() == FillPatternType.SOLID_FOREGROUND && bgColor != null) {
            g2d.setColor(bgColor);
            g2d.fillRect(x, y, width, height);
        }

        // 绘制边框
        g2d.setColor(Color.BLACK);
        if (style.getBorderTop() != BorderStyle.NONE) g2d.drawLine(x, y, x + width, y);
        if (style.getBorderBottom() != BorderStyle.NONE) g2d.drawLine(x, y + height, x + width, y + height);
        if (style.getBorderLeft() != BorderStyle.NONE) g2d.drawLine(x, y, x, y + height);
        if (style.getBorderRight() != BorderStyle.NONE) g2d.drawLine(x + width, y, x + width, y + height);

        // 绘制文字
        Workbook wb = cell.getSheet().getWorkbook();
        org.apache.poi.ss.usermodel.Font poiFont = wb.getFontAt(style.getFontIndexAsInt());
        Font awtFont = new Font(poiFont.getFontName(), (poiFont.getBold() ? Font.BOLD : Font.PLAIN) | (poiFont.getItalic() ? Font.ITALIC : Font.PLAIN), poiFont.getFontHeightInPoints());
        g2d.setFont(awtFont);
        
        Color fontColor = convertPOIToAwtColor(poiFont, wb);
        g2d.setColor(fontColor != null ? fontColor : Color.BLACK);

        String text = formatter.formatCellValue(cell);
        if (!StringUtils.hasText(text)) return;
        
        FontMetrics fm = g2d.getFontMetrics();
        Rectangle2D textBounds = fm.getStringBounds(text, g2d);
        
        // 水平对齐
        float textX = x + 5;
        if (style.getAlignment() == HorizontalAlignment.CENTER) textX = x + (width - (float)textBounds.getWidth()) / 2;
        else if (style.getAlignment() == HorizontalAlignment.RIGHT) textX = x + width - (float)textBounds.getWidth() - 5;
        
        // 垂直对齐
        float textY = y + (height - (float)textBounds.getHeight()) / 2 + fm.getAscent();
        if (style.getVerticalAlignment() == VerticalAlignment.TOP) textY = y + fm.getAscent() + 5;
        else if (style.getVerticalAlignment() == VerticalAlignment.BOTTOM) textY = y + height - fm.getDescent() - 5;

        g2d.drawString(text, textX, textY);
    }
    
    // --- 辅助方法 ---

    private Color convertPOIToAwtColor(org.apache.poi.ss.usermodel.Font poiFont, Workbook wb) {
        if (wb instanceof org.apache.poi.hssf.usermodel.HSSFWorkbook) {
            HSSFPalette palette = ((org.apache.poi.hssf.usermodel.HSSFWorkbook) wb).getCustomPalette();
            HSSFColor color = palette.getColor(poiFont.getColor());
            if (color != null) {
                short[] rgb = color.getTriplet();
                return new Color(rgb[0], rgb[1], rgb[2]);
            }
        } else if (wb instanceof org.apache.poi.xssf.usermodel.XSSFWorkbook) {
             if (poiFont instanceof org.apache.poi.xssf.usermodel.XSSFFont) {
                XSSFColor color = ((org.apache.poi.xssf.usermodel.XSSFFont) poiFont).getXSSFColor();
                return convertPOIToAwtColor(color);
            }
        }
        return null;
    }

    private Color convertPOIToAwtColor(org.apache.poi.ss.usermodel.Color poiColor) {
        if (poiColor instanceof XSSFColor) {
            byte[] argb = ((XSSFColor) poiColor).getARGB();
            if (argb != null) return new Color(argb[1] & 0xFF, argb[2] & 0xFF, argb[3] & 0xFF);
        } else if (poiColor instanceof HSSFColor) {
             short[] rgb = ((HSSFColor) poiColor).getTriplet();
             if (rgb != null) return new Color(rgb[0], rgb[1], rgb[2]);
        }
        return null;
    }

    private boolean isCellMergedAndNotTopLeft(Sheet sheet, int row, int col) {
        for (CellRangeAddress region : sheet.getMergedRegions()) {
            if (region.isInRange(row, col) && (region.getFirstRow() != row || region.getFirstColumn() != col)) {
                return true;
            }
        }
        return false;
    }

    private CellRangeAddress getMergedRegionForCell(Sheet sheet, int row, int col) {
        for (CellRangeAddress region : sheet.getMergedRegions()) {
            if (region.isInRange(row, col)) return region;
        }
        return null;
    }

    private int getMergedWidthInPixels(Sheet sheet, CellRangeAddress region) {
        int width = 0;
        for (int i = region.getFirstColumn(); i <= region.getLastColumn(); i++) {
            width += Math.round(sheet.getColumnWidth(i) / 256f * 8f);
        }
        return width;
    }

    private int getMergedHeightInPixels(Sheet sheet, CellRangeAddress region) {
        int height = 0;
        for (int i = region.getFirstRow(); i <= region.getLastRow(); i++) {
            Row row = sheet.getRow(i);
            float rowHeightInPoints = (row != null) ? row.getHeightInPoints() : sheet.getDefaultRowHeightInPoints();
            height += Math.round(rowHeightInPoints * DPI / 72f);
        }
        return height;
    }
}