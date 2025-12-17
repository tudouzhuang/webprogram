import { exportWithExcelJS } from '/js/utils/luckysheetExporter.js';

Vue.component('record-review-panel', {
    components: {
        'workspace-status-bar': WorkspaceStatusBar,
        'problem-record-table': ProblemRecordTable
    },
    // 【Props】: 从父组件接收要查看的过程记录ID
    props: {
        recordId: {
            type: [String, Number],
            required: true
        }
    },
    // 【模板】: 完整模板，包含iframe和按钮
    template: `
        <div class="content-wrapper" style="width:100%;height:100%">
            <!-- 加载与错误状态 -->
            <div v-if="isLoading" class="card">
                <div class="card-body text-center p-5">
                    <p>正在加载审核工作区...</p>
                    <el-progress :percentage="100" status="success" :indeterminate="true" :duration="1"></el-progress>
                </div>
            </div>
            <div v-else-if="loadError" class="alert alert-danger">{{ loadError }}</div>
            
            <!-- 主内容区 (数据加载成功后显示) -->
            <div v-else-if="recordInfo">
                <!-- ======================= 1. 顶部信息与操作区 ======================= -->
                <div class="card mb-4">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center">
                            
                            <!-- 左侧：统一的信息中心 -->
                            <div style="flex-grow: 1; margin-right: 20px;">
                            <workspace-status-bar
                            v-if="recordInfo"
                                ref="statusBarRef"
                                :file-id="activeFile ? activeFile.id : null"
                                :record-info="recordInfo"
                                :meta-data="metaDataContent"
                                :live-stats="currentLiveStats"
                                :status="recordInfo.status"
                                :total-duration="recordInfo.totalDesignDurationSeconds"
                                :session-duration="currentSessionSeconds">
                            </workspace-status-bar>
                            </div>

                            <!-- 右侧：审核员的操作按钮 (垂直排列) -->
                            <div class="d-flex flex-column" style="flex-shrink: 0; gap: 10px; min-width: 150px;">
                                <el-button @click="goBack" icon="el-icon-back" plain style="width: 100%; margin-left: 10px">返回列表</el-button>
                                <el-button v-if="activeTab !== 'recordMeta'" type="info" plain icon="el-icon-download" @click="exportCurrentSheet" style="width: 100%;">导出文件</el-button>
                                <el-button type="primary" @click="saveChanges" :loading="isSaving" icon="el-icon-document-checked" style="width: 100%;">保存在线修改</el-button>
                                <el-divider class="my-1"></el-divider>
                                <el-button @click="rejectRecord" type="danger" icon="el-icon-close" style="width: 100%; margin-left: 10px">打回修改</el-button>
                                <el-button @click="approveRecord" type="success" icon="el-icon-check" style="width: 100%;">批准通过</el-button>
                            </div>
                            
                        </div>
                    </div>
                </div>
                
                <!-- ======================= 2. Tab切换与内容展示区域 ======================= -->
                <div class="card">
                <div class="card-body">
                    <el-tabs v-model="activeTab" type="border-card" @tab-click="handleTabClick">
                        
                        <!-- 1. 表单元数据 Tab (UI已升级为el-form) -->
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
                                <el-row :gutter="20">
                                    <el-col :span="12">
                                        <el-form-item label="使用设备 (主线)">
                                            <el-input :value="metaDataContent.equipment" disabled></el-input>
                                        </el-form-item>
                                    </el-col>
                                    <el-col :span="12">
                                        <el-form-item label="使用设备 (副线)">
                                            <!-- 如果没有副线信息，显示“无” -->
                                            <el-input :value="metaDataContent.subEquipment || '无'" disabled></el-input>
                                        </el-form-item>
                                    </el-col>
                                </el-row>
                                
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
                        
                        <!-- 2. 动态Excel文件 Tab -->
                        <el-tab-pane
                            v-for="file in excelFiles"
                            :key="file.id"
                            :label="file.documentType"
                            :name="file.documentType"
                            lazy>
                            <!-- 保持与设计端一致的高度 -->
                            <iframe v-if="activeTab === file.documentType"
                                :ref="'iframe-' + file.id"
                                src="/luckysheet-iframe-loader.html"
                                @load="() => loadSheetIntoIframe(file)"
                                style="width: 100%; height: 80vh; border: none;">
                            </iframe>
                        </el-tab-pane>
            
                        <!-- 3. 问题记录 Tab (从页面底部移入) -->
                        <el-tab-pane label="问题记录" name="problemRecord" lazy>
                            <problem-record-table
                                v-if="activeTab === 'problemRecord'"
                                :record-id="Number(recordId)"
                                mode="reviewer">
                            </problem-record-table>
                        </el-tab-pane>
            
                        <!-- 4. 无文件时的提示信息 -->
                        <div v-if="!metaFile && excelFiles.length === 0" class="text-center text-muted p-5">
                            <h4>未找到任何可供审核的文件。</h4>
                        </div>
                    </el-tabs>
                </div>
            </div>
            </div>
        </div>
    `,

    // record-review-panel.js -> <script>

    data() {
        return {
            isLoading: true,
            recordInfo: null,
            loadError: null,
            allFiles: [],
            activeTab: '',
            isSaving: false,
            scrollTopBeforeClick: 0,
            currentLiveStats: null,
            currentSessionSeconds: 0,
            
            // --- 修正部分 ---
            isMetaDataLoading: false, 
            metaDataContent: null, // 统一使用这个变量存储元数据
            // 移除了重复的 metaData
        }
    },
    // 修改后
    computed: {
        excelFiles() {
            // 【【【 核心修正：增加安全检查 】】】
            // 1. 确保 allFiles 是一个数组
            if (!Array.isArray(this.allFiles)) {
                return [];
            }
            // 2. 在 filter 内部，首先确保 file 对象本身存在
            return this.allFiles.filter(file =>
                file && // <-- 确保 file 不是 null 或 undefined
                file.fileType &&
                (file.fileType.includes('spreadsheetml') || file.fileType.includes('excel'))
            );
        },
        metaFile() {
            if (!Array.isArray(this.allFiles)) {
                return null;
            }
            // 同样，增加对 file 对象的检查
            return this.allFiles.find(file => file && file.documentType === 'recordMeta');
        },
        activeFile() {
            if (this.activeTab === 'recordMeta') {
                return this.metaFile;
            }
            // 确保 excelFiles 存在
            if (this.excelFiles && this.excelFiles.length > 0) {
                return this.excelFiles.find(f => f.documentType === this.activeTab);
            }
            return null;
        }
    },
    methods: {
        lockScroll() {
            document.body.classList.add('body-scroll-lock');
        },

        /**
         * 【【【新增】】】 解锁父页面滚动
         */
        unlockScroll() {
            document.body.classList.remove('body-scroll-lock');
        },
        handleIframeFocus() {
            this.scrollTopBeforeFocus = window.scrollY || document.documentElement.scrollTop;
            setTimeout(() => {
                window.scrollTo(0, this.scrollTopBeforeFocus);
            }, 0);
        },
        // 修改后
        async fetchAllData() {
            if (!this.recordId) return;
            this.isLoading = true;
            this.loadError = null;
            try {
                console.log('[Review Panel] fetchAllData 开始执行...');
                const [recordResponse, filesResponse] = await Promise.all([
                    axios.get(`/api/process-records/${this.recordId}`),
                    axios.get(`/api/process-records/${this.recordId}/files`)
                ]);

                // 【【【 核心修正：原子化数据处理 】】】
                // 步骤 1：在局部变量中完成所有数据处理
                const rawFiles = filesResponse.data;
                let cleanedFiles = [];
                let newActiveTab = '';

                if (Array.isArray(rawFiles)) {
                    cleanedFiles = rawFiles
                        .filter(file => file && file.documentType) // 先过滤脏数据
                        .sort((a, b) => a.documentType.localeCompare(b.documentType, 'zh-Hans-CN'));
                } else {
                    console.error('[Review Panel] /files 接口返回的不是一个数组！');
                }

                // 从清洗过的数据中派生出 excelFiles 和 metaFile
                const excelFiles = cleanedFiles.filter(file => file.fileType && (file.fileType.includes('spreadsheetml') || file.fileType.includes('excel')));
                const metaFile = cleanedFiles.find(file => file.documentType === 'recordMeta');

                if (excelFiles.length > 0) {
                    newActiveTab = excelFiles[0].documentType;
                } else if (metaFile) {
                    newActiveTab = 'recordMeta';
                }

                // 步骤 2：【【【 一次性更新所有响应式数据 】】】
                // 这样做可以最大程度地避免渲染竞争条件
                console.log('[Review Panel] 准备一次性更新 data 属性...');
                this.recordInfo = recordResponse.data;
                this.allFiles = cleanedFiles;
                this.activeTab = newActiveTab; // 在同一个事件循环中更新 activeTab

                // 步骤 3：使用 $nextTick 确保 DOM 更新后再执行依赖 DOM 的操作（如果需要）
                this.$nextTick(() => {
                    console.log('[Review Panel] DOM 更新完成。最终状态:');
                    console.log('  -> this.allFiles:', JSON.parse(JSON.stringify(this.allFiles)));
                    console.log('  -> this.activeTab:', this.activeTab);
                    console.log('  -> computed excelFiles:', JSON.parse(JSON.stringify(this.excelFiles)));
                    console.log('  -> computed activeFile:', JSON.parse(JSON.stringify(this.activeFile)));
                });

            } catch (error) {
                this.loadError = "加载工作区数据失败：" + (error.response?.data?.message || error.message);
                console.error("[Review Panel] fetchAllData 失败:", error);
            } finally {
                this.isLoading = false;
            }
        },

        async fetchMetaData() {
            // 1. 安全检查：如果没有元数据文件记录，直接返回
            if (!this.metaFile) {
                console.warn("[Review Panel] 未找到元数据文件记录 (recordMeta)，无法加载。");
                return;
            }
        
            // 2. 缓存检查：如果已经有数据了，就不重复请求 (除非你想强制刷新)
            if (this.metaDataContent) return;
        
            this.isMetaDataLoading = true;
            console.log("[Review Panel] 正在加载元数据...", this.metaFile.filePath);
        
            try {
                // 3. 发起请求
                const fileUrl = `/api/files/content/${this.metaFile.id}`;
                // 添加时间戳防止浏览器缓存 GET 请求
                const response = await axios.get(`${fileUrl}?t=${new Date().getTime()}`);
        
                // 4. 数据解析与赋值 【核心修正点】
                let parsedData = null;
                if (typeof response.data === 'string') {
                    try {
                        parsedData = JSON.parse(response.data);
                    } catch (e) {
                        console.error("元数据 JSON 解析失败:", e);
                        throw new Error("元数据格式错误");
                    }
                } else {
                    parsedData = response.data;
                }
        
                // 赋值给模板正在使用的变量
                this.metaDataContent = parsedData;
                console.log("[Review Panel] 元数据加载成功:", this.metaDataContent);
        
            } catch (error) {
                console.error("加载元数据失败:", error);
                this.$message.error("加载表单元数据失败：" + (error.message || "网络错误"));
                // 设置一个空对象或错误提示对象，避免页面 v-if 报错
                this.metaDataContent = null; 
            } finally {
                this.isMetaDataLoading = false;
            }
        },

        loadSheetIntoIframe(fileInfo) {
            if (!fileInfo) return;
            const iframeRef = this.$refs['iframe-' + fileInfo.id];
            const targetIframe = Array.isArray(iframeRef) ? iframeRef[0] : iframeRef;

            if (targetIframe && targetIframe.contentWindow) {

                // ===== 您的滚动锁定逻辑 (保持不变) =====
                let lastScrollY = window.scrollY;
                const preventScroll = e => e.preventDefault();
                window.addEventListener('scroll', preventScroll, { passive: false });
                setTimeout(() => {
                    window.removeEventListener('scroll', preventScroll);
                    window.scrollTo(0, lastScrollY);
                }, 1500);

                const options = { allowUpdate: true, showtoolbar: true };

                // 【关键修改】在原始 URL 后面强制追加 `&format=json` (或 `?format=json`)
                // 这样 iframe 内部的加载器就会收到JSON，而不是二进制文件
                let fileUrl = `/api/files/content/${fileInfo.id}?t=${new Date().getTime()}`;
                if (fileUrl.includes('?')) {
                    fileUrl += '&format=json';
                } else {
                    fileUrl += '?format=json';
                }

                console.log(`[Parent Panel] 准备向 iframe 发送加载指令, 强制使用 JSON 格式, URL: ${fileUrl}`);

                const message = {
                    type: 'LOAD_SHEET',
                    payload: {
                        fileUrl: fileUrl, // 使用我们修改过的 URL
                        fileName: fileInfo.fileName,
                        options: { lang: 'zh', ...options }
                    }
                };

                // 发送消息给 iframe
                this.sendMessageToIframe(targetIframe, message);
            }
        },




        saveChanges() {
            // 1. 状态检查
            if (this.isSaving) {
                this.$message.warning('正在保存中，请稍候...');
                return;
            }

            // 2. 【核心修正】: 使用 activeTab (documentType) 来查找当前文件
            const currentFile = this.excelFiles.find(file => file.documentType === this.activeTab);
            if (!currentFile) {
                this.$message.error("当前没有活动的表格可供保存。");
                return;
            }

            // 3. 查找 iframe 实例
            const iframeRef = this.$refs['iframe-' + currentFile.id];
            const targetIframe = Array.isArray(iframeRef) ? iframeRef[0] : iframeRef;
            if (!targetIframe) {
                this.$message.error('找不到编辑器实例！');
                return;
            }

            // 4. 更新UI状态，并发送指令
            this.isSaving = true; // 在这里设置 isSaving
            this.$message.info(`正在从编辑器获取 "${currentFile.documentType}" 的最新数据...`);

            // 5. 【核心修正】: 使用统一、简单的 purpose
            this.sendMessageToIframe(targetIframe, {
                type: 'GET_DATA_AND_IMAGES',
                payload: {
                    purpose: 'save-draft', // 统一使用 'save-draft'
                    fileId: currentFile.id,
                    documentType: currentFile.documentType
                }
            });
        },

        /**
                 * 消息监听器，处理来自 iframe 的所有数据响应。
                 * 【最终修正版】：修正了数据源变量名，并统一了方法调用。
                 */
        async messageEventListener(event) {
            // 1. 统一的安全检查
            if (event.origin !== window.location.origin || !event.data || !event.data.type) {
                return;
            }

            console.log('[Parent Panel] 接收到 message 事件:', event.data);
            const { type, payload } = event.data;

            // =================================================================
            //  ↓↓↓ 分支 1: 处理“保存”操作的回调数据 ↓↓↓
            // =================================================================
            if (type === 'SHEET_DATA_WITH_IMAGES_RESPONSE') {

                // a. 验证 purpose 是否为保存操作
                if (!payload || payload.purpose !== 'save-draft') {
                    console.warn(`[Parent Panel] 收到的 purpose 不匹配 'save-draft'，已忽略。`);
                    return;
                }

                // b. 【【【 核心修正：使用正确的数据源 this.allFiles 】】】
                const currentFile = this.allFiles.find(file => file.id === payload.fileId);
                if (!currentFile) {
                    this.$message.error('保存失败：找不到与返回数据匹配的文件记录。');
                    this.isSaving = false;
                    return;
                }

                console.log(`[Parent Panel] ✅ Purpose 检查通过，开始保存文件: "${currentFile.fileName}"`);

                // c. 执行文件上传和后续操作
                // 注意：这里不再需要 this.isSaving = true，因为 saveChanges 方法已经设置过了
                try {
                    const exportBlob = await exportWithExcelJS(payload);
                    const formData = new FormData();
                    const fileName = currentFile.fileName || `${payload.documentType}.xlsx`;
                    formData.append('file', exportBlob, fileName);

                    const apiUrl = `/api/process-records/${this.recordId}/save-draft?fileId=${currentFile.id}`;
                    await axios.post(apiUrl, formData, { headers: { 'Content-Type': 'multipart/form-data' } });

                    this.$message.success(`文件 "${fileName}" 已成功保存！`);

                    // d. 【无感刷新逻辑】
                    console.log("[Parent Panel] 执行无感刷新，重新加载 iframe 内容...");
                    this.loadSheetIntoIframe(currentFile); // 【优化】统一方法名

                    // e. 【触发统计刷新】
                    this.currentLiveStats = null;
                    if (this.$refs.statusBarRef) {
                        this.$refs.statusBarRef.fetchSavedStats();
                    }

                } catch (error) {
                    this.$message.error("保存文件时出错！");
                    console.error("保存失败:", error);
                } finally {
                    this.isSaving = false; // 无论成功失败，都在这里结束加载状态
                }

                // =================================================================
                //  ↓↓↓ 分支 2: 处理实时统计更新的消息 ↓↓↓
                // =================================================================
            } else if (type === 'STATS_UPDATE') {

                console.log('[Parent Panel] 接收到实时统计更新:', payload);
                this.currentLiveStats = payload;

            }
        },

        exportCurrentSheet() {
            const currentFile = this.excelFiles.find(file => String(file.id) === this.activeTab);
            if (!currentFile) { this.$message.warning("没有可导出的活动文件。"); return; }
            const iframeRef = this.$refs['iframe-' + currentFile.id];
            const targetIframe = Array.isArray(iframeRef) ? iframeRef[0] : iframeRef;
            if (!targetIframe) return;
            const fileName = `${currentFile.fileName || 'export'}.xlsx`;
            this.sendMessageToIframe(targetIframe, { type: 'EXPORT_SHEET', payload: { fileName: fileName } });
        },

        approveRecord() {
            this.$confirm('您确定所有内容都已审核完毕，并批准此设计记录吗?', '批准确认', {
                confirmButtonText: '确定批准',
                cancelButtonText: '取消',
                type: 'success'
            })
                .then(async () => {
                    try {
                        // 【【【核心修改】】】
                        // 解开注释，调用后端API
                        await axios.post(`/api/process-records/${this.recordId}/approve`);

                        this.$message.success('操作成功，该记录已批准！');

                        // 操作成功后，可以返回列表页或刷新当前页
                        this.goBack(); // 调用已有的返回方法

                    } catch (error) {
                        this.$message.error('批准失败：' + (error.response?.data?.message || '未知错误'));
                        console.error("批准操作失败:", error);
                    }
                }).catch(() => {
                    this.$message.info('已取消操作');
                });
        },

        rejectRecord() {
            this.$prompt('请输入打回意见（必填）：', '打回修改', {
                confirmButtonText: '确定打回',
                cancelButtonText: '取消',
                inputPattern: /.+/, // 正则表达式，确保不为空
                inputErrorMessage: '打回意见不能为空'
            }).then(async ({ value }) => {
                try {
                    // 【【【核心修改】】】
                    // 解开注释，调用后端API，并传递comment
                    await axios.post(`/api/process-records/${this.recordId}/request-changes`, { comment: value });

                    this.$message.success('操作成功，该记录已打回修改！');

                    // 打回后，也返回列表页
                    this.goBack();

                } catch (error) {
                    this.$message.error('打回失败：' + (error.response?.data?.message || '未知错误'));
                    console.error("打回操作失败:", error);
                }
            }).catch(() => {
                this.$message.info('已取消操作');
            });
        },

        // 辅助方法
        sendMessageToIframe(iframe, message) {
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage(message, window.location.origin);
            }
        },
        formatDuration(totalSeconds) {
            if (totalSeconds == null || totalSeconds < 0) return '暂无记录';
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            let result = '';
            if (hours > 0) result += `${hours} 小时 `;
            if (minutes > 0) result += `${minutes} 分钟 `;
            if (seconds > 0 || result === '') result += `${seconds} 秒`;
            return result.trim();
        },
        handleTabClick(tab) {
            if (tab.name === 'recordMeta') {
                this.fetchMetaData(); // 调用修正后的方法
            }
        },
        goBack() {
            this.$emit('back-to-review-tasks');
        },
        handleIframeBlur() {
            // 我们不需要记录和恢复滚动位置，因为那太复杂了。
            // 我们直接找到页面上一个固定且不会引起滚动的元素，比如页面的主标题。
            // 如果您的页面标题有一个ID，那是最好的。如果没有，我们可以用 class 来查找。

            // 尝试找到页面主标题的DOM元素
            // 这里的选择器 '.page-title' 需要根据您 index.html 的实际结构来定
            const mainTitle = document.querySelector('.main-panel .page-header .page-title');

            if (mainTitle) {
                // 为了让一个普通元素能获得焦点，我们需要临时给它设置 tabindex
                mainTitle.setAttribute('tabindex', '-1');
                mainTitle.focus();
                mainTitle.removeAttribute('tabindex'); // 获得焦点后马上移除，避免影响页面行为
                console.log('Iframe lost focus. Focus returned to main title.');
            } else {
                // 如果找不到标题，就用我们之前那个隐藏的 "焦点捕获器"
                const focusCatcher = document.getElementById('focus-catcher');
                if (focusCatcher) {
                    focusCatcher.focus();
                    console.log('Iframe lost focus. Focus returned to focus-catcher.');
                }
            }
        },

    },
    // 在 record-review-panel.js 中

    // 在 record-review-panel.js 中

    mounted() {
        console.log('[INIT] 启动带敌我识别的终极滚动守护神...');

        // 【步骤1】初始化状态对象
        this._scrollGuardian = {
            // 【关键】这个变量记录的不是一个固定的值，而是【上一帧】的滚动位置
            lastKnownScrollY: window.scrollY || document.documentElement.scrollTop,

            // 【关键】敌我识别标志位
            isUserScrolling: false,

            scrollTimeoutId: null,
            animationFrameId: null
        };

        // 【步骤2】定义守护循环
        const guardianLoop = () => {
            if (this && this._scrollGuardian) {
                const currentScrollY = window.scrollY;

                // 【【【核心逻辑】】】
                if (this._scrollGuardian.isUserScrolling) {
                    // 如果是用户在滚动，我们不干涉，只更新记录
                    this._scrollGuardian.lastKnownScrollY = currentScrollY;
                } else {
                    // 如果不是用户在滚动，但位置却变了，这就是“坏的滚动”！
                    if (currentScrollY !== this._scrollGuardian.lastKnownScrollY) {
                        console.warn(`[GUARDIAN] 检测到未授权滚动！强行恢复到: ${this._scrollGuardian.lastKnownScrollY}`);
                        window.scrollTo(0, this._scrollGuardian.lastKnownScrollY);
                    }
                }
                this._scrollGuardian.animationFrameId = requestAnimationFrame(guardianLoop);
            }
        };

        // 【步骤3】启动守护循环
        guardianLoop();

        // 【步骤4】为“敌我识别系统”添加滚轮事件监听器
        // 这个监听器只负责一件事：在用户滚动滚轮时，举起“自己人”的牌子
        this.handleWheel = () => {
            // 举起牌子：告诉守护神，现在是我在滚，别开枪！
            this._scrollGuardian.isUserScrolling = true;

            // 清除之前的“放下牌子”定时器
            clearTimeout(this._scrollGuardian.scrollTimeoutId);

            // 设置一个新的定时器：如果200毫秒内没再滚动，就自动放下牌子
            this._scrollGuardian.scrollTimeoutId = setTimeout(() => {
                this._scrollGuardian.isUserScrolling = false;
                console.log('[GUARDIAN] 用户停止滚动，守护模式已恢复。');
            }, 200);
        };

        // 将滚轮监听器绑定到整个 window 上，这样无论鼠标在哪里都能捕捉到
        window.addEventListener('wheel', this.handleWheel, { passive: true });

        // --- 您已有的其他 mounted 逻辑 ---
        this.boundMessageListener = this.messageEventListener.bind(this);
        window.addEventListener('message', this.boundMessageListener);

    },

    beforeDestroy() {
        console.log('[CLEANUP] 停止终极滚动守护神...');

        if (this._scrollGuardian) {
            cancelAnimationFrame(this._scrollGuardian.animationFrameId);
            clearTimeout(this._scrollGuardian.scrollTimeoutId);
        }

        // 【【【核心清理】】】 必须移除全局的滚轮监听器
        window.removeEventListener('wheel', this.handleWheel);

        // --- 您已有的其他 beforeDestroy 逻辑 ---
        window.removeEventListener('message', this.boundMessageListener);
    },
    watch: {
        recordId: {
            immediate: true,
            handler(newId) {
                if (newId) {
                    this.fetchAllData();
                }
            }
        },

        activeTab(newTabName, oldTabName) {
            if (newTabName && newTabName !== oldTabName) {
                if (newTabName === 'recordMeta') {
                    this.fetchMetaData(); // 调用修正后的方法
                }
            }
        }
    }
});