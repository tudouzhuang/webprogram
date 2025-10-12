// public/components/workspace-status-bar.js

const WorkspaceStatusBar = {
    props: {
        fileId: { type: Number, required: true },
        recordInfo: { type: Object, required: true },
        liveStats: { type: Object, default: null }
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
            if (!this.recordInfo) return {};
            return {
                number: this.recordInfo.projectNumber || 'N/A',
                designer: this.recordInfo.designerName || 'N/A',
                proofreader: this.recordInfo.proofreaderName || 'N/A',
                auditor: this.recordInfo.auditorName || 'N/A'
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
        }
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
        <div class="card mb-3" style="border: 2px dashed red;">
            <!-- 【调试】在组件顶部添加一个清晰的视觉标记 -->
            <div style="position: absolute; top: -10px; left: 5px; background: red; color: white; padding: 2px 5px; font-size: 10px; z-index: 10;">
                DEBUG: WorkspaceStatusBar Component
            </div>

            <div class="card-body p-3">
                <!-- 状态一：正在加载 -->
                <div v-if="isLoading" class="text-center">
                    <p>正在加载统计信息...</p>
                    <el-progress :percentage="100" status="success" :indeterminate="true" :duration="1"></el-progress>
                </div>
                
                <!-- 状态二：加载出错 -->
                <div v-else-if="error" class="alert alert-danger">
                    <strong>组件内部错误:</strong> {{ error }}
                </div>
                
                <!-- 状态三：没有可显示的数据 -->
                <div v-else-if="!displayData" class="text-center text-muted">
                    <p>暂无统计数据 (displayData is null or undefined)</p>
                    <el-button size="mini" @click="fetchSavedStats">手动刷新</el-button>
                </div>
                
                <!-- 状态四：成功渲染 -->
                <div v-else>
                    <el-row :gutter="20">
                        <!-- 人员信息表格 -->
                        <el-col :span="8">
                             <table class="table table-bordered table-sm" style="font-size: 0.9em;">
                                <tbody>
                                    <tr><td style="width: 30%;">编号：</td><td>{{ personnelInfo.number }}</td></tr>
                                    <tr><td>设计人员：</td><td>{{ personnelInfo.designer }}</td></tr>
                                    <tr><td>校对人员：</td><td>{{ personnelInfo.proofreader }}</td></tr>
                                    <tr><td>审核人员：</td><td>{{ personnelInfo.auditor }}</td></tr>
                                </tbody>
                            </table>
                        </el-col>
                        
                        <!-- 统计表格 -->
                        <el-col :span="16">
                            <div class="d-flex justify-content-between align-items-center mb-1">
                                <h6 class="mb-0">统计信息</h6>
                                <span v-if="isDirty" class="text-warning small font-italic">*实时数据，未保存</span>
                            </div>
                            
                            <!-- 【调试】检查 displayData.stats 是否存在且为数组 -->
                            <div v-if="!displayData.stats || !Array.isArray(displayData.stats)" class="alert alert-warning small p-2">
                                <strong>数据结构警告:</strong> displayData.stats 不存在或不是一个数组。
                                <pre style="font-size: 10px;">{{ JSON.stringify(displayData, null, 2) }}</pre>
                            </div>
                            <el-table v-else :data="displayData.stats" border size="mini">
                                <el-table-column prop="category" label="分类" min-width="90"></el-table-column>
                                <el-table-column label="结果" align="center">
                                    <el-table-column prop="okCount" label="√ (OK)" min-width="60" align="center"></el-table-column>
                                    <el-table-column prop="ngCount" label="× (NG)" min-width="60" align="center"></el-table-column>
                                    <el-table-column prop="naCount" label="无 (N/A)" min-width="60" align="center"></el-table-column>
                                </el-table-column>
                                <el-table-column prop="totalCount" label="项数" min-width="60" align="center"></el-table-column>
                                <el-table-column prop="okPercentage" label="OK比例" min-width="80" align="center">
                                    <template slot-scope="scope">
                                        <span>{{ scope.row.okPercentage }}%</span>
                                    </template>
                                </el-table-column>
                            </el-table>
                        </el-col>
                    </el-row>
                </div>
            </div>
        </div>
    `
};