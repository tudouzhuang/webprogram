Vue.component("dashboard-panel", {
  // 将原来 main-panel 里的 HTML 内容，作为组件的 template
  template: `
    <div style="width: 100%; height: 100%">
      <div class="content-wrapper" style="width: 100%; height: 100%">
        <div class="row">
          <div class="col-sm-12">
            <div class="home-tab">
              <div
                class="d-sm-flex align-items-center justify-content-between border-bottom"
              >
                <ul class="nav nav-tabs" role="tablist">
                  <li class="nav-item">
                    <a
                      class="nav-link active ps-0"
                      id="home-tab"
                      data-bs-toggle="tab"
                      href="#overview"
                      role="tab"
                      aria-controls="overview"
                      aria-selected="true"
                      >工作概览</a
                    >
                  </li>
                  <li class="nav-item">
                    <a
                      class="nav-link"
                      id="contact-tab"
                      data-bs-toggle="tab"
                      href="#demographics"
                      role="tab"
                      aria-selected="false"
                      >事务提醒</a
                    >
                  </li>
                  <li class="nav-item">
                    <a
                      class="nav-link border-0"
                      id="more-tab"
                      data-bs-toggle="tab"
                      href="#more"
                      role="tab"
                      aria-selected="false"
                      >更多</a
                    >
                  </li>
                </ul>
                <div>
                  <div class="btn-wrapper">
                    <a href="#" class="btn btn-otline-dark align-items-center"
                      ><i class="icon-share"></i> 分享</a
                    >
                    <a href="#" class="btn btn-otline-dark"
                      ><i class="icon-printer"></i> 打印</a
                    >
                    <a href="#" class="btn btn-primary text-white me-0"
                      ><i class="icon-download"></i> 导出</a
                    >
                  </div>
                </div>
              </div>
              <div class="tab-content tab-content-basic">
                <div
                  class="tab-pane fade show active"
                  id="overview"
                  role="tabpanel"
                  aria-labelledby="overview"
                >
                  <div class="row">
                    <div class="col-sm-12">
                      <div
                        class="statistics-details d-flex align-items-center justify-content-between"
                      >
                        <div>
                          <p class="statistics-title">完成率</p>
                          <h3 class="rate-percentage">32.53%</h3>
                          <p class="text-danger d-flex">
                            <i class="mdi mdi-menu-down"></i><span>-0.5%</span>
                          </p>
                        </div>
                        <div>
                          <p class="statistics-title">页面浏览量</p>
                          <h3 class="rate-percentage">7,682</h3>
                          <p class="text-success d-flex">
                            <i class="mdi mdi-menu-up"></i><span>+0.1%</span>
                          </p>
                        </div>
                        <div>
                          <p class="statistics-title">已处理</p>
                          <h3 class="rate-percentage">68.8</h3>
                          <p class="text-danger d-flex">
                            <i class="mdi mdi-menu-down"></i><span>68.8</span>
                          </p>
                        </div>
                        <div class="d-none d-md-block">
                          <p class="statistics-title">平均工作时间</p>
                          <h3 class="rate-percentage">2m:35s</h3>
                          <p class="text-success d-flex">
                            <i class="mdi mdi-menu-down"></i><span>+0.8%</span>
                          </p>
                        </div>
                        <div class="d-none d-md-block">
                          <p class="statistics-title">待处理</p>
                          <h3 class="rate-percentage">68.8</h3>
                          <p class="text-danger d-flex">
                            <i class="mdi mdi-menu-down"></i><span>68.8</span>
                          </p>
                        </div>
                        <div class="d-none d-md-block">
                          <p class="statistics-title">经常在线时间</p>
                          <h3 class="rate-percentage">2m:35s</h3>
                          <p class="text-success d-flex">
                            <i class="mdi mdi-menu-down"></i><span>+0.8%</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="row">
                    <div class="col-lg-8 d-flex flex-column">
                      <div class="row flex-grow">
                        <div
                          class="col-12 col-lg-4 col-lg-12 grid-margin stretch-card"
                        >
                          <div class="card card-rounded">
                            <div class="card-body">
                              <div
                                class="d-sm-flex justify-content-between align-items-start"
                              >
                                <div>
                                  <h4 class="card-title card-title-dash">
                                    审批工作量折线表
                                  </h4>
                                  <h5 class="card-subtitle card-subtitle-dash">
                                    直观读出您每周的审批数量
                                  </h5>
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
                    <div class="col-lg-4 d-flex flex-column">
                      <div class="row flex-grow">
                        <div class="col-md-6 col-lg-12 grid-margin stretch-card">
                          <div class="card bg-primary card-rounded">
                            <div class="card-body pb-0">
                              <h4
                                class="card-title card-title-dash text-white mb-4"
                              >
                                Status Summary
                              </h4>
                              <div class="row">
                                <div class="col-sm-4">
                                  <p class="status-summary-ight-white mb-1">
                                    Closed Value
                                  </p>
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
                                  <div
                                    class="d-flex justify-content-between align-items-center mb-2 mb-sm-0"
                                  >
                                    <div class="circle-progress-width">
                                      <div
                                        id="totalVisitors"
                                        class="progressbar-js-circle pr-2"
                                      ></div>
                                    </div>
                                    <div>
                                      <p class="text-small mb-2">总访问量</p>
                                      <h4 class="mb-0 fw-bold">26.80%</h4>
                                    </div>
                                  </div>
                                </div>
                                <div class="col-sm-6">
                                  <div
                                    class="d-flex justify-content-between align-items-center"
                                  >
                                    <div class="circle-progress-width">
                                      <div
                                        id="visitperday"
                                        class="progressbar-js-circle pr-2"
                                      ></div>
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
                  <div class="row">
                    <div class="col-lg-8 d-flex flex-column"></div>
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
      message: "test-Hello from the dashboard component!",
    };
  },
  methods: {
    /**
     * 初始化仪表盘上所有的图表和插件。
     * 这个方法应该在组件的 mounted 钩子中被调用。
     */
    initDashboardPlugins() {
      // 使用 jQuery 的 $ 函数来替代原始代码中的 (function($) { ... })(jQuery);
      const $ = jQuery;

      // 1. 初始化 "审批工作量折线表" (performaneLine)
      // ----------------------------------------------------
      if ($("#performaneLine").length) {
        const ctx = document.getElementById("performaneLine").getContext("2d");
        const saleGradientBg = ctx.createLinearGradient(5, 0, 5, 100);
        saleGradientBg.addColorStop(0, "rgba(26, 115, 232, 0.18)");
        saleGradientBg.addColorStop(1, "rgba(26, 115, 232, 0.02)");
        const saleGradientBg2 = ctx.createLinearGradient(100, 0, 50, 150);
        saleGradientBg2.addColorStop(0, "rgba(0, 208, 255, 0.19)");
        saleGradientBg2.addColorStop(1, "rgba(0, 208, 255, 0.03)");

        const salesTopData = {
          labels: [
            "星期日",
            "星期一",
            "星期二",
            "星期三",
            "星期四",
            "星期五",
            "星期六",
          ],
          datasets: [
            {
              label: "这周",
              data: [50, 110, 60, 290, 200, 115, 130],
              backgroundColor: saleGradientBg,
              borderColor: "#1F3BB3",
              borderWidth: 1.5,
              fill: true,
              pointRadius: 4,
              pointBackgroundColor: "#1F3BB3",
              pointBorderColor: "#fff",
            },
            {
              label: "上周", // 修改了标签以符合逻辑
              data: [30, 150, 190, 250, 120, 150, 130],
              backgroundColor: saleGradientBg2,
              borderColor: "#52CDFF",
              borderWidth: 1.5,
              fill: true,
              pointRadius: 4,
              pointBackgroundColor: "#52CDFF",
              pointBorderColor: "#fff",
            },
          ],
        };

        const salesTopOptions = {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            yAxes: [
              {
                gridLines: { color: "#F0F0F0", zeroLineColor: "#F0F0F0" },
                ticks: { fontSize: 10, color: "#6B778C" },
              },
            ],
            xAxes: [
              {
                gridLines: { display: false },
                ticks: { fontSize: 10, color: "#6B778C" },
              },
            ],
          },
          legend: false,
          legendCallback: function (chart) {
            let text = ['<div class="chartjs-legend"><ul>'];
            chart.data.datasets.forEach(function (dataset) {
              text.push(
                '<li><span style="background-color:' +
                  dataset.borderColor +
                  '"></span>' +
                  dataset.label +
                  "</li>"
              );
            });
            text.push("</ul></div>");
            return text.join("");
          },
          elements: { line: { tension: 0.4 } },
          tooltips: { backgroundColor: "rgba(31, 59, 179, 1)" },
        };

        const salesTop = new Chart(ctx, {
          type: "line",
          data: salesTopData,
          options: salesTopOptions,
        });
        document.getElementById("performance-line-legend").innerHTML =
          salesTop.generateLegend();
      }

      // 2. 初始化 "Status Summary" 小图 (status-summary)
      // ----------------------------------------------------
      if ($("#status-summary").length) {
        const statusCtx = document
          .getElementById("status-summary")
          .getContext("2d");
        const statusData = {
          labels: ["SUN", "MON", "TUE", "WED", "THU", "FRI"],
          datasets: [
            {
              label: "状态",
              data: [50, 68, 70, 10, 12, 80],
              backgroundColor: "#ffcc00",
              borderColor: "#01B6A0",
              borderWidth: 2,
              fill: false,
              pointRadius: 0,
            },
          ],
        };
        const statusOptions = {
          responsive: true,
          maintainAspectRatio: false,
          scales: { yAxes: [{ display: false }], xAxes: [{ display: false }] },
          legend: false,
          elements: { line: { tension: 0.4 } },
          tooltips: { backgroundColor: "rgba(31, 59, 179, 1)" },
        };
        new Chart(statusCtx, {
          type: "line",
          data: statusData,
          options: statusOptions,
        });
      }

      // 3. 初始化 "总访问量" 圆形进度条 (totalVisitors)
      // ----------------------------------------------------
      if ($("#totalVisitors").length) {
        // 注意：原始代码中的 totalVisitors 是一个裸变量，这里我们用选择器 #totalVisitors
        const bar1 = new ProgressBar.Circle("#totalVisitors", {
          color: "#fff",
          strokeWidth: 15,
          trailWidth: 15,
          easing: "easeInOut",
          duration: 1400,
          text: { autoStyleContainer: false },
          from: { color: "#52CDFF", width: 15 },
          to: { color: "#677ae4", width: 15 },
          step: function (state, circle) {
            circle.path.setAttribute("stroke", state.color);
            circle.path.setAttribute("stroke-width", state.width);
            const value = Math.round(circle.value() * 100);
            circle.setText(value === 0 ? "" : value);
          },
        });
        bar1.text.style.fontSize = "0rem";
        bar1.animate(0.64);
      }

      // 4. 初始化 "每日访问" 圆形进度条 (visitperday)
      // ----------------------------------------------------
      if ($("#visitperday").length) {
        // 注意：原始代码中的 visitperday 是一个裸变量，这里我们用选择器 #visitperday
        const bar2 = new ProgressBar.Circle("#visitperday", {
          color: "#fff",
          strokeWidth: 15,
          trailWidth: 15,
          easing: "easeInOut",
          duration: 1400,
          text: { autoStyleContainer: false },
          from: { color: "#34B1AA", width: 15 },
          to: { color: "#677ae4", width: 15 },
          step: function (state, circle) {
            circle.path.setAttribute("stroke", state.color);
            circle.path.setAttribute("stroke-width", state.width);
            const value = Math.round(circle.value() * 100);
            circle.setText(value === 0 ? "" : value);
          },
        });
        bar2.text.style.fontSize = "0rem";
        bar2.animate(0.34);
      }
    },
  },

  mounted() {
    console.log("Dashboard Panel 组件已挂载，开始初始化所有插件...");
    this.$nextTick(() => {
      this.initDashboardPlugins();
    });
  },
});
