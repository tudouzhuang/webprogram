package org.example.project.service;

import java.io.File;
import java.io.IOException;

public interface FileProcessingService {
    void processExcelToImages(File excelFile, Long projectId) throws IOException;
}