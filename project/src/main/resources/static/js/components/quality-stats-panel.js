// src/main/resources/static/js/components/quality-stats-panel.js
Vue.component('quality-stats-panel', {
    props: {
        projectId: {
            type: [String, Number],
            required: false // 设为 false 可兼容全局模式
        }
    },
    template: `
        <div class="content-wrapper">
            <div class="page-header mb-4" style="display: flex; justify-content: space-between; align-items: center;">
                <h3 class="page-title" style="margin: 0;">
                    <span class="page-title-icon bg-gradient-primary text-white me-2" style="padding: 8px; border-radius: 4px;">
                        <i class="mdi mdi-chart-bar"></i>
                    </span> 
                    <span style="vertical-align: middle;">数据研究看板</span>
                </h3>
                <div class="header-actions">
                    <el-button type="primary" size="medium" icon="el-icon-refresh" @click="loadAllData">同步最新数据</el-button>
                </div>
            </div>

            <div class="alert d-flex align-items-center shadow-sm mb-4" style="border-left: 5px solid #409EFF; background-color: #ecf5ff; padding: 15px 20px;">
                <i class="el-icon-data-analysis text-primary" style="font-size: 28px; margin-right: 15px;"></i>
                <div>
                    <div style="font-size: 12px; color: #909399; margin-bottom: 2px;">当前看板分析目标</div>
                    <div style="font-size: 16px; font-weight: bold; color: #303133;">
                        {{ currentProjectName || '全局大盘数据' }}
                    </div>
                </div>
                <div class="ms-auto text-muted" style="font-size: 13px;">
                    <i class="el-icon-mouse"></i> 点击下方列表中的任意一行，即可实时切换上方看板数据
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
                                                <el-table-column label="符合率" width="200"> <template slot-scope="scope">
                                                        <div class="d-flex align-items-center">
                                                            <el-progress :percentage="scope.row.compliance" 
                                                                        :status="getProgStatus(scope.row.compliance)" 
                                                                        :stroke-width="12" 
                                                                        :show-text="false" 
                                                                        style="flex: 1;"></el-progress>
                                                            <span class="ms-2 font-weight-bold" style="min-width: 45px; font-size: 13px; color: #606266;">
                                                                {{ scope.row.compliance }}%
                                                            </span>
                                                        </div>
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

                                <el-table-column label="总审核轮次" prop="totalRounds" sortable width="140" align="center"></el-table-column>

                                <el-table-column label="平均轮次" prop="avgRounds" sortable width="140" align="center">
                                    <template slot-scope="scope">
                                        <el-tag effect="plain" size="small" :type="scope.row.avgRounds > 2 ? 'danger' : 'info'">
                                            {{ scope.row.avgRounds }}
                                        </el-tag>
                                    </template>
                                </el-table-column>
                                
                                <el-table-column label="绩效统计" prop="onePassCount" sortable width="240">
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
            tableData: [],
            currentProjectName: ''
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
            // 1. 调用 el-table 内置的方法：展开/折叠该行明细
            this.$refs.statsTable.toggleRowExpansion(row);

            // 🔥 2. 【核心注入】提取当前行数据，实时刷新顶部看板
            // 更新看板聚焦名称
            this.currentProjectName = row.name;

            // 计算当前行的累计任务和一次通过率
            const totalTasks = row.details ? row.details.length : 0;
            const totalReviews = (row.onePassCount || 0) + (row.ngCount || 0);
            const onePassRate = totalReviews > 0 ? Math.round((row.onePassCount / totalReviews) * 100) : 0;

            // 将当前行的数据覆盖给全局变量 globalStats，上方卡片会瞬间响应变化
            this.globalStats = {
                avgCompliance: row.avgCompliance || 0,
                avgRounds: row.avgRounds || 0,
                onePassRate: onePassRate,
                totalTasks: totalTasks
            };
        },
        async loadAllData() {
            this.loading = true;
            try {
                // 1. 请求全量数据
                const res = await axios.get('/api/stats/full-quality-report');

                // 🔥 2. 无论什么模式，下方表格都拿到全量数据
                this.tableData = res.data.list;

                // 3. 核心计算：分离看板数据与列表数据
                if (this.projectId) {
                    const currentProject = res.data.list.find(item =>
                        item.type === 'project' &&
                        item.details && item.details.length > 0 &&
                        item.details[0].projectId == this.projectId
                    );

                    if (currentProject) {
                        this.currentProjectName = currentProject.name; // 存下名字给提示框用

                        // 针对该项目计算顶部的 4 个 KPI
                        const totalTasks = currentProject.details.length;
                        const totalReviews = currentProject.onePassCount + currentProject.ngCount;
                        const onePassRate = totalReviews > 0 ? Math.round((currentProject.onePassCount / totalReviews) * 100) : 0;

                        this.globalStats = {
                            avgCompliance: currentProject.avgCompliance,
                            avgRounds: currentProject.avgRounds,
                            onePassRate: onePassRate,
                            totalTasks: totalTasks
                        };

                        // 贴心优化：自动展开当前项目的详情行，方便用户第一时间看到
                        this.$nextTick(() => {
                            if (this.$refs.statsTable) {
                                this.$refs.statsTable.toggleRowExpansion(currentProject, true);
                            }
                        });
                    } else {
                        this.currentProjectName = '未知项目';
                        this.globalStats = { avgCompliance: 0, avgRounds: 0, onePassRate: 0, totalTasks: 0 };
                    }
                } else {
                    // 全局模式：没有指定项目，显示大盘数据，清空项目名称
                    this.currentProjectName = '';
                    this.globalStats = res.data.global;
                }
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
    },

    watch: {
        projectId(newVal, oldVal) {
            if (newVal !== oldVal) {
                this.loadAllData();
            }
        }
    }
});