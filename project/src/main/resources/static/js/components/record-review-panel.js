Vue.component('record-review-panel', {
    // 【Props】: 同样接收 recordId
    props: {
        recordId: {
            type: [String, Number],
            required: true
        }
    },
    // 【模板】: 核心修改在这里，使用了el-row和el-col来实现左右分栏布局
    template: `
            <div class="content-wrapper" style="width:100%;height:100%">
                
                <!-- 1. 过程记录表主信息 (保持不变) -->
                <div class="card mb-4">
                    <div class="card-body">
                        <div v-if="isLoading" class="text-center p-3">
                            <p>正在加载过程记录表信息...</p>
                        </div>
                        <div v-else-if="loadError" class="alert alert-danger">{{ loadError }}</div>
                        <div v-else-if="recordInfo">
                            <el-descriptions title="过程记录表详情" :column="2" border>
                                <el-descriptions-item label="零件名称">{{ recordInfo.partName }}</el-descriptions-item>
                                <el-descriptions-item label="工序名称">{{ recordInfo.processName }}</el-descriptions-item>
                                <el-descriptions-item label="所属项目ID">{{ recordInfo.projectId }}</el-descriptions-item>
                                <el-descriptions-item label="记录创建时间">{{ recordInfo.createdAt }}</el-descriptions-item>
                            </el-descriptions>
                        </div>
                    </div>
                </div>

                <!-- 2. 【核心布局修改】使用 el-row 和 el-col 将预览和审核表单左右并排显示 -->
                <el-row :gutter="20">
                    <!-- 2a. 左侧：Luckysheet 预览区域 -->
                    <el-col :span="16">
                        <div class="card">
                            <div class="card-body">
                                <h4 class="card-title mb-0">文件预览</h4>
                                <hr>
                                <div v-if="!recordInfo || !recordInfo.sourceFilePath" class="text-muted p-5 text-center">
                                    此记录表没有关联可供预览的Excel文件。
                                </div>
                                <div v-else>
                                    <div v-if="isLoadingSheet" class="text-center p-5">
                                        <p>正在加载和转换预览文件...</p>
                                    </div>
                                    <div id="luckysheet-review-container" v-show="!isLoadingSheet" style="width: 100%; height: 80vh;"></div>
                                    <div v-if="loadSheetError" class="alert alert-warning mt-3">
                                        <strong>预览失败：</strong> {{ loadSheetError }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </el-col>

                    <!-- 2b. 右侧：审核表单区域 -->
                    <el-col :span="8">
                        <div class="card">
                            <div class="card-body">
                                <h4 class="card-title">审核操作</h4>
                                <p class="card-description">请根据左侧预览内容进行审核。</p>
                                
                                <el-form ref="reviewForm" :model="reviewForm" label-position="top">
                                    <el-form-item label="审核结果" prop="status">
                                        <el-radio-group v-model="reviewForm.status">
                                            <el-radio label="APPROVED">审核通过</el-radio>
                                            <el-radio label="REJECTED">驳回</el-radio>
                                        </el-radio-group>
                                    </el-form-item>

                                    <el-form-item label="审核意见" prop="comments">
                                        <el-input 
                                            type="textarea" 
                                            :rows="10" 
                                            placeholder="请输入详细的审核意见，如果驳回，请说明原因。" 
                                            v-model="reviewForm.comments">
                                        </el-input>
                                    </el-form-item>

                                    <!-- 更多审核项，例如： -->
                                    <el-form-item label="风险等级评估">
                                        <el-rate v-model="reviewForm.riskLevel" :colors="['#99A9BF', '#F7BA2A', '#FF9900']"></el-rate>
                                    </el-form-item>
                                    
                                    <el-form-item>
                                        <el-button type="primary" @click="submitReview" :loading="isSubmitting">提交审核</el-button>
                                        <el-button @click="resetReviewForm">重置</el-button>
                                    </el-form-item>
                                </el-form>
                            </div>
                        </div>
                    </el-col>
                </el-row>

            </div>
    `,
    
    data() {
        return {
            isLoading: true,
            recordInfo: null,
            loadError: null,
            
            isLoadingSheet: false,
            loadSheetError: null,
            
            isSubmitting: false,
            // 审核表单的数据模型
            reviewForm: {
                status: 'APPROVED', // 默认选中“通过”
                comments: '',
                riskLevel: 0
            }
        }
    },

    methods: {
        // --- 核心数据获取方法 (保持不变) ---
        fetchRecordData() {
            if (!this.recordId) return;
            this.isLoading = true;
            this.loadError = null;
            
            axios.get(`/api/process-records/${this.recordId}`)
                .then(response => {
                    this.recordInfo = response.data;
                    // 【联动】获取到数据后，如果有关联文件，则自动加载预览
                    if (this.recordInfo && this.recordInfo.sourceFilePath) {
                        this.$nextTick(() => {
                            const fileUrl = '/uploads/' + this.recordInfo.sourceFilePath;
                            this.renderSheetFromUrl(fileUrl);
                        });
                    }
                })
                .catch(error => { /* ... 错误处理 ... */ })
                .finally(() => { this.isLoading = false; });
        },

        // --- Luckysheet 渲染逻辑 (保持不变) ---
        renderSheetFromUrl(fileUrl) {
            this.isLoadingSheet = true;
            this.loadSheetError = null;
            if (!window.LuckyExcel || !window.luckysheet) { /* ... */ return; }

            axios.get(fileUrl, { responseType: 'blob' })
                .then(response => {
                    window.LuckyExcel.transformExcelToLucky(response.data,
                        (exportJson) => {
                            this.isLoadingSheet = false;
                            if (!exportJson.sheets || exportJson.sheets.length === 0) {
                                this.loadSheetError = "文件内容为空。";
                                return;
                            }
                            if (window.luckysheet) window.luckysheet.destroy();
                            
                            window.luckysheet.create({
                                container: 'luckysheet-review-container', // 注意ID已更改
                                data: exportJson.sheets, title: exportJson.info.name, lang: 'zh',
                                showtoolbar: false, showinfobar: false, showsheetbar: true,
                                showstatisticBar: false, sheetFormulaBar: false, allowUpdate: false
                            });
                        },
                        (error) => { /* ... 错误处理 ... */ }
                    );
                }).catch(error => { /* ... 错误处理 ... */ });
        },

        // --- 新增的审核表单方法 ---
        submitReview() {
            this.$refs.reviewForm.validate((valid) => {
                if (valid) {
                    this.isSubmitting = true;
                    console.log("准备提交审核数据:", this.reviewForm);

                    // 【后端API】调用后端的审核接口
                    axios.post(`/api/process-records/${this.recordId}/review`, this.reviewForm)
                        .then(response => {
                            this.$message.success("审核意见提交成功！");
                            // 审核成功后，可以触发事件通知父组件刷新列表
                            this.$emit('record-reviewed', response.data);
                        })
                        .catch(error => {
                            this.$message.error((error.response && error.response.data) || "提交失败");
                        })
                        .finally(() => {
                            this.isSubmitting = false;
                        });
                }
            });
        },
        resetReviewForm() {
            this.$refs.reviewForm.resetFields();
            // 手动重置非表单项的数据
            this.reviewForm.status = 'APPROVED';
            this.reviewForm.riskLevel = 0;
        }
    },

    watch: {
        // 监听 recordId 变化 (保持不变)
        recordId: {
            immediate: true,
            handler(newId) {
                if (newId) {
                    this.fetchRecordData();
                }
            }
        }
    },
    beforeDestroy() {
        if (window.luckysheet) {
            window.luckysheet.destroy();
        }
    }
});