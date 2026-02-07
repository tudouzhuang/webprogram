// src/main/resources/static/js/components/audit-history-timeline.js
Vue.component('audit-history-timeline', {
    props: ['recordId'],
    template: `
        <div class="content-wrapper">
            <div class="page-header">
                <h3 class="page-title">
                    <span class="page-title-icon bg-gradient-info text-white me-2">
                        <i class="mdi mdi-history"></i>
                    </span>
                    过程追溯轨迹
                </h3>
                <nav aria-label="breadcrumb">
                    <el-button @click="$emit('back')" size="small" icon="el-icon-back">返回列表</el-button>
                </nav>
            </div>
            <div class="row">
                <div class="col-12 grid-margin stretch-card">
                    <div class="card">
                        <div class="card-body">
                            <h4 class="card-title">流转记录 (ID: {{recordId}})</h4>
                            <p class="card-description">记录该零件每一轮的审核意见与修改人员</p>
                            
                            <div class="mt-4" v-loading="loading">
                                <el-timeline v-if="logs.length > 0">
                                    <el-timeline-item
                                        v-for="(log, index) in logs"
                                        :key="index"
                                        :timestamp="formatDate(log.createdAt)"
                                        :type="getTimelineType(log.actionType)"
                                        size="large"
                                        placement="top">
                                        <el-card shadow="hover" class="mb-3">
                                            <div class="d-flex justify-content-between align-items-center">
                                                <h5>
                                                    <el-tag :type="getTimelineType(log.actionType)" size="small" class="me-2">
                                                        {{ actionMap[log.actionType] }}
                                                    </el-tag>
                                                    审核轮次：第 {{ log.auditRound }} 轮
                                                </h5>
                                                <small class="text-muted">
                                                    <i class="mdi mdi-account"></i> 操作人ID: {{ log.operatorId }}
                                                </small>
                                            </div>
                                            <div v-if="log.comment" class="mt-3 p-3 bg-light rounded" style="border-left: 5px solid #ccc;">
                                                <i class="mdi mdi-comment-text-outline me-1"></i>
                                                <strong>处理意见：</strong> {{ log.comment }}
                                            </div>
                                        </el-card>
                                    </el-timeline-item>
                                </el-timeline>
                                <el-empty v-else description="暂无流转历史"></el-empty>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            loading: false,
            logs: [],
            actionMap: {
                'SUBMIT': '初始提交',
                'REJECT': '审核打回',
                'FIX': '修改提交',
                'PASS': '审核通过'
            }
        };
    },
    watch: {
        recordId: {
            immediate: true,
            handler(val) { if(val) this.fetchLogs(); }
        }
    },
    methods: {
        async fetchLogs() {
            this.loading = true;
            try {
                const res = await axios.get(`/api/audit-logs/record/${this.recordId}`);
                this.logs = res.data;
            } catch (e) {
                this.$message.error("获取轨迹失败");
            } finally { this.loading = false; }
        },
        getTimelineType(action) {
            const types = { 'REJECT': 'danger', 'FIX': 'primary', 'SUBMIT': 'info', 'PASS': 'success' };
            return types[action] || 'info';
        },
        formatDate(date) { return moment(date).format('YYYY-MM-DD HH:mm:ss'); }
    }
});