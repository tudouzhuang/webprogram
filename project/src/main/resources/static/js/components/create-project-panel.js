Vue.component('create-project-panel', {
    template: `
        <div>
            <div class="content-wrapper" style="width:100%; height:100%;">
                <div class="card" >
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
                                <el-col :span="12"><el-form-item label="制件料厚" prop="thickness"><el-input v-model="projectForm.thickness" placeholder="例如: 1.2"></el-input></el-form-item></el-col>
                            </el-row>
                            <el-row :gutter="20">
                                <el-col :span="12"><el-form-item label="工序号-工序内容" prop="process"><el-input v-model="projectForm.process"></el-input></el-form-item></el-col>
                                <el-col :span="12"><el-form-item label="抗拉强度" prop="tensileStrength"><el-input v-model="projectForm.tensileStrength" placeholder="例如: 350"></el-input></el-form-item></el-col>
                            </el-row>
                            <el-form-item label="模具图号" prop="moldDrawingNumber"><el-input v-model="projectForm.moldDrawingNumber" type="textarea" :rows="2"></el-input></el-form-item>
                            <el-row :gutter="20">
                                <el-col :span="12"><el-form-item label="使用设备 (主线)" prop="equipment"><el-input v-model="projectForm.equipment"></el-input></el-form-item></el-col>
                                <el-col :span="12"><el-form-item label="客户名称" prop="customerName"><el-input v-model="projectForm.customerName"></el-input></el-form-item></el-col>
                            </el-row>

                            <el-divider>人员信息</el-divider>

                            <el-row :gutter="20">
                                <el-col :span="12"><el-form-item label="设计人员" prop="designerName"><el-input v-model="projectForm.designerName"></el-input></el-form-item></el-col>
                                <el-col :span="12"><el-form-item label="日期" prop="designerDate"><el-date-picker type="date" placeholder="选择日期" v-model="projectForm.designerDate" style="width: 100%;"></el-date-picker></el-form-item></el-col>
                            </el-row>
                            <el-row :gutter="20">
                                <el-col :span="12"><el-form-item label="校对人员" prop="checkerName"><el-input v-model="projectForm.checkerName" disabled></el-input></el-form-item></el-col>
                                <el-col :span="12"><el-form-item label="日期" prop="checkerDate"><el-date-picker type="date" placeholder="自动生成" v-model="projectForm.checkerDate" style="width: 100%;" disabled></el-date-picker></el-form-item></el-col>
                            </el-row>
                            <el-row :gutter="20">
                                <el-col :span="12"><el-form-item label="审核人员" prop="auditorName"><el-input v-model="projectForm.auditorName" disabled></el-input></el-form-item></el-col>
                                <el-col :span="12"><el-form-item label="日期" prop="auditorDate"><el-date-picker type="date" placeholder="自动生成" v-model="projectForm.auditorDate" style="width: 100%;" disabled></el-date-picker></el-form-item></el-col>
                            </el-row>

                            <el-divider>尺寸与重量</el-divider>
                            
                            <!-- ======================================================= -->
                            <!--   ↓↓↓  【核心修正】补全尺寸输入的完整HTML结构  ↓↓↓   -->
                            <!-- ======================================================= -->
                            <el-form-item label="报价 尺寸" prop="quoteSize">
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
                                <el-input v-model="projectForm.quoteWeight" placeholder="重量"><template slot="append">T</template></el-input>
                            </el-form-item>

                            <el-form-item label="实际 尺寸" prop="actualSize">
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
                                <el-input v-model="projectForm.actualWeight" placeholder="重量"><template slot="append">T</template></el-input>
                            </el-form-item>

                            <el-divider>文件上传</el-divider>
                            <el-form-item label="关联Excel文件" prop="excelFile">
                                <el-upload ref="upload" action="#" :auto-upload="false" :limit="1" :on-change="handleFileChange" :on-exceed="handleFileExceed" :on-remove="handleFileRemove" accept=".xls,.xlsx">
                                    <el-button slot="trigger" size="small" type="primary">选取文件</el-button>
                                    <div slot="tip" class="el-upload__tip">只能上传一个 .xls 或 .xlsx 文件，且不超过50MB</div>
                                </el-upload>
                            </el-form-item>

                            <el-form-item>
                                <el-button type="primary" @click="submitForm" :loading="isSubmitting">立即创建</el-button>
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
                projectNumber: '', productName: '', material: '', partNumber: '',
                thickness: '', process: '', tensileStrength: '', moldDrawingNumber: '',
                equipment: '', customerName: '', designerName: '', designerDate: new Date(),
                checkerName: null, checkerDate: null, auditorName: null, auditorDate: null,
                quoteSize: { length: '', width: '', height: '' },
                quoteWeight: '',
                actualSize: { length: '', width: '', height: '' },
                actualWeight: ''
            },
            selectedFile: null, 
            isSubmitting: false,
            rules: {
                projectNumber: [{ required: true, message: '项目号不能为空', trigger: 'blur' }],
                productName: [{ required: true, message: '产品名不能为空', trigger: 'blur' }],
                material: [{ required: true, message: '制件材质不能为空', trigger: 'blur' }],
                partNumber: [{ required: true, message: '零件号不能为空', trigger: 'blur' }],
                thickness: [
                    { required: true, message: '制件料厚不能为空', trigger: 'blur' },
                    { validator: validateNumber, trigger: 'blur' }
                ],
                process: [{ required: true, message: '工序信息不能为空', trigger: 'blur' }],
                tensileStrength: [
                    { required: true, message: '抗拉强度不能为空', trigger: 'blur' },
                    { validator: validateNumber, trigger: 'blur' }
                ],
                moldDrawingNumber: [{ required: true, message: '模具图号不能为空', trigger: 'blur' }],
                equipment: [{ required: true, message: '使用设备不能为空', trigger: 'blur' }],
                customerName: [{ required: true, message: '客户名称不能为空', trigger: 'blur' }],
                designerName: [{ required: true, message: '设计人员不能为空', trigger: 'blur' }],
                designerDate: [{ type: 'date', required: true, message: '请选择设计日期', trigger: 'change' }],
                'quoteSize.length': [
                    { required: true, message: '长度不能为空', trigger: 'blur' },
                    { validator: validateNumber, trigger: 'blur' }
                ],
                'quoteSize.width': [
                    { required: true, message: '宽度不能为空', trigger: 'blur' },
                    { validator: validateNumber, trigger: 'blur' }
                ],
                'quoteSize.height': [
                    { required: true, message: '高度不能为空', trigger: 'blur' },
                    { validator: validateNumber, trigger: 'blur' }
                ],
                quoteWeight: [
                    { required: true, message: '报价重量不能为空', trigger: 'blur' },
                    { validator: validateNumber, trigger: 'blur' }
                ],
                'actualSize.length': [
                    { required: true, message: '长度不能为空', trigger: 'blur' },
                    { validator: validateNumber, trigger: 'blur' }
                ],
                'actualSize.width': [
                    { required: true, message: '宽度不能为空', trigger: 'blur' },
                    { validator: validateNumber, trigger: 'blur' }
                ],
                'actualSize.height': [
                    { required: true, message: '高度不能为空', trigger: 'blur' },
                    { validator: validateNumber, trigger: 'blur' }
                ],
                actualWeight: [
                    { required: true, message: '实际重量不能为空', trigger: 'blur' },
                    { validator: validateNumber, trigger: 'blur' }
                ],
                excelFile: [{ 
                    required: true, 
                    validator: (rule, value, callback) => {
                        if (this.selectedFile) {
                            callback();
                        } else {
                            callback(new Error('请上传Excel文件'));
                        }
                    },
                    trigger: 'change' 
                }]
            }
        }
    },
    methods: {
        handleFileChange(file, fileList) {
            this.selectedFile = file.raw;
            this.$refs.projectForm.validateField('excelFile');
        },
        handleFileExceed(files, fileList) {
            this.$message.warning(`只能选择 1 个文件，请先移除当前文件再重新选择。`);
        },
        handleFileRemove(file, fileList) {
            this.selectedFile = null;
        },
        submitForm() {
            if (this.isSubmitting) return;
            this.$refs.projectForm.validate((valid) => {
                if (valid) {
                    this.isSubmitting = true;
                    const formData = new FormData();
                    formData.append('projectData', new Blob([JSON.stringify(this.projectForm)], { type: "application/json" }));
                    formData.append('file', this.selectedFile);
                    console.log('表单验证通过，准备提交 FormData...');
                    axios.post('/api/projects/create', formData)
                        .then(response => {
                            this.$message.success('项目创建成功！');
                            this.resetForm();
                            setTimeout(() => {
                                window.location.reload();
                            }, 1500);
                        })
                        .catch(error => {
                            if (error.response) {
                                const errorMessage = error.response.data || '创建失败，请联系管理员';
                                this.$message.error('错误: ' + errorMessage);
                            } else {
                                this.$message.error('网络错误或请求无法发送。');
                            }
                        })
                        .finally(() => {
                            this.isSubmitting = false;
                        });
                } else {
                    console.log('表单验证失败!!');
                    this.$message.error('请检查表单，所有必填项都需填写。');
                    return false;
                }
            });
        },
        resetForm() {
            this.$refs.projectForm.resetFields();
            this.projectForm.designerDate = new Date();
            this.projectForm.checkerName = null;
            this.projectForm.checkerDate = null;
            this.projectForm.auditorName = null;
            this.projectForm.auditorDate = null;
            if (this.$refs.upload) {
                this.$refs.upload.clearFiles();
            }
            this.selectedFile = null;
            this.$message('表单已重置。');
        }
    }
});