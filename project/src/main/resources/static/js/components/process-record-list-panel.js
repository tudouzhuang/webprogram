Vue.component('process-record-list-panel', {
    props: {
        projectId: {
            type: [String, Number],
            required: true
        }
    },
    template: `
        <div class="main-panel" style="width:100%;height:100%">
            <div class="content-wrapper">
                <div class="card">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <div>
                                <h4 class="card-title">我的设计记录</h4>
                                <p class="card-description">
                                   项目ID: {{ projectId }} | 共查询到 {{ totalRecords }} 条记录
                                </p>
                                <!-- 【筛选区域】 -->
                                <div class="d-flex align-items-center mt-2" style="gap: 20px;">
                                    <!-- 开关 -->
                                    <div v-if="currentUser">
                                        <el-switch
                                            v-model="showMyRecordsOnly"
                                            active-text="只看我提交的">
                                        </el-switch>
                                    </div>
                                    <!-- 【【【 新增：状态筛选下拉框 】】】 -->
                                    <div>
                                        <el-select 
                                            v-model="selectedStatuses" 
                                            multiple 
                                            collapse-tags
                                            placeholder="按状态筛选" 
                                            style="width: 280px;"
                                            size="small"
                                            clearable>
                                            <el-option label="草稿 (DRAFT)" value="DRAFT"></el-option>
                                            <el-option label="待审核 (PENDING_REVIEW)" value="PENDING_REVIEW"></el-option>
                                            <el-option label="已批准 (APPROVED)" value="APPROVED"></el-option>
                                            <el-option label="待修改 (CHANGES_REQUESTED)" value="CHANGES_REQUESTED"></el-option>
                                            <el-option label="已驳回 (REJECTED)" value="REJECTED"></el-option>
                                        </el-select>
                                    </div>
                                </div>

                            </div>
                            <div>
                                <el-button type="info" icon="el-icon-refresh" @click="reloadData" circle title="刷新列表"></el-button>
                                <el-button type="primary" icon="el-icon-plus" @click="createNewRecord" style="margin-left: 10px;">
                                    新建设计记录
                                </el-button>
                            </div>
                        </div>

                        <div v-if="isLoading" class="text-center p-5">
                            <p>正在加载记录列表...</p>
                            <i class="el-icon-loading" style="font-size: 24px;"></i>
                        </div>

                        <div v-else-if="loadError" class="alert alert-danger">
                            {{ loadError }}
                        </div>
                        
                        <div v-else>
                            <!-- 【【【 修改：表格数据源绑定到 filteredRecordList 】】】 -->
                            <el-table :data="filteredRecordList" style="width: 100%" v-loading="isLoading">
                                
                                <el-table-column prop="id" label="记录ID" width="80"></el-table-column>
                                <el-table-column prop="partName" label="零件名称" sortable></el-table-column>
                                <el-table-column prop="processName" label="工序名称" width="150" sortable></el-table-column>
                                <el-table-column label="提交人" width="120">
                                    <template slot-scope="scope"> 
                                        <span v-if="scope.row.createdByUserId && userMap[scope.row.createdByUserId]">
                                            {{ userMap[scope.row.createdByUserId] }}
                                        </span>
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

                                <el-table-column label="操作" width="180" fixed="right">
                                    <template slot-scope="scope">
                                        <!-- 状态: 草稿 (DRAFT) -> 可编辑和删除 -->
                                        <template v-if="scope.row.status === 'DRAFT'">
                                            <el-button @click="editRecord(scope.row)" type="primary" size="small">编辑</el-button>
                                            <el-button @click="deleteRecord(scope.row)" type="text" size="small" style="color: #F56C6C; margin-left: 10px;">删除</el-button>
                                        </template>
                                        
                                        <!-- 状态: 已打回 (CHANGES_REQUESTED) -> 可修改 -->
                                        <el-button v-else-if="scope.row.status === 'CHANGES_REQUESTED'" @click="editRecord(scope.row)" type="danger" size="small">修改并重提</el-button>

                                        <!-- 其他状态 -> 只能查看 -->
                                        <el-button v-else @click="viewRecordDetails(scope.row)" type="text" size="small">查看详情</el-button>
                                    </template>
                                </el-table-column>
                            </el-table>
                            
                             <!-- 【【【 修改：空状态提示，使其能响应筛选状态 】】】 -->
                             <p v-if="filteredRecordList.length === 0" class="text-center text-muted mt-4">
                                {{ showMyRecordsOnly ? '您在该项目下暂无自己提交的设计记录。' : '该项目下暂无任何设计记录。' }}
                             </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,

    data() {
        return {
            isLoading: false,
            recordList: [],      // 存储从后端获取的【原始】列表
            loadError: null,
            userMap: {},
            currentUser: null,       // 【【【 新增：用于存储当前登录用户信息 】】】
            showMyRecordsOnly: false, // 【【【 新增：筛选开关的状态 】】】
            selectedStatuses: [] // 初始为空数组，表示不过滤
        }
    },

    computed: {
        totalRecords() {
            // totalRecords 现在应该计算【过滤后】的列表长度
            return this.filteredRecordList.length;
        },

        // 【【【 新增：核心筛选逻辑 】】】
        // 【【【 核心修改：重构筛选逻辑 】】】
        filteredRecordList() {
            let list = this.recordList; // 从原始列表开始

            // --- 筛选步骤 1: “只看我的” ---
            if (this.showMyRecordsOnly && this.currentUser) {
                list = list.filter(record => record.createdByUserId === this.currentUser.id);
            }

            // --- 筛选步骤 2: “状态筛选” ---
            if (this.selectedStatuses && this.selectedStatuses.length > 0) {
                // 将选中的状态值转为一个 Set，查询效率更高
                const statusSet = new Set(this.selectedStatuses);
                list = list.filter(record => statusSet.has(record.status));
            }

            return list;
        }
    },

    methods: {
        // 【新增】统一的刷新方法
        reloadData() {
            this.isLoading = true;
            Promise.all([
                this.fetchAllUsers(),
                this.fetchRecordList(),
                this.fetchCurrentUser() // 【【【 新增调用 】】】
            ]).catch(() => {
                // 错误已在各自方法中提示，这里防止 unhandled rejection
            }).finally(() => {
                this.isLoading = false;
            });
        },
        // 【新增】获取所有用户并创建映射表
        async fetchAllUsers() {
            try {
                const response = await axios.get('/api/users');
                const userMap = {};
                if (response.data) {
                    response.data.forEach(user => {
                        userMap[user.id] = user.username;
                    });
                }
                this.userMap = userMap;
            } catch (error) {
                this.$message.error("加载用户信息失败！");
                throw error; // 抛出错误以便 Promise.all 捕获
            }
        },

        // 【【【 新增方法：获取当前用户信息 】】】
        async fetchCurrentUser() {
            try {
                const response = await axios.get('/api/users/me');
                this.currentUser = response.data;
            } catch (error) {
                console.error("获取当前用户信息失败，筛选功能可能不可用。", error);
                this.$message.warning("无法获取用户信息，筛选功能可能不可用。");
            }
        },
        // 【修改】fetchRecordList 现在只负责获取列表
        async fetchRecordList() {
            if (!this.projectId) return;
            this.loadError = null;
            try {
                const response = await axios.get(`/api/projects/${this.projectId}/process-records`);
                this.recordList = response.data;
            } catch (error) {
                this.loadError = "加载列表失败，请刷新重试。";
                this.$message.error("加载列表失败！");
                throw error; // 抛出错误
            }
        },

        createNewRecord() {
            this.$emit('create-new-record');
        },
        editRecord(record) {
            this.$emit('edit-record', record.id);
        },
        viewRecordDetails(record) {
            this.$emit('view-record-details', record.id);
        },

        /**
         * 删除记录的方法，包含了确认弹窗和API调用
         * @param {object} record - 要删除的记录对象
         */
        deleteRecord(record) {
            // 1. 弹出确认对话框
            this.$confirm(`确定要永久删除零件 "${record.partName}" 的这份设计记录吗? 此操作不可恢复。`, '警告', {
                confirmButtonText: '确定删除',
                cancelButtonText: '取消',
                type: 'warning'
            }).then(() => {
                // 2. 用户点击“确定”后，调用后端的删除API
                console.log(`【DesignerList】准备删除记录, ID: ${record.id}`);
                axios.delete(`/api/process-records/${record.id}`)
                    .then(() => {
                        // 3a. 删除成功
                        this.$message.success('删除成功！');
                        this.fetchRecordList(); // 重新加载列表以更新界面
                    })
                    .catch(error => {
                        // 3b. 删除失败，向用户显示更详细的错误信息
                        let errorMessage = '删除失败！';
                        if (error.response && error.response.data) {
                            // 如果后端返回的是字符串
                            if (typeof error.response.data === 'string') {
                                errorMessage += ` 原因: ${error.response.data}`;
                            }
                            // 如果后端返回的是JSON对象，例如 { "message": "..." }
                            else if (error.response.data.message) {
                                errorMessage += ` 原因: ${error.response.data.message}`;
                            }
                        }
                        this.$message.error(errorMessage);
                        console.error(`【DesignerList】删除记录 ${record.id} 失败:`, error);
                    });
            }).catch(() => {
                // 4. 用户点击“取消”
                this.$message.info('已取消删除');
            });
        },

        // --- 辅助格式化方法 ---
        formatDate(dateString) {
            if (!dateString) return 'N/A';
            try { return new Date(dateString).toLocaleString(); }
            catch (e) { return dateString; }
        },
        formatStatus(status) {
            const statusMap = {
                'DRAFT': '草稿', 'PENDING_REVIEW': '审核中', 'APPROVED': '已通过',
                'REJECTED': '已驳回', 'CHANGES_REQUESTED': '待修改'
            };
            return statusMap[status] || status;
        },
        getStatusTagType(status) {
            const typeMap = {
                'DRAFT': 'info', 'PENDING_REVIEW': 'warning', 'APPROVED': 'success',
                'REJECTED': 'danger', 'CHANGES_REQUESTED': 'primary'
            };
            return typeMap[status] || 'primary';
        },

    },

    mounted() {
        this.reloadData();
    },

    watch: {
        projectId(newId) {
            if (newId) {
                this.reloadData();
            }
        }
    }
});