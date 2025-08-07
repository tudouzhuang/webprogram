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
 * Spring Security 配置类 (推荐的黑名单模式)
 * <p>
 * 核心策略：默认所有请求都需要认证。
 * 只有明确列出的公共资源（如登录页、静态文件）才允许匿名访问。
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
        .authorizeRequests(authorize -> authorize
            // 【第一优先级】：白名单，放行所有公共资源和静态文件
            .antMatchers(
                    // 公共页面
                    "/login", "/signup", "/reset", "/404", 
                    // 公共API
                    "/api/users/login", "/api/users/register",
                    // 所有静态资源 - 这是解决CSS问题的关键
                    "/static/**", "/assets/**", "/main/**", "/js/**", "/css/**", 
                    "/luckysheet/**", "/luckyexcel/**", "/favicon.ico","/material/**","/templates/**"
            ).permitAll()

            // 【第二优先级】：黑名单，保护所有需要登录才能访问的资源
            .antMatchers(
                    "/", 
                    "/index",
                    "/api/projects/**", // 保护所有项目数据API
                    "/api/files/**"     // 保护所有文件下载API
            ).authenticated()

            // 【最低优先级】：其他任何未匹配的请求，也需要登录
            .anyRequest().authenticated()
        )

            // 【第三步：配置表单登录】
            .formLogin(form -> form
                .loginPage("/login")
                .loginProcessingUrl("/api/users/login")
                // 【核心修正】填回完整的成功处理器
                .successHandler((request, response, authentication) -> {
                    response.setContentType("application/json;charset=UTF-8");
                    response.setStatus(HttpServletResponse.SC_OK);
                    Map<String, Object> result = new HashMap<>();
                    result.put("success", true);
                    result.put("message", "登录成功");
                    result.put("redirectUrl", "/index");
                    response.getWriter().write(new ObjectMapper().writeValueAsString(result));
                })
                // 【核心修正】填回完整的失败处理器
                .failureHandler((request, response, exception) -> {
                    response.setContentType("application/json;charset=UTF-8");
                    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                    Map<String, Object> result = new HashMap<>();
                    result.put("success", false);
                    result.put("message", "用户名或密码不正确");
                    response.getWriter().write(new ObjectMapper().writeValueAsString(result));
                })
            )

            // 【第四步：配置登出】
            .logout(logout -> logout
                .logoutUrl("/api/users/logout")
                // 【核心修正】填回完整的登出成功处理器
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

            // 【第五步：关闭CSRF保护】
            .csrf(csrf -> csrf.disable());

        return http.build();
    }
}