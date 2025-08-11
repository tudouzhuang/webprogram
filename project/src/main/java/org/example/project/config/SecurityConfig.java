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
 * Spring Security 配置类 (黑名单模式)
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
            // =======================================================
            //  【白名单】：所有允许匿名访问的路径都放在这里
            // =======================================================
            .antMatchers(
                    // 1. 核心公共页面和API
                    "/login", 
                    "/signup", 
                    "/reset", 
                    "/404",
                    "/api/users/login", 
                    "/api/users/register",
                    
                    // 2. 网站基础静态资源
                    "/static/**", 
                    "/assets/**", 
                    "/main/**", 
                    "/js/**", 
                    "/css/**", 
                    "/luckysheet/**", 
                    "/luckyexcel/**", 
                    "/favicon.ico", 
                    "/material/**",
                    "/pdfjs/**", // 如果你还用pdf.js的话
                    "/luckysheet-iframe-loader.html", // iframe加载器
                    
                    // 3. 【核心修正】所有上传的文件和模板，需要公开给iframe访问
                    "/uploads/**",
                    "/templates/**",
                    
                    // 【重要】如果你有专门的文件下载API，也需要放行
                    "/api/files/content/**",
                    "/api/files/templates/**"
                    
            ).permitAll() // <-- 告诉Spring，以上所有路径都无需登录
        
            // =======================================================
            //  【黑名单】：除了上面白名单里的，其他所有请求都需要登录
            // =======================================================
            .anyRequest().authenticated() // <-- 这一行就足够了，它会处理所有未被上面permitAll()匹配到的请求
        )
        // 【配置表单登录】(保持不变)
        .formLogin(form -> form
            .loginPage("/login")
            .loginProcessingUrl("/api/users/login")
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
        )

        // 【配置登出】(保持不变)
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
        
        // =======================================================
        //  ↓↓↓ 【新增配置】解决 Iframe 嵌套显示问题 ↓↓↓
        // =======================================================
        .headers(headers -> headers
            .frameOptions(frameOptions -> frameOptions
                .sameOrigin() // 允许来自同源(same-origin)的页面将本站页面嵌套在 <frame> 或 <iframe> 中
            )
        )

        // 【关闭CSRF保护】(保持不变)
        .csrf(csrf -> csrf.disable());

        return http.build();
    }
}