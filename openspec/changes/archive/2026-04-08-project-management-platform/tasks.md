## 1. 项目初始化与目录结构

- [x] 1.1 创建项目根目录结构（backend/、frontend/、spec/、README.md、require.txt）
- [x] 1.2 初始化 Django 项目（`django-admin startproject sdd_platform backend/`）
- [x] 1.3 创建 Django Apps：users、projects、iterations、requirements、tests、bugs
- [x] 1.4 初始化前端项目（Ant Design Pro + Vite，`pnpm create umi`）
- [x] 1.5 配置 Django settings.py（数据库 MySQL、CORS、JWT、已安装 App）
- [x] 1.6 配置前端 Vite 代理和 Axios baseURL
- [x] 1.7 创建 spec/program.md 和 spec/problem.md 过程留档文件
- [x] 1.8 配置前端 ESLint + Prettier（`.eslintrc`、`.prettierrc`，集成到 pnpm lint 脚本）
- [x] 1.9 创建 frontend/static/ 目录并配置 Vite publicDir 指向

## 2. 数据库与数据模型

- [x] 2.1 配置 MySQL 数据库连接（settings.py DATABASE 配置）
- [x] 2.2 实现 User 模型（含企微字段 qw_userid/openid/department/avatar）
- [x] 2.3 实现 Project 模型
- [x] 2.3b 实现 Module 模型（project_id、name、parent_id 自引用、order 排序字段）
- [x] 2.4 实现 Iteration 模型（关联 Project）
- [x] 2.5 实现 Requirement 模型（含 JSON 多值字段：gitlab_branch、commit_id、tags、developer；新增 is_blocked、block_reason、is_archived 字段）
- [x] 2.6 实现 SubRequirement 模型（关联 Requirement）
- [x] 2.7 实现 Bug 模型（含 env、type、group、source 字段）
- [x] 2.8 实现 FunctionCase 模型（含 plat、source、reviewed、is_delete 字段）
- [x] 2.9 实现 ChangeLog 模型（通用多态审计：target_type + target_id）
- [x] 2.10 执行初始 migrate，验证表结构正确

## 3. 用户认证与权限（user-auth）

- [x] 3.1 安装并配置 djangorestframework-simplejwt（Access 15min，Refresh 7天）
- [x] 3.2 实现 `POST /api/auth/login` 用户名密码登录接口
- [x] 3.3 实现 `POST /api/auth/logout` 登出（Refresh Token 黑名单）
- [x] 3.4 实现 `GET /api/auth/me` 获取当前用户信息
- [x] 3.5 实现 Token 刷新接口 `POST /api/auth/token/refresh`
- [x] 3.6 实现企业微信授权链接生成 `GET /api/auth/qw/auth`
- [x] 3.7 实现企业微信回调处理 `GET /api/auth/qw/callback`（换取用户信息，绑定/创建本地账号，返回 JWT）
- [x] 3.7b 实现企业微信用户直接登录 `POST /api/auth/qw/login`
- [x] 3.7c 实现获取企微用户信息 `GET /api/auth/qw/userinfo`
- [x] 3.8 实现 RBAC 权限类（基于 role 字段的 DRF Permission 类）
- [x] 3.9 前端实现 Axios 拦截器（自动注入 Token，处理 401 自动刷新）
- [x] 3.10 前端实现登录页（用户名密码 + 企微扫码入口）
- [x] 3.11 前端实现 access.ts 权限控制（基于用户角色控制菜单和按钮）

## 4. 项目与迭代管理（project-management）

- [x] 4.1 实现项目 CRUD API（`GET/POST /api/projects`，`GET/PUT/DELETE /api/projects/:id`，创建/编辑/删除限管理员+超管）
- [x] 4.1b 实现模块 CRUD API（`GET/POST /api/modules`，`GET/PUT/DELETE /api/modules/:id`，`GET /api/modules?project_id=<id>` 返回完整树）
- [x] 4.2 实现迭代 CRUD API（`GET/POST /api/iterations`，`GET/PUT/DELETE /api/iterations/:id`）
- [x] 4.3 实现迭代详情中的进度统计（total_requirements、completed_requirements、completion_rate）
- [x] 4.4 前端实现左侧导航栏项目列表（可展开查看迭代）
- [x] 4.5 前端实现项目管理页（项目列表，管理员可新建/编辑/删除项目）
- [x] 4.5b 前端实现模块管理页（树形组件展示多层级模块，支持新建/编辑/删除模块节点）
- [x] 4.6 前端实现迭代管理页（迭代列表、新建/编辑迭代、迭代统计面板）

## 5. 需求生命周期管理（requirement-lifecycle）

- [x] 5.1 实现需求 CRUD API（`GET/POST /api/requirements`，`GET/PUT/DELETE /api/requirements/:id`）
- [x] 5.2 实现需求状态机（完整流转规则：含待测试→开发中驳回路径，非法流转返回 400）
- [x] 5.2b 实现驳回接口逻辑（目标状态为"开发中"时 MUST 校验 reject_reason 非空，写入一条 ChangeLog：status 变更 + reject_reason）
- [x] 5.2c 实现开发中阻塞标记（is_blocked + block_reason 字段更新，写入 ChangeLog）
- [x] 5.2d 实现已完成需求归档（is_archived 字段，归档后不出现在默认列表，支持 include_archived 参数）
- [x] 5.3 实现状态变更接口 `POST /api/requirements/:id/change-status`（写入 ChangeLog）
- [x] 5.4 实现 MD 文档上传接口 `POST /api/requirements/:id/upload-md`
- [x] 5.5 实现需求列表 API 支持多维筛选（iteration_id、status、priority、assignee、关键词搜索）
- [x] 5.6 实现子需求 CRUD API（嵌套在需求详情中）
- [x] 5.7 实现 ChangeLog 查询 API（按 target_type + target_id 查询）
- [x] 5.8 实现自动 ChangeLog 记录（Requirement 字段变更时自动写入）
- [x] 5.9 前端实现需求列表页（ProTable、生命周期进度条、筛选、批量操作，支持 include_archived 切换）
- [x] 5.10 前端实现需求详情页（多标签页：基本信息、描述/技术方案 MD 编辑器、子需求、关联缺陷、测试用例、变更记录；含阻塞标记按钮）
- [x] 5.11 前端实现需求状态流转操作（状态变更确认弹窗；驳回时强制弹出驳回原因输入框）

## 6. 测试管理（test-management）

- [x] 6.1 实现测试用例 CRUD API（`GET/POST /api/test-cases`，`GET/PUT/DELETE /api/test-cases/:id`，软删除）
- [x] 6.2 实现测试用例执行状态更新
- [x] 6.3 实现缺陷 CRUD API（`GET/POST /api/bugs`，`GET/PUT/DELETE /api/bugs/:id`）
- [x] 6.4 实现缺陷状态变更并写入 ChangeLog
- [x] 6.5 实现测试计划 CRUD（关联需求和测试用例集合，跟踪执行进度）
- [x] 6.6 实现测试报告生成接口（聚合统计：通过数、失败数、缺陷数、覆盖率）
- [x] 6.7 前端实现测试用例管理页（列表、新建/编辑、按模块/需求筛选、执行状态更新）
- [x] 6.8 前端实现缺陷管理页（列表、提报、分配、状态跟踪、统计图表）
- [x] 6.9 前端实现测试计划与报告页

## 7. 人员与团队管理（user-team-management）

- [x] 7.1 实现用户管理 API（`GET/POST /api/users`，`GET/PUT/DELETE /api/users/:id`）
- [x] 7.2 实现团队 CRUD API（`GET/POST /api/teams`，成员管理）
- [x] 7.3 实现工作量统计 API（按用户/团队聚合需求数和缺陷数，支持时间范围筛选）
- [x] 7.4 前端实现用户管理页（列表、新建/编辑用户、角色分配）
- [x] 7.5 前端实现团队管理页（团队列表、成员管理）
- [x] 7.6 前端实现工作量统计页（个人和团队工作量展示）

## 8. Dashboard 与通知（dashboard-notifications）

- [x] 8.1 实现 Dashboard 数据聚合 API（各项目需求分布、缺陷数、迭代进度）
- [x] 8.2 实现站内通知模型和 CRUD API（创建、查询、标记已读）
- [x] 8.3 实现企业微信 Webhook 通知服务（需求状态变更、缺陷分配时推送）
- [x] 8.4 前端实现 Dashboard 页面（项目概览卡片、需求状态饼图、迭代进度条）
- [x] 8.5 前端实现顶部通知中心（未读数徽标、通知列表抽屉）

## 9. 第三方集成（third-party-integrations）

- [x] 9.1 实现 TAPD 集成（`POST /api/tapd/auth`，`GET /api/tapd/projects`，`GET /api/tapd/requirements`，`POST /api/tapd/sync`）
- [x] 9.2 实现 GitLab 配置存储（项目级 GitLab 仓库 URL + Access Token）
- [x] 9.3 实现 AI 服务层（统一封装 DeepSeek/Claude API，支持流式响应）
- [x] 9.4 实现 AI 需求分析接口（提交需求描述，返回拆解建议）
- [x] 9.5 实现 AI 测试用例生成接口（根据需求 ID 生成测试用例，source 标记"AI 生成"）
- [x] 9.5b 实现 AI 智能代码生成接口（根据需求描述和技术方案生成代码片段）
- [x] 9.5c 预留自动化测试触发接口 `POST /api/test-cases/:id/run-automation`（当前返回 HTTP 501，后期 AI 集成实现）
- [x] 9.6 前端实现 TAPD 需求拉取与同步 UI
- [x] 9.7 前端实现 AI 功能入口（需求分析面板、测试用例 AI 生成按钮）

## 10. 文档管理（document-management）

- [x] 10.1 前端集成 Markdown 编辑器（如 md-editor-rt 或 @uiw/react-md-editor）
- [x] 10.2 实现需求详情页 MD 文档在线编辑与保存
- [x] 10.3 实现 Figma 链接字段存储与详情页展示
- [x] 10.4 实现 Markdown 内容前端渲染（带代码高亮）

## 11. 安全与质量

- [x] 11.1 配置 Django CORS（允许前端开发域名）
- [x] 11.2 配置 CSRF 保护（DRF session 认证场景）
- [x] 11.3 确保所有 API 输入经过 DRF Serializer 验证
- [x] 11.4 确保密码使用 Django 内置 bcrypt/PBKDF2 加密存储
- [x] 11.5 SQL 注入防护（全程使用 Django ORM，禁止 raw SQL 拼接）
- [x] 11.6 前端 XSS 防护（Markdown 渲染使用安全库，禁止 dangerouslySetInnerHTML 注入）

## 12. 过程留档与部署文档

- [x] 12.1 将后端依赖实时写入 require.txt（每次安装新包后更新）
- [x] 12.2 编写 README.md（前后端启动方法、环境配置说明）
- [x] 12.3 记录研发过程关键节点至 spec/program.md
- [x] 12.4 记录遇到的问题与解决方案至 spec/problem.md
