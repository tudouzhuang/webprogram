const RecordItemConfigPanel = {
    template: `
        <!-- 【【【根元素已按您的要求修正】】】 -->
        <div class="checklist-panel content-wrapper" v-loading.fullscreen.lock="isSaving">
            
            <!-- 页面标题 -->
            <div class="page-header">
                <h3 class="page-title">
                    <span class="page-title-icon bg-gradient-primary text-white me-2"><i class="mdi mdi-playlist-plus"></i></span>
                    为设计记录配置检查项
                    <small class="text-muted" style="font-size: 1rem; margin-left: 10px;">(ID: {{ recordId }})</small>
                </h3>
            </div>

            <!-- 主内容区 -->
            <div class="row">
                <!-- 左侧：素材库和待选区 -->
                <div class="col-md-8 grid-margin stretch-card">
                    <el-card class="box-card" body-style="padding: 20px;">
                        <div slot="header">
                            <span><strong>步骤 1:</strong> 从素材库选择或自定义</span>
                        </div>
                        
                        <!-- 模板选择 -->
                        <div class="template-selector">
                            <el-select v-model="selectedTemplateId" placeholder="从模板库加载检查项" @change="loadTemplateItems" style="width: 70%;" clearable>
                                <el-option v-for="template in templates" :key="template.id" :label="template.templateName" :value="template.id"></el-option>
                            </el-select>
                            <el-button @click="addAllTemplateItems" type="primary" plain :disabled="!availableItems.length">一键添加该模板所有项</el-button>
                        </div>
                        
                        <!-- 待选列表 -->
                        <div class="item-list-wrapper" v-loading="isLoadingTemplate">
                            <el-table :data="availableItems" @selection-change="handleSelectionChange" ref="availableTable" height="300" empty-text="请选择一个模板或添加自定义项">
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
                    <el-card class="box-card" body-style="padding: 20px;">
                         <div slot="header">
                            <span><strong>步骤 2:</strong> 确认最终列表 ({{ finalItems.length }} 项)</span>
                        </div>
                        <div class="item-list-wrapper final-list">
                            <el-table :data="finalItems" height="420">
                                <el-table-column prop="itemDescription" label="已选内容" show-overflow-tooltip></el-table-column>
                                <el-table-column label="操作" width="80" align="center">
                                    <template slot-scope="scope">
                                        <el-button type="danger" icon="el-icon-delete" circle size="mini" @click="removeItem(scope.$index)"></el-button>
                                    </template>
                                </el-table-column>
                            </el-table>
                        </div>
                        <div style="padding-top: 15px; text-align: right;">
                             <el-button @click="clearFinalItems" type="danger" plain :disabled="!finalItems.length">
                                <i class="el-icon-refresh-left"></i> 全部清空
                            </el-button>
                        </div>
                    </el-card>
                </div>
            </div>
            
            <!-- 底部：提交按钮 -->
            <div class="row">
                <div class="col-12">
                     <el-card class="box-card" style="text-align: center;">
                        <el-button type="success" size="large" @click="saveItems" :disabled="!finalItems.length">
                            <i class="el-icon-check"></i> 保存检查项列表
                        </el-button>
                        <p class="text-muted" style="font-size: 12px; margin-top: 10px;">保存后，将为此设计记录正式生成这些检查项，并进入自检阶段。</p>
                    </el-card>
                </div>
            </div>
        </div>
    `,
    props: ['recordId', 'currentUser'],
    data() {
        return {
            isSaving: false,
            isLoadingTemplate: false,
            templates: [],
            selectedTemplateId: null,
            availableItems: [],
            selectedItems: [],
            finalItems: [],
            customItemText: ''
        };
    },
    methods: {
        async fetchTemplates() {
            try {
                const response = await axios.get('/api/templates');
                this.templates = response.data;
            } catch (error) { this.$message.error('加载模板列表失败！'); }
        },
        async loadTemplateItems() {
            if (!this.selectedTemplateId) {
                this.availableItems = [];
                return;
            }
            this.isLoadingTemplate = true;
            try {
                const response = await axios.get(`/api/templates/${this.selectedTemplateId}`);
                const existingDescriptions = new Set(this.finalItems.map(item => item.itemDescription));
                this.availableItems = response.data.items.filter(item => !existingDescriptions.has(item.itemDescription));
            } catch (error) { this.$message.error('加载模板详情失败！'); }
            finally { this.isLoadingTemplate = false; }
        },
        handleSelectionChange(selection) { this.selectedItems = selection; },
        addSelectedItems() {
            this.finalItems.push(...this.selectedItems);
            const selectedDescriptions = new Set(this.selectedItems.map(item => item.itemDescription));
            this.availableItems = this.availableItems.filter(item => !selectedDescriptions.has(item.itemDescription));
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
            const newItemDesc = this.customItemText.trim();
            const isDuplicate = this.availableItems.some(item => item.itemDescription === newItemDesc) || this.finalItems.some(item => item.itemDescription === newItemDesc);
            if (isDuplicate) {
                 this.$message.warning('该检查项已存在！');
                 return;
            }
            this.availableItems.unshift({ itemDescription: newItemDesc });
            this.customItemText = '';
        },
        removeItem(index) {
            const [removedItem] = this.finalItems.splice(index, 1);
            if (removedItem.templateId) {
                this.availableItems.unshift(removedItem);
            }
        },
        clearFinalItems() {
            this.finalItems = [];
            if (this.selectedTemplateId) { this.loadTemplateItems(); }
        },
        async saveItems() {
            if (this.finalItems.length === 0) {
                this.$message.error('请至少添加一个检查项！');
                return;
            }
            this.isSaving = true;
            const payload = { items: this.finalItems.map(item => ({ itemDescription: item.itemDescription })) };
            try {
                // 后端应该有一个批量添加的接口
                await axios.post(`/api/records/${this.recordId}/items-batch`, payload.items);
                this.$message.success('检查项已成功保存！');
                this.$emit('items-saved', this.recordId);
            } catch (error) {
                this.$message.error('保存检查项失败！');
            } finally {
                this.isSaving = false;
            }
        },
        goBack() {
            this.$emit('back-to-list');
        }
    },
    created() {
        this.fetchTemplates();
    }
};

// 【【【自我注册，以匹配您的项目风格】】】
Vue.component('record-item-config-panel', RecordItemConfigPanel);