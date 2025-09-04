// src/main/java/org/example/project/service/impl/ReviewProblemServiceImpl.java
package org.example.project.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import lombok.extern.slf4j.Slf4j;
import org.example.project.dto.ReviewProblemCreateDTO;
import org.example.project.dto.ReviewProblemUpdateDTO;
import org.example.project.dto.ReviewProblemVO;
import org.example.project.entity.ReviewProblem;
import org.example.project.entity.ReviewProblemStatus;
import org.example.project.entity.User;
import org.example.project.mapper.ReviewProblemMapper;
import org.example.project.service.ReviewProblemService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
public class ReviewProblemServiceImpl extends ServiceImpl<ReviewProblemMapper, ReviewProblem> implements ReviewProblemService {

    @Value("${file.upload-dir}")
    private String uploadDir;

    @Override
    // 【修改返回类型和实现】
    public List<ReviewProblemVO> findProblemsByRecordId(Long recordId) {
        // 调用我们新创建的、带有JOIN查询的Mapper方法
        return baseMapper.findProblemsWithUsernameByRecordId(recordId);
    }

    @Override
    @Transactional
    public ReviewProblem createProblem(Long recordId, ReviewProblemCreateDTO createDTO) {
        User currentUser = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (currentUser == null) {
            throw new IllegalStateException("无法获取当前用户信息，请登录后重试。");
        }

        ReviewProblem newProblem = new ReviewProblem();
        newProblem.setRecordId(recordId);
        newProblem.setStage(createDTO.getStage());
        newProblem.setProblemPoint(createDTO.getProblemPoint());
        newProblem.setDescription(createDTO.getDescription());

        newProblem.setStatus(ReviewProblemStatus.OPEN);
        newProblem.setCreatedByUserId(currentUser.getId());
        newProblem.setCreatedAt(LocalDateTime.now());
        newProblem.setUpdatedAt(LocalDateTime.now());

        this.save(newProblem);
        return newProblem;
    }

    @Override
    @Transactional
    public ReviewProblem updateProblem(Long problemId, ReviewProblemUpdateDTO updateDTO) {
        ReviewProblem problem = this.getById(problemId);
        if (problem == null) {
            // 【FIX】 使用 RuntimeException 替代 EntityNotFoundException
            throw new RuntimeException("未找到ID为 " + problemId + " 的问题记录");
        }

        // 按需更新字段
        if (updateDTO.getStage() != null) {
            problem.setStage(updateDTO.getStage());
        }
        if (updateDTO.getProblemPoint() != null) {
            problem.setProblemPoint(updateDTO.getProblemPoint());
        }
        if (updateDTO.getDescription() != null) {
            problem.setDescription(updateDTO.getDescription());
        }
        if (updateDTO.getStatus() != null) {
            problem.setStatus(updateDTO.getStatus());
        }

        problem.setUpdatedAt(LocalDateTime.now());
        this.updateById(problem);
        return problem;
    }

    @Override
    @Transactional
    public void deleteProblem(Long problemId) {
        ReviewProblem problem = this.getById(problemId);
        if (problem != null) {
            // 1. 删除物理文件（如果存在）
            if (problem.getScreenshotPath() != null && !problem.getScreenshotPath().isEmpty()) {
                try {
                    // 使用 Paths.get() 来正确构建路径
                    String fileName = Paths.get(problem.getScreenshotPath()).getFileName().toString();
                    Path filePath = Paths.get(uploadDir, "screenshots", fileName);
                    Files.deleteIfExists(filePath);
                } catch (IOException e) {
                    log.error("删除截图文件失败: " + problem.getScreenshotPath(), e);
                }
            }
            // 2. 删除数据库记录
            this.removeById(problemId);
        }
    }

    @Override
    @Transactional
    public String uploadAndLinkScreenshot(Long problemId, MultipartFile file) throws IOException {
        ReviewProblem problem = this.getById(problemId);
        if (problem == null) {
            // 【FIX】 使用 RuntimeException 替代 EntityNotFoundException
            throw new RuntimeException("未找到ID为 " + problemId + " 的问题记录以关联截图");
        }

        // 1. 定义截图存储的子目录
        Path screenshotDir = Paths.get(uploadDir, "screenshots");
        if (!Files.exists(screenshotDir)) {
            Files.createDirectories(screenshotDir);
        }

        // 2. 生成唯一文件名
        String originalFilename = file.getOriginalFilename();
        String fileExtension = "";
        if (originalFilename != null && originalFilename.contains(".")) {
            fileExtension = originalFilename.substring(originalFilename.lastIndexOf("."));
        }
        String uniqueFileName = UUID.randomUUID().toString() + fileExtension;

        // 3. 保存文件到物理路径
        Path destinationFile = screenshotDir.resolve(uniqueFileName);
        Files.copy(file.getInputStream(), destinationFile);

        // 4. 生成可供Web访问的相对路径
        String webAccessiblePath = "/uploads/screenshots/" + uniqueFileName;

        // 5. 更新数据库记录
        problem.setScreenshotPath(webAccessiblePath);
        problem.setUpdatedAt(LocalDateTime.now());
        this.updateById(problem);

        return webAccessiblePath;
    }

    @Override
    @Transactional
    public ReviewProblem resolveProblem(Long problemId) {
        // 1. 获取问题
        ReviewProblem problem = this.getById(problemId);
        if (problem == null) {
            throw new RuntimeException("未找到ID为 " + problemId + " 的问题记录");
        }
        // 2. 检查状态是否为 OPEN
        if (problem.getStatus() != ReviewProblemStatus.OPEN) {
            throw new IllegalStateException("该问题当前状态不是'OPEN'，无法标记为已解决。");
        }
        // 3. 获取当前操作的设计员
        User currentUser = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();

        // 4. 更新状态和确认信息
        problem.setStatus(ReviewProblemStatus.RESOLVED); // 状态变为“已解决”
        problem.setConfirmedByUserId(currentUser.getId()); // 记录确认人
        problem.setConfirmedAt(LocalDateTime.now());       // 记录确认时间
        problem.setUpdatedAt(LocalDateTime.now());

        this.updateById(problem);
        return problem;
    }

    @Override
    @Transactional
    public ReviewProblem closeProblem(Long problemId) {
        ReviewProblem problem = this.getById(problemId);
        if (problem == null) {
            throw new RuntimeException("未找到ID为 " + problemId + " 的问题记录");
        }
        if (problem.getStatus() != ReviewProblemStatus.RESOLVED) {
            throw new IllegalStateException("该问题当前不是'待复核'状态，无法关闭。");
        }
        User currentUser = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        
        problem.setStatus(ReviewProblemStatus.CLOSED);
        problem.setUpdatedAt(LocalDateTime.now());
        
        this.updateById(problem);
        log.info("审核员 {} 已成功关闭问题 #{}", currentUser.getUsername(), problemId);
        
        return problem;
    }
}
