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
                                
                                <el-form-item label="报价 尺寸">
                                    <el-row :gutter="10">
                                        <el-col :span="7">
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
                                
                                <el-divider>检查项文件上传</el-divider>

                                <el-form-item label="检查项文件" prop="sheetFiles">
                                    <div class="p-3 border rounded">
                                            <el-row :gutter="10" class="mb-3">
                                                <!-- 默认项选择区域 -->
                                                <el-col :span="12">
                                                    <div class="d-flex align-items-center">
                                                        <!-- 【修改】改为多选下拉框 -->
                                                        <el-select 
                                                            v-model="selectedTemplateKeys" 
                                                            multiple 
                                                            collapse-tags 
                                                            placeholder="请勾选需要的模板(可多选)" 
                                                            size="small" 
                                                            style="flex-grow: 1; margin-right: 10px;">
                                                            <el-option
                                                                v-for="item in availableSheetTemplates"
                                                                :key="item.key"
                                                                :label="item.name"
                                                                :value="item.key"
                                                                :disabled="isItemAlreadyAdded(item.key)">
                                                            </el-option>
                                                        </el-select>
                                                        <!-- 【修改】按钮改为批量添加 -->
                                                        <el-button @click="addSelectedTemplates" type="primary" size="small" icon="el-icon-plus" :loading="isTemplateLoading">批量添加</el-button>
                                                    </div>
                                                </el-col>
                                    
                                                <!-- 自定义项输入区域 -->
                                                <el-col :span="12">
                                                    <div class="d-flex align-items-center">
                                                        <el-input 
                                                            v-model="customSheetName" 
                                                            placeholder="或输入自定义检查项名称" 
                                                            size="small" 
                                                            style="flex-grow: 1; margin-right: 10px;"
                                                            @keyup.enter.native="addCustomSheetItem">
                                                        </el-input>
                                                        <el-button @click="addCustomSheetItem" type="success" size="small" icon="el-icon-plus" plain>添加自定义项</el-button>
                                                    </div>
                                                </el-col>
                                            </el-row>
                                
                                            <el-table v-if="recordForm.sheetFiles.length > 0" :data="recordForm.sheetFiles" style="width: 100%" border size="medium">
                                                <!-- 列1: 检查项名称 -->
                                                <el-table-column prop="name" label="检查项名称" min-width="180">
                                                    <template slot-scope="scope">
                                                        <span style="color: #F56C6C;">* </span>
                                                        <span>{{ scope.row.name }}</span>
                                                    </template>
                                                </el-table-column>
                                                
                                                <!-- 列2: 上传状态 -->
                                                <el-table-column label="上传状态" min-width="250">
                                                    <template slot-scope="scope">
                                                        <div v-if="scope.row.file">
                                                            <div class="d-flex align-items-center">
                                                                <i class="el-icon-success" style="color: #67C23A; font-size: 18px; margin-right: 8px;"></i>
                                                                <div>
                                                                    <div style="font-weight: 500; line-height: 1.2;">{{ scope.row.file.name }}</div>
                                                                    <div style="font-size: 12px; color: #909399; line-height: 1.2;">
                                                                        大小: {{ (scope.row.file.size / 1024).toFixed(2) }} KB
                                                                        <el-tag size="mini" type="info" v-if="scope.row.isTemplate" effect="plain" style="margin-left:5px">模板预设</el-tag>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div v-else class="d-flex align-items-center text-muted">
                                                            <i class="el-icon-warning-outline" style="font-size: 16px; margin-right: 8px;"></i>
                                                            <span>等待上传文件...</span>
                                                        </div>
                                                    </template>
                                                </el-table-column>
                                                
                                                <!-- 列3: 上传操作 -->
                                                <el-table-column label="上传操作" width="150" align="center">
                                                    <template slot-scope="scope">
                                                        <el-upload
                                                            action="#"
                                                            :http-request="() => {}"
                                                            :auto-upload="false"
                                                            :show-file-list="false"
                                                            :limit="1" 
                                                            :on-change="(file) => handleFileChange(file, scope.row.key)"
                                                            :on-exceed="() => handleFileExceed(scope.row.key)">
                                                            <el-button v-if="!scope.row.file" slot="trigger" size="mini" type="primary" icon="el-icon-upload2">选择文件</el-button>
                                                            <el-button v-else slot="trigger" size="mini" type="warning" icon="el-icon-refresh" plain>重新选择</el-button>
                                                        </el-upload>
                                                    </template>
                                                </el-table-column>
                                
                                                <!-- 列4: 删除操作 -->
                                                <el-table-column label="删除" width="100" align="center">
                                                    <template slot-scope="scope">
                                                        <el-button @click="removeSheetFileItem(scope.row.key)" type="danger" size="mini" icon="el-icon-delete" circle plain></el-button>
                                                    </template>
                                                </el-table-column>
                                            </el-table>
                                            
                                            <div v-else class="text-center text-muted p-4">
                                                <p>暂未添加任何检查项，请从上方选择并添加。</p>
                                            </div>
                                    </div>
                                </el-form-item>
                                
                                <el-divider>信息提交</el-divider>
            
                                <el-form-item>
                                    <el-button type="primary" @click="submitRecord" :loading="isSubmitting" :disabled="!isReadyToSubmit">
                                        提交记录表
                                    </el-button>
                                    <el-button @click="resetForm">重置表单</el-button>
                                </el-form-item>
                            </el-form>
                        </div>
                    </div>
                </div>
            </div>
    `,

    data() {
        const validateSheetFiles = (rule, value, callback) => {
            if (!value || value.length === 0) {
                callback(new Error('请至少添加一个检查项并上传文件'));
            } else {
                const allFilesUploaded = value.every(item => item.file !== null);
                if (!allFilesUploaded) {
                    callback(new Error('所有已添加的检查项都必须上传文件'));
                } else {
                    callback();
                }
            }
        };
        const validateNumber = (rule, value, callback) => {
            if (value && !/^[0-9]+(\.[0-9]{1,3})?$/.test(value)) {
                callback(new Error('请输入有效的数字, 最多三位小数'));
            } else {
                callback();
            }
        };

        return {
            isSubmitting: false,
            isTemplateLoading: false, // 控制添加模板按钮的 loading 状态
            selectedTemplateKeys: [], // 【修改】改为数组，用于多选
            customSheetName: '', 
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
                sheetFiles: []
            },
            // 【修改】更新为所有可用的模板文件列表
            availableSheetTemplates: [
                { key: '减重问题清单', name: '减重问题清单' },
                { key: '动态干涉检查', name: '动态干涉检查' },
                { key: '包边', name: '包边' },
                { key: '后工序', name: '后工序' },
                { key: '后序压力控制专项检查表', name: '后序压力控制专项检查表' },
                { key: '安全部件检查表', name: '安全部件检查表' },
                { key: '废料滑落检查表', name: '废料滑落检查表' },
                { key: '拉延', name: '拉延' },
                { key: '拉延调试工艺卡', name: '拉延调试工艺卡' },
                { key: '机床参数检查表', name: '机床参数检查表' },
                { key: '材质确认表', name: '材质确认表' },
                { key: '目录', name: '目录' },
                { key: '筋厚检查报告', name: '筋厚检查报告' },
                { key: '结构FMC审核记录表', name: '结构FMC审核记录表' },
                { key: '结构正式图审核记录表', name: '结构正式图审核记录表' },
                { key: '设计重大风险排查表', name: '设计重大风险排查表' },
                { key: '静态干涉检查', name: '静态干涉检查' }
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
                sheetFiles: [
                    { type: 'array', required: true },
                    { validator: validateSheetFiles, trigger: 'change' } // 使用自定义验证器
                ]
            }
        }
    },
    computed: {
        isReadyToSubmit() {
            // 只有在至少有一个检查项，并且所有检查项都上传了文件时才可提交
            if (this.recordForm.sheetFiles.length === 0) {
                return false;
            }
            return this.recordForm.sheetFiles.every(item => item.file !== null);
        }
    },
    methods: {
    isItemAlreadyAdded(keyOrName) {
        const trimmedValue = keyOrName.trim();
        return this.recordForm.sheetFiles.some(item => item.key.trim() === trimmedValue);
    },
    
    // 【核心修改】: 支持批量异步加载服务器端模板文件
    async addSelectedTemplates() {
        if (!this.selectedTemplateKeys || this.selectedTemplateKeys.length === 0) {
            this.$message.warning('请至少勾选一个模板。');
            return;
        }
        
        // 过滤掉已经添加的
        const keysToAdd = this.selectedTemplateKeys.filter(key => !this.isItemAlreadyAdded(key));
        
        if (keysToAdd.length === 0) {
            this.$message.warning('所选模板均已添加。');
            this.selectedTemplateKeys = []; // 清空选择
            return;
        }

        this.isTemplateLoading = true;
        let successCount = 0;
        let failCount = 0;

        try {
            // 并行处理所有选中的模板
            await Promise.all(keysToAdd.map(async (key) => {
                const template = this.availableSheetTemplates.find(t => t.key === key);
                if (!template) return;

                try {
                    // 1. 尝试从服务器静态资源目录获取文件
                    // 假设后端静态资源映射是默认的，文件存放在 src/main/resources/static/templates/
                    // 浏览器访问路径通常为 /templates/文件名.xlsx
                    const fileName = template.name + '.xlsx'; // 假设文件后缀为 .xlsx
                    const fileUrl = `/templates/${encodeURIComponent(template.name)}.xlsx`; // URL编码防止中文乱码

                    const response = await axios.get(fileUrl, { 
                        responseType: 'blob', // 关键：告诉 axios 返回二进制流
                        validateStatus: status => status === 200 // 只接受 200 OK
                    });

                    // 2. 将 Blob 转换为 File 对象
                    const file = new File([response.data], fileName, { 
                        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        lastModified: new Date().getTime()
                    });

                    // 3. 添加到列表
                    this.recordForm.sheetFiles.push({
                        key: template.key,
                        name: template.name,
                        file: file, 
                        isTemplate: true 
                    });
                    successCount++;

                } catch (error) {
                    console.error(`加载模板 "${template.name}" 失败:`, error);
                    failCount++;
                    // 加载失败时添加一个空项，让用户知道这个模板有问题
                    this.recordForm.sheetFiles.push({
                        key: template.key,
                        name: template.name,
                        file: null,
                        isTemplate: false
                    });
                }
            }));

            if (successCount > 0) {
                this.$message.success(`成功添加 ${successCount} 个模板项。`);
            }
            if (failCount > 0) {
                this.$message.warning(`${failCount} 个模板文件加载失败，已添加空项请手动上传。`);
            }

            this.selectedTemplateKeys = []; // 清空选择
            this.$refs.recordForm.validateField('sheetFiles');

        } catch (error) {
            console.error("批量添加模板过程发生错误:", error);
            this.$message.error("批量添加过程中发生错误。");
        } finally {
            this.isTemplateLoading = false;
        }
    },
    
    // 添加自定义项 (保持手动上传逻辑)
    addCustomSheetItem() {
        const name = this.customSheetName.trim();
        if (!name) {
            this.$message.warning('请输入有效的自定义检查项名称。');
            return;
        }
        if (this.isItemAlreadyAdded(name)) {
            this.$message.error(`检查项 "${name}" 已存在，请勿重复添加。`);
            return;
        }
        this.recordForm.sheetFiles.push({ key: name, name: name, file: null, isTemplate: false });
        this.customSheetName = '';
        this.$refs.recordForm.validateField('sheetFiles');
    },

    // 移除检查项
    removeSheetFileItem(sheetKeyToRemove) {
        this.$confirm('确定要移除此检查项及其已选择的文件吗?', '确认删除', {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
        }).then(() => {
            const index = this.recordForm.sheetFiles.findIndex(item => item.key === sheetKeyToRemove);
            if (index !== -1) {
                this.recordForm.sheetFiles.splice(index, 1);
                this.$message.success('检查项已移除。');
                this.$refs.recordForm.validateField('sheetFiles');
            }
        }).catch(() => {});
    },
        
    // 文件选择
    handleFileChange(file, sheetKey) {
        const index = this.recordForm.sheetFiles.findIndex(sheet => sheet.key === sheetKey);
        if (index !== -1) {
            const updatedSheet = { ...this.recordForm.sheetFiles[index], file: file.raw, isTemplate: false }; // 手动上传覆盖后，取消模板标记
            this.$set(this.recordForm.sheetFiles, index, updatedSheet);
            this.$message.success(`已为 "${updatedSheet.name}" 选择文件: ${file.name}`);
            this.$refs.recordForm.validateField('sheetFiles');
        }
    },

    // 文件超出限制
    handleFileExceed(sheetKey) {
        this.$message.warning(`"${sheetKey}" 只能选择一个文件，新选择的将覆盖旧的。`);
    },

    // 提交记录
    submitRecord() {
        this.$refs.recordForm.validate((valid) => {
            if (valid) {
                this.isSubmitting = true;
                const formData = new FormData();
                const metaData = { ...this.recordForm };
                delete metaData.sheetFiles;
                formData.append('recordMeta', new Blob([JSON.stringify(metaData)], { type: 'application/json' }));
                this.recordForm.sheetFiles.forEach(sheetFile => {
                    if (sheetFile.file) {
                        // 使用检查项名称作为 key，这样后端可以识别是哪个Sheet
                        // 如果是自动加载的模板，file.name 也是对的
                        formData.append(sheetFile.key, sheetFile.file, sheetFile.file.name);
                    }
                });
                axios.post(`/api/projects/${this.projectId}/process-records-multi-file`, formData)
                .then(() => {
                    this.$message.success('提交成功！');
                    this.$emit('record-created');
                    this.resetForm();
                }).catch(error => {
                    this.$message.error(error.response?.data?.message || '提交失败');
                }).finally(() => {
                    this.isSubmitting = false;
                });
            } else {
                this.$message.error('表单验证失败，请检查必填项！');
            }
        });
    },

        // 更新 resetForm 方法
        resetForm() {
            this.$refs.recordForm.resetFields();
            this.recordForm.sheetFiles = [];
            this.selectedTemplateKeys = []; // 【修改】重置数组
            this.customSheetName = ''; // 确保自定义输入框也被清空
            this.recordForm.designerDate = new Date();
        },
    }
});