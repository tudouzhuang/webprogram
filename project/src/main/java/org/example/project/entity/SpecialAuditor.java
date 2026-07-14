package org.example.project.entity;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class SpecialAuditor {
    private String username;
    private LocalDateTime createdAt;
}