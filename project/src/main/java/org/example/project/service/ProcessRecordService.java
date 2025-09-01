package org.example.project.service;

import org.example.project.entity.ProcessRecord;
import org.example.project.entity.ProjectFile;
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
    ProjectFile findReviewSheetByRecordId(Long recordId);
    ProjectFile saveReviewSheet(Long recordId, MultipartFile file) throws IOException;
        /**
     * 转交任务给新的负责人
     * @param recordId 记录ID
     * @param newAssigneeId 新负责人的用户ID
     */
    void reassignTask(Long recordId, Long newAssigneeId);

    /**
     * 将任务打回给创建者以供修改
     * @param recordId 记录ID
     * @param comment 打回意见
     */
    void requestChanges(Long recordId, String comment);

    void resubmit(Long recordId, MultipartFile file) throws IOException;

    void deleteRecordById(Long recordId) throws IOException;

        /**
     * 【新增方法声明 1】
     * 保存草稿文件。
     * @param recordId 记录ID
     * @param file     新文件
     * @throws IOException 文件IO异常
     * @throws IllegalArgumentException 如果记录不存在
     */
    void saveDraftFile(Long recordId, MultipartFile file) throws IOException;

    /**
     * 【新增方法声明 2】
     * 启动审核流程。
     * @param recordId 记录ID
     * @throws IllegalStateException 如果当前状态不符合提交条件
     * @throws IllegalArgumentException 如果记录不存在
     */
    void startReviewProcess(Long recordId);
}