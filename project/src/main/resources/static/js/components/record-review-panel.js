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
            <div class="content-wrapper" style="width:100%;height:100%">
                
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
    `,
    
    data() {
        return {
            isLoading: true,
            recordInfo: null,
            loadError: null,
            isSavingSheet: false,
            reviewTemplateUrl: '/templates/review_template.xlsx',
            previewIframeLoaded: false,
            reviewIframeLoaded: false,
        }
    },

    methods: {
        // --- 核心数据获取方法 ---
        fetchRecordData() {
            if (!this.recordId) return;
            this.isLoading = true;
            this.loadError = null;
            
            axios.get(`/api/process-records/${this.recordId}`)
                .then(response => {
                    this.recordInfo = response.data;
                    console.log('✅ 【ReviewPanel】获取到记录信息:', this.recordInfo);

                    // 如果预览iframe已经加载好了，就立即发送加载指令
                    if (this.previewIframeLoaded && this.recordInfo.sourceFilePath) {
                        this.sendMessageToIframe(this.$refs.previewIframe, {
                            type: 'LOAD_SHEET',
                            payload: {
                                fileUrl: '/uploads/' + this.recordInfo.sourceFilePath,
                                options: { lang: 'zh', showtoolbar: false, showinfobar: false, allowUpdate: false, showsheetbar: true }
                            }
                        });
                    }
                })
                .catch(error => {
                    this.loadError = "加载过程记录表信息失败，请刷新重试。";
                    this.$message.error("加载数据失败！");
                    console.error("❌ 【ReviewPanel】获取过程记录表信息失败:", error);
                })
                .finally(() => {
                    this.isLoading = false;
                });
        },
        
        // --- Iframe加载完成后的回调函数 ---
        onPreviewIframeLoad() {
            console.log("【ReviewPanel】左侧预览iframe已加载完成。");
            this.previewIframeLoaded = true;
            // 如果主数据已经先获取到了，就立即发送消息
            if (this.recordInfo && this.recordInfo.sourceFilePath) {
                this.sendMessageToIframe(this.$refs.previewIframe, {
                    type: 'LOAD_SHEET',
                    payload: {
                        fileUrl: '/uploads/' + this.recordInfo.sourceFilePath,
                        options: { lang: 'zh', showtoolbar: false, showinfobar: false, allowUpdate: false, showsheetbar: true }
                    }
                });
            }
        },
        onReviewIframeLoad() {
            console.log("【ReviewPanel】右侧审核iframe已加载完成。");
            this.reviewIframeLoaded = true;
            // 立即发送加载模板的指令
            this.sendMessageToIframe(this.$refs.reviewIframe, {
                type: 'LOAD_SHEET',
                payload: {
                    fileUrl: this.reviewTemplateUrl,
                    options: { lang: 'zh', allowUpdate: true, showtoolbar: true, showsheetbar: true }
                }
            });
        },
        
        // --- 保存逻辑 ---
        saveReviewSheet() {
            if (this.isSavingSheet) return;
            if (!this.reviewIframeLoaded) {
                 this.$message.warning("请等待审核模板加载完成。");
                 return;
            }
            this.isSavingSheet = true;
            console.log("【ReviewPanel】请求右侧iframe返回数据...");
            this.sendMessageToIframe(this.$refs.reviewIframe, { type: 'GET_DATA' });
        },
        
        // --- 辅助方法 ---
        sendMessageToIframe(iframe, message) {
            if (iframe && iframe.contentWindow) {
                 iframe.contentWindow.postMessage(message, window.location.origin);
            } else {
                console.error("【ReviewPanel】尝试向iframe发送消息失败，iframe不存在或contentWindow未准备好。");
            }
        },

        // --- 消息监听器 ---
        messageEventListener(event) {
            if (event.origin !== window.location.origin) return; // 安全检查
            const { type, payload } = event.data;
            
            if (type === 'SHEET_DATA_RESPONSE') {
                console.log("【ReviewPanel】收到来自iframe的Luckysheet数据，准备使用SheetJS导出...");
                
                // 确保 SheetJS 库 (xlsx) 已经通过 <script> 标签加载到全局
                if (typeof XLSX === 'undefined') {
                    console.error("【ReviewPanel】SheetJS (xlsx) 库未找到！请在 index.html 中引入。");
                    this.$message.error("导出功能核心库缺失！");
                    this.isSavingSheet = false;
                    return;
                }
                
                try {
                    // 1. 将Luckysheet的JSON数据格式转换为SheetJS需要的数据格式
                    const sheetJSData = this.convertLuckyToSheetJS(payload);
                    // 2. 使用SheetJS创建工作簿
                    const workbook = XLSX.utils.book_new();
                    Object.keys(sheetJSData).forEach(sheetName => {
                        XLSX.utils.book_append_sheet(workbook, sheetJSData[sheetName], sheetName);
                    });
                    // 3. 将工作簿写入Blob
                    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
                    const exportBlob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

                    // 4. 上传Blob
                    const formData = new FormData();
                    const reviewFileName = `ReviewResult_${this.recordInfo.partName}_${this.recordId}.xlsx`;
                    formData.append('file', exportBlob, reviewFileName);
                    
                    // 【重要】后端API修改为保存审核表
                    const apiUrl = `/api/process-records/${this.recordId}/save-review-sheet`;

                    axios.post(apiUrl, formData)
                        .then((response) => {
                            this.$message.success("在线审核表格已成功保存！");
                            this.$emit('record-reviewed', response.data); // 触发事件通知父组件
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
                // 可以在这里更新UI，显示错误信息
            }
        },
        
        // ---【新增】将Luckysheet数据格式转换为SheetJS数据格式的辅助函数 ---
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
                        // 使用 .m (原始值) 或 .v (显示值)
                        cellMap[cell.r][cell.c] = cell.v ? cell.v.m || cell.v.v : '';
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
                // TODO: 在这里可以添加对合并单元格、样式等的转换
            });
            return sheetJSData;
        }
    },

    // --- 生命周期钩子 ---
    mounted() {
        console.log("【ReviewPanel】组件已挂载, recordId:", this.recordId);
        // 在组件挂载时，开始监听来自iframe的消息
        window.addEventListener('message', this.messageEventListener);
    },
    beforeDestroy() {
        console.log("【ReviewPanel】组件将被销毁，移除消息监听器...");
        // 在组件销毁前，必须移除事件监听器，防止内存泄漏
        window.removeEventListener('message', this.messageEventListener);
    },
    watch: {
        recordId: {
            immediate: true,
            handler(newId, oldId) {
                console.log(`【ReviewPanel】检测到 recordId 从 ${oldId} 变为 ${newId}`);
                if (newId) {
                    this.fetchRecordData();
                }
            }
        }
    }
});