package org.example.project.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private static final Logger log = LoggerFactory.getLogger(WebConfig.class);

    // 从 application.properties 中注入你配置的文件上传根目录
    @Value("${file.upload-dir}")
    private String uploadDir;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        
        // --- 保留你可能已有的对 /static/** 的处理 ---
        registry.addResourceHandler("/static/**")
                .addResourceLocations("classpath:/static/");
        // (根据你项目的实际情况，保留或添加对 main, assets 等目录的处理)
        registry.addResourceHandler("/main/**").addResourceLocations("classpath:/static/main/");
        registry.addResourceHandler("/js/**").addResourceLocations("classpath:/static/js/");
        registry.addResourceHandler("/material/**").addResourceLocations("classpath:/static/material/");
        
        // =======================================================
        // 【核心新增】：添加一个新的资源处理器，用于访问上传的文件
        // =======================================================

        // 1. 定义URL的访问模式：所有以 /uploads/ 开头的请求都会被这个处理器拦截。
        String resourceHandler = "/uploads/**";
        
        // 2. 定义物理文件位置：
        //    "file:" 前缀是必须的，它告诉Spring这是一个文件系统上的绝对路径。
        //    我们还需要确保路径的末尾有一个斜杠 "/"。
        String resourceLocation = "file:" + uploadDir.replace("\\", "/") + "/";
        
        // 3. 添加映射关系
        registry.addResourceHandler(resourceHandler)
                .addResourceLocations(resourceLocation);
        
        log.info("已配置静态资源映射：URL路径 '{}' -> 物理路径 '{}'", resourceHandler, resourceLocation);
    }
}