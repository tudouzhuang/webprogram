package org.example.project.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.example.project.entity.ProcessRecord;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;

// 将@Mapper注解放在接口上，指示MyBatis框架需要扫描并创建此接口的实现类
@Mapper
public interface ProcessRecordMapper extends BaseMapper<ProcessRecord> {
    // 继承BaseMapper接口后，不需要显式实现方法，BaseMapper已提供了基本操作。
}
