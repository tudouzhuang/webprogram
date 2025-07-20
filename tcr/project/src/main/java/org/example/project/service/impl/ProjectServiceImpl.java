package org.example.project.service.impl;

// --- 基础依赖 ---
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.apache.pdfbox.rendering.ImageType;
import org.example.project.dto.ProjectCreateDTO;
import org.example.project.entity.Project;
import org.example.project.entity.ProjectFile;
import org.example.project.mapper.ProjectFileMapper;
import org.example.project.mapper.ProjectMapper;
import org.example.project.service.ProjectService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

// --- 文件处理依赖 ---
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.stream.Collectors;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.poi.ss.usermodel.*;

@Service
public class ProjectServiceImpl implements ProjectService {

    private static final Logger log = LoggerFactory.getLogger(ProjectServiceImpl.class);
    private static final String PDF_SUBDIR = "pdfs";
    private static final String IMAGES_SUBDIR = "images";
    private static final String TEMP_SHEETS_SUBDIR = "temp_sheets";

    @Autowired
    private ProjectMapper projectMapper;

    @Autowired
    private ProjectFileMapper projectFileMapper;

    @Lazy
    @Autowired
    private ProjectService self;

    @Autowired
    @Qualifier("fileProcessingExecutor")
    private Executor fileProcessingExecutor;

    @Value("${file.upload-dir}")
    private String uploadDir;

    @Value("${libreoffice.path:libreoffice}") 
    private String libreofficeCommand;

    // =======================================================
    //  Public Methods (Implementation of ProjectService interface)
    // =======================================================

    /**
     * 创建一个新项目，并处理与之关联的上传文件。
     * 这是一个事务性操作，确保项目信息和所有文件记录要么全部成功，要么全部回滚。
     *
     * @param createDTO 包含项目表单数据的DTO对象。
     * @param file      用户上传的Excel文件，可以为null。
     * @throws IOException          当文件I/O操作失败时。
     * @throws InterruptedException 当调用外部进程（如LibreOffice）被中断时。
     */
    @Override
// 【关键修改】: 移除 @Transactional 注解，此方法现在是非事务性的总协调方法
    public void createProjectWithFile(ProjectCreateDTO createDTO, MultipartFile file) throws IOException, InterruptedException {
        // 1. 在事务外进行前置检查，更早地失败
        QueryWrapper<Project> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("project_number", createDTO.getProjectNumber());
        if (projectMapper.selectCount(queryWrapper) > 0) {
            throw new RuntimeException("项目号 '" + createDTO.getProjectNumber() + "' 已存在！");
        }

        // 2. 调用独立的事务方法来保存项目信息，这是一个短暂的事务
        // 【注意】: 确保你已经注入了自身的代理 `self`
        Project projectEntity = self.saveProjectInfoInTransaction(createDTO);
        Long newProjectId = projectEntity.getId();
        log.info("【步骤1】项目信息已保存，新项目ID为: {}", newProjectId);

        // 3. 处理文件（如果存在），这部分在事务之外执行
        if (file != null && !file.isEmpty()) {
            Path tempDir = null;
            try {
                // a. 保存原始文件并按Sheet拆分 (非数据库操作)
                File sourceExcelFile = saveOriginalFile(file, newProjectId);
                tempDir = Paths.get(uploadDir, String.valueOf(newProjectId), TEMP_SHEETS_SUBDIR);
                List<File> singleSheetExcelFiles = splitExcelByDeleting(sourceExcelFile, tempDir);
                log.info("【步骤2】发现 {} 个独立的Sheet文件，开始并行处理...", singleSheetExcelFiles.size());

                // b. 并行地进行所有耗时的文件转换，并将结果收集到内存中
                List<CompletableFuture<List<ProjectFile>>> futures = singleSheetExcelFiles.stream()
                        .map(singleSheetExcel ->
                                // 使用 supplyAsync 因为我们需要返回值 (List<ProjectFile>)
                                CompletableFuture.supplyAsync(() -> {
                                    try {
                                        // 这个方法现在只负责文件转换，不接触数据库
                                        return processSingleFileToImageRecords(singleSheetExcel, newProjectId);
                                    } catch (Exception e) {
                                        log.error("并行处理文件 {} 时发生错误", singleSheetExcel.getName(), e);
                                        return null; // 返回null表示该文件处理失败
                                    }
                                }, fileProcessingExecutor) // 使用自定义线程池
                        )
                        .collect(Collectors.toList());

                // c. 等待所有并行任务完成
                CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();

                // d. 从所有future中收集成功转换的文件记录
                List<ProjectFile> allFileRecords = futures.stream()
                        .map(CompletableFuture::join) // 获取每个任务的结果
                        .filter(Objects::nonNull)      // 过滤掉处理失败的(null)
                        .flatMap(List::stream)         // 将多个 List<ProjectFile> 合并成一个大的 List
                        .collect(Collectors.toList());

                // e. 调用独立的事务方法，将所有文件记录一次性批量保存到数据库
                if (!allFileRecords.isEmpty()) {
                    self.saveFileInfosInTransaction(allFileRecords);
                } else {
                    log.warn("所有文件处理任务均失败或未生成任何文件，没有文件记录需要保存。");
                }

            } catch (Exception e) {
                // f. 手动补偿：如果文件处理流程中发生任何无法恢复的错误，删除之前已创建的项目记录
                log.error("文件处理流程发生严重错误，将手动删除已创建的项目记录 ID: {}", newProjectId, e);
                projectMapper.deleteById(newProjectId);
                // 向上抛出异常，让Controller知道操作失败了
                throw new RuntimeException("文件处理失败，项目已回滚。", e);
            } finally {
                // g. 清理临时文件
                log.info("【清理】开始清理临时文件...");
                if (tempDir != null && Files.exists(tempDir)) {
                    try {
                        Files.walk(tempDir)
                                .sorted((p1, p2) -> -p1.compareTo(p2)) // 倒序，先删除文件再删除目录
                                .forEach(path -> {
                                    try {
                                        Files.delete(path);
                                    } catch (IOException ex) {
                                        log.error("清理文件失败: {}", path, ex);
                                    }
                                });
                    } catch (IOException ex) {
                        log.error("遍历临时目录失败: {}", tempDir, ex);
                    }
                }
                log.info("【清理】临时文件清理完毕。");
            }
        } else {
            log.warn("【Service】未提供关联文件，仅创建项目信息。");
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public void saveFileInfosInTransaction(List<ProjectFile> fileRecords) {
        if (fileRecords == null || fileRecords.isEmpty()) {
            log.warn("【步骤3】文件记录列表为空，无需执行数据库插入操作。");
            return;
        }

        log.info("【步骤3】开始在一个事务中批量插入 {} 条文件记录...", fileRecords.size());

        // 遍历列表，逐条插入。
        // 因为整个方法被 @Transactional 注解包裹，所以这些插入操作会作为一个整体的事务来执行。
        // 如果中途有任何一条插入失败，所有已插入的记录都会被回滚。
        for (ProjectFile record : fileRecords) {
            try {
                projectFileMapper.insert(record);
            } catch (Exception e) {
                log.error("插入文件记录失败: {}", record, e);
                // 向上抛出运行时异常，以触发整个事务的回滚
                throw new RuntimeException("数据库批量插入文件记录时失败", e);
            }
        }

        log.info("【步骤3】批量插入文件记录成功！");
    }

    private List<ProjectFile> processSingleFileToImageRecords(File singleSheetExcel, Long projectId) throws IOException, InterruptedException {
        log.info("线程 [{}] 开始处理文件: {}", Thread.currentThread().getName(), singleSheetExcel.getName());

        // 1. Excel -> PDF (此步骤不变)
        File pdfFile = convertExcelToPdf(singleSheetExcel);

        // 2. PDF -> PNGs, 并返回待保存的ProjectFile对象列表 (此步骤改变)
        List<ProjectFile> records = convertPdfToPngRecords(pdfFile, projectId);

        log.info("线程 [{}] 完成文件转换，生成了 {} 条文件记录: {}", Thread.currentThread().getName(), records.size(), singleSheetExcel.getName());
        return records;
    }

    private List<ProjectFile> convertPdfToPngRecords(File pdfFile, Long projectId) throws IOException {
        log.info("【4/5】准备将PDF '{}' 的所有页面转换为PNG...", pdfFile.getName());

        Path projectRootDir = pdfFile.getParentFile().getParentFile().toPath();
        Path imageDir = projectRootDir.resolve(IMAGES_SUBDIR);
        if (!Files.exists(imageDir)) {
            Files.createDirectories(imageDir);
        }

        String baseFileName = StringUtils.stripFilenameExtension(pdfFile.getName());
        List<ProjectFile> fileRecords = new ArrayList<>();

        try (PDDocument document = PDDocument.load(pdfFile)) {
            PDFRenderer pdfRenderer = new PDFRenderer(document);
            int pageCount = document.getNumberOfPages();

            for (int pageIndex = 0; pageIndex < pageCount; pageIndex++) {
                String pngFileName;
                if (pageCount > 1) {
                    pngFileName = String.format("%s_page_%d.png", baseFileName, pageIndex + 1);
                } else {
                    pngFileName = baseFileName + ".png";
                }

                File pngFile = imageDir.resolve(pngFileName).toFile();
                BufferedImage bim = pdfRenderer.renderImageWithDPI(pageIndex, 150, ImageType.RGB);
                ImageIO.write(bim, "PNG", pngFile);

                // 只创建对象，不保存
                ProjectFile projectFile = new ProjectFile();
                projectFile.setProjectId(projectId);
                projectFile.setFileName(pngFileName);
                String relativePath = Paths.get(String.valueOf(projectId), IMAGES_SUBDIR, pngFileName).toString().replace("\\", "/");
                projectFile.setFilePath(relativePath);
                projectFile.setFileType("image/png");
                fileRecords.add(projectFile);
            }
        }

        log.info("【4/5】PDF到PNG的转换完成，生成了 {} 个文件记录。", fileRecords.size());
        return fileRecords;
    }

    @Transactional(rollbackFor = Exception.class)
    public Project saveProjectInfoInTransaction(ProjectCreateDTO createDTO) {
        Project projectEntity = new Project();
        BeanUtils.copyProperties(createDTO, projectEntity);

        if (createDTO.getQuoteSize() != null) {
            projectEntity.setQuoteLength(createDTO.getQuoteSize().getLength());
            projectEntity.setQuoteWidth(createDTO.getQuoteSize().getWidth());
            projectEntity.setQuoteHeight(createDTO.getQuoteSize().getHeight());
        }
        if (createDTO.getActualSize() != null) {
            projectEntity.setActualLength(createDTO.getActualSize().getLength());
            projectEntity.setActualWidth(createDTO.getActualSize().getWidth());
            projectEntity.setActualHeight(createDTO.getActualSize().getHeight());
        }

        // ... 为非必填字段设置默认值 ...

        projectMapper.insert(projectEntity);
        return projectEntity;
    }


    private void processSingleFileAsync(File singleSheetExcel, Long projectId) {
        // 使用 try-catch 保证单个文件的失败不会影响其他并行任务
        try {
            log.info("线程 [{}] 开始处理文件: {}", Thread.currentThread().getName(), singleSheetExcel.getName());

            // 1. Excel -> PDF
            File pdfFile = convertExcelToPdf(singleSheetExcel);

            // 2. PDF -> PNGs
            convertPdfToPng(pdfFile, projectId);

            log.info("线程 [{}] 成功完成文件: {}", Thread.currentThread().getName(), singleSheetExcel.getName());

        } catch (IOException | InterruptedException e) {
            // 将 InterruptedException 转换为 RuntimeException 以便上层捕获
            Thread.currentThread().interrupt(); // 重新设置中断状态
            throw new RuntimeException("处理文件 " + singleSheetExcel.getName() + " 时中断", e);
        } catch (Exception e) {
            // 捕获其他所有可能的运行时异常
            throw new RuntimeException("处理文件 " + singleSheetExcel.getName() + " 时发生未知错误", e);
        }
    }


    /**
     * 获取所有项目的列表。
     * @return 包含所有项目实体的列表。
     */
    @Override
    public List<Project> getAllProjects() {
        log.info("【Service】正在查询所有项目列表...");
        return projectMapper.selectList(null);
    }

    /**
     * 根据项目ID获取该项目下所有关联的文件记录。
     * @param projectId 项目的ID。
     * @return 包含该项目所有文件信息的列表。
     */
    @Override
    public List<ProjectFile> getFilesByProjectId(Long projectId) {
        log.info("【Service】正在查询项目ID {} 的文件列表...", projectId);
        QueryWrapper<ProjectFile> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("project_id", projectId);
        return projectFileMapper.selectList(queryWrapper);
    }

    /**
     * 根据项目ID获取单个项目的详细信息。
     * @param projectId 项目的ID。
     * @return 项目实体。
     * @throws NoSuchElementException 如果找不到对应ID的项目。
     */
    @Override
    public Project getProjectById(Long projectId) {
        log.info("【Service】正在查询项目ID {} 的详细信息...", projectId);
        Project project = projectMapper.selectById(projectId);
        if (project == null) {
            throw new NoSuchElementException("找不到ID为 " + projectId + " 的项目");
        }
        return project;
    }

    // =======================================================
    //  Private Helper Methods for File Processing
    // =======================================================

    private File saveOriginalFile(MultipartFile file, Long projectId) throws IOException {
        String originalFilename = StringUtils.cleanPath(file.getOriginalFilename());
        Path projectUploadPath = Paths.get(uploadDir, String.valueOf(projectId));
        if (!Files.exists(projectUploadPath)) {
            Files.createDirectories(projectUploadPath);
        }
        Path sourceFilePath = projectUploadPath.resolve("source_" + originalFilename);
        Files.copy(file.getInputStream(), sourceFilePath, StandardCopyOption.REPLACE_EXISTING);
        return sourceFilePath.toFile();
    }

    private List<File> splitExcelByDeleting(File sourceExcel, Path tempDir) throws IOException {
        log.info("【2/5】开始拆分Excel为多个单Sheet文件...");
        if (!Files.exists(tempDir)) Files.createDirectories(tempDir);

        List<File> singleSheetFiles = new ArrayList<>();
        
        // 【核心修正】使用只有一个参数的 WorkbookFactory.create(File) 方法
        // 这是最标准和兼容性最好的用法。
        try (Workbook workbook = WorkbookFactory.create(sourceExcel)) {
            int totalSheets = workbook.getNumberOfSheets();
            for (int i = 0; i < totalSheets; i++) {
                // 同样，为每次循环重新打开源文件
                try (Workbook tempWorkbook = WorkbookFactory.create(sourceExcel)) {
                    if (tempWorkbook.isSheetHidden(i)) continue;

                    String sheetName = tempWorkbook.getSheetName(i);
                    String cleanSheetName = sheetName.replaceAll("[\\\\/:*?\"<>|\\s]", "_");

                    // 删除所有其他的Sheet
                    for (int j = tempWorkbook.getNumberOfSheets() - 1; j >= 0; j--) {
                        if (i != j) {
                            tempWorkbook.removeSheetAt(j);
                        }
                    }
                    
                    // 设置打印参数
                    Sheet targetSheet = tempWorkbook.getSheetAt(0);
                    PrintSetup ps = targetSheet.getPrintSetup();
                    ps.setLandscape(true);
                    ps.setFitWidth((short) 1);
                    ps.setFitHeight((short) 0);
                    targetSheet.setAutobreaks(true);
                    
                    File singleSheetFile = tempDir.resolve(cleanSheetName + ".xlsx").toFile();
                    try (FileOutputStream fos = new FileOutputStream(singleSheetFile)) {
                        tempWorkbook.write(fos);
                    }
                    singleSheetFiles.add(singleSheetFile);
                } catch (Exception e) {
                    // 增加对内部循环异常的捕获和日志记录
                    log.error("在处理第 {} 个Sheet时发生错误: {}", i, e.getMessage());
                    // 决定是继续还是抛出异常，这里选择继续处理下一个sheet
                }
            }
        } catch (Exception e) {
            log.error("打开源Excel文件失败: {}", sourceExcel.getAbsolutePath(), e);
            throw new IOException("无法打开或解析源Excel文件", e);
        }
        
        log.info("【2/5】成功拆分出 {} 个单Sheet的Excel文件。", singleSheetFiles.size());
        return singleSheetFiles;
    }

    private File convertExcelToPdf(File excelFile) throws IOException, InterruptedException {
        log.info("【3/5】开始将 {} 转换为PDF...", excelFile.getName());
        Path pdfDir = Paths.get(excelFile.getParentFile().getParent().toString(), PDF_SUBDIR);
        if (!Files.exists(pdfDir)) Files.createDirectories(pdfDir);

        String command = String.format(
                "%s --headless --convert-to pdf --outdir \"%s\" \"%s\"",
                this.libreofficeCommand,
                pdfDir.toAbsolutePath().toString(),
                excelFile.getAbsolutePath()
        );

        log.debug("执行命令: {}", command);
        Process process = Runtime.getRuntime().exec(command);

        if (!process.waitFor(2, TimeUnit.MINUTES)) {
            process.destroyForcibly();
            throw new IOException("LibreOffice转换超时: " + excelFile.getName());
        }

        if (process.exitValue() != 0) {
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getErrorStream()))) {
                StringBuilder errorOutput = new StringBuilder("LibreOffice转换失败，退出码: " + process.exitValue() + "\n");
                String line;
                while ((line = reader.readLine()) != null) errorOutput.append(line).append("\n");
                throw new IOException(errorOutput.toString());
            }
        }

        String pdfFileName = StringUtils.stripFilenameExtension(excelFile.getName()) + ".pdf";
        File pdfFile = pdfDir.resolve(pdfFileName).toFile();
        if (!pdfFile.exists() || pdfFile.length() == 0) {
            throw new IOException("LibreOffice转换成功，但生成的PDF文件为空或不存在: " + pdfFile.getAbsolutePath());
        }
        log.info("【3/5】PDF转换成功，文件位于: {}", pdfFile.getAbsolutePath());
        return pdfFile;
    }

    private List<ProjectFile> convertPdfToPng(File pdfFile, Long projectId) throws IOException {
        log.info("【4/5】准备将PDF '{}' 的所有页面转换为PNG...", pdfFile.getName());

        Path imageDir = Paths.get(pdfFile.getParentFile().getParent().toString(), IMAGES_SUBDIR);
        if (!Files.exists(imageDir)) {
            Files.createDirectories(imageDir);
        }

        String baseFileName = StringUtils.stripFilenameExtension(pdfFile.getName());
        List<ProjectFile> fileRecords = new ArrayList<>();

        try (PDDocument document = PDDocument.load(pdfFile)) {
            PDFRenderer pdfRenderer = new PDFRenderer(document);
            int pageCount = document.getNumberOfPages();

            for (int pageIndex = 0; pageIndex < pageCount; pageIndex++) {
                String pngFileName;
                if (pageCount > 1) {
                    pngFileName = String.format("%s_page_%d.png", baseFileName, pageIndex + 1);
                } else {
                    pngFileName = baseFileName + ".png";
                }

                File pngFile = imageDir.resolve(pngFileName).toFile();
                BufferedImage bim = pdfRenderer.renderImageWithDPI(pageIndex, 150, ImageType.RGB);
                ImageIO.write(bim, "PNG", pngFile);

                // 只创建对象，不保存
                ProjectFile projectFile = new ProjectFile();
                projectFile.setProjectId(projectId);
                projectFile.setFileName(pngFileName);
                String relativePath = Paths.get(String.valueOf(projectId), IMAGES_SUBDIR, pngFileName).toString().replace("\\", "/");
                projectFile.setFilePath(relativePath);
                projectFile.setFileType("image/png");
                fileRecords.add(projectFile);
            }
        }

        log.info("【4/5】PDF到PNG的转换完成，生成了 {} 个文件记录。", fileRecords.size());
        return fileRecords;
    }


}