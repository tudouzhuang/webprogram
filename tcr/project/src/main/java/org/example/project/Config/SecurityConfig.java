package org.example.project.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

import javax.servlet.http.HttpServletResponse;
import java.util.HashMap;
import java.util.Map;

/**
 * Spring Security 配置类 (精准保护 / 白名单模式)
 * <p>
 * 核心策略：默认所有页面和接口都允许匿名访问。
 * 只有明确指定的 "受保护" 路径（如 /index 及其相关API）才需要进行身份验证。
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            // 【第一步：配置请求授权规则】
            .authorizeRequests(authorize -> authorize
                .antMatchers(
                        "/index", // 保护主页
                        "/"
                ).authenticated()

                // 【开放的资源】除了上面明确指定的，其他任何请求(anyRequest)都允许匿名访问(permitAll)
                .anyRequest().permitAll()
            )

            // 【第二步：配置表单登录】
            .formLogin(form -> form
                // 当未登录用户访问受保护的 /index 时，自动跳转到 /login 页面
                .loginPage("/login")
                // 指定处理登录请求的API地址
                .loginProcessingUrl("/api/users/login")
                // 成功和失败处理器保持不变
                .successHandler((request, response, authentication) -> {
                    response.setContentType("application/json;charset=UTF-8");
                    response.setStatus(HttpServletResponse.SC_OK);
                    Map<String, Object> result = new HashMap<>();
                    result.put("success", true);
                    result.put("message", "登录成功");
                    result.put("redirectUrl", "/index"); // 登录成功后，引导前端跳转到主页
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
            )

            // 【第三步：配置登出】
            .logout(logout -> logout
                .logoutUrl("/api/users/logout")
                .logoutSuccessHandler((request, response, authentication) -> {
                    response.setContentType("application/json;charset=UTF-8");
                    response.setStatus(HttpServletResponse.SC_OK);
                    Map<String, Object> result = new HashMap<>();
                    result.put("success", true);
                    result.put("message", "登出成功");
                    response.getWriter().write(new ObjectMapper().writeValueAsString(result));
                })
                .deleteCookies("JSESSIONID")
                .invalidateHttpSession(true)
            )

            // 【第四步：关闭CSRF保护】
            .csrf(csrf -> csrf.disable());

        return http.build();
    }
}