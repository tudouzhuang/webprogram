package org.example.project.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.example.project.dto.UserRegisterDTO;
import org.example.project.entity.User;
import org.example.project.mapper.UserMapper;
import org.example.project.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List; // 【核心修正】: 添加这一行导入语句

@Service
public class UserServiceImpl implements UserService, UserDetailsService {

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private PasswordEncoder passwordEncoder;

    /**
     * 处理用户注册的核心业务逻辑
     * @param userRegisterDTO 包含注册信息的DTO对象
     */
    @Override
    public void register(UserRegisterDTO userRegisterDTO) {
        // 1. 检查用户名是否已存在
        QueryWrapper<User> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("username", userRegisterDTO.getName());
        if (userMapper.selectCount(queryWrapper) > 0) {
            throw new RuntimeException("用户名已存在");
        }

        // 2. 创建实体对象
        User user = new User();
        user.setUsername(userRegisterDTO.getName());
        user.setEmail(userRegisterDTO.getEmail());
        user.setIdentity(userRegisterDTO.getIdentity());

        // 3. 对密码进行加密
        user.setPassword(passwordEncoder.encode(userRegisterDTO.getPassword()));

        // 4. 硬编码一个默认的头像URL
        String defaultAvatarUrl = "main/images/faces/default-avatar.png";
        user.setAvatarUrl(defaultAvatarUrl);

        // 5. 将新用户对象插入数据库
        userMapper.insert(user);
    }


    @Override
    public User findByUsername(String username) {
        QueryWrapper<User> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("username", username);
        return userMapper.selectOne(queryWrapper);
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        // 1. 从数据库加载用户实体
        User user = this.findByUsername(username);
        if (user == null) {
            throw new UsernameNotFoundException("用户 '" + username + "' 不存在");
        }

        // 2. 从用户实体中获取 identity 字段，并将其转换为 Spring Security 的 GrantedAuthority
        String role = "ROLE_" + user.getIdentity().toUpperCase();
        GrantedAuthority authority = new SimpleGrantedAuthority(role);
        List<GrantedAuthority> authorities = Collections.singletonList(authority);

        // 3. 创建并返回 UserDetails 对象，这次要传入正确的权限列表
        return new org.springframework.security.core.userdetails.User(
                user.getUsername(),
                user.getPassword(),
                authorities
        );
    }
}