Vue.component("project-planning-panel", {
    props: {
        projectId: {
            type: [String, Number],
            required: true,
        },
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

            <div class="card" style="height: 60vh; display: flex; flex-direction: column; justify-content: center; align-items: center; background: #f8f9fa; border: 2px dashed #dcdfe6;">
                
                <div class="text-center">
                    <div class="mb-4">
                        <i class="el-icon-reading" style="font-size: 64px; color: #409EFF;"></i>
                    </div>
                    <h3 class="mb-3 text-dark">设计策划书预览中心</h3>
                    <p class="text-muted mb-4" style="max-width: 500px; margin: 0 auto;">
                        当前共有 <b class="text-primary">{{ planningDocuments.length }}</b> 个设计文件。
                        <br>点击下方按钮打开独立阅读视窗，获取最佳浏览体验。
                    </p>

                    <div class="d-flex justify-content-center gap-3">
                         <el-upload
                            v-if="canEdit"
                            action="#" 
                            multiple
                            class="mr-3"
                            :http-request="handleFileUpload"
                            :show-file-list="false"
                            :before-upload="beforeUpload">
                            <el-button icon="el-icon-upload" size="medium" plain>上传新文件</el-button>
                        </el-upload>

                        <el-button 
                            type="primary" 
                            size="medium" 
                            icon="el-icon-data-board" 
                            :disabled="planningDocuments.length === 0"
                            style="
                                background: linear-gradient(135deg, #409EFF 0%, #0575E6 100%);
                                border: none;
                                font-weight: 800;
                                letter-spacing: 1px;
                                border-radius: 50px;
                                padding: 12px 36px;
                                box-shadow: 0 8px 16px rgba(64, 158, 255, 0.35);
                                font-size: 16px;
                                transition: all 0.3s ease;
                            "
                            @click="openFullscreenModal">
                            {{ planningDocuments.length > 0 ? '进入沉浸式阅读模式' : '暂无文件可预览' }}
                        </el-button>
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
                                <i class="el-icon-circle-close"></i> 以下 {{ skippedSheetsList.length }} 个表格因图片过多被跳过：
                            </p>
                            <ul style="padding-left: 20px; margin: 0; color: #606266; font-size: 12px;">
                                <li v-for="name in skippedSheetsList" :key="name">{{ name }}</li>
                            </ul>
                        </div>
                        <div class="d-flex justify-content-center">
                            <el-button type="warning" @click="handleConfirmPartialSuccess">我知道了</el-button>
                        </div>
                    </div>

                    <div v-else>
                        <p class="mb-3 text-muted" style="min-height: 24px;">
                            <span v-if="splitProgress < 100">
                                <i class="el-icon-cpu"></i> 正在处理... {{ splitProgress }}%
                            </span>
                            <span v-else class="text-success font-weight-bold">
                                <i class="el-icon-upload"></i> 处理成功!
                            </span>
                        </p>
                        <el-progress type="circle" :percentage="splitProgress" :status="progressStatus"></el-progress>
                    </div>
                </div>
            </el-dialog>

            <el-dialog
                :visible.sync="showFullscreenModal"
                fullscreen
                :show-close="false"
                custom-class="reader-dialog"
                append-to-body>
                
                <div slot="title" class="reader-header d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center">
                        <div class="logo-area mr-3">
                            <i class="el-icon-s-cooperation text-white" style="font-size: 24px;"></i>
                        </div>
                        <div class="text-white">
                            <div style="font-size: 16px; font-weight: bold; letter-spacing: 1px;">文档评审阅览室</div>
                            <div style="font-size: 12px; opacity: 0.8;">{{ projectInfo ? projectInfo.productName : 'Loading...' }}</div>
                        </div>
                    </div>
                    <div>
                        <el-tooltip content="导出当前表格" placement="bottom">
                            <el-button type="text" class="text-white mr-3" icon="el-icon-download" @click="handleExport">下载</el-button>
                        </el-tooltip>
                        
                        <el-tooltip content="清理所有分割产生的临时Sheet" placement="bottom">
                            <el-button v-if="canEdit && childFiles.length > 0" type="text" class="text-warning mr-3" icon="el-icon-delete" @click="handleClearSplitFiles">清理分割子文件</el-button>
                        </el-tooltip>

                        <el-button type="danger" size="small" icon="el-icon-close" circle @click="showFullscreenModal = false"></el-button>
                    </div>
                </div>

                <div class="reader-body d-flex">
                    
                    <div class="reader-sidebar">
                        <div class="sidebar-title">
                            <i class="el-icon-menu"></i> 文件目录 ({{ planningDocuments.length }})
                        </div>
                        <div class="file-list">
                            <div 
                                v-for="file in planningDocuments" 
                                :key="file.id"
                                class="file-item"
                                :class="{ 'active': activeFileId === file.id.toString() }"
                                @click="switchFileInReader(file)">
                                
                                <div class="d-flex align-items-center w-100">
                                    <i v-if="file.documentType.startsWith('PLANNING_DOCUMENT')" class="el-icon-s-grid mr-2 text-primary"></i>
                                    <i v-else class="el-icon-document mr-2 text-warning"></i>
                                    
                                    <span class="file-name text-truncate" :title="file.fileName">
                                        {{ file.fileName }}
                                    </span>
                                    
                                    <i v-if="canEdit" class="el-icon-delete delete-icon ml-auto" @click.stop="deleteFile(file)"></i>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="reader-content flex-grow-1 position-relative">
                        
                        <div v-if="showLargeFileConfirm" class="d-flex justify-content-center align-items-center h-100 bg-white" style="flex-direction: column; z-index: 20; position: absolute; width: 100%;">
                            <i class="el-icon-warning text-warning mb-3" style="font-size: 48px;"></i>
                            <h4 class="mb-2">该文件较大 (>20MB)</h4>
                            <p class="text-muted mb-4">建议分割后预览以获得流畅体验。</p>
                            <div class="d-flex" style="gap: 15px;">
                                <el-button type="warning" icon="el-icon-scissors" @click="handleSplitFile(planningDocuments.find(f => f.id.toString() === activeFileId))">
                                    立即智能分割
                                </el-button>
                                <el-button type="primary" plain icon="el-icon-view" @click="forceLoadCurrentFile">
                                    强制预览
                                </el-button>
                            </div>
                        </div>

                        <iframe 
                            v-show="!showLargeFileConfirm"
                            ref="fullscreenIframe"
                            src="/luckysheet-iframe-loader.html"
                            @load="onFullscreenIframeLoad"
                            style="width: 100%; height: 100%; border: none;">
                        </iframe>

                    </div>
                </div>

            </el-dialog>
        </div>
    `,
    // CSS 样式注入
    mounted() {
        // ... (原有的mounted逻辑保持不变，如有其他初始化代码请保留)

        // ============================================================
        // 1. 动态注入样式 (核心修复：强制全屏无滚动条布局)
        // ============================================================
        const style = document.createElement('style');
        style.innerHTML = `
            /* --- 1. 重置 Element UI Dialog 的外层容器 --- */
            /* 强制弹窗占满视口，并杀掉最外层滚动条 */
            .reader-dialog {
                display: flex;
                flex-direction: column;
                margin: 0 !important;
                position: absolute;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                overflow: hidden !important; 
                border-radius: 0 !important;
            }

            /* --- 2. 顶栏样式 --- */
            .reader-dialog .el-dialog__header {
                padding: 0 !important; 
                margin: 0 !important;
                background: #2b3245; /* 深色背景 */
                flex-shrink: 0;      /* 禁止被压缩 */
                height: 60px;        /* 固定高度 */
                overflow: hidden;
            }

            .reader-header {
                height: 60px;
                padding: 0 20px;
                display: flex; 
                justify-content: space-between;
                align-items: center; 
            }

            /* --- 3. 内容主体样式 (关键计算) --- */
            .reader-dialog .el-dialog__body {
                padding: 0 !important;
                margin: 0 !important;
                /* 高度 = 屏幕总高 - 顶栏高度 */
                height: calc(100vh - 60px) !important; 
                width: 100%;
                overflow: hidden !important; /* 禁止 Body 产生滚动条 */
                display: flex; /* 开启 Flex 布局让左右分栏 */
            }

            /* --- 4. 左右分栏布局 --- */
            .reader-body {
                flex: 1; 
                width: 100%;
                height: 100%; 
                display: flex; 
                overflow: hidden; 
            }

            /* 左侧侧边栏 */
            .reader-sidebar {
                width: 260px;
                height: 100%;
                background: #f5f7fa;
                border-right: 1px solid #e4e7ed;
                display: flex;
                flex-direction: column;
                flex-shrink: 0; /* 宽度固定 */
                z-index: 10;
            }

            .sidebar-title {
                padding: 0 20px;
                height: 50px;
                line-height: 50px;
                font-weight: bold;
                color: #606266;
                border-bottom: 1px solid #ebeef5;
                background: #fff;
                flex-shrink: 0;
            }

            .file-list {
                flex-grow: 1;
                overflow-y: auto; /* 只有这里允许垂直滚动 */
                padding: 10px 0;
            }

            /* 右侧内容区 (Iframe 容器) */
            .reader-content {
                flex-grow: 1;
                height: 100%;
                width: 0; /* 防止 Iframe 撑破 Flex 容器 */
                position: relative;
                background: #fff;
            }

            /* --- 5. 文件列表项交互样式 --- */
            .file-item {
                padding: 12px 20px;
                cursor: pointer;
                transition: all 0.2s;
                border-left: 3px solid transparent;
                color: #606266;
                font-size: 14px;
                display: flex;
                align-items: center;
            }
            .file-item:hover {
                background-color: #e6f7ff;
            }
            .file-item.active {
                background-color: #e6f7ff;
                border-left-color: #1890ff;
                color: #1890ff;
                font-weight: 500;
            }
            .delete-icon {
                display: none;
                color: #ff4d4f;
                padding: 4px;
                margin-left: auto; /* 靠右对齐 */
            }
            .file-item:hover .delete-icon {
                display: block;
            }
            .delete-icon:hover {
                background: rgba(255, 77, 79, 0.1);
                border-radius: 4px;
            }
        `;
        document.head.appendChild(style);

        // ============================================================
        // 2. 启动 Scroll Guardian (滚动守护神)
        // ============================================================
        console.log('[INIT] 启动带敌我识别的终极滚动守护神...');

        this._scrollGuardian = {
            lastKnownScrollY: window.scrollY || document.documentElement.scrollTop,
            isUserScrolling: false,
            scrollTimeoutId: null,
            animationFrameId: null
        };

        const guardianLoop = () => {
            if (this && this._scrollGuardian) {
                const currentScrollY = window.scrollY;

                // 核心逻辑：
                // 1. 如果是用户主动滚动 (isUserScrolling)，允许。
                // 2. 如果全屏模态框打开了 (showFullscreenModal)，允许 (因为此时主页面被遮住了，怎么滚都无所谓，且全屏模式下 overflow: hidden 实际上也没法滚)。
                // 3. 否则，强行锁死位置。
                if (this._scrollGuardian.isUserScrolling || this.showFullscreenModal) {
                    this._scrollGuardian.lastKnownScrollY = currentScrollY;
                } else {
                    if (currentScrollY !== this._scrollGuardian.lastKnownScrollY) {
                        window.scrollTo(0, this._scrollGuardian.lastKnownScrollY);
                    }
                }
                this._scrollGuardian.animationFrameId = requestAnimationFrame(guardianLoop);
            }
        };
        // 启动循环
        guardianLoop();

        // ============================================================
        // 3. 全局事件监听
        // ============================================================

        // 滚轮事件监听 (用于敌我识别)
        this.handleWheel = () => {
            this._scrollGuardian.isUserScrolling = true;
            clearTimeout(this._scrollGuardian.scrollTimeoutId);

            // 200ms 后认为停止滚动
            this._scrollGuardian.scrollTimeoutId = setTimeout(() => {
                this._scrollGuardian.isUserScrolling = false;
            }, 200);
        };
        window.addEventListener('wheel', this.handleWheel, { passive: true });

        // Iframe 消息监听
        this.boundMessageListener = this.messageEventListener.bind(this);
        window.addEventListener('message', this.boundMessageListener);
    },
    data() {
        return {
            isLoading: false,
            projectInfo: null,
            fileList: [],
            loadError: null,

            // 预览状态
            isPreviewing: false, // 兼容旧逻辑
            isLoadingSheet: false,
            previewingFileName: "",
            currentPreviewFile: null,

            // 分割状态
            skippedSheetsList: [],
            isPartiallyFailed: false,
            isSplitting: false,
            showProgressDialog: false,
            splitProgress: 0,
            progressStatus: null,
            splitErrorSheet: null,
            splitErrorReason: '',

            activeFileId: "", // 当前选中的 File ID
            showLargeFileConfirm: false,

            // 预览超时逻辑
            previewTimer: null,
            isPreviewAbandoned: false,

            // 核心：全屏模态框开关
            showFullscreenModal: false,
        };
    },

    computed: {
        planningDocuments() {
            if (!this.fileList) return [];
            const docs = this.fileList.filter(
                (f) => f.documentType && (f.documentType.startsWith("PLANNING_DOCUMENT") || f.documentType === "SPLIT_CHILD_SHEET")
            );
            docs.sort((a, b) => {
                const typeA = a.documentType.startsWith("PLANNING_DOCUMENT") ? 0 : 1;
                const typeB = b.documentType.startsWith("PLANNING_DOCUMENT") ? 0 : 1;
                if (typeA !== typeB) return typeA - typeB;
                const getNum = (name) => {
                    const match = name.match(/^(\d+)/);
                    return match ? parseInt(match[1]) : Number.MAX_SAFE_INTEGER;
                };
                const numA = getNum(a.fileName);
                const numB = getNum(b.fileName);
                if (numA !== numB) return numA - numB;
                return a.fileName.localeCompare(b.fileName, "zh-CN", { numeric: true });
            });
            return docs;
        },
        mainFile() {
            return this.planningDocuments.find((f) => f.documentType.startsWith("PLANNING_DOCUMENT"));
        },
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
        // --- 初始化数据 ---
        fetchData() {
            if (!this.projectId) return;
            this.isLoading = true;
            const timestamp = new Date().getTime();
            Promise.all([
                axios.get(`/api/projects/${this.projectId}?t=${timestamp}`),
                axios.get(`/api/projects/${this.projectId}/files?t=${timestamp}`)
            ]).then(([pRes, fRes]) => {
                this.projectInfo = pRes.data;
                this.fileList = fRes.data;
                this.detectFileSizes();
                // 默认选中第一个
                if ((!this.activeFileId || this.activeFileId === '') && this.planningDocuments.length > 0) {
                    this.activeFileId = this.planningDocuments[0].id.toString();
                }
            }).catch(e => {
                this.loadError = "加载失败";
            }).finally(() => {
                this.isLoading = false;
            });
        },

        // --- 打开全屏阅读器 ---
        openFullscreenModal() {
            if (this.planningDocuments.length === 0) {
                this.$message.warning("暂无文件");
                return;
            }
            // 确保有选中的文件
            if (!this.activeFileId) {
                this.activeFileId = this.planningDocuments[0].id.toString();
            }
            this.showFullscreenModal = true;

            // 延迟加载 iframe 内容
            this.$nextTick(() => {
                this.handleTabClick(); // 触发加载逻辑
            });
        },

        // --- 阅读器内部切换文件 ---
        switchFileInReader(file) {
            this.activeFileId = file.id.toString();
            this.handleTabClick();
        },

        // --- 核心：加载逻辑 (合并了之前的 handleTabClick 和 loadActiveFile) ---
        handleTabClick() {
            const file = this.planningDocuments.find(f => f.id.toString() === this.activeFileId);
            if (!file) return;

            // 1. 重置状态
            this.showLargeFileConfirm = false;
            this.isPreviewAbandoned = false;
            if (this.previewTimer) clearTimeout(this.previewTimer);

            // 2. 检查是否为子文件 (直接加载)
            if (file.documentType === 'SPLIT_CHILD_SHEET' || /_\d+\.xlsx$/.test(file.fileName)) {
                this.loadActiveFileToFullscreen();
                return;
            }

            // 3. 检查大文件
            const size = file.fileSize || file.size || 0;
            const THRESHOLD = 20 * 1024 * 1024; // 20MB
            if (size > THRESHOLD) {
                // 检查是否已分割
                const hasSplitChildren = this.fileList.some(f => f.parentId === file.id);
                if (hasSplitChildren) {
                    this.$message.warning('该大文件已完成分割，请点击左侧列表中的子Sheet查看。');
                    return;
                }
                this.$message.info('文件较大，系统正在为您智能分割...');
                this.handleSplitFile(file);
                return;
            }

            // 4. 普通文件：带超时加载
            this.previewWithTimeout(file);
        },

        previewWithTimeout(file) {
            // 【新增】安全机制：如果之前有正在跑的定时器，先清除，防止多重触发
            if (this.previewTimer) {
                clearTimeout(this.previewTimer);
                this.previewTimer = null;
            }

            console.log('[Timeout] 启动10秒熔断倒计时...');

            // 启动10秒超时熔断
            this.previewTimer = setTimeout(() => {
                // 标记为“已放弃”，这样即使后面 Luckysheet 加载出来了，也不会再处理
                this.isPreviewAbandoned = true;
                this.previewTimer = null;

                this.$notify({
                    title: '加载响应较慢',
                    message: '文件解析超时 (10s)，系统已自动切换为分割模式。',
                    type: 'warning',
                    duration: 4500
                });

                // 只有在没被销毁的情况下才执行分割，防止组件已关闭报错
                if (this.handleSplitFile) {
                    this.handleSplitFile(file);
                }
            }, 10000);

            this.loadActiveFileToFullscreen();
        },

        loadActiveFileToFullscreen() {
            const file = this.planningDocuments.find(f => f.id.toString() === this.activeFileId);
            if (!file) return;

            // 更新文件名显示
            this.previewingFileName = file.fileName;

            const iframe = this.$refs.fullscreenIframe;
            if (iframe && iframe.contentWindow) {
                const fileUrl = `/api/files/content/${file.id}?t=${new Date().getTime()}`;

                // 发送加载指令
                iframe.contentWindow.postMessage({
                    type: "LOAD_SHEET",
                    payload: {
                        fileUrl: fileUrl,
                        fileName: file.fileName,
                        options: {
                            lang: "zh",
                            allowUpdate: false,
                            showtoolbar: true, // 允许全屏缩放
                            showsheetbar: true,
                            showstatisticBar: true
                        },
                    },
                }, window.location.origin);
            }
        },

        // Iframe 加载完毕回调
        onFullscreenIframeLoad() {
            this.loadActiveFileToFullscreen();
        },

        // --- 强制预览 (跳过大文件警告) ---
        forceLoadCurrentFile() {
            this.showLargeFileConfirm = false;
            this.loadActiveFileToFullscreen();
        },

        // --- 导出当前文件 ---
        handleExport() {
            const activeFile = this.planningDocuments.find(f => f.id.toString() === this.activeFileId);
            if (!activeFile) return;

            // 如果处于大文件拦截界面，直接下载原文件
            if (this.showLargeFileConfirm) {
                this.downloadSourceFile(activeFile);
                return;
            }

            // 否则通过 Luckysheet 导出 (保留格式)
            const iframe = this.$refs.fullscreenIframe;
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({
                    type: 'EXPORT_SHEET',
                    payload: {
                        fileName: activeFile.fileName.endsWith('.xlsx') ? activeFile.fileName : (activeFile.fileName + '.xlsx')
                    }
                }, window.location.origin);
                this.$message.success('已发送导出请求...');
            }
        },

        downloadSourceFile(file) {
            const link = document.createElement("a");
            link.href = `/api/files/content/${file.id}`;
            link.download = file.fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        },

        // --- Iframe 消息监听 ---
        // 【修改后】监听 Iframe 发来的消息
        messageEventListener(event) {
            if (!event || !event.data) return;
            const data = event.data;

            if (data.type === 'LUCKYSHEET_RENDER_FINISHED' || data.type === 'LUCKYSHEET_SUCCESS') {

                console.log('[Message] 收到 Iframe 加载完成信号');

                // 1. 核心注入点：传入 iframe 的 window 对象 (即 event.source)
                this.injectZoomHandler(event.source); // ← [插入这行代码]

                if (this.isPreviewAbandoned) {
                    console.warn('[Preview] 加载过慢，超时逻辑已触发，忽略本次渲染结果。');
                    return;
                }

                if (this.previewTimer) {
                    clearTimeout(this.previewTimer);
                    this.previewTimer = null;
                    console.log('[Preview] ⚡️ 加载成功，已取消 10s 倒计时熔断。');
                }

                this.isLoadingSheet = false;
            }
        },

        // --- 其他原有逻辑 (分割、上传、删除、探测大小) 保持不变 ---
        // (为节省篇幅，这里简略列出，请确保你保留了原有的 method 实现)
        detectFileSizes() { /* ...原代码... */
            this.planningDocuments.forEach((file) => {
                if (file.fileSize === undefined || file.fileSize === null || file.fileSize === 0) {
                    const fileUrl = `/api/files/content/${file.id}`;
                    axios.head(fileUrl).then((response) => {
                        const length = response.headers["content-length"];
                        if (length) this.$set(file, "fileSize", parseInt(length));
                    }).catch(() => { this.$set(file, "fileSize", -1); });
                }
            });
        },
        beforeUpload(file) { return file.name.endsWith(".xls") || file.name.endsWith(".xlsx"); },
        handleFileUpload(options) {
            const file = options.file;
            const formData = new FormData();
            formData.append("file", file);
            const safeFileName = encodeURIComponent(file.name);
            const documentTypeKey = `PLANNING_DOCUMENT_${safeFileName}`;
            axios.post(`/api/projects/${this.projectId}/files/${documentTypeKey}`, formData)
                .then(() => {
                    this.$message.success(`文件 ${file.name} 上传成功！`);
                    this.fetchProjectFiles();
                }).catch((e) => this.$message.error("上传失败"));
        },
        fetchProjectFiles() { return this.fetchData(); }, // 复用 fetchData

        handleSplitFile(file) {
            if (this.isSplitting) return;
            this.isSplitting = true;
            this.showProgressDialog = true;
            this.splitProgress = 0;
            axios.post(`/api/files/${file.id}/split-by-sheet`).then(() => {
                this.pollProgress(file.id);
            }).catch((e) => {
                this.showProgressDialog = false;
                this.isSplitting = false;
                this.$message.error("启动分割失败");
            });
        },
        pollProgress(fileId) {
            const self = this;
            if (self._pollTimer) clearInterval(self._pollTimer);
            self.skippedSheetsList = [];
            setTimeout(() => {
                self._pollTimer = setInterval(() => {
                    axios.get(`/api/files/${fileId}/split-progress?t=${new Date().getTime()}`)
                        .then(res => {
                            const data = res.data;
                            if (!data) return;
                            self.splitProgress = data.progress;
                            if (data.progress >= 100) {
                                clearInterval(self._pollTimer);
                                self.progressStatus = 'success';

                                setTimeout(() => {
                                    self.$alert('文件智能分割已全部完成！点击确定将刷新页面以加载生成的子文件。', '处理成功', {
                                        confirmButtonText: '确定刷新',
                                        type: 'success',
                                        showClose: false, // 禁止关闭，强制用户点击刷新
                                        callback: () => {
                                            location.reload();
                                        }
                                    });
                                }, 300);
                            } 
                            else if (data.progress === -1) {
                                clearInterval(self._pollTimer);
                                self.progressStatus = 'exception';
                                self.isSplitting = false;
                                self.$alert(data.errorMessage || '未知错误');
                            }
                        });
                }, 1000);
            }, 500);
        },
        handleConfirmPartialSuccess() {
            this.showProgressDialog = false;
            location.reload();
        },
        deleteFile(file) {
            this.$confirm(`确定删除 "${file.fileName}" 吗？`, "提示", { type: "warning" })
                .then(() => {
                    axios.delete(`/api/files/${file.id}`).then(() => {
                        this.$message.success("删除成功");
                        this.fetchData();
                    });
                }).catch(() => { });
        },
        handleClearSplitFiles() {
            const count = this.childFiles.length;
            if (count === 0) return;
            this.$confirm(`确定清空所有 ${count} 个子文件吗？`, '提示', { type: 'error' })
                .then(async () => {
                    const loading = this.$loading({ lock: true, text: '清理中...' });
                    try {
                        await Promise.all(this.childFiles.map(f => axios.delete(`/api/files/${f.id}`)));
                        this.$message.success('清理完成');
                        this.fetchData();
                    } finally { loading.close(); }
                });
        },
        // 【新增】注入缩放控制逻辑 (手术刀式集成)
        // 【调试版】注入缩放控制逻辑
        // 【强制刷新版】注入缩放控制逻辑
        injectZoomHandler(iframeWindow) {
            if (!iframeWindow) return;

            // 1. 获取 Iframe 内部对象
            const doc = iframeWindow.document;
            const win = iframeWindow; // 拿到 iframe 的 window 对象

            // 2. 寻找容器
            const container = doc.getElementById('luckysheet');
            if (!container) return;

            // 3. 防止重复绑定
            if (container.dataset.hasZoomListener) return;
            container.dataset.hasZoomListener = "true";

            console.log('[Zoom] 缩放监听器注入成功！');

            container.addEventListener('wheel', function (event) {
                if (event.ctrlKey) {
                    event.preventDefault();

                    // 核心：获取 luckysheet 全局对象
                    const luckysheet = win.luckysheet;
                    // 尝试获取全局 Store (某些版本需要直接改 Store)
                    const Store = win.Store;

                    if (!luckysheet) return;

                    // 获取当前比例
                    let currentRatio = luckysheet.zoomRatio || 1;

                    // 计算新比例
                    const step = 0.05; // 稍微调小一点步长，缩放更平滑
                    let newRatio = event.deltaY < 0
                        ? currentRatio + step
                        : currentRatio - step;

                    // 限制范围 (0.4 到 2.0 是比较安全的范围，太小会报错)
                    newRatio = Math.max(0.4, Math.min(newRatio, 2.0));
                    newRatio = parseFloat(newRatio.toFixed(2));

                    console.log(`[Zoom] 尝试缩放: ${currentRatio} -> ${newRatio}`);

                    // ==========================================
                    // 🔥【核心修复】三管齐下，强制刷新 🔥
                    // ==========================================

                    // 1. 尝试调用官方 API
                    if (typeof luckysheet.setZoomRatio === 'function') {
                        luckysheet.setZoomRatio(newRatio);
                    } else {
                        // 如果没有 API，手动修改属性
                        luckysheet.zoomRatio = newRatio;
                        if (Store) Store.zoomRatio = newRatio;
                    }

                    // 2. 强制调用核心重绘方法 (解决“不刷新”的关键)
                    // 不同的版本刷新方法不同，我们挨个试一遍
                    try {
                        if (win.luckysheet.jfrefreshgrid) {
                            win.luckysheet.jfrefreshgrid(); // 核心刷新方法
                        } else if (win.luckysheet.refresh) {
                            win.luckysheet.refresh();       // 通用刷新
                        } else if (win.luckysheet.resize) {
                            win.luckysheet.resize();        // 缩放刷新
                        }
                    } catch (e) {
                        console.warn('[Zoom] 刷新画布失败', e);
                    }

                }
            }, { passive: false });
        },
    },

    beforeDestroy() {
        console.log('[CLEANUP] 停止终极滚动守护神...');
        if (this._scrollGuardian) {
            cancelAnimationFrame(this._scrollGuardian.animationFrameId);
            clearTimeout(this._scrollGuardian.scrollTimeoutId);
        }
        window.removeEventListener('wheel', this.handleWheel);
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