// js/components/project-pdf-viewer.js

Vue.component('project-pdf-viewer', {
    // 【Props】: 定义一个名为 `pdfPath` 的属性，用于从父组件接收PDF的相对路径
    props: {
        pdfPath: {
            type: String,
            required: true // 确保父组件必须传递这个值
        }
    },
    // 【Template】: 组件的HTML结构，核心是一个iframe
    template: `
        <div class="main-panel">
            <div class="content-wrapper" style="padding: 1rem;">
                <div class="card" style="height: 85vh;"> <!-- 设置一个视口高度，让PDF充满屏幕 -->
                    <div class="card-body" style="padding: 0; height: 100%; overflow: hidden;">
                        <iframe 
                            v-if="viewerUrl" 
                            :src="viewerUrl" 
                            width="100%" 
                            height="100%" 
                            frameborder="0"
                            allowfullscreen>
                            您的浏览器不支持iframe，请升级。
                        </iframe>
                        <div v-else class="d-flex justify-content-center align-items-center h-100">
                            <p>正在加载PDF预览...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    // 【Data】: 组件的内部状态
    data() {
        return {
            viewerUrl: '' // 用于存储最终要加载到iframe中的完整URL
        }
    },
    // 【Watch】: 监听器，当 pdfPath 属性发生变化时自动执行
    watch: {
        pdfPath: {
            immediate: true, // 组件一创建就立即执行一次
            handler(newPath) {
                if (newPath) {
                    // 【关键逻辑】: 拼接最终的URL
                    // 1. 获取我们真正的PDF文件的访问URL
                    const fileUrl = '/uploads/' + newPath;
                    
                    // 2. 将这个URL作为参数，传递给PDF.js的查看器页面
                    //    encodeURIComponent确保路径中的特殊字符被正确编码
                    this.viewerUrl = `/pdfjs/web/viewer.html?file=${encodeURIComponent(fileUrl)}`;
                    
                    console.log('PDF Viewer URL has been set to:', this.viewerUrl);
                } else {
                    this.viewerUrl = ''; // 如果路径为空，则清空URL
                }
            }
        }
    }
});