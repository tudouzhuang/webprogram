package org.example.project.service;

import java.util.List;
import java.util.Map;

public interface SpecialAuditorService {
    List<Map<String, Object>> getManagerList();
    void togglePrivilege(String username, Boolean enable);
    List<String> getActiveUsernames();
}