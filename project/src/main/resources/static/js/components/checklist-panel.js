Vue.component('checklist-panel', {
    template: `
        <div class="checklist-panel content-wrapper" v-loading.fullscreen.lock="isLoading">
            <!-- 页面标题和返回按钮 -->
            <div class="page-header">
                <h3 class="page-title">
                    <span class="page-title-icon bg-gradient-primary text-white me-2">
                        <i class="mdi mdi-format-list-checks"></i>
                    </span>
                    设计审查工作台 (记录ID: {{ recordId }})
                </h3>
                <nav aria-label="breadcrumb">
                    <ol class="breadcrumb">
                        <li class="breadcrumb-item"><el-button @click="goBack" icon="el-icon-back" size="small">返回列表</el-button></li>
                    </ol>
                </nav>
            </div>

            <!-- 操作和筛选区 -->
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

            <!-- 卡片列表区 -->
            <div class="card-list">
                <check-item-card 
                    v-for="item in filteredItems" 
                    :key="item.id"
                    :item-data="item"
                    :current-user="currentUser"
                    @update="handleItemUpdate">
                </check-item-card>
                <div v-if="!filteredItems.length && !isLoading" class="empty-state">
                    <i class="el-icon-folder-opened" style="font-size: 48px; color: #ccc;"></i>
                    <p>没有符合条件的检查项</p>
                </div>
            </div>
            
            <!-- 新增问题对话框 -->
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
            return this.items.filter(item => item.status === this.filterStatus);
        },
        isReviewer() {
            return this.currentUser && ['MANAGER', 'REVIEWER'].includes(this.currentUser.identity);
        }
    },
    methods: {
        countByStatus(status) {
            return this.items.filter(item => item.status === status).length;
        },
        async fetchItems() {
            this.isLoading = true;
            try {
                const response = await axios.get(`/api/records/${this.recordId}/items`);
                this.items = response.data.sort((a, b) => b.id - a.id);
            } catch (error) {
                this.$message.error('加载检查项列表失败！');
                console.error(error);
            } finally {
                this.isLoading = false;
            }
        },
        async handleItemUpdate(updatedItem) {
            try {
                await axios.put(`/api/items/${updatedItem.id}`, updatedItem);
                // 优化：只更新本地数据，不重新请求整个列表，体验更流畅
                const index = this.items.findIndex(i => i.id === updatedItem.id);
                if (index !== -1) {
                    // 更新操作人和时间戳，模拟后端返回
                    updatedItem.checkedByUsername = this.currentUser.username;
                    updatedItem.checkedAt = new Date().toISOString();
                    this.$set(this.items, index, updatedItem);
                }
                this.$message.success('更新成功！');
            } catch (error) {
                this.$message.error('更新失败！');
                console.error(error);
                this.fetchItems(); // 更新失败时，重新获取数据以同步
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
                // TODO: 调用后端提交审核的API
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