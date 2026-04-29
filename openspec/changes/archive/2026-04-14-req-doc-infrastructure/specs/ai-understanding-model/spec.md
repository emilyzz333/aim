## ADDED Requirements

### Requirement: AiInputAsset 素材批次模型
系统 SHALL 提供 `AiInputAsset` 表，用于按批次存储用户积累的素材（图片+文字），每条记录对应用户的一次有意识的"投喂动作"，支持增删改，是 AI 理解生成的原料管理层。

#### Scenario: 创建素材批次（图片+文字）
- **WHEN** 用户一次上传 3 张图片并填写说明"登录页+个人中心设计稿"，提交
- **THEN** 系统创建一条 AiInputAsset 记录，`file_paths=["path1.png","path2.png","path3.png"]`，`text_content="登录页+个人中心设计稿"`，`batch_desc` 由用户填写或自动生成，返回记录 ID

#### Scenario: 创建纯文字素材批次
- **WHEN** 用户只填写文字说明"重点关注登录后的跳转逻辑"，不上传图片
- **THEN** 系统创建一条 AiInputAsset 记录，`file_paths=[]`，`text_content="重点关注登录后的跳转逻辑"`

#### Scenario: 编辑批次说明或文字内容
- **WHEN** 用户修改某条 AiInputAsset 的 `batch_desc` 或 `text_content`，提交 PATCH
- **THEN** 系统更新对应字段，`updated_at` 自动刷新，返回 HTTP 200

#### Scenario: 替换批次图片
- **WHEN** 用户重新上传图片至某条 AiInputAsset
- **THEN** 系统删除旧文件，保存新文件，更新 `file_paths`，`updated_at` 刷新

#### Scenario: 删除素材批次
- **WHEN** 用户删除某条 AiInputAsset 记录
- **THEN** 系统删除记录及关联文件，已使用该批次生成的 AiUnderstanding 记录不受影响（M2M 关系断开但记录保留）

### Requirement: AiUnderstanding 模型存储
系统 SHALL 提供 `AiUnderstanding` 表，用于存储 AI 对需求维度上各类内容（需求文档、UI设计稿、技术方案）的多维理解记录，每条记录关联到一个需求，支持多次生成、状态追踪和用户选优；通过 M2M 关联 AiInputAsset 记录哪些素材批次参与了本次生成。

#### Scenario: 创建理解记录
- **WHEN** 系统（后端任务或接口）创建一条 AiUnderstanding 记录，指定 requirement、understand_type、source_type、source_ref
- **THEN** 记录以 `status='pending'` 保存，`is_selected=False`，`created_at`/`updated_at` 自动写入

#### Scenario: 理解记录关联素材批次
- **WHEN** 用户选择多条 AiInputAsset 批次，触发 AI 理解生成
- **THEN** 新建 AiUnderstanding 记录，`input_assets` M2M 关联选中的所有批次 ID，Celery 任务读取这些批次的所有图片和文字进行汇总理解

#### Scenario: 理解记录状态流转
- **WHEN** Celery 任务开始处理某条记录
- **THEN** 记录状态更新为 `processing`；任务成功后更新为 `done` 并写入 `ai_understanding`；失败时更新为 `failed` 并写入 `error_msg`

#### Scenario: 同类型记录可多条并存
- **WHEN** 用户对同一需求的同一 understand_type 多次触发生成（不同素材组合或重新生成）
- **THEN** 系统创建多条 AiUnderstanding 记录，每条独立保存，均可被查询和选择

### Requirement: AiUnderstanding 用户选优
系统 SHALL 支持用户在同一 `(requirement, understand_type)` 组合下选择一条记录为"最优理解"，选中后将该记录的 `ai_understanding` 写入 `Requirement.req_understanding`。

#### Scenario: 选中某条理解为最优
- **WHEN** 用户请求将某条 `AiUnderstanding` 记录标记为 `is_selected=True`
- **THEN** 系统将同 requirement + 同 understand_type 下所有其他记录的 `is_selected` 设为 False，将本条设为 True，并将 `ai_understanding` 内容写入 `Requirement.req_understanding`，返回 HTTP 200

#### Scenario: 同类型只有一条被选中
- **WHEN** 同一需求的同一 understand_type 已有一条 is_selected=True 的记录，用户选中另一条
- **THEN** 原来选中的记录 is_selected 变为 False，新选中的记录 is_selected 变为 True

### Requirement: AiUnderstanding 内容手动编辑
系统 SHALL 允许用户直接编辑某条 AiUnderstanding 记录的 `ai_understanding` 字段内容。

#### Scenario: 编辑理解内容
- **WHEN** 用户提交 `PATCH /api/requirements/ai-understandings/{id}/`，携带更新后的 `ai_understanding` 文本
- **THEN** 系统保存更新内容，更新 `updated_at`，返回 HTTP 200

### Requirement: AiUnderstanding 列表查询
系统 SHALL 支持按需求 ID 和 understand_type 查询 AiUnderstanding 记录列表，按 `created_at` 降序排列。

#### Scenario: 查询某需求的理解列表
- **WHEN** 用户请求 `GET /api/requirements/{id}/ai-understandings/?type=req_md`
- **THEN** 系统返回该需求下 understand_type=req_md 的所有记录，按创建时间降序，包含 status、is_selected、created_at、updated_at、关联的 input_assets ID 列表字段
