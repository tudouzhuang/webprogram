// src/main/java/org/example/project/service/impl/DesignWorkSessionServiceImpl.java
package org.example.project.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.example.project.entity.DesignWorkSession;
import org.example.project.entity.User;
import org.example.project.mapper.DesignWorkSessionMapper;
import org.example.project.service.DesignWorkSessionService;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Duration;
import java.time.LocalDateTime;

@Service
public class DesignWorkSessionServiceImpl extends ServiceImpl<DesignWorkSessionMapper, DesignWorkSession> implements DesignWorkSessionService {
    
    @Override
    @Transactional
    public DesignWorkSession startSession(Long recordId) {
        User currentUser = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        
        DesignWorkSession session = new DesignWorkSession();
        session.setRecordId(recordId);
        session.setUserId(currentUser.getId());
        session.setStartTime(LocalDateTime.now());
        session.setLastHeartbeatTime(LocalDateTime.now());
        session.setIsActive(true);
        
        this.save(session);
        return session;
    }

    @Override
    @Transactional
    public void stopSession(Long sessionId) {
        DesignWorkSession session = this.getById(sessionId);
        if (session != null && session.getIsActive()) {
            session.setEndTime(LocalDateTime.now());
            session.setIsActive(false);
            
            long duration = Duration.between(session.getStartTime(), session.getEndTime()).getSeconds();
            session.setDurationSeconds((int) duration);
            
            this.updateById(session);
            
            baseMapper.addDurationToProcessRecord(session.getRecordId(), session.getDurationSeconds());
        }
    }

    @Override
    public void recordHeartbeat(Long sessionId) {
        DesignWorkSession session = this.getById(sessionId);
        if (session != null && session.getIsActive()) {
            session.setLastHeartbeatTime(LocalDateTime.now());
            this.updateById(session);
        }
    }
}