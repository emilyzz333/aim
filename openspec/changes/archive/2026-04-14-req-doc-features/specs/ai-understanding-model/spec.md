## ADDED Requirements

### Requirement: AiUnderstanding 模型存储
系统 SHALL 提供 `AiUnderstanding` 表，用于存储 AI 对需求维度上各类内容（需求文档、UI设计稿、技术方案）的多维理解记录。

**Change B 新增：图片文件引用列表**
`raw_content` 字段在图片类型（source_type=upload_image）时，存储图片相对路径列表（JSON格式字符串）。

Celery 任务实现细节：
- `apps/tasks/tasks/ai_tasks.py` 中实现 `generate_ai_understanding(understanding_id)`
- `apps/tasks/tasks/md_tasks.py` 中实现 `pull_req_md(requirement_id)` 和 `pull_tech_md(requirement_id)`

#### Scenario: 创建理解记录
- **WHEN** 系统（后端任务或接口）创建一条 AiUnderstanding 记录，指定 requirement、understand_type、source_type、source_ref
- **THEN** 记录以 `status='pending'` 保存，`is_selected=False`，`created_at`/`updated_at` 自动写入

#### Scenario: 理解记录状态流转
- **WHEN** Celery 任务开始处理某条记录
- **THEN** 记录状态更新为 `processing`；任务成功后更新为 `done` 并写入 `ai_understanding`；失败时更新为 `failed` 并写入 `error_msg`

#### Scenario: 图片路径存储格式
- **WHEN** 用户上传 3 张图片，source_type=upload_image
- **THEN** `raw_content` 存储 JSON 数组字符串：`["uploads/req_42_ui_20260409/img1.png", "uploads/req_42_ui_20260409/img2.png", "uploads/req_42_ui_20260409/img3.png"]`

#### Scenario: 同类型记录可多条并存
- **WHEN** 用户对同一需求的同一 understand_type 多次触发生成
- **THEN** 系统创建多条 AiUnderstanding 记录，每条独立保存，均可被查询和选择
