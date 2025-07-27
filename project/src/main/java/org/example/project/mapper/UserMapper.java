package org.example.project.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.example.project.entity.User;

@Mapper
public interface UserMapper extends BaseMapper<User> {
    // 继承了 BaseMapper，就自动拥有了增删改查功能，无需再写SQL
}