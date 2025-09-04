import { exportWithExcelJS } from '/js/utils/luckysheetExporter.js';

Vue.component('record-review-panel', {
    components: {
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
            <div class="content-wrapper" style="height:100%;width:100%">
                
                <!-- 1. 过程记录表主信息 -->
                <div class="card mb-4">
                     <div class="card-body">
                        <div v-if="isLoading" class="text-center p-3">
                            <p>正在加载过程记录表信息...</p>
                            <el-progress :percentage="100" status="success" :indeterminate="true" :duration="1"></el-progress>
                        </div>
                        <div v-else-if="loadError" class="alert alert-danger">{{ loadError }}</div>
                        <div v-else-if="recordInfo">
                            <el-descriptions title="过程记录表详情" :column="2" border>
                                <el-descriptions-item label="零件名称">{{ recordInfo.partName }}</el-descriptions-item>
                                <el-descriptions-item label="工序名称">{{ recordInfo.processName }}</el-descriptions-item>
                                <el-descriptions-item label="所属项目ID">{{ recordInfo.projectId }}</el-descriptions-item>
                                <el-descriptions-item label="记录创建时间">{{ recordInfo.createdAt }}</el-descriptions-item>
                            </el-descriptions>
                        </div>
                     </div>
                </div>

                <!-- 2. 左右分栏布局 -->
                <el-row :gutter="20">
                    <!-- 2a. 左侧：只读预览 Iframe -->
                        <el-col :span="16">
                        <div class="card">
                            <div class="card-body">
                                <!-- 【修改】将所有头部元素都包裹在一个 flex 容器中 -->
                                <div class="d-flex justify-content-between align-items-center mb-3">
                                    <!-- 左侧部分：标题和描述 -->
                                    <div>
                                        <h4 class="card-title mb-0 d-inline-block mr-2">文件预览 (只读)</h4>
                                        <p class="card-description d-inline-block mb-0">点击下方标签页，切换查看不同的检查项文件。</p>
                                    </div>
                                    
                                    <!-- 右侧部分：导出按钮 -->
                                    <el-button 
                                        v-if="excelFilesToPreview.length > 0"
                                        type="success" 
                                        size="mini" 
                                        icon="el-icon-download"
                                        @click="exportPreviewSheet">
                                        导出当前预览文件
                                    </el-button>
                                </div>
                                    <p class="card-description">点击下方标签页，切换查看不同的检查项文件。</p>
                                <el-tabs v-model="activePreviewTab" type="border-card">
                                    
                                    <!-- 为 recordMeta 文件创建一个专门的、静态的Tab页 -->
                                    <el-tab-pane v-if="metaFile" label="表单元数据" name="recordMeta" lazy>
                                        <!-- ... (这里可以复用 workspace-panel 中展示元数据的 el-form 结构) ... -->
                                        <div class="p-3">只读的表单元数据将在这里展示...</div>
                                    </el-tab-pane>
            
                                    <!-- 使用 v-for 动态生成所有检查项文件的 Tab 页 -->
                                    <el-tab-pane
                                        v-for="file in excelFilesToPreview"
                                        :key="file.id"
                                        :label="file.documentType"
                                        :name="file.documentType"
                                        lazy>
                                        
                                        <!-- 每个Tab页内都有自己的只读 iframe -->
                                        <iframe v-if="activePreviewTab === file.documentType"
                                            :ref="'iframe-' + file.id"
                                            src="/luckysheet-iframe-loader.html" 
                                            @load="() => loadSheetInPreviewIframe(file)"
                                            style="width: 100%; height: 70vh; border: none;">
                                        </iframe>
            
                                    </el-tab-pane>
            
                                    <div v-if="!metaFile && excelFilesToPreview.length === 0" class="text-center text-muted p-5">
                                        <h4>未找到任何可供预览的文件。</h4>
                                    </div>
                                </el-tabs>
                            </div>
                        </div>
                    </el-col>

                    <!-- 2b. 右侧：可编辑审核 Iframe -->
                    <el-col :span="8">
                        <div class="card">
                            <div class="card-body">
                                <h4 class="card-title">在线审核与批注 (可编辑)</h4>
                                <p class="card-description">可直接在下方表格中填写，完成后点击保存。</p>
                                
                                <iframe ref="reviewIframe" src="/luckysheet-iframe-loader.html" @load="onReviewIframeLoad" style="width: 100%; height: 70vh; border: none;"></iframe>
                                
                                <div class="mt-3 text-center">
                                    <el-button type="primary" @click="saveReviewSheet" :loading="isSavingSheet">
                                        <i class="el-icon-document-checked"></i> 保存审核结果
                                    </el-button>
                                    <el-button type="success" @click="exportReviewSheet">
                                        <i class="el-icon-download"></i> 导出审核表
                                    </el-button>
                                </div>
                            </div>
                        </div>
                    </el-col>
                </el-row>


                <problem-record-table
                    v-if="recordId"
                    :record-id="Number(recordId)">
                </problem-record-table>
            </div>
    `,

    // record-review-panel.js -> <script>

    data() {
        return {
            isLoading: true,
            recordInfo: null,
            loadError: null,
            filesToPreview: [],
            activePreviewTab: '',
            isSavingSheet: false,
            reviewTemplateUrl: '/api/files/templates/review-sheet.xlsx',

            // --- 【核心修正】: 新增两个状态来管理加载流程 ---
            reviewIframeLoaded: false,
            reviewSheetData: null, // 用于暂存从 fetchAllData 获取的数据 {url, fileName}

            metaDataContent: null,
            isMetaDataLoading: false
        }
    },
    computed: {
        excelFilesToPreview() {
            return this.filesToPreview.filter(file =>
                file.fileType && (file.fileType.includes('spreadsheetml') || file.fileType.includes('excel'))
            );
        },
        metaFile() {
            return this.filesToPreview.find(file => file.documentType === 'recordMeta');
        }
    },
    methods: {
        async fetchAllData() {
            console.log(`%c[fetchAllData] STAGE 0: Initialization for recordId=${this.recordId}`, 'color: blue; font-weight: bold;');
            if (!this.recordId) return;

            this.isLoading = true;
            this.loadError = null;
            this.reviewSheet = null;

            try {
                // STAGE 1 & 2
                const [recordResponse, filesResponse] = await Promise.all([
                    axios.get(`/api/process-records/${this.recordId}`),
                    axios.get(`/api/process-records/${this.recordId}/files`)
                ]);
                this.recordInfo = recordResponse.data;
                this.filesToPreview = (filesResponse.data || []).sort((a, b) => a.documentType.localeCompare(b.documentType));

                let defaultFileToLoad = null;
                if (this.excelFilesToPreview.length > 0) {
                    this.activePreviewTab = this.excelFilesToPreview[0].documentType;
                    defaultFileToLoad = this.excelFilesToPreview[0];
                } else if (this.metaFile) {
                    this.activePreviewTab = 'recordMeta';
                }

                this.$nextTick(() => {
                    if (this.activePreviewTab === 'recordMeta') {
                        this.fetchAndDisplayMetaData();
                    } else if (defaultFileToLoad) {
                        this.loadSheetInPreviewIframe(defaultFileToLoad);
                    }
                });

                // STAGE 3
                console.log('%c[fetchAllData] STAGE 3: Fetching review sheet info...', 'color: blue; font-weight: bold;');
                try {
                    const reviewSheetResponse = await axios.get(`/api/process-records/${this.recordId}/review-sheet-info`);
                    let savedReviewSheet = reviewSheetResponse.data;
                    if (typeof savedReviewSheet === 'string') {
                        savedReviewSheet = JSON.parse(savedReviewSheet);
                    }
                    const fileId = savedReviewSheet.id;
                    const fileName = savedReviewSheet.fileName || savedReviewSheet.file_name;

                    if (!fileId || !fileName) throw new Error("Response missing key fields.");

                    // 【【【 关键修正点 1：赋值给正确的变量 this.reviewSheetData 】】】
                    this.reviewSheetData = {
                        url: `/api/files/content/${fileId}?t=${new Date().getTime()}`,
                        fileName: fileName
                    };

                } catch (error) {
                    // 【【【 关键修正点 2：回退时也赋值给 this.reviewSheetData 】】】
                    this.reviewSheetData = {
                        url: this.reviewTemplateUrl,
                        fileName: '审核模板.xlsx'
                    };
                }

                // 调用 loadReviewSheet，它会去检查 reviewSheetData
                this.loadReviewSheet();

            } catch (error) {
                this.loadError = "加载核心数据失败：" + error.message;
            } finally {
                this.isLoading = false;
            }
        },

        // 【只保留唯一、正确的 loadReviewSheet 方法】
        loadReviewSheet() {
            console.log(`[Parent] Attempting to load review sheet. iframeLoaded=${this.reviewIframeLoaded}, dataReady=${!!this.reviewSheetData}`);

            // 只有在 iframe 已加载 并且 数据已准备好 这两个条件都满足时，才发送消息
            if (this.reviewIframeLoaded && this.reviewSheetData) {
                this.sendMessageToIframe(this.$refs.reviewIframe, {
                    type: 'LOAD_SHEET',
                    payload: {
                        fileUrl: this.reviewSheetData.url,
                        fileName: this.reviewSheetData.fileName,
                        options: { lang: 'zh', allowUpdate: true, showtoolbar: true }
                    }
                });
                console.log(`[Parent] ✅ LOAD_SHEET message sent to reviewIframe.`);
            }
        },

        // --- 其他必要的方法 ---
        async fetchAndDisplayMetaData() {
            // ... (这是您展示元数据JSON的方法，如果不需要可以删除)
        },
        loadSheetInPreviewIframe(fileInfo) {
            if (!fileInfo) return;
            const iframeRef = this.$refs['iframe-' + fileInfo.id];
            const targetIframe = Array.isArray(iframeRef) ? iframeRef[0] : iframeRef;
            if (targetIframe && targetIframe.contentWindow) {
                const options = { allowUpdate: false, showtoolbar: false, showinfobar: false };
                const fileUrl = `/api/files/content/${fileInfo.id}?t=${new Date().getTime()}`;
                const message = {
                    type: 'LOAD_SHEET',
                    payload: { fileUrl, fileName: fileInfo.fileName, options: { lang: 'zh', ...options } }
                };
                targetIframe.contentWindow.postMessage(message, window.location.origin);
            }
        },
        handleTabClick(tab) {
            if (tab.name === 'recordMeta') {
                this.fetchAndDisplayMetaData();
            } else {
                const fileToLoad = this.excelFilesToPreview.find(f => f.documentType === tab.name);
                this.$nextTick(() => this.loadSheetInPreviewIframe(fileToLoad));
            }
        },
        onReviewIframeLoad() {
            console.log("[DEBUG] onReviewIframeLoad: ✅ 右侧审核Iframe已加载。");
            this.reviewIframeLoaded = true;
            // iframe 加载完成后，立即尝试加载数据
            // 这时 reviewSheetData 很可能已经被 fetchAllData 填充好了
            this.loadReviewSheet();
        },

        saveReviewSheet() {
            if (this.isSavingSheet || !this.reviewIframeLoaded) return;
            this.isSavingSheet = true;
            this.$message.info("正在生成审核文件...");
        
            // 像 workspace 一样，在 payload 中添加一个明确的 purpose
            this.sendMessageToIframe(this.$refs.reviewIframe, { 
                type: 'GET_DATA_AND_IMAGES', 
                payload: {
                    purpose: 'save-review-sheet' // 使用一个唯一的 purpose
                } 
            });
        },
        
        async messageEventListener(event) {
            // 1. 安全检查
            if (event.origin !== window.location.origin || !event.data) {
                return;
            }
        
            // 2. 只处理我们关心的数据响应类型
            if (event.data.type !== 'SHEET_DATA_WITH_IMAGES_RESPONSE') {
                return;
            }
        
            const { payload } = event.data;
        
            // 3. 【重要】根据 purpose 判断是否应该处理此消息
            //    这确保了只有点击 "保存审核结果" 按钮时，这个逻辑才会被触发
            if (!payload || payload.purpose !== 'save-review-sheet') {
                return;
            }
        
            console.log('[Review Panel] ✅ Purpose 检查通过，开始执行保存审核结果逻辑...');
        
            try {
                // 4. 【核心修正】将从 iframe 收到的完整 payload 直接传递给导出函数
                //    这与 workspace 的工作方式完全一致
                const exportBlob = await exportWithExcelJS(payload);
                
                const formData = new FormData();
                const reviewFileName = `ReviewResult_${this.recordInfo.partName}_${this.recordId}.xlsx`;
                formData.append('file', exportBlob, reviewFileName);
                
                const apiUrl = `/api/process-records/${this.recordId}/save-review-sheet`;
                await axios.post(apiUrl, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
        
                this.$message.success("审核表已成功保存！");
                this.fetchAllData(); // 重新加载以显示最新版本
                
            } catch (error) {
                this.$message.error(error.message || "导出或上传过程出错！");
                console.error("在线保存审核文件时出错:", error);
            } finally {
                this.isSavingSheet = false;
            }
        },
        sendMessageToIframe(iframe, message) {
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage(message, window.location.origin);
            }
        },
        /**
     * 导出左侧当前正在预览的 Excel 文件
     */
        exportPreviewSheet() {
            // 1. 找到当前激活的 Tab 对应的文件信息
            const currentFile = this.excelFilesToPreview.find(file => file.documentType === this.activePreviewTab);

            if (!currentFile) {
                this.$message.warning("没有可导出的预览文件。");
                return;
            }

            // 2. 找到对应的 iframe 引用
            const iframeRef = this.$refs['iframe-' + currentFile.id];
            const targetIframe = Array.isArray(iframeRef) ? iframeRef[0] : iframeRef;

            if (!targetIframe) {
                this.$message.error("无法找到对应的预览窗口实例。");
                return;
            }

            // 3. 构造一个有意义的文件名
            const fileName = `${currentFile.fileName || currentFile.documentType}.xlsx`;

            // 4. 向该 iframe 发送导出指令
            this.sendMessageToIframe(targetIframe, {
                type: 'EXPORT_SHEET',
                payload: {
                    fileName: fileName
                }
            });

            this.$message.info(`已发送导出指令给: ${fileName}`);
        },

        /**
         * 导出右侧的审核表
         */
        exportReviewSheet() {
            // 1. 检查右侧 iframe 是否已加载
            if (!this.$refs.reviewIframe) {
                this.$message.error("无法找到审核窗口实例。");
                return;
            }

            // 2. 构造一个有意义的文件名
            const fileName = `审核结果_${this.recordInfo.partName}_${this.recordId}.xlsx`;

            // 3. 向右侧的审核 iframe 发送导出指令
            this.sendMessageToIframe(this.$refs.reviewIframe, {
                type: 'EXPORT_SHEET',
                payload: {
                    fileName: fileName
                }
            });

            this.$message.info("已发送导出指令给审核表...");
        },

    },
    mounted() {
        this.boundMessageListener = this.messageEventListener.bind(this);
        window.addEventListener('message', this.boundMessageListener);
    },
    beforeDestroy() {
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
        }
    }
});