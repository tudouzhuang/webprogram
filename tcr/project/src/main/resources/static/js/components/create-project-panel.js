Vue.component('create-project-panel', {
    template: `
        <div class="main-panel">
            <div class="content-wrapper">
                <div class="card">
                    <div class="card-body">
                        <h4 class="card-title">新建项目信息录入</h4>
                        <p class="card-description">
                           请精确填写下方表格中的所有必填项，并上传关联的Excel文件。
                        </p>
                        
                        <el-form ref="projectForm" :model="projectForm" :rules="rules" label-width="150px" label-position="right">
                            
                            <!-- 基础信息部分 -->
                            <el-form-item label="项目号" prop="projectNumber"><el-input v-model="projectForm.projectNumber"></el-input></el-form-item>
                            <el-row :gutter="20">
                                <el-col :span="12"><el-form-item label="产品名" prop="productName"><el-input v-model="projectForm.productName"></el-input></el-form-item></el-col>
                                <el-col :span="12"><el-form-item label="制件材质" prop="material"><el-input v-model="projectForm.material"></el-input></el-form-item></el-col>
                            </el-row>
                            <el-row :gutter="20">
                                <el-col :span="12"><el-form-item label="零件号" prop="partNumber"><el-input v-model="projectForm.partNumber"></el-input></el-form-item></el-col>
                                <el-col :span="12"><el-form-item label="制件料厚" prop="thickness"><el-input v-model="projectForm.thickness"></el-input></el-form-item></el-col>
                            </el-row>
                            <el-row :gutter="20">
                                <el-col :span="12"><el-form-item label="工序号-工序内容" prop="process"><el-input v-model="projectForm.process"></el-input></el-form-item></el-col>
                                <el-col :span="12"><el-form-item label="抗拉强度" prop="tensileStrength"><el-input v-model="projectForm.tensileStrength"></el-input></el-form-item></el-col>
                            </el-row>
                            <el-form-item label="模具图号" prop="moldDrawingNumber"><el-input v-model="projectForm.moldDrawingNumber" type="textarea" :rows="2"></el-input></el-form-item>
                            <el-row :gutter="20">
                                <el-col :span="12"><el-form-item label="使用设备 (主线)" prop="equipment"><el-input v-model="projectForm.equipment"></el-input></el-form-item></el-col>
                                <el-col :span="12"><el-form-item label="客户名称" prop="customerName"><el-input v-model="projectForm.customerName"></el-input></el-form-item></el-col>
                            </el-row>

                            <el-divider>人员信息</el-divider>

                            <!-- 人员信息部分 -->
                            <el-row :gutter="20">
                                <el-col :span="12"><el-form-item label="设计人员" prop="designerName"><el-input v-model="projectForm.designerName"></el-input></el-form-item></el-col>
                                <el-col :span="12"><el-form-item label="日期" prop="designerDate"><el-date-picker type="date" placeholder="选择日期" v-model="projectForm.designerDate" style="width: 100%;"></el-date-picker></el-form-item></el-col>
                            </el-row>
                            <el-row :gutter="20">
                                <el-col :span="12"><el-form-item label="校对人员" prop="checkerName"><el-input v-model="projectForm.checkerName"></el-input></el-form-item></el-col>
                                <el-col :span="12"><el-form-item label="日期" prop="checkerDate"><el-date-picker type="date" placeholder="选择日期" v-model="projectForm.checkerDate" style="width: 100%;"></el-date-picker></el-form-item></el-col>
                            </el-row>
                            <el-row :gutter="20">
                                <el-col :span="12"><el-form-item label="审核人员" prop="auditorName"><el-input v-model="projectForm.auditorName"></el-input></el-form-item></el-col>
                                <el-col :span="12"><el-form-item label="日期" prop="auditorDate"><el-date-picker type="date" placeholder="选择日期" v-model="projectForm.auditorDate" style="width: 100%;"></el-date-picker></el-form-item></el-col>
                            </el-row>

                            <el-divider>尺寸与重量</el-divider>
                            
                            <el-form-item label="报价 尺寸">
                                <el-row :gutter="10" type="flex" align="middle">
                                    <el-col :span="7">
                                        <el-form-item prop="quoteSize.length" :show-message="false">
                                            <el-input v-model="projectForm.quoteSize.length" placeholder="长度(mm)"></el-input>
                                        </el-form-item>
                                    </el-col>
                                    <el-col :span="1" class="text-center">X</el-col>
                                    <el-col :span="7">
                                        <el-form-item prop="quoteSize.width" :show-message="false">
                                            <el-input v-model="projectForm.quoteSize.width" placeholder="宽度(mm)"></el-input>
                                        </el-form-item>
                                    </el-col>
                                    <el-col :span="1" class="text-center">X</el-col>
                                    <el-col :span="7">
                                        <el-form-item prop="quoteSize.height" :show-message="false">
                                            <el-input v-model="projectForm.quoteSize.height" placeholder="高度(mm)"></el-input>
                                        </el-form-item>
                                    </el-col>
                                </el-row>
                            </el-form-item>
                            
                            <el-form-item label="报价 重量" prop="quoteWeight">
                                <el-input v-model="projectForm.quoteWeight" placeholder="重量">
                                    <template slot="append">T</template>
                                </el-input>
                            </el-form-item>

                            <el-form-item label="实际 尺寸">
                                 <el-row :gutter="10" type="flex" align="middle">
                                    <el-col :span="7">
                                        <el-form-item prop="actualSize.length" :show-message="false">
                                            <el-input v-model="projectForm.actualSize.length" placeholder="长度(mm)"></el-input>
                                        </el-form-item>
                                    </el-col>
                                    <el-col :span="1" class="text-center">X</el-col>
                                    <el-col :span="7">
                                        <el-form-item prop="actualSize.width" :show-message="false">
                                            <el-input v-model="projectForm.actualSize.width" placeholder="宽度(mm)"></el-input>
                                        </el-form-item>
                                    </el-col>
                                    <el-col :span="1" class="text-center">X</el-col>
                                    <el-col :span="7">
                                        <el-form-item prop="actualSize.height" :show-message="false">
                                            <el-input v-model="projectForm.actualSize.height" placeholder="高度(mm)"></el-input>
                                        </el-form-item>
                                    </el-col>
                                </el-row>
                            </el-form-item>
                            
                            <el-form-item label="实际 重量" prop="actualWeight">
                                <el-input v-model="projectForm.actualWeight" placeholder="重量">
                                    <template slot="append">T</template>
                                </el-input>
                            </el-form-item>

                            <el-divider>文件上传</el-divider>
                            <el-form-item label="关联Excel文件" prop="excelFile">
                                <el-upload
                                    ref="upload"
                                    action="#" 
                                    :auto-upload="false"
                                    :limit="1"
                                    :on-change="handleFileChange"
                                    :on-exceed="handleFileExceed"
                                    :on-remove="handleFileRemove"
                                    accept=".xls,.xlsx">
                                    <el-button slot="trigger" size="small" type="primary">选取文件</el-button>
                                    <div slot="tip" class="el-upload__tip">只能上传一个 .xls 或 .xlsx 文件，且不超过50MB</div>
                                </el-upload>
                            </el-form-item>

                            <el-form-item>
                                <el-button type="primary" @click="submitForm">立即创建</el-button>
                                <el-button @click="resetForm">重置</el-button>
                            </el-form-item>
                        </el-form>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        const validateNumber = (rule, value, callback) => {
            if (value && !/^[0-9]+(\.[0-9]{1,2})?$/.test(value)) {
                callback(new Error('请输入有效的数字'));
            } else {
                callback();
            }
        };

        return {
            projectForm: {
                projectNumber: '',
                productName: '',
                material: '',
                partNumber: '',
                thickness: '',
                process: '',
                tensileStrength: '',
                moldDrawingNumber: '',
                equipment: '',
                customerName: '',
                designerName: '',
                designerDate: new Date(),
                checkerName: '',
                checkerDate: null,
                auditorName: '',
                auditorDate: null,
                quoteSize: { length: '', width: '', height: '' },
                quoteWeight: '',
                actualSize: { length: '', width: '', height: '' },
                actualWeight: ''
            },
            
            selectedFile: null, 

            rules: {
                // 所有验证规则保持不变，它们是正确的
                projectNumber: [{ required: true, message: '项目号不能为空', trigger: 'blur' }],
                // ... 其他规则 ...
            }
        }
    },
    methods: {
        handleFileChange(file, fileList) {
            console.log('文件已选择:', file.name);
            this.selectedFile = file.raw; 
        },
        handleFileExceed(files, fileList) {
            this.$message.warning(`只能选择 1 个文件，您已选择了一个文件，请先移除再重新选择。`);
        },
        handleFileRemove(file, fileList) {
            console.log('文件已移除');
            this.selectedFile = null;
        },
        submitForm() {
            // 使用Promise链确保验证流程清晰
            new Promise((resolve, reject) => {
                // 1. 首先验证表单字段
                this.$refs.projectForm.validate((valid) => {
                    if (valid) {
                        resolve(); // 验证通过，继续
                    } else {
                        reject(new Error('表单字段验证失败!!'));
                    }
                });
            })
            .then(() => {
                // 2. 然后验证文件是否已选择
                if (!this.selectedFile) {
                    return Promise.reject(new Error('请选择要上传的Excel文件！'));
                }
                
                // 3. 构造 FormData
                const formData = new FormData();
                formData.append('projectData', new Blob([JSON.stringify(this.projectForm)], { type: "application/json" }));
                formData.append('file', this.selectedFile);
                console.log('准备提交 FormData...');
                
                // 4. 【核心修改】发送POST请求到后端统一的创建接口
                return axios.post('/api/projects/create', formData);
            })
            .then(response => {
                // 5. 处理成功响应
                this.$message.success('项目和文件已成功提交创建！');
                this.resetForm();
            })
            .catch(error => {
                // 6. 统一处理所有失败情况 (字段验证失败、文件未选、网络请求失败)
                if (error.response) { // Axios错误
                    console.error('项目创建请求失败:', error.response);
                    const errorMessage = error.response.data || '创建失败，请联系管理员';
                    this.$message.error('错误: ' + errorMessage);
                } else { // 其他错误 (如验证失败)
                    console.error('提交过程中断:', error.message);
                    this.$message.error(error.message); // 显示如 "请选择要上传的Excel文件！"
                }
            });
        },
        resetForm() {
            this.$refs.projectForm.resetFields();
            this.projectForm.designerDate = new Date();
            if (this.$refs.upload) {
                this.$refs.upload.clearFiles();
            }
            this.selectedFile = null;
            this.$message('表单已重置。');
        }
    }
});