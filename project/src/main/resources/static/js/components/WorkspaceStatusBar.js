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
        <div class="card"> <!-- 移除 mb-3，间距由父组件控制 -->
            <div class="card-body p-3">
                <div v-if="isLoading" class="text-center py-5">正在加载统计信息...</div>
                <div v-else>
                    <el-row :gutter="20" type="flex" align="middle">
                        
                        <!-- ======================= 区域一：项目人员 ======================= -->
                        <el-col :span="6">
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

                        <!-- 分隔线 -->
                        <el-col :span="1" class="text-center"><el-divider direction="vertical" style="height: 7em;"></el-divider></el-col>

                        <!-- ======================= 区域二：状态与时长 (KPI卡片化) ======================= -->
                        <el-col :span="6">
                             <h6 class="text-muted small font-weight-bold mb-2">状态与时长</h6>
                             <div class="d-flex flex-column" style="gap: 8px;">
                                <div class="d-flex justify-content-between align-items-center">
                                    <span class="text-muted">当前状态:</span>
                                    <el-tag :type="getStatusTagType(status)" size="medium">{{ formatStatus(status) }}</el-tag>
                                </div>
                                <div class="d-flex justify-content-between align-items-center">
                                    <span class="text-muted">累计时长:</span>
                                    <span class="font-weight-bold h6 mb-0">{{ formatDuration(totalDuration) }}</span>
                                </div>
                                <div class="d-flex justify-content-between align-items-center">
                                    <span class="text-muted">本次时长:</span>
                                    <span class="font-weight-bold h6 mb-0 text-primary">{{ formatDuration(sessionDuration) }}</span>
                                </div>
                             </div>
                        </el-col>

                        <!-- 分隔线 -->
                        <el-col :span="1" class="text-center"><el-divider direction="vertical" style="height: 7em;"></el-divider></el-col>
                        
                        <!-- ======================= 区域三：数据统计 ======================= -->
                        <el-col :span="10">
                            <div v-if="!displayData" class="text-center text-muted">暂无统计数据</div>
                            <div v-else>
                                <div class="d-flex justify-content-between align-items-center mb-1">
                                    <h6 class="text-muted small font-weight-bold">数据统计</h6>
                                    <span v-if="isDirty" class="text-warning small font-italic">*实时，未保存</span>
                                </div>
                                <el-table :data="displayData.stats" border size="mini" style="font-size: 0.8em;">
                                    <el-table-column prop="category" label="分类" min-width="80"></el-table-column>
                                    <el-table-column prop="okCount" label="√" min-width="45" align="center"></el-table-column>
                                    <el-table-column prop="ngCount" label="×" min-width="45" align="center"></el-table-column>
                                    <el-table-column prop="naCount" label="无" min-width="45" align="center"></el-table-column>
                                    <el-table-column prop="totalCount" label="项数" min-width="50" align="center"></el-table-column>
                                    <el-table-column prop="okPercentage" label="OK%" min-width="65" align="center">
                                        <template slot-scope="scope">{{ scope.row.okPercentage }}%</template>
                                    </el-table-column>
                                </el-table>
                            </div>
                        </el-col>

                    </el-row>
                </div>
            </div>
        </div>
    `
};