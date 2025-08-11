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
        <div class="main-panel">
            <div class="content-wrapper">
                
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
                                <hr>
                                <iframe ref="previewIframe" src="/luckysheet-iframe-loader.html" @load="onPreviewIframeLoad" style="width: 100%; height: 80vh; border: none;"></iframe>
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
        </div>
    `,
    
    data() {
        return {
            isLoading: true,
            recordInfo: null,
            loadError: null,
            isSavingSheet: false,
            reviewTemplateUrl: '/api/files/templates/review-sheet',
            previewIframeLoaded: false,
            reviewIframeLoaded: false,
            reviewSheetUrl: ''
        }
    },

    methods: {
        // --- 核心数据获取方法 (保持不变) ---
        fetchRecordData() {
            if (!this.recordId) return;
            this.isLoading = true;
            this.loadError = null;
            
            axios.get(`/api/process-records/${this.recordId}`)
                .then(response => {
                    this.recordInfo = response.data;
                    console.log('✅ 【ReviewPanel】获取到记录信息:', this.recordInfo);

                    if (this.previewIframeLoaded && this.recordInfo.sourceFilePath) {
                        this.loadPreviewSheet();
                    }
                    this.determineReviewSheetUrl();
                })
                .catch(error => {
                    this.loadError = "加载过程记录表信息失败，请刷新重试。";
                    this.$message.error("加载数据失败！");
                })
                .finally(() => {
                    this.isLoading = false;
                });
        },
        
        // --- 决定加载模板还是已保存的审核表 (保持不变) ---
        determineReviewSheetUrl() {
            axios.get(`/api/process-records/${this.recordId}/review-sheet-info`)
                .then(response => {
                    const savedReviewSheet = response.data;
                    this.reviewSheetUrl = `/api/files/content/${savedReviewSheet.id}`;
                    if (this.reviewIframeLoaded) this.loadReviewSheet();
                })
                .catch(error => {
                    if (error.response && error.response.status === 404) {
                        this.reviewSheetUrl = this.reviewTemplateUrl;
                        if (this.reviewIframeLoaded) this.loadReviewSheet();
                    } else {
                        this.loadError = "查询历史审核表失败！";
                    }
                });
        },
        
        // --- Iframe加载完成后的回调 (保持不变) ---
        onPreviewIframeLoad() {
            console.log("【ReviewPanel】左侧预览iframe已加载完成。");
            this.previewIframeLoaded = true;
            if (this.recordInfo && this.recordInfo.sourceFilePath) {
                this.loadPreviewSheet();
            }
        },
        onReviewIframeLoad() {
            console.log("【ReviewPanel】右侧审核iframe已加载完成。");
            this.reviewIframeLoaded = true;
            if (this.reviewSheetUrl) {
                this.loadReviewSheet();
            }
        },

        // --- 向Iframe发送加载指令 ---
        loadPreviewSheet() {
            this.sendMessageToIframe(this.$refs.previewIframe, {
                type: 'LOAD_SHEET',
                payload: {
                    // 【修正】: 不再需要 instanceId
                    fileUrl: '/uploads/' + this.recordInfo.sourceFilePath,
                    options: { lang: 'zh', showtoolbar: false, showinfobar: false, allowUpdate: false, showsheetbar: true }
                }
            });
        },
        loadReviewSheet() {
            this.sendMessageToIframe(this.$refs.reviewIframe, {
                type: 'LOAD_SHEET',
                payload: {
                    // 【修正】: 不再需要 instanceId
                    fileUrl: this.reviewSheetUrl,
                    options: { lang: 'zh', allowUpdate: true, showtoolbar: true, showsheetbar: true }
                }
            });
        },
        
        // --- 保存逻辑 ---
        saveReviewSheet() {
            if (this.isSavingSheet || !this.reviewIframeLoaded) return;
            this.isSavingSheet = true;
            console.log("【ReviewPanel】请求右侧iframe返回数据...");
            // 【修正】: 不再需要 payload.instanceId
            this.sendMessageToIframe(this.$refs.reviewIframe, { type: 'GET_DATA' });
        },
        
        // --- 消息处理与辅助方法 ---
        sendMessageToIframe(iframe, message) {
            if (iframe && iframe.contentWindow) {
                 iframe.contentWindow.postMessage(message, window.location.origin);
            } else {
                console.error("【ReviewPanel】尝试向iframe发送消息失败，iframe未准备好。");
            }
        },
        messageEventListener(event) {
            if (event.origin !== window.location.origin) return;
            const { type, payload } = event.data; // 【修正】: 移除了 instanceId
            
            // 【修正】: 不再需要 instanceId 检查，我们通过事件监听器的上下文来判断
            // 这个监听器是属于 record-review-panel 的，我们假设 GET_DATA 只从审核iframe触发
            if (type === 'SHEET_DATA_RESPONSE') {
                console.log("【ReviewPanel】收到来自iframe的Luckysheet数据，准备导出...");
                
                if (typeof XLSX === 'undefined') {
                    this.$message.error("导出功能核心库(SheetJS)缺失！");
                    this.isSavingSheet = false;
                    return;
                }
                
                try {
                    const sheetJSData = this.convertLuckyToSheetJS(payload);
                    const workbook = XLSX.utils.book_new();
                    Object.keys(sheetJSData).forEach(sheetName => {
                        XLSX.utils.book_append_sheet(workbook, sheetJSData[sheetName], sheetName);
                    });
                    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
                    const exportBlob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

                    const formData = new FormData();
                    const reviewFileName = `ReviewResult_${this.recordInfo.partName}_${this.recordId}.xlsx`;
                    formData.append('file', exportBlob, reviewFileName);
                    
                    const apiUrl = `/api/process-records/${this.recordId}/save-review-sheet`;

                    axios.post(apiUrl, formData)
                        .then((response) => {
                            this.$message.success("在线审核表格已成功保存！");
                            this.$emit('record-reviewed', response.data);
                        })
                        .catch(error => {
                            const errorMessage = (error.response && error.response.data) || "保存在线审核表格失败！";
                            this.$message.error(errorMessage);
                        })
                        .finally(() => {
                            this.isSavingSheet = false;
                        });

                } catch (e) {
                    console.error("【ReviewPanel】使用SheetJS导出时发生错误:", e);
                    this.$message.error("导出审核表格时出错！");
                    this.isSavingSheet = false;
                }
            } else if (type === 'SHEET_LOAD_ERROR') {
                console.error("【ReviewPanel】Iframe内部加载Sheet时出错:", payload.error);
            }
        },
        convertLuckyToSheetJS(luckySheets) {
            const sheetJSData = {};
            if (!luckySheets || !Array.isArray(luckySheets)) return sheetJSData;

            luckySheets.forEach(sheet => {
                const sheetData = [];
                if (sheet.celldata) {
                    const cellMap = {};
                    let maxRow = -1;
                    let maxCol = -1;
                    sheet.celldata.forEach(cell => {
                        if (cell.r > maxRow) maxRow = cell.r;
                        if (cell.c > maxCol) maxCol = cell.c;

                        if (!cellMap[cell.r]) cellMap[cell.r] = {};
                        cellMap[cell.r][cell.c] = cell.v ? (cell.v.m !== undefined ? cell.v.m : cell.v.v) : '';
                    });
                    
                    for (let r = 0; r <= maxRow; r++) {
                        const row = [];
                        for (let c = 0; c <= maxCol; c++) {
                            row[c] = cellMap[r] && cellMap[r][c] !== undefined ? cellMap[r][c] : null;
                        }
                        sheetData.push(row);
                    }
                }
                sheetJSData[sheet.name] = XLSX.utils.aoa_to_sheet(sheetData);
            });
            return sheetJSData;
        }
    },

    // --- 生命周期钩子 ---
    mounted() {
        console.log("【ReviewPanel】组件已挂载, recordId:", this.recordId);
        window.addEventListener('message', this.messageEventListener);
    },
    beforeDestroy() {
        console.log("【ReviewPanel】组件将被销毁，移除消息监听器...");
        window.removeEventListener('message', this.messageEventListener);
    },
    watch: {
        recordId: {
            immediate: true,
            handler(newId) {
                if (newId) {
                    this.fetchRecordData();
                }
            }
        }
    }
});