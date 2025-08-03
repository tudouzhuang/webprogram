Vue.component('review-tasks-panel', {
    // 【Props】: 和设计人员的列表一样，接收 projectId
    props: {
        projectId: {
            type: [String, Number],
            required: true
        }
    },
    // 【模板】: 修改了标题、描述和操作按钮
    template: `
            <div class="content-wrapper" style="width:100%;height:100%">
                <div class="card">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <div>
                                <h4 class="card-title">项目审查列表</h4>
                                <p class="card-description">
                                   项目ID: {{ projectId }} | 共查询到 {{ totalTasks }} 条相关记录
                                </p>
                            </div>
                            <div>
                                <el-button type="info" icon="el-icon-refresh" @click="fetchReviewList" circle title="刷新列表"></el-button>
                            </div>
                        </div>

                        <div v-if="isLoading" class="text-center p-5">
                            <p>正在加载审查任务列表...</p>
                            <i class="el-icon-loading" style="font-size: 24px;"></i>
                        </div>

                        <div v-else-if="loadError" class="alert alert-danger">
                            {{ loadError }}
                        </div>
                        
                        <div v-else>
                            <el-table
                                :data="reviewList"
                                style="width: 100%"
                                v-loading="isLoading">
                                
                                <el-table-column prop="id" label="记录ID" width="80"></el-table-column>
                                <el-table-column prop="partName" label="零件名称" sortable></el-table-column>
                                <el-table-column prop="processName" label="工序名称" sortable></el-table-column>
                                
                                <el-table-column label="提交人" width="120">
                                    <template slot-scope="scope">
                                        {{ getDesignerName(scope.row.specificationsJson) }}
                                    </template>
                                </el-table-column>

                                <el-table-column prop="status" label="状态" width="120">
                                    <template slot-scope="scope">
                                        <el-tag :type="getStatusTagType(scope.row.status)">
                                            {{ formatStatus(scope.row.status) }}
                                        </el-tag>
                                    </template>
                                </el-table-column>

                                <el-table-column prop="createdAt" label="提交时间" width="180" sortable>
                                    <template slot-scope="scope">
                                        {{ formatDate(scope.row.createdAt) }}
                                    </template>
                                </el-table-column>

                                <el-table-column label="操作" width="150" fixed="right">
                                    <template slot-scope="scope">
                                        <!-- 根据状态决定显示什么按钮 -->
                                        <el-button
                                            v-if="scope.row.status === 'PENDING_REVIEW'"
                                            @click="reviewRecord(scope.row)"
                                            type="primary"
                                            size="small">
                                            开始审核
                                        </el-button>
                                        <el-button
                                            v-else
                                            @click="viewReviewedRecord(scope.row)"
                                            type="text"
                                            size="small">
                                            查看详情
                                        </el-button>
                                    </template>
                                </el-table-column>
                            </el-table>
                            
                            <p v-if="reviewList.length === 0" class="text-center text-muted mt-4">
                                该项目下暂无需要您处理的审核任务或相关记录。
                             </p>
                        </div>
                    </div>
                </div>
            </div>
    `,
    
    data() {
        return {
            isLoading: false,
            reviewList: [], // 数据源命名为 reviewList
            loadError: null
        }
    },

    computed: {
        totalTasks() {
            return this.reviewList.length;
        }
    },

    methods: {
        // --- 数据获取 ---
        fetchReviewList() {
            if (!this.projectId) return;

            this.isLoading = true;
            this.loadError = null;
            // 【核心修改】调用一个新的API，获取特定项目中与当前审核人相关的记录
            axios.get(`/api/projects/${this.projectId}/process-records`)
                .then(response => {
                    this.reviewList = response.data;
                })
                .catch(error => {
                    this.loadError = "加载审查列表失败，请刷新重试。";
                    this.$message.error("加载列表失败！");
                    console.error("获取审查列表失败:", error);
                })
                .finally(() => {
                    this.isLoading = false;
                });
        },

        // --- 操作方法 ---
        reviewRecord(record) {
            // 触发事件，通知父组件切换到“记录审查”面板
            console.log("【ReviewListPanel】触发 review-record 事件, 记录ID:", record.id);
            this.$emit('review-record', record.id);
        },
        viewReviewedRecord(record) {
            console.log("【ReviewListPanel】触发 view-reviewed-record 事件 (将统一为 'review-record'), 记录ID:", record.id);
            // 【核心修正】: 发出与父组件监听器一致的事件名
            this.$emit('review-record', record.id); 
        },

        // --- 辅助格式化方法 (完全复用，保持不变) ---
        formatDate(dateString) {
            if (!dateString) return 'N/A';
            try { return new Date(dateString).toLocaleString(); } 
            catch (e) { return dateString; }
        },
        formatStatus(status) {
            const statusMap = { 'DRAFT': '草稿', 'PENDING_REVIEW': '待审核', 'APPROVED': '已批准', 'REJECTED': '已驳回' };
            return statusMap[status] || status;
        },
        getStatusTagType(status) {
             const typeMap = { 'DRAFT': 'info', 'PENDING_REVIEW': 'warning', 'APPROVED': 'success', 'REJECTED': 'danger' };
            return typeMap[status] || 'primary';
        },
        getDesignerName(jsonString) {
            if (!jsonString) return 'N/A';
            try {
                const specData = JSON.parse(jsonString);
                return specData.designerName || '未知';
            } catch(e) { return '解析错误'; }
        }
    },

    mounted() {
        console.log("【ReviewListPanel】已挂载，初始 projectId:", this.projectId);
        this.fetchReviewList();
    },

    watch: {
        // 监听 projectId 变化，当用户在侧边栏切换项目时，自动刷新列表
        projectId(newId, oldId) {
            console.log(`【ReviewListPanel】检测到 projectId 从 ${oldId} 变为 ${newId}`);
            if (newId && newId !== oldId) {
                this.fetchReviewList();
            }
        }
    }
});