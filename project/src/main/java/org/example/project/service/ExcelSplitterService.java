package org.example.project.service;

import org.example.project.dto.LuckySheetJsonDTO; // 【新增】 导入 DTO
import java.io.File;
import java.io.IOException;
import java.util.List;

public interface ExcelSplitterService {
    List<File> splitExcel(File sourceFile, String outputDir) throws IOException;
    List<LuckySheetJsonDTO.SheetData> convertExcelToLuckysheetJson(String filePath) throws IOException;
}