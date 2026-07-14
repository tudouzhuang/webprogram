package org.example.project.controller;

import org.example.project.service.SpecialAuditorService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import lombok.Data;

@RestController
@RequestMapping("/api/special-auditors")
public class SpecialAuditorController {

    @Autowired
    private SpecialAuditorService specialAuditorService;

    /**
     * 内部专员：定义专用的安全传参载荷 DTO
     */
    @Data
    public static class ToggleDTO {
        private String username;
        private Boolean enable;
    }

    /**
     * 查询所有 Manager 及其特权状态
     */
    @GetMapping("/manager-list")
    public ResponseEntity<List<Map<String, Object>>> getManagerList() {
        return ResponseEntity.ok(specialAuditorService.getManagerList());
    }

    /**
     * 🔮【加固提效】：全面改用更安全的 @RequestBody JSON 管道流，免除 URL 中文乱码困扰
     */
    @PostMapping("/toggle")
    public ResponseEntity<Void> togglePrivilege(@RequestBody ToggleDTO dto) {
        specialAuditorService.togglePrivilege(dto.getUsername(), dto.getEnable());
        return ResponseEntity.ok().build();
    }

    /**
     * 获取所有已激活的特权用户名列表
     */
    @GetMapping("/active-usernames")
    public ResponseEntity<List<String>> getActiveUsernames() {
        return ResponseEntity.ok(specialAuditorService.getActiveUsernames());
    }
}