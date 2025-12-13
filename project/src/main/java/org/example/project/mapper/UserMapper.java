// 文件路径: src/main/java/org/example/project/mapper/UserMapper.java
package org.example.project.mapper;

import java.util.List;
import java.util.Map;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.example.project.entity.User;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;

@Mapper
public interface UserMapper extends BaseMapper<User> {

    /**
     * 根据角色/身份查询用户列表。
     * 
     * @param role 角色名称 (例如 "REVIEWER")
     * @return 匹配该角色的用户列表
     */
    // 【核心修正】:
    // 1. 将 SQL 查询中的 `role` 字段名修改为 `identity`，以匹配数据库表结构。
    // 2. 将方法参数名从 `roleName` 修改为 `role`，以保持一致性。
    // 3. (推荐) 使用 @Param 注解，可以避免在复杂查询中参数名混淆的问题。
    @Select("SELECT * FROM users WHERE identity = #{role}")
    List<User> findByRole(@Param("role") String role);

    @Select({
        "<script>",
        "SELECT * FROM users WHERE identity IN ",
        "<foreach item='item' index='index' collection='roles' open='(' separator=',' close=')'>",
        "#{item}",
        "</foreach>",
        "</script>"
    })
    List<User> findUsersByRoles(@Param("roles") List<String> roles);

    @Select("SELECT * FROM users WHERE username = #{username}")
    User selectByUsername(@Param("username") String username);

    /**
     * 【修正】智能负载均衡查询
     * 修正点：WHERE u.role -> WHERE u.identity
     */
    @Select("SELECT u.*, COUNT(pr.id) as workload " +
            "FROM users u " +
            "LEFT JOIN process_records pr ON u.id = pr.assignee_id AND pr.status = 'PENDING_REVIEW' " +
            "WHERE u.identity = #{role} " + // <--- 关键修改：role 改为 identity
            "GROUP BY u.id " +
            "ORDER BY workload ASC, u.id ASC " +
            "LIMIT 1")
    User findLeastLoadedUserByRole(@Param("role") String role);

    // 统计待办任务数 (供 saveReviewSheet 中的智能分配使用)
    @Select("<script>" +
            "SELECT assignee_id as assigneeId, COUNT(*) as taskCount " +
            "FROM process_records " +
            "WHERE status = 'PENDING_REVIEW' AND assignee_id IN " +
            "<foreach item='id' collection='userIds' open='(' separator=',' close=')'>#{id}</foreach> " +
            "GROUP BY assignee_id" +
            "</script>")
    List<Map<String, Object>> countPendingTasksByAssignees(@Param("userIds") List<Long> userIds);
}