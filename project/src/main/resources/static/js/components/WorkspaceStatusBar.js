// public/components/workspace-status-bar.js

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
            error: null // 【调试】新增一个错误信息属性
        };
    },
    computed: {
        displayData() {
            // 【调试】在计算属性中加入日志
            console.log('[StatusBar - Computed] displayData is being calculated. liveStats:', this.liveStats, 'savedStats:', this.savedStats);
            return this.liveStats || this.savedStats;
        },
        // 【调试】新增一个用于模板展示的 personnelInfo 计算属性
        personnelInfo() {
            // displayData 是我们的 "真理之源"，它要么是 savedStats，要么是 liveStats
            if (!this.displayData) return {};
            return {
                number: this.displayData.fileNumber || 'N/A',
                designer: this.displayData.designerName || 'N/A',
                proofreader: this.displayData.proofreaderName || 'N/A',
                auditor: this.displayData.auditorName || 'N/A'
            };
        },
        // 【【【 新增这个计算属性 】】】
        overallTotalCount() {
            if (this.displayData && this.displayData.stats && this.displayData.stats.length > 0) {
                // 查找第一个 totalCount 大于 0 的记录，并返回它的 totalCount
                const statWithTotal = this.displayData.stats.find(s => s.totalCount > 0);
                if (statWithTotal) {
                    return statWithTotal.totalCount;
                }
                // 如果所有记录的 totalCount 都是0，则返回0
                return 0;
            }
            // 如果没有数据，也返回0
            return 0;
        }
    },
    watch: {
        fileId: {
            immediate: true,
            handler(newId, oldId) {
                // 【调试】监听 fileId 变化
                console.log(`[StatusBar - Watch] fileId changed from ${oldId} to ${newId}.`);
                if (newId) {
                    this.fetchSavedStats();
                } else {
                    console.warn('[StatusBar - Watch] fileId is null or invalid. Skipping fetch.');
                }
            }
        },
        liveStats(newVal) {
            // 【调试】监听 liveStats 变化
            console.log('[StatusBar - Watch] liveStats has been updated:', newVal);
            this.isDirty = newVal !== null;
        }
    },
    methods: {
        fetchSavedStats() {
            console.log(`[StatusBar - Method] fetchSavedStats called for fileId: ${this.fileId}`);
            this.isLoading = true;
            this.error = null; // 【调试】每次请求前清空错误信息

            axios.get(`/api/files/${this.fileId}/statistics`)
                .then(response => {
                    // 【调试】打印成功获取的数据
                    console.log('[StatusBar - Axios SUCCESS] Successfully fetched stats:', response.data);
                    
                    // 【调试】增加一个检查，确保返回的是一个对象
                    if (typeof response.data === 'object' && response.data !== null) {
                        this.savedStats = response.data;
                        this.isDirty = false;
                    } else {
                        console.error('[StatusBar - Axios ERROR] Response data is not a valid object:', response.data);
                        this.error = '从服务器返回的数据格式不正确。';
                        this.savedStats = null;
                    }
                })
                .catch(error => {
                    // 【调试】打印详细的错误信息
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
            if (totalSeconds == null || totalSeconds < 0) {
                return '暂无记录';
            }
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
    // 【【【 核心调试：在 mounted 钩子中打印初始 props 】】】
    mounted() {
        console.log('[StatusBar - Lifecycle] Component has been MOUNTED.');
        console.log('[StatusBar - Initial Props]', {
            fileId: this.fileId,
            recordInfo: JSON.parse(JSON.stringify(this.recordInfo)), // 深拷贝以清晰地查看初始值
            liveStats: this.liveStats
        });
    },
template: `
    <div class="card">
        <div class="card-body p-3">
            <div v-if="isLoading" class="text-center py-5">正在加载统计信息...</div>
            <div v-else>
                <!-- ======================= 区域一：顶部KPI指标卡 ======================= -->
                <el-row :gutter="20" class="mb-3">
                    <!-- KPI 1: 当前状态 -->
                    <el-col :span="8">
                        <div class="kpi-card">
                            <div class="kpi-label text-muted">当前状态</div>
                            <div class="kpi-value">
                                <el-tag :type="getStatusTagType(status)" size="medium" effect="dark">{{ formatStatus(status) }}</el-tag>
                            </div>
                        </div>
                    </el-col>
                    <!-- KPI 2: 累计时长 -->
                    <el-col :span="8">
                        <div class="kpi-card">
                            <div class="kpi-label text-muted">累计设计时长</div>
                            <div class="kpi-value h5 mb-0 font-weight-bold">{{ formatDuration(totalDuration) }}</div>
                        </div>
                    </el-col>
                    <!-- KPI 3: 本次时长 -->
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
                    <!-- 左侧：项目人员 -->
                    <el-col :span="9">
                        <h6 class="text-muted small font-weight-bold mb-2">项目人员</h6>
                        <table class="table table-bordered table-sm m-0" style="font-size: 0.85em;">
                            <tbody>
                                <tr><td style="width: 35%;" class="font-weight-bold bg-light">编号</td><td>{{ personnelInfo.number }}</td></tr>
                                <tr><td class="font-weight-bold bg-light">设计人员</td><td>{{ personnelInfo.designer }}</td></tr>
                                <tr><td class="font-weight-bold bg-light">校对人员</td><td>{{ personnelInfo.proofreader }}</td></tr>
                                <tr><td class="font-weight-bold bg-light">审核人员</td><td>{{ personnelInfo.auditor }}</td></tr>
                            </tbody>
                        </table>
                    </el-col>
                    
                    <!-- 右侧：数据统计 -->
                    <el-col :span="15">
                        <div v-if="!displayData || !displayData.stats || displayData.stats.length === 0" class="text-center text-muted" style="padding-top: 20px;">暂无统计数据</div>
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

        <!-- 【【【 新增：为KPI卡片添加样式 】】】 -->
        <style>
            .kpi-card {
                padding: 10px;
                background-color: #f8f9fa;
                border-radius: 4px;
                text-align: center;
            }
            .kpi-label {
                font-size: 0.8em;
                margin-bottom: 5px;
            }
        </style>
    `
};