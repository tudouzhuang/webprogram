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
                            </div>
                            <div>
                                <el-button type="info" icon="el-icon-refresh" @click="fetchRecordList" circle title="刷新列表"></el-button>
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
                            <el-table :data="recordList" style="width: 100%" v-loading="isLoading">
                                
                                <el-table-column prop="id" label="记录ID" width="80"></el-table-column>
                                <el-table-column prop="partName" label="零件名称" sortable></el-table-column>
                                <el-table-column prop="processName" label="工序名称" width="150" sortable></el-table-column>
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
                            
                             <p v-if="recordList.length === 0" class="text-center text-muted mt-4">您在该项目下暂无设计记录。</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    
    data() {
        return {
            isLoading: false,
            recordList: [],
            loadError: null
        }
    },

    computed: {
        totalRecords() {
            return this.recordList.length;
        }
    },

    methods: {
        fetchRecordList() {
            if (!this.projectId) return;
            this.isLoading = true;
            this.loadError = null;
            axios.get(`/api/projects/${this.projectId}/process-records`)
                .then(response => {
                    this.recordList = response.data;
                })
                .catch(error => {
                    this.loadError = "加载列表失败，请刷新重试。";
                    this.$message.error("加载列表失败！");
                })
                .finally(() => {
                    this.isLoading = false;
                });
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
        getDesignerName(jsonString) {
            if (!jsonString) return 'N/A';
            try {
                const specData = JSON.parse(jsonString);
                return specData.designerName || '未知';
            } catch(e) { return '解析错误'; }
        }
    },

    mounted() {
        this.fetchRecordList();
    },

    watch: {
        projectId(newId) {
            if (newId) {
                this.fetchRecordList();
            }
        }
    }
});