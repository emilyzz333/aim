## ADDED Requirements

### Requirement: 顶部核心导航Tab
系统 SHALL 在顶部 Header 区域提供"需求 / 迭代 / 缺陷"三个导航 Tab，点击后跳转至对应页面。

#### Scenario: Tab 仅在核心路由显示
- **WHEN** 当前路由为 `/requirements`、`/iterations`、`/bugs` 之一
- **THEN** 顶部 Header 显示"需求 / 迭代 / 缺陷"三个 Tab，当前路由对应的 Tab 高亮激活

#### Scenario: 进入左侧菜单页面时Tab隐藏
- **WHEN** 当前路由为 `/home`、`/dashboard`、`/projects`、`/test-cases`、`/users`、`/integrations` 之一
- **THEN** 顶部 Header 不显示三个导航 Tab，仅保留 Logo 区域、通知铃铛和用户头像

#### Scenario: 点击顶部Tab跳转
- **WHEN** 用户点击顶部"迭代"Tab
- **THEN** 路由跳转至 `/iterations`，Tab 高亮切换

---

### Requirement: 左侧可折叠图标菜单
系统 SHALL 提供可折叠的左侧 Sider，折叠时仅显示图标，展开时显示图标和菜单名称。

#### Scenario: Sider 展开状态
- **WHEN** Sider 处于展开状态（默认）
- **THEN** 每个菜单项显示图标和文字名称，Sider 宽度约 200px，底部或顶部有折叠触发按钮

#### Scenario: Sider 折叠状态
- **WHEN** 用户点击折叠按钮
- **THEN** Sider 收缩至仅显示图标（约 64px），鼠标悬停图标时显示 Tooltip 展示菜单名称

#### Scenario: 折叠状态持久化
- **WHEN** 用户折叠 Sider 后刷新页面
- **THEN** Sider 保持上次折叠/展开状态（通过 localStorage 存储）

---

### Requirement: 左侧菜单项构成
左侧菜单 SHALL 包含以下固定项（顺序从上到下）：主页、仪表盘、项目管理、测试管理、人员管理、集成中心，各项按角色权限动态显示。

#### Scenario: 全量菜单（管理员/超管）
- **WHEN** 当前用户角色为 `admin` 或 `super_admin`
- **THEN** 左侧菜单显示全部6个菜单项

#### Scenario: 普通用户菜单
- **WHEN** 当前用户角色为 `product_manager`、`developer` 或 `project_manager`
- **THEN** 左侧菜单仅显示"主页"和"仪表盘"，项目管理/测试管理/人员管理/集成中心均不显示

---

### Requirement: 默认落地页为需求
系统 SHALL 将未登录后跳转的默认页（`/`）重定向至 `/requirements`。

#### Scenario: 访问根路径
- **WHEN** 已登录用户访问 `/`
- **THEN** 自动重定向至 `/requirements`

#### Scenario: 登录后跳转
- **WHEN** 用户完成登录
- **THEN** 跳转至 `/requirements` 页面
