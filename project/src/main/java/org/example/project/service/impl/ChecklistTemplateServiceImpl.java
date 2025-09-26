package org.example.project.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper; // 【新增】引入
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.example.project.entity.ChecklistTemplate;
import org.example.project.entity.ChecklistTemplateItem; // 【新增】引入
import org.example.project.mapper.ChecklistTemplateItemMapper; // 【新增】引入
import org.example.project.mapper.ChecklistTemplateMapper;
import org.example.project.service.ChecklistTemplateService;
import org.springframework.beans.factory.annotation.Autowired; // 【新增】引入
import org.springframework.stereotype.Service;

import java.util.List; // 【新增】引入

@Service
public class ChecklistTemplateServiceImpl extends ServiceImpl<ChecklistTemplateMapper, ChecklistTemplate> implements ChecklistTemplateService {
    
    // 【【【核心新增1】】】
    // 注入 ChecklistTemplateItemMapper，以便我们能查询检查项条目。
    @Autowired
    private ChecklistTemplateItemMapper templateItemMapper;

    /**
     * 【【【核心新增2】】】
     * 实现获取模板详情的业务逻辑。
     */
    @Override
    public ChecklistTemplate getTemplateWithDetails(Long templateId) {
        // 1. 先根据ID获取模板的基本信息 (e.g., id, templateName)
        ChecklistTemplate template = this.getById(templateId);
        
        // 2. 如果模板存在，就去查询它关联的所有检查项条目
        if (template != null) {
            // 使用 QueryWrapper 来构建查询条件： "WHERE template_id = ?"
            List<ChecklistTemplateItem> items = templateItemMapper.selectList(
                new QueryWrapper<ChecklistTemplateItem>().eq("template_id", templateId)
            );
            
            // 3. 将查询到的条目列表，设置到我们之前在实体类中添加的非数据库字段`items`上
            template.setItems(items);
        }
        
        // 4. 返回这个包含了完整信息的 template 对象
        return template;
    }
}