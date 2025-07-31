package org.example.project.service;

import org.example.project.dto.ProjectCreateDTO;
import org.example.project.entity.Project;
import org.example.project.entity.ProjectFile;
import org.springframework.web.multipart.MultipartFile;
import org.example.project.dto.ProjectFullCreateDTO; 
import java.io.IOException;
import java.util.List;

/**
 * 项目相关的核心业务逻辑接口
 */
public interface ProjectService {

    /**
     * 创建一个新项目，并处理与之关联的上传文件（包括解析并存储Sheet数据）。
     * 这是一个完整的事务性操作。
     *
     * @param createDTO 包含项目表单数据的DTO对象。
     * @param file      用户上传的Excel文件，可以为null。
     * @throws IOException 当文件I/O操作失败时。
     */
    void createProjectWithFile(ProjectCreateDTO createDTO, MultipartFile file) throws IOException;

    /**
     * 获取所有项目的列表。
     *
     * @return 包含所有项目实体的列表。
     */
    List<Project> getAllProjects();

    /**
     * 根据项目ID获取单个项目的详细信息。
     *
     * @param projectId 项目的ID。
     * @return 项目实体。
     */
    Project getProjectById(Long projectId);

    /**
     * 根据项目ID获取该项目下所有关联的原始文件记录。
     *
     * @param projectId 项目的ID。
     * @return 包含该项目所有文件信息的列表。
     */
    List<ProjectFile> getFilesByProjectId(Long projectId);
    
    // 注意：saveProjectInfoInTransaction 和 saveFileInfosInTransaction 方法已从接口中移除，
    // 因为它们是内部实现细节，不应该暴露给外部调用者。
    void uploadOrUpdateProjectFile(Long projectId, MultipartFile file, String documentType) throws IOException;
    Project createProject(ProjectCreateDTO createDTO);

   void createProjectWithFile(ProjectFullCreateDTO createDTO, MultipartFile file) throws IOException;
}