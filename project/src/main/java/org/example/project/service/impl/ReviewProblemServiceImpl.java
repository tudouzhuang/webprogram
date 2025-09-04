// src/main/java/org/example/project/service/impl/ReviewProblemServiceImpl.java

package org.example.project.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import lombok.extern.slf4j.Slf4j;
import org.example.project.dto.ReviewProblemCreateDTO;
import org.example.project.dto.ReviewProblemUpdateDTO;
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
    public List<ReviewProblem> findProblemsByRecordId(Long recordId) {
        QueryWrapper<ReviewProblem> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("record_id", recordId);
        queryWrapper.orderByDesc("created_at");
        return this.list(queryWrapper);
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
        if (updateDTO.getStage() != null) problem.setStage(updateDTO.getStage());
        if (updateDTO.getProblemPoint() != null) problem.setProblemPoint(updateDTO.getProblemPoint());
        if (updateDTO.getDescription() != null) problem.setDescription(updateDTO.getDescription());
        if (updateDTO.getStatus() != null) problem.setStatus(updateDTO.getStatus());
        
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
}