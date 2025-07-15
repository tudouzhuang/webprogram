package org.example.project.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule; // 【重要】处理Java 8日期
import org.example.project.dto.ProjectCreateDTO;
import org.example.project.service.ProjectService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    @Autowired
    private ProjectService projectService;

    /**
     * 【保持不变】这个接口用于处理不带文件的项目创建请求
     */
    @PostMapping("/create")
    public ResponseEntity<String> createProject(@RequestBody ProjectCreateDTO createDTO) {
        try {
            projectService.createProject(createDTO);
            return ResponseEntity.ok("项目创建成功");
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.badRequest().body("创建失败: " + e.getMessage());
        }
    }

    /**
     * 【核心新增】这个新的API接口用于处理“项目数据 + Excel文件”的创建请求
     *
     * @param projectDataJson 前端通过 FormData 发送过来的、包含项目表单信息的JSON字符串。
     * @param file              前端通过 FormData 发送过来的Excel文件本身。
     * @return                  返回一个表示操作结果的响应。
     */
    @PostMapping(value = "/create-with-file", consumes = "multipart/form-data")
    public ResponseEntity<String> createProjectWithFile(
            @RequestPart("projectData") String projectDataJson,
            @RequestPart("file") MultipartFile file) {

        // --- 第一步：验证文件是否为空 ---
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body("上传的文件不能为空！");
        }

        try {
            // --- 第二步：将JSON字符串手动转换为DTO对象 ---
            // 因为混合请求不能直接用 @RequestBody，所以需要手动转换
            ObjectMapper objectMapper = new ObjectMapper();
            // 注册JavaTimeModule以正确处理LocalDate等Java 8日期类型
            objectMapper.registerModule(new JavaTimeModule()); 
            ProjectCreateDTO createDTO = objectMapper.readValue(projectDataJson, ProjectCreateDTO.class);

            // --- 第三步：调用Service层进行处理 ---
            // 我们将在Service层创建一个新的方法来处理这个复杂的业务
            projectService.createProjectWithFile(createDTO, file);

            // 如果Service层没有抛出异常，说明操作成功
            return ResponseEntity.ok("项目和文件已成功接收并开始处理");

        } catch (Exception e) {
            // 捕获所有可能的异常，包括JSON转换失败、文件保存失败等
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("处理失败: " + e.getMessage());
        }
    }
}