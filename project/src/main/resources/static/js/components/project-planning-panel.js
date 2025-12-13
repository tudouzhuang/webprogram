// public/js/components/project-planning-panel.js

Vue.component('project-planning-panel', {
    // 【核心修正1】: 将 props 的名字从 recordId 改为 projectId
    props: {
        projectId: {
            type: [String, Number],
            required: true
        },
        // 接收用户信息以判断权限
        currentUser: {
            type: Object,
            default: () => ({})
        }
    },
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
                        <el-descriptions title="项目基本信息" :column="2" border>
                            <el-descriptions-item label="项目名称">{{ projectInfo.projectName }}</el-descriptions-item>
                            <el-descriptions-item label="项目编号">{{ projectInfo.projectNumber }}</el-descriptions-item>
                            <el-descriptions-item label="客户名称">{{ projectInfo.customerName || '-' }}</el-descriptions-item>
                            <el-descriptions-item label="创建时间">{{ formatDate(projectInfo.createdAt) }}</el-descriptions-item>
                        </el-descriptions>
                    </div>
                </div>
            </div>

            <!-- 2. 设计策划书管理区域 -->
            <div class="card">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <div>
                            <h4 class="card-title mb-1">设计策划书管理</h4>
                            <p class="card-description text-muted mb-0">
                                管理项目设计前期的核心策划文档。
                                <span v-if="canEdit" class="text-success"><i class="el-icon-check"></i> 可编辑</span>
                                <span v-else class="text-secondary"><i class="el-icon-lock"></i> 只读</span>
                            </p>
                        </div>
                        
                        <!-- 【修改】上传按钮常驻，开启 multiple 支持多选 -->
                        <el-upload
                            v-if="canEdit"
                            action="#" 
                            multiple
                            :http-request="handleFileUpload"
                            :show-file-list="false"
                            :before-upload="beforeUpload">
                            <el-button type="primary" size="small" icon="el-icon-upload">上传策划书</el-button>
                        </el-upload>
                    </div>
                    
                    <!-- 【修改】使用表格展示多文件列表 -->
                    <el-table :data="planningDocuments" style="width: 100%" border stripe empty-text="暂无设计策划书">
                        <el-table-column type="index" width="50" align="center"></el-table-column>
                        
                        <el-table-column prop="fileName" label="文件名" min-width="200">
                            <template slot-scope="scope">
                                <i class="el-icon-document text-primary"></i>
                                <span class="ml-2 font-weight-bold">{{ scope.row.fileName }}</span>
                                <!-- 分割文件标记 -->
                                <el-tag v-if="scope.row.fileName.includes('_part')" type="warning" size="mini" effect="plain" class="ml-2">分割卷</el-tag>
                            </template>
                        </el-table-column>
                        
                        <!-- 文件大小列 (增加兼容性处理) -->
                        <el-table-column label="大小" width="100" align="center">
                            <template slot-scope="scope">
                                <el-tag v-if="scope.row.fileSize !== undefined" :type="isLargeFile(scope.row) ? 'danger' : 'info'" size="mini" effect="plain">
                                    {{ formatFileSize(scope.row.fileSize) }}
                                </el-tag>
                                <span v-else class="text-muted" style="font-size: 12px;">
                                    <i class="el-icon-loading"></i> 计算中...
                                </span>
                            </template>
                        </el-table-column>
                        
                        <el-table-column prop="createdAt" label="上传时间" width="160" align="center">
                            <template slot-scope="scope">{{ formatDate(scope.row.createdAt) }}</template>
                        </el-table-column>
                        
                        <!-- 【UI修复】宽度减小，按钮分两行 -->
                        <el-table-column label="操作" width="200" align="center">
                            <template slot-scope="scope">
                                <div class="d-flex flex-column" style="gap: 5px;">
                                    <!-- 第一行：查看与下载 -->
                                    <div class="d-flex justify-content-center" style="gap: 5px;">
                                        <el-button size="mini" type="success" icon="el-icon-view" plain @click="handlePreviewClick(scope.row)">预览</el-button>
                                        <el-button size="mini" type="primary" icon="el-icon-download" plain @click="downloadFile(scope.row)">下载</el-button>
                                    </div>
                                    <!-- 第二行：管理操作 (仅编辑权限可见) -->
                                    <div class="d-flex justify-content-center" style="gap: 5px;" v-if="canEdit">
                                        <!-- 分割按钮 (仅针对大文件显示) -->
                                        <el-button v-if="isLargeFile(scope.row)" size="mini" type="warning" icon="el-icon-scissors" plain @click="handleSplitFile(scope.row)">分割</el-button>
                                        <!-- 删除按钮 -->
                                        <el-button size="mini" type="danger" icon="el-icon-delete" plain @click="deleteFile(scope.row)">删除</el-button>
                                    </div>
                                </div>
                            </template>
                        </el-table-column>
                    </el-table>

                </div>
            </div>

            <!-- 3. Luckysheet 预览区域 (弹窗模式) -->
            <el-dialog 
                :title="'文件预览: ' + previewingFileName" 
                :visible.sync="isPreviewing" 
                fullscreen
                append-to-body
                custom-class="preview-dialog">
                
                <div v-loading="isLoadingSheet" style="height: calc(100vh - 100px);">
                    <!-- 引用优化后的 loader -->
                    <iframe 
                        v-if="isPreviewing"
                        ref="previewIframe"
                        src="/luckysheet-iframe-loader.html"
                        @load="onIframeLoad"
                        style="width: 100%; height: 100%; border: none;">
                    </iframe>
                </div>
            </el-dialog>

            <style>
                .preview-dialog .el-dialog__body { padding: 0; }
                .preview-dialog .el-dialog__header { padding: 15px 20px; border-bottom: 1px solid #eee; }
            </style>

        </div>
    `,
    
    data() {
        return {
            isLoading: false,
            projectInfo: null,
            fileList: [], // 所有文件
            loadError: null,
            
            // 预览状态
            isPreviewing: false,
            isLoadingSheet: false,
            previewingFileName: '',
            currentPreviewFile: null,

            // 分割状态
            isSplitting: false
        }
    },

    computed: {
        // 【核心修复】筛选出所有策划书（前缀匹配，支持多文件）
        // 只要 documentType 是以 'PLANNING_DOCUMENT' 开头，都算作策划书
        planningDocuments() {
            if (!this.fileList) return [];
            return this.fileList.filter(f => f.documentType && f.documentType.startsWith('PLANNING_DOCUMENT'));
        },
        // 权限判断
        canEdit() {
            if (!this.currentUser || !this.currentUser.identity) return false;
            const role = this.currentUser.identity.toUpperCase();
            return role === 'MANAGER' || role === 'ADMIN';
        }
    },

    methods: {
        // --- 核心数据获取逻辑 ---
        fetchData() {
            if (!this.projectId) return;
            this.isLoading = true;

            Promise.all([
                axios.get(`/api/projects/${this.projectId}`),
                axios.get(`/api/projects/${this.projectId}/files`)
            ]).then(([projectResponse, filesResponse]) => {
                this.projectInfo = projectResponse.data;
                this.fileList = filesResponse.data;
                
                // 数据加载完后，启动文件大小探测（针对旧数据或后端没存大小的情况）
                this.detectFileSizes();

            }).catch(error => {
                this.loadError = "加载项目数据失败。";
                console.error("Fetch Error:", error);
            }).finally(() => {
                this.isLoading = false;
            });
        },
        
        // --- 纯前端探测文件大小的方法 ---
        detectFileSizes() {
            this.planningDocuments.forEach((file) => {
                // 如果后端没返回 fileSize (为null或0)，我们手动去问一下
                if (file.fileSize === undefined || file.fileSize === null || file.fileSize === 0) {
                    const fileUrl = `/api/files/content/${file.id}`;
                    // 发送 HEAD 请求
                    axios.head(fileUrl)
                        .then(response => {
                            const length = response.headers['content-length'];
                            if (length) {
                                // 使用 Vue.set 确保视图更新
                                this.$set(file, 'fileSize', parseInt(length));
                                console.log(`[FileSize] 探测到文件 ${file.fileName} 大小: ${length} bytes`);
                            }
                        })
                        .catch(() => {
                            // 设为 -1 表示探测失败，避免一直转圈
                            this.$set(file, 'fileSize', -1);
                        });
                }
            });
        },
        
        // --- 批量上传逻辑 ---
        beforeUpload(file) {
            const isExcel = file.name.endsWith('.xls') || file.name.endsWith('.xlsx');
            if (!isExcel) this.$message.error('只能上传Excel文件!');
            return isExcel;
        },
        
        handleFileUpload(options) {
            const file = options.file;
            const formData = new FormData();
            formData.append('file', file);
            
            // 【核心修复】构造唯一的 documentType
            // 格式：PLANNING_DOCUMENT_{文件名}
            // 这样后端就会把它当成一个新的类型存储，从而实现“多文件上传”且不覆盖旧文件（除非文件名完全相同）
            const safeFileName = encodeURIComponent(file.name); 
            const documentTypeKey = `PLANNING_DOCUMENT_${safeFileName}`;
            
            const apiUrl = `/api/projects/${this.projectId}/files/${documentTypeKey}`;
            
            axios.post(apiUrl, formData).then(response => {
                this.$message.success(`文件 ${file.name} 上传成功！`);
                // 刷新列表，触发新一轮探测
                this.fetchProjectFiles(); 
            }).catch(error => {
                this.$message.error(`文件 ${file.name} 上传失败`);
                console.error(error);
            });
        },

        // --- 辅助：文件大小格式化与判断 ---
        formatFileSize(bytes) {
            if (bytes === -1) return '未知'; // 探测失败
            if (bytes === undefined || bytes === null) return '计算中...';
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        },

        isLargeFile(file) {
            // 兼容 fileSize 或 size 属性
            const size = file.fileSize || file.size || 0;
            return size > 20 * 1024 * 1024; // > 20MB
        },

        // --- 智能预览逻辑 (曲线救国) ---
        handlePreviewClick(file) {
            // 1. 检查文件大小
            if (this.isLargeFile(file)) {
                const sizeStr = this.formatFileSize(file.fileSize || file.size);
                this.$confirm(
                    `该文件较大 (${sizeStr})，直接预览可能导致浏览器卡顿或崩溃。\n\n是否使用【自动分割】功能？\n系统将自动将其拆分为多个小文件，方便流畅查看。`, 
                    '大文件处理建议', 
                    {
                        confirmButtonText: '🚀 自动分割 (推荐)',
                        cancelButtonText: '强制预览 (风险)',
                        type: 'warning',
                        distinguishCancelAndClose: true,
                        center: true
                    }
                ).then(() => {
                    // 用户选择：自动分割
                    this.handleSplitFile(file);
                }).catch((action) => {
                    if (action === 'cancel') {
                        // 用户选择：强制预览
                        this.startPreview(file);
                    }
                });
            } else {
                // 小文件直接预览
                this.startPreview(file);
            }
        },

        // --- 预览启动 ---
        startPreview(file) {
            this.currentPreviewFile = file;
            this.previewingFileName = file.fileName;
            this.isPreviewing = true;
            this.isLoadingSheet = true;
            
            this.$nextTick(() => {
                const iframe = this.$refs.previewIframe;
                // 如果 iframe 已经缓存/加载过，直接触发加载逻辑
                if (iframe && iframe.contentWindow) {
                   setTimeout(() => this.onIframeLoad(), 200);
                }
            });
        },

        onIframeLoad() {
            if (!this.currentPreviewFile) return;
            this.isLoadingSheet = false;
            
            const iframe = this.$refs.previewIframe;
            if (iframe && iframe.contentWindow) {
                // 【核心】使用 Blob 模式 (不带 format=json) 加载，确保兼容性和图片显示
                const fileUrl = `/api/files/content/${this.currentPreviewFile.id}?t=${new Date().getTime()}`;
                
                iframe.contentWindow.postMessage({
                    type: 'LOAD_SHEET',
                    payload: { 
                        fileUrl, 
                        fileName: this.currentPreviewFile.fileName, 
                        options: { lang: 'zh', allowUpdate: false, showtoolbar: false } // 只读模式
                    }
                }, window.location.origin);
            }
        },

        // --- 导出逻辑 ---
        exportCurrentSheet() {
            const targetIframe = this.$refs.previewIframe;
            if (targetIframe && targetIframe.contentWindow) {
                targetIframe.contentWindow.postMessage({
                    type: 'EXPORT_SHEET', 
                    payload: { fileName: this.previewingFileName }
                }, window.location.origin);
            }
        },

        // --- 分割逻辑 ---
        async handleSplitFile(file) {
            if (this.isSplitting) return;
            this.isSplitting = true;
            
            const loading = this.$loading({
                lock: true,
                text: '正在智能分割大文件，请稍候...',
                spinner: 'el-icon-loading',
                background: 'rgba(0, 0, 0, 0.7)'
            });

            try {
                // 调用后端分割接口
                await axios.post(`/api/files/${file.id}/split`);
                this.$message.success(`文件 "${file.fileName}" 已成功分割！`);
                // 刷新列表显示分割后的文件
                await this.fetchProjectFiles();
            } catch (e) {
                console.error(e);
                this.$message.error('分割失败：' + (e.response?.data?.message || '服务器处理错误'));
            } finally {
                loading.close();
                this.isSplitting = false;
            }
        },

        // --- 下载逻辑 ---
        downloadFile(file) {
            const link = document.createElement('a');
            link.href = `/api/files/content/${file.id}`;
            link.download = file.fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        },

        // --- 删除逻辑 ---
        deleteFile(file) {
            this.$confirm(`确定删除 "${file.fileName}" 吗？`, '提示', { type: 'warning' })
                .then(() => {
                    axios.delete(`/api/files/${file.id}`).then(() => {
                        this.$message.success('删除成功');
                        this.fetchProjectFiles();
                        // 如果删除的是当前正在预览的文件，关闭预览
                        if (this.isPreviewing && this.previewingFileName === file.fileName) {
                            this.closePreview();
                        }
                    });
                }).catch(() => {});
        },

        // --- 辅助 ---
        fetchProjectFiles() {
            return axios.get(`/api/projects/${this.projectId}/files`).then(res => {
                this.fileList = res.data;
                // 每次刷新列表都重新探测一下
                this.detectFileSizes();
            });
        },
        formatDate(str) {
            return str ? new Date(str).toLocaleString() : '-';
        },
        closePreview() {
            this.isPreviewing = false;
            this.previewingFileName = '';
            this.currentPreviewFile = null;
        }
    },
    
    watch: {
        projectId: {
            immediate: true,
            handler(newVal) { if(newVal) this.fetchData(); }
        }
    }
});