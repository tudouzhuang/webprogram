package org.example.project.service;

import com.baomidou.mybatisplus.extension.service.IService;
import org.example.project.entity.ChecklistTemplate;

public interface ChecklistTemplateService extends IService<ChecklistTemplate> {
    
    /**
     * 【【【核心新增】】】
     * 根据模板ID，获取模板的基本信息，并同时查询出其包含的所有检查项条目。
     * @param templateId 模板的ID
     * @return 包含条目列表 (items) 的 ChecklistTemplate 对象，如果找不到则返回 null。
     */
    ChecklistTemplate getTemplateWithDetails(Long templateId);
    
}