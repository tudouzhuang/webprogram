package org.example.project.service;

import com.baomidou.mybatisplus.extension.service.IService;
import org.example.project.entity.ChecklistItem;
import org.example.project.vo.ChecklistItemVO;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;

public interface ChecklistItemService extends IService<ChecklistItem> {
    List<ChecklistItemVO> getChecklistItemsByRecordId(Long recordId);
    boolean updateChecklistItem(ChecklistItem item);
    ChecklistItem addChecklistItem(ChecklistItem item);
    String uploadScreenshot(Long itemId, MultipartFile file);
}