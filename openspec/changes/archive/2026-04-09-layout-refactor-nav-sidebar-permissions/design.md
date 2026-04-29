## Context

当前系统 (`frontend/src/layouts/index.tsx`) 使用 Ant Design 的 `Layout + Sider + Header + Content` 结构，Sider 宽度固定 220px，所有菜单项平铺在左侧，Header 仅显示通知铃铛和用户头像。后端 User 模型有6个角色，前端无集中的权限管理文件，各页面单独请求 `/auth/me/` 判断 `is_admin_or_above`。

本次变更涉及：前端布局层核心重构、路由调整、2个新页面、2个页面重构、后端角色扩展+排序支持。跨越前后端，改动文件较多，但均为 UI 层变更，不涉及数据模型结构性变化。

## Goals / Non-Goals

**Goals:**
- 顶部导航栏承载核心工作流（需求/迭代/缺陷），降低主要用户的操作路径深度
- 左侧 Sider 改为可折叠图标菜单，按角色动态显示，减少低权限用户的视觉噪音
- 迭代页改为双栏布局，直接在迭代上下文中查看需求，减少页面跳转
- 角色体系扩展支持 TL 岗位，权限逻辑集中维护在单一常量文件
- AI 用例生成能力从集成中心迁入测试管理，提升功能可发现性

**Non-Goals:**
- 不实现动态权限配置（数据库存储、管理员界面配置），权限变更通过代码发布
- 不修改后端数据访问层权限（API 仍全员可访问），仅控制前端菜单可见性
- 不重构需求详情页的整体 UI，仅新增生成AI用例入口
- 不修改缺陷（Bug）页面的功能逻辑，仅调整其导航位置

## Decisions

### D1：顶部 Tab 的显隐策略——路由感知隐藏（方案A）

**决策**：顶部"需求/迭代/缺陷"Tab 仅在对应三个路由（`/requirements`、`/iterations`、`/bugs`）时显示，进入左侧其他菜单页面时隐藏 Tab，Header 退回为纯信息栏。

**理由**：
- 进入仪表盘、测试管理等功能页时，顶部 Tab 与当前上下文无关，显示会造成误导
- 方案B（始终显示）虽然实现更简单，但 Tab 激活状态无法与左侧菜单状态保持一致，视觉逻辑混乱

**实现**：在 `layouts/index.tsx` 中用 `useLocation` 判断当前路径，动态渲染顶部 Tab 区域。

---

### D2：权限管理——前端常量文件，不引入后端属性

**决策**：新建 `frontend/src/config/permissions.ts`，用 `Record<string, string[]>` 结构存储各菜单的可见角色列表。布局组件读取 `currentUser.role` 做 `includes()` 判断。

**理由**：
- TL 权限差异仅体现在菜单可见性（UI 层），后端 API 数据访问无需区分
- 添加 `is_tl / can_see_project` 等属性会使 User 模型承担不属于它的 UI 关注点
- 权限变化频率极低，常量文件 + 代码发布的成本完全可接受
- 所有权限逻辑集中在一处，比散落在各组件中的 `is_admin_or_above` 判断更易审计

**备选**：数据库配置化权限（Casbin / 自建 RolePermission 表）—— 复杂度远超收益，排除。

---

### D3：迭代视图布局——三栏（左侧图标菜单 + 迭代列表 + 需求内容）

**决策**：迭代页面在全局 Sider 内嵌套一个二级面板，展示迭代列表（宽约 200px），右侧主内容区展示选中迭代的需求列表。

**实现**：
- 迭代列表面板放在页面组件内部（`pages/iterations/index.tsx`），而非全局 Layout
- 全局 Sider 折叠状态不影响迭代列表面板的独立展开/折叠
- 默认选中最近一个"进行中"（`status=active`）的迭代

---

### D4：需求排序——后端支持 ordering，前端默认 -updated_at

**决策**：后端 `requirements/views.py` 的 `get_queryset` 读取 `ordering` query param，默认值为 `-updated_at`。前端需求列表提供排序切换控件（更新时间/创建时间/优先级）。

**理由**：分页场景下排序必须在后端处理，前端排序仅对当前页有效，会造成数据错乱。

---

### D5：AI用例迁移——双入口（测试管理Tab + 需求详情按钮）

**决策**：两个思路均实现：
- 思路A：`test-cases/index.tsx` 新增"AI用例"Tab，包含完整的 AI 测试用例生成表单（迁自 `integrations/AITab`）
- 思路B：`requirements/detail/index.tsx` 新增"生成AI用例"按钮，调用 `/integrations/ai/test-case-generation/`，结果以 `source=ai, reviewed=pending` 通过 `/test-cases/` API 保存

**理由**：测试人员从测试管理入口批量生成；产品/开发在查看需求时可直接触发生成，两种工作流均有价值。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| 布局重构影响所有已有页面的视觉呈现 | 逐页验证，重点测试 requirements/iterations/test-cases 三个核心页面 |
| 迭代双栏布局在小屏（<1280px）下空间不足 | 迭代列表面板默认宽 200px，设置 `overflow: auto`，小屏可折叠该面板 |
| 顶部 Tab 隐藏逻辑依赖路由字符串匹配，路由变更可能导致 Tab 不显示 | 将匹配路径集中为常量 `const TOP_NAV_ROUTES = ['/requirements', '/iterations', '/bugs']` |
| 角色扩展后旧用户数据中 `role` 字段仍为旧值，新 TL 角色需手动分配 | 迁移无破坏性（仅扩展枚举值域），现有用户权限不受影响；管理员在人员管理中手动更新角色 |
| AI 用例生成结果保存到 `/test-cases/` 需要 `project` 字段（必填），需求详情入口如何自动带入项目 | 需求对象上有 `project` 字段，生成时从需求上下文自动带入，无需用户选择 |

## Migration Plan

1. 后端先行：执行 `makemigrations` + `migrate`（角色字段值域扩展，无破坏性）
2. 后端部署 `requirements/views.py` 排序支持
3. 前端按任务顺序实施（权限常量 → 布局 → 路由 → 各页面）
4. 回滚策略：前端变更均在同一 git 分支，如有问题直接回退分支；后端迁移可通过删除新角色记录回滚（无数据丢失）

## Open Questions

- 迭代双栏布局中，若用户尚无任何迭代，右侧默认展示什么？（建议：空状态提示 + 新建迭代引导）--按建议
- 主页（/home）的统计数是实时查询还是缓存？（建议：实时查询，数据量小无性能压力）：按建议
