// src/main/resources/static/js/components/quality-stats-panel.js
Vue.component('quality-stats-panel', {
    template: `
        <div class="content-wrapper">
            <div class="page-header mb-4" style="display: flex; justify-content: space-between; align-items: center;">
                <h3 class="page-title" style="margin: 0;">
                    <span class="page-title-icon bg-gradient-primary text-white me-2" style="padding: 8px; border-radius: 4px;">
                        <i class="mdi mdi-chart-bar"></i>
                    </span> 
                    <span style="vertical-align: middle;">质量与效能监控看板</span>
                </h3>
                <div class="header-actions">
                    <el-button type="primary" size="medium" icon="el-icon-refresh" @click="loadAllData">同步最新数据</el-button>
                </div>
            </div>

            <div class="row">
                <div class="col-md-3 stretch-card grid-margin" v-for="kpi in kpiCards" :key="kpi.title">
                    <div :class="['card text-white', kpi.bgClass]" style="position: relative; overflow: hidden; border: none; border-radius: 10px;">
                        <div style="position: absolute; right: -20px; top: -20px; width: 100px; height: 100px; border-radius: 50%; background: rgba(255,255,255,0.15);"></div>
                        <div class="card-body p-4">
                            <h4 class="font-weight-normal mb-3">{{ kpi.title }} <i :class="['mdi float-right', kpi.icon]" style="font-size: 1.5rem;"></i></h4>
                            <h2 class="mb-3">{{ kpi.value }}{{ kpi.unit }}</h2>
                            <p class="card-text" style="font-size: 0.85rem; opacity: 0.8;">{{ kpi.desc }}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row mt-2">
                <div class="col-12 grid-margin">
                    <div class="card shadow-sm">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom">
                                <el-radio-group v-model="viewMode" size="medium">
                                    <el-radio-button label="project">按项目维度</el-radio-button>
                                    <el-radio-button label="employee">按员工维度</el-radio-button>
                                </el-radio-group>
                                
                                <div class="filter-box d-flex">
                                    <el-input v-model="filterName" 
                                              placeholder="搜索名称..." 
                                              prefix-icon="el-icon-search" 
                                              size="small" 
                                              style="width: 200px;" 
                                              clearable></el-input>
                                </div>
                            </div>

                            <el-table 
                                ref="statsTable" 
                                @row-click="handleRowClick" 
                                style="width: 100%; cursor: pointer;" 
                                :data="filteredData" 
                                v-loading="loading" 
                                stripe>
                                
                                <el-table-column type="expand">
                                    <template slot-scope="props">
                                        <div style="padding: 20px; background: #fafafa; border-radius: 8px; margin: 10px;">
                                            <h5 class="mb-3" style="color: #4a4a4a; font-size: 14px;">
                                                <i class="mdi mdi-subdirectory-arrow-right text-primary me-2"></i>
                                                {{ viewMode === 'project' ? '项目成员产出明细' : '个人跨项目表现明细' }}
                                            </h5>
                                            <el-table :data="props.row.details" size="mini" border header-cell-class-name="bg-light">
                                                <el-table-column prop="partName" label="零件/节点名称"></el-table-column>

                                                <el-table-column prop="memberName" label="负责人" width="120">
                                                    <template slot-scope="scope">
                                                        <i class="mdi mdi-account-circle text-muted me-1"></i>
                                                        {{ scope.row.memberName }}
                                                    </template>
                                                </el-table-column>
                                                <el-table-column label="符合率" width="150">
                                                    <template slot-scope="scope">
                                                        <el-progress :percentage="scope.row.compliance" 
                                                                    :status="getProgStatus(scope.row.compliance)" 
                                                                    :stroke-width="12"></el-progress>
                                                    </template>
                                                </el-table-column>
                                                <el-table-column prop="auditRounds" label="审核轮次" width="100" align="center"></el-table-column>
                                                <el-table-column prop="lastReviewTime" label="更新时间" width="160"></el-table-column>
                                                <el-table-column label="当前状态" width="120">
                                                    <template slot-scope="scope">
                                                        <el-tag :type="getStatusTag(scope.row.status)" size="mini">{{ translateStatus(scope.row.status) }}</el-tag>
                                                    </template>
                                                </el-table-column>
                                            </el-table>
                                        </div>
                                    </template>
                                </el-table-column>

                                <el-table-column :label="viewMode === 'project' ? '项目信息' : '人员姓名'" prop="name" sortable>
                                    <template slot-scope="scope">
                                        <div class="d-flex flex-column">
                                            <span class="text-primary font-weight-bold">{{ scope.row.name }}</span>
                                            <small v-if="viewMode === 'project'" class="text-muted">ID: {{ scope.row.details[0].projectId }}</small>
                                        </div>
                                    </template>
                                </el-table-column>
                                
                                <el-table-column label="平均符合率" prop="avgCompliance" sortable width="200">
                                    <template slot-scope="scope">
                                        <div class="d-flex align-items-center">
                                            <span style="width: 50px; font-weight: bold;">{{ scope.row.avgCompliance }}%</span>
                                            <el-progress :percentage="scope.row.avgCompliance" 
                                                        :show-text="false" 
                                                        :status="getProgStatus(scope.row.avgCompliance)" 
                                                        style="flex: 1; margin-left: 10px;"></el-progress>
                                        </div>
                                    </template>
                                </el-table-column>

                                <el-table-column label="总审核轮次" prop="totalRounds" width="120" align="center"></el-table-column>
                                <el-table-column label="平均轮次" prop="avgRounds" width="120" align="center">
                                    <template slot-scope="scope">
                                        <el-tag effect="plain" size="small" :type="scope.row.avgRounds > 2 ? 'danger' : 'info'">
                                            {{ scope.row.avgRounds }}
                                        </el-tag>
                                    </template>
                                </el-table-column>
                                
                                <el-table-column label="绩效统计" width="220">
                                    <template slot-scope="scope">
                                        <div style="font-size: 12px;">
                                            <span class="text-success">一次通过: {{ scope.row.onePassCount }}</span>
                                            <el-divider direction="vertical"></el-divider>
                                            <span class="text-danger">NG/修正: {{ scope.row.ngCount }}</span>
                                        </div>
                                    </template>
                                </el-table-column>
                            </el-table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            loading: false,
            viewMode: 'project',
            filterName: '',
            globalStats: {
                avgCompliance: 0,
                avgRounds: 0,
                onePassRate: 0,
                totalTasks: 0
            },
            tableData: []
        };
    },
    computed: {
        kpiCards() {
            return [
                { title: '平均符合率', value: this.globalStats.avgCompliance, unit: '%', icon: 'mdi-shield-check', bgClass: 'bg-gradient-danger', desc: '全量零件统计均值' },
                { title: '平均审核轮次', value: this.globalStats.avgRounds, unit: '轮', icon: 'mdi-trending-down', bgClass: 'bg-gradient-info', desc: '数值越低质量越稳' },
                { title: '一次通过率', value: this.globalStats.onePassRate, unit: '%', icon: 'mdi-lightning-bolt', bgClass: 'bg-gradient-success', desc: '首轮即合格的比例' },
                { title: '累计任务总数', value: this.globalStats.totalTasks, unit: '项', icon: 'mdi-file-tree', bgClass: 'bg-gradient-primary', desc: '系统内总记录覆盖' }
            ];
        },
        filteredData() {
            let list = this.tableData.filter(item => item.type === this.viewMode);
            if (this.filterName) {
                list = list.filter(i => i.name.toLowerCase().includes(this.filterName.toLowerCase()));
            }
            return list;
        }
    },
    mounted() {
        this.loadAllData();
    },
    methods: {
        handleRowClick(row, column, event) {
            // 调用 el-table 内置的方法：toggleRowExpansion
            // 第一个参数是行数据，第二个参数如果不传，则会自动切换(toggle)状态
            this.$refs.statsTable.toggleRowExpansion(row);
        },
        async loadAllData() {
            this.loading = true;
            try {
                // 后端接口：/api/stats/full-quality-report
                const res = await axios.get('/api/stats/full-quality-report');
                this.globalStats = res.data.global;
                this.tableData = res.data.list;
            } catch (e) {
                this.$message.error("无法加载统计详情，请检查后端 API 状态");
            } finally {
                this.loading = false;
            }
        },
        getProgStatus(val) {
            if (val >= 95) return 'success';
            if (val < 80) return 'exception';
            return 'warning';
        },
        translateStatus(status) {
            const map = {
                'APPROVED': '已审核',
                'KEPT': '保留',
                'DRAFT': '草稿',
                'PENDING_REVIEW': '待审核'
            };
            return map[status] || status || '未知';
        },
        // 2. 增强版状态颜色适配
        getStatusTag(status) {
            const map = {
                'APPROVED': 'success',
                'KEPT': 'warning',
                'PENDING_REVIEW': 'primary',
                'DRAFT': 'info',
                'REJECTED': 'danger' // 预留打回状态颜色
            };
            return map[status] || 'info';
        }
    }
});