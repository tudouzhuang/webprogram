package org.example.project.mapper; // <-- 必须是 org

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.example.project.entity.ChecklistTemplate; // <-- 这里的引用也必须是 org

@Mapper
public interface ChecklistTemplateMapper extends BaseMapper<ChecklistTemplate> {
}