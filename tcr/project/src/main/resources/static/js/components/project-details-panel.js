Vue.component('project-details-panel', {
    // 【新增】: 通过 props 接收父组件传递过来的 projectId
    props: {
        projectId: {
            type: [Number, String],
            required: true
        }
    },
    // 【模板重构】: 融合了项目信息展示和 Luckysheet 容器
    template: `
            <div class="content-wrapper" style="width:100%;height:100%">
                
                <!-- 1. 项目详细信息展示区域 (保留) -->
                <div class="card mb-4">
                    <div class="card-body">
                        <!-- 使用 v-if="projectInfo" 确保在数据加载完成前不显示 -->
                        <el-descriptions v-if="projectInfo" title="项目详细信息" :column="4" border>
                            <el-descriptions-item label="项目号">{{ projectInfo.projectNumber }}</el-descriptions-item>
                            <el-descriptions-item label="产品名">{{ projectInfo.productName }}</el-descriptions-item>
                            <el-descriptions-item label="客户名称" :span="2">{{ projectInfo.customerName }}</el-descriptions-item>
                            <!-- ... 可以添加更多项目信息的展示 ... -->
                        </el-descriptions>
                        <div v-else>正在加载项目信息...</div>
                    </div>
                </div>

                <!-- 2. Luckysheet 预览区域 (替换原来的图片预览) -->
                <div class="card">
                    <div class="card-body">
                         <h4 class="card-title">关联文件预览</h4>
                         <!-- 加载状态提示 -->
                         <div v-if="isLoading" class="text-center p-5">
                            <p>{{ loadingMessage }}</p>
                            <el-progress :percentage="100" status="success" :indeterminate="true" :duration="2"></el-progress>
                        </div>
                        <!-- Luckysheet 渲染容器 -->
                        <div 
                            id="luckysheet-container" 
                            v-show="!isLoading" 
                            style="width: 100%; height: 80vh; border: 1px solid #ddd;">
                        </div>
                    </div>
                </div>

            </div>
    `,
    
    data() {
        return {
            isLoading: true,
            loadingMessage: '正在加载项目信息...',
            projectInfo: null, // 用于存储项目的基础信息
        }
    },
    methods: {
        // 【核心方法】: 获取项目数据并加载 Luckysheet
        initializePanel() {
            if (!this.projectId) {
                this.$message.error("未提供项目ID。");
                return;
            }

            this.isLoading = true;
            this.loadingMessage = '正在获取项目信息...';

            // 【第一步】: 并行获取项目信息和文件列表
            const projectInfoRequest = axios.get(`/api/projects/${this.projectId}`);
            const filesRequest = axios.get(`/api/projects/${this.projectId}/files`);

            Promise.all([projectInfoRequest, filesRequest])
                .then(([projectResponse, filesResponse]) => {
                    // a. 处理项目信息
                    this.projectInfo = projectResponse.data;

                    // b. 处理文件列表，找到原始Excel文件
                    const files = filesResponse.data;
                    if (!files || files.length === 0) {
                        throw new Error("该项目没有关联的Excel文件。");
                    }
                    const excelFile = files.find(f => f.fileName.startsWith('source_'));
                    if (!excelFile) {
                        throw new Error("在文件列表中找不到原始Excel文件。");
                    }
                    if (!excelFile.id) {
                        this.$message.error("文件对象中缺少ID，无法生成预览链接！");
                        return;
                    }
                    const excelFileUrl = `/api/files/preview/project-file/${excelFile.id}`; // ⬅️ 指向我们新增的预览接口
                    
                    this.loadingMessage = `正在加载文件: ${excelFile.fileName.replace('source_', '')}`;
                    
                    // d. 调用渲染方法
                    this.renderSheetFromUrl(excelFileUrl);
                })
                .catch(error => {
                    this.isLoading = false;
                    console.error("初始化面板失败:", error);
                    this.$message.error(error.message || "加载项目数据失败！");
                });
        },
        
        // Luckysheet 渲染逻辑 (基本不变)
        renderSheetFromUrl(fileUrl) {
            if (!window.LuckyExcel || !window.luckysheet) {
                this.$message.error("Luckysheet 库未能成功加载。");
                this.isLoading = false;
                return;
            }
        
            this.$nextTick(() => {
                axios.get(fileUrl, { responseType: 'arraybuffer' }) // ⬅️ 使用 ArrayBuffer 读取
                    .then(response => {
                        const arrayBuffer = response.data;
        
                        window.LuckyExcel.transformExcelToLucky(
                            arrayBuffer, // ⬅️ 注意传的是二进制内容
                            (exportJson, luckysheetfile) => {
                                this.isLoading = false;
        
                                if (!exportJson.sheets || exportJson.sheets.length === 0) {
                                    this.$message.error("文件读取失败或内容为空！");
                                    return;
                                }
        
                                if (window.luckysheet) {
                                    window.luckysheet.destroy();
                                }
        
                                window.luckysheet.create({
                                    container: 'luckysheet-container',
                                    data: exportJson.sheets,
                                    title: exportJson.info.name,
                                    lang: 'zh',
                                    allowUpdate: false,
                                    showtoolbar: true,
                                    showinfobar: false,
                                    showsheetbar: true
                                });
        
                                this.$message.success("文件预览加载成功！");
                            },
                            (error) => {
                                this.isLoading = false;
                                console.error("[LuckyExcel] 文件转换失败:", error);
                                this.$message.error("加载或转换Excel文件时发生错误。");
                            }
                        );
                    })
                    .catch(error => {
                        this.isLoading = false;
                        console.error("[Axios] 文件下载失败:", error);
                        this.$message.error("无法下载 Excel 文件！");
                    });
            });
        },
        
    },
    // 【生命周期钩子】: 监听 projectId 的变化，如果ID变了，就重新加载数据
    watch: {
        projectId: {
            immediate: true, // 组件一创建就立即执行
            handler(newId, oldId) {
                if (newId) {
                    this.initializePanel();
                }
            }
        }
    },
    beforeDestroy() {
        // 组件销毁前，清理 Luckysheet 实例
        if (window.luckysheet) {
            window.luckysheet.destroy();
        }
    }
});