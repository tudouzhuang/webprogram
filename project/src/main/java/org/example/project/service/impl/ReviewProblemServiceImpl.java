package org.example.project.service.impl;

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
    public List<ReviewProblemVO> findProblemsByRecordId(Long recordId) {
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

        // 【新增】更新修改闭环信息
        if (updateDTO.getFixScreenshotPath() != null) {
            problem.setFixScreenshotPath(updateDTO.getFixScreenshotPath());
        }
        if (updateDTO.getFixComment() != null) {
            problem.setFixComment(updateDTO.getFixComment());
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
            // 删除原始问题截图
            deleteFileByWebPath(problem.getScreenshotPath());
            // 【新增】删除修改后的证明截图
            deleteFileByWebPath(problem.getFixScreenshotPath());

            // 2. 删除数据库记录
            this.removeById(problemId);
        }
    }

    // 辅助方法：根据Web路径删除物理文件
    private void deleteFileByWebPath(String webPath) {
        if (webPath != null && !webPath.isEmpty()) {
            try {
                String fileName = Paths.get(webPath).getFileName().toString();
                Path filePath = Paths.get(uploadDir, "screenshots", fileName);
                Files.deleteIfExists(filePath);
            } catch (IOException e) {
                log.error("删除截图文件失败: " + webPath, e);
            }
        }
    }

    @Override
    @Transactional
    public String uploadAndLinkScreenshot(Long problemId, MultipartFile file) throws IOException {
        ReviewProblem problem = this.getById(problemId);
        if (problem == null) {
            throw new RuntimeException("未找到ID为 " + problemId + " 的问题记录以关联截图");
        }

        String webAccessiblePath = saveScreenshotFile(file);

        // 更新数据库记录
        problem.setScreenshotPath(webAccessiblePath);
        problem.setUpdatedAt(LocalDateTime.now());
        this.updateById(problem);

        return webAccessiblePath;
    }

    @Override
    @Transactional
    public String uploadAndLinkFixScreenshot(Long problemId, MultipartFile file) throws IOException {
        ReviewProblem problem = this.getById(problemId);
        if (problem == null) {
            throw new RuntimeException("未找到ID为 " + problemId + " 的问题记录以关联修改截图");
        }

        // 复用文件保存逻辑，但加上前缀区分是个好习惯，或者直接复用
        String webAccessiblePath = saveScreenshotFile(file);

        // 更新数据库记录 - 设置 fix_screenshot_path
        problem.setFixScreenshotPath(webAccessiblePath);
        problem.setUpdatedAt(LocalDateTime.now());
        this.updateById(problem);

        return webAccessiblePath;
    }

    // 辅助方法：保存文件并返回Web路径
    private String saveScreenshotFile(MultipartFile file) throws IOException {
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
        return "/uploads/screenshots/" + uniqueFileName;
    }

    @Override
    @Transactional
    public ReviewProblem resolveProblem(Long problemId) {
        ReviewProblem problem = this.getById(problemId);
        if (problem == null) {
            throw new RuntimeException("未找到ID为 " + problemId + " 的问题记录");
        }
        // 允许从 OPEN 或 REJECTED(如果被复核打回) 状态转为 RESOLVED
        // 但通常是 OPEN -> RESOLVED。如果被打回，状态会变回 OPEN。
        if (problem.getStatus() != ReviewProblemStatus.OPEN) {
             throw new IllegalStateException("该问题当前状态不是'待解决'，无法标记为已解决。");
        }

        User currentUser = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();

        problem.setStatus(ReviewProblemStatus.RESOLVED);
        problem.setConfirmedByUserId(currentUser.getId()); 
        problem.setConfirmedAt(LocalDateTime.now());      
        problem.setUpdatedAt(LocalDateTime.now());

        this.updateById(problem);
        return problem;
    }

    @Override
    @Transactional
    public ReviewProblem reopenProblem(Long problemId, String comment) {
        ReviewProblem problem = this.getById(problemId);
        if (problem == null) {
            throw new RuntimeException("未找到ID为 " + problemId + " 的问题记录");
        }

        if (problem.getStatus() != ReviewProblemStatus.RESOLVED) {
            throw new IllegalStateException("该问题当前不是'待复核'状态，无法打回。");
        }

        User currentUser = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();

        problem.setStatus(ReviewProblemStatus.OPEN); 

        String originalDescription = problem.getDescription() == null ? "" : problem.getDescription();
        String rejectionLog = String.format("\n\n--- [打回于 %s by %s] ---\n%s",
                LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")),
                currentUser.getUsername(),
                comment
        );
        problem.setDescription(originalDescription + rejectionLog);

        problem.setConfirmedByUserId(null);
        problem.setConfirmedAt(null);
        problem.setUpdatedAt(LocalDateTime.now());

        this.updateById(problem);
        log.info("审核员 {} 已成功打回问题 #{}, 原因: {}", currentUser.getUsername(), problemId, comment);

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