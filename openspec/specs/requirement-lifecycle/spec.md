## ADDED Requirements

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

### Requirement: 需求生命周期状态流转
系统 SHALL 实现 11 个状态的流转控制，合法流转路径如下：
- 待评审 → 待技评（产品评审通过）
- 待技评 → 待开发（技评通过）
- 待开发 → 开发中（开发人员领取任务）
- 开发中 → 待测试（开发完成）
- 待测试 → 测试中（开始测试）
- 待测试 → 开发中（驳回，需填写驳回原因）
- 测试中 → 待验收（测试通过）
- 待验收 → 待上线（验收通过）
- 待上线 → 待回归（上线完成）
- 待回归 → 已完成（回归通过）
- 任意状态 → 关闭（异常关闭）

#### Scenario: 合法状态流转
- **WHEN** 用户请求 `POST /api/requirements/:id/change-status`，提交合法的目标状态
- **THEN** 系统更新需求状态，写入 ChangeLog（field=status），返回 HTTP 200

#### Scenario: 非法状态流转
- **WHEN** 用户尝试将需求从"待评审"直接跳转至"待上线"
- **THEN** 系统返回 HTTP 400，提示非法状态流转

#### Scenario: 任意状态关闭
- **WHEN** 用户提交目标状态为"关闭"
- **THEN** 系统允许流转，更新状态并写入 ChangeLog

### Requirement: 待测试驳回至开发中
系统 SHALL 支持测试人员在"待测试"状态将需求驳回至"开发中"，驳回时 MUST 填写驳回原因，系统写入两条 ChangeLog：一条记录 status 变更，一条记录 reject_reason。

#### Scenario: 驳回成功
- **WHEN** 测试人员请求 `POST /api/requirements/:id/change-status`，目标状态为"开发中"，且请求体包含非空 `reject_reason`
- **THEN** 系统将需求状态更新为"开发中"，写入两条 ChangeLog：`{field: "status", old_value: "待测试", new_value: "开发中"}` 和 `{field: "reject_reason", old_value: null, new_value: "<驳回原因>"}，返回 HTTP 200`

#### Scenario: 驳回未填原因
- **WHEN** 测试人员提交驳回请求但 `reject_reason` 为空或缺失
- **THEN** 系统返回 HTTP 400，提示"驳回原因不能为空"

#### Scenario: 非待测试状态不可驳回
- **WHEN** 用户在非"待测试"状态尝试将需求流转至"开发中"
- **THEN** 系统返回 HTTP 400，提示非法状态流转

### Requirement: 开发中阻塞标记
系统 SHALL 支持在需求处于"开发中"状态时标记为阻塞状态，阻塞标记不改变主状态，写入 ChangeLog。

#### Scenario: 标记阻塞
- **WHEN** 开发人员请求更新需求的 `is_blocked` 字段为 true，并填写阻塞原因
- **THEN** 系统保存阻塞标记和原因，写入 ChangeLog（field=is_blocked），需求主状态保持"开发中"，返回 HTTP 200

#### Scenario: 解除阻塞
- **WHEN** 开发人员将 `is_blocked` 更新为 false
- **THEN** 系统清除阻塞标记，写入 ChangeLog，返回 HTTP 200

### Requirement: 已完成需求归档
系统 SHALL 支持对"已完成"状态的需求执行归档操作，归档后需求默认不出现在活跃列表中。

#### Scenario: 归档需求
- **WHEN** 项目经理或管理员对已完成需求执行归档操作
- **THEN** 系统将需求 `is_archived` 置为 true，返回 HTTP 200

#### Scenario: 归档需求不出现在默认列表
- **WHEN** 用户请求 `GET /api/requirements`（不带 `include_archived=true` 参数）
- **THEN** 系统返回列表中不包含已归档需求

### Requirement: 变更历史审计（ChangeLog）
系统 SHALL 在需求任意字段发生变更时，自动记录变更人、变更时间、变更字段、旧值和新值。

#### Scenario: 字段变更记录
- **WHEN** 用户更新需求的状态、负责人或时间节点等字段
- **THEN** 系统在 ChangeLog 表中写入一条记录，包含 `target_type=requirement`、`target_id`、`field`、`old_value`、`new_value`、`changed_by`、`changed_at`

#### Scenario: 查看变更历史
- **WHEN** 用户在需求详情页查看变更记录
- **THEN** 系统返回该需求所有 ChangeLog，按时间倒序排列

### Requirement: MD 文档上传
系统 SHALL 支持为需求上传需求 MD 文档（requirement_md）和技术 MD 文档（technical_md）。

#### Scenario: 上传需求 MD
- **WHEN** 用户请求 `POST /api/requirements/:id/upload-md`，提交 MD 内容
- **THEN** 系统更新需求的 `requirement_md` 字段，返回 HTTP 200

### Requirement: GitLab 分支与 Commit 关联
系统 SHALL 支持在需求上关联多个 GitLab 分支和 Commit ID（JSON 多值存储）。

#### Scenario: 关联 GitLab 分支
- **WHEN** 开发人员更新需求的 `gitlab_branch` 字段，传入分支名数组
- **THEN** 系统存储分支信息，返回 HTTP 200

### Requirement: 子需求管理
系统 SHALL 支持在需求下创建、编辑、删除子需求，子需求包含名称、描述、状态和负责人。

#### Scenario: 创建子需求
- **WHEN** 用户在需求详情页创建子需求
- **THEN** 系统创建子需求记录，关联到父需求，返回 HTTP 201

#### Scenario: 查询子需求列表
- **WHEN** 用户请求 `GET /api/requirements/:id`
- **THEN** 响应体包含该需求下所有子需求列表

### Requirement: 从 TAPD 拉取需求
系统 SHALL 支持通过 TAPD 集成接口将 TAPD 中的需求导入到本平台。

#### Scenario: 拉取 TAPD 需求
- **WHEN** 用户请求 `GET /api/tapd/requirements`
- **THEN** 系统调用 TAPD API 返回需求列表，供用户选择导入

#### Scenario: 同步 TAPD 需求
- **WHEN** 用户选择需求并触发 `POST /api/tapd/sync`
- **THEN** 系统将选中需求写入本地 Requirement 表，返回导入结果
