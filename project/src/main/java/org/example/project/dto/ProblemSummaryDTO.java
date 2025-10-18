package org.example.project.dto;

import lombok.Data;

@Data
public class ProblemSummaryDTO {
    private long openIssues;
    private long resolvedIssues;
    private long closedIssues;
}