package org.example.project.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.example.project.entity.StatisticRule;

/**
 * 统计规则表的 Mapper 接口
 */
@Mapper
public interface StatisticRuleMapper extends BaseMapper<StatisticRule> {
    // 继承 BaseMapper 后，常规的 CRUD 方法会自动拥有，无需在此定义
}