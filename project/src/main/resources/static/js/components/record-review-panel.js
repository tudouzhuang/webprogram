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
            // 安全校验
            if (event.origin !== window.location.origin || !event.data || event.data.type !== 'SHEET_DATA_WITH_IMAGES_RESPONSE') {
                return;
            }
            
            const { payload } = event.data;
            
            if (typeof XLSX === 'undefined') {
                this.$message.error(`导出核心库(XLSX)缺失！请检查index.html是否正确引入SheetJS。`);
                this.isSavingSheet = false;
                return;
            }
            try {
                const exportBlob = this.exportWithSheetJS(payload);
                const formData = new FormData();
                const reviewFileName = `ReviewResult_${this.recordInfo.partName}_${this.recordId}.xlsx`;
                formData.append('file', exportBlob, reviewFileName);
                
                const apiUrl = `/api/process-records/${this.recordId}/save-review-sheet`;
                const response = await axios.post(apiUrl, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                this.$message.success("在线审核表格已成功保存！");
                this.$emit('record-reviewed', response.data);
                // 保存成功后，重新获取审核表信息，以便下次加载的是最新版本
                this.determineReviewSheetUrl();
            } catch (error) {
                this.$message.error(error.message || "导出或保存失败！请检查控制台日志。");
                console.error("导出或上传过程出错:", error);
            } finally {
                this.isSavingSheet = false;
            }
        },
    
        /**
         * 【关键修正】: 使用SheetJS手动构建，并正确处理图片定位
         */
        exportWithSheetJS(luckysheetData) {
            console.log("【修正方案】使用SheetJS手动构建，包含精确图片定位...");
            const { sheets, images } = luckysheetData;
            
            const workbook = XLSX.utils.book_new();

            (sheets || []).forEach(sheet => {
                const ws = {};
                const range = {s: {c: 10000, r: 10000}, e: {c: 0, r: 0}};

                // 1. 填充单元格数据
                (sheet.celldata || []).forEach(cell => {
                    if(range.s.r > cell.r) range.s.r = cell.r;
                    if(range.s.c > cell.c) range.s.c = cell.c;
                    if(range.e.r < cell.r) range.e.r = cell.r;
                    if(range.e.c < cell.c) range.e.c = cell.c;
                    
                    const cell_ref = XLSX.utils.encode_cell({c: cell.c, r: cell.r});
                    const cellValue = cell.v ? (cell.v.m !== undefined ? cell.v.m : cell.v.v) : null;
                    const cellType = typeof cellValue === 'number' ? 'n' : 's';
                    
                    ws[cell_ref] = { v: cellValue, t: cellType };
                });
                
                ws['!ref'] = range.s.c < 10000 ? XLSX.utils.encode_range(range) : 'A1';

                // 2. 添加合并单元格
                if(sheet.config && sheet.config.merge) {
                    ws['!merges'] = Object.values(sheet.config.merge).map(m => ({
                        s: { r: m.r, c: m.c },
                        e: { r: m.r + m.rs - 1, c: m.c + m.cs - 1 }
                    }));
                }

                // 3. 设置列宽和行高
                if(sheet.config) {
                    ws['!cols'] = sheet.config.columnlen ? Object.entries(sheet.config.columnlen).map(([i,w]) => ({wch: w / 7.5})) : [];
                    ws['!rows'] = sheet.config.rowlen ? Object.entries(sheet.config.rowlen).map(([i,h]) => ({hpx: h})) : [];
                }

                // 4. 【核心修正】手动注入图片，并计算其单元格锚点
                if (images && Object.keys(images).length > 0) {
                    ws['!images'] = [];
                    for (const imageId in images) {
                        const img = images[imageId];
                        const imgDefault = img.default || img;

                        // 确保图片属于当前Sheet (通过 sheet.order 匹配)
                        if (imgDefault.sheetIndex == sheet.order) {
                            console.log(`✅ 正在向Sheet '${sheet.name}' 添加图片 ${imageId}`);
                            
                            const position = this.getExcelCellPosition(
                                imgDefault.left, 
                                imgDefault.top, 
                                imgDefault.width, 
                                imgDefault.height,
                                sheet.config?.columnlen || {},
                                sheet.config?.rowlen || {}
                            );

                            ws['!images'].push({
                                name: `${imageId}.${this.getImageExtension(img.src)}`,
                                data: img.src.split(',')[1], // 直接传入base64字符串
                                opts: { base64: true },
                                position: {
                                    type: 'twoCell',
                                    from: position.from,
                                    to: position.to
                                }
                            });
                        }
                    }
                }
                
                XLSX.utils.book_append_sheet(workbook, ws, sheet.name);
            });

            const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            console.log("【修正方案】文件ArrayBuffer已生成，大小: " + wbout.byteLength);
            return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        },

        /**
         * 【新增辅助函数】: 将像素坐标转换为Excel单元格锚点
         */
        getExcelCellPosition(left, top, width, height, colLen, rowLen) {
            const defaultColWidth = 73;
            const defaultRowHeight = 19;

            let currentX = 0, startCol = 0, startColOff = 0;
            let currentY = 0, startRow = 0, startRowOff = 0;
            let endX = left + width;
            let endY = top + height;

            for (let c = 0; c < 256; c++) {
                const currentW = colLen[c] === undefined ? defaultColWidth : colLen[c];
                if (left < currentX + currentW) {
                    startCol = c;
                    startColOff = left - currentX;
                    break;
                }
                currentX += currentW;
            }
            for (let r = 0; r < 2000; r++) { // 增加行数上限
                const currentH = rowLen[r] === undefined ? defaultRowHeight : rowLen[r];
                if (top < currentY + currentH) {
                    startRow = r;
                    startRowOff = top - currentY;
                    break;
                }
                currentY += currentH;
            }

            currentX = 0;
            currentY = 0;
            let endCol = startCol, endColOff = 0;
            let endRow = startRow, endRowOff = 0;

            for (let c = 0; c < 256; c++) {
                const currentW = colLen[c] === undefined ? defaultColWidth : colLen[c];
                if (endX <= currentX + currentW) {
                    endCol = c;
                    endColOff = endX - currentX;
                    break;
                }
                currentX += currentW;
            }
            for (let r = 0; r < 2000; r++) { // 增加行数上限
                const currentH = rowLen[r] === undefined ? defaultRowHeight : rowLen[r];
                if (endY <= currentY + currentH) {
                    endRow = r;
                    endRowOff = endY - currentY;
                    break;
                }
                currentY += currentH;
            }

            const EMU_PER_PIXEL = 9525;

            return {
                from: { col: startCol, row: startRow, colOff: startColOff * EMU_PER_PIXEL, rowOff: startRowOff * EMU_PER_PIXEL },
                to: { col: endCol, row: endRow, colOff: endColOff * EMU_PER_PIXEL, rowOff: endRowOff * EMU_PER_PIXEL }
            };
        },
        
        getImageExtension(dataUrl) {
            if(!dataUrl) return 'png';
            const mimeMatch = dataUrl.match(/data:image\/(.*?);/);
            const ext = mimeMatch ? mimeMatch[1] : 'png';
            return ext === 'jpeg' ? 'jpg' : ext; // Excel 通常使用 jpg
        },

        // base64ToArrayBuffer 不再需要，因为SheetJS可以直接处理base64字符串
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