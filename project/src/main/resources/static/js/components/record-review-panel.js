import { exportWithExcelJS } from '/js/utils/luckysheetExporter.js';

Vue.component('record-review-panel', {
    components: {
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
            <div class="content-wrapper" style="height:100%;width:100%">
                

                <!-- 2. 【核心修改】布局变为单栏，并添加新的操作按钮 -->
                <el-row>
                    <el-col :span="24">
                        <div class="card">
                            <div class="card-body">
                                <div class="d-flex justify-content-between align-items-center mb-3">
                                    <div>
                                        <h4 class="card-title mb-0">设计记录表审核工作区</h4>
                                        <p class="card-description mb-0">可直接在下方表格中进行批注和修改。</p>
                                    </div>
                                    <div>
                                        <el-button-group>
                                            <el-button type="primary" @click="saveChanges" :loading="isSaving" icon="el-icon-document-checked">保存修改</el-button>
                                            <el-button type="success" @click="exportCurrentSheet" icon="el-icon-download">导出当前表格</el-button>
                                        </el-button-group>
                                        <el-button-group style="margin-left: 10px;">
                                            <el-button @click="approveRecord" type="success" icon="el-icon-check">批准</el-button>
                                            <el-button @click="rejectRecord" type="danger" icon="el-icon-close">打回修改</el-button>
                                        </el-button-group>
                                    </div>
                                </div>
            
                                <el-tabs v-model="activeTab" type="border-card">
                                    <el-tab-pane v-if="metaFile" label="表单元数据" name="recordMeta" lazy>
                                        <!-- 【【【用下面的内容替换掉旧的 <div>】】】 -->
                                        <div class="p-4" v-if="metaData">
                                            <el-descriptions title="详细规格信息" :column="3" border>
                                                <el-descriptions-item label="制件材质">{{ metaData.material || 'N/A' }}</el-descriptions-item>
                                                <el-descriptions-item label="制件料厚">{{ metaData.thickness || 'N/A' }} mm</el-descriptions-item>
                                                <el-descriptions-item label="抗拉强度">{{ metaData.tensileStrength || 'N/A' }} MPa</el-descriptions-item>
                                                <el-descriptions-item label="客户名称">{{ metaData.customerName || 'N/A' }}</el-descriptions-item>
                                                <el-descriptions-item label="模具图号" :span="2">{{ metaData.moldDrawingNumber || 'N/A' }}</el-descriptions-item>
                                                <el-descriptions-item label="使用设备">{{ metaData.equipment || 'N/A' }}</el-descriptions-item>
                                            </el-descriptions>
                                            
                                            <el-descriptions title="人员信息" :column="3" border class="mt-4">
                                                <el-descriptions-item label="设计人员">{{ metaData.designerName || 'N/A' }}</el-descriptions-item>
                                                <el-descriptions-item label="日期">{{ metaData.designerDate || 'N/A' }}</el-descriptions-item>
                                                <el-descriptions-item label="校对人员">{{ metaData.checkerName || 'N/A' }}</el-descriptions-item>
                                                <el-descriptions-item label="日期">{{ metaData.checkerDate || 'N/A' }}</el-descriptions-item>
                                                <el-descriptions-item label="审核人员">{{ metaData.auditorName || 'N/A' }}</el-descriptions-item>
                                                <el-descriptions-item label="日期">{{ metaData.auditorDate || 'N/A' }}</el-descriptions-item>
                                            </el-descriptions>
                                    
                                            <el-descriptions title="尺寸与重量" :column="4" border class="mt-4">
                                                <el-descriptions-item label="报价 长度">{{ metaData.quoteSize ? metaData.quoteSize.length : 'N/A' }} mm</el-descriptions-item>
                                                <el-descriptions-item label="报价 宽度">{{ metaData.quoteSize ? metaData.quoteSize.width : 'N/A' }} mm</el-descriptions-item>
                                                <el-descriptions-item label="报价 高度">{{ metaData.quoteSize ? metaData.quoteSize.height : 'N/A' }} mm</el-descriptions-item>
                                                <el-descriptions-item label="报价 重量">{{ metaData.quoteWeight || 'N/A' }} T</el-descriptions-item>
                                                <el-descriptions-item label="实际 长度">{{ metaData.actualSize ? metaData.actualSize.length : 'N/A' }} mm</el-descriptions-item>
                                                <el-descriptions-item label="实际 宽度">{{ metaData.actualSize ? metaData.actualSize.width : 'N/A' }} mm</el-descriptions-item>
                                                <el-descriptions-item label="实际 高度">{{ metaData.actualSize ? metaData.actualSize.height : 'N/A' }} mm</el-descriptions-item>
                                                <el-descriptions-item label="实际 重量">{{ metaData.actualWeight || 'N/A' }} T</el-descriptions-item>
                                            </el-descriptions>
                                        </div>
                                        <div v-else class="p-4 text-muted">
                                            正在加载元数据...
                                        </div>
                                    </el-tab-pane>
                                    <el-tab-pane
                                        v-for="file in excelFiles"
                                        :key="file.id"
                                        :label="file.documentType"
                                        :name="String(file.id)"
                                        lazy
                                        
                                        @mouseover.native="lockScroll"
                                        @mouseleave.native="unlockScroll"
                                    >
                                    <div style="height: 70vh; overflow: hidden;">
                                        <iframe v-if="activeTab === String(file.id)"
                                            :ref="'iframe-' + file.id"
                                            src="/luckysheet-iframe-loader.html"
                                            @load="() => loadSheetIntoIframe(file)"
                                            style="width: 100%; height: 100%; border: none;">
                                        </iframe>
                                    </div>
                                
                                    </el-tab-pane>
                                    <div v-if="!metaFile && excelFiles.length === 0" class="text-center text-muted p-5">
                                        <h4>未找到任何可供审核的文件。</h4>
                                    </div>
                                </el-tabs>
                            </div>
                        </div>
                    </el-col>
                </el-row>

\
                <problem-record-table
                    v-if="recordId"
                    :record-id="Number(recordId)">
                </problem-record-table>
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
            metaData: null,
            scrollTopBeforeClick: 0 
            // 【【【确保这里没有 scrollTopBeforeFocus, _scrollLock, iframeIsActive 等任何东西】】】
        }
    },
    computed: {
        excelFiles() {
            return this.allFiles.filter(file =>
                file.fileType && (file.fileType.includes('spreadsheetml') || file.fileType.includes('excel'))
            );
        },
        metaFile() {
            return this.allFiles.find(file => file.documentType === 'recordMeta');
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
        async fetchAllData() {
            if (!this.recordId) return;
            this.isLoading = true;
            this.loadError = null;
            try {
                const [recordResponse, filesResponse] = await Promise.all([
                    axios.get(`/api/process-records/${this.recordId}`),
                    axios.get(`/api/process-records/${this.recordId}/files`)
                ]);
                this.recordInfo = recordResponse.data;
                this.allFiles = (filesResponse.data || []).sort((a, b) => a.documentType.localeCompare(b.documentType));
                if (this.excelFiles.length > 0) {
                    this.activeTab = String(this.excelFiles[0].id);
                } else if (this.metaFile) {
                    this.activeTab = 'recordMeta';
                    // 立即获取元数据，因为 watch 不会立即触发
                    this.$nextTick(() => {
                        this.fetchMetaData();
                    });
                }
            } catch (error) {
                this.loadError = "加载工作区数据失败：" + (error.response?.data?.message || error.message);
            } finally {
                this.isLoading = false;
            }
        },

        async fetchMetaData() {
            if (!this.metaFile) {
                console.warn("No meta file found to fetch.");
                return;
            }

            // 如果已经加载过，就不再重复请求
            if (this.metaData) return;

            console.log("Fetching meta data from:", this.metaFile.filePath);
            try {
                // 直接使用文件ID构造内容获取URL
                const fileUrl = `/api/files/content/${this.metaFile.id}`;
                const response = await axios.get(fileUrl);

                // 后端返回的可能是JSON字符串，也可能是对象，我们做兼容处理
                if (typeof response.data === 'string') {
                    this.metaData = JSON.parse(response.data);
                } else {
                    this.metaData = response.data;
                }
                console.log("Meta data loaded and parsed:", this.metaData);

            } catch (error) {
                console.error("Failed to fetch or parse meta data:", error);
                this.$message.error("加载表单元数据失败！");
            }
        },

        loadSheetIntoIframe(fileInfo) {
            if (!fileInfo) return;
            const iframeRef = this.$refs['iframe-' + fileInfo.id];
            const targetIframe = Array.isArray(iframeRef) ? iframeRef[0] : iframeRef;
        
            if (targetIframe && targetIframe.contentWindow) {
        
                // ===== 新增：锁定 window.scrollY =====
                let lastScrollY = window.scrollY;
        
                // 阻止 window 在 iframe 渲染期间滚动
                const preventScroll = e => e.preventDefault();
                window.addEventListener('scroll', preventScroll, { passive: false });
        
                // 渲染完成后恢复滚动（这里用 1.5s 假设 Luckysheet 完成初始化）
                setTimeout(() => {
                    window.removeEventListener('scroll', preventScroll);
                    window.scrollTo(0, lastScrollY);
                    console.log('[FIX] window.scrollY 恢复到', lastScrollY);
                }, 1500);
        
                // ===== 原有 Luckysheet 加载逻辑 =====
                const options = { allowUpdate: true, showtoolbar: true };
                const fileUrl = `/api/files/content/${fileInfo.id}?t=${new Date().getTime()}`;
                const message = {
                    type: 'LOAD_SHEET',
                    payload: { fileUrl, fileName: fileInfo.fileName, options: { lang: 'zh', ...options } }
                };
                this.sendMessageToIframe(targetIframe, message);
            }
        },
        
        
        

        saveChanges() {
            const currentFile = this.excelFiles.find(file => String(file.id) === this.activeTab);
            if (!currentFile) { this.$message.error("没有活动的表格可供保存。"); return; }

            const iframeRef = this.$refs['iframe-' + currentFile.id];
            const targetIframe = Array.isArray(iframeRef) ? iframeRef[0] : iframeRef;
            if (!targetIframe) { this.$message.error('找不到编辑器实例！'); return; }

            // 【修改】: 在这里不再设置 isSaving=true
            // this.isSaving = true;
            this.$message.info("正在生成文件...");

            this.sendMessageToIframe(targetIframe, {
                type: 'GET_DATA_AND_IMAGES',
                payload: { purpose: `update-file-${currentFile.id}` }
            });
        },

        async messageEventListener(event) {
            if (event.origin !== window.location.origin || event.data.type !== 'SHEET_DATA_WITH_IMAGES_RESPONSE') return;
            
            const { payload } = event.data;
            const currentFile = this.excelFiles.find(file => String(file.id) === this.activeTab);
            if (!payload || !currentFile || payload.purpose !== `update-file-${currentFile.id}`) return;

            // 【【【核心修改】】】
            this.isSaving = true; // 在开始上传时，设置加载状态
            try {
                const exportBlob = await exportWithExcelJS(payload);
                const formData = new FormData();
                formData.append('file', exportBlob, currentFile.fileName);
                
                const apiUrl = `/api/process-records/${this.recordId}/files/${currentFile.id}`;
                await axios.post(apiUrl, formData, { headers: { 'Content-Type': 'multipart/form-data' } });

                this.$message.success(`文件 "${currentFile.fileName}" 已成功保存！`);

                // --- 【【【无感刷新逻辑】】】 ---
                // 1. 不再调用 this.fetchAllData()
                // this.fetchAllData(); 

                // 2. 而是直接调用 loadSheetIntoIframe 方法，
                //    并传入当前激活的文件信息。
                //    这会命令 iframe 重新从后端加载最新的文件内容，
                //    而不会重新渲染 iframe 标签本身。
                console.log("执行无感刷新，重新加载 iframe 内容...");
                this.loadSheetIntoIframe(currentFile);

            } catch (error) {
                this.$message.error("保存文件时出错！");
                console.error("保存失败:", error);
            } finally {
                this.isSaving = false; // 无论成功失败，都结束加载状态
            }
            if (event.origin !== window.location.origin || !event.data) return;

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
            // 当用户点击 "表单元数据" Tab时，触发数据加载
            if (tab.name === 'recordMeta') {
                this.fetchMetaData();
            }
            // 对于Excel文件Tab，loadSheetIntoIframe 会在iframe的 @load 事件中自动触发
        },
        goBack() {
            this.$emit('back-to-list');
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
        // 【【【新增】】】
        activeTab(newTabName, oldTabName) {
            if (newTabName && newTabName !== oldTabName) {
                if (newTabName === 'recordMeta') {
                    this.fetchMetaData();
                }
                // 对于Excel Tab，加载会在 iframe 的 @load 事件中自动触发，所以这里不需要额外操作
            }
        }
    }
});