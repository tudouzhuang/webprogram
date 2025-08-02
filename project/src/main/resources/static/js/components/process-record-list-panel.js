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
                                <h4 class="card-title">设计过程记录表列表</h4>
                                <p class="card-description">
                                   项目ID: {{ projectId }} | 共查询到 {{ totalRecords }} 条记录
                                </p>
                            </div>
                            <div>
                                <el-button type="primary" icon="el-icon-plus" @click="createNewRecord">
                                    新建过程记录表
                                </el-button>
                            </div>
                        </div>

                        <div v-if="isLoading" class="text-center p-5">
                            <p>正在加载记录表列表...</p>
                            <i class="el-icon-loading" style="font-size: 24px;"></i>
                        </div>

                        <div v-else-if="loadError" class="alert alert-danger">
                            {{ loadError }}
                        </div>
                        
                        <div v-else>
                            <el-table
                                :data="recordList"
                                style="width: 100%"
                                v-loading="isLoading">
                                
                                <el-table-column
                                    prop="id"
                                    label="记录ID"
                                    width="80">
                                </el-table-column>
                                
                                <el-table-column
                                    prop="partName"
                                    label="零件名称"
                                    sortable>
                                </el-table-column>
                                
                                <el-table-column
                                    prop="processName"
                                    label="工序名称"
                                    sortable>
                                </el-table-column>
                                
                                <el-table-column
                                    prop="designerName"
                                    label="提交人"
                                    width="120">
                                    <!-- 使用自定义模板来从JSON中提取提交人 -->
                                    <template slot-scope="scope">
                                        {{ getDesignerName(scope.row.specificationsJson) }}
                                    </template>
                                </el-table-column>

                                <el-table-column
                                    prop="status"
                                    label="状态"
                                    width="120">
                                    <template slot-scope="scope">
                                        <el-tag :type="getStatusTagType(scope.row.status)">
                                            {{ formatStatus(scope.row.status) }}
                                        </el-tag>
                                    </template>
                                </el-table-column>

                                <el-table-column
                                    prop="createdAt"
                                    label="提交时间"
                                    width="180"
                                    sortable>
                                    <template slot-scope="scope">
                                        {{ formatDate(scope.row.createdAt) }}
                                    </template>
                                </el-table-column>

                                <el-table-column
                                    label="操作"
                                    width="150"
                                    fixed="right">
                                    <template slot-scope="scope">
                                        <el-button
                                            @click="viewRecordDetails(scope.row)"
                                            type="text"
                                            size="small">
                                            查看详情
                                        </el-button>
                                        <el-button
                                            @click="deleteRecord(scope.row)"
                                            type="text"
                                            size="small"
                                            style="color: #F56C6C;">
                                            删除
                                        </el-button>
                                    </template>
                                </el-table-column>
                            </el-table>
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
            loadError: null,
            totalRecords: 0
        }
    },

    methods: {
        // --- 数据获取 ---
        fetchRecordList() {
            if (!this.projectId) return;

            this.isLoading = true;
            this.loadError = null;
            // 调用我们新创建的后端API
            axios.get(`/api/projects/${this.projectId}/process-records`)
                .then(response => {
                    this.recordList = response.data;
                    this.totalRecords = this.recordList.length;
                })
                .catch(error => {
                    this.loadError = "加载过程记录表列表失败，请刷新重试。";
                    this.$message.error("加载列表失败！");
                    console.error("获取过程记录表列表失败:", error);
                })
                .finally(() => {
                    this.isLoading = false;
                });
        },

        // --- 操作方法 ---
        createNewRecord() {
            // 触发一个事件，通知父组件需要切换到“新建记录表”的面板
            console.log("【ListPanel】触发 create-new-record 事件");
            this.$emit('create-new-record');
        },
        viewRecordDetails(record) {
            // 触发一个事件，通知父组件需要切换到“记录表详情”面板，并传递记录ID
            console.log("【ListPanel】触发 view-record-details 事件, 记录ID:", record.id);
            this.$emit('view-record-details', record.id);
        },
        deleteRecord(record) {
            this.$confirm(`确定要删除零件 "${record.partName}" 的这份过程记录表吗?`, '警告', {
                confirmButtonText: '确定删除',
                cancelButtonText: '取消',
                type: 'warning'
            }).then(() => {
                // TODO: 调用后端的删除API
                // axios.delete(`/api/process-records/${record.id}`).then(() => { ... });
                this.$message.success('删除成功！');
                // 刷新列表
                this.fetchRecordList();
            }).catch(() => {});
        },

        // --- 辅助格式化方法 ---
        formatDate(dateString) {
            if (!dateString) return 'N/A';
            try {
                // 假设后端返回的是ISO格式字符串，例如 "2024-07-31T10:30:00"
                return new Date(dateString).toLocaleString();
            } catch (e) {
                return dateString;
            }
        },
        formatStatus(status) {
            const statusMap = {
                'DRAFT': '草稿',
                'PENDING_REVIEW': '待审核',
                'APPROVED': '已批准',
                'REJECTED': '已驳回'
            };
            return statusMap[status] || status;
        },
        getStatusTagType(status) {
             const typeMap = {
                'DRAFT': 'info',
                'PENDING_REVIEW': 'warning',
                'APPROVED': 'success',
                'REJECTED': 'danger'
            };
            return typeMap[status] || 'primary';
        },
        getDesignerName(jsonString) {
            if (!jsonString) return 'N/A';
            try {
                // 从JSON字符串中解析出 designerName
                const specData = JSON.parse(jsonString);
                return specData.designerName || '未知';
            } catch(e) {
                return '解析错误';
            }
        }
    },

    mounted() {
        console.log("【ListPanel】已挂载，初始 projectId:", this.projectId);
        this.fetchRecordList();
    },

    watch: {
        projectId(newId, oldId) {
            console.log(`【ListPanel】检测到 projectId 从 ${oldId} 变为 ${newId}`);
            if (newId && newId !== oldId) {
                this.fetchRecordList();
            }
        }
    }
});