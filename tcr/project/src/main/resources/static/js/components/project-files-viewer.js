Vue.component('project-files-viewer', {
    props: {
        projectId: {
            type: [Number, String],
            required: true
        }
    },
    template: `
        <div class="content-wrapper">
            <!-- ======================================================= -->
            <!--   ↓↓↓  【核心新增】项目表头信息显示区域  ↓↓↓   -->
            <!-- ======================================================= -->
            <div class="row mb-4">
                <div class="col-12">
                    <div class="card">
                        <div class="card-body">
                            <!-- 使用 Element UI 的 Descriptions 组件来展示键值对信息 -->
                            <el-descriptions class="margin-top" title="项目详细信息" :column="4" border>
                                <!-- 我们使用 v-if="projectInfo.projectNumber" 来确保在数据加载完成前不显示 -->

                                <!-- 遍历 projectInfo 对象来动态生成描述项，是一种更高级的写法 -->
                                <!-- 但为了清晰，我们这里逐一列出 -->
                                
                                <el-descriptions-item label="项目号">{{ projectInfo.projectNumber }}</el-descriptions-item>
                                <el-descriptions-item label="产品名">{{ projectInfo.productName }}</el-descriptions-item>
                                <el-descriptions-item label="客户名称">{{ projectInfo.customerName }}</el-descriptions-item>
                                <el-descriptions-item label="零件号">{{ projectInfo.partNumber }}</el-descriptions-item>
                                
                                <el-descriptions-item label="制件材质">{{ projectInfo.material }}</el-descriptions-item>
                                <el-descriptions-item label="制件料厚 (mm)">{{ projectInfo.thickness }}</el-descriptions-item>
                                <el-descriptions-item label="抗拉强度 (MPa)">{{ projectInfo.tensileStrength }}</el-descriptions-item>
                                <el-descriptions-item label="使用设备">{{ projectInfo.equipment }}</el-descriptions-item>
                                
                                <el-descriptions-item label="工序内容" :span="4">{{ projectInfo.process }}</el-descriptions-item>
                                <el-descriptions-item label="模具图号" :span="4">{{ projectInfo.moldDrawingNumber }}</el-descriptions-item>

                                <el-descriptions-item label="设计人员">{{ projectInfo.designerName }}</el-descriptions-item>
                                <el-descriptions-item label="设计日期">{{ projectInfo.designerDate }}</el-descriptions-item>
                                <el-descriptions-item label="校对人员">{{ projectInfo.checkerName || 'N/A' }}</el-descriptions-item>
                                <el-descriptions-item label="校对日期">{{ projectInfo.checkerDate || 'N/A' }}</el-descriptions-item>
                                
                                <el-descriptions-item label="审核人员">{{ projectInfo.auditorName || 'N/A' }}</el-descriptions-item>
                                <el-descriptions-item label="审核日期">{{ projectInfo.auditorDate || 'N/A' }}</el-descriptions-item>
                                
                            </el-descriptions>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 第一行：文件列表 (原来的第一行) -->
            <div class="row">
                <div class="col-12">
                    <div class="card">
                        <div class="card-body">
                            <h4 class="card-title">文件列表</h4>
                            <div class="list-group list-group-horizontal-md" style="overflow-x: auto;">
                                <a href="javascript:void(0)" 
                                   v-for="file in fileList" 
                                   :key="file.id"
                                   class="list-group-item list-group-item-action text-nowrap"
                                   :class="{ 'active': selectedFile && selectedFile.id === file.id }"
                                   @click="selectFile(file)">
                                   {{ file.fileName }}
                                </a>
                                <div v-if="isLoading && fileList.length === 0" class="list-group-item">加载中...</div>
                                <div v-if="!isLoading && fileList.length === 0" class="list-group-item text-muted">
                                    此项目没有关联文件。
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 第二行：图片显示区域 (原来的第二行) -->
            <div class="row mt-4">
                <div class="col-12">
                    <div class="card">
                        <div class="card-body text-center">
                            <h4 v-if="selectedFile" class="card-title">{{ selectedFile.fileName }}</h4>
                            <div v-if="selectedFile" style="overflow: auto; max-height: 80vh;">
                                <img :src="selectedFile.fullUrl" @error="onImageError" alt="文件预览" style="max-width: 100%; border: 1px solid #eee;">
                            </div>
                            <div v-else class="text-muted" style="padding: 5rem 0;">
                                <p>请从上方选择一个文件进行预览。</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            fileList: [],
            selectedFile: null,
            isLoading: false,
            // 确保 projectInfo 的结构完整，以防渲染时出错
            projectInfo: {
                projectNumber: '',
                productName: '',
                material: '',
                partNumber: '',
                thickness: '',
                process: '',
                tensileStrength: '',
                moldDrawingNumber: '',
                equipment: '',
                customerName: '',
                designerName: '',
                designerDate: '',
                checkerName: '',
                checkerDate: '',
                auditorName: '',
                auditorDate: ''
            }
        }
    },
    methods: {
        // ... fetchFiles 和 fetchProjectInfo 等方法保持不变 ...
        fetchFiles() {
            if (!this.projectId) return;
            this.isLoading = true;
            axios.get(`/api/projects/${this.projectId}/files`).then(response => {
                this.fileList = response.data.map(file => ({ ...file, fullUrl: '/uploads/' + file.filePath }));
                if (this.fileList.length > 0) this.selectFile(this.fileList[0]);
            }).catch(error => {
                console.error(`获取文件列表失败:`, error);
                this.$message.error('无法加载文件列表。');
            }).finally(() => { this.isLoading = false; });
        },
        fetchProjectInfo() {
            if (!this.projectId) return;
            axios.get(`/api/projects/${this.projectId}`).then(response => {
                if (response.data && response.data.projectNumber) {
                    this.projectInfo = response.data;
                } else {
                    this.projectInfo = { projectNumber: '未找到该项目' };
                }
            }).catch(error => {
                console.error(`获取项目信息失败:`, error);
                this.projectInfo = { projectNumber: '加载项目信息失败' };
            });
        },
        selectFile(file) {
            this.selectedFile = file;
        },
        onImageError(event) {
            console.error('图片加载失败:', event.target.src);
            event.target.src = 'path/to/image-load-failed-placeholder.png';
            this.$message.error('无法加载预览图片。');
        }
    },
    watch: {
        // ... watch 逻辑保持不变 ...
        projectId: {
            immediate: true,
            handler(newId) {
                if (newId) {
                    this.fetchProjectInfo();
                    this.fetchFiles();
                } else {
                    this.fileList = [];
                    this.selectedFile = null;
                    this.projectInfo = {};
                }
            }
        }
    }
});