// src/main/java/org/example/project/entity/User.java
package org.example.project.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Collections;

@Data
@TableName("users") // 保持你原有的表名设置
public class User implements UserDetails {

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 工号 (用来登录，业务主键)
     * 格式要求：CT20 开头 + 6位数字
     * 建议在数据库设置为 UNIQUE 索引
     */
    @TableField("employee_id")
    private String employeeId;

    /**
     * 真实姓名 (用来显示)
     */
    @TableField("real_name")
    private String realName;

    /**
     * 用户名
     * 改造后逻辑：系统自动生成 = realName + employeeId
     * 例如：张三CT20117012
     */
    @TableField("username")
    private String username;

    @TableField("password")
    private String password;

    @TableField("email")
    private String email;

    @TableField("identity")
    private String identity; // 角色, e.g., 'DESIGNER', 'MANAGER'
    
    @TableField("avatar_url")
    private String avatarUrl;
    
    @TableField("created_at")
    private LocalDateTime createdAt;
    
    @TableField("updated_at")
    private LocalDateTime updatedAt;

    // ======================================================================
    // --- 实现 UserDetails 接口所要求的方法 ---
    // ======================================================================

    /**
     * 返回用户的权限集合。
     * Spring Security 会根据这里的权限进行授权检查。
     */
    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        // 检查 identity 字段是否为空
        if (this.identity == null || this.identity.trim().isEmpty()) {
            return Collections.emptyList(); // 如果没有角色，返回一个空的权限列表
        }

        // 创建一个权限字符串，并确保它以 "ROLE_" 开头
        // 这是 Spring Security 的标准约定
        String role = this.identity.toUpperCase();
        if (!role.startsWith("ROLE_")) {
            role = "ROLE_" + role;
        }

        // 将角色字符串包装成 SimpleGrantedAuthority 对象，并放入一个列表中返回
        return Collections.singletonList(new SimpleGrantedAuthority(role));
    }

    /**
     * 账户是否未过期。
     * 业务上没有此要求，直接返回 true。
     */
    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    /**
     * 账户是否未被锁定。
     * 业务上没有此要求，直接返回 true。
     */
    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    /**
     * 用户凭证（密码）是否未过期。
     * 业务上没有此要求，直接返回 true。
     */
    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    /**
     * 账户是否启用。
     * 业务上没有此要求，直接返回 true。
     */
    @Override
    public boolean isEnabled() {
        return true;
    }
}