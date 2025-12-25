package org.example.project.dto;
import lombok.Data;

@Data
public class LoginDto {
    private String employeeId; // 前端传来的通用账号
    private String password;   // 密码
}