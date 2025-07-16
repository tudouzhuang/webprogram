Vue.component('project-files-viewer', {
    props: {
        projectId: {
            type: [Number, String],
            required: true
        }
    },
    template: `
        <div class="content-wrapper">
            <div class="row">
                <!-- 左侧：图片列表子菜单 -->
                <div class="col-md-3">
                    <div class="card">
                        <div class="card-body">
                            <h4 class="card-title">文件列表 (项目: {{ projectInfo.projectNumber || '加载中...' }})</h4>
                            <div class="list-group">
                                <a href="javascript:void(0)" 
                                   v-for="file in fileList" 
                                   :key="file.id"
                                   class="list-group-item list-group-item-action"
                                   :class="{ 'active': selectedFile && selectedFile.id === file.id }"
                                   @click="selectFile(file)">
                                   {{ file.fileName }}
                                </a>
                                <div v-if="isLoading" class="list-group-item">加载中...</div>
                                <div v-if="!isLoading && fileList.length === 0" class="list-group-item text-muted">
                                    此项目没有关联文件。
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 右侧：图片显示区域 -->
                <div class="col-md-9">
                    <div class="card">
                        <div class="card-body text-center">
                            <h4 v-if="selectedFile" class="card-title">{{ selectedFile.fileName }}</h4>
                            <div v-if="selectedFile" style="overflow: auto; max-height: 80vh;">
                                <img :src="selectedFile.fullUrl" alt="文件预览" style="max-width: 100%; border: 1px solid #eee;">
                            </div>
                            <div v-else class="text-muted" style="padding: 5rem 0;">
                                <p>请从左侧选择一个文件进行预览。</p>
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
            projectInfo: {}
        }
    },
    methods: {
        fetchFiles() {
            if (!this.projectId) return;
            this.isLoading = true;
            
            // 【核心修改 1】: 在发送请求前，打印出将要访问的文件列表API地址
            const filesApiUrl = `/api/projects/${this.projectId}/files`;
            console.log(`[Viewer] 准备从API获取文件列表: ${filesApiUrl}`);

            axios.get(filesApiUrl)
                .then(response => {
                    this.fileList = response.data.map(file => {
                        const fullUrl = '/uploads/' + file.filePath;
                        // 【优化】: 也可以在这里打印每张图片的最终URL，方便调试
                        // console.log(`[Viewer] 文件'${file.fileName}'的完整URL是: ${fullUrl}`);
                        return { ...file, fullUrl };
                    });
                    if (this.fileList.length > 0) {
                        this.selectFile(this.fileList[0]);
                    }
                })
                .catch(error => {
                    console.error(`获取项目 ${this.projectId} 的文件列表失败:`, error);
                    this.$message.error('无法加载文件列表。');
                })
                .finally(() => {
                    this.isLoading = false;
                });
        },
        fetchProjectInfo() {
            if (!this.projectId) return;

            // 【核心修改 2】: 在发送请求前，打印出将要访问的项目信息API地址
            const projectApiUrl = `/api/projects/${this.projectId}`;
            console.log(`[Viewer] 准备从API获取项目信息: ${projectApiUrl}`);

            axios.get(projectApiUrl)
                .then(response => {
                    this.projectInfo = response.data;
                })
                .catch(error => {
                    console.error(`获取项目 ${this.projectId} 的基本信息失败:`, error);
                });
        },
        selectFile(file) {
            this.selectedFile = file;
            console.log(`[Viewer] 已选择文件: ${file.fileName}, 图片加载地址: ${file.fullUrl}`);
        }
    },
    watch: {
        projectId: {
            immediate: true,
            handler(newId) {
                if (newId) {
                    console.log(`[Viewer] ProjectId 变化为: ${newId}，开始加载数据...`);
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