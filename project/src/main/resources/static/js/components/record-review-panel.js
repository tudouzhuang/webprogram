import { exportWithExcelJS } from '/js/utils/luckysheetExporter.js';

Vue.component('record-review-panel', {
    components: {
        'workspace-status-bar': WorkspaceStatusBar,
        'problem-record-table': ProblemRecordTable
    },
    // 【Props】: 从父组件接收要查看的过程记录ID
    props: {
        recordId: {
            type: [String, Number],
            required: true
        }
    },
    // 【模板】: 完整模板，包含iframe和按钮
    template: `
        <div class="content-wrapper" style="width:100%;height:100%">
            <!-- 加载与错误状态 -->
            <div v-if="isLoading" class="card">
                <div class="card-body text-center p-5">
                    <p>正在加载审核工作区...</p>
                    <el-progress :percentage="100" status="success" :indeterminate="true" :duration="1"></el-progress>
                </div>
            </div>
            <div v-else-if="loadError" class="alert alert-danger">{{ loadError }}</div>
            
            <!-- 主内容区 (数据加载成功后显示) -->
            <div v-else-if="recordInfo">
                <!-- ======================= 1. 顶部信息与操作区 ======================= -->
                <div class="card mb-4">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center">
                            
                            <!-- 左侧：统一的信息中心 -->
                            <div style="flex-grow: 1; margin-right: 20px;">
                                <workspace-status-bar
                                    v-if="activeFile && recordInfo"
                                    ref="statusBarRef"
                                    :file-id="activeFile.id"
                                    :record-info="recordInfo"
                                    :live-stats="currentLiveStats"
                                    :status="recordInfo.status"
                                    :total-duration="recordInfo.totalDesignDurationSeconds"
                                    :session-duration="0"> <!-- 审核员面板不计时，传0 -->
                                </workspace-status-bar>
                            </div>

                            <!-- 右侧：审核员的操作按钮 (垂直排列) -->
                            <div class="d-flex flex-column" style="flex-shrink: 0; gap: 10px; min-width: 150px;">
                                <el-button @click="goBack" icon="el-icon-back" plain style="width: 100%; margin-left: 10px">返回列表</el-button>
                                <el-button v-if="activeTab !== 'recordMeta'" type="info" plain icon="el-icon-download" @click="exportCurrentSheet" style="width: 100%;">导出文件</el-button>
                                <el-button type="primary" @click="saveChanges" :loading="isSaving" icon="el-icon-document-checked" style="width: 100%;">保存在线修改</el-button>
                                <el-divider class="my-1"></el-divider>
                                <el-button @click="rejectRecord" type="danger" icon="el-icon-close" style="width: 100%; margin-left: 10px">打回修改</el-button>
                                <el-button @click="approveRecord" type="success" icon="el-icon-check" style="width: 100%;">批准通过</el-button>
                            </div>
                            
                        </div>
                    </div>
                </div>
                
                <!-- ======================= 2. Tab切换与内容展示区域 ======================= -->
                <div class="card">
                    <div class="card-body">
                        <el-tabs v-model="activeTab" type="border-card" @tab-click="handleTabClick">
                        <el-tab-pane v-if="metaFile" label="表单元数据" name="recordMeta" lazy>
                            <div v-if="isMetaDataLoading" class="p-4 text-center">
                                <i class="el-icon-loading"></i> 正在加载元数据...
                            </div>
                            <div v-else-if="metaData && !metaData.error" class="p-4">
                                <!-- 【【【 在这里恢复您完整的 el-descriptions 模板 】】】 -->
                                <el-descriptions title="详细规格信息" :column="3" border>
                                    <el-descriptions-item label="制件材质">{{ metaData.material || 'N/A' }}</el-descriptions-item>
                                    <el-descriptions-item label="制件料厚">{{ metaData.thickness || 'N/A' }} mm</el-descriptions-item>
                                    <el-descriptions-item label="抗拉强度">{{ metaData.tensileStrength || 'N/A' }} MPa</el-descriptions-item>
                                    <el-descriptions-item label="客户名称">{{ metaData.customerName || 'N/A' }}</el-descriptions-item>
                                    <el-descriptions-item label="模具图号" :span="2">{{ metaData.moldDrawingNumber || 'N/A' }}</el-descriptions-item>
                                    <el-descriptions-item label="使用设备">{{ metaData.equipment || 'N/A' }}</el-descriptions-item>
                                </el-descriptions>
                                
                                <el-descriptions title="人员信息" :column="3" border class="mt-4">
                                    <el-descriptions-item label="设计人员">{{ metaData.designerName || 'N/A' }}</el-descriptions-item>
                                    <el-descriptions-item label="日期">{{ metaData.designerDate || 'N/A' }}</el-descriptions-item>
                                    <el-descriptions-item label="校对人员">{{ metaData.checkerName || 'N/A' }}</el-descriptions-item>
                                    <el-descriptions-item label="日期">{{ metaData.checkerDate || 'N/A' }}</el-descriptions-item>
                                    <el-descriptions-item label="审核人员">{{ metaData.auditorName || 'N/A' }}</el-descriptions-item>
                                    <el-descriptions-item label="日期">{{ metaData.auditorDate || 'N/A' }}</el-descriptions-item>
                                </el-descriptions>
                        
                                <el-descriptions title="尺寸与重量" :column="4" border class="mt-4">
                                    <el-descriptions-item label="报价 长度">{{ metaData.quoteSize ? metaData.quoteSize.length : 'N/A' }} mm</el-descriptions-item>
                                    <el-descriptions-item label="报价 宽度">{{ metaData.quoteSize ? metaData.quoteSize.width : 'N/A' }} mm</el-descriptions-item>
                                    <el-descriptions-item label="报价 高度">{{ metaData.quoteSize ? metaData.quoteSize.height : 'N/A' }} mm</el-descriptions-item>
                                    <el-descriptions-item label="报价 重量">{{ metaData.quoteWeight || 'N/A' }} T</el-descriptions-item>
                                    <el-descriptions-item label="实际 长度">{{ metaData.actualSize ? metaData.actualSize.length : 'N/A' }} mm</el-descriptions-item>
                                    <el-descriptions-item label="实际 宽度">{{ metaData.actualSize ? metaData.actualSize.width : 'N/A' }} mm</el-descriptions-item>
                                    <el-descriptions-item label="实际 高度">{{ metaData.actualSize ? metaData.actualSize.height : 'N/A' }} mm</el-descriptions-item>
                                    <el-descriptions-item label="实际 重量">{{ metaData.actualWeight || 'N/A' }} T</el-descriptions-item>
                                </el-descriptions>
                            </div>
                            <div v-else class="p-4 text-center text-muted">
                                <p>未能加载元数据。</p>
                                <el-button size="mini" @click="fetchMetaData">重试</el-button>
                            </div>
                        </el-tab-pane>
                            
                            <!-- 修改后 -->
                            <el-tab-pane
                                v-for="file in excelFiles"
                                :key="file.id"
                                :label="file.documentType"
                                :name="file.documentType"
                                lazy>
                                <div style="height: 70vh;">
                                    <!-- 【【【 核心修正：移除外层的 v-if="activeFile" 防御 】】】 -->
                                    <!-- 只保留内层的 v-if，这个 v-if 是 el-tabs 正常工作所必需的 -->
                                    <iframe v-if="activeTab === file.documentType"
                                        :ref="'iframe-' + file.id"
                                        src="/luckysheet-iframe-loader.html"
                                        @load="() => loadSheetIntoIframe(file)"
                                        style="width: 100%; height: 100%; border: none;">
                                    </iframe>
                                </div>
                            </el-tab-pane>

                            <div v-if="!metaFile && excelFiles.length === 0" class="text-center text-muted p-5">
                                <h4>未找到任何可供审核的文件。</h4>
                            </div>
                        </el-tabs>
                    </div>
                </div>

                <!-- ======================= 3. 问题记录表 ======================= -->
                <problem-record-table
                    v-if="recordId"
                    :record-id="Number(recordId)"
                    mode="reviewer"> <!-- 审核员模式 -->
                </problem-record-table>
            </div>
        </div>
    `,

    // record-review-panel.js -> <script>

    data() {
        return {
            isLoading: true,
            recordInfo: null,
            loadError: null,
            allFiles: [],
            activeTab: '',
            isSaving: false,
            metaData: null,
            scrollTopBeforeClick: 0,
            currentLiveStats: null,
            isMetaDataLoading: false, // <-- 修复错误一
            metaData: null,          // 用于存储 metaFile 的内容
            // 【【【确保这里没有 scrollTopBeforeFocus, _scrollLock, iframeIsActive 等任何东西】】】
        }
    },
    // 修改后
    computed: {
        excelFiles() {
            // 【【【 核心修正：增加安全检查 】】】
            // 1. 确保 allFiles 是一个数组
            if (!Array.isArray(this.allFiles)) {
                return [];
            }
            // 2. 在 filter 内部，首先确保 file 对象本身存在
            return this.allFiles.filter(file =>
                file && // <-- 确保 file 不是 null 或 undefined
                file.fileType &&
                (file.fileType.includes('spreadsheetml') || file.fileType.includes('excel'))
            );
        },
        metaFile() {
            if (!Array.isArray(this.allFiles)) {
                return null;
            }
            // 同样，增加对 file 对象的检查
            return this.allFiles.find(file => file && file.documentType === 'recordMeta');
        },
        activeFile() {
            if (this.activeTab === 'recordMeta') {
                return this.metaFile;
            }
            // 确保 excelFiles 存在
            if (this.excelFiles && this.excelFiles.length > 0) {
                return this.excelFiles.find(f => f.documentType === this.activeTab);
            }
            return null;
        }
    },
    methods: {
        lockScroll() {
            document.body.classList.add('body-scroll-lock');
        },

        /**
         * 【【【新增】】】 解锁父页面滚动
         */
        unlockScroll() {
            document.body.classList.remove('body-scroll-lock');
        },
        handleIframeFocus() {
            this.scrollTopBeforeFocus = window.scrollY || document.documentElement.scrollTop;
            setTimeout(() => {
                window.scrollTo(0, this.scrollTopBeforeFocus);
            }, 0);
        },
        // 修改后
        async fetchAllData() {
            if (!this.recordId) return;
            this.isLoading = true;
            this.loadError = null;
            try {
                console.log('[Review Panel] fetchAllData 开始执行...');
                const [recordResponse, filesResponse] = await Promise.all([
                    axios.get(`/api/process-records/${this.recordId}`),
                    axios.get(`/api/process-records/${this.recordId}/files`)
                ]);

                // 【【【 核心修正：原子化数据处理 】】】
                // 步骤 1：在局部变量中完成所有数据处理
                const rawFiles = filesResponse.data;
                let cleanedFiles = [];
                let newActiveTab = '';

                if (Array.isArray(rawFiles)) {
                    cleanedFiles = rawFiles
                        .filter(file => file && file.documentType) // 先过滤脏数据
                        .sort((a, b) => a.documentType.localeCompare(b.documentType, 'zh-Hans-CN'));
                } else {
                    console.error('[Review Panel] /files 接口返回的不是一个数组！');
                }

                // 从清洗过的数据中派生出 excelFiles 和 metaFile
                const excelFiles = cleanedFiles.filter(file => file.fileType && (file.fileType.includes('spreadsheetml') || file.fileType.includes('excel')));
                const metaFile = cleanedFiles.find(file => file.documentType === 'recordMeta');

                if (excelFiles.length > 0) {
                    newActiveTab = excelFiles[0].documentType;
                } else if (metaFile) {
                    newActiveTab = 'recordMeta';
                }

                // 步骤 2：【【【 一次性更新所有响应式数据 】】】
                // 这样做可以最大程度地避免渲染竞争条件
                console.log('[Review Panel] 准备一次性更新 data 属性...');
                this.recordInfo = recordResponse.data;
                this.allFiles = cleanedFiles;
                this.activeTab = newActiveTab; // 在同一个事件循环中更新 activeTab

                // 步骤 3：使用 $nextTick 确保 DOM 更新后再执行依赖 DOM 的操作（如果需要）
                this.$nextTick(() => {
                    console.log('[Review Panel] DOM 更新完成。最终状态:');
                    console.log('  -> this.allFiles:', JSON.parse(JSON.stringify(this.allFiles)));
                    console.log('  -> this.activeTab:', this.activeTab);
                    console.log('  -> computed excelFiles:', JSON.parse(JSON.stringify(this.excelFiles)));
                    console.log('  -> computed activeFile:', JSON.parse(JSON.stringify(this.activeFile)));
                });

            } catch (error) {
                this.loadError = "加载工作区数据失败：" + (error.response?.data?.message || error.message);
                console.error("[Review Panel] fetchAllData 失败:", error);
            } finally {
                this.isLoading = false;
            }
        },

        async fetchMetaData() {
            if (!this.metaFile) {
                console.warn("No meta file found to fetch.");
                return;
            }

            // 如果已经加载过，就不再重复请求
            if (this.metaData) return;

            console.log("Fetching meta data from:", this.metaFile.filePath);
            try {
                // 直接使用文件ID构造内容获取URL
                const fileUrl = `/api/files/content/${this.metaFile.id}`;
                const response = await axios.get(fileUrl);

                // 后端返回的可能是JSON字符串，也可能是对象，我们做兼容处理
                if (typeof response.data === 'string') {
                    this.metaData = JSON.parse(response.data);
                } else {
                    this.metaData = response.data;
                }
                console.log("Meta data loaded and parsed:", this.metaData);

            } catch (error) {
                console.error("Failed to fetch or parse meta data:", error);
                this.$message.error("加载表单元数据失败！");
            }
        },

        loadSheetIntoIframe(fileInfo) {
            if (!fileInfo) return;
            const iframeRef = this.$refs['iframe-' + fileInfo.id];
            const targetIframe = Array.isArray(iframeRef) ? iframeRef[0] : iframeRef;

            if (targetIframe && targetIframe.contentWindow) {

                // ===== 您的滚动锁定逻辑 (保持不变) =====
                let lastScrollY = window.scrollY;
                const preventScroll = e => e.preventDefault();
                window.addEventListener('scroll', preventScroll, { passive: false });
                setTimeout(() => {
                    window.removeEventListener('scroll', preventScroll);
                    window.scrollTo(0, lastScrollY);
                }, 1500);

                const options = { allowUpdate: true, showtoolbar: true };

                // 【关键修改】在原始 URL 后面强制追加 `&format=json` (或 `?format=json`)
                // 这样 iframe 内部的加载器就会收到JSON，而不是二进制文件
                let fileUrl = `/api/files/content/${fileInfo.id}?t=${new Date().getTime()}`;
                if (fileUrl.includes('?')) {
                    fileUrl += '&format=json';
                } else {
                    fileUrl += '?format=json';
                }

                console.log(`[Parent Panel] 准备向 iframe 发送加载指令, 强制使用 JSON 格式, URL: ${fileUrl}`);

                const message = {
                    type: 'LOAD_SHEET',
                    payload: {
                        fileUrl: fileUrl, // 使用我们修改过的 URL
                        fileName: fileInfo.fileName,
                        options: { lang: 'zh', ...options }
                    }
                };

                // 发送消息给 iframe
                this.sendMessageToIframe(targetIframe, message);
            }
        },




        saveChanges() {
            // 1. 状态检查
            if (this.isSaving) {
                this.$message.warning('正在保存中，请稍候...');
                return;
            }

            // 2. 【核心修正】: 使用 activeTab (documentType) 来查找当前文件
            const currentFile = this.excelFiles.find(file => file.documentType === this.activeTab);
            if (!currentFile) {
                this.$message.error("当前没有活动的表格可供保存。");
                return;
            }

            // 3. 查找 iframe 实例
            const iframeRef = this.$refs['iframe-' + currentFile.id];
            const targetIframe = Array.isArray(iframeRef) ? iframeRef[0] : iframeRef;
            if (!targetIframe) {
                this.$message.error('找不到编辑器实例！');
                return;
            }

            // 4. 更新UI状态，并发送指令
            this.isSaving = true; // 在这里设置 isSaving
            this.$message.info(`正在从编辑器获取 "${currentFile.documentType}" 的最新数据...`);

            // 5. 【核心修正】: 使用统一、简单的 purpose
            this.sendMessageToIframe(targetIframe, {
                type: 'GET_DATA_AND_IMAGES',
                payload: {
                    purpose: 'save-draft', // 统一使用 'save-draft'
                    fileId: currentFile.id,
                    documentType: currentFile.documentType
                }
            });
        },

        /**
                 * 消息监听器，处理来自 iframe 的所有数据响应。
                 * 【最终修正版】：修正了数据源变量名，并统一了方法调用。
                 */
        async messageEventListener(event) {
            // 1. 统一的安全检查
            if (event.origin !== window.location.origin || !event.data || !event.data.type) {
                return;
            }

            console.log('[Parent Panel] 接收到 message 事件:', event.data);
            const { type, payload } = event.data;

            // =================================================================
            //  ↓↓↓ 分支 1: 处理“保存”操作的回调数据 ↓↓↓
            // =================================================================
            if (type === 'SHEET_DATA_WITH_IMAGES_RESPONSE') {

                // a. 验证 purpose 是否为保存操作
                if (!payload || payload.purpose !== 'save-draft') {
                    console.warn(`[Parent Panel] 收到的 purpose 不匹配 'save-draft'，已忽略。`);
                    return;
                }

                // b. 【【【 核心修正：使用正确的数据源 this.allFiles 】】】
                const currentFile = this.allFiles.find(file => file.id === payload.fileId);
                if (!currentFile) {
                    this.$message.error('保存失败：找不到与返回数据匹配的文件记录。');
                    this.isSaving = false;
                    return;
                }

                console.log(`[Parent Panel] ✅ Purpose 检查通过，开始保存文件: "${currentFile.fileName}"`);

                // c. 执行文件上传和后续操作
                // 注意：这里不再需要 this.isSaving = true，因为 saveChanges 方法已经设置过了
                try {
                    const exportBlob = await exportWithExcelJS(payload);
                    const formData = new FormData();
                    const fileName = currentFile.fileName || `${payload.documentType}.xlsx`;
                    formData.append('file', exportBlob, fileName);

                    const apiUrl = `/api/process-records/${this.recordId}/save-draft?fileId=${currentFile.id}`;
                    await axios.post(apiUrl, formData, { headers: { 'Content-Type': 'multipart/form-data' } });

                    this.$message.success(`文件 "${fileName}" 已成功保存！`);

                    // d. 【无感刷新逻辑】
                    console.log("[Parent Panel] 执行无感刷新，重新加载 iframe 内容...");
                    this.loadSheetIntoIframe(currentFile); // 【优化】统一方法名

                    // e. 【触发统计刷新】
                    this.currentLiveStats = null;
                    if (this.$refs.statusBarRef) {
                        this.$refs.statusBarRef.fetchSavedStats();
                    }

                } catch (error) {
                    this.$message.error("保存文件时出错！");
                    console.error("保存失败:", error);
                } finally {
                    this.isSaving = false; // 无论成功失败，都在这里结束加载状态
                }

                // =================================================================
                //  ↓↓↓ 分支 2: 处理实时统计更新的消息 ↓↓↓
                // =================================================================
            } else if (type === 'STATS_UPDATE') {

                console.log('[Parent Panel] 接收到实时统计更新:', payload);
                this.currentLiveStats = payload;

            }
        },

        exportCurrentSheet() {
            const currentFile = this.excelFiles.find(file => String(file.id) === this.activeTab);
            if (!currentFile) { this.$message.warning("没有可导出的活动文件。"); return; }
            const iframeRef = this.$refs['iframe-' + currentFile.id];
            const targetIframe = Array.isArray(iframeRef) ? iframeRef[0] : iframeRef;
            if (!targetIframe) return;
            const fileName = `${currentFile.fileName || 'export'}.xlsx`;
            this.sendMessageToIframe(targetIframe, { type: 'EXPORT_SHEET', payload: { fileName: fileName } });
        },

        approveRecord() {
            this.$confirm('您确定所有内容都已审核完毕，并批准此设计记录吗?', '批准确认', {
                confirmButtonText: '确定批准',
                cancelButtonText: '取消',
                type: 'success'
            })
                .then(async () => {
                    try {
                        // 【【【核心修改】】】
                        // 解开注释，调用后端API
                        await axios.post(`/api/process-records/${this.recordId}/approve`);

                        this.$message.success('操作成功，该记录已批准！');

                        // 操作成功后，可以返回列表页或刷新当前页
                        this.goBack(); // 调用已有的返回方法

                    } catch (error) {
                        this.$message.error('批准失败：' + (error.response?.data?.message || '未知错误'));
                        console.error("批准操作失败:", error);
                    }
                }).catch(() => {
                    this.$message.info('已取消操作');
                });
        },

        rejectRecord() {
            this.$prompt('请输入打回意见（必填）：', '打回修改', {
                confirmButtonText: '确定打回',
                cancelButtonText: '取消',
                inputPattern: /.+/, // 正则表达式，确保不为空
                inputErrorMessage: '打回意见不能为空'
            }).then(async ({ value }) => {
                try {
                    // 【【【核心修改】】】
                    // 解开注释，调用后端API，并传递comment
                    await axios.post(`/api/process-records/${this.recordId}/request-changes`, { comment: value });

                    this.$message.success('操作成功，该记录已打回修改！');

                    // 打回后，也返回列表页
                    this.goBack();

                } catch (error) {
                    this.$message.error('打回失败：' + (error.response?.data?.message || '未知错误'));
                    console.error("打回操作失败:", error);
                }
            }).catch(() => {
                this.$message.info('已取消操作');
            });
        },

        // 辅助方法
        sendMessageToIframe(iframe, message) {
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage(message, window.location.origin);
            }
        },
        formatDuration(totalSeconds) {
            if (totalSeconds == null || totalSeconds < 0) return '暂无记录';
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            let result = '';
            if (hours > 0) result += `${hours} 小时 `;
            if (minutes > 0) result += `${minutes} 分钟 `;
            if (seconds > 0 || result === '') result += `${seconds} 秒`;
            return result.trim();
        },
        handleTabClick(tab) {
            // 当用户点击 "表单元数据" Tab时，触发数据加载
            if (tab.name === 'recordMeta') {
                this.fetchMetaData();
            }
            // 对于Excel文件Tab，loadSheetIntoIframe 会在iframe的 @load 事件中自动触发
        },
        goBack() {
            this.$emit('back-to-list');
        },
        handleIframeBlur() {
            // 我们不需要记录和恢复滚动位置，因为那太复杂了。
            // 我们直接找到页面上一个固定且不会引起滚动的元素，比如页面的主标题。
            // 如果您的页面标题有一个ID，那是最好的。如果没有，我们可以用 class 来查找。

            // 尝试找到页面主标题的DOM元素
            // 这里的选择器 '.page-title' 需要根据您 index.html 的实际结构来定
            const mainTitle = document.querySelector('.main-panel .page-header .page-title');

            if (mainTitle) {
                // 为了让一个普通元素能获得焦点，我们需要临时给它设置 tabindex
                mainTitle.setAttribute('tabindex', '-1');
                mainTitle.focus();
                mainTitle.removeAttribute('tabindex'); // 获得焦点后马上移除，避免影响页面行为
                console.log('Iframe lost focus. Focus returned to main title.');
            } else {
                // 如果找不到标题，就用我们之前那个隐藏的 "焦点捕获器"
                const focusCatcher = document.getElementById('focus-catcher');
                if (focusCatcher) {
                    focusCatcher.focus();
                    console.log('Iframe lost focus. Focus returned to focus-catcher.');
                }
            }
        },

    },
    // 在 record-review-panel.js 中

    // 在 record-review-panel.js 中

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
        recordId: {
            immediate: true,
            handler(newId) {
                if (newId) {
                    this.fetchAllData();
                }
            }
        },
        // 【【【新增】】】
        activeTab(newTabName, oldTabName) {
            if (newTabName && newTabName !== oldTabName) {
                if (newTabName === 'recordMeta') {
                    this.fetchMetaData();
                }
                // 对于Excel Tab，加载会在 iframe 的 @load 事件中自动触发，所以这里不需要额外操作
            }
        }
    }
});