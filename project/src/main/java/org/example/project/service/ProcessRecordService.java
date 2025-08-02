package org.example.project.service;

import org.example.project.entity.ProcessRecord;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.util.List;

/**
 * 设计过程记录表相关业务逻辑的服务接口。
 */
public interface ProcessRecordService {

    /**
     * 创建一份新的设计过程记录表，并处理其关联的Excel文件。
     *
     * @param projectId      该记录表所属的项目ID。
     * @param recordMetaJson 包含记录表元数据（如零件名、工序名、规格等）的JSON字符串。
     * @param file           用户上传的、包含待检查Sheet的完整Excel文件。
     * @throws IOException 如果在文件处理过程中发生IO错误。
     */
    void createProcessRecord(Long projectId, String recordMetaJson, MultipartFile file) throws IOException;
    List<ProcessRecord> getRecordsByProjectId(Long projectId);
    ProcessRecord getRecordById(Long recordId);
    // 未来可以在这里添加其他方法，例如：
    // void updateProcessRecord(...);
    // ProcessRecord getProcessRecordById(Long recordId);
    // List<ProcessRecord> getRecordsByProjectId(Long projectId);
}