// src/main/java/org/example/project/service/DesignWorkSessionService.java
package org.example.project.service;

import com.baomidou.mybatisplus.extension.service.IService;
import org.example.project.entity.DesignWorkSession;

public interface DesignWorkSessionService extends IService<DesignWorkSession> {
    DesignWorkSession startSession(Long recordId);
    void stopSession(Long sessionId);
    void recordHeartbeat(Long sessionId);
}