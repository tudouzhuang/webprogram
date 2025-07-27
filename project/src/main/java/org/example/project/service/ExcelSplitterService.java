package org.example.project.service;

import java.io.File;
import java.io.IOException;
import java.util.List;

public interface ExcelSplitterService {
    List<File> splitExcel(File sourceFile, String outputDir) throws IOException;
}