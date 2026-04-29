# TODO — SDD 项管平台待办与优化清单
> 最后更新：2026-04-17 by zdd    [x] [ ] 
[x] 1、TAPD数据的字段对接（需求、任务、缺陷）
[x] 2、AI解析的效果调优
[ ] 3、AI理解的效果调优
[ ] 4、蓝湖lanhu对接、数据抓取--》需要提供token，公司项目上未找到 
[ ] 5、企微文档对接、数据抓取--》需要corpid和secret，暂不支持-只能尝试cookie短期抓取
[ ] 6、开发代码的功能/平台、模块的功能总结
[ ] 7、

迭代看板
迭代看板--开发-含开发任务拆饭
迭代看板--测试-含测试任务拆分、sum_module


> 最后更新：2026-04-09

---

## 一、环境配置（启动前必做）

- [ ] 配置 MySQL 密码：修改 `backend/aim/settings.py` 中 `DATABASES['default']['PASSWORD']`
- [ ] 创建数据库：`mysql -u root -p -e "CREATE DATABASE m_platform CHARACTER SET utf8mb4;"`
- [ ] 执行数据迁移：`cd backend && python manage.py migrate`
- [ ] 创建超级管理员：`python manage.py createsuperuser`

---

## 二、第三方集成（需外部账号/凭据）

### 企业微信
- [ ] 配置 `settings.QW_CORP_ID`、`QW_AGENT_ID`、`QW_SECRET`（企微应用信息）
- [ ] 配置 `settings.QW_WEBHOOK_URL`（群机器人 Webhook，启用状态变更/缺陷分配推送）
- [x] 企微 SSO 登录流程已实现（前端：登录页"企微扫码登录"按钮 → `GET /api/auth/qw/auth/` 获取授权链接；后端：`QwAuthView` 生成授权 URL、`QwCallbackView` 接收回调、`QwLoginView` 完成 JWT 登录）
  - 待配置：需填写真实 `QW_CORP_ID`、`QW_AGENT_ID` 环境变量，并在 `QwCallbackView` 中调用企微 API 换取用户信息

### TAPD
- [ ] 申请 TAPD 开放平台应用，获取真实 `app_id` / `app_secret`
- [ ] 将 `TAPDProjectsView`、`TAPDRequirementsView` 中的 Mock 数据替换为真实 TAPD API 调用
- [ ] 实现 TAPD OAuth 授权流程（当前 `access_token` 为 mock）

### GitLab
- [ ] 配置项目级 GitLab 仓库（通过集成中心 → GitLab 配置页面）
- [ ] 实现 GitLab 分支列表实时拉取（需调用 `GET /projects/:id/repository/branches`）

### AI（DeepSeek / Claude）
- [ ] 配置 `settings.DEEPSEEK_API_KEY` 或 `settings.CLAUDE_API_KEY`，启用真实 AI 功能
- [ ] 验证 AI 需求分析、测试用例生成、代码生成接口的实际效果

---

## 三、前端性能优化

- [ ] **代码分割**：配置 `vite.config.ts` 的 `rollupOptions.manualChunks`，将 antd、md-editor 等大库单独打包（当前 bundle 1.3MB，超过 500KB 建议值）
- [ ] **按需加载**：对路由页面使用 `React.lazy` + `Suspense` 实现懒加载
- [ ] **图片优化**：配置 Vite 的图片压缩插件（如 `vite-plugin-imagemin`）

---

## 四、功能完善

### 后端
- [ ] **TAPD 真实同步**：`TAPDSyncView` 当前为 Mock，需实现从 TAPD 拉取需求详情并写入 `Requirement` 表
- [x] **企微消息推送**：`notify_requirement_blocked` 已在 block 接口中调用（`RequirementViewSet.block` 方法）
- [ ] **需求列表分页**：确认前端分页参数与后端 `PageNumberPagination`（PAGE_SIZE=20）对接正常
- [ ] **文件上传**：需求 MD 文档目前存 TextField，如需支持附件上传需增加 FileField 及存储后端

### 前端
- [ ] **站内通知功能**：通知图标和轮询已暂时移除。待后续实现：① 后端补全 `Notification.objects.create()` 写入逻辑（缺陷分配、需求状态变更、@提及触发）；② 前端恢复通知铃铛图标与抽屉展示；③ 将轮询替换为 WebSocket 实时推送
- [x] **需求详情独立路由**：已实现 `/requirements/:id` 独立路由（`RequirementDetail` 页面）
- [ ] **测试计划页完善**：测试报告生成接口（`/api/test-cases/test-plans/:id/report/`）已实现，前端报告展示页尚缺可视化图表
- [ ] **缺陷统计图表**：缺陷管理页的统计图表（按严重级别/状态分布）使用了 Ant Design Charts，确认组件正常渲染
- [ ] **工作量统计图表**：人员管理页的工作量 Tab 可增加柱状图可视化
- [ ] **文件上传拖拽支持**：需求理解/技术方案/UI设计稿的文件上传功能，当前支持按钮选择文件/文件夹，后期需实现拖拽上传区域，支持同时拖入文件和文件夹（浏览器拖拽 API 支持混合拖入）

---

## 五、安全与质量

- [ ] **生产环境 SECRET_KEY**：`settings.py` 中当前为 `django-insecure-*` 的 key，上线前必须替换为随机强密钥
- [ ] **DEBUG 关闭**：生产环境将 `settings.DEBUG` 改为 `False`，配置 `ALLOWED_HOSTS`
- [ ] **HTTPS**：部署时配置 Nginx + SSL，后端 API 和前端均走 HTTPS
- [ ] **CORS 收紧**：`CORS_ALLOWED_ORIGINS` 限制为实际前端域名，去除开发时的通配符
- [ ] **JWT Secret 独立**：`SIMPLE_JWT.SIGNING_KEY` 与 `SECRET_KEY` 分开，使用独立随机值
- [ ] **依赖安全审计**：运行 `pip-audit` 和 `pnpm audit` 检查依赖漏洞

---

## 六、部署

- [ ] 编写 `Dockerfile`（前端 + 后端分别打包）
- [ ] 编写 `docker-compose.yml`（MySQL + Django + Vite 静态文件 + Nginx）
- [ ] 配置 Nginx：反向代理 `/api/` 到 Django，静态文件直接由 Nginx 服务
- [ ] CI/CD：配置 GitLab CI 或 GitHub Actions，实现自动测试 + 构建 + 部署

---

## 七、测试

- [ ] 后端单元测试：为核心接口（状态机、ChangeLog、权限）编写 Django TestCase
- [ ] 前端组件测试：使用 Vitest + Testing Library 为关键组件添加测试
- [ ] E2E 测试：使用 Playwright 覆盖登录、需求流转、缺陷提报等核心流程

---

## 八、需求文档智能化（req-doc 相关延后功能）

- [ ] **Confluence 集成**：配置 Confluence Token，实现从 Confluence 页面 URL 读取内容并解析为 Markdown，存入 AiUnderstanding.raw_content
- [ ] **TAPD 链接内容解析**：通过已有 TAPD Token 解析 TAPD 需求链接，提取需求详情内容供 AI 理解生成
- [ ] **req_understanding 注入测试用例 prompt**：升级 `AITestCaseGenerationView`，将 `Requirement.req_understanding`（最优 AI 需求理解）注入测试用例生成的 system prompt，提升测试用例质量
- [ ] **文件存储迁移至 OSS**：当前 AiInputAsset 图片文件存储在 `backend/static/uploads/`，迁移 OSS 时需批量更新 `AiInputAsset.file_paths` 字段中的路径；只需替换 storage backend，无需改动业务逻辑
