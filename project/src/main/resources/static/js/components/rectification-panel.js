// public/js/components/rectification-panel.js
Vue.component('rectification-panel', {
    template: `
        <div class="content-wrapper">
            <div class="page-header">
                <h3 class="page-title">
                    <span class="page-title-icon bg-gradient-danger text-white me-2">
                        <i class="mdi mdi-wrench"></i>
                    </span>
                    工艺整改
                </h3>
            </div>
            <div class="row">
                <div class="col-12 grid-margin stretch-card">
                    <div class="card">
                        <div class="card-body text-center p-5">
                            <i class="mdi mdi-cogs" style="font-size: 4rem; color: #ccc;"></i>
                            <h4 class="mt-3">功能开发中...</h4>
                            <p class="text-muted">工艺整改相关功能正在紧张开发中，敬请期待！</p>
                             <el-button @click="$emit('back-to-list')" type="primary" plain>返回</el-button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `
});