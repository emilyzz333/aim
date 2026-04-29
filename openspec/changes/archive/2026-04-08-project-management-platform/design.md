## Context

SDD 项管平台是一个全新建设的综合性项目管理系统，旨在覆盖需求从提出到上线的全生命周期。当前团队使用的工具分散（TAPD、GitLab、企业微信等），缺乏统一视图和状态追踪。本平台需整合项目管理、测试管理、人员管理三大核心域，并与企业微信、GitLab、TAPD、AI 模型进行外部集成。

技术约束：前端 React + Ant Design Pro + Vite（Node.js v22.22.2，pnpm），后端 Django 3.x/4.x + DRF（Python 3.9，pip），数据库 MySQL，认证 JWT，部署 Gunicorn，暂不使用 Docker/Redis/Celery。

## Goals / Non-Goals

**Goals:**
- 建立前后端分离的全栈项目管理平台（REST API + SPA）
- 实现需求 11 状态生命周期完整流转与历史审计
- 支持基于角色的权限控制（RBAC）
- 完成企业微信 SSO、GitLab、TAPD、AI 模型的外部集成
- 本地开发环境可一键启动（前端 `pnpm dev`，后端 `python manage.py runserver`）
- 所有后端依赖实时写入 `require.txt`
- 所有前端依赖实时写入 `package.json`

**Non-Goals:**
- 不做容器化（Docker / Docker Compose）
- 不引入 Redis 缓存或 Celery 异步任务（初期）
- 不做生产环境云部署（先本地服务器）
- 不做移动端原生 App

## Decisions

### 1. 前端框架：React + Ant Design Pro + Vite（非 Webpack）

**选择 Vite 而非 Webpack**：Vite 在开发态基于 ESM 原生按需编译，冷启动速度比 Webpack 快 10-100x，HMR 响应更快，适合快速迭代。PRD 已明确要求使用 Vite。

**选择 Ant Design Pro**：内置 ProTable、ProForm、布局框架、权限方案（access.ts），与 Ant Design 生态无缝整合，可直接复用大量业务组件，减少重复开发。

**状态管理：Redux Toolkit + Redux Saga**（PRD 要求）：Saga 处理复杂异步流（如状态流转、TAPD 同步），Redux Toolkit 减少样板代码。

### 2. 后端框架：Django + Django REST Framework

**选择 DRF**：与 Django ORM 深度集成，Serializer 自动处理 JSON 序列化/反序列化及字段验证，ViewSet + Router 减少 CRUD 样板，Permission 类天然支持 RBAC。

**多 App 结构**：按业务域拆分（users, projects, iterations, requirements, tests, bugs），各 App 独立 models/views/serializers/urls，边界清晰，便于后续拆分或扩展。

### 3. 认证方案：JWT（djangorestframework-simplejwt）

**选择 JWT 而非 Session**：前后端分离架构下无状态认证，天然支持跨域，适合后续扩展移动端或第三方服务调用。配置 Access Token（短期，15分钟）+ Refresh Token（长期，7天），前端 Axios 拦截器自动刷新。

**企业微信 SSO**：通过企业微信 OAuth2.0 获取 code，后端换取 access_token 和用户信息，与本地 User 绑定，返回 JWT，实现单点登录。

### 4. 数据模型核心设计

**需求状态机**：11 个状态（待评审、待技评、待开发、开发中、待测试、测试中、待验收、待上线、待回归、已完成、关闭），通过 `change-status` 接口控制流转，每次变更写入 ChangeLog。

**ChangeLog 通用审计**：`target_type + target_id` 多态设计，一张表覆盖需求、缺陷等所有实体的变更历史，避免多表冗余。

**Requirement 多值字段**：`gitlab_branch`、`commit_id`、`tags`、`developer` 等支持多值，使用 JSON 字段存储（MySQL 5.7+ 支持），避免引入关联表过度设计。

### 5. 目录结构规范

```
project/
├── backend/
│   ├── manage.py
│   ├── sdd_platform/        # Django 项目配置
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   ├── apps/
│   │   ├── users/           # 用户、角色、团队、企微集成
│   │   ├── projects/        # 项目管理
│   │   ├── iterations/      # 迭代管理
│   │   ├── requirements/    # 需求、子需求、变更记录
│   │   ├── tests/           # 测试用例、测试计划、测试报告
│   │   └── bugs/            # 缺陷管理
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── pages/           # 页面组件
│   │   ├── components/      # 通用组件
│   │   ├── store/           # Redux store + sagas
│   │   ├── services/        # Axios API 封装
│   │   └── access.ts        # 权限控制
│   ├── package.json
│   └── tsconfig.json
├── spec/
│   ├── program.md           # 研发过程记录
│   └── problem.md           # 问题与解决方案记录
├── README.md
└── require.txt
```

### 6. 第三方集成策略

- **GitLab**：通过 GitLab REST API v4 关联项目/分支/MR，存储在 Requirement 字段，不做 Webhook 实时同步（初期）
- **TAPD**：通过 TAPD Open API 拉取需求数据，手动触发同步，映射到本地 Requirement 模型
- **AI 集成**：后端统一 AI 服务层（`apps/ai/`），封装 DeepSeek/Claude API 调用，前端通过统一接口请求，支持流式响应
- **企业微信通知**：通过企业微信群机器人 Webhook 发送关键事件通知

## Risks / Trade-offs

- **JSON 字段多值存储** → 查询效率低于关联表，但初期数据量小影响可接受；若后续需要复杂查询可迁移为关联表
- **无 Redis/Celery** → TAPD 同步、AI 调用等耗时操作在请求线程内执行，可能导致超时；初期数据量小可接受，后续按需引入
- **企业微信 SSO 依赖企业内网** → 开发环境需配置企业微信测试应用，本地调试有一定复杂度；提供用户名密码兜底登录
- **MySQL JSON 字段** → 需 MySQL 5.7+，查询语法相对复杂；通过 Django 自定义查询方法封装
- **前端状态管理复杂度** → Redux Saga 学习曲线较陡；通过规范 saga 模式和代码模板降低门槛

## Migration Plan

本次为全新建设，无历史数据迁移。

**启动流程：**
1. 初始化 MySQL 数据库，配置 `settings.py`
2. 运行 `python manage.py migrate` 创建表结构
3. 运行 `python manage.py createsuperuser` 创建初始管理员
4. 后端：`python manage.py runserver`
5. 前端：`pnpm install && pnpm dev`

**回滚策略：** 全新项目，无需回滚方案。

## Open Questions

- 企业微信应用 CorpID 和 AgentID 配置信息待运维提供
- TAPD Open API 的 AppID/AppSecret 待申请
- AI 模型 API Key（DeepSeek/Claude）待申请
- GitLab 实例地址和 Personal Access Token 待确认
