
Vue.component('process-sheet-viewer', {
    template: `
        <div class="content-wrapper">
            <div class="page-header">
                <h3 class="page-title">
                    <span class="page-title-icon bg-gradient-primary text-white me-2">
                        <i class="mdi mdi-clipboard-text"></i>
                    </span>
                    工艺记录表
                </h3>
            </div>
            <div class="row">
                <div class="col-12 grid-margin stretch-card">
                    <div class="card">
                        <div class="card-body text-center p-5">
                            <div style="margin-bottom: 2rem;">
                                <!-- 使用 construction 图标或 cogs 图标 -->
                                <i class="mdi mdi-worker" style="font-size: 6rem; color: #e0e0e0;"></i>
                            </div>
                            <h3 class="mt-3 text-primary">功能升级中...</h3>
                            <p class="text-muted mt-3 mb-4" style="font-size: 1.1rem;">
                                工艺记录表模块正在进行架构升级与功能优化。<br>
                                我们正在努力为您提供更好的体验，敬请期待！
                            </p>
                            <!-- 返回按钮，触发父组件切换回仪表盘或列表 -->
                            <el-button @click="$emit('back-to-list')" type="primary" icon="el-icon-back" plain round>返回首页</el-button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    mounted() {
        console.log("[Luckysheet Viewer] 建设中页面已加载");
    }
});