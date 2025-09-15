package org.example.project.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.example.project.entity.ChecklistItem;
import org.example.project.mapper.ChecklistItemMapper;
import org.example.project.service.ChecklistItemService;
import org.example.project.vo.ChecklistItemVO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import java.io.File;
import java.io.IOException;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class ChecklistItemServiceImpl extends ServiceImpl<ChecklistItemMapper, ChecklistItem> implements ChecklistItemService {

    @Value("${file.upload-dir}")
    private String uploadDir;

    @Override
    public List<ChecklistItemVO> getChecklistItemsByRecordId(Long recordId) {
        return this.baseMapper.selectVoListByRecordId(recordId);
    }

    @Override
    public boolean updateChecklistItem(ChecklistItem item) {
        // TODO: 从Security上下文获取用户ID
        item.setCheckedByUserId(1L); // 临时用1L
        item.setCheckedAt(LocalDateTime.now());
        return this.updateById(item);
    }

    @Override
    public ChecklistItem addChecklistItem(ChecklistItem item) {
        // TODO: 从Security上下文获取用户ID
        item.setCheckedByUserId(1L); // 临时用1L
        item.setCheckedAt(LocalDateTime.now());
        this.save(item);
        return item;
    }

    @Override
    public String uploadScreenshot(Long itemId, MultipartFile file) {
        ChecklistItem item = this.getById(itemId);
        if (item == null || file.isEmpty()) {
            throw new IllegalArgumentException("Item not found or file is empty");
        }
        try {
            String originalFilename = file.getOriginalFilename();
            String fileExtension = "";
            if (originalFilename != null && originalFilename.contains(".")) {
                fileExtension = originalFilename.substring(originalFilename.lastIndexOf("."));
            }
            String newFilename = UUID.randomUUID().toString() + fileExtension;
            File destFile = new File(new File(uploadDir).getAbsolutePath(), newFilename);
            destFile.getParentFile().mkdirs();
            file.transferTo(destFile);
            String relativePath = Paths.get("uploads", newFilename).toString().replace("\\", "/");
            item.setScreenshotPath(relativePath);
            this.updateById(item);
            return relativePath;
        } catch (IOException e) {
            throw new RuntimeException("File upload failed", e);
        }
    }
}