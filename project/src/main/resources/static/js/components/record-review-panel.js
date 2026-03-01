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
            <div v-if="isLoading" class="card">
                <div class="card-body text-center p-5">
                    <p>正在加载审核工作区...</p>
                    <el-progress :percentage="100" status="success" :indeterminate="true" :duration="1"></el-progress>
                </div>
            </div>
            <div v-else-if="loadError" class="alert alert-danger">{{ loadError }}</div>
            
            <div v-else-if="recordInfo">
                
                <div class="card mb-3">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center">
                            <div style="flex-grow: 1; margin-right: 20px;">
                                <workspace-status-bar
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
                            
                            <el-button @click="goBack" icon="el-icon-back" plain size="small">返回列表</el-button>
                        </div>
                    </div>
                </div>

                <div class="card" v-if="!showFullscreen" style="min-height: 600px; display: flex; align-items: center; justify-content: center; background-color: #f8f9fa;">
                    <div class="card-body w-100 d-flex flex-column align-items-center justify-content-center" style="padding: 40px;">
                        
                        <div class="text-center mb-4">
                            <div class="mb-3 d-inline-block p-3 rounded-circle" style="background: #ecf5ff;">
                                <i class="el-icon-s-check" style="font-size: 48px; color: #409EFF;"></i>
                            </div>
                            <h2 style="font-weight: 700; color: #303133; margin-bottom: 10px;">审核工作台</h2>
                            <p class="text-muted" style="font-size: 14px; margin: 0;">
                                待审核内容包含 <span class="text-primary font-weight-bold" style="font-size: 16px;">{{ excelFiles.length }}</span> 个 Excel 文件及相关表单数据
                            </p>
                        </div>

                        <div class="mb-5">
                            <el-button 
                                type="primary" 
                                size="medium" 
                                icon="el-icon-full-screen" 
                                round
                                style="
                                    background: linear-gradient(135deg, #409EFF 0%, #0575E6 100%);
                                    border: none;
                                    font-weight: 800;
                                    letter-spacing: 1px;
                                    padding: 14px 50px;
                                    box-shadow: 0 8px 20px rgba(64, 158, 255, 0.4);
                                    font-size: 16px;
                                    transform: translateY(0);
                                    transition: all 0.3s;
                                "
                                @mouseover.native="$event.target.style.transform = 'translateY(-2px)'"
                                @mouseleave.native="$event.target.style.transform = 'translateY(0)'"
                                @click="showFullscreen = true">
                                进入审核工作台
                            </el-button>
                        </div>
            
                        <div class="w-100" style="max-width: 650px;">
                            
                            <div v-if="excelFiles.length === 0" class="text-center text-muted p-4 border rounded dashed" style="background: #fafafa;">
                                暂无需要审核的文件
                            </div>
                
                            <div v-else class="d-flex flex-column" style="gap: 12px;">
                                <div v-for="file in excelFiles" 
                                    :key="file.id" 
                                    class="bg-white rounded border d-flex align-items-center text-left shadow-sm hover-effect" 
                                    style="padding: 16px 20px; border-left: 5px solid #409EFF !important; transition: all 0.3s;"
                                > 
                                    <div class="mr-3 pt-1" style="flex-shrink: 0;">
                                        <i class="el-icon-s-grid text-primary" style="font-size: 24px;"></i>
                                    </div>
                
                                    <div style="flex-grow: 1; overflow: hidden;">
                                        <div class="text-truncate" style="font-size: 15px; font-weight: 600; color: #303133; margin-bottom: 4px;" :title="file.fileName || file.documentType">
                                            {{ file.documentType }} <span v-if="file.fileName" class="text-muted font-weight-normal">({{ file.fileName }})</span>
                                        </div>
                                        <div class="text-muted" style="font-size: 12px;">
                                            <i class="el-icon-document"></i> 
                                            <span v-if="file.fileSize"> {{ (file.fileSize / 1024).toFixed(2) }} KB</span>
                                            <span v-else> 待审核文件</span>
                                        </div>
                                    </div>
                                    
                                    <div class="ml-3 text-muted">
                                        <i class="el-icon-view" style="font-size: 18px;"></i>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                <el-dialog 
                    :visible.sync="showFullscreen" 
                    fullscreen 
                    :show-close="false"
                    custom-class="reader-dialog" 
                    append-to-body>

                    <div slot="title" class="reader-header d-flex justify-content-between align-items-center">
                        <div class="d-flex align-items-center">
                            <div class="logo-area mr-3">
                                <i class="el-icon-s-check text-white" style="font-size: 24px;"></i>
                            </div>
                            <div class="text-white">
                                <div style="font-size: 16px; font-weight: bold; letter-spacing: 1px;">过程记录审核</div>
                                <div style="font-size: 12px; opacity: 0.8;">
                                    {{ recordInfo.partName }} 
                                    <span class="ml-2" style="background: rgba(255,255,255,0.2); padding: 0 5px; border-radius: 2px;">{{ recordInfo.status }}</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <el-tooltip content="导出当前文件" placement="bottom" v-if="activeTab !== 'recordMeta'">
                                <el-button type="text" class="text-white mr-3" icon="el-icon-download" @click="exportCurrentSheet">导出</el-button>
                            </el-tooltip>
                            
                            <el-divider direction="vertical"></el-divider>

                            <el-button type="text" class="text-white mr-2" icon="el-icon-document-checked" @click="saveChanges" :loading="isSaving">保存修改</el-button>
                            <el-button type="text" class="text-danger mr-2" icon="el-icon-close" @click="rejectRecord">打回</el-button>
                            <el-button type="text" class="text-success mr-3" icon="el-icon-check" @click="approveRecord">批准</el-button>

                            <el-button type="danger" size="small" icon="el-icon-close" circle @click="showFullscreen = false" style="margin-left: 10px;"></el-button>
                        </div>
                    </div>

                    <div class="reader-body" style="background: #fff; height: 100%; display: flex; flex-direction: row; overflow: hidden;">
                        
                        <div class="reader-sidebar" style="width: 260px; border-right: 1px solid #e4e7ed; display: flex; flex-direction: column; background-color: #f5f7fa; flex-shrink: 0;">
                            <div class="sidebar-title" style="height: 50px; line-height: 50px; padding: 0 20px; font-weight: bold; color: #606266; border-bottom: 1px solid #ebeef5; background: #fff;">
                                <i class="el-icon-menu"></i> 审核目录 ({{ 2 + excelFiles.length }})
                            </div>
                            
                            <div class="file-list" style="flex: 1; overflow-y: auto; padding: 10px 0;">
                                <div class="file-item" :class="{ 'active': activeTab === 'recordMeta' }" @click="activeTab = 'recordMeta'">
                                    <div class="d-flex align-items-center w-100">
                                        <i class="el-icon-info mr-2" style="color: #909399;"></i>
                                        <span class="file-name text-truncate">表单元数据</span>
                                    </div>
                                </div>
                                <div class="file-item" :class="{ 'active': activeTab === 'problemRecord' }" @click="activeTab = 'problemRecord'">
                                    <div class="d-flex align-items-center w-100">
                                        <i class="el-icon-warning-outline mr-2" style="color: #E6A23C;"></i>
                                        <span class="file-name text-truncate">问题记录</span>
                                    </div>
                                </div>

                                <div style="height: 1px; background: #ebeef5; margin: 8px 15px;"></div>
                                <div style="padding: 5px 20px; font-size: 12px; color: #909399;">项目策划书 (参考)</div>
                                
                                <div v-for="mainDoc in planningDocs" :key="'group-' + mainDoc.id" class="planning-group">
                                    <div class="file-item" @click="togglePlanningGroup(mainDoc.id)" style="background: #f8f9fb; font-weight: bold; border-bottom: 1px solid #eee;">
                                        <i :class="expandedPlanningGroups[mainDoc.id] ? 'el-icon-folder-opened' : 'el-icon-folder'" class="mr-2 text-warning"></i>
                                        <span class="file-name text-truncate" style="flex: 1;">{{ getCleanPlanningName(mainDoc.fileName) }}</span>
                                        <i :class="expandedPlanningGroups[mainDoc.id] ? 'el-icon-arrow-down' : 'el-icon-arrow-right'" style="font-size: 12px; color: #909399;"></i>
                                    </div>
                                
                                    <el-collapse-transition>
                                        <div v-show="expandedPlanningGroups[mainDoc.id]" style="background: #fff;">
                                            <div v-for="child in getChildDocs(mainDoc.id)" 
                                                 :key="'child-' + child.id"
                                                 class="file-item"
                                                 :class="{ 'active': activeTab === 'plan-child-' + child.id }"
                                                 style="padding-left: 45px; font-size: 13px; border-bottom: 1px solid #f9f9f9;"
                                                 @click="activeTab = 'plan-child-' + child.id; handleTabClick({name: 'plan-child-' + child.id})">
                                                <i class="el-icon-document mr-2" style="color: #67C23A;"></i>
                                                <span class="file-name text-truncate">{{ child.fileName }}</span>
                                            </div>
                                        </div>
                                    </el-collapse-transition>
                                </div>

                                <div v-for="file in excelFiles" :key="file.id" class="file-item" :class="{ 'active': activeTab === file.documentType }" @click="activeTab = file.documentType">
                                    <div class="d-flex align-items-center w-100">
                                        <i class="el-icon-s-grid mr-2 text-primary"></i>
                                        <span class="file-name text-truncate" :title="file.fileName">{{ file.documentType }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="reader-content" style="flex: 1; height: 100%; position: relative; overflow: hidden; background: #fff;">
                            
                            <div v-if="activeTab === 'recordMeta'" class="scrollable-tab-content">
                                <div v-if="isMetaDataLoading" class="text-center p-5">正在加载元数据...</div>
                                <div v-else-if="metaDataContent" class="p-4">
                                    <el-alert title="原始表单数据" type="info" class="mb-3" :closable="false" description="这是创建此记录时提交的所有表单信息的备份。此内容为只读。"></el-alert>
                                    
                                    <el-form :model="metaDataContent" label-width="120px" label-position="right">
                                        <el-row :gutter="20">
                                            <el-col :span="12"><el-form-item label="零件名称"><el-input :value="metaDataContent.partName" disabled></el-input></el-form-item></el-col>
                                            <el-col :span="12"><el-form-item label="工序名称"><el-input :value="metaDataContent.processName" disabled></el-input></el-form-item></el-col>
                                        </el-row>
                                        
                                        <el-divider>详细规格信息</el-divider>
                                        
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
                                            <el-col :span="12"><el-form-item label="使用设备 (主线)"><el-input :value="metaDataContent.equipment" disabled></el-input></el-form-item></el-col>
                                            <el-col :span="12"><el-form-item label="使用设备 (副线)"><el-input :value="metaDataContent.subEquipment || '无'" disabled></el-input></el-form-item></el-col>
                                        </el-row>
                                        
                                        <el-divider>人员信息</el-divider>
                        
                                        <el-row :gutter="20">
                                            <el-col :span="12"><el-form-item label="设计人员"><el-input :value="metaDataContent.designerName" disabled></el-input></el-form-item></el-col>
                                            <el-col :span="12"><el-form-item label="日期"><el-date-picker type="date" :value="metaDataContent.designerDate" style="width: 100%;" disabled></el-date-picker></el-form-item></el-col>
                                        </el-row>
                                        <el-row :gutter="20">
                                            <el-col :span="12"><el-form-item label="校对人员"><el-input v-if="metaDataContent.checkerName" :value="metaDataContent.checkerName" disabled></el-input><el-input v-else placeholder="待校对" disabled></el-input></el-form-item></el-col>
                                            <el-col :span="12"><el-form-item label="日期"><el-date-picker v-if="metaDataContent.checkerDate" type="date" :value="metaDataContent.checkerDate" style="width: 100%;" disabled></el-date-picker><el-input v-else placeholder="待校对" disabled></el-input></el-form-item></el-col>
                                        </el-row>
                                        <el-row :gutter="20">
                                            <el-col :span="12"><el-form-item label="审核人员"><el-input v-if="metaDataContent.auditorName" :value="metaDataContent.auditorName" disabled></el-input><el-input v-else placeholder="待审核" disabled></el-input></el-form-item></el-col>
                                            <el-col :span="12"><el-form-item label="日期"><el-date-picker v-if="metaDataContent.auditorDate" type="date" :value="metaDataContent.auditorDate" style="width: 100%;" disabled></el-date-picker><el-input v-else placeholder="待审核" disabled></el-input></el-form-item></el-col>
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
                                        <el-form-item label="报价 重量"><el-input :value="metaDataContent.quoteWeight" placeholder="重量" disabled><template slot="append">T</template></el-input></el-form-item>
                        
                                        <el-form-item label="实际 尺寸">
                                            <el-row :gutter="10" v-if="metaDataContent.actualSize">
                                                <el-col :span="7"><el-input :value="metaDataContent.actualSize.length" placeholder="长度(mm)" disabled></el-input></el-col>
                                                <el-col :span="1" class="text-center">X</el-col>
                                                <el-col :span="7"><el-input :value="metaDataContent.actualSize.width" placeholder="宽度(mm)" disabled></el-input></el-col>
                                                <el-col :span="1" class="text-center">X</el-col>
                                                <el-col :span="7"><el-input :value="metaDataContent.actualSize.height" placeholder="高度(mm)" disabled></el-input></el-col>
                                            </el-row>
                                        </el-form-item>
                                        <el-form-item label="实际 重量"><el-input :value="metaDataContent.actualWeight" placeholder="重量" disabled><template slot="append">T</template></el-input></el-form-item>
                                    </el-form>
                                </div>
                            </div>

                            <div v-if="activeTab === 'problemRecord'" class="scrollable-tab-content">
                                <problem-record-table
                                    :record-id="Number(recordId)"
                                    :mode="reviewer" 
                                    @trigger-submit="handleTriggerReview">
                                </problem-record-table>
                            </div>

                            <div v-if="activeTab && activeTab.startsWith('plan-child-') && activeFile" 
                                :key="'plan-render-' + activeTab" 
                                style="width: 100%; height: 100%;">
                                <iframe
                                    :ref="'iframe-' + activeFile.id"
                                    src="/luckysheet-iframe-loader.html" 
                                    @load="() => loadSheetIntoIframe(activeFile)"
                                    style="width: 100%; height: 100%; border: none; display: block;">
                                </iframe>
                            </div>

                            <div v-for="file in excelFiles" :key="file.id" v-show="activeTab === file.documentType" style="width: 100%; height: 100%;">
                                <iframe
                                    :ref="'iframe-' + file.id"
                                    src="/luckysheet-iframe-loader.html" 
                                    @load="() => loadSheetIntoIframe(file)"
                                    style="width: 100%; height: 100%; border: none; display: block;">
                                </iframe>
                            </div>

                        </div>
                    </div>
                </el-dialog>
            </div>
        </div>
    `,

    // record-review-panel.js -> <script>

    data() {
        return {
            showFullscreen: false,
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
            planningDocs: [],             // 存放主策划书文件
            allProjectFiles: [],          // 存放项目下所有文件（用于找子Sheet）
            expandedPlanningGroups: {},   // 控制策划书目录的折叠状态
            showFullscreen: false,
        }
    },
    // 修改后
    computed: {
        // 【核心修复】动态判断问题面板的模式 (支持 Admin 超级模式)
        // 【核心修复 + 调试版】动态判断问题面板的模式
        // 【核心修复】更强壮的用户获取逻辑
        problemPanelMode() {
            // 🔥🔥🔥 1. 全方位尝试获取用户数据 🔥🔥🔥
            let user = {};

            try {
                // 尝试 1: 全局变量 (有些老系统用这个)
                if (window.currentUser) user = window.currentUser;

                // 尝试 2: sessionStorage (Key 可能是 'user' 或 'userInfo')
                else if (sessionStorage.getItem('user')) user = JSON.parse(sessionStorage.getItem('user'));
                else if (sessionStorage.getItem('userInfo')) user = JSON.parse(sessionStorage.getItem('userInfo'));

                // 尝试 3: localStorage (最常见的情况，Key 可能是 'user' 或 'userInfo')
                else if (localStorage.getItem('user')) user = JSON.parse(localStorage.getItem('user'));
                else if (localStorage.getItem('userInfo')) user = JSON.parse(localStorage.getItem('userInfo'));

                // 尝试 4: Vuex (如果你用了 Vuex)
                // else if (this.$store && this.$store.state.user) user = this.$store.state.user;

            } catch (e) {
                console.error("解析用户信息失败:", e);
            }

            // 🔥🔥🔥 [调试信息] 🔥🔥🔥
            console.group("🕵️‍♂️ [权限调试 - 修复版]");
            console.log("1. 捕获到的用户对象:", user);
            console.log("   -> 角色:", user.role || user.roles); // 有些系统用 roles 数组
            console.log("   -> 用户名:", user.username || user.name);

            // 2. 判断是否是管理员/经理
            // 注意：增加对 'manager' 或其他大小写变体的兼容
            const role = (user.role || '').toLowerCase(); // 转小写比较更安全
            const isManager = role === 'admin' || role === 'manager' || role === 'administrator';

            console.log(`2. 管理员判定 (isManager): ${isManager} (当前角色: ${role})`);

            if (isManager) {
                console.log("✅ 匹配管理员，返回 'admin'");
                console.groupEnd();
                return 'admin';
            }

            // 3. 判断是否是指定审核人
            const currentUserName = user.username || user.name;
            const auditorName = this.recordInfo ? this.recordInfo.auditorName : '';
            const isAuditor = currentUserName && auditorName && currentUserName === auditorName;

            if (isAuditor) {
                console.log("✅ 匹配审核人，返回 'reviewer'");
                console.groupEnd();
                return 'reviewer';
            }

            // 4. 默认
            console.log("⬇️ 无权限，返回 'designer'");
            console.groupEnd();
            return 'designer';
        },
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
            if (this.activeTab === 'recordMeta') return this.metaFile;
            // 1. 先从过程记录的 excelFiles 中找
            let file = this.excelFiles.find(f => f.documentType === this.activeTab);
            // 2. 🔥 如果没找到，且是策划书子项，从 allProjectFiles 里通过 ID 找
            if (!file && this.activeTab && this.activeTab.startsWith('plan-child-')) {
                const id = this.activeTab.replace('plan-child-', '');
                file = this.allProjectFiles.find(f => f.id.toString() === id);
            }
            return file;
        },
    },
    methods: {
        async handleTriggerReview() {
            this.isSubmitting = true;
            try {
                // 调用后端接口触发状态流转
                await axios.post(`/api/process-records/${this.recordId}/trigger-review`);

                this.$message.success("已成功重新提交审核！");

                // 提交后通常需要刷新页面或返回列表
                this.goBack();
            } catch (error) {
                this.$message.error("提交失败: " + (error.response?.data?.message || '未知错误'));
            } finally {
                this.isSubmitting = false;
            }
        },

        triggerActiveIframeResize() {
            const file = this.activeFile;
            if (file && file.id) {
                const iframeRef = this.$refs['iframe-' + file.id];
                const targetIframe = Array.isArray(iframeRef) ? iframeRef[0] : iframeRef;

                if (targetIframe && targetIframe.contentWindow) {
                    try {
                        const win = targetIframe.contentWindow;
                        // 1. 触发浏览器原生 resize 事件
                        win.dispatchEvent(new Event('resize'));
                        // 2. 双重保险：直接调用 Luckysheet 自带的重绘方法
                        if (win.luckysheet && typeof win.luckysheet.resize === 'function') {
                            win.luckysheet.resize();
                        }
                    } catch (e) {
                        console.warn("唤醒 iframe 渲染失败", e);
                    }
                }
            }
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
                if (this.recordInfo.projectId) {
                    axios.get(`/api/projects/${this.recordInfo.projectId}/files`).then(res => {
                        this.allProjectFiles = res.data || [];
                        // 过滤出主策划书
                        this.planningDocs = this.allProjectFiles.filter(f =>
                            f.documentType && f.documentType.startsWith('PLANNING_DOCUMENT')
                        );
                    }).catch(err => console.error("加载参考策划书失败:", err));
                }
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
        getCleanPlanningName(fileName) {
            if (!fileName) return "未命名策划书";
            let name = fileName.replace(/^PLANNING_DOCUMENT_/, '');
            // 处理重复后缀逻辑：针对 "XXX.XLSX-XXX.xlsx"
            if (name.toUpperCase().includes('.XLSX-')) {
                const parts = name.split(/\.xlsx-/i);
                name = parts[parts.length - 1];
            }
            return name.replace(/\.xlsx$/i, '').replace(/\.xls$/i, '');
        },
        getChildDocs(parentId) {
            return this.allProjectFiles
                .filter(f => f.parentId === parentId)
                .sort((a, b) => a.fileName.localeCompare(b.fileName, undefined, { numeric: true }));
        },
        togglePlanningGroup(id) {
            this.$set(this.expandedPlanningGroups, id, !this.expandedPlanningGroups[id]);
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
            if (!fileInfo || !this.showFullscreen) return;

            const isPlanningRef = this.activeTab && this.activeTab.startsWith('plan-child-');
            const iframeRef = this.$refs['iframe-' + fileInfo.id];
            const targetIframe = Array.isArray(iframeRef) ? iframeRef[0] : iframeRef;

            if (targetIframe && targetIframe.contentWindow) {
                // 🔥【核心修复】：移除 &format=json。策划书必须用二进制流解析才能出图
                let fileUrl = `/api/files/content/${fileInfo.id}?t=${new Date().getTime()}`;

                const options = {
                    lang: 'zh',
                    allowUpdate: false, // 审核页面统一不允许同步，需通过审核按钮提交
                    showtoolbar: true,
                    showsheetbar: true,
                    showstatisticBar: false,
                    // 🔥【图片渲染核心】
                    allowImage: true,
                    allowEdit: true,   // 开启前端编辑模式，否则 DISPIMG 公式不解析
                    dataVerification: false
                };

                console.log(`[Review] 以流模式加载${isPlanningRef ? '参考表' : '待审表'} | ID: ${fileInfo.id}`);

                this.sendMessageToIframe(targetIframe, {
                    type: 'LOAD_SHEET',
                    payload: {
                        fileUrl: fileUrl,
                        fileName: fileInfo.fileName,
                        options: options
                    }
                });

                // 🔥【注入公式拦截器】：防止 DISPIMG 报错卡死渲染
                const win = targetIframe.contentWindow;
                if (win.luckysheet) {
                    win.luckysheet_function = win.luckysheet_function || {};
                    win.luckysheet_function._XLFN = win.luckysheet_function._XLFN || {};
                    if (!win.luckysheet_function._XLFN.DISPIMG) {
                        win.luckysheet_function._XLFN.DISPIMG = function () { return ""; };
                    }
                }
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
        // 【新增】注入全屏弹窗和侧边栏的专用样式
        const style = document.createElement('style');
        style.innerHTML = `
            /* 1. 弹窗基础重置 */
            .reader-dialog .el-dialog__header {
                padding: 0 !important;
                margin: 0 !important;
                background: #2b3245; /* 深色背景 */
                height: 60px;
                overflow: hidden;
            }
            .reader-dialog .el-dialog__body {
                padding: 0 !important;
                height: calc(100vh - 60px);
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }
            
            /* 2. Header 布局 */
            .reader-header {
                height: 60px;
                padding: 0 20px;
                display: flex; 
                justify-content: space-between;
                align-items: center;
            }

            /* 3. 侧边栏列表项样式 */
            .file-item {
                padding: 12px 20px;
                cursor: pointer;
                transition: all 0.2s;
                border-left: 3px solid transparent;
                color: #606266;
                font-size: 14px;
                display: flex;
                align-items: center;
            }
            .file-item:hover {
                background-color: #e6f7ff;
                color: #409EFF;
            }
            .file-item.active {
                background-color: #ecf5ff;
                border-left-color: #409EFF;
                color: #409EFF;
                font-weight: 600;
            }

            /* 4. 内容区滚动条 */
            .scrollable-tab-content {
                height: 100%;
                overflow-y: auto;
                padding: 20px;
            }
        `;
        document.head.appendChild(style);



        // --- 您已有的其他 mounted 逻辑 ---
        this.boundMessageListener = this.messageEventListener.bind(this);
        window.addEventListener('message', this.boundMessageListener);

    },

    beforeDestroy() {

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

        // 🔥【新增】当全屏弹窗刚打开时，如果是表格，也需要重绘一次
        showFullscreen(newVal) {
            if (newVal) {
                this.$nextTick(() => {
                    if (this.activeTab !== 'recordMeta' && this.activeTab !== 'problemRecord') {
                        this.triggerActiveIframeResize();
                    }
                });
            }
        },

        activeTab(newTabName, oldTabName) {
            if (newTabName && newTabName !== oldTabName) {
                if (newTabName === 'recordMeta') {
                    this.fetchMetaData();
                } else if (newTabName !== 'problemRecord') {
                    // 🔥【核心修复】等待 v-show(display:block) 生效后，唤醒画布
                    this.$nextTick(() => {
                        this.triggerActiveIframeResize();
                    });
                }
            }
        }
    }
});