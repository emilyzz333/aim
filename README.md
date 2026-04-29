# AI-M平台

顺应当前AI时代下的综合需求项目管理平台，覆盖基于AI时代的需求全生命周期、项目流程、测试管理、人员管理，集成企微 SSO、GitLab、TAPD、AI 辅助能力。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + Ant Design 5 + Vite 5 + React Router v6 |
| 后端 | Django 4.2 + DRF 3.16 + simplejwt |
| 数据库 | MySQL 5.7+ |
| 认证 | JWT（Access 15min + Refresh 7天）|

## 环境要求

- Node.js v22.22.2
- Python 3.9
- MySQL 5.7+
- pnpm（前端）/ pip（后端）

## 快速启动

### 后端

```bash
cd backend

# 1. 安装依赖
pip install -r ../require.txt

# 2. 配置数据库（修改 project_management/settings.py 中的 DATABASES）
# 创建数据库
mysql -u root -p -e "CREATE DATABASE m_platform CHARACTER SET utf8mb4;"

# 3. 数据迁移
python manage.py makemigrations
python manage.py migrate

# 4. 创建超级管理员
python manage.py createsuperuser
python manage.py changepassword <用户名>
#如果不知道超级管理员用户名，先查一下：
python manage.py shell -c "from apps.users.models import User; print([(u.username, u.role) for u in User.objects.filter(role='super_admin')])"

# 5. 启动开发服务器
python manage.py runserver

# 终端1：Django 服务
python manage.py runserver 8888

# 终端2：启动异步任务 Celery worker
celery -A project_management worker -l info --pool=solo  #改用 solo 或 threads pool 代替 prefork，避免子进程的 _loc 缓存没有被正确初始化
##celery -A project_management worker -l info  #这么启动会存在Celery 5.3.6 + billiard + Windows prefork 的已知 bug：子进程的 _loc 缓存没有被正确初始化导致报错ValueError: not enough values to unpack (expected 3, got 0)
```

### 前端

```bash
cd frontend

# 安装依赖
pnpm install

# 启动开发服务器（代理到 http://localhost:8888，前端监听 8001）
pnpm dev
```

## 目录结构

```
d:/gdSDDpmo/
├── backend/
│   ├── apps/
│   │   ├── users/          # 用户认证、RBAC 权限、企微 SSO
│   │   ├── projects/       # 项目管理、模块树管理
│   │   ├── iterations/     # 迭代管理
│   │   ├── requirements/   # 需求全生命周期（状态机、ChangeLog）
│   │   ├── tests/          # 测试用例（FunctionCase）、测试计划
│   │   ├── bugs/           # 缺陷管理
│   │   └── integrations/   # 第三方集成（GitLab、TAPD、AI、confluence）、Dashboard
│   ├── project_management/ # Django 项目配置
│   └── manage.py
├── frontend/               # 前端代码（React + Ant Design）
│   ├── src/
│   │   ├── layouts/    # 全局布局
│   │   ├── pages/      # 页面组件
│   │   └── services/   # API 服务层（含 JWT 拦截器）
├── spec/
│   ├── program.md      # 研发过程记录
│   └── problem.md      # 问题与解决方案
├── openspec/           # OpenSpec 变更提案
├── require.txt         # 后端依赖
└── prd.md              # 产品需求文档
```

## API 接口

所有接口以 `/api/` 为前缀，需在 Header 中携带 `Authorization: Bearer <access_token>`。

| 模块 | 路径前缀 |
|---|---|
| 认证 | `/api/auth/` |
| 用户管理 | `/api/users/` |
| 项目 | `/api/projects/` |
| 模块 | `/api/projects/modules/` |
| 迭代 | `/api/iterations/` |
| 需求 | `/api/requirements/` |
| 测试用例 | `/api/test-cases/` |
| 缺陷 | `/api/bugs/` |

## 需求状态流转

```
待评审 → 待技评 → 待开发 → 开发中 → 待测试 ⇄ 开发中（驳回）
待测试 → 测试中 → 待验收 → 待上线 → 待回归 → 已完成
任意状态 → 关闭
```
