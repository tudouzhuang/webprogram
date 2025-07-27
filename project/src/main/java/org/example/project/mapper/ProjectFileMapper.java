package org.example.project.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.example.project.entity.ProjectFile;

/**
 * 项目关联文件的数据访问层 (Mapper)
 */
@Mapper // 告诉Spring这是一个MyBatis的Mapper接口，需要被扫描到
public interface ProjectFileMapper extends BaseMapper<ProjectFile> {
    // 继承了BaseMapper之后，就自动拥有了对ProjectFile实体的
    // insert, delete, update, selectById, selectList等所有常用方法。
    // 对于简单的增删改查，我们不需要写任何SQL。
}