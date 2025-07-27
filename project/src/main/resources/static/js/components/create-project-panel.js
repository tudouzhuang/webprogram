Vue.component('create-project-panel', {
    template: `
        <div class="main-panel">
            <div class="content-wrapper">
                <div class="card">
                    <div class="card-body">
                        <h4 class="card-title">新建项目信息录入</h4>
                        <p class="card-description">
                           请精确填写下方表格中的所有项目基础信息。
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

                            <!-- 人员信息部分 -->
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
                            
                            <!-- 尺寸与重量部分 -->
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
            if (value && !/^[0-9]+(\.[0-9]{1,3})?$/.test(value)) {
                callback(new Error('请输入有效的数字, 最多三位小数'));
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
                checkerName: null,
                checkerDate: null,
                auditorName: null,
                auditorDate: null,
                quoteSize: { length: '', width: '', height: '' },
                quoteWeight: '',
                actualSize: { length: '', width: '', height: '' },
                actualWeight: ''
            },
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
                ]
            }
        }
    },
    methods: {
        submitForm() {
            if (this.isSubmitting) return;

            this.$refs.projectForm.validate((valid) => {
                if (valid) {
                    this.isSubmitting = true;
                    
                    console.log('表单验证通过，准备提交 JSON 数据:', this.projectForm);
                    
                    axios.post('/api/projects/create-info', this.projectForm)
                        .then(response => {
                            this.$message.success('项目基础信息创建成功！');
                            this.resetForm();
                            // 触发一个事件，通知父组件项目已创建成功
                            this.$emit('project-created'); 
                        })
                        .catch(error => {
                            if (error.response && error.response.data) {
                                // 优先显示后端返回的明确错误信息
                                this.$message.error('错误: ' + error.response.data);
                            } else {
                                this.$message.error('网络错误或服务器无法响应，请稍后再试。');
                            }
                            console.error('项目创建请求失败:', error);
                        })
                        .finally(() => {
                            this.isSubmitting = false;
                        });
                } else {
                    console.log('表单验证失败!!');
                    this.$message.error('请检查表单，所有必填项都需正确填写。');
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
            this.$message('表单已重置。');
        }
    }
});