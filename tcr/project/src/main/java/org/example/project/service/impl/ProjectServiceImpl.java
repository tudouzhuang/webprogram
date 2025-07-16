package org.example.project.service.impl;

// --- 基础依赖 ---
import org.example.project.dto.ProjectCreateDTO;
import org.example.project.entity.Project;
import org.example.project.entity.ProjectFile;
import org.example.project.mapper.ProjectFileMapper;
import org.example.project.mapper.ProjectMapper;
import org.example.project.service.ProjectService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

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
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.hssf.util.HSSFColor;
import org.apache.poi.hssf.usermodel.HSSFPalette;


@Service
public class ProjectServiceImpl implements ProjectService {

    private static final Logger log = LoggerFactory.getLogger(ProjectServiceImpl.class);
    private static final String IMAGES_SUBDIR = "images";
    private static final float DPI = 72.0f; 

    @Autowired
    private ProjectMapper projectMapper;

    @Autowired
    private ProjectFileMapper projectFileMapper;

    @Value("${file.upload-dir}")
    private String uploadDir;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void createProjectWithFile(ProjectCreateDTO createDTO, MultipartFile file) throws IOException {
        
        // =======================================================
        //  第一步：数据转换与实体准备
        // =======================================================
        Project projectEntity = new Project();
        BeanUtils.copyProperties(createDTO, projectEntity);

        if (createDTO.getQuoteSize() != null) {
            projectEntity.setQuoteLength(createDTO.getQuoteSize().getLength());
            projectEntity.setQuoteWidth(createDTO.getQuoteSize().getWidth());
            projectEntity.setQuoteHeight(createDTO.getQuoteSize().getHeight());
        }
        if (createDTO.getActualSize() != null) {
            projectEntity.setActualLength(createDTO.getActualSize().getLength());
            projectEntity.setActualWidth(createDTO.getActualSize().getWidth());
            projectEntity.setActualHeight(createDTO.getActualSize().getHeight());
        }
        
        // =======================================================
        //  第二步：保存项目基础信息到 `projects` 表
        // =======================================================
        projectMapper.insert(projectEntity);
        Long newProjectId = projectEntity.getId();
        log.info("【Service】项目信息已保存，新项目ID为: {}", newProjectId);
        
        // =======================================================
        //  第三步：处理并保存关联的Excel文件
        // =======================================================
        if (file != null && !file.isEmpty()) {
            log.info("【Service】接收到文件: {}，准备处理...", file.getOriginalFilename());

            // 1. 创建并保存原始Excel文件
            String originalFilename = StringUtils.cleanPath(file.getOriginalFilename());
            Path projectUploadPath = Paths.get(uploadDir, String.valueOf(newProjectId));
            if (!Files.exists(projectUploadPath)) {
                Files.createDirectories(projectUploadPath);
            }
            Path sourceFilePath = projectUploadPath.resolve("source_" + originalFilename);
            Files.copy(file.getInputStream(), sourceFilePath, StandardCopyOption.REPLACE_EXISTING);
            log.info("【Service】原始Excel文件已保存至: {}", sourceFilePath);

            // 2. 【核心】调用文件处理方法，将Excel转换为图片
            this.processExcelToImages(sourceFilePath.toFile(), newProjectId);

        } else {
            log.warn("【Service】未提供关联文件，仅创建项目信息。");
        }
    }

    /**
     * 将一个Excel文件中的所有Sheet转换为图片，并保存文件记录到数据库。
     * 这个方法是私有的，因为它只应该在创建项目的事务流程中被调用。
     */
    private void processExcelToImages(File excelFile, Long projectId) throws IOException {
        log.info("开始处理Excel文件: {}", excelFile.getName());
        File imageOutputDir = new File(uploadDir, projectId + File.separator + IMAGES_SUBDIR);
        if (!imageOutputDir.exists() && !imageOutputDir.mkdirs()) {
            throw new IOException("无法创建图片输出目录: " + imageOutputDir.getAbsolutePath());
        }

        try (FileInputStream fis = new FileInputStream(excelFile);
             Workbook workbook = WorkbookFactory.create(fis)) {

            DataFormatter dataFormatter = new DataFormatter();
            for (int i = 0; i < workbook.getNumberOfSheets(); i++) {
                Sheet sheet = workbook.getSheetAt(i);
                if (sheet == null || workbook.isSheetHidden(i)) {
                    log.warn("跳过第 {} 个Sheet，因为它为空或被隐藏。", i + 1);
                    continue;
                }
                
                String sheetName = sheet.getSheetName();
                log.info("正在处理Sheet: '{}'", sheetName);
                try {
                    BufferedImage image = sheetToImage(sheet, dataFormatter);
                    String pngFileName = sheetName.replaceAll("[\\\\/:*?\"<>|\\s]", "_") + ".png";
                    File outputFile = new File(imageOutputDir, pngFileName);
                    ImageIO.write(image, "PNG", outputFile);
                    log.info("图片已保存到: {}", outputFile.getAbsolutePath());

                    // 将文件信息存入数据库
                    ProjectFile projectFile = new ProjectFile();
                    projectFile.setProjectId(projectId);
                    projectFile.setFileName(pngFileName);
                    String relativePath = Paths.get(String.valueOf(projectId), IMAGES_SUBDIR, pngFileName).toString().replace("\\", "/");
                    projectFile.setFilePath(relativePath);
                    projectFile.setFileType("image/png");
                    projectFileMapper.insert(projectFile);
                } catch (Exception e) {
                    log.error("处理Sheet '{}' 时发生严重错误: ", sheetName, e);
                    // 在事务中，这里抛出异常会导致整个操作回滚。
                    // 如果你希望即使单个sheet失败也继续，可以只打印日志而不抛出异常。
                    throw new IOException("处理Sheet '" + sheetName + "' 失败", e);
                }
            }
        }
    }

    /**
     * 将Sheet对象转换为BufferedImage的核心实现（手动绘制版本）
     */
    private BufferedImage sheetToImage(Sheet sheet, DataFormatter dataFormatter) {
        // --- 1. 计算图片尺寸 (此部分逻辑已非常完善，保持不变) ---
        int lastCol = 0;
        for (Row row : sheet) {
            if (row != null) lastCol = Math.max(lastCol, row.getLastCellNum());
        }
        if (lastCol == 0) return new BufferedImage(1, 1, BufferedImage.TYPE_INT_RGB);

        int imageWidth = 0;
        for (int i = 0; i < lastCol; i++) {
            imageWidth += Math.round(sheet.getColumnWidth(i) / 256f * 8f);
        }

        int imageHeight = 0;
        for (int i = 0; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            float rowHeightInPoints = (row != null) ? row.getHeightInPoints() : sheet.getDefaultRowHeightInPoints();
            imageHeight += Math.round(rowHeightInPoints * DPI / 72f);
        }
        if (imageWidth <= 0) imageWidth = 800;
        if (imageHeight <= 0) imageHeight = 600;

        // --- 2. 创建画布 (此部分逻辑已非常完善，保持不变) ---
        BufferedImage image = new BufferedImage(imageWidth, imageHeight, BufferedImage.TYPE_INT_RGB);
        Graphics2D g2d = image.createGraphics();
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g2d.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        g2d.setColor(Color.WHITE);
        g2d.fillRect(0, 0, imageWidth, imageHeight);

        // --- 3. 绘制单元格 (此部分逻辑已非常完善，保持不变) ---
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

    /**
     * 绘制单个单元格的全部样式
     */
    private void drawCell(Graphics2D g2d, Cell cell, int x, int y, int width, int height, DataFormatter formatter) {
        if (cell == null) {
            g2d.setColor(Color.BLACK);
            g2d.drawRect(x, y, width - 1, height - 1);
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
        if (style.getBorderTop() != BorderStyle.NONE) g2d.drawLine(x, y, x + width - 1, y);
        if (style.getBorderBottom() != BorderStyle.NONE) g2d.drawLine(x, y + height - 1, x + width - 1, y + height - 1);
        if (style.getBorderLeft() != BorderStyle.NONE) g2d.drawLine(x, y, x, y + height - 1);
        if (style.getBorderRight() != BorderStyle.NONE) g2d.drawLine(x + width - 1, y, x + width - 1, y + height - 1);

        // 绘制文字
        Workbook wb = cell.getSheet().getWorkbook();
        org.apache.poi.ss.usermodel.Font poiFont = wb.getFontAt(style.getFontIndexAsInt());
        Font awtFont = new Font(poiFont.getFontName(), (poiFont.getBold() ? Font.BOLD : Font.PLAIN) | (poiFont.getItalic() ? Font.ITALIC : Font.PLAIN), poiFont.getFontHeightInPoints());
        g2d.setFont(awtFont);
        
        Color fontColor = convertPOIToAwtColor(poiFont.getColor(), wb);
        g2d.setColor(fontColor != null ? fontColor : Color.BLACK);

        String text = formatter.formatCellValue(cell);
        if (!StringUtils.hasText(text)) return;
        
        FontMetrics fm = g2d.getFontMetrics();
        Rectangle2D textBounds = fm.getStringBounds(text, g2d);
        
        // 处理水平对齐
        float textX = x + 5; // 默认左对齐 + 5px padding
        if (style.getAlignment() == HorizontalAlignment.CENTER) {
            textX = x + (width - (float)textBounds.getWidth()) / 2;
        } else if (style.getAlignment() == HorizontalAlignment.RIGHT) {
            textX = x + width - (float)textBounds.getWidth() - 5; // 右对齐 - 5px padding
        }
        
        // 处理垂直对齐
        float textY = y + (height - (float)textBounds.getHeight()) / 2 + fm.getAscent(); // 默认垂直居中
        if (style.getVerticalAlignment() == VerticalAlignment.TOP) {
            textY = y + fm.getAscent() + 5; // 顶部对齐
        } else if (style.getVerticalAlignment() == VerticalAlignment.BOTTOM) {
            textY = y + height - fm.getDescent() - 5; // 底部对齐
        }

        g2d.drawString(text, textX, textY);
    }
    
    // --- 辅助方法 ---

    private Color convertPOIToAwtColor(short poiColorIndex, Workbook wb) {
        if (wb instanceof org.apache.poi.hssf.usermodel.HSSFWorkbook) {
            org.apache.poi.hssf.usermodel.HSSFPalette palette = ((org.apache.poi.hssf.usermodel.HSSFWorkbook) wb).getCustomPalette();
            if (palette != null) {
                org.apache.poi.hssf.util.HSSFColor color = palette.getColor(poiColorIndex);
                if (color != null) {
                    short[] rgb = color.getTriplet();
                    return new Color(rgb[0], rgb[1], rgb[2]);
                }
            }
        }
        return null; // For XSSF, index-based color is more complex, returning null for simplicity
    }

    private Color convertPOIToAwtColor(org.apache.poi.ss.usermodel.Color poiColor) {
        if (poiColor == null) return null;
        if (poiColor instanceof XSSFColor) {
            byte[] argb = ((XSSFColor) poiColor).getARGB();
            if (argb != null) {
                // Excel ARGB is Alpha, Red, Green, Blue
                return new Color(argb[1] & 0xFF, argb[2] & 0xFF, argb[3] & 0xFF);
            }
        }
        return null;
    }

    private boolean isCellMergedAndNotTopLeft(Sheet sheet, int row, int col) {
        for (CellRangeAddress region : sheet.getMergedRegions()) {
            if (region.isInRange(row, col)) {
                return region.getFirstRow() != row || region.getFirstColumn() != col;
            }
        }
        return false;
    }

    private CellRangeAddress getMergedRegionForCell(Sheet sheet, int row, int col) {
        for (CellRangeAddress region : sheet.getMergedRegions()) {
            if (region.isInRange(row, col)) {
                return region;
            }
        }
        return null;
    }

    private int getMergedWidthInPixels(Sheet sheet, CellRangeAddress region) {
        int width = 0;
        for (int i = region.getFirstColumn(); i <= region.getLastColumn(); i++) {
            width += Math.round(sheet.getColumnWidth(i) / 256f * 7f);
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

    // `createProject` 方法如果你不需要，可以删除
    @Override
    public void createProject(ProjectCreateDTO createDTO) {
        // This method can be left empty or removed if not used.
    }
}