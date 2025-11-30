package org.example.project.service;

import org.example.project.dto.LuckySheetJsonDTO; // 【新增】引入 DTO
import org.example.project.entity.ProcessRecord;
import org.example.project.entity.ProjectFile;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.util.List;
import java.util.Map;

/**
 * 设计过程记录表相关业务逻辑的服务接口。
 */
public interface ProcessRecordService {

    List<ProcessRecord> getRecordsByProjectId(Long projectId);
    ProcessRecord getRecordById(Long recordId);
    ProjectFile findReviewSheetByRecordId(Long recordId);
    ProjectFile saveReviewSheet(Long recordId, MultipartFile file) throws IOException;
    
    void reassignTask(Long recordId, Long newAssigneeId);

    void requestChanges(Long recordId, String comment);
    void approveRecord(Long recordId);

    void resubmit(Long recordId, MultipartFile file) throws IOException;

    void deleteRecordById(Long recordId) throws IOException;
    
    void updateAssociatedFile(Long recordId, Long fileId, MultipartFile file) throws IOException;

    void startReviewProcess(Long recordId);
    /**
     * 【新增】自动填充重大风险清单数据
     * 该方法会读取同项目下其他文件的统计结论（OK/NG），并自动填入到风险清单的对应单元格中。
     *
     * @param recordId 当前过程记录ID
     * @param sheets   Luckysheet 的数据对象（引用传递，直接修改该对象）
     */
    void autoFillRiskSheetData(Long recordId, List<LuckySheetJsonDTO.SheetData> sheets);
    byte[] processRiskSheetStream(Long fileId) throws IOException;
}