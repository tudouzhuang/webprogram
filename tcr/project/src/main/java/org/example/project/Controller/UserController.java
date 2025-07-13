package org.example.project.Controller;

import org.example.project.dto.UserRegisterDTO;
import org.example.project.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
}