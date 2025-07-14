// js/components/create-project-panel.js

Vue.component('create-project-panel', {
    template: `
        <div >
            <div class="content-wrapper" style="width:100%; height:100%">
                <div class="card">
                    <div class="card-body">
                        <h4 class="card-title">新建项目信息录入</h4>
                        <p class="card-description">
                           请精确填写下方表格中的所有必填项
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
        // 自定义数字验证函数
        const validateNumber = (rule, value, callback) => {
            if (value && !/^[0-9]+(\.[0-9]{1,2})?$/.test(value)) {
                callback(new Error('请输入有效的数字'));
            } else {
                callback();
            }
        };

        return {
            // 表单数据模型
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
            // 表单验证规则
            rules: {
                projectNumber: [{ required: true, message: '项目号不能为空', trigger: 'blur' }],
                productName: [{ required: true, message: '产品名不能为空', trigger: 'blur' }],
                customerName: [{ required: true, message: '客户名称不能为空', trigger: 'blur' }],
                designerName: [{ required: true, message: '设计人员不能为空', trigger: 'blur' }],
                designerDate: [{ required: true, message: '请选择设计日期', trigger: 'change' }],
                
                'quoteSize.length': [
                    { required: true, message: ' ', trigger: 'blur' },
                    { validator: validateNumber, trigger: 'blur' }
                ],
                'quoteSize.width': [
                    { required: true, message: ' ', trigger: 'blur' },
                    { validator: validateNumber, trigger: 'blur' }
                ],
                'quoteSize.height': [
                    { required: true, message: ' ', trigger: 'blur' },
                    { validator: validateNumber, trigger: 'blur' }
                ],
                quoteWeight: [
                    { required: true, message: '报价重量不能为空', trigger: 'blur' },
                    { validator: validateNumber, trigger: 'blur' }
                ],
                'actualSize.length': [
                    { required: true, message: ' ', trigger: 'blur' },
                    { validator: validateNumber, trigger: 'blur' }
                ],
                'actualSize.width': [
                    { required: true, message: ' ', trigger: 'blur' },
                    { validator: validateNumber, trigger: 'blur' }
                ],
                'actualSize.height': [
                    { required: true, message: ' ', trigger: 'blur' },
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
            this.$refs.projectForm.validate((valid) => {
                if (valid) {
                    // 【修正】在提交前组合数据，移除了错误的 \
                    const dataToSubmit = {
                        ...this.projectForm,
                        quoteSize: `${this.projectForm.quoteSize.length}*${this.projectForm.quoteSize.width}*${this.projectForm.quoteSize.height}`,
                        actualSize: `${this.projectForm.actualSize.length}*${this.projectForm.actualSize.width}*${this.projectForm.actualSize.height}`
                    };
                    console.log('验证通过，准备提交的组合后数据:', dataToSubmit);
                    
                    this.$message.success('验证成功！数据已在控制台打印。');
                    // 可以在这里调用 axios 将 dataToSubmit 发送到后端
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
            this.$message('表单已重置。');
        }
    }
});