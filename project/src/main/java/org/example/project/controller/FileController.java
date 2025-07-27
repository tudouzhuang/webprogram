package org.example.project.controller;

// --- 基础 Spring 依赖 ---
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource; // 【修改】: 引入 UrlResource
import org.springframework.http.HttpHeaders;   // 【新增】: 引入 HttpHeaders
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
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
import java.io.IOException;
import java.net.MalformedURLException;
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

        try {
            // 【修改】: 增加 .normalize() 来处理路径安全问题
            Path filePath = Paths.get(uploadDir).resolve(fileRecord.getFilePath()).normalize();
            log.info("准备从物理路径读取文件: {}", filePath);

            // 【修改】: 使用 UrlResource 代替 InputStreamResource
            Resource resource = new UrlResource(filePath.toUri());

            if (!resource.exists() || !resource.isReadable()) {
                log.error("数据库记录存在，但物理文件不存在或不可读: {}", filePath);
                return ResponseEntity.notFound().build();
            }

            String contentType = determineContentType(filePath, fileRecord.getFileName());
            log.info("确定文件 {} 的 Content-Type 为: {}", fileRecord.getFileName(), contentType);

            // 【核心修改】: 移除 attachment 头，改为 inline 头，更适合预览场景
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .contentLength(resource.contentLength())
                    // "inline" 建议浏览器在页面内预览文件，而不是触发下载
                    // "filename" 提供了文件的原始名称，增强了兼容性
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + fileRecord.getFileName() + "\"")
                    .body(resource);

        } catch (MalformedURLException e) {
             log.error("创建文件路径URL时出错, fileId: {}", fileId, e);
             return ResponseEntity.badRequest().build();
        } catch (IOException e) {
            log.error("读取文件ID {} 时发生IO异常", fileId, e);
            return ResponseEntity.internalServerError().build();
        }
    }
    
    // determineContentType 方法保持原样，它已经非常完善
    private String determineContentType(Path path, String fileName) {
        try {
            String probedType = Files.probeContentType(path);
            if (probedType != null) {
                return probedType;
            }
        } catch (IOException e) {
            log.warn("使用 Files.probeContentType 探测文件 '{}' 类型失败，将回退到基于后缀名的判断。", fileName, e);
        }

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
        
        return "application/octet-stream";
    }
        @DeleteMapping("/{fileId}")
    public ResponseEntity<String> deleteFile(@PathVariable Long fileId) {
        log.info("接收到删除文件的请求，文件ID: {}", fileId);
        try {
            // 我们需要一个 Service 方法来处理删除逻辑
            // 为了保持Controller的简洁，我们假设有一个 fileService
            // fileService.deleteFileById(fileId);
            // 或者，我们暂时可以直接在这里实现逻辑
            
            // 1. 从数据库查找文件记录
            ProjectFile fileRecord = projectFileMapper.selectById(fileId);
            if (fileRecord == null) {
                return ResponseEntity.notFound().build();
            }

            // 2. 删除物理文件
            Path filePath = Paths.get(uploadDir, fileRecord.getFilePath());
            try {
                Files.deleteIfExists(filePath);
                log.info("成功删除物理文件: {}", filePath);
            } catch (IOException e) {
                // 即使物理文件删除失败，也继续删除数据库记录，但要记录错误
                log.error("删除物理文件失败: {}", filePath, e);
            }
            
            // 3. 从数据库删除记录
            projectFileMapper.deleteById(fileId);
            log.info("成功从数据库删除文件记录, ID: {}", fileId);

            return ResponseEntity.ok("文件删除成功");

        } catch (Exception e) {
            log.error("删除文件ID {} 时发生未知错误", fileId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("删除文件时发生服务器内部错误。");
        }
    }
}