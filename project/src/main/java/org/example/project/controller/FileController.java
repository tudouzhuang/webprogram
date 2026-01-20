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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

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
            // 1. 从数据库查找主文件记录
            ProjectFile fileRecord = projectFileMapper.selectById(fileId);
            if (fileRecord == null) {
                return ResponseEntity.notFound().build();
            }

            // =========================================================
            // 【核心新增 1】：直接删除该文件专属的 split_output_ID 目录
            // =========================================================
            // 因为我们在 splitBySheet 里是这样创建的：split_output_ + fileId
            // 所以删除时，直接把这个文件夹整个端掉，既快又干净，不用担心误删别人的
            try {
                Path splitOutputDir = Paths.get(uploadDir, fileRecord.getFilePath()).getParent().resolve("split_output_" + fileId);
                deleteDirectory(splitOutputDir); // 调用下方的辅助方法
                log.info("已清理关联的分割目录: {}", splitOutputDir);
            } catch (Exception e) {
                log.warn("清理分割目录失败 (可能不存在): {}", e.getMessage());
            }

            // =========================================================
            // 【核心新增 2】：级联删除数据库中的子文件记录 (防止脏数据)
            // =========================================================
            // 就算物理文件删了，数据库里的子记录也得删
            try {
                // 如果你还没在 Mapper 加 selectByParentId，请务必加上，或者用 MyBatis-Plus 的 Wrapper
                List<ProjectFile> children = projectFileMapper.selectByParentId(fileId);
                if (children != null && !children.isEmpty()) {
                    for (ProjectFile child : children) {
                        projectFileMapper.deleteById(child.getId());
                    }
                    log.info("级联删除了 {} 条子文件数据库记录", children.size());
                }
            } catch (Exception e) {
                log.warn("级联删除数据库记录时出错 (可能是 Mapper 方法未定义): {}", e.getMessage());
            }

            // 2. 删除主文件的物理文件
            Path filePath = Paths.get(uploadDir, fileRecord.getFilePath());
            Files.deleteIfExists(filePath);

            // 3. 从数据库删除主文件记录
            projectFileMapper.deleteById(fileId);
            
            return ResponseEntity.ok("文件及关联数据删除成功");

        } catch (Exception e) {
            log.error("删除文件ID {} 时发生未知错误", fileId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("删除失败: " + e.getMessage());
        }
    }
    /**
     * 【新增】递归删除目录及其内容
     */
    private void deleteDirectory(Path path) throws IOException {
        if (Files.exists(path)) {
            Files.walk(path)
                .sorted(java.util.Comparator.reverseOrder()) // 倒序遍历：先删文件，再删文件夹
                .map(Path::toFile)
                .forEach(File::delete);
        }
    }

    // 新增 API
    @GetMapping("/{fileId}/statistics")
    public ResponseEntity<StatisticsResultDTO> getFileStatistics(@PathVariable Long fileId) {
        StatisticsResultDTO stats = statisticsService.getSavedStats(fileId);
        return ResponseEntity.ok(stats);
    }

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

        // 【核心修改】使用 "split_output_" + fileId 作为独立目录，物理隔离不同文件的子Sheet
        File outputDirFile = new File(sourceFile.getParent(), "split_output_" + fileId);
        if (!outputDirFile.exists()) {
            outputDirFile.mkdirs();
        }

        // =======================================================
        // 【核心修复 1】同步重置状态 (必须在主线程！)
        // =======================================================
        // 防止异步线程还没启动，前端轮询就读到了上一次的残留状态
        nativeSplitterService.resetProgress(fileId);

        // =======================================================
        // 【核心修复 2】使用 CompletableFuture 启动异步任务
        // =======================================================
        CompletableFuture.runAsync(() -> {
            try {
                log.info("【异步任务】开始处理文件: {}", fileId);

                // A. 调用 Service 执行 VBS 分割
                nativeSplitterService.splitExcelAsync(
                        fileId,
                        sourceFile.getAbsolutePath(),
                        outputDirFile.getAbsolutePath()
                );

                // 手动更新进度到 98%
                NativeExcelSplitterServiceImpl.PROGRESS_MAP.put(fileId, 98);

                // B. 扫描文件并批量入库
                File[] splitFiles = outputDirFile.listFiles((dir, name) -> name.toLowerCase().endsWith(".xlsx"));

                if (splitFiles != null && splitFiles.length > 0) {
                    List<ProjectFile> batchList = new ArrayList<>(splitFiles.length);
                    Path relativeParentPath = Paths.get(fileRecord.getFilePath()).getParent();
                    Path relativeOutputDirPath = relativeParentPath.resolve("split_output_" + fileId);

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
                        newFile.setParentId(fileId);
                        
                        // 【修复点 1】先把这行注释掉，除非你在 ProjectFile 实体里加了 fileSize 字段
                        // newFile.setFileSize(f.length()); 

                        batchList.add(newFile);
                    }

                    // 【修复点 2】把 batchList.length 改为 batchList.size()
                    log.info("【异步任务】正在批量入库 {} 个文件...", batchList.size());
                    
                    for (ProjectFile pf : batchList) {
                        projectFileMapper.insert(pf);
                    }
                    
                    log.info("【异步任务】数据库同步完成");
                }

                // C. 流程结束
                NativeExcelSplitterServiceImpl.PROGRESS_MAP.put(fileId, 100);
                log.info("【异步任务】流程全部结束 ID={}", fileId);
                NativeExcelSplitterServiceImpl.STATUS_MESSAGE_MAP.put(fileId, "流程全部结束");

            } catch (Exception e) {
                log.error("【异步任务】异常中断", e);
                String msg = "处理失败: " + e.getMessage();
                NativeExcelSplitterServiceImpl.ERROR_MESSAGE_MAP.put(fileId, msg);
                NativeExcelSplitterServiceImpl.PROGRESS_MAP.put(fileId, -1);
            }
        });
        return ResponseEntity.ok("任务已启动");
    }

@GetMapping("/{fileId}/split-progress")
    public ResponseEntity<Map<String, Object>> getSplitProgress(@PathVariable Long fileId) {
        // 打印日志，确认接口被调用
        // System.out.println("【Debug】正在处理进度查询 ID: " + fileId);

        Map<String, Object> response = new HashMap<>();

        // 1. 获取进度数字
        Integer progress = NativeExcelSplitterServiceImpl.PROGRESS_MAP.getOrDefault(fileId, 0);
        response.put("progress", progress);

        // =======================================================
        // 🔥【核心修复】获取状态文字 (这是前端判定完成的关键) 🔥
        // =======================================================
        // 从 Service 刚才定义的 STATUS_MESSAGE_MAP 中取出 "流程全部结束" 这类文字
        String statusMsg = NativeExcelSplitterServiceImpl.STATUS_MESSAGE_MAP.get(fileId);
        
        // 放入响应中，前端通过 data.message 读取
        response.put("message", statusMsg != null ? statusMsg : ""); 

        // 3. 获取跳过列表
        List<String> skipped = NativeExcelSplitterServiceImpl.SKIPPED_SHEETS_MAP.get(fileId);
        if (skipped != null) {
            response.put("skipped_sheets", skipped);
        }

        // 4. 处理错误情况
        if (progress == -1) {
            // 从 Service 的 ERROR_MESSAGE_MAP 中取出报错原因
            String errorMsg = NativeExcelSplitterServiceImpl.ERROR_MESSAGE_MAP.get(fileId);

            // 如果取不到，给一个默认值
            if (errorMsg == null || errorMsg.isEmpty()) {
                errorMsg = "后端未返回具体错误原因 (Map为空)";
            }

            // 放入响应
            response.put("errorMessage", errorMsg);

            // 打印日志确认后端拿到了错误
            System.err.println("【Debug Controller】发现错误状态，返回消息: " + errorMsg);
        }

        return ResponseEntity.ok(response);
    }
}
