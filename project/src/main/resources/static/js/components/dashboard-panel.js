// public/js/components/dashboard-panel.js

Vue.component('dashboard-panel', {
  props: {
      currentUser: {
          type: Object,
          default: null
      }
  },
  template: `
    <div style="width: 100%; height: 100%">
      <div class="content-wrapper" style="width: 100%; height: 100%">
        <div class="row">
          <div class="col-sm-12">
            <!-- 状态一：加载中 -->
            <div v-if="isLoading" class="text-center p-5">
              <h4>正在加载仪表盘数据...</h4>
              <el-progress :percentage="100" status="success" :indeterminate="true" :duration="1"></el-progress>
            </div>
            <!-- 状态二：加载失败 -->
            <div v-else-if="!dashboardData" class="alert alert-danger m-5 text-center">
                <h4><i class="el-icon-warning-outline"></i> 加载仪表盘数据失败</h4>
                <p>请检查网络连接或联系系统管理员。</p>
                <el-button @click="fetchDashboardData" size="small" type="primary" plain>重试</el-button>
            </div>
            <!-- 状态三：成功加载 -->
            <div v-else class="home-tab">
              <div class="d-sm-flex align-items-center justify-content-between border-bottom">
                <ul class="nav nav-tabs" role="tablist">
                  <li class="nav-item"><a class="nav-link active ps-0" id="home-tab" data-bs-toggle="tab" href="#overview" role="tab" aria-selected="true">工作概览</a></li>
                  <li class="nav-item">
                    <a class="nav-link" id="contact-tab" data-bs-toggle="tab" href="#demographics" role="tab" aria-selected="false" @click="fetchUserTasks">
                      事务提醒
                      <el-badge :value="userTasks.length" class="ml-2" type="warning" :hidden="userTasks.length === 0"></el-badge>
                    </a>
                  </li>
                </ul>
                <div>
                  <div class="btn-wrapper">
                    <a href="#" class="btn btn-otline-dark align-items-center"><i class="icon-share"></i> 分享</a>
                    <a href="#" class="btn btn-otline-dark"><i class="icon-printer"></i> 打印</a>
                    <a href="#" class="btn btn-primary text-white me-0"><i class="icon-download"></i> 导出</a>
                  </div>
                </div>
              </div>
              <div class="tab-content tab-content-basic">
                <div class="tab-pane fade show active" id="overview">
                  <!-- 1. 工作概览 (Overview Cards) -->
                  <div class="row">
                    <div class="col-sm-12">
                      <div class="statistics-details d-flex align-items-center justify-content-between">
                        <div v-if="dashboardData.overview">
                          <p class="statistics-title">完成率</p>
                          <h3 class="rate-percentage">{{ dashboardData.overview.completionRate.toFixed(2) }}%</h3>
                          <p :class="['d-flex', dashboardData.overview.completionRateTrend >= 0 ? 'text-success' : 'text-danger']">
                            <i :class="['mdi', dashboardData.overview.completionRateTrend >= 0 ? 'mdi-menu-up' : 'mdi-menu-down']"></i>
                            <span>{{ dashboardData.overview.completionRateTrend.toFixed(2) }}%</span>
                          </p>
                        </div>
                        <div v-if="dashboardData.overview">
                          <p class="statistics-title">本周新增</p>
                          <h3 class="rate-percentage">{{ dashboardData.overview.newRecordsThisWeek }}</h3>
                          <p class="text-muted d-flex"><i class="mdi mdi-menu-right"></i><span>-</span></p>
                        </div>
                        <div v-if="dashboardData.overview">
                          <p class="statistics-title">已处理</p>
                          <h3 class="rate-percentage">{{ dashboardData.overview.processedTasks }}</h3>
                          <p class="text-muted d-flex"><i class="mdi mdi-menu-right"></i><span>-</span></p>
                        </div>
                        <div v-if="dashboardData.overview" class="d-none d-md-block">
                          <p class="statistics-title">平均工作时间</p>
                          <h3 class="rate-percentage">{{ formatDuration(dashboardData.overview.averageWorkTimeSeconds) }}</h3>
                          <p class="text-muted d-flex"><i class="mdi mdi-menu-right"></i><span>-</span></p>
                        </div>
                        <div v-if="dashboardData.overview" class="d-none d-md-block">
                          <p class="statistics-title">待处理</p>
                          <h3 class="rate-percentage">{{ dashboardData.overview.pendingTasks }}</h3>
                           <p class="text-danger d-flex"><i class="mdi mdi-alert-circle"></i><span>{{ dashboardData.overview.pendingTasks }} 项</span></p>
                        </div>
                        <div v-if="dashboardData.overview" class="d-none d-md-block">
                          <p class="statistics-title">平均审核周期</p>
                          <h3 class="rate-percentage">{{ formatDuration(dashboardData.overview.averageReviewCycleSeconds) }}</h3>
                           <p class="text-muted d-flex"><i class="mdi mdi-menu-right"></i><span>-</span></p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <!-- 2. 图表与摘要 -->
                  <div class="row">
                    <div class="col-lg-8 d-flex flex-column">
                      <div class="row flex-grow">
                        <div class="col-12 grid-margin stretch-card">
                          <div class="card card-rounded">
                            <div class="card-body">
                              <div class="d-sm-flex justify-content-between align-items-start">
                                <div><h4 class="card-title card-title-dash">审批工作量 (近7日)</h4></div>
                              </div>
                              <div class="chartjs-wrapper mt-5"><canvas id="performaneLine"></canvas></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="col-lg-4 d-flex flex-column">
                       <div class="row flex-grow">
                         <div class="col-12 grid-margin stretch-card">
                           <div class="card card-rounded">
                             <div class="card-body">
                                <h4 class="card-title card-title-dash mb-4">问题状态摘要</h4>
                                <div v-if="dashboardData.problemSummary">
                                   <div class="d-flex justify-content-between align-items-center mb-3">
                                     <span class="font-weight-bold">待解决 (Open)</span>
                                     <el-tag type="danger" size="large">{{ dashboardData.problemSummary.openIssues || 0 }}</el-tag>
                                   </div>
                                   <div class="d-flex justify-content-between align-items-center mb-3">
                                     <span class="font-weight-bold">待复核 (Resolved)</span>
                                     <el-tag type="warning" size="large">{{ dashboardData.problemSummary.resolvedIssues || 0 }}</el-tag>
                                   </div>
                                   <div class="d-flex justify-content-between align-items-center">
                                     <span class="font-weight-bold">已关闭 (Closed)</span>
                                     <el-tag type="success" size="large">{{ dashboardData.problemSummary.closedIssues || 0 }}</el-tag>
                                   </div>
                                </div>
                                <div v-else class="text-muted text-center pt-5">暂无问题数据</div>
                             </div>
                           </div>
                         </div>
                       </div>
                    </div>
                  </div>
                </div>
                
                <!-- 事务提醒 Tab 的内容 -->
                <div class="tab-pane fade" id="demographics" role="tabpanel" aria-labelledby="contact-tab">
                  <div class="p-0"> 
                      <!-- 状态一：加载中 -->
                      <div v-if="isTasksLoading" class="text-center p-5">
                          <i class="el-icon-loading"></i> 正在刷新您的待办任务...
                      </div>
                      
                      <!-- 状态二：无任务 -->
                      <div v-else-if="userTasks.length === 0" class="text-center p-5">
                        <i class="mdi mdi-check-circle-outline" style="font-size: 3rem; color: #67c23a;"></i>
                        <h5 class="mt-3">太棒了！</h5>
                        <p class="text-muted">您当前没有需要处理的任务。</p>
                      </div>

                      <!-- 状态三：有任务，显示表格 -->
                      <div v-else 
                           class="table-container-with-style" 
                           style="border-radius: 10px; 
                                  overflow: hidden; 
                                  border: 1px solid #EBEEF5; 
                                  box-shadow: 0 2px 12px 0 rgba(0,0,0,.1);
                                  margin: 1.5rem;">
                        
                        <el-table :data="userTasks" stripe @row-click="handleTaskClick" style="cursor: pointer; width: 100%;">
                          <el-table-column label="任务类型" width="120">
                              <template slot-scope="scope">
                                  <el-tag :type="getTaskTagType(scope.row.taskType)" size="small">{{ scope.row.taskType }}</el-tag>
                              </template>
                          </el-table-column>
                          <el-table-column prop="projectNumber" label="项目编号" width="180" sortable></el-table-column>
                          <el-table-column prop="recordName" label="记录名称" min-width="250" show-overflow-tooltip></el-table-column>
                          <el-table-column prop="updatedAt" label="更新时间" width="200" sortable>
                               <template slot-scope="scope">{{ new Date(scope.row.updatedAt).toLocaleString() }}</template>
                          </el-table-column>
                          <el-table-column label="操作" width="120" align="center">
                              <template slot-scope="scope">
                                  <el-button type="primary" size="mini" plain @click="handleTaskClick(scope.row)">处理任务</el-button>
                              </template>
                          </el-table-column>
                        </el-table>
                      </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
`,
data() {
  return {
    isLoading: true,
    dashboardData: null,
    performanceChart: null,
    isTasksLoading: false,
    userTasks: []
  };
},
methods: {
  // 【核心修复】: 动态注入样式，解决 Vue 模板中不能包含 <style> 的问题
  injectStyles() {
      const styleId = 'dashboard-modern-table-styles';
      if (document.getElementById(styleId)) return;

      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
          .modern-table.el-table--border,
          .modern-table.el-table--group {
              border-radius: 10px; /* 从 8px 改为 10px */
              overflow: hidden; 
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); 
              border: 1px solid #EBEEF5; 
          }
          .modern-table .el-table__header-wrapper th {
              background-color: #f5f7fa !important; color: #606266; font-weight: 600;
          }
          .modern-table .el-table--striped .el-table__body tr.el-table__row--striped td {
              background: #fafcff !important;
          }
          .modern-table .el-table__body tr:hover > td {
              background-color: #ecf5ff !important;
          }
          .modern-table.el-table--border::after, .modern-table.el-table--group::after, .modern-table::before {
              background-color: transparent;
          }
      `;
      document.head.appendChild(style);
  },
  formatDuration(totalSeconds) {
    if (totalSeconds == null || isNaN(totalSeconds) || totalSeconds < 0) return 'N/A';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  },
  async fetchDashboardData() {
    this.isLoading = true;
    try {
      const [dashboardRes, tasksRes] = await Promise.all([
        axios.get('/api/stats/dashboard'),
        axios.get('/api/stats/user-tasks')
      ]);
      
      this.dashboardData = dashboardRes.data;
      this.userTasks = tasksRes.data;
      console.log("仪表盘及待办数据一次性加载成功！", { dashboard: this.dashboardData, tasks: this.userTasks });

      this.$nextTick(() => {
        this.initLineChart();
      });
    } catch (error) {
      this.$message.error("加载仪表盘数据失败！");
      this.dashboardData = null;
      this.userTasks = [];
    } finally {
      this.isLoading = false;
    }
  },
  
  async fetchUserTasks() {
      if (this.isTasksLoading) return;
      
      this.isTasksLoading = true;
      console.log("正在刷新待办列表...");
      try {
          const response = await axios.get('/api/stats/user-tasks');
          this.userTasks = response.data;
          this.$message.success('待办列表已刷新！');
      } catch (error) {
          this.$message.error('刷新待办列表失败！');
      } finally {
          this.isTasksLoading = false;
      }
  },

  initLineChart() {
    const canvasElement = document.getElementById("performaneLine");
    if (!canvasElement || !this.dashboardData || !this.dashboardData.reviewWorkload) return;
    if (this.performanceChart) return;
    
    const workload = this.dashboardData.reviewWorkload;
    const labels = workload.map(d => d.date);
    const data = workload.map(d => d.count);
    const ctx = canvasElement.getContext("2d");
    const saleGradientBg = ctx.createLinearGradient(5, 0, 5, 100);
    saleGradientBg.addColorStop(0, "rgba(26, 115, 232, 0.18)");
    saleGradientBg.addColorStop(1, "rgba(26, 115, 232, 0.02)");
    const salesTopData = {
        labels: labels,
        datasets: [{
            label: "已审核数", data: data, backgroundColor: saleGradientBg, borderColor: "#1F3BB3", borderWidth: 1.5,
            fill: true, pointRadius: 4, pointBackgroundColor: "#1F3BB3", pointBorderColor: "#fff",
        }]
    };
    const salesTopOptions = {
        responsive: true, maintainAspectRatio: false,
        scales: {
          yAxes: [{ gridLines: { color: "#F0F0F0", zeroLineColor: "#F0F0F0" }, ticks: { beginAtZero: true, fontColor: "#6B778C" } }],
          xAxes: [{ gridLines: { display: false }, ticks: { fontColor: "#6B778C" } }]
        },
        legend: { display: false }, elements: { line: { tension: 0.4 } }, tooltips: { backgroundColor: "rgba(31, 59, 179, 1)" },
    };
    this.performanceChart = new Chart(ctx, { type: "line", data: salesTopData, options: salesTopOptions });
    console.log("审批工作量折线图已成功初始化。");
  },

  handleTaskClick(task) {
      console.log("用户点击了任务:", task);
      if (this.currentUser && this.currentUser.identity) {
          const role = this.currentUser.identity.toUpperCase();
          if (task.taskType === '待审核' && (role === 'REVIEWER' || role === 'MANAGER')) {
              this.$root.navigateTo('record-review-panel', { recordId: task.recordId });
          } else {
              this.$root.navigateTo('record-workspace-panel', { recordId: task.recordId });
          }
      } else {
          console.warn("无法确定用户角色，跳转失败。");
          this.$message.warning("无法确定您的角色，无法进行跳转。");
      }
  },
  getTaskTagType(taskType) {
      const typeMap = {
          '待审核': 'warning', '待修改': 'primary', '草稿': 'info'
      };
      return typeMap[taskType] || '';
  }
},

mounted() {
  // 1. 注入样式
  this.injectStyles();
  // 2. 加载数据
  console.log("Dashboard Panel 组件已挂载 (mounted)。");
  this.fetchDashboardData();
},
updated() {
  console.log("Dashboard Panel 组件已更新 (updated)。尝试初始化图表...");
  this.$nextTick(() => {
      this.initLineChart();
  });
},
beforeDestroy() {
  if (this.performanceChart) {
    console.log("正在销毁 Chart.js 实例...");
    this.performanceChart.destroy();
    this.performanceChart = null;
  }
}
});