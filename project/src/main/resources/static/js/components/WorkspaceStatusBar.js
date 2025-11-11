// public/js/components/workspace-status-bar.js

const WorkspaceStatusBar = {
    props: {
        fileId: { type: Number, required: true },
        recordInfo: { type: Object, required: true },
        liveStats: { type: Object, default: null },
        status: { type: String, required: true },
        totalDuration: { type: Number, default: 0 },
        sessionDuration: { type: Number, default: 0 }
    },
    data() {
        return {
            isLoading: false,
            savedStats: null,
            isDirty: false,
            error: null
        };
    },
    computed: {
        displayData() {
            return this.liveStats || this.savedStats;
        },

        // 【【【 最终修正版：优先使用 displayData，其次使用 recordInfo 】】】
        personnelInfo() {
            // --- 主数据源：尝试从 displayData (即 /statistics 接口) 获取 ---
            // 这是最理想的情况，因为后端 getSavedStats 方法已经帮我们查询并组装好了所有姓名。
            if (this.displayData && this.displayData.fileNumber) {
                return {
                    number: this.displayData.fileNumber || 'N/A',
                    designer: this.displayData.designerName || 'N/A',
                    proofreader: this.displayData.proofreaderName || 'N/A',
                    auditor: this.displayData.auditorName || 'N/A'
                };
            }

            // --- 后备数据源：如果主数据源不可用（例如在“问题记录”Tab），则从 recordInfo prop 中获取 ---
            // recordInfo 是父组件传递的基础信息，它始终存在。
            if (this.recordInfo) {
                console.warn("[StatusBar] 警告：statistics 数据源不可用或不包含人员信息，人员信息已回退到使用 recordInfo。");
                // 这里的字段名需要根据您 recordInfo 对象的实际结构来定
                return {
                    number: this.recordInfo.projectNumber || this.recordInfo.partName || 'N/A',
                    // 假设 recordInfo 中可能没有姓名，提供一个兜底
                    designer: this.recordInfo.designerName || '（未知）',
                    proofreader: this.recordInfo.proofreaderName || '（未知）',
                    auditor: this.recordInfo.auditorName || '（未知）'
                };
            }

            // --- 最终的兜底，在 recordInfo 也不存在时显示 ---
            return { number: '加载中...', designer: '加载中...', proofreader: '加载中...', auditor: '加载中...' };
        },

        overallTotalCount() {
            if (this.displayData && this.displayData.stats && this.displayData.stats.length > 0) {
                const statWithTotal = this.displayData.stats.find(s => s.totalCount > 0);
                return statWithTotal ? statWithTotal.totalCount : 0;
            }
            return 0;
        },

        // 【【【 核心修正：新增计算属性，用于控制统计模块的显示/隐藏 】】】
        shouldShowStatistics() {
            // 只有当 fileId 有效（大于0）时，才显示统计模块
            // 这会自动处理“表单元数据”和“问题记录”Tab (此时 fileId 会被父组件设为0)
            return this.fileId > 0;
        }
    },
    watch: {
        fileId: {
            immediate: true,
            handler(newId, oldId) {
                console.log(`[StatusBar - Watch] fileId changed from ${oldId} to ${newId}.`);

                // 【【【 核心修正：增加对无效 fileId 的处理 】】】
                if (newId && newId > 0) {
                    this.fetchSavedStats();
                } else {
                    console.warn('[StatusBar - Watch] fileId is invalid. Clearing stats and skipping fetch.');
                    this.savedStats = null; // 清空旧数据
                    this.error = null;      // 清空错误
                    this.isLoading = false; // 确保加载状态关闭
                }
            }
        },
        liveStats(newVal) {
            console.log('[StatusBar - Watch] liveStats has been updated:', newVal);
            if (newVal && JSON.stringify(newVal) !== JSON.stringify(this.savedStats)) {
                this.isDirty = true;
            } else {
                this.isDirty = false;
            }
        }
    },
    methods: {
        fetchSavedStats() {
            console.log(`[StatusBar - Method] fetchSavedStats called for fileId: ${this.fileId}`);
            this.isLoading = true;
            this.error = null;

            axios.get(`/api/files/${this.fileId}/statistics`)
                .then(response => {
                    console.log('[StatusBar - Axios SUCCESS] Successfully fetched stats:', response.data);
                    if (typeof response.data === 'object' && response.data !== null) {
                        this.savedStats = response.data;
                        this.isDirty = false;
                    } else {
                        this.error = '从服务器返回的数据格式不正确。';
                        this.savedStats = null;
                    }
                })
                .catch(error => {
                    console.error("[StatusBar - Axios FAILED] 加载统计数据失败:", error.response || error);
                    this.error = `加载统计数据失败: ${error.message || '未知网络错误'}`;
                    this.savedStats = null;
                })
                .finally(() => {
                    console.log('[StatusBar - Method] fetchSavedStats finished.');
                    this.isLoading = false;
                });
        },
        formatDuration(totalSeconds) {
            if (totalSeconds == null || totalSeconds < 0) return '暂无记录';
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            return `${hours} 小时 ${minutes} 分钟 ${seconds} 秒`;
        },
        formatStatus(status) {
            const statusMap = { 'DRAFT': '草稿', 'PENDING_REVIEW': '审核中', 'APPROVED': '已通过', 'REJECTED': '已驳回', 'CHANGES_REQUESTED': '待修改' };
            return statusMap[status] || status;
        },
        getStatusTagType(status) {
            const typeMap = { 'DRAFT': 'info', 'PENDING_REVIEW': 'warning', 'APPROVED': 'success', 'REJECTED': 'danger', 'CHANGES_REQUESTED': 'primary' };
            return typeMap[status] || 'primary';
        },
    },
    mounted() {
        console.log('[StatusBar - Lifecycle] Component has been MOUNTED.');
    },
    template: `
        <div class="card">
            <div class="card-body p-3">
                <!-- ======================= 区域一：顶部KPI指标卡 (保持不变) ======================= -->
                <el-row :gutter="20" class="mb-3">
                    <el-col :span="8">
                        <div class="kpi-card">
                            <div class="kpi-label text-muted">当前状态</div>
                            <div class="kpi-value">
                                <el-tag :type="getStatusTagType(status)" size="medium" effect="dark">{{ formatStatus(status) }}</el-tag>
                            </div>
                        </div>
                    </el-col>
                    <el-col :span="8">
                        <div class="kpi-card">
                            <div class="kpi-label text-muted">累计设计时长</div>
                            <div class="kpi-value h5 mb-0 font-weight-bold">{{ formatDuration(totalDuration) }}</div>
                        </div>
                    </el-col>
                    <el-col :span="8">
                        <div class="kpi-card">
                            <div class="kpi-label text-muted">本次设计时长</div>
                            <div class="kpi-value h5 mb-0 font-weight-bold text-primary">{{ formatDuration(sessionDuration) }}</div>
                        </div>
                    </el-col>
                </el-row>

                <el-divider></el-divider>

                <!-- ======================= 区域二：底部详细信息 ======================= -->
                <el-row :gutter="20">
                    <!-- 左侧：项目人员 (保持不变) -->
                    <el-col :span="9">
                        <h6 class="text-muted small font-weight-bold mb-2">项目人员</h6>
                        <table class="table table-bordered table-sm m-0" style="font-size: 0.85em;">
                            <tbody>
                                <tr><td style="width: 35%;" class="font-weight-bold bg-light">记录表编号</td><td>{{ personnelInfo.number }}</td></tr>
                                <tr><td class="font-weight-bold bg-light">设计人员</td><td>{{ personnelInfo.designer }}</td></tr>
                                <tr><td class="font-weight-bold bg-light">校对人员</td><td>{{ personnelInfo.proofreader }}</td></tr>
                                <tr><td class="font-weight-bold bg-light">审核人员</td><td>{{ personnelInfo.auditor }}</td></tr>
                            </tbody>
                        </table>
                    </el-col>
                    
                    <!-- 
                        【【【 核心修正：用 v-if="shouldShowStatistics" 包裹整个统计模块 】】】 
                        栅格系统总分为 24，(9 + 15 = 24)。当统计模块隐藏时，人员信息会自动撑满整行。
                    -->
                    <el-col :span="15" v-if="shouldShowStatistics">
                        <div v-if="isLoading" class="text-center text-muted pt-4"><i class="el-icon-loading"></i> 正在加载统计...</div>
                        <div v-else-if="error" class="alert alert-danger p-2 small">{{ error }}</div>
                        <div v-else-if="!displayData || !displayData.stats || displayData.stats.length === 0" class="text-center text-muted" style="padding-top: 20px;">暂无统计数据</div>
                        <div v-else>
                            <div class="d-flex justify-content-between align-items-center mb-1">
                                <h6 class="text-muted small font-weight-bold">数据统计</h6>
                                <div>
                                    <span class="text-muted small mr-2"><strong>总项数: {{ overallTotalCount }}</strong></span>
                                    <span v-if="isDirty" class="text-warning small font-italic">*实时，未保存</span>
                                </div>
                            </div>
                            <el-table :data="displayData.stats" border size="mini" style="font-size: 0.8em;">
                                <el-table-column prop="category" label="分类" min-width="100"></el-table-column>
                                <el-table-column prop="okCount" label="√" min-width="45" align="center"></el-table-column>
                                <el-table-column prop="ngCount" label="×" min-width="45" align="center"></el-table-column>
                                <el-table-column prop="naCount" label="无" min-width="45" align="center"></el-table-column>
                                <el-table-column prop="okPercentage" label="OK%" min-width="65" align="center">
                                    <template slot-scope="scope">{{ scope.row.okPercentage }}%</template>
                                </el-table-column>
                            </el-table>
                        </div>
                    </el-col>
                    
                </el-row>
            </div>
        </div>
        <style>
            .kpi-card { padding: 10px; background-color: #f8f9fa; border-radius: 4px; text-align: center; }
            .kpi-label { font-size: 0.8em; margin-bottom: 5px; }
        </style>
    `
};