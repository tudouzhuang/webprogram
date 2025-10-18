// src/main/java/org/example/project/mapper/ReviewProblemMapper.java
package org.example.project.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.example.project.dto.ProblemSummaryDTO;
import org.example.project.dto.ReviewProblemVO; // 确保导入
import org.example.project.entity.ReviewProblem;

import java.util.List;

@Mapper
public interface ReviewProblemMapper extends BaseMapper<ReviewProblem> {

    /**
     * [新增] 根据 recordId 关联查询问题列表，并带上创建人和确认人的用户名
     */
    @Select("SELECT "
            + "  rp.*, "
            + "  creator.username AS created_by_username, "
            + "  confirmer.username AS confirmed_by_username "
            + "FROM "
            + "  review_problems rp "
            + "LEFT JOIN "
            + "  users creator ON rp.created_by_user_id = creator.id "
            + "LEFT JOIN "
            + "  users confirmer ON rp.confirmed_by_user_id = confirmer.id "
            + "WHERE "
            + "  rp.record_id = #{recordId} "
            + "ORDER BY "
            + "  rp.created_at DESC")
    List<ReviewProblemVO> findProblemsWithUsernameByRecordId(@Param("recordId") Long recordId);

    @Select("SELECT "
            + "SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) as openIssues, "
            + "SUM(CASE WHEN status = 'RESOLVED' THEN 1 ELSE 0 END) as resolvedIssues, "
            + "SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END) as closedIssues "
            + "FROM review_problems")
    ProblemSummaryDTO getProblemSummary();

}
