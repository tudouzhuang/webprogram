package org.example.project.service.impl;

import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataValidation;
import org.apache.poi.ss.usermodel.DataValidationConstraint;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.ss.util.CellRangeAddressList;
import org.apache.poi.openxml4j.util.ZipSecureFile;
import org.apache.poi.xssf.usermodel.*;
import org.example.project.dto.LuckySheetJsonDTO;
import org.example.project.service.ExcelSplitterService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Excel 文件拆分服务的实现类。 实现了将一个多Sheet的 .xlsx 文件拆分为多个单Sheet文件的功能。
 */
@Service
public class ExcelSplitterServiceImpl implements ExcelSplitterService {

    private static final Logger log = LoggerFactory.getLogger(ExcelSplitterServiceImpl.class);

    @Override
    public List<File> splitExcel(File sourceFile, String outputDirPath) throws IOException {
        List<File> outputFiles = new ArrayList<>();
        File outputDir = new File(outputDirPath);

        if (!outputDir.exists() && !outputDir.mkdirs()) {
            throw new IOException("无法创建拆分文件的输出目录: " + outputDirPath);
        }

        ZipSecureFile.setMinInflateRatio(0.001);
        log.info("【ExcelSplitter】开始拆分文件: {}", sourceFile.getName());
        try (FileInputStream fis = new FileInputStream(sourceFile); XSSFWorkbook sourceWorkbook = new XSSFWorkbook(fis)) {

            for (int i = 0; i < sourceWorkbook.getNumberOfSheets(); i++) {
                XSSFSheet sourceSheet = sourceWorkbook.getSheetAt(i);
                String sheetName = sourceSheet.getSheetName();
                log.info("【ExcelSplitter】正在处理Sheet: '{}'", sheetName);

                try {
                    String cleanSheetName = sheetName.replaceAll("[\\\\/:*?\"<>|\\s]", "_");
                    String newFileName = cleanSheetName.isEmpty() ? "Sheet_" + (i + 1) + ".xlsx" : cleanSheetName + ".xlsx";
                    File newFile = new File(outputDir, newFileName);

                    try (XSSFWorkbook newWorkbook = new XSSFWorkbook()) {
                        XSSFSheet newSheet = newWorkbook.createSheet(sheetName);
                        copySheet(sourceSheet, newSheet); // 调用下面的私有辅助方法

                        try (FileOutputStream fos = new FileOutputStream(newFile)) {
                            newWorkbook.write(fos);
                        }
                        log.info("【ExcelSplitter】成功保存为 -> {}", newFileName);
                        outputFiles.add(newFile); // 将成功生成的文件添加到返回列表
                    }
                } catch (Exception e) {
                    log.error("【ExcelSplitter】处理Sheet '{}' 时发生错误，已跳过。", sheetName, e);
                }
            }
        }
        log.info("【ExcelSplitter】文件拆分完成，共生成 {} 个文件。", outputFiles.size());
        return outputFiles;
    }

    /**
     * 复制整个Sheet，包括内容、样式、合并单元格和图片。
     *
     * @param source 源Sheet
     * @param destination 目标Sheet
     */
    private void copySheet(XSSFSheet source, XSSFSheet destination) {
        Map<Integer, XSSFCellStyle> styleMap = new HashMap<>();

        // 1. 复制合并单元格
        for (CellRangeAddress region : source.getMergedRegions()) {
            destination.addMergedRegion(region);
        }

        // 2. 复制列宽
        if (source.getPhysicalNumberOfRows() > 0) {
            XSSFRow firstRow = source.getRow(source.getFirstRowNum());
            if (firstRow != null) {
                for (int i = 0; i < firstRow.getLastCellNum(); i++) {
                    destination.setColumnWidth(i, source.getColumnWidth(i));
                }
            }
        }

        // 3. 遍历行并复制
        for (int i = source.getFirstRowNum(); i <= source.getLastRowNum(); i++) {
            XSSFRow sourceRow = source.getRow(i);
            if (sourceRow != null) {
                XSSFRow destRow = destination.createRow(i);
                destRow.setHeight(sourceRow.getHeight());
                // 遍历单元格并复制
                for (int j = sourceRow.getFirstCellNum(); j >= 0 && j < sourceRow.getLastCellNum(); j++) {
                    XSSFCell sourceCell = sourceRow.getCell(j);
                    if (sourceCell != null) {
                        XSSFCell destCell = destRow.createCell(j);
                        copyCell(sourceCell, destCell, styleMap);
                    }
                }
            }
        }

        // 4. 复制绘图层 (图片、形状等)
        XSSFDrawing sourceDrawing = source.getDrawingPatriarch();
        if (sourceDrawing != null) {
            XSSFDrawing destDrawing = destination.createDrawingPatriarch();
            for (XSSFShape shape : sourceDrawing.getShapes()) {
                if (shape instanceof XSSFPicture) {
                    XSSFPicture sourcePicture = (XSSFPicture) shape;
                    try {
                        XSSFPictureData pictureData = sourcePicture.getPictureData();
                        if (pictureData != null && pictureData.getData() != null) {
                            int pictureIndex = destination.getWorkbook().addPicture(pictureData.getData(), pictureData.getPictureType());
                            XSSFClientAnchor anchor = sourcePicture.getClientAnchor();
                            destDrawing.createPicture(anchor, pictureIndex);
                        } else {
                            log.warn("【ExcelSplitter】在Sheet '{}' 中发现一个空的图片数据，已跳过。", source.getSheetName());
                        }
                    } catch (NullPointerException npe) {
                        log.warn("【ExcelSplitter】在Sheet '{}' 中发现一个损坏的图片引用，已安全跳过。", source.getSheetName());
                    }
                }
            }
        }
    }

    /**
     * 复制单个单元格，包括样式、评论、超链接和值。
     *
     * @param source 源单元格
     * @param destination 目标单元格
     * @param styleMap 用于缓存和复用样式的Map
     */
    private void copyCell(XSSFCell source, XSSFCell destination, Map<Integer, XSSFCellStyle> styleMap) {
        // 复制样式
        if (source.getCellStyle() != null) {
            int sourceStyleId = source.getCellStyle().getIndex();
            XSSFCellStyle newCellStyle = styleMap.get(sourceStyleId);
            if (newCellStyle == null) {
                newCellStyle = destination.getSheet().getWorkbook().createCellStyle();
                newCellStyle.cloneStyleFrom(source.getCellStyle());
                styleMap.put(sourceStyleId, newCellStyle);
            }
            destination.setCellStyle(newCellStyle);
        }

        // 复制评论
        if (source.getCellComment() != null) {
            destination.setCellComment(source.getCellComment());
        }

        // 复制超链接
        if (source.getHyperlink() != null) {
            destination.setHyperlink(source.getHyperlink());
        }

        // 复制单元格类型和值
        destination.setCellType(source.getCellType());
        switch (source.getCellType()) {
            case STRING:
                destination.setCellValue(source.getStringCellValue());
                break;
            case NUMERIC:
                destination.setCellValue(source.getNumericCellValue());
                break;
            case BOOLEAN:
                destination.setCellValue(source.getBooleanCellValue());
                break;
            case FORMULA:
                destination.setCellFormula(source.getCellFormula());
                break;
            case BLANK:
                break;
            case ERROR:
                destination.setCellErrorValue(source.getErrorCellValue());
                break;
            default:
                break;
        }
    }

    /**
     * 【辅助方法】将 POI 边框样式转换为 Luckysheet 样式 ID
     */
    private int getLuckysheetBorderStyle(org.apache.poi.ss.usermodel.BorderStyle style) {
        if (style == null) {
            return 0;
        }
        switch (style) {
            case THIN:
                return 1;              // 细实线
            case HAIR:
                return 2;              // 极细虚线
            case DOTTED:
                return 3;            // 点虚线
            case DASHED:
                return 4;            // 短划线
            case DASH_DOT:
                return 5;          // 点划线
            case DASH_DOT_DOT:
                return 6;      // 双点划线
            case DOUBLE:
                return 7;            // 双实线
            case MEDIUM:
                return 8;            // 中实线
            case MEDIUM_DASHED:
                return 9;     // 中划线
            case MEDIUM_DASH_DOT:
                return 10;  // 中点划线
            case MEDIUM_DASH_DOT_DOT:
                return 11; // 中双点划线
            case SLANTED_DASH_DOT:
                return 12; // 倾斜点划线
            case THICK:
                return 13;            // 粗实线
            default:
                return 1;
        }
    }

    /**
     * 【辅助方法】获取 POI 颜色 Hex 字符串
     */
    private String getPOIColor(org.apache.poi.xssf.usermodel.XSSFColor color) {
        if (color == null || color.getARGBHex() == null) {
            return "#000000"; // 默认为黑色
        }
        // POI 返回的 ARGBHex 前两位是 Alpha 通道，通常需要截取掉，或者保留 #
        // Luckysheet 兼容 #RRGGBB
        return "#" + color.getARGBHex().substring(2);
    }

    /**
     * 【核心转换功能】读取 .xlsx 文件，并将其内容转换为 Luckysheet 需要的 JSON 格式。 【最终完整版 + 后端标红】:
     * 全面支持样式、合并、列宽等，并增加了后端自动标红逻辑。
     *
     * @param filePath 文件的绝对物理路径
     * @return 包含所有 Sheet 数据的 List 集合
     * @throws IOException 如果文件读取失败
     */
    public List<LuckySheetJsonDTO.SheetData> convertExcelToLuckysheetJson(String filePath) throws IOException {
        log.info("【Excel->JSON】开始转换文件: {}", filePath);
        List<LuckySheetJsonDTO.SheetData> sheetsData = new ArrayList<>();

        ZipSecureFile.setMinInflateRatio(0.001);

        try (FileInputStream fis = new FileInputStream(filePath); XSSFWorkbook workbook = new XSSFWorkbook(fis)) {

            for (int i = 0; i < workbook.getNumberOfSheets(); i++) {
                XSSFSheet sheet = workbook.getSheetAt(i);
                LuckySheetJsonDTO.SheetData sheetData = new LuckySheetJsonDTO.SheetData();

                sheetData.setName(sheet.getSheetName());
                sheetData.setIndex(i);
                sheetData.setOrder(i);
                sheetData.setStatus(sheet.isSelected() ? 1 : 0);

                // 【【【 核心修正 1：动态规则选择 】】】
                // =================================================================
                String okSymbol;
                String ngSymbol;

                if (sheet.getSheetName().contains("重大风险")) {
                    log.info("  -> 检测到 '重大风险' Sheet，切换到特殊解析规则。");
                    // 在这里定义“重大风险”工作表专用的符号
                    okSymbol = "OK";
                    ngSymbol = "NG";
                } else {
                    // 默认规则
                    okSymbol = "√";
                    ngSymbol = "×";
                }
                // =================================================================
                java.util.Set<String> hiddenMergedCells = new java.util.HashSet<>();
                for (CellRangeAddress region : sheet.getMergedRegions()) {
                    for (int mr = region.getFirstRow(); mr <= region.getLastRow(); mr++) {
                        for (int mc = region.getFirstColumn(); mc <= region.getLastColumn(); mc++) {
                            // 跳过左上角的“老大”，其他的“小弟”全部加入黑名单
                            if (mr == region.getFirstRow() && mc == region.getFirstColumn()) {
                                continue;
                            }
                            hiddenMergedCells.add(mr + "_" + mc);
                        }
                    }
                }
                List<LuckySheetJsonDTO.CellData> celldataList = new ArrayList<>();
                for (int r = sheet.getFirstRowNum(); r <= sheet.getLastRowNum(); r++) {
                    Row row = sheet.getRow(r);
// 🔥【手术刀修复】必须判空！POI 遇到空行会返回 null
                    if (row == null) {
                        continue;
                    }

// 获取起始列，如果小于0说明该行虽然存在但无单元格
                    short firstCellNum = row.getFirstCellNum();
                    if (firstCellNum < 0) {
                        continue;
                    }
                    for (int c = firstCellNum; c < row.getLastCellNum(); c++) {
                        XSSFCell cell = (XSSFCell) row.getCell(c, Row.MissingCellPolicy.CREATE_NULL_AS_BLANK);
                        if (cell == null) {
                            continue;
                        }

                        LuckySheetJsonDTO.CellData cellData = new LuckySheetJsonDTO.CellData();
                        cellData.setR(r);
                        cellData.setC(c);

                        LuckySheetJsonDTO.CellValue cellValue = new LuckySheetJsonDTO.CellValue();

                        // 1. 解析单元格已有的样式
                        XSSFCellStyle style = cell.getCellStyle();
                        if (style != null) {
                            XSSFFont font = style.getFont();
                            if (font != null) {
                                if (font.getBold()) {
                                    cellValue.setBl(1);
                                }
                                if (font.getItalic()) {
                                    cellValue.setIt(1);
                                }
                                if (font.getStrikeout()) {
                                    cellValue.setCl(1);
                                }
                                if (font.getUnderline() != XSSFFont.U_NONE) {
                                    cellValue.setUl(1);
                                }
                                if (font.getFontName() != null) {
                                    cellValue.setFf(font.getFontName());
                                }
                                cellValue.setFs(font.getFontHeightInPoints());
                                XSSFColor fontColor = font.getXSSFColor();
                                if (fontColor != null && fontColor.getARGBHex() != null) {
                                    cellValue.setFc("#" + fontColor.getARGBHex().substring(2));
                                }
                            }
                            XSSFColor bgColor = style.getFillForegroundXSSFColor();
                            if (bgColor != null && style.getFillPattern() == FillPatternType.SOLID_FOREGROUND && bgColor.getARGBHex() != null) {
                                cellValue.setBg("#" + bgColor.getARGBHex().substring(2));
                            }
                            switch (style.getAlignment()) {
                                case LEFT:
                                    cellValue.setHt(1);
                                    break;
                                case CENTER:
                                    cellValue.setHt(0);
                                    break;
                                case RIGHT:
                                    cellValue.setHt(2);
                                    break;
                            }
                            switch (style.getVerticalAlignment()) {
                                case TOP:
                                    cellValue.setVt(1);
                                    break;
                                case CENTER:
                                    cellValue.setVt(0);
                                    break;
                                case BOTTOM:
                                    cellValue.setVt(2);
                                    break;
                            }
                            if (style.getWrapText()) {
                                cellValue.setTb(2);
                            }
                            Map<String, Object> bd = new HashMap<>();

                            // 为了防止日志刷屏，我们只打印前 10 行非空单元格的调试信息
                            boolean isDebugTarget = (r < 10 && c < 10);

                            if (isDebugTarget) {
                                log.info("🔍 [Cell Debug] ({}, {}) POI原始边框状态: Top={}, Bottom={}, Left={}, Right={}",
                                        r, c, style.getBorderTop(), style.getBorderBottom(), style.getBorderLeft(), style.getBorderRight());
                            }
                            if (!hiddenMergedCells.contains(r + "_" + c)) {
                                // 1. 上边框 (Top)
                                if (style.getBorderTop() != org.apache.poi.ss.usermodel.BorderStyle.NONE) {
                                    Map<String, Object> borderTop = new HashMap<>();
                                    int s = getLuckysheetBorderStyle(style.getBorderTop());
                                    String color = getPOIColor(style.getTopBorderXSSFColor());
                                    borderTop.put("style", s);
                                    borderTop.put("color", color);
                                    bd.put("t", borderTop);
                                    if (isDebugTarget) {
                                        log.info("   -> ✅ 捕获上边框: style={}, color={}", s, color);
                                    }
                                }

                                // 2. 下边框 (Bottom)
                                if (style.getBorderBottom() != org.apache.poi.ss.usermodel.BorderStyle.NONE) {
                                    Map<String, Object> borderBottom = new HashMap<>();
                                    borderBottom.put("style", getLuckysheetBorderStyle(style.getBorderBottom()));
                                    borderBottom.put("color", getPOIColor(style.getBottomBorderXSSFColor()));
                                    bd.put("b", borderBottom);
                                }

                                // 3. 左边框 (Left)
                                if (style.getBorderLeft() != org.apache.poi.ss.usermodel.BorderStyle.NONE) {
                                    Map<String, Object> borderLeft = new HashMap<>();
                                    borderLeft.put("style", getLuckysheetBorderStyle(style.getBorderLeft()));
                                    borderLeft.put("color", getPOIColor(style.getLeftBorderXSSFColor()));
                                    bd.put("l", borderLeft);
                                }

                                // 4. 右边框 (Right)
                                if (style.getBorderRight() != org.apache.poi.ss.usermodel.BorderStyle.NONE) {
                                    Map<String, Object> borderRight = new HashMap<>();
                                    borderRight.put("style", getLuckysheetBorderStyle(style.getBorderRight()));
                                    borderRight.put("color", getPOIColor(style.getRightBorderXSSFColor()));
                                    bd.put("r", borderRight);
                                }
                            }
                            // 将边框信息存入 cellValue
                            if (!bd.isEmpty()) {
                                cellValue.setBd(bd);
                                if (isDebugTarget) {
                                    log.info("   -> 🎉 单元格 ({}, {}) 边框数据已写入 DTO: {}", r, c, bd);
                                }
                            } else {
                                if (isDebugTarget && (style.getBorderTop() != org.apache.poi.ss.usermodel.BorderStyle.NONE)) {
                                    log.warn("   -> ⚠️ 警告：POI检测到边框但 bd Map 为空？请检查逻辑！");
                                }
                            }
                        }

                        // 2. 解析单元格的值
                        String finalValue = ""; // 用于存储最终的文本值，方便后面判断
                        switch (cell.getCellType()) {
                            case STRING:
                                finalValue = cell.getStringCellValue();
                                cellValue.setV(finalValue);
                                cellValue.setM(finalValue);
                                break;
                            case NUMERIC:
                                if (org.apache.poi.ss.usermodel.DateUtil.isCellDateFormatted(cell)) {
                                    java.util.Date date = cell.getDateCellValue();
                                    java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
                                    finalValue = sdf.format(date);
                                    cellValue.setV(finalValue);
                                    cellValue.setM(finalValue);
                                } else {
                                    finalValue = new java.math.BigDecimal(cell.getNumericCellValue()).toPlainString();
                                    cellValue.setV(finalValue);
                                    cellValue.setM(finalValue);
                                }
                                break;
                            case BOOLEAN:
                                finalValue = String.valueOf(cell.getBooleanCellValue());
                                cellValue.setV(finalValue);
                                cellValue.setM(finalValue);
                                break;
                            case FORMULA:
                                cellValue.setF("=" + cell.getCellFormula());
                                switch (cell.getCachedFormulaResultType()) {
                                    case NUMERIC:
                                        finalValue = String.valueOf(cell.getNumericCellValue());
                                        break;
                                    case STRING:
                                        finalValue = cell.getStringCellValue();
                                        break;
                                    case BOOLEAN:
                                        finalValue = String.valueOf(cell.getBooleanCellValue());
                                        break;
                                    case ERROR:
                                        finalValue = org.apache.poi.ss.usermodel.FormulaError.forInt(cell.getErrorCellValue()).getString();
                                        break;
                                    default:
                                        finalValue = "";
                                        break;
                                }
                                cellValue.setV(finalValue);
                                break;
                            default:
                                break;
                        }

                        // 【【【 核心修正 2：应用动态规则进行标红 】】】
                        // =================================================================
                        List<Integer> targetColumns = java.util.Arrays.asList(4, 5, 6, 7, 8, 9, 10);
                        if (targetColumns.contains(c)) {
                            // 使用我们动态选择的 ngSymbol 来判断
                            if (ngSymbol.equals(finalValue.trim())) {
                                log.trace("后端标红: 单元格 (r={}, c={}) 值为'{}'，设置红色背景。", r, c, ngSymbol);
                                cellValue.setBg("#ffdddd");
                                cellValue.setFc("#9c0006");
                            } else {
                                if (cellValue.getBg() != null && "#ffdddd".equalsIgnoreCase(cellValue.getBg())) {
                                    log.trace("后端清除标红: 单元格 (r={}, c={}) 值不再是'{}'，清除红色背景。", r, c, ngSymbol);
                                    cellValue.setBg(null);
                                    cellValue.setFc(null);
                                }
                            }
                        }
                        // =================================================================

                        cellData.setV(cellValue);
                        celldataList.add(cellData);
                    }
                }
                sheetData.setCelldata(celldataList);

                // 3. 读取配置信息 (config)
                Map<String, Object> config = new HashMap<>();
                Map<String, Object> merge = new HashMap<>();
                List<CellRangeAddress> mergedRegions = sheet.getMergedRegions();
                if (mergedRegions != null) {
                    for (CellRangeAddress region : mergedRegions) {
                    // 【【【 核心修正：增加安全检查 】】】
                    // 只有当合并区域的行数(rs)和列数(cs)都大于1时，才是一个有效的合并单元格。
                    // 单行或单列的“合并”是没有意义的，且可能导致 Luckysheet 内部 bug。
                    int rowSpan = region.getLastRow() - region.getFirstRow() + 1;
                    int colSpan = region.getLastColumn() - region.getFirstColumn() + 1;

                    if (rowSpan > 1 || colSpan > 1) {
                        String key = region.getFirstRow() + "_" + region.getFirstColumn();
                        Map<String, Integer> mergeValue = new HashMap<>();
                        mergeValue.put("r", region.getFirstRow());
                        mergeValue.put("c", region.getFirstColumn());
                        mergeValue.put("rs", rowSpan);
                        mergeValue.put("cs", colSpan);
                        merge.put(key, mergeValue);
                    } else {
                        log.warn("发现一个无效的单格合并区域 (r={}, c={})，已自动忽略。", region.getFirstRow(), region.getFirstColumn());
                    }
                }}
                if (!merge.isEmpty()) {
                    config.put("merge", merge);
                }

                Map<String, Integer> columnlenMap = new HashMap<>();
                int maxColumn = 0;
                for (int r = sheet.getFirstRowNum(); r <= sheet.getLastRowNum(); r++) {
                    Row row = sheet.getRow(r);
                    if (row != null && row.getLastCellNum() > maxColumn) {
                        maxColumn = row.getLastCellNum();
                    }
                }
                for (int c = 0; c < maxColumn; c++) {
                    int poiWidth = sheet.getColumnWidth(c);
                    if (poiWidth != sheet.getDefaultColumnWidth() * 256) {
                        int pixelWidth = (int) Math.round(poiWidth / 256.0 * 8);
                        columnlenMap.put(String.valueOf(c), pixelWidth);
                    }
                }
                if (!columnlenMap.isEmpty()) {
                    config.put("columnlen", columnlenMap);
                }

                Map<String, Integer> rowlenMap = new HashMap<>();
                for (int r = sheet.getFirstRowNum(); r <= sheet.getLastRowNum(); r++) {
                    Row row = sheet.getRow(r);
                    if (row != null) {
                        short poiHeight = row.getHeight();
                        if (poiHeight != sheet.getDefaultRowHeight()) {
                            int pixelHeight = (int) Math.round(poiHeight / 20.0 * 1.333);
                            rowlenMap.put(String.valueOf(r), pixelHeight);
                        }
                    }
                }
                if (!rowlenMap.isEmpty()) {
                    config.put("rowlen", rowlenMap);
                }
                sheetData.setConfig(config);

                // 4. 读取数据验证规则
                Map<String, Object> dataVerificationMap = new HashMap<>();
                for (DataValidation validation : sheet.getDataValidations()) {
                    DataValidationConstraint constraint = validation.getValidationConstraint();
                    if (constraint.getValidationType() == DataValidationConstraint.ValidationType.LIST) {
                        CellRangeAddressList regions = validation.getRegions();
                        for (CellRangeAddress region : regions.getCellRangeAddresses()) {
                            for (int r = region.getFirstRow(); r <= region.getLastRow(); r++) {
                                for (int c = region.getFirstColumn(); c <= region.getLastColumn(); c++) {
                                    String luckysheetRangeKey = r + "_" + c;
                                    Map<String, Object> rule = new HashMap<>();
                                    rule.put("type", "dropdown");
                                    String formula = constraint.getFormula1();
                                    if (formula != null && formula.startsWith("\"") && formula.endsWith("\"")) {
                                        formula = formula.substring(1, formula.length() - 1);
                                    }
                                    rule.put("value1", formula);
                                    rule.put("prohibitInput", !validation.getEmptyCellAllowed());
                                    dataVerificationMap.put(luckysheetRangeKey, rule);
                                }
                            }
                        }
                    }
                }
                if (!dataVerificationMap.isEmpty()) {
                    sheetData.setDataVerification(dataVerificationMap);
                }

                sheetsData.add(sheetData);
            }
        }
        log.info("【Excel->JSON】文件转换成功，共处理 {} 个Sheet。", sheetsData.size());
        return sheetsData;
    }
}
