<template>
  <div class="main-panel">
    <div class="content-wrapper">
      <!-- 以下是 main-panel 中的全部内容 -->
      <div class="row">
        <div class="col-sm-12">
          <div class="home-tab">
            <div class="d-sm-flex align-items-center justify-content-between border-bottom">
              <ul class="nav nav-tabs" role="tablist">
                <li class="nav-item">
                  <a class="nav-link active ps-0" id="home-tab" data-bs-toggle="tab"
                     href="#overview" role="tab" aria-controls="overview"
                     aria-selected="true">工作概览</a>
                </li>
                <li class="nav-item">
                  <a class="nav-link" id="contact-tab" data-bs-toggle="tab"
                     href="#demographics"
                     role="tab" aria-selected="false">事务提醒</a>
                </li>
                <li class="nav-item">
                  <a class="nav-link border-0" id="more-tab" data-bs-toggle="tab" href="#more"
                     role="tab" aria-selected="false">更多</a>
                </li>
              </ul>
              <div>
                <div class="btn-wrapper">
                  <a href="#" class="btn btn-otline-dark align-items-center"><i
                      class="icon-share"></i> 分享</a>
                  <a href="#" class="btn btn-otline-dark"><i class="icon-printer"></i> 打印</a>
                  <a href="#" class="btn btn-primary text-white me-0"><i
                      class="icon-download"></i> 导出</a>
                </div>
              </div>
            </div>
            <div class="tab-content tab-content-basic">
              <div class="tab-pane fade show active" id="overview" role="tabpanel"
                   aria-labelledby="overview">
                <div class="row">
                  <div class="col-sm-12">
                    <div class="statistics-details d-flex align-items-center justify-content-between">
                      <div>
                        <p class="statistics-title">完成率</p>
                        <h3 class="rate-percentage">32.53%</h3>
                        <p class="text-danger d-flex"><i
                            class="mdi mdi-menu-down"></i><span>-0.5%</span></p>
                      </div>
                      <div>
                        <p class="statistics-title">页面浏览量</p>
                        <h3 class="rate-percentage">7,682</h3>
                        <p class="text-success d-flex"><i
                            class="mdi mdi-menu-up"></i><span>+0.1%</span></p>
                      </div>
                      <div>
                        <p class="statistics-title">已处理</p>
                        <h3 class="rate-percentage">68.8</h3>
                        <p class="text-danger d-flex"><i
                            class="mdi mdi-menu-down"></i><span>68.8</span></p>
                      </div>
                      <div class="d-none d-md-block">
                        <p class="statistics-title">平均工作时间</p>
                        <h3 class="rate-percentage">2m:35s</h3>
                        <p class="text-success d-flex"><i
                            class="mdi mdi-menu-down"></i><span>+0.8%</span></p>
                      </div>
                      <div class="d-none d-md-block">
                        <p class="statistics-title">待处理</p>
                        <h3 class="rate-percentage">68.8</h3>
                        <p class="text-danger d-flex"><i
                            class="mdi mdi-menu-down"></i><span>68.8</span></p>
                      </div>
                      <div class="d-none d-md-block">
                        <p class="statistics-title">经常在线时间</p>
                        <h3 class="rate-percentage">2m:35s</h3>
                        <p class="text-success d-flex"><i
                            class="mdi mdi-menu-down"></i><span>+0.8%</span></p>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 折线图 -->
                <div class="row">
                  <div class="col-lg-8 d-flex flex-column">
                    <div class="row flex-grow">
                      <div class="col-12 col-lg-4 col-lg-12 grid-margin stretch-card">
                        <div class="card card-rounded">
                          <div class="card-body">
                            <div class="d-sm-flex justify-content-between align-items-start">
                              <div>
                                <h4 class="card-title card-title-dash">审批工作量折线表</h4>
                                <h5 class="card-subtitle card-subtitle-dash">直观读出您每周的审批数量</h5>
                              </div>
                              <div id="performance-line-legend"></div>
                            </div>
                            <div class="chartjs-wrapper mt-5">
                              <canvas id="performaneLine"></canvas>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- 右侧卡片 -->
                  <div class="col-lg-4 d-flex flex-column">
                    <div class="row flex-grow">
                      <div class="col-md-6 col-lg-12 grid-margin stretch-card">
                        <div class="card bg-primary card-rounded">
                          <div class="card-body pb-0">
                            <h4 class="card-title card-title-dash text-white mb-4">Status Summary</h4>
                            <div class="row">
                              <div class="col-sm-4">
                                <p class="status-summary-ight-white mb-1">Closed Value</p>
                                <h2 class="text-info">357</h2>
                              </div>
                              <div class="col-sm-8">
                                <div class="status-summary-chart-wrapper pb-4">
                                  <canvas id="status-summary"></canvas>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div class="col-md-6 col-lg-12 grid-margin stretch-card">
                        <div class="card card-rounded">
                          <div class="card-body">
                            <div class="row">
                              <div class="col-sm-6">
                                <div class="d-flex justify-content-between align-items-center mb-2 mb-sm-0">
                                  <div class="circle-progress-width">
                                    <div id="totalVisitors" class="progressbar-js-circle pr-2"></div>
                                  </div>
                                  <div>
                                    <p class="text-small mb-2">总访问量</p>
                                    <h4 class="mb-0 fw-bold">26.80%</h4>
                                  </div>
                                </div>
                              </div>
                              <div class="col-sm-6">
                                <div class="d-flex justify-content-between align-items-center">
                                  <div class="circle-progress-width">
                                    <div id="visitperday" class="progressbar-js-circle pr-2"></div>
                                  </div>
                                  <div>
                                    <p class="text-small mb-2">每日访问</p>
                                    <h4 class="mb-0 fw-bold">9065</h4>
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

                <!-- 后续可能还有内容 -->
                <div class="row">
                  <div class="col-lg-8 d-flex flex-column">
                    <!-- ... -->
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>      
    </div>
  </div>
</template>

<script>
export default {
  name: 'DashboardPanel',
  mounted() {
    console.log('DashboardPanel mounted');

    // 初始化图表逻辑示例（你需要根据 dashboard.js 复制完整逻辑）
    if (window.Chart && document.getElementById('performaneLine')) {
      const ctx = document.getElementById('performaneLine').getContext('2d');
      new Chart(ctx, {
        type: 'line',
        data: {
          // 示例数据
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          datasets: [{
            label: '审批数量',
            data: [10, 20, 15, 25, 30],
            borderColor: '#4c84ff',
            fill: false
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              display: true
            }
          }
        }
      });
    }

    // 其他 JS 初始化逻辑也可写这里
  }
}
</script>

<style scoped>
/* 添加你的组件局部样式（可选） */
</style>