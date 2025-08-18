Vue.component('record-workspace-panel', {
    props: {
        recordId: {
            type: [String, Number],
            required: true
        }
    },
    template: `
        <div class="main-panel" style="width:100%;height:100%">
            <div class="content-wrapper">
                <!-- 1. 顶部信息与动态操作区 (保持不变) -->
                <div class="card mb-4">
                    <div class="card-body">
                        <!-- ... 加载和错误状态 ... -->
                        <div v-if="isLoading" class="text-center p-3">...</div>
                        <div v-else-if="loadError" class="alert alert-danger">{{ loadError }}</div>
                        <div v-else-if="recordInfo">
                            <!-- ... 描述和按钮 ... -->
                            <div class="d-flex justify-content-between align-items-start">
                                <div>
                                    <el-descriptions :title="'工作区: ' + recordInfo.partName" :column="2" border>
                                        <el-descriptions-item label="工序名称">{{ recordInfo.processName }}</el-descriptions-item>
                                        <el-descriptions-item label="状态">
                                            <el-tag :type="getStatusTagType(recordInfo.status)">{{ formatStatus(recordInfo.status) }}</el-tag>
                                        </el-descriptions-item>
                                    </el-descriptions>
                                </div>
                                <div class="d-flex align-items-center">
                                    <el-button @click="goBack" icon="el-icon-back" plain>返回列表</el-button>
                                    <el-button v-if="canResubmit" type="danger" icon="el-icon-upload" @click="handleResubmit" :loading="isResubmitting" style="margin-left: 10px;">
                                        完成修改，重新提交审核
                                    </el-button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 2. 内容区域 (Tab切换) -->
                <div class="card" v-if="!isLoading && recordInfo">
                    <div class="card-body">
                        <el-tabs v-model="activeTab" type="border-card">
                            <!-- 标签1: 我的设计 -->
                            <el-tab-pane label="我的设计" name="design" lazy>
                                <div class="mb-3 p-2 bg-light border rounded" v-if="canResubmit">
                                    <p class="text-danger mb-2"><i class="el-icon-warning"></i> <strong>操作提示:</strong> 请上传新版Excel文件以覆盖当前内容。</p>
                                    <el-upload
                                      action=""
                                      :auto-upload="false"
                                      :on-change="handleFileUpdate"
                                      :show-file-list="false">
                                      <el-button size="small" type="primary" icon="el-icon-document-add">选择新版设计Excel</el-button>
                                    </el-upload>
                                </div>

                                <div v-if="recordInfo && recordInfo.rejectionComment" class="mt-3">
                                    <el-alert
                                    title="最新审核意见"
                                    type="warning"
                                    :description="recordInfo.rejectionComment"
                                    show-icon
                                    :closable="false">
                                    </el-alert>
                                </div>


                                <div v-if="!designFile" class="text-muted text-center p-5"><h4>未找到设计文件</h4></div>
                        


                                <!-- 【核心改造】: 使用 iframe -->
                                <iframe v-if="activeTab === 'design' && designFile"
                                    ref="designIframe"
                                    src="/luckysheet-iframe-loader.html" 
                                    @load="loadSheetInIframe('design')"
                                    style="width: 100%; height: 80vh; border: none;">
                                </iframe>
                            </el-tab-pane>

                            <!-- 标签2: 审核意见 -->
                            <el-tab-pane label="审核意见" name="review" v-if="reviewFile" lazy>              
                                <!-- 【核心改造】: 使用 iframe -->
                                <iframe v-if="activeTab === 'review' && reviewFile"
                                    ref="reviewIframe"
                                    src="/luckysheet-iframe-loader.html" 
                                    @load="loadSheetInIframe('review')"
                                    style="width: 100%; height: 80vh; border: none;">
                                </iframe>
                            </el-tab-pane>
                        </el-tabs>
                    </div>
                </div>
            </div>
        </div>
    `,

    data() {
        return {
            isLoading: true,
            loadError: null,
            recordInfo: null,
            designFile: null,
            reviewFile: null,
            activeTab: 'design',
            isResubmitting: false,
            updatedFile: null
        }
    },

    computed: {
        canResubmit() {
            return this.recordInfo && this.recordInfo.status === 'CHANGES_REQUESTED';
        }
    },

    methods: {
        async fetchData() {
            this.isLoading = true;
            this.loadError = null;
            this.updatedFile = null;
            this.designFile = null;
            this.reviewFile = null;

            console.log(`[Workspace] 开始为 Record ID: ${this.recordId} 获取数据...`);
            try {
                // 1. 获取主记录信息 (这一步不变)
                const recordResponse = await axios.get(`/api/process-records/${this.recordId}`);
                this.recordInfo = recordResponse.data;
                console.log("[Workspace] 1/2: 成功获取记录主信息", this.recordInfo);

                // 2. --- 新的文件信息构建逻辑 ---
                console.log("[Workspace] 开始根据主记录信息构建文件对象...");

                // 2.1 构建设计文件 (designFile) 对象
                if (this.recordInfo && this.recordInfo.sourceFilePath) {
                    // 我们直接从 recordInfo 中提取信息，手动构建一个与 ProjectFile 结构类似的对象
                    this.designFile = {
                        // id: -1, // 我们没有文件ID，但可以模拟一个
                        filePath: this.recordInfo.sourceFilePath,
                        // 从路径中提取文件名
                        fileName: this.recordInfo.sourceFilePath.split('/').pop(),
                        documentType: 'SOURCE_RECORD' // 虚拟类型
                    };
                    console.log("[Workspace] 根据 source_file_path 成功构建了 designFile 对象:", this.designFile);
                } else {
                    console.warn("[Workspace] 警告: 记录中没有 source_file_path 字段，无法构建设计文件对象。");
                }

                // 2.2 查找审核文件 (reviewFile) 的逻辑保持不变
                // 这一步依然需要查询 project_files 表，因为审核文件是后来附加的
                const filesResponse = await axios.get(`/api/process-records/${this.recordId}/files`);
                const allFiles = filesResponse.data || [];
                this.reviewFile = allFiles.find(f => f.documentType && f.documentType.startsWith('REVIEW_'));
                console.log("[Workspace] 2/2: 查找到的审核文件(reviewFile):", this.reviewFile);

                // 3. 渲染默认的Tab页
                this.$nextTick(() => {
                    if (this.designFile) {
                        this.loadSheetInIframe('design');
                    }
                });

            } catch (error) {
                this.loadError = "加载工作区数据失败。";
                console.error("[Workspace] fetchData 过程中发生严重错误:", error);
                this.$message.error("加载数据失败！");
            } finally {
                this.isLoading = false;
            }
        },

        // --- 【核心修正】: 修改 loadSheetInIframe 的 URL 构建逻辑 ---
        loadSheetInIframe(type) {
            console.log(`[Workspace] ${type} iframe 已加载, 准备发送 LOAD_SHEET 消息...`);
            let iframeRef, fileInfo, options, fileUrl;

            if (type === 'design') {
                iframeRef = this.$refs.designIframe;
                fileInfo = this.designFile;
                options = { allowUpdate: this.canResubmit, showtoolbar: this.canResubmit };
                // 设计文件的 URL 直接拼接 uploads 目录
                fileUrl = `/uploads/${fileInfo.filePath}`;
            } else {
                iframeRef = this.$refs.reviewIframe;
                fileInfo = this.reviewFile;
                options = { allowUpdate: false, showtoolbar: false };
                // 审核文件的 URL 通过 FileController 获取，因为它在 project_files 表里有ID
                fileUrl = `/api/files/content/${fileInfo.id}`;
            }

            if (iframeRef && fileInfo) {
                console.log(`[Workspace] 准备加载文件, URL: ${fileUrl}`);
                const message = {
                    type: 'LOAD_SHEET',
                    payload: {
                        fileUrl: fileUrl,
                        fileName: fileInfo.fileName,
                        options: { lang: 'zh', showinfobar: false, ...options }
                    }
                };
                iframeRef.contentWindow.postMessage(message, window.location.origin);
            }
        },

        handleTabClick(tab) {
            console.log(`[Workspace] Tab 切换到: ${tab.name}`);
            // 当我们点击tab时，对应的iframe可能已经因为 v-if="reviewFile" 等条件被渲染了
            // 它的 @load 事件应该会自动触发 loadSheetInIframe
            // 这个方法可以留空，或者用于一些额外的逻辑
        },

        // --- 【核心改造】: 上传文件后，不再预览，而是直接准备提交 ---
        handleFileUpdate(file, fileList) {
            this.updatedFile = file.raw;
            this.$message.success({
                message: `新文件 "${file.name}" 已准备好。点击“重新提交审核”按钮即可完成上传。`,
                duration: 5000
            });
            // 不再需要本地预览逻辑，因为提交后刷新即可看到最新版本
        },

        // --- 其他方法保持不变 ---
        handleResubmit() {
            if (!this.updatedFile) {
                this.$message.warning("请先通过“选择新版设计Excel”按钮选择一个更新后的文件。");
                return;
            }
            this.$confirm(`确定要使用新文件 "${this.updatedFile.name}" 覆盖旧的设计，并重新提交审核吗?`, '确认操作', {
                confirmButtonText: '确定提交', cancelButtonText: '取消', type: 'warning'
            }).then(() => {
                this.resubmitWithNewFile();
            }).catch(() => { });
        },
        async resubmitWithNewFile() {
            this.isResubmitting = true;
            const formData = new FormData();
            formData.append('file', this.updatedFile);
            try {
                await axios.post(`/api/process-records/${this.recordId}/resubmit`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                this.$message.success("重新提交成功！");
                this.goBack();
            } catch (error) {
                this.$message.error("提交失败！" + (error.response.data.message || ''));
            } finally {
                this.isResubmitting = false;
            }
        },
        goBack() { this.$emit('back-to-list'); },
        formatStatus(status) {
            const statusMap = { 'DRAFT': '草稿', 'PENDING_REVIEW': '审核中', 'APPROVED': '已通过', 'REJECTED': '已驳回', 'CHANGES_REQUESTED': '待修改' };
            return statusMap[status] || status;
        },
        getStatusTagType(status) {
            const typeMap = { 'DRAFT': 'info', 'PENDING_REVIEW': 'warning', 'APPROVED': 'success', 'REJECTED': 'danger', 'CHANGES_REQUESTED': 'primary' };
            return typeMap[status] || 'primary';
        },
    },

    watch: {
        recordId: {
            immediate: true,
            handler(newId) {
                if (newId) {
                    this.activeTab = 'design';
                    this.fetchData();
                }
            }
        }
    }
});