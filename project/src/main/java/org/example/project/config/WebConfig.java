package org.example.project.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import java.io.File;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private static final Logger log = LoggerFactory.getLogger(WebConfig.class);

    @Value("${file.upload-dir}")
    private String uploadDir;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        
        // --- 规则 1: 处理打包在JAR内的静态资源 (classpath resources) ---
        // 这个保持不变，服务于 /js, /css, /luckysheet 等
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/");
        log.info("已配置 Classpath 静态资源映射: URL '/**' -> Path '/static/'");

        // --- 规则 2: 处理位于项目根目录下的外部文件 ---
        File dir = new File(uploadDir);
        String absoluteUploadPath = dir.getAbsolutePath();
        
        String resourceLocation = "file:" + absoluteUploadPath.replace("\\", "/") + "/";
        
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(resourceLocation);
        
        log.info("已配置外部文件系统资源映射：URL '/uploads/**' -> 物理路径 '{}'", resourceLocation);
    }
}