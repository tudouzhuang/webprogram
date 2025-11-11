// 【第1步】: 导入我们之前创建的导出工具模块
import { exportWithExcelJS } from '/js/utils/luckysheetExporter.js';

Vue.component('record-workspace-panel', {
    props: {
        recordId: {
            type: [String, Number],
            required: true
        }
    },
    components: {
        'problem-record-table': ProblemRecordTable,
        'workspace-status-bar': WorkspaceStatusBar,
    },
    // 【第2步】: 大幅修改模板，增加在线编辑相关的按钮和状态
    template: `
        <div class="main-panel" style="width:100%;height:100%">
            <div class="content-wrapper">
                <!-- 1. 顶部信息与操作区 -->
                <div class="card mb-4">
                    <div class="card-body">
                        <div v-if="isLoading" class="text-center p-3">
                            <p>正在加载工作区...</p>
                            <el-progress :percentage="100" status="success" :indeterminate="true" :duration="1"></el-progress>
                        </div>
                        <div v-else-if="loadError" class="alert alert-danger">{{ loadError }}</div>
                        
                        <!-- 【【【 优化后的布局 】】】 -->
                        <div v-else-if="recordInfo">
                            <!-- 最外层 Flexbox 容器 -->
                            <div class="d-flex justify-content-between align-items-center">
                                
                                <!-- 左侧：统一的信息中心 (宽度自适应) -->
                                <div style="flex-grow: 1; margin-right: 20px;">
                                <workspace-status-bar
                                    v-if="recordInfo"
                                    ref="statusBarRef"
                                    :file-id="activeFile ? activeFile.id : 0" 
                                    
                                    :record-info="recordInfo"
                                    :live-stats="currentLiveStats"
                                    :status="recordInfo.status"
                                    :total-duration="recordInfo.totalDesignDurationSeconds"
                                    :session-duration="currentSessionSeconds">
                                </workspace-status-bar>
                                </div>

                                <div class="d-flex flex-column" style="flex-shrink: 0; gap: 10px; min-width: 150px;">
    
                                    <el-button @click="goBack" icon="el-icon-back" plain style="width: 100%; margin-left: 10px">返回列表</el-button>
                                    
                                    <el-button 
                                        v-if="activeTab !== 'recordMeta'"
                                        type="info" 
                                        plain
                                        icon="el-icon-download"
                                        @click="handleExport"
                                        style="width: 100%;">
                                        导出文件
                                    </el-button>
                                    
                                    <!-- 【【【 核心修正：移除 <template>，将 v-if 直接应用到每个按钮上 】】】 -->
                                    <el-button v-if="canEdit" type="primary" plain icon="el-icon-document" @click="handleSaveDraft" :loading="isSaving" style="width: 100%;">
                                        保存在线修改
                                    </el-button>
                                    
                                    <el-button v-if="canEdit" type="success" icon="el-icon-s-promotion" @click="handleTriggerReview" :loading="isSubmitting" style="width: 100%;">
                                        提交审核
                                    </el-button>
                                    
                                </div>
                                
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 2. 内容区域 (Tab切换) -->
                <!-- 2. 内容区域：动态Tab页 -->
                <div class="card" v-if="!isLoading && recordInfo">
                    <div class="card-body">
                        <el-tabs v-model="activeTab" type="border-card" @tab-click="handleTabClick">
                            
                            <el-tab-pane v-if="metaFile" label="表单元数据" name="recordMeta" lazy>
                                <div v-if="isMetaDataLoading" class="text-center p-5">正在加载元数据...</div>
                                
                                <!-- 【核心UI改造】: 使用只读的 el-form 来展示数据 -->
                                <div v-else-if="metaDataContent">
                                    <el-alert title="原始表单数据" type="info" class="mb-3" :closable="false" description="这是创建此记录时提交的所有表单信息的备份。此内容为只读。"></el-alert>
                                    
                                    <!-- 我们复用 el-form 结构，但所有 input 都设为 disabled -->
                                    <el-form :model="metaDataContent" label-width="120px" label-position="right">
                                        <!-- 1. 零件和工序信息 -->
                                        <el-row :gutter="20">
                                            <el-col :span="12">
                                                <el-form-item label="零件名称">
                                                    <el-input :value="metaDataContent.partName" disabled></el-input>
                                                </el-form-item>
                                            </el-col>
                                            <el-col :span="12">
                                                <el-form-item label="工序名称">
                                                    <el-input :value="metaDataContent.processName" disabled></el-input>
                                                </el-form-item>
                                            </el-col>
                                        </el-row>
                                        
                                        <el-divider>详细规格信息</el-divider>
                                        
                                        <!-- 基础信息部分 -->
                                        <el-row :gutter="20">
                                            <el-col :span="12"><el-form-item label="制件材质"><el-input :value="metaDataContent.material" disabled></el-input></el-form-item></el-col>
                                            <el-col :span="12"><el-form-item label="制件料厚"><el-input :value="metaDataContent.thickness" disabled></el-input></el-form-item></el-col>
                                        </el-row>
                                        <el-row :gutter="20">
                                            <el-col :span="12"><el-form-item label="抗拉强度"><el-input :value="metaDataContent.tensileStrength" disabled></el-input></el-form-item></el-col>
                                            <el-col :span="12"><el-form-item label="客户名称"><el-input :value="metaDataContent.customerName" disabled></el-input></el-form-item></el-col>
                                        </el-row>
                                        <el-form-item label="模具图号"><el-input :value="metaDataContent.moldDrawingNumber" type="textarea" :rows="2" disabled></el-input></el-form-item>
                                        <el-form-item label="使用设备 (主线)"><el-input :value="metaDataContent.equipment" disabled></el-input></el-form-item>
                                        
                                        <el-divider>人员信息</el-divider>
                            
                                        <el-row :gutter="20">
                                            <el-col :span="12">
                                                <el-form-item label="设计人员">
                                                    <el-input :value="metaDataContent.designerName" disabled></el-input>
                                                </el-form-item>
                                            </el-col>
                                            <el-col :span="12">
                                                <el-form-item label="日期">
                                                    <el-date-picker type="date" :value="metaDataContent.designerDate" style="width: 100%;" disabled></el-date-picker>
                                                </el-form-item>
                                            </el-col>
                                        </el-row>
                                        <!-- 校对人员信息 -->
                                        <el-row :gutter="20">
                                            <el-col :span="12">
                                                <el-form-item label="校对人员">
                                                    <!-- 使用 v-if 判断，如果数据不存在则显示占位符 -->
                                                    <el-input v-if="metaDataContent.checkerName" :value="metaDataContent.checkerName" disabled></el-input>
                                                    <el-input v-else placeholder="待校对" disabled></el-input>
                                                </el-form-item>
                                            </el-col>
                                            <el-col :span="12">
                                                <el-form-item label="日期">
                                                    <el-date-picker 
                                                        v-if="metaDataContent.checkerDate" 
                                                        type="date" 
                                                        :value="metaDataContent.checkerDate" 
                                                        style="width: 100%;" 
                                                        disabled>
                                                    </el-date-picker>
                                                    <el-input v-else placeholder="待校对" disabled></el-input>
                                                </el-form-item>
                                            </el-col>
                                        </el-row>

                                        <!-- 审核人员信息 -->
                                        <el-row :gutter="20">
                                            <el-col :span="12">
                                                <el-form-item label="审核人员">
                                                    <el-input v-if="metaDataContent.auditorName" :value="metaDataContent.auditorName" disabled></el-input>
                                                    <el-input v-else placeholder="待审核" disabled></el-input>
                                                </el-form-item>
                                            </el-col>
                                            <el-col :span="12">
                                                <el-form-item label="日期">
                                                    <el-date-picker 
                                                        v-if="metaDataContent.auditorDate" 
                                                        type="date" 
                                                        :value="metaDataContent.auditorDate" 
                                                        style="width: 100%;" 
                                                        disabled>
                                                    </el-date-picker>
                                                    <el-input v-else placeholder="待审核" disabled></el-input>
                                                </el-form-item>
                                            </el-col>
                                        </el-row>
                                        
                                        <el-divider>尺寸与重量</el-divider>
                                        
                                        <el-form-item label="报价 尺寸">
                                            <el-row :gutter="10" v-if="metaDataContent.quoteSize">
                                                <el-col :span="7"><el-input :value="metaDataContent.quoteSize.length" placeholder="长度(mm)" disabled></el-input></el-col>
                                                <el-col :span="1" class="text-center">X</el-col>
                                                <el-col :span="7"><el-input :value="metaDataContent.quoteSize.width" placeholder="宽度(mm)" disabled></el-input></el-col>
                                                <el-col :span="1" class="text-center">X</el-col>
                                                <el-col :span="7"><el-input :value="metaDataContent.quoteSize.height" placeholder="高度(mm)" disabled></el-input></el-col>
                                            </el-row>
                                        </el-form-item>
                                        
                                        <el-form-item label="报价 重量">
                                            <el-input :value="metaDataContent.quoteWeight" placeholder="重量" disabled><template slot="append">T</template></el-input>
                                        </el-form-item>
                            
                                        <el-form-item label="实际 尺寸">
                                            <el-row :gutter="10" v-if="metaDataContent.actualSize">
                                                <el-col :span="7"><el-input :value="metaDataContent.actualSize.length" placeholder="长度(mm)" disabled></el-input></el-col>
                                                <el-col :span="1" class="text-center">X</el-col>
                                                <el-col :span="7"><el-input :value="metaDataContent.actualSize.width" placeholder="宽度(mm)" disabled></el-input></el-col>
                                                <el-col :span="1" class="text-center">X</el-col>
                                                <el-col :span="7"><el-input :value="metaDataContent.actualSize.height" placeholder="高度(mm)" disabled></el-input></el-col>
                                            </el-row>
                                        </el-form-item>
                                        
                                        <el-form-item label="实际 重量">
                                            <el-input :value="metaDataContent.actualWeight" placeholder="重量" disabled><template slot="append">T</template></el-input>
                                        </el-form-item>
                            
                                    </el-form>
                                </div>
                            </el-tab-pane>
        
                            <!-- 使用 v-for 动态生成所有检查项文件的 Tab 页 -->
                            <el-tab-pane
                                v-for="file in excelFiles"
                                :key="file.id"
                                :label="file.documentType"
                                :name="file.documentType"
                                lazy>
                                <iframe v-if="activeTab === file.documentType"
                                    :ref="'iframe-' + file.id"
                                    src="/luckysheet-iframe-loader.html" 
                                    @load="() => loadSheetInIframe(file)"
                                    style="width: 100%; height: 80vh; border: none;">
                                </iframe>
                            </el-tab-pane>

                            <el-tab-pane label="问题记录" name="problemRecord" lazy>
                                <problem-record-table
                                    v-if="activeTab === 'problemRecord'"
                                    :record-id="Number(recordId)"
                                    mode="reviewer">
                                </problem-record-table>
                            </el-tab-pane>
            
                            <div v-if="!metaFile && excelFiles.length === 0" class="text-center text-muted p-5">
                                <h4>此过程记录未关联任何文件。</h4>
                            </div>
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
            associatedFiles: [],
            activeTab: '',
            isSaving: false,
            isSubmitting: false,
            iframesLoaded: {},
            metaDataContent: null,
            isMetaDataLoading: false,
            workSessionId: null,
            heartbeatInterval: null,
            isPaused: false,
            currentSessionSeconds: 0, // 用于存储本次会话已经过的秒数
            sessionTimer: null,        // 用于存储驱动UI更新的秒级定时器
            currentLiveStats: null // 用于存储来自 iframe 的实时统计 
        }
    },

    computed: {
        // 【核心修正】: canEdit 现在还需判断当前Tab是否为只读的'recordMeta'
        canEdit() {
            if (!this.recordInfo) return false;
            const isEditableStatus = ['DRAFT', 'CHANGES_REQUESTED'].includes(this.recordInfo.status);
            // 只有在状态允许，并且当前不在查看元数据时，才能编辑
            return isEditableStatus && this.activeTab !== 'recordMeta';
        },
        excelFiles() {
            return this.associatedFiles.filter(file =>
                file.fileType && (file.fileType.includes('spreadsheetml') || file.fileType.includes('excel'))
            );
        },
        metaFile() {
            return this.associatedFiles.find(file => file.documentType === 'recordMeta');
        },
        activeFile() {
            if (this.activeTab === 'recordMeta') {
                return this.metaFile;
            }
            return this.excelFiles.find(f => f.documentType === this.activeTab);
        }
    },

    methods: {
        // fetchData 逻辑基本不变，保持原样
        async fetchData() {
            this.isLoading = true;
            this.loadError = null;
            this.associatedFiles = [];
            this.iframesLoaded = {};
            this.activeTab = '';
            this.metaDataContent = null; // 重置

            try {
                const recordResponse = await axios.get(`/api/process-records/${this.recordId}`);
                this.recordInfo = recordResponse.data;
                const filesResponse = await axios.get(`/api/process-records/${this.recordId}/files`);
                this.associatedFiles = (filesResponse.data || []).sort((a, b) => a.documentType.localeCompare(b.documentType));

                // 【修正】: 设定默认激活的Tab页，优先Excel，其次元数据
                if (this.excelFiles.length > 0) {
                    this.activeTab = this.excelFiles[0].documentType;
                } else if (this.metaFile) {
                    this.activeTab = 'recordMeta';
                    // 如果默认就是元数据页，则立即获取其内容
                    this.fetchAndDisplayMetaData();
                }

            } catch (error) {
                this.loadError = "加载工作区数据失败。";
                console.error("[Workspace] fetchData 失败:", error);
            } finally {
                this.isLoading = false;
            }
        },

        async fetchAndDisplayMetaData() {
            // 如果已经加载过，或者没有metaFile，则不执行
            if (this.metaDataContent || !this.metaFile) return;

            this.isMetaDataLoading = true;
            try {
                const response = await axios.get(`/api/files/content/${this.metaFile.id}`);
                // axios 可能会自动解析JSON，也可能返回字符串，做兼容处理
                if (typeof response.data === 'string') {
                    this.metaDataContent = JSON.parse(response.data);
                } else {
                    this.metaDataContent = response.data;
                }
            } catch (e) {
                console.error("解析元数据JSON失败", e);
                this.metaDataContent = { "error": "无法加载或解析元数据内容。" };
            } finally {
                this.isMetaDataLoading = false;
            }
        },

        loadSheetInIframe(fileInfo) {
            if (!fileInfo || !fileInfo.id) return;

            this.iframesLoaded[fileInfo.id] = true;

            const iframeRef = this.$refs['iframe-' + fileInfo.id];
            const targetIframe = Array.isArray(iframeRef) ? iframeRef[0] : iframeRef;

            if (targetIframe && targetIframe.contentWindow) {
                const options = { allowUpdate: this.canEdit, showtoolbar: this.canEdit, showinfobar: false };

                // 【【【 核心修改在这里 】】】
                // 我们在原有的 URL 后面，加上了 &format=json 这个参数。
                // 注意：因为前面已经有了一个 '?' (用于时间戳)，所以我们用 '&' 来连接新的参数。
                const fileUrl = `/api/files/content/${fileInfo.id}?t=${new Date().getTime()}&format=json`;

                console.log(`[Workspace] 准备向 iframe 发送加载指令, URL: ${fileUrl}`); // 增加一条日志，方便调试

                const message = {
                    type: 'LOAD_SHEET',
                    payload: { fileUrl, fileName: fileInfo.fileName, options: { lang: 'zh', ...options } }
                };
                targetIframe.contentWindow.postMessage(message, window.location.origin);
            } else {
                console.warn(`[Workspace] 尝试加载 iframe 内容失败，未能找到 ref 为 'iframe-${fileInfo.id}' 的 iframe 实例。`);
            }
        },

        handleTabClick(tab) {
            // tab.name 就是 documentType
            if (tab.name === 'recordMeta') {
                // 如果是元数据Tab，调用专门的方法
                this.fetchAndDisplayMetaData();
            } else {
                // 否则，是Excel Tab，调用加载iframe的方法
                const fileToLoad = this.excelFiles.find(f => f.documentType === tab.name);
                // 【【【 修正点 】】】
                // 确保在 $nextTick 中调用，等待 iframe 被渲染出来
                this.$nextTick(() => {
                    this.loadSheetInIframe(fileToLoad);
                });
            }
        },

        // --- 【第4步】: 新增在线保存和提交的核心逻辑 ---

        /**
                 * 【【最终修正版】】 "保存在线修改" 按钮的处理器。
                 * 此方法只负责向 iframe 发送获取数据的指令，真正的保存逻辑在 messageEventListener 中处理。
                 */
        handleSaveDraft() {
            // 1. 前置状态检查
            if (this.isSaving) {
                this.$message.warning('正在保存中，请稍候...');
                return;
            }

            // 2. 查找当前激活的文件和对应的 iframe 实例
            const activeFile = this.excelFiles.find(f => f.documentType === this.activeTab);
            if (!activeFile) {
                this.$message.error('错误：当前没有可保存的Excel文件！');
                return;
            }

            // 【语法修正】修复了字符串拼接中的额外单引号
            const iframeRef = this.$refs['iframe-' + activeFile.id];
            const targetIframe = Array.isArray(iframeRef) ? iframeRef[0] : iframeRef;
            if (!targetIframe) {
                this.$message.error('错误：无法找到对应的编辑器实例！');
                return;
            }

            // 3. 更新UI状态，并向用户显示提示
            this.isSaving = true;
            this.$message.info(`正在从编辑器获取 "${activeFile.documentType}" 的最新数据...`);

            console.log('【父组件】准备发送 GET_DATA_AND_IMAGES 指令给 iframe...');

            // 4. 【核心】只发送一次指令给 iframe，然后函数结束。
            // 后续的数据处理和文件上传，将由 messageEventListener 异步接管。
            targetIframe.contentWindow.postMessage({
                type: 'GET_DATA_AND_IMAGES',
                payload: {
                    purpose: 'save-draft',
                    fileId: activeFile.id,
                    documentType: activeFile.documentType
                }
            }, window.location.origin);

            console.log('【父组件】GET_DATA_AND_IMAGES 指令已发送！等待 iframe 响应...');
        },

        // 2. "提交审核" 按钮的处理器
        handleTriggerReview() {
            this.$confirm('您确定所有修改都已保存，并准备好提交给审核员吗？', '确认提交', {
                confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning'
            }).then(() => {
                this.triggerReviewFlow();
            }).catch(() => { });
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


        async messageEventListener(event) {
            // 安全检查，确保消息来自同源且有数据
            if (event.origin !== window.location.origin || !event.data || !event.data.type) {
                return;
            }

            console.log('[Parent] 接收到 message 事件:', event.data); // 打印所有收到的消息

            const { type, payload } = event.data;

            // =================================================================
            //  ↓↓↓ 分支 1: 处理“保存”操作的回调数据 ↓↓↓
            // =================================================================
            if (type === 'SHEET_DATA_WITH_IMAGES_RESPONSE') {

                console.log('[Parent] 消息类型匹配！正在处理 SHEET_DATA_WITH_IMAGES_RESPONSE...');
                console.log('[Parent] 解构后的 payload:', payload);

                if (!payload || payload.purpose !== 'save-draft') {
                    console.warn(`[Parent] payload.purpose 不匹配 'save-draft'，已忽略。`);
                    return;
                }

                console.log('[Parent] ✅ Purpose 检查通过，开始执行保存逻辑...');
                try {
                    const exportBlob = await exportWithExcelJS(payload);
                    const formData = new FormData();
                    const newFileName = `${payload.documentType}_${this.recordInfo.partName}_${this.recordId}.xlsx`;
                    formData.append('file', exportBlob, newFileName);

                    await axios.post(`/api/process-records/${this.recordId}/save-draft?fileId=${payload.fileId}`, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });

                    this.$message.success(`"${payload.documentType}" 已成功保存！`);

                    // 【【【 新增逻辑：保存成功后，触发状态栏刷新 】】】
                    // 清空实时统计数据，让状态栏显示已保存的数据
                    this.currentLiveStats = null;

                    // 通过 ref 调用子组件的方法，让它重新从后端拉取最新的持久化统计数据
                    if (this.$refs.statusBarRef) {
                        this.$refs.statusBarRef.fetchSavedStats();
                    }

                    // 刷新当前Tab的内容 (您的原有逻辑)
                    // 注意：为了避免竞争条件，最好在统计刷新后再重新加载iframe，或者接受短暂的数据不一致
                    const fileToReload = this.associatedFiles.find(f => f.documentType === payload.documentType);
                    if (fileToReload) {
                        this.loadSheetInIframe(fileToReload);
                    }

                } catch (error) {
                    this.$message.error("保存失败: " + (error.message || '未知错误'));
                    console.error("在线保存文件时出错:", error);
                } finally {
                    this.isSaving = false;
                }

                // =================================================================
                //  ↓↓↓ 分支 2: 【【【 新增 】】】 处理实时统计更新的消息 ↓↓↓
                // =================================================================
            } else if (type === 'STATS_UPDATE') {

                console.log('[Parent] 消息类型匹配！正在处理 STATS_UPDATE...');
                console.log('[Parent] 接收到实时统计更新:', payload);

                // 将从 iframe 接收到的实时统计数据，存入父组件的 data 属性中
                // 这个属性通过 prop 绑定到了 <workspace-status-bar> 组件
                this.currentLiveStats = payload;

                // =================================================================
                //  ↓↓↓ 分支 3: 处理 iframe 内点击事件（您的原有逻辑，保持不变） ↓↓↓
                // =================================================================
            } else if (type === 'IFRAME_CLICKED') {
                // 可以在这里处理 iframe 点击事件，如果需要的话
            }
        },

        // --- 其他辅助方法保持不变 ---
        goBack() {
            console.log("[Action] 用户点击返回列表。");
            this.stopWorkSession(); // 在发出事件前，先停止会话
            this.$emit('back-to-list');
        },
        handleExport() {
            // 1. 找到当前激活的 Tab 对应的文件信息
            const activeFile = this.excelFiles.find(f => f.documentType === this.activeTab);

            if (!activeFile) {
                this.$message.warning('当前没有可导出的 Excel 文件！');
                return;
            }

            // 2. 找到对应的 iframe 引用
            const iframeRef = this.$refs['iframe-' + activeFile.id];
            const targetIframe = Array.isArray(iframeRef) ? iframeRef[0] : iframeRef;

            if (!targetIframe) {
                this.$message.error('无法找到对应的编辑器实例！');
                return;
            }

            // 3. 构造一个有意义的文件名
            const fileName = `${activeFile.fileName || activeFile.documentType}.xlsx`;

            // 4. 向该 iframe 发送导出指令
            targetIframe.contentWindow.postMessage({
                type: 'EXPORT_SHEET',
                payload: {
                    fileName: fileName
                }
            }, window.location.origin);

            this.$message.info(`已发送导出指令给: ${fileName}`);
        },
        async startWorkSession() {
            if (!this.recordId || !this.canEdit) return;
            try {
                const response = await axios.post(`/api/process-records/${this.recordId}/work-sessions/start`);
                this.workSessionId = response.data.id;
                console.log(`[WorkTimer] 工作会话已开始，Session ID: ${this.workSessionId}`);

                // --- 【【【 新增调用 】】】 ---
                this.startSessionTimer(); // 启动 UI 计时器
                this.startHeartbeat();    // 启动心跳

            } catch (error) {
                console.error("[WorkTimer] 启动工作会话失败:", error);
            }
        },
        async stopWorkSession() {
            if (this.workSessionId) {
                try {
                    // 使用 navigator.sendBeacon 可以在页面关闭时更可靠地发送请求
                    const url = `/api/work-sessions/${this.workSessionId}/stop`;
                    navigator.sendBeacon(url);
                    console.log(`[WorkTimer] 已发送停止会话信标, Session ID: ${this.workSessionId}`);
                } catch (error) {
                    // 如果 sendBeacon 失败，尝试用 axios
                    axios.post(`/api/work-sessions/${this.workSessionId}/stop`).catch(e => { });
                }
                this.stopSessionTimer(); // 停止 UI 计时器
                this.stopHeartbeat();    // 停止心跳
                this.workSessionId = null;
            }
        },
        startHeartbeat() {
            this.stopHeartbeat(); // 先清除旧的，防止重复
            this.heartbeatInterval = setInterval(() => {
                if (this.workSessionId && !this.isPaused) {
                    axios.post(`/api/work-sessions/${this.workSessionId}/heartbeat`)
                        .catch(err => console.warn("[WorkTimer] 心跳发送失败", err));
                }
            }, 60 * 1000); // 每分钟一次
        },
        stopHeartbeat() {
            if (this.heartbeatInterval) {
                clearInterval(this.heartbeatInterval);
                this.heartbeatInterval = null;
            }
        },
        startSessionTimer() {
            this.stopSessionTimer(); // 先清除旧的，确保只有一个计时器在运行
            this.currentSessionSeconds = 0; // 每次开始都从0计时

            this.sessionTimer = setInterval(() => {
                // 如果会话ID存在且没有被暂停，则秒数+1
                if (this.workSessionId && !this.isPaused) {
                    this.currentSessionSeconds++;
                }
            }, 1000); // 每1000毫秒 (1秒) 执行一次
        },
        /**
         * 停止 UI 计时器
         */
        stopSessionTimer() {
            if (this.sessionTimer) {
                clearInterval(this.sessionTimer);
                this.sessionTimer = null;
            }
        },
    },

    // 【第5步】: 添加 mounted 和 beforeDestroy 钩子来管理事件监听器
    mounted() {
        // --- 您已有的 message 监听器逻辑 (保持不变) ---
        this.boundMessageListener = this.messageEventListener.bind(this);
        window.addEventListener('message', this.boundMessageListener);

        // --- 您已有的 beforeunload 监听器逻辑 (保持不变) ---
        window.addEventListener('beforeunload', this.stopWorkSession);

        // =======================================================
        // ↓↓↓ 【【【新增：智能滚动锁的全部逻辑】】】 ↓↓↓
        // =======================================================
        console.log('[INIT] 启动智能滚动拦截器...');

        this._scrollLock = {
            lastKnownScrollY: window.scrollY || document.documentElement.scrollTop,
            isUserScrolling: false,
            timeoutId: null,
            animationFrameId: null
        };

        const scrollLockLoop = () => {
            if (this && this._scrollLock) {
                if (!this._scrollLock.isUserScrolling && window.scrollY !== this._scrollLock.lastKnownScrollY) {
                    window.scrollTo(0, this._scrollLock.lastKnownScrollY);
                } else {
                    this._scrollLock.lastKnownScrollY = window.scrollY;
                }
                this._scrollLock.animationFrameId = requestAnimationFrame(scrollLockLoop);
            }
        };
        scrollLockLoop();

        this.handleWheel = () => {
            this._scrollLock.isUserScrolling = true;
            clearTimeout(this._scrollLock.timeoutId);
            this._scrollLock.timeoutId = setTimeout(() => {
                this._scrollLock.isUserScrolling = false;
            }, 200);
        };

        window.addEventListener('wheel', this.handleWheel, { passive: true });
        // =======================================================
    },

    // 【【【 修改 beforeDestroy 】】】
    beforeDestroy() {
        console.log("[LifeCycle] beforeDestroy: 组件即将销毁，执行清理操作。");

        // --- 您已有的清理逻辑 (保持不变) ---
        this.stopWorkSession();
        window.removeEventListener('message', this.boundMessageListener);
        window.removeEventListener('beforeunload', this.stopWorkSession);

        // =======================================================
        // ↓↓↓ 【【【新增：智能滚动锁的清理逻辑】】】 ↓↓↓
        // =======================================================
        console.log('[CLEANUP] 停止智能滚动拦截器...');
        if (this._scrollLock) {
            cancelAnimationFrame(this._scrollLock.animationFrameId);
            clearTimeout(this._scrollLock.timeoutId);
        }
        window.removeEventListener('wheel', this.handleWheel);
        // =======================================================
    },
    watch: {
        recordId: {
            immediate: true,
            handler(newId, oldId) {
                // 当 recordId 发生有效变化时，执行清理和重新加载
                if (newId) {
                    // 如果是从一个有效的旧ID切换过来的，先停止上一个会话
                    if (oldId && this.workSessionId) {
                        console.log(`[WorkTimer] Record ID 从 ${oldId} 切换到 ${newId}，停止旧会话。`);
                        this.stopWorkSession();
                    }


                    // 【【【 核心修改 】】】
                    // fetchData 是一个 async 函数，所以它返回一个 Promise。
                    // 我们使用 .then() 来确保在数据获取成功之后再执行后续操作。
                    this.fetchData().then(() => {
                        console.log("[WorkTimer] fetchData 完成，准备启动工作会话。");
                        // 在这里调用 startWorkSession，可以确保 this.recordInfo 和 this.canEdit 都是最新的
                        this.startWorkSession();
                    }).catch(error => {
                        console.error("[WorkTimer] fetchData 失败，无法启动工作会话。", error);
                    });

                } else {
                    // 如果 recordId 变为 null 或 undefined (例如返回列表页)，也停止会话
                    this.stopWorkSession();
                }
            }
        }
    }
});