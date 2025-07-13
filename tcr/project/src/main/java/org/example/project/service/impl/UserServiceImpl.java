package org.example.project.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.example.project.dto.UserRegisterDTO;
import org.example.project.entity.User;
import org.example.project.mapper.UserMapper;
import org.example.project.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class UserServiceImpl implements UserService {

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Override
    public void register(UserRegisterDTO userRegisterDTO) {
        // 检查用户名是否已存在
        QueryWrapper<User> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("username", userRegisterDTO.getName());
        if (userMapper.selectCount(queryWrapper) > 0) {
            throw new RuntimeException("用户名已存在");
        }

        // 创建实体对象
        User user = new User();
        user.setUsername(userRegisterDTO.getName());
        user.setEmail(userRegisterDTO.getEmail());
        user.setIdentity(userRegisterDTO.getIdentity());

        // 加密密码
        user.setPassword(passwordEncoder.encode(userRegisterDTO.getPassword()));

        // 插入数据库
        userMapper.insert(user);
    }
}