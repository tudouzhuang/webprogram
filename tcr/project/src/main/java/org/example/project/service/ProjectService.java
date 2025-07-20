package org.example.project.service;
import org.example.project.entity.ProjectFile; // 导入ProjectFile
import org.example.project.dto.ProjectCreateDTO;
import org.example.project.entity.Project;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.util.List;

/**
 * 项目服务接口，定义了与项目相关的核心业务操作。
 */
public interface ProjectService {

    /**
     * 创建一个新项目，并处理与之关联的上传文件。
     * <p>
     * 这个统一的方法会处理项目信息的保存，以及（如果提供了文件）
     * 后续的文件保存、格式转换和文件信息入库等一系列操作。
     *
     * @param createDTO 包含项目表单数据的DTO对象。
     * @param file      用户上传的Excel文件，可以为null。
     * @throws IOException          当文件保存或格式转换时发生IO错误。
     * @throws InterruptedException 当调用外部进程（如WPS或LibreOffice）被中断时。
     */
    void createProjectWithFile(ProjectCreateDTO createDTO, MultipartFile file) throws IOException, InterruptedException;
    List<Project> getAllProjects();
    List<ProjectFile> getFilesByProjectId(Long projectId);
    Project getProjectById(Long projectId); // 【新增】
    Project saveProjectInfoInTransaction(ProjectCreateDTO createDTO);
    void saveFileInfosInTransaction(List<ProjectFile> allFileRecords);
}