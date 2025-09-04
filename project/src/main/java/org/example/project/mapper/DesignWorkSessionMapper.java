// src/main/java/org/example/project/mapper/DesignWorkSessionMapper.java
package org.example.project.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;
import org.example.project.entity.DesignWorkSession;

@Mapper
public interface DesignWorkSessionMapper extends BaseMapper<DesignWorkSession> {
    
    @Update("UPDATE process_records SET total_design_duration_seconds = total_design_duration_seconds + #{duration} WHERE id = #{recordId}")
    void addDurationToProcessRecord(@Param("recordId") Long recordId, @Param("duration") int duration);
}