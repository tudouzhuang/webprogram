Vue.component('create-project-panel', {
    // 【模板】: 简化到极致，只剩下一个输入框和两个按钮
    template: `
            <div class="content-wrapper" style="width:100%;height:100%">
                <div class="card">
                    <div class="card-body">
                        <h4 class="card-title">新建项目</h4>
                        <p class="card-description">
                           请输入一个唯一的项目号来启动一个新项目。
                        </p>
                        
                        <el-form ref="projectForm" :model="projectForm" :rules="rules" label-width="120px" label-position="right" style="max-width: 600px;">
                            
                            <el-form-item label="项目号" prop="projectNumber">
                                <el-input v-model="projectForm.projectNumber" placeholder="请输入项目号"></el-input>
                            </el-form-item>

                            <el-form-item>
                                <el-button type="primary" @click="submitForm" :loading="isSubmitting">立即创建项目</el-button>
                                <el-button @click="resetForm">重置</el-button>
                            </el-form-item>
                        </el-form>
                    </div>
                </div>
            </div>
    `,
    
    // 【数据】: 只保留 projectNumber
    data() {
        return {
            projectForm: {
                projectNumber: ''
            },
            isSubmitting: false,
            rules: {
                projectNumber: [
                    { required: true, message: '项目号不能为空', trigger: 'blur' },
                    { min: 1, max: 100, message: '长度在 1 到 100 个字符', trigger: 'blur' }
                ]
            }
        }
    },

    // 【方法】: 提交的数据只有一个字段
    methods: {
        submitForm() {
            if (this.isSubmitting) return;

            this.$refs.projectForm.validate((valid) => {
                if (valid) {
                    this.isSubmitting = true;
                    
                    console.log('表单验证通过，准备提交的项目号:', this.projectForm);
                    
                    // 【关键】后端API可以保持不变或简化
                    axios.post('/api/projects', this.projectForm)
                        .then(response => {
                            this.$message.success('新项目 "' + response.data.projectNumber + '" 创建成功！');
                            this.resetForm();
                            // 触发事件，通知父组件项目已创建成功
                            this.$emit('project-created', response.data); 
                        })
                        .catch(error => {
                            if (error.response && error.response.data) {
                                this.$message.error('错误: ' + error.response.data);
                            } else {
                                this.$message.error('网络错误或服务器无法响应。');
                            }
                            console.error('项目创建请求失败:', error);
                        })
                        .finally(() => {
                            this.isSubmitting = false;
                        });
                } else {
                    console.log('表单验证失败!!');
                    return false;
                }
            });
        },
        resetForm() {
            this.$refs.projectForm.resetFields();
        }
    }
});