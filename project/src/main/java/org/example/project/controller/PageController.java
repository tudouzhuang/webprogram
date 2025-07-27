package org.example.project.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

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