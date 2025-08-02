Vue.component('record-details-viewer', {
    props: {
        recordId: {
            type: [String, Number],
            required: true
        }
    },
    template: `
        <div class="main-panel">
            <div class="content-wrapper">

                <!-- 1. 过程记录表基础信息显示 -->
                <div class="card mb-4">
                    <div class="card-body">
                         <div class="d-flex justify-content-between align-items-center">
                            <h4 class="card-title mb-0">过程记录表详情</h4>
                            <el-button icon="el-icon-back" @click="goBackToList" circle title="返回列表"></el-button>
                        </div>
                        <hr>
                        <div v-if="isLoading" class="text-center p-3">
                            <p>正在加载记录表信息...</p>
                            <i class="el-icon-loading" style="font-size: 24px;"></i>
                        </div>
                        <div v-else-if="loadError" class="alert alert-danger">{{ loadError }}</div>
                        <div v-else-if="recordInfo">
                            <el-descriptions title="基础信息" :column="2" border>
                                <el-descriptions-item label="记录ID">{{ recordInfo.id }}</el-descriptions-item>
                                <el-descriptions-item label="所属项目ID">{{ recordInfo.projectId }}</el-descriptions-item>
                                <el-descriptions-item label="零件名称">{{ recordInfo.partName }}</el-descriptions-item>
                                <el-descriptions-item label="工序名称">{{ recordInfo.processName }}</el-descriptions-item>
                                <el-descriptions-item label="提交人">{{ getSpecDetail('designerName') }}</el-descriptions-item>
                                <el-descriptions-item label="提交时间">{{ formatDate(recordInfo.createdAt) }}</el-descriptions-item>
                                <el-descriptions-item label="状态">
                                     <el-tag :type="getStatusTagType(recordInfo.status)">{{ formatStatus(recordInfo.status) }}</el-tag>
                                </el-descriptions-item>
                            </el-descriptions>
                            
                            <!-- 更多规格信息可以从 JSON 中提取展示 -->
                            <el-collapse v-model="activeCollapse" class="mt-3">
                                <el-collapse-item title="查看完整规格信息 (JSON)" name="1">
                                    <pre style="white-space: pre-wrap; word-wrap: break-word; background-color: #f5f5f5; padding: 10px; border-radius: 4px;">{{ prettyPrintJson(recordInfo.specificationsJson) }}</pre>
                                </el-collapse-item>
                            </el-collapse>
                        </div>
                    </div>
                </div>

                <!-- 2. 关联的Sheet文件列表 -->
                <div class="card mb-4">
                    <div class="card-body">
                        <h4 class="card-title">关联的检查项 (Sheets)</h4>
                        <div v-if="isLoading">加载中...</div>
                        <div v-else-if="fileList.length === 0" class="text-muted">此记录表没有关联任何检查项文件。</div>
                        <div v-else>
                            <el-table :data="fileList" style="width: 100%">
                                <el-table-column prop="fileName" label="Sheet文件名" sortable></el-table-column>
                                <el-table-column label="操作" width="120" align="center">
                                    <template slot-scope="scope">
                                        <el-button @click="previewFile(scope.row)" type="primary" size="mini">预览</el-button>
                                    </template>
                                </el-table-column>
                            </el-table>
                        </div>
                    </div>
                </div>

                <!-- 3. Luckysheet 预览区域 -->
                <div v-if="isPreviewing" class="card mt-4">
                     <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center">
                            <h4 class="card-title mb-0">文件预览: {{ previewingFileName }}</h4>
                            <el-button type="info" icon="el-icon-close" @click="closePreview" circle></el-button>
                        </div>
                        <hr>
                        <div v-if="isLoadingSheet" class="text-center p-5">
                            <p>正在加载预览文件...</p>
                            <el-progress :percentage="100" status="success" :indeterminate="true" :duration="2"></el-progress>
                        </div>
                        <!-- 【重要】使用动态ID确保每次重新创建时容器是唯一的 -->
                        <div :id="'luckysheet-record-viewer-' + recordId + '-' + previewingFileId" v-show="!isLoadingSheet" style="width: 100%; height: 80vh;"></div>
                        <div v-if="loadSheetError" class="alert alert-warning mt-3">
                            <strong>预览失败：</strong> {{ loadSheetError }}
                        </div>
                     </div>
                </div>

            </div>
        </div>
    `,
    
    data() {
        return {
            isLoading: false,
            recordInfo: null,
            fileList: [],
            loadError: null,
            activeCollapse: '',
            
            isPreviewing: false,
            isLoadingSheet: false,
            loadSheetError: null,
            previewingFileName: '',
            previewingFileId: null // 【新增】用于生成唯一的容器ID
        }
    },

    methods: {
        // --- 数据获取 ---
        fetchData() {
            if (!this.recordId) return;
            this.resetState();
            this.isLoading = true;
            
            Promise.all([
                axios.get(`/api/process-records/${this.recordId}`),
                // 【修正】API地址应该指向获取特定记录表的文件
                axios.get(`/api/process-records/${this.recordId}/files`)
            ]).then(([recordResponse, filesResponse]) => {
                this.recordInfo = recordResponse.data;
                this.fileList = filesResponse.data;
            }).catch(error => {
                this.loadError = "加载记录表详情失败。";
                this.$message.error("加载数据失败！");
                console.error("【DetailsPanel】Fetch data error:", error);
            }).finally(() => {
                this.isLoading = false;
            });
        },

        // --- 文件预览 ---
        previewFile(file) {
            if (!file || !file.id) return;
            this.isPreviewing = true;
            this.isLoadingSheet = true;
            this.loadSheetError = null;
            this.previewingFileName = file.fileName;
            this.previewingFileId = file.id; // 设置当前预览文件的ID
            
            this.$nextTick(() => {
                this.renderSheetFromFileId(file.id);
            });
        },
        renderSheetFromFileId(fileId) {
            if (!window.LuckyExcel || !window.luckysheet) {
                this.loadSheetError = "Luckysheet 核心库未能加载。";
                this.isLoadingSheet = false;
                return;
            }
            // 【核心修正】: 使用我们之前创建的、正确的 /api/files/content/{fileId} 接口来获取文件内容
            const fileUrl = `/api/files/content/${fileId}`;
            axios.get(fileUrl, { responseType: 'blob' })
                .then(response => {
                    const fileBlob = response.data;
                    window.LuckyExcel.transformExcelToLucky(fileBlob, (exportJson) => {
                        this.isLoadingSheet = false;
                        if (!exportJson.sheets || exportJson.sheets.length === 0) {
                            this.loadSheetError = "文件内容为空或无法解析。";
                            return;
                        }
                        if (window.luckysheet) window.luckysheet.destroy();
                        
                        const containerId = `luckysheet-record-viewer-${this.recordId}-${fileId}`;
                        window.luckysheet.create({
                            container: containerId,
                            data: exportJson.sheets,
                            title: exportJson.info.name,
                            lang: 'zh',
                            allowUpdate: false // 只读
                        });
                    }, (error) => {
                        this.isLoadingSheet = false;
                        this.loadSheetError = "LuckyExcel转换文件时出错。";
                        console.error("[LuckyExcel] 转换失败:", error);
                    });
                }).catch(error => {
                    this.isLoadingSheet = false;
                    this.loadSheetError = "从服务器获取文件失败。";
                    console.error("【Axios】文件下载失败:", error);
                });
        },
        closePreview() {
            this.isPreviewing = false;
            if (window.luckysheet) {
                window.luckysheet.destroy();
            }
        },

        // --- 辅助方法 ---
        goBackToList() {
            this.$emit('back-to-list');
        },
        resetState() {
            this.isLoading = false;
            this.recordInfo = null;
            this.fileList = [];
            this.loadError = null;
            this.closePreview();
        },
        formatDate(dateStr) {
            if (!dateStr) return 'N/A';
            return new Date(dateStr).toLocaleString();
        },
        formatStatus(status) {
            const statusMap = { 'DRAFT': '草稿', 'PENDING_REVIEW': '待审核', 'APPROVED': '已批准', 'REJECTED': '已驳回' };
            return statusMap[status] || status;
        },
        getStatusTagType(status) {
            const typeMap = { 'DRAFT': 'info', 'PENDING_REVIEW': 'warning', 'APPROVED': 'success', 'REJECTED': 'danger' };
            return typeMap[status] || 'primary';
        },
        getSpecDetail(key) {
            if (!this.recordInfo || !this.recordInfo.specificationsJson) return 'N/A';
            try {
                const specData = JSON.parse(this.recordInfo.specificationsJson);
                return specData[key] || '未提供';
            } catch (e) {
                return '解析错误';
            }
        },
        prettyPrintJson(jsonString) {
            if (!jsonString) return '{}';
            try {
                const obj = JSON.parse(jsonString);
                return JSON.stringify(obj, null, 2);
            } catch(e) {
                return "无效的JSON格式";
            }
        }
    },

    mounted() {
        this.fetchData();
    },

    watch: {
        recordId(newId, oldId) {
            if (newId && newId !== oldId) {
                this.fetchData();
            }
        }
    }
});