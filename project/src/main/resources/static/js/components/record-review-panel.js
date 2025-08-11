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
            reviewTemplateUrl: '/api/files/templates/review-sheet',
            previewIframeLoaded: false,
            reviewIframeLoaded: false,
            reviewSheetUrl: '',
            previewFileName: '',
            reviewSheetFileName: ''
        }
    },

methods: {
    // --- 核心数据获取方法 ---
    fetchRecordData() {
        if (!this.recordId) return;
        this.isLoading = true;
        this.loadError = null;
        
        Promise.all([
            axios.get(`/api/process-records/${this.recordId}`),
            axios.get(`/api/process-records/${this.recordId}/source-file-info`).catch(e => ({ data: null }))
        ]).then(([recordResponse, sourceFileResponse]) => {
            this.recordInfo = recordResponse.data;
            
            if (sourceFileResponse.data && sourceFileResponse.data.fileName) {
                this.previewFileName = sourceFileResponse.data.fileName;
            } else {
                this.previewFileName = (this.recordInfo && this.recordInfo.sourceFileName) ? this.recordInfo.sourceFileName : '未知预览文件';
            }
            
            console.log('✅ 【ReviewPanel】获取到记录信息:', this.recordInfo);

            if (this.previewIframeLoaded && this.recordInfo.sourceFilePath) {
                this.loadPreviewSheet();
            }
            this.determineReviewSheetUrl();

        }).catch(error => {
            this.loadError = "加载过程记录表信息失败，请刷新重试。";
            this.$message.error("加载数据失败！");
            console.error("❌ 【ReviewPanel】获取过程记录表信息失败:", error);
        }).finally(() => {
            this.isLoading = false;
        });
    },
    
    // --- 决定加载模板还是已保存的审核表 ---
    determineReviewSheetUrl() {
        axios.get(`/api/process-records/${this.recordId}/review-sheet-info`)
            .then(response => {
                const savedReviewSheet = response.data;
                this.reviewSheetUrl = `/api/files/content/${savedReviewSheet.id}`;
                this.reviewSheetFileName = savedReviewSheet.fileName;
                if (this.reviewIframeLoaded) this.loadReviewSheet();
            })
            .catch(error => {
                if (error.response && error.response.status === 404) {
                    this.reviewSheetUrl = this.reviewTemplateUrl;
                    this.reviewSheetFileName = '审核模板.xlsx';
                    if (this.reviewIframeLoaded) this.loadReviewSheet();
                } else {
                    this.loadError = "查询历史审核表失败！";
                }
            });
    },
    
    // --- Iframe加载完成后的回调 ---
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
                instanceId: 'previewSheet',
                fileUrl: '/uploads/' + this.recordInfo.sourceFilePath,
                fileName: this.previewFileName,
                options: { lang: 'zh', showtoolbar: false, showinfobar: false, allowUpdate: false, showsheetbar: true }
            }
        });
    },
    loadReviewSheet() {
        this.sendMessageToIframe(this.$refs.reviewIframe, {
            type: 'LOAD_SHEET',
            payload: {
                instanceId: 'reviewSheet',
                fileUrl: this.reviewSheetUrl,
                fileName: this.reviewSheetFileName,
                options: { lang: 'zh', allowUpdate: true, showtoolbar: true, showsheetbar: true }
            }
        });
    },
    
    // --- 保存逻辑 ---
    saveReviewSheet() {
        if (this.isSavingSheet || !this.reviewIframeLoaded) return;
        this.isSavingSheet = true;
        console.log("【ReviewPanel】请求右侧iframe返回数据...");
        this.sendMessageToIframe(this.$refs.reviewIframe, { 
            type: 'GET_DATA_AND_IMAGES',
            payload: {
                instanceId: 'reviewSheet'
            }
        });
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
        const { type, payload } = event.data;
        
        if (type === 'SHEET_DATA_WITH_IMAGES_RESPONSE') {
            console.log("【ReviewPanel】收到iframe回传的数据和图片，准备导出并上传...", payload);
            
            if (typeof XLSX === 'undefined') {
                this.$message.error("导出功能核心库(SheetJS)缺失！");
                this.isSavingSheet = false;
                return;
            }
            
            try {
                const { sheets, images } = payload;
                // =======================================================
                // 【调试日志 1】: 检查收到的原始数据
                // =======================================================
                console.log("【Debug】收到的原始Sheets数据:", JSON.parse(JSON.stringify(sheets)));
                console.log("【Debug】收到的原始Images数据:", JSON.parse(JSON.stringify(images)));
                
                const exportBlob = this.exportDataWithImages(sheets, images);

                // =======================================================
                // 【调试日志 4】: 在上传前，深入检查 Blob 对象
                // =======================================================
                console.log("【Debug Blob】准备上传的 Blob 对象:", exportBlob);
                console.log(`【Debug Blob】Blob 类型: ${exportBlob.type}, 大小: ${exportBlob.size} bytes`);
                // 我们可以尝试读取Blob内容来验证（这是一个异步操作）
                const reader = new FileReader();
                reader.onload = function(e) {
                    // 只打印前100个字符作为样本，避免控制台卡死
                    console.log("【Debug Blob】Blob 内容样本 (前100字符):", e.target.result.substring(0, 100));
                };
                reader.readAsText(exportBlob.slice(0, 100)); // 只读取前100个字节
                // =======================================================

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
                console.error("【ReviewPanel】在 messageEventListener 中发生严重错误:", e);
                this.$message.error("导出审核表格时出错！");
                this.isSavingSheet = false;
            }
        } else if (type === 'SHEET_LOAD_ERROR') {
            console.error("【ReviewPanel】Iframe内部加载Sheet时出错:", payload.error);
        }
    },
    
    exportDataWithImages(sheets, images) {
        console.log("【Debug】进入 exportDataWithImages 方法...");
        const workbook = XLSX.utils.book_new();

        if (sheets && sheets.length > 0) {
            const sheet = sheets[0];
            console.log(`【Debug】正在处理唯一的Sheet: '${sheet.name}'`);
            const ws = this.convertCelldataToWorksheet(sheet.celldata);

            if (images && Object.keys(images).length > 0) {
                if (!ws['!images']) ws['!images'] = [];
                console.log(`【Debug】发现 ${Object.keys(images).length} 张图片，开始遍历...`);

                for (const imageId in images) {
                    const img = images[imageId];
                    if (img.default && img.src) {
                        try {
                            const base64Data = img.src.split(',')[1];
                            if (!base64Data) continue;

                            const buffer = this.base64ToArrayBuffer(base64Data);
                            const imageExt = this.getImageExtension(img.src);
                            
                            const topLeftCell = this.findCellByPosition(sheet, img.default.left, img.default.top);
                            const imagePosition = { editAs: 'oneCell', cell: topLeftCell.address };

                            // =======================================================
                            // 【调试日志 2】: 检查准备添加到worksheet的图片对象
                            // =======================================================
                            const imageToAdd = {
                                name: `${imageId}.${imageExt}`,
                                data: buffer,
                                opts: { base64: false },
                                position: imagePosition
                            };
                            console.log("【Debug Image】准备添加图片到 worksheet:", imageToAdd);

                            ws['!images'].push(imageToAdd);

                        } catch (e) {
                            console.warn(`【Export】处理图片 ${imageId} 时发生内部错误，已跳过:`, e);
                        }
                    }
                }
            } else {
                console.log("【Debug】未发现任何图片数据。");
            }
            XLSX.utils.book_append_sheet(workbook, ws, sheet.name);
        } else {
            console.warn("【Debug】没有找到任何Sheet数据，将生成一个空的Excel文件。");
            const ws = XLSX.utils.aoa_to_sheet([["空内容"]]);
            XLSX.utils.book_append_sheet(workbook, ws, "Sheet1");

        }
        console.log("【Debug Workbook】所有Sheet处理完毕，最终的Workbook结构:", workbook);
        console.log("【Debug Workbook】第一个Sheet的!images数组内容:", workbook.Sheets[workbook.SheetNames[0]]['!images']);

        const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        console.log("【Debug】Excel ArrayBuffer生成成功！");
        return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    },
    
    convertCelldataToWorksheet(celldata) {
        const sheetData = [];
        if (celldata) {
            const cellMap = {};
            let maxRow = -1; let maxCol = -1;
            celldata.forEach(cell => {
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
        return XLSX.utils.aoa_to_sheet(sheetData);
    },
    
    base64ToArrayBuffer(base64) {
        const binary_string = window.atob(base64);
        const len = binary_string.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary_string.charCodeAt(i);
        }
        return bytes.buffer;
    },
    
    getImageExtension(dataUrl) {
        const mimeMatch = dataUrl.match(/data:image\/(.*?);/);
        return mimeMatch ? mimeMatch[1] : 'png';
    },
    
    findCellByPosition(sheet, x_px, y_px) {
        let accumulatedHeight = 0;
        let targetRow = 0;
        if (sheet.config && sheet.config.rowlen) {
            for (let i = 0; i < sheet.config.rowlen.length; i++) {
                const rowHeight = sheet.config.rowlen[i] || 20;
                if (y_px < accumulatedHeight + rowHeight) {
                    targetRow = i;
                    break;
                }
                accumulatedHeight += rowHeight;
            }
        }

        let accumulatedWidth = 0;
        let targetCol = 0;
        if (sheet.config && sheet.config.columnlen) {
            for (let i = 0; i < sheet.config.columnlen.length; i++) {
                const colWidth = sheet.config.columnlen[i] || 80;
                if (x_px < accumulatedWidth + colWidth) {
                    targetCol = i;
                    break;
                }
                accumulatedWidth += colWidth;
            }
        }

        return {
            address: XLSX.utils.encode_cell({ r: targetRow, c: targetCol })
        };
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