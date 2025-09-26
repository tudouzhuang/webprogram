// src/main/java/org/example/project/service/ItemScreenshotService.java
package org.example.project.service;

import com.baomidou.mybatisplus.extension.service.IService;
import org.example.project.entity.ItemScreenshot;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.util.List;

public interface ItemScreenshotService extends IService<ItemScreenshot> {
    List<ItemScreenshot> getScreenshotsByItemId(Long itemId);
    ItemScreenshot attachScreenshotToItem(Long itemId, MultipartFile file) throws IOException;
    void deleteScreenshot(Long screenshotId);
}