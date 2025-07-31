package org.example.project.service;

import org.example.project.dto.BusinessProjectCreateDTO;
import org.example.project.entity.BusinessProject;

public interface BusinessProjectService {
    BusinessProject createNewProject(BusinessProjectCreateDTO createDTO);
    // 未来可以添加更多方法，如 findById, getAllProjects等
}