package org.example.project.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.example.project.entity.User;
import org.example.project.mapper.UserMapper;
import org.example.project.mapper.SpecialAuditorMapper;
import org.example.project.service.SpecialAuditorService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class SpecialAuditorServiceImpl implements SpecialAuditorService {

    @Autowired
    private SpecialAuditorMapper specialAuditorMapper;

    @Autowired
    private UserMapper userMapper; // 🔮 注入您项目原生的用户 Mapper，利用 MyBatis-Plus 的动态表名主防线

    @Override
    public List<Map<String, Object>> getManagerList() {
        // 1. 动用 MyBatis-Plus 核心引擎，安全、动态地拉取所有 identity 为 manager 的用户
        // 这一步会根据您 User 实体类上的 @TableName 注解自动找到真正的表名，绝不报 500 错误
        QueryWrapper<User> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("identity", "manager");
        List<User> managers = userMapper.selectList(queryWrapper);

        // 2. 查出当前已经在特权白名单表里的全部用户名
        List<String> activeSpecialUsernames = specialAuditorMapper.getActiveUsernames();

        // 3. 在内存中完成平滑的高速流式拼装，无缝对齐前端所需要的数据格式
        List<Map<String, Object>> resultList = new ArrayList<>();
        for (User user : managers) {
            Map<String, Object> map = new HashMap<>();
            map.put("realName", user.getRealName());
            map.put("username", user.getUsername());
            // 如果特权白名单包含当前用户的用户名，则设为 true，否则为 false
            map.put("isSpecial", activeSpecialUsernames.contains(user.getUsername()));
            resultList.add(map);
        }

        return resultList;
    }

    @Override
    public void togglePrivilege(String username, Boolean enable) {
        if (Boolean.TRUE.equals(enable)) {
            if (specialAuditorMapper.countByUsername(username) == 0) {
                specialAuditorMapper.insertSpecialAuditor(username);
            }
        } else {
            specialAuditorMapper.deleteSpecialAuditor(username);
        }
    }

    @Override
    public List<String> getActiveUsernames() {
        return specialAuditorMapper.getActiveUsernames();
    }
}