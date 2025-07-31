package org.example.project.controller;

import org.example.project.dto.BusinessProjectCreateDTO;
import org.example.project.entity.BusinessProject;
import org.example.project.service.BusinessProjectService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/business-projects") // 使用新的API路径
public class BusinessProjectController {

    private static final Logger log = LoggerFactory.getLogger(BusinessProjectController.class);

    @Autowired
    private BusinessProjectService businessProjectService;

    @PostMapping
    public ResponseEntity<?> createNewProject(@RequestBody BusinessProjectCreateDTO createDTO) {
        log.info("接收到创建新业务项目的请求，项目名: {}", createDTO.getProjectName());
        try {
            BusinessProject newProject = businessProjectService.createNewProject(createDTO);
            return ResponseEntity.ok(newProject);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            log.error("创建新业务项目时发生未知错误", e);
            return ResponseEntity.status(500).body("服务器内部错误");
        }
    }
}