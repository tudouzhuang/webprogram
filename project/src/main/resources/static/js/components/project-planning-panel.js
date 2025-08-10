Vue.component('record-review-panel', {
    props: {
        recordId: { type: [String, Number], required: true }
    },
    template: `
    <div class="main-panel" style="width:100%; height:100%">
        <div class="content-wrapper">

            <!-- 1. 项目基础信息显示区域 -->
            <div class="card mb-4">
                <div class="card-body">
                    <div v-if="isLoading" class="text-center p-3">
                        <p>正在加载项目信息...</p>
                        <el-progress :percentage="100" status="success" :indeterminate="true" :duration="1"></el-progress>
                    </div>
                    <div v-else-if="loadError" class="alert alert-danger">{{ loadError }}</div>
                    <div v-else-if="projectInfo">
                        <el-descriptions title="项目基本信息" :column="1" border>
                            <el-descriptions-item label="项目号">{{ projectInfo.projectNumber }}</el-descriptions-item>
                        </el-descriptions>
                    </div>
                </div>
            </div>

            <!-- 2. 设计策划书管理区域 -->
            <div class="card">
                <div class="card-body">
                    <h4 class="card-title">设计策划书管理</h4>
                    <p class="card-description">
                        项目设计前期的核心策划文档。
                        <span v-if="canEdit" class="text-success">（您是管理员，拥有编辑权限）</span>
                        <span v-else class="text-primary">（您是普通用户，只读权限）</span>
                    </p>
                    
                    <div v-if="planningDocument">
                        <p>
                            <strong><i class="el-icon-document"></i> 当前文件:<> {{ planningDocument.fileName }}
                        </p>
                        <el-button size="small" type="success" icon="el-icon-view" @click="previewFile(planningDocument)">
                            预览策划书
                        </el-button>
                        <el-button v-if="canEdit" size="small" type="danger" icon="el-icon-delete" @click="deleteFile(planningDocument)">
                            删除并替换
                        </el-button>
                    </div>

                    <div v-else>
                         <p class="text-muted">暂未上传设计策划书。</p>
                        <el-upload
                            v-if="canEdit"
                            class="mt-2"
                            action="#" 
                            :http-request="handleFileUpload"
                            :show-file-list="false"
                            :before-upload="beforeUpload">
                            <el-button size="small" type="primary" icon="el-icon-upload">
                                上传新的策划书
                            </el-button>
                            <div slot="tip" class="el-upload__tip">只能上传 .xlsx 或 .xls 格式的Excel文件</div>
                        </el-upload>
                    </div>
                </div>
            </div>

            <!-- 3. Luckysheet 预览区域 -->
            <div v-if="isPreviewing" class="card mt-4">
                 <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <h4 class="card-title mb-0">文件预览: {{ previewingFileName }}</h4>
                        <el-button type="info" icon="el-icon-close" @click="closePreview" circle></el-button>
                    </div>
                    <hr>
                    <div v-if="isLoadingSheet" class="text-center p-5">
                        <p>正在加载和转换预览文件...</p>
                        <el-progress :percentage="100" status="success" :indeterminate="true" :duration="2"></el-progress>
                    </div>
                    <div id="luckysheet-planning-container" v-show="!isLoadingSheet" style="width: 100%; height: 80vh;"></div>
                    <div v-if="loadSheetError" class="alert alert-warning mt-3">
                        <strong>预览失败：<> {{ loadSheetError }}
                    </div>
                 </div>
            </div>

        </div>
    </div>
`,
    
    data() {
        return {
            isLoading: true,
            recordInfo: null, // 存储主信息
            reviewSheetInfo: null, // 【新增】存储已保存的审核表信息
            loadError: null,
            isSavingSheet: false,
            reviewTemplateUrl: '/templates/review_template.xlsx',
            previewIframeLoaded: false,
            reviewIframeLoaded: false,
        }
    },

    methods: {
        // --- 核心数据获取方法 ---
        fetchData() {
            if (!this.recordId) return;
            this.isLoading = true;
            this.loadError = null;
            this.reviewSheetInfo = null; // 重置

            // 使用 Promise.allSettled 来并行获取所有数据，无论成功失败
            Promise.allSettled([
                axios.get(`/api/process-records/${this.recordId}`),
                axios.get(`/api/process-records/${this.recordId}/review-sheet-info`)
            ]).then(([recordResult, reviewSheetResult]) => {
                
                // 处理主信息获取结果
                if (recordResult.status === 'fulfilled') {
                    this.recordInfo = recordResult.value.data;
                    console.log('✅ 【ReviewPanel】获取到主信息:', this.recordInfo);
                    // 如果预览iframe已加载，立即加载
                    if (this.previewIframeLoaded) this.loadPreviewSheet();
                } else {
                    this.loadError = "加载过程记录表信息失败。";
                    console.error("❌ 【ReviewPanel】获取主信息失败:", recordResult.reason);
                }

                // 处理审核表信息获取结果
                if (reviewSheetResult.status === 'fulfilled') {
                    this.reviewSheetInfo = reviewSheetResult.value.data;
                    console.log('✅ 【ReviewPanel】已找到保存的审核表:', this.reviewSheetInfo);
                } else {
                    console.log("ℹ️ 【ReviewPanel】未找到已保存的审核表，将使用默认模板。");
                }

            }).finally(() => {
                this.isLoading = false;
                // 无论成功失败，只要审核iframe加载完成，就尝试加载它
                if (this.reviewIframeLoaded) this.loadReviewSheet();
            });
        },
        
        // --- Iframe加载完成后的回调函数 ---
        onPreviewIframeLoad() {
            console.log("【ReviewPanel】左侧预览iframe已加载完成。");
            this.previewIframeLoaded = true;
            if (this.recordInfo) this.loadPreviewSheet();
        },
        onReviewIframeLoad() {
            console.log("【ReviewPanel】右侧审核iframe已加载完成。");
            this.reviewIframeLoaded = true;
            // 如果数据获取流程已结束（isLoading为false），就加载
            if (!this.isLoading) this.loadReviewSheet();
        },
        
        // --- 具体的加载方法 ---
        loadPreviewSheet() {
            if (this.recordInfo && this.recordInfo.sourceFilePath) {
                this.sendMessageToIframe(this.$refs.previewIframe, {
                    type: 'LOAD_SHEET_FROM_URL',
                    payload: {
                        fileUrl: '/uploads/' + this.recordInfo.sourceFilePath,
                        options: { lang: 'zh', showtoolbar: false, showinfobar: false, allowUpdate: false, showsheetbar: true }
                    }
                });
            }
        },
        loadReviewSheet() {
            let urlToLoad;
            // 【核心逻辑】根据 reviewSheetInfo 是否存在来决定URL
            if (this.reviewSheetInfo) {
                // 如果找到了已保存的审核表，使用它的静态资源访问路径
                urlToLoad = '/uploads/' + this.reviewSheetInfo.filePath;
            } else {
                // 否则，使用默认模板的静态资源路径
                urlToLoad = this.reviewTemplateUrl;
            }
            
            console.log("【ReviewPanel】准备加载右侧审核表, URL:", urlToLoad);
            this.sendMessageToIframe(this.$refs.reviewIframe, {
                type: 'LOAD_SHEET_FROM_URL',
                payload: {
                    fileUrl: urlToLoad,
                    options: { lang: 'zh', allowUpdate: true, showtoolbar: true, showsheetbar: true }
                }
            });
        },
        
        // --- 保存和消息处理逻辑 (保持不变) ---
        saveReviewSheet() { /* ... */ },
        sendMessageToIframe(iframe, message) { /* ... */ },
        messageEventListener(event) { /* ... */ },
        convertLuckyToSheetJS(luckySheets) { /* ... */ },
    },

    // --- 生命周期钩子和watch (保持不变) ---
    mounted() {
        window.addEventListener('message', this.messageEventListener);
    },
    beforeDestroy() {
        window.removeEventListener('message', this.messageEventListener);
        this.sendMessageToIframe(this.$refs.previewIframe, { type: 'DESTROY' });
        this.sendMessageToIframe(this.$refs.reviewIframe, { type: 'DESTROY' });
    },
    watch: {
        recordId: {
            immediate: true,
            handler(newId) {
                if (newId) this.fetchData();
            }
        }
    }
});