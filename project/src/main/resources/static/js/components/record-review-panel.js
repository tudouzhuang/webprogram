import { exportWithExcelJS } from '/js/utils/luckysheetExporter.js';

Vue.component('record-review-panel', {
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
                                <h4 class="card-title mb-0">文件预览 (只读)</h4>
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
                                </div>
                            </div>
                        </div>
                    </el-col>
                </el-row>

            </div>
    `,

    data() {
        return {
            // --- 核心状态 ---
            isLoading: true,
            recordInfo: null,
            loadError: null,
            
            // --- 左侧预览区数据 ---
            filesToPreview: [],
            activePreviewTab: '',
            metaDataContent: null,
            isMetaDataLoading: false,
    
            // --- 右侧审核区数据 ---
            isSavingSheet: false,
            reviewTemplateUrl: '/api/files/templates/review-sheet.xlsx',
            reviewIframeLoaded: false
            // 【已清理】: 不再需要 reviewSheet 对象在 data 中，改为局部变量
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
    // 【【【 核心修正：添加超详细日志 】】】
    // 【统一的数据加载入口】
    async fetchAllData() {
        if (!this.recordId) return;
        this.isLoading = true;
        this.loadError = null;

        try {
            // 1. 并行获取主记录和文件列表
            const [recordResponse, filesResponse] = await Promise.all([
                axios.get(`/api/process-records/${this.recordId}`),
                axios.get(`/api/process-records/${this.recordId}/files`)
            ]);
            
            this.recordInfo = recordResponse.data;
            this.filesToPreview = (filesResponse.data || []).sort((a, b) => a.documentType.localeCompare(b.documentType));
            
            // 2. 设定默认预览Tab并安排加载
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

            // 3. 获取审核表信息并直接调用加载函数
            let reviewUrl, reviewFileName;
            try {
                const reviewSheetResponse = await axios.get(`/api/process-records/${this.recordId}/review-sheet-info`);
                const savedReviewSheet = reviewSheetResponse.data;
                reviewUrl = `/api/files/content/${savedReviewSheet.id}?t=${new Date().getTime()}`;
                reviewFileName = savedReviewSheet.fileName || savedReviewSheet.file_name;
            } catch (error) {
                console.warn("[ReviewPanel] 获取历史审核表失败，将使用默认模板:", error.message);
                reviewUrl = this.reviewTemplateUrl;
                reviewFileName = '审核模板.xlsx';
            }
            
            this.loadReviewSheet(reviewUrl, reviewFileName);

        } catch (error) {
            this.loadError = "加载核心数据失败：" + error.message;
        } finally {
            this.isLoading = false;
        }
    },

        loadSheetInPreviewIframe(fileInfo) {
            if (!fileInfo) {
                console.warn("[ReviewPanel] loadSheetInPreviewIframe 调用时 fileInfo 为空。");
                return;
            }
            
            const iframeRef = this.$refs['iframe-' + fileInfo.id];
            const targetIframe = Array.isArray(iframeRef) ? iframeRef[0] : iframeRef;
            
            // 增加更详细的日志
            if (targetIframe && targetIframe.contentWindow) {
                console.log(`[ReviewPanel] 成功找到 ref='iframe-${fileInfo.id}' 的 iframe，准备发送 LOAD_SHEET 消息。`);
                const options = { allowUpdate: false, showtoolbar: false, showinfobar: false };
                const fileUrl = `/api/files/content/${fileInfo.id}?t=${new Date().getTime()}`;
                const message = {
                    type: 'LOAD_SHEET',
                    payload: { fileUrl, fileName: fileInfo.fileName, options: { lang: 'zh', ...options } }
                };
                targetIframe.contentWindow.postMessage(message, window.location.origin);
            } else {
                 console.error(`[ReviewPanel] 致命错误：未能找到 ref='iframe-${fileInfo.id}' 的 iframe 实例！`);
            }
        },

        determineReviewSheetUrl() {
            console.log(`[DEBUG] determineReviewSheetUrl: 开始为 recordId=${this.recordId} 查询审核表...`);
            axios.get(`/api/process-records/${this.recordId}/review-sheet-info`)
                .then(response => {
                    const savedReviewSheet = response.data;
                    this.reviewSheetUrl = `/api/files/content/${savedReviewSheet.id}?t=${new Date().getTime()}`;
                    this.reviewSheetFileName = savedReviewSheet.fileName;
                    console.log(`[DEBUG] determineReviewSheetUrl: ✅ 找到已保存的审核表, URL设置为: ${this.reviewSheetUrl}`);
                    this.loadReviewSheet(); // 触发一次加载尝试
                })
                .catch(error => {
                    if (error.response && error.response.status === 404) {
                        this.reviewSheetUrl = this.reviewTemplateUrl;
                        this.reviewSheetFileName = '审核模板.xlsx';
                        console.log(`[DEBUG] determineReviewSheetUrl: ℹ️ 未找到历史审核表(404), URL设置为模板: ${this.reviewSheetUrl}`);
                        this.loadReviewSheet(); // 触发一次加载尝试
                    } else {
                        this.loadError = "查询历史审核表失败！";
                        console.error("[DEBUG-ERROR] determineReviewSheetUrl: 查询审核表信息失败:", error);
                    }
                });
        },

        // --- Iframe 加载事件处理器 ---
        onPreviewIframeLoad() {
            console.log("[DEBUG] onPreviewIframeLoad: ✅ 左侧预览Iframe已加载。");
            this.previewIframeLoaded = true;
            this.loadPreviewSheet(); // 触发一次加载尝试
        },
        onReviewIframeLoad() {
            console.log("[DEBUG] onReviewIframeLoad: ✅ 右侧审核Iframe已加载。");
            this.reviewIframeLoaded = true;
            this.loadReviewSheet(); // 触发一次加载尝试
        },

        // --- 保存逻辑 ---
        saveReviewSheet() {
            if (this.isSavingSheet || !this.reviewIframeLoaded) return;
            this.isSavingSheet = true;
            this.$message.info("正在生成审核文件，请稍候...");
            this.sendMessageToIframe(this.$refs.reviewIframe, {
                type: 'GET_DATA_AND_IMAGES',
                payload: {
                    // instanceId已在iframe侧移除，不再需要
                }
            });
        },

        getExcelImageTwoCellAnchor(left, top, width, height, colLen, rowLen) {
            const defaultColWidth = 73;
            const defaultRowHeight = 19;
            const EMU_PER_PIXEL = 9525;

            // --- 计算左上角 ('tl') 锚点 ---
            let currentX = 0, startCol = 0, startColOffPx = 0;
            for (let c = 0; c < 512; c++) {
                const currentW = colLen[c] === undefined ? defaultColWidth : colLen[c];
                if (left < currentX + currentW) {
                    startCol = c;
                    startColOffPx = left - currentX;
                    break;
                }
                currentX += currentW;
            }

            let currentY = 0, startRow = 0, startRowOffPx = 0;
            for (let r = 0; r < 4096; r++) {
                const currentH = rowLen[r] === undefined ? defaultRowHeight : rowLen[r];
                if (top < currentY + currentH) {
                    startRow = r;
                    startRowOffPx = top - currentY;
                    break;
                }
                currentY += currentH;
            }
            const tlAnchor = { col: startCol, row: startRow, colOff: startColOffPx * EMU_PER_PIXEL, rowOff: startRowOffPx * EMU_PER_PIXEL };

            // --- 计算右下角 ('br') 锚点 ---
            const endX = left + width;
            const endY = top + height;

            currentX = 0;
            let endCol = 0, endColOffPx = 0;
            for (let c = 0; c < 512; c++) {
                const currentW = colLen[c] === undefined ? defaultColWidth : colLen[c];
                if (endX <= currentX + currentW) {
                    endCol = c;
                    endColOffPx = endX - currentX;
                    break;
                }
                currentX += currentW;
            }

            currentY = 0;
            let endRow = 0, endRowOffPx = 0;
            for (let r = 0; r < 4096; r++) {
                const currentH = rowLen[r] === undefined ? defaultRowHeight : rowLen[r];
                if (endY <= currentY + currentH) {
                    endRow = r;
                    endRowOffPx = endY - currentY;
                    break;
                }
                currentY += currentH;
            }
            const brAnchor = { col: endCol, row: endRow, colOff: endColOffPx * EMU_PER_PIXEL, rowOff: endRowOffPx * EMU_PER_PIXEL };

            // 【核心修正】: 返回 tl 和 br，而不是 from 和 to
            return { tl: tlAnchor, br: brAnchor };
        },

        // --- 消息处理与辅助方法 ---
        sendMessageToIframe(iframe, message) {
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage(message, window.location.origin);
            } else {
                console.error("尝试向iframe发送消息失败，iframe未准备好。");
            }
        },

        async messageEventListener(event) {
            if (event.origin !== window.location.origin || !event.data || event.data.type !== 'SHEET_DATA_WITH_IMAGES_RESPONSE') {
                return;
            }
            const { payload } = event.data;

            // 1. 缓存逻辑保持不变
            const cacheKey = `luckysheet_cache_${this.recordId}`;
            try {
                sessionStorage.setItem(cacheKey, JSON.stringify(payload.sheets));
                console.log(`[Parent] ✅ 已将实时JSON暂存到 sessionStorage (key: ${cacheKey})`);
            } catch (e) {
                console.warn("[Parent] 暂存 Luckysheet JSON 到 sessionStorage 失败:", e);
            }

            // 2. 【调用外部模块】导出为 .xlsx 文件
            try {
                // 这里是关键变化！调用导入的函数
                const exportBlob = await exportWithExcelJS(payload);

                // 后续上传逻辑不变
                const formData = new FormData();
                const reviewFileName = `ReviewResult_${this.recordInfo.partName}_${this.recordId}.xlsx`;
                formData.append('file', exportBlob, reviewFileName);
                const apiUrl = `/api/process-records/${this.recordId}/save-review-sheet`;
                await axios.post(apiUrl, formData, { headers: { 'Content-Type': 'multipart/form-data' } });

                this.$message.success("审核表已成功保存！");

                // 3. 触发重载
                this.determineReviewSheetUrl();

            } catch (error) {
                this.$message.error(error.message || "导出或上传过程出错！");
                console.error("调用 luckysheetExporter 或上传过程出错:", error);
            } finally {
                this.isSavingSheet = false;
            }
        },

        loadReviewSheet(url, fileName) {
            if (this.reviewIframeLoaded && url && fileName) {
                 this.sendMessageToIframe(this.$refs.reviewIframe, {
                    type: 'LOAD_SHEET',
                    payload: {
                        fileUrl: url,
                        fileName: fileName,
                        options: { lang: 'zh', allowUpdate: true, showtoolbar: true }
                    }
                });
            }
        },

        // 新增一个辅助方法，用于封装原始的文件加载逻辑
        loadReviewSheetFromFile() {
            this.sendMessageToIframe(this.$refs.reviewIframe, {
                type: 'LOAD_SHEET',
                payload: {
                    fileUrl: this.reviewSheetUrl,
                    fileName: this.reviewSheetFileName,
                    options: { lang: 'zh', allowUpdate: true, showtoolbar: true, showsheetbar: true }
                }
            });
        },

        /**
     * 【新增翻译官】: 将 Luckysheet 的 'r_c' 范围字符串转换为 Excel 的 'A1' 地址
     * @param {string} luckysheetRange - 例如 '5_0'
     * @returns {string} 例如 'A6'
     */
        convertLuckysheetRangeToExcel(luckysheetRange) {
            // Luckysheet 的数据验证范围通常是单个单元格的 r_c 格式
            const parts = luckysheetRange.split('_');
            if (parts.length !== 2) {
                console.warn(`无法解析的 Luckysheet 范围格式: ${luckysheetRange}，已跳过。`);
                return null;
            }

            const r = parseInt(parts[0], 10); // 0-based row index
            const c = parseInt(parts[1], 10); // 0-based col index

            // 将 0-based 列索引转换为 'A', 'B', 'Z', 'AA' 等
            let colName = '';
            let tempC = c;
            while (tempC >= 0) {
                colName = String.fromCharCode((tempC % 26) + 65) + colName;
                tempC = Math.floor(tempC / 26) - 1;
            }

            // Excel 行号是 1-based
            const rowNum = r + 1;

            return `${colName}${rowNum}`;
        },
    },

    mounted() {
        // 绑定事件监听，确保 this 指向正确
        this.boundMessageListener = this.messageEventListener.bind(this);
        window.addEventListener('message', this.boundMessageListener);
    },
    beforeDestroy() {
        window.removeEventListener('message', this.boundMessageListener);
    },
// record-review-panel.js -> watch
    watch: {
        recordId: {
            immediate: true,
            handler(newId) {
                if (newId) {
                    // 【【【 核心修正 】】】
                    // 调用新的、统一的、健壮的数据加载方法
                    this.fetchAllData(); 
                }
            }
        }
    }
});