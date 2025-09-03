// src/main/java/org/example/project/service/impl/ReviewProblemServiceImpl.java
package org.example.project.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.example.project.dto.ReviewProblemCreateDTO;
import org.example.project.entity.ReviewProblem;
import org.example.project.entity.ReviewProblemStatus;
import org.example.project.entity.User;
import org.example.project.mapper.ReviewProblemMapper;
import org.example.project.service.ReviewProblemService;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ReviewProblemServiceImpl extends ServiceImpl<ReviewProblemMapper, ReviewProblem> implements ReviewProblemService {

    @Override
    public List<ReviewProblem> findProblemsByRecordId(Long recordId) {
        // 使用 QueryWrapper 构建查询条件
        QueryWrapper<ReviewProblem> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("record_id", recordId);
        queryWrapper.orderByDesc("created_at"); // 按创建时间降序排序
        return this.list(queryWrapper);
    }

    @Override
    public ReviewProblem createProblem(Long recordId, ReviewProblemCreateDTO createDTO) {
        // 1. 获取当前登录的用户信息
        User currentUser = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (currentUser == null) {
            throw new IllegalStateException("无法获取当前用户信息，请登录后重试。");
        }

        // 2. 将 DTO 转换为 Entity
        ReviewProblem newProblem = new ReviewProblem();
        newProblem.setRecordId(recordId);
        newProblem.setStage(createDTO.getStage());
        newProblem.setProblemPoint(createDTO.getProblemPoint());
        newProblem.setDescription(createDTO.getDescription());

        // 3. 设置默认值和系统生成的值
        newProblem.setStatus(ReviewProblemStatus.OPEN); // 初始状态为 OPEN
        newProblem.setCreatedByUserId(currentUser.getId());
        newProblem.setCreatedAt(LocalDateTime.now());
        newProblem.setUpdatedAt(LocalDateTime.now());

        // 4. 保存到数据库
        this.save(newProblem); // this.save() 是 ServiceImpl 提供的方法

        return newProblem;
    }
}