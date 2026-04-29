## Why

当前团队缺乏统一的项目管理工具，需求从提出到上线的全流程无法有效追踪，测试管理、缺陷跟踪与人员协作分散在不同系统，导致信息孤岛、沟通成本高、交付质量难以保障。SDD项管平台旨在整合项目管理、测试管理与人员管理，实现需求全生命周期的标准化管理，提升团队协作效率与项目交付质量。

## What Changes

- 全新构建 SDD 项目管理平台（前端 React + Ant Design Pro + Vite，后端 Django + DRF + MySQL）
- 引入需求全生命周期管理（11个状态流转：待评审 → 待技评 → 待开发 → 开发中 → 待测试 → 测试中 → 待验收 → 待上线 → 待回归 → 已完成 / 关闭）
- 引入迭代管理，支持多迭代并行跟踪
- 引入测试管理模块（测试用例、缺陷管理、测试计划、测试报告）
- 引入人员与权限管理（角色：产品经理、开发人员、测试人员、项目经理、管理员、超级管理员）
- 集成企业微信扫码登录（SSO）
- 集成 GitLab（代码仓库关联、分支/Commit 绑定）
- 集成 TAPD（需求数据同步）
- 引入 AI 辅助功能（需求分析、测试用例生成、智能代码生成，对接 DeepSeek / Claude 等模型）
- Dashboard 展示项目概览与关键指标
- 通知系统（企业微信 / 钉钉）
- 文档管理（Markdown + Figma 链接）
- 变更记录全量审计（ChangeLog）

## Capabilities

### New Capabilities

- `user-auth`: 用户认证与授权，包含 JWT 登录、企业微信 SSO、Token 刷新机制及基于角色的权限控制（RBAC）
- `project-management`: 项目与迭代管理，支持项目 CRUD、迭代周期设置、进度跟踪
- `requirement-lifecycle`: 需求全生命周期管理，包含 11 个状态流转、MD 文档上传、GitLab 分支关联、子需求、版本变更记录
- `test-management`: 测试管理，含测试用例（CRUD、执行、AI 生成）、缺陷管理（提报/分配/解决）、测试计划与报告
- `user-team-management`: 人员与团队管理，包含用户 CRUD、角色定义、团队组建与工作量统计
- `dashboard-notifications`: Dashboard 概览展示与通知系统（企业微信/钉钉推送）
- `third-party-integrations`: 第三方集成，含 GitLab API、TAPD 数据同步、企业微信认证、AI 模型接口（DeepSeek/Claude）
- `document-management`: 文档管理，支持 Markdown 文档存储与 Figma 链接关联

### Modified Capabilities

（本次为全新建设，无已有 Capability 变更）

## Impact

- **代码库**：全新项目，`backend/` 目录使用 Django 应用结构（apps/users, projects, iterations, requirements, tests, bugs），`frontend/` 使用 React + Vite 结构
- **数据库**：MySQL，核心表：User、Project、Iteration、Requirement、SubRequirement、Bug、FunctionCase、ChangeLog
- **API**：RESTful API，路径前缀 `/api/`，认证使用 JWT Bearer Token
- **外部依赖**：GitLab API、TAPD API、企业微信开放平台、AI 模型 API（DeepSeek/Claude）、企业微信/钉钉 Webhook 通知
- **运行环境**：Node.js v22.22.2，Python 3.9，pnpm（前端），pip（后端），Gunicorn（生产）
- **依赖管理**：后端依赖实时写入 `require.txt`，前端依赖通过 `package.json` 管理
- **过程留档**：研发过程记录至 `spec/program.md`，问题经验记录至 `spec/problem.md`，部署方法记录至 `README.md`
