package org.example.project.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.example.project.entity.SheetStatistic;

/**
 * 表格统计结果表的 Mapper 接口
 */
@Mapper
public interface SheetStatisticMapper extends BaseMapper<SheetStatistic> {
    // 继承 BaseMapper 后，常规的 CRUD 方法会自动拥有，无需在此定义
}