Vue.component('screenshot-manager-dialog', {
    template: `
        <el-dialog
            :visible.sync="dialogVisible"
            :title="'管理 “' + problemDescription + '” 的截图'"
            width="60%"
            @close="closeDialog"
            append-to-body>

            <div class="screenshot-manager-body" @paste="handlePaste">
                <el-alert
                    title="操作提示"
                    type="info"
                    show-icon
                    :closable="false"
                    description="您可以点击上传按钮，或直接将图片文件拖拽到此区域，也可以直接在本窗口使用 Ctrl+V 粘贴剪贴板中的截图。"
                    class="mb-3">
                </el-alert>

                <el-upload
                    class="screenshot-uploader"
                    drag
                    multiple
                    action="#"
                    :http-request="handleUpload"
                    :show-file-list="false"
                    :before-upload="beforeUpload">
                    <i class="el-icon-upload"></i>
                    <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
                </el-upload>
                
                <el-divider>已上传的截图 ({{ screenshots.length }})</el-divider>

                <div v-if="isLoading" class="text-center p-4"><i class="el-icon-loading"></i> 正在加载截图...</div>
                
                <div class="screenshot-list" v-else-if="screenshots.length > 0">
                    <div v-for="screenshot in screenshots" :key="screenshot.id" class="screenshot-item">
                        <el-image 
                            :src="screenshot.filePath" 
                            fit="cover" 
                            :preview-src-list="previewList"
                            class="screenshot-thumbnail">
                        </el-image>
                        <div class="screenshot-actions">
                            <el-button type="danger" icon="el-icon-delete" circle size="mini" @click="deleteScreenshot(screenshot)"></el-button>
                        </div>
                    </div>
                </div>

                <div v-else class="no-screenshots-placeholder">
                    暂无截图
                </div>
            </div>

            <span slot="footer" class="dialog-footer">
                <el-button @click="closeDialog">关 闭</el-button>
            </span>
        </el-dialog>
    `,
    props: {
        visible: {
            type: Boolean,
            default: false
        },
        problemId: {
            type: Number,
            default: null
        },
        problemDescription: {
            type: String,
            default: '问题'
        }
    },
    data() {
        return {
            screenshots: [],
            isLoading: false
        };
    },
    computed: {
        dialogVisible: {
            get() {
                return this.visible;
            },
            set(val) {
                this.$emit('update:visible', val);
            }
        },
        previewList() {
            return this.screenshots.map(s => s.filePath);
        }
    },
    methods: {
        async fetchScreenshots() {
            if (!this.problemId) return;
            this.isLoading = true;
            try {
                // 【后端API需求1】获取某个问题的所有截图
                const response = await axios.get(`/api/problems/${this.problemId}/screenshots`);
                this.screenshots = response.data;
            } catch (error) {
                this.$message.error('加载截图列表失败！');
            } finally {
                this.isLoading = false;
            }
        },
        handlePaste(event) {
            const items = (event.clipboardData || window.clipboardData).items;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    this.uploadFile(blob);
                    event.preventDefault(); // 阻止默认的粘贴行为
                    return;
                }
            }
        },
        handleUpload(options) {
            this.uploadFile(options.file);
        },
        async uploadFile(file) {
            const formData = new FormData();
            formData.append('file', file);
            try {
                // 【后端API需求2】为某个问题上传一张截图
                const response = await axios.post(`/api/problems/${this.problemId}/screenshots`, formData);
                this.screenshots.unshift(response.data); // 将新截图添加到列表顶部
                this.$message.success('上传成功！');
            } catch (error) {
                this.$message.error('上传失败！');
            }
        },
        async deleteScreenshot(screenshot) {
            try {
                await this.$confirm('确定要删除这张截图吗?', '提示', { type: 'warning' });
                // 【后端API需求3】删除某一张截图
                await axios.delete(`/api/screenshots/${screenshot.id}`);
                const index = this.screenshots.findIndex(s => s.id === screenshot.id);
                if (index !== -1) this.screenshots.splice(index, 1);
                this.$message.success('删除成功！');
            } catch (error) {
                if (error !== 'cancel') {
                    this.$message.error('删除失败！');
                }
            }
        },
        beforeUpload(file) {
            const isImage = file.type.startsWith('image/');
            const isLt5M = file.size / 1024 / 1024 < 5;
            if (!isImage) this.$message.error('只能上传图片格式文件!');
            if (!isLt5M) this.$message.error('上传图片大小不能超过 5MB!');
            return isImage && isLt5M;
        },
        closeDialog() {
            this.dialogVisible = false;
        }
    },
    watch: {
        visible(newVal) {
            if (newVal) {
                this.fetchScreenshots();
            }
        }
    }
});