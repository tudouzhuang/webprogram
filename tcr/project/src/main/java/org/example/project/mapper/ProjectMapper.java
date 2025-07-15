package org.example.project.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.example.project.entity.Project;

@Mapper // 告诉 Spring 这是一个 Mapper 接口
public interface ProjectMapper extends BaseMapper<Project> {
    // 继承 BaseMapper 后，就自动拥有了增、删、改、查等所有常用方法
    // 例如 insert(), selectById(), updateById(), deleteById() 等
}