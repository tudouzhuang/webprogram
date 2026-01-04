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

            <div class="card" style="min-height: 60vh; display: flex; flex-direction: column;">
                
                <div class="card-header bg-white d-flex justify-content-between align-items-center py-3">
                    <div class="d-flex align-items-center">
                        <i class="el-icon-folder-opened text-primary mr-2" style="font-size: 20px;"></i>
                        <h5 class="mb-0 font-weight-bold">策划书文件管理</h5>
                        <el-tag size="small" class="ml-3" v-if="planningDocuments.length > 0">共 {{ planningDocuments.length }} 个文件</el-tag>
                    </div>
                    
                    <div class="d-flex" style="gap: 10px;">
                        <el-upload
                            v-if="canEdit"
                            action="#" 
                            multiple
                            :http-request="handleFileUpload"
                            :show-file-list="false"
                            :before-upload="beforeUpload">
                            <el-button size="small" type="primary" icon="el-icon-upload" plain>上传新文件</el-button>
                        </el-upload>

                        <el-button 
                            v-if="planningDocuments.length > 0"
                            size="small" 
                            type="success" 
                            icon="el-icon-download" 
                            plain 
                            @click="handleDownloadPlanningDoc">
                            下载策划书
                        </el-button>

                        <el-button 
                            v-if="canEdit && planningDocuments.length > 0" 
                            size="small" 
                            type="danger" 
                            icon="el-icon-delete" 
                            plain 
                            @click="handleClearSplitFiles">
                            清空Excel文件
                        </el-button>

                        <el-button size="small" icon="el-icon-refresh" circle @click="fetchData" title="刷新列表"></el-button>
                    </div>
                </div>

                <div class="card-body d-flex flex-column justify-content-center align-items-center bg-light" style="flex-grow: 1; border-top: 1px solid #ebeef5;">
                    
                    <div v-if="planningDocuments.length === 0" class="text-center text-muted">
                        <i class="el-icon-document-remove mb-3" style="font-size: 48px; color: #dcdfe6;"></i>
                        <p>暂无策划书文件，请点击右上角上传。</p>
                    </div>

                    <div v-else class="text-center w-100">
                        <div class="mb-5 w-100 px-4">
                                
                            <div class="d-flex flex-column align-items-center mb-4" style="gap: 12px;">
                                <div v-for="file in planningDocuments.filter(f => f.documentType.startsWith('PLANNING_DOCUMENT'))" 
                                    :key="file.id" 
                                    class="bg-white rounded border d-flex align-items-start text-left" 
                                    style="width: 100%; max-width: 650px; padding: 16px 20px; border-left: 5px solid #409EFF !important;"
                                > 
                                    <div class="mr-3 pt-1" style="flex-shrink: 0;">
                                        <i class="el-icon-s-grid text-primary" style="font-size: 24px;"></i>
                                    </div>

                                    <div style="flex-grow: 1;">
                                        <div style="font-size: 15px; font-weight: 600; color: #303133; line-height: 1.6; word-break: break-all; white-space: normal;">
                                            {{ getCleanFileName(file) }}
                                        </div>
                                        <div class="text-muted mt-2" style="font-size: 12px;">
                                            <i class="el-icon-document"></i> 策划书文件 <span v-if="file.fileSize"> | {{ formatFileSize(file.fileSize) }}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>

                        <div class="mb-4">
                            <i class="el-icon-reading" style="font-size: 64px; color: #409EFF; margin-bottom: 20px; display: block;"></i>
                            <p class="text-muted mb-4">进入全屏专注模式以获得最佳的表格浏览与操作体验。</p>
                            
                            <el-button 
                                type="primary" 
                                size="medium" 
                                icon="el-icon-data-board" 
                                style="
                                    background: linear-gradient(135deg, #409EFF 0%, #0575E6 100%);
                                    border: none;
                                    font-weight: 800;
                                    letter-spacing: 1px;
                                    border-radius: 50px;
                                    padding: 14px 40px;
                                    box-shadow: 0 8px 20px rgba(64, 158, 255, 0.4);
                                    font-size: 18px;
                                    transform: translateY(0);
                                    transition: all 0.3s;
                                "
                                @mouseover.native="$event.target.style.transform = 'translateY(-2px)'"
                                @mouseleave.native="$event.target.style.transform = 'translateY(0)'"
                                @click="openFullscreenModal">
                                进入全屏文件浏览模式
                            </el-button>
                        </div>
                    </div>

                </div>
            </div>

            <el-dialog
                :visible.sync="showProgressDialog"
                width="420px"
                custom-class="progress-modern-modal"
                top="0"
                :close-on-click-modal="false"
                :show-close="false"
                append-to-body>
                
                <div class="text-center" style="padding: 10px 0;">
                    
                    <h3 class="mb-4" style="font-weight: 700; color: #303133; font-size: 18px;">
                        {{ isPartiallyFailed ? '处理完成 (部分缺失)' : '文件加载中' }}
                    </h3>
                    <div v-if="isPartiallyFailed" class="text-warning mb-4">
                        <i class="el-icon-warning" style="font-size: 50px; color: #E6A23C; margin-bottom: 20px; display: block;"></i>
                        <div class="text-left p-3 mb-4" style="background-color: #fdf6ec; border: 1px solid #faecd8; border-radius: 8px; max-height: 150px; overflow-y: auto;">
                            <p class="mb-2 font-weight-bold" style="color: #E6A23C; font-size: 13px;">
                                <i class="el-icon-circle-close"></i> 以下 {{ skippedSheetsList.length }} 个表格因图片过多被跳过：
                            </p>
                            <ul style="padding-left: 20px; margin: 0; color: #606266; font-size: 12px;">
                                <li v-for="name in skippedSheetsList" :key="name">{{ name }}</li>
                            </ul>
                        </div>
                        <el-button type="warning" size="medium" round @click="handleConfirmPartialSuccess">我知道了</el-button>
                    </div>

                    <div v-else>
                        <div class="mb-4">
                            <el-progress 
                                type="circle" 
                                :width="130"
                                :stroke-width="10"
                                :percentage="splitProgress" 
                                :status="splitProgress >= 100 ? 'success' : null">
                            </el-progress>
                        </div>

                        <p class="mb-0" style="font-size: 15px; min-height: 24px;">
                            <span v-if="splitProgress < 90" style="color: #409EFF; font-weight: bold;">
                                <i class="el-icon-cpu"></i> 文件较大，正在加载中，请耐心等待...
                            </span>
                            <span v-else-if="splitProgress < 100" style="color: #409EFF; font-weight: bold;">
                                <i class="el-icon-loading"></i> 文件较大，正在加载中，请耐心等待...
                            </span>
                            <span v-else class="text-success font-weight-bold">
                                <i class="el-icon-check"></i> 加载完成!
                            </span>
                        </p>
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
                            <el-button type="text" class="text-white mr-3" icon="el-icon-download" @click="handleDownloadPlanningDoc">下载</el-button>
                        </el-tooltip>
                        
                        <el-tooltip content="清理所有分割产生的临时Sheet" placement="bottom">
                            <el-button v-if="canEdit && planningDocuments.length > 0" type="text" class="text-warning mr-3" icon="el-icon-delete" @click="handleClearSplitFiles">清空Excel文件</el-button>
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
                                    
                                    <span class="file-name text-truncate" :title="getCleanFileName(file)">
                                        {{ getCleanFileName(file) }}
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
                /* --- 进度弹窗美化样式 (绝对居中 + 圆角) --- */
            .progress-modern-modal {
                position: absolute !important;
                top: 50% !important;
                left: 50% !important;
                transform: translate(-50%, -50%) !important;
                margin: 0 !important; 
                
                border-radius: 16px !important; /* 圆角 */
                box-shadow: 0 15px 40px rgba(0, 0, 0, 0.2) !important; /* 阴影 */
                overflow: hidden; 
            }

            /* 隐藏默认 Header，使用我们在 Body 里写的 h3 */
            .progress-modern-modal .el-dialog__header {
                display: none !important;
            }

            .progress-modern-modal .el-dialog__body {
                padding: 30px 25px !important;
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

            // 【关键】先强制显示弹窗，再加载内容
            // 防止后面的逻辑报错导致弹窗出不来
            this.showFullscreenModal = true;

            // 延迟执行加载逻辑，确保 DOM 已渲染
            this.$nextTick(() => {
                this.handleTabClick();
            });
        },

        // --- 阅读器内部切换文件 ---
        switchFileInReader(file) {
            this.activeFileId = file.id.toString();
            this.handleTabClick();
        },

        // --- 核心：加载逻辑 (优化版：自动处理已分割文件) ---
        handleTabClick() {
            let file = this.planningDocuments.find(f => f.id.toString() === this.activeFileId);
            if (!file) return;

            // 重置状态
            this.showLargeFileConfirm = false;
            this.isPreviewAbandoned = false;
            if (this.previewTimer) clearTimeout(this.previewTimer);

            // A. 如果是已经拆分的子文件 -> 直接加载
            if (file.documentType === 'SPLIT_CHILD_SHEET' || /_\d+\.xlsx$/.test(file.fileName)) {
                this.loadActiveFileToFullscreen();
                return;
            }

            // B. 检查是否是大文件
            const size = file.fileSize || file.size || 0;
            const THRESHOLD = 20 * 1024 * 1024; // 20MB

            if (size > THRESHOLD) {
                // 检查是否已存在分割后的子文件
                const firstChild = this.fileList.find(f => f.parentId === file.id);

                if (firstChild) {
                    // 【优化体验】如果找到了子文件，不要报错拦截，直接自动切过去！
                    this.$message.success('检测到该文件已优化，正在为您打开第一个子 Sheet...');

                    // 切换选中 ID 为第一个子文件
                    this.activeFileId = firstChild.id.toString();

                    // 递归调用自己，重新走流程加载子文件
                    this.$nextTick(() => {
                        this.handleTabClick();
                    });
                    return;
                }

                // 如果是大文件且没分割，显示分割引导页
                this.$message.info('文件较大，需要进行智能分割...');
                this.handleSplitFile(file);
                return;
            }

            // C. 普通文件 -> 正常加载
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

            // 【修复点】定义 previewingFileName
            this.previewingFileName = this.getCleanFileName(file);

            const iframe = this.$refs.fullscreenIframe;
            if (iframe && iframe.contentWindow) {
                const fileUrl = `/api/files/content/${file.id}?t=${new Date().getTime()}`;

                // 发送加载指令
                iframe.contentWindow.postMessage({
                    type: "LOAD_SHEET",
                    payload: {
                        fileUrl: fileUrl,
                        fileName: this.previewingFileName, // 【修复点】使用正确的变量名
                        options: {
                            lang: "zh",
                            allowUpdate: false,
                            showtoolbar: true,
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

            // 1. 获取清洗后的文件名 (用于下载保存)
            let cleanName = this.getCleanFileName(activeFile);
            if (!cleanName.endsWith('.xlsx')) cleanName += '.xlsx';

            // 2. 直接调用源文件下载 (并传入清洗后的名字)
            // 理由：策划书可能包含复杂格式，下载源文件最保险，且我们可以通过 Blob 强制改名
            this.downloadSourceFile(activeFile, cleanName);
        },

        // ✂️ 替换位置：源文件下载 (支持强制重命名)
        async downloadSourceFile(file, customFileName) {
            if (!file) return;

            const fileName = customFileName || file.fileName; // 优先使用清洗后的名字
            const loading = this.$loading({
                lock: true,
                text: `正在准备下载 ${fileName}...`,
                spinner: 'el-icon-loading',
                background: 'rgba(0, 0, 0, 0.7)'
            });

            try {
                // 1. 使用 axios 获取文件流 (关键：responseType: 'blob')
                const response = await axios.get(`/api/files/content/${file.id}`, {
                    responseType: 'blob',
                    headers: { 'Cache-Control': 'no-cache' } // 防止缓存旧名
                });

                // 2. 创建 Blob 对象
                const blob = new Blob([response.data], {
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                });

                // 3. 创建临时下载链接
                const link = document.createElement('a');
                link.href = window.URL.createObjectURL(blob);
                link.download = fileName; // ✅ 这里强制应用了清洗后的文件名

                // 4. 触发下载
                document.body.appendChild(link);
                link.click();

                // 5. 清理内存
                document.body.removeChild(link);
                window.URL.revokeObjectURL(link.href);

                this.$message.success('下载已开始');
            } catch (error) {
                console.error('下载失败', error);
                this.$message.error('文件下载失败，请检查网络');
            } finally {
                loading.close();
            }
        },

        handleDownloadPlanningDoc() {
            // 1. 在文件列表中查找主策划书
            const mainFile = this.planningDocuments.find(f => f.documentType && f.documentType.startsWith('PLANNING_DOCUMENT'));
            
            if (!mainFile) {
                this.$message.warning("当前项目未找到主策划书文件");
                return;
            }

            // 2. 获取清洗后的文件名
            let cleanName = this.getCleanFileName(mainFile);
            if (!cleanName.endsWith('.xlsx')) cleanName += '.xlsx';

            // 3. 调用源文件下载 (复用之前写的 Blob 下载逻辑)
            this.downloadSourceFile(mainFile, cleanName);
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
        // ✂️ 替换位置：带“尾部缓冲”的进度轮询
        pollProgress(fileId) {
            const self = this;
            // 清除可能存在的旧定时器
            if (self._pollTimer) clearInterval(self._pollTimer);
            if (self._fakeTimer) clearInterval(self._fakeTimer);

            self.skippedSheetsList = [];
            self.progressStatus = null;

            // 延迟一点启动，给后端反应时间
            setTimeout(() => {
                // === 第一阶段：轮询后端真实进度 (目标 0% -> 90%) ===
                self._pollTimer = setInterval(() => {
                    axios.get(`/api/files/${fileId}/split-progress?t=${new Date().getTime()}`)
                        .then(res => {
                            const data = res.data;
                            if (!data) return;

                            if (data.progress === -1) {
                                // 异常处理
                                clearInterval(self._pollTimer);
                                self.progressStatus = 'exception';
                                self.isSplitting = false;
                                self.$alert(data.errorMessage || '未知错误');
                                return;
                            }

                            if (data.progress >= 100) {
                                // === 后端处理完了 ===
                                clearInterval(self._pollTimer);

                                // 强制设为 90%，准备开始最后 10秒 的冲刺
                                self.splitProgress = 90;
                                self.runFinalTenSeconds();
                            } else {
                                // 还在处理中，更新进度，但视觉上最高封顶 90%
                                // 避免后端还没完，前端先跑满了
                                self.splitProgress = Math.min(data.progress, 90);
                            }
                        });
                }, 1000);
            }, 500);
        },

        // 【新增】最后 10% 的缓冲动画 (1秒跑1%)
        runFinalTenSeconds() {
            const self = this;
            if (self._fakeTimer) clearInterval(self._fakeTimer);

            self._fakeTimer = setInterval(() => {
                // 每秒 +1%
                if (self.splitProgress < 100) {
                    self.splitProgress += 1;
                } else {
                    // === 跑满 100% ===
                    clearInterval(self._fakeTimer);
                    self.progressStatus = 'success'; // 变绿

                    // 弹出最终完成框
                    self.$alert('文件数据已全部加载就绪。', '加载完成', {
                        confirmButtonText: '确定',
                        type: 'success',
                        showClose: false,
                        callback: () => {
                            self.showProgressDialog = false;
                            self.isSplitting = false;
                            self.fetchData(); // 刷新列表
                        }
                    });
                }
            }, 1000); // 1000ms = 1秒
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
        // 简化的清理逻辑 (全删)
        handleClearSplitFiles() {
            if (this.planningDocuments.length === 0) return;

            this.$confirm(
                `确定要清空当前项目下的所有策划书文件吗？<br><span style="color:#F56C6C; font-size:12px;">此操作不可恢复！</span>`,
                '高风险操作警告',
                {
                    confirmButtonText: '确定全部清空',
                    cancelButtonText: '取消',
                    confirmButtonClass: 'el-button--danger',
                    type: 'warning',
                    dangerouslyUseHTMLString: true,
                    center: true
                }
            ).then(() => {
                // 直接传入所有文件进行删除
                this.executeBatchDelete(this.planningDocuments, '正在清空所有文件...');
            }).catch(() => {
                // 取消操作，无事发生
            });
        },

        // 【新增】通用批量删除辅助函数
        async executeBatchDelete(filesToDelete, loadingMsg) {
            if (!filesToDelete || filesToDelete.length === 0) {
                this.$message.info("没有需要删除的文件。");
                return;
            }

            const loading = this.$loading({ lock: true, text: loadingMsg });
            try {
                // 并发执行删除请求
                await Promise.all(filesToDelete.map(f => axios.delete(`/api/files/${f.id}`)));

                this.$message.success('清理操作完成');

                // 如果当前选中的文件被删除了，重置选中状态
                if (filesToDelete.some(f => f.id.toString() === this.activeFileId)) {
                    this.activeFileId = '';
                    this.showFullscreenModal = false; // 如果在全屏模式下删除了主文件，最好关闭弹窗
                }

                // 刷新列表
                this.fetchData();
            } catch (e) {
                console.error(e);
                this.$message.error('删除过程中出现错误，请重试');
            } finally {
                loading.close();
            }
        },

        // 【新增】文件名清洗函数：去除前缀和重复后缀
        getCleanFileName(file) {
            if (!file || !file.fileName) return '未知文件';

            let name = file.fileName;

            // 1. 去除 "PLANNING_DOCUMENT_" 前缀
            name = name.replace(/^PLANNING_DOCUMENT_/, '');

            // 2. 修复特殊的重复后缀问题
            // 针对你的例子： "...V1.7.XLSX-ST8项目...xlsx"
            // 逻辑：如果检测到 ".XLSX-" 这种奇怪的分隔符，取横杠后面的部分（通常那是干净的原名）
            if (name.match(/\.XLSX-/i) || name.match(/\.xlsx-/i)) {
                const parts = name.split(/\.xlsx-/i);
                // 取最后一部分，通常是完整的文件名
                if (parts.length > 1) {
                    name = parts[parts.length - 1];
                }
            }

            return name;
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

        formatFileSize(bytes) {
            if (!bytes || bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            // 保留2位小数
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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