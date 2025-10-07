// src/main/java/org/example/project/service/ReviewProblemService.java
package org.example.project.service;

import com.baomidou.mybatisplus.extension.service.IService;
import org.example.project.dto.ReviewProblemCreateDTO;
import org.example.project.dto.ReviewProblemUpdateDTO;
import org.example.project.dto.ReviewProblemVO;
import org.example.project.entity.ReviewProblem;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

public interface ReviewProblemService extends IService<ReviewProblem> {

    /**
     * 根据过程记录ID查找所有相关问题
     * @param recordId 过程记录ID
     * @return 问题列表
     */
    List<ReviewProblemVO> findProblemsByRecordId(Long recordId);

    /**
     * 为指定的过程记录创建一个新的问题
     * @param recordId 过程记录ID
     * @param createDTO 问题创建信息
     * @return 创建成功后的问题实体
     */
    ReviewProblem createProblem(Long recordId, ReviewProblemCreateDTO createDTO);

        /**
     * 更新问题详情
     */
    ReviewProblem updateProblem(Long problemId, ReviewProblemUpdateDTO updateDTO);

    /**
     * 删除问题（包括关联的截图文件）
     */
    void deleteProblem(Long problemId);

    /**
     * 上传并关联截图
     */
    String uploadAndLinkScreenshot(Long problemId, MultipartFile file) throws IOException;
    
    /**
     * [NEW] 解决一个问题
     */
    ReviewProblem resolveProblem(Long problemId);

    ReviewProblem closeProblem(Long problemId);
    
    ReviewProblem reopenProblem(Long problemId, String comment);
}