package org.example.project.service;

import org.example.project.dto.ProjectCreateDTO;
import org.springframework.web.multipart.MultipartFile; // 导入
import java.io.IOException; // 导入

public interface ProjectService {

    void createProject(ProjectCreateDTO createDTO);

    // 【新增】声明处理带文件创建的方法
    void createProjectWithFile(ProjectCreateDTO createDTO, MultipartFile file) throws IOException;
}