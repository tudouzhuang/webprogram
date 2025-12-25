// 文件路径: src/main/java/org/example/project/controller/UserController.java
package org.example.project.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.example.project.dto.LoginDto;
import org.example.project.dto.UserRegisterDTO;
import org.example.project.entity.User;
import org.example.project.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 用户相关API的控制器 根路径: /api/users
 */
@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserService userService;

    @Autowired
    private PasswordEncoder passwordEncoder;

// src/main/java/org/example/project/controller/UserController.java
    @PostMapping("/signin")
    public ResponseEntity<?> login(@RequestBody LoginDto loginDto) {
        String inputAccount = loginDto.getEmployeeId();
        String password = loginDto.getPassword();

        // 【修复 1】兼容写法：判空返回
        if (inputAccount == null || inputAccount.trim().isEmpty() || password == null) {
            Map<String, Object> err = new HashMap<>(); // 使用 HashMap
            err.put("code", 400);
            err.put("msg", "账号或密码不能为空");
            return ResponseEntity.badRequest().body(err);
        }

        QueryWrapper<User> queryWrapper = new QueryWrapper<>();
        queryWrapper.and(wrapper -> wrapper
                .eq("employee_id", inputAccount)
                .or().eq("real_name", inputAccount)
                .or().eq("username", inputAccount)
                .or().eq("id", inputAccount)
        );

        User user = userService.getOne(queryWrapper);

        // 【修复 2】兼容写法：密码错误返回
        if (user == null || !passwordEncoder.matches(password, user.getPassword())) {
            Map<String, Object> err = new HashMap<>(); // 使用 HashMap
            err.put("code", 401);
            err.put("msg", "账号或密码错误");
            return ResponseEntity.ok(err);
        }

        // 【修复 3】兼容写法：成功返回
        Map<String, Object> data = new HashMap<>();
        data.put("token", "MOCK_TOKEN_" + user.getId());
        data.put("displayUsername", user.getUsername());
        data.put("role", user.getIdentity());
        data.put("redirectUrl", "/index");

        Map<String, Object> response = new HashMap<>();
        response.put("code", 200);
        response.put("msg", "登录成功");
        response.put("data", data);

        return ResponseEntity.ok(response);
    }

    /**
     * API: 用户注册
     */
    @PostMapping("/register")
    public ResponseEntity<String> registerUser(@RequestBody UserRegisterDTO userData) {
        String eid = userData.getEmployeeId();
        // 格式校验: CT20 + 6位数字
        if (eid == null || !eid.matches("^CT20\\d{6}$")) {
            return ResponseEntity
                    .status(HttpStatus.BAD_REQUEST)
                    .body("注册失败：工号格式错误！必须以 'CT20' 开头，后接6位数字 (例如: CT20117012)");
        }

        if (userData.getRealName() == null || userData.getRealName().trim().isEmpty()) {
            return ResponseEntity
                    .status(HttpStatus.BAD_REQUEST)
                    .body("注册失败：真实姓名不能为空！");
        }

        try {
            userService.register(userData);
            return ResponseEntity.status(HttpStatus.CREATED).body("注册成功！");
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(e.getMessage());
        }
    }

    @GetMapping("/current")
    public ResponseEntity<User> getCurrentUser(Principal principal) {
        return Optional.ofNullable(principal)
                .map(p -> userService.findByUsername(p.getName()))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }

    @GetMapping
    public ResponseEntity<List<User>> getUsers(@RequestParam(value = "role", required = false) String role) {
        List<User> users;
        if (role != null && !role.trim().isEmpty()) {
            users = userService.findUsersByRole(role);
        } else {
            users = userService.findAllUsers();
        }
        return ResponseEntity.ok(users);
    }

    @GetMapping("/me")
    public ResponseEntity<User> getMyProfile(Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        User currentUser = userService.findByUsername(principal.getName());
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        return ResponseEntity.ok(currentUser);
    }
}
