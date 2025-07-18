package org.example.project.service.impl;

// --- 基础依赖 ---
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
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
import java.util.concurrent.TimeUnit;
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
    @Transactional(rollbackFor = Exception.class)
    public void createProjectWithFile(ProjectCreateDTO createDTO, MultipartFile file) throws IOException, InterruptedException {
        // 1. 检查项目号是否重复
        QueryWrapper<Project> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("project_number", createDTO.getProjectNumber());
        if (projectMapper.selectCount(queryWrapper) > 0) {
            throw new RuntimeException("项目号 '" + createDTO.getProjectNumber() + "' 已存在！");
        }
        
        // 2. 数据转换与实体准备
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
        
        // 3. 保存项目基础信息到数据库
        projectMapper.insert(projectEntity);
        Long newProjectId = projectEntity.getId();
        log.info("【1/5】项目信息已保存，新项目ID为: {}", newProjectId);
        
        // 4. 处理并保存关联的Excel文件
        if (file != null && !file.isEmpty()) {
            Path tempDir = null;
            try {
                File sourceExcelFile = saveOriginalFile(file, newProjectId);
                tempDir = Paths.get(uploadDir, String.valueOf(newProjectId), TEMP_SHEETS_SUBDIR);
                List<File> singleSheetExcelFiles = splitExcelByDeleting(sourceExcelFile, tempDir);
                
                for (File singleSheetExcel : singleSheetExcelFiles) {
                    File pdfFile = convertExcelToPdf(singleSheetExcel);
                    File pngFile = convertPdfToPng(pdfFile);
                    saveFileInfoToDb(pngFile, newProjectId);
                }
            } catch (Exception e) {
                log.error("【Service】在处理项目ID {} 的文件时发生严重错误，将回滚事务。", newProjectId, e);
                throw new RuntimeException("文件处理失败，数据库操作已回滚。", e);
            } finally {
                // 无论成功失败，都清理所有临时文件
                log.info("【清理】开始清理临时文件...");
                if (tempDir != null && Files.exists(tempDir)) {
                    Files.walk(tempDir)
                         .sorted((p1, p2) -> -p1.compareTo(p2))
                         .forEach(path -> {
                             try { Files.delete(path); } catch (IOException e) { log.error("清理文件失败: {}", path, e); }
                         });
                }
                log.info("【清理】临时文件清理完毕。");
            }
        } else {
            log.warn("【Service】未提供关联文件，仅创建项目信息。");
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

    private File convertPdfToPng(File pdfFile) throws IOException {
        log.info("【4/5】开始将 {} 转换为PNG...", pdfFile.getName());
        Path imageDir = Paths.get(pdfFile.getParentFile().getParent().toString(), IMAGES_SUBDIR);
        if (!Files.exists(imageDir)) Files.createDirectories(imageDir);

        String pngFileName = StringUtils.stripFilenameExtension(pdfFile.getName()) + ".png";
        File pngFile = imageDir.resolve(pngFileName).toFile();

        try (PDDocument document = PDDocument.load(pdfFile)) {
            PDFRenderer pdfRenderer = new PDFRenderer(document);
            BufferedImage bim = pdfRenderer.renderImageWithDPI(0, 150);
            ImageIO.write(bim, "PNG", pngFile);
        }
        log.info("【4/5】PNG转换成功，文件位于: {}", pngFile.getAbsolutePath());
        return pngFile;
    }

    private void saveFileInfoToDb(File pngFile, Long projectId) {
        log.info("【5/5】正在将文件 {} 的信息保存到数据库...", pngFile.getName());
        ProjectFile projectFile = new ProjectFile();
        projectFile.setProjectId(projectId);
        projectFile.setFileName(pngFile.getName());
        String relativePath = Paths.get(String.valueOf(projectId), IMAGES_SUBDIR, pngFile.getName()).toString().replace("\\", "/");
        projectFile.setFilePath(relativePath);
        projectFile.setFileType("image/png");
        projectFileMapper.insert(projectFile);
        log.info("【5/5】文件信息保存成功。");
    }
}