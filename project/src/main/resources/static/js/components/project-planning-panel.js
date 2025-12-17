// public/js/components/project-planning-panel.js

Vue.component("project-planning-panel", {
  // 【核心修正1】: 将 props 的名字从 recordId 改为 projectId
  props: {
    projectId: {
      type: [String, Number],
      required: true,
    },
    // 接收用户信息以判断权限
    currentUser: {
      type: Object,
      default: () => ({}),
    },
  },
  template: `
        <div class="content-wrapper" style="width:100%;height:100%">

            <div class="card mb-4">
                <div class="card-body">
                    <div v-if="isLoading" class="text-center p-3">
                        <p>正在加载项目信息...</p>
                        <el-progress :percentage="100" status="success" :indeterminate="true" :duration="1"></el-progress>
                    </div>
                    <div v-else-if="loadError" class="alert alert-danger">{{ loadError }}</div>
                    <div v-else-if="projectInfo">
                        <el-descriptions title="项目基本信息" :column="2" border>
                            <el-descriptions-item label="项目名称">
                                {{ projectInfo.productName || projectInfo.projectNumber || '未命名项目' }}
                            </el-descriptions-item>
                            <el-descriptions-item label="项目编号/ID">
                                <span style="font-weight: bold; color: #409EFF;">{{ projectInfo.id }}</span>
                            </el-descriptions-item>
                        </el-descriptions>
                    </div>
                </div>
            </div>

            <div class="card" style="height: 80%; display: flex; flex-direction: column;">
                <div class="card-header bg-white pb-0">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <div class="d-flex align-items-center">
                            <div class="bg-primary-light text-primary rounded d-flex align-items-center justify-content-center mr-3" 
                                 style="width: 40px; height: 40px; background-color: #ecf5ff; border-radius: 8px;">
                                <i class="el-icon-reading" style="font-size: 20px; color: #409EFF;"></i>
                            </div>
                            
                            <div>
                                <h5 class="mb-0 font-weight-bold" style="color: #303133; font-size: 16px; line-height: 1.2;">
                                    设计策划书预览
                                </h5>
                                <div class="text-muted mt-1" style="font-size: 12px;">
                                    <i class="el-icon-mouse"></i> 点击下方标签切换 Sheet 文件
                                </div>
                            </div>
                        </div>
                        
                        <div class="d-flex" style="gap: 10px;">
                            <el-upload
                                v-if="canEdit"
                                action="#" 
                                multiple
                                :http-request="handleFileUpload"
                                :show-file-list="false"
                                :before-upload="beforeUpload">
                                <el-button type="primary" size="small" icon="el-icon-upload">上传</el-button>
                            </el-upload>

                            <el-button 
                                v-if="canEdit && mainFile" 
                                type="warning" 
                                size="small" 
                                icon="el-icon-scissors" 
                                @click="handleSplitFile(mainFile)">
                                智能分割
                            </el-button>
                            
                            <el-button size="small" icon="el-icon-refresh" circle @click="fetchData"></el-button>
                        </div>
                    </div>

                    <el-tabs class="custom-tabs" v-model="activeFileId" @tab-click="handleTabClick">
                        <el-tab-pane 
                            v-for="file in planningDocuments" 
                            :key="file.id.toString()" 
                            :name="file.id.toString()">
                            <span slot="label">
                                <i v-if="file.documentType.startsWith('PLANNING_DOCUMENT')" class="el-icon-s-grid text-primary"></i>
                                <i v-else class="el-icon-document text-warning"></i>
                                {{ file.fileName }}
                                <i v-if="canEdit" class="el-icon-close text-danger ml-2" @click.stop="deleteFile(file)"></i>
                            </span>
                        </el-tab-pane>
                    </el-tabs>
                </div>

                <div class="card-body p-0" style="flex-grow: 1; position: relative;">
                    
                    <div v-if="showLargeFileConfirm" class="d-flex justify-content-center align-items-center h-100 bg-light" style="flex-direction: column; z-index: 20; position: absolute; width: 100%;">
                        <i class="el-icon-warning text-warning mb-3" style="font-size: 48px;"></i>
                        <h4 class="mb-2">该文件较大 (>20MB)</h4>
                        <p class="text-muted mb-4">直接预览可能会导致浏览器卡顿，建议先分割或下载。</p>
                        
                        <div class="d-flex" style="gap: 15px;">
                            <el-button 
                                type="warning" 
                                icon="el-icon-scissors" 
                                @click="handleSplitFile(planningDocuments.find(f => f.id.toString() === activeFileId))">
                                立即智能分割
                            </el-button>
                            
                            <el-button 
                                type="primary" 
                                plain 
                                icon="el-icon-view" 
                                @click="forceLoadCurrentFile">
                                强制预览
                            </el-button>
                        </div>
                    </div>

                    <iframe 
                        v-show="!showLargeFileConfirm && planningDocuments.length > 0"
                        ref="previewIframe"
                        src="/luckysheet-iframe-loader.html"
                        @load="onIframeLoad"
                        style="width: 100%; height: 100%; border: none;">
                    </iframe>
                    
                    <div v-if="!showLargeFileConfirm && planningDocuments.length === 0" class="d-flex justify-content-center align-items-center h-100">
                        <p class="text-muted">暂无文件，请上传</p>
                    </div>
                </div>
            </div>

            <el-dialog
                title="智能分割中"
                :visible.sync="showProgressDialog"
                width="400px"
                :close-on-click-modal="false"
                :show-close="false"
                center
                append-to-body>
                <div class="text-center">
                    
                    <p class="mb-3 text-muted" style="min-height: 24px;">
                        <span v-if="splitProgress === 0">
                            <i class="el-icon-loading"></i> 正在后台启动 Excel 引擎...
                        </span>
                        <span v-else>
                            <i class="el-icon-cpu"></i> 正在处理 Sheet，请稍候...
                        </span>
                    </p>

                    <el-progress 
                        type="circle" 
                        :percentage="splitProgress" 
                        :status="progressStatus">
                    </el-progress>
                    
                    <p class="mt-3 text-primary font-weight-bold" v-if="splitProgress < 100">
                        已处理 {{ splitProgress }}%
                    </p>
                </div>
            </el-dialog>
            
        </div>


        <style>
                .preview-dialog .el-dialog__body { padding: 0; }
                .preview-dialog .el-dialog__header { padding: 15px 20px; border-bottom: 1px solid #eee; }

                /* 【新增】自定义滚动条样式 */
                .custom-tabs .el-tabs__nav-scroll {
                    overflow-x: auto !important; /* 强制显示横向滚动 */
                    padding-bottom: 5px; /* 给滚动条留点位置 */
                }
                
                /* 滚动条整体 */
                .custom-tabs .el-tabs__nav-scroll::-webkit-scrollbar {
                    height: 8px; /* 高度 */
                    background-color: #f5f5f5;
                }

                /* 滚动条滑块 */
                .custom-tabs .el-tabs__nav-scroll::-webkit-scrollbar-thumb {
                    background-color: #dcdfe6; /* 浅灰色 */
                    border-radius: 4px;
                }

                /* 滑块悬停 */
                .custom-tabs .el-tabs__nav-scroll::-webkit-scrollbar-thumb:hover {
                    background-color: #c0c4cc; /* 深灰色 */
                }
            </style>
    `,

  data() {
    return {
      isLoading: false,
      projectInfo: null,
      fileList: [], // 所有文件
      loadError: null,

      // 预览状态
      isPreviewing: false,
      isLoadingSheet: false,
      previewingFileName: "",
      currentPreviewFile: null,

      // 分割状态
      isSplitting: false,
      showProgressDialog: false,
      splitProgress: 0,
      progressStatus: null,

      activeFileId: "", // 当前选中的 Tab ID
      isLoadingSheet: false, // 预览区域的加载状态
      showLargeFileConfirm: false,
    };
  },

  computed: {
    // 【核心修改】排序逻辑升级：提取开头的数字进行自然排序
    planningDocuments() {
      if (!this.fileList) return [];

      const docs = this.fileList.filter(
        (f) =>
          f.documentType &&
          (f.documentType.startsWith("PLANNING_DOCUMENT") ||
            f.documentType === "SPLIT_CHILD_SHEET")
      );

      docs.sort((a, b) => {
        // 1. 类型优先级：主文件(PLANNING_DOCUMENT)永远排第一
        const typeA = a.documentType.startsWith("PLANNING_DOCUMENT") ? 0 : 1;
        const typeB = b.documentType.startsWith("PLANNING_DOCUMENT") ? 0 : 1;
        if (typeA !== typeB) return typeA - typeB;

        // 2. 提取文件名前面的数字 (例如 "10-贴字.xlsx" -> 10)
        const getNum = (name) => {
          const match = name.match(/^(\d+)/);
          return match ? parseInt(match[1]) : Number.MAX_SAFE_INTEGER; // 没有数字的排最后
        };

        const numA = getNum(a.fileName);
        const numB = getNum(b.fileName);

        if (numA !== numB) {
          return numA - numB; // 按数字大小升序
        }

        // 3. 如果数字一样（或都没数字），按字符串自然顺序兜底
        return a.fileName.localeCompare(b.fileName, "zh-CN", { numeric: true });
      });

      return docs;
    },

    // 【新增】获取主文件对象（方便调用分割功能）
    mainFile() {
      return this.planningDocuments.find((f) =>
        f.documentType.startsWith("PLANNING_DOCUMENT")
      );
    },
    // 权限判断
    canEdit() {
      if (!this.currentUser || !this.currentUser.identity) return false;
      const role = this.currentUser.identity.toUpperCase();
      return role === "MANAGER" || role === "ADMIN";
    },
  },
  // --- 【新增】生命周期：挂载后添加滚轮监听 ---
  mounted() {
    this.$nextTick(() => {
      this.initTabScroll();
    });
  },

  updated() {
    // 数据变化导致 Tab 重新渲染时，重新绑定
    this.initTabScroll();
  },
  methods: {
    // --- 核心数据获取逻辑 ---
    fetchData() {
      if (!this.projectId) return;
      this.isLoading = true;
      Promise.all([
        axios.get(`/api/projects/${this.projectId}`),
        axios.get(`/api/projects/${this.projectId}/files`),
      ])
        .then(([pRes, fRes]) => {
          this.projectInfo = pRes.data;
          this.fileList = fRes.data;
          this.detectFileSizes();

          // 【新增】默认选中第一个文件
          if (
            (!this.activeFileId || this.activeFileId === "") &&
            this.planningDocuments.length > 0
          ) {
            this.activeFileId = this.planningDocuments[0].id.toString();
            this.$nextTick(() => this.loadActiveFile());
          }
        })
        .catch((e) => {
          this.loadError = "加载失败";
        })
        .finally(() => {
          this.isLoading = false;
        });
    },

    // --- 纯前端探测文件大小的方法 ---
    detectFileSizes() {
      this.planningDocuments.forEach((file) => {
        // 如果后端没返回 fileSize (为null或0)，我们手动去问一下
        if (
          file.fileSize === undefined ||
          file.fileSize === null ||
          file.fileSize === 0
        ) {
          const fileUrl = `/api/files/content/${file.id}`;
          // 发送 HEAD 请求
          axios
            .head(fileUrl)
            .then((response) => {
              const length = response.headers["content-length"];
              if (length) {
                // 使用 Vue.set 确保视图更新
                this.$set(file, "fileSize", parseInt(length));
                console.log(
                  `[FileSize] 探测到文件 ${file.fileName} 大小: ${length} bytes`
                );
              }
            })
            .catch(() => {
              // 设为 -1 表示探测失败，避免一直转圈
              this.$set(file, "fileSize", -1);
            });
        }
      });
    },

    // --- 批量上传逻辑 ---
    beforeUpload(file) {
      const isExcel = file.name.endsWith(".xls") || file.name.endsWith(".xlsx");
      if (!isExcel) this.$message.error("只能上传Excel文件!");
      return isExcel;
    },

    handleFileUpload(options) {
      const file = options.file;
      const formData = new FormData();
      formData.append("file", file);

      // 【核心修复】构造唯一的 documentType
      // 格式：PLANNING_DOCUMENT_{文件名}
      // 这样后端就会把它当成一个新的类型存储，从而实现“多文件上传”且不覆盖旧文件（除非文件名完全相同）
      const safeFileName = encodeURIComponent(file.name);
      const documentTypeKey = `PLANNING_DOCUMENT_${safeFileName}`;

      const apiUrl = `/api/projects/${this.projectId}/files/${documentTypeKey}`;

      axios
        .post(apiUrl, formData)
        .then((response) => {
          this.$message.success(`文件 ${file.name} 上传成功！`);
          // 刷新列表，触发新一轮探测
          this.fetchProjectFiles();
        })
        .catch((error) => {
          this.$message.error(`文件 ${file.name} 上传失败`);
          console.error(error);
        });
    },

    // --- 辅助：文件大小格式化与判断 ---
    formatFileSize(bytes) {
      if (bytes === -1) return "未知"; // 探测失败
      if (bytes === undefined || bytes === null) return "计算中...";
      if (bytes === 0) return "0 B";
      const k = 1024;
      const sizes = ["B", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    },

    isLargeFile(file) {
      // 兼容 fileSize 或 size 属性
      const size = file.fileSize || file.size || 0;
      return size > 20 * 1024 * 1024; // > 20MB
    },

    // --- 智能预览逻辑 (曲线救国) ---
    handlePreviewClick(file) {
      // 1. 检查文件大小
      if (this.isLargeFile(file)) {
        const sizeStr = this.formatFileSize(file.fileSize || file.size);
        this.$confirm(
          `该文件较大 (${sizeStr})，直接预览可能导致浏览器卡顿或崩溃。\n\n是否使用【自动分割】功能？\n系统将自动将其拆分为多个小文件，方便流畅查看。`,
          "大文件处理建议",
          {
            confirmButtonText: "🚀 自动分割 (推荐)",
            cancelButtonText: "强制预览 (风险)",
            type: "warning",
            distinguishCancelAndClose: true,
            center: true,
          }
        )
          .then(() => {
            // 用户选择：自动分割
            this.handleSplitFile(file);
          })
          .catch((action) => {
            if (action === "cancel") {
              // 用户选择：强制预览
              this.startPreview(file);
            }
          });
      } else {
        // 小文件直接预览
        this.startPreview(file);
      }
    },

    // --- 预览启动 ---
    startPreview(file) {
      this.currentPreviewFile = file;
      this.previewingFileName = file.fileName;
      this.isPreviewing = true;
      this.isLoadingSheet = true;

      this.$nextTick(() => {
        const iframe = this.$refs.previewIframe;
        // 如果 iframe 已经缓存/加载过，直接触发加载逻辑
        if (iframe && iframe.contentWindow) {
          setTimeout(() => this.onIframeLoad(), 200);
        }
      });
    },

    onIframeLoad() {
      if (!this.currentPreviewFile) return;
      this.isLoadingSheet = false;

      const iframe = this.$refs.previewIframe;
      if (iframe && iframe.contentWindow) {
        // 【核心】使用 Blob 模式 (不带 format=json) 加载，确保兼容性和图片显示
        const fileUrl = `/api/files/content/${
          this.currentPreviewFile.id
        }?t=${new Date().getTime()}`;

        iframe.contentWindow.postMessage(
          {
            type: "LOAD_SHEET",
            payload: {
              fileUrl,
              fileName: this.currentPreviewFile.fileName,
              options: { lang: "zh", allowUpdate: false, showtoolbar: false }, // 只读模式
            },
          },
          window.location.origin
        );
      }
    },

    // --- 导出逻辑 ---
    exportCurrentSheet() {
      const targetIframe = this.$refs.previewIframe;
      if (targetIframe && targetIframe.contentWindow) {
        targetIframe.contentWindow.postMessage(
          {
            type: "EXPORT_SHEET",
            payload: { fileName: this.previewingFileName },
          },
          window.location.origin
        );
      }
    },

    // 【核心修改】带进度条的分割逻辑
    handleSplitFile(file) {
      if (this.isSplitting) return;

      // 1. 初始化弹窗状态
      this.isSplitting = true;
      this.showProgressDialog = true;
      this.splitProgress = 0;
      this.progressStatus = null;

      // 2. 发起请求
      axios
        .post(`/api/files/${file.id}/split-by-sheet`)
        .then(() => {
          // 3. 启动轮询
          this.pollProgress(file.id);
        })
        .catch((e) => {
          console.error(e);
          this.showProgressDialog = false;
          this.isSplitting = false;
          this.$message.error(
            "启动失败：" + (e.response?.data?.message || "未知错误")
          );
        });
    },

    // 【新增】轮询进度辅助方法
    pollProgress(fileId) {
      const timer = setInterval(() => {
        axios
          .get(`/api/files/${fileId}/split-progress`)
          .then((res) => {
            const p = res.data.progress; // 获取后端 Map 里的进度
            this.splitProgress = p;

            if (p >= 100) {
              // 完成
              clearInterval(timer);
              this.progressStatus = "success";
              setTimeout(() => {
                this.$message.success("分割完成！");
                this.showProgressDialog = false;
                this.isSplitting = false;
                this.fetchProjectFiles(); // 刷新列表，新文件出现
              }, 1000);
            } else if (p === -1) {
              // 失败
              clearInterval(timer);
              this.progressStatus = "exception";
              this.$message.error("后台处理出错，请查看服务器日志");
              // 保持弹窗开启以便用户看到错误
              this.isSplitting = false;
            }
          })
          .catch(() => {
            // 网络波动不中断，继续轮询
          });
      }, 1000); // 每秒查一次
    },

    // --- 下载逻辑 ---
    downloadFile(file) {
      const link = document.createElement("a");
      link.href = `/api/files/content/${file.id}`;
      link.download = file.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },

    // --- 删除逻辑 ---
    deleteFile(file) {
      this.$confirm(`确定删除 "${file.fileName}" 吗？`, "提示", {
        type: "warning",
      })
        .then(() => {
          axios.delete(`/api/files/${file.id}`).then(() => {
            this.$message.success("删除成功");
            this.fetchProjectFiles();
            // 如果删除的是当前正在预览的文件，关闭预览
            if (
              this.isPreviewing &&
              this.previewingFileName === file.fileName
            ) {
              this.closePreview();
            }
          });
        })
        .catch(() => {});
    },

    // --- 辅助 ---
    fetchProjectFiles() {
      console.log(`[Debug] 正在请求项目 ${this.projectId} 的文件列表...`);
      return axios
        .get(`/api/projects/${this.projectId}/files`)
        .then((res) => {
          const data = res.data;
          console.log(`[Debug] API 响应成功，获取到 ${data.length} 条记录`);

          // 简单的完整性检查
          const splitFiles = data.filter(
            (f) => f.documentType === "SPLIT_CHILD_SHEET"
          );
          if (splitFiles.length > 0) {
            console.log(
              "[Debug] API返回数据中包含子文件，ParentID 检查:",
              splitFiles.map((f) => ({ id: f.id, pid: f.parentId }))
            );
          } else {
            console.warn(
              "[Debug] ⚠️ API返回数据中没有找到任何 SPLIT_CHILD_SHEET 类型的文件！可能是后端入库没成功？"
            );
          }

          this.fileList = data;
          // 每次刷新列表都重新探测一下
          this.detectFileSizes();
        })
        .catch((e) => {
          console.error("[Error] 获取文件列表失败", e);
        });
    },
    formatDate(str) {
      return str ? new Date(str).toLocaleString() : "-";
    },
    closePreview() {
      this.isPreviewing = false;
      this.previewingFileName = "";
      this.currentPreviewFile = null;
    },
    // --- 【新增】标签页切换逻辑 ---
    handleTabClick(tab) {
      const file = this.planningDocuments.find(
        (f) => f.id.toString() === this.activeFileId
      );
      if (!file) return;

      // 判断大小 (> 20MB)
      const size = file.fileSize || file.size || 0;
      if (size > 20 * 1024 * 1024) {
        this.showLargeFileConfirm = true; // 显示拦截层
        this.isLoadingSheet = false; // 停止加载 loading
        // 注意：这里不要 postMessage，iframe 保持空白或显示拦截层
      } else {
        this.showLargeFileConfirm = false;
        this.loadActiveFile(); // 正常加载
      }
    },

    // 加载当前选中的文件到 iframe
    loadActiveFile() {
      if (!this.activeFileId) return;
      const file = this.planningDocuments.find(
        (f) => f.id.toString() === this.activeFileId
      );
      if (!file) return;

      this.isLoadingSheet = true;
      const iframe = this.$refs.previewIframe;

      // 如果 iframe 已就绪，直接发消息；否则等待 onload
      if (iframe && iframe.contentWindow) {
        this.postMessageToIframe(file);
      }
    },

    // iframe 加载完毕的回调
    onIframeLoad() {
      const file = this.planningDocuments.find(
        (f) => f.id.toString() === this.activeFileId
      );
      if (file) this.postMessageToIframe(file);
    },
    // 【新增】用户点击“强制预览”
    forceLoadCurrentFile() {
      this.showLargeFileConfirm = false;
      this.loadActiveFile();
    },
    // 发送数据给 Luckysheet
    postMessageToIframe(file) {
      const fileUrl = `/api/files/content/${file.id}?t=${new Date().getTime()}`;
      const iframe = this.$refs.previewIframe;

      iframe.contentWindow.postMessage(
        {
          type: "LOAD_SHEET",
          payload: {
            fileUrl: fileUrl,
            fileName: file.fileName,
            options: {
              lang: "zh",
              allowUpdate: false,
              showtoolbar: false,
              showsheetbar: false,
            },
          },
        },
        window.location.origin
      );

      setTimeout(() => {
        this.isLoadingSheet = false;
      }, 500);
    },
  },

  watch: {
    projectId: {
      immediate: true,
      handler(newVal) {
        if (newVal) this.fetchData();
      },
    },
  },
});
