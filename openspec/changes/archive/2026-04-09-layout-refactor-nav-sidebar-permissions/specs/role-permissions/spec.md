## ADDED Requirements

### Requirement: 菜单权限常量定义
系统 SHALL 在 `frontend/src/config/permissions.ts` 中集中定义各菜单项的可见角色列表，布局组件读取该配置动态渲染菜单。

#### Scenario: 权限常量结构
- **WHEN** 前端构建时加载权限配置
- **THEN** 配置文件导出 `MENU_PERMISSIONS` 对象，key 为菜单标识，value 为允许访问的角色数组

#### Scenario: 项目管理菜单可见性
- **WHEN** 当前用户角色为 `tester`、`tester_tl`、`product_tl`、`developer_tl`、`admin`、`super_admin`
- **THEN** 左侧菜单显示"项目管理"入口

#### Scenario: 测试管理菜单可见性
- **WHEN** 当前用户角色为 `tester`、`tester_tl`、`admin`、`super_admin`
- **THEN** 左侧菜单显示"测试管理"入口

#### Scenario: 人员管理/集成中心菜单可见性
- **WHEN** 当前用户角色为 `admin` 或 `super_admin`
- **THEN** 左侧菜单显示"人员管理"和"集成中心"入口

#### Scenario: 无权限菜单不渲染
- **WHEN** 当前用户角色不在某菜单的可见角色列表中
- **THEN** 该菜单项不渲染到 DOM（非隐藏，是不渲染）

---

### Requirement: TL 角色后端扩展
后端 `User` 模型的 `ROLE_CHOICES` SHALL 新增 `product_tl`（产品TL）、`developer_tl`（开发TL）、`tester_tl`（测试TL）三个角色值。

#### Scenario: 新角色可分配给用户
- **WHEN** 管理员在人员管理中为用户分配角色
- **THEN** 角色下拉选项中包含"产品TL"、"开发TL"、"测试TL"

#### Scenario: /auth/me/ 返回TL角色
- **WHEN** 角色为 `tester_tl` 的用户调用 `/auth/me/`
- **THEN** 响应中 `role` 字段值为 `"tester_tl"`，前端据此渲染对应权限的菜单

#### Scenario: 现有用户不受影响
- **WHEN** 执行数据库迁移后
- **THEN** 现有用户的 `role` 字段值不变，权限不受影响
