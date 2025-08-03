Vue.component('record-details-viewer', {
    // 【Props】: 从父组件接收要查看的过程记录ID
    props: {
        recordId: {
            type: [String, Number],
            required: true
        }
    },
    // 【模板】: 完全重构，不再有文件列表，而是直接显示原始文件信息和预览按钮
    template: `
            <div class="content-wrapper" style="width:100%;height:100%">
                <div class="card mb-4">
                    <div class="card-body">
                        <div v-if="isLoading" class="text-center p-3">
                            <p>正在加载过程记录表信息...</p>
                            <el-progress :percentage="100" status="success" :indeterminate="true" :duration="1"></el-progress>
                        </div>
                        <div v-else-if="loadError" class="alert alert-danger">{{ loadError }}</div>
                        <div v-else-if="recordInfo">
                            <!-- 使用 el-descriptions 展示主信息，更美观 -->
                            <el-descriptions title="过程记录表详情" :column="2" border>
                                <el-descriptions-item label="零件名称">{{ recordInfo.partName }}</el-descriptions-item>
                                <el-descriptions-item label="工序名称">{{ recordInfo.processName }}</el-descriptions-item>
                                <el-descriptions-item label="所属项目ID">{{ recordInfo.projectId }}</el-descriptions-item>
                                <el-descriptions-item label="记录创建时间">{{ recordInfo.createdAt }}</el-descriptions-item>
                            </el-descriptions>
                        </div>
                    </div>
                </div>

                <!-- 2. 【核心重构】关联的原始Excel文件预览区域 -->
                <div class="card mb-4">
                    <div class="card-body">
                        <h4 class="card-title">关联的原始Excel文件</h4>
                        <!-- 直接检查 recordInfo.sourceFilePath 是否存在 -->
                        <div v-if="isLoading">加载中...</div>
                        <div v-else-if="recordInfo && recordInfo.sourceFilePath">
                            <p>
                                <strong><i class="el-icon-document"></i> 文件路径:</strong> 
                                <code>/uploads/{{ recordInfo.sourceFilePath }}</code>
                            </p>
                            <el-button size="small" type="success" icon="el-icon-view" @click="togglePreview(true)">
                                在线预览
                            </el-button>
                        </div>
                        <div v-else class="text-muted">
                            此记录表没有关联任何原始Excel文件。
                        </div>
                    </div>
                </div>

                <!-- 3. Luckysheet 预览浮层/区域 -->
                <div v-if="isPreviewing" class="card mt-4">
                     <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center">
                            <h4 class="card-title mb-0">文件预览</h4>
                            <el-button type="info" icon="el-icon-close" @click="togglePreview(false)" circle></el-button>
                        </div>
                        <hr>
                        <div v-if="isLoadingSheet" class="text-center p-5">
                            <p>正在加载和转换预览文件...</p>
                        </div>
                        <div id="luckysheet-record-viewer-container" v-show="!isLoadingSheet" style="width: 100%; height: 80vh;"></div>
                        <div v-if="loadSheetError" class="alert alert-warning mt-3">
                            <strong>预览失败：</strong> {{ loadSheetError }}
                        </div>
                     </div>
                </div>

            </div>
    `,
    
    data() {
        return {
            isLoading: true,       // 控制主信息加载状态
            recordInfo: null,      // 存储从后端获取的过程记录表主信息
            loadError: null,       // 存储加载错误信息
            
            isPreviewing: false,   // 控制Luckysheet预览区域的显示/隐藏
            isLoadingSheet: false, // 控制Luckysheet加载状态
            loadSheetError: null   // 存储Luckysheet加载错误
        }
    },

    methods: {
        /**
         * 核心数据获取方法：只获取过程记录表的主信息。
         */
        fetchRecordData() {
            if (!this.recordId) return;

            this.isLoading = true;
            this.loadError = null;
            
            // 【核心】现在只需要调用一个API，获取过程记录表的详情
            axios.get(`/api/process-records/${this.recordId}`)
                .then(response => {
                    this.recordInfo = response.data;
                    console.log('✅ 【Viewer】成功获取到过程记录表信息:', this.recordInfo);
                })
                .catch(error => {
                    this.loadError = "加载过程记录表信息失败，请刷新重试。";
                    console.error("❌ 【Viewer】获取过程记录表信息失败:", error);
                    this.$message.error("加载数据失败！");
                })
                .finally(() => {
                    this.isLoading = false;
                });
        },

        /**
         * 控制预览区域的显示和隐藏，并在显示时触发渲染
         */
        togglePreview(show) {
             this.isPreviewing = show;
             if (show && this.recordInfo && this.recordInfo.sourceFilePath) {
                 this.$nextTick(() => {
                     // 使用 recordInfo 中的 sourceFilePath 来加载
                     const fileUrl = '/uploads/' + this.recordInfo.sourceFilePath;
                     this.renderSheetFromUrl(fileUrl);
                 });
             } else if (!show) {
                 // 关闭预览时销毁实例
                 if (window.luckysheet) window.luckysheet.destroy();
             }
        },

        /**
         * 使用LuckyExcel从URL加载并渲染Sheet
         */
        renderSheetFromUrl(fileUrl) {
            this.isLoadingSheet = true;
            this.loadSheetError = null;

            if (!window.LuckyExcel || !window.luckysheet) {
                this.loadSheetError = "Luckysheet核心库未能加载。";
                this.isLoadingSheet = false;
                return;
            }

            console.log("【Viewer】准备从URL加载Sheet:", fileUrl);
            axios.get(fileUrl, { responseType: 'blob' })
                .then(response => {
                    window.LuckyExcel.transformExcelToLucky(
                        response.data,
                        (exportJson) => {
                            this.isLoadingSheet = false;
                            if (!exportJson.sheets || exportJson.sheets.length === 0) {
                                this.loadSheetError = "文件内容为空或无法解析。";
                                return;
                            }
                            if (window.luckysheet) window.luckysheet.destroy();
                            
                            window.luckysheet.create({
                                container: 'luckysheet-record-viewer-container',
                                data: exportJson.sheets,
                                title: exportJson.info.name, lang: 'zh',
                                showtoolbar: false, showinfobar: false, showsheetbar: true,
                                showstatisticBar: false, sheetFormulaBar: false, allowUpdate: false
                            });
                        },
                        (error) => {
                            this.isLoadingSheet = false;
                            this.loadSheetError = "LuckyExcel转换文件时出错。";
                            console.error("❌ [LuckyExcel] 转换失败:", error);
                        }
                    );
                }).catch(error => {
                    this.isLoadingSheet = false;
                    this.loadSheetError = "从服务器获取文件失败。";
                    console.error("❌ 【Axios】文件下载失败:", error);
                });
        },
    },

    // --- 生命周期钩子 ---
    watch: {
        // 监听 recordId 的变化，当父组件切换查看的记录时，自动重新加载数据
        recordId: {
            immediate: true, // 组件创建时立即执行一次
            handler(newId) {
                if (newId) {
                    this.fetchRecordData();
                    this.togglePreview(false); // 切换记录时默认关闭预览
                }
            }
        }
    },
    beforeDestroy() {
        // 组件销毁时，确保清理Luckysheet实例
        if (window.luckysheet) {
            window.luckysheet.destroy();
        }
    }
});