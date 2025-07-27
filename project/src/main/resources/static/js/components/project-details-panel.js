Vue.component('project-details-panel', {
    props: {
        projectId: {
            type: [String, Number],
            required: true
        }
    },

    template: `
        <div class="main-panel" style="width:100%;height:100%">
            <div class="content-wrapper">
                <div class="card mb-4">
                    <div class="card-body">
                        <h4 class="card-title">项目详情与文档管理</h4>
                        <div v-if="isLoadingInfo" class="text-center p-3">
                            <p>正在加载项目详细信息...</p>
                            <el-progress :percentage="100" status="success" :indeterminate="true" :duration="1"></el-progress>
                        </div>
                        <div v-else-if="loadInfoError" class="alert alert-danger">{{ loadInfoError }}</div>
                        <div v-else-if="projectInfo">
                            <el-descriptions title="基础信息" :column="2" border>
                                <el-descriptions-item label="项目号">{{ projectInfo.projectNumber }}</el-descriptions-item>
                                <el-descriptions-item label="产品名">{{ projectInfo.productName }}</el-descriptions-item>
                                <el-descriptions-item label="零件号">{{ projectInfo.partNumber }}</el-descriptions-item>
                                <el-descriptions-item label="客户名称">{{ projectInfo.customerName }}</el-descriptions-item>
                                <el-descriptions-item label="制件材质">{{ projectInfo.material }}</el-descriptions-item>
                                <el-descriptions-item label="制件料厚">{{ projectInfo.thickness }} mm</el-descriptions-item>
                                <el-descriptions-item label="工序号-工序内容">{{ projectInfo.process }}</el-descriptions-item>
                                <el-descriptions-item label="抗拉强度">{{ projectInfo.tensileStrength }} MPa</el-descriptions-item>
                                <el-descriptions-item label="使用设备 (主线)">{{ projectInfo.equipment }}</el-descriptions-item>
                                <el-descriptions-item label="模具图号">{{ projectInfo.moldDrawingNumber }}</el-descriptions-item>
                            </el-descriptions>
                            <el-descriptions title="人员信息" :column="2" border class="mt-4">
                                <el-descriptions-item label="设计人员">{{ projectInfo.designerName }}</el-descriptions-item>
                                <el-descriptions-item label="设计日期">{{ formatDate(projectInfo.designerDate) }}</el-descriptions-item>
                                <el-descriptions-item label="校对人员">{{ projectInfo.checkerName || 'N/A' }}</el-descriptions-item>
                                <el-descriptions-item label="校对日期">{{ formatDate(projectInfo.checkerDate) || 'N/A' }}</el-descriptions-item>
                                <el-descriptions-item label="审核人员">{{ projectInfo.auditorName || 'N/A' }}</el-descriptions-item>
                                <el-descriptions-item label="审核日期">{{ formatDate(projectInfo.auditorDate) || 'N/A' }}</el-descriptions-item>
                            </el-descriptions>
                            <el-descriptions title="尺寸与重量" :column="2" border class="mt-4">
                                <el-descriptions-item label="报价 尺寸">{{ projectInfo.quoteLength }} x {{ projectInfo.quoteWidth }} x {{ projectInfo.quoteHeight }} mm</el-descriptions-item>
                                <el-descriptions-item label="报价 重量">{{ projectInfo.quoteWeight }} T</el-descriptions-item>
                                <el-descriptions-item label="实际 尺寸">{{ projectInfo.actualLength }} x {{ projectInfo.actualWidth }} x {{ projectInfo.actualHeight }} mm</el-descriptions-item>
                                <el-descriptions-item label="实际 重量">{{ projectInfo.actualWeight }} T</el-descriptions-item>
                            </el-descriptions>
                        </div>
                    </div>
                </div>

                <!-- 2. 文件管理区域 -->
                <div class="row">
                    <div class="col-md-6 grid-margin stretch-card">
                        <div class="card">
                            <div class="card-body">
                                <h4 class="card-title">设计策划书</h4>
                                <p class="card-description">项目设计前期的策划文档。</p>
                                <div v-if="planningDocument">
                                    <p><strong><i class="el-icon-document"></i> 文件名:</strong> {{ planningDocument.fileName }}</p>
                                    <el-button size="small" type="success" icon="el-icon-view" @click="previewFile(planningDocument)">预览</el-button>
                                    <el-button size="small" type="danger" icon="el-icon-delete" @click="deleteFile(planningDocument)">删除</el-button>
                                </div>
                                <div v-else>
                                    <p class="text-muted">暂未上传设计策划书。</p>
                                    <el-upload class="mt-2" action="#" :http-request="(options) => handleFileUpload(options, 'PLANNING_DOCUMENT')" :show-file-list="false" :before-upload="beforeUpload">
                                        <el-button size="small" type="primary" icon="el-icon-upload">上传策划书</el-button>
                                    </el-upload>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6 grid-margin stretch-card">
                        <div class="card">
                            <div class="card-body">
                                <h4 class="card-title">设计过程记录表</h4>
                                <p class="card-description">图纸完成后对照检查的表格。</p>
                                <div v-if="checkRecord">
                                    <p><strong><i class="el-icon-document"></i> 文件名:</strong> {{ checkRecord.fileName }}</p>
                                    <el-button size="small" type="success" icon="el-icon-view" @click="previewFile(checkRecord)">预览</el-button>
                                    <el-button size="small" type="danger" icon="el-icon-delete" @click="deleteFile(checkRecord)">删除</el-button>
                                </div>
                                <div v-else>
                                     <p class="text-muted">暂未上传设计过程记录表。</p>
                                    <el-upload class="mt-2" action="#" :http-request="(options) => handleFileUpload(options, 'CHECK_RECORD')" :show-file-list="false" :before-upload="beforeUpload">
                                        <el-button size="small" type="primary" icon="el-icon-upload">上传记录表</el-button>
                                    </el-upload>
                                </div>
                            </div>
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
                        <div id="luckysheet-viewer-container" v-show="!isLoadingSheet" style="width: 100%; height: 80vh;"></div>
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
            isLoadingInfo: false,
            projectInfo: null,
            loadInfoError: null,
            fileList: [],
            isPreviewing: false,
            isLoadingSheet: false,
            loadSheetError: null,
            previewingFileName: ''
        }
    },

    computed: {
        planningDocument() {
            return this.fileList.find(f => f.documentType === 'PLANNING_DOCUMENT');
        },
        checkRecord() {
            return this.fileList.find(f => f.documentType === 'CHECK_RECORD');
        }
    },

    methods: {
        // --- 数据获取 ---
        fetchProjectData() {
            if (!this.projectId) {
                this.resetState();
                return;
            }
            this.resetState();
            this.isLoadingInfo = true;

            Promise.all([
                axios.get(`/api/projects/${this.projectId}`),
                axios.get(`/api/projects/${this.projectId}/files`)
            ]).then(([projectResponse, filesResponse]) => {
                this.projectInfo = projectResponse.data;
                this.fileList = filesResponse.data;
                this.isLoadingInfo = false;
            }).catch(error => {
                this.isLoadingInfo = false;
                this.loadInfoError = "加载项目数据失败，请刷新重试。";
                console.error("获取项目数据失败:", error);
                this.$message.error("加载项目数据失败！");
            });
        },
        
        // --- 文件上传 ---
        beforeUpload(file) {
            const isExcel = file.type.includes('spreadsheet') || file.name.endsWith('.xls') || file.name.endsWith('.xlsx');
            if (!isExcel) this.$message.error('只能上传Excel文件!');
            return isExcel;
        },
        handleFileUpload(options, documentType) {
            const file = options.file;
            const formData = new FormData();
            formData.append('file', file);

            const apiUrl = documentType === 'PLANNING_DOCUMENT'
                ? `/api/projects/${this.projectId}/upload/planning-document`
                : `/api/projects/${this.projectId}/upload/check-record`;
            
            this.$message('正在上传文件...');
            axios.post(apiUrl, formData).then(response => {
                this.$message.success('文件上传成功！');
                this.fetchProjectFiles();
            }).catch(error => {
                const errorMessage = (error.response && error.response.data) ? error.response.data : '上传失败';
                this.$message.error(errorMessage);
            });
        },
        
        fetchProjectFiles() {
            axios.get(`/api/projects/${this.projectId}/files`).then(response => {
                this.fileList = response.data;
            });
        },

        // --- 文件预览 ---
        previewFile(file) {
            if (!file || !file.id) {
                this.$message.error("文件信息不完整，无法预览。");
                return;
            }
            this.isPreviewing = true;
            this.isLoadingSheet = true;
            this.loadSheetError = null;
            this.previewingFileName = file.fileName;
            
            this.$nextTick(() => {
                // 【核心修正】调用正确的文件流渲染方法
                this.renderSheetFromFileId(file.id);
            });
        },
        
        /**
         * 【核心修正】: 使用axios获取文件Blob，然后用LuckyExcel渲染。
         *              不再使用Base64方案。
         */
        renderSheetFromFileId(fileId) {
            console.log("【子组件】准备从文件流API获取数据, fileId:", fileId);
            
            if (!window.LuckyExcel || !window.luckysheet) {
                this.loadSheetError = "Luckysheet 核心库未能加载。";
                this.isLoadingSheet = false;
                return;
            }

            // 【关键】直接请求你已经写好的 /api/files/content/{fileId} 接口
            const fileUrl = `/api/files/content/${fileId}`;

            axios.get(fileUrl, {
                responseType: 'blob' // 告诉axios期望接收二进制数据
            }).then(response => {
                const fileBlob = response.data; // response.data 现在就是文件的Blob对象
                
                window.LuckyExcel.transformExcelToLucky(
                    fileBlob, // 将获取到的 Blob 对象传给 LuckyExcel
                    (exportJson, luckysheetfile) => {
                        this.isLoadingSheet = false;
                        if (!exportJson.sheets || exportJson.sheets.length === 0) {
                            this.loadSheetError = "文件内容为空或无法解析。";
                            return;
                        }
                        if (window.luckysheet) window.luckysheet.destroy();
                        
                        window.luckysheet.create({
                            container: 'luckysheet-viewer-container',
                            data: exportJson.sheets,
                            title: exportJson.info.name, lang: 'zh',
                            showtoolbar: false, showinfobar: false, showsheetbar: true,
                            showstatisticBar: false, sheetFormulaBar: false, allowUpdate: false
                        });
                        console.log("【子组件】Luckysheet 渲染成功！");
                    },
                    (error) => {
                        this.isLoadingSheet = false;
                        this.loadSheetError = "LuckyExcel转换文件时出错，可能是文件格式问题。";
                        console.error("[LuckyExcel] 文件转换失败:", error);
                    }
                );
            }).catch(error => {
                this.isLoadingSheet = false;
                this.loadSheetError = "获取文件失败，请检查文件是否存在或网络连接。";
                console.error("【Axios】文件下载失败:", error);
            });
        },
        
        closePreview() {
            this.isPreviewing = false;
            if (window.luckysheet) {
                window.luckysheet.destroy();
            }
        },

        // --- 文件删除 ---
        deleteFile(file) {
            if (!file || !file.id) {
                this.$message.error('无效的文件记录，无法删除。');
                return;
            }
            this.$confirm(`此操作将永久删除文件 "${file.fileName}", 是否继续?`, '警告', {
                confirmButtonText: '确定删除',
                cancelButtonText: '取消',
                type: 'warning'
            }).then(() => {
                axios.delete(`/api/files/${file.id}`).then(() => {
                    this.$message.success('文件删除成功！');
                    this.fetchProjectFiles();
                    if (this.isPreviewing && this.previewingFileName === file.fileName) {
                        this.closePreview();
                    }
                }).catch(error => {
                    const errorMessage = (error.response && error.response.data) ? error.response.data : '删除失败';
                    this.$message.error(errorMessage);
                });
            }).catch(() => {
                this.$message.info('已取消删除');          
            });
        },

        // --- 辅助方法 ---
        formatDate(dateString) {
            if (!dateString) return null;
            try {
                const date = new Date(dateString);
                if (isNaN(date.getTime())) return '无效日期';
                return date.toLocaleDateString();
            } catch (e) {
                return '日期格式错误';
            }
        },
        resetState() {
            this.isLoadingInfo = false;
            this.projectInfo = null;
            this.loadInfoError = null;
            this.fileList = [];
            this.isPreviewing = false;
            this.isLoadingSheet = false;
            this.loadSheetError = null;
            this.previewingFileName = '';
            if (window.luckysheet) {
                window.luckysheet.destroy();
            }
        }
    },

    mounted() {
        console.log("【子组件】project-details-panel 已挂载，初始 projectId:", this.projectId);
        this.fetchProjectData();
    },

    beforeDestroy() {
        console.log("【子组件】project-details-panel 即将被销毁，清理资源...");
        this.resetState();
    },

    watch: {
        projectId(newId, oldId) {
            console.log(`【子组件】检测到 projectId 从 ${oldId} 变为 ${newId}`);
            if (newId !== oldId) {
                this.fetchProjectData();
            }
        }
    }
});