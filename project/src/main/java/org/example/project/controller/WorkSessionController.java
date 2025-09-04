// src/main/java/org/example/project/controller/WorkSessionController.java
package org.example.project.controller;

import org.example.project.entity.DesignWorkSession;
import org.example.project.service.DesignWorkSessionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/work-sessions")
public class WorkSessionController {

    @Autowired
    private DesignWorkSessionService sessionService;

    // 注意：我们将 start 接口放在了 ProcessRecordController 中，因为它与 recordId 强相关
    // 这里只处理针对具体 session 的操作

    @PostMapping("/{sessionId}/stop")
    public ResponseEntity<Void> stopSession(@PathVariable Long sessionId) {
        sessionService.stopSession(sessionId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{sessionId}/heartbeat")
    public ResponseEntity<Void> heartbeat(@PathVariable Long sessionId) {
        sessionService.recordHeartbeat(sessionId);
        return ResponseEntity.ok().build();
    }
}