package org.example.project.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.example.project.dto.BusinessProjectCreateDTO;
import org.example.project.entity.BusinessProject;
import org.example.project.mapper.BusinessProjectMapper;
import org.example.project.service.BusinessProjectService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class BusinessProjectServiceImpl implements BusinessProjectService {
    
    private static final Logger log = LoggerFactory.getLogger(BusinessProjectServiceImpl.class);

    @Autowired
    private BusinessProjectMapper businessProjectMapper;

    @Override
    public BusinessProject createNewProject(BusinessProjectCreateDTO createDTO) {
        // 1. 检查项目名称唯一性
        QueryWrapper<BusinessProject> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("name", createDTO.getProjectName());
        if (businessProjectMapper.selectCount(queryWrapper) > 0) {
            throw new RuntimeException("项目名称 '" + createDTO.getProjectName() + "' 已存在！");
        }

        // 2. 创建实体并赋值
        BusinessProject newProject = new BusinessProject();
        newProject.setName(createDTO.getProjectName());
        newProject.setStatus("PLANNING"); // 设置初始状态

        // 可以在这里获取当前登录用户ID并设置
        // newProject.setCreatedByUserId(...);
        
        // 3. 插入数据库
        businessProjectMapper.insert(newProject);
        log.info("新业务项目已创建，ID: {}, 名称: {}", newProject.getId(), newProject.getName());
        
        return newProject;
    }
}