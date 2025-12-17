package org.example.project.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 项目关联文件实体类
 * 对应数据库中的 `project_files` 表。
 * 用于存储所有与项目或过程记录表相关联的文件信息。
 */
@Data
@TableName("project_files")
public class ProjectFile {

    /**
     * 文件ID，主键，自增
     */
    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 关联的项目ID，对应 projects.id
     */
    private Long projectId;

    /**
     * 关联的过程记录表ID，对应 process_records.id
     */
    private Long recordId;

    /**
     * 文件在服务器上存储的名称 (例如: PLAN-document.xlsx)
     */
    private String fileName;

    /**
     * 文件的业务类型 (例如: PLAN, CHECK_RECORD, REVIEW_SHEET, SOURCE)
     */
    private String documentType; 

    /**
     * 文件在服务器上的相对存储路径 (例如: 78/PLAN-document.xlsx)
     */
    private String filePath;

    /**
     * 文件的MIME类型 (例如: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)
     */
    private String fileType;

    /**
     * 文件记录的创建时间
     */
    private LocalDateTime createdAt;

    private Long parentId; // <--- 新增这行
}