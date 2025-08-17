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
            const { payload } = event.data; // payload.sheets 包含了完美融合的数据

            // 1. 【新增】将这份完美数据暂存到 sessionStorage
            // 我们用 recordId 作为 key，确保每个记录表都有自己的缓存
            const cacheKey = `luckysheet_cache_${this.recordId}`;
            try {
                sessionStorage.setItem(cacheKey, JSON.stringify(payload.sheets));
                console.log(`[Parent] ✅ 已将包含数据验证的实时JSON暂存到 sessionStorage (key: ${cacheKey})`);
            } catch (e) {
                console.warn("[Parent] 暂存 Luckysheet JSON 到 sessionStorage 失败:", e);
            }

            // 2. 导出为 .xlsx 文件 (这部分逻辑保持不变)
            try {
                const exportBlob = await this.exportWithExcelJS(payload);
                const formData = new FormData();
                const reviewFileName = `ReviewResult_${this.recordInfo.partName}_${this.recordId}.xlsx`;
                formData.append('file', exportBlob, reviewFileName);
                const apiUrl = `/api/process-records/${this.recordId}/save-review-sheet`;
                await axios.post(apiUrl, formData, { headers: { 'Content-Type': 'multipart/form-data' } });

                this.$message.success("审核表已成功保存！");

                // 3. 触发重载 (保持不变)
                this.determineReviewSheetUrl();

            } catch (error) {
                this.$message.error(error.message || "导出或上传过程出错！");
                console.error("ExcelJS 导出或上传过程出错:", error);
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
/**
         * 【最终修正版】: 修复了文本无法保存的问题，并完全遵循 ExcelJS 规范
         */
async exportWithExcelJS(luckysheetData) {
    console.log("【最终修正版】: 开始构建，修复文本保存问题并遵循规范...");
    const { sheets } = luckysheetData;
    if (!sheets || sheets.length === 0) { throw new Error("工作表数据为空"); }

    const workbook = new ExcelJS.Workbook();

    for (const sheet of sheets) {
        if (!sheet) continue;
        const worksheet = workbook.addWorksheet(sheet.name);

        // 1. 设置列宽和行高 (符合规范)
        if (sheet.config) {
            if (sheet.config.columnlen) { Object.entries(sheet.config.columnlen).forEach(([colIndex, width]) => { worksheet.getColumn(parseInt(colIndex) + 1).width = width / 8; }); }
            if (sheet.config.rowlen) { Object.entries(sheet.config.rowlen).forEach(([rowIndex, height]) => { worksheet.getRow(parseInt(rowIndex) + 1).height = height * 0.75; }); }
        }
        
        // 2. 【核心修正】遍历所有有记录的单元格，确保无遗漏
        (sheet.celldata || []).forEach(cellData => {
            // 无论如何，先获取单元格对象
            const cell = worksheet.getCell(cellData.r + 1, cellData.c + 1);
            const luckysheetCell = cellData.v; // 这个对象可能为 null

            // 如果 luckysheetCell 存在，说明单元格有内容或样式
            if (luckysheetCell) {
                // 优先处理公式
                if (luckysheetCell.f) {
                    cell.formula = luckysheetCell.f.substring(1);
                } else {
                    // 处理值（显示值优先）
                    cell.value = luckysheetCell.m !== undefined ? luckysheetCell.m : luckysheetCell.v;
                }
                // 应用所有样式（字体、对齐、边框、背景、数字格式等）
                cell.style = this.mapLuckysheetStyleToExcelJS(luckysheetCell);
            } else {
                // 如果 luckysheetCell 不存在 (为 null)，说明这是一个被清空了的单元格
                // 我们需要显式地将其值设为 null，以覆盖模板中可能存在的旧数据
                cell.value = null;
                // 同时也可以清空样式，如果需要的话
                cell.style = {};
            }
        });

        // 3. 处理合并单元格 (符合规范)
        if (sheet.config && sheet.config.merge) { 
             Object.values(sheet.config.merge).forEach(merge => { 
                worksheet.mergeCells(merge.r + 1, merge.c + 1, merge.r + merge.rs, merge.c + merge.cs); 
            }); 
        }
        
        if (sheet.dataVerification) {
            Object.entries(sheet.dataVerification).forEach(([luckysheetRange, rule]) => {
                if (rule.type === 'dropdown') {
                    // 调用“翻译官”函数进行地址转换
                    const excelAddress = this.convertLuckysheetRangeToExcel(luckysheetRange);
                    
                    // 只有在地址转换成功后才添加验证
                    if (excelAddress) {
                        worksheet.dataValidations.add(excelAddress, {
                            type: 'list',
                            allowBlank: rule.prohibitInput !== true,
                            formulae: [`"${rule.value1}"`],
                            showErrorMessage: true,
                            errorStyle: 'warning',
                            errorTitle: '输入无效',
                            error: '请从下拉列表中选择一个有效值。'
                        });
                        console.log(`✅ [地址转换后] 已为 Excel 地址 [${excelAddress}] 添加下拉列表: ${rule.value1}`);
                    }
                }
            });
        }

        // 5. 处理图片 (保持不变)
        if (sheet.images && typeof sheet.images === 'object') {
            for (const imageId in sheet.images) {
                const img = sheet.images[imageId];
                const imgDefault = img ? img.default : null;
                if (!img || !img.src || !imgDefault) { continue; }
                const { left, top, width, height } = imgDefault;
                if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) { continue; }
                const base64Data = img.src.split(',')[1];
                if (!base64Data) { continue; }
                
                const imageIdInWorkbook = workbook.addImage({ base64: base64Data, extension: this.getImageExtension(img.src) });
                const anchor = this.getExcelImageTwoCellAnchor(left, top, width, height, sheet.config?.columnlen || {}, sheet.config?.rowlen || {});
                worksheet.addImage(imageIdInWorkbook, {
                    tl: anchor.tl,
                    br: anchor.br,
                    editAs: 'twoCell' 
                });
            }
        }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    console.log("✅ ExcelJS (最终修正版) 成功生成文件 Buffer，大小:", buffer.byteLength);
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheet.ml.sheet' });
},

        /**
                 * 【完全版】: 将 Luckysheet 单元格样式映射到 ExcelJS 样式 (含边框)
                 * @param {object} luckysheetCell - Luckysheet 的单元格对象 (cellData.v)
                 * @returns {object} ExcelJS 的 style 对象
                 */
        mapLuckysheetStyleToExcelJS(luckysheetCell) {
            if (!luckysheetCell) return {}; // 安全检查

            const style = {};
            const font = {};
            const alignment = {};
            const fill = {};
            const border = {}; // 新增：边框对象

            // --- 字体 ---
            if (luckysheetCell.bl === 1) font.bold = true;
            if (luckysheetCell.it === 1) font.italic = true;
            if (luckysheetCell.cl === 1) font.strike = true; // 删除线
            if (luckysheetCell.ul === 1) font.underline = true; // 下划线
            if (luckysheetCell.ff) font.name = luckysheetCell.ff;
            if (luckysheetCell.fs) font.size = luckysheetCell.fs;
            if (luckysheetCell.fc) font.color = { argb: luckysheetCell.fc.replace('#', 'FF') };

            // --- 背景填充 (此功能已存在且正确) ---
            if (luckysheetCell.bg) {
                fill.type = 'pattern';
                fill.pattern = 'solid';
                fill.fgColor = { argb: luckysheetCell.bg.replace('#', 'FF') };
            }

            // --- 对齐 ---
            if (luckysheetCell.ht === 0) alignment.horizontal = 'center';
            else if (luckysheetCell.ht === 1) alignment.horizontal = 'left';
            else if (luckysheetCell.ht === 2) alignment.horizontal = 'right';

            if (luckysheetCell.vt === 0) alignment.vertical = 'middle';
            else if (luckysheetCell.vt === 1) alignment.vertical = 'top';
            else if (luckysheetCell.vt === 2) alignment.vertical = 'bottom';

            if (luckysheetCell.tb === 2) alignment.wrapText = true;

            // --- 【核心新增】边框处理 ---
            if (luckysheetCell.bd) {
                // Luckysheet 边框类型到 ExcelJS 的映射
                const luckysheetBorderTypeMap = {
                    "1": "thin", "2": "hair", "3": "dotted", "4": "dashed",
                    "5": "dashDot", "6": "dashDotDot", "7": "double", "8": "medium",
                    "9": "mediumDashed", "10": "mediumDashDot", "11": "mediumDashDotDot",
                    "12": "slantDashDot", "13": "thick"
                };

                const processBorder = (borderConfig) => {
                    if (!borderConfig) return undefined;
                    return {
                        style: luckysheetBorderTypeMap[borderConfig.style] || 'thin',
                        color: { argb: (borderConfig.color || '#000000').replace('#', 'FF') }
                    };
                };

                // 分别处理 上、下、左、右 边框
                const top = processBorder(luckysheetCell.bd.t);
                const bottom = processBorder(luckysheetCell.bd.b);
                const left = processBorder(luckysheetCell.bd.l);
                const right = processBorder(luckysheetCell.bd.r);

                if (top) border.top = top;
                if (bottom) border.bottom = bottom;
                if (left) border.left = left;
                if (right) border.right = right;
            }

            // --- 组合最终的 style 对象 ---
            if (Object.keys(font).length > 0) style.font = font;
            if (Object.keys(alignment).length > 0) style.alignment = alignment;
            if (Object.keys(fill).length > 0) style.fill = fill;
            if (Object.keys(border).length > 0) style.border = border;

            return style;
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