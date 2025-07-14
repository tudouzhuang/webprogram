package org.example.project.controller;

import org.example.project.dto.UserRegisterDTO;
import org.example.project.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import org.example.project.entity.User;
import java.security.Principal;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserService userService;
    
    @PostMapping("/register")
    public ResponseEntity<String> registerUser(@RequestBody UserRegisterDTO userData) {
        try {
            userService.register(userData);
            return ResponseEntity.ok("注册成功！");
        } catch (RuntimeException e) {
            // 将业务层抛出的异常信息返回给前端
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/current")
    public ResponseEntity<Object> getCurrentUser(Principal principal) {
        // 1. 检查用户是否真的登录了
        if (principal == null) {
            // 如果 principal 为 null，说明该请求没有有效的认证信息
            return ResponseEntity.status(401).body("用户未认证，请先登录。");
        }

        // 2. 从凭证中获取用户名
        // principal.getName() 方法默认返回的是登录时使用的用户名
        String username = principal.getName();

        // 3. 【关键】调用 Service 层，根据用户名从数据库中查询真实的用户信息
        // 你需要确保你的 UserService 中有一个类似 findByUsername 的方法
        System.out.println("【Controller】从 Principal 获取到的用户名是: [" + username + "]");
        //test 看有没有成功获取Principal

        User currentUser = userService.findByUsername(username);

        System.out.println("【Controller】UserService 返回的用户是: " + currentUser);
        // test
        // 4. 对查询结果进行判断
        if (currentUser == null) {
            // 正常情况下不应发生，但作为健壮性检查
            return ResponseEntity.status(404).body("未找到用户: " + username);
        }

        // 5. 返回真实的用户数据
        // 注意：为了安全，通常会返回一个不包含密码等敏感信息的 DTO 对象，
        // 但为了简单起见，这里直接返回 User 对象（请确保 User 类的 password 字段上没有暴露给JSON的注解）
        return ResponseEntity.ok(currentUser);
    }

}