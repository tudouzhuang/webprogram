package org.example.project.Controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * 页面导航控制器 (Page Navigation Controller)
 * 这个类的核心职责是作为项目的“页面路由器”或“导航员”，负责处理页面的路由和跳转。
 * 提供简洁、用户友好的URL路径（如 /login），并将这些请求精确地引导到存储在
 * /resources/static/ 目录下的实际物理HTML文件（如 /static/login.html）。
 * 工作机制:
 * 1. 使用 {@link Controller @Controller} 注解，将这个类声明为Spring MVC的控制器，专门用于处理页面导航。
 * 2. 使用 {@link GetMapping @GetMapping} 注解，将一个HTTP GET请求的URL路径（例如 "/login"）映射到一个具体处理方法上。
 * 3. 方法返回一个以 "forward:" 为前缀的字符串。这个前缀告诉Spring Boot执行一次“服务器内部转发”。
 * - 用户访问: /login
 * - 本控制器拦截请求，执行 toLogin() 方法
 * - 服务器内部转发到: /static/login.html 文件
 */
@Controller
public class PageController {

    @GetMapping("/login")
    public String toLogin() {
        return "forward:/static/login.html";
    }

    @GetMapping("/signup")
    public String toSignup() {
        return "forward:/static/signup.html";
    }

    @GetMapping("/reset")
    public String toReset() {
        return "forward:/static/reset-password.html";
    }

    @GetMapping("/index")
    public String toIndex() {
        return "forward:/static/index.html";
    }

    @GetMapping("/404")
    public String to404() {
        return "forward:/static/404.html";
    }

}