## ADDED Requirements

### Requirement: UI 设计稿 Tab 展示
系统 SHALL 在需求详情页新增"UI设计稿"Tab，展示 Web 端和 App 端的设计稿链接，支持 Figma iframe 嵌入预览。

#### Scenario: 展示 Web 端 Figma 链接并 iframe 预览
- **WHEN** 需求 `ui_design_web` 字段包含 figma.com 域名的链接
- **THEN** Tab 内显示链接旁有"嵌入预览"按钮，点击展开 Figma embed iframe

#### Scenario: 展示 Lanhu 链接（非 Figma）
- **WHEN** 需求 `ui_design_web` 或 `ui_design_app` 字段包含非 figma.com 的链接（如 Lanhu）
- **THEN** 只显示"打开链接"按钮，不显示 iframe 预览按钮（Lanhu 不支持嵌入）

#### Scenario: 编辑 UI 设计稿链接
- **WHEN** 用户在 UI设计稿 Tab 内点击 Web 端链接区域，输入新的 URL 并保存
- **THEN** 系统调用 `PATCH /api/requirements/{id}/`，更新 `ui_design_web` 字段，返回 HTTP 200

### Requirement: UI 设计稿素材批次管理
系统 SHALL 在 UI设计稿 Tab 内提供 AiInputAssetManager 区域，支持用户分批上传截图和文字说明。

#### Scenario: 上传截图批次
- **WHEN** 用户在 UI设计稿 Tab 上传多张截图并附带说明文字，提交
- **THEN** 系统创建 understand_type=ui_design 的 AiInputAsset 批次记录，图片保存至文件存储，返回批次 ID

#### Scenario: 勾选批次生成 AI 理解
- **WHEN** 用户在素材管理区勾选一个或多个 AiInputAsset 批次，点击"用选中批次生成AI理解"
- **THEN** 系统新建 understand_type=ui_design 的 AiUnderstanding 记录（M2M 关联选中批次），派发 Celery 任务，前端启动轮询

### Requirement: UI 设计稿 AI 理解列表（表格形式）
系统 SHALL 在 UI设计稿 Tab 内以表格形式展示 understand_type=ui_design 的 AiUnderstanding 记录，点击行展开详情 Drawer。

#### Scenario: 表格展示 AI 理解记录
- **WHEN** 用户进入 UI设计稿 Tab
- **THEN** 系统加载该需求 understand_type=ui_design 的所有 AiUnderstanding 记录，以表格展示：★（是否最优）、来源类型 badge、描述/备注、状态、更新时间、操作列（选/删）

#### Scenario: 最优理解置顶展示
- **WHEN** 用户进入 UI设计稿 Tab 且存在 is_selected=True 的记录
- **THEN** 表格上方"★ 最优理解区"展示该记录的来源类型、备注、AI理解全文、操作按钮（编辑/取消选中/删除）

#### Scenario: 点击表格行展开 Drawer
- **WHEN** 用户点击表格中某条 AiUnderstanding 记录
- **THEN** 右侧 Drawer 展开，展示：来源信息（类型/批次数）、备注（可编辑）、原始内容区（折叠，图片缩略图网格+文字说明）、AI理解文本（可编辑）、[重新生成] 按钮

#### Scenario: 选中某条理解为最优
- **WHEN** 用户点击某条记录的"选为最优"（表格操作列或 Drawer 内）
- **THEN** 系统调用选优接口，该条记录 is_selected=True，其余同类型记录 is_selected=False，`Requirement.req_understanding` 写入该理解内容

#### Scenario: 点击"生成新理解"按钮
- **WHEN** 用户点击表格右上角"生成新理解"按钮
- **THEN** 在表格下方展开 AiInputAssetManager 面板（素材批次管理区），用户勾选批次后确认生成
