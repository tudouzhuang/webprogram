package org.example.project.dto;

import lombok.Data;

@Data
public class UserRegisterDTO {
    // 字段名必须和前端JS中formData的键名一致
    /**
     * 工号 (前端输入，必须是 CT20xxxxxx)
     */
    private String employeeId;

    /**
     * 真实姓名 (前端输入)
     */
    private String realName;
    private String name; 
    private String email;
    private String password;
    private String identity;
}