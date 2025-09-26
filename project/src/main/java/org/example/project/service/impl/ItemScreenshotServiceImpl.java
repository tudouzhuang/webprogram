package org.example.project.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.example.project.entity.ItemScreenshot;
import org.example.project.entity.User;
import org.example.project.mapper.ItemScreenshotMapper;
import org.example.project.mapper.UserMapper;
import org.example.project.service.ItemScreenshotService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service // 【核心】确保Spring能够扫描并管理这个Bean
public class ItemScreenshotServiceImpl extends ServiceImpl<ItemScreenshotMapper, ItemScreenshot> implements ItemScreenshotService {

    private static final Logger log = LoggerFactory.getLogger(ItemScreenshotServiceImpl.class);

    @Value("${file.upload-dir}")
    private String uploadDir;
    
    @Autowired
    private UserMapper userMapper;

    /**
     * 从Spring Security上下文中获取当前登录的用户实体。
     * @return 当前登录的User对象，如果未登录或找不到则返回null。
     */
    private User getCurrentUser() {
        try {
            Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
            if (principal instanceof UserDetails) {
                String username = ((UserDetails) principal).getUsername();
                return userMapper.selectByUsername(username);
            } else if (principal instanceof String) {
                return userMapper.selectByUsername((String) principal);
            }
        } catch (Exception e) {
            log.error("获取当前登录用户时发生异常", e);
        }
        return null;
    }

    /**
     * 根据检查项ID获取其所有的截图列表。
     */
    @Override
    public List<ItemScreenshot> getScreenshotsByItemId(Long itemId) {
        return this.list(new QueryWrapper<ItemScreenshot>().eq("item_id", itemId).orderByDesc("uploaded_at"));
    }

    /**
     * 将上传的截图文件附加到一个检查项上。
     * 包括：保存物理文件 + 创建数据库记录。
     */
    @Override
    @Transactional
    public ItemScreenshot attachScreenshotToItem(Long itemId, MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("上传文件不能为空。");
        }
        
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            throw new IllegalStateException("无法获取当前用户信息，无法上传文件。");
        }

        // 1. 保存物理文件
        String originalFilename = StringUtils.cleanPath(file.getOriginalFilename());
        String fileExtension = "";
        if (originalFilename.contains(".")) {
            fileExtension = originalFilename.substring(originalFilename.lastIndexOf("."));
        }
        String newFilename = UUID.randomUUID().toString() + fileExtension;
        
        // 构建存储的绝对物理路径
        Path physicalPath = Paths.get(this.uploadDir, newFilename);
        log.info("准备保存截图文件到物理路径: {}", physicalPath);

        // 确保父目录存在
        Files.createDirectories(physicalPath.getParent());
        // 复制文件
        Files.copy(file.getInputStream(), physicalPath);

        // 2. 创建数据库记录
        ItemScreenshot screenshot = new ItemScreenshot();
        screenshot.setItemId(itemId);
        screenshot.setUploaderId(currentUser.getId());
        screenshot.setFileName(originalFilename);
        // 存储用于Web访问的相对URL路径
        screenshot.setFilePath("/uploads/" + newFilename); 
        screenshot.setUploadedAt(LocalDateTime.now());
        
        this.save(screenshot);
        log.info("截图信息已保存到数据库, ID: {}", screenshot.getId());
        return screenshot;
    }

    /**
     * 删除一张指定的截图。
     * 包括：删除物理文件 + 删除数据库记录。
     */
    @Override
    @Transactional
    public void deleteScreenshot(Long screenshotId) {
        ItemScreenshot screenshot = this.getById(screenshotId);
        if (screenshot != null) {
            // 1. 删除物理文件
            try {
                // 从filePath中提取文件名进行删除，假设filePath是 /uploads/filename.ext
                String filename = Paths.get(screenshot.getFilePath()).getFileName().toString();
                Path physicalPath = Paths.get(this.uploadDir, filename);
                
                if(Files.deleteIfExists(physicalPath)) {
                    log.info("已成功删除物理文件: {}", physicalPath);
                } else {
                    log.warn("物理文件不存在，无需删除: {}", physicalPath);
                }
            } catch (IOException e) {
                // 记录日志，但继续执行，因为数据库记录删除更重要
                log.error("删除物理文件 {} 失败", screenshot.getFilePath(), e);
            }
            // 2. 删除数据库记录
            this.removeById(screenshotId);
            log.info("已成功删除数据库中的截图记录, ID: {}", screenshotId);
        } else {
            log.warn("尝试删除一个不存在的截图记录, ID: {}", screenshotId);
        }
    }
}