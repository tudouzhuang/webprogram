Vue.component("project-planning-panel", {
    // 【核心修正1】: 将 props 的名字从 recordId 改为 projectId
    props: {
        projectId: {
            type: [String, Number],
            required: true,
        },
        // 接收用户信息以判断权限
        currentUser: {
            type: Object,
            default: () => ({}),
        },
    },
    template: `
        <div class="content-wrapper" style="width:100%;height:100%">

            <div class="card mb-4">
                <div class="card-body">
                    <div v-if="isLoading" class="text-center p-3">
                        <p>正在加载项目信息...</p>
                        <el-progress :percentage="100" status="success" :indeterminate="true" :duration="1"></el-progress>
                    </div>
                    <div v-else-if="loadError" class="alert alert-danger">{{ loadError }}</div>
                    <div v-else-if="projectInfo">
                        <el-descriptions title="项目基本信息" :column="2" border>
                            <el-descriptions-item label="项目名称">
                                {{ projectInfo.productName || projectInfo.projectNumber || '未命名项目' }}
                            </el-descriptions-item>
                            <el-descriptions-item label="项目编号/ID">
                                <span style="font-weight: bold; color: #409EFF;">{{ projectInfo.id }}</span>
                            </el-descriptions-item>
                        </el-descriptions>
                    </div>
                </div>
            </div>

            <div class="card" style="height: 80%; display: flex; flex-direction: column;">
                <div class="card-header bg-white pb-0">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <div class="d-flex align-items-center">
                            <div class="bg-primary-light text-primary rounded d-flex align-items-center justify-content-center mr-3" 
                                 style="width: 40px; height: 40px; background-color: #ecf5ff; border-radius: 8px;">
                                <i class="el-icon-reading" style="font-size: 20px; color: #409EFF;"></i>
                            </div>
                            
                            <div>
                                <h5 class="mb-0 font-weight-bold" style="color: #303133; font-size: 16px; line-height: 1.2;">
                                    设计策划书预览
                                </h5>
                                <div class="text-muted mt-1" style="font-size: 12px;">
                                    <i class="el-icon-mouse"></i> 点击下方标签切换 Sheet 文件
                                </div>
                            </div>
                        </div>
                        
                        <div class="d-flex" style="gap: 10px;">
                            <el-upload
                                v-if="canEdit"
                                action="#" 
                                multiple
                                :http-request="handleFileUpload"
                                :show-file-list="false"
                                :before-upload="beforeUpload">
                                <el-button type="primary" size="small" icon="el-icon-upload">上传</el-button>
                            </el-upload>

                            <el-button 
                                v-if="canEdit && mainFile" 
                                type="warning" 
                                size="small" 
                                icon="el-icon-scissors" 
                                @click="handleSplitFile(mainFile)">
                                智能分割
                            </el-button>

                            <el-button 
                                v-if="canEdit && childFiles.length > 0" 
                                type="danger" 
                                size="small" 
                                icon="el-icon-delete" 
                                plain
                                @click="handleClearSplitFiles">
                                清空分割
                            </el-button>
                            
                            <el-button 
                                v-if="planningDocuments.length > 0" 
                                type="success" 
                                size="small" 
                                icon="el-icon-download" 
                                plain
                                @click="handleExport">
                                下载
                            </el-button>

                            <el-button size="small" icon="el-icon-refresh" circle @click="fetchData"></el-button>
                        </div>
                    </div>

                    <el-tabs class="custom-tabs" v-model="activeFileId" @tab-click="handleTabClick">
                        <el-tab-pane 
                            v-for="file in planningDocuments" 
                            :key="file.id.toString()" 
                            :name="file.id.toString()">
                            <span slot="label">
                                <i v-if="file.documentType.startsWith('PLANNING_DOCUMENT')" class="el-icon-s-grid text-primary"></i>
                                <i v-else class="el-icon-document text-warning"></i>
                                {{ file.fileName }}
                                <i v-if="canEdit" class="el-icon-close text-danger ml-2" @click.stop="deleteFile(file)"></i>
                            </span>
                        </el-tab-pane>
                    </el-tabs>
                </div>

                <div class="card-body p-0" style="flex-grow: 1; position: relative;">
                    
                    <div v-if="showLargeFileConfirm" class="d-flex justify-content-center align-items-center h-100 bg-light" style="flex-direction: column; z-index: 20; position: absolute; width: 100%;">
                        <i class="el-icon-warning text-warning mb-3" style="font-size: 48px;"></i>
                        <h4 class="mb-2">该文件较大 (>20MB)</h4>
                        <p class="text-muted mb-4">直接预览可能会导致浏览器卡顿，建议先分割或下载。</p>
                        
                        <div class="d-flex" style="gap: 15px;">
                            <el-button 
                                type="warning" 
                                icon="el-icon-scissors" 
                                @click="handleSplitFile(planningDocuments.find(f => f.id.toString() === activeFileId))">
                                立即智能分割
                            </el-button>
                            
                            <el-button 
                                type="primary" 
                                plain 
                                icon="el-icon-view" 
                                @click="forceLoadCurrentFile">
                                强制预览
                            </el-button>
                        </div>
                    </div>

                    <iframe 
                        v-show="!showLargeFileConfirm && planningDocuments.length > 0"
                        ref="previewIframe"
                        src="/luckysheet-iframe-loader.html"
                        @load="onIframeLoad"
                        style="width: 100%; height: 100%; border: none;">
                    </iframe>
                    
                    <div v-if="!showLargeFileConfirm && planningDocuments.length === 0" class="d-flex justify-content-center align-items-center h-100 flex-column bg-light">
                        
                        <i class="el-icon-folder-opened mb-3" style="font-size: 64px; color: #dcdfe6;"></i>
                        <p class="text-muted mb-4">暂无设计策划书文件</p>
                        
                        <el-upload
                            v-if="canEdit"
                            action="#" 
                            multiple
                            :http-request="handleFileUpload"
                            :show-file-list="false"
                            :before-upload="beforeUpload">
                            
                            <el-button type="primary" icon="el-icon-upload" style="padding: 12px 30px; font-size: 16px; box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);">
                                立即上传文件
                            </el-button>
                        </el-upload>
                        
                        <div v-else class="text-muted" style="font-size: 12px;">
                            (您暂无上传权限)
                        </div>
                    </div>
                </div>
            </div>

            <el-dialog
                :title="isPartiallyFailed ? '处理完成 (部分缺失)' : '智能分割中'"
                :visible.sync="showProgressDialog"
                width="480px"
                :close-on-click-modal="false"
                :show-close="false"
                center
                append-to-body>
                <div class="text-center">
                    
                    <div v-if="isPartiallyFailed" class="text-warning">
                        <i class="el-icon-warning" style="font-size: 60px; color: #E6A23C; margin-bottom: 20px;"></i>
                        
                        <h4 style="color: #303133; margin-bottom: 10px;">文件处理完成，但有遗漏</h4>
                        
                        <div class="text-left p-3 mb-4" style="background-color: #fdf6ec; border: 1px solid #faecd8; border-radius: 4px; max-height: 150px; overflow-y: auto;">
                            <p class="mb-2 font-weight-bold" style="color: #E6A23C; font-size: 13px;">
                                <i class="el-icon-circle-close"></i> 以下 {{ skippedSheetsList.length }} 个表格因图片过多/内存不足被跳过：
                            </p>
                            <ul style="padding-left: 20px; margin: 0; color: #606266; font-size: 12px;">
                                <li v-for="name in skippedSheetsList" :key="name">{{ name }}</li>
                            </ul>
                        </div>

                        <p class="text-muted mb-4" style="font-size: 13px;">
                            其他表格已成功入库。您可以手动拆分上述失败的表格后，单独上传补充。
                        </p>

                        <div class="d-flex justify-content-center">
                            <el-button type="warning" @click="handleConfirmPartialSuccess">我知道了，加载已完成部分</el-button>
                        </div>
                    </div>

                    <div v-else>
                        <p class="mb-3 text-muted" style="min-height: 24px;">
                            <span v-if="splitProgress < 100 && splitProgress >= 0">
                                <i class="el-icon-cpu"></i> 正在处理... (遇错将自动跳过)
                            </span>
                            <span v-else-if="splitProgress >= 100" class="text-success font-weight-bold">
                                <i class="el-icon-upload"></i> 全部处理成功，写入数据库中...
                            </span>
                        </p>

                        <el-progress type="circle" :percentage="splitProgress" :status="progressStatus"></el-progress>
                        
                        <p class="mt-3 text-primary font-weight-bold" v-if="splitProgress < 100">已处理 {{ splitProgress }}%</p>
                        <p class="mt-3 text-warning font-weight-bold" v-else>请稍候，即将刷新...</p>
                    </div>

                </div>
            </el-dialog>
            
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
            previewingFileName: "",
            currentPreviewFile: null,
            skippedSheetsList: [], // 存储缺失的表格名
            isPartiallyFailed: false, // 是否处于部分失败状态
            // 分割状态
            isSplitting: false,
            showProgressDialog: false,
            splitProgress: 0,
            progressStatus: null,

            activeFileId: "", // 当前选中的 Tab ID
            isLoadingSheet: false, // 预览区域的加载状态
            showLargeFileConfirm: false,

            // 【新增】记录分割报错的 Sheet 名称
            splitErrorSheet: null,
            // 【新增】记录具体的错误原因
            splitErrorReason: '',
            // 【新增】预览超时定时器
            previewTimer: null,
            // 【新增】标记是否已因超时放弃当前预览
            isPreviewAbandoned: false,


        };
    },

    computed: {
        // 【核心修改】排序逻辑升级：提取开头的数字进行自然排序
        planningDocuments() {
            if (!this.fileList) return [];

            const docs = this.fileList.filter(
                (f) =>
                    f.documentType &&
                    (f.documentType.startsWith("PLANNING_DOCUMENT") ||
                        f.documentType === "SPLIT_CHILD_SHEET")
            );

            docs.sort((a, b) => {
                // 1. 类型优先级：主文件(PLANNING_DOCUMENT)永远排第一
                const typeA = a.documentType.startsWith("PLANNING_DOCUMENT") ? 0 : 1;
                const typeB = b.documentType.startsWith("PLANNING_DOCUMENT") ? 0 : 1;
                if (typeA !== typeB) return typeA - typeB;

                // 2. 提取文件名前面的数字 (例如 "10-贴字.xlsx" -> 10)
                const getNum = (name) => {
                    const match = name.match(/^(\d+)/);
                    return match ? parseInt(match[1]) : Number.MAX_SAFE_INTEGER; // 没有数字的排最后
                };

                const numA = getNum(a.fileName);
                const numB = getNum(b.fileName);

                if (numA !== numB) {
                    return numA - numB; // 按数字大小升序
                }

                // 3. 如果数字一样（或都没数字），按字符串自然顺序兜底
                return a.fileName.localeCompare(b.fileName, "zh-CN", { numeric: true });
            });

            return docs;
        },

        // 【新增】获取主文件对象（方便调用分割功能）
        mainFile() {
            return this.planningDocuments.find((f) =>
                f.documentType.startsWith("PLANNING_DOCUMENT")
            );
        },
        // 权限判断
        canEdit() {
            if (!this.currentUser || !this.currentUser.identity) return false;
            const role = this.currentUser.identity.toUpperCase();
            return role === "MANAGER" || role === "ADMIN";
        },

        childFiles() {
            if (!this.fileList) return [];
            return this.fileList.filter(f => f.documentType === 'SPLIT_CHILD_SHEET');
        },
    },
    methods: {
        // --- 核心数据获取逻辑 ---
        // --- 核心数据获取逻辑 (防缓存版) ---
        fetchData() {
            if (!this.projectId) return;
            this.isLoading = true;

            // 【加强点1】加一个随机时间戳 t=... 防止浏览器缓存
            const timestamp = new Date().getTime();

            Promise.all([
                axios.get(`/api/projects/${this.projectId}?t=${timestamp}`),
                axios.get(`/api/projects/${this.projectId}/files?t=${timestamp}`)
            ]).then(([pRes, fRes]) => {
                this.projectInfo = pRes.data;

                // 【调试日志】看看这次到底拉回来多少个
                console.log(`[Refresh] 拉取到文件数量: ${fRes.data.length}`);

                this.fileList = fRes.data;
                this.detectFileSizes();

                // 默认选中逻辑
                if ((!this.activeFileId || this.activeFileId === '') && this.planningDocuments.length > 0) {
                    this.activeFileId = this.planningDocuments[0].id.toString();
                    this.$nextTick(() => this.loadActiveFile());
                }
            }).catch(e => {
                this.loadError = "加载失败";
            }).finally(() => {
                this.isLoading = false;
            });
        },

        // --- 纯前端探测文件大小的方法 ---
        detectFileSizes() {
            this.planningDocuments.forEach((file) => {
                // 如果后端没返回 fileSize (为null或0)，我们手动去问一下
                if (
                    file.fileSize === undefined ||
                    file.fileSize === null ||
                    file.fileSize === 0
                ) {
                    const fileUrl = `/api/files/content/${file.id}`;
                    // 发送 HEAD 请求
                    axios
                        .head(fileUrl)
                        .then((response) => {
                            const length = response.headers["content-length"];
                            if (length) {
                                // 使用 Vue.set 确保视图更新
                                this.$set(file, "fileSize", parseInt(length));
                                console.log(
                                    `[FileSize] 探测到文件 ${file.fileName} 大小: ${length} bytes`
                                );
                            }
                        })
                        .catch(() => {
                            // 设为 -1 表示探测失败，避免一直转圈
                            this.$set(file, "fileSize", -1);
                        });
                }
            });
        },

        // --- 批量上传逻辑 ---
        beforeUpload(file) {
            const isExcel = file.name.endsWith(".xls") || file.name.endsWith(".xlsx");
            if (!isExcel) this.$message.error("只能上传Excel文件!");
            return isExcel;
        },

        handleFileUpload(options) {
            const file = options.file;
            const formData = new FormData();
            formData.append("file", file);

            // 【核心修复】构造唯一的 documentType
            // 格式：PLANNING_DOCUMENT_{文件名}
            // 这样后端就会把它当成一个新的类型存储，从而实现“多文件上传”且不覆盖旧文件（除非文件名完全相同）
            const safeFileName = encodeURIComponent(file.name);
            const documentTypeKey = `PLANNING_DOCUMENT_${safeFileName}`;

            const apiUrl = `/api/projects/${this.projectId}/files/${documentTypeKey}`;

            axios
                .post(apiUrl, formData)
                .then((response) => {
                    this.$message.success(`文件 ${file.name} 上传成功！`);
                    // 刷新列表，触发新一轮探测
                    this.fetchProjectFiles();
                })
                .catch((error) => {
                    this.$message.error(`文件 ${file.name} 上传失败`);
                    console.error(error);
                });
        },

        // --- 辅助：文件大小格式化与判断 ---
        formatFileSize(bytes) {
            if (bytes === -1) return "未知"; // 探测失败
            if (bytes === undefined || bytes === null) return "计算中...";
            if (bytes === 0) return "0 B";
            const k = 1024;
            const sizes = ["B", "KB", "MB", "GB"];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
        },

        isLargeFile(file) {
            // 兼容 fileSize 或 size 属性
            const size = file.fileSize || file.size || 0;
            return size > 20 * 1024 * 1024; // > 20MB
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
                const fileUrl = `/api/files/content/${this.currentPreviewFile.id
                    }?t=${new Date().getTime()}`;

                iframe.contentWindow.postMessage(
                    {
                        type: "LOAD_SHEET",
                        payload: {
                            fileUrl,
                            fileName: this.currentPreviewFile.fileName,
                            options: { lang: "zh", allowUpdate: false, showtoolbar: false }, // 只读模式
                        },
                    },
                    window.location.origin
                );
            }
        },

        // --- 导出逻辑 ---
        exportCurrentSheet() {
            const targetIframe = this.$refs.previewIframe;
            if (targetIframe && targetIframe.contentWindow) {
                targetIframe.contentWindow.postMessage(
                    {
                        type: "EXPORT_SHEET",
                        payload: { fileName: this.previewingFileName },
                    },
                    window.location.origin
                );
            }
        },

        // 【核心修改】带进度条的分割逻辑
        handleSplitFile(file) {
            if (this.isSplitting) return;

            // 1. 初始化弹窗状态
            this.isSplitting = true;
            this.showProgressDialog = true;
            this.splitProgress = 0;
            this.progressStatus = null;

            // 2. 发起请求
            axios
                .post(`/api/files/${file.id}/split-by-sheet`)
                .then(() => {
                    // 3. 启动轮询
                    this.pollProgress(file.id);
                })
                .catch((e) => {
                    console.error(e);
                    this.showProgressDialog = false;
                    this.isSplitting = false;
                    this.$message.error(
                        "启动失败：" + (e.response?.data?.message || "未知错误")
                    );
                });
        },


        // --- 下载逻辑 ---
        downloadFile(file) {
            const link = document.createElement("a");
            link.href = `/api/files/content/${file.id}`;
            link.download = file.fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        },

        // --- 删除逻辑 ---
        deleteFile(file) {
            this.$confirm(`确定删除 "${file.fileName}" 吗？`, "提示", {
                type: "warning",
            })
                .then(() => {
                    axios.delete(`/api/files/${file.id}`).then(() => {
                        this.$message.success("删除成功");
                        this.fetchProjectFiles();
                        // 如果删除的是当前正在预览的文件，关闭预览
                        if (
                            this.isPreviewing &&
                            this.previewingFileName === file.fileName
                        ) {
                            this.closePreview();
                        }
                    });
                })
                .catch(() => { });
        },

        // --- 辅助 ---
        fetchProjectFiles() {
            console.log(`[Debug] 正在请求项目 ${this.projectId} 的文件列表...`);
            return axios
                .get(`/api/projects/${this.projectId}/files`)
                .then((res) => {
                    const data = res.data;
                    console.log(`[Debug] API 响应成功，获取到 ${data.length} 条记录`);

                    // 简单的完整性检查
                    const splitFiles = data.filter(
                        (f) => f.documentType === "SPLIT_CHILD_SHEET"
                    );
                    if (splitFiles.length > 0) {
                        console.log(
                            "[Debug] API返回数据中包含子文件，ParentID 检查:",
                            splitFiles.map((f) => ({ id: f.id, pid: f.parentId }))
                        );
                    } else {
                        console.warn(
                            "[Debug] ⚠️ API返回数据中没有找到任何 SPLIT_CHILD_SHEET 类型的文件！可能是后端入库没成功？"
                        );
                    }

                    this.fileList = data;
                    // 每次刷新列表都重新探测一下
                    this.detectFileSizes();
                })
                .catch((e) => {
                    console.error("[Error] 获取文件列表失败", e);
                });
        },
        formatDate(str) {
            return str ? new Date(str).toLocaleString() : "-";
        },
        closePreview() {
            this.isPreviewing = false;
            this.previewingFileName = "";
            this.currentPreviewFile = null;
        },
        // --- 【新增】标签页切换逻辑 ---
        handleTabClick(tab) {
            const file = this.planningDocuments.find(
                (f) => f.id.toString() === this.activeFileId
            );
            if (!file) return;

            // --- 重置状态 ---
            this.showLargeFileConfirm = false; 
            this.isPreviewAbandoned = false; 
            if (this.previewTimer) clearTimeout(this.previewTimer);

            // --- 判定 1: 是否为已分割的子文件 ---
            if (file.documentType === 'SPLIT_CHILD_SHEET' || /_\d+\.xlsx$/.test(file.fileName)) {
                console.log('[Tab] 检测到子文件，强制预览');
                this.loadActiveFile(); 
                return;
            }

            // --- 判定 2: 文件过大 (> 20MB) ---
            const size = file.fileSize || file.size || 0;
            const THRESHOLD = 20 * 1024 * 1024; // 20MB (保持和其他地方一致)

            if (size > THRESHOLD) {
                // =======================================================
                // ↓↓↓ 【核心新增】检测是否已经分割过 ↓↓↓
                // =======================================================
                // 只要 fileList 里有任何一个文件的 parentId 等于当前文件的 id，说明已经分割过了
                const hasSplitChildren = this.fileList.some(f => f.parentId === file.id);

                if (hasSplitChildren) {
                    this.$message.warning('该大文件已完成分割，请直接查看右侧生成的子 Sheet 标签。');
                    // 直接终止，不预览，也不触发分割
                    return; 
                }
                // =======================================================

                console.log('[Tab] 文件过大且未分割，自动触发分割');
                this.$message.info('文件较大，系统正在自动为您分割以提升浏览体验...');
                this.handleSplitFile(file);
                return;
            }

            // --- 判定 3: 普通文件 (尝试预览 + 10秒熔断) ---
            this.previewWithTimeout(file);
        },

        // 【新增】带超时机制的预览
        previewWithTimeout(file) {
            console.log('[Tab] 尝试预览，启动10秒熔断计时...');

            // 启动 10秒 倒计时
            this.previewTimer = setTimeout(() => {
                this.isPreviewAbandoned = true;

                // 停止 loading 状态 (如果有)
                this.isLoadingSheet = false;

                this.$notify({
                    title: '加载响应较慢',
                    message: '文件解析超时 (10s)，系统已自动切换为分割模式。',
                    type: 'warning',
                    duration: 4500
                });

                console.warn('[Timeout] 预览超时，转为自动分割');
                this.handleSplitFile(file);
            }, 10000); // 10秒

            // 开始正常加载
            this.loadActiveFile();
        },

        // 加载当前选中的文件到 iframe
        loadActiveFile() {
            if (!this.activeFileId) return;
            const file = this.planningDocuments.find(
                (f) => f.id.toString() === this.activeFileId
            );
            if (!file) return;

            this.isLoadingSheet = true;
            const iframe = this.$refs.previewIframe;

            // 如果 iframe 已就绪，直接发消息；否则等待 onload
            if (iframe && iframe.contentWindow) {
                this.postMessageToIframe(file);
            }
        },

        // iframe 加载完毕的回调
        onIframeLoad() {
            const file = this.planningDocuments.find(
                (f) => f.id.toString() === this.activeFileId
            );
            if (file) this.postMessageToIframe(file);
        },
        // 【新增】用户点击“强制预览”
        forceLoadCurrentFile() {
            this.showLargeFileConfirm = false;
            this.loadActiveFile();
        },
        // 发送数据给 Luckysheet
        postMessageToIframe(file) {
            const fileUrl = `/api/files/content/${file.id}?t=${new Date().getTime()}`;
            const iframe = this.$refs.previewIframe;

            iframe.contentWindow.postMessage(
                {
                    type: "LOAD_SHEET",
                    payload: {
                        fileUrl: fileUrl,
                        fileName: file.fileName,
                        options: {
                            lang: "zh",
                            allowUpdate: false,
                            showtoolbar: false,
                            showsheetbar: false,
                        },
                    },
                },
                window.location.origin
            );

            setTimeout(() => {
                this.isLoadingSheet = false;
            }, 500);
        },
        handleClearSplitFiles() {
            const count = this.childFiles.length;
            if (count === 0) return;

            this.$confirm(
                `确定要删除所有 ${count} 个分割出来的子文件吗？\n(主策划书文件将保留)`,
                '高风险操作提示',
                {
                    confirmButtonText: '确定清空',
                    cancelButtonText: '取消',
                    type: 'error'
                }
            ).then(async () => {
                // 开启全屏 Loading 防止用户乱点
                const loading = this.$loading({
                    lock: true,
                    text: `正在清理 ${count} 个文件，请稍候...`,
                    spinner: 'el-icon-loading',
                    background: 'rgba(0, 0, 0, 0.7)'
                });

                try {
                    // 1. 构造所有删除请求
                    const deletePromises = this.childFiles.map(file => {
                        return axios.delete(`/api/files/${file.id}`);
                    });

                    // 2. 并发执行
                    await Promise.all(deletePromises);

                    this.$message.success('清理完成，列表已重置');

                    // 3. 如果当前选中的是子文件，重置选中到主文件
                    const main = this.mainFile;
                    if (main) {
                        this.activeFileId = main.id.toString();
                    } else {
                        this.activeFileId = '';
                    }

                    // 4. 刷新列表
                    this.fetchData();

                } catch (e) {
                    console.error(e);
                    this.$message.error('部分文件清理失败，请重试');
                    this.fetchData(); // 无论成功失败都刷新一下
                } finally {
                    loading.close();
                }
            }).catch(() => { });
        },

        // 【新增】重新上传按钮逻辑
        handleReUpload() {
            this.showProgressDialog = false;
            this.splitErrorSheet = null; // 重置错误状态
            // 触发文件上传框点击 (假设你的 upload 组件 ref 叫 upload)
            // 或者仅仅关闭弹窗让用户自己点
            this.$message.info('请重新选择文件上传');
        },

        // 【新增】关闭弹窗重置
        closeProgressDialog() {
            this.showProgressDialog = false;
            this.splitErrorSheet = null;
            this.isSplitting = false;
        },

        pollProgress(fileId) {
            console.log(`[Poll] 准备开始轮询文件 ${fileId} 的进度...`);
            
            // 保存 Vue 实例的引用，防止 this 丢失
            const self = this;

            // 1. 清理旧定时器
            if (self._pollTimer) {
                clearInterval(self._pollTimer);
                self._pollTimer = null;
            }

            self.skippedSheetsList = [];
            self.progressStatus = null; 

            // 2. 延迟 500ms 启动
            setTimeout(() => {
                // 再次检查清理
                if (self._pollTimer) clearInterval(self._pollTimer);

                console.log('[Poll] 定时器启动，开始每秒请求...'); // ★ 确认定时器真的启动了

                self._pollTimer = setInterval(() => {
                    const url = `/api/files/${fileId}/split-progress?t=${new Date().getTime()}`;
                    
                    // ★ 打印正在请求的 URL，请在控制台确认这个 URL 是否拼写正确
                    console.log(`[Poll] 正在请求: ${url}`); 

                    axios.get(url)
                        .then(res => {
                            const data = res.data;
                            // 确保 data 不为空
                            if (!data) {
                                console.error('[Poll] 响应数据为空！');
                                return;
                            }

                            const p = data.progress;
                            console.log(`[Poll] 收到响应: 进度=${p}, 错误信息=${data.errorMessage}`); // ★ 关键日志

                            self.splitProgress = p;

                            // Case 1: 成功
                            if (p >= 100) {
                                clearInterval(self._pollTimer);
                                self._pollTimer = null;
                                // ... (成功逻辑保持不变) ...
                                self.progressStatus = 'success';
                                self.$message.success('🎉 处理完成，即将刷新');
                                location.reload();
                            } 
                            // Case 2: 失败 (-1)
                            else if (p === -1) {
                                clearInterval(self._pollTimer);
                                self._pollTimer = null;

                                self.progressStatus = 'exception';
                                self.isSplitting = false;
                                self.showProgressDialog = false;
                                
                                const errorMsg = data.errorMessage || '发生未知错误';
                                console.error('[Poll] 捕获到后端报错:', errorMsg);

                                self.$alert(errorMsg, '文件处理失败', {
                                    confirmButtonText: '关闭',
                                    type: 'error',
                                    showClose: false
                                });
                            }
                        })
                        .catch((e) => {
                            // ★ 打印详细的网络错误
                            console.error('[Poll] 请求出错:', e);
                            if (e.response) {
                                console.error('[Poll] 状态码:', e.response.status);
                                console.error('[Poll] 响应体:', e.response.data);
                            }
                        });
                }, 1000);
            }, 500);
        },

        // 【新增】用户点击“确认部分缺失，继续刷新”
        handleConfirmPartialSuccess() {
            this.showProgressDialog = false;
            this.isSplitting = false;
            location.reload(); // 依然刷新，让用户看成功的那部分
        },

        // 【新增/修改】监听 Iframe 发来的消息
        messageEventListener(event) {
            if (!event || !event.data) return;
            const data = event.data;

            // 判断消息类型：Luckysheet 渲染完成
            // 注意：你需要确保 iframe 那边发的 type 是这个名字
            if (data.type === 'LUCKYSHEET_RENDER_FINISHED' || data.type === 'LUCKYSHEET_SUCCESS') {

                console.log('[Message] 收到 Iframe 加载完成信号');

                // 【核心逻辑 1】如果标记为“已放弃”（即超时了），则忽略这次成功
                // 防止已经切到分割界面了，预览界面又突然跳出来干扰
                if (this.isPreviewAbandoned) {
                    console.warn('[Preview] 加载过慢，超时逻辑已触发，忽略本次渲染结果。');
                    return;
                }

                // 【核心逻辑 2】不仅没超时，还成功了 -> 赶紧把炸弹（定时器）拆了！
                if (this.previewTimer) {
                    clearTimeout(this.previewTimer);
                    this.previewTimer = null;
                    console.log('[Preview] ⚡️ 加载成功，已取消 10s 倒计时熔断。');
                }

                // 停止 loading 动画
                this.isLoadingSheet = false;
            }
        },
        // 【新增/修改】导出下载逻辑
        handleExport() {
            // 1. 获取当前选中的文件
            const activeFile = this.planningDocuments.find(
                (f) => f.id.toString() === this.activeFileId
            );

            if (!activeFile) {
                this.$message.warning('当前没有选中的文件！');
                return;
            }

            // 2. 【分支 A】如果是大文件拦截状态（Iframe 里没数据），直接下载源文件
            if (this.showLargeFileConfirm) {
                this.$confirm('当前文件未加载到预览框中（大文件拦截），将直接下载原始文件？', '提示', {
                    confirmButtonText: '下载原文件',
                    cancelButtonText: '取消',
                    type: 'info'
                }).then(() => {
                    this.downloadSourceFile(activeFile);
                }).catch(() => {});
                return;
            }

            // 3. 【分支 B】正常预览状态，通知 Iframe 导出 (这样可以保留 Luckysheet 的渲染效果)
            const iframe = this.$refs.previewIframe;
            
            if (!iframe || !iframe.contentWindow) {
                this.$message.error('编辑器实例未就绪');
                return;
            }

            // 发送指令
            iframe.contentWindow.postMessage({
                type: 'EXPORT_SHEET',
                payload: {
                    // 确保文件名有后缀
                    fileName: activeFile.fileName.endsWith('.xlsx') ? activeFile.fileName : (activeFile.fileName + '.xlsx')
                }
            }, window.location.origin);

            this.$message.success('已发送导出请求，正在生成 Excel...');
        },

        // 【辅助】直接下载源文件 (用于大文件或兜底)
        downloadSourceFile(file) {
            const link = document.createElement("a");
            // 使用你的后端下载接口
            link.href = `/api/files/content/${file.id}`; 
            link.download = file.fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        },

    },

    mounted() {
        console.log('[INIT] 启动带敌我识别的终极滚动守护神...');

        // 【步骤1】初始化状态对象
        this._scrollGuardian = {
            // 【关键】这个变量记录的不是一个固定的值，而是【上一帧】的滚动位置
            lastKnownScrollY: window.scrollY || document.documentElement.scrollTop,

            // 【关键】敌我识别标志位
            isUserScrolling: false,

            scrollTimeoutId: null,
            animationFrameId: null
        };

        // 【步骤2】定义守护循环
        const guardianLoop = () => {
            if (this && this._scrollGuardian) {
                const currentScrollY = window.scrollY;

                // 【【【核心逻辑】】】
                if (this._scrollGuardian.isUserScrolling) {
                    // 如果是用户在滚动，我们不干涉，只更新记录
                    this._scrollGuardian.lastKnownScrollY = currentScrollY;
                } else {
                    // 如果不是用户在滚动，但位置却变了，这就是“坏的滚动”！
                    if (currentScrollY !== this._scrollGuardian.lastKnownScrollY) {
                        console.warn(`[GUARDIAN] 检测到未授权滚动！强行恢复到: ${this._scrollGuardian.lastKnownScrollY}`);
                        window.scrollTo(0, this._scrollGuardian.lastKnownScrollY);
                    }
                }
                this._scrollGuardian.animationFrameId = requestAnimationFrame(guardianLoop);
            }
        };

        // 【步骤3】启动守护循环
        guardianLoop();

        // 【步骤4】为“敌我识别系统”添加滚轮事件监听器
        // 这个监听器只负责一件事：在用户滚动滚轮时，举起“自己人”的牌子
        this.handleWheel = () => {
            // 举起牌子：告诉守护神，现在是我在滚，别开枪！
            this._scrollGuardian.isUserScrolling = true;

            // 清除之前的“放下牌子”定时器
            clearTimeout(this._scrollGuardian.scrollTimeoutId);

            // 设置一个新的定时器：如果200毫秒内没再滚动，就自动放下牌子
            this._scrollGuardian.scrollTimeoutId = setTimeout(() => {
                this._scrollGuardian.isUserScrolling = false;
                console.log('[GUARDIAN] 用户停止滚动，守护模式已恢复。');
            }, 200);
        };

        // 将滚轮监听器绑定到整个 window 上，这样无论鼠标在哪里都能捕捉到
        window.addEventListener('wheel', this.handleWheel, { passive: true });

        // --- 您已有的其他 mounted 逻辑 ---
        this.boundMessageListener = this.messageEventListener.bind(this);
        window.addEventListener('message', this.boundMessageListener);

    },

    beforeDestroy() {
        console.log('[CLEANUP] 停止终极滚动守护神...');

        if (this._scrollGuardian) {
            cancelAnimationFrame(this._scrollGuardian.animationFrameId);
            clearTimeout(this._scrollGuardian.scrollTimeoutId);
        }

        // 【【【核心清理】】】 必须移除全局的滚轮监听器
        window.removeEventListener('wheel', this.handleWheel);

        // --- 您已有的其他 beforeDestroy 逻辑 ---
        window.removeEventListener('message', this.boundMessageListener);
    },

    watch: {
        projectId: {
            immediate: true,
            handler(newVal) {
                if (newVal) this.fetchData();
            },
        },
    },
});
