// src/main/java/org/example/project/controller/ChecklistItemController.java
package org.example.project.controller;

import org.example.project.entity.ChecklistItem;
import org.example.project.entity.ItemScreenshot; // 引入
import org.example.project.service.ChecklistItemService;
import org.example.project.service.ItemScreenshotService; // 引入
import org.example.project.vo.ChecklistItemVO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api")
public class ChecklistItemController {

    @Autowired
    private ChecklistItemService checklistItemService;

    @Autowired
    private ItemScreenshotService screenshotService;

    /**
     * GET /api/records/{recordId}/items
     * 获取指定设计记录下的所有检查项卡片列表 (已包含截图)
     */
    @GetMapping("/records/{recordId}/items")
    public ResponseEntity<List<ChecklistItemVO>> getItemsByRecordId(@PathVariable Long recordId) {
        List<ChecklistItemVO> items = checklistItemService.getChecklistItemsByRecordId(recordId);
        return ResponseEntity.ok(items);
    }

    /**
     * PUT /api/items/{itemId}
     * 更新单个检查项卡片 (状态、备注)
     */
    @PutMapping("/items/{itemId}")
    public ResponseEntity<Void> updateItem(@PathVariable Long itemId, @RequestBody ChecklistItem updatedItem) {
        updatedItem.setId(itemId);
        checklistItemService.updateChecklistItem(updatedItem);
        return ResponseEntity.ok().build();
    }

    /**
     * POST /api/records/{recordId}/items
     * 审核员动态添加一个新的问题卡片
     */
    @PostMapping("/records/{recordId}/items")
    public ResponseEntity<ChecklistItem> addItemToRecord(@PathVariable Long recordId, @RequestBody ChecklistItem newItem) {
        newItem.setRecordId(recordId);
        ChecklistItem createdItem = checklistItemService.addChecklistItem(newItem);
        return ResponseEntity.ok(createdItem);
    }

    /**
     * POST /api/items/{itemId}/screenshots
     * 【新】为检查项上传一张截图
     */
    @PostMapping("/items/{itemId}/screenshots")
    public ResponseEntity<ItemScreenshot> uploadScreenshot(@PathVariable Long itemId, @RequestParam("file") MultipartFile file) throws IOException {
        ItemScreenshot newScreenshot = screenshotService.attachScreenshotToItem(itemId, file);
        return ResponseEntity.ok(newScreenshot);
    }

    /**
     * DELETE /api/screenshots/{screenshotId}
     * 【新】删除一张指定的截图
     */
    @DeleteMapping("/screenshots/{screenshotId}")
    public ResponseEntity<Void> deleteScreenshot(@PathVariable Long screenshotId) {
        screenshotService.deleteScreenshot(screenshotId);
        return ResponseEntity.noContent().build();
    }
}