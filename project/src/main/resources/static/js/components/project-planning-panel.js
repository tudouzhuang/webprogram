Vue.component('project-planning-panel', {
    // 【 props 】: 接收父组件传递过来的 projectId
    props: {
        projectId: {
            type: [String, Number],
            required: true
        }
    },

    // 【模板】: 模板完全不需要修改，它将自动响应 computed 属性的变化
    template: `
        <div class="main-panel" style="width:100%; height:100%">
            <div class="content-wrapper">

                <!-- 1. 项目基础信息显示区域 -->
                <div class="card mb-4">
                    <div class="card-body">
                        <div v-if="isLoading" class="text-center p-3">
                            <p>正在加载项目信息...</p>
                            <el-progress :percentage="100" status="success" :indeterminate="true" :duration="1"></el-progress>
                        </div>
                        <div v-else-if="loadError" class="alert alert-danger">{{ loadError }}</div>
                        <div v-else-if="projectInfo">
                            <el-descriptions title="项目基本信息" :column="1" border>
                                <el-descriptions-item label="项目号">{{ projectInfo.projectNumber }}</el-descriptions-item>
                            </el-descriptions>
                        </div>
                    </div>
                </div>

                <!-- 2. 设计策划书管理区域 -->
                <div class="card">
                    <div class="card-body">
                        <h4 class="card-title">设计策划书管理</h4>
                        <p class="card-description">
                            项目设计前期的核心策划文档。
                            <span v-if="canEdit" class="text-success">（您是管理员，拥有编辑权限）</span>
                            <span v-else class="text-primary">（您是普通用户，只读权限）</span>
                        </p>
                        
                        <div v-if="planningDocument">
                            <p>
                                <strong><i class="el-icon-document"></i> 当前文件:</strong> {{ planningDocument.fileName }}
                            </p>
                            <el-button size="small" type="success" icon="el-icon-view" @click="previewFile(planningDocument)">
                                预览策划书
                            </el-button>
                            <el-button v-if="canEdit" size="small" type="danger" icon="el-icon-delete" @click="deleteFile(planningDocument)">
                                删除并替换
                            </el-button>
                        </div>

                        <div v-else>
                             <p class="text-muted">暂未上传设计策划书。</p>
                            <el-upload
                                v-if="canEdit"
                                class="mt-2"
                                action="#" 
                                :http-request="handleFileUpload"
                                :show-file-list="false"
                                :before-upload="beforeUpload">
                                <el-button size="small" type="primary" icon="el-icon-upload">
                                    上传新的策划书
                                </el-button>
                                <div slot="tip" class="el-upload__tip">只能上传 .xlsx 或 .xls 格式的Excel文件</div>
                            </el-upload>
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
                            <p>正在加载和转换预览文件...</p>
                            <el-progress :percentage="100" status="success" :indeterminate="true" :duration="2"></el-progress>
                        </div>
                        <div id="luckysheet-planning-container" v-show="!isLoadingSheet" style="width: 100%; height: 80vh;"></div>
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
            projectInfo: null,
            fileList: [],
            loadError: null,
            
            // 【数据】: 只保留模拟用户数据
            mockCurrentUser: {
                username: '模拟管理员',
                email: 'manager@example.com',
                identity: 'manager' // 在这里切换 'manager' 或 'student' 来测试
            },
            isPreviewing: false,
            isLoadingSheet: false,
            loadSheetError: null,
            previewingFileName: ''
        }
    },

    computed: {
        // 从文件列表中筛选出设计策划书
        planningDocument() {
            return this.fileList.find(f => f.documentType === 'PLANNING_DOCUMENT');
        },

        // =======================================================
        // 【核心修改】: 将 canEdit 定义为一个计算属性
        // =======================================================
        canEdit() {
            // 这个计算属性的值，完全依赖于 mockCurrentUser.identity
            // 当 mockCurrentUser 变化时（虽然在本例中它不怎么变），canEdit 会自动更新
            // 更重要的是，Vue 能保证模板中对 canEdit 的访问是完全响应式的
            const isManager = this.mockCurrentUser && this.mockCurrentUser.identity.toLowerCase() === 'manager';
            console.log("【Computed Permission】canEdit 的计算结果为:", isManager);
            return isManager;
        }
    },

    methods: {
        // --- 核心数据获取逻辑 (保持不变) ---
        fetchData() {
            if (!this.projectId) {
                this.resetState();
                return;
            }
            this.resetState();
            this.isLoading = true;

            Promise.all([
                axios.get(`/api/projects/${this.projectId}`),
                axios.get(`/api/projects/${this.projectId}/files`)
            ]).then(([projectResponse, filesResponse]) => {
                this.projectInfo = projectResponse.data;
                this.fileList = filesResponse.data;
                this.isLoading = false;
            }).catch(error => {
                this.isLoading = false;
                this.loadError = "加载项目数据失败，请确认项目是否存在或刷新重试。";
                console.error("【PlanningPanel】获取项目数据失败:", error);
                this.$message.error("加载项目数据失败！");
            });
        },
        
        // --- 文件上传逻辑 (保持不变) ---
        beforeUpload(file) {
            const isExcel = file.type.includes('spreadsheet') || file.name.endsWith('.xls') || file.name.endsWith('.xlsx');
            if (!isExcel) this.$message.error('只能上传Excel文件!');
            return isExcel;
        },
        handleFileUpload(options) {
            const file = options.file;
            const formData = new FormData();
            formData.append('file', file);
            const documentType = 'PLANNING_DOCUMENT';
            const apiUrl = `/api/projects/${this.projectId}/files/${documentType}`;
            
            this.$message('正在上传策划书...');
            axios.post(apiUrl, formData).then(response => {
                this.$message.success('设计策划书上传成功！');
                this.fetchProjectFiles();
            }).catch(error => {
                const errorMessage = (error.response && error.response.data) ? error.response.data : '上传失败';
                this.$message.error(errorMessage);
            });
        },
        
        // --- 只刷新文件列表 (保持不变) ---
        fetchProjectFiles() {
            axios.get(`/api/projects/${this.projectId}/files`).then(response => {
                this.fileList = response.data;
            });
        },

        // --- 文件预览逻辑 (保持不变) ---
        previewFile(file) {
            if (!file || !file.id) return;
            this.isPreviewing = true;
            this.isLoadingSheet = true;
            this.loadSheetError = null;
            this.previewingFileName = file.fileName;
            
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
            const fileUrl = `/api/files/content/${fileId}`;
            axios.get(fileUrl, { responseType: 'blob' })
                .then(response => {
                    window.LuckyExcel.transformExcelToLucky(
                        response.data,
                        (exportJson, luckysheetfile) => {
                            this.isLoadingSheet = false;
                            if (!exportJson.sheets || exportJson.sheets.length === 0) {
                                this.loadSheetError = "文件内容为空或无法解析。";
                                return;
                            }
                            if (window.luckysheet) window.luckysheet.destroy();
                            
                            window.luckysheet.create({
                                container: 'luckysheet-planning-container',
                                data: exportJson.sheets,
                                title: exportJson.info.name, lang: 'zh',
                                showtoolbar: false, showinfobar: false, showsheetbar: true,
                                showstatisticBar: false, sheetFormulaBar: false, allowUpdate: false
                            });
                        },
                        (error) => {
                            this.isLoadingSheet = false;
                            this.loadSheetError = "LuckyExcel转换文件时出错。";
                            console.error("[LuckyExcel] 转换失败:", error);
                        }
                    );
                }).catch(error => {
                    this.isLoadingSheet = false;
                    this.loadSheetError = "获取文件失败。";
                    console.error("【Axios】文件下载失败:", error);
                });
        },
        
        closePreview() {
            this.isPreviewing = false;
            if (window.luckysheet) {
                window.luckysheet.destroy();
            }
        },

        // --- 文件删除逻辑 (保持不变) ---
        deleteFile(file) {
            this.$confirm(`确定要删除设计策划书 "${file.fileName}" 吗？删除后可以重新上传。`, '警告', {
                confirmButtonText: '确定删除', cancelButtonText: '取消', type: 'warning'
            }).then(() => {
                axios.delete(`/api/files/${file.id}`).then(() => {
                    this.$message.success('文件删除成功！');
                    this.fetchProjectFiles();
                    if (this.isPreviewing && this.previewingFileName === file.fileName) {
                        this.closePreview();
                    }
                }).catch(error => {
                    this.$message.error((error.response && error.response.data) || '删除失败');
                });
            }).catch(() => { /* 用户取消 */ });
        },

        // --- 辅助方法 (保持不变) ---
        resetState() {
            this.isLoading = false;
            this.projectInfo = null;
            this.fileList = [];
            this.loadError = null;
            // 【移除】: 这里不再需要重置 canEdit
            this.closePreview();
        }
    },

    // --- 生命周期钩子 ---
    created() {
        // 【移除】: 不再需要在 created 中手动设置 canEdit
        // 这里的逻辑已经全部转移到 computed 属性中，更优雅、更可靠
    },
    mounted() {
        console.log("【PlanningPanel】已挂载，初始 projectId:", this.projectId);
        this.fetchData();
    },
    beforeDestroy() {
        console.log("【PlanningPanel】将被销毁，清理资源...");
        this.resetState();
    },
    watch: {
        projectId(newId, oldId) {
            console.log(`【PlanningPanel】检测到 projectId 从 ${oldId} 变为 ${newId}`);
            if (newId && newId !== oldId) {
                // fetchData中不再需要权限判断逻辑，因为computed会自动处理
                this.fetchData();
            }
        }
    }
});