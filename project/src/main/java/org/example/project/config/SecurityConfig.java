package org.example.project.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.GrantedAuthority; // 【第一步】: 确保导入这个类
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
            .authorizeHttpRequests(authorize -> authorize // 使用新版API
                .antMatchers( // 使用新版API
                    "/login", "/signup", "/reset", "/404",
                    "/api/users/login", "/api/users/register",
                    "/static/**", "/assets/**", "/main/**", "/js/**", "/css/**", 
                    "/luckysheet/**", "/luckyexcel/**", "/favicon.ico", 
                    "/material/**", "/pdfjs/**", "/luckysheet-iframe-loader.html",
                    "/uploads/**", "/templates/**",
                    "/api/files/content/**", "/api/files/templates/**"
                ).permitAll()
                .anyRequest().authenticated()
            )
            .formLogin(form -> form
                .loginPage("/login")
                .loginProcessingUrl("/api/users/login")
                .successHandler((request, response, authentication) -> {
                    response.setContentType("application/json;charset=UTF-8");
                    response.setStatus(HttpServletResponse.SC_OK);

                    // 【第二步】: 将提取角色的逻辑填入
                    String userRole = authentication.getAuthorities().stream()
                            .findFirst()
                            .map(GrantedAuthority::getAuthority)
                            .map(role -> role.replace("ROLE_", ""))
                            .map(String::toLowerCase)
                            .orElse("designer"); // 安全默认值

                    Map<String, Object> result = new HashMap<>();
                    result.put("success", true);
                    result.put("message", "登录成功");
                    result.put("redirectUrl", "/index");
                    result.put("role", userRole); // <-- 将提取到的 userRole 变量作为值传入

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