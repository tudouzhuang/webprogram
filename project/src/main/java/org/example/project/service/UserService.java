package org.example.project.service;
import org.example.project.entity.User;

import java.util.List;

import org.example.project.dto.UserRegisterDTO;

public interface UserService {
    void register(UserRegisterDTO userRegisterDTO);
    User findByUsername(String username);
    List<User> findUsersByRole(String role);
}