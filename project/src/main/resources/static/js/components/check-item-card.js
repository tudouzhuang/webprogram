Vue.component('check-item-card', {
    template: `
    <div class="content-wrapper" style="width:100%;height:100%">
        <el-card class="box-card check-item-card" :class="'status-' + item.status.toLowerCase()" shadow="hover">
            <div slot="header" class="clearfix card-header">
                <span class="item-description">{{ item.itemDescription }}</span>
                <el-tag size="small" :type="statusType" class="status-tag" effect="dark">{{ statusText }}</el-tag>
            </div>
            
            <div class="card-body">
                <!-- 状态切换区: 使用更紧凑的图标按钮，增加视觉吸引力 -->
                <div class="action-group">
                    <label class="action-label">设置状态:</label>
                    <el-radio-group :value="item.status" @input="updateStatus" size="medium">
                        <el-tooltip content="合格" placement="top"><el-radio-button label="OK"><i class="el-icon-check"></i> OK</el-radio-button></el-tooltip>
                        <el-tooltip content="不合格" placement="top"><el-radio-button label="NG"><i class="el-icon-close"></i> NG</el-radio-button></el-tooltip>
                        <el-tooltip content="不适用" placement="top"><el-radio-button label="NA"><i class="el-icon-minus"></i> N/A</el-radio-button></el-tooltip>
                    </el-radio-group>
                </div>

                <!-- 备注区 -->
                <div class="action-group">
                    <label class="action-label">{{ remarkLabel }}:</label>
                    <el-input
                        class="remarks-input"
                        type="textarea"
                        :autosize="{ minRows: 2, maxRows: 4}"
                        :placeholder="remarkPlaceholder"
                        :value="currentRemark"
                        @input="updateRemark"
                        @blur="saveChanges">
                    </el-input>
                </div>

                <!-- 截图区: 优化布局和上传体验 -->
                <div class="action-group screenshot-area">
                    <label class="action-label">问题截图:</label>
                    <div class="screenshot-content">
                        <el-upload
                            class="screenshot-uploader"
                            action="#" 
                            :http-request="uploadScreenshot"
                            :show-file-list="false"
                            :before-upload="beforeUpload">
                            <el-image 
                                v-if="item.screenshotPath" 
                                :src="item.screenshotPath" 
                                fit="cover"
                                :preview-src-list="[item.screenshotPath]"
                                class="screenshot-thumbnail uploaded">
                            </el-image>
                            <div v-else class="screenshot-thumbnail uploader-icon">
                                <i class="el-icon-plus"></i>
                                <span>点击上传</span>
                            </div>
                        </el-upload>
                    </div>
                </div>
            </div>

            <div class="card-footer">
                <small v-if="item.checkedByUsername">
                    <i class="el-icon-user"></i> {{ item.checkedByUsername }} 
                    <i class="el-icon-time" style="margin-left: 8px;"></i> {{ formatTime(item.checkedAt) }}
                </small>
                <small v-else>
                    暂无操作记录
                </small>
            </div>
        </el-card>
    <div>
    `,
    props: ['itemData', 'currentUser'],
    data() {
        return {
            item: JSON.parse(JSON.stringify(this.itemData))
        };
    },
    computed: {
        isReviewer() {
            return this.currentUser && ['MANAGER', 'REVIEWER'].includes(this.currentUser.identity);
        },
        remarkLabel() {
            return this.isReviewer ? '审核备注' : '设计备注';
        },
        remarkPlaceholder() {
            return `请输入${this.remarkLabel}...`;
        },
        currentRemark() {
            return this.isReviewer ? this.item.reviewerRemarks : this.item.designerRemarks;
        },
        statusText() {
            const map = { OK: '合格', NG: '不合格', NA: '不适用', PENDING: '待处理' };
            return map[this.item.status] || '未知';
        },
        statusType() {
            const map = { OK: 'success', NG: 'danger', NA: 'info', PENDING: 'warning' };
            return map[this.item.status] || '';
        }
    },
    methods: {
        updateStatus(newStatus) {
            this.item.status = newStatus;
            this.saveChanges();
        },
        updateRemark(newRemark) {
            if (this.isReviewer) {
                this.item.reviewerRemarks = newRemark;
            } else {
                this.item.designerRemarks = newRemark;
            }
        },
        saveChanges() {
            if (JSON.stringify(this.item) !== JSON.stringify(this.itemData)) {
                this.$emit('update', this.item);
            }
        },
        async uploadScreenshot(options) {
            const formData = new FormData();
            formData.append('file', options.file);
            try {
                const response = await axios.post(`/api/items/${this.item.id}/screenshot`, formData);
                this.item.screenshotPath = response.data;
                this.saveChanges();
                this.$message.success('截图上传成功！');
            } catch (error) {
                this.$message.error('截图上传失败！');
                console.error(error);
            }
        },
        beforeUpload(file) {
            const isImage = file.type.startsWith('image/');
            const isLt5M = file.size / 1024 / 1024 < 5;
            if (!isImage) {
                this.$message.error('只能上传图片格式文件!');
            }
            if (!isLt5M) {
                this.$message.error('上传图片大小不能超过 5MB!');
            }
            return isImage && isLt5M;
        },
        formatTime(timeStr) {
            if (!timeStr) return '';
            try {
                return new Date(timeStr).toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-');
            } catch (e) {
                return timeStr;
            }
        }
    },
    watch: {
        itemData: {
            handler(newData) {
                this.item = JSON.parse(JSON.stringify(newData));
            },
            deep: true
        }
    }
});