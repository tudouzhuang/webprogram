Vue.component('user-dropdown', {
    // 【模板】: 根据新的界面样式进行更新
    template: `
        <li class="nav-item dropdown d-none d-lg-block user-dropdown">
            <a class="nav-link" id="UserDropdown" href="#" data-bs-toggle="dropdown" aria-expanded="false">
                <!-- 动态绑定头像 -->
                <img class="img-xs rounded-circle" :src="currentUser.avatarUrl" alt="Profile image">
            </a>
            <div class="dropdown-menu dropdown-menu-right navbar-dropdown" aria-labelledby="UserDropdown">
                <div class="dropdown-header text-center">
                    <!-- 动态绑定头像 -->
                    <img class="img-md rounded-circle" :src="currentUser.avatarUrl" alt="Profile image">
                    <!-- 动态绑定用户名和邮箱 -->
                    <p class="mb-1 mt-3 font-weight-semibold">{{ currentUser.username }}</p>
                    <p class="fw-light text-muted mb-0">{{ currentUser.email }}</p>
                </div>

                <!-- 【新增】添加了新的菜单项和徽章 -->
                <a class="dropdown-item">
                    <i class="dropdown-item-icon mdi mdi-account-outline text-primary me-2"></i>
                    个人资料
                    <!-- 徽章，将来可以动态绑定未读数量 -->
                    <span class="badge badge-pill badge-danger">1</span>
                </a>
                <a class="dropdown-item">
                    <i class="dropdown-item-icon mdi mdi-message-text-outline text-primary me-2"></i>
                    消息
                </a>
                <a class="dropdown-item">
                    <i class="dropdown-item-icon mdi mdi-calendar-check-outline text-primary me-2"></i>
                    活动
                </a>
                <a class="dropdown-item">
                    <i class="dropdown-item-icon mdi mdi-help-circle-outline text-primary me-2"></i>
                    FAQ
                </a>
                
                <!-- 【更新】登出按钮绑定了 logout 方法 -->
                <a class="dropdown-item" href="javascript:void(0)" @click="logout">
                    <i class="dropdown-item-icon mdi mdi-power text-primary me-2"></i>
                    退出登录
                </a>
            </div>
        </li>
    `,
    // data, methods, created 部分保持不变，因为它们的功能是正确的
    data() {
        return {
            currentUser: {
                username: '加载中...',
                email: '...',
                avatarUrl: 'main/images/faces/face1.jpg'
            }
        }
    },
    methods: {
        fetchCurrentUser() {
            axios.get('/api/users/current')
                .then(response => {
                    this.currentUser = response.data;
                })
                .catch(error => {
                    console.error('用户组件获取信息失败:', error);
                    this.currentUser.username = '未登录';
                });
        },
        logout() {
            axios.post('/api/users/logout')
                .then(() => {
                    window.location.href = '/login';
                })
                .catch(error => {
                    console.error('登出失败:', error);
                    alert('登出时发生错误。');
                });
        }
    },
    created() {
        this.fetchCurrentUser();
    }
});