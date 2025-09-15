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

    // GET /api/templates - 获取所有模板列表
    @GetMapping
    public ResponseEntity<List<ChecklistTemplate>> getAllTemplates() {
        return ResponseEntity.ok(templateService.list());
    }

    // GET /api/templates/{id} - 获取单个模板详情
    @GetMapping("/{id}")
    public ResponseEntity<ChecklistTemplate> getTemplateById(@PathVariable Long id) {
        ChecklistTemplate template = templateService.getById(id);
        if (template == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(template);
    }

    // POST /api/templates - 创建一个新模板
    @PostMapping
    public ResponseEntity<ChecklistTemplate> createTemplate(@RequestBody ChecklistTemplate template) {
        templateService.save(template);
        return ResponseEntity.ok(template);
    }

    // PUT /api/templates/{id} - 更新一个模板
    @PutMapping("/{id}")
    public ResponseEntity<ChecklistTemplate> updateTemplate(@PathVariable Long id, @RequestBody ChecklistTemplate template) {
        template.setId(id);
        templateService.updateById(template);
        return ResponseEntity.ok(template);
    }

    // DELETE /api/templates/{id} - 删除一个模板
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTemplate(@PathVariable Long id) {
        templateService.removeById(id);
        return ResponseEntity.noContent().build();
    }
}