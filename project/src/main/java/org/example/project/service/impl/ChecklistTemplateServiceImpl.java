package org.example.project.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.example.project.entity.ChecklistTemplate;
import org.example.project.mapper.ChecklistTemplateMapper;
import org.example.project.service.ChecklistTemplateService;
import org.springframework.stereotype.Service;

@Service
public class ChecklistTemplateServiceImpl extends ServiceImpl<ChecklistTemplateMapper, ChecklistTemplate> implements ChecklistTemplateService {
    // 基础的CRUD已经由ServiceImpl实现了
}