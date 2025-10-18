package org.example.project.mapper;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;
import org.example.project.entity.ProcessRecord;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;

// 将@Mapper注解放在接口上，指示MyBatis框架需要扫描并创建此接口的实现类
@Mapper
public interface ProcessRecordMapper extends BaseMapper<ProcessRecord> {

    @Select({
        "<script>",
        "SELECT assignee_id as assigneeId, COUNT(*) as taskCount",
        "FROM process_records",
        "WHERE status = 'PENDING_REVIEW' AND assignee_id IN",
        "<foreach item='id' collection='assigneeIds' open='(' separator=',' close=')'>",
        "#{id}",
        "</foreach>",
        "GROUP BY assignee_id",
        "</script>"
    })
    List<Map<String, Object>> countPendingTasksByAssignees(@Param("assigneeIds") List<Long> assigneeIds);

    @Select("SELECT DATE(updated_at) AS date, COUNT(*) AS count "
            + "FROM process_records "
            + "WHERE status IN ('APPROVED', 'CHANGES_REQUESTED') AND updated_at >= #{startDate} "
            + "GROUP BY DATE(updated_at) "
            + "ORDER BY date")
    List<Map<String, Object>> getReviewWorkloadByDate(LocalDate startDate);
}
