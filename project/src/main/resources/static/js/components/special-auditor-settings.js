// src/main/resources/static/js/components/special-auditor-settings.js

Vue.component('special-auditor-settings', {
    // 【Template】: 采用反引号多行字符串，Element UI 高颜值拟物卡片布局
    template: `
        <div class="card mt-4" style="max-width: 800px; margin: 20px auto; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <div class="card-body" style="padding: 25px;">
                <!-- 头部标题区 -->
                <div class="d-flex align-items-center mb-4">
                    <div class="p-2 rounded-circle mr-3" style="background-color: #ecf5ff; color: #409EFF;">
                        <i class="el-icon-lock" style="font-size: 28px;"></i>
                    </div>
                    <div>
                        <h4 class="card-title mb-1" style="font-weight: 700; color: #303133; font-size: 18px;">下图特权主管管控后台</h4>
                        <p class="text-muted mb-0" style="font-size: 13px;">动态分配或收回临下图阶段存在遗留项时的最高强制批准放行权限</p>
                    </div>
                </div>

                <!-- 业务引导提示 -->
                <el-alert 
                    title="流转控制合规说明" 
                    type="info" 
                    description="开启特权开关的主管（Manager）可在图纸存在未关闭缺陷时，点击右上角【批准】执行特权强行下图。若关闭或抹空所有特权人，系统自动降级恢复为大盘所有 Manager 均可放行的初始策略。" 
                    :closable="false" 
                    show-icon
                    class="mb-4"
                    style="line-height: 1.4;">
                </el-alert>

                <!-- 人员特权开关控制表 -->
                <el-table 
                    :data="managers" 
                    v-loading="isLoading"
                    stripe 
                    border 
                    style="width: 100%"
                    size="medium"
                    :header-cell-style="{ background: '#f5f7fa', color: '#606266', fontWeight: 'bold' }">
                    
                    <el-table-column prop="realName" label="主管姓名" width="160" align="center">
                        <template slot-scope="scope">
                            <span style="font-weight: 600; color: #303133;">{{ scope.row.realName }}</span>
                        </template>
                    </el-table-column>
                    
                    <el-table-column prop="username" label="系统内部账号 / 工号" min-width="220" show-overflow-tooltip></el-table-column>
                    
                    <el-table-column label="下图审批特权" width="180" align="center">
                        <template slot-scope="scope">
                            <el-switch 
                                v-model="scope.row.isSpecial"
                                active-color="#13ce66"
                                inactive-color="#ff4949"
                                active-text="已授权"
                                inactive-text="未授权"
                                @change="(val) => handleTogglePrivilege(scope.row)">
                            </el-switch>
                        </template>
                    </el-table-column>
                </el-table>
            </div>
        </div>
    `,

    // 【Data】: 组件内部响应式状态
    data() {
        return {
            managers: [],
            isLoading: false
        };
    },

    // 【Mounted】: 生命周期钩子，挂载完毕后立刻拉取数据
    mounted() {
        this.fetchManagers();
    },

    // 【Methods】: 核心业务网络管线
    methods: {
        // 拉取所有 Manager 人员及特权状态
        fetchManagers() {
            this.isLoading = true;
            axios.get('/api/special-auditors/manager-list')
                .then(res => {
                    // 🔮 核心转换：后端传来的 0/1 智能双向绑定为 Vue 的布尔值驱动 el-switch
                    this.managers = (res.data || []).map(m => ({
                        ...m,
                        isSpecial: !!m.isSpecial
                    }));
                })
                .catch(err => {
                    this.$message.error('加载主管特权清单失败');
                    console.error(err);
                })
                .finally(() => {
                    this.isLoading = false;
                });
        },
        
// 切换特权开关
        handleTogglePrivilege(row) {
            // 🔮【前端对齐改造】：不再往 URL 后面硬挂带中文字符的 query，改用标准的 JSON Body 发包
            axios.post('/api/special-auditors/toggle', {
                username: row.username,
                enable: row.isSpecial
            })
            .then(() => {
                this.$message({
                    message: `操作成功！已动态【${row.isSpecial ? '赋予' : '收回'}】${row.realName} 的下图放行特权。`,
                    type: row.isSpecial ? 'success' : 'warning'
                });
            })
            .catch(err => {
                this.$message.error('同步服务器权限失败，请检查系统日志');
                row.isSpecial = !row.isSpecial; // 护盾机制：网络异常时强行回滚开关状态
                console.error("【特权管控错误日志】:", err);
            });
        }
    }
});