## ADDED Requirements

### Requirement: 项目 CRUD（含权限控制）
系统 SHALL 支持项目的创建、查询、更新和删除操作。所有登录用户可查看项目列表，仅管理员和超级管理员可创建、编辑和删除项目。

#### Scenario: 创建项目（管理员）
- **WHEN** 管理员提交项目名称和描述至 `POST /api/projects`
- **THEN** 系统创建项目记录，返回 HTTP 201 及项目详情

#### Scenario: 非管理员尝试创建项目
- **WHEN** 角色为开发人员的用户请求 `POST /api/projects`
- **THEN** 系统返回 HTTP 403

#### Scenario: 获取项目列表
- **WHEN** 任意登录用户请求 `GET /api/projects`
- **THEN** 系统返回所有项目列表（支持分页），普通用户只能查看，不能操作

#### Scenario: 删除项目
- **WHEN** 管理员请求 `DELETE /api/projects/:id`
- **THEN** 系统软删除该项目，返回 HTTP 204

### Requirement: 模块管理（多层级树状结构）
系统 SHALL 支持项目下的多层级模块管理，模块使用 `parent_id` 自引用构成无限层级树结构。模块有独立管理页面，支持模块的创建、编辑、删除和层级调整。

#### Scenario: 创建根模块
- **WHEN** 项目经理或管理员提交模块名称和 `project_id`（`parent_id` 为 null）至 `POST /api/modules`
- **THEN** 系统创建根级模块，返回 HTTP 201

#### Scenario: 创建子模块
- **WHEN** 用户提交模块名称、`project_id` 和非空 `parent_id` 至 `POST /api/modules`
- **THEN** 系统创建子模块，挂载到指定父模块下，返回 HTTP 201

#### Scenario: 查询项目模块树
- **WHEN** 用户请求 `GET /api/modules?project_id=<id>`
- **THEN** 系统返回该项目完整模块树（嵌套 JSON 结构，含各节点的 id、name、parent_id、children）

#### Scenario: 删除含子模块的模块
- **WHEN** 用户尝试删除含有子模块的模块
- **THEN** 系统返回 HTTP 400，提示"请先删除子模块"

#### Scenario: 前端模块管理页展示
- **WHEN** 用户进入项目的模块管理页
- **THEN** 系统以树形组件展示模块层级结构，支持拖拽调整顺序和层级（或通过上移/下移按钮）

### Requirement: 迭代 CRUD
系统 SHALL 支持迭代的创建、查询、更新和删除，迭代必须归属于某个项目，包含开始/结束日期和状态。

#### Scenario: 创建迭代
- **WHEN** 用户提交迭代名称、所属项目、开始日期和结束日期至 `POST /api/iterations`
- **THEN** 系统创建迭代，返回 HTTP 201

#### Scenario: 查询项目下所有迭代
- **WHEN** 用户请求 `GET /api/iterations?project_id=<id>`
- **THEN** 系统返回该项目下所有迭代列表，按开始日期排序

### Requirement: 迭代状态管理
系统 SHALL 支持迭代状态流转（计划中、进行中、已完成），并记录状态变更时间。

#### Scenario: 更新迭代状态
- **WHEN** 项目经理请求 `PUT /api/iterations/:id` 更新 status 字段
- **THEN** 系统更新迭代状态，返回 HTTP 200

### Requirement: 迭代进度跟踪
系统 SHALL 在迭代详情中展示需求完成率（已完成需求数 / 总需求数）。

#### Scenario: 查看迭代统计
- **WHEN** 用户请求 `GET /api/iterations/:id`
- **THEN** 系统返回迭代信息，包含 `total_requirements`、`completed_requirements` 和 `completion_rate` 字段

### Requirement: 需求分配到迭代
系统 SHALL 支持将需求关联到指定迭代，同一需求只能属于一个迭代。

#### Scenario: 分配需求到迭代
- **WHEN** 用户更新需求的 `iteration_id` 字段
- **THEN** 系统更新需求所属迭代，返回 HTTP 200
