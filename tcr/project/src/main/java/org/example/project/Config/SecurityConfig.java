package org.example.project.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Spring Security 配置类
 */
@Configuration
public class SecurityConfig {

    /**
     * 向Spring容器中注入一个密码加密器的Bean。
     * Spring Security会使用这个Bean来加密和验证密码。
     * 我们使用官方推荐的 BCrypt 强哈希加密算法。
     *
     * @return PasswordEncoder 的一个实例
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}