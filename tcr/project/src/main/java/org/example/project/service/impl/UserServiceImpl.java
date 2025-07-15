package org.example.project.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.example.project.dto.UserRegisterDTO;
import org.example.project.entity.User;
import org.example.project.mapper.UserMapper;
import org.example.project.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
// 【关键修改1】: 不再需要 @Value 注解，可以删除这一行导入
// import org.springframework.beans.factory.annotation.Value; 
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Collections;

@Service
public class UserServiceImpl implements UserService, UserDetailsService {

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private PasswordEncoder passwordEncoder;

    // 【关键修改2】: 删除 @Value 注入的成员变量
    // @Value("${user.default-avatar-url}")
    // private String defaultAvatarUrl;

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

        // 4. 【关键修改3】: 直接在这里硬编码一个默认的头像URL
        String defaultAvatarUrl = "main/images/faces/default-avatar.png";
        user.setAvatarUrl(defaultAvatarUrl);

        // 5. 将新用户对象插入数据库
        userMapper.insert(user);
    }

    // ... findByUsername 和 loadUserByUsername 方法保持不变 ...
    
    @Override
    public User findByUsername(String username) {
        QueryWrapper<User> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("username", username);
        return userMapper.selectOne(queryWrapper);
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = this.findByUsername(username);

        if (user == null) {
            throw new UsernameNotFoundException("用户 '" + username + "' 不存在");
        }

        return new org.springframework.security.core.userdetails.User(
                user.getUsername(),
                user.getPassword(),
                Collections.emptyList()
        );
    }
}