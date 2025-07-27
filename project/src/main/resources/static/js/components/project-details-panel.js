Vue.component('project-details-panel', {
    props: {
        projectId: {
            type: [String, Number],
            default: null
        }
    },

    template: `
            <div class="content-wrapper" style="width:100%;height:100%">
                
                <!-- 1. 顶部项目详细信息展示卡片 -->
                <div class="card mb-4">
                    <div class="card-body">
                        <h4 class="card-title">项目详情与文件预览</h4>
                        
                        <div v-if="isLoadingInfo" class="text-center p-3">
                            <p>正在加载项目详细信息...</p>
                            <el-progress :percentage="100" status="success" :indeterminate="true" :duration="1"></el-progress>
                        </div>
                        <div v-else-if="loadInfoError" class="alert alert-danger">
                            {{ loadInfoError }}
                        </div>

                        <div v-else-if="projectInfo" class="project-details">
                            <el-descriptions title="基础信息" :column="2" border>
                                <el-descriptions-item label="项目号">{{ projectInfo.projectNumber }}</el-descriptions-item>
                                <el-descriptions-item label="产品名">{{ projectInfo.productName }}</el-descriptions-item>
                                <el-descriptions-item label="零件号">{{ projectInfo.partNumber }}</el-descriptions-item>
                                <el-descriptions-item label="客户名称">{{ projectInfo.customerName }}</el-descriptions-item>
                                <el-descriptions-item label="制件材质">{{ projectInfo.material }}</el-descriptions-item>
                                <el-descriptions-item label="制件料厚">{{ projectInfo.thickness }} mm</el-descriptions-item>
                                <el-descriptions-item label="工序号-工序内容">{{ projectInfo.process }}</el-descriptions-item>
                                <el-descriptions-item label="抗拉强度">{{ projectInfo.tensileStrength }} MPa</el-descriptions-item>
                                <el-descriptions-item label="使用设备 (主线)">{{ projectInfo.equipment }}</el-descriptions-item>
                                <el-descriptions-item label="模具图号">{{ projectInfo.moldDrawingNumber }}</el-descriptions-item>
                            </el-descriptions>

                            <el-descriptions title="人员信息" :column="2" border class="mt-4">
                                <el-descriptions-item label="设计人员">{{ projectInfo.designerName }}</el-descriptions-item>
                                <el-descriptions-item label="设计日期">{{ formatDate(projectInfo.designerDate) }}</el-descriptions-item>
                                <el-descriptions-item label="校对人员">{{ projectInfo.checkerName || 'N/A' }}</el-descriptions-item>
                                <el-descriptions-item label="校对日期">{{ formatDate(projectInfo.checkerDate) || 'N/A' }}</el-descriptions-item>
                                <el-descriptions-item label="审核人员">{{ projectInfo.auditorName || 'N/A' }}</el-descriptions-item>
                                <el-descriptions-item label="审核日期">{{ formatDate(projectInfo.auditorDate) || 'N/A' }}</el-descriptions-item>
                            </el-descriptions>
                            
                            <el-descriptions title="尺寸与重量" :column="2" border class="mt-4">
                                <el-descriptions-item label="报价 尺寸">{{ projectInfo.quoteLength }} x {{ projectInfo.quoteWidth }} x {{ projectInfo.quoteHeight }} mm</el-descriptions-item>
                                <el-descriptions-item label="报价 重量">{{ projectInfo.quoteWeight }} T</el-descriptions-item>
                                <el-descriptions-item label="实际 尺寸">{{ projectInfo.actualLength }} x {{ projectInfo.actualWidth }} x {{ projectInfo.actualHeight }} mm</el-descriptions-item>
                                <el-descriptions-item label="实际 重量">{{ projectInfo.actualWeight }} T</el-descriptions-item>
                            </el-descriptions>
                        </div>
                    </div>
                </div>

                <!-- 2. Luckysheet 渲染区域 -->
                <div v-if="isLoadingSheet" class="text-center p-5">
                    <p>{{ loadingSheetMessage }}</p>
                    <el-progress v-if="loadingSheetMessage.includes('加载')" :percentage="100" status="success" :indeterminate="true" :duration="2"></el-progress>
                </div>

                <div 
                    id="luckysheet-viewer-container" 
                    v-show="!isLoadingSheet && !loadSheetError" 
                    style="width: 100%; height: 80vh; border: 1px solid #ddd;">
                </div>
                <div v-if="loadSheetError" class="alert alert-warning mt-3">
                    <strong>文件预览失败：</strong> {{ loadSheetError }}
                </div>

            </div>
    `,
    
    /**
     * 【Data】
     * 组件的内部状态。
     */
    data() {
        return {
            isLoadingInfo: false,
            isLoadingSheet: false,
            loadingSheetMessage: '',
            projectInfo: null,
            loadInfoError: null,
            loadSheetError: null
        }
    },

    /**
     * 【Methods】
     * 组件的所有方法。
     */
    methods: {
        /**
         * 核心方法：获取所有数据。
         */
        fetchAllData() {
            if (!this.projectId) {
                this.resetState();
                return;
            }

            this.resetState();
            this.isLoadingInfo = true;
            this.isLoadingSheet = true;
            this.loadingSheetMessage = '正在获取项目文件信息...';

            Promise.all([
                axios.get(`/api/projects/${this.projectId}`),
                axios.get(`/api/projects/${this.projectId}/files`)
            ]).then(([projectResponse, filesResponse]) => {
                this.projectInfo = projectResponse.data;
                this.isLoadingInfo = false;

                const files = filesResponse.data;
                if (!files || files.length === 0) throw new Error("该项目没有关联任何文件。");
                
                const excelFile = files.find(f => f.fileName && f.fileName.startsWith('source_'));
                if (!excelFile) throw new Error("在文件列表中找不到原始Excel文件。");
                
                const fileUrl = `/api/files/content/${excelFile.id}`; 
                this.loadingSheetMessage = '文件信息获取成功，正在加载和转换Excel...';
                
                this.renderSheetFromUrl(fileUrl);
            }).catch(error => {
                this.isLoadingInfo = false;
                this.isLoadingSheet = false;
                const errorMessage = (error.response && error.response.data) ? error.response.data : error.message;
                this.loadInfoError = `加载项目数据失败: ${errorMessage}`;
            });
        },
        
        /**
         * 核心渲染方法：使用axios获取文件Blob，然后用LuckyExcel渲染。
         */
        renderSheetFromUrl(fileUrl) {
            console.log("【子组件】准备从URL加载Sheet:", fileUrl);
            
            if (!window.LuckyExcel || !window.luckysheet) {
                this.loadSheetError = "Luckysheet 核心库未能成功加载。";
                this.isLoadingSheet = false;
                return;
            }

            // 使用axios获取文件流，并指定响应类型为 'blob'
            axios.get(fileUrl, {
                responseType: 'blob' 
            }).then(response => {
                const fileBlob = response.data;
                
                window.LuckyExcel.transformExcelToLucky(
                    fileBlob, // 将获取到的 Blob 对象传给 LuckyExcel
                    (exportJson, luckysheetfile) => {
                        this.isLoadingSheet = false;
                        
                        if (!exportJson.sheets || exportJson.sheets.length === 0) {
                            this.loadSheetError = "文件成功加载，但内容为空或无法解析。";
                            return;
                        }
                        if (window.luckysheet) window.luckysheet.destroy();
                        
                        // =======================================================
                        // 【核心】: 补全 luckysheet.create 的完整配置
                        // =======================================================
                        window.luckysheet.create({
                            container: 'luckysheet-viewer-container',
                            data: exportJson.sheets,
                            title: exportJson.info.name,
                            lang: 'zh',
                            // --- UI精简配置 ---
                            showtoolbar: false,
                            showinfobar: false,
                            showsheetbar: true,
                            showstatisticBar: false,
                            sheetFormulaBar: false,
                            // --- 功能限制配置 ---
                            allowUpdate: false
                        });
                        
                        console.log("【子组件】Luckysheet 渲染成功！");
                    },
                    (error) => {
                        this.isLoadingSheet = false;
                        this.loadSheetError = "LuckyExcel转换文件时发生错误，可能是文件格式问题。";
                        console.error("[LuckyExcel] 文件转换失败:", error);
                    }
                );
            }).catch(error => {
                this.isLoadingSheet = false;
                this.loadSheetError = "从后端API获取Excel文件流失败，请检查网络或后端API。";
                console.error("【Axios】文件下载失败:", error);
            });
        },

        /**
         * 辅助方法：格式化日期。
         */
        formatDate(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            return date.toLocaleDateString(); 
        },

        /**
         * 辅助方法：重置组件的所有状态。
         */
        resetState() {
            this.isLoadingInfo = false;
            this.isLoadingSheet = false;
            this.projectInfo = null;
            this.loadInfoError = null;
            this.loadSheetError = null;
            this.loadingSheetMessage = '';
            if (window.luckysheet) {
                window.luckysheet.destroy();
            }
        }
    },

    /**
     * 【生命周期钩子】
     */
    mounted() {
        console.log("【子组件】project-details-panel 已挂载，初始 projectId:", this.projectId);
        this.fetchAllData();
    },
    beforeDestroy() {
        console.log("【子组件】project-details-panel 即将被销毁，清理资源...");
        this.resetState();
    },

    /**
     * 【Watch 监听器】
     */
    watch: {
        projectId(newId, oldId) {
            console.log(`【子组件】检测到 projectId 从 ${oldId} 变为 ${newId}`);
            if (newId && newId !== oldId) {
                this.fetchAllData();
            }
        }
    }
});