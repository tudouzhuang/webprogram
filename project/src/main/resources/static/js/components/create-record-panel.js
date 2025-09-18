Vue.component('create-record-panel', {
    template: `
        <div class="content-wrapper create-record-panel" v-loading.fullscreen.lock="isSubmitting">
            <!-- 页面标题 -->
            <div class="page-header">
                <h3 class="page-title">
                    <span class="page-title-icon bg-gradient-primary text-white me-2">
                        <i class="mdi mdi-file-document-box-plus-outline"></i>
                    </span>
                    新建设计记录
                </h3>
                <nav aria-label="breadcrumb">
                    <ol class="breadcrumb">
                        <li class="breadcrumb-item"><el-button @click="goBack" icon="el-icon-back" size="small">返回列表</el-button></li>
                    </ol>
                </nav>
            </div>

            <!-- 主内容区 -->
            <div class="row">
                <!-- 左侧：素材库和待选区 -->
                <div class="col-md-8 grid-margin stretch-card">
                    <el-card class="box-card">
                        <div slot="header">
                            <span><strong>步骤 1:</strong> 从素材库选择或自定义检查项</span>
                        </div>
                        
                        <!-- 模板选择 -->
                        <div class="template-selector">
                            <el-select v-model="selectedTemplateId" placeholder="请选择一个检查项模板" @change="loadTemplateItems" style="width: 70%;">
                                <el-option v-for="template in templates" :key="template.id" :label="template.templateName" :value="template.id"></el-option>
                            </el-select>
                            <el-button @click="addAllTemplateItems" type="primary" plain :disabled="!availableItems.length">一键添加该模板所有项</el-button>
                        </div>
                        
                        <!-- 待选列表 -->
                        <div class="item-list-wrapper" v-loading="isLoadingTemplate">
                            <el-table :data="availableItems" @selection-change="handleSelectionChange" ref="availableTable" height="300">
                                <el-table-column type="selection" width="55"></el-table-column>
                                <el-table-column property="itemDescription" label="检查项内容"></el-table-column>
                            </el-table>
                        </div>
                        <el-button @click="addSelectedItems" type="primary" :disabled="!selectedItems.length" style="margin-top: 15px;">
                            将选中的 {{ selectedItems.length }} 项添加到右侧 <i class="el-icon-d-arrow-right"></i>
                        </el-button>
                        
                        <el-divider>或者，添加自定义检查项</el-divider>
                        
                        <!-- 自定义添加 -->
                        <div class="custom-add">
                            <el-input type="textarea" :rows="3" placeholder="在此输入自定义检查项内容..." v-model="customItemText"></el-input>
                            <el-button @click="addCustomItem" type="success" plain style="margin-top: 10px;">添加自定义项到待选列表</el-button>
                        </div>
                    </el-card>
                </div>

                <!-- 右侧：已选区 -->
                <div class="col-md-4 grid-margin stretch-card">
                    <el-card class="box-card">
                         <div slot="header">
                            <span><strong>步骤 2:</strong> 确认最终检查项 ({{ finalItems.length }} 项)</span>
                        </div>
                        <div class="item-list-wrapper final-list">
                            <el-table :data="finalItems" height="420">
                                <el-table-column property="itemDescription" label="已选内容"></el-table-column>
                                <el-table-column label="操作" width="80">
                                    <template slot-scope="scope">
                                        <el-button type="danger" icon="el-icon-delete" circle size="mini" @click="removeItem(scope.$index)"></el-button>
                                    </template>
                                </el-table-column>
                            </el-table>
                        </div>
                        <el-button @click="clearFinalItems" type="danger" plain :disabled="!finalItems.length" style="margin-top: 15px;">
                            <i class="el-icon-refresh-left"></i> 全部清空
                        </el-button>
                    </el-card>
                </div>
            </div>
            
            <!-- 底部：基础信息表单和提交按钮 -->
            <div class="row">
                <div class="col-12 grid-margin stretch-card">
                     <el-card class="box-card">
                         <div slot="header">
                            <span><strong>步骤 3:</strong> 填写基本信息并创建</span>
                        </div>
                        <el-form :model="recordForm" :rules="formRules" ref="recordForm" label-width="100px">
                             <el-row>
                                <el-col :span="12">
                                    <el-form-item label="零件名称" prop="partName">
                                        <el-input v-model="recordForm.partName" placeholder="请输入零件名称"></el-input>
                                    </el-form-item>
                                </el-col>
                                <el-col :span="12">
                                     <el-form-item label="工序名称" prop="processName">
                                        <el-input v-model="recordForm.processName" placeholder="请输入工序名称"></el-input>
                                    </el-form-item>
                                </el-col>
                            </el-row>
                            <el-form-item style="text-align: center; margin-top: 20px;">
                                <el-button type="success" size="large" @click="submitCreate" :disabled="!finalItems.length">
                                    <i class="el-icon-document-add"></i> 创建设计记录
                                </el-button>
                            </el-form-item>
                        </el-form>
                    </el-card>
                </div>
            </div>
        </div>
    `,
    props: ['projectId'],
    data() {
        return {
            isSubmitting: false,
            isLoadingTemplate: false,
            templates: [],
            selectedTemplateId: null,
            availableItems: [], // 左侧待选列表
            selectedItems: [],  // 左侧表格中被勾选的项
            finalItems: [],     // 右侧最终确定的列表
            customItemText: '',
            recordForm: {
                partName: '',
                processName: ''
            },
            formRules: {
                partName: [{ required: true, message: '零件名称不能为空', trigger: 'blur' }],
                processName: [{ required: true, message: '工序名称不能为空', trigger: 'blur' }]
            }
        };
    },
    methods: {
        async fetchTemplates() {
            try {
                const response = await axios.get('/api/templates');
                this.templates = response.data;
            } catch (error) {
                this.$message.error('加载模板列表失败！');
            }
        },
        async loadTemplateItems() {
            if (!this.selectedTemplateId) return;
            this.isLoadingTemplate = true;
            try {
                const response = await axios.get(`/api/templates/${this.selectedTemplateId}`);
                // 过滤掉已在最终列表中的项，避免重复添加
                const existingDescriptions = new Set(this.finalItems.map(item => item.itemDescription));
                this.availableItems = response.data.items.filter(item => !existingDescriptions.has(item.itemDescription));
            } catch (error) {
                this.$message.error('加载模板详情失败！');
            } finally {
                this.isLoadingTemplate = false;
            }
        },
        handleSelectionChange(selection) {
            this.selectedItems = selection;
        },
        addSelectedItems() {
            this.finalItems.push(...this.selectedItems);
            // 从待选列表中移除已添加的项
            const selectedDescriptions = new Set(this.selectedItems.map(item => item.itemDescription));
            this.availableItems = this.availableItems.filter(item => !selectedDescriptions.has(item.itemDescription));
            // 清空勾选
            this.$refs.availableTable.clearSelection();
        },
        addAllTemplateItems() {
            this.finalItems.push(...this.availableItems);
            this.availableItems = [];
        },
        addCustomItem() {
            if (!this.customItemText.trim()) {
                this.$message.warning('自定义项内容不能为空！');
                return;
            }
            // 检查是否已存在
            const existingInAvailable = this.availableItems.some(item => item.itemDescription === this.customItemText.trim());
            const existingInFinal = this.finalItems.some(item => item.itemDescription === this.customItemText.trim());
            if (existingInAvailable || existingInFinal) {
                 this.$message.warning('该检查项已存在！');
                 return;
            }
            this.availableItems.unshift({ itemDescription: this.customItemText.trim() });
            this.customItemText = '';
        },
        removeItem(index) {
            const removedItem = this.finalItems.splice(index, 1)[0];
            // 将移除的项放回待选列表（如果它来自模板）
            if(removedItem.templateId){
                this.availableItems.unshift(removedItem);
            }
        },
        clearFinalItems() {
            this.finalItems = [];
            // 如果选择了模板，重新加载模板项
            if (this.selectedTemplateId) {
                this.loadTemplateItems();
            }
        },
        submitCreate() {
            this.$refs.recordForm.validate(async (valid) => {
                if (valid) {
                    if (this.finalItems.length === 0) {
                        this.$message.error('请至少添加一个检查项！');
                        return;
                    }
                    this.isSubmitting = true;
                    const payload = {
                        ...this.recordForm,
                        items: this.finalItems.map(item => ({ itemDescription: item.itemDescription }))
                    };
                    try {
                        await axios.post(`/api/projects/${this.projectId}/records-with-items`, payload);
                        this.$message.success('设计记录创建成功！');
                        // 通知父组件返回列表页
                        this.$emit('back-to-list');
                    } catch (error) {
                        this.$message.error('创建失败！');
                    } finally {
                        this.isSubmitting = false;
                    }
                }
            });
        },
        goBack() {
            this.$emit('back-to-list');
        }
    },
    created() {
        this.fetchTemplates();
    }
});