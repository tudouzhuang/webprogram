package com.example.project.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.example.project.entity.ChecklistTemplate;
import com.example.project.mapper.ChecklistTemplateMapper;
import com.example.project.service.ChecklistTemplateService;
import org.springframework.stereotype.Service;

@Service
public class ChecklistTemplateServiceImpl extends ServiceImpl<ChecklistTemplateMapper, ChecklistTemplate> implements ChecklistTemplateService {
    // 基础的CRUD已经由 ServiceImpl 实现了
    // 未来可以在这里添加更复杂的业务逻辑
}