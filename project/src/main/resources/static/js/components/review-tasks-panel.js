Vue.component('review-tasks-panel', {
    // 【Props】: 保持不变
    props: {
        projectId: {
            type: [String, Number],
            required: true
        }
    },
    // 【模板】: 注入了所有新状态对应的按钮和交互对话框
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
                        <el-table :data="reviewList" style="width: 100%" v-loading="isLoading">
                            <el-table-column prop="id" label="记录ID" width="80"></el-table-column>
                            <el-table-column prop="partName" label="零件名称" sortable></el-table-column>
                            
                            <!-- 新增: 当前处理人列 -->
                            <el-table-column label="当前处理人" width="120">
                                <template slot-scope="scope">
                                    <span v-if="scope.row.assignee">{{ scope.row.assignee.username }}</span>
                                    <el-tag v-else-if="scope.row.status === 'APPROVED' || scope.row.status === 'REJECTED'" type="info" size="mini">流程结束</el-tag>
                                    <span v-else>N/A</span>
                                </template>
                            </el-table-column>

                            <el-table-column prop="status" label="状态" width="120">
                                <template slot-scope="scope">
                                    <el-tag :type="getStatusTagType(scope.row.status)">
                                        {{ formatStatus(scope.row.status) }}
                                    </el-tag>
                                </template>
                            </el-table-column>

                            <el-table-column prop="updatedAt" label="最后更新" width="180" sortable>
                                <template slot-scope="scope">
                                    {{ formatDate(scope.row.updatedAt) }}
                                </template>
                            </el-table-column>

                            <!-- 核心改造: 操作列 -->
                            <el-table-column label="操作" width="250" fixed="right">
                                <template slot-scope="scope">
                                    <!-- 1. 状态: 待审核 (PENDING_REVIEW) -->
                                    <div v-if="scope.row.status === 'PENDING_REVIEW'">
                                        <el-button @click="reviewRecord(scope.row)" type="primary" size="small">开始审核</el-button>
                                        <el-button @click="openReassignDialog(scope.row)" type="warning" size="small" plain>转交</el-button>
                                    </div>

                                    <!-- 2. 状态: 已批准 (APPROVED) -->
                                    <div v-else-if="scope.row.status === 'APPROVED'">
                                        <el-button @click="viewRecord(scope.row)" type="text" size="small">查看详情</el-button>
                                        <el-button @click="openRequestChangesDialog(scope.row)" type="danger" size="small" plain>打回修改</el-button>
                                    </div>

                                    <!-- 3. 状态: 已驳回 (REJECTED) -->
                                    <div v-else-if="scope.row.status === 'REJECTED'">
                                        <el-button @click="viewRecord(scope.row)" type="text" size="small">查看详情</el-button>
                                    </div>

                                    <!-- 4. 状态: 要求修改 (CHANGES_REQUESTED) -->
                                    <div v-else-if="scope.row.status === 'CHANGES_REQUESTED'">
                                        <el-tag type="info" size="small">等待 {{ scope.row.assignee ? scope.row.assignee.username : '设计员' }} 修改</el-tag>
                                        <el-button @click="viewRecord(scope.row)" type="text" size="small" style="margin-left: 10px;">查看进度</el-button>
                                    </div>
                                    
                                    <!-- 5. 状态: 草稿 (DRAFT) - 通常在审核列表不可见，但以防万一 -->
                                     <div v-else-if="scope.row.status === 'DRAFT'">
                                        <el-tag type="info" size="small">设计员草稿</el-tag>
                                    </div>
                                </template>
                            </el-table-column>
                        </el-table>
                        
                        <p v-if="reviewList.length === 0" class="text-center text-muted mt-4">
                            该项目下暂无相关记录。
                         </p>
                    </div>
                </div>
            </div>

            <!-- 新增：转交任务对话框 -->
            <el-dialog title="转交审核任务" :visible.sync="reassignDialogVisible" width="400px" append-to-body>
                <div v-if="currentRecord">
                    <p>确定要将 <strong>{{ currentRecord.partName }}</strong> 的审核任务转交给其他审核员吗？</p>
                    <el-select v-model="selectedAssigneeId" placeholder="请选择新的审核员" filterable style="width: 100%;">
                        <el-option v-for="user in reviewerUsers" :key="user.id" :label="user.username" :value="user.id"></el-option>
                    </el-select>
                </div>
                <span slot="footer" class="dialog-footer">
                    <el-button @click="reassignDialogVisible = false">取 消</el-button>
                    <el-button type="primary" @click="handleReassign" :loading="isSubmitting">确 定 转 交</el-button>
                </span>
            </el-dialog>
    
            <!-- 新增：打回修改对话框 -->
            <el-dialog title="打回修改" :visible.sync="requestChangesDialogVisible" width="500px" append-to-body>
                 <div v-if="currentRecord">
                    <p>您将打回 <strong>{{ currentRecord.partName }}</strong>，请填写打回原因，以便设计员修改：</p>
                    <el-input type="textarea" :rows="4" placeholder="请输入详细的修改意见，例如：请注意第5行的尺寸标注有误，需要重新确认。" v-model="requestChangesComment"></el-input>
                </div>
                <span slot="footer" class="dialog-footer">
                    <el-button @click="requestChangesDialogVisible = false">取 消</el-button>
                    <el-button type="danger" @click="handleRequestChanges" :loading="isSubmitting">确 认 打 回</el-button>
                </span>
            </el-dialog>
        </div>
    `,
    
    data() {
        return {
            isLoading: false,
            reviewList: [],
            loadError: null,
            // --- 新增 data 属性 ---
            reassignDialogVisible: false,
            requestChangesDialogVisible: false,
            isSubmitting: false,
            currentRecord: null,      // 当前正在操作的记录对象
            reviewerUsers: [],        // 存储所有审核员用户列表
            selectedAssigneeId: null, // 转交时选中的新审核员ID
            requestChangesComment: '' // 打回修改的意见
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
            axios.get(`/api/projects/${this.projectId}/process-records`)
                .then(response => {
                    this.reviewList = response.data;
                })
                .catch(error => {
                    this.loadError = "加载审查列表失败，请刷新重试。";
                    this.$message.error("加载列表失败！");
                })
                .finally(() => {
                    this.isLoading = false;
                });
        },
        
        // --- 新增方法: 获取所有审核员用户 ---
        fetchReviewerUsers() {
            // 这个API需要你后端实现
            axios.get('/api/users?role=REVIEWER')
                .then(response => {
                    this.reviewerUsers = response.data;
                })
                .catch(error => {
                    this.$message.error("获取审核员列表失败！");
                });
        },

        // --- 核心操作方法 ---
        reviewRecord(record) {
            this.$emit('review-record', record.id);
        },
        viewRecord(record) {
            this.$emit('review-record', record.id);
        },

        // --- 新增: 打开对话框的方法 ---
        openReassignDialog(record) {
            this.currentRecord = record;
            this.selectedAssigneeId = null; // 重置
            this.reassignDialogVisible = true;
        },
        openRequestChangesDialog(record) {
            this.currentRecord = record;
            this.requestChangesComment = ''; // 重置
            this.requestChangesDialogVisible = true;
        },

        // --- 新增: 提交核心操作到后端的方法 ---
        handleReassign() {
            if (!this.selectedAssigneeId) {
                return this.$message.warning("请选择一位新的审核员！");
            }
            this.isSubmitting = true;
            // 调用你后端的转交API
            axios.post(`/api/process-records/${this.currentRecord.id}/reassign`, {
                newAssigneeId: this.selectedAssigneeId
            }).then(() => {
                this.$message.success("任务转交成功！");
                this.reassignDialogVisible = false;
                this.fetchReviewList(); // 操作成功后刷新列表
            }).catch(err => {
                this.$message.error("操作失败！" + (err.response.data.message || ''));
            }).finally(() => {
                this.isSubmitting = false;
            });
        },
        handleRequestChanges() {
            if (!this.requestChangesComment.trim()) {
                return this.$message.warning("请填写打回原因！");
            }
            this.isSubmitting = true;
            // 调用你后端的打回API
            axios.post(`/api/process-records/${this.currentRecord.id}/request-changes`, {
                comment: this.requestChangesComment
            }).then(() => {
                this.$message.success("已成功打回！任务已返回给设计员。");
                this.requestChangesDialogVisible = false;
                this.fetchReviewList(); // 操作成功后刷新列表
            }).catch(err => {
                this.$message.error("操作失败！" + (err.response.data.message || ''));
            }).finally(() => {
                this.isSubmitting = false;
            });
        },

        // --- 辅助格式化方法 (已更新) ---
        formatDate(dateString) {
            if (!dateString) return 'N/A';
            try { return new Date(dateString).toLocaleString(); } 
            catch (e) { return dateString; }
        },
        formatStatus(status) {
            const statusMap = { 
                'DRAFT': '草稿', 
                'PENDING_REVIEW': '待审核', 
                'APPROVED': '已批准', 
                'REJECTED': '已驳回',
                'CHANGES_REQUESTED': '修改中' // 新增
            };
            return statusMap[status] || status;
        },
        getStatusTagType(status) {
             const typeMap = { 
                'DRAFT': 'info', 
                'PENDING_REVIEW': 'warning', 
                'APPROVED': 'success', 
                'REJECTED': 'danger',
                'CHANGES_REQUESTED': 'primary' // 新增
             };
            return typeMap[status] || 'primary';
        },
        getDesignerName(jsonString) { // 此方法保持不变
            if (!jsonString) return 'N/A';
            try {
                const specData = JSON.parse(jsonString);
                return specData.designerName || '未知';
            } catch(e) { return '解析错误'; }
        }
    },

    mounted() {
        this.fetchReviewList();
        this.fetchReviewerUsers(); // 组件加载时，预先获取审核员列表
    },

    watch: {
        projectId(newId) {
            if (newId) {
                this.fetchReviewList();
            }
        }
    }
});