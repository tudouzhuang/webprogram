package org.example.project.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data; // 确保已添加Lombok依赖

import java.time.LocalDateTime;

/**
 * 项目关联文件实体类
 * 对应数据库中的 `project_files` 表
 */
@Data // Lombok注解，自动生成getters, setters, toString等方法
@TableName("project_files") // 告诉MyBatis-Plus这个类对应哪张表
public class ProjectFile {

    /**
     * 文件ID，主键，自增
     */
    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 关联的项目ID，对应projects表的主键
     */
    private Long projectId;

    /**
     * 文件名 (例如: Sheet1.png)
     */
    private String fileName;


    private String documentType; 
    /**
     * 文件在服务器上的相对存储路径
     * (例如: 123/images/Sheet1.png)
     */
    private String filePath;

    /**
     * 文件MIME类型 (例如: image/png)
     */
    private String fileType;

    /**
     * 文件记录的创建时间
     */
    private LocalDateTime createdAt;

    public void setDocumentType(String documentType) {
        this.documentType = documentType;
    }
    public String getDocumentType() {
        return this.documentType;
    }

    private Long recordId; // 新增字段

}