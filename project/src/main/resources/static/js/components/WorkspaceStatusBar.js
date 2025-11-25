// public/js/components/workspace-status-bar.js

const WorkspaceStatusBar = {
    props: {
        fileId: { type: [Number, String], default: null },
        recordInfo: { type: Object, required: true },
        metaData: { type: Object, default: null },
        liveStats: { type: Object, default: null },
        status: { type: String, required: true },
        totalDuration: { type: Number, default: 0 },
        sessionDuration: { type: Number, default: 0 }
    },
    data() {
        return {
            isLoading: false,
            savedStats: null,
            isDirty: false,
            error: null
        };
    },
    computed: {
        shouldShowStatisticsTable() {
            return this.fileId && Number(this.fileId) > 0;
        },

        displayData() {
            return this.liveStats || this.savedStats;
        },

        // 逻辑保持不变：动态计算一致性
        processedStats() {
            const rawStats = (this.displayData && this.displayData.stats) ? this.displayData.stats : [];
            if (rawStats.length === 0) return [];

            let stats = JSON.parse(JSON.stringify(rawStats));
            let globalTotalItems = 0;
            let globalDiffCount = 0;
            let pairFoundCount = 0;

            stats.forEach(designRow => {
                if (designRow.category && designRow.category.startsWith('设计-')) {
                    const suffix = designRow.category.substring(3); 
                    const proofRow = stats.find(r => r.category === ('校审-' + suffix));

                    if (proofRow) {
                        pairFoundCount++;
                        const currentTotal = Math.max(designRow.totalCount, proofRow.totalCount, 0);
                        globalTotalItems += currentTotal;
                        const diffOk = Math.abs(designRow.okCount - proofRow.okCount);
                        const diffNg = Math.abs(designRow.ngCount - proofRow.ngCount);
                        globalDiffCount += (diffOk + diffNg);
                    }
                }
            });

            if (pairFoundCount > 0 && globalTotalItems > 0) {
                let consistencyRate = ((globalTotalItems - globalDiffCount) / globalTotalItems * 100).toFixed(2);
                consistencyRate = Math.max(0, Math.min(100, Number(consistencyRate)));

                stats.push({
                    category: '自检与复核一致性',
                    totalCount: globalTotalItems,
                    okCount: '-',          
                    ngCount: globalDiffCount,
                    naCount: '-',
                    okPercentage: consistencyRate,
                    isComputed: true
                });
            } else if (pairFoundCount > 0) {
                stats.push({
                    category: '自检与复核一致性',
                    totalCount: 0,
                    okCount: '-',
                    ngCount: 0,
                    naCount: '-',
                    okPercentage: 100,
                    isComputed: true
                });
            }
            return stats;
        },

        basicInfo() {
            const meta = this.metaData || {};
            const r = this.recordInfo || {};
            return {
                partName: meta.partName || r.partName || 'N/A',
                moldNo: meta.moldDrawingNumber || r.moldDrawingNumber || 'N/A',
                processName: meta.processName || r.processName || 'N/A',
                equipment: meta.equipment || r.equipment || 'N/A'
            };
        },

        personnelInfo() {
            if (this.displayData && this.displayData.fileNumber) {
                return {
                    number: this.displayData.fileNumber,
                    designer: this.displayData.designerName || 'N/A',
                    proofreader: this.displayData.proofreaderName || 'N/A',
                    auditor: this.displayData.auditorName || 'N/A'
                };
            }
            if (this.recordInfo) {
                return {
                    number: this.recordInfo.processName || this.recordInfo.partName || '...',
                    designer: this.recordInfo.designerName || '（未知）',
                    proofreader: this.recordInfo.proofreaderName || '（未知）',
                    auditor: this.recordInfo.auditorName || '（未知）'
                };
            }
            return { number: '...', designer: '...', proofreader: '...', auditor: '...' };
        },

        overallTotalCount() {
            if (this.processedStats.length > 0) {
                const normalRow = this.processedStats.find(s => !s.isComputed && s.totalCount > 0);
                return normalRow ? normalRow.totalCount : 0;
            }
            return 0;
        }
    },
    watch: {
        fileId: {
            immediate: true,
            handler(newId) {
                if (newId && Number(newId) > 0) {
                    this.fetchSavedStats();
                }
            }
        },
        liveStats(newVal) {
            if (newVal && this.savedStats && JSON.stringify(newVal) !== JSON.stringify(this.savedStats)) {
                this.isDirty = true;
            } else {
                this.isDirty = false;
            }
        }
    },
    methods: {
        fetchSavedStats() {
            this.isLoading = true;
            axios.get(`/api/files/${this.fileId}/statistics`)
                .then(response => {
                    if (typeof response.data === 'object' && response.data !== null) {
                        this.savedStats = response.data;
                        this.isDirty = false;
                        this.error = null;
                    }
                })
                .catch(error => {
                    console.error("加载统计失败:", error);
                    if (!this.savedStats) this.error = "无法获取人员信息";
                })
                .finally(() => {
                    this.isLoading = false;
                });
        },
        formatDuration(totalSeconds) {
            if (totalSeconds == null || totalSeconds < 0) return '0 秒';
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            let res = [];
            if(hours > 0) res.push(`${hours}小时`);
            if(minutes > 0) res.push(`${minutes}分`);
            res.push(`${seconds}秒`);
            return res.join(' ');
        },
        formatStatus(status) {
            const map = { 'DRAFT': '草稿', 'PENDING_REVIEW': '审核中', 'APPROVED': '已通过', 'REJECTED': '已驳回', 'CHANGES_REQUESTED': '待修改' };
            return map[status] || status;
        },
        getStatusTagType(status) {
            const map = { 'DRAFT': 'info', 'PENDING_REVIEW': 'warning', 'APPROVED': 'success', 'REJECTED': 'danger', 'CHANGES_REQUESTED': 'primary' };
            return map[status] || 'primary';
        },
        getRowStyle({ row }) {
            if (row.isComputed) {
                return { 
                    backgroundColor: '#ecf5ff', 
                    color: '#409EFF',           
                    fontWeight: 'bold',
                    borderTop: '2px solid #d9ecff'
                };
            }
            if (row.category && row.category.includes('重大风险')) {
                return { color: '#F56C6C' };
            }
            return {};
        }
    },
    template: `
        <div class="card">
            <div class="card-body p-3">
                <el-row :gutter="20" class="mb-3">
                    <el-col :span="8">
                        <div class="kpi-card">
                            <div class="kpi-label text-muted">当前状态</div>
                            <div class="kpi-value">
                                <el-tag :type="getStatusTagType(status)" size="medium" effect="dark">{{ formatStatus(status) }}</el-tag>
                            </div>
                        </div>
                    </el-col>
                    <el-col :span="8">
                        <div class="kpi-card">
                            <div class="kpi-label text-muted">工作时长 (累计 / 本次)</div>
                            <div class="kpi-value h5 mb-0 font-weight-bold">
                                {{ formatDuration(totalDuration) }} 
                                <span class="text-primary small" style="font-weight: normal;">/ {{ formatDuration(sessionDuration) }}</span>
                            </div>
                        </div>
                    </el-col>
                    <el-col :span="8">
                        <div class="kpi-card">
                            <div class="kpi-label text-muted">检查总项数</div>
                            <div class="kpi-value h5 mb-0 font-weight-bold text-dark">{{ overallTotalCount }}</div>
                        </div>
                    </el-col>
                </el-row>

                <el-divider class="my-3"></el-divider>

                <el-row type="flex" :gutter="20" class="d-flex flex-wrap align-items-stretch">
                    
                    <el-col :span="9" class="d-flex flex-column">
                        <h6 class="text-muted small font-weight-bold mb-2">项目信息</h6>
                        <div class="flex-grow-1 d-flex flex-column">
                            <table class="table table-bordered table-sm m-0 shadow-sm h-100" style="font-size: 0.85em; background-color: white;">
                                <tbody>
                                    <tr>
                                        <td style="width: 30%; background-color: #f8f9fa;" class="font-weight-bold align-middle">零件名称</td>
                                        <td class="align-middle">{{ basicInfo.partName }}</td>
                                    </tr>
                                    <tr>
                                        <td style="background-color: #f8f9fa;" class="font-weight-bold align-middle">模具图号</td>
                                        <td class="align-middle">{{ basicInfo.moldNo }}</td>
                                    </tr>
                                    <tr>
                                        <td style="background-color: #f8f9fa;" class="font-weight-bold align-middle">工序名称</td>
                                        <td class="align-middle">{{ basicInfo.processName }}</td>
                                    </tr>
                                    <tr>
                                        <td style="background-color: #f8f9fa;" class="font-weight-bold align-middle">使用设备</td>
                                        <td class="align-middle">{{ basicInfo.equipment }}</td>
                                    </tr>
                                    
                                    <tr style="border-top: 2px solid #dee2e6;">
                                        <td style="background-color: #f8f9fa;" class="font-weight-bold align-middle">设计人员</td>
                                        <td class="align-middle">{{ personnelInfo.designer }}</td>
                                    </tr>
                                    <tr>
                                        <td style="background-color: #f8f9fa;" class="font-weight-bold align-middle">校对人员</td>
                                        <td class="align-middle">{{ personnelInfo.proofreader }}</td>
                                    </tr>
                                    <tr>
                                        <td style="background-color: #f8f9fa;" class="font-weight-bold align-middle">审核人员</td>
                                        <td class="align-middle">{{ personnelInfo.auditor }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </el-col>
                    
                    <el-col :span="15" v-if="shouldShowStatisticsTable" class="d-flex flex-column">
                        <div v-if="isLoading && !savedStats" class="text-center text-muted pt-4"><i class="el-icon-loading"></i> 加载中...</div>
                        <div v-else class="d-flex flex-column h-100">
                            <div class="d-flex justify-content-between align-items-center mb-1">
                                <h6 class="text-muted small font-weight-bold mb-0">检查统计</h6>
                                <span v-if="isDirty" class="text-warning small font-italic"><i class="el-icon-refresh"></i> 实时更新中...</span>
                            </div>
                            <div class="flex-grow-1 shadow-sm" style="background: white; border: 1px solid #dee2e6; border-radius: 0.25rem; overflow: hidden; position: relative; min-height: 250px;">
                                <el-table 
                                    :data="processedStats" 
                                    size="mini" 
                                    style="width: 100%; position: absolute; top: 0; bottom: 0; left: 0;"
                                    height="100%"
                                    :header-cell-style="{background:'#f8f9fa', color:'#6c757d', padding:'6px 0'}"
                                    :cell-style="{padding:'5px 0'}"
                                    :row-style="getRowStyle">
                                    
                                    <el-table-column prop="category" label="分类" min-width="110" show-overflow-tooltip></el-table-column>
                                    
                                    <el-table-column prop="okCount" label="√ (OK)" min-width="60" align="center"></el-table-column>
                                    
                                    <el-table-column prop="ngCount" min-width="70" align="center">
                                        <template slot="header">
                                            <span>× (NG)</span>
                                        </template>
                                        <template slot-scope="scope">
                                            <div v-if="scope.row.isComputed">
                                                <span v-if="scope.row.ngCount > 0" class="text-danger">
                                                    {{ scope.row.ngCount }} <span style="font-size: 0.8em">差异</span>
                                                </span>
                                                <span v-else class="text-success">0 差异</span>
                                            </div>
                                            <div v-else :class="{'text-danger font-weight-bold': scope.row.ngCount > 0}">
                                                {{ scope.row.ngCount }}
                                            </div>
                                        </template>
                                    </el-table-column>
                                    
                                    <el-table-column prop="naCount" label="无 (NA)" min-width="50" align="center"></el-table-column>
                                    
                                    <el-table-column prop="okPercentage" label="OK%" min-width="80" align="center">
                                        <template slot-scope="scope">
                                            <el-tag v-if="scope.row.isComputed" 
                                                size="mini" 
                                                :type="scope.row.okPercentage == 100 ? 'success' : 'warning'"
                                                effect="plain">
                                                一致 {{ scope.row.okPercentage }}%
                                            </el-tag>
                                            <span v-else>{{ scope.row.okPercentage }}%</span>
                                        </template>
                                    </el-table-column>

                                </el-table>
                            </div>
                        </div>
                    </el-col>
                </el-row>
            </div>
        </div>
    `
};