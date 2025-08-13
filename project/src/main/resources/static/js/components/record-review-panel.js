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
                                    </button>
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
                
                if (this.previewIframeLoaded && this.recordInfo.sourceFilePath) {
                    this.loadPreviewSheet();
                }
                this.determineReviewSheetUrl();

            }).catch(error => {
                this.loadError = "加载过程记录表信息失败，请刷新重试。";
                this.$message.error("加载数据失败！");
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
            this.previewIframeLoaded = true;
            if (this.recordInfo && this.recordInfo.sourceFilePath) {
                this.loadPreviewSheet();
            }
        },
        onReviewIframeLoad() {
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
                console.error("尝试向iframe发送消息失败，iframe未准备好。");
            }
        },

        async messageEventListener(event) {
            if (event.origin !== window.location.origin) return;
            const { type, payload } = event.data;
            
            if (type === 'SHEET_DATA_WITH_IMAGES_RESPONSE') {
                if (typeof XLSX === 'undefined') {
                    this.$message.error(`导出核心库(XLSX)缺失！`);
                    this.isSavingSheet = false;
                    return;
                }
                try {
                    const exportBlob = this.exportWithSheetJS(payload);
                    const formData = new FormData();
                    const reviewFileName = `ReviewResult_${this.recordInfo.partName}_${this.recordId}.xlsx`;
                    formData.append('file', exportBlob, reviewFileName);
                    const apiUrl = `/api/process-records/${this.recordId}/save-review-sheet`;
                    const response = await axios.post(apiUrl, formData);
                    this.$message.success("在线审核表格已成功保存！");
                    this.$emit('record-reviewed', response.data);
                    this.determineReviewSheetUrl();
                } catch (error) {
                    this.$message.error(error.message || "导出或保存失败！");
                    console.error("导出或上传过程出错:", error);
                } finally {
                    this.isSavingSheet = false;
                }
            }
        },
    
        /**
         * 【终局之战】: 回归SheetJS，手动构建所有内容
         */
        exportWithSheetJS(luckysheetData) {
            console.log("【终局方案】使用SheetJS手动构建...");
            const { sheets, images } = luckysheetData;
            
            const workbook = XLSX.utils.book_new();

            (sheets || []).forEach(sheet => {
                // 1. 手动创建工作表并填充数据
                const ws = {};
                const range = {s: {c: 10000, r: 10000}, e: {c: 0, r: 0}};
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
                
                if(range.s.c < 10000) {
                    ws['!ref'] = XLSX.utils.encode_range(range);
                } else {
                    // Handle empty sheet case
                    ws['!ref'] = 'A1';
                }

                // 2. 手动添加合并单元格
                if(sheet.config && sheet.config.merge) {
                    ws['!merges'] = Object.values(sheet.config.merge).map(m => ({
                        s: { r: m.r, c: m.c },
                        e: { r: m.r + m.rs - 1, c: m.c + m.cs - 1 }
                    }));
                }

                // 3. 手动设置列宽和行高 (单位转换)
                if(sheet.config) {
                    ws['!cols'] = sheet.config.columnlen ? Object.entries(sheet.config.columnlen).map(([i,w]) => ({wch: w / 8})) : [];
                    ws['!rows'] = sheet.config.rowlen ? Object.entries(sheet.config.rowlen).map(([i,h]) => ({hpt: h * 0.75})) : [];
                }

                // 4. 【核心】手动注入图片
                if (images && Object.keys(images).length > 0) {
                    ws['!images'] = [];
                    for (const imageId in images) {
                        const img = images[imageId];
                        const imgDefault = img.default || img;

                        // 使用 `order` (sheet的顺序) 和 `sheetIndex` (图片所属的顺序) 进行匹配
                        if (imgDefault.sheetIndex == sheet.order) {
                            console.log(`✅ 正在向Sheet '${sheet.name}' 添加图片 ${imageId}`);
                            ws['!images'].push({
                                name: `${imageId}.${this.getImageExtension(img.src)}`,
                                data: this.base64ToArrayBuffer(img.src.split(',')[1]),
                                opts: { base64: false },
                                position: {
                                    type: 'absolute',
                                    x: imgDefault.left,
                                    y: imgDefault.top,
                                    cx: imgDefault.width,
                                    cy: imgDefault.height
                                }
                            });
                        }
                    }
                }
                
                // 5. 将构建好的工作表添加到工作簿
                XLSX.utils.book_append_sheet(workbook, ws, sheet.name);
            });

            // 6. 生成最终文件
            const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            console.log("【终局方案】文件ArrayBuffer已生成，大小: " + wbout.byteLength);
            return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        },
        
        getImageExtension(dataUrl) {
            if(!dataUrl) return 'png';
            const mimeMatch = dataUrl.match(/data:image\/(.*?);/);
            const ext = mimeMatch ? mimeMatch[1] : 'png';
            return ext === 'jpeg' ? 'jpeg' : ext;
        },

        base64ToArrayBuffer(base64) {
            const binary_string = window.atob(base64);
            const len = binary_string.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binary_string.charCodeAt(i);
            }
            return bytes.buffer;
        }
    },

    mounted() {
        window.addEventListener('message', this.messageEventListener.bind(this));
    },
    beforeDestroy() {
        window.removeEventListener('message', this.messageEventListener.bind(this));
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