package org.example.project.service.impl;

// --- 基础依赖 ---
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.project.dto.ProjectCreateDTO;
import org.example.project.entity.ExcelSheetData;
import org.example.project.entity.Project;
import org.example.project.entity.ProjectFile;
import org.example.project.mapper.ExcelSheetDataMapper;
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

// --- EasyExcel 依赖 ---
import com.alibaba.excel.EasyExcel;
import com.alibaba.excel.context.AnalysisContext;
import com.alibaba.excel.read.listener.ReadListener;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

@Service
public class ProjectServiceImpl implements ProjectService {

    private static final Logger log = LoggerFactory.getLogger(ProjectServiceImpl.class);

    @Autowired
    private ProjectMapper projectMapper;

    @Autowired
    private ProjectFileMapper projectFileMapper;
    
    @Autowired
    private ExcelSheetDataMapper excelSheetDataMapper; // 【新增】注入Sheet数据Mapper

    @Value("${file.upload-dir}")
    private String uploadDir;
    
    private final ObjectMapper objectMapper = new ObjectMapper(); // 用于将Map转为JSON字符串

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void createProjectWithFile(ProjectCreateDTO createDTO, MultipartFile file) throws IOException {
        
        // --- 1. 检查项目号唯一性 ---
        QueryWrapper<Project> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("project_number", createDTO.getProjectNumber());
        if (projectMapper.selectCount(queryWrapper) > 0) {
            throw new RuntimeException("项目号 '" + createDTO.getProjectNumber() + "' 已存在！");
        }

        // --- 2. 保存项目基础信息 ---
        Project projectEntity = new Project();
        BeanUtils.copyProperties(createDTO, projectEntity);
        if (createDTO.getQuoteSize() != null) { /* ... 设置尺寸 ... */ }
        if (createDTO.getActualSize() != null) { /* ... 设置尺寸 ... */ }
        projectMapper.insert(projectEntity);
        Long newProjectId = projectEntity.getId();
        log.info("【步骤1】项目信息已保存，新项目ID为: {}", newProjectId);

        // --- 3. 处理并保存关联的Excel文件 ---
        if (file != null && !file.isEmpty()) {
            // a. 保存原始Excel文件到服务器
            Path sourceFilePath = saveOriginalFile(file, newProjectId);
            
            // b. 将原始文件的信息存入 `project_files` 表
            saveProjectFileInfo(file.getOriginalFilename(), sourceFilePath, newProjectId);

            // c. 【核心重构】使用EasyExcel解析文件，并将每个Sheet的数据存入数据库
            parseAndSaveAllSheetData(sourceFilePath.toFile(), newProjectId);
        }
    }

    /**
     * 保存原始上传的Excel文件。
     */
    private Path saveOriginalFile(MultipartFile file, Long projectId) throws IOException {
        String originalFilename = StringUtils.cleanPath(file.getOriginalFilename());
        Path projectUploadPath = Paths.get(uploadDir, String.valueOf(projectId));
        if (!Files.exists(projectUploadPath)) {
            Files.createDirectories(projectUploadPath);
        }
        Path sourceFilePath = projectUploadPath.resolve("source_" + originalFilename);
        Files.copy(file.getInputStream(), sourceFilePath, StandardCopyOption.REPLACE_EXISTING);
        log.info("【步骤2a】原始Excel文件已保存至: {}", sourceFilePath);
        return sourceFilePath;
    }

    /**
     * 将原始Excel文件的元信息保存到 project_files 表。
     */
    private void saveProjectFileInfo(String originalFilename, Path sourceFilePath, Long projectId) {
        ProjectFile projectFile = new ProjectFile();
        projectFile.setProjectId(projectId);
        projectFile.setFileName("source_" + originalFilename); // 存保存后的文件名
        // 存储相对路径
        String relativePath = Paths.get(String.valueOf(projectId), "source_" + originalFilename).toString().replace("\\", "/");
        projectFile.setFilePath(relativePath);
        projectFile.setFileType(originalFilename.substring(originalFilename.lastIndexOf('.'))); // 文件类型
        projectFileMapper.insert(projectFile);
        log.info("【步骤2b】原始文件信息已存入数据库。");
    }

    /**
     * 【核心方法】使用EasyExcel解析整个Excel文件，并将所有Sheet的数据存入数据库。
     */
    private void parseAndSaveAllSheetData(File excelFile, Long projectId) {
        log.info("【步骤2c】开始使用EasyExcel解析文件并按Sheet入库: {}", excelFile.getName());
        try {
            // 创建一个监听器实例，并传入必要的参数
            SheetDataListener listener = new SheetDataListener(projectId, excelSheetDataMapper, objectMapper);
            // .doReadAll() 会自动遍历所有Sheet并读取
            EasyExcel.read(excelFile, listener).doReadAll();
        } catch (Exception e) {
            log.error("【EasyExcel】解析文件时发生严重错误", e);
            // 抛出运行时异常以触发事务回滚
            throw new RuntimeException("Excel文件解析失败", e);
        }
    }
    
    // =======================================================
    //  其他 Service 方法 (保持不变)
    // =======================================================
    
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

    @Override
    public Project getProjectById(Long projectId) {
        log.info("【Service】正在查询项目ID {} 的详细信息...", projectId);
        Project project = projectMapper.selectById(projectId);
        if (project == null) {
            throw new NoSuchElementException("找不到ID为 " + projectId + " 的项目");
        }
        return project;
    }
}

/**
 * EasyExcel的自定义读取监听器。
 * 泛型 <Map<Integer, String>> 表示每行数据都会被读取成一个Map，key是列号，value是单元格的字符串值。
 */
class SheetDataListener implements ReadListener<Map<Integer, String>> {

    private static final Logger log = LoggerFactory.getLogger(SheetDataListener.class);
    
    private final Long projectId;
    private final ExcelSheetDataMapper mapper;
    private final ObjectMapper objectMapper;

    public SheetDataListener(Long projectId, ExcelSheetDataMapper mapper, ObjectMapper objectMapper) {
        this.projectId = projectId;
        this.mapper = mapper;
        this.objectMapper = objectMapper;
    }

    /**
     * 每读取到一行数据，这个方法就会被调用一次。
     */
    @Override
    public void invoke(Map<Integer, String> data, AnalysisContext context) {
        // data.isEmpty() 检查是否为空行
        if (data == null || data.isEmpty()) {
            return;
        }
        
        String sheetName = context.readSheetHolder().getSheetName();
        Integer rowIndex = context.readRowHolder().getRowIndex();
        
        try {
            // 将Map格式的行数据转换为JSON字符串
            String rowDataJson = objectMapper.writeValueAsString(data);
            
            ExcelSheetData sheetData = new ExcelSheetData();
            sheetData.setProjectId(projectId);
            sheetData.setSheetName(sheetName);
            sheetData.setRowIndex(rowIndex);
            sheetData.setRowDataJson(rowDataJson);
            
            // 插入数据库
            mapper.insert(sheetData);
        } catch (JsonProcessingException e) {
            log.error("【Listener】在Sheet '{}', 行 {} 转换JSON失败", sheetName, rowIndex, e);
        } catch (Exception e) {
            log.error("【Listener】在Sheet '{}', 行 {} 插入数据库失败", sheetName, rowIndex, e);
        }
    }

    /**
     * 所有数据解析完成后，这个方法会被调用。
     */
    @Override
    public void doAfterAllAnalysed(AnalysisContext context) {
        log.info("【Listener】文件所有Sheet的数据已成功解析并处理完毕。");
    }
}