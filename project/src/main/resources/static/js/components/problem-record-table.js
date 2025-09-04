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
        }
    },
    /**
     * Data: 组件的响应式状态。
     */
    data() {
        return {
            problems: [],           // 从服务器获取的问题列表
            isLoading: false,       // 控制表格的加载动画
            dialogVisible: false,   // 控制新增/编辑对话框的显示与隐藏
            isEditMode: false,      // 标记对话框是用于“新增”还是“编辑”
            currentProblem: {       // 与对话框内表单双向绑定的数据模型
                id: null,
                stage: 'FMC',
                problemPoint: '',   // [FIXED] 统一为驼峰式
                description: '',
                status: 'OPEN'
            },
            formRules: {            // Element UI 表单的验证规则
                stage: [{ required: true, message: '请选择问题阶段', trigger: 'change' }],
                problemPoint: [{ required: true, message: '请输入问题点', trigger: 'blur' }] // [FIXED] 统一为驼峰式
            }
        };
    },
    /**
     * Lifecycle Hook: 在组件实例被创建后立即调用。
     * 这是发起初始数据请求的最佳位置。
     */
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


    /**
     * Methods: 包含组件的所有业务逻辑方法。
     */
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

        /**
         * 重置表单绑定的数据模型到初始状态。
         */
        resetForm() {
            this.currentProblem = {
                id: null,
                stage: 'FMC',
                problemPoint: '', // [FIXED] 统一为驼峰式
                description: '',
                status: 'OPEN'
            };
            if (this.$refs.problemForm) {
                this.$refs.problemForm.clearValidate();
            }
        },

        /**
         * 处理“新增问题”按钮的点击事件。
         */
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

        /**
         * 处理表格行内“删除”按钮的点击事件。
         * @param {number} problemId - 要删除的问题的ID。
         */
        handleDelete(problemId) {
            this.$confirm('此操作将永久删除该问题记录及其截图, 是否继续?', '提示', {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'warning'
            }).then(() => {
                axios.delete(`/api/problems/${problemId}`)
                    .then(() => {
                        this.$message.success('删除成功!');
                        this.fetchProblems(); // 删除成功后重新加载列表
                    })
                    .catch(error => {
                        this.$message.error('删除失败!');
                        console.error("删除问题时出错:", error);
                    });
            }).catch(() => {
                this.$message({ type: 'info', message: '已取消删除' });
            });
        },

        handleResolve(problem) {
            this.$confirm(`确定要将问题 "${problem.problemPoint}" 标记为已解决吗？`, '确认操作', {
                confirmButtonText: '确定', cancelButtonText: '取消', type: 'info'
            }).then(() => {
                axios.post(`/api/problems/${problem.id}/resolve`)
                    .then(response => {
                        this.$message.success('问题已成功标记为已解决！');
                        // 使用后端返回的数据进行局部更新，体验更好
                        const index = this.problems.findIndex(p => p.id === problem.id);
                        if (index !== -1) {
                            this.$set(this.problems, index, response.data);
                        } else {
                            this.fetchProblems(); // 兜底刷新
                        }
                    })
                    .catch(error => {
                        this.$message.error('操作失败: ' + (error.response?.data?.message || '未知错误'));
                    });
            }).catch(() => { });
        },
        /**
         * 提交表单（新增或更新）。
         */
        submitForm() {
            this.$refs.problemForm.validate(valid => {
                if (valid) {
                    const action = this.isEditMode
                        ? axios.put(`/api/problems/${this.currentProblem.id}`, this.currentProblem)
                        : axios.post(`/api/process-records/${this.recordId}/problems`, this.currentProblem);

                    action.then(() => {
                        this.$message.success(this.isEditMode ? '更新成功!' : '新增成功!');
                        this.dialogVisible = false;
                        this.fetchProblems(); // 操作成功后重新加载列表
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
         * 截图上传成功时的回调函数。
         * @param {object} res - 服务器返回的响应数据，应包含 { filePath: '...' }。
         * @param {object} file - Element UI 提供的文件对象。
         * @param {object} problem - 触发上传操作的那一行的问题数据对象。
         */
        handleScreenshotSuccess(res, file, problem) {
            console.log('截图上传成功，服务器响应:', res);
            this.$message.success('截图上传成功!');
            if (res.filePath) {
                // [FIXED] 直接修改行数据对象的属性，Vue的响应式系统会自动更新UI
                problem.screenshotPath = res.filePath;
            } else {
                this.$message.error('未能从服务器获取文件路径！');
            }
        },

        /**
         * 截图上传失败时的回调函数。
         * @param {Error} err - 错误对象。
         */
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
                    <el-button type="primary" icon="el-icon-plus" @click="handleAddNew">新增问题</el-button>
                </div>
            

                <el-table :data="problems" v-loading="isLoading" stripe style="width: 100%" border>
                    <el-table-column type="index" label="序号" width="60" align="center"></el-table-column>
                    <el-table-column prop="stage" label="阶段" width="120"></el-table-column>
                    <el-table-column prop="problemPoint" label="问题点" min-width="200"></el-table-column>
                    <el-table-column prop="description" label="描述" min-width="250" show-overflow-tooltip></el-table-column>
                    
                    <el-table-column label="截图" width="100" align="center">
                        <template slot-scope="scope">
                            <el-image 
                                v-if="scope.row.screenshotPath" 
                                style="width: 50px; height: 50px; display: block; margin: auto;"
                                :src="scope.row.screenshotPath" 
                                :preview-src-list="[scope.row.screenshotPath]">
                                <div slot="error" class="image-slot" style="text-align: center; line-height: 50px;">
                                    <i class="el-icon-picture-outline"></i>
                                </div>
                            </el-image>
                            <el-upload
                                v-else
                                class="screenshot-uploader"
                                :action="'/api/problems/' + scope.row.id + '/screenshot'"
                                :show-file-list="false"
                                :on-success="(res, file) => handleScreenshotSuccess(res, file, scope.row)"
                                :on-error="handleScreenshotError"
                                name="file">
                                <i class="el-icon-plus"></i>
                            </el-upload>
                        </template>
                    </el-table-column>

                    <el-table-column prop="status" label="状态" width="150" align="center">
                        <template slot-scope="scope">
                            
                            <el-tag v-if="scope.row.status === 'OPEN'" type="danger">
                                待解决
                            </el-tag>
                    
                            <el-tag v-else-if="scope.row.status === 'RESOLVED'" type="warning">
                                待复核
                            </el-tag>
                            
                            <el-tag v-else-if="scope.row.status === 'CLOSED'" type="success">
                                已复核
                            </el-tag>
                            
                            <el-tag v-else type="info">
                                {{ scope.row.status }}
                            </el-tag>
                    
                        </template>
                    </el-table-column>


                    <el-table-column prop="confirmedByUsername" label="确认人" width="120"></el-table-column>
                    <el-table-column prop="confirmedAt" label="确认时间" width="160"></el-table-column>

                    <el-table-column prop="reviewerUsername" label="审核人" width="120"></el-table-column>
                    
                    <!-- 审核时间列：绑定到别名 reviewedAt -->
                    <el-table-column prop="reviewedAt" label="审核时间" width="160"></el-table-column>

                    <el-table-column label="操作" width="180" align="center" fixed="right">
                        <template slot-scope="scope">
                        
                            <!-- ======================= 审核员模式下的操作按钮 ======================= -->
                            <div v-if="isReviewerMode">
                                
                                <!-- 场景1: 当问题状态为 OPEN (待解决) 时，审核员可以编辑和删除 -->
                                <template v-if="scope.row.status === 'OPEN'">
                                    <el-button size="mini" @click="handleEdit(scope.row)" icon="el-icon-edit">编辑</el-button>
                                    <el-button size="mini" type="danger" @click="handleDelete(scope.row.id)" icon="el-icon-delete">删除</el-button>
                                </template>
                                
                                <!-- 场景2: 当问题状态为 RESOLVED (待复核) 时，审核员可以关闭问题 -->
                                <el-button 
                                    v-else-if="scope.row.status === 'RESOLVED'"
                                    size="mini" 
                                    type="success" 
                                    icon="el-icon-circle-check"
                                    @click="handleClose(scope.row)">
                                    关闭问题
                                </el-button>
                                
                                <!-- 场景3: 当问题状态为 CLOSED (已关闭) 时，显示提示信息 -->
                                <el-tag v-else-if="scope.row.status === 'CLOSED'" type="success" effect="plain">已关闭</el-tag>
                    
                                <!-- 其他意外状态的兜底显示 -->
                                <el-tag v-else type="info">状态未知</el-tag>
                    
                            </div>
                    
                            <!-- ======================= 设计员模式下的操作按钮 ======================= -->
                            <div v-if="isDesignerMode">
                                
                                <!-- 场景1: 当问题状态为 OPEN (待解决) 时，设计员可以标记为已解决 -->
                                <el-button 
                                    v-if="scope.row.status === 'OPEN'"
                                    size="mini" 
                                    type="success" 
                                    icon="el-icon-check"
                                    @click="handleResolve(scope.row)">
                                    标记为已解决
                                </el-button>
                                
                                <!-- 场景2: 其他状态下，设计员都无需操作 -->
                                <el-tag v-else :type="scope.row.status === 'RESOLVED' ? 'warning' : 'info'" effect="plain">
                                    无需操作
                                </el-tag>
                    
                            </div>
                        </template>
                    </el-table-column>
                </el-table>

                <!-- 新增与编辑问题的对话框 -->
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