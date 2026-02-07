package org.example.project.entity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("audit_logs")
public class AuditLog {
    private Long id;
    private Long recordId;
    private Long operatorId;
    private String actionType; // 建议用常量或枚举：SUBMIT, REJECT, FIX, PASS
    private Integer auditRound;
    private String comment;
    private LocalDateTime createdAt;
}