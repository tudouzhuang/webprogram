# 项目上下文大纲 (PROJECT_CONTEXT.md)

## 1. 核心技术栈
- **后端**: Spring Boot (MyBatis Plus, Spring Security, JJWT)
- **前端**: Vue 2 (原生引用), Element UI, Luckysheet/LuckyExcel
- **交互协议**: Axios (含全局响应解包拦截器)

## 2. 项目目录结构 (AI 检索依据)
- `src/main/java/org/example/project/`
    - `common/`: ApiResult (统一响应), SecurityUtils (用户上下文)
    - `config/`: SecurityConfig (JWT配置), WebConfig (拦截器)
    - `filter/`: JwtAuthenticationFilter (认证逻辑)
    - `exception/`: GlobalExceptionHandler (全局异常处理)
- `src/main/resources/static/`
    - `js/components/`: 所有的 Vue 组件 (*-panel.js)
    - `js/utils/`: statusConfig.js (状态映射), permissions.js (权限), sheetReaderMixin.js (表格功能)
    - `luckysheet/`: 底层渲染引擎

## 3. 架构规范与核心模式
- **响应包装**: 所有 Controller 必须返回 `ApiResult<T>`。前端拦截器会自动处理 `response.data.data`。
- **用户鉴权**: 禁止直接操作 `SecurityContextHolder`，统一使用 `SecurityUtils` 获取 `currentUser`。
- **状态管理**: 所有的状态枚举（如 DRAFT, APPROVED）请通过 `window.STATUS_CONFIG` 获取。
- **权限控制**: 角色判断严禁硬编码字符串，统一使用 `window.PERMISSIONS` 下的方法（如 `isAdminOrManager(user)`）。

## 4. 关键业务协议 (跨组件通信)
- **Luckysheet 渲染**: 组件与 Iframe 通过 `postMessage` 通信。
    - 主动事件: `LOAD_SHEET`, `GET_DATA_AND_IMAGES`, `EXPORT_SHEET`
    - 响应事件: `LUCKYSHEET_RENDER_FINISHED`, `SHEET_DATA_WITH_IMAGES_RESPONSE`

## 5. 调试与防御性开发守则
- **日志规范**: 使用 `@Slf4j`，严禁 `System.out.println`。
- **Excel 防御**: 
    - 解析前：必须对 `sheet.drawing` 进行清洗（`delete sheet.drawing`）。
    - 解析中：必须在 `imageObject` 赋值前添加 `if (imageObject != null)` 判断。
    - 报错处理：优先在前端 Iframe Loader 的 `unhandledrejection` 中进行熔断，防止白屏。
- **数据库**: 测试用户密码统一为 `123456` (BCrypt Hash: `$2a$12$HrkUj...`)。

## 6. 当前开发重点
- 持续清理代码中的 `console.log` 和重复逻辑。
- 确保所有删除操作统一通过拦截器处理错误。
- 修复 Excel 的复杂图形/矢量图引发的渲染崩溃。