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
            // 【第一优先级】：白名单，放行所有公共资源和静态文件 (保持不变)
            .antMatchers(
                    "/login", "/signup", "/reset", "/404", 
                    "/api/users/login", "/api/users/register",
                    "/static/**", "/assets/**", "/main/**", "/js/**", "/css/**", 
                    "/luckysheet/**", "/luckyexcel/**", "/favicon.ico", "/material/**",
                    // 【重要】确保你的iframe加载器HTML也被放行
                    "/luckysheet-iframe-loader.html", 
                    // 【重要】确保模板文件API被放行（如果模板对未登录用户也可见）
                    "/templates/**" 
            ).permitAll()

            // 【第二优先级】：黑名单，保护所有需要登录才能访问的资源 (保持不变)
            .antMatchers(
                    "/", 
                    "/index",
                    "/api/projects/**",
                    "/api/files/**"
            ).authenticated()

            // 【最低优先级】：其他任何未匹配的请求，也需要登录 (保持不变)
            .anyRequest().authenticated()
        )

        // 【第三步：配置表单登录】(保持不变)
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

        // 【第四步：配置登出】(保持不变)
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
        //  ↓↓↓ 【核心修正】在这里添加解决 iframe 问题的 headers 配置 ↓↓↓
        // =======================================================
        .headers(headers -> headers
            .frameOptions(frameOptions -> frameOptions
                .sameOrigin() // 允许来自同源的页面嵌套在iframe中
            )
        )

        // 【第五步：关闭CSRF保护】(保持不变)
        .csrf(csrf -> csrf.disable());

        return http.build();
    }
}