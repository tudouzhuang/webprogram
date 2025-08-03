Vue.component('process-record-panel', {
    props: {
        projectId: {
            type: [String, Number],
            required: true
        }
    },
    template: `
            <div class="main-panel" style="width:100%;height:100%">
                <div class="content-wrapper">
                    <div class="card">
                        <div class="card-body">
                            <h4 class="card-title">新建设计过程记录表</h4>
                            <p class="card-description">
                               请填写此零件/工序的相关信息，并从下方按钮列表中选择需要包含的检查项 (Sheet)。
                            </p>
                            
                            <el-form ref="recordForm" :model="recordForm" :rules="rules" label-width="120px" label-position="right">
                                <!-- 1. 零件和工序信息 -->
                                <el-row :gutter="20">
                                    <el-col :span="12">
                                        <el-form-item label="零件名称" prop="partName">
                                            <el-input v-model="recordForm.partName" placeholder="例如: 左前门外板"></el-input>
                                        </el-form-item>
                                    </el-col>
                                    <el-col :span="12">
                                        <el-form-item label="工序名称" prop="processName">
                                            <el-input v-model="recordForm.processName" placeholder="例如: OP10-拉延"></el-input>
                                        </el-form-item>
                                    </el-col>
                                </el-row>
                                
                                <el-divider>详细规格信息</el-divider>
                                
                                <!-- 基础信息部分 -->
                                <el-row :gutter="20">
                                    <el-col :span="12"><el-form-item label="制件材质" prop="material"><el-input v-model="recordForm.material"></el-input></el-form-item></el-col>
                                    <el-col :span="12"><el-form-item label="制件料厚" prop="thickness"><el-input v-model="recordForm.thickness" placeholder="例如: 1.2"></el-input></el-form-item></el-col>
                                </el-row>
                                <el-row :gutter="20">
                                    <el-col :span="12"><el-form-item label="抗拉强度" prop="tensileStrength"><el-input v-model="recordForm.tensileStrength" placeholder="例如: 350"></el-input></el-form-item></el-col>
                                    <el-col :span="12"><el-form-item label="客户名称" prop="customerName"><el-input v-model="recordForm.customerName"></el-input></el-form-item></el-col>
                                </el-row>
                                <el-form-item label="模具图号" prop="moldDrawingNumber"><el-input v-model="recordForm.moldDrawingNumber" type="textarea" :rows="2"></el-input></el-form-item>
                                <el-form-item label="使用设备 (主线)" prop="equipment"><el-input v-model="recordForm.equipment"></el-input></el-form-item>
                                
                                <el-divider>人员信息</el-divider>

                                <el-row :gutter="20">
                                    <el-col :span="12">
                                        <el-form-item label="设计人员" prop="designerName">
                                            <el-input v-model="recordForm.designerName" placeholder="请输入提交人姓名"></el-input>
                                        </el-form-item>
                                    </el-col>
                                    <el-col :span="12">
                                        <el-form-item label="日期" prop="designerDate">
                                            <el-date-picker type="date" placeholder="选择日期" v-model="recordForm.designerDate" style="width: 100%;"></el-date-picker>
                                        </el-form-item>
                                    </el-col>
                                </el-row>
                                <el-row :gutter="20">
                                    <el-col :span="12">
                                        <el-form-item label="校对人员" prop="checkerName">
                                            <el-input v-model="recordForm.checkerName" placeholder="提交后由校对人员填写" disabled></el-input>
                                        </el-form-item>
                                    </el-col>
                                    <el-col :span="12">
                                        <el-form-item label="日期" prop="checkerDate">
                                            <el-date-picker type="date" v-model="recordForm.checkerDate" style="width: 100%;" disabled></el-date-picker>
                                        </el-form-item>
                                    </el-col>
                                </el-row>
                                <el-row :gutter="20">
                                    <el-col :span="12">
                                        <el-form-item label="审核人员" prop="auditorName">
                                            <el-input v-model="recordForm.auditorName" placeholder="提交后由审核人员填写" disabled></el-input>
                                        </el-form-item>
                                    </el-col>
                                    <el-col :span="12">
                                        <el-form-item label="日期" prop="auditorDate">
                                            <el-date-picker type="date" v-model="recordForm.auditorDate" style="width: 100%;" disabled></el-date-picker>
                                        </el-form-item>
                                    </el-col>
                                </el-row>

                                <el-divider>尺寸与重量</el-divider>
                                
                                <!-- ======================================================= -->
                                <!--   ↓↓↓ 【核心修正 A】: 移除了尺寸部分嵌套的 el-form-item ↓↓↓   -->
                                <!-- ======================================================= -->
                                
                                <el-form-item label="报价 尺寸">
                                    <el-row :gutter="10">
                                        <el-col :span="7">
                                            <!-- 注意：这里的 prop 绑定在外层 el-form-item 上，内层不再需要 -->
                                            <el-input v-model="recordForm.quoteSize.length" placeholder="长度(mm)"></el-input>
                                        </el-col>
                                        <el-col :span="1" class="text-center">X</el-col>
                                        <el-col :span="7">
                                            <el-input v-model="recordForm.quoteSize.width" placeholder="宽度(mm)"></el-input>
                                        </el-col>
                                        <el-col :span="1" class="text-center">X</el-col>
                                        <el-col :span="7">
                                            <el-input v-model="recordForm.quoteSize.height" placeholder="高度(mm)"></el-input>
                                        </el-col>
                                    </el-row>
                                </el-form-item>
                                
                                <el-form-item label="报价 重量" prop="quoteWeight">
                                    <el-input v-model="recordForm.quoteWeight" placeholder="重量"><template slot="append">T</template></el-input>
                                </el-form-item>
                                
                                <el-form-item label="实际 尺寸">
                                     <el-row :gutter="10">
                                        <el-col :span="7">
                                            <el-input v-model="recordForm.actualSize.length" placeholder="长度(mm)"></el-input>
                                        </el-col>
                                        <el-col :span="1" class="text-center">X</el-col>
                                        <el-col :span="7">
                                            <el-input v-model="recordForm.actualSize.width" placeholder="宽度(mm)"></el-input>
                                        </el-col>
                                        <el-col :span="1" class="text-center">X</el-col>
                                        <el-col :span="7">
                                            <el-input v-model="recordForm.actualSize.height" placeholder="高度(mm)"></el-input>
                                        </el-col>
                                     </el-row>
                                </el-form-item>
                                
                                <el-form-item label="实际 重量" prop="actualWeight">
                                    <el-input v-model="recordForm.actualWeight" placeholder="重量"><template slot="append">T</template></el-input>
                                </el-form-item>
                                
                                <el-divider>检查项选择与文件上传</el-divider>

                                <el-form-item label="添加检查项" prop="selectedSheets">
                                    <div class="p-3 border rounded">
                                        <p class="text-muted small mb-3">点击下方的按钮来添加或移除过程记录表：</p>
                                        <div>
                                            <el-button 
                                                v-for="sheet in availableSheetTemplates" 
                                                :key="sheet.key"
                                                :type="isSheetSelected(sheet.key) ? 'success' : 'info'"
                                                @click="toggleSheetSelection(sheet.key)"
                                                size="small" class="m-1">
                                                {{ sheet.name }} <i v-if="isSheetSelected(sheet.key)" class="el-icon-check"></i>
                                            </el-button>
                                        </div>
                                    </div>
                                </el-form-item>

                                <el-form-item label="已选检查项">
                                    <div v-if="recordForm.selectedSheets.length > 0">
                                        <el-tag v-for="tag in recordForm.selectedSheets" :key="tag" closable @close="handleTagClose(tag)" class="m-1">
                                            {{ getSheetNameByKey(tag) }}
                                        </el-tag>
                                    </div>
                                    <p v-else class="text-muted">请从上方按钮列表中至少选择一个检查项。</p>
                                </el-form-item>

                                <!-- ======================================================= -->
                                <!--   ↓↓↓ 【核心修正 B】: 移除了上传文件 el-form-item 的 prop ↓↓↓   -->
                                <!-- ======================================================= -->
                                <el-form-item label="上传文件">
                                     <el-upload
                                        ref="recordUploader"
                                        action="#" 
                                        :http-request="() => {}"
                                        :auto-upload="false"
                                        :limit="1"
                                        :on-change="handleFileChange">
                                        <el-button slot="trigger" size="small" type="primary">
                                            选取包含 <strong class="text-danger">{{ recordForm.selectedSheets.length }}</strong> 个已选Sheet的Excel文件
                                        </el-button>
                                     </el-upload>
                                </el-form-item>

                                <el-divider>信息提交</el-divider>

                                <el-form-item>
                                    <el-button type="primary" @click="submitRecord" :loading="isSubmitting">提交记录表</el-button>
                                    <el-button @click="resetForm">重置表单</el-button>
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
            isSubmitting: false,
            recordForm: {
                partName: '',
                processName: '',
                material: '',
                thickness: '',
                tensileStrength: '',
                customerName: '',
                moldDrawingNumber: '',
                equipment: '',
                quoteSize: { length: '', width: '', height: '' },
                quoteWeight: '',
                actualSize: { length: '', width: '', height: '' },
                actualWeight: '',
                designerName: '',
                designerDate: new Date(),
                checkerName: null,
                checkerDate: null,
                auditorName: null,
                auditorDate: null,
                selectedSheets: [],
                file: null
            },
            availableSheetTemplates: [
                { key: '2-清单', name: '2-清单' },
                { key: '3定位、基准', name: '3-定位、基准' },
                { key: '4模具存放、限位', name: '4-模具存放、限位' },
                { key: '调试工艺卡', name: '调试工艺卡' },
                { key: '废料滑落检查', name: '废料滑落检查' },
                { key: '18修冲模', name: '18-修冲模' },
                { key: '20斜楔', name: '20-斜楔' }
            ],
            rules: {
                partName: [{ required: true, message: '零件名称不能为空', trigger: 'blur' }],
                processName: [{ required: true, message: '工序名称不能为空', trigger: 'blur' }],
                material: [{ required: true, message: '制件材质不能为空', trigger: 'blur' }],
                thickness: [{ required: true, message: '制件料厚不能为空', trigger: 'blur' }, { validator: validateNumber, trigger: 'blur' }],
                tensileStrength: [{ required: true, message: '抗拉强度不能为空', trigger: 'blur' }, { validator: validateNumber, trigger: 'blur' }],
                customerName: [{ required: true, message: '客户名称不能为空', trigger: 'blur' }],
                moldDrawingNumber: [{ required: true, message: '模具图号不能为空', trigger: 'blur' }],
                equipment: [{ required: true, message: '使用设备不能为空', trigger: 'blur' }],
                designerName: [{ required: true, message: '设计人员姓名不能为空', trigger: 'blur' }],
                designerDate: [{ type: 'date', required: true, message: '请选择设计日期', trigger: 'change' }],
                'quoteSize.length': [{ required: true, message: '长度不能为空', trigger: 'blur' }, { validator: validateNumber, trigger: 'blur' }],
                'quoteSize.width': [{ required: true, message: '宽度不能为空', trigger: 'blur' }, { validator: validateNumber, trigger: 'blur' }],
                'quoteSize.height': [{ required: true, message: '高度不能为空', trigger: 'blur' }, { validator: validateNumber, trigger: 'blur' }],
                quoteWeight: [{ required: true, message: '报价重量不能为空', trigger: 'blur' }, { validator: validateNumber, trigger: 'blur' }],
                'actualSize.length': [{ required: true, message: '长度不能为空', trigger: 'blur' }, { validator: validateNumber, trigger: 'blur' }],
                'actualSize.width': [{ required: true, message: '宽度不能为空', trigger: 'blur' }, { validator: validateNumber, trigger: 'blur' }],
                'actualSize.height': [{ required: true, message: '高度不能为空', trigger: 'blur' }, { validator: validateNumber, trigger: 'blur' }],
                actualWeight: [{ required: true, message: '实际重量不能为空', trigger: 'blur' }, { validator: validateNumber, trigger: 'blur' }],
                selectedSheets: [{ type: 'array', required: true, message: '请至少选择一个检查项', trigger: 'change' }]
            }
        }
    },
    methods: {
        toggleSheetSelection(sheetKey) {
            const index = this.recordForm.selectedSheets.indexOf(sheetKey);
            if (index > -1) {
                this.recordForm.selectedSheets.splice(index, 1);
            } else {
                this.recordForm.selectedSheets.push(sheetKey);
            }
        },
        isSheetSelected(sheetKey) {
            return this.recordForm.selectedSheets.includes(sheetKey);
        },
        handleTagClose(tag) {
            this.toggleSheetSelection(tag);
        },
        getSheetNameByKey(key) {
            const sheet = this.availableSheetTemplates.find(s => s.key === key);
            return sheet ? sheet.name : key;
        },
        handleFileChange(file) {
            this.recordForm.file = file.raw;
        },
        submitRecord() {
            console.log('%c--- 开始执行 submitRecord 方法 ---', 'color: blue; font-weight: bold;');
            if (!this.$refs.recordForm) {
                console.error('【严重错误】: this.$refs.recordForm 未定义！');
                this.$message.error('表单引用丢失，无法提交。');
                return;
            }
            this.$refs.recordForm.validate((valid, invalidFields) => {
                if (valid) {
                    console.log('%c【验证通过】', 'color: green; font-weight: bold;', '表单所有字段均符合规则。');
                    if (!this.recordForm.file) {
                        this.$message.error('请选择要上传的Excel文件！');
                        return;
                    }
                    this.isSubmitting = true;
                    const formData = new FormData();
                    const dataToSend = { ...this.recordForm };
                    delete dataToSend.file; 
                    formData.append('recordMeta', JSON.stringify(dataToSend));
                    formData.append('file', this.recordForm.file);

                    console.log('【准备发送】FormData 已创建，即将发送到后端...');
                    console.log('  - Project ID:', this.projectId);
                    console.log('  - Record Meta (JSON):', JSON.stringify(dataToSend));
                    console.log('  - File Name:', this.recordForm.file.name);

                    axios.post(`/api/projects/${this.projectId}/process-records`, formData)
                        .then(() => {
                            this.$message.success('过程记录表提交成功！');
                            this.resetForm();
                            this.$emit('record-created');
                        }).catch(error => {
                            const errorMessage = (error.response && error.response.data) ? error.response.data : '提交失败';
                            this.$message.error(errorMessage);
                            console.error('【请求失败】Axios 请求出错:', error);
                        }).finally(() => {
                            this.isSubmitting = false;
                        });
                } else {
                    console.error('%c【验证失败】', 'color: red; font-weight: bold;', '表单验证未通过！');
                    console.error('  - 未通过验证的字段详情:', invalidFields);
                    try {
                        const firstErrorField = Object.keys(invalidFields)[0];
                        const errorMessage = invalidFields[firstErrorField][0].message;
                        this.$message({
                            type: 'error',
                            message: `提交失败，请检查字段 [${firstErrorField}]: ${errorMessage}`,
                            duration: 5000
                        });
                    } catch (e) {
                         this.$message.error('表单中有多个字段未通过验证，请检查所有红色提示项。');
                    }
                    return false;
                }
            });
        },
        resetForm() {
            this.$refs.recordForm.resetFields();
            this.$refs.recordUploader.clearFiles();
            this.recordForm.file = null;
            this.recordForm.designerDate = new Date();
            this.recordForm.checkerName = null;
            this.recordForm.checkerDate = null;
            this.recordForm.auditorName = null;
            this.recordForm.auditorDate = null;
        }
    }
});