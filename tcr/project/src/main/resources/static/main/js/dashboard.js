(function($) {
  'use strict';
  $(function() {
    // 暗黑模式的折线图初始化 
    if ($("#performaneLine-dark").length) {
      var graphGradient = document.getElementById("performaneLine-dark").getContext('2d');
      var graphGradient2 = document.getElementById("performaneLine-dark").getContext('2d');
      var saleGradientBg = graphGradient.createLinearGradient(5, 0, 5, 100);
      saleGradientBg.addColorStop(0, 'rgba(26, 115, 232, 0.18)');
      saleGradientBg.addColorStop(1, 'rgba(34, 36, 55, 0.5)');
      var saleGradientBg2 = graphGradient2.createLinearGradient(10, 0, 0, 150);
      saleGradientBg2.addColorStop(0, 'rgba(0, 208, 255, 0.19)');
      saleGradientBg2.addColorStop(1, 'rgba(34, 36, 55, 0.2)');
      var salesTopDataDark = { /* ... data ... */ };
      var salesTopOptionsDark = { /* ... options ... */ };
      var salesTopDark = new Chart(graphGradient, {
          type: 'line',
          data: salesTopDataDark,
          options: salesTopOptionsDark
      });
      document.getElementById('performance-line-legend-dark').innerHTML = salesTopDark.generateLegend();
    }
    
    // 日期选择器初始化 (保留)
    if ($("#datepicker-popup").length) {
      $('#datepicker-popup').datepicker({
        enableOnReadonly: true,
        todayHighlight: true,
      });
      $("#datepicker-popup").datepicker("setDate", "0");
    }

    // 营销概览图初始化 (保留)
    if ($("#marketingOverview").length) {
      var marketingOverviewChart = document.getElementById("marketingOverview").getContext('2d');
      var marketingOverviewData = { /* ... data ... */ };
      var marketingOverviewOptions = { /* ... options ... */ };
      var marketingOverview = new Chart(marketingOverviewChart, {
          type: 'bar',
          data: marketingOverviewData,
          options: marketingOverviewOptions
      });
      document.getElementById('marketing-overview-legend').innerHTML = marketingOverview.generateLegend();
    }

    // 暗黑模式的营销概览图初始化 (保留)
    if ($("#marketingOverview-dark").length) {
      var marketingOverviewChartDark = document.getElementById("marketingOverview-dark").getContext('2d');
      var marketingOverviewDataDark = { /* ... data ... */ };
      var marketingOverviewOptionsDark = { /* ... options ... */ };
      var marketingOverviewDark = new Chart(marketingOverviewChartDark, {
          type: 'bar',
          data: marketingOverviewDataDark,
          options: marketingOverviewOptionsDark
      });
      document.getElementById('marketing-overview-legend').innerHTML = marketingOverviewDark.generateLegend();
    }
    
    // 甜甜圈图初始化 (保留)
    if ($("#doughnutChart").length) {
      var doughnutChartCanvas = $("#doughnutChart").get(0).getContext("2d");
      var doughnutPieData = { /* ... data ... */ };
      var doughnutPieOptions = { /* ... options ... */ };
      var doughnutChart = new Chart(doughnutChartCanvas, {
        type: 'doughnut',
        data: doughnutPieData,
        options: doughnutPieOptions
      });
      document.getElementById('doughnut-chart-legend').innerHTML = doughnutChart.generateLegend();
    }

    // 离职报告图初始化 (保留)
    if ($("#leaveReport").length) {
      var leaveReportChart = document.getElementById("leaveReport").getContext('2d');
      var leaveReportData = { /* ... data ... */ };
      var leaveReportOptions = { /* ... options ... */ };
      var leaveReport = new Chart(leaveReportChart, {
          type: 'bar',
          data: leaveReportData,
          options: leaveReportOptions
      });
    }
    
    // 暗黑模式的离职报告图初始化 (保留)
    if ($("#leaveReport-dark").length) {
      var leaveReportChartDark = document.getElementById("leaveReport-dark").getContext('2d');
      var leaveReportDataDark = { /* ... data ... */ };
      var leaveReportOptionsDark = { /* ... options ... */ };
      var leaveReportDark = new Chart(leaveReportChartDark, {
          type: 'bar',
          data: leaveReportDataDark,
          options: leaveReportOptionsDark
      });
    }
  
  });
})(jQuery);