Vue.component('checklist-panel', {
    template: `
        <!-- 【核心修正1】: 使用 'content-wrapper'作为根元素，与您的主题保持一致 -->
        <div class="content-wrapper">
            <!-- 【核心修正2】: 添加标准的主题页面标题栏 'page-header' -->
            <div class="page-header">
                <h3 class="page-title">
                    <span class="page-title-icon bg-gradient-primary text-white me-2">
                        <i class="mdi mdi-format-list-checks"></i>
                    </span>
                    设计审查工作台
                    <small class="text-muted" style="font-size: 1rem; margin-left: 10px;">(记录ID: {{ recordId }})</small>
                </h3>
                <nav aria-label="breadcrumb">
                    <ol class="breadcrumb">
                        <li class="breadcrumb-item">
                            <el-button @click="goBack" icon="el-icon-back" size="small">返回列表</el-button>
                        </li>
                    </ol>
                </nav>
            </div>

            <!-- 【核心修正3】: 将所有内容包裹在 'row' 和 'col' 网格系统中 -->
            <div class="row">
                <div class="col-12 grid-margin">
                    <!-- 操作和筛选区现在是一个标准的 el-card -->
                    <el-card class="box-card panel-header" shadow="never">
                        <div class="header-left">
                            <el-radio-group v-model="filterStatus" size="small">
                                <el-radio-button label="ALL">全部 ({{ items.length }})</el-radio-button>
                                <el-radio-button label="PENDING">待处理 ({{ countByStatus('PENDING') }})</el-radio-button>
                                <el-radio-button label="NG">不合格 ({{ countByStatus('NG') }})</el-radio-button>
                                <el-radio-button label="OK">合格 ({{ countByStatus('OK') }})</el-radio-button>
                            </el-radio-group>
                        </div>
                        <div class="header-right">
                            <el-button v-if="isReviewer" @click="showAddItemDialog = true" type="primary" icon="el-icon-plus" size="small">新增问题项</el-button>
                            <el-button @click="submitForReview" type="success" icon="el-icon-check" size="small">提交审核</el-button>
                        </div>
                    </el-card>
                </div>
                
                <div class="col-12">
                    <!-- 卡片列表区 -->
                    <div v-if="!isLoading && items.length > 0" class="card-list">
                        <check-item-card 
                            v-for="item in filteredItems" 
                            :key="item.id"
                            :item-data="item"
                            :current-user="currentUser"
                            @update="handleItemUpdate">
                        </check-item-card>
                    </div>
                    
                    <!-- 加载状态 -->
                    <div v-if="isLoading" class="loading-state">
                         <i class="el-icon-loading"></i>
                         <p>正在加载检查项...</p>
                    </div>
                    
                    <!-- 空状态 -->
                    <div v-if="!isLoading && items.length === 0" class="empty-state">
                        <div class="empty-state-icon">
                            <i class="mdi mdi-folder-open-outline"></i>
                        </div>
                        <h4>没有检查项</h4>
                        <p class="text-muted">此设计记录还没有检查项，您可以从上方“新增问题项”开始。</p>
                    </div>
                </div>
            </div>

            <!-- 新增问题对话框 (保持不变) -->
            <el-dialog title="新增问题项" :visible.sync="showAddItemDialog" width="500px" append-to-body>
                <el-form :model="newItemForm" ref="newItemForm" label-width="80px">
                    <el-form-item label="问题描述" prop="itemDescription" :rules="{ required: true, message: '问题描述不能为空', trigger: 'blur' }">
                        <el-input type="textarea" :rows="5" v-model="newItemForm.itemDescription" placeholder="请详细描述审核中发现的新问题..."></el-input>
                    </el-form-item>
                </el-form>
                <div slot="footer" class="dialog-footer">
                    <el-button @click="showAddItemDialog = false">取 消</el-button>
                    <el-button type="primary" @click="handleAddItem" :loading="isAdding">确 定</el-button>
                </div>
            </el-dialog>
        </div>
    `,
    props: ['recordId', 'currentUser'],
    // data, computed, methods, watch, created 部分与上一版完全相同，无需修改
    data() {
        return {
            isLoading: true,
            isAdding: false,
            items: [],
            filterStatus: 'ALL',
            showAddItemDialog: false,
            newItemForm: {
                itemDescription: ''
            }
        };
    },
    computed: {
        filteredItems() {
            if (this.filterStatus === 'ALL') {
                return this.items;
            }
            // 筛选逻辑应基于设计员的状态，因为这是流程推进的基础
            return this.items.filter(item => item.designerStatus === this.filterStatus);
        },
        isReviewer() {
            return this.currentUser && ['MANAGER', 'REVIEWER', 'ADMIN'].includes(this.currentUser.identity);
        }
    },
    methods: {
        countByStatus(status) {
            return this.items.filter(item => item.designerStatus === status).length;
        },
        async fetchItems() {
            this.isLoading = true;
            try {
                const response = await axios.get(`/api/records/${this.recordId}/items`);
                this.items = response.data.sort((a, b) => b.id - a.id);
            } catch (error) {
                this.$message.error('加载检查项列表失败！');
            } finally {
                this.isLoading = false;
            }
        },
        async handleItemUpdate(updatedItem) {
            const index = this.items.findIndex(i => i.id === updatedItem.id);
            if (index !== -1) {
                this.$set(this.items, index, updatedItem);
            }
            try {
                await axios.put(`/api/items/${updatedItem.id}`, updatedItem);
                this.$message.success('保存成功！');
            } catch (error) {
                this.$message.error('保存失败！请检查网络或联系管理员。');
                this.fetchItems(); 
            }
        },
        handleAddItem() {
            this.$refs.newItemForm.validate(async (valid) => {
                if (valid) {
                    this.isAdding = true;
                    try {
                        const response = await axios.post(`/api/records/${this.recordId}/items`, this.newItemForm);
                        this.items.unshift(response.data);
                        this.showAddItemDialog = false;
                        this.$refs.newItemForm.resetFields();
                        this.$message.success('新增成功！');
                    } catch (error) {
                        this.$message.error('新增失败！');
                    } finally {
                        this.isAdding = false;
                    }
                }
            });
        },
        submitForReview() {
            this.$confirm('确认所有检查项已完成并提交审核吗?', '提交确认', {
                confirmButtonText: '确定提交',
                cancelButtonText: '取消',
                type: 'warning'
            }).then(() => {
                this.$message.info('提交审核功能待实现');
            }).catch(() => {});
        },
        goBack() {
            this.$emit('back-to-list');
        }
    },
    created() {
        if (!this.recordId) {
            this.$message.error('未提供有效的记录ID！');
            this.isLoading = false;
            return;
        }
        this.fetchItems();
    }
});