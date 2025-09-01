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

        loadReviewSheet() {
            console.log(`[Parent] loadReviewSheet: 尝试加载... iframeLoaded=${this.reviewIframeLoaded}, url=${this.reviewSheetUrl}`);
            if (this.reviewIframeLoaded && this.reviewSheetUrl) {
                
                // 【核心策略】
                // 1. 优先尝试从 sessionStorage 读取缓存
                const cacheKey = `luckysheet_cache_${this.recordId}`;
                const cachedData = sessionStorage.getItem(cacheKey);

                if (cachedData) {
                    console.log(`[Parent] 🚀 发现缓存！将直接使用 sessionStorage 中的JSON数据加载审核表。`);
                    try {
                        const luckysheetData = JSON.parse(cachedData);
                        this.sendMessageToIframe(this.$refs.reviewIframe, {
                            type: 'LOAD_SHEET',
                            payload: {
                                luckysheetData: luckysheetData, // 直接传递数据
                                fileName: this.reviewSheetFileName,
                                options: { lang: 'zh', allowUpdate: true, showtoolbar: true, showsheetbar: true }
                            }
                        });
                        // 使用后立即清除，确保下次刷新页面时加载的是服务器最新版本
                        sessionStorage.removeItem(cacheKey);
                    } catch (e) {
                         console.error("[Parent] 解析缓存的JSON失败，将回退到文件下载方式。", e);
                         this.loadReviewSheetFromFile(); // 解析失败，回退
                    }
                } else {
                    console.log(`[Parent] ℹ️ 未发现缓存，将从服务器下载 .xlsx 文件进行加载。`);
                    this.loadReviewSheetFromFile(); // 没有缓存，正常从文件加载
                }
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