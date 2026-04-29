## Why

当前系统采用固定左侧导航栏将所有功能平铺展示，不符合研发团队以"需求"为核心的工作流，重要功能（需求、迭代）与辅助配置功能（人员管理、集成中心）混杂在同一层级，导致主要用户（产品经理、开发人员）的使用路径冗长，且无法按角色动态控制菜单可见性。

## What Changes

- **整体布局重构**：顶部导航栏增加"需求 / 迭代 / 缺陷"三个核心 Tab（仅在对应页面显示），左侧 Sider 改为可折叠图标菜单（展开显示图标+名称，折叠仅图标）
- **默认落地页变更**：从仪表盘（`/`）改为需求列表（`/requirements`），按更新时间降序排列
- **新增主页**：`/home` 页面，包含需求/迭代/缺陷三张统计入口卡片，左侧菜单"主页"图标点击进入
- **迭代视图重构**：迭代页改为双栏布局——左侧展示迭代列表（支持跨项目筛选），右侧展示选中迭代下的需求列表
- **角色体系扩展**：后端新增 `product_tl`（产品TL）、`developer_tl`（开发TL）、`tester_tl`（测试TL）三个角色，前端新建权限常量文件集中管理菜单可见性
- **需求列表排序**：后端支持 `ordering` 参数，默认 `-updated_at`；前端支持排序字段切换
- **测试管理重组**：新增"AI用例"Tab（迁入 AI 测试用例生成功能）；需求详情页新增"生成AI用例"按钮，生成结果以 `source=ai, reviewed=pending` 保存
- **缺陷独立**：缺陷管理全员可见，作为顶部导航独立 Tab"缺陷"，不并入测试管理

### 后续追加改动（同次开发周期）

- **需求详情页 Tab 重组**：Tab 顺序调整为 详细信息 → 子需求 → 需求文档 → 技术方案 → 测试计划 → 变更历史；"AI助手"从 Tab 改回标题栏按钮，点击弹出右侧对话 Drawer
- **标签展示优化**：标签 Tag 与加号按钮在同一行内联展示（`flex + flexWrap`），不再另起一行
- **备注字段迁移**：备注从右侧基础信息侧边栏移动到"详细信息" Tab 的标签行下方，以 TextArea 形式展示（失焦自动保存）
- **右侧侧边栏加宽**：需求详情右侧基础信息侧边栏宽度从 230px 调整为 280px
- **测试计划 Tab 新增**：需求详情新增"测试计划" Tab，含"AI自动生成测试计划"和"AI测试用例"两个区块
- **AI需求助手 Drawer**：新建 `AiAssistantDrawer` 组件（右侧滑出对话面板），支持多会话切换、"注入项目数据"开关（自动带入需求上下文）、气泡样式消息列表、Enter 发送；后端新增 `/integrations/ai/chat/` 接口
- **User 模型扩展**：新增 `display_name`（中文姓名）、`qw_username`（企微中文名）、`team`（FK → Team）、`leader`（自关联 FK）字段；UserSerializer 同步暴露 `team_name`、`leader_name`、`leader_username` 只读字段
- **需求 Serializer 扩展**：新增 `test_plan_count`、`test_case_count` 只读聚合字段（利用 tests app 的反向关联）
- **Bug 编号自增**：`bug_id` 字段改为 `blank=True`，`perform_create` 自动生成 `BUG-XXXX` 格式编号（同需求 `REQ-XXXX` 逻辑）

## Capabilities

### New Capabilities

- `layout-navigation`: 顶部核心导航Tab（需求/迭代/缺陷）+ 左侧可折叠图标菜单 + 路由感知Tab显隐逻辑
- `role-permissions`: 前端角色权限常量文件，控制左侧各菜单项按角色显隐
- `home-page`: 主页（/home），展示需求/迭代/缺陷三张统计入口卡片
- `iteration-split-view`: 迭代页双栏布局——左侧迭代列表+右侧需求列表
- `ai-assistant-drawer`: AI需求助手右侧对话 Drawer，支持多会话、上下文注入、对话气泡 UI

### Modified Capabilities

- `requirement-lifecycle`: 需求列表新增 `ordering` 排序支持；详情页 Tab 重组；标签内联展示；备注移至详细信息 Tab；侧边栏加宽；新增 `test_plan_count`/`test_case_count` 聚合字段
- `test-management`: 新增"AI用例"子Tab；需求详情新增生成AI用例入口及测试计划Tab，保存时标记 `source=ai, reviewed=pending`
- `user-auth`: 后端 `ROLE_CHOICES` 扩展三个TL角色；User 模型新增 `display_name`/`qw_username`/`team`/`leader` 字段
- `bug-management`: `bug_id` 改为自增生成（`BUG-XXXX` 格式）

## Impact

**后端文件**：
- `backend/apps/users/models.py` — 扩展 `ROLE_CHOICES`；新增 `display_name`、`qw_username`、`team`、`leader` 字段
- `backend/apps/users/serializers.py` — 暴露新字段及 `team_name`/`leader_name`/`leader_username`
- `backend/apps/requirements/views.py` — 新增 `ordering` 参数支持
- `backend/apps/requirements/serializers.py` — 新增 `test_plan_count`/`test_case_count` 聚合字段
- `backend/apps/bugs/models.py` — `bug_id` 改为 `blank=True`
- `backend/apps/bugs/views.py` — `perform_create` 自动生成 `bug_id`
- `backend/apps/integrations/views.py` — 新增 `AIChatView`
- `backend/apps/integrations/urls.py` — 注册 `ai/chat/` 路由

**前端文件**：
- `frontend/src/layouts/index.tsx` — 整体布局重构（核心改动）
- `frontend/src/App.tsx` — 路由调整，默认页改为 `/requirements`，新增 `/home`
- `frontend/src/config/permissions.ts` — 新建权限常量文件
- `frontend/src/pages/home/index.tsx` — 新建主页
- `frontend/src/pages/iterations/index.tsx` — 重构为双栏布局
- `frontend/src/pages/requirements/index.tsx` — 新增排序控件
- `frontend/src/pages/test-cases/index.tsx` — 新增 AI用例 Tab
- `frontend/src/pages/requirements/detail/index.tsx` — Tab 重组、AI助手按钮、测试计划Tab、标签/备注布局调整
- `frontend/src/components/AiAssistantDrawer.tsx` — 新建 AI对话 Drawer 组件

**数据库**：
- `users` app：migration `0004` — 新增 `display_name`/`qw_username`/`team`/`leader` 字段
- `bugs` app：migration `0004` — `bug_id` 字段 `blank=True`

**依赖**：无新增第三方依赖，复用现有 Ant Design 组件
