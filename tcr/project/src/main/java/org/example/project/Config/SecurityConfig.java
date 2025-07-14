package org.example.project.Config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

import javax.servlet.http.HttpServletResponse;
import java.util.HashMap;
import java.util.Map;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    // 【第一部分】密码编码器，保持不变，它是一个独立的 Bean
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // 【第二部分】配置安全过滤链
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        // 在这个新的配置方式下，Spring Security 会自动找到我们实现了 UserDetailsService 接口的 Bean
        // 以及我们定义的 PasswordEncoder Bean，并将它们组合起来进行认证。
        // 我们不再需要手动配置 AuthenticationManager 或注入 UserDetailsService。

        http.authorizeRequests(authorize -> authorize
                        .antMatchers("/index", "/profile", "/api/data/**").authenticated()
                        .anyRequest().permitAll()
                )
                .formLogin(form -> form
                        .loginPage("/login")
                        .loginProcessingUrl("/api/users/login")
                        // 成功和失败处理器保持不变
                        .successHandler((request, response, authentication) -> {
                            response.setContentType("application/json;charset=UTF-8");
                            response.setStatus(HttpServletResponse.SC_OK);
                            Map<String, Object> result = new HashMap<>();
                            result.put("success", true);
                            result.put("message", "登录成功");
                            result.put("redirectUrl", "/index");
                            response.getWriter().write(new ObjectMapper().writeValueAsString(result));
                        })
                        .failureHandler((request, response, exception) -> {
                            response.setContentType("application/json;charset=UTF-8");
                            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                            Map<String, Object> result = new HashMap<>();
                            result.put("success", false);
                            result.put("message", "用户名或密码不正确");
                            response.getWriter().write(new ObjectMapper().writeValueAsString(result));
                        })
                        .permitAll()
                )
                .logout(logout -> logout
                        .logoutUrl("/api/users/logout")
                        .logoutSuccessUrl("/login?logout")
                        .permitAll()
                )
                .csrf(csrf -> csrf.disable());

        return http.build();
    }
}