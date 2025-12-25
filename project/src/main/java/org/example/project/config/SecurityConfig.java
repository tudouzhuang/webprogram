package org.example.project.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
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
                // 【【【核心修正1：恢复您最初的、正确的Lambda DSL写法】】】
                .csrf(csrf -> csrf.disable())
                .headers(headers -> headers
                .frameOptions(frameOptions -> frameOptions.sameOrigin())
                )
                .authorizeHttpRequests(authorize -> authorize
                // 【保留您已有的所有 permitAll 规则，不做任何修改】
                .antMatchers(
                    // 1. 纯静态页面和公共路由
                    "/login", "/signup", "/reset", "/404", "/index", "/",
                
                    // 2. 【核心修正】只放行登录和注册接口，不要放行整个 /api/users/**
                    "/api/users/signin", 
                    "/api/users/register", 
                
                    // 3. 静态资源 (保持不变)
                    "/static/**", "/assets/**", "/main/**", "/js/**", "/css/**",
                    "/favicon.ico", "/material/**", "/pdfjs/**", 
                    
                    // 4. Luckysheet 相关资源 (保持不变)
                    "/luckysheet/**", "/luckyexcel/**", "/luckysheet-iframe-loader.html",
                
                    // 5. 文件上传和预览资源 (保持不变)
                    "/uploads/**", "/templates/**",
                    "/api/files/content/**", "/api/files/templates/**"
                ).permitAll()
                // 其他所有请求都需要认证
                // 【【【核心修正2：为转交API添加明确的授权规则】】】
                // 允许任何已登录的用户访问转交接口，先确保功能跑通
                .antMatchers(HttpMethod.POST, "/api/process-records/**", "/api/problems/**")
                    .hasAnyRole("DESIGNER", "REVIEWER", "MANAGER", "ADMIN")
                // b. 允许 MANAGER 或 ADMIN 删除 process-records
                .antMatchers(HttpMethod.DELETE, "/api/process-records/**")
                .hasAnyRole("MANAGER", "ADMIN")
                .antMatchers(HttpMethod.DELETE, "/api/process-records/**", "/api/problems/**")
                .hasAnyRole("ADMIN", "MANAGER")
                // c. 允许 MANAGER 或 REVIEWER 对 problems 执行所有 POST 操作
                //    这会覆盖 /resolve, /close, /reopen 等
                .antMatchers(HttpMethod.POST, "/api/problems/**")
                .hasAnyRole("MANAGER", "REVIEWER", "ADMIN")
                // d. 允许 MANAGER 或 ADMIN 删除 problems
                .antMatchers(HttpMethod.DELETE, "/api/problems/**")
                .hasAnyRole("MANAGER", "ADMIN")
                // 【保留您已有的 anyRequest 规则】
                .anyRequest().authenticated()
                )
                
                // 【保留您已有的 formLogin 配置，不做任何修改】
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
                // 【保留您已有的 logout 配置，不做任何修改】
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
