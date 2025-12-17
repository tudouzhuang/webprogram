package org.example.project.controller;

// --- 基础 Spring 依赖 ---
import org.example.project.dto.LuckySheetJsonDTO;
import org.example.project.dto.StatisticsResultDTO;
import org.example.project.service.ExcelSplitterService;
import org.example.project.service.ProcessRecordService; // 【新增】导入 ProcessRecordService
import org.example.project.service.StatisticsService;
import org.example.project.service.impl.NativeExcelSplitterServiceImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.core.io.ByteArrayResource; // 【新增】用于返回内存中的文件流
// --- 日志、实体和Mapper依赖 ---
import org.example.project.entity.ProjectFile;
import org.example.project.mapper.ProjectFileMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

// --- Java IO 和 NIO 依赖 ---
import java.io.File;
import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 文件控制器 (File Controller) 负责处理所有与文件获取、下载、预览相关的API请求。
 */
@RestController
@RequestMapping("/api/files")
public class FileController {

    private static final Logger log = LoggerFactory.getLogger(FileController.class);

    @Autowired
    private ProjectFileMapper projectFileMapper;

    @Autowired
    private ExcelSplitterService excelSplitterService;

    @Autowired
    private StatisticsService statisticsService;

    @Autowired
    private NativeExcelSplitterServiceImpl nativeSplitterService;
    // 【新增】注入 ProcessRecordService，用于处理自动填充逻辑
    @Autowired
    private ProcessRecordService processRecordService;

    @Value("${file.upload-dir}")
    private String uploadDir;

    // =======================================================
    //  ↓↓↓ 【新增功能】: 提供审核模板文件的API ↓↓↓
    // =======================================================
    @GetMapping("/templates/review-sheet")
    public ResponseEntity<Resource> getReviewTemplate() {
        try {
            Resource resource = new ClassPathResource("static/templates/review_template.xlsx");

            if (resource.exists() && resource.isReadable()) {
                log.info("正在提供审核模板文件: {}", resource.getFilename());
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
    //  ↓↓↓ 【已有功能】: 获取文件内容 (核心修改点) ↓↓↓
    // =======================================================
    @GetMapping("/content/{fileId}")
    public ResponseEntity<?> getFileContentById(
            @PathVariable Long fileId,
            @RequestParam(name = "format", required = false) String format) {

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

            // 2. 根据 format 参数决定执行哪个逻辑分支
            if ("json".equalsIgnoreCase(format)) {
                // --- 分支A: 用户需要JSON数据 (前端已弃用此分支，但为了兼容性保留) ---
                log.info("【JSON模式】开始将文件转换为JSON: {}", filePath);
                List<LuckySheetJsonDTO.SheetData> sheets = excelSplitterService.convertExcelToLuckysheetJson(filePath.toString());
                // 旧的自动填充入口 (现已转移到下方文件流模式)
                if (fileRecord.getFileName().contains("设计重大风险排查表")) {
                    processRecordService.autoFillRiskSheetData(fileRecord.getRecordId(), sheets);
                }
                return ResponseEntity.ok(sheets);

            } else {
                // --- 分支B: 用户需要原始文件 (Luckysheet 前端解析模式) ---
                log.info("【文件流模式】准备处理文件: {}", fileRecord.getFileName());

                // =================================================================================
                // 【核心修改】: 拦截“设计重大风险排查表”，进行动态 POI 处理
                // =================================================================================
                if (fileRecord.getFileName().contains("设计重大风险排查表")) {
                    log.info(">>> 拦截到风险表流请求，执行 POI 动态注入...");
                    try {
                        // 1. 调用 Service 方法，获取经过修改（自动填充）后的文件字节流
                        byte[] modifiedBytes = processRecordService.processRiskSheetStream(fileId);

                        // 2. 返回内存中的流，而不是磁盘文件
                        return ResponseEntity.ok()
                                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                                .contentLength(modifiedBytes.length)
                                .body(new ByteArrayResource(modifiedBytes));
                    } catch (Exception e) {
                        log.error("POI 动态注入失败，降级返回原文件", e);
                        // 如果注入失败，不抛出错误，而是继续向下执行，返回磁盘上的原始文件作为兜底
                    }
                }
                // =================================================================================

                log.info("【文件流模式】提供原始文件下载: {}", filePath);
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

    // determineContentType 方法保持原样
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

    // 新增 API
    @GetMapping("/{fileId}/statistics")
    public ResponseEntity<StatisticsResultDTO> getFileStatistics(@PathVariable Long fileId) {
        StatisticsResultDTO stats = statisticsService.getSavedStats(fileId);
        return ResponseEntity.ok(stats);
    }

// =======================================================
    //  ↓↓↓ 【修复版】异步分割接口 ↓↓↓
    // =======================================================
    @PostMapping("/{fileId}/split-by-sheet")
    public ResponseEntity<?> splitBySheet(@PathVariable("fileId") Long fileId) {
        log.info("收到大文件分割请求: fileId={}", fileId);

        // 1. 基础校验 & 路径准备
        ProjectFile fileRecord = projectFileMapper.selectById(fileId);
        if (fileRecord == null) {
            return ResponseEntity.badRequest().body("数据库中找不到该文件记录");
        }

        File uploadRootDir = new File(uploadDir);
        File sourceFile = new File(uploadRootDir, fileRecord.getFilePath());
        if (!sourceFile.exists()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("服务器上找不到物理文件");
        }

        // 准备输出目录
        Path relativeParentPath = Paths.get(fileRecord.getFilePath()).getParent();
        Path relativeOutputDirPath = relativeParentPath.resolve("split_output");
        File outputDirFile = new File(sourceFile.getParent(), "split_output");

        // 2. 【核心】启动异步线程 (Fire-and-Forget)
        // 这样前端请求会立刻得到 200 OK，不会超时
        new Thread(() -> {
            try {
                log.info("【异步任务】开始处理文件: {}", fileId);

                // A. 调用 Service 执行分割 (传入 fileId 用于更新进度)
                nativeSplitterService.splitExcelAsync(
                        fileId,
                        sourceFile.getAbsolutePath(),
                        outputDirFile.getAbsolutePath()
                );

                // B. 分割完成，扫描文件并入库
                File[] splitFiles = outputDirFile.listFiles((dir, name) -> name.toLowerCase().endsWith(".xlsx"));

                if (splitFiles != null && splitFiles.length > 0) {
                    int count = 0;
                    for (File f : splitFiles) {
                        String fileName = f.getName();
                        String newRelativePath = relativeOutputDirPath.resolve(fileName).toString().replace("\\", "/");

                        ProjectFile newFile = new ProjectFile();
                        newFile.setProjectId(fileRecord.getProjectId());
                        newFile.setRecordId(fileRecord.getRecordId());
                        newFile.setFileName(fileName);
                        newFile.setFilePath(newRelativePath);
                        newFile.setFileType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
                        newFile.setDocumentType("SPLIT_CHILD_SHEET");
                        newFile.setParentId(fileId); // 关联父ID

                        projectFileMapper.insert(newFile);
                        count++;
                    }
                    log.info("【异步任务】数据库已同步 {} 个子文件记录", count);
                }

                // C. 全部搞定，将进度置为 100%
                NativeExcelSplitterServiceImpl.PROGRESS_MAP.put(fileId, 100);
                log.info("【异步任务】文件 {} 处理完毕", fileId);

            } catch (Exception e) {
                log.error("【异步任务】出错", e);
                // 标记失败，让前端停止轮询并报错
                NativeExcelSplitterServiceImpl.PROGRESS_MAP.put(fileId, -1);
            }
        }).start();

        // 3. 主线程立刻返回
        return ResponseEntity.ok("任务已启动，请轮询进度");
    }

    @GetMapping("/{fileId}/split-progress")
    public ResponseEntity<Map<String, Object>> getSplitProgress(@PathVariable("fileId") Long fileId) {
        Map<String, Object> result = new HashMap<>();

        Integer progress = NativeExcelSplitterServiceImpl.PROGRESS_MAP.getOrDefault(fileId, 0);
        result.put("progress", progress);

        // 【核心】获取跳过的 Sheet 列表
        List<String> skippedSheets = NativeExcelSplitterServiceImpl.SKIPPED_SHEETS_MAP.get(fileId);
        if (skippedSheets != null && !skippedSheets.isEmpty()) {
            result.put("skipped_sheets", skippedSheets); // 返回列表
        }

        return ResponseEntity.ok(result);
    }

}
