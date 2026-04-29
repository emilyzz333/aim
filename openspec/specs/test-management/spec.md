## ADDED Requirements

### Requirement: 测试用例 CRUD
系统 SHALL 支持测试用例的创建、查询、更新和删除，用例包含标题、步骤、预期结果、所属模块/需求、平台、状态、来源、审核状态等字段。

#### Scenario: 创建测试用例
- **WHEN** 测试人员提交用例信息至 `POST /api/test-cases`
- **THEN** 系统创建用例，`source` 默认为"新建"，返回 HTTP 201

#### Scenario: 按模块/需求查询用例
- **WHEN** 用户请求 `GET /api/test-cases?module_id=<id>&requirement_id=<id>`
- **THEN** 系统返回符合条件的用例列表（支持分页）

#### Scenario: 软删除测试用例
- **WHEN** 用户请求 `DELETE /api/test-cases/:id`
- **THEN** 系统将 `is_delete` 置为 true，用例不再出现在列表中，返回 HTTP 204

### Requirement: 测试用例执行
系统 SHALL 支持对测试用例进行执行操作，记录执行结果（通过/失败/阻塞）。

#### Scenario: 执行测试用例
- **WHEN** 测试人员更新用例的 `status` 字段为执行结果
- **THEN** 系统更新用例状态，返回 HTTP 200

### Requirement: 自动化测试关联字段
系统 SHALL 在测试用例模型中保留 `api_test`（关联接口自动化）和 `ui_test`（关联 UI 自动化）字段，当前阶段作为文本/ID 记录字段使用，不触发外部调用。自动化测试执行与结果展示能力由后期 AI 集成实现。

#### Scenario: 记录自动化测试关联
- **WHEN** 测试人员在用例上填写 `api_test` 或 `ui_test` 字段值
- **THEN** 系统存储该字段值，在用例详情页展示

#### Scenario: 自动化触发（后期实现）
- **WHEN** 用户点击"触发自动化"按钮（后期功能）
- **THEN** 系统预留接口 `POST /api/test-cases/:id/run-automation`，当前返回 HTTP 501（未实现）

### Requirement: AI 生成测试用例
系统 SHALL 支持通过 AI 接口根据需求描述自动生成测试用例，生成的用例 `source` 字段标记为"AI 生成"。

#### Scenario: AI 生成用例
- **WHEN** 用户请求 AI 生成，提交需求 ID 或需求描述文本
- **THEN** 系统调用 AI 服务，返回结构化测试用例列表，用户确认后批量写入数据库

### Requirement: 缺陷 CRUD
系统 SHALL 支持缺陷的创建、查询、更新和删除，缺陷包含标题、描述、严重程度、状态、负责人、报告人、发现环境、缺陷类型、归属团队、来源等字段。

#### Scenario: 提报缺陷
- **WHEN** 测试人员提交缺陷信息至 `POST /api/bugs`
- **THEN** 系统创建缺陷记录，初始状态为"待处理"，返回 HTTP 201

#### Scenario: 查询缺陷列表（带筛选）
- **WHEN** 用户请求 `GET /api/bugs?status=<status>&severity=<severity>&group=<group>`
- **THEN** 系统返回符合条件的缺陷列表

#### Scenario: 更新缺陷状态
- **WHEN** 开发人员将缺陷状态更新为"已解决"
- **THEN** 系统更新缺陷状态，写入 ChangeLog，返回 HTTP 200

### Requirement: 缺陷关联需求
系统 SHALL 支持缺陷关联到对应需求，在需求详情页展示关联缺陷列表。

#### Scenario: 关联缺陷到需求
- **WHEN** 测试人员在缺陷上设置 `requirement_id`
- **THEN** 系统建立关联，在需求详情的"关联缺陷"标签页中展示该缺陷

### Requirement: 测试计划
系统 SHALL 支持创建测试计划，关联需求和测试用例，跟踪测试进度。

#### Scenario: 创建测试计划
- **WHEN** 测试负责人创建测试计划，选择关联需求和用例范围
- **THEN** 系统创建测试计划记录，展示计划执行进度

### Requirement: 测试报告
系统 SHALL 支持基于测试计划生成测试报告，包含用例总数、通过数、失败数、缺陷数和测试覆盖率。

#### Scenario: 生成测试报告
- **WHEN** 用户请求生成指定测试计划的测试报告
- **THEN** 系统聚合统计数据，返回包含覆盖率、通过率、缺陷分布等指标的报告

### Requirement: 测试管理AI用例Tab
测试管理页面（`/test-cases`）SHALL 新增"AI用例"Tab，提供完整的 AI 测试用例生成功能，将集成中心的 AI 测试用例生成能力迁入。

#### Scenario: 进入AI用例Tab
- **WHEN** 测试人员（或管理员）进入测试管理页，点击"AI用例"Tab
- **THEN** 展示 AI 测试用例生成表单，包含：需求ID输入框、需求MD上传/输入、技术MD上传/输入、生成按钮

#### Scenario: AI生成测试用例并展示
- **WHEN** 用户填写需求ID（或MD内容）后点击"生成测试用例"
- **THEN** 调用 `/integrations/ai/test-case-generation/` 接口，生成结果以结构化用例列表展示（用例名称/前置条件/步骤/预期结果）

#### Scenario: 将AI用例保存到测试用例库
- **WHEN** 用户在AI用例结果列表中点击"保存到用例库"
- **THEN** 以 `source=ai`、`reviewed=pending` 调用 `POST /test-cases/` 保存，保存成功后在"测试用例"Tab中可见，审核状态显示"待审核"

---

### Requirement: 需求详情AI用例生成入口
需求详情页 SHALL 提供"生成AI用例"快捷按钮，一键触发 AI 生成并保存，无需跳转到测试管理页。

#### Scenario: 需求详情页生成AI用例
- **WHEN** 用户在需求详情页点击"生成AI用例"按钮
- **THEN** 调用 `/integrations/ai/test-case-generation/`（自动传入当前需求ID），生成结果弹窗展示

#### Scenario: 从需求详情保存AI用例
- **WHEN** 用户在弹窗中确认保存生成的用例
- **THEN** 以 `source=ai`、`reviewed=pending`、`requirement=<当前需求ID>`、`project=<需求所属项目ID>` 调用 `POST /test-cases/` 保存，提示"AI用例已保存，审核状态：待审核"
