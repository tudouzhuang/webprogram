package org.example.project;

import org.mybatis.spring.annotation.MapperScan; // <--- 1. 导入这个注解
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@MapperScan("org.example.project.mapper") // <--- 2. 添加这一行！指定你的Mapper包路径
public class ProjectApplication {

    public static void main(String[] args) {
        SpringApplication.run(ProjectApplication.class, args);
    }

}