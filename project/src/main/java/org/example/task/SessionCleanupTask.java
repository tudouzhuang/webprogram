// src/main/java/org/example/project/task/SessionCleanupTask.java
package org.example.project.task;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.extern.slf4j.Slf4j;
import org.example.project.entity.DesignWorkSession;
import org.example.project.mapper.DesignWorkSessionMapper;
import org.example.project.service.DesignWorkSessionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Component
public class SessionCleanupTask {

    @Autowired
    private DesignWorkSessionService sessionService;
    @Autowired
    private DesignWorkSessionMapper sessionMapper;

    // fixedRate=900000 表示每 15 分钟执行一次
    @Scheduled(fixedRate = 900000) 
    public void cleanupInactiveSessions() {
        log.info("【定时任务】开始清理僵尸工作会话...");
        
        // 查找 15 分钟前没有心跳的活动会话
        LocalDateTime fifteenMinutesAgo = LocalDateTime.now().minusMinutes(15);
        
        QueryWrapper<DesignWorkSession> query = new QueryWrapper<>();
        query.eq("is_active", true)
             .lt("last_heartbeat_time", fifteenMinutesAgo);
             
        List<DesignWorkSession> inactiveSessions = sessionService.list(query);
        
        if (inactiveSessions.isEmpty()) {
            log.info("【定时任务】没有发现僵尸会话。");
            return;
        }
        
        log.warn("【定时任务】发现 {} 个僵尸会话，正在处理...", inactiveSessions.size());
        
        for (DesignWorkSession session : inactiveSessions) {
            session.setEndTime(session.getLastHeartbeatTime()); // 结束时间设为最后一次心跳时间
            session.setIsActive(false);
            
            long duration = Duration.between(session.getStartTime(), session.getEndTime()).getSeconds();
            session.setDurationSeconds((int) duration);
            
            sessionService.updateById(session);
            sessionMapper.addDurationToProcessRecord(session.getRecordId(), session.getDurationSeconds());
            
            log.info("【定时任务】已关闭僵尸会话 ID: {}, 持续时长: {} 秒。", session.getId(), session.getDurationSeconds());
        }
    }
}