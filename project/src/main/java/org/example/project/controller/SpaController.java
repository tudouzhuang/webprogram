package org.example.project.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import javax.servlet.http.HttpServletRequest;

@Controller
public class SpaController {

    /**
     * 单页面应用(SPA)回退路由。
     * 只有当请求不是API (/api/**) 且不是静态资源 (不含.) 时，才转发到 index.html
     */
    @RequestMapping(value = {
            "/",
            "/{path:[^\\.]*}",
            "/view/{path:[^\\.]*}" // 可以为你将来的前端路由预留路径
    })
    public String forwardSpa(HttpServletRequest request) {
        String path = request.getRequestURI();
        // 增加一个额外的保护，防止意外匹配到API
        if (path.startsWith("/api/")) {
            // 理论上不会进入这里，因为API Controller优先级更高
            return null; 
        }
        return "forward:/index.html";
    }
}