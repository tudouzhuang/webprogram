package org.example.project.dto;

import lombok.Data;

@Data
public class UserRegisterDTO {
    // 字段名必须和前端JS中formData的键名一致
    private String name; 
    private String email;
    private String password;
    private String identity;
}