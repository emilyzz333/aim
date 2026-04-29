## ADDED Requirements

### Requirement: 主页入口卡片
系统 SHALL 在 `/home` 路由下提供主页，展示需求、迭代、缺陷三张统计入口卡片，左侧菜单"主页"图标点击进入。

#### Scenario: 主页展示三张卡片
- **WHEN** 用户进入 `/home` 页面
- **THEN** 页面展示三张并排卡片：需求（显示未完成需求总数）、迭代（显示进行中迭代数）、缺陷（显示未修复缺陷数）

#### Scenario: 点击卡片跳转对应页面
- **WHEN** 用户点击"需求"卡片
- **THEN** 路由跳转至 `/requirements`

#### Scenario: 点击迭代/缺陷卡片跳转
- **WHEN** 用户点击"迭代"卡片
- **THEN** 路由跳转至 `/iterations`

#### Scenario: 统计数实时查询
- **WHEN** 主页加载时
- **THEN** 分别调用 `/requirements/`、`/iterations/`、`/bugs/` 接口获取统计数，加载中显示骨架屏或 loading 状态
