// public/components/problem-record-table.js

const ProblemRecordTable = {
    props: {
        recordId: { type: Number, required: true },
        mode: { type: String, default: 'reviewer' } // 'reviewer' | 'designer'
    },
    
    data() {
        return {
            problems: [],
            isLoading: false,
            
            // --- 新增/编辑问题弹窗 (审核员) ---
            dialogVisible: false,
            isEditMode: false,
            currentProblem: {
                id: null, stage: 'FMC', problemPoint: '', description: '', status: 'OPEN'
            },
            formRules: {
                stage: [{ required: true, message: '必选', trigger: 'change' }],
                problemPoint: [{ required: true, message: '必填', trigger: 'blur' }]
            },

            // --- 通用截图上传弹窗 (用于表格列内直接上传) ---
            screenshotUploadVisible: false,
            currentProblemForUpload: null, // 当前操作的问题对象
            uploadType: 'problem',         // 'problem' (问题截图) | 'fix' (修复截图)

            // --- 确认解决弹窗 (设计员) ---
            resolveDialogVisible: false,
            isResolving: false,
            currentProblemForResolve: null,
            resolveForm: {
                fixComment: '',
                fixScreenshotPath: ''
            }
        };
    },

    computed: {
        isReviewerMode() { return this.mode === 'reviewer'; },
        isDesignerMode() { return this.mode === 'designer'; },

        // 动态计算通用上传接口
        uploadActionUrl() {
            if (!this.currentProblemForUpload) return '';
            // 根据类型决定调用哪个接口
            if (this.uploadType === 'fix') {
                return `/api/problems/${this.currentProblemForUpload.id}/fix-screenshot`;
            } else {
                return `/api/problems/${this.currentProblemForUpload.id}/screenshot`;
            }
        },

        // 解决弹窗专用的上传接口
        resolveUploadUrl() {
            if (!this.currentProblemForResolve) return '';
            return `/api/problems/${this.currentProblemForResolve.id}/fix-screenshot`;
        },
        
        // 弹窗标题
        uploadDialogTitle() {
            return this.uploadType === 'fix' ? '上传/更换 修复证明' : '上传/更换 问题截图';
        }
    },
    
    watch: {
        recordId: {
            immediate: true,
            handler(val) { if (val) this.fetchProblems(); }
        }
    },

    methods: {
        fetchProblems() {
            this.isLoading = true;
            axios.get(`/api/process-records/${this.recordId}/problems`)
                .then(res => { this.problems = res.data; })
                .catch(err => this.$message.error('加载失败'))
                .finally(() => { this.isLoading = false; });
        },

        // --- 审核员：新增/编辑问题 ---
        resetForm() {
            this.currentProblem = { id: null, stage: 'FMC', problemPoint: '', description: '', status: 'OPEN' };
            if (this.$refs.problemForm) this.$refs.problemForm.clearValidate();
        },
        handleAddNew() {
            this.isEditMode = false;
            this.resetForm();
            this.dialogVisible = true;
        },
        handleEdit(row) {
            this.isEditMode = true;
            this.currentProblem = JSON.parse(JSON.stringify(row));
            this.dialogVisible = true;
        },
        submitForm() {
            this.$refs.problemForm.validate(valid => {
                if (!valid) return;
                const req = this.isEditMode 
                    ? axios.put(`/api/problems/${this.currentProblem.id}`, this.currentProblem)
                    : axios.post(`/api/process-records/${this.recordId}/problems`, this.currentProblem);
                
                req.then(() => {
                    this.$message.success('保存成功');
                    this.dialogVisible = false;
                    this.fetchProblems();
                }).catch(e => this.$message.error('保存失败'));
            });
        },
        handleDelete(id) {
            this.$confirm('确认删除此记录及其截图吗？', '提示', { type: 'warning' })
                .then(() => axios.delete(`/api/problems/${id}`))
                .then(() => {
                    this.$message.success('删除成功');
                    this.fetchProblems();
                }).catch(() => {});
        },

        // --- 通用：表格列内的截图上传 ---
        /**
         * 打开通用上传弹窗
         * @param row 问题对象
         * @param type 'problem' (审核员传问题图) | 'fix' (设计员传修复图)
         */
        openScreenshotUploader(row, type) {
            this.currentProblemForUpload = row;
            this.uploadType = type;
            this.screenshotUploadVisible = true;
        },
        handlePaste(e) {
            const items = (e.clipboardData || window.clipboardData).items;
            let file = null;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    file = items[i].getAsFile();
                    break;
                }
            }
            if (file) {
                e.preventDefault();
                this.uploadFile(file);
            }
        },
        async uploadFile(file) {
            const formData = new FormData();
            formData.append('file', file);
            try {
                const res = await axios.post(this.uploadActionUrl, formData);
                this.handleUploadSuccess(res.data);
            } catch (e) {
                this.$message.error('上传失败');
            }
        },
        handleUploadSuccess(res) {
            if (res.filePath && this.currentProblemForUpload) {
                // 根据类型更新对应字段，实现无刷新更新视图
                if (this.uploadType === 'fix') {
                    this.currentProblemForUpload.fixScreenshotPath = res.filePath;
                } else {
                    this.currentProblemForUpload.screenshotPath = res.filePath;
                }
                this.$message.success('上传成功');
                this.screenshotUploadVisible = false;
            }
        },

        // --- 设计员：解决问题闭环 ---
        handleResolve(row) {
            this.currentProblemForResolve = row;
            // 【核心修复】回显已有数据！
            // 这样如果是被打回的，设计员能看到之前的备注和图，直接修改即可
            this.resolveForm = {
                fixComment: row.fixComment || '',
                fixScreenshotPath: row.fixScreenshotPath || ''
            };
            this.resolveDialogVisible = true;
        },
        // 解决弹窗内的粘贴处理
        handleResolvePaste(e) {
            const items = (e.clipboardData || window.clipboardData).items;
            let file = null;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    file = items[i].getAsFile();
                    break;
                }
            }
            if (file) {
                e.preventDefault();
                this.uploadFixFileForResolve(file);
            }
        },
        async uploadFixFileForResolve(file) {
            const formData = new FormData();
            formData.append('file', file);
            try {
                const res = await axios.post(this.resolveUploadUrl, formData);
                if (res.data.filePath) {
                    this.resolveForm.fixScreenshotPath = res.data.filePath;
                    this.$message.success('图片已上传');
                }
            } catch (e) {
                this.$message.error('上传失败');
            }
        },
        handleResolveUploadSuccess(res) {
            if (res.filePath) {
                this.resolveForm.fixScreenshotPath = res.filePath;
                this.$message.success('图片已上传');
            }
        },
        submitResolve() {
            // 校验图片
            if (!this.resolveForm.fixScreenshotPath) {
                return this.$message.warning('请务必上传修改后的截图证明');
            }
            this.isResolving = true;
            const payload = {
                // 注意：不传 status 字段，状态流转由后端 resolve 接口控制
                fixComment: this.resolveForm.fixComment,
                fixScreenshotPath: this.resolveForm.fixScreenshotPath
            };
            axios.post(`/api/problems/${this.currentProblemForResolve.id}/resolve`, payload)
                .then(res => {
                    this.$message.success('已提交解决确认');
                    this.resolveDialogVisible = false;
                    // 局部更新
                    const idx = this.problems.findIndex(p => p.id === this.currentProblemForResolve.id);
                    if (idx !== -1) this.$set(this.problems, idx, res.data);
                })
                .catch(e => this.$message.error(e.response?.data?.message || '提交失败'))
                .finally(() => this.isResolving = false);
        },

        // --- 审核员：打回与关闭 ---
        handleReopen(row) {
            this.$prompt('请输入打回原因:', '确认打回', {
                inputPattern: /.+/, inputErrorMessage: '原因不能为空'
            }).then(({ value }) => {
                axios.post(`/api/problems/${row.id}/reopen`, { comment: value })
                    .then(res => {
                        this.$message.success('已打回');
                        const idx = this.problems.findIndex(p => p.id === row.id);
                        if (idx !== -1) this.$set(this.problems, idx, res.data);
                    });
            }).catch(() => {});
        },
        handleClose(row) {
            this.$confirm('确认关闭此问题吗？', '提示', { type: 'success' })
                .then(() => axios.post(`/api/problems/${row.id}/close`))
                .then(res => {
                    this.$message.success('已关闭');
                    const idx = this.problems.findIndex(p => p.id === row.id);
                    if (idx !== -1) this.$set(this.problems, idx, res.data);
                });
        }
    },

    template: `
        <div class="card mt-4">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h4 class="card-title mb-0">问题记录表</h4>
                    <!-- 只有审核员能新增 -->
                    <el-button v-if="isReviewerMode" type="primary" icon="el-icon-plus" @click="handleAddNew">新增问题</el-button>
                </div>

                <el-table :data="problems" v-loading="isLoading" stripe border style="width: 100%">
                    <!-- 1. 序号 -->
                    <el-table-column type="index" label="序号" width="50" align="center"></el-table-column>
                    
                    <!-- 2. 阶段 -->
                    <el-table-column prop="stage" label="阶段" width="80" align="center"></el-table-column>
                    
                    <!-- 3. 问题点 -->
                    <el-table-column prop="problemPoint" label="问题点" min-width="100" show-overflow-tooltip></el-table-column>
                    
                    <!-- 4. 描述 -->
                    <el-table-column label="描述" min-width="140">
                        <template slot-scope="scope">
                            <span :title="scope.row.description" class="text-truncate d-block">{{ scope.row.description }}</span>
                        </template>
                    </el-table-column>

                    <!-- 5. 问题截图 (审核员管理) -->
                    <el-table-column label="问题截图" width="100" align="center">
                        <template slot-scope="scope">
                            <div class="d-flex justify-content-center align-items-center">
                                <el-image 
                                    v-if="scope.row.screenshotPath"
                                    style="width: 40px; height: 40px; border:1px solid #eee; border-radius:4px; margin-right:4px;"
                                    :src="scope.row.screenshotPath" 
                                    :preview-src-list="[scope.row.screenshotPath]">
                                </el-image>
                                <!-- 审核员 & OPEN状态：可上传/更换 -->
                                <el-button 
                                    v-if="isReviewerMode && scope.row.status === 'OPEN'"
                                    type="text" 
                                    :icon="scope.row.screenshotPath ? 'el-icon-refresh' : 'el-icon-plus'"
                                    :title="scope.row.screenshotPath ? '更换图片' : '上传图片'"
                                    @click="openScreenshotUploader(scope.row, 'problem')">
                                </el-button>
                            </div>
                        </template>
                    </el-table-column>

                    <!-- 6. 修复证明 (设计员管理) -->
                    <el-table-column label="修复证明" min-width="150">
                        <template slot-scope="scope">
                            <div class="d-flex align-items-center">
                                <!-- 显示修复图 -->
                                <el-image 
                                    v-if="scope.row.fixScreenshotPath"
                                    style="width: 40px; height: 40px; flex-shrink:0; border:1px solid #67c23a; border-radius:4px; margin-right:8px;"
                                    :src="scope.row.fixScreenshotPath" 
                                    :preview-src-list="[scope.row.fixScreenshotPath]">
                                </el-image>
                                
                                <!-- 显示备注 -->
                                <div v-if="scope.row.fixScreenshotPath || scope.row.fixComment" style="font-size:0.85em; line-height:1.2; flex-grow:1; overflow:hidden;">
                                    <div class="text-success font-weight-bold">已修复</div>
                                    <div class="text-muted text-truncate" :title="scope.row.fixComment">{{ scope.row.fixComment || '无备注' }}</div>
                                </div>
                                <div v-else class="text-muted small flex-grow-1">(待修复)</div>

                                <!-- 【关键修复】设计员 & OPEN状态：直接在此处上传/更换修复图 -->
                                <el-button 
                                    v-if="isDesignerMode && scope.row.status === 'OPEN'"
                                    type="text" 
                                    :icon="scope.row.fixScreenshotPath ? 'el-icon-refresh' : 'el-icon-plus'"
                                    :title="scope.row.fixScreenshotPath ? '更换证明' : '上传证明'"
                                    @click="openScreenshotUploader(scope.row, 'fix')">
                                </el-button>
                            </div>
                        </template>
                    </el-table-column>

                    <!-- 7. 状态 -->
                    <el-table-column label="状态" width="85" align="center">
                        <template slot-scope="scope">
                            <el-tag v-if="scope.row.status === 'OPEN'" type="danger" size="small" effect="dark">待解决</el-tag>
                            <el-tag v-else-if="scope.row.status === 'RESOLVED'" type="warning" size="small" effect="dark">待复核</el-tag>
                            <el-tag v-else type="success" size="small" effect="dark">已关闭</el-tag>
                        </template>
                    </el-table-column>

                    <!-- 8. 责任人 -->
                    <el-table-column label="责任人" min-width="110">
                        <template slot-scope="scope">
                            <div style="font-size:0.85em;">
                                <div><span class="text-muted">提:</span> {{ scope.row.createdByUsername }}</div>
                                <div v-if="scope.row.confirmedByUsername"><span class="text-muted">改:</span> {{ scope.row.confirmedByUsername }}</div>
                            </div>
                        </template>
                    </el-table-column>

                    <!-- 9. 操作列 -->
                    <el-table-column label="操作" width="150" align="center" fixed="right">
                        <template slot-scope="scope">
                            <!-- 审核员视图 -->
                            <div v-if="isReviewerMode">
                                <template v-if="scope.row.status === 'OPEN'">
                                    <el-button size="mini" icon="el-icon-edit" circle @click="handleEdit(scope.row)"></el-button>
                                    <el-button size="mini" type="danger" icon="el-icon-delete" circle @click="handleDelete(scope.row.id)"></el-button>
                                </template>
                                <template v-else-if="scope.row.status === 'RESOLVED'">
                                    <el-button size="mini" type="warning" @click="handleReopen(scope.row)">打回</el-button>
                                    <el-button size="mini" type="success" @click="handleClose(scope.row)">通过</el-button>
                                </template>
                                <span v-else class="text-muted small">已存档</span>
                            </div>

                            <!-- 设计员视图 -->
                            <div v-if="isDesignerMode">
                                <el-button 
                                    v-if="scope.row.status === 'OPEN'"
                                    size="mini" type="primary" icon="el-icon-check" 
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

                <!-- 1. 新增/编辑弹窗 (审核员) -->
                <el-dialog :title="isEditMode ? '编辑问题' : '新增问题'" :visible.sync="dialogVisible" width="500px" :close-on-click-modal="false">
                    <el-form :model="currentProblem" :rules="formRules" ref="problemForm" label-width="80px">
                        <el-form-item label="阶段" prop="stage">
                            <el-select v-model="currentProblem.stage" style="width:100%">
                                <el-option label="FMC" value="FMC"></el-option>
                                <el-option label="正式图" value="FORMAL_DRAWING"></el-option>
                            </el-select>
                        </el-form-item>
                        <el-form-item label="问题点" prop="problemPoint">
                            <el-input v-model="currentProblem.problemPoint"></el-input>
                        </el-form-item>
                        <el-form-item label="描述" prop="description">
                            <el-input type="textarea" v-model="currentProblem.description" :rows="3"></el-input>
                        </el-form-item>
                    </el-form>
                    <span slot="footer">
                        <el-button @click="dialogVisible = false">取消</el-button>
                        <el-button type="primary" @click="submitForm">确定</el-button>
                    </span>
                </el-dialog>

                <!-- 2. 通用截图上传弹窗 (列操作用) -->
                <el-dialog :title="uploadDialogTitle" :visible.sync="screenshotUploadVisible" width="400px" append-to-body>
                    <div @paste="handlePaste" class="text-center border rounded p-3 bg-light">
                        <el-upload
                            drag
                            :action="uploadActionUrl"
                            :show-file-list="false"
                            :on-success="handleUploadSuccess"
                            name="file">
                            <i class="el-icon-upload"></i>
                            <div class="el-upload__text">拖拽或点击上传<br><small class="text-muted">支持 Ctrl+V 粘贴</small></div>
                        </el-upload>
                    </div>
                </el-dialog>

                <!-- 3. 确认解决弹窗 (设计员) -->
                <el-dialog title="确认解决 & 提交证明" :visible.sync="resolveDialogVisible" width="500px" append-to-body :close-on-click-modal="false">
                    <el-form :model="resolveForm" label-width="80px">
                        <el-alert title="请上传修改后的截图并填写备注，以便审核员复核。" type="info" :closable="false" class="mb-3"></el-alert>
                        
                        <el-form-item label="修改备注">
                            <el-input type="textarea" v-model="resolveForm.fixComment" :rows="2" placeholder="例如：已修改尺寸"></el-input>
                        </el-form-item>
                        
                        <el-form-item label="修复截图" required>
                            <div @paste="handleResolvePaste" class="text-center border rounded p-2 bg-light">
                                <el-upload
                                    drag
                                    :action="resolveUploadUrl"
                                    :show-file-list="false"
                                    :on-success="handleResolveUploadSuccess"
                                    name="file">
                                    <div v-if="resolveForm.fixScreenshotPath" style="height:120px; display:flex; align-items:center; justify-content:center;">
                                        <img :src="resolveForm.fixScreenshotPath" style="max-height:100%; max-width:100%;">
                                    </div>
                                    <div v-else>
                                        <i class="el-icon-upload"></i>
                                        <div class="el-upload__text">点击/粘贴上传</div>
                                    </div>
                                </el-upload>
                            </div>
                            <div v-if="resolveForm.fixScreenshotPath" class="text-success small mt-1"><i class="el-icon-check"></i> 已上传</div>
                        </el-form-item>
                    </el-form>
                    <span slot="footer">
                        <el-button @click="resolveDialogVisible = false">取消</el-button>
                        <el-button type="primary" :loading="isResolving" @click="submitResolve">确认提交</el-button>
                    </span>
                </el-dialog>

            </div>
        </div>
    `
};