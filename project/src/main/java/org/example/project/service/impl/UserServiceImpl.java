package org.example.project.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.example.project.dto.UserRegisterDTO;
import org.example.project.entity.User;
import org.example.project.mapper.UserMapper;
import org.example.project.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

@Service
public class UserServiceImpl extends ServiceImpl<UserMapper, User> implements UserService, UserDetailsService {

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private PasswordEncoder passwordEncoder;

    /**
     * 【改造后】处理用户注册的核心业务逻辑
     * 逻辑：校验工号 -> 自动生成用户名 -> 加密密码 -> 入库
     *
     * @param dto 包含工号、姓名、密码的DTO
     */
    @Override
    public void register(UserRegisterDTO dto) {
        // 1. 【改动】检查工号 (EmployeeID) 是否已存在，而不是检查用户名
        QueryWrapper<User> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("employee_id", dto.getEmployeeId());
        
        if (userMapper.selectCount(queryWrapper) > 0) {
            throw new RuntimeException("该工号 (" + dto.getEmployeeId() + ") 已被注册，请核对！");
        }

        // 2. 创建用户实体对象
        User user = new User();
        
        // 设置基础信息
        user.setEmployeeId(dto.getEmployeeId());
        user.setRealName(dto.getRealName());
        user.setIdentity(dto.getIdentity());

        // 3. 【核心】自动生成用户名：真实姓名 + 工号
        // 例如：金萌萌CT20117012
        String autoUsername = dto.getRealName() + dto.getEmployeeId();
        user.setUsername(autoUsername);

        // 4. 对密码进行加密处理
        user.setPassword(passwordEncoder.encode(dto.getPassword()));

        // 5. 设置默认头像和时间戳
        user.setAvatarUrl("main/images/faces/default-avatar.png");
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());

        // 6. 将新用户数据插入数据库
        userMapper.insert(user);
    }

    /**
     * 根据用户名查找用户
     * 通常用于 token 解析后获取用户信息，或者 getProfile
     */
    @Override
    public User findByUsername(String username) {
        QueryWrapper<User> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("username", username);
        return userMapper.selectOne(queryWrapper);
    }

    /**
     * 【关键改动】实现 UserDetailsService 接口
     * Spring Security 在登录时会调用这个方法。
     * * @param inputId 前端登录框输入的字符串（现在业务要求是 工号）
     */
    @Override
    public UserDetails loadUserByUsername(String inputId) throws UsernameNotFoundException {
        // 1. 【改动】因为前端传的是工号，所以这里查询 employee_id 字段
        QueryWrapper<User> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("employee_id", inputId);
        User user = userMapper.selectOne(queryWrapper);

        // 2. 如果找不到，抛出异常
        if (user == null) {
            throw new UsernameNotFoundException("工号 '" + inputId + "' 不存在。");
        }

        // 3. 返回 User 对象 (User 实体已经实现了 UserDetails 接口)
        return user;
    }

    /**
     * 根据角色/身份查询用户列表
     */
    @Override
    public List<User> findUsersByRole(String role) {
        // 业务规则：查找 "REVIEWER" 时，同时包含 "MANAGER"
        if ("REVIEWER".equalsIgnoreCase(role)) {
            List<String> rolesToFind = Arrays.asList("REVIEWER", "MANAGER");
            // 注意：这里需要确保 UserMapper XML 中有 findUsersByRoles 的实现
            // 如果没有 XML，可以使用 MybatisPlus 的 lambdaQuery().in(...) 替代
            return baseMapper.findUsersByRoles(rolesToFind);
        } else {
            return baseMapper.findUsersByRoles(Collections.singletonList(role));
        }
    }

    /**
     * 查询所有用户
     */
    @Override
    public List<User> findAllUsers() {
        return this.list();
    }
}