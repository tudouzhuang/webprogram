// public/js/components/dashboard-panel.js

Vue.component('dashboard-panel', {
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
                  <li class="nav-item"><a class="nav-link" id="contact-tab" data-bs-toggle="tab" href="#demographics" role="tab">事务提醒</a></li>
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
                    <!-- 折线图 -->
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
                    <!-- 问题摘要 -->
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
      performanceChart: null // 用于存储图表实例，方便销毁
    };
  },
  methods: {
    formatDuration(totalSeconds) {
      if (totalSeconds == null || isNaN(totalSeconds) || totalSeconds < 0) return 'N/A';
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    },
    async fetchDashboardData() {
      this.isLoading = true;
      try {
        const response = await axios.get('/api/stats/dashboard');
        this.dashboardData = response.data;
        console.log("仪表盘数据一次性加载成功！", this.dashboardData);
        // 【核心修正】：不再在这里调用 initLineChart
      } catch (error) {
        this.$message.error("加载仪表盘数据失败！");
        this.dashboardData = null;
      } finally {
        this.isLoading = false;
      }
    },
    initLineChart() {
      // 1. 检查 DOM 和数据是否就绪
      const canvasElement = document.getElementById("performaneLine");
      if (!canvasElement || !this.dashboardData || !this.dashboardData.reviewWorkload) {
        return; // 如果还没准备好，就直接返回，等待下一次 updated 钩子触发
      }
      
      // 2. 如果图表已经存在，也直接返回，避免重复初始化
      if (this.performanceChart) {
        return;
      }
      
      console.log("✅ Chart.js、容器和数据均已就绪，开始初始化折线图...");

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
              label: "已审核数",
              data: data,
              backgroundColor: saleGradientBg,
              borderColor: "#1F3BB3",
              borderWidth: 1.5,
              fill: true,
              pointRadius: 4,
              pointBackgroundColor: "#1F3BB3",
              pointBorderColor: "#fff",
          }]
      };

      const salesTopOptions = {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            yAxes: [{
                gridLines: { color: "#F0F0F0", zeroLineColor: "#F0F0F0" },
                ticks: { beginAtZero: true, fontColor: "#6B778C" }
            }],
            xAxes: [{
                gridLines: { display: false },
                ticks: { fontColor: "#6B778C" }
            }]
          },
          legend: { display: false },
          elements: { line: { tension: 0.4 } },
          tooltips: { backgroundColor: "rgba(31, 59, 179, 1)" },
      };

      // 3. 创建新实例，并将其保存在 data 属性中
      this.performanceChart = new Chart(ctx, { type: "line", data: salesTopData, options: salesTopOptions });
      console.log("审批工作量折线图已成功初始化。");
    }
  },
  
  // 【【【 核心修正：重构生命周期钩子 】】】
  mounted() {
    console.log("Dashboard Panel 组件已挂载 (mounted)。");
    this.fetchDashboardData();
  },

  /**
   * 新增：updated 钩子
   * 在每次数据变化导致 DOM 重新渲染后调用。
   * 这是初始化非 Vue 插件（如 Chart.js）最可靠的地方。
   */
  updated() {
    console.log("Dashboard Panel 组件已更新 (updated)。尝试初始化图表...");
    // 每次 DOM 更新后，都尝试去初始化图表
    // initLineChart 内部的检查会防止重复初始化
    this.$nextTick(() => {
        this.initLineChart();
    });
  },
  
  /**
   * 新增：beforeDestroy 钩子
   * 在组件销毁前，销毁 Chart.js 实例，防止内存泄漏。
   */
  beforeDestroy() {
    if (this.performanceChart) {
      console.log("正在销毁 Chart.js 实例...");
      this.performanceChart.destroy();
      this.performanceChart = null;
    }
  }
});