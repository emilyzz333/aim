## 1. 后端：角色扩展与排序支持

- [x] 1.1 在 `backend/apps/users/models.py` 的 `ROLE_CHOICES` 新增 `product_tl`（产品TL）、`developer_tl`（开发TL）、`tester_tl`（测试TL）三个角色
- [x] 1.2 执行 `python manage.py makemigrations users` 生成迁移文件
- [x] 1.3 执行 `python manage.py migrate` 应用迁移
- [x] 1.4 在 `backend/apps/requirements/views.py` 的 `get_queryset` 中新增 `ordering` 参数支持，默认值为 `-updated_at`，支持字段：`updated_at`、`created_at`、`priority`

## 2. 前端：权限常量文件

- [x] 2.1 新建 `frontend/src/config/permissions.ts`，定义 `ROLES` 常量（9个角色值）和 `MENU_PERMISSIONS` 对象（各菜单可见角色列表）
- [x] 2.2 验证权限矩阵：项目管理（tester/tester_tl/product_tl/developer_tl/admin/super_admin）、测试管理（tester/tester_tl/admin/super_admin）、人员管理/集成中心（admin/super_admin）

## 3. 前端：整体布局重构

- [x] 3.1 重构 `frontend/src/layouts/index.tsx`：整体结构改为顶部 Header + 左侧可折叠 Sider + Content
- [x] 3.2 实现 Sider 折叠/展开功能：折叠时宽 64px 仅图标，展开时宽 200px 图标+文字；折叠状态存入 `localStorage`
- [x] 3.3 实现顶部"需求/迭代/缺陷"Tab 的路由感知显隐逻辑：定义 `TOP_NAV_ROUTES = ['/requirements', '/iterations', '/bugs']`，用 `useLocation` 判断当前路由
- [x] 3.4 实现左侧菜单项按 `currentUser.role` 读取 `MENU_PERMISSIONS` 动态渲染（不渲染无权限菜单项）
- [x] 3.5 左侧菜单项构成：主页（/home）、仪表盘（/dashboard）、项目管理（/projects）、测试管理（/test-cases）、人员管理（/users）、集成中心（/integrations）
- [x] 3.6 在 Header 中将"需求/迭代/缺陷"Tab 改为 `antd Menu`（`mode="horizontal"`），正确高亮当前激活项

## 4. 前端：路由调整

- [x] 4.1 修改 `frontend/src/App.tsx`：根路径 `/` 重定向至 `/requirements`
- [x] 4.2 新增 `/home` 路由，对应新建的 `HomePage` 组件
- [x] 4.3 确认 `/bugs` 路由保留（全员可见），并加入顶部导航 Tab

## 5. 前端：新建主页

- [x] 5.1 新建 `frontend/src/pages/home/index.tsx`，展示需求/迭代/缺陷三张入口卡片
- [x] 5.2 主页加载时分别请求 `/requirements/`、`/iterations/`、`/bugs/` 获取统计数（未完成需求数、进行中迭代数、未修复缺陷数）
- [x] 5.3 点击各卡片跳转至对应路由（`/requirements`、`/iterations`、`/bugs`）

## 6. 前端：迭代页双栏布局重构

- [x] 6.1 重构 `frontend/src/pages/iterations/index.tsx` 为双栏布局：左侧迭代列表面板（约 200px）+ 右侧需求内容区
- [x] 6.2 左侧迭代列表：加载所有迭代，顶部提供项目筛选下拉框，列表项显示迭代名称和状态标签
- [x] 6.3 默认选中第一个 `status=active` 的迭代；无进行中迭代则选中第一项；列表为空展示空状态+新建引导
- [x] 6.4 右侧需求列表：根据选中迭代 ID 请求 `/requirements/?iteration_id=<id>`，展示需求列表（编号/名称/状态/优先级/负责人）
- [x] 6.5 右侧需求列表支持状态筛选和关键词搜索
- [x] 6.6 右侧"新建需求"按钮打开新建表单时，所属迭代字段自动预填为当前选中迭代

## 7. 前端：需求列表排序

- [x] 7.1 修改 `frontend/src/pages/requirements/index.tsx`：默认请求携带 `ordering=-updated_at` 参数
- [x] 7.2 在筛选栏新增排序切换控件（Select），选项：更新时间（-updated_at）、创建时间（-created_at）、优先级（-priority）
- [x] 7.3 切换排序字段时重新请求接口，列表刷新

## 8. 前端：测试管理新增AI用例Tab

- [x] 8.1 修改 `frontend/src/pages/test-cases/index.tsx`：在现有 Tab 列表（测试用例/测试计划）后新增"AI用例"Tab
- [x] 8.2 AI用例 Tab 内容：迁入 `integrations/AITab` 中的 AI 测试用例生成功能（需求ID输入、MD内容输入、生成按钮、结构化结果展示）
- [x] 8.3 在 AI 用例结果列表每行新增"保存到用例库"按钮，调用 `POST /test-cases/` 保存，携带 `source=ai`、`reviewed=pending`、`project`（需用户选择或从上下文带入）

## 9. 前端：需求详情新增生成AI用例入口

- [x] 9.1 修改 `frontend/src/pages/requirements/detail/index.tsx`：在详情页操作区新增"生成AI用例"按钮
- [x] 9.2 点击按钮调用 `/integrations/ai/test-case-generation/`（自动传入当前需求ID），生成结果在 Modal 中展示
- [x] 9.3 Modal 中提供"保存全部"按钮，批量调用 `POST /test-cases/`，携带 `source=ai`、`reviewed=pending`、`requirement=<需求ID>`、`project=<需求项目ID>`
- [x] 9.4 保存成功后 Modal 提示"AI用例已保存，审核状态：待审核"

## 10. 前端：人员管理角色选项更新

- [x] 10.1 修改 `frontend/src/pages/users/index.tsx`：`ROLE_MAP` 新增三个TL角色的显示名和颜色
- [x] 10.2 确认用户创建/编辑表单的角色下拉选项包含新增的三个TL角色

## 11. 验证与收尾

- [ ] 11.1 验证不同角色登录后左侧菜单显示正确（用 product_manager / tester / tester_tl / admin 各测一次）
- [ ] 11.2 验证顶部 Tab 在需求/迭代/缺陷页面显示，进入仪表盘/测试管理后隐藏
- [ ] 11.3 验证迭代双栏布局：切换迭代时右侧需求列表正确刷新
- [ ] 11.4 验证 AI 用例生成并保存后，在测试管理"测试用例"Tab 中 `source=AI生成`、`reviewed=待审核`
- [ ] 11.5 验证需求列表默认按更新时间降序，排序切换控件生效
