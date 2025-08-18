// 文件路径: src/main/java/org/example/project/config/SecurityConfig.java
package org.example.project.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod; // 【第一步】: 确保导入 HttpMethod
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

import javax.servlet.http.HttpServletResponse;
import java.util.HashMap;
import java.util.Map;

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
            .csrf(csrf -> csrf.disable()) // 禁用CSRF
            .headers(headers -> headers
                .frameOptions(frameOptions -> frameOptions.sameOrigin()) // 允许同源iframe
            )
            .authorizeHttpRequests(authorize -> authorize // 开始配置授权规则
                // 1. 公开访问路径 (无需认证)
                .antMatchers(
                    "/login", "/signup", "/reset", "/404",
                    "/api/users/login", "/api/users/register",
                    "/static/**", "/assets/**", "/main/**", "/js/**", "/css/**", 
                    "/luckysheet/**", "/luckyexcel/**", "/favicon.ico", 
                    "/material/**", "/pdfjs/**", "/luckysheet-iframe-loader.html",
                    "/uploads/**", "/templates/**",
                    "/api/files/content/**", "/api/files/templates/**"
                ).permitAll()

                // =======================================================
                //  ↓↓↓ 【核心修正】: 在这里添加对新API的授权规则 ↓↓↓
                // =======================================================
                
                // 2. 需要认证，但所有角色都可以访问的路径
                .antMatchers(HttpMethod.GET, "/api/users").authenticated() // 允许所有登录用户获取审核员列表

                // 3. 需要特定角色才能访问的路径
                .antMatchers(HttpMethod.POST, "/api/process-records/*/reassign", "/api/process-records/*/request-changes")
                    .hasAnyRole("REVIEWER", "MANAGER", "ADMIN") // 允许审核员、经理、管理员执行打回和转交
                
                // =======================================================
                //  ↑↑↑ 【核心修正结束】 ↑↑↑
                // =======================================================

                // 4. 其他所有请求都需要认证
                .anyRequest().authenticated()
            )
            .formLogin(form -> form
                .loginPage("/login")
                .loginProcessingUrl("/api/users/login")
                .successHandler((request, response, authentication) -> {
                    response.setContentType("application/json;charset=UTF-8");
                    response.setStatus(HttpServletResponse.SC_OK);

                    String userRole = authentication.getAuthorities().stream()
                            .findFirst()
                            .map(GrantedAuthority::getAuthority)
                            .map(role -> role.replace("ROLE_", ""))
                            .map(String::toLowerCase)
                            .orElse("designer");

                    Map<String, Object> result = new HashMap<>();
                    result.put("success", true);
                    result.put("message", "登录成功");
                    result.put("redirectUrl", "/index");
                    result.put("role", userRole);

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
            );

        return http.build();
    }
}