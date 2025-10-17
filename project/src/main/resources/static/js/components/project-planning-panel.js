Vue.component('project-planning-panel', {
    // 【核心修正1】: 将 props 的名字从 recordId 改为 projectId
    props: {
        projectId: {
            type: [String, Number],
            required: true
        }
    },
    // 【模板】: 完整模板，保持不变
    template: `
        <div class="content-wrapper" style="width:100%;height:100%">

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
                            <el-descriptions-item label="项目名称">{{ projectInfo.projectName }}</el-descriptions-item>
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
                        <span v-if="canEdit" class="text-success">（您拥有编辑权限）</span>
                        <span v-else class="text-primary">（您只有只读权限）</span>
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
                        <div>
                             <el-button type="success" size="mini" icon="el-icon-download" @click="exportCurrentSheet">导出文件</el-button>
                             <el-button type="info" icon="el-icon-close" @click="closePreview" circle style="margin-left:10px;"></el-button>
                        </div>
                    </div>
                    <hr>
                    
                    <!-- 【【【核心修改：用 iframe 替换掉旧的 div】】】 -->
                    <div v-if="isLoadingSheet" class="text-center p-5">
                        <p>正在加载预览文件...</p>
                        <i class="el-icon-loading" style="font-size: 24px;"></i>
                    </div>

                    <iframe 
                        v-show="!isLoadingSheet"
                        ref="previewIframe"
                        src="/luckysheet-iframe-loader.html"
                        @load="onIframeLoad"
                        style="width: 100%; height: 80vh; border: none;">
                    </iframe>

                    <div v-if="loadSheetError" class="alert alert-warning mt-3">
                        <strong>预览失败：</strong> {{ loadSheetError }}
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
            currentUser: { identity: 'manager' }, // 假设的当前用户信息，用于权限判断
            isPreviewing: false,
            isLoadingSheet: false,
            loadSheetError: null,
            previewingFileName: ''
        }
    },

    computed: {
        // 从文件列表中筛选出设计策划书
        planningDocument() {
            // 假设策划书的 documentType 为 'PLANNING_DOCUMENT'
            return this.fileList.find(f => f.documentType === 'PLANNING_DOCUMENT');
        },
        // 判断当前用户是否可编辑
        canEdit() {
            return this.currentUser && this.currentUser.identity.toLowerCase() === 'manager';
        }
    },

    methods: {
        // --- 核心数据获取逻辑 ---
        fetchData() {
            // 【核心修正2】: 确保使用 this.projectId
            if (!this.projectId) return;
            this.resetState();
            this.isLoading = true;

            Promise.all([
                axios.get(`/api/projects/${this.projectId}`),
                axios.get(`/api/projects/${this.projectId}/files`)
            ]).then(([projectResponse, filesResponse]) => {
                this.projectInfo = projectResponse.data;
                this.fileList = filesResponse.data;
            }).catch(error => {
                this.isLoading = false;
                this.loadError = "加载项目数据失败，请确认项目是否存在或刷新重试。";
                console.error("【PlanningPanel】获取项目数据失败:", error);
                this.$message.error("加载项目数据失败！");
            }).finally(() => {
                this.isLoading = false;
            });
        },
        
        // --- 文件上传逻辑 ---
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
            // 【核心修正3】: 确保使用 this.projectId
            const apiUrl = `/api/projects/${this.projectId}/files/${documentType}`;
            
            this.$message('正在上传策划书...');
            axios.post(apiUrl, formData).then(response => {
                this.$message.success('设计策划书上传成功！');
                this.fetchProjectFiles(); // 上传成功后刷新文件列表
            }).catch(error => {
                const errorMessage = (error.response && error.response.data) ? error.response.data : '上传失败';
                this.$message.error(errorMessage);
            });
        },
        /**
 * 【新增】当 iframe 加载完成时调用
 */
onIframeLoad() {
    console.log("【PlanningPanel】预览 iframe 已加载。");
    // iframe 加载完成后，如果正在预览某个文件，就立即向它发送加载指令
    if (this.isPreviewing && this.planningDocument) {
        this.loadSheetIntoIframe(this.planningDocument);
    }
},

/**
 * 【新增】向 iframe 发送加载表格数据的消息
 */
loadSheetIntoIframe(fileInfo) {
    this.isLoadingSheet = false; // iframe 已加载，可以停止 loading 状态了
    const targetIframe = this.$refs.previewIframe;
    if (targetIframe && targetIframe.contentWindow) {
        const options = { allowUpdate: false, showtoolbar: false }; // 策划书始终是只读的
        const fileUrl = `/api/files/content/${fileInfo.id}?t=${new Date().getTime()}`;
        
        targetIframe.contentWindow.postMessage({
            type: 'LOAD_SHEET',
            payload: { fileUrl, fileName: fileInfo.fileName, options }
        }, window.location.origin);

        console.log("【PlanningPanel】已向 iframe 发送 LOAD_SHEET 指令。");
    } else {
        this.loadSheetError = "无法与预览窗口建立通信。";
    }
},

/**
 * 【新增】导出当前预览的表格
 */
exportCurrentSheet() {
    const targetIframe = this.$refs.previewIframe;
    if (targetIframe && targetIframe.contentWindow) {
        targetIframe.contentWindow.postMessage({
            type: 'EXPORT_SHEET',
            payload: { fileName: this.previewingFileName }
        }, window.location.origin);
    }
},
        
        // --- 只刷新文件列表 ---
        fetchProjectFiles() {
            // 【核心修正4】: 确保使用 this.projectId
            axios.get(`/api/projects/${this.projectId}/files`).then(response => {
                this.fileList = response.data;
            });
        },

        previewFile(file) {
            if (!file || !file.id) return;
            this.isPreviewing = true;
            this.isLoadingSheet = true; // 开始加载
            this.loadSheetError = null;
            this.previewingFileName = file.fileName;
        
            // 【核心修改】我们不再在这里调用渲染逻辑
            // 而是等待 iframe 的 @load 事件触发 onIframeLoad 方法
            // 如果 iframe 已经加载过了，我们可以手动调用一次
            if (this.$refs.previewIframe) {
                this.loadSheetIntoIframe(file);
            }
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
                                title: exportJson.info ? exportJson.info.name : this.previewingFileName,
                                lang: 'zh',
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
            this.previewingFileName = '';
            // 我们不再需要手动销毁 Luckysheet 实例，因为它在 iframe 内部
        },

        // --- 文件删除逻辑 ---
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

        // --- 辅助方法 ---
        resetState() {
            this.isLoading = false;
            this.projectInfo = null;
            this.fileList = [];
            this.loadError = null;
            this.closePreview();
        }
    },

    // --- 生命周期钩子 ---
    mounted() {
        console.log("【PlanningPanel】已挂载，初始 projectId:", this.projectId);
        this.fetchData();

        // =======================================================
        // ↓↓↓ 【【【新增：智能滚动锁的全部启动逻辑】】】 ↓↓↓
        // =======================================================
        console.log('[INIT] [PlanningPanel] 启动智能滚动拦截器...');

        this._scrollLock = {
            lastKnownScrollY: window.scrollY || document.documentElement.scrollTop,
            isUserScrolling: false, 
            timeoutId: null,
            animationFrameId: null
        };
        
        const scrollLockLoop = () => {
            if (this && this._scrollLock) {
                if (!this._scrollLock.isUserScrolling && window.scrollY !== this._scrollLock.lastKnownScrollY) {
                    window.scrollTo(0, this._scrollLock.lastKnownScrollY);
                } else {
                    this._scrollLock.lastKnownScrollY = window.scrollY;
                }
                this._scrollLock.animationFrameId = requestAnimationFrame(scrollLockLoop);
            }
        };
        scrollLockLoop();
        
        this.handleWheel = () => {
            this._scrollLock.isUserScrolling = true;
            clearTimeout(this._scrollLock.timeoutId);
            this._scrollLock.timeoutId = setTimeout(() => {
                this._scrollLock.isUserScrolling = false;
            }, 200);
        };

        window.addEventListener('wheel', this.handleWheel, { passive: true });
        // =======================================================
    },
    beforeDestroy() {
        console.log("【PlanningPanel】将被销毁，清理资源...");
        this.resetState();

        // =======================================================
        // ↓↓↓ 【【【新增：智能滚动锁的清理逻辑】】】 ↓↓↓
        // =======================================================
        console.log('[CLEANUP] [PlanningPanel] 停止智能滚动拦截器...');
        
        if (this._scrollLock) {
            cancelAnimationFrame(this._scrollLock.animationFrameId);
            clearTimeout(this._scrollLock.timeoutId);
        }
        window.removeEventListener('wheel', this.handleWheel);
        // =======================================================
    },
    // 【核心修正5】: 监听 projectId 的变化
    watch: {
        projectId(newId, oldId) {
            console.log(`【PlanningPanel】检测到 projectId 从 ${oldId} 变为 ${newId}`);
            if (newId && newId !== oldId) {
                this.fetchData();
            }
        }
    }
});