package org.example.project.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import org.example.project.entity.AuditLog;
import java.util.List;

/**
 * 审核日志 Mapper
 * 继承 BaseMapper 以获得标准的 CRUD 能力
 */
@Mapper
public interface AuditLogMapper extends BaseMapper<AuditLog> {

    /**
     * 根据过程记录 ID 查询所有相关的审核流转轨迹
     * 按照时间倒序排列，方便前端展示时间轴
     */
    @Select("SELECT * FROM audit_logs WHERE record_id = #{recordId} ORDER BY created_at DESC")
    List<AuditLog> selectByRecordId(Long recordId);
    
    // 如果你以后需要按轮次筛选，也可以加在这里
}