// public/components/problem-record-table.js

const ProblemRecordTable = {
    /**
     * Props: 从父组件(record-review-panel)接收核心的 recordId，
     * 用于确定当前问题列表属于哪个过程记录。
     */
    props: {
        recordId: {
            type: Number,
            required: true
        },
        mode: {
            type: String,
            default: 'reviewer'
        }
    },
    computed: {
        isReviewerMode() {
            return this.mode === 'reviewer';
        },
        isDesignerMode() {
            return this.mode === 'designer';
        },
        // 【修改】通用上传 URL，根据 uploadType 动态决定接口
        uploadActionUrl() {
            if (!this.currentProblemForUpload) return '';
            
            if (this.uploadType === 'fix') {
                // 上传修复证明
                return `/api/problems/${this.currentProblemForUpload.id}/fix-screenshot`;
            } else {
                // 默认：上传问题描述截图
                return `/api/problems/${this.currentProblemForUpload.id}/screenshot`;
            }
        },
        // 【新增】上传修复证明截图的 URL (设计员解决弹窗专用)
        resolveUploadUrl() {
            if (this.currentProblemForResolve) {
                return `/api/problems/${this.currentProblemForResolve.id}/fix-screenshot`;
            }
            return '';
        }
    },
    /**
     * Data: 组件的响应式状态。
     */
    data() {
        return {
            problems: [],           // 从服务器获取的问题列表
            isLoading: false,       // 控制表格的加载动画
            
            // --- 新增/编辑问题相关 ---
            dialogVisible: false,   // 控制新增/编辑对话框的显示与隐藏
            isEditMode: false,      // 标记对话框是用于“新增”还是“编辑”   
            currentProblem: {       // 与对话框内表单双向绑定的数据模型
                id: null,
                stage: 'FMC',
                problemPoint: '',   
                description: '',
                status: 'OPEN'
            },
            formRules: {            // Element UI 表单的验证规则
                stage: [{ required: true, message: '请选择问题阶段', trigger: 'change' }],
                problemPoint: [{ required: true, message: '请输入问题点', trigger: 'blur' }]
            },

            // --- 截图上传相关 (通用) ---
            screenshotUploadVisible: false, // 控制截图弹窗的显示
            currentProblemForUpload: null,  // 记录正在操作截图的是哪个问题
            uploadType: 'problem',          // 【新增】记录当前上传类型：'problem' 或 'fix'

            // --- 【新增】解决问题闭环相关 (设计员) ---
            resolveDialogVisible: false,     // 控制“确认解决”弹窗
            isResolving: false,              // 提交 Loading 状态
            currentProblemForResolve: null,  // 当前正在处理解决的问题
            resolveForm: {                   // 解决表单数据
                fixComment: '',
                fixScreenshotPath: ''
            }
        };
    },
    
    watch: {
        recordId: {
            immediate: true,
            handler(newId) {
                if (newId) {
                    this.fetchProblems();
                }
            }
        }
    },

    methods: {
        /**
         * 从后端API获取指定 recordId 的所有问题列表。
         */
        fetchProblems() {
            this.isLoading = true;
            axios.get(`/api/process-records/${this.recordId}/problems`)
                .then(response => {
                    this.problems = response.data;
                })
                .catch(error => {
                    this.$message.error('加载问题列表失败！');
                    console.error("获取问题列表时出错:", error);
                })
                .finally(() => {
                    this.isLoading = false;
                });
        },

        resetForm() {
            this.currentProblem = {
                id: null,
                stage: 'FMC',
                problemPoint: '',
                description: '',
                status: 'OPEN'
            };
            if (this.$refs.problemForm) {
                this.$refs.problemForm.clearValidate();
            }
        },

        handleAddNew() {
            if (!this.isReviewerMode) return;
            this.isEditMode = false;
            this.resetForm();
            this.dialogVisible = true;
        },
        
        handleEdit(row) {
            if (!this.isReviewerMode) return;
            this.isEditMode = true;
            this.currentProblem = JSON.parse(JSON.stringify(row));
            this.dialogVisible = true;
        },

        handleDelete(problemId) {
            this.$confirm('此操作将永久删除该问题记录及其截图, 是否继续?', '提示', {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'warning'
            }).then(() => {
                axios.delete(`/api/problems/${problemId}`)
                    .then(() => {
                        this.$message.success('删除成功!');
                        this.fetchProblems(); 
                    })
                    .catch(error => {
                        this.$message.error('删除失败!');
                        console.error("删除问题时出错:", error);
                    });
            }).catch(() => {
                this.$message({ type: 'info', message: '已取消删除' });
            });
        },

        /**
         * 【重写】处理“标记为已解决”按钮点击
         * 不再直接提交，而是打开弹窗让设计员上传证明
         */
        handleResolve(problem) {
            this.currentProblemForResolve = problem;
            // 【修改】回显已有数据，而不是清空，方便修改
            this.resolveForm = {
                fixComment: problem.fixComment || '',
                fixScreenshotPath: problem.fixScreenshotPath || ''
            };
            this.resolveDialogVisible = true;
        },

        /**
         * 【新增】处理解决弹窗中的图片粘贴
         */
        handleResolvePaste(event) {
            const items = (event.clipboardData || window.clipboardData).items;
            let imageFile = null;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    imageFile = items[i].getAsFile();
                    break;
                }
            }
            if (imageFile) {
                event.preventDefault();
                this.uploadFixFile(imageFile);
            }
        },

        /**
         * 【新增】上传修复证明图片的底层逻辑 (弹窗用)
         */
        async uploadFixFile(file) {
            const formData = new FormData();
            formData.append('file', file);
            try {
                // 使用 resolveUploadUrl (fix-screenshot 接口)
                const res = await axios.post(this.resolveUploadUrl, formData);
                this.handleResolveUploadSuccess(res.data);
            } catch (error) {
                this.$message.error('截图上传失败');
                console.error(error);
            }
        },

        /**
         * 【新增】修复截图上传成功回调 (弹窗用)
         */
        handleResolveUploadSuccess(res) {
            if (res.filePath) {
                this.resolveForm.fixScreenshotPath = res.filePath;
                this.$message.success('修改证明已上传');
            }
        },

        /**
         * 【新增】提交“已解决”确认
         * 同时提交 截图路径 和 备注
         */
        submitResolve() {
            // 校验：必须上传截图（根据你的业务需求，这里强制要求上传）
            if (!this.resolveForm.fixScreenshotPath) {
                this.$message.warning('请上传修改后的截图作为证明');
                return;
            }
            
            this.isResolving = true;
            // 构建 DTO
            const payload = {
                // 【FIX】不要发送 status: 'RESOLVED'，否则后端先update状态后，再执行resolve业务流校验状态时会报错
                fixComment: this.resolveForm.fixComment,
                fixScreenshotPath: this.resolveForm.fixScreenshotPath
            };
            
            axios.post(`/api/problems/${this.currentProblemForResolve.id}/resolve`, payload)
                .then(response => {
                    this.$message.success('问题已标记为已解决！');
                    this.resolveDialogVisible = false;
                    
                    // 局部更新列表
                    const index = this.problems.findIndex(p => p.id === this.currentProblemForResolve.id);
                    if (index !== -1) {
                        this.$set(this.problems, index, response.data);
                    }
                })
                .catch(error => {
                    this.$message.error('提交失败: ' + (error.response?.data?.message || '未知错误'));
                })
                .finally(() => {
                    this.isResolving = false;
                });
        },

        handleReopen(problem) {
            this.$prompt('请输入打回原因，内容将反馈给设计员。', '确认打回', {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                inputPattern: /.+/, 
                inputErrorMessage: '打回原因不能为空！'
            }).then(({ value }) => { 
                axios.post(`/api/problems/${problem.id}/reopen`, { comment: value })
                    .then(response => {
                        this.$message.success('问题已成功打回！');
                        const index = this.problems.findIndex(p => p.id === problem.id);
                        if (index !== -1) {
                            this.$set(this.problems, index, response.data);
                        } else {
                            this.fetchProblems();
                        }
                    })
                    .catch(error => {
                        this.$message.error('操作失败: ' + (error.response?.data?.message || '未知错误'));
                    });
            }).catch(() => {
                this.$message.info('已取消打回操作');
            });
        },

        submitForm() {
            this.$refs.problemForm.validate(valid => {
                if (valid) {
                    const action = this.isEditMode
                        ? axios.put(`/api/problems/${this.currentProblem.id}`, this.currentProblem)
                        : axios.post(`/api/process-records/${this.recordId}/problems`, this.currentProblem);

                    action.then(() => {
                        this.$message.success(this.isEditMode ? '更新成功!' : '新增成功!');
                        this.dialogVisible = false;
                        this.fetchProblems(); 
                    }).catch(error => {
                        this.$message.error('操作失败!');
                        console.error("提交表单时出错:", error);
                    });
                } else {
                    return false;
                }
            });
        },

        /**
         * 【修改】打开截图上传弹窗，支持指定类型
         * @param problem 问题对象
         * @param type 上传类型 'problem' | 'fix'
         */
        openScreenshotUploader(problem, type = 'problem') {
            this.currentProblemForUpload = problem;
            this.uploadType = type; // 设置上传类型
            this.screenshotUploadVisible = true;
        },

        handlePaste(event) {
            const items = (event.clipboardData || window.clipboardData).items;
            let imageFile = null;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    imageFile = items[i].getAsFile();
                    break;
                }
            }

            if (imageFile) {
                event.preventDefault(); 
                this.$message.info('检测到图片，正在上传...');
                this.uploadFile(imageFile);
            }
        },

        async uploadFile(file) {
            const formData = new FormData();
            formData.append('file', file);
            try {
                const response = await axios.post(this.uploadActionUrl, formData);
                this.handleSingleScreenshotSuccess(response.data);
            } catch (error) {
                this.handleScreenshotError(error);
            }
        },

        handleSingleScreenshotSuccess(res) {
            console.log('截图上传成功，服务器响应:', res);
            this.$message.success('截图上传成功!');
            if (res.filePath && this.currentProblemForUpload) {
                // 【修改】根据 uploadType 更新对应字段
                if (this.uploadType === 'fix') {
                    this.currentProblemForUpload.fixScreenshotPath = res.filePath;
                } else {
                    this.currentProblemForUpload.screenshotPath = res.filePath;
                }
                this.screenshotUploadVisible = false;
            } else {
                this.$message.error('未能从服务器获取文件路径！');
            }
        },

        handleScreenshotError(err) {
            this.$message.error('截图上传失败，请检查网络或联系管理员。');
            console.error("截图上传失败:", err);
        },

        handleClose(problem) {
            this.$confirm(`确定要关闭问题 "${problem.problemPoint}" 吗？此操作表示问题已最终确认解决。`, '确认关闭', {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'success'
            }).then(() => {
                axios.post(`/api/problems/${problem.id}/close`)
                    .then(response => {
                        this.$message.success('问题已成功关闭！');
                        const index = this.problems.findIndex(p => p.id === problem.id);
                        if (index !== -1) {
                            this.$set(this.problems, index, response.data);
                        } else {
                            this.fetchProblems();
                        }
                    })
                    .catch(error => {
                        this.$message.error('操作失败: ' + (error.response?.data?.message || '未知错误'));
                    });
            }).catch(() => { });
        },
    },

    /**
     * Template: 组件的HTML模板。
     */
    template: `
            <div class="card mt-4">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h4 class="card-title mb-0">问题记录表</h4>
                    <el-button v-if="isReviewerMode" type="primary" icon="el-icon-plus" @click="handleAddNew">新增问题</el-button>
                </div>
            
                <!-- 通用截图上传弹窗 (表格列操作用) -->
                <el-dialog
                    v-if="screenshotUploadVisible"
                    :title="uploadType === 'fix' ? '上传修复证明' : '上传问题截图'"
                    :visible.sync="screenshotUploadVisible"
                    width="500px"
                    @close="currentProblemForUpload = null"
                    append-to-body>
                    
                    <div @paste="handlePaste" class="screenshot-paste-area">
                        <el-upload
                            class="screenshot-uploader-in-dialog"
                            drag
                            :action="uploadActionUrl"
                            :show-file-list="false"
                            :on-success="handleSingleScreenshotSuccess"
                            :on-error="handleScreenshotError"
                            name="file">
                            <i class="el-icon-upload"></i>
                            <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
                            <div class="el-upload__tip" slot="tip">
                                您也可以直接在本窗口内使用 <strong>Ctrl+V</strong> 粘贴剪贴板中的截图
                            </div>
                        </el-upload>
                    </div>
                </el-dialog>

                <!-- 设计员：确认解决弹窗 (上传修改证明) -->
                <el-dialog
                    title="确认已解决"
                    :visible.sync="resolveDialogVisible"
                    width="500px"
                    append-to-body
                    :close-on-click-modal="false">
                    <el-form :model="resolveForm" label-width="80px">
                        <el-alert title="请上传修改后的截图作为证明，并填写备注。" type="info" :closable="false" class="mb-3"></el-alert>
                        
                        <el-form-item label="修改备注">
                            <el-input type="textarea" v-model="resolveForm.fixComment" placeholder="例如：已按要求修改尺寸，请复核。" :rows="2"></el-input>
                        </el-form-item>
                        
                        <el-form-item label="修改截图" required>
                             <div @paste="handleResolvePaste" class="screenshot-paste-area">
                                <el-upload
                                    class="screenshot-uploader-in-dialog"
                                    drag
                                    :action="resolveUploadUrl"
                                    :show-file-list="false"
                                    :on-success="handleResolveUploadSuccess"
                                    name="file">
                                    <div v-if="resolveForm.fixScreenshotPath" style="width:100%; height:100%; display:flex; align-items:center; justify-content:center;">
                                        <img :src="resolveForm.fixScreenshotPath" style="max-width: 100%; max-height: 100%; object-fit: contain;">
                                    </div>
                                    <div v-else>
                                        <i class="el-icon-upload"></i>
                                        <div class="el-upload__text">拖拽/点击上传<br><small>支持 Ctrl+V 粘贴</small></div>
                                    </div>
                                </el-upload>
                            </div>
                            <div v-if="resolveForm.fixScreenshotPath" class="text-success small mt-1">
                                <i class="el-icon-check"></i> 图片已上传
                            </div>
                        </el-form-item>
                    </el-form>
                    <span slot="footer" class="dialog-footer">
                        <el-button @click="resolveDialogVisible = false">取消</el-button>
                        <el-button type="primary" :loading="isResolving" @click="submitResolve">确认提交</el-button>
                    </span>
                </el-dialog>


                <el-table :data="problems" v-loading="isLoading" stripe style="width: 100%" border>
                    <el-table-column type="index" label="序号" width="50" align="center"></el-table-column>
                    <el-table-column prop="stage" label="阶段" width="80" align="center"></el-table-column>
                    <el-table-column prop="problemPoint" label="问题点" min-width="110" show-overflow-tooltip></el-table-column>
                    
                    <el-table-column label="问题描述" min-width="150">
                        <template slot-scope="scope">
                            <div class="d-flex align-items-center">
                                <span class="text-truncate" :title="scope.row.description">{{ scope.row.description }}</span>
                            </div>
                        </template>
                    </el-table-column>

                    <!-- 【修改】明确表头为“问题截图”，与“修复证明”区分 -->
                    <el-table-column label="问题截图" width="100" align="center">
                        <template slot-scope="scope">
                            <div class="d-flex align-items-center justify-content-center">
                                <!-- 图片 (如果有) -->
                                <el-image 
                                    v-if="scope.row.screenshotPath"
                                    style="width: 40px; height: 40px; margin-right: 5px; border-radius: 4px; border: 1px solid #eee;"
                                    :src="scope.row.screenshotPath" 
                                    :preview-src-list="[scope.row.screenshotPath]">
                                </el-image>

                                <!-- 
                                    上传/替换按钮：仅审核员在 OPEN 状态下，或图片为空时显示
                                -->
                                <el-button
                                    v-if="!scope.row.screenshotPath || (isReviewerMode && scope.row.status === 'OPEN')"
                                    type="text"
                                    :icon="scope.row.screenshotPath ? 'el-icon-refresh' : 'el-icon-plus'"
                                    :title="scope.row.screenshotPath ? '更换截图' : '上传截图'"
                                    @click="openScreenshotUploader(scope.row, 'problem')">
                                </el-button>
                            </div>
                        </template>
                    </el-table-column>

                    <!-- 【修改】明确表头为“修复证明” -->
                    <el-table-column label="修复证明" min-width="140">
                         <template slot-scope="scope">
                            <div v-if="scope.row.fixScreenshotPath" class="d-flex align-items-center">
                                <!-- 修复截图 -->
                                <el-image 
                                    style="width: 40px; height: 40px; margin-right: 5px; flex-shrink: 0; border: 1px solid #67c23a;"
                                    :src="scope.row.fixScreenshotPath" 
                                    :preview-src-list="[scope.row.fixScreenshotPath]">
                                </el-image>
                                <div style="font-size: 0.85em; line-height: 1.2; flex-grow: 1;">
                                    <div class="text-success font-weight-bold">已修复</div>
                                    <div class="text-muted text-truncate" style="max-width: 90px;" :title="scope.row.fixComment">
                                        {{ scope.row.fixComment || '无备注' }}
                                    </div>
                                </div>
                            </div>
                            
                            <span v-else-if="scope.row.status === 'RESOLVED' || scope.row.status === 'CLOSED'" class="text-muted small">
                                (无证明)
                            </span>

                            <!-- 【关键新增】设计员在 OPEN 状态下，可以直接在这里上传/更换修复截图 -->
                            <div v-if="isDesignerMode && scope.row.status === 'OPEN'" style="display: inline-block;">
                                <el-button
                                    type="text"
                                    :icon="scope.row.fixScreenshotPath ? 'el-icon-refresh' : 'el-icon-plus'"
                                    :title="scope.row.fixScreenshotPath ? '更换修复截图' : '上传修复截图'"
                                    @click="openScreenshotUploader(scope.row, 'fix')">
                                </el-button>
                            </div>
                        </template>
                    </el-table-column>
                    
                    <el-table-column prop="status" label="状态" width="85" align="center">
                        <template slot-scope="scope">
                            <el-tag :type="scope.row.status === 'OPEN' ? 'danger' : scope.row.status === 'RESOLVED' ? 'warning' : 'success'" size="small" effect="dark">
                                {{ scope.row.status === 'OPEN' ? '待解决' : scope.row.status === 'RESOLVED' ? '待复核' : '已关闭' }}
                            </el-tag>
                        </template>
                    </el-table-column>

                    <el-table-column label="责任人" min-width="120">
                         <template slot-scope="scope">
                            <div style="font-size: 0.85em;">
                                <div><span class="text-muted">提:</span> {{ scope.row.createdByUsername }}</div>
                                <div v-if="scope.row.confirmedByUsername"><span class="text-muted">改:</span> {{ scope.row.confirmedByUsername }}</div>
                            </div>
                         </template>
                    </el-table-column>

                    <el-table-column label="操作" width="160" align="center" fixed="right">
                        <template slot-scope="scope">
                        
                            <!-- 审核员操作 -->
                            <div v-if="isReviewerMode">
                                <template v-if="scope.row.status === 'OPEN'">
                                    <el-button size="mini" @click="handleEdit(scope.row)" icon="el-icon-edit" circle title="编辑"></el-button>
                                    <el-button size="mini" type="danger" @click="handleDelete(scope.row.id)" icon="el-icon-delete" circle title="删除"></el-button>
                                </template>
                                <template v-else-if="scope.row.status === 'RESOLVED'">
                                    <el-button size="mini" type="warning" @click="handleReopen(scope.row)">打回</el-button>
                                    <el-button size="mini" type="success" @click="handleClose(scope.row)">通过</el-button>
                                </template>
                                <span v-else class="text-muted small">已归档</span>
                            </div>
                    
                            <!-- 设计员操作 -->
                            <div v-if="isDesignerMode">
                                <el-button 
                                    v-if="scope.row.status === 'OPEN'"
                                    size="mini" 
                                    type="primary" 
                                    icon="el-icon-check"
                                    @click="handleResolve(scope.row)">
                                    解决
                                </el-button>
                                <span v-else class="text-muted small">
                                    {{ scope.row.status === 'RESOLVED' ? '等待复核' : '已完成' }}
                                </span>
                            </div>
                        </template>
                    </el-table-column>
                </el-table>

                <!-- 新增与编辑问题的对话框 (审核员用) -->
                <el-dialog :title="isEditMode ? '编辑问题' : '新增问题'" :visible.sync="dialogVisible" width="50%" :close-on-click-modal="false">
                    <el-form :model="currentProblem" :rules="formRules" ref="problemForm" label-width="100px">
                        <el-form-item label="问题阶段" prop="stage">
                            <el-select v-model="currentProblem.stage" placeholder="请选择阶段">
                                <el-option label="FMC" value="FMC"></el-option>
                                <el-option label="正式图" value="FORMAL_DRAWING"></el-option>
                            </el-select>
                        </el-form-item>
                        <el-form-item label="问题点" prop="problemPoint">
                            <el-input v-model="currentProblem.problemPoint" placeholder="请输入问题的简要标题"></el-input>
                        </el-form-item>
                        <el-form-item label="详细描述" prop="description">
                            <el-input type="textarea" :rows="4" v-model="currentProblem.description" placeholder="请详细描述问题内容"></el-input>
                        </el-form-item>
                        <el-form-item v-if="isEditMode" label="问题状态" prop="status">
                            <el-select v-model="currentProblem.status" placeholder="请选择状态">
                                <el-option label="已提出 (OPEN)" value="OPEN"></el-option>
                                <el-option label="已解决 (RESOLVED)" value="RESOLVED"></el-option>
                                <el-option label="已关闭 (CLOSED)" value="CLOSED"></el-option>
                            </el-select>
                        </el-form-item>
                    </el-form>
                    <span slot="footer" class="dialog-footer">
                        <el-button @click="dialogVisible = false">取 消</el-button>
                        <el-button type="primary" @click="submitForm">确 定</el-button>
                    </span>
                </el-dialog>
            </div>
        </div>
    `
};