// src/main/java/org/example/project/mapper/ChecklistItemMapper.java
package org.example.project.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.example.project.entity.ChecklistItem;
import org.example.project.vo.ChecklistItemVO;
import java.util.List;

@Mapper
public interface ChecklistItemMapper extends BaseMapper<ChecklistItem> {

    /**
     * 【【【已升级】】】
     * 根据 recordId 连接查询 checklist_items 和两次 users 表，
     * 返回带设计员和审核员用户名的VO列表
     * @param recordId 过程记录ID
     * @return VO列表
     */
    @Select("SELECT ci.*, " +
            "designer.username AS designedByUsername, " +
            "reviewer.username AS reviewedByUsername " +
            "FROM checklist_items ci " +
            "LEFT JOIN users designer ON ci.designed_by_user_id = designer.id " +
            "LEFT JOIN users reviewer ON ci.reviewed_by_user_id = reviewer.id " +
            "WHERE ci.record_id = #{recordId} " +
            "ORDER BY ci.id ASC")
    List<ChecklistItemVO> selectVoListByRecordId(@Param("recordId") Long recordId);
}