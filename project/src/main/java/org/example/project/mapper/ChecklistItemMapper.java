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

    @Select("SELECT ci.*, u.username as checkedByUsername " +
            "FROM checklist_items ci " +
            "LEFT JOIN users u ON ci.checked_by_user_id = u.id " +
            "WHERE ci.record_id = #{recordId} " +
            "ORDER BY ci.id ASC")
    List<ChecklistItemVO> selectVoListByRecordId(@Param("recordId") Long recordId);

}