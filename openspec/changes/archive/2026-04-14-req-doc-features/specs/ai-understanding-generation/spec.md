## ADDED Requirements

### Requirement: 素材批次上传（AiInputAsset CRUD）
系统 SHALL 支持用户在需求维度的素材管理区，按批次上传图片和文字说明，并支持查看、编辑、删除已有批次。

#### Scenario: 上传新批次（图片+文字）
- **WHEN** 用户上传 3 张图片并填写批次说明"登录页+个人中心"、文字说明"重点关注跳转逻辑"，提交 `POST /api/requirements/{id}/ai-input-assets/`
- **THEN** 系统保存图片至 MEDIA_ROOT，创建 AiInputAsset 记录（file_paths 为路径列表，text_content 为文字说明），返回记录 ID 和 created_at

#### Scenario: 上传纯文字批次
- **WHEN** 用户只填写文字说明，不上传图片，提交
- **THEN** 系统创建 AiInputAsset 记录，file_paths=[]，text_content 有值

#### Scenario: 单批次图片数量限制
- **WHEN** 用户在一个批次中上传超过 10 张图片
- **THEN** 前端阻止提交，提示"单批次最多支持 10 张图片"

#### Scenario: 编辑批次内容
- **WHEN** 用户修改某条批次的 batch_desc 或 text_content，提交 `PATCH /api/requirements/ai-input-assets/{id}/`
- **THEN** 系统更新字段，updated_at 刷新，返回 HTTP 200

#### Scenario: 替换批次图片
- **WHEN** 用户为某条批次重新上传图片，提交 PATCH 含新 images[]
- **THEN** 系统删除旧文件，保存新文件，更新 file_paths，updated_at 刷新

#### Scenario: 删除素材批次
- **WHEN** 用户删除某条 AiInputAsset 记录，提交 `DELETE /api/requirements/ai-input-assets/{id}/`
- **THEN** 系统删除记录和关联文件，已使用该批次生成的 AiUnderstanding 不受影响，返回 HTTP 204

### Requirement: 多批次汇总生成 AI 理解
系统 SHALL 支持用户勾选多个 AiInputAsset 批次，将所有批次的图片和文字汇总后，异步调用 Claude Vision 生成 AiUnderstanding 记录。

#### Scenario: 多批次汇总生成
- **WHEN** 用户勾选 2 个批次（共 5 张图片），点击"用选中批次生成AI理解"，提交 `POST /api/requirements/{id}/generate-understanding/`，携带 `asset_ids=[1,2]`、`understand_type=ui_design`
- **THEN** 系统新建 AiUnderstanding 记录（input_assets 关联勾选的批次），status=pending，派发 Celery 任务，返回 understanding_id

#### Scenario: 总图片数超过 20 张时截断
- **WHEN** 用户选中的批次合计图片超过 20 张
- **THEN** Celery 任务按批次 created_at 升序取图片，超出部分忽略，prompt 中注明"部分图片已省略"

### Requirement: Celery 异步 AI 理解生成
系统 SHALL 通过 Celery 任务异步执行 AI 理解生成，不阻塞 HTTP 响应。

#### Scenario: 多批次图片 AI 理解生成（Claude Vision）
- **WHEN** Celery 任务 `generate_ai_understanding` 处理关联了多个 AiInputAsset 的 AiUnderstanding 记录
- **THEN** 读取所有批次的图片转 base64，汇总批次文字说明，构造 Claude Vision 多图消息，调用 Claude API，结果存入 `ai_understanding`，status 更新为 `done`

#### Scenario: 纯文字批次 AI 理解生成
- **WHEN** 所有选中批次均无图片（file_paths 均为空）
- **THEN** Celery 任务汇总所有 text_content，使用 AIService.complete() 生成理解，status=done

#### Scenario: AI 生成失败
- **WHEN** Claude API 调用失败（超时/限流/key无效）
- **THEN** AiUnderstanding status 更新为 `failed`，error_msg 写入具体错误信息

### Requirement: 前端轮询 AI 生成状态
系统 SHALL 支持前端通过轮询接口获取 AI 理解生成进度，直到状态变为 done 或 failed。

#### Scenario: 正常轮询完成
- **WHEN** 前端每 2s 请求 `GET /api/requirements/ai-understandings/{id}/`
- **THEN** 接口返回当前 status；当 status=done 时，前端停止轮询并展示生成的理解内容

#### Scenario: 轮询超时
- **WHEN** 前端轮询 60 次（约 2 分钟）后 status 仍为 pending/processing
- **THEN** 前端停止轮询，提示用户"生成超时，请稍后刷新重试"

### Requirement: 不重新上传直接重新生成理解
系统 SHALL 支持用户对已有 AiUnderstanding 记录，直接基于相同的 input_assets 组合重新触发 AI 生成（新建记录，不覆盖原记录）。

#### Scenario: 从表格操作列触发重新生成
- **WHEN** 用户点击 AI理解表格操作列中某条记录的"重新生成"按钮
- **THEN** 系统以该记录关联的 input_assets（或 raw_content）为基础，新建一条 AiUnderstanding 记录并派发 Celery 任务，不修改原记录；新记录插入表格并启动轮询

#### Scenario: 从行详情 Drawer 触发重新生成
- **WHEN** 用户点击行详情 Drawer 内的"重新生成"按钮
- **THEN** 同上，系统新建记录并派发任务，Drawer 关闭，新记录出现在表格中并开始轮询
