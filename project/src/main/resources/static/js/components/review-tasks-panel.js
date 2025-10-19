Vue.component('review-tasks-panel', {
    props: {
        projectId: {
            type: [String, Number],
            required: true
        },
        currentUser: {
            type: Object,
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
                            <!-- 【【【 核心修改：升级筛选区域 】】】 -->
                            <div class="d-flex align-items-center mt-2" style="gap: 20px;">
                                <!-- 开关 -->
                                <div v-if="currentUser">
                                    <el-switch
                                        v-model="showMyTasksOnly"
                                        active-text="只看我的待办">
                                    </el-switch>
                                </div>
                                <!-- 状态筛选下拉框 -->
                                <div>
                                    <el-select 
                                        v-model="selectedStatuses" 
                                        multiple 
                                        collapse-tags
                                        placeholder="按状态筛选" 
                                        style="width: 280px;"
                                        size="small"
                                        clearable>
                                        <el-option label="待审核 (PENDING_REVIEW)" value="PENDING_REVIEW"></el-option>
                                        <el-option label="已批准 (APPROVED)" value="APPROVED"></el-option>
                                        <el-option label="修改中 (CHANGES_REQUESTED)" value="CHANGES_REQUESTED"></el-option>
                                        <el-option label="草稿 (DRAFT)" value="DRAFT"></el-option>
                                    </el-select>
                                </div>
                            </div>

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
                        <!-- 【【【 修改：表格数据源绑定到 filteredReviewList 】】】 -->
                        <el-table :data="filteredReviewList" style="width: 100%" v-loading="isLoading">
                            <el-table-column prop="id" label="记录ID" width="80"></el-table-column>
                            <el-table-column prop="partName" label="零件名称" sortable></el-table-column>
                            
                            <el-table-column label="当前处理人" width="120">
                                <template slot-scope="scope">
                                    <span v-if="scope.row.assigneeId && userMap[scope.row.assigneeId]">
                                        {{ userMap[scope.row.assigneeId] }}
                                    </span>
                                    <el-tag v-else-if="scope.row.status === 'APPROVED' || scope.row.status === 'REJECTED'" type="info" size="mini">
                                        流程结束
                                    </el-tag>
                                    <span v-else class="text-muted">
                                        N/A
                                    </span>
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

                            <el-table-column label="操作" width="280" fixed="right">
                                <template slot-scope="scope">
                                    <div class="d-flex align-items-center">
                                        <div v-if="scope.row.status === 'PENDING_REVIEW'">
                                            <el-button @click="reviewRecord(scope.row)" type="primary" size="small">开始审核</el-button>
                                            <el-button @click="openReassignDialog(scope.row)" type="warning" size="small" plain>转交</el-button>
                                        </div>
                                        <div v-else-if="scope.row.status === 'APPROVED'">
                                            <el-button @click="viewRecord(scope.row)" type="text" size="small">查看详情</el-button>
                                            <el-button @click="openRequestChangesDialog(scope.row)" type="danger" size="small" plain>打回修改</el-button>
                                        </div>
                                        <div v-else-if="scope.row.status === 'REJECTED'">
                                            <el-button @click="viewRecord(scope.row)" type="text" size="small">查看详情</el-button>
                                        </div>
                                        <div v-else-if="scope.row.status === 'CHANGES_REQUESTED'">
                                            <el-tag type="info" size="small">等待 {{ userMap[scope.row.assigneeId] || '设计员' }} 修改</el-tag>
                                            <el-button @click="viewRecord(scope.row)" type="text" size="small" style="margin-left: 10px;">查看进度</el-button>
                                        </div>
                                        <div v-else-if="scope.row.status === 'DRAFT'">
                                            <el-tag type="info" size="small">设计员草稿</el-tag>
                                        </div>

                                        <el-button 
                                            v-if="isAdmin"
                                            @click="deleteRecord(scope.row)"
                                            type="text"
                                            size="small"
                                            style="color: #F56C6C; margin-left: 10px;"
                                            title="管理员权限删除">
                                            删除
                                        </el-button>
                                    </div>
                                </template>
                            </el-table-column>
                        </el-table>
                        
                        <!-- 【【【 修改：空状态提示，使其能响应筛选状态 】】】 -->
                        <p v-if="filteredReviewList.length === 0" class="text-center text-muted mt-4">
                            {{ showMyTasksOnly ? '您当前没有待处理的审查任务。' : '该项目下暂无相关记录。' }}
                         </p>
                    </div>
                </div>
            </div>

            <!-- 新增：转交任务对话框 -->
            <el-dialog title="转交审核任务" :visible.sync="reassignDialogVisible" width="400px" append-to-body>
                <div v-if="currentRecord">
                    <p>确定要将 <strong>{{ currentRecord.partName }}</strong> 的审核任务转交给其他审核员吗？</p>
                    <el-select 
                        v-model="selectedAssigneeId" 
                        placeholder="请选择新的审核员" 
                        filterable 
                        style="width: 100%;">
                        <el-option 
                            v-for="user in availableReviewersForReassign" 
                            :key="user.id" 
                            :label="user.username" 
                            :value="user.id">
                        </el-option>
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
                    <el-button type="danger" @click="handleRequestChanges" :loading="isSubmitting">确 定 打 回</el-button>
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
            requestChangesComment: '', // 打回修改的意见
            userMap: {}, // 【新增】用于存储 { userId: username } 的映射
            showMyTasksOnly: false,
            selectedStatuses: [] ,
        }
    },

    computed: {
        totalTasks() {
            return this.reviewList.length;
        },
        // 【【【 新增：核心筛选逻辑 】】】
        filteredReviewList() {
            let list = this.reviewList; // 从原始列表开始
    
            // --- 筛选步骤 1: “只看我的待办” ---
            // this.currentUser 是从父组件 prop 传入的
            if (this.showMyTasksOnly && this.currentUser && this.currentUser.id) {
                list = list.filter(record => 
                    record.status === 'PENDING_REVIEW' && 
                    record.assigneeId === this.currentUser.id
                );
            }
    
            // --- 筛选步骤 2: “状态筛选” ---
            if (this.selectedStatuses && this.selectedStatuses.length > 0) {
                const statusSet = new Set(this.selectedStatuses);
                list = list.filter(record => statusSet.has(record.status));
            }
            
            return list;
        },
        availableReviewersForReassign() {
            console.log("--- [Debug Point 5] --- availableReviewersForReassign 计算属性被调用 ---");

            // 【检查站 D】: 查看计算时 this.reviewerUsers 的状态
            console.log("[Debug Point 6] 计算时，this.reviewerUsers 的内容:", JSON.parse(JSON.stringify(this.reviewerUsers)));
            console.log("[Debug Point 7] 计算时，this.currentRecord 的内容:", this.currentRecord ? this.currentRecord.id : 'null');

            if (!this.currentRecord || !this.reviewerUsers || this.reviewerUsers.length === 0) {
                console.warn("[Debug Info] 因前置条件不满足，返回空数组。");
                return [];
            }

            const filtered = this.reviewerUsers.filter(user => user.id !== this.currentRecord.assigneeId);

            // 【检查站 E】: 查看最终返回给模板的数组
            console.log("[Debug Point 8] 最终返回给下拉框的数组:", JSON.parse(JSON.stringify(filtered)));

            return filtered;
        },
        isAdmin() {
            // =======================================================
            //  ↓↓↓ 【核心调试代码】 ↓↓↓
            // =======================================================

            console.log("--- [isAdmin Computed Property] 正在检查用户权限 ---");

            // 检查 this.$root 是否存在
            if (!this.$root) {
                console.error("【权限检查失败】: 无法访问 this.$root。");
                return false;
            }

            // 检查 currentUser 对象是否存在
            const currentUser = this.$root.currentUser;
            if (!currentUser) {
                console.warn("【权限检查警告】: this.$root.currentUser 对象不存在或为 null。当前用户可能未登录。");
                return false;
            }

            // 打印 currentUser 的完整信息，以便查看其结构
            console.log("  - 当前用户信息 (this.$root.currentUser):", JSON.parse(JSON.stringify(currentUser)));

            // 检查 identity 字段是否存在
            const identity = currentUser.identity;
            if (!identity) {
                console.warn("【权限检查警告】: currentUser 对象中没有找到 'identity' 字段。");
                return false;
            }

            // 执行最终的权限判断
            const isAdminUser = (identity === 'ADMIN' || identity === 'MANAGER');

            console.log(`  - 用户身份 (identity): '${identity}'`);
            console.log(`  - 是否为管理员 (isAdminUser): ${isAdminUser}`);
            console.log("-------------------------------------------------");

            return isAdminUser;
            // =======================================================
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
            } catch (e) { return '解析错误'; }
        },
        deleteRecord(record) {
            this.$confirm(`【管理员操作】确定要永久删除记录 #${record.id} (${record.partName}) 吗? 这将一并删除所有关联文件，且操作不可恢复。`, '高危操作警告', {
                confirmButtonText: '我确认，执行删除',
                cancelButtonText: '取消',
                type: 'warning'
            }).then(() => {
                console.log(`【ReviewPanel】管理员准备删除记录, ID: ${record.id}`);
                // 调用后端的删除API
                axios.delete(`/api/process-records/${record.id}`).then(() => {
                    this.$message.success('删除成功！');
                    this.fetchReviewList(); // 成功后刷新列表
                }).catch(error => {
                    let errorMessage = '删除失败！';
                    // 尝试从后端响应中提取更具体的错误信息
                    if (error.response && error.response.data) {
                        if (typeof error.response.data === 'string') {
                            errorMessage += ` 原因: ${error.response.data}`;
                        } else if (error.response.data.message) {
                            errorMessage += ` 原因: ${error.response.data.message}`;
                        }
                    }
                    this.$message.error(errorMessage);
                    console.error(`【ReviewPanel】删除记录 ${record.id} 失败:`, error);
                });
            }).catch(() => {
                this.$message.info('已取消删除操作');
            });
        },
        async fetchAllUsers() {
            console.log("--- [Debug Point 1] --- fetchAllUsers 方法被调用 ---");
            try {
                const response = await axios.get('/api/users');
                const allUsers = response.data;

                console.log("[Debug Point 2] 从 /api/users 收到的原始数据:", JSON.parse(JSON.stringify(allUsers)));

                if (!allUsers || !Array.isArray(allUsers) || allUsers.length === 0) {
                    console.error("[Debug Error] API返回的数据为空或格式不正确！");
                    return;
                }

                const userMap = {};
                allUsers.forEach(user => { userMap[user.id] = user.username; });
                this.userMap = userMap;

                console.log("[Debug Point 3] 生成的 userMap:", JSON.parse(JSON.stringify(this.userMap)));

                // 【【【核心修正：忽略大小写】】】
                const filteredReviewers = allUsers.filter(user => {
                    // 1. 确保 user.identity 存在且是字符串
                    if (typeof user.identity !== 'string') return false;
                    // 2. 将其转换为大写再进行比较
                    const identityUpper = user.identity.toUpperCase();
                    return identityUpper === 'REVIEWER' || identityUpper === 'MANAGER';
                });

                console.log("[Debug Point 4] 过滤出的审核员 (filteredReviewers):", JSON.parse(JSON.stringify(filteredReviewers)));

                this.reviewerUsers = filteredReviewers;

            } catch (error) {
                this.$message.error("加载用户信息失败！");
                console.error("[Debug Error] fetchAllUsers 请求失败:", error);
            }
        },
    },

    mounted() {
        // 只并行获取所有用户和任务列表
        Promise.all([
            this.fetchAllUsers(),
            this.fetchReviewList()
        ]).catch(error => {
            console.error("初始化面板数据时发生错误:", error);
            this.$message.error("初始化面板数据失败，请刷新重试。");
        });
    },

    watch: {
        projectId(newId) {
            if (newId) {
                this.fetchReviewList();
            }
        }
    }
});