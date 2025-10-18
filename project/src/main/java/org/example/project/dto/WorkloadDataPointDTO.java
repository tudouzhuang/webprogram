package org.example.project.dto;

import lombok.Data;
import java.time.LocalDate;

@Data
public class WorkloadDataPointDTO {
    private LocalDate date;
    private long count;
}