package org.example.project.Config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 静态资源映射配置 (Static Resource Mapping Configuration)
 * 这个配置类用于明确地告诉Spring MVC如何处理静态资源的请求。
 * 它建立了一个URL路径与项目内部文件路径之间的映射关系。
 * 主要作用:
 * 当浏览器或服务器内部请求一个以 "/static/" 开头的URL时，
 * Spring会去项目的 "classpath:/static/" 目录下寻找对应的文件。
 * 这对于 PageController 中 "forward:/static/..." 的内部转发至关重要，
 * 确保了转发请求能够被正确解析并找到对应的HTML文件。
 */
@Configuration
public class StaticResourceConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // addResourceHandler: 定义URL的访问路径，"/static/**"表示任何以/static/开头的请求。
        // addResourceLocations: 定义这些请求应该映射到的物理文件位置，"classpath:/static/" 指向src/main/resources/static/目录。
        registry.addResourceHandler("/static/**")
                .addResourceLocations("classpath:/static/");
    }
}