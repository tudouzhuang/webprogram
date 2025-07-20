package org.example.project.controller;

import org.example.project.entity.ProjectFile;
import org.example.project.mapper.ProjectFileMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Optional;
import java.util.stream.Stream;

@Controller
@RequestMapping("/api/files")
public class FileController {

    private static final Logger log = LoggerFactory.getLogger(FileController.class);

    @Value("${file.upload-dir}")
    private String uploadDir;

    @Autowired
    private ProjectFileMapper projectFileMapper;

    // =========================================================================
    // 【方法一】: 根据文件ID下载单个文件 (这正是你前端需要的那个!)
    // =========================================================================
    /**
     * 根据文件在数据库中的主键ID，下载对应的文件（PNG, PDF等）。
     * @param fileId 文件在 `project_files` 表中的主键ID
     * @return 包含文件内容的文件流响应
     */
    @GetMapping("/download/project-file/{fileId}")
    public ResponseEntity<Resource> downloadProjectFileById(@PathVariable Long fileId) {
        log.info("接收到下载文件ID {} 的请求", fileId);

        // 1. 根据 fileId 从数据库查询文件记录
        ProjectFile fileRecord = projectFileMapper.selectById(fileId);
        if (fileRecord == null) {
            log.warn("在数据库中找不到文件ID: {}", fileId);
            return ResponseEntity.notFound().build();
        }

        // 2. 使用记录中的 filePath 构建文件的完整物理路径
        Path filePath = Paths.get(uploadDir, fileRecord.getFilePath());
        File file = filePath.toFile();
        if (!file.exists()) {
            log.error("数据库记录存在，但物理文件未找到: {}", filePath);
            return ResponseEntity.notFound().build();
        }

        try {
            // 3. 准备文件流和响应头
            InputStreamResource resource = new InputStreamResource(new FileInputStream(file));
            String encodedFilename = URLEncoder.encode(fileRecord.getFileName(), "UTF-8").replaceAll("\\+", "%20");

            HttpHeaders headers = new HttpHeaders();
            headers.add(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + encodedFilename + "\"");

            // 4. 返回响应
            return ResponseEntity.ok()
                    .headers(headers)
                    .contentLength(file.length())
                    .contentType(MediaType.APPLICATION_OCTET_STREAM) // 使用通用的二进制流类型
                    .body(resource);

        } catch (IOException e) {
            log.error("读取文件时发生IO异常: ", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    // =========================================================================
    // 【方法二】: 根据项目ID下载原始Excel文件 (你可以保留它，以备将来之需)
    // =========================================================================
    /**
     * 根据项目ID，自动查找并下载该项目目录下的原始Excel文件。
     * @param projectId 项目的ID
     * @return 包含Excel文件内容的文件流响应
     */
    @GetMapping("/download/project-excel/{projectId}")
    public ResponseEntity<Resource> downloadOriginalExcel(@PathVariable Long projectId) {
        log.info("接收到下载项目ID {} 的原始Excel文件请求", projectId);
        try {
            Path projectDir = Paths.get(uploadDir, String.valueOf(projectId));
            if (!Files.isDirectory(projectDir)) {
                log.error("项目目录不存在: {}", projectDir);
                return ResponseEntity.notFound().build();
            }

            Optional<File> excelFileOptional;
            try (Stream<Path> stream = Files.walk(projectDir, 1)) {
                excelFileOptional = stream
                        .map(Path::toFile)
                        .filter(file -> file.isFile() && file.getName().startsWith("source_") && (file.getName().toLowerCase().endsWith(".xlsx") || file.getName().toLowerCase().endsWith(".xls")))
                        .findFirst();
            }

            if (!excelFileOptional.isPresent()) {
                log.error("在目录 {} 中找不到原始Excel文件", projectDir);
                return ResponseEntity.notFound().build();
            }
            File excelFile = excelFileOptional.get();

            InputStreamResource resource = new InputStreamResource(new FileInputStream(excelFile));
            String originalFilename = excelFile.getName().replaceFirst("source_", "");
            String encodedFilename = URLEncoder.encode(originalFilename, "UTF-8").replaceAll("\\+", "%20");

            HttpHeaders headers = new HttpHeaders();
            headers.add(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + encodedFilename + "\"");

            return ResponseEntity.ok()
                    .headers(headers)
                    .contentLength(excelFile.length())
                    .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                    .body(resource);

        } catch (IOException e) {
            log.error("读取文件或目录时发生IO异常: ", e);
            return ResponseEntity.internalServerError().build();
        }
    }
}