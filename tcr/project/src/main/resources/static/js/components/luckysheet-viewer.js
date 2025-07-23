Vue.component('luckysheet-viewer', {
    // 【新增】: 通过 props 接收父组件传递过来的 projectId
    props: {
        projectId: {
            type: [String, Number], // projectId可以是字符串或数字
            required: true // 设为必需，确保父组件必须传递这个值
        }
    },
    // 【模板】: 移除了文件选择的UI，改为显示项目信息和加载状态
    template: `
        <div class="main-panel">
            <div class="content-wrapper">
                
                <!-- 1. 顶部信息栏 -->
                <div class="card mb-4">
                    <div class="card-body">
                        <h4 class="card-title">项目文件预览</h4>
                        <p v-if="projectInfo" class="card-description">
                            正在预览项目 <strong>{{ projectInfo.projectNumber }}</strong> ({{ projectInfo.productName }}) 的关联文件。
                        </p>
                        <p v-else class="card-description">
                            正在加载项目信息...
                        </p>
                    </div>
                </div>

                <!-- 2. Luckysheet 渲染区域 -->
                <div v-if="isLoading" class="text-center p-5">
                    <p>{{ loadingMessage }}</p>
                    <el-progress :percentage="100" status="success" :indeterminate="true" :duration="2"></el-progress>
                </div>

                <div 
                    id="luckysheet-viewer-container" 
                    v-show="!isLoading" 
                    style="width: 100%; height: 80vh; border: 1px solid #ddd;">
                </div>

            </div>
        </div>
    `,
    
    data() {
        return {
            isLoading: true, // 初始为加载状态
            loadingMessage: '正在加载项目文件信息...',
            projectInfo: null,  // 用于存储项目的基础信息
            excelFileUrl: ''    // 用于存储要加载的Excel文件的URL
        }
    },
    methods: {
        // 【核心方法】: 根据 projectId 获取数据并加载表格
        fetchDataAndLoadSheet() {
            if (!this.projectId) {
                this.$message.error("未提供项目ID，无法加载文件。");
                this.isLoading = false;
                return;
            }

            this.isLoading = true;
            this.loadingMessage = '正在获取项目文件信息...';

            // 【第一步】: 调用后端API，获取项目关联的文件列表
            // 我们需要从文件列表中找到那个原始的 .xlsx 文件
            axios.get(`/api/projects/${this.projectId}/files`)
                .then(response => {
                    const files = response.data;
                    if (!files || files.length === 0) {
                        throw new Error("该项目没有关联的Excel文件。");
                    }
                    
                    // 假设第一个文件就是我们要找的原始Excel文件
                    // 你也可以根据文件名 (比如以 "source_" 开头) 来查找
                    const excelFile = files.find(f => f.fileName.startsWith('source_'));
                    if (!excelFile) {
                         throw new Error("在文件列表中找不到原始Excel文件。");
                    }
                    
                    // 【第二步】: 构建可供Luckysheet加载的完整文件URL
                    // 这个URL指向 FileController 提供的文件下载接口
                    this.excelFileUrl = `/api/files/download/project-excel/${this.projectId}`;
                    this.loadingMessage = '文件信息获取成功，正在加载和转换Excel...';
                    
                    // 【第三步】: 调用渲染方法
                    this.renderSheetFromUrl(this.excelFileUrl);
                    
                    // (可选) 同时获取项目的基础信息用于显示
                    this.fetchProjectInfo();

                })
                .catch(error => {
                    this.isLoading = false;
                    console.error("获取项目文件列表失败:", error);
                    this.$message.error(error.message || "获取项目文件列表失败！");
                });
        },
        
        // (可选) 获取项目基础信息
        fetchProjectInfo() {
            axios.get(`/api/projects/${this.projectId}`)
                .then(response => {
                    this.projectInfo = response.data;
                });
        },

        // 核心的渲染逻辑 (现在从URL加载)
        renderSheetFromUrl(fileUrl) {
            if (!window.LuckyExcel || !window.luckysheet) {
                this.$message.error("Luckysheet 库未能成功加载。");
                this.isLoading = false;
                return;
            }
            
            this.$nextTick(() => {
                window.LuckyExcel.transformExcelToLucky(
                    fileUrl, // 【关键】这里传入的是从后端API获取的URL
                    (exportJson, luckysheetfile) => {
                        this.isLoading = false;
                        
                        if (!exportJson.sheets || exportJson.sheets.length === 0) {
                            this.$message.error("文件读取失败或内容为空！");
                            return;
                        }

                        if (window.luckysheet) {
                            window.luckysheet.destroy();
                        }

                        // 使用精简UI配置创建 Luckysheet
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
                        this.isLoading = false;
                        console.error("[LuckyExcel] 文件转换失败:", error);
                        this.$message.error("加载或转换Excel文件时发生错误。");
                    }
                );
            });
        },
    },
    // 【生命周期钩子】: 当组件被创建时，立即开始获取数据
    mounted() {
        this.fetchDataAndLoadSheet();
    },
    // 【新增】: 监听 projectId 的变化，如果ID变了，就重新加载数据
    watch: {
        projectId(newId, oldId) {
            if (newId !== oldId) {
                this.fetchDataAndLoadSheet();
            }
        }
    },
    beforeDestroy() {
        if (window.luckysheet) {
            window.luckysheet.destroy();
        }
    }
});