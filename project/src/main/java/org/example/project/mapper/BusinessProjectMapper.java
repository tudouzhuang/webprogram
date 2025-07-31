package org.example.project.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.example.project.entity.BusinessProject;

@Mapper
public interface BusinessProjectMapper extends BaseMapper<BusinessProject> {
    // 继承后自动拥有所有CRUD方法
}