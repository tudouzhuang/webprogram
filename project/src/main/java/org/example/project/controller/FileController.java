package org.example.project.controller;

// --- 基础 Spring 依赖 ---
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// --- 日志、实体和Mapper依赖 ---
import org.example.project.entity.ProjectFile;
import org.example.project.mapper.ProjectFileMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

// --- Java IO 和 NIO 依赖 ---
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * 文件控制器 (File Controller)
 * 负责处理所有与文件获取、下载、预览相关的API请求。
 */
@RestController
@RequestMapping("/api/files")
public class FileController {

    private static final Logger log = LoggerFactory.getLogger(FileController.class);

    @Autowired
    private ProjectFileMapper projectFileMapper;

    @Value("${file.upload-dir}")
    private String uploadDir;

    @GetMapping("/content/{fileId}")
    public ResponseEntity<Resource> getFileStreamById(@PathVariable Long fileId) {
        log.info("接收到获取文件内容的请求，文件ID: {}", fileId);

        ProjectFile fileRecord = projectFileMapper.selectById(fileId);
        if (fileRecord == null) {
            log.warn("在数据库中找不到文件记录，ID: {}", fileId);
            return ResponseEntity.notFound().build();
        }

        Path filePath = Paths.get(uploadDir, fileRecord.getFilePath());
        File file = filePath.toFile();
        log.info("准备从物理路径读取文件: {}", file.getAbsolutePath());

        if (!file.exists() || !file.canRead()) {
            log.error("数据库记录存在，但物理文件不存在或不可读: {}", filePath);
            return ResponseEntity.notFound().build();
        }

        try {
            InputStreamResource resource = new InputStreamResource(new FileInputStream(file));

            String contentType = determineContentType(filePath, fileRecord.getFileName());
            log.info("确定文件 {} 的 Content-Type 为: {}", fileRecord.getFileName(), contentType);

            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .contentLength(file.length())
                    .body(resource);

        } catch (IOException e) {
            log.error("读取文件ID {} 时发生IO异常", fileId, e);
            return ResponseEntity.internalServerError().build();
        }
    }
    

    private String determineContentType(Path path, String fileName) {
        // 优先使用Java NIO进行内容探测，因为它更准确
        try {
            String probedType = Files.probeContentType(path);
            if (probedType != null) {
                return probedType;
            }
        } catch (IOException e) {
            log.warn("使用 Files.probeContentType 探测文件 '{}' 类型失败，将回退到基于后缀名的判断。", fileName, e);
        }

        // 如果探测失败，使用基于文件后缀名的备选方案
        if (fileName != null) {
            String lowerCaseFileName = fileName.toLowerCase();
            if (lowerCaseFileName.endsWith(".xlsx")) {
                return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            } else if (lowerCaseFileName.endsWith(".xls")) {
                return "application/vnd.ms-excel";
            } else if (lowerCaseFileName.endsWith(".pdf")) {
                return "application/pdf";
            } else if (lowerCaseFileName.endsWith(".png")) {
                return "image/png";
            } else if (lowerCaseFileName.endsWith(".jpg") || lowerCaseFileName.endsWith(".jpeg")) {
                return "image/jpeg";
            }
        }
        
        // 如果都失败了，返回一个通用的二进制流类型，让axios自行处理
        return "application/octet-stream";
    }
}