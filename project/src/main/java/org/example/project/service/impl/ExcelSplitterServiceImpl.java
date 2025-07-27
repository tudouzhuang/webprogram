package org.example.project.service.impl;

import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.openxml4j.util.ZipSecureFile;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.xssf.usermodel.*;
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
}