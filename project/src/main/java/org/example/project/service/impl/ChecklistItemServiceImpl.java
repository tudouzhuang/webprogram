package org.example.project.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.example.project.entity.ChecklistItem;
import org.example.project.entity.User;
import org.example.project.entity.enums.ChecklistItemStatus;
import org.example.project.mapper.ChecklistItemMapper;
import org.example.project.mapper.UserMapper; // 引入 UserMapper
import org.example.project.service.ChecklistItemService;
import org.example.project.service.ItemScreenshotService;
import org.example.project.vo.ChecklistItemVO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

@Service
public class ChecklistItemServiceImpl extends ServiceImpl<ChecklistItemMapper, ChecklistItem> implements ChecklistItemService {

    @Autowired
    private ItemScreenshotService screenshotService;

    @Autowired
    private UserMapper userMapper; // 注入UserMapper以便查询用户信息

    /**
     * 从Spring Security上下文中获取当前登录的用户实体。
     * @return 当前登录的User对象，如果未登录或找不到则返回null。
     */
    private User getCurrentUser() {
        try {
            Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
            if (principal instanceof UserDetails) {
                String username = ((UserDetails) principal).getUsername();
                // 使用 UserMapper 从数据库中查找完整的用户信息
                return userMapper.selectByUsername(username); // 假设UserMapper中有此方法
            } else if (principal instanceof String) {
                // 有时 principal 只是一个用户名字符串
                return userMapper.selectByUsername((String) principal);
            }
        } catch (Exception e) {
            // 在获取用户失败时记录日志，而不是让程序崩溃
            System.err.println("获取当前登录用户时发生异常: " + e.getMessage());
        }
        return null;
    }


    /**
     * 获取指定记录下的所有检查项，并附带相关的用户名和截图列表。
     */
    @Override
    public List<ChecklistItemVO> getChecklistItemsByRecordId(Long recordId) {
        // 1. 调用Mapper的自定义方法，获取包含了用户名的VO列表
        List<ChecklistItemVO> voList = this.baseMapper.selectVoListByRecordId(recordId);
        
        // 2. 遍历每个VO，为其附加截图列表
        voList.forEach(vo -> {
            vo.setScreenshots(screenshotService.getScreenshotsByItemId(vo.getId()));
        });
        
        return voList;
    }


    /**
     * 更新单个检查项。核心业务逻辑在这里：根据当前用户的角色，决定更新哪些字段。
     * @param itemFromRequest 从前端请求体中接收到的要更新的数据。
     * @return 是否更新成功。
     */
    @Override
    @Transactional
    public boolean updateChecklistItem(ChecklistItem itemFromRequest) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            throw new IllegalStateException("无法获取当前用户信息，更新操作被拒绝。");
        }

        // 从数据库中获取最新的数据记录，避免覆盖冲突
        ChecklistItem itemInDb = this.getById(itemFromRequest.getId());
        if (itemInDb == null) {
            throw new IllegalArgumentException("找不到ID为 " + itemFromRequest.getId() + " 的检查项。");
        }

        String role = currentUser.getIdentity();

        // 根据用户角色进行分支处理
        if ("DESIGNER".equalsIgnoreCase(role)) {
            // 设计员只能更新“设计员”相关的字段
            itemInDb.setDesignerStatus(itemFromRequest.getDesignerStatus());
            itemInDb.setDesignerRemarks(itemFromRequest.getDesignerRemarks());
            itemInDb.setDesignedByUserId(currentUser.getId());
            itemInDb.setDesignedAt(LocalDateTime.now());
            
        } else if ("REVIEWER".equalsIgnoreCase(role) || "MANAGER".equalsIgnoreCase(role) || "ADMIN".equalsIgnoreCase(role)) {
            // 审核员或管理员可以更新“审核员”相关的字段
            // 注意：业务上，审核员不应该直接修改设计员的自检状态和备注，而是填写自己的
            itemInDb.setReviewerStatus(itemFromRequest.getReviewerStatus());
            itemInDb.setReviewerRemarks(itemFromRequest.getReviewerRemarks());
            itemInDb.setReviewedByUserId(currentUser.getId());
            itemInDb.setReviewedAt(LocalDateTime.now());

        } else {
            throw new SecurityException("权限不足：当前用户角色 (" + role + ") 无权修改检查项。");
        }
        
        // 将更新后的数据保存回数据库
        return this.updateById(itemInDb);
    }


    /**
     * 新增一个检查项（通常由审核员在审核过程中动态添加）。
     * @param newItem 从前端接收到的新检查项数据。
     * @return 创建成功并带有ID的检查项对象。
     */
    @Override
    public ChecklistItem addChecklistItem(ChecklistItem newItem) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            throw new IllegalStateException("无法获取当前用户信息，新增操作被拒绝。");
        }
        
        // 新增的问题项，创建时就记录审核员的信息
        newItem.setReviewerStatus(newItem.getReviewerStatus() != null ? newItem.getReviewerStatus() : ChecklistItemStatus.PENDING);
        newItem.setReviewerRemarks(newItem.getReviewerRemarks());
        newItem.setReviewedByUserId(currentUser.getId());
        newItem.setReviewedAt(LocalDateTime.now());
        
        // 设计员相关的状态默认为 PENDING，等待设计员处理
        newItem.setDesignerStatus(ChecklistItemStatus.PENDING);

        this.save(newItem);
        return newItem;
    }

    /**
     * 【【【补全的抽象方法实现】】】
     * (这个方法现在被废弃，因为我们使用 ItemScreenshotService 来处理截图)
     * (但为了满足接口要求，我们必须提供一个实现)
     * 
     * @deprecated 请使用 ItemScreenshotService.attachScreenshotToItem()
     */
    @Override
    @Deprecated
    public String uploadScreenshot(Long itemId, org.springframework.web.multipart.MultipartFile file) {
        // 因为业务逻辑已经转移到 ItemScreenshotService，这里可以抛出异常或返回null
        // 抛出异常是更好的选择，因为它能明确告诉调用者这个方法不应该再被使用
        throw new UnsupportedOperationException("此方法已废弃，请调用 ItemScreenshotService 中的方法上传截图。");
    }
}