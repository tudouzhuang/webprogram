Vue.component('record-review-panel', {
    props: {
        recordId: {
            type: [String, Number],
            required: true
        }
    },
    template: `
        <div class="main-panel">
            <div class="content-wrapper">
                
                <!-- 1. 过程记录表主信息 (保持不变) -->
                <div class="card mb-4">
                    <div class="card-body">
                        <div v-if="isLoading" class="text-center p-3"><p>正在加载...</p></div>
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

                <el-row :gutter="20">
                    <!-- 左侧：Luckysheet 只读预览区域 (保持不变) -->
                    <el-col :span="16">
                        <div class="card">
                             <div class="card-body">
                                <h4 class="card-title mb-0">文件预览 (只读)</h4>
                                <hr>
                                <div v-if="!recordInfo || !recordInfo.sourceFilePath" class="text-muted p-5 text-center">此记录没有关联可预览的Excel文件。</div>
                                <div v-else>
                                    <div v-if="isLoadingSheet" class="text-center p-5"><p>正在加载预览文件...</p></div>
                                    <div id="luckysheet-review-container" v-show="!isLoadingSheet" style="width: 100%; height: 80vh;"></div>
                                    <div v-if="loadSheetError" class="alert alert-warning mt-3"><strong>预览失败：</strong> {{ loadSheetError }}</div>
                                </div>
                            </div>
                        </div>
                    </el-col>

                    <!-- 右侧：【核心】可编辑的在线审核模板区域 -->
                    <el-col :span="8">
                        <div class="card">
                            <div class="card-body">
                                <h4 class="card-title">在线审核与批注 (可编辑)</h4>
                                <p class="card-description">可直接在下方表格中填写，完成后点击保存。</p>
                                
                                <div v-if="isLoadingReviewSheet" class="text-center p-5"><p>正在加载审核模板...</p></div>
                                <div id="luckysheet-review-form-container" v-show="!isLoadingReviewSheet" style="width: 100%; height: 70vh;"></div>
                                
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
            isLoadingSheet: false,
            loadSheetError: null,
            
            isLoadingReviewSheet: false,
            isSavingSheet: false,
            reviewTemplateUrl: '/templates/review_template.xlsx'
        }
    },

    methods: {
        // --- 核心数据获取方法 (保持不变) ---
        fetchRecordData() {
            if (!this.recordId) return;
            this.isLoading = true; this.loadError = null;
            axios.get(`/api/process-records/${this.recordId}`)
                .then(response => {
                    this.recordInfo = response.data;
                    if (this.recordInfo && this.recordInfo.sourceFilePath) {
                        this.$nextTick(() => {
                            const fileUrl = '/uploads/' + this.recordInfo.sourceFilePath;
                            this.renderSheetFromUrl(fileUrl, 'luckysheet-review-container', false); // 只读
                        });
                    }
                })
                .catch(error => { this.loadError = "加载过程记录表信息失败"; })
                .finally(() => { this.isLoading = false; });
        },

        // --- Luckysheet 渲染逻辑 (被重构为通用方法) ---
        renderSheetFromUrl(fileUrl, containerId, allowUpdate) {
            const loadingFlag = containerId === 'luckysheet-review-container' ? 'isLoadingSheet' : 'isLoadingReviewSheet';
            const errorFlag = containerId === 'luckysheet-review-container' ? 'loadSheetError' : 'loadReviewSheetError'; // 可以为审核模板也添加一个错误状态
            
            this[loadingFlag] = true;
            this[errorFlag] = null;

            if (!window.LuckyExcel || !window.luckysheet) {
                this[errorFlag] = "Luckysheet核心库未能加载。";
                this[loadingFlag] = false;
                return;
            }

            axios.get(fileUrl, { responseType: 'blob' })
                .then(response => {
                    window.LuckyExcel.transformExcelToLucky(response.data,
                        (exportJson) => {
                            this[loadingFlag] = false;
                            if (!exportJson.sheets || exportJson.sheets.length === 0) {
                                this[errorFlag] = "文件内容为空或无法解析。";
                                return;
                            }
                            // 为了管理多实例，我们在创建前不调用destroy
                            window.luckysheet.create({
                                container: containerId,
                                data: exportJson.sheets, title: exportJson.info.name, lang: 'zh',
                                showtoolbar: allowUpdate, // 根据参数决定是否显示工具栏
                                showinfobar: false, showsheetbar: true,
                                showstatisticBar: false, sheetFormulaBar: false, 
                                allowUpdate: allowUpdate // 根据参数决定是否可编辑
                            });
                        },
                        (error) => {
                            this[loadingFlag] = false;
                            this[errorFlag] = "LuckyExcel转换文件时出错。";
                        }
                    );
                }).catch(error => {
                    this[loadingFlag] = false;
                    this[errorFlag] = "从服务器获取文件失败。";
                });
        },
        
        // --- 【新】加载并渲染右侧可编辑的审核模板 ---
        loadReviewTemplate() {
            this.renderSheetFromUrl(this.reviewTemplateUrl, 'luckysheet-review-form-container', true); // 可编辑
        },

        // --- 【新】保存可编辑审核结果的方法 ---
        saveReviewSheet() {
            if (this.isSavingSheet) return;
            this.isSavingSheet = true;

            // 【关键】获取指定容器的Luckysheet实例数据
            // Luckysheet的API本身不直接支持多实例，这是一个变通方法
            // 我们假设最后创建的实例是我们要操作的
            const allSheetsData = window.luckysheet.getAllSheets();

            window.LuckyExcel.transformLuckyToExcel(
                allSheetsData,
                (exportBlob) => {
                    const formData = new FormData();
                    // 构造一个有意义的文件名
                    const reviewFileName = `ReviewResult_${this.recordInfo.partName}_${this.recordId}.xlsx`;
                    formData.append('file', exportBlob, reviewFileName);
                    
                    const documentType = 'REVIEW_SHEET';
                    // 【重要】文件应该关联到项目ID，而不是记录ID
                    const apiUrl = `/api/projects/${this.recordInfo.projectId}/files/${documentType}`;

                    axios.post(apiUrl, formData)
                        .then((response) => {
                            this.$message.success("在线审核表格已成功保存！");
                            // 可选：更新文件列表，将新保存的审核文件显示出来
                            this.$emit('file-list-updated', response.data);
                        })
                        .catch(error => {
                            this.$message.error("保存在线审核表格失败！");
                        })
                        .finally(() => {
                            this.isSavingSheet = false;
                        });
                },
                (error) => {
                    this.isSavingSheet = false;
                    this.$message.error("导出审核表格时出错！");
                }
            );
        }
    },

    watch: {
        recordId: {
            immediate: true,
            handler(newId) {
                if (newId) {
                    this.fetchRecordData();
                    this.loadReviewTemplate();
                }
            }
        }
    },
    beforeDestroy() {
        // Luckysheet 的 destroy API 会销毁页面上所有实例
        if (window.luckysheet) {
            window.luckysheet.destroy();
        }
    }
});