// src/main/java/org/example/project/entity/ReviewProblemStatus.java
package org.example.project.entity;

public enum ReviewProblemStatus {
    OPEN,       // 已提出 (由审核员创建，等待设计员修改)
    RESOLVED,   // 已解决 (由设计员确认修改，等待审核员复核)
    CLOSED      // 已关闭 (由审核员确认修改无误)
}