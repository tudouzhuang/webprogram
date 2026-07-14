package org.example.project.mapper;

import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface SpecialAuditorMapper {

    /**
     * 精确查重特权表，杜绝主键冲突
     */
    @Select("SELECT COUNT(1) FROM sys_special_auditor WHERE username = #{username}")
    int countByUsername(@Param("username") String username);

    /**
     * 写入特权主管白名单
     */
    @Insert("INSERT INTO sys_special_auditor (username) VALUES (#{username})")
    int insertSpecialAuditor(@Param("username") String username);

    /**
     * 从白名单中移除特权主管
     */
    @Delete("DELETE FROM sys_special_auditor WHERE username = #{username}")
    int deleteSpecialAuditor(@Param("username") String username);

    /**
     * 获取当前所有已被激活的特权主管用户名列表
     */
    @Select("SELECT username FROM sys_special_auditor")
    List<String> getActiveUsernames();
}