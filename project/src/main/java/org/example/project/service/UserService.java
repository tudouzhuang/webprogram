package org.example.project.service;

import com.baomidou.mybatisplus.extension.service.IService;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.example.project.dto.UserRegisterDTO;
import org.example.project.entity.User;
import java.util.List;

public interface UserService extends IService<User>, UserDetailsService {
    void register(UserRegisterDTO userRegisterDTO);
    User findByUsername(String username);
    List<User> findUsersByRole(String role); // 确保这行存在
    List<User> findAllUsers();             // 确保这行也存在
}