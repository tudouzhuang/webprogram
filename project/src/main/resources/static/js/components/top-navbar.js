// src/main/resources/static/js/components/top-navbar.js

Vue.component('top-navbar', {
    // 【核心修正 1】：不再需要 `components` 选项，因为 'user-dropdown' 也将被全局注册。
    
        // 【Props】: 接收从主 Vue 实例传来的 props
    props: {
        currentUser: {
            type: Object,
            default: null
        }
    },

        // 【Data】: 组件数据
    data() {
        return {
            notifications: [],
            isNotificationsLoading: false,
            notificationCount: 0,
            // 搜索
            searchDialogVisible: false,
            searchKeyword: '',
            searchResults: [],
            isSearching: false
        };
    },

    // 【Computed】: 计算属性
    computed: {
        welcomeUserName() {
            return this.currentUser ? this.currentUser.username : '尊敬的用户';
        },
        greeting() {
            const hour = new Date().getHours();
            if (hour >= 5 && hour < 9)  return { text: '早上好', icon: '🌅' };
            if (hour >= 9 && hour < 12) return { text: '上午好', icon: '☀️' };
            if (hour >= 12 && hour < 14) return { text: '中午好', icon: '🌤️' };
            if (hour >= 14 && hour < 18) return { text: '下午好', icon: '🌇' };
            if (hour >= 18 && hour < 22) return { text: '晚上好', icon: '🌆' };
            return { text: '夜深了', icon: '🌙' };
        },
        todayDate() {
            const d = new Date();
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
            const weekday = weekdays[d.getDay()];
            return `${year}年${month}月${day}日 星期${weekday}`;
        }
    },

    // 【Methods】
    methods: {
        onRequestLogout() {
            this.$emit('request-logout');
        },
        onOpenProfile() {
            this.$emit('open-profile');
        },
        // 获取待办任务通知
        async fetchNotifications() {
            if (this.isNotificationsLoading) return;
            this.isNotificationsLoading = true;
            try {
                const response = await axios.get('/api/stats/user-tasks');
                this.notifications = response.data || [];
                this.notificationCount = this.notifications.length;
            } catch (error) {
                console.error('获取通知失败:', error);
                this.notifications = [];
                this.notificationCount = 0;
            } finally {
                this.isNotificationsLoading = false;
            }
        },
        // 点击通知项跳转到对应任务
        handleNotificationClick(task) {
            console.log('通知点击，跳转到任务:', task);
            if (this.currentUser && this.currentUser.identity) {
                const role = this.currentUser.identity.toUpperCase();
                if (task.taskType === '待审核' && (role === 'REVIEWER' || role === 'MANAGER')) {
                    this.$root.navigateTo('record-review-panel', { recordId: task.recordId });
                } else {
                    this.$root.navigateTo('record-workspace-panel', { recordId: task.recordId });
                }
            }
        },
                // 获取任务类型对应的标签样式
        getTaskTagType(taskType) {
            const typeMap = { '待审核': 'warning', '待修改': 'primary', '草稿': 'info' };
            return typeMap[taskType] || '';
        },
        // 打开搜索弹窗
        openSearchDialog() {
            this.searchDialogVisible = true;
            this.searchKeyword = '';
            this.searchResults = [];
            this.$nextTick(() => {
                this.$refs.searchInput && this.$refs.searchInput.focus();
            });
        },
        // 执行搜索
        async performSearch() {
            const keyword = this.searchKeyword.trim();
            if (!keyword) {
                this.searchResults = [];
                return;
            }
            this.isSearching = true;
            try {
                const response = await axios.get('/api/search', { params: { q: keyword } });
                this.searchResults = response.data || [];
            } catch (error) {
                console.error('搜索失败:', error);
                this.searchResults = [];
                this.$message.error('搜索失败，请稍后重试');
            } finally {
                this.isSearching = false;
            }
        },
        // 点击搜索结果跳转
        handleSearchResultClick(item) {
            this.searchDialogVisible = false;
            if (item.type === 'project') {
                this.$root.navigateTo('project-planning-panel', { projectId: item.id });
            } else if (item.type === 'record') {
                this.$root.navigateTo('record-workspace-panel', { recordId: item.id });
            }
        }
    },
    
    // 【Template】: 模板 (保持不变)
    template: `
        <nav class="navbar default-layout col-lg-12 col-12 p-0 fixed-top d-flex align-items-top flex-row">
            <!-- Logo 部分 -->
            <div class="text-center navbar-brand-wrapper d-flex align-items-center justify-content-start">
                <div class="me-3">
                    <button class="navbar-toggler navbar-toggler align-self-center" type="button" data-bs-toggle="minimize">
                        <span class="icon-menu"></span>
                    </button>
                </div>
                <div>
                    <a class="navbar-brand brand-logo" href="index.html"><img src="main/images/logo.svg" alt="logo" /></a>
                    <a class="navbar-brand brand-logo-mini" href="index.html"><img src="main/images/logo-mini.svg" alt="logo" /></a>
                </div>
            </div>

            <!-- 主菜单部分 -->
            <div class="navbar-menu-wrapper d-flex align-items-top">
                <ul class="navbar-nav">
                    <li class="nav-item font-weight-semibold d-none d-lg-block ms-0">
                                                <h1 class="welcome-text">
                            <span class="greeting-icon">{{ greeting.icon }}</span>
                            {{ greeting.text }},
                            <span class="text-black fw-bold">{{ welcomeUserName }}</span>
                        </h1>
                        <h3 class="welcome-sub-text">{{ todayDate }}</h3>
                    </li>
                </ul>
                                                                <ul class="navbar-nav ms-auto">
                    <!-- 搜索图标 -->
                    <li class="nav-item">
                        <a class="nav-link" href="javascript:void(0)" @click="openSearchDialog" title="搜索">
                            <i class="icon-search"></i>
                        </a>
                    </li>
                    <!-- 通知铃铛 -->
                    <li class="nav-item dropdown">
                        <a class="nav-link count-indicator" id="countDropdown" href="#" data-bs-toggle="dropdown"
                            aria-expanded="false" @click="fetchNotifications">
                            <i class="icon-bell"></i>
                            <span class="count" v-if="notificationCount > 0">{{ notificationCount > 99 ? '99+' : notificationCount }}</span>
                        </a>
                        <div class="dropdown-menu dropdown-menu-right navbar-dropdown preview-list pb-0"
                            aria-labelledby="countDropdown" style="min-width: 360px;">
                            <!-- 标题栏 -->
                            <div class="dropdown-item py-3 border-bottom d-flex justify-content-between align-items-center">
                                <p class="mb-0 font-weight-medium">待办事项</p>
                                <el-badge :value="notificationCount" type="warning" :hidden="notificationCount === 0"></el-badge>
                            </div>
                            <div style="max-height: 400px; overflow-y: auto;">
                                <!-- 加载中 -->
                                <div v-if="isNotificationsLoading" class="text-center py-4">
                                    <i class="el-icon-loading"></i> 加载中...
                                </div>
                                <!-- 无待办 -->
                                <div v-else-if="notifications.length === 0" class="text-center py-4 text-muted">
                                    <i class="mdi mdi-check-circle-outline" style="font-size: 2rem;"></i>
                                    <p class="mt-2 mb-0">暂无待办事项</p>
                                </div>
                                <!-- 有待办 -->
                                <div v-else>
                                    <a class="dropdown-item preview-item py-2 border-bottom"
                                       v-for="(task, index) in notifications" :key="index"
                                       href="javascript:void(0)" @click="handleNotificationClick(task)">
                                        <div class="preview-item-content flex-grow py-1">
                                            <div class="d-flex justify-content-between align-items-center">
                                                <h6 class="preview-subject font-weight-medium text-dark mb-1 text-truncate" style="max-width: 200px;">
                                                    {{ task.recordName || '未命名记录' }}
                                                </h6>
                                                <el-tag :type="getTaskTagType(task.taskType)" size="mini">{{ task.taskType }}</el-tag>
                                            </div>
                                            <p class="fw-light small-text mb-0 text-muted">
                                                {{ task.projectNumber || '' }}
                                                <span v-if="task.updatedAt" class="ms-2">{{ new Date(task.updatedAt).toLocaleDateString() }}</span>
                                            </p>
                                        </div>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </li>
                    
                                        <!-- user-dropdown 监听事件名 @request-logout 与子组件发出的事件名保持一致 -->
                    <user-dropdown v-if="currentUser" :user="currentUser" @request-logout="onRequestLogout" @open-profile="onOpenProfile"></user-dropdown>
                                </ul>
                <button class="navbar-toggler navbar-toggler-right d-lg-none align-self-center" type="button"
                    data-bs-toggle="offcanvas">
                    <span class="mdi mdi-menu"></span>
                </button>
            </div>

                        <!-- 搜索弹窗 -->
            <el-dialog title="全局搜索" :visible.sync="searchDialogVisible" width="600px" :modal="false" :close-on-click-modal="false" @opened="openSearchDialog">
                <div>
                    <el-input
                        ref="searchInput"
                        v-model="searchKeyword"
                        placeholder="输入项目编号、记录名称搜索..."
                        clearable
                        @keyup.enter.native="performSearch"
                        size="medium">
                        <i slot="prefix" class="el-input__icon el-icon-search"></i>
                        <el-button slot="append" @click="performSearch" :loading="isSearching">搜索</el-button>
                    </el-input>
                </div>
                <div style="margin-top: 16px; max-height: 400px; overflow-y: auto;">
                    <!-- 加载中 -->
                    <div v-if="isSearching" class="text-center py-4">
                        <i class="el-icon-loading"></i> 搜索中...
                    </div>
                    <!-- 无结果 -->
                    <div v-else-if="searchKeyword && searchResults.length === 0 && !isSearching" class="text-center py-4 text-muted">
                        <i class="el-icon-document" style="font-size: 2rem;"></i>
                        <p class="mt-2">未找到相关结果</p>
                    </div>
                    <!-- 有结果 -->
                    <div v-else-if="searchResults.length > 0">
                        <div v-for="(item, index) in searchResults" :key="index"
                             class="search-result-item"
                             style="padding: 10px 12px; cursor: pointer; border-radius: 6px; border: 1px solid #EBEEF5; margin-bottom: 8px;"
                             @mouseenter="$event.currentTarget.style.backgroundColor = '#F5F7FA'"
                             @mouseleave="$event.currentTarget.style.backgroundColor = ''"
                             @click="handleSearchResultClick(item)">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <strong>{{ item.name || item.projectNumber || item.recordName }}</strong>
                                    <p class="mb-0 text-muted small mt-1">{{ item.description || '' }}</p>
                                </div>
                                <el-tag :type="item.type === 'project' ? 'primary' : 'success'" size="mini">
                                    {{ item.type === 'project' ? '项目' : '记录' }}
                                </el-tag>
                            </div>
                        </div>
                    </div>
                </div>
            </el-dialog>
        </nav>
    `
});