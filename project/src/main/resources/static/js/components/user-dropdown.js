Vue.component('user-dropdown', {
    template: `
        <li class="nav-item dropdown d-none d-lg-block user-dropdown">
            <a class="nav-link" id="UserDropdown" href="#" data-bs-toggle="dropdown" aria-expanded="false">
                <img class="img-xs rounded-circle" :src="currentUser.avatarUrl" alt="Profile image">
            </a>
            <div class="dropdown-menu dropdown-menu-right navbar-dropdown" aria-labelledby="UserDropdown">
                <div class="dropdown-header text-center">
                    <img class="img-md rounded-circle" :src="currentUser.avatarUrl" alt="Profile image">
                    <p class="mb-1 mt-3 font-weight-semibold">{{ currentUser.username }}</p>
                    <p class="fw-light text-muted mb-0">{{ currentUser.email }}</p>
                </div>
                <a class="dropdown-item">
                    <i class="dropdown-item-icon mdi mdi-account-outline text-primary me-2"></i>
                    个人资料
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
                <a class="dropdown-item" href="javascript:void(0)" @click="logout">
                    <i class="dropdown-item-icon mdi mdi-power text-primary me-2"></i>
                    退出登录
                </a>
            </div>
        </li>
    `,
    data() {
        return {
            currentUser: {
                username: '加载中...',
                email: '...',
                avatarUrl: 'main/images/faces/face1.jpg' // 一个默认的头像
            }
        }
    },
    methods: {
        fetchCurrentUser() {
            // 从后端API获取当前登录用户的信息
            axios.get('/api/users/current')
                .then(response => {
                    // 1. 将从后端获取到的数据赋值给组件的 currentUser 对象，Vue会自动更新UI
                    this.currentUser = response.data;
                    console.log('✅ [UserDropdown] 成功获取到当前用户信息:');
                    console.log('   - 用户名:', this.currentUser.username);
                    console.log('   - 邮  箱:', this.currentUser.email);
                    console.log('   - 头像地址:', this.currentUser.avatarUrl);
                    
                })
                .catch(error => {
                    console.error('❌ [UserDropdown] 获取当前用户信息失败:', error);
                    // 可以在这里设置一个表示“未登录”状态的用户对象
                    this.currentUser.username = '未登录';
                    this.currentUser.email = '请先登录';
                    // 可以设置一个默认的匿名用户头像
                    this.currentUser.avatarUrl = 'main/images/faces/anonymous.jpg'; 
                });
        },
        logout() {
            // 调用后端API执行登出操作
            axios.post('/api/users/logout')
                .then(() => {
                    console.log('✅ [UserDropdown] 登出成功，即将跳转到登录页。');
                    // 登出成功后，重定向到登录页面
                    window.location.href = '/login';
                })
                .catch(error => {
                    console.error('❌ [UserDropdown] 登出失败:', error);
                    alert('登出时发生错误，请稍后再试。');
                });
        }
    },
    // 【生命周期钩子】
    // 当这个组件被创建并挂载到页面上时，自动调用 fetchCurrentUser 方法
    created() {
        console.log('[UserDropdown] 组件已创建，正在请求用户信息...');
        this.fetchCurrentUser();
    }
});