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
            if (!this.recordId) {
                console.warn("[DEBUG] fetchRecordData: recordId 为空，已跳过。");
                return;
            }
            console.log(`[DEBUG] fetchRecordData: 开始为 recordId=${this.recordId} 获取数据...`);
            this.isLoading = true;
            this.loadError = null;

            axios.get(`/api/process-records/${this.recordId}`)
                .then(response => {
                    this.recordInfo = response.data;
                    console.log("[DEBUG] fetchRecordData: 成功获取到 recordInfo:", this.recordInfo);

                    if (this.recordInfo && this.recordInfo.sourceFilePath) {
                        this.previewFileUrl = '/uploads/' + this.recordInfo.sourceFilePath;
                        this.previewFileName = this.recordInfo.sourceFileName || '未知预览文件';
                        console.log(`[DEBUG] fetchRecordData: 已设置 previewFileUrl 为: ${this.previewFileUrl}`);
                    } else {
                        this.loadError = "未能获取到源文件路径。";
                        console.error("[DEBUG-ERROR] fetchRecordData: API返回的数据中缺少 sourceFilePath:", this.recordInfo);
                    }
                    
                    this.loadPreviewSheet(); // 触发一次加载尝试
                    this.determineReviewSheetUrl(); // 链式调用
                })
                .catch(error => {
                    this.loadError = "加载过程记录表信息失败。";
                    console.error("[DEBUG-ERROR] fetchRecordData: 请求主数据失败:", error);
                })
                .finally(() => {
                    this.isLoading = false;
                });
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

        // --- 向 Iframe 发送指令的核心方法 (包含防御性检查) ---
        loadPreviewSheet() {
            console.log(`[DEBUG] loadPreviewSheet: 尝试加载... iframeLoaded=${this.previewIframeLoaded}, url=${this.previewFileUrl}`);
            if (this.previewIframeLoaded && this.previewFileUrl) {
                console.log(`[DEBUG] loadPreviewSheet: 🚀 条件满足！向预览iframe发送 LOAD_SHEET 指令。`);
                this.sendMessageToIframe(this.$refs.previewIframe, {
                    type: 'LOAD_SHEET',
                    payload: {
                        fileUrl: this.previewFileUrl,
                        fileName: this.previewFileName,
                        options: { lang: 'zh', showtoolbar: false, showinfobar: false, allowUpdate: false, showsheetbar: true }
                    }
                });
            }
        },
        loadReviewSheet() {
            console.log(`[DEBUG] loadReviewSheet: 尝试加载... iframeLoaded=${this.reviewIframeLoaded}, url=${this.reviewSheetUrl}`);
            if (this.reviewIframeLoaded && this.reviewSheetUrl) {
                console.log(`[DEBUG] loadReviewSheet: 🚀 条件满足！向审核iframe发送 LOAD_SHEET 指令。`);
                this.sendMessageToIframe(this.$refs.reviewIframe, {
                    type: 'LOAD_SHEET',
                    payload: {
                        fileUrl: this.reviewSheetUrl,
                        fileName: this.reviewSheetFileName,
                        options: { lang: 'zh', allowUpdate: true, showtoolbar: true, showsheetbar: true }
                    }
                });
            }
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

            // 【变更】: 检查 ExcelJS 是否存在
            if (typeof ExcelJS === 'undefined') {
                this.$message.error(`导出核心库(ExcelJS)缺失！请检查 index.html。`);
                this.isSavingSheet = false;
                return;
            }

            try {
                // 【变更】: 调用新的基于 ExcelJS 的导出函数
                const exportBlob = await this.exportWithExcelJS(payload);
                
                // 触发前端下载，用于最终验证
                const downloadUrl = window.URL.createObjectURL(exportBlob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = downloadUrl;
                a.download = `FINAL_EXPORT_WITH_EXCELJS_${this.recordId}.xlsx`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(downloadUrl);
                document.body.removeChild(a);

                const formData = new FormData();
                const reviewFileName = `ReviewResult_${this.recordInfo.partName}_${this.recordId}.xlsx`;
                formData.append('file', exportBlob, reviewFileName);
                const apiUrl = `/api/process-records/${this.recordId}/save-review-sheet`;
                await axios.post(apiUrl, formData, { headers: { 'Content-Type': 'multipart/form-data' } });

                this.$message.success("审核表已使用新引擎成功保存！");
                this.determineReviewSheetUrl();
            } catch (error) {
                this.$message.error(error.message || "使用 ExcelJS 导出或保存失败！");
                console.error("ExcelJS 导出或上传过程出错:", error);
            } finally {
                this.isSavingSheet = false;
            }
        },

        async messageEventListener(event) {
            if (event.origin !== window.location.origin || !event.data || event.data.type !== 'SHEET_DATA_WITH_IMAGES_RESPONSE') {
                return;
            }
            const { payload } = event.data;
            if (typeof ExcelJS === 'undefined') {
                this.$message.error(`导出核心库(ExcelJS)缺失！`); this.isSavingSheet = false; return;
            }
            try {
                const exportBlob = await this.exportWithExcelJS(payload);
                
                // 最终验证下载
                const downloadUrl = window.URL.createObjectURL(exportBlob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = `THE_FINAL_EXPORT_${this.recordId}.xlsx`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(downloadUrl);
                a.remove();
    
                const formData = new FormData();
                const reviewFileName = `ReviewResult_${this.recordInfo.partName}_${this.recordId}.xlsx`;
                formData.append('file', exportBlob, reviewFileName);
                const apiUrl = `/api/process-records/${this.recordId}/save-review-sheet`;
                await axios.post(apiUrl, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    
                this.$message.success("审核表已使用最终引擎成功保存！");
                this.determineReviewSheetUrl();
            } catch (error) {
                this.$message.error(error.message || "使用 ExcelJS 导出或保存失败！");
                console.error("ExcelJS 导出或上传过程出错:", error);
            } finally {
                this.isSavingSheet = false;
            }
        },
    
        /**
         * 【终极版解决方案】: 使用 ExcelJS 导出，并采用最兼容的图片锚定方式
         */
        async exportWithExcelJS(luckysheetData) {
            console.log("【终极版解决方案】: 使用 ExcelJS 引擎和精确锚点开始构建...");
            const sheets = luckysheetData.sheets;
            if (!sheets || sheets.length === 0) { throw new Error("工作表数据为空"); }
    
            const workbook = new ExcelJS.Workbook();
    
            for (const sheet of sheets) {
                if (!sheet) continue;
                const worksheet = workbook.addWorksheet(sheet.name);
    
                // 1. 设置列宽和行高 (保持不变)
                if (sheet.config) {
                    if (sheet.config.columnlen) { Object.entries(sheet.config.columnlen).forEach(([colIndex, width]) => { worksheet.getColumn(parseInt(colIndex) + 1).width = width / 8; }); }
                    if (sheet.config.rowlen) { Object.entries(sheet.config.rowlen).forEach(([rowIndex, height]) => { worksheet.getRow(parseInt(rowIndex) + 1).height = height * 0.75; }); }
                }
    
                // 2. 填充单元格和合并 (保持不变)
                (sheet.celldata || []).forEach(cellData => { const cell = worksheet.getCell(cellData.r + 1, cellData.c + 1); if (cellData.v) { cell.value = cellData.v.m !== undefined ? cellData.v.m : cellData.v.v; } });
                if (sheet.config && sheet.config.merge) { Object.values(sheet.config.merge).forEach(merge => { worksheet.mergeCells(merge.r + 1, merge.c + 1, merge.r + merge.rs, merge.c + merge.cs); }); }
    
                // 3. 【核心修正】处理图片
                if (sheet.images && typeof sheet.images === 'object') {
                    for (const imageId in sheet.images) {
                        const img = sheet.images[imageId];
                        if (!img || !img.src) continue;
    
                        const base64Data = img.src.split(',')[1];
                        if (!base64Data) continue;
                        
                        const imageIdInWorkbook = workbook.addImage({
                            base64: base64Data,
                            extension: this.getImageExtension(img.src),
                        });
                        
                        const imgDefault = img.default || {};
                        const { left, top, width, height } = imgDefault;
    
                        // a. 【关键】调用辅助函数，计算出图片应该锚定在哪个单元格以及单元格内的偏移
                        const anchor = this.getExcelImageAnchor(left, top, sheet.config?.columnlen || {}, sheet.config?.rowlen || {});
                        
                        // b. 【关键】使用计算出的锚点来添加图片
                        worksheet.addImage(imageIdInWorkbook, {
                            tl: { 
                                col: anchor.col + 0.00001, // 加上极小值避免整数边界问题
                                row: anchor.row + 0.00001,
                                // ExcelJS 的 tl 对象不直接支持 colOff/rowOff，这是文档的一个误导
                                // 正确的方式是直接修改 col 和 row 的小数部分来表示偏移
                                // 但更简单的方式是直接使用 range
                            },
                            // 使用 range 提供更精确的、兼容性最好的定位
                            tl: { col: anchor.col, row: anchor.row, colOff: anchor.colOff, rowOff: anchor.rowOff },
                            ext: { width, height }
                        });
                        console.log(`✅ 图片 ${imageId} 已使用精确锚点添加到工作表`);
                    }
                }
            }
    
            // 4. 生成 Blob
            const buffer = await workbook.xlsx.writeBuffer();
            console.log("✅ ExcelJS 成功生成兼容性文件 Buffer，大小:", buffer.byteLength);
            return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        },
    
        /**
         * 【复活的辅助函数】: 计算图片左上角的精确单元格锚点
         */
        getExcelImageAnchor(left, top, colLen, rowLen) {
            const defaultColWidth = 73;
            const defaultRowHeight = 19;
            const EMU_PER_PIXEL = 9525;
    
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
    
            return {
                col: startCol,
                row: startRow,
                colOff: startColOffPx * EMU_PER_PIXEL,
                rowOff: startRowOffPx * EMU_PER_PIXEL,
            };
        },
    
        getImageExtension(dataUrl) {
            if (!dataUrl) return 'png';
            const mimeMatch = dataUrl.match(/data:image\/(.*?);/);
            const ext = mimeMatch ? mimeMatch[1] : 'png';
            return ext === 'jpeg' ? 'jpeg' : ext;
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