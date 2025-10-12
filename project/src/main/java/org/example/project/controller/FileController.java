package org.example.project.controller;

// --- 基础 Spring 依赖 ---
import org.example.project.dto.LuckySheetJsonDTO; // 【新增】 导入我们定义好的 Luckysheet 数据传输对象
import org.example.project.dto.StatisticsResultDTO;
import org.example.project.service.ExcelSplitterService; // 【新增】 导入我们处理Excel的核心服务
import org.example.project.service.StatisticsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource; // 【新增】: 导入 ClassPathResource
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam; // 【修改】 导入 RequestParam

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
import java.util.List; // 【新增】 用于接收List类型

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

    @Autowired
    private ExcelSplitterService excelSplitterService;

    @Value("${file.upload-dir}")
    private String uploadDir;

    // =======================================================
    //  ↓↓↓ 【新增功能】: 提供审核模板文件的API ↓↓↓
    // =======================================================
    /**
     * 【API - 获取模板】
     * 提供固定的审核表单模板文件下载。
     * @return 审核模板的Excel文件流
     */
    @GetMapping("/templates/review-sheet")
    public ResponseEntity<Resource> getReviewTemplate() {
        try {
            Resource resource = new ClassPathResource("static/templates/review_template.xlsx");

            if (resource.exists() && resource.isReadable()) {
                log.info("正在提供审核模板文件: {}", resource.getFilename());
                // 【关键修改】: 移除了 .header(HttpHeaders.CONTENT_DISPOSITION, ...)
                // 只设置 Content-Type 和 Content-Length，让浏览器将它作为普通的数据流处理。
                return ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                        .contentLength(resource.contentLength())
                        .body(resource);
            } else {
                log.error("审核模板文件 'static/templates/review_template.xlsx' 未找到！");
                return ResponseEntity.notFound().build();
            }
        } catch (Exception e) {
            log.error("获取审核模板文件时出错", e);
            return ResponseEntity.internalServerError().build();
        }
    }


    // =======================================================
    //  ↓↓↓ 【已有功能】: 你的原有代码，保持不变 ↓↓↓
    // =======================================================

    @GetMapping("/content/{fileId}")
    public ResponseEntity<?> getFileContentById(
            @PathVariable Long fileId,
            @RequestParam(name = "format", required = false) String format) { // 接收可选的 format 参数

        log.info("接收到获取文件内容的请求，文件ID: {}, 请求格式: {}", fileId, format == null ? "默认(文件流)" : format);

        try {
            // 1. 公共逻辑：查找文件记录并构建物理路径
            ProjectFile fileRecord = projectFileMapper.selectById(fileId);
            if (fileRecord == null) {
                log.warn("在数据库中找不到文件记录，ID: {}", fileId);
                return ResponseEntity.notFound().build();
            }
            Path filePath = Paths.get(uploadDir).resolve(fileRecord.getFilePath()).normalize();
            if (!Files.exists(filePath)) {
                log.error("数据库记录存在，但物理文件不存在: {}", filePath);
                return ResponseEntity.notFound().build();
            }

            // 2. 【核心判断】根据 format 参数决定执行哪个逻辑分支
            if ("json".equalsIgnoreCase(format)) {
                // --- 分支A: 用户需要JSON数据 ---
                log.info("【JSON模式】开始将文件转换为JSON: {}", filePath);
                List<LuckySheetJsonDTO.SheetData> sheets = excelSplitterService.convertExcelToLuckysheetJson(filePath.toString());
                return ResponseEntity.ok(sheets); // 直接返回JSON数据
            } else {
                // --- 分支B: 用户需要原始文件 (默认行为) ---
                log.info("【文件流模式】准备提供原始文件下载: {}", filePath);
                Resource resource = new UrlResource(filePath.toUri());
                String contentType = determineContentType(filePath, fileRecord.getFileName());
                return ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(contentType))
                        .contentLength(resource.contentLength())
                        .body(resource);
            }
        } catch (IOException e) {
            log.error("处理文件ID {} 时发生IO异常", fileId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("文件处理异常");
        } catch (Exception e) {
            log.error("处理文件ID {} 时发生未知错误", fileId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("服务器内部错误");
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

        // 注入 StatisticsService
    @Autowired
    private StatisticsService statisticsService;

    // 新增 API
    @GetMapping("/{fileId}/statistics")
    public ResponseEntity<StatisticsResultDTO> getFileStatistics(@PathVariable Long fileId) {
        StatisticsResultDTO stats = statisticsService.getSavedStats(fileId);
        return ResponseEntity.ok(stats);
    }
}