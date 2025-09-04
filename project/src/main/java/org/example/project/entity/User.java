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
import java.util.List;
import java.util.stream.Collectors;

@Data
@TableName("users")
public class User implements UserDetails {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String username;
    private String password;
    private String email;
    private String identity; // 角色, e.g., 'DESIGNER', 'MANAGER'
    
    @TableField("avatar_url") // 明确指定数据库字段名
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