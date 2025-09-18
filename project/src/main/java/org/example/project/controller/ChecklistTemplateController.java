package org.example.project.controller;

import org.example.project.entity.ChecklistTemplate;
import org.example.project.service.ChecklistTemplateService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/templates")
public class ChecklistTemplateController {

    @Autowired
    private ChecklistTemplateService templateService;

    // 获取所有模板列表 (这个接口保持不变，用于前端下拉框)
    @GetMapping
    public ResponseEntity<List<ChecklistTemplate>> getAllTemplates() {
        return ResponseEntity.ok(templateService.list());
    }

    /**
     * 【【【核心修改】】】
     * 获取单个模板的详情。现在它调用的不再是简单的 getById，
     * 而是我们新创建的 getTemplateWithDetails 方法，
     * 因此返回的JSON中会包含一个 "items" 数组。
     */
    @GetMapping("/{id}")
    public ResponseEntity<ChecklistTemplate> getTemplateById(@PathVariable Long id) {
        ChecklistTemplate template = templateService.getTemplateWithDetails(id); 
        
        if (template == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(template);
    }

    // 创建新模板 (保持不变)
    @PostMapping
    public ResponseEntity<ChecklistTemplate> createTemplate(@RequestBody ChecklistTemplate template) {
        templateService.save(template);
        return ResponseEntity.ok(template);
    }

    // 更新模板 (保持不变)
    @PutMapping("/{id}")
    public ResponseEntity<ChecklistTemplate> updateTemplate(@PathVariable Long id, @RequestBody ChecklistTemplate template) {
        template.setId(id);
        templateService.updateById(template);
        return ResponseEntity.ok(template);
    }

    // 删除模板 (保持不变)
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTemplate(@PathVariable Long id) {
        templateService.removeById(id);
        return ResponseEntity.noContent().build();
    }
}