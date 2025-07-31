package org.example.project.service.impl;

// --- 基础 Spring 和 DTO/Entity/Mapper 依赖 ---
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.example.project.dto.ProcessRecordCreateDTO;
import org.example.project.entity.ProcessRecord;
import org.example.project.entity.ProjectFile;
import org.example.project.mapper.ProcessRecordMapper;
import org.example.project.mapper.ProjectFileMapper;
import org.example.project.service.ExcelSplitterService;
import org.example.project.service.ProcessRecordService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

// --- Java IO 和 NIO 依赖 ---
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;

/**
 * ProcessRecordService 的实现类。
 */
@Service
public class ProcessRecordServiceImpl implements ProcessRecordService {

    private static final Logger log = LoggerFactory.getLogger(ProcessRecordServiceImpl.class);

    // 【优化】: 定义文件类型常量，避免硬编码字符串，防止拼写错误
    private static final String DOC_TYPE_PROCESS_RECORD_SHEET = "PROCESS_RECORD_SHEET";

    @Autowired
    private ProcessRecordMapper processRecordMapper;

    @Autowired
    private ProjectFileMapper projectFileMapper;

    @Autowired
    private ExcelSplitterService excelSplitterService;

    @Value("${file.upload-dir}")
    private String uploadDir;

    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void createProcessRecord(Long projectId, String recordMetaJson, MultipartFile file) throws IOException {
        
        // --- 步骤 1: 解析元数据 ---
        log.info("【ProcessRecordService】开始创建新的过程记录表，项目ID: {}", projectId);
        ProcessRecordCreateDTO createDTO = objectMapper.readValue(recordMetaJson, ProcessRecordCreateDTO.class);
        
        // --- 步骤 2: 创建主记录 ---
        ProcessRecord record = new ProcessRecord();
        record.setProjectId(projectId);
        record.setPartName(createDTO.getPartName());
        record.setProcessName(createDTO.getProcessName());
        // record.setCreatedByUserId(...); // TODO: 从Spring Security获取当前登录用户ID
        record.setSpecificationsJson(objectMapper.writeValueAsString(createDTO));
        
        processRecordMapper.insert(record);
        Long newRecordId = record.getId();
        log.info("【ProcessRecordService】过程记录表主信息已保存，新记录ID: {}", newRecordId);

        // --- 步骤 3: 处理关联文件 ---
        if (file != null && !file.isEmpty()) {
            // a. 保存原始文件
            Path sourceFilePath = saveOriginalFile(file, projectId, newRecordId);

            // b. 拆分文件
            String splitOutputDirPath = Paths.get(uploadDir, String.valueOf(projectId), String.valueOf(newRecordId), "split_output").toString();
            List<File> splitFiles = excelSplitterService.splitExcel(sourceFilePath.toFile(), splitOutputDirPath);

            // c. 过滤并保存用户选择的Sheet文件信息
            for (File splitFile : splitFiles) {
                String sheetName = splitFile.getName().replaceAll("\\.xlsx$", "");
                
                if (createDTO.getSelectedSheets().contains(sheetName)) {
                    ProjectFile projectFile = new ProjectFile();
                    projectFile.setProjectId(projectId);
                    projectFile.setRecordId(newRecordId);
                    projectFile.setFileName(splitFile.getName());
                    String relativePath = Paths.get(String.valueOf(projectId), String.valueOf(newRecordId), "split_output", splitFile.getName()).toString().replace("\\", "/");
                    projectFile.setFilePath(relativePath);
                    projectFile.setFileType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
                    
                    // =======================================================
                    //  ↓↓↓ 【核心优化】: 在这里明确设置 documentType ↓↓↓
                    // =======================================================
                    projectFile.setDocumentType(DOC_TYPE_PROCESS_RECORD_SHEET);
                    
                    projectFileMapper.insert(projectFile);
                    log.info("【ProcessRecordService】已将拆分文件 '{}' (类型: {}) 信息存入数据库。", splitFile.getName(), DOC_TYPE_PROCESS_RECORD_SHEET);
                } else {
                     log.info("【ProcessRecordService】跳过未被用户选择的拆分文件 '{}'。", splitFile.getName());
                }
            }
        } else {
            log.warn("【ProcessRecordService】未提供关联的Excel文件。");
        }
    }

    /**
     * 辅助方法：将上传的原始文件保存到服务器磁盘。
     */
    private Path saveOriginalFile(MultipartFile file, Long projectId, Long recordId) throws IOException {
        String originalFilename = StringUtils.cleanPath(file.getOriginalFilename());
        Path recordUploadPath = Paths.get(uploadDir, String.valueOf(projectId), String.valueOf(recordId));
        if (!Files.exists(recordUploadPath)) {
            Files.createDirectories(recordUploadPath);
        }
        Path sourceFilePath = recordUploadPath.resolve("source_" + originalFilename);
        Files.copy(file.getInputStream(), sourceFilePath, StandardCopyOption.REPLACE_EXISTING);
        log.info("【ProcessRecordService】原始Excel文件已保存至: {}", sourceFilePath);
        return sourceFilePath;
    }
}