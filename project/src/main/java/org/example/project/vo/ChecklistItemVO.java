package org.example.project.vo;

import lombok.Data;
import lombok.EqualsAndHashCode;
import org.example.project.entity.ChecklistItem;

@Data
@EqualsAndHashCode(callSuper = true)
public class ChecklistItemVO extends ChecklistItem {
    private String checkedByUsername;
}