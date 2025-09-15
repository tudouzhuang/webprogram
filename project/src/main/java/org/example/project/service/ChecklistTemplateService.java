package com.example.project.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.example.project.entity.ChecklistTemplate;

// 继承 IService 可以直接获得大部分CRUD能力
public interface ChecklistTemplateService extends IService<ChecklistTemplate> {
    // 后续可以添加更复杂的业务方法，例如“创建模板并同时创建其条目”
}