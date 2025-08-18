package org.example.project.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;

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

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

@Service
public class UserServiceImpl extends ServiceImpl<UserMapper, User> implements UserService, UserDetailsService {

    // 自动注入 UserMapper，用于数据库操作
    @Autowired
    private UserMapper userMapper;

    // 自动注入 Spring Security 的密码编码器
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

        // 2. 创建用户实体对象
        User user = new User();
        user.setUsername(userRegisterDTO.getName());
        user.setEmail(userRegisterDTO.getEmail());
        user.setIdentity(userRegisterDTO.getIdentity());

        // 3. 对密码进行加密处理
        user.setPassword(passwordEncoder.encode(userRegisterDTO.getPassword()));

        // 4. 设置一个默认的头像URL
        String defaultAvatarUrl = "main/images/faces/default-avatar.png";
        user.setAvatarUrl(defaultAvatarUrl);

        // 5. 将新用户数据插入数据库
        userMapper.insert(user);
    }

    /**
     * 根据用户名查找用户
     * @param username 用户名
     * @return User 实体 或 null
     */
    @Override
    public User findByUsername(String username) {
        QueryWrapper<User> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("username", username);
        return userMapper.selectOne(queryWrapper);
    }

    /**
     * 实现 UserDetailsService 接口，为 Spring Security 提供用户认证服务
     * @param username 用户在登录时输入的用户名
     * @return UserDetails 对象，包含了用户名、加密后的密码和权限信息
     * @throws UsernameNotFoundException 如果用户不存在
     */
    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        // 1. 从数据库加载用户实体
        User user = this.findByUsername(username);
        if (user == null) {
            throw new UsernameNotFoundException("用户 '" + username + "' 不存在");
        }

        // 2. 将用户的 identity (如 "REVIEWER", "DESIGNER") 转换为 Spring Security 的权限格式 ("ROLE_REVIEWER")
        String role = "ROLE_" + user.getIdentity().toUpperCase();
        GrantedAuthority authority = new SimpleGrantedAuthority(role);
        List<GrantedAuthority> authorities = Collections.singletonList(authority);

        // 3. 创建并返回 Spring Security 可识别的 UserDetails 对象
        return new org.springframework.security.core.userdetails.User(
                user.getUsername(),
                user.getPassword(),
                authorities
        );
    }

    /**
     * 【新功能】根据角色/身份查询用户列表
     * 这个方法将被 UserController 调用，为前端提供审核员列表
     * @param role 角色字符串 (例如 "REVIEWER")
     * @return 匹配该角色的用户列表
     */
        @Override
        public List<User> findUsersByRole(String role) {
            // 【核心修正】: 应用 "manager 也是 reviewer" 的业务规则
            if ("REVIEWER".equalsIgnoreCase(role)) {
                // 如果要找审核员，就把 'REVIEWER' 和 'MANAGER' 都找出来
                List<String> rolesToFind = Arrays.asList("REVIEWER", "MANAGER");
                return baseMapper.findUsersByRoles(rolesToFind);
            } else {
                // 对于其他角色 (如 DESIGNER)，只查找它自己
                return baseMapper.findUsersByRoles(Collections.singletonList(role));
            }
}
}