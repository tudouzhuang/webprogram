// 文件路径: src/main/java/org/example/project/controller/UserController.java
package org.example.project.controller;

import org.example.project.dto.UserRegisterDTO;
import org.example.project.entity.User;
import org.example.project.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * 用户相关API的控制器
 * 根路径: /api/users
 */
@RestController
@RequestMapping("/api/users") // 所有用户相关API都从此路径开始
public class UserController {

    @Autowired
    private UserService userService;
    
    /**
     * API: 用户注册
     * POST /api/users/register
     */
    @PostMapping("/register")
    public ResponseEntity<String> registerUser(@RequestBody UserRegisterDTO userData) {
        try {
            userService.register(userData);
            return ResponseEntity.status(HttpStatus.CREATED).body("注册成功！");
        } catch (RuntimeException e) {
            // 对于已存在的用户名等业务异常，返回 409 Conflict 更合适
            return ResponseEntity.status(HttpStatus.CONFLICT).body(e.getMessage());
        }
    }

    /**
     * API: 获取当前登录用户信息
     * GET /api/users/current
     */
    @GetMapping("/current")
    public ResponseEntity<User> getCurrentUser(Principal principal) {
        // 使用 Optional 包装，避免空指针，代码更优雅
        return Optional.ofNullable(principal)
                .map(p -> userService.findByUsername(p.getName()))
                .map(ResponseEntity::ok) // 如果用户存在，返回 200 OK 和用户信息
                .orElse(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build()); // 如果 principal 为空或用户不存在，返回 401 Unauthorized
    }

    @GetMapping
    public ResponseEntity<List<User>> getUsers(@RequestParam(value = "role", required = false) String role) {
        List<User> users;
        if (role != null && !role.trim().isEmpty()) {
            users = userService.findUsersByRole(role);
    
        } else {
            // --- 【【【 在这里修改 】】】 ---
            // 调用我们自己定义的、明确存在于接口中的 findAllUsers() 方法
            users = userService.findAllUsers(); 
        }
        return ResponseEntity.ok(users);
    }
}