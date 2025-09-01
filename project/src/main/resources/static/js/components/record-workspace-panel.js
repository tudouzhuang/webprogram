// 【第1步】: 导入我们之前创建的导出工具模块
import { exportWithExcelJS } from '/js/utils/luckysheetExporter.js';

Vue.component('record-workspace-panel', {
    props: {
        recordId: {
            type: [String, Number],
            required: true
        }
    },
    // 【第2步】: 大幅修改模板，增加在线编辑相关的按钮和状态
    template: `
        <div class="main-panel" style="width:100%;height:100%">
            <div class="content-wrapper">
                <!-- 1. 顶部信息与动态操作区 -->
                <div class="card mb-4">
                    <div class="card-body">
                        <div v-if="isLoading" class="text-center p-3">
                            <p>正在加载工作区...</p>
                            <el-progress :percentage="100" status="success" :indeterminate="true" :duration="1"></el-progress>
                        </div>
                        <div v-else-if="loadError" class="alert alert-danger">{{ loadError }}</div>
                        <div v-else-if="recordInfo">
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
                                    <!-- 【核心UI修改】: 按钮区域 -->
                                    <el-button @click="goBack" icon="el-icon-back" plain>返回列表</el-button>
                                    
                                    <el-button v-if="canEdit" type="primary" plain icon="el-icon-document" @click="handleSaveDraft" :loading="isSaving" style="margin-left: 10px;">
                                        保存在线修改
                                    </el-button>

                                    <el-button v-if="canEdit" type="success" icon="el-icon-s-promotion" @click="handleTriggerReview" :loading="isSubmitting" style="margin-left: 10px;">
                                        提交审核
                                    </el-button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 2. 内容区域 (Tab切换) -->
                <div class="card" v-if="!isLoading && recordInfo">
                    <div class="card-body">
                        <el-tabs v-model="activeTab" type="border-card" @tab-click="handleTabClick">
                            <!-- 标签1: 我的设计 -->
                            <el-tab-pane label="我的设计" name="design" lazy>
                                <div v-if="recordInfo && recordInfo.rejectionComment" class="mb-3">
                                    <el-alert title="最新审核意见" type="warning" :description="recordInfo.rejectionComment" show-icon :closable="false" />
                                </div>
                                
                                <div v-if="canEdit" class="mb-3 p-2 bg-light border rounded">
                                     <p class="text-info mb-0"><i class="el-icon-info"></i> <strong>操作提示:</strong> 您可以直接在下方的表格中进行编辑。完成后，请先点击“保存在线修改”，确认无误后，再点击“提交审核”以推进流程。</p>
                                </div>

                                <iframe v-if="activeTab === 'design' && designFile"
                                    ref="designIframe"
                                    src="/luckysheet-iframe-loader.html" 
                                    @load="loadSheetInIframe('design')"
                                    style="width: 100%; height: 80vh; border: none;">
                                </iframe>
                                <div v-else-if="!designFile" class="text-muted text-center p-5"><h4>未找到设计文件</h4></div>
                            </el-tab-pane>

                            <!-- 标签2: 审核意见 -->
                            <el-tab-pane label="审核意见" name="review" v-if="reviewFile" lazy>
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

    // 【第3步】: 更新 data 属性以支持新功能
    data() {
        return {
            isLoading: true,
            loadError: null,
            recordInfo: null,
            designFile: null,
            reviewFile: null,
            activeTab: 'design',
            isSaving: false,      // 新增：用于“保存”按钮的加载状态
            isSubmitting: false,  // 新增：用于“提交”按钮的加载状态
            iframeLoaded: {       // 新增：跟踪iframe加载状态
                design: false,
                review: false
            }
        }
    },

    computed: {
        // 修改计算属性，定义何时可以进行编辑
        canEdit() {
            if (!this.recordInfo) return false;
            // 设计员可以在 DRAFT (草稿) 或 CHANGES_REQUESTED (待修改) 状态下编辑
            return ['DRAFT', 'CHANGES_REQUESTED'].includes(this.recordInfo.status);
        }
    },

    methods: {
        // fetchData 逻辑基本不变，保持原样
        async fetchData() {
            this.isLoading = true;
            this.loadError = null;
            this.designFile = null;
            this.reviewFile = null;
            this.iframeLoaded = { design: false, review: false }; // 重置加载状态

            try {
                const recordResponse = await axios.get(`/api/process-records/${this.recordId}`);
                this.recordInfo = recordResponse.data;

                if (this.recordInfo && this.recordInfo.sourceFilePath) {
                    this.designFile = {
                        filePath: this.recordInfo.sourceFilePath,
                        fileName: this.recordInfo.sourceFilePath.split('/').pop(),
                        documentType: 'SOURCE_RECORD'
                    };
                }

                const filesResponse = await axios.get(`/api/process-records/${this.recordId}/files`);
                const allFiles = filesResponse.data || [];
                this.reviewFile = allFiles.find(f => f.documentType && f.documentType.startsWith('REVIEW_'));
                
                // 确保数据加载后才尝试渲染iframe内容
                this.$nextTick(() => {
                    if (this.activeTab === 'design') this.loadSheetInIframe('design');
                    else if (this.activeTab === 'review') this.loadSheetInIframe('review');
                });
            } catch (error) {
                this.loadError = "加载工作区数据失败。";
            } finally {
                this.isLoading = false;
            }
        },

        // loadSheetInIframe 逻辑微调，以适应新的可编辑状态
        loadSheetInIframe(type) {
            this.iframeLoaded[type] = true;
            let iframeRef, fileInfo, options, fileUrl;

            if (type === 'design') {
                if (!this.iframeLoaded.design || !this.designFile) return;
                iframeRef = this.$refs.designIframe;
                fileInfo = this.designFile;
                // 核心：根据 canEdit 决定 Luckysheet 是否可编辑
                options = { allowUpdate: this.canEdit, showtoolbar: this.canEdit }; 
                fileUrl = `/uploads/${fileInfo.filePath}?t=${new Date().getTime()}`; // 加时间戳避免缓存
            } else {
                if (!this.iframeLoaded.review || !this.reviewFile) return;
                iframeRef = this.$refs.reviewIframe;
                fileInfo = this.reviewFile;
                options = { allowUpdate: false, showtoolbar: false }; // 审核文件总是只读
                fileUrl = `/api/files/content/${fileInfo.id}?t=${new Date().getTime()}`;
            }

            if (iframeRef && iframeRef.contentWindow) {
                const message = {
                    type: 'LOAD_SHEET',
                    payload: { fileUrl, fileName: fileInfo.fileName, options: { lang: 'zh', ...options } }
                };
                iframeRef.contentWindow.postMessage(message, window.location.origin);
            }
        },
        
        handleTabClick(tab) {
             this.$nextTick(() => this.loadSheetInIframe(tab.name));
        },

        // --- 【第4步】: 新增在线保存和提交的核心逻辑 ---

        // 1. "保存在线修改" 按钮的处理器
        handleSaveDraft() {
            if (this.isSaving || !this.iframeLoaded.design) return;
            this.isSaving = true;
            this.$message.info("正在生成并保存文件...");
            // 向 iframe 发送获取数据的请求
            this.$refs.designIframe.contentWindow.postMessage({ type: 'GET_DATA_AND_IMAGES', payload: { purpose: 'save-draft' } }, window.location.origin);
        },

        // 2. "提交审核" 按钮的处理器
        handleTriggerReview() {
            this.$confirm('您确定所有修改都已保存，并准备好提交给审核员吗？', '确认提交', {
                confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning'
            }).then(() => {
                this.triggerReviewFlow();
            }).catch(() => {});
        },

        async triggerReviewFlow() {
            this.isSubmitting = true;
            try {
                // 调用新的、只改变状态的 API
                await axios.post(`/api/process-records/${this.recordId}/trigger-review`);
                this.$message.success("已成功提交审核！");
                this.goBack(); // 提交成功后返回列表
            } catch (error) {
                this.$message.error("提交失败: " + (error.response?.data?.message || '未知错误'));
            } finally {
                this.isSubmitting = false;
            }
        },

        // 3. 消息监听器，处理来自 iframe 的数据响应
        async messageEventListener(event) {
            // 【第一层调试】: 打印所有收到的消息
            console.log('[Parent] 接收到 message 事件:', event.data);
        
            if (event.origin !== window.location.origin || !event.data) {
                return;
            }
            
            // 只处理我们关心的数据响应类型
            if (event.data.type !== 'SHEET_DATA_WITH_IMAGES_RESPONSE') {
                // console.log('[Parent] 消息类型不匹配，已忽略。');
                return;
            }
        
            console.log('[Parent] 消息类型匹配！正在处理 SHEET_DATA_WITH_IMAGES_RESPONSE...');
        
            const { payload } = event.data;
        
            // 【第二层调试】: 打印解构后的 payload
            console.log('[Parent] 解构后的 payload:', payload);
        
            if (!payload || payload.purpose !== 'save-draft') {
                console.warn(`[Parent] payload.purpose 不匹配 'save-draft'，已忽略。实际 purpose: ${payload ? payload.purpose : 'undefined'}`);
                return;
            }
        
            // 如果能执行到这里，说明判断通过了
            console.log('[Parent] ✅ Purpose 检查通过，开始执行保存逻辑...');

            try {
                // 使用我们复用的模块来生成 Blob
                const exportBlob = await exportWithExcelJS(payload);

                const formData = new FormData();
                const newFileName = `Design_${this.recordInfo.partName}_${this.recordId}.xlsx`;
                formData.append('file', exportBlob, newFileName);
                
                // 调用新的、只保存文件的 API
                await axios.post(`/api/process-records/${this.recordId}/save-draft`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                this.$message.success("在线修改已成功保存！");
                // 保存后重新加载数据，以刷新文件预览
                this.fetchData(); 

            } catch (error) {
                this.$message.error("保存失败: " + (error.message || '未知错误'));
                console.error("在线保存文件时出错:", error);
            } finally {
                this.isSaving = false;
            }
        },
        
        // --- 其他辅助方法保持不变 ---
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

    // 【第5步】: 添加 mounted 和 beforeDestroy 钩子来管理事件监听器
    mounted() {
        this.boundMessageListener = this.messageEventListener.bind(this);
        window.addEventListener('message', this.boundMessageListener);
    },
    beforeDestroy() {
        window.removeEventListener('message', this.boundMessageListener);
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