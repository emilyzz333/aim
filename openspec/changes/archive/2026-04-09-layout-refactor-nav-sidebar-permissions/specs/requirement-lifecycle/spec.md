## MODIFIED Requirements

### Requirement: 需求 CRUD
系统 SHALL 支持需求的创建、查询、更新和删除，需求包含 PRD 中定义的所有字段（名称、所属迭代/项目、优先级、负责人、时间节点、多值字段等）。

#### Scenario: 创建需求
- **WHEN** 用户提交需求基本信息至 `POST /api/requirements`
- **THEN** 系统创建需求，初始状态为"待评审"，返回 HTTP 201 及需求详情

#### Scenario: 查询需求列表（带筛选）
- **WHEN** 用户请求 `GET /api/requirements?iteration_id=<id>&status=<status>&priority=<priority>`
- **THEN** 系统返回符合条件的需求列表，支持分页，包含所有表格字段

#### Scenario: 需求搜索
- **WHEN** 用户在需求列表页通过关键词搜索
- **THEN** 系统在需求名称和描述中进行模糊匹配，返回匹配结果

#### Scenario: 需求列表按更新时间排序（默认）
- **WHEN** 用户请求 `GET /api/requirements/`，未传 `ordering` 参数
- **THEN** 系统按 `updated_at` 降序返回需求列表

#### Scenario: 需求列表支持动态排序
- **WHEN** 用户请求 `GET /api/requirements/?ordering=created_at` 或 `ordering=-priority`
- **THEN** 系统按指定字段和方向排序返回结果；支持字段：`updated_at`、`created_at`、`priority`

#### Scenario: 前端排序切换
- **WHEN** 用户在需求列表页点击排序切换控件
- **THEN** 前端携带对应 `ordering` 参数重新请求接口，列表按新排序刷新
