// src/main/resources/static/js/components/user-dropdown.js

Vue.component('user-dropdown', {
    props: {
        user: {
            type: Object,
            default: null
        }
    },
    template: `
        <li class="nav-item dropdown d-none d-lg-block user-dropdown">
            <a class="nav-link" id="UserDropdown" href="#" data-bs-toggle="dropdown" aria-expanded="false">
                <img class="img-xs rounded-circle" :src="user.avatarUrl" alt="Profile image">
            </a>
            <div class="dropdown-menu dropdown-menu-right navbar-dropdown" aria-labelledby="UserDropdown">
                <div class="dropdown-header text-center">
                    <img class="img-md rounded-circle" :src="user.avatarUrl" alt="Profile image">
                    <p class="mb-1 mt-3 font-weight-semibold">{{ user.username }}</p>
                    <p class="fw-light text-muted mb-0">{{ user.email || user.username }}</p>
                </div>
                <a class="dropdown-item" href="javascript:void(0)" @click="openProfileDialog">
                    <i class="dropdown-item-icon mdi mdi-account-outline text-primary me-2"></i>
                    个人资料
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
            user: {
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
                    this.user = response.data;
                })
                .catch(error => {
                    console.error('❌ [UserDropdown] 获取当前用户信息失败:', error);
                    this.user.username = '未登录';
                    this.user.email = '请先登录';
                    this.user.avatarUrl = 'main/images/faces/anonymous.jpg';
                });
        },
        openProfileDialog() {
            this.$emit('open-profile');
        },
        logout() {
            axios.post('/api/users/logout')
                .then(() => {
                    window.location.href = '/login';
                })
                .catch(error => {
                    console.error('❌ [UserDropdown] 登出失败:', error);
                    alert('登出时发生错误，请稍后再试。');
                });
        }
    },
    created() {
        console.log('[UserDropdown] 组件已创建，正在请求用户信息...');
        this.fetchCurrentUser();
    }
});