package org.example.project.service.impl; // 你的包名是 service，不是 Service

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.example.project.dto.UserRegisterDTO;
import org.example.project.entity.User;
import org.example.project.mapper.UserMapper;
import org.example.project.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService; // 【关键】导入这个接口
import org.springframework.security.core.userdetails.UsernameNotFoundException; // 【关键】导入这个异常
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Collections; // 【关键】导入 Collections

// 【核心修改 1】: 在这里添加 implements UserDetailsService
@Service
public class UserServiceImpl implements UserService, UserDetailsService {

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private PasswordEncoder passwordEncoder;

    // 你原来的 register 方法保持不变，它是正确的
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

    @Override
    public User findByUsername(String username) {
        // 1. 创建一个 MyBatis-Plus 的查询包装器
        QueryWrapper<User> queryWrapper = new QueryWrapper<>();

        // 2. 添加查询条件：where username = ?
        queryWrapper.eq("username", username);

        // 3. 调用 userMapper 执行查询，并返回查询到的单个用户对象
        // 如果找不到，userMapper.selectOne 会自动返回 null
        return userMapper.selectOne(queryWrapper);
    }


    /**
     * 【核心修改 2】: 实现 UserDetailsService 接口的核心方法
     * 这是 Spring Security 在进行登录验证时，真正会调用的方法。
     *
     * @param username 前端登录表单中输入的用户名
     * @return 一个包含了用户名、加密密码和权限信息的 UserDetails 对象
     * @throws UsernameNotFoundException 如果在数据库中找不到该用户
     */
    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        // 1. 根据用户名从数据库查询用户
        QueryWrapper<User> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("username", username);
        User user = userMapper.selectOne(queryWrapper); // 使用 selectOne 获取单个用户对象

        // 2. 如果找不到用户，必须抛出指定的异常
        if (user == null) {
            throw new UsernameNotFoundException("用户 '" + username + "' 不存在或密码不正确");
        }

        // 3. 如果找到了，将你的 User 实体信息封装成 Spring Security 需要的 UserDetails 对象并返回
        //    Spring Security 会自动用这个对象里的加密密码和用户输入的密码进行比对。
        return new org.springframework.security.core.userdetails.User(
                user.getUsername(),
                user.getPassword(), // 【注意】这里传递的是从数据库取出的加密后的密码
                Collections.emptyList() // 权限列表，暂时为空
        );
    }
}