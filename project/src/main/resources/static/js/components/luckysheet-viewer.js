Vue.component('luckysheet-viewer', {
    // 【新增】: 通过 props 接收父组件传递过来的 projectId
    props: {
        projectId: {
            type: [String, Number],
            required: true
        }
    },
    // 【模板】: 完全重构，增加了详细的项目信息展示区域
    template: `
        <div class="main-panel">
            <div class="content-wrapper">
                
                <!-- 1. 顶部项目详细信息展示卡片 -->
                <div class="card mb-4">
                    <div class="card-body">
                        <h4 class="card-title">项目详情与文件预览</h4>
                        
                        <!-- 加载中或加载失败的提示 -->
                        <div v-if="isLoadingInfo" class="text-center p-3">
                            <p>正在加载项目详细信息...</p>
                            <el-progress :percentage="100" status="success" :indeterminate="true" :duration="1"></el-progress>
                        </div>
                        <div v-else-if="loadInfoError" class="alert alert-danger">
                            {{ loadInfoError }}
                        </div>

                        <!-- 项目信息展示区域 -->
                        <div v-else-if="projectInfo" class="project-details">
                            <!-- 使用 el-descriptions 组件美化展示 -->
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
                    <el-progress :percentage="100" status="success" :indeterminate="true" :duration="2"></el-progress>
                </div>

                <div 
                    id="luckysheet-viewer-container" 
                    v-show="!isLoadingSheet" 
                    style="width: 100%; height: 80vh; border: 1px solid #ddd;">
                </div>

            </div>
        </div>
    `,
    
    data() {
        return {
            isLoadingInfo: true,      // 控制项目信息加载状态
            isLoadingSheet: true,     // 控制Luckysheet加载状态
            loadingSheetMessage: '正在初始化预览器...',
            projectInfo: null,        // 存储项目的基础信息
            loadInfoError: null       // 存储加载信息时的错误
        }
    },
    methods: {
        // 【核心方法】: 根据 projectId 获取所有数据并加载
        fetchAllData() {
            if (!this.projectId) {
                this.loadInfoError = "错误：未提供项目ID。";
                this.isLoadingInfo = false;
                this.isLoadingSheet = false;
                return;
            }

            // 重置状态
            this.isLoadingInfo = true;
            this.isLoadingSheet = true;
            this.loadInfoError = null;
            this.projectInfo = null;
            this.loadingSheetMessage = '正在获取项目文件信息...';

            // 【第一步】: 并行获取项目信息和文件列表
            Promise.all([
                axios.get(`/api/projects/${this.projectId}`),
                axios.get(`/api/projects/${this.projectId}/files`)
            ]).then(([projectResponse, filesResponse]) => {
                
                // 处理项目信息
                this.projectInfo = projectResponse.data;
                this.isLoadingInfo = false;

                // 处理文件列表
                const files = filesResponse.data;
                if (!files || files.length === 0) {
                    throw new Error("该项目没有关联的Excel文件。");
                }
                
                // 查找原始Excel文件 (以 source_ 开头)
                const excelFile = files.find(f => f.fileName && f.fileName.startsWith('source_'));
                if (!excelFile) {
                     throw new Error("在文件列表中找不到原始Excel文件(文件名需以'source_'开头)。");
                }
                
                // 【第二步】: 构建文件URL并开始渲染Sheet
                const fileUrl = `/api/files/preview/${excelFile.id}`;
                this.loadingSheetMessage = '文件信息获取成功，正在加载和转换Excel...';
                this.renderSheetFromUrl(fileUrl);

            }).catch(error => {
                this.isLoadingInfo = false;
                this.isLoadingSheet = false;
                const errorMessage = error.response ? error.response.data : error.message;
                this.loadInfoError = `加载项目数据失败: ${errorMessage}`;
                console.error("获取项目数据失败:", error);
                this.$message.error(this.loadInfoError);
            });
        },
        
        // 核心的渲染逻辑
        renderSheetFromUrl(fileUrl) {
            // ... (这个方法的内部逻辑保持不变，它已经很完善了) ...
            if (!window.LuckyExcel || !window.luckysheet) {
                this.$message.error("Luckysheet 库未能成功加载。");
                this.isLoadingSheet = false;
                return;
            }
            
            this.$nextTick(() => {
                window.LuckyExcel.transformExcelToLucky(
                    fileUrl,
                    (exportJson, luckysheetfile) => {
                        this.isLoadingSheet = false;
                        if (!exportJson.sheets || exportJson.sheets.length === 0) {
                            this.$message.error("文件读取失败或内容为空！");
                            return;
                        }
                        if (window.luckysheet) window.luckysheet.destroy();
                        
                        window.luckysheet.create({
                            container: 'luckysheet-viewer-container',
                            data: exportJson.sheets,
                            title: exportJson.info.name,
                            lang: 'zh',
                            showtoolbar: false,
                            showinfobar: false,
                            showsheetbar: true,
                            showstatisticBar: false,
                            sheetFormulaBar: false,
                            allowUpdate: false
                        });
                        
                        this.$message.success("Excel文件加载渲染成功！");
                    },
                    (error) => {
                        this.isLoadingSheet = false;
                        console.error("[LuckyExcel] 文件转换失败:", error);
                        this.$message.error("加载或转换Excel文件时发生错误。");
                    }
                );
            });
        },

        // 【新增】辅助方法：格式化日期
        formatDate(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            return date.toLocaleDateString();
        }
    },
    // 【生命周期钩子】: 当组件被创建时，立即开始获取数据
    mounted() {
        this.fetchAllData();
    },
    // 【监听】: 当 projectId 变化时 (例如用户在列表中切换了不同的项目)，重新加载所有数据
    watch: {
        projectId(newId, oldId) {
            if (newId && newId !== oldId) {
                this.fetchAllData();
            }
        }
    },
    beforeDestroy() {
        if (window.luckysheet) {
            window.luckysheet.destroy();
        }
    }
});