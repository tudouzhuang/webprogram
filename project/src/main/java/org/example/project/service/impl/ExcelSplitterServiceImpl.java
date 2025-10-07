package org.example.project.service.impl;

import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataValidation;
import org.apache.poi.ss.usermodel.DataValidationConstraint;
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
 * Excel 文件拆分服务的实现类。
 * 实现了将一个多Sheet的 .xlsx 文件拆分为多个单Sheet文件的功能。
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
        try (FileInputStream fis = new FileInputStream(sourceFile);
             XSSFWorkbook sourceWorkbook = new XSSFWorkbook(fis)) {

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
     * @param source      源Sheet
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
            if(firstRow != null){
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
     * @param source      源单元格
     * @param destination 目标单元格
     * @param styleMap    用于缓存和复用样式的Map
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

    // ==============================================================================
    //  ↓↓↓ 【【【  把 新 方 法 完 整 地 粘 贴 在 这 里  】】】 ↓↓↓
    // ==============================================================================
    /**
     * 【核心转换功能】读取 .xlsx 文件，并将其内容转换为 Luckysheet 需要的 JSON 格式。
     * @param filePath 文件的绝对物理路径
     * @return 包含所有 Sheet 数据的 List 集合
     * @throws IOException 如果文件读取失败
     */
    public List<LuckySheetJsonDTO.SheetData> convertExcelToLuckysheetJson(String filePath) throws IOException {
        log.info("【Excel->JSON】开始转换文件: {}", filePath);
        List<LuckySheetJsonDTO.SheetData> sheetsData = new ArrayList<>();

        ZipSecureFile.setMinInflateRatio(0.001); // 防范 Zip bomb 攻击

        try (FileInputStream fis = new FileInputStream(filePath);
             XSSFWorkbook workbook = new XSSFWorkbook(fis)) {

            for (int i = 0; i < workbook.getNumberOfSheets(); i++) {
                XSSFSheet sheet = workbook.getSheetAt(i);
                LuckySheetJsonDTO.SheetData sheetData = new LuckySheetJsonDTO.SheetData();

                // 1. 读取 Sheet 的基本信息
                sheetData.setName(sheet.getSheetName());
                sheetData.setIndex(i);
                sheetData.setOrder(i);
                sheetData.setStatus(sheet.isSelected() ? 1 : 0);

                // 2. 读取所有单元格数据 (celldata)
                List<LuckySheetJsonDTO.CellData> celldataList = new ArrayList<>();
                for (int r = sheet.getFirstRowNum(); r <= sheet.getLastRowNum(); r++) {
                    Row row = sheet.getRow(r);
                    if (row == null) continue;
                    for (int c = row.getFirstCellNum(); c < row.getLastCellNum(); c++) {
                        XSSFCell cell = (XSSFCell) row.getCell(c, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
                        if (cell == null) continue;

                        LuckySheetJsonDTO.CellData cellData = new LuckySheetJsonDTO.CellData();
                        cellData.setR(r);
                        cellData.setC(c);
                        
                        LuckySheetJsonDTO.CellValue cellValue = new LuckySheetJsonDTO.CellValue();
                        // 这里可以根据需要添加更复杂的样式、富文本等解析逻辑
                        switch (cell.getCellType()) {
                            case STRING:
                                cellValue.setV(cell.getStringCellValue());
                                cellValue.setM(cell.getStringCellValue());
                                break;
                            case NUMERIC:
                                cellValue.setV(String.valueOf(cell.getNumericCellValue()));
                                cellValue.setM(String.valueOf(cell.getNumericCellValue()));
                                break;
                            case BOOLEAN:
                                cellValue.setV(String.valueOf(cell.getBooleanCellValue()));
                                cellValue.setM(String.valueOf(cell.getBooleanCellValue()));
                                break;
                            case FORMULA:
                                cellValue.setF("=" + cell.getCellFormula());
                                try {
                                    cellValue.setV(String.valueOf(cell.getNumericCellValue()));
                                } catch (Exception e) {
                                    cellValue.setV(cell.getStringCellValue());
                                }
                                break;
                            default: break;
                        }
                        cellData.setV(cellValue);
                        celldataList.add(cellData);
                    }
                }
                sheetData.setCelldata(celldataList);

                // 3. 读取配置信息 (config), 如合并单元格
                Map<String, Object> config = new HashMap<>();
                Map<String, Object> merge = new HashMap<>();
                for (CellRangeAddress region : sheet.getMergedRegions()) {
                    String key = region.getFirstRow() + "_" + region.getFirstColumn();
                    Map<String, Integer> mergeValue = new HashMap<>();
                    mergeValue.put("r", region.getFirstRow());
                    mergeValue.put("c", region.getFirstColumn());
                    mergeValue.put("rs", region.getLastRow() - region.getFirstRow() + 1);
                    mergeValue.put("cs", region.getLastColumn() - region.getFirstColumn() + 1);
                    merge.put(key, mergeValue);
                }
                if(!merge.isEmpty()) config.put("merge", merge);
                sheetData.setConfig(config);

                // 4. 【【【 核心：读取数据验证规则 】】】
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