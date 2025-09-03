// src/main/java/org/example/project/service/ReviewProblemService.java
package org.example.project.service;

import com.baomidou.mybatisplus.extension.service.IService;
import org.example.project.dto.ReviewProblemCreateDTO;
import org.example.project.entity.ReviewProblem;
import java.util.List;

public interface ReviewProblemService extends IService<ReviewProblem> {

    /**
     * 根据过程记录ID查找所有相关问题
     * @param recordId 过程记录ID
     * @return 问题列表
     */
    List<ReviewProblem> findProblemsByRecordId(Long recordId);

    /**
     * 为指定的过程记录创建一个新的问题
     * @param recordId 过程记录ID
     * @param createDTO 问题创建信息
     * @return 创建成功后的问题实体
     */
    ReviewProblem createProblem(Long recordId, ReviewProblemCreateDTO createDTO);
}